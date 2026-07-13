/**
 * Customer profile edit + account deletion (DPDP right to erasure).
 * SERVER-ONLY: uses @kakoa/db. Scoped to the caller's own `customerId`.
 */
import { customers, db } from "@kakoa/db";
import { and, eq, ne, sql } from "drizzle-orm";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type UpdateProfileResult =
  | { ok: true }
  | { ok: false; code: "VALIDATION_ERROR" | "CONFLICT"; message: string };

/**
 * Update the customer's name and/or email. Phone is the verified login identity
 * and is not editable here. Email must be unique + well-formed. A customer must
 * retain at least one contact (phone or email).
 */
export async function updateCustomerProfile(
  customerId: string,
  input: { name?: unknown; email?: unknown },
): Promise<UpdateProfileResult> {
  const set: Record<string, unknown> = {};

  if ("name" in input) {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (name.length > 80) return { ok: false, code: "VALIDATION_ERROR", message: "Name must be 80 characters or fewer." };
    set.name = name === "" ? null : name;
  }

  if ("email" in input) {
    const raw = input.email;
    if (raw === null || raw === "") {
      set.email = null;
    } else {
      const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";
      if (!EMAIL_RE.test(email) || email.length > 254) {
        return { ok: false, code: "VALIDATION_ERROR", message: "Enter a valid email address." };
      }
      // Uniqueness pre-check (race-backstopped by the unique index below).
      const [taken] = await db
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.email, email), ne(customers.id, customerId)))
        .limit(1);
      if (taken) return { ok: false, code: "CONFLICT", message: "That email is already in use." };
      set.email = email;
    }
  }

  if (Object.keys(set).length === 0) return { ok: true };
  set.updatedAt = sql`now()`;

  try {
    await db.update(customers).set(set).where(eq(customers.id, customerId));
    return { ok: true };
  } catch {
    // Unique(email) race or contact-check (would strip the last contact).
    return { ok: false, code: "CONFLICT", message: "Couldn't update your profile — check your email." };
  }
}

/**
 * Permanently delete the customer's account (DPDP erasure). Cascades remove
 * sessions, addresses, wishlist, reviews and carts; ORDERS are retained but
 * de-linked (orders.customer_id → NULL via the FK) so tax/invoice records
 * survive as the law requires, without the personal account.
 */
export async function deleteCustomerAccount(customerId: string): Promise<void> {
  await db.delete(customers).where(eq(customers.id, customerId));
}
