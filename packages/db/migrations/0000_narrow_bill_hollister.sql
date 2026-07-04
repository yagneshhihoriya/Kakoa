CREATE TYPE "public"."actor_type" AS ENUM('system', 'customer', 'admin', 'webhook');--> statement-breakpoint
CREATE TYPE "public"."admin_role" AS ENUM('owner', 'staff');--> statement-breakpoint
CREATE TYPE "public"."cart_status" AS ENUM('active', 'merged', 'converted', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."delivery_option" AS ENUM('standard', 'express');--> statement-breakpoint
CREATE TYPE "public"."inventory_reason" AS ENUM('initial_stock', 'order_placed', 'order_cancelled', 'payment_expired', 'rto_restock', 'return_restock', 'manual_adjustment', 'stock_correction', 'damage_writeoff');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending_payment', 'payment_failed', 'cod_pending_confirmation', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'rto_initiated', 'rto_delivered');--> statement-breakpoint
CREATE TYPE "public"."otp_channel" AS ENUM('sms', 'email');--> statement-breakpoint
CREATE TYPE "public"."otp_purpose" AS ENUM('customer_login', 'cod_verification', 'order_lookup', 'admin_login');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('card', 'upi', 'netbanking', 'wallet', 'emi', 'cod', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."payment_mode" AS ENUM('prepaid', 'cod');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('razorpay', 'cod');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('created', 'authorized', 'captured', 'failed', 'partially_refunded', 'refunded', 'cod_pending_collection', 'cod_collected', 'cod_pending_remittance', 'cod_remitted');--> statement-breakpoint
CREATE TYPE "public"."refund_destination" AS ENUM('original_method', 'bank_transfer', 'upi');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('initiated', 'processed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."return_reason" AS ENUM('damaged_or_melted', 'wrong_item', 'quality_issue', 'changed_mind', 'other');--> statement-breakpoint
CREATE TYPE "public"."return_resolution" AS ENUM('refund', 'replacement');--> statement-breakpoint
CREATE TYPE "public"."return_status" AS ENUM('requested', 'approved', 'rejected', 'pickup_scheduled', 'received', 'refunded', 'closed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."shipment_status" AS ENUM('pending', 'awb_assigned', 'pickup_scheduled', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'rto_initiated', 'rto_in_transit', 'rto_delivered', 'cancelled', 'lost');--> statement-breakpoint
CREATE TYPE "public"."webhook_provider" AS ENUM('razorpay', 'shiprocket');--> statement-breakpoint
CREATE TYPE "public"."webhook_status" AS ENUM('received', 'processing', 'processed', 'failed', 'skipped');--> statement-breakpoint
CREATE SEQUENCE "public"."order_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 48210 CACHE 1;--> statement-breakpoint
CREATE TABLE "store_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"position" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug"),
	CONSTRAINT "categories_slug_check" CHECK ("categories"."slug" ~ '^[a-z0-9-]+$')
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"url" text NOT NULL,
	"alt" text DEFAULT '' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"price_paise" integer NOT NULL,
	"compare_at_price_paise" integer,
	"gst_rate_bp" integer DEFAULT 500 NOT NULL,
	"hsn_code" text DEFAULT '1806' NOT NULL,
	"weight_grams" integer NOT NULL,
	"ship_weight_grams" integer NOT NULL,
	"length_cm" numeric(6, 2),
	"breadth_cm" numeric(6, 2),
	"height_cm" numeric(6, 2),
	"stock_quantity" integer DEFAULT 0 NOT NULL,
	"low_stock_threshold" integer DEFAULT 10 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_variants_sku_unique" UNIQUE("sku"),
	CONSTRAINT "product_variants_price_check" CHECK ("product_variants"."price_paise" > 0),
	CONSTRAINT "product_variants_compare_at_check" CHECK ("product_variants"."compare_at_price_paise" > "product_variants"."price_paise"),
	CONSTRAINT "product_variants_gst_rate_check" CHECK ("product_variants"."gst_rate_bp" BETWEEN 0 AND 2800),
	CONSTRAINT "product_variants_weight_check" CHECK ("product_variants"."weight_grams" > 0),
	CONSTRAINT "product_variants_stock_check" CHECK ("product_variants"."stock_quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"category_id" uuid NOT NULL,
	"blurb" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"tasting_notes" text[] DEFAULT '{}'::text[] NOT NULL,
	"ingredients" text DEFAULT '' NOT NULL,
	"allergens" text DEFAULT '' NOT NULL,
	"nutrition_facts" jsonb,
	"shelf_life_days" integer,
	"storage_instructions" text,
	"is_veg" boolean DEFAULT true NOT NULL,
	"badge" text,
	"tone" text DEFAULT 'dark' NOT NULL,
	"rating_avg" numeric(3, 2) DEFAULT '0' NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug"),
	CONSTRAINT "products_slug_check" CHECK ("products"."slug" ~ '^[a-z0-9-]+$'),
	CONSTRAINT "products_shelf_life_check" CHECK ("products"."shelf_life_days" > 0)
);
--> statement-breakpoint
CREATE TABLE "customer_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"label" text DEFAULT 'Home' NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"line1" text NOT NULL,
	"line2" text,
	"landmark" text,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"state_code" char(2) NOT NULL,
	"pincode" char(6) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_addresses_phone_check" CHECK ("customer_addresses"."phone" ~ '^\+91[6-9][0-9]{9}$'),
	CONSTRAINT "customer_addresses_pincode_check" CHECK ("customer_addresses"."pincode" ~ '^[1-9][0-9]{5}$')
);
--> statement-breakpoint
CREATE TABLE "customer_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"user_agent" text,
	"ip" "inet",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text,
	"email" "citext",
	"phone_verified_at" timestamp with time zone,
	"email_verified_at" timestamp with time zone,
	"name" text,
	"is_blocked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_phone_unique" UNIQUE("phone"),
	CONSTRAINT "customers_email_unique" UNIQUE("email"),
	CONSTRAINT "customers_phone_format_check" CHECK ("customers"."phone" ~ '^\+91[6-9][0-9]{9}$'),
	CONSTRAINT "customers_contact_check" CHECK ("customers"."phone" IS NOT NULL OR "customers"."email" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "otp_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel" "otp_channel" NOT NULL,
	"destination" text NOT NULL,
	"purpose" "otp_purpose" NOT NULL,
	"code_hash" text NOT NULL,
	"context" jsonb,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip" "inet",
	CONSTRAINT "otp_challenges_attempts_check" CHECK ("otp_challenges"."attempts" <= 5)
);
--> statement-breakpoint
CREATE TABLE "cart_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cart_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"gift_wrap" boolean DEFAULT false NOT NULL,
	"gift_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cart_items_cart_variant_uq" UNIQUE("cart_id","variant_id"),
	CONSTRAINT "cart_items_quantity_check" CHECK ("cart_items"."quantity" BETWEEN 1 AND 20),
	CONSTRAINT "cart_items_gift_message_check" CHECK (char_length("cart_items"."gift_message") <= 300)
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid,
	"status" "cart_status" DEFAULT 'active' NOT NULL,
	"coupon_id" uuid,
	"merged_into_cart_id" uuid,
	"expires_at" timestamp with time zone DEFAULT now() + interval '30 days' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "carts_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "coupon_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coupon_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"customer_id" uuid,
	"contact_phone" text NOT NULL,
	"discount_paise" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupon_redemptions_coupon_order_uq" UNIQUE("coupon_id","order_id"),
	CONSTRAINT "coupon_redemptions_discount_check" CHECK ("coupon_redemptions"."discount_paise" >= 0)
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" "citext" NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"percent_bp" integer,
	"flat_paise" integer,
	"max_discount_paise" integer,
	"min_subtotal_paise" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone,
	"usage_limit" integer,
	"per_customer_limit" integer DEFAULT 1 NOT NULL,
	"first_order_only" boolean DEFAULT false NOT NULL,
	"redemption_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_code_unique" UNIQUE("code"),
	CONSTRAINT "coupons_code_length_check" CHECK (char_length("coupons"."code"::text) BETWEEN 3 AND 24),
	CONSTRAINT "coupons_percent_bp_check" CHECK ("coupons"."percent_bp" BETWEEN 1 AND 10000),
	CONSTRAINT "coupons_flat_paise_check" CHECK ("coupons"."flat_paise" > 0),
	CONSTRAINT "coupons_max_discount_check" CHECK ("coupons"."max_discount_paise" > 0),
	CONSTRAINT "coupons_usage_limit_check" CHECK ("coupons"."usage_limit" > 0),
	CONSTRAINT "coupons_kind_check" CHECK (num_nonnulls("coupons"."percent_bp", "coupons"."flat_paise") = 1)
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"product_name" text NOT NULL,
	"variant_name" text NOT NULL,
	"sku" text NOT NULL,
	"image_url" text,
	"hsn_code" text NOT NULL,
	"gst_rate_bp" integer NOT NULL,
	"unit_price_paise" integer NOT NULL,
	"quantity" integer NOT NULL,
	"line_total_paise" integer NOT NULL,
	"taxable_value_paise" integer NOT NULL,
	"cgst_paise" integer DEFAULT 0 NOT NULL,
	"sgst_paise" integer DEFAULT 0 NOT NULL,
	"igst_paise" integer DEFAULT 0 NOT NULL,
	"gift_wrap" boolean DEFAULT false NOT NULL,
	"gift_wrap_fee_paise" integer DEFAULT 0 NOT NULL,
	"gift_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_items_unit_price_check" CHECK ("order_items"."unit_price_paise" > 0),
	CONSTRAINT "order_items_quantity_check" CHECK ("order_items"."quantity" > 0),
	CONSTRAINT "order_items_gift_message_check" CHECK (char_length("order_items"."gift_message") <= 300)
);
--> statement-breakpoint
CREATE TABLE "order_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"from_status" "order_status",
	"to_status" "order_status" NOT NULL,
	"actor_type" "actor_type" NOT NULL,
	"actor_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" text DEFAULT 'KK-' || lpad(nextval('order_number_seq')::text, 5, '0') NOT NULL,
	"invoice_number" text,
	"customer_id" uuid,
	"cart_id" uuid,
	"status" "order_status" NOT NULL,
	"payment_mode" "payment_mode" NOT NULL,
	"currency" char(3) DEFAULT 'INR' NOT NULL,
	"contact_phone" text NOT NULL,
	"contact_email" "citext",
	"cod_phone_verified_at" timestamp with time zone,
	"shipping_address" jsonb NOT NULL,
	"billing_address" jsonb,
	"ship_to_state_code" char(2) NOT NULL,
	"delivery_opt" "delivery_option" NOT NULL,
	"subtotal_paise" integer NOT NULL,
	"discount_paise" integer DEFAULT 0 NOT NULL,
	"shipping_fee_paise" integer DEFAULT 0 NOT NULL,
	"cod_fee_paise" integer DEFAULT 0 NOT NULL,
	"gift_wrap_total_paise" integer DEFAULT 0 NOT NULL,
	"total_paise" integer NOT NULL,
	"cgst_paise" integer DEFAULT 0 NOT NULL,
	"sgst_paise" integer DEFAULT 0 NOT NULL,
	"igst_paise" integer DEFAULT 0 NOT NULL,
	"coupon_id" uuid,
	"coupon_code" text,
	"idempotency_key" text,
	"access_token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"customer_note" text,
	"cancel_reason" text,
	"placed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"packed_at" timestamp with time zone,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"rto_delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number"),
	CONSTRAINT "orders_invoice_number_unique" UNIQUE("invoice_number"),
	CONSTRAINT "orders_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "orders_access_token_unique" UNIQUE("access_token"),
	CONSTRAINT "orders_contact_phone_check" CHECK ("orders"."contact_phone" ~ '^\+91[6-9][0-9]{9}$'),
	CONSTRAINT "orders_subtotal_check" CHECK ("orders"."subtotal_paise" >= 0),
	CONSTRAINT "orders_discount_check" CHECK ("orders"."discount_paise" >= 0),
	CONSTRAINT "orders_shipping_fee_check" CHECK ("orders"."shipping_fee_paise" >= 0),
	CONSTRAINT "orders_cod_fee_check" CHECK ("orders"."cod_fee_paise" >= 0),
	CONSTRAINT "orders_gift_wrap_total_check" CHECK ("orders"."gift_wrap_total_paise" >= 0),
	CONSTRAINT "orders_total_check" CHECK ("orders"."total_paise" >= 0),
	CONSTRAINT "orders_total_math_check" CHECK ("orders"."total_paise" = "orders"."subtotal_paise" - "orders"."discount_paise" + "orders"."shipping_fee_paise" + "orders"."cod_fee_paise" + "orders"."gift_wrap_total_paise")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"provider_order_id" text,
	"provider_payment_id" text,
	"method" "payment_method" DEFAULT 'unknown' NOT NULL,
	"status" "payment_status" DEFAULT 'created' NOT NULL,
	"amount_paise" integer NOT NULL,
	"amount_refunded_paise" integer DEFAULT 0 NOT NULL,
	"signature_verified" boolean DEFAULT false NOT NULL,
	"failure_code" text,
	"failure_reason" text,
	"cod_remitted_at" timestamp with time zone,
	"cod_remittance_ref" text,
	"raw_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_amount_check" CHECK ("payments"."amount_paise" > 0),
	CONSTRAINT "payments_refunded_check" CHECK ("payments"."amount_refunded_paise" <= "payments"."amount_paise")
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"payment_id" uuid,
	"return_request_id" uuid,
	"provider_refund_id" text,
	"destination" "refund_destination" NOT NULL,
	"amount_paise" integer NOT NULL,
	"status" "refund_status" DEFAULT 'initiated' NOT NULL,
	"reason" text NOT NULL,
	"payout_reference" text,
	"initiated_by" uuid,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refunds_amount_check" CHECK ("refunds"."amount_paise" > 0)
);
--> statement-breakpoint
CREATE TABLE "shipment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"status" "shipment_status" NOT NULL,
	"sr_status_code" text,
	"activity" text,
	"location" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"source" text NOT NULL,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipment_events_dedup_uq" UNIQUE("shipment_id","status","occurred_at"),
	CONSTRAINT "shipment_events_source_check" CHECK ("shipment_events"."source" IN ('webhook', 'poll', 'manual'))
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"shiprocket_order_id" text,
	"shiprocket_shipment_id" text,
	"awb_code" text,
	"courier_company_id" integer,
	"courier_name" text,
	"label_url" text,
	"manifest_url" text,
	"status" "shipment_status" DEFAULT 'pending' NOT NULL,
	"cod" boolean DEFAULT false NOT NULL,
	"pickup_scheduled_at" timestamp with time zone,
	"expected_delivery_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"superseded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipments_awb_code_unique" UNIQUE("awb_code")
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "webhook_provider" NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"headers" jsonb,
	"status" "webhook_status" DEFAULT 'received' NOT NULL,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	CONSTRAINT "webhook_events_provider_event_uq" UNIQUE("provider","event_id")
);
--> statement-breakpoint
CREATE TABLE "inventory_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"reason" "inventory_reason" NOT NULL,
	"order_id" uuid,
	"admin_user_id" uuid,
	"note" text,
	"stock_after" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inv_adj_delta_check" CHECK ("inventory_adjustments"."delta" <> 0),
	CONSTRAINT "inv_adj_stock_after_check" CHECK ("inventory_adjustments"."stock_after" >= 0)
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"order_item_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"title" text,
	"body" text NOT NULL,
	"status" "review_status" DEFAULT 'pending' NOT NULL,
	"moderated_by" uuid,
	"moderated_at" timestamp with time zone,
	"moderation_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_order_item_id_unique" UNIQUE("order_item_id"),
	CONSTRAINT "reviews_rating_check" CHECK ("reviews"."rating" BETWEEN 1 AND 5),
	CONSTRAINT "reviews_title_check" CHECK (char_length("reviews"."title") <= 120),
	CONSTRAINT "reviews_body_check" CHECK (char_length("reviews"."body") BETWEEN 10 AND 2000)
);
--> statement-breakpoint
CREATE TABLE "wishlist_items" (
	"customer_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wishlist_items_pk" PRIMARY KEY("customer_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "return_request_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_request_id" uuid NOT NULL,
	"order_item_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "return_request_items_request_item_uq" UNIQUE("return_request_id","order_item_id"),
	CONSTRAINT "return_request_items_quantity_check" CHECK ("return_request_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "return_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"customer_id" uuid,
	"status" "return_status" DEFAULT 'requested' NOT NULL,
	"reason" "return_reason" NOT NULL,
	"resolution" "return_resolution" DEFAULT 'refund' NOT NULL,
	"comment" text,
	"photo_urls" text[] DEFAULT '{}'::text[] NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"received_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "return_requests_comment_check" CHECK (char_length("return_requests"."comment") <= 1000)
);
--> statement-breakpoint
CREATE TABLE "admin_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"ip" "inet",
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" "citext" NOT NULL,
	"name" text NOT NULL,
	"role" "admin_role" DEFAULT 'staff' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "store_settings" ADD CONSTRAINT "store_settings_updated_by_admin_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_sessions" ADD CONSTRAINT "customer_sessions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_merged_into_cart_id_carts_id_fk" FOREIGN KEY ("merged_into_cart_id") REFERENCES "public"."carts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_return_request_id_return_requests_id_fk" FOREIGN KEY ("return_request_id") REFERENCES "public"."return_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_initiated_by_admin_users_id_fk" FOREIGN KEY ("initiated_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_moderated_by_admin_users_id_fk" FOREIGN KEY ("moderated_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_request_items" ADD CONSTRAINT "return_request_items_return_request_id_return_requests_id_fk" FOREIGN KEY ("return_request_id") REFERENCES "public"."return_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_request_items" ADD CONSTRAINT "return_request_items_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_decided_by_admin_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_images_product_pos_idx" ON "product_images" USING btree ("product_id","position");--> statement-breakpoint
CREATE INDEX "product_variants_product_idx" ON "product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_variants_one_default_idx" ON "product_variants" USING btree ("product_id") WHERE "product_variants"."is_default";--> statement-breakpoint
CREATE INDEX "product_variants_low_stock_idx" ON "product_variants" USING btree ("stock_quantity") WHERE "product_variants"."is_active" AND "product_variants"."stock_quantity" <= 10;--> statement-breakpoint
CREATE INDEX "products_category_active_idx" ON "products" USING btree ("category_id") WHERE "products"."is_active";--> statement-breakpoint
CREATE INDEX "products_search_idx" ON "products" USING gin (("name" || ' ' || "blurb") gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "customer_addresses_one_default_idx" ON "customer_addresses" USING btree ("customer_id") WHERE "customer_addresses"."is_default";--> statement-breakpoint
CREATE INDEX "customer_sessions_customer_idx" ON "customer_sessions" USING btree ("customer_id") WHERE "customer_sessions"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "otp_open_idx" ON "otp_challenges" USING btree ("destination","purpose","created_at" DESC NULLS LAST) WHERE "otp_challenges"."consumed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "otp_rate_idx" ON "otp_challenges" USING btree ("destination","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "carts_one_active_per_customer_idx" ON "carts" USING btree ("customer_id") WHERE "carts"."status" = 'active' AND "carts"."customer_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "carts_abandoned_sweep_idx" ON "carts" USING btree ("updated_at") WHERE "carts"."status" = 'active';--> statement-breakpoint
CREATE INDEX "coupon_redemptions_phone_idx" ON "coupon_redemptions" USING btree ("coupon_id","contact_phone");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_variant_idx" ON "order_items" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "osh_order_idx" ON "order_status_history" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_customer_idx" ON "orders" USING btree ("customer_id","placed_at" DESC NULLS LAST) WHERE "orders"."customer_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status","placed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "orders_open_ops_idx" ON "orders" USING btree ("placed_at") WHERE "orders"."status" IN ('cod_pending_confirmation', 'confirmed', 'packed');--> statement-breakpoint
CREATE INDEX "orders_phone_idx" ON "orders" USING btree ("contact_phone");--> statement-breakpoint
CREATE INDEX "orders_pending_expiry_idx" ON "orders" USING btree ("placed_at") WHERE "orders"."status" = 'pending_payment';--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_payment_idx" ON "payments" USING btree ("provider","provider_payment_id") WHERE "payments"."provider_payment_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_order_idx" ON "payments" USING btree ("provider","provider_order_id") WHERE "payments"."provider_order_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payments_cod_remit_idx" ON "payments" USING btree ("status") WHERE "payments"."status" IN ('cod_collected', 'cod_pending_remittance');--> statement-breakpoint
CREATE UNIQUE INDEX "refunds_provider_idx" ON "refunds" USING btree ("provider_refund_id") WHERE "refunds"."provider_refund_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "refunds_order_idx" ON "refunds" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "shipment_events_shipment_idx" ON "shipment_events" USING btree ("shipment_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "shipments_one_active_idx" ON "shipments" USING btree ("order_id") WHERE "shipments"."superseded_at" IS NULL;--> statement-breakpoint
CREATE INDEX "shipments_stale_poll_idx" ON "shipments" USING btree ("last_synced_at") WHERE "shipments"."superseded_at" IS NULL AND "shipments"."status" IN ('awb_assigned', 'pickup_scheduled', 'picked_up', 'in_transit', 'out_for_delivery', 'rto_initiated', 'rto_in_transit');--> statement-breakpoint
CREATE INDEX "webhook_events_pending_idx" ON "webhook_events" USING btree ("received_at") WHERE "webhook_events"."status" IN ('received', 'failed');--> statement-breakpoint
CREATE INDEX "inv_adj_variant_idx" ON "inventory_adjustments" USING btree ("variant_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "inv_adj_once_per_cause_idx" ON "inventory_adjustments" USING btree ("order_id","variant_id","reason") WHERE "inventory_adjustments"."reason" IN ('order_placed', 'order_cancelled', 'payment_expired', 'rto_restock', 'return_restock');--> statement-breakpoint
CREATE INDEX "reviews_product_approved_idx" ON "reviews" USING btree ("product_id","created_at" DESC NULLS LAST) WHERE "reviews"."status" = 'approved';--> statement-breakpoint
CREATE INDEX "reviews_moderation_queue_idx" ON "reviews" USING btree ("created_at") WHERE "reviews"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "return_requests_one_open_idx" ON "return_requests" USING btree ("order_id") WHERE "return_requests"."status" IN ('requested', 'approved', 'pickup_scheduled');--> statement-breakpoint
CREATE INDEX "return_requests_queue_idx" ON "return_requests" USING btree ("created_at") WHERE "return_requests"."status" = 'requested';--> statement-breakpoint
CREATE INDEX "admin_audit_entity_idx" ON "admin_audit_log" USING btree ("entity_type","entity_id","created_at" DESC NULLS LAST);