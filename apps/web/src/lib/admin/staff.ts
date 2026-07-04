/**
 * Admin staff / users (HANDOFF-Staff-Roles-Audit §5). Passwordless: an "invite" is
 * an `admin_users` row; the admin signs in via email OTP. The security-critical
 * §4 invariants are enforced HERE, in-transaction, using the pure guards in
 * rbac-guards.ts — never trust the client. Deactivate / role-change revokes the
 * target's live sessions in the same tx (grants are re-read per request).
 *
 * SERVER-ONLY: uses @kakoa/db.
 */
import { adminAuditLog, adminSessions, adminUsers, db, roles } from '@kakoa/db';
import {
  LEGACY_ROLE_TO_PRESET,
  expandPermissions,
  systemRole,
  type PermissionGrant,
} from '@platform/kernel';
import { and, desc, eq, sql, type SQL } from 'drizzle-orm';
import { withConstraintMapping } from './db-errors';
import { canGrantAll, isOwnerGrants, isSelfLockout, wouldLeaveNoOwner } from './rbac-guards';
import { isUuid } from './product-validation';

export const STAFF_PAGE_SIZE = 30;

/** The acting admin, as passed from the route (auth.value.admin). */
export interface Actor {
  id: string;
  grants: readonly PermissionGrant[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function likeParam(s: string): string {
  return `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
function clampPage(raw: number | undefined): number {
  const n = Math.floor(Number(raw ?? 1));
  return Number.isFinite(n) ? Math.min(1_000_000, Math.max(1, n)) : 1;
}

/** Resolve an admin row's effective grants: role.permissions, or legacy enum → preset. */
function grantsFor(roleKey: string | null, rolePerms: readonly string[] | null, legacyRole: 'owner' | 'staff'): readonly PermissionGrant[] {
  if (roleKey !== null && rolePerms !== null) return rolePerms as PermissionGrant[];
  return systemRole(LEGACY_ROLE_TO_PRESET[legacyRole])?.permissions ?? [];
}

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  roleKey: string;
  roleName: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AdminUserList {
  rows: AdminUserRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export async function listAdminUsers(input: {
  search?: string;
  filter?: 'all' | 'active' | 'inactive';
  page?: number;
}): Promise<AdminUserList> {
  const page = clampPage(input.page);
  const pageSize = STAFF_PAGE_SIZE;

  const conds: SQL[] = [];
  if (input.filter === 'active') conds.push(eq(adminUsers.isActive, true));
  if (input.filter === 'inactive') conds.push(eq(adminUsers.isActive, false));
  const search = input.search?.trim();
  if (search) {
    const p = likeParam(search);
    conds.push(sql`(${adminUsers.email}::text ilike ${p} or ${adminUsers.name} ilike ${p})`);
  }
  const where = conds.length > 0 ? and(...conds) : undefined;

  const [totalRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(adminUsers)
    .where(where);
  const total = Number(totalRow?.total ?? 0);

  const rows = await db
    .select({
      id: adminUsers.id,
      email: adminUsers.email,
      name: adminUsers.name,
      legacyRole: adminUsers.role,
      roleKey: roles.key,
      roleName: roles.name,
      isActive: adminUsers.isActive,
      lastLoginAt: adminUsers.lastLoginAt,
      createdAt: adminUsers.createdAt,
    })
    .from(adminUsers)
    .leftJoin(roles, eq(roles.id, adminUsers.roleId))
    .where(where)
    .orderBy(desc(adminUsers.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    rows: rows.map((r) => {
      const preset = systemRole(LEGACY_ROLE_TO_PRESET[r.legacyRole]);
      return {
        id: r.id,
        email: r.email,
        name: r.name,
        roleKey: r.roleKey ?? r.legacyRole,
        roleName: r.roleName ?? preset?.name ?? r.legacyRole,
        isActive: r.isActive,
        lastLoginAt: r.lastLoginAt ? new Date(r.lastLoginAt).toISOString() : null,
        createdAt: new Date(r.createdAt).toISOString(),
      };
    }),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export interface AssignableRole {
  id: string;
  key: string;
  name: string;
  isSystem: boolean;
  permissionCount: number | 'all';
  assignable: boolean;
}

/** Every role, flagged `assignable` = the actor may grant its full permission set (§4.1). */
export async function listAssignableRoles(actorGrants: readonly PermissionGrant[]): Promise<AssignableRole[]> {
  const rows = await db
    .select({
      id: roles.id,
      key: roles.key,
      name: roles.name,
      isSystem: roles.isSystem,
      permissions: roles.permissions,
    })
    .from(roles)
    .orderBy(desc(roles.isSystem), roles.name);
  return rows.map((r) => {
    const perms = r.permissions as PermissionGrant[];
    const isWild = isOwnerGrants(perms);
    return {
      id: r.id,
      key: r.key,
      name: r.name,
      isSystem: r.isSystem,
      permissionCount: isWild ? 'all' : perms.length,
      assignable: canGrantAll(actorGrants, expandPermissions(perms)),
    };
  });
}

export type StaffResult =
  | { ok: true; id: string }
  | { ok: false; code: 'VALIDATION_ERROR' | 'NOT_FOUND' | 'FORBIDDEN'; message: string };

/** Fetch the active-owner admin ids, locking those rows (FOR UPDATE) to serialise §4.2. */
async function lockActiveOwnerIds(tx: Parameters<Parameters<typeof db.transaction>[0]>[0]): Promise<string[]> {
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

export async function inviteAdmin(
  input: { email: string; name: string; roleId: string },
  actor: Actor,
): Promise<StaffResult> {
  const email = (typeof input.email === 'string' ? input.email : '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 200) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Enter a valid email address.' };
  }
  const name = (typeof input.name === 'string' ? input.name : '').trim();
  if (name.length < 1 || name.length > 80) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Enter a name (1–80 characters).' };
  }
  if (!isUuid(input.roleId)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Choose a role.' };
  }

  return withConstraintMapping(() =>
    db.transaction(async (tx) => {
      const [role] = await tx
        .select({ id: roles.id, key: roles.key, permissions: roles.permissions })
        .from(roles)
        .where(eq(roles.id, input.roleId))
        .limit(1);
      if (!role) return { ok: false, code: 'VALIDATION_ERROR', message: 'That role no longer exists.' };

      // §4.1 — the assigned role must be within the actor's own grants.
      if (!canGrantAll(actor.grants, expandPermissions(role.permissions as PermissionGrant[]))) {
        return { ok: false, code: 'FORBIDDEN', message: "You can't assign a role with more access than your own." };
      }

      // Nice pre-check message for the common duplicate-email case (§4.8); the
      // unique index + withConstraintMapping is the race backstop.
      const [dupe] = await tx
        .select({ id: adminUsers.id })
        .from(adminUsers)
        .where(eq(adminUsers.email, email))
        .limit(1);
      if (dupe) return { ok: false, code: 'VALIDATION_ERROR', message: 'That email already has an admin account.' };

      const [row] = await tx
        .insert(adminUsers)
        .values({ email, name, roleId: role.id, role: 'staff', isActive: true })
        .returning({ id: adminUsers.id });
      if (!row) return { ok: false, code: 'VALIDATION_ERROR', message: 'Could not create the admin.' };

      await tx.insert(adminAuditLog).values({
        adminUserId: actor.id,
        action: 'admin_user.invite',
        entityType: 'admin_user',
        entityId: row.id,
        before: null,
        after: { email, name, roleKey: role.key },
      });
      return { ok: true, id: row.id };
    }),
  );
}

export async function updateAdmin(
  id: string,
  input: { name?: string; roleId?: string; isActive?: boolean },
  actor: Actor,
): Promise<StaffResult> {
  if (!isUuid(id)) return { ok: false, code: 'NOT_FOUND', message: "We couldn't find that admin." };
  if (input.roleId !== undefined && !isUuid(input.roleId)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Choose a valid role.' };
  }
  const name = input.name !== undefined ? input.name.trim() : undefined;
  if (name !== undefined && (name.length < 1 || name.length > 80)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Enter a name (1–80 characters).' };
  }

  return withConstraintMapping(() =>
    db.transaction(async (tx) => {
      const [current] = await tx
        .select({
          id: adminUsers.id,
          isActive: adminUsers.isActive,
          roleId: adminUsers.roleId,
          legacyRole: adminUsers.role,
          roleKey: roles.key,
          rolePerms: roles.permissions,
        })
        .from(adminUsers)
        .leftJoin(roles, eq(roles.id, adminUsers.roleId))
        .where(eq(adminUsers.id, id))
        // Lock ONLY the admin_users row — Postgres forbids FOR UPDATE on the
        // nullable side of a LEFT JOIN (the joined roles row), so scope it.
        .for('update', { of: adminUsers })
        .limit(1);
      if (!current) return { ok: false, code: 'NOT_FOUND', message: "We couldn't find that admin." };

      const currentGrants = grantsFor(current.roleKey, current.rolePerms as string[] | null, current.legacyRole);
      const roleChanged = input.roleId !== undefined && input.roleId !== current.roleId;

      let newGrants: readonly PermissionGrant[] | null = null; // null = role unchanged
      let newRoleKey: string | null = null;
      if (roleChanged) {
        const [newRole] = await tx
          .select({ id: roles.id, key: roles.key, permissions: roles.permissions })
          .from(roles)
          .where(eq(roles.id, input.roleId as string))
          .limit(1);
        if (!newRole) return { ok: false, code: 'VALIDATION_ERROR', message: 'That role no longer exists.' };
        newGrants = newRole.permissions as PermissionGrant[];
        newRoleKey = newRole.key;
        // §4.1 — can't assign beyond the actor's own grants.
        if (!canGrantAll(actor.grants, expandPermissions(newGrants))) {
          return { ok: false, code: 'FORBIDDEN', message: "You can't assign a role with more access than your own." };
        }
      }

      const newIsActive = input.isActive ?? current.isActive;
      const deactivating = input.isActive === false;

      // §4.3 — no self-lockout.
      if (
        isSelfLockout({
          actorId: actor.id,
          targetId: id,
          deactivating,
          actorGrants: actor.grants,
          newGrants,
        })
      ) {
        return { ok: false, code: 'VALIDATION_ERROR', message: "You can't remove your own admin access." };
      }

      // §4.2 — never drop the last active owner.
      const effectiveGrants = roleChanged ? (newGrants ?? []) : currentGrants;
      const targetIsOwnerAfter = newIsActive && isOwnerGrants(effectiveGrants);
      const activeOwnerIds = await lockActiveOwnerIds(tx);
      if (wouldLeaveNoOwner({ activeOwnerIds, targetId: id, targetIsOwnerAfter })) {
        return { ok: false, code: 'VALIDATION_ERROR', message: 'The business must keep at least one active owner.' };
      }

      // Apply the change.
      await tx
        .update(adminUsers)
        .set({
          ...(name !== undefined ? { name } : {}),
          ...(roleChanged ? { roleId: input.roleId as string } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          updatedAt: sql`now()`,
        })
        .where(eq(adminUsers.id, id));

      // §4.4 — deactivate or role-change revokes the target's live sessions in-tx.
      if (deactivating || roleChanged) {
        await tx
          .update(adminSessions)
          .set({ revokedAt: sql`now()` })
          .where(and(eq(adminSessions.adminUserId, id), sql`${adminSessions.revokedAt} is null`));
      }

      await tx.insert(adminAuditLog).values({
        adminUserId: actor.id,
        action: 'admin_user.update',
        entityType: 'admin_user',
        entityId: id,
        before: { roleKey: current.roleKey ?? current.legacyRole, isActive: current.isActive },
        after: {
          roleKey: newRoleKey ?? current.roleKey ?? current.legacyRole,
          isActive: newIsActive,
          ...(name !== undefined ? { name } : {}),
        },
      });
      return { ok: true, id };
    }),
  );
}
