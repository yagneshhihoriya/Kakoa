/**
 * Shared column helpers for the KAKOA schema.
 *
 * Conventions (Contract §3.0 / DATABASE_ERD.md): every timestamp is
 * `timestamptz` with servers on UTC; case-insensitive identifiers
 * (emails, coupon codes) use the `citext` extension.
 */
import { customType, timestamp } from 'drizzle-orm/pg-core';

/** `citext` — case-insensitive text. Requires `CREATE EXTENSION citext`. */
export const citext = customType<{ data: string }>({
  dataType() {
    return 'citext';
  },
});

/** UTC `timestamptz` column (JS `Date` mode). */
export function timestamptz(name: string) {
  return timestamp(name, { withTimezone: true, mode: 'date' });
}
