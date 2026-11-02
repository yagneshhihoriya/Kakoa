/**
 * Admin BusinessContext resolver (docs/admin-platform §1.2, §5).
 *
 * Builds the per-request `BusinessContext` the admin runs against: a
 * `SettingsReader` over `store_settings`, the vertical preset's capabilities,
 * and the acting admin's permission grants. Every config read, capability check
 * and permission check flows through this — the seam that lets us add shared
 * multi-tenancy later without touching module code.
 *
 * Today it resolves the single 'default' business — the brand this build was
 * made for (`brand.profile`, selected by BRAND_KEY). `business_settings`
 * (namespaced) will supersede `store_settings` in a later increment; the reader
 * already accepts a `(namespace, key)` shape and degrades to the flat key.
 *
 * SERVER-ONLY: uses @kakoa/db.
 */
import { db, storeSettings } from '@kakoa/db';
import {
  CAPABILITY_KEYS,
  createBusinessContext,
  resolveCapabilities,
  resolvePreset,
  type BusinessContext,
  type BusinessProfile,
  type Capability,
  type SettingsReader,
} from '@platform/kernel';
import { assertBrandMatchesEnv, brand } from '@/lib/brand';
import { resolveAdminSession, type AdminIdentity } from './session';

function toBool(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1 ? true : value === 0 ? false : null;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'true' || v === '1') return true;
    if (v === 'false' || v === '0') return false;
  }
  return null;
}

function toInt(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isSafeInteger(n) ? n : null;
}

/**
 * Read `store_settings` into a `SettingsReader`. A `(namespace, key)` lookup
 * tries `namespace.key` first, then the flat `key` — so today's flat keys
 * (`cod_enabled`, `seller_state_code`) resolve while namespaced keys work too.
 */
function makeSettingsReader(map: ReadonlyMap<string, unknown>): SettingsReader {
  const lookup = (ns: string, key: string): unknown =>
    map.has(`${ns}.${key}`) ? map.get(`${ns}.${key}`) : map.get(key);
  return {
    get: <T,>(ns: string, key: string): T | undefined => lookup(ns, key) as T | undefined,
    getBool: (ns, key, fb = false) => toBool(lookup(ns, key)) ?? fb,
    getInt: (ns, key, fb = 0) => toInt(lookup(ns, key)) ?? fb,
    getString: (ns, key, fb) => {
      const v = lookup(ns, key);
      return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : fb;
    },
  };
}

async function loadSettings(): Promise<Map<string, unknown>> {
  const rows = await db
    .select({ key: storeSettings.key, value: storeSettings.value })
    .from(storeSettings);
  return new Map(rows.map((r) => [r.key, r.value]));
}

/**
 * Per-business capability overrides: a `capability.<key>.enabled` setting row
 * (jsonb boolean, or "true"/"false"/1/0) turns a capability on or off over the
 * preset's defaults. Unset or unparsable rows leave the default alone.
 */
function loadCapabilityOverrides(
  settings: SettingsReader,
): Partial<Record<Capability, boolean>> {
  const overrides: Partial<Record<Capability, boolean>> = {};
  for (const cap of CAPABILITY_KEYS) {
    const enabled = toBool(settings.get('capability', `${cap}.enabled`));
    if (enabled !== null) overrides[cap] = enabled;
  }
  return overrides;
}

/** Build the BusinessContext for the acting admin (grants drive `can()`). */
export async function buildBusinessContext(
  admin: AdminIdentity,
): Promise<BusinessContext> {
  assertBrandMatchesEnv();
  const map = await loadSettings();
  const settings = makeSettingsReader(map);
  const { profile: brandProfile } = brand;

  const profile: BusinessProfile = {
    businessId: 'default',
    name: brandProfile.name,
    // Legal identity lives in store_settings only (no brand default) —
    // `undefined` until the owner configures it in Settings.
    legalName: settings.getString('legal', 'seller_legal_name'),
    currency: brandProfile.currency,
    country: brandProfile.country,
    locale: brandProfile.locale,
    identifierPrefix: brandProfile.identifierPrefix,
    vertical: brandProfile.vertical,
  };

  // The brand's vertical preset (tuned by its presetOverrides), then the
  // per-business capability overrides from settings on top.
  const preset = resolvePreset(brandProfile);
  const capabilities = resolveCapabilities(preset, loadCapabilityOverrides(settings));

  return createBusinessContext({
    profile,
    capabilities,
    enabledModules: new Set(),
    settings,
    grants: admin.grants,
    preset,
  });
}

export interface AdminRequestContext {
  readonly admin: AdminIdentity;
  readonly ctx: BusinessContext;
}

/**
 * Resolve the acting admin AND their BusinessContext, or `null` when there is
 * no live admin session. The one entry point admin pages/handlers use.
 */
export async function resolveAdminContext(): Promise<AdminRequestContext | null> {
  const admin = await resolveAdminSession();
  if (admin === null) return null;
  const ctx = await buildBusinessContext(admin);
  return { admin, ctx };
}
