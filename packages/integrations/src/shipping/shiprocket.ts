import { parseServerEnv } from "@kakoa/config";
import type {
  AssignAwbResult,
  CreateShipmentInput,
  CreateShipmentResult,
  LabelResult,
  ManifestResult,
  PickupResult,
  ServiceabilityResult,
  ShippingProvider,
  TrackingResult,
  TrackingScan,
} from "./provider";

/**
 * Real Shiprocket provider (HANDOFF-Shiprocket-Integration.md). Base
 * `https://apiv2.shiprocket.in`, prefix `/v1/external`. Every call (except
 * login) needs `Authorization: Bearer <token>` AND `Content-Type: application/json`
 * (missing content-type → 403 even with a valid token).
 *
 * Token: valid 240h, NO refresh endpoint — re-login. Cached in-memory per
 * process (re-login on expiry or a 401). Selected by `getShippingProvider()`
 * only when `SHIPROCKET_EMAIL` is set, so the Mock drives dev/CI.
 *
 * ⚠️ A few response field TYPES / key names are marked "verify at integration"
 * — confirm them against the first live 200 (the `shiprocketdev` Postman
 * workspace has examples). No file outside this dir imports Shiprocket specifics.
 *
 * TODO(shipping): persist the token in `store_settings` (shared across serverless
 * instances) instead of the per-process cache — needs a DB seam into this package.
 */

const BASE = "https://apiv2.shiprocket.in/v1/external";
const TIMEOUT_MS = 15_000;
/** Re-login when < 1 day of the 240h token remains. */
const TOKEN_REFRESH_MARGIN_MS = 24 * 60 * 60 * 1000;

class TransientShiprocketError extends Error {}
class PermanentShiprocketError extends Error {}

/** Process-local token cache (see class doc). */
let cachedToken: { token: string; expiresAt: number } | null = null;

/** Strip a +91 / leading zeros to Shiprocket's expected 10-digit mobile. */
function toTenDigit(phoneE164: string): string {
  const digits = phoneE164.replace(/[^0-9]/g, "");
  return digits.slice(-10);
}

/** Build the `/orders/create/adhoc` body — PURE (exported for unit tests). */
export function buildAdhocOrderBody(input: CreateShipmentInput): Record<string, unknown> {
  const subTotalRupees = Math.round(input.subTotalPaise) / 100;
  const orderDate = input.orderDateIso.slice(0, 16).replace("T", " "); // 'YYYY-MM-DD HH:mm'
  return {
    order_id: input.orderNumber, // channel reference — dedupe key on SR side
    order_date: orderDate,
    pickup_location: input.pickupLocation,
    channel_id: "",
    billing_customer_name: input.billing.name,
    billing_last_name: "",
    billing_address: input.billing.address,
    ...(input.billing.address2 !== undefined ? { billing_address_2: input.billing.address2 } : {}),
    billing_city: input.billing.city,
    billing_pincode: input.billing.pincode,
    billing_state: input.billing.state,
    billing_country: "India",
    billing_email: input.billing.email ?? "",
    billing_phone: toTenDigit(input.billing.phone),
    shipping_is_billing: true,
    order_items: input.items.map((i) => ({
      name: i.name,
      sku: i.sku,
      units: i.units,
      // verify at integration: selling_price string vs number.
      selling_price: Math.round(i.sellingPricePaise) / 100,
    })),
    payment_method: input.cod ? "COD" : "Prepaid",
    // 🔴 sub_total is NOT auto-computed by Shiprocket — send the real value.
    sub_total: subTotalRupees,
    length: input.lengthCm ?? 10,
    breadth: input.breadthCm ?? 10,
    height: input.heightCm ?? 10,
    weight: Math.max(0.001, input.weightGrams / 1000), // kg
  };
}

export class ShiprocketShippingProvider implements ShippingProvider {
  /* ── auth ─────────────────────────────────────────────────────────── */

  private async token(): Promise<string> {
    const now = Date.now();
    if (cachedToken !== null && cachedToken.expiresAt - TOKEN_REFRESH_MARGIN_MS > now) {
      return cachedToken.token;
    }
    return this.login();
  }

  private async login(): Promise<string> {
    const env = parseServerEnv();
    if (env.SHIPROCKET_EMAIL === undefined || env.SHIPROCKET_PASSWORD === undefined) {
      throw new PermanentShiprocketError("Shiprocket selected without credentials");
    }
    const res = await this.raw("POST", "/auth/login", {
      email: env.SHIPROCKET_EMAIL,
      password: env.SHIPROCKET_PASSWORD,
    });
    const json = (await this.json(res)) as { token?: unknown };
    if (typeof json.token !== "string" || json.token === "") {
      throw new PermanentShiprocketError("Shiprocket login returned no token");
    }
    cachedToken = { token: json.token, expiresAt: Date.now() + 240 * 60 * 60 * 1000 };
    return json.token;
  }

  /* ── HTTP core ────────────────────────────────────────────────────── */

  /** One fetch with timeout; no auth (used by login). Never retries here. */
  private async raw(method: string, path: string, body?: unknown, token?: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      return await fetch(`${BASE}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json", // mandatory — 403 without it
          ...(token !== undefined ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });
    } catch {
      throw new TransientShiprocketError(`Shiprocket ${method} ${path} failed/timed out`);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Authenticated request with: 401 → re-login + retry once; 5xx/timeout → one
   * retry; 4xx → permanent (surface `message`). Returns the parsed JSON.
   */
  private async call(method: string, path: string, body?: unknown): Promise<unknown> {
    const attempt = async (tok: string): Promise<Response> => this.raw(method, path, body, tok);

    let token = await this.token();
    let res: Response;
    try {
      res = await attempt(token);
    } catch {
      // transient network/timeout → one retry
      res = await attempt(token);
    }

    if (res.status === 401) {
      cachedToken = null;
      token = await this.login();
      res = await attempt(token);
    }
    if (res.status >= 500) {
      // one retry on a 5xx
      res = await attempt(token);
    }
    if (res.status >= 400) {
      const msg = await this.errorMessage(res);
      throw new PermanentShiprocketError(`Shiprocket ${method} ${path} ${res.status}: ${msg}`);
    }
    return this.json(res);
  }

  private async json(res: Response): Promise<unknown> {
    try {
      return await res.json();
    } catch {
      throw new PermanentShiprocketError("Shiprocket returned a non-JSON body");
    }
  }

  private async errorMessage(res: Response): Promise<string> {
    try {
      const j = (await res.json()) as { message?: unknown };
      return typeof j.message === "string" ? j.message : `HTTP ${res.status}`;
    } catch {
      return `HTTP ${res.status}`;
    }
  }

  /* ── interface methods ────────────────────────────────────────────── */

  // eslint-disable-next-line @typescript-eslint/require-await -- optimistic (see below)
  async serviceability(a: { pincode: string; cod: boolean }): Promise<ServiceabilityResult> {
    // Serviceability is OPTIMISTIC here: a syntactically valid pincode is treated
    // as serviceable with standard/express options, and true courier availability
    // is enforced at AWB-assign time (auto-pick surfaces non-serviceable then).
    // Wiring the real `/courier/serviceability` query (needs the seller pickup
    // pincode + a 24h cache, HANDOFF §3.3) is a deferred nicety and out of scope
    // for the core push/AWB/track flow — enabling SHIPROCKET_EMAIL must not break
    // the checkout quote.
    // TODO(shipping): real serviceability query + 24h (pincode,cod) cache.
    const serviceable = /^[1-9][0-9]{5}$/.test(a.pincode);
    return {
      serviceable,
      codAvailable: serviceable && a.cod,
      options: serviceable
        ? [
            { option: "standard", feePaise: 0, etaDaysMin: 3, etaDaysMax: 5 },
            { option: "express", feePaise: 0, etaDaysMin: 1, etaDaysMax: 2 },
          ]
        : [],
    };
  }

  async createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult> {
    const json = (await this.call("POST", "/orders/create/adhoc", buildAdhocOrderBody(input))) as {
      order_id?: unknown;
      shipment_id?: unknown;
    };
    const orderId = json.order_id;
    const shipmentId = json.shipment_id;
    if (orderId === undefined || shipmentId === undefined) {
      throw new PermanentShiprocketError("Shiprocket adhoc create missing order_id/shipment_id");
    }
    return {
      shiprocketOrderId: String(orderId),
      shiprocketShipmentId: String(shipmentId),
    };
  }

  async assignAwb(input: { shiprocketShipmentId: string; courierCompanyId?: number }): Promise<AssignAwbResult> {
    const body: Record<string, unknown> = { shipment_id: Number(input.shiprocketShipmentId) };
    // OMIT courier_id unless explicitly chosen → Shiprocket auto-picks per the
    // seller's Courier-Priority rule (the whole "auto-pick cheapest" feature).
    if (input.courierCompanyId !== undefined) body.courier_id = input.courierCompanyId;
    const json = (await this.call("POST", "/courier/assign/awb", body)) as {
      response?: { data?: { awb_code?: unknown; courier_name?: unknown; courier_company_id?: unknown } };
    };
    const data = json.response?.data ?? {};
    if (typeof data.awb_code !== "string" && typeof data.awb_code !== "number") {
      throw new PermanentShiprocketError("Shiprocket assign/awb returned no awb_code");
    }
    return {
      awbCode: String(data.awb_code),
      courierName: typeof data.courier_name === "string" ? data.courier_name : "Courier",
      courierCompanyId:
        typeof data.courier_company_id === "number" ? data.courier_company_id : Number(data.courier_company_id) || 0,
      labelUrl: null,
    };
  }

  async getLabel(shiprocketShipmentIds: string[]): Promise<LabelResult> {
    const json = (await this.call("POST", "/courier/generate/label", {
      shipment_id: shiprocketShipmentIds.map((s) => Number(s)),
    })) as { label_url?: unknown };
    return { labelUrl: typeof json.label_url === "string" ? json.label_url : null };
  }

  async getManifest(shiprocketShipmentIds: string[]): Promise<ManifestResult> {
    const json = (await this.call("POST", "/manifests/generate", {
      shipment_id: shiprocketShipmentIds.map((s) => Number(s)),
    })) as { manifest_url?: unknown };
    return { manifestUrl: typeof json.manifest_url === "string" ? json.manifest_url : null };
  }

  async requestPickup(shiprocketShipmentIds: string[]): Promise<PickupResult> {
    const json = (await this.call("POST", "/courier/generate/pickup", {
      shipment_id: shiprocketShipmentIds.map((s) => Number(s)),
    })) as { pickup_scheduled_date?: unknown; response?: { pickup_scheduled_date?: unknown } };
    const raw = json.pickup_scheduled_date ?? json.response?.pickup_scheduled_date;
    return { pickupScheduledDateIso: typeof raw === "string" ? raw : null };
  }

  async track(awb: string): Promise<TrackingResult> {
    const json = (await this.call("GET", `/courier/track/awb/${encodeURIComponent(awb)}`)) as {
      tracking_data?: {
        shipment_status?: unknown;
        shipment_track_activities?: Array<{ status?: unknown; sr_status_label?: unknown; activity?: unknown; location?: unknown; date?: unknown }>;
      };
    };
    const td = json.tracking_data ?? {};
    const scans: TrackingScan[] = (td.shipment_track_activities ?? []).map((s) => ({
      statusCode: typeof s.status === "number" ? s.status : Number(s.status) || null,
      statusLabel: typeof s.sr_status_label === "string" ? s.sr_status_label : null,
      activity: typeof s.activity === "string" ? s.activity : null,
      location: typeof s.location === "string" ? s.location : null,
      occurredAtIso: typeof s.date === "string" ? s.date : null,
    }));
    const code = td.shipment_status;
    return {
      awb,
      statusCode: typeof code === "number" ? code : Number(code) || null,
      statusLabel: scans[scans.length - 1]?.statusLabel ?? null,
      scans,
    };
  }
}
