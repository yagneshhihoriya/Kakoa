/**
 * Email identity — SERVER-ONLY loader: reads the store_settings rows the pure
 * `buildEmailIdentity` (identity-model.ts) needs and returns the
 * `EmailIdentityModel` for the next send. Read live, like every settings read
 * on the send path, so an owner's Settings edit reaches the very next email.
 */
import { db, storeSettings } from '@kakoa/db';
import { inArray } from 'drizzle-orm';

import { LEGAL_IDENTITY_KEYS } from '@/lib/admin/legal-identity';
import { buildEmailIdentity } from './identity-model';
import type { EmailIdentityModel } from './templates';

export { buildEmailIdentity } from './identity-model';

const IDENTITY_KEYS: readonly string[] = [...LEGAL_IDENTITY_KEYS, 'support_email'];

export async function loadEmailIdentity(): Promise<EmailIdentityModel> {
  const rows = await db
    .select({ key: storeSettings.key, value: storeSettings.value })
    .from(storeSettings)
    .where(inArray(storeSettings.key, [...IDENTITY_KEYS]));
  return buildEmailIdentity(new Map(rows.map((r) => [r.key, r.value])));
}
