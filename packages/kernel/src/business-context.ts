/**
 * BusinessContext (docs/admin-platform §1.2) — the per-request handle every
 * config read, capability check and permission check flows through.
 *
 * Today it resolves a single business ('default'). Because nothing reads brand
 * constants or settings directly (they go through here), converting to shared
 * multi-tenancy later is: resolve the context per-request from a tenant header
 * and inject a tenant scope into the data layer — WITHOUT touching module code.
 * That forward-compatibility is the whole point of this seam.
 */
import type { Capability } from './capabilities';
import type { Permission } from './permissions';
import { grantsPermission, type PermissionGrant } from './roles';
import { getPreset, type PresetKey, type VerticalPreset } from './presets';

/** Identity/brand/market of a business — sourced from settings + boot config. */
export interface BusinessProfile {
  readonly businessId: string;
  readonly name: string;
  readonly legalName?: string;
  /** ISO-4217 (e.g. 'INR'). Money is formatted against this. */
  readonly currency: string;
  /** ISO-3166-1 alpha-2 (e.g. 'IN'). */
  readonly country: string;
  readonly locale: string;
  /** Prefix for order numbers / SKUs / cookies (e.g. 'KK'). */
  readonly identifierPrefix: string;
  readonly vertical: PresetKey;
}

/** Typed, cached read over the business config store (store_settings today). */
export interface SettingsReader {
  get<T = unknown>(namespace: string, key: string): T | undefined;
  getBool(namespace: string, key: string, fallback?: boolean): boolean;
  getInt(namespace: string, key: string, fallback?: number): number;
  getString(namespace: string, key: string, fallback?: string): string | undefined;
}

export interface BusinessContext {
  readonly businessId: string;
  readonly profile: BusinessProfile;
  readonly preset: VerticalPreset;
  readonly capabilities: ReadonlySet<Capability>;
  readonly enabledModules: ReadonlySet<string>;
  readonly settings: SettingsReader;
  /** RBAC check for the acting admin. */
  can(perm: Permission): boolean;
  /** Capability check — gates fields/modules. */
  has(cap: Capability): boolean;
}

/**
 * Resolve the effective capability set: the preset's defaults, plus any
 * per-business `capability.<key>.enabled` overrides. Pure — the overrides map
 * is whatever the caller loaded from settings.
 */
export function resolveCapabilities(
  vertical: PresetKey,
  overrides?: Partial<Record<Capability, boolean>>,
): Set<Capability> {
  const preset = getPreset(vertical);
  const set = new Set<Capability>(preset.capabilities);
  if (overrides) {
    for (const [cap, enabled] of Object.entries(overrides)) {
      if (enabled === true) set.add(cap as Capability);
      else if (enabled === false) set.delete(cap as Capability);
    }
  }
  return set;
}

/**
 * Build a BusinessContext from resolved parts. The acting admin's permission
 * grants drive `can()`; capabilities drive `has()`. This is the single
 * constructor the admin request pipeline uses (the real settings/DB wiring
 * lands in a later increment — this keeps the kernel pure and testable).
 */
export function createBusinessContext(input: {
  profile: BusinessProfile;
  capabilities: Set<Capability>;
  enabledModules: Set<string>;
  settings: SettingsReader;
  /** The acting admin's expanded permission grants (or `['*']` for Owner). */
  grants: readonly PermissionGrant[];
}): BusinessContext {
  const { profile, capabilities, enabledModules, settings, grants } = input;
  return {
    businessId: profile.businessId,
    profile,
    preset: getPreset(profile.vertical),
    capabilities,
    enabledModules,
    settings,
    can: (perm) => grantsPermission(grants, perm),
    has: (cap) => capabilities.has(cap),
  };
}
