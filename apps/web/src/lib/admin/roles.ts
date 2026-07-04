/**
 * Admin roles / permissions (HANDOFF-Staff-Roles-Audit §6). CRUD over the `roles`
 * table that `resolveAdminSession` reads grants from. Security invariants (§4) are
 * enforced HERE, in-transaction, via the pure guards in rbac-guards.ts:
 *   §4.1 a role's perms must be ⊆ the actor's grants   (canGrantAll)
 *   §4.2 never strip '*' from the last owner path        (activeOwnerIds math)
 *   §4.3 no self-lockout via editing your own role       (grantsPermission delta)
 *   §4.5 the `owner` role is protected; system roles undeletable
 *   §4.6 a role in use by an active admin can't be deleted
 *
 * SERVER-ONLY: uses @kakoa/db.
 */
import { adminAuditLog, adminUsers, db, roles } from '@kakoa/db';
import {
  expandPermissions,
  grantsPermission,
  type Permission,
  type PermissionGrant,
} from '@platform/kernel';
import { and, desc, eq, sql } from 'drizzle-orm';
import { withConstraintMapping } from './db-errors';
import { canGrantAll, isOwnerGrants, type RoleInputValues } from './rbac-guards';
import { isUuid } from './product-validation';
import type { Actor } from './staff';

export interface AdminRoleRow {
  id: string;
  key: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissionCount: number | 'all';
  userCount: number;
}

/** Active admins currently assigned to a role — correlated (see customers.ts note on literal `roles.id`). */
const userCountSql = sql<number>`(select count(*)::int from ${adminUsers} au where au.role_id = roles.id and au.is_active)`;

export async function listRoles(): Promise<AdminRoleRow[]> {
  const rows = await db
    .select({
      id: roles.id,
      key: roles.key,
      name: roles.name,
      description: roles.description,
      isSystem: roles.isSystem,
      permissions: roles.permissions,
      userCount: userCountSql,
    })
    .from(roles)
    .orderBy(desc(roles.isSystem), roles.name);
  return rows.map((r) => {
    const perms = r.permissions as PermissionGrant[];
    return {
      id: r.id,
      key: r.key,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      permissionCount: isOwnerGrants(perms) ? 'all' : perms.length,
      userCount: Number(r.userCount ?? 0),
    };
  });
}

export interface AdminRoleDetail {
  id: string;
  key: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: PermissionGrant[];
  isOwner: boolean;
}

export async function getRole(id: string): Promise<AdminRoleDetail | null> {
  if (!isUuid(id)) return null;
  const [r] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
  if (!r) return null;
  const permissions = r.permissions as PermissionGrant[];
  return {
    id: r.id,
    key: r.key,
    name: r.name,
    description: r.description,
    isSystem: r.isSystem,
    permissions,
    isOwner: r.key === 'owner' || isOwnerGrants(permissions),
  };
}

export type RoleResult =
  | { ok: true; id: string }
  | { ok: false; code: 'VALIDATION_ERROR' | 'NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT'; message: string };

/** Active admin ids whose effective grants include '*' (owners), locked FOR UPDATE (§4.2 race-safety). */
async function lockActiveOwnerIds(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
): Promise<string[]> {
  const rows = await tx
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .where(
      sql`${adminUsers.isActive} and (
        ${adminUsers.roleId} in (select id from ${roles} where '*' = any(permissions))
        or (${adminUsers.roleId} is null and ${adminUsers.role} = 'owner')
      )`,
    )
    .for('update');
  return rows.map((r) => r.id);
}

export async function createRole(
  input: { key: string } & RoleInputValues,
  actor: Actor,
): Promise<RoleResult> {
  // §4.1 — the new role's permissions must be within the actor's own grants.
  if (!canGrantAll(actor.grants, expandPermissions(input.permissions))) {
    return { ok: false, code: 'FORBIDDEN', message: "You can't grant permissions beyond your own access." };
  }
  return withConstraintMapping(() =>
    db.transaction(async (tx) => {
      const [dupe] = await tx
        .select({ id: roles.id })
        .from(roles)
        .where(eq(roles.key, input.key))
        .limit(1);
      if (dupe) return { ok: false, code: 'VALIDATION_ERROR', message: 'That role key is already in use.' };

      const [row] = await tx
        .insert(roles)
        .values({
          key: input.key,
          name: input.name,
          description: input.description,
          permissions: input.permissions,
          isSystem: false,
        })
        .returning({ id: roles.id });
      if (!row) return { ok: false, code: 'VALIDATION_ERROR', message: 'Could not create the role.' };

      await tx.insert(adminAuditLog).values({
        adminUserId: actor.id,
        action: 'role.create',
        entityType: 'role',
        entityId: row.id,
        before: null,
        after: { key: input.key, name: input.name, permissions: input.permissions },
      });
      return { ok: true, id: row.id };
    }),
  );
}

export async function updateRole(
  id: string,
  input: { permissionsProvided: boolean } & RoleInputValues,
  actor: Actor,
): Promise<RoleResult> {
  if (!isUuid(id)) return { ok: false, code: 'NOT_FOUND', message: "We couldn't find that role." };

  // §4.1 — the resulting permission set must be within the actor's grants.
  if (input.permissionsProvided && !canGrantAll(actor.grants, expandPermissions(input.permissions))) {
    return { ok: false, code: 'FORBIDDEN', message: "You can't grant permissions beyond your own access." };
  }

  return withConstraintMapping(() =>
    db.transaction(async (tx) => {
      const [role] = await tx
        .select({ id: roles.id, key: roles.key, isSystem: roles.isSystem, permissions: roles.permissions })
        .from(roles)
        .where(eq(roles.id, id))
        .for('update')
        .limit(1);
      if (!role) return { ok: false, code: 'NOT_FOUND', message: "We couldn't find that role." };

      // §4.5 — the Owner role is fully protected (never lose '*').
      if (role.key === 'owner') {
        return { ok: false, code: 'FORBIDDEN', message: 'The Owner role is protected and cannot be edited.' };
      }

      const currentPerms = role.permissions as PermissionGrant[];
      const newPerms = input.permissionsProvided ? input.permissions : currentPerms;

      // §4.3 — editing your OWN role must not strip your self-management perms.
      if (input.permissionsProvided) {
        const selfManage: Permission[] = ['staff:manage', 'roles:manage'];
        for (const p of selfManage) {
          if (grantsPermission(actor.grants, p) && !grantsPermission(newPerms, p)) {
            return { ok: false, code: 'VALIDATION_ERROR', message: "You can't remove your own admin access." };
          }
        }
      }

      // §4.2 — if this change strips '*' from a role that grants it, ensure an owner remains.
      if (isOwnerGrants(currentPerms) && !isOwnerGrants(newPerms)) {
        const ownerIds = await lockActiveOwnerIds(tx);
        const onThisRole = await tx
          .select({ id: adminUsers.id })
          .from(adminUsers)
          .where(and(eq(adminUsers.roleId, id), eq(adminUsers.isActive, true)));
        const onRole = new Set(onThisRole.map((r) => r.id));
        const remaining = ownerIds.filter((o) => !onRole.has(o));
        if (remaining.length === 0) {
          return { ok: false, code: 'VALIDATION_ERROR', message: 'The business must keep at least one active owner.' };
        }
      }

      await tx
        .update(roles)
        .set({
          name: input.name,
          description: input.description,
          ...(input.permissionsProvided ? { permissions: input.permissions } : {}),
          updatedAt: sql`now()`,
        })
        .where(eq(roles.id, id));

      await tx.insert(adminAuditLog).values({
        adminUserId: actor.id,
        action: 'role.update',
        entityType: 'role',
        entityId: id,
        before: { name: role.key, permissions: currentPerms },
        after: { name: input.name, permissions: newPerms },
      });
      return { ok: true, id };
    }),
  );
}

export async function deleteRole(id: string, actor: Actor): Promise<RoleResult> {
  if (!isUuid(id)) return { ok: false, code: 'NOT_FOUND', message: "We couldn't find that role." };
  return withConstraintMapping(() =>
    db.transaction(async (tx) => {
      const [role] = await tx
        .select({ id: roles.id, key: roles.key, isSystem: roles.isSystem })
        .from(roles)
        .where(eq(roles.id, id))
        .for('update')
        .limit(1);
      if (!role) return { ok: false, code: 'NOT_FOUND', message: "We couldn't find that role." };

      // §4.5 — system presets are undeletable.
      if (role.isSystem) {
        return { ok: false, code: 'FORBIDDEN', message: 'System roles cannot be deleted.' };
      }

      // §4.6 — can't delete a role still assigned to active admins.
      const [used] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(adminUsers)
        .where(and(eq(adminUsers.roleId, id), eq(adminUsers.isActive, true)));
      const count = Number(used?.n ?? 0);
      if (count > 0) {
        return {
          ok: false,
          code: 'CONFLICT',
          message: `Reassign the ${count} active admin${count === 1 ? '' : 's'} on this role first.`,
        };
      }

      await tx.delete(roles).where(eq(roles.id, id));
      await tx.insert(adminAuditLog).values({
        adminUserId: actor.id,
        action: 'role.delete',
        entityType: 'role',
        entityId: id,
        before: { key: role.key },
        after: null,
      });
      return { ok: true, id };
    }),
  );
}
