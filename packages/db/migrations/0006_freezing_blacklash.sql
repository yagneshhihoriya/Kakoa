ALTER TABLE "product_variants" ALTER COLUMN "gst_rate_bp" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "product_variants" ALTER COLUMN "hsn_code" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "order_number" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "image_url" text;--> statement-breakpoint
-- Hand-written data copy (the only non-generated statement in this file): the
-- chocolate-shaped column becomes the preset's `tasting_notes` attribute (type
-- text) before the column goes, so no stored note is lost.
UPDATE "products"
SET "attributes" = coalesce("attributes", '{}'::jsonb)
  || jsonb_build_object('tasting_notes', array_to_string("tasting_notes", ', '))
WHERE cardinality("tasting_notes") > 0;--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "tasting_notes";