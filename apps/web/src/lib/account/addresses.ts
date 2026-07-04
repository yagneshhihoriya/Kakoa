/**
 * Saved-address-book service — smart-address Phase 1 (customer-accounts.md §1.9
 * / §5). Server-only CRUD over `customer_addresses`, all owner-scoped to the
 * live session's customer. Every mutation returns an `ApiResult<T>` (never
 * throws for an expected failure); genuinely unexpected faults surface as a
 * thrown Error the Route Handler maps to 500.
 *
 * Invariants enforced here (mirrors the DB one-default partial-unique index):
 *  - a customer holds at most `ADDRESS_LIMIT` rows (CONFLICT 'address_limit');
 *  - the very first saved address is auto-default;
 *  - at most ONE default at a time — setting a default clears the others in the
 *    SAME transaction (so the partial-unique index never trips mid-flight);
 *  - deleting the current default promotes the most-recent survivor to default;
 *  - a customer can only see/mutate their OWN rows (NOT_FOUND otherwise).
 *
 * `saveCheckoutAddress` is the best-effort book insert called from placement:
 * it never throws and never blocks the order.
 */
import 'server-only';

import { customerAddresses, db } from '@kakoa/db';
import {
  ok,
  err,
  stateByCode,
  type ApiResult,
  type CreateAddressInput,
  type SavedAddress,
  type UpdateAddressInput,
  createAddressInputSchema,
  updateAddressInputSchema,
} from '@kakoa/core';
import { and, desc, eq, sql } from 'drizzle-orm';

import { getCurrentCustomer } from '@/lib/auth/session';

/** Per-customer address cap (customer-accounts.md §1.9 / §5). */
export const ADDRESS_LIMIT = 20;

const ADDRESS_LIMIT_MESSAGE =
  'You can save up to 20 addresses. Remove one to add another.';
const NOT_FOUND_MESSAGE = 'That address no longer exists.';
const UNAUTHORIZED_MESSAGE = 'Please log in to manage your addresses.';

/** A drizzle transaction handle. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
/** Either the base db or a transaction — every read below accepts both. */
type Db = typeof db | Tx;

/** The row projection that maps 1:1 onto `SavedAddress`. */
const ADDRESS_COLUMNS = {
  id: customerAddresses.id,
  label: customerAddresses.label,
  fullName: customerAddresses.fullName,
  phone: customerAddresses.phone,
  line1: customerAddresses.line1,
  line2: customerAddresses.line2,
  landmark: customerAddresses.landmark,
  city: customerAddresses.city,
  state: customerAddresses.state,
  stateCode: customerAddresses.stateCode,
  pincode: customerAddresses.pincode,
  isDefault: customerAddresses.isDefault,
} as const;

interface AddressRow {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
  isDefault: boolean;
}

/** Nullable DB columns → the optional-key `SavedAddress` shape. */
function toSavedAddress(row: AddressRow): SavedAddress {
  return {
    id: row.id,
    label: row.label,
    fullName: row.fullName,
    phone: row.phone,
    line1: row.line1,
    ...(row.line2 !== null ? { line2: row.line2 } : {}),
    ...(row.landmark !== null ? { landmark: row.landmark } : {}),
    city: row.city,
    state: row.state,
    stateCode: row.stateCode,
    pincode: row.pincode,
    isDefault: row.isDefault,
  };
}

/** Resolve `state` display name from a GST code (falls back to the raw code). */
function stateNameFor(stateCode: string, fallback: string): string {
  return stateByCode(stateCode)?.name ?? fallback;
}

/** The stored E.164 form the DB CHECK requires (`+91XXXXXXXXXX`). */
function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const ten = digits.length > 10 ? digits.slice(-10) : digits;
  return `+91${ten}`;
}

/** All of a customer's addresses, default first then newest. */
async function selectAddresses(
  runner: Db,
  customerId: string,
): Promise<AddressRow[]> {
  return runner
    .select(ADDRESS_COLUMNS)
    .from(customerAddresses)
    .where(eq(customerAddresses.customerId, customerId))
    .orderBy(desc(customerAddresses.isDefault), desc(customerAddresses.createdAt));
}

/* ------------------------------------------------------------------ */
/* listAddresses                                                       */
/* ------------------------------------------------------------------ */

/**
 * Every saved address for the current customer, default-first. Returns `[]`
 * for guests (no session) — the caller decides whether that is an auth error.
 */
export async function listAddresses(): Promise<SavedAddress[]> {
  const customer = await getCurrentCustomer();
  if (customer === null) return [];
  const rows = await selectAddresses(db, customer.id);
  return rows.map(toSavedAddress);
}

/* ------------------------------------------------------------------ */
/* createAddress                                                       */
/* ------------------------------------------------------------------ */

/**
 * Insert a new saved address. The first address a customer saves is forced to
 * default; a caller-sent `isDefault` (or the first-address rule) transactionally
 * clears any prior default. Over the cap ⇒ CONFLICT 'address_limit'.
 */
export async function createAddress(
  input: CreateAddressInput,
): Promise<ApiResult<SavedAddress>> {
  const customer = await getCurrentCustomer();
  if (customer === null) return err('UNAUTHORIZED', UNAUTHORIZED_MESSAGE);
  const customerId = customer.id;

  const parsed = createAddressInputSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR', 'Please check the address details.', {
      fieldErrors: parsed.error.flatten().fieldErrors,
    });
  }
  const data = parsed.data;

  const saved = await db.transaction(
    async (tx): Promise<SavedAddress | 'limit'> => {
      const existing = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(customerAddresses)
        .where(eq(customerAddresses.customerId, customerId));
      const current = existing[0]?.count ?? 0;
      if (current >= ADDRESS_LIMIT) return 'limit';

      // First address is always default; otherwise honour the caller flag.
      const makeDefault = current === 0 ? true : data.isDefault === true;
      if (makeDefault) await clearDefaults(tx, customerId);

      const [row] = await tx
        .insert(customerAddresses)
        .values({
          customerId,
          label: data.label,
          fullName: data.fullName,
          phone: toE164(data.phone),
          line1: data.line1,
          line2: data.line2 ?? null,
          landmark: data.landmark ?? null,
          city: data.city,
          state: stateNameFor(data.stateCode, data.state),
          stateCode: data.stateCode,
          pincode: data.pincode,
          isDefault: makeDefault,
        })
        .returning(ADDRESS_COLUMNS);
      if (!row) throw new Error('address insert returned no row');
      return toSavedAddress(row);
    },
  );

  if (saved === 'limit') return err('CONFLICT', ADDRESS_LIMIT_MESSAGE);
  return ok(saved);
}

/* ------------------------------------------------------------------ */
/* updateAddress                                                       */
/* ------------------------------------------------------------------ */

/**
 * Patch a saved address. Only the supplied fields change. Promoting it to
 * default clears the others in the same tx; NOT_FOUND if the row is not the
 * caller's.
 */
export async function updateAddress(
  input: UpdateAddressInput,
): Promise<ApiResult<SavedAddress>> {
  const customer = await getCurrentCustomer();
  if (customer === null) return err('UNAUTHORIZED', UNAUTHORIZED_MESSAGE);
  const customerId = customer.id;

  const parsed = updateAddressInputSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR', 'Please check the address details.', {
      fieldErrors: parsed.error.flatten().fieldErrors,
    });
  }
  const { id, isDefault, ...fields } = parsed.data;

  const result = await db.transaction(
    async (tx): Promise<SavedAddress | 'not_found'> => {
      const [owned] = await tx
        .select({ id: customerAddresses.id })
        .from(customerAddresses)
        .where(
          and(
            eq(customerAddresses.id, id),
            eq(customerAddresses.customerId, customerId),
          ),
        )
        .limit(1);
      if (!owned) return 'not_found';

      // Promoting to default: clear siblings first (never demote to non-default
      // here — a book always keeps exactly one default while rows exist).
      if (isDefault === true) await clearDefaults(tx, customerId);

      const patch: Record<string, unknown> = { updatedAt: sql`now()` };
      if (fields.label !== undefined) patch.label = fields.label;
      if (fields.fullName !== undefined) patch.fullName = fields.fullName;
      if (fields.phone !== undefined) patch.phone = toE164(fields.phone);
      if (fields.line1 !== undefined) patch.line1 = fields.line1;
      if (fields.line2 !== undefined) patch.line2 = fields.line2 ?? null;
      if (fields.landmark !== undefined) patch.landmark = fields.landmark ?? null;
      if (fields.city !== undefined) patch.city = fields.city;
      if (fields.stateCode !== undefined) {
        patch.stateCode = fields.stateCode;
        patch.state = stateNameFor(fields.stateCode, fields.state ?? '');
      } else if (fields.state !== undefined) {
        patch.state = fields.state;
      }
      if (fields.pincode !== undefined) patch.pincode = fields.pincode;
      if (isDefault === true) patch.isDefault = true;

      const [row] = await tx
        .update(customerAddresses)
        .set(patch)
        .where(
          and(
            eq(customerAddresses.id, id),
            eq(customerAddresses.customerId, customerId),
          ),
        )
        .returning(ADDRESS_COLUMNS);
      if (!row) return 'not_found';
      return toSavedAddress(row);
    },
  );

  if (result === 'not_found') return err('NOT_FOUND', NOT_FOUND_MESSAGE);
  return ok(result);
}

/* ------------------------------------------------------------------ */
/* deleteAddress                                                       */
/* ------------------------------------------------------------------ */

/**
 * Hard-delete a saved address (orders snapshot the address, so nothing dangles).
 * Deleting the current default promotes the most-recent survivor to default.
 * NOT_FOUND if the row is not the caller's.
 */
export async function deleteAddress(
  id: string,
): Promise<ApiResult<Record<string, never>>> {
  const customer = await getCurrentCustomer();
  if (customer === null) return err('UNAUTHORIZED', UNAUTHORIZED_MESSAGE);
  const customerId = customer.id;

  const outcome = await db.transaction(
    async (tx): Promise<'ok' | 'not_found'> => {
      const [deleted] = await tx
        .delete(customerAddresses)
        .where(
          and(
            eq(customerAddresses.id, id),
            eq(customerAddresses.customerId, customerId),
          ),
        )
        .returning({ isDefault: customerAddresses.isDefault });
      if (!deleted) return 'not_found';

      // Removed the default and rows remain ⇒ promote the newest survivor.
      if (deleted.isDefault) {
        const [survivor] = await tx
          .select({ id: customerAddresses.id })
          .from(customerAddresses)
          .where(eq(customerAddresses.customerId, customerId))
          .orderBy(desc(customerAddresses.createdAt))
          .limit(1);
        if (survivor) {
          await tx
            .update(customerAddresses)
            .set({ isDefault: true, updatedAt: sql`now()` })
            .where(eq(customerAddresses.id, survivor.id));
        }
      }
      return 'ok';
    },
  );

  if (outcome === 'not_found') return err('NOT_FOUND', NOT_FOUND_MESSAGE);
  return ok({});
}

/* ------------------------------------------------------------------ */
/* setDefaultAddress                                                   */
/* ------------------------------------------------------------------ */

/**
 * Make one address the default: clear every sibling, then set this one — in the
 * same tx so the one-default partial-unique index is never violated. Returns
 * the refreshed default-first list. NOT_FOUND if the row is not the caller's.
 */
export async function setDefaultAddress(
  id: string,
): Promise<ApiResult<SavedAddress[]>> {
  const customer = await getCurrentCustomer();
  if (customer === null) return err('UNAUTHORIZED', UNAUTHORIZED_MESSAGE);
  const customerId = customer.id;

  const result = await db.transaction(
    async (tx): Promise<AddressRow[] | 'not_found'> => {
      const [owned] = await tx
        .select({ id: customerAddresses.id })
        .from(customerAddresses)
        .where(
          and(
            eq(customerAddresses.id, id),
            eq(customerAddresses.customerId, customerId),
          ),
        )
        .limit(1);
      if (!owned) return 'not_found';

      await clearDefaults(tx, customerId);
      await tx
        .update(customerAddresses)
        .set({ isDefault: true, updatedAt: sql`now()` })
        .where(eq(customerAddresses.id, id));

      return selectAddresses(tx, customerId);
    },
  );

  if (result === 'not_found') return err('NOT_FOUND', NOT_FOUND_MESSAGE);
  return ok(result.map(toSavedAddress));
}

/* ------------------------------------------------------------------ */
/* saveCheckoutAddress — best-effort book insert from placement         */
/* ------------------------------------------------------------------ */

/**
 * Persist a just-used checkout shipping address to the customer's book, unless
 * it is a near-duplicate of an existing row (same pincode + line1 + fullName,
 * case-insensitive). The first saved address becomes the default. Best-effort:
 * a full book (cap reached) or any error is swallowed — placement must never
 * fail because the book save did.
 */
export async function saveCheckoutAddress(
  customerId: string,
  address: {
    fullName: string;
    phone: string;
    line1: string;
    line2?: string;
    landmark?: string;
    city: string;
    state: string;
    stateCode: string;
    pincode: string;
  },
): Promise<void> {
  try {
    const line1Key = address.line1.trim().toLowerCase();
    const nameKey = address.fullName.trim().toLowerCase();

    await db.transaction(async (tx) => {
      const existing = await tx
        .select({
          line1: customerAddresses.line1,
          fullName: customerAddresses.fullName,
        })
        .from(customerAddresses)
        .where(
          and(
            eq(customerAddresses.customerId, customerId),
            eq(customerAddresses.pincode, address.pincode),
          ),
        );

      const isDup = existing.some(
        (row) =>
          row.line1.trim().toLowerCase() === line1Key &&
          row.fullName.trim().toLowerCase() === nameKey,
      );
      if (isDup) return;

      const [{ count } = { count: 0 }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(customerAddresses)
        .where(eq(customerAddresses.customerId, customerId));
      if (count >= ADDRESS_LIMIT) return; // silently skip when the book is full

      const makeDefault = count === 0;
      if (makeDefault) await clearDefaults(tx, customerId);

      await tx.insert(customerAddresses).values({
        customerId,
        label: 'Home',
        fullName: address.fullName,
        phone: toE164(address.phone),
        line1: address.line1,
        line2: address.line2 ?? null,
        landmark: address.landmark ?? null,
        city: address.city,
        state: stateNameFor(address.stateCode, address.state),
        stateCode: address.stateCode,
        pincode: address.pincode,
        isDefault: makeDefault,
      });
    });
  } catch (cause) {
    console.error('account.save_checkout_address_failed', {
      cause: cause instanceof Error ? cause.message : 'unknown',
    });
  }
}

/* ------------------------------------------------------------------ */
/* internals                                                           */
/* ------------------------------------------------------------------ */

/** Demote every currently-default row for the customer (within a tx). */
async function clearDefaults(tx: Tx, customerId: string): Promise<void> {
  await tx
    .update(customerAddresses)
    .set({ isDefault: false, updatedAt: sql`now()` })
    .where(
      and(
        eq(customerAddresses.customerId, customerId),
        eq(customerAddresses.isDefault, true),
      ),
    );
}
