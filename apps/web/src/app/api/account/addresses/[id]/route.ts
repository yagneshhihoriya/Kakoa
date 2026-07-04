/**
 * /api/account/addresses/[id] — customer-tier (customer-accounts.md §5).
 *
 * PATCH  → 200 { address } | 400 | 401 | 404 NOT_FOUND (not the caller's row).
 * DELETE → 200 {}          | 401 | 404 NOT_FOUND.
 *
 * The `id` from the path is authoritative — a body `id` (updateAddressInputSchema
 * carries one) must match it, else 400. All ownership + one-default invariants
 * live in the service layer; nothing here is CDN-cached.
 */
import { updateAddressInputSchema, isErr } from '@kakoa/core';

import { jsonErr, jsonOk, NO_STORE, toFieldErrors } from '@/lib/api/http';
import { getCurrentCustomer } from '@/lib/auth/session';
import { deleteAddress, updateAddress } from '@/lib/account/addresses';

export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const customer = await getCurrentCustomer();
    if (customer === null) {
      return jsonErr('UNAUTHORIZED', 'Please log in to edit your addresses.');
    }

    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return jsonErr('NOT_FOUND', 'That address no longer exists.');
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonErr('VALIDATION_ERROR', 'Please check the address details.');
    }

    // The path id wins; a body id (if any) must not disagree with it.
    const payload =
      body !== null && typeof body === 'object'
        ? { ...(body as Record<string, unknown>), id }
        : { id };

    const parsed = updateAddressInputSchema.safeParse(payload);
    if (!parsed.success) {
      return jsonErr('VALIDATION_ERROR', 'Please check the address details.', {
        fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
      });
    }

    const result = await updateAddress(parsed.data);
    if (isErr(result)) {
      return jsonErr(result.error.code, result.error.message, {
        ...(result.error.fieldErrors
          ? { fieldErrors: result.error.fieldErrors }
          : {}),
      });
    }
    return jsonOk({ address: result.data }, { cacheControl: NO_STORE });
  } catch {
    return jsonErr('INTERNAL', 'Something went wrong on our side.');
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const customer = await getCurrentCustomer();
    if (customer === null) {
      return jsonErr('UNAUTHORIZED', 'Please log in to remove an address.');
    }

    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return jsonErr('NOT_FOUND', 'That address no longer exists.');
    }

    const result = await deleteAddress(id);
    if (isErr(result)) {
      return jsonErr(result.error.code, result.error.message);
    }
    return jsonOk({}, { cacheControl: NO_STORE });
  } catch {
    return jsonErr('INTERNAL', 'Something went wrong on our side.');
  }
}
