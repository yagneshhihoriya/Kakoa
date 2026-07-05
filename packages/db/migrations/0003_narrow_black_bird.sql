CREATE TABLE "notification_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel" text NOT NULL,
	"template_key" text NOT NULL,
	"recipient" text NOT NULL,
	"order_id" uuid,
	"status" text NOT NULL,
	"provider_message_id" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_log_channel_check" CHECK ("notification_log"."channel" IN ('email', 'sms')),
	CONSTRAINT "notification_log_status_check" CHECK ("notification_log"."status" IN ('sent', 'failed', 'skipped'))
);
--> statement-breakpoint
CREATE TABLE "notification_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"channel" text NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_templates_key_channel_uq" UNIQUE("key","channel"),
	CONSTRAINT "notification_templates_channel_check" CHECK ("notification_templates"."channel" IN ('email', 'sms'))
);
--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_updated_by_admin_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_log_created_idx" ON "notification_log" USING btree ("created_at" DESC NULLS LAST);