/**
 * Offline PIN-code → GST state-code inference (smart-address Phase 1).
 *
 * India Post PIN codes are geographically allocated: the FIRST DIGIT selects a
 * postal region and the FIRST TWO DIGITS select a postal circle, which maps
 * (with a handful of shared-circle exceptions) to a single state / UT. This
 * module resolves the two-digit prefix to the canonical GST `stateCode` used
 * everywhere else in the contract (see `gst-states.ts`), so the checkout UI can
 * autofill the state dropdown the moment a valid PIN is entered — no network,
 * no dataset load, zero runtime deps.
 *
 * This is a CONVENIENCE prefill only. The authoritative state is still whatever
 * the user confirms in the GST dropdown; `addressInputSchema.stateCode` remains
 * the validation gate. A few circles genuinely span two states/UTs (e.g. `19`
 * covers West Bengal, Sikkim, and A&N Islands); for those we pick the dominant
 * state and rely on the user to correct the rare edge case.
 *
 * Prefixes are keyed to `GST_STATES` codes:
 *   11→Delhi(07), 12/13→Haryana(06), 14/15→Punjab(03), 16→Punjab(03),
 *   17→Himachal(02), 18/19→J&K(01), 20–28→UP(09), 30–34→Rajasthan(08),
 *   36/37→Gujarat(24), 38/39→Gujarat(24), 40–44→Maharashtra(27),
 *   45–48→MP(23), 49→Chhattisgarh(22), 50→Telangana(36),
 *   51–53→Andhra(37), 56–59→Karnataka(29), 60–64→Tamil Nadu(33),
 *   67–69→Kerala(32), 682→Lakshadweep(31), 70–74→West Bengal(19),
 *   744→A&N(35), 737→Sikkim(11), 75–77→Odisha(21), 78→Assam(18),
 *   79→NE states, 80–85→Bihar(10), 81–83→Jharkhand(20).
 */

import { isValidStateCode } from './gst-states';

/**
 * India PIN first-two-digits → GST state code.
 *
 * Ordering note: `stateCodeFromPincode` checks a small set of THREE-digit
 * overrides (`PINCODE_STATE_OVERRIDES`) before consulting this two-digit map,
 * so shared circles (Kerala/Lakshadweep on `68`, WB/Sikkim/A&N on `73`/`74`)
 * resolve to the correct UT for their specific sub-range.
 */
export const PINCODE_STATE_PREFIXES: Readonly<Record<string, string>> = {
  // Delhi
  '11': '07',
  // Haryana
  '12': '06',
  '13': '06',
  // Punjab
  '14': '03',
  '15': '03',
  '16': '03',
  // Himachal Pradesh
  '17': '02',
  // Jammu & Kashmir (and Ladakh sub-ranges, see overrides)
  '18': '01',
  '19': '01',
  // Uttar Pradesh + Uttarakhand (24x)
  '20': '09',
  '21': '09',
  '22': '09',
  '23': '09',
  '24': '05', // Uttarakhand
  '25': '09',
  '26': '09',
  '27': '09',
  '28': '09',
  // Rajasthan
  '30': '08',
  '31': '08',
  '32': '08',
  '33': '08',
  '34': '08',
  // Gujarat (incl. Daman & Diu / DNH sub-ranges via overrides)
  '36': '24',
  '37': '24',
  '38': '24',
  '39': '24',
  // Maharashtra
  '40': '27',
  '41': '27',
  '42': '27',
  '43': '27',
  '44': '27',
  // Madhya Pradesh
  '45': '23',
  '46': '23',
  '47': '23',
  '48': '23',
  // Chhattisgarh
  '49': '22',
  // Telangana
  '50': '36',
  // Andhra Pradesh
  '51': '37',
  '52': '37',
  '53': '37',
  // Karnataka
  '56': '29',
  '57': '29',
  '58': '29',
  '59': '29',
  // Tamil Nadu (incl. Puducherry pockets)
  '60': '33',
  '61': '33',
  '62': '33',
  '63': '33',
  '64': '33',
  // Kerala (Lakshadweep 682xxx via override)
  '67': '32',
  '68': '32',
  '69': '32',
  // West Bengal (Sikkim 737 / A&N 744 via overrides)
  '70': '19',
  '71': '19',
  '72': '19',
  '73': '19',
  '74': '19',
  // Odisha
  '75': '21',
  '76': '21',
  '77': '21',
  // Assam
  '78': '18',
  // North-East (79x — dominant Assam; discrete NE states via overrides)
  '79': '18',
  // Bihar
  '80': '10',
  '84': '10',
  '85': '10',
  // Jharkhand
  '81': '20',
  '82': '20',
  '83': '20',
};

/**
 * Three-digit prefixes that override the two-digit map because the circle is
 * shared across states/UTs. Checked FIRST. Keeps the common two-digit table
 * clean while still resolving the well-known split ranges correctly.
 */
export const PINCODE_STATE_OVERRIDES: Readonly<Record<string, string>> = {
  // Lakshadweep shares Kerala's circle (68), block 682xxx.
  '682': '31',
  // Sikkim shares West Bengal's circle (73), block 737xxx.
  '737': '11',
  // Andaman & Nicobar shares West Bengal's circle (74), block 744xxx.
  '744': '35',
  // Puducherry pockets inside the Tamil Nadu circle.
  '605': '34',
  '533': '37', // Yanam is administered with Puducherry but PIN-mapped to AP circle; kept AP.
  // Arunachal Pradesh (79x split).
  '790': '12',
  '791': '12',
  '792': '12',
  // Nagaland.
  '797': '13',
  '798': '13',
  // Manipur.
  '795': '14',
  // Mizoram.
  '796': '15',
  // Tripura.
  '799': '16',
  // Meghalaya.
  '793': '17',
  '794': '17',
};

const PINCODE_RE = /^[1-9][0-9]{5}$/;

/**
 * Infer the canonical GST `stateCode` from a 6-digit India PIN.
 *
 * Returns `null` when the input is not a syntactically valid PIN or the prefix
 * is not mapped (unallocated / military / rare circle). The caller treats
 * `null` as "leave the state field for the user to pick".
 *
 * Resolution order: exact three-digit override → two-digit prefix. The result
 * is defensively re-validated against `GST_STATES`, so the function can never
 * emit a code the address schema would later reject.
 */
export function stateCodeFromPincode(pincode: string): string | null {
  if (typeof pincode !== 'string') return null;
  const trimmed = pincode.trim();
  if (!PINCODE_RE.test(trimmed)) return null;

  const three = trimmed.slice(0, 3);
  const two = trimmed.slice(0, 2);

  const code = PINCODE_STATE_OVERRIDES[three] ?? PINCODE_STATE_PREFIXES[two];
  if (code === undefined) return null;

  return isValidStateCode(code) ? code : null;
}
