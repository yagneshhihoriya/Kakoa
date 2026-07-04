/**
 * Admin settings data layer (HANDOFF-Settings.md). Reads/writes the singleton
 * `store_settings` key/value store that DRIVES live checkout behavior (fees, COD
 * toggle, GST identity). Correctness rules:
 *  - `value` is jsonb — a number is stored as a JSON NUMBER, a bool as a JSON
 *    boolean, a string as a JSON string (the checkout `getInt`/`getBool` readers
 *    depend on this). The pure `settings-schema` validator produces typed values.
 *  - A write is a per-key UPSERT; unchanged keys are skipped (clean audit).
 *  - One `admin_audit_log` row per save, recording ONLY the changed keys.
 *  - Only catalogued keys are ever returned or persisted.
 *
 * SERVER-ONLY: uses @kakoa/db.
 */
import { adminAuditLog, adminUsers, db, storeSettings } from '@kakoa/db';
import { eq, inArray, sql } from 'drizzle-orm';
import { withConstraintMapping } from './db-errors';
import {
  SETTINGS_DEFAULTS,
  SETTINGS_KEYS,
  type JsonValue,
} from './settings-schema';

export interface SettingMeta {
  updatedAt: string | null;
  updatedByEmail: string | null;
}

export interface AllSettings {
  /** Catalogued key → current stored value (defaults overlaid for missing rows). */
  values: Record<string, JsonValue>;
  /** Catalogued key → last-changed metadata (null when never written / seeded). */
  meta: Record<string, SettingMeta>;
}

/**
 * Read every catalogued setting, overlaying `SETTINGS_DEFAULTS` for any missing
 * row and dropping stray/legacy keys so the response is exactly the catalog.
 */
export async function getAllSettings(): Promise<AllSettings> {
  const rows = await db
    .select({
      key: storeSettings.key,
      value: storeSettings.value,
      updatedAt: storeSettings.updatedAt,
      updatedByEmail: adminUsers.email,
    })
    .from(storeSettings)
    .leftJoin(adminUsers, eq(adminUsers.id, storeSettings.updatedBy))
    .where(inArray(storeSettings.key, [...SETTINGS_KEYS]));

  const byKey = new Map(rows.map((r) => [r.key, r]));

  const values: Record<string, JsonValue> = {};
  const meta: Record<string, SettingMeta> = {};
  for (const key of SETTINGS_KEYS) {
    const row = byKey.get(key);
    values[key] =
      row !== undefined ? (row.value as JsonValue) : SETTINGS_DEFAULTS[key]!;
    meta[key] = {
      updatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : null,
      updatedByEmail: row?.updatedByEmail ?? null,
    };
  }
  return { values, meta };
}

export type UpdateSettingsResult =
  | { ok: true; changed: string[] }
  | { ok: false; code: 'VALIDATION_ERROR'; message: string };

/**
 * Persist already-VALIDATED typed values. Reads current values under the tx to
 * skip no-op keys, upserts each changed key (writing `updatedBy`), and writes a
 * single audit row with only the changed keys. A no-op save writes nothing.
 */
export async function updateSettings(
  validated: Record<string, JsonValue>,
  adminUserId: string,
): Promise<UpdateSettingsResult> {
  const keys = Object.keys(validated);
  if (keys.length === 0) return { ok: true, changed: [] };

  return withConstraintMapping(() =>
    db.transaction(async (tx): Promise<UpdateSettingsResult> => {
      const current = await tx
        .select({ key: storeSettings.key, value: storeSettings.value })
        .from(storeSettings)
        .where(inArray(storeSettings.key, keys));
      const currentByKey = new Map(current.map((r) => [r.key, r.value as JsonValue]));

      const before: Record<string, JsonValue | null> = {};
      const after: Record<string, JsonValue> = {};
      const changed: string[] = [];

      for (const key of keys) {
        const next = validated[key]!;
        const cur = currentByKey.has(key) ? currentByKey.get(key)! : undefined;
        // Skip a genuine no-op (same JSON primitive) — keeps the audit clean.
        if (cur !== undefined && Object.is(cur, next)) continue;
        changed.push(key);
        before[key] = cur ?? null;
        after[key] = next;

        await tx
          .insert(storeSettings)
          .values({ key, value: next, updatedBy: adminUserId })
          .onConflictDoUpdate({
            target: storeSettings.key,
            set: { value: next, updatedBy: adminUserId, updatedAt: sql`now()` },
          });
      }

      if (changed.length === 0) return { ok: true, changed: [] };

      await tx.insert(adminAuditLog).values({
        adminUserId,
        action: 'settings.update',
        entityType: 'settings',
        entityId: null,
        before,
        after,
      });

      return { ok: true, changed };
    }),
  );
}
