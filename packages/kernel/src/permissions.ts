/**
 * Permission catalog — the granular `resource:action` vocabulary the whole
 * admin platform authorizes against (docs/admin-platform §4 RBAC upgrade, A4).
 *
 * Permissions are business-agnostic. Roles (per business) are sets of these;
 * every admin mutation checks one server-side via `BusinessContext.can(...)`.
 * Modules contribute their permissions here so the Permissions/Roles admin can
 * list them automatically.
 *
 * The wildcard `'*'` (see roles.ts) means "all permissions" — the Owner preset.
 */

/** Every permission the platform kernel + core commerce modules define. */
export const PERMISSION_KEYS = [
  // dashboard
  'dashboard:read',
  // orders
  'orders:read',
  'orders:transition',
  'orders:refund',
  'orders:cod-manage',
  // catalog
  'products:read',
  'products:write',
  'products:publish',
  'categories:manage',
  // inventory
  'inventory:read',
  'inventory:adjust',
  // customers
  'customers:read',
  'customers:pii-view',
  'customers:block',
  'customers:data-request',
  // promotions
  'coupons:read',
  'coupons:manage',
  // reviews
  'reviews:moderate',
  // payments
  'payments:read',
  'payments:refund',
  // fulfilment
  'shipping:read',
  'shipping:manage',
  // taxes
  'taxes:manage',
  // media
  'media:read',
  'media:write',
  // notifications
  'notifications:read',
  'notifications:manage',
  // content
  'content:manage',
  // insight
  'analytics:read',
  'reports:export',
  // administration
  'settings:read',
  'settings:write',
  'staff:manage',
  'roles:manage',
  'audit:read',
] as const;

export type Permission = (typeof PERMISSION_KEYS)[number];

/** True for a syntactically valid, catalogued permission string. */
export function isPermission(value: string): value is Permission {
  return (PERMISSION_KEYS as readonly string[]).includes(value);
}

/** Human-readable metadata for the Permissions/Roles admin surface. */
export interface PermissionMeta {
  readonly key: Permission;
  readonly resource: string;
  readonly action: string;
  readonly label: string;
  /** Owner-sensitive: destructive / money / identity actions default to Owner. */
  readonly sensitive: boolean;
}

const SENSITIVE = new Set<Permission>([
  'orders:refund',
  'payments:refund',
  'customers:pii-view',
  'customers:data-request',
  'coupons:manage',
  'settings:write',
  'staff:manage',
  'roles:manage',
  'audit:read',
  'reports:export',
]);

/**
 * Derived catalog — one entry per permission, `resource`/`action` split on the
 * colon, a title-cased label, and the sensitivity flag. Pure/deterministic.
 */
export const PERMISSION_CATALOG: readonly PermissionMeta[] = PERMISSION_KEYS.map(
  (key) => {
    const [resource, action] = key.split(':') as [string, string];
    const label = `${titleCase(action)} ${titleCase(resource)}`;
    return { key, resource, action, label, sensitive: SENSITIVE.has(key) };
  },
);

/** Permissions grouped by resource — drives the role editor's checkbox groups. */
export function permissionsByResource(): Record<string, PermissionMeta[]> {
  const out: Record<string, PermissionMeta[]> = {};
  for (const meta of PERMISSION_CATALOG) {
    (out[meta.resource] ??= []).push(meta);
  }
  return out;
}

function titleCase(s: string): string {
  return s
    .split('-')
    .map((w) => (w.length === 0 ? w : w[0]!.toUpperCase() + w.slice(1)))
    .join(' ');
}
