/**
 * Canonical GST state / union-territory codes (checkout.md §1.2, Contract §2.5).
 *
 * The two-digit `code` is the GSTIN state code used by the Indian GST regime;
 * it is the authority for the CGST/SGST-vs-IGST split at quote and placement:
 * `ship_to_state_code == store_settings.seller_state_code` ⇒ intra-state
 * (CGST + SGST), else inter-state (IGST). `name` is the display label shown in
 * the address-step dropdown (never free-typed) and snapshotted onto
 * `orders.shipping_address.state`.
 *
 * List is complete and canonical: 01–38 plus 97 (Other Territory). Codes 26
 * (formerly Dadra & Nagar Haveli) and 27… are per the post-2020 merged UT
 * numbering; the array is the single source of truth for both `stateByCode`
 * and the `AddressInput.stateCode` regex.
 */

export interface GstState {
  /** Two-digit GSTIN state code, e.g. `'27'` for Maharashtra. */
  readonly code: string;
  /** Display name shown in the address dropdown. */
  readonly name: string;
}

export const GST_STATES: readonly GstState[] = [
  { code: '01', name: 'Jammu & Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '25', name: 'Daman & Diu' },
  { code: '26', name: 'Dadra & Nagar Haveli and Daman & Diu' },
  { code: '27', name: 'Maharashtra' },
  { code: '28', name: 'Andhra Pradesh (Old)' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman & Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh' },
  { code: '97', name: 'Other Territory' },
] as const;

/**
 * Two-digit GST state code regex — `01`–`38` plus `97`. Identical to the
 * `AddressInput.stateCode` field rule (checkout.md §1.2) so schema and lookup
 * can never drift.
 */
export const STATE_CODE_RE = /^(0[1-9]|[12][0-9]|3[0-8]|97)$/;

const BY_CODE: ReadonlyMap<string, GstState> = new Map(
  GST_STATES.map((s) => [s.code, s]),
);

const BY_NAME: ReadonlyMap<string, GstState> = new Map(
  GST_STATES.map((s) => [s.name.toLowerCase(), s]),
);

/** Lookup a state by its two-digit GST code; `undefined` if unknown. */
export function stateByCode(code: string): GstState | undefined {
  return BY_CODE.get(code);
}

/** Lookup a state by display name (case-insensitive); `undefined` if unknown. */
export function stateByName(name: string): GstState | undefined {
  if (typeof name !== 'string') return undefined;
  return BY_NAME.get(name.trim().toLowerCase());
}

/**
 * Whether `code` is a syntactically valid GST state code AND present in
 * `GST_STATES`. The regex alone admits e.g. `39`; membership pins it to the
 * canonical list.
 */
export function isValidStateCode(code: string): boolean {
  if (typeof code !== 'string') return false;
  return STATE_CODE_RE.test(code) && BY_CODE.has(code);
}
