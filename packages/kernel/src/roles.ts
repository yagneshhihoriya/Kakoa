/**
 * Roles & the RBAC engine (docs/admin-platform §4, Decision A4).
 *
 * A role is a named set of permissions. Businesses get seeded **system presets**
 * (Owner/Admin/Manager/Staff/Viewer) and may define custom roles. The wildcard
 * `'*'` on a role's permission set means "all permissions" (the Owner preset) —
 * so a newly-added permission is automatically granted to Owner without a data
 * migration. Every admin mutation checks a permission server-side.
 *
 * Back-compat: the legacy `owner`/`staff` enum maps to the `owner`/`staff`
 * presets below, so the migration is additive.
 */
import { PERMISSION_KEYS, type Permission } from './permissions';

/** `'*'` = every permission (now and future). Owner holds this. */
export type PermissionGrant = Permission | '*';

export interface Role {
  /** Stable machine key, unique per business. */
  readonly key: string;
  readonly name: string;
  readonly description: string;
  /** System presets are seeded and cannot be deleted (permissions still editable per policy). */
  readonly isSystem: boolean;
  /** Granted permissions, or `['*']` for all. */
  readonly permissions: readonly PermissionGrant[];
}

/** True iff a permission grant set includes `perm` (honouring the `'*'` wildcard). */
export function grantsPermission(
  grants: readonly PermissionGrant[],
  perm: Permission,
): boolean {
  return grants.includes('*') || grants.includes(perm);
}

/** True iff `role` grants `perm`. */
export function roleCan(role: Role, perm: Permission): boolean {
  return grantsPermission(role.permissions, perm);
}

/** Expand a role's grants to the concrete permission list (`'*'` → all keys). */
export function expandPermissions(
  grants: readonly PermissionGrant[],
): readonly Permission[] {
  if (grants.includes('*')) return PERMISSION_KEYS;
  return grants.filter((g): g is Permission => g !== '*');
}

/* ------------------------------------------------------------------ */
/* System role presets                                                 */
/* ------------------------------------------------------------------ */

/** Read-only across everything an operator might legitimately view. */
const VIEWER_PERMS: Permission[] = [
  'dashboard:read',
  'orders:read',
  'products:read',
  'inventory:read',
  'customers:read',
  'coupons:read',
  'payments:read',
  'shipping:read',
  'media:read',
  'notifications:read',
  'analytics:read',
  'settings:read',
];

/** Front-line ops: run orders, edit catalog drafts, adjust stock — no money/identity. */
const STAFF_PERMS: Permission[] = [
  ...VIEWER_PERMS,
  'orders:transition',
  'orders:cod-manage',
  'products:write',
  'categories:manage',
  'inventory:adjust',
  'customers:block',
  'reviews:moderate',
];

/** Ops lead: staff + publish + shipping + notifications (still no refunds/roles/settings-write). */
const MANAGER_PERMS: Permission[] = [
  ...STAFF_PERMS,
  'products:publish',
  'shipping:manage',
  'media:write',
  'notifications:manage',
  'content:manage',
];

/** Everything except the very top (roles/audit/data-requests stay Owner). */
const ADMIN_PERMS: Permission[] = [
  ...MANAGER_PERMS,
  'orders:refund',
  'payments:refund',
  'customers:pii-view',
  'coupons:manage',
  'taxes:manage',
  'settings:write',
  'reports:export',
  'staff:manage',
];

/**
 * The seeded system roles for a new business. Owner holds `'*'`. These are the
 * source of truth for the DB seed (Phase 0B) and for back-compat mapping.
 */
export const SYSTEM_ROLES: readonly Role[] = [
  {
    key: 'owner',
    name: 'Owner',
    description: 'Full access to everything, including roles, audit and data requests.',
    isSystem: true,
    permissions: ['*'],
  },
  {
    key: 'admin',
    name: 'Admin',
    description: 'Manage the store end-to-end: orders, refunds, catalog, staff, settings.',
    isSystem: true,
    permissions: dedupe(ADMIN_PERMS),
  },
  {
    key: 'manager',
    name: 'Manager',
    description: 'Run daily operations: fulfil orders, publish products, manage shipping.',
    isSystem: true,
    permissions: dedupe(MANAGER_PERMS),
  },
  {
    key: 'staff',
    name: 'Staff',
    description: 'Front-line operations: process orders, edit catalog drafts, adjust stock.',
    isSystem: true,
    permissions: dedupe(STAFF_PERMS),
  },
  {
    key: 'viewer',
    name: 'Viewer',
    description: 'Read-only access for reporting and support.',
    isSystem: true,
    permissions: dedupe(VIEWER_PERMS),
  },
];

/** Legacy `admin_users.role` enum → preset key (back-compat during migration). */
export const LEGACY_ROLE_TO_PRESET: Record<'owner' | 'staff', string> = {
  owner: 'owner',
  staff: 'staff',
};

export function systemRole(key: string): Role | undefined {
  return SYSTEM_ROLES.find((r) => r.key === key);
}

function dedupe(perms: readonly Permission[]): Permission[] {
  return [...new Set(perms)];
}
