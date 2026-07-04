/**
 * POST /api/account/addresses/[id]/default — customer-tier (customer-accounts.md
 * §5). Make one saved address the default; returns the refreshed default-first
 * list so the client re-renders the whole book in one round-trip.
 *
 * → 200 { addresses } | 401 UNAUTHORIZED | 404 NOT_FOUND (not the caller's row).
 * The clear-then-set is transactional in the service layer (one-default index).
 */
import { isErr } from '@kakoa/core';

import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { getCurrentCustomer } from '@/lib/auth/session';
import { setDefaultAddress } from '@/lib/account/addresses';

export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const customer = await getCurrentCustomer();
    if (customer === null) {
      return jsonErr('UNAUTHORIZED', 'Please log in to manage your addresses.');
    }

    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return jsonErr('NOT_FOUND', 'That address no longer exists.');
    }

    const result = await setDefaultAddress(id);
    if (isErr(result)) {
      return jsonErr(result.error.code, result.error.message);
    }
    return jsonOk({ addresses: result.data }, { cacheControl: NO_STORE });
  } catch {
    return jsonErr('INTERNAL', 'Something went wrong on our side.');
  }
}
