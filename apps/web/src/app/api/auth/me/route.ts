/**
 * GET /api/auth/me — customer · no rate class (auth-otp.md §5.4).
 *
 * `getCurrentCustomer()` → 200 { customer } | 401 UNAUTHORIZED. All 401 causes
 * (no cookie, hash not found, revoked, expired) are indistinguishable (no
 * oracle, §6). Side effect: rolling extension when within 24h of expiry (§1.4),
 * handled inside `getCurrentCustomer`.
 */
import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { getCurrentCustomer } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const customer = await getCurrentCustomer();
    if (customer === null) {
      return jsonErr('UNAUTHORIZED', 'Please log in to continue.');
    }
    return jsonOk({ customer }, { cacheControl: NO_STORE });
  } catch {
    return jsonErr('INTERNAL', 'Something went wrong on our side.');
  }
}
