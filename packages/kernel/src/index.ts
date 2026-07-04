/**
 * @platform/kernel — the business-agnostic platform spine (docs/admin-platform).
 *
 * Pure domain logic: RBAC (permissions/roles), the capability system, vertical
 * presets + product attribute schema, the BusinessContext seam, and the module
 * registry (plugin system). No business names, no DB, no framework — so it is
 * fully unit-testable and reusable across any business instance.
 */
export * from './permissions';
export * from './capabilities';
export * from './roles';
export * from './presets';
export * from './business-context';
export * from './registry';
