/**
 * Canonical enum string lists — Contract §1.0 (PROJECT_PLAN.md §3.0).
 *
 * These `as const` tuples are the single source of truth: `packages/db`
 * builds `pgEnum(...)` from them and zod schemas derive `z.enum(...)` from
 * them, so DB and validation can never drift. Every value string is
 * verbatim from the Contract DDL.
 */

export const ORDER_STATUSES = [
  'pending_payment',
  'payment_failed',
  'cod_pending_confirmation',
  'confirmed',
  'packed',
  'shipped',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'rto_initiated',
  'rto_delivered',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_MODES = ['prepaid', 'cod'] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const PAYMENT_PROVIDERS = ['razorpay', 'cod'] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const PAYMENT_STATUSES = [
  'created',
  'authorized',
  'captured',
  'failed',
  'partially_refunded',
  'refunded',
  'cod_pending_collection',
  'cod_collected',
  'cod_pending_remittance',
  'cod_remitted',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = [
  'card',
  'upi',
  'netbanking',
  'wallet',
  'emi',
  'cod',
  'unknown',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const REFUND_STATUSES = ['initiated', 'processed', 'failed'] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export const REFUND_DESTINATIONS = [
  'original_method',
  'bank_transfer',
  'upi',
] as const;
export type RefundDestination = (typeof REFUND_DESTINATIONS)[number];

export const SHIPMENT_STATUSES = [
  'pending',
  'awb_assigned',
  'pickup_scheduled',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'rto_initiated',
  'rto_in_transit',
  'rto_delivered',
  'cancelled',
  'lost',
] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const WEBHOOK_PROVIDERS = ['razorpay', 'shiprocket'] as const;
export type WebhookProvider = (typeof WEBHOOK_PROVIDERS)[number];

export const WEBHOOK_STATUSES = [
  'received',
  'processing',
  'processed',
  'failed',
  'skipped',
] as const;
export type WebhookStatus = (typeof WEBHOOK_STATUSES)[number];

export const OTP_CHANNELS = ['sms', 'email'] as const;
export type OtpChannel = (typeof OTP_CHANNELS)[number];

export const OTP_PURPOSES = [
  'customer_login',
  'cod_verification',
  'order_lookup',
  'admin_login',
] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

export const CART_STATUSES = [
  'active',
  'merged',
  'converted',
  'abandoned',
] as const;
export type CartStatus = (typeof CART_STATUSES)[number];

export const DELIVERY_OPTIONS = ['standard', 'express'] as const;
export type DeliveryOption = (typeof DELIVERY_OPTIONS)[number];

export const REVIEW_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const RETURN_STATUSES = [
  'requested',
  'approved',
  'rejected',
  'pickup_scheduled',
  'received',
  'refunded',
  'closed',
  'cancelled',
] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];

export const RETURN_REASONS = [
  'damaged_or_melted',
  'wrong_item',
  'quality_issue',
  'changed_mind',
  'other',
] as const;
export type ReturnReason = (typeof RETURN_REASONS)[number];

export const RETURN_RESOLUTIONS = ['refund', 'replacement'] as const;
export type ReturnResolution = (typeof RETURN_RESOLUTIONS)[number];

export const ADMIN_ROLES = ['owner', 'staff'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ACTOR_TYPES = ['system', 'customer', 'admin', 'webhook'] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];

export const INVENTORY_REASONS = [
  'initial_stock',
  'order_placed',
  'order_cancelled',
  'payment_expired',
  'rto_restock',
  'return_restock',
  'manual_adjustment',
  'stock_correction',
  'damage_writeoff',
] as const;
export type InventoryReason = (typeof INVENTORY_REASONS)[number];
