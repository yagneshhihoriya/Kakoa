/**
 * Route Handler response helpers — Contract §2.1 envelope over HTTP.
 *
 * Every catalog GET sends `Cache-Control: s-maxage=60, stale-while-revalidate=300`;
 * the stock endpoint sends `no-store` (spec §3 caching table). Error responses
 * are never CDN-cached.
 */
import {
  err,
  httpStatusFor,
  ok,
  type ApiMeta,
  type ErrorCode,
} from '@kakoa/core';

/** CDN policy for public catalog GETs (module spec §5 / Contract §2.1). */
export const CATALOG_CACHE_CONTROL = 's-maxage=60, stale-while-revalidate=300';

/** Live-stock reads must never be cached (oversell surface, spec §5.6). */
export const NO_STORE = 'no-store';

function requestId(): string {
  return crypto.randomUUID();
}

/**
 * ApiOk envelope. `meta.requestId` is always set. Defaults to HTTP 200; pass
 * `status` for created resources (checkout placement returns 201).
 */
export function jsonOk<T>(
  data: T,
  options: {
    cacheControl: string;
    status?: number;
    meta?: Omit<ApiMeta, 'requestId'>;
  },
): Response {
  const body = ok(data, { ...options.meta, requestId: requestId() });
  return Response.json(body, {
    status: options.status ?? 200,
    headers: { 'Cache-Control': options.cacheControl },
  });
}

/** ApiErr envelope with the registry HTTP status. Never CDN-cached. */
export function jsonErr(
  code: ErrorCode,
  message: string,
  options?: {
    details?: unknown;
    fieldErrors?: Record<string, string[]>;
  },
): Response {
  const body = err(code, message, {
    requestId: requestId(),
    ...(options?.details !== undefined ? { details: options.details } : {}),
    ...(options?.fieldErrors ? { fieldErrors: options.fieldErrors } : {}),
  });
  return Response.json(body, {
    status: httpStatusFor(code),
    headers: { 'Cache-Control': NO_STORE },
  });
}

/** zod `flatten().fieldErrors` → the envelope's `Record<string, string[]>`. */
export function toFieldErrors(
  fieldErrors: Record<string, string[] | undefined>,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [key, messages] of Object.entries(fieldErrors)) {
    if (messages && messages.length > 0) out[key] = messages;
  }
  return out;
}
