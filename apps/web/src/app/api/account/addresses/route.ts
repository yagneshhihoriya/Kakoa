/**
 * /api/account/addresses — customer-tier address book (customer-accounts.md §5).
 *
 * GET  → 200 { addresses } (default-first) | 401 UNAUTHORIZED.
 * POST → 201 { address }   | 400 VALIDATION_ERROR | 401 | 409 CONFLICT (cap).
 *
 * Every response is the §2.1 envelope; nothing here is CDN-cached (private,
 * per-customer). The service layer owns the transactional invariants (one
 * default, 20-cap, first-address-default).
 */
import { createAddressInputSchema, isErr } from '@kakoa/core';

import { jsonErr, jsonOk, NO_STORE, toFieldErrors } from '@/lib/api/http';
import { getCurrentCustomer } from '@/lib/auth/session';
import { createAddress, listAddresses } from '@/lib/account/addresses';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const customer = await getCurrentCustomer();
    if (customer === null) {
      return jsonErr('UNAUTHORIZED', 'Please log in to view your addresses.');
    }
    const addresses = await listAddresses();
    return jsonOk({ addresses }, { cacheControl: NO_STORE });
  } catch {
    return jsonErr('INTERNAL', 'Something went wrong on our side.');
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const customer = await getCurrentCustomer();
    if (customer === null) {
      return jsonErr('UNAUTHORIZED', 'Please log in to save an address.');
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonErr('VALIDATION_ERROR', 'Please check the address details.');
    }

    const parsed = createAddressInputSchema.safeParse(body);
    if (!parsed.success) {
      return jsonErr('VALIDATION_ERROR', 'Please check the address details.', {
        fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
      });
    }

    const result = await createAddress(parsed.data);
    if (isErr(result)) {
      return jsonErr(result.error.code, result.error.message, {
        ...(result.error.fieldErrors
          ? { fieldErrors: result.error.fieldErrors }
          : {}),
      });
    }
    return jsonOk({ address: result.data }, { cacheControl: NO_STORE, status: 201 });
  } catch {
    return jsonErr('INTERNAL', 'Something went wrong on our side.');
  }
}
