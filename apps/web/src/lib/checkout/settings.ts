/**
 * `store_settings` reads for checkout (checkout.md §3, §4; cod.md §config).
 *
 * Every fee/policy value the quote engine and placement transaction need,
 * loaded live and SNAPSHOTTED onto the order at placement — a later settings
 * edit is never retroactive (checkout.md §3 caching table). Missing keys
 * degrade to documented defaults rather than a 500 (the seed ships the fee
 * keys; `cod_max_order_paise` / `cod_rto_block_threshold` are cod.md config
 * defaults not yet in the seed).
 *
 * SERVER-ONLY: uses @kakoa/db.
 */
import { db, storeSettings } from '@kakoa/db';
import { inArray } from 'drizzle-orm';

/** cod.md §config default when the setting row is absent (₹3,000). */
export const COD_MAX_ORDER_PAISE_DEFAULT = 300_000;

/** cod.md §config default repeat-RTO blocklist threshold. */
export const COD_RTO_BLOCK_THRESHOLD_DEFAULT = 2;

export interface CheckoutSettings {
  /** GST state code of the seller — drives CGST/SGST vs IGST (§5.2). */
  sellerStateCode: string;
  shippingFeeStandardPaise: number;
  shippingFeeExpressPaise: number;
  freeShippingThresholdPaise: number;
  codFeePaise: number;
  giftWrapFeePaise: number;
  /** COD value cap — total above this ⇒ COD_UNAVAILABLE (cod.md §1). */
  codMaxOrderPaise: number;
  /** Repeat-RTO COD orders in the last 180d at/above this block COD. */
  codRtoBlockThreshold: number;
  /**
   * Master COD switch. Default **false** (prepaid/online-only) — KAKOA launches
   * without Cash on Delivery. Flip the `cod_enabled` store_settings row to `true`
   * to re-enable COD everywhere (checkout option, quote, placement) with no code
   * change. When false the checkout hides the COD option and placement rejects
   * `paymentMode: 'cod'` with COD_UNAVAILABLE.
   */
  codEnabled: boolean;
  /** Prepaid stock-hold window (minutes) — the sweep releases after this. */
  paymentExpiryMinutes: number;
}

const KEYS = [
  'seller_state_code',
  'shipping_fee_standard_paise',
  'shipping_fee_express_paise',
  'free_shipping_threshold_paise',
  'cod_fee_paise',
  'gift_wrap_fee_paise',
  'cod_max_order_paise',
  'cod_rto_block_threshold',
  'cod_enabled',
  'payment_expiry_minutes',
] as const;

/** jsonb value → non-negative safe integer, or `null` when unusable. */
function toIntSetting(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 ? n : null;
}

/** jsonb value → boolean, or `null` when unusable. Accepts true/false, 1/0,
 * and the strings "true"/"false"/"1"/"0" (jsonb settings are stringly-typed). */
function toBoolSetting(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1 ? true : value === 0 ? false : null;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'true' || v === '1') return true;
    if (v === 'false' || v === '0') return false;
  }
  return null;
}

/** jsonb value → trimmed string, or `null`. */
function toStringSetting(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  if (typeof value === 'number') return String(value);
  return null;
}

/**
 * Load the checkout fee/policy settings. Missing fee keys degrade to 0
 * (never a 500); `seller_state_code` degrades to '27' (Maharashtra, the
 * seeded seller) so the GST split stays deterministic.
 */
export async function loadCheckoutSettings(): Promise<CheckoutSettings> {
  const rows = await db
    .select({ key: storeSettings.key, value: storeSettings.value })
    .from(storeSettings)
    .where(inArray(storeSettings.key, [...KEYS]));

  const byKey = new Map(rows.map((row) => [row.key, row.value]));

  return {
    sellerStateCode:
      toStringSetting(byKey.get('seller_state_code')) ?? '27',
    shippingFeeStandardPaise:
      toIntSetting(byKey.get('shipping_fee_standard_paise')) ?? 0,
    shippingFeeExpressPaise:
      toIntSetting(byKey.get('shipping_fee_express_paise')) ?? 0,
    freeShippingThresholdPaise:
      toIntSetting(byKey.get('free_shipping_threshold_paise')) ?? 0,
    codFeePaise: toIntSetting(byKey.get('cod_fee_paise')) ?? 0,
    giftWrapFeePaise: toIntSetting(byKey.get('gift_wrap_fee_paise')) ?? 0,
    codMaxOrderPaise:
      toIntSetting(byKey.get('cod_max_order_paise')) ??
      COD_MAX_ORDER_PAISE_DEFAULT,
    codRtoBlockThreshold:
      toIntSetting(byKey.get('cod_rto_block_threshold')) ??
      COD_RTO_BLOCK_THRESHOLD_DEFAULT,
    // Default OFF: absent key ⇒ COD disabled (prepaid-only launch).
    codEnabled: toBoolSetting(byKey.get('cod_enabled')) ?? false,
    paymentExpiryMinutes:
      toIntSetting(byKey.get('payment_expiry_minutes')) ?? 30,
  };
}
