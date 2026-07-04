"use client";

/**
 * Client helpers for the customer tracking surface (order-tracking.md §5).
 *
 * The tracking JWT (30-min, `scope:'tracking'`) is a bearer credential that
 * MUST live in client memory only — never localStorage, never a cookie, never
 * a URL (§6 token hygiene). This module therefore keeps every credential in
 * component state / closures; nothing here persists.
 *
 * Three credentials resolve to the SAME tracking read, expressed as a
 * discriminated `TrackingCredential`:
 *   - `bearer`       — the 30-min JWT minted by guest OTP verify
 *   - `accessToken`  — the order's `access_token`, read-only, ≤24h (success page)
 *   - `session`      — no explicit credential; the `kakoa_session` cookie rides
 *                      along automatically (logged-in owner)
 */
import { useCallback } from "react";
import type {
  ApiResult,
  CancelOrderInput,
  LookupRequestInput,
  LookupVerifyInput,
  OrderSummary,
  OrderTracking,
} from "@kakoa/core";

/** Data returned by `POST /api/orders/lookup/request-otp`. */
export interface LookupRequestData {
  sent: true;
  resendAfterSec: number;
}

/** Data returned by `POST /api/orders/lookup/verify`. */
export interface LookupVerifyData {
  trackingToken: string;
  order: OrderSummary;
}

/** Credential a tracking/cancel call is authorized with. */
export type TrackingCredential =
  | { kind: "bearer"; token: string }
  | { kind: "accessToken"; token: string }
  | { kind: "session" };

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

/** Attach the bearer JWT (only the `bearer` credential travels in a header). */
function authHeaders(credential: TrackingCredential): HeadersInit {
  if (credential.kind === "bearer") {
    return { Authorization: `Bearer ${credential.token}` };
  }
  return {};
}

/** `?accessToken=` is the only credential carried in the query string. */
function trackingUrl(
  orderNumber: string,
  credential: TrackingCredential,
): string {
  const base = `/api/orders/${encodeURIComponent(orderNumber)}/tracking`;
  if (credential.kind === "accessToken") {
    return `${base}?accessToken=${encodeURIComponent(credential.token)}`;
  }
  return base;
}

async function parse<T>(response: Response): Promise<ApiResult<T>> {
  try {
    return (await response.json()) as ApiResult<T>;
  } catch {
    return {
      ok: false,
      error: { code: "INTERNAL", message: "Something went wrong. Please try again." },
      requestId: "client",
    };
  }
}

export interface UseTracking {
  requestOtp: (
    input: LookupRequestInput,
  ) => Promise<{ result: ApiResult<LookupRequestData>; retryAfter: number | null }>;
  verifyOtp: (input: LookupVerifyInput) => Promise<ApiResult<LookupVerifyData>>;
  fetchTracking: (
    orderNumber: string,
    credential: TrackingCredential,
  ) => Promise<ApiResult<OrderTracking>>;
  cancelOrder: (
    orderNumber: string,
    input: CancelOrderInput,
    credential: TrackingCredential,
  ) => Promise<ApiResult<{ order: OrderSummary }>>;
}

/**
 * Stable-identity bundle of the four tracking calls. Credentials are passed in
 * per-call (never captured/stored here), so the hook itself holds no secrets.
 */
export function useTracking(): UseTracking {
  const requestOtp = useCallback<UseTracking["requestOtp"]>(async (input) => {
    const response = await fetch("/api/orders/lookup/request-otp", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(input),
    });
    const retryHeader = response.headers.get("Retry-After");
    const retryAfter =
      retryHeader !== null && retryHeader !== "" && Number.isFinite(Number(retryHeader))
        ? Number(retryHeader)
        : null;
    return { result: await parse<LookupRequestData>(response), retryAfter };
  }, []);

  const verifyOtp = useCallback<UseTracking["verifyOtp"]>(async (input) => {
    const response = await fetch("/api/orders/lookup/verify", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(input),
    });
    return parse<LookupVerifyData>(response);
  }, []);

  const fetchTracking = useCallback<UseTracking["fetchTracking"]>(
    async (orderNumber, credential) => {
      const response = await fetch(trackingUrl(orderNumber, credential), {
        method: "GET",
        headers: authHeaders(credential),
        cache: "no-store",
      });
      return parse<OrderTracking>(response);
    },
    [],
  );

  const cancelOrder = useCallback<UseTracking["cancelOrder"]>(
    async (orderNumber, input, credential) => {
      const response = await fetch(
        `/api/orders/${encodeURIComponent(orderNumber)}/cancel`,
        {
          method: "POST",
          headers: { ...JSON_HEADERS, ...authHeaders(credential) },
          body: JSON.stringify(input),
        },
      );
      return parse<{ order: OrderSummary }>(response);
    },
    [],
  );

  return { requestOtp, verifyOtp, fetchTracking, cancelOrder };
}

/** Customer-cancellable order statuses (order-state-machine subset). */
const CANCELLABLE_STATUSES: ReadonlySet<string> = new Set([
  "pending_payment",
  "payment_failed",
  "cod_pending_confirmation",
  "confirmed",
]);

/** Whether the order's current status permits a customer-initiated cancel. */
export function isCancellable(status: string): boolean {
  return CANCELLABLE_STATUSES.has(status);
}
