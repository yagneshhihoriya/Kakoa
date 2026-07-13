/**
 * Newsletter / mailing-list subscribers. Minimal by design: a unique email +
 * source + timestamp. Marketing sends are handled by the email provider; this
 * table is the consented audience of record.
 */
import { sql } from "drizzle-orm";
import { pgTable, text, uuid } from "drizzle-orm/pg-core";
import { timestamptz } from "./helpers";

export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  /** Where the signup came from (home, checkout, …) for basic attribution. */
  source: text("source").notNull().default("storefront"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
});
