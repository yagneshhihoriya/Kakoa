/**
 * Response envelope — Contract §2.1 (PROJECT_PLAN.md §3.0).
 *
 * Every Route Handler response and every Server Action return value is an
 * `ApiResult<T>`. Server Actions never throw for expected failures — they
 * return `ApiErr` (React `useActionState`-friendly).
 */

import type { ErrorCode } from './errors';

export interface ApiMeta {
  page?: number;
  pageSize?: number;
  total?: number;
  /**
   * True when this success body is an idempotent REPLAY of a prior request
   * (checkout placement / payment verify) rather than a fresh effect. The
   * client uses it purely for telemetry — the body is byte-identical either way.
   */
  duplicate?: boolean;
  requestId: string;
}

export interface ApiOk<T> {
  ok: true;
  data: T;
  meta?: ApiMeta;
}

export interface ApiErrBody {
  code: ErrorCode;
  /** Human-readable, safe to show to the user. */
  message: string;
  /** Machine data, e.g. per-variant stock availability. Never shown raw. */
  details?: unknown;
  /** zod `flatten()` output keyed by field path. */
  fieldErrors?: Record<string, string[]>;
}

export interface ApiErr {
  ok: false;
  error: ApiErrBody;
  requestId: string;
}

export type ApiResult<T> = ApiOk<T> | ApiErr;

/** Fallback request-id generator (crypto.randomUUID when available). */
function generateRequestId(): string {
  const cryptoObj = (
    globalThis as { crypto?: { randomUUID?: () => string } }
  ).crypto;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Build a success envelope. */
export function ok<T>(data: T, meta?: ApiMeta): ApiOk<T> {
  return meta === undefined ? { ok: true, data } : { ok: true, data, meta };
}

/** Build an error envelope. `requestId` is generated when not supplied. */
export function err(
  code: ErrorCode,
  message: string,
  options?: {
    requestId?: string;
    details?: unknown;
    fieldErrors?: Record<string, string[]>;
  },
): ApiErr {
  const error: ApiErrBody = { code, message };
  if (options && 'details' in options) error.details = options.details;
  if (options?.fieldErrors) error.fieldErrors = options.fieldErrors;
  return {
    ok: false,
    error,
    requestId: options?.requestId ?? generateRequestId(),
  };
}

/** Type guard: narrows an `ApiResult<T>` to `ApiOk<T>`. */
export function isOk<T>(result: ApiResult<T>): result is ApiOk<T> {
  return result.ok;
}

/** Type guard: narrows an `ApiResult<T>` to `ApiErr`. */
export function isErr<T>(result: ApiResult<T>): result is ApiErr {
  return !result.ok;
}
