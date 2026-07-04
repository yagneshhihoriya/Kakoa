/**
 * Admin module registry (docs/admin-platform §5, 02-CORE-MODULES). Each module
 * declares a manifest; `adminRegistry.compose(ctx)` builds the nav filtered by
 * enablement ⊕ settings-override ⊕ capability ⊕ the acting admin's permissions.
 * Adding a module is one `register()` call here — nav + permission catalog +
 * dashboard widgets compose automatically.
 *
 * Routes are mounted under `apps/web/src/app/admin/*`. Modules not yet built
 * resolve to the `/admin/[section]` "coming soon" placeholder until their real
 * page lands (a static segment overrides the catch-all).
 */
import { ModuleRegistry, type AdminModule } from '@platform/kernel';

const MODULES: readonly AdminModule[] = [
  /* ---- kernel ---- */
  {
    key: 'dashboard',
    title: 'Dashboard',
    group: 'kernel',
    order: 0,
    enabledByDefault: true,
    permissions: [{ key: 'dashboard:read', label: 'View dashboard' }],
    nav: [{ label: 'Dashboard', href: '/admin', permission: 'dashboard:read', icon: 'gauge' }],
    widgets: [
      { key: 'revenue', permission: 'dashboard:read' },
      { key: 'orders-today', permission: 'orders:read' },
      { key: 'low-stock', permission: 'inventory:read' },
    ],
  },
  /* ---- commerce ---- */
  {
    key: 'orders',
    title: 'Orders',
    group: 'commerce',
    order: 10,
    enabledByDefault: true,
    permissions: [
      { key: 'orders:read', label: 'View orders' },
      { key: 'orders:transition', label: 'Move orders through states' },
      { key: 'orders:refund', label: 'Refund orders' },
      { key: 'orders:cod-manage', label: 'Manage COD confirmations' },
    ],
    nav: [{ label: 'Orders', href: '/admin/orders', permission: 'orders:read', icon: 'receipt' }],
  },
  {
    key: 'products',
    title: 'Products',
    group: 'commerce',
    order: 11,
    enabledByDefault: true,
    permissions: [
      { key: 'products:read', label: 'View products' },
      { key: 'products:write', label: 'Edit products' },
      { key: 'products:publish', label: 'Publish products' },
    ],
    nav: [{ label: 'Products', href: '/admin/products', permission: 'products:read', icon: 'box' }],
  },
  {
    key: 'categories',
    title: 'Categories',
    group: 'commerce',
    order: 12,
    enabledByDefault: true,
    permissions: [{ key: 'categories:manage', label: 'Manage categories' }],
    nav: [{ label: 'Categories', href: '/admin/categories', permission: 'categories:manage', icon: 'folder' }],
  },
  {
    key: 'inventory',
    title: 'Inventory',
    group: 'commerce',
    order: 13,
    enabledByDefault: true,
    permissions: [
      { key: 'inventory:read', label: 'View inventory' },
      { key: 'inventory:adjust', label: 'Adjust stock' },
    ],
    nav: [{ label: 'Inventory', href: '/admin/inventory', permission: 'inventory:read', icon: 'layers' }],
  },
  {
    key: 'customers',
    title: 'Customers',
    group: 'commerce',
    order: 14,
    enabledByDefault: true,
    permissions: [
      { key: 'customers:read', label: 'View customers' },
      { key: 'customers:pii-view', label: 'View customer PII' },
      { key: 'customers:block', label: 'Block customers' },
      { key: 'customers:data-request', label: 'Handle data requests' },
    ],
    nav: [{ label: 'Customers', href: '/admin/customers', permission: 'customers:read', icon: 'users' }],
  },
  {
    key: 'coupons',
    title: 'Promotions',
    group: 'commerce',
    order: 15,
    enabledByDefault: true,
    permissions: [
      { key: 'coupons:read', label: 'View coupons' },
      { key: 'coupons:manage', label: 'Manage coupons' },
    ],
    nav: [{ label: 'Promotions', href: '/admin/coupons', permission: 'coupons:read', icon: 'tag' }],
  },
  {
    key: 'reviews',
    title: 'Reviews',
    group: 'commerce',
    order: 16,
    enabledByDefault: false, // opt-in per business
    permissions: [{ key: 'reviews:moderate', label: 'Moderate reviews' }],
    nav: [{ label: 'Reviews', href: '/admin/reviews', permission: 'reviews:moderate', icon: 'star' }],
  },
  {
    key: 'payments',
    title: 'Payments',
    group: 'commerce',
    order: 17,
    enabledByDefault: true,
    permissions: [
      { key: 'payments:read', label: 'View payments' },
      { key: 'payments:refund', label: 'Refund payments' },
    ],
    nav: [{ label: 'Payments', href: '/admin/payments', permission: 'payments:read', icon: 'wallet' }],
  },
  {
    key: 'shipping',
    title: 'Shipping',
    group: 'commerce',
    order: 18,
    enabledByDefault: true,
    requiresCapabilities: ['weight-shipping'],
    permissions: [
      { key: 'shipping:read', label: 'View shipping' },
      { key: 'shipping:manage', label: 'Manage shipping' },
    ],
    nav: [{ label: 'Shipping', href: '/admin/shipping', permission: 'shipping:read', icon: 'truck' }],
  },
  {
    key: 'taxes',
    title: 'Taxes',
    group: 'commerce',
    order: 19,
    enabledByDefault: true,
    requiresCapabilities: ['tax-inclusive'],
    permissions: [{ key: 'taxes:manage', label: 'Manage taxes' }],
    nav: [{ label: 'Taxes', href: '/admin/taxes', permission: 'taxes:manage', icon: 'percent' }],
  },
  /* ---- content & insight ---- */
  {
    key: 'content',
    title: 'Content',
    group: 'content',
    order: 30,
    enabledByDefault: false,
    permissions: [{ key: 'content:manage', label: 'Manage content' }],
    nav: [{ label: 'Content', href: '/admin/content', permission: 'content:manage', icon: 'file' }],
  },
  {
    key: 'media',
    title: 'Media',
    group: 'content',
    order: 31,
    enabledByDefault: true,
    permissions: [
      { key: 'media:read', label: 'View media' },
      { key: 'media:write', label: 'Upload media' },
    ],
    nav: [{ label: 'Media', href: '/admin/media', permission: 'media:read', icon: 'image' }],
  },
  {
    key: 'analytics',
    title: 'Analytics',
    group: 'insight',
    order: 40,
    enabledByDefault: true,
    permissions: [
      { key: 'analytics:read', label: 'View analytics' },
      { key: 'reports:export', label: 'Export reports' },
    ],
    nav: [{ label: 'Analytics', href: '/admin/analytics', permission: 'analytics:read', icon: 'chart' }],
  },
  /* ---- administration (kernel group, sorted last by high order) ---- */
  {
    key: 'notifications',
    title: 'Notifications',
    group: 'kernel',
    order: 50,
    enabledByDefault: true,
    permissions: [
      { key: 'notifications:read', label: 'View notifications' },
      { key: 'notifications:manage', label: 'Manage notification templates' },
    ],
    nav: [{ label: 'Notifications', href: '/admin/notifications', permission: 'notifications:read', icon: 'bell' }],
  },
  {
    key: 'staff',
    title: 'Users & Roles',
    group: 'kernel',
    order: 51,
    enabledByDefault: true,
    permissions: [{ key: 'staff:manage', label: 'Manage admin users' }],
    nav: [{ label: 'Users & Roles', href: '/admin/staff', permission: 'staff:manage', icon: 'shield' }],
  },
  {
    key: 'roles',
    title: 'Permissions',
    group: 'kernel',
    order: 52,
    enabledByDefault: true,
    permissions: [{ key: 'roles:manage', label: 'Manage roles & permissions' }],
    nav: [{ label: 'Permissions', href: '/admin/roles', permission: 'roles:manage', icon: 'key' }],
  },
  {
    key: 'audit',
    title: 'Audit Log',
    group: 'kernel',
    order: 53,
    enabledByDefault: true,
    permissions: [{ key: 'audit:read', label: 'Read the audit log' }],
    nav: [{ label: 'Audit Log', href: '/admin/audit', permission: 'audit:read', icon: 'history' }],
  },
  {
    key: 'settings',
    title: 'Settings',
    group: 'kernel',
    order: 54,
    enabledByDefault: true,
    permissions: [
      { key: 'settings:read', label: 'View settings' },
      { key: 'settings:write', label: 'Edit settings' },
    ],
    nav: [{ label: 'Settings', href: '/admin/settings', permission: 'settings:read', icon: 'settings' }],
  },
];

/** The process-wide registry, composed per request against a BusinessContext. */
export const adminRegistry: ModuleRegistry = (() => {
  const registry = new ModuleRegistry();
  for (const m of MODULES) registry.register(m);
  return registry;
})();
