/**
 * Shared client-side checkout types (docs/modules/checkout.md §2 flow).
 *
 * These describe the CLIENT state machine only — every money figure that
 * matters is re-derived server-side by `/api/checkout/quote` and
 * `/api/checkout/orders`. The client holds display copies and refs (address
 * inputs, coupon code, delivery choice) and never trusts its own prices.
 */
import type {
  AddressInput,
  CheckoutQuote,
  DeliveryOption,
  PaymentMode,
  SavedAddress,
  ServiceabilityResult,
} from "@kakoa/core";

/** The four wizard steps, in order (prototype 50-checkout stepper). */
export type CheckoutStep = 1 | 2 | 3 | 4;

/** Contact fields (§1.1) — phone required, email optional. */
export interface ContactState {
  phone: string;
  email: string;
}

/**
 * Address form state. Mirrors `AddressInput` but every field is a string the
 * form binds to (never `undefined`); `stateCode` is set by the state <select>.
 */
export interface AddressState {
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  landmark: string;
  city: string;
  /** Display name from GST_STATES; empty until the customer picks one. */
  state: string;
  /** Two-digit GST code driven by the state <select>. */
  stateCode: string;
  pincode: string;
}

/** A COD OTP challenge the customer has verified locally (held for placement). */
export interface VerifiedCodOtp {
  challengeId: string;
  code: string;
}

/** Hydration/health of the serviceability lookup on the current pincode. */
export type ServiceabilityStatus =
  | "idle"
  | "loading"
  | "serviceable"
  | "unserviceable"
  | "fallback"
  | "error";

/** Hydration/health of the current quote. */
export type QuoteStatus = "idle" | "loading" | "ready" | "error";

/** Non-blocking per-line "just sold out" markers from a 409 OUT_OF_STOCK. */
export interface SoldOutLine {
  variantId: string;
  requested: number;
  available: number;
}

/** Fee/policy thresholds the summary + payment step need (`store_settings`). */
export interface CheckoutSummarySettings {
  freeShippingThresholdPaise: number;
  giftWrapFeePaise: number;
  codFeePaise: number;
  /** COD value cap — total above this disables COD (checkout.md §7.7). */
  codMaxOrderPaise: number;
  /**
   * Master COD switch (default false = prepaid-only). When false the payment
   * step hides the Cash on Delivery option entirely and only "Pay online" shows.
   */
  codEnabled: boolean;
}

/** Server payload for the prepaid Razorpay handoff (§5.3 prepaid 201). */
export interface RazorpayHandoff {
  orderId: string;
  keyId: string;
  amountPaise: number;
  currency: "INR";
  prefill: { contact: string; email?: string };
}

/** What the client needs to render the success / payment-handoff surfaces. */
export interface PlacedOrder {
  orderId: string;
  orderNumber: string;
  accessToken: string;
  paymentMode: PaymentMode;
  /** Present only for prepaid orders awaiting the Razorpay modal. */
  razorpay: RazorpayHandoff | null;
}

/**
 * Strip a leading `+91` / `91` / `0` from an Indian mobile down to the bare
 * 10-digit form the checkout schema (`^[6-9][0-9]{9}$`) and the form expect.
 * Saved addresses (and the session contact) store phones E.164 (`+91…`), so a
 * saved-address checkout would otherwise send `+91XXXXXXXXXX` and 400.
 */
export function toTenDigitPhone(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/** Convert an `AddressState` to the wire `AddressInput` (drops empty optionals). */
export function toAddressInput(address: AddressState): AddressInput {
  const input: AddressInput = {
    fullName: address.fullName.trim(),
    phone: toTenDigitPhone(address.phone),
    line1: address.line1.trim(),
    city: address.city.trim(),
    state: address.state,
    stateCode: address.stateCode,
    pincode: address.pincode.trim(),
  };
  const line2 = address.line2.trim();
  if (line2 !== "") input.line2 = line2;
  const landmark = address.landmark.trim();
  if (landmark !== "") input.landmark = landmark;
  return input;
}

/** Hydrate a saved-book row into the form-bound `AddressState` (empty for
 * missing optionals — the form never binds `undefined`). */
export function savedAddressToState(saved: SavedAddress): AddressState {
  return {
    fullName: saved.fullName,
    phone: toTenDigitPhone(saved.phone),
    line1: saved.line1,
    line2: saved.line2 ?? "",
    landmark: saved.landmark ?? "",
    city: saved.city,
    state: saved.state,
    stateCode: saved.stateCode,
    pincode: saved.pincode,
  };
}

/** Re-export for step-component prop typing convenience. */
export type {
  AddressInput,
  CheckoutQuote,
  DeliveryOption,
  PaymentMode,
  SavedAddress,
  ServiceabilityResult,
};
