/**
 * RBAC security guards — the heart of Staff & Roles (HANDOFF-Staff-Roles-Audit §4).
 * PURE (no @kakoa/db import) so every invariant is exhaustively unit-testable and
 * cannot silently depend on request/DB state. The data layer computes the concrete
 * inputs (actor grants, active-owner set, new grants) IN A TRANSACTION and calls
 * these to decide; the UI may mirror them but MUST NOT be trusted.
 *
 * Invariants encoded here:
 *   §4.1 no privilege escalation  — canGrantAll / sanitizePermissionGrants
 *   §4.2 last-active-owner         — wouldLeaveNoOwner
 *   §4.3 no self-lockout           — isSelfLockout
 *   §4.7 permission validation     — sanitizePermissionGrants (+ isPermission)
 */
import { grantsPermission, isPermission, type Permission, type PermissionGrant } from '@platform/kernel';

/** True iff a grant set is the Owner wildcard (holds `'*'`). */
export function isOwnerGrants(grants: readonly PermissionGrant[]): boolean {
  return grants.includes('*');
}

/**
 * §4.1 — an actor may assign only a permission set that is a SUBSET of their own
 * grants. Owner (`'*'`) may assign anything. `targetPerms` should already be the
 * expanded concrete permission list of the role/grant being assigned.
 */
export function canGrantAll(
  actorGrants: readonly PermissionGrant[],
  targetPerms: readonly Permission[],
): boolean {
  if (isOwnerGrants(actorGrants)) return true;
  const held = new Set<PermissionGrant>(actorGrants);
  return targetPerms.every((p) => held.has(p));
}

/** §4.7 — only an actor holding `'*'` may set the wildcard grant on a role. */
export function canSetWildcard(actorGrants: readonly PermissionGrant[]): boolean {
  return isOwnerGrants(actorGrants);
}

/**
 * §4.7 — clean an incoming permission array into a valid grant set:
 * drop non-strings and unknown keys (via `isPermission`), keep `'*'` ONLY when the
 * actor is an owner, and dedupe. The result is what may be persisted; the data
 * layer still applies §4.1 (`canGrantAll` over the expanded set) as authorization.
 */
export function sanitizePermissionGrants(
  raw: unknown,
  actorGrants: readonly PermissionGrant[],
): PermissionGrant[] {
  if (!Array.isArray(raw)) return [];
  const actorIsOwner = isOwnerGrants(actorGrants);
  const out = new Set<PermissionGrant>();
  for (const v of raw) {
    if (typeof v !== 'string') continue;
    if (v === '*') {
      if (actorIsOwner) out.add('*');
      continue;
    }
    if (isPermission(v)) out.add(v);
  }
  return [...out];
}

/**
 * §4.2 — would this change leave the business with zero active owners? An "owner"
 * is an active admin whose grants include `'*'`. `activeOwnerIds` is the current
 * set (computed in-tx); `targetIsOwnerAfter` is whether the changed admin will
 * STILL be an active owner afterwards. Changing a non-owner can never reduce the
 * count; changing the sole owner into a non-owner does.
 */
export function wouldLeaveNoOwner(params: {
  activeOwnerIds: readonly string[];
  targetId: string;
  targetIsOwnerAfter: boolean;
}): boolean {
  const owners = new Set(params.activeOwnerIds);
  const wasOwner = owners.has(params.targetId);
  if (!wasOwner) return false;
  if (params.targetIsOwnerAfter) return false;
  return owners.size <= 1;
}

/**
 * §4.3 — an admin cannot lock themselves out: no self-deactivate, and no self
 * role-change that STRIPS a self-management permission they currently hold
 * (`staff:manage` / `roles:manage`). Only applies when actor === target.
 * `newGrants === null` means the role/grants are unchanged by this edit.
 */
export function isSelfLockout(params: {
  actorId: string;
  targetId: string;
  deactivating: boolean;
  actorGrants: readonly PermissionGrant[];
  newGrants: readonly PermissionGrant[] | null;
}): boolean {
  if (params.actorId !== params.targetId) return false;
  if (params.deactivating) return true;
  if (params.newGrants !== null) {
    const selfManage: Permission[] = ['staff:manage', 'roles:manage'];
    for (const p of selfManage) {
      if (grantsPermission(params.actorGrants, p) && !grantsPermission(params.newGrants, p)) {
        return true;
      }
    }
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* Pure field validators for the Roles editor                          */
/* ------------------------------------------------------------------ */

/** Role machine key: lowercase, starts with a letter, 2–31 chars total. */
const ROLE_KEY_RE = /^[a-z][a-z0-9_]{1,30}$/;

export function isValidRoleKey(key: unknown): key is string {
  return typeof key === 'string' && ROLE_KEY_RE.test(key);
}

export interface RoleInputValues {
  name: string;
  description: string;
  permissions: PermissionGrant[];
}

export type RoleInputValidation =
  | { ok: true; value: RoleInputValues }
  | { ok: false; message: string };

/**
 * Validate the shared Role create/update payload (name + description +
 * permissions), sanitising permissions against the actor's grants. `key` is
 * validated separately (create-only) via `isValidRoleKey`. Subset authorization
 * (§4.1) is enforced by the data layer after this returns.
 */
export function validateRoleInput(
  raw: unknown,
  actorGrants: readonly PermissionGrant[],
): RoleInputValidation {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, message: 'Invalid role payload.' };
  }
  const b = raw as Record<string, unknown>;
  const name = (typeof b.name === 'string' ? b.name : '').trim();
  if (name.length < 2 || name.length > 60) {
    return { ok: false, message: 'Enter a role name (2–60 characters).' };
  }
  const description = (typeof b.description === 'string' ? b.description : '').slice(0, 200);
  const permissions = sanitizePermissionGrants(b.permissions, actorGrants);
  return { ok: true, value: { name, description, permissions } };
}
