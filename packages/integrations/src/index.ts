export type { SmsProvider } from "./sms/provider";
export {
  getSmsProvider,
  resetSmsProvider,
} from "./sms/index";
export {
  FakeSmsProvider,
  getSentOtps,
  clearSentOtps,
} from "./sms/fake";
export type { SentOtp } from "./sms/fake";
export { Msg91SmsProvider } from "./msg91/client";

// ── Transactional email (launch-gate) ────────────────────────────────
export type { EmailProvider } from "./email/provider";
export {
  getEmailProvider,
  resetEmailProvider,
} from "./email/index";
export {
  FakeEmailProvider,
  getSentEmails,
  clearSentEmails,
} from "./email/fake";
export type { SentEmail } from "./email/fake";
export { ResendEmailProvider } from "./email/resend";

// ── Payments (checkout.md §3) ────────────────────────────────────────
export type { PaymentProvider } from "./payments/provider";
export {
  getPaymentProvider,
  resetPaymentProvider,
} from "./payments/index";
export { MockPaymentProvider } from "./payments/mock";
export { RazorpayPaymentProvider } from "./payments/razorpay";

// ── Shipping (checkout.md §3) ────────────────────────────────────────
export type {
  ShippingProvider,
  ServiceabilityResult,
  ServiceabilityOption,
  CreateShipmentInput,
  CreateShipmentItem,
  CreateShipmentResult,
  AssignAwbResult,
  TrackingResult,
  TrackingScan,
  LabelResult,
  ManifestResult,
  PickupResult,
} from "./shipping/provider";
export { mapShiprocketStatus, SHIPROCKET_STATUS_CODES } from "./shipping/status-map";
export {
  getShippingProvider,
  resetShippingProvider,
} from "./shipping/index";
export { MockShippingProvider } from "./shipping/mock";
export { ShiprocketShippingProvider, buildAdhocOrderBody } from "./shipping/shiprocket";
