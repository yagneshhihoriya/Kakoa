'use server';

/**
 * Catalog-adjacent Server Action stubs — Module 1.
 *
 * Add-to-bag is OWNED BY THE CART MODULE (docs/modules/cart.md). Until it
 * lands, the PDP posts to this stub, which returns a Contract `ApiErr`
 * (`NOT_IMPLEMENTED`) — Server Actions never throw for expected failures.
 * The client shows `error.message` as a toast ("Cart coming soon").
 */

import { err, type ApiResult } from '@kakoa/core';

export interface AddToBagInput {
  variantId: string;
  qty: number;
}

/**
 * Stub — replaced by the Cart module's `addToCart` Server Action.
 * Always returns `ApiErr NOT_IMPLEMENTED`; never mutates anything.
 */
export async function addToBag(
  _input: AddToBagInput,
): Promise<ApiResult<never>> {
  return err('NOT_IMPLEMENTED', 'Cart coming soon');
}
