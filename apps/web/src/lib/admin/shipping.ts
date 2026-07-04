/**
 * Admin shipping / fulfilment console (HANDOFF-Shipping.md). A manual, audited,
 * monotonic-guarded shipment console over `shipments` + `shipment_events`, behind
 * the `ShippingProvider` abstraction (mock-first). Correctness rules:
 *  - ONE active shipment per order (`shipments_one_active_idx`); AWB is UNIQUE —
 *    both surface as clean 400s via `withConstraintMapping`, never a 500.
 *  - Status is MONOTONIC (`canAdvanceShipment`): never regress, never post-terminal.
 *  - When a shipment advances, MIRROR the order via the shared order state-machine
 *    write (`applyOrderTransitionTx`) — never hand-roll order status writes; an
 *    illegal mirror surfaces INVALID_TRANSITION instead of being forced.
 *  - Every lock-select that JOINs `orders` uses `.for('update', { of: shipments })`
 *    (FOR UPDATE on the nullable side of a join → `0A000`).
 *  - Every mutation is `isUuid`-guarded, audited in-tx, and logs a `shipment_events` row.
 *
 * The live Shiprocket pipeline (webhook + 30-min poller + Inngest + token auth +
 * NDR/auto-RTO + label/pickup) is Phase 2-3 and OUT OF SCOPE here — see
 * docs/modules/shipping-fulfillment.md. TODO markers flag the hook-in points.
 *
 * SERVER-ONLY: uses @kakoa/db.
 */
import {
  adminAuditLog,
  db,
  orderItems,
  orders,
  payments,
  productVariants,
  shipmentEvents,
  shipments,
  type AddressSnapshot,
} from '@kakoa/db';
import { type OrderStatus, type ShipmentStatus } from '@kakoa/core';
import { getShippingProvider } from '@kakoa/integrations';
import { and, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { withConstraintMapping } from './db-errors';
import { isUuid } from './product-validation';
import { applyOrderTransitionTx } from './order-actions';
import {
  canAdvanceShipment,
  isTerminalShipment,
  validateAwbInput,
} from './shipping-status';

export const SHIPMENTS_PAGE_SIZE = 30;

function likeParam(s: string): string {
  return `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function clampPage(raw: number | undefined): number {
  const n = Math.floor(Number(raw ?? 1));
  return Number.isFinite(n) ? Math.min(1_000_000, Math.max(1, n)) : 1;
}

/**
 * Shipment status → the order status to mirror to. Statuses not listed (awb_assigned,
 * pickup_scheduled, in_transit, cancelled, lost) do NOT move the order.
 */
const ORDER_MIRROR: Partial<Record<ShipmentStatus, OrderStatus>> = {
  picked_up: 'shipped',
  out_for_delivery: 'out_for_delivery',
  delivered: 'delivered',
  rto_initiated: 'rto_initiated',
  rto_delivered: 'rto_delivered',
};

const FILTERS = ['all', 'active', 'in_transit', 'delivered', 'rto', 'exception'] as const;
export type ShipmentFilter = (typeof FILTERS)[number];

export function isShipmentFilter(v: string): v is ShipmentFilter {
  return (FILTERS as readonly string[]).includes(v);
}

export interface ShipmentRow {
  id: string;
  orderNumber: string;
  city: string;
  state: string;
  awbCode: string | null;
  courierName: string | null;
  status: string;
  cod: boolean;
  superseded: boolean;
  expectedDeliveryAt: string | null;
  createdAt: string;
}

export interface ShipmentList {
  rows: ShipmentRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export async function listShipments(input: {
  search?: string;
  status?: string;
  filter?: ShipmentFilter;
  page?: number;
}): Promise<ShipmentList> {
  const page = clampPage(input.page);
  const pageSize = SHIPMENTS_PAGE_SIZE;
  const filter = input.filter ?? 'all';

  const conds: SQL[] = [];
  // Superseded shipments are read-only history — excluded unless explicitly shown.
  if (filter !== 'exception') {
    conds.push(sql`${shipments.supersededAt} IS NULL`);
  }
  if (filter === 'active') {
    conds.push(sql`${shipments.status} NOT IN ('delivered','rto_delivered','cancelled','lost')`);
  } else if (filter === 'in_transit') {
    conds.push(sql`${shipments.status} IN ('picked_up','in_transit','out_for_delivery')`);
  } else if (filter === 'delivered') {
    conds.push(sql`${shipments.status} = 'delivered'`);
  } else if (filter === 'rto') {
    conds.push(sql`${shipments.status} IN ('rto_initiated','rto_in_transit','rto_delivered')`);
  } else if (filter === 'exception') {
    conds.push(sql`(${shipments.status} IN ('cancelled','lost') OR ${shipments.supersededAt} IS NOT NULL)`);
  }
  if (input.status !== undefined && input.status !== '') {
    conds.push(sql`${shipments.status} = ${input.status}`);
  }
  const search = input.search?.trim();
  if (search !== undefined && search !== '') {
    const p = likeParam(search);
    conds.push(sql`(${orders.orderNumber} ilike ${p} or ${shipments.awbCode} ilike ${p})`);
  }
  const where = conds.length > 0 ? and(...conds) : undefined;

  const [totalRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(shipments)
    .innerJoin(orders, eq(orders.id, shipments.orderId))
    .where(where);
  const total = Number(totalRow?.total ?? 0);

  const rows = await db
    .select({
      id: shipments.id,
      orderNumber: orders.orderNumber,
      shippingAddress: orders.shippingAddress,
      awbCode: shipments.awbCode,
      courierName: shipments.courierName,
      status: shipments.status,
      cod: shipments.cod,
      supersededAt: shipments.supersededAt,
      expectedDeliveryAt: shipments.expectedDeliveryAt,
      createdAt: shipments.createdAt,
    })
    .from(shipments)
    .innerJoin(orders, eq(orders.id, shipments.orderId))
    .where(where)
    .orderBy(desc(shipments.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    rows: rows.map((r) => {
      const addr = r.shippingAddress as AddressSnapshot | null;
      return {
        id: r.id,
        orderNumber: r.orderNumber,
        city: addr?.city ?? '—',
        state: addr?.state ?? '',
        awbCode: r.awbCode,
        courierName: r.courierName,
        status: r.status,
        cod: r.cod,
        superseded: r.supersededAt !== null,
        expectedDeliveryAt: r.expectedDeliveryAt
          ? new Date(r.expectedDeliveryAt).toISOString()
          : null,
        createdAt: new Date(r.createdAt).toISOString(),
      };
    }),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export interface ShipmentEventRow {
  id: string;
  status: string;
  activity: string | null;
  location: string | null;
  occurredAt: string;
  source: string;
}

export interface ShipmentDetail {
  id: string;
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  customerName: string;
  city: string;
  state: string;
  awbCode: string | null;
  courierName: string | null;
  courierCompanyId: number | null;
  labelUrl: string | null;
  status: string;
  cod: boolean;
  superseded: boolean;
  pickupScheduledAt: string | null;
  expectedDeliveryAt: string | null;
  createdAt: string;
  events: ShipmentEventRow[];
}

export async function getShipmentDetail(id: string): Promise<ShipmentDetail | null> {
  if (!isUuid(id)) return null;

  const [row] = await db
    .select({
      id: shipments.id,
      orderId: shipments.orderId,
      orderNumber: orders.orderNumber,
      orderStatus: orders.status,
      shippingAddress: orders.shippingAddress,
      awbCode: shipments.awbCode,
      courierName: shipments.courierName,
      courierCompanyId: shipments.courierCompanyId,
      labelUrl: shipments.labelUrl,
      status: shipments.status,
      cod: shipments.cod,
      supersededAt: shipments.supersededAt,
      pickupScheduledAt: shipments.pickupScheduledAt,
      expectedDeliveryAt: shipments.expectedDeliveryAt,
      createdAt: shipments.createdAt,
    })
    .from(shipments)
    .innerJoin(orders, eq(orders.id, shipments.orderId))
    .where(eq(shipments.id, id))
    .limit(1);
  if (!row) return null;

  const events = await db
    .select({
      id: shipmentEvents.id,
      status: shipmentEvents.status,
      activity: shipmentEvents.activity,
      location: shipmentEvents.location,
      occurredAt: shipmentEvents.occurredAt,
      source: shipmentEvents.source,
    })
    .from(shipmentEvents)
    .where(eq(shipmentEvents.shipmentId, id))
    .orderBy(desc(shipmentEvents.occurredAt));

  const addr = row.shippingAddress as AddressSnapshot | null;

  return {
    id: row.id,
    orderId: row.orderId,
    orderNumber: row.orderNumber,
    orderStatus: row.orderStatus,
    customerName: addr?.fullName ?? '—',
    city: addr?.city ?? '—',
    state: addr?.state ?? '',
    awbCode: row.awbCode,
    courierName: row.courierName,
    courierCompanyId: row.courierCompanyId,
    labelUrl: row.labelUrl,
    status: row.status,
    cod: row.cod,
    superseded: row.supersededAt !== null,
    pickupScheduledAt: row.pickupScheduledAt
      ? new Date(row.pickupScheduledAt).toISOString()
      : null,
    expectedDeliveryAt: row.expectedDeliveryAt
      ? new Date(row.expectedDeliveryAt).toISOString()
      : null,
    createdAt: new Date(row.createdAt).toISOString(),
    events: events.map((e) => ({
      id: e.id,
      status: e.status,
      activity: e.activity,
      location: e.location,
      occurredAt: new Date(e.occurredAt).toISOString(),
      source: e.source,
    })),
  };
}

export type ShippingResult =
  | { ok: true; shipmentId: string; status: string }
  | {
      ok: false;
      code: 'NOT_FOUND' | 'VALIDATION_ERROR' | 'INVALID_TRANSITION' | 'CONFLICT' | 'UPSTREAM_ERROR';
      message: string;
    };

/** A valid Indian pincode for a fulfilment push. */
const PIN_RE = /^[1-9][0-9]{5}$/;
const PHONE_RE = /^\+?[6-9][0-9]{9}$/;

/** Guard the address snapshot has the fields Shiprocket's push requires. */
function addressComplete(addr: AddressSnapshot | null): boolean {
  if (addr === null) return false;
  const phone = (addr.phone ?? '').replace(/^\+91/, '');
  return (
    typeof addr.fullName === 'string' && addr.fullName.trim().length > 0 &&
    typeof addr.line1 === 'string' && addr.line1.trim().length > 0 &&
    typeof addr.city === 'string' && addr.city.trim().length > 0 &&
    typeof addr.state === 'string' && addr.state.trim().length > 0 &&
    typeof addr.pincode === 'string' && PIN_RE.test(addr.pincode) &&
    (PHONE_RE.test(addr.phone ?? '') || /^[6-9][0-9]{9}$/.test(phone))
  );
}

/**
 * Create a shipment for a fulfilment-ready order. Guards: order in
 * `{confirmed, packed}`, valid address snapshot, every line variant
 * `shipWeightGrams > 0`. The one-active partial-unique index enforces a single
 * active shipment (dup → clean CONFLICT). Calls the mock provider for the SR
 * handles, inserts the shipment + an initial `pending` event, and audits — all
 * in one tx.
 */
export async function createShipment(
  orderId: string,
  adminUserId: string,
): Promise<ShippingResult> {
  if (!isUuid(orderId)) {
    return { ok: false, code: 'NOT_FOUND', message: 'Order not found.' };
  }

  // Preload order + address + weight OUTSIDE the tx to build the provider payload;
  // the provider call must not run inside the DB transaction.
  const [order] = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      paymentMode: orders.paymentMode,
      shippingAddress: orders.shippingAddress,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!order) return { ok: false, code: 'NOT_FOUND', message: 'Order not found.' };

  if (order.status !== 'confirmed' && order.status !== 'packed') {
    return {
      ok: false,
      code: 'INVALID_TRANSITION',
      message: 'Confirm or pack the order before creating a shipment.',
    };
  }

  const addr = order.shippingAddress as AddressSnapshot | null;
  if (!addressComplete(addr)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Shipment data incomplete: shipping address.' };
  }

  const weightRows = await db
    .select({ weight: productVariants.shipWeightGrams, qty: orderItems.quantity })
    .from(orderItems)
    .innerJoin(productVariants, eq(productVariants.id, orderItems.variantId))
    .where(eq(orderItems.orderId, order.id));
  if (weightRows.length === 0) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Shipment data incomplete: order has no items.' };
  }
  let totalWeight = 0;
  for (const w of weightRows) {
    if (!Number.isInteger(w.weight) || w.weight <= 0) {
      return { ok: false, code: 'VALIDATION_ERROR', message: 'Shipment data incomplete: a product is missing its packed weight.' };
    }
    totalWeight += w.weight * w.qty;
  }

  // Provider call (mock) — outside the tx. A hard failure ⇒ UPSTREAM_ERROR.
  let handles;
  try {
    handles = await getShippingProvider().createShipment({
      orderNumber: order.orderNumber,
      cod: order.paymentMode === 'cod',
      pincode: addr!.pincode,
      weightGrams: totalWeight,
    });
  } catch {
    return { ok: false, code: 'UPSTREAM_ERROR', message: "Couldn't reach the shipping provider. Please try again." };
  }

  return withConstraintMapping(() =>
    db.transaction(async (tx): Promise<ShippingResult> => {
      // Friendly path for the common (sequential) case; the one-active partial
      // unique index is the race-safe backstop (a raced dup → clean 400 via
      // withConstraintMapping).
      const [existing] = await tx
        .select({ id: shipments.id })
        .from(shipments)
        .where(and(eq(shipments.orderId, order.id), sql`${shipments.supersededAt} IS NULL`))
        .limit(1);
      if (existing) {
        return { ok: false, code: 'CONFLICT', message: 'This order already has an active shipment.' };
      }

      const [created] = await tx
        .insert(shipments)
        .values({
          orderId: order.id,
          shiprocketOrderId: handles.shiprocketOrderId,
          shiprocketShipmentId: handles.shiprocketShipmentId,
          status: 'pending',
          cod: order.paymentMode === 'cod',
        })
        .returning({ id: shipments.id });
      if (!created) {
        return { ok: false, code: 'VALIDATION_ERROR', message: 'Could not create the shipment.' };
      }

      await tx.insert(shipmentEvents).values({
        shipmentId: created.id,
        status: 'pending',
        source: 'manual',
        activity: 'Shipment created',
        occurredAt: sql`now()`,
      });
      await tx.insert(adminAuditLog).values({
        adminUserId,
        action: 'shipment.create',
        entityType: 'shipment',
        entityId: created.id,
        before: null,
        after: { orderId: order.id, status: 'pending', cod: order.paymentMode === 'cod' },
      });
      return { ok: true, shipmentId: created.id, status: 'pending' };
    }),
  );
}

/**
 * Assign an AWB + courier to a `pending` shipment. Accepts a manual AWB or calls
 * the provider when none is given. AWB is UNIQUE (dup → clean CONFLICT).
 */
export async function assignAwb(
  shipmentId: string,
  rawInput: unknown,
  adminUserId: string,
): Promise<ShippingResult> {
  if (!isUuid(shipmentId)) {
    return { ok: false, code: 'NOT_FOUND', message: 'Shipment not found.' };
  }

  const body = (rawInput ?? {}) as Record<string, unknown>;
  const manual = typeof body.awbCode === 'string' && body.awbCode.trim() !== '';

  // Manual AWB entry is validated up front; auto-assign validates the provider result.
  let awb: { awbCode: string; courierName: string | null; courierCompanyId: number | null; labelUrl: string | null };
  if (manual) {
    const v = validateAwbInput(body);
    if (!v.ok) return { ok: false, code: 'VALIDATION_ERROR', message: v.message };
    awb = { ...v.value, labelUrl: null };
  } else {
    // Provider assigns — needs the SR shipment id; read it first (no lock).
    const [row] = await db
      .select({ srShipmentId: shipments.shiprocketShipmentId, status: shipments.status })
      .from(shipments)
      .where(eq(shipments.id, shipmentId))
      .limit(1);
    if (!row) return { ok: false, code: 'NOT_FOUND', message: 'Shipment not found.' };
    if (row.status !== 'pending') {
      return { ok: false, code: 'INVALID_TRANSITION', message: 'An AWB can only be assigned to a pending shipment.' };
    }
    const cid = body.courierCompanyId !== undefined && body.courierCompanyId !== null && body.courierCompanyId !== ''
      ? Number(body.courierCompanyId)
      : undefined;
    try {
      const res = await getShippingProvider().assignAwb({
        shiprocketShipmentId: row.srShipmentId ?? shipmentId,
        courierCompanyId: cid !== undefined && Number.isInteger(cid) ? cid : undefined,
      });
      awb = { awbCode: res.awbCode, courierName: res.courierName, courierCompanyId: res.courierCompanyId, labelUrl: res.labelUrl };
    } catch {
      return { ok: false, code: 'UPSTREAM_ERROR', message: "Couldn't reach the shipping provider. Please try again." };
    }
  }

  return withConstraintMapping(() =>
    db.transaction(async (tx): Promise<ShippingResult> => {
      const [shipment] = await tx
        .select({ id: shipments.id, status: shipments.status })
        .from(shipments)
        .where(eq(shipments.id, shipmentId))
        .for('update')
        .limit(1);
      if (!shipment) return { ok: false, code: 'NOT_FOUND', message: 'Shipment not found.' };
      if (shipment.status !== 'pending') {
        return { ok: false, code: 'INVALID_TRANSITION', message: 'An AWB can only be assigned to a pending shipment.' };
      }

      // Friendly duplicate-AWB check; the UNIQUE(awb_code) index is the race backstop.
      const [dup] = await tx
        .select({ id: shipments.id })
        .from(shipments)
        .where(and(eq(shipments.awbCode, awb.awbCode), sql`${shipments.id} <> ${shipmentId}`))
        .limit(1);
      if (dup) {
        return { ok: false, code: 'CONFLICT', message: 'That AWB is already assigned to another shipment.' };
      }

      await tx
        .update(shipments)
        .set({
          awbCode: awb.awbCode,
          courierName: awb.courierName,
          courierCompanyId: awb.courierCompanyId,
          labelUrl: awb.labelUrl,
          status: 'awb_assigned',
          updatedAt: sql`now()`,
        })
        .where(eq(shipments.id, shipmentId));
      await tx.insert(shipmentEvents).values({
        shipmentId,
        status: 'awb_assigned',
        source: 'manual',
        activity: `AWB ${awb.awbCode} assigned (${awb.courierName ?? 'courier'})`,
        occurredAt: sql`now()`,
      });
      await tx.insert(adminAuditLog).values({
        adminUserId,
        action: 'shipment.assign_awb',
        entityType: 'shipment',
        entityId: shipmentId,
        before: { status: 'pending' },
        after: { status: 'awb_assigned', awbCode: awb.awbCode, courierName: awb.courierName },
      });
      return { ok: true, shipmentId, status: 'awb_assigned' };
    }),
  );
}

/**
 * Advance a shipment to `toStatus` through the monotonic machine, appending an
 * event and MIRRORING the order via the shared order state-machine write. The
 * shipment row is locked `FOR UPDATE OF shipments`; the order row is locked in
 * the SAME tx for the mirror, so the whole move is atomic. An illegal shipment
 * move or an illegal order mirror both roll back with INVALID_TRANSITION.
 */
export async function advanceShipment(
  shipmentId: string,
  toStatus: ShipmentStatus,
  adminUserId: string,
): Promise<ShippingResult> {
  if (!isUuid(shipmentId)) {
    return { ok: false, code: 'NOT_FOUND', message: 'Shipment not found.' };
  }

  return withConstraintMapping(() =>
    db.transaction(async (tx): Promise<ShippingResult> => {
      const [shipment] = await tx
        .select({
          id: shipments.id,
          orderId: shipments.orderId,
          status: shipments.status,
          cod: shipments.cod,
          supersededAt: shipments.supersededAt,
        })
        .from(shipments)
        .where(eq(shipments.id, shipmentId))
        .for('update')
        .limit(1);
      if (!shipment) return { ok: false, code: 'NOT_FOUND', message: 'Shipment not found.' };
      if (shipment.supersededAt !== null) {
        return { ok: false, code: 'INVALID_TRANSITION', message: 'This shipment is superseded (read-only).' };
      }
      if (!canAdvanceShipment(shipment.status, toStatus)) {
        return { ok: false, code: 'INVALID_TRANSITION', message: `Can't move a shipment from ${shipment.status.replace(/_/g, ' ')} to ${toStatus.replace(/_/g, ' ')}.` };
      }

      // Mirror the order FIRST (locks the order row, asserts the order machine).
      // If the mirror is illegal, the whole action fails — we never force it.
      const mirror = ORDER_MIRROR[toStatus];
      if (mirror !== undefined) {
        const [order] = await tx
          .select({ id: orders.id, status: orders.status })
          .from(orders)
          .where(eq(orders.id, shipment.orderId))
          .for('update')
          .limit(1);
        if (!order) return { ok: false, code: 'NOT_FOUND', message: 'Order not found.' };
        // Idempotent: skip the mirror if the order is already at/past the target.
        if (order.status !== mirror) {
          try {
            await applyOrderTransitionTx(tx, order, mirror, {
              adminUserId,
              action: 'order.transition',
              note: `Shipment ${toStatus.replace(/_/g, ' ')}`,
            });
          } catch {
            return {
              ok: false,
              code: 'INVALID_TRANSITION',
              message: `The order can't move to ${mirror.replace(/_/g, ' ')} right now, so this shipment update was not applied.`,
            };
          }
        }

        // COD cash is collected on delivery — move the COD payment to collected.
        // (No existing "collect" path exists to reuse; this is the ledger update.)
        if (toStatus === 'delivered' && shipment.cod) {
          await tx
            .update(payments)
            .set({ status: 'cod_collected', updatedAt: sql`now()` })
            .where(and(eq(payments.orderId, shipment.orderId), eq(payments.status, 'cod_pending_collection')));
        }
      }

      const stamp: Record<string, unknown> = { status: toStatus, updatedAt: sql`now()` };
      if (toStatus === 'pickup_scheduled') stamp.pickupScheduledAt = sql`now()`;
      // Populate a courier ETA once picked up so the storefront timeline shows it.
      if (toStatus === 'picked_up') stamp.expectedDeliveryAt = sql`now() + interval '5 days'`;

      await tx.update(shipments).set(stamp).where(eq(shipments.id, shipmentId));
      // Dedup-safe (unique on shipment_id, status, occurred_at).
      await tx
        .insert(shipmentEvents)
        .values({ shipmentId, status: toStatus, source: 'manual', occurredAt: sql`now()` })
        .onConflictDoNothing();
      await tx.insert(adminAuditLog).values({
        adminUserId,
        action: 'shipment.advance',
        entityType: 'shipment',
        entityId: shipmentId,
        before: { status: shipment.status },
        after: { status: toStatus },
      });
      return { ok: true, shipmentId, status: toStatus };
    }),
  );
}

/**
 * Cancel / supersede a shipment. Sets `status='cancelled'` (when not already
 * terminal) and `supersededAt = now()`, which frees the one-active index so the
 * order can be re-shipped. Read-only on an already-superseded shipment.
 */
export async function cancelShipment(
  shipmentId: string,
  adminUserId: string,
): Promise<ShippingResult> {
  if (!isUuid(shipmentId)) {
    return { ok: false, code: 'NOT_FOUND', message: 'Shipment not found.' };
  }

  return withConstraintMapping(() =>
    db.transaction(async (tx): Promise<ShippingResult> => {
      const [shipment] = await tx
        .select({ id: shipments.id, status: shipments.status, supersededAt: shipments.supersededAt })
        .from(shipments)
        .where(eq(shipments.id, shipmentId))
        .for('update')
        .limit(1);
      if (!shipment) return { ok: false, code: 'NOT_FOUND', message: 'Shipment not found.' };
      if (shipment.supersededAt !== null) {
        return { ok: false, code: 'INVALID_TRANSITION', message: 'This shipment is already superseded.' };
      }

      // A picked-up-or-later shipment is in the courier's hands — cancelling it
      // here just supersedes it (frees the index for a reship); a pre-pickup one
      // also flips to `cancelled`.
      const nextStatus = isTerminalShipment(shipment.status) ? shipment.status : 'cancelled';

      await tx
        .update(shipments)
        .set({ status: nextStatus, supersededAt: sql`now()`, updatedAt: sql`now()` })
        .where(eq(shipments.id, shipmentId));
      if (nextStatus !== shipment.status) {
        await tx
          .insert(shipmentEvents)
          .values({ shipmentId, status: nextStatus, source: 'manual', activity: 'Cancelled by admin', occurredAt: sql`now()` })
          .onConflictDoNothing();
      }
      await tx.insert(adminAuditLog).values({
        adminUserId,
        action: 'shipment.cancel',
        entityType: 'shipment',
        entityId: shipmentId,
        before: { status: shipment.status, superseded: false },
        after: { status: nextStatus, superseded: true },
      });
      return { ok: true, shipmentId, status: nextStatus };
    }),
  );
}

/** The active shipment id for an order, if any (for the order-detail panel). */
export async function getActiveShipmentForOrder(
  orderId: string,
): Promise<{ id: string; status: string; awbCode: string | null; courierName: string | null } | null> {
  if (!isUuid(orderId)) return null;
  const [row] = await db
    .select({ id: shipments.id, status: shipments.status, awbCode: shipments.awbCode, courierName: shipments.courierName })
    .from(shipments)
    .where(and(eq(shipments.orderId, orderId), sql`${shipments.supersededAt} IS NULL`))
    .limit(1);
  return row ?? null;
}
