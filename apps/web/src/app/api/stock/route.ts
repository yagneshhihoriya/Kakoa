/**
 * POST /api/stock — the PDP's live-stock check (module spec §5.6).
 * { variantIds: string[] } → { stock: Record<variantId, { inStock, stockLow }> }
 *
 * NEVER cached (`Cache-Control: no-store` — a CDN-cached stock response is
 * an oversell bug). Booleans only, never quantities. Malformed/unknown ids
 * are simply absent from the map (no enumeration oracle).
 */
import { getLiveStock } from '@/lib/catalog';
import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';

/** A PDP never needs more than its own variants — cap the batch. */
const MAX_VARIANT_IDS = 50;

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonErr('VALIDATION_ERROR', 'Request body must be valid JSON.');
  }

  const variantIds =
    typeof body === 'object' && body !== null && 'variantIds' in body
      ? (body as { variantIds: unknown }).variantIds
      : undefined;

  if (
    !Array.isArray(variantIds) ||
    variantIds.length === 0 ||
    variantIds.length > MAX_VARIANT_IDS ||
    !variantIds.every((id): id is string => typeof id === 'string')
  ) {
    return jsonErr('VALIDATION_ERROR', 'variantIds must be 1-50 variant ids.', {
      fieldErrors: {
        variantIds: [`variantIds must be an array of 1-${MAX_VARIANT_IDS} variant ids.`],
      },
    });
  }

  try {
    const stock = await getLiveStock(variantIds);
    return jsonOk({ stock }, { cacheControl: NO_STORE });
  } catch {
    return jsonErr('INTERNAL', 'Something went wrong. Please try again.');
  }
}
