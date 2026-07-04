/**
 * Saved-address-book contracts (smart-address Phase 1, customer-accounts.md
 * §1.9 / §5). A saved address is a checkout `AddressInput` PLUS book metadata
 * (`label`, `isDefault`). The two must round-trip losslessly: any row that
 * validates here MUST also validate against `addressInputSchema`, because the
 * checkout picker feeds a chosen saved address straight into place-order. To
 * guarantee that, every shipping field below is imported/derived from
 * `checkout.ts` field shapes — the maxlengths (`line1` ≤150, `landmark` ≤100,
 * etc.) are defined once there and reused, so the book and checkout can never
 * drift.
 *
 * `.strict()` everywhere: unknown keys → `VALIDATION_ERROR`. TS types are
 * `z.infer` (inputs) or the explicit `SavedAddress` shape (the API/DB row).
 */

import { z } from 'zod';

import { addressInputSchema } from './checkout';

/* ------------------------------------------------------------------ */
/* Book metadata                                                       */
/* ------------------------------------------------------------------ */

/**
 * Address label ("Home", "Work", "Mom's place"). Free text, trimmed,
 * 1–30 chars (customer_addresses.label DB default 'Home'). Control chars are
 * not stripped here — the DB column is short and the label is display-only, so
 * the length + non-empty rule is sufficient.
 */
export const addressLabelSchema = z
  .string()
  .trim()
  .min(1, 'Give this address a short label (e.g., Home).')
  .max(30, 'Label must be 30 characters or fewer.')
  .default('Home');

/** UUID (any RFC-4122 version) identifying a saved address row. */
const addressUuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'Invalid address id.',
  );

/* ------------------------------------------------------------------ */
/* savedAddressSchema — the canonical book row                         */
/* ------------------------------------------------------------------ */

/**
 * A full saved address as validated on the way IN (create/replace). Extends
 * every checkout shipping field with `label` (default 'Home') and `isDefault`
 * (default false). Reuses `addressInputSchema`'s field rules verbatim via
 * `.extend`, so book ↔ checkout stay byte-for-byte compatible.
 */
export const savedAddressSchema = addressInputSchema
  .extend({
    label: addressLabelSchema,
    isDefault: z.boolean().default(false),
  })
  .strict();
export type SavedAddressInput = z.input<typeof savedAddressSchema>;

/* ------------------------------------------------------------------ */
/* createAddressInputSchema — POST /api/account/addresses              */
/* ------------------------------------------------------------------ */

/**
 * Create payload: a saved address WITHOUT a caller-forced default flag by
 * default, but `isDefault` may be sent optionally (the backend also
 * auto-defaults the very first address regardless). Shipping fields + label
 * are required-with-defaults per `savedAddressSchema`.
 */
export const createAddressInputSchema = savedAddressSchema
  .omit({ isDefault: true })
  .extend({
    isDefault: z.boolean().optional(),
  })
  .strict();
export type CreateAddressInput = z.input<typeof createAddressInputSchema>;

/* ------------------------------------------------------------------ */
/* updateAddressInputSchema — PATCH /api/account/addresses/[id]        */
/* ------------------------------------------------------------------ */

/**
 * Partial update: an `id` plus any subset of address fields / label /
 * isDefault. `.partial()` on the shipping fields makes each optional; `id` is
 * always required. Omitted fields are left untouched by the backend.
 */
export const updateAddressInputSchema = addressInputSchema
  .extend({
    label: addressLabelSchema,
    isDefault: z.boolean(),
  })
  .partial()
  .extend({ id: addressUuidSchema })
  .strict();
export type UpdateAddressInput = z.input<typeof updateAddressInputSchema>;

/* ------------------------------------------------------------------ */
/* addressIdSchema — DELETE / set-default path param                   */
/* ------------------------------------------------------------------ */

export const addressIdSchema = z.object({ id: addressUuidSchema }).strict();
export type AddressIdInput = z.infer<typeof addressIdSchema>;

/* ------------------------------------------------------------------ */
/* SavedAddress — the API/DB row shape (response)                      */
/* ------------------------------------------------------------------ */

/**
 * A saved address as returned by the API (all fields resolved, no defaults
 * pending). This is the shape `listAddresses()` yields and the checkout picker
 * consumes. `line2`/`landmark` are optional to mirror the nullable DB columns.
 */
export interface SavedAddress {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
  isDefault: boolean;
}
