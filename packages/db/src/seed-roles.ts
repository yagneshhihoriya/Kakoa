/**
 * System-role seed (docs/admin-platform Phase 0B, Decision A4).
 *
 * Upserts the 5 kernel presets (owner/admin/manager/staff/viewer) into `roles`
 * and backfills `admin_users.role_id` from the legacy `role` enum. Idempotent —
 * safe to re-run (upsert on `key`; backfill only touches rows with a NULL
 * `role_id`). `@platform/kernel` SYSTEM_ROLES is the single source of truth.
 *
 * Run standalone against any env:  pnpm --filter @kakoa/db exec tsx src/seed-roles.ts
 */
import { LEGACY_ROLE_TO_PRESET, SYSTEM_ROLES } from '@platform/kernel';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db, queryClient, type Db } from './client';
import { adminUsers, roles } from './schema/index';

/**
 * Upsert every system role and backfill admin role_ids. Returns a small summary.
 * Accepts a `Db` so it can run inside the main seed's connection or standalone.
 */
export async function seedSystemRoles(database: Db = db): Promise<{
  rolesUpserted: number;
  adminsBackfilled: number;
}> {
  // 1. Upsert the presets (kernel is the source of truth).
  for (const role of SYSTEM_ROLES) {
    await database
      .insert(roles)
      .values({
        key: role.key,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        permissions: [...role.permissions],
      })
      .onConflictDoUpdate({
        target: roles.key,
        set: {
          name: role.name,
          description: role.description,
          isSystem: role.isSystem,
          permissions: [...role.permissions],
          updatedAt: sql`now()`,
        },
      });
  }

  // 2. Backfill admin_users.role_id from the legacy `role` enum (owner/staff).
  let adminsBackfilled = 0;
  for (const [legacyRole, presetKey] of Object.entries(LEGACY_ROLE_TO_PRESET)) {
    const [row] = await database
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.key, presetKey))
      .limit(1);
    if (!row) continue;
    const updated = await database
      .update(adminUsers)
      .set({ roleId: row.id, updatedAt: sql`now()` })
      .where(
        and(
          eq(adminUsers.role, legacyRole as 'owner' | 'staff'),
          isNull(adminUsers.roleId),
        ),
      )
      .returning({ id: adminUsers.id });
    adminsBackfilled += updated.length;
  }

  return { rolesUpserted: SYSTEM_ROLES.length, adminsBackfilled };
}

// CLI entry — run directly against DATABASE_URL.
if (import.meta.url === `file://${process.argv[1]}`) {
  seedSystemRoles()
    .then((summary) => {
      console.log(
        `Seeded roles: ${String(summary.rolesUpserted)} system roles upserted, ` +
          `${String(summary.adminsBackfilled)} admin(s) backfilled.`,
      );
    })
    .catch((error: unknown) => {
      console.error('seed-roles failed:', error);
      process.exitCode = 1;
    })
    .finally(() => {
      void queryClient.end();
    });
}
