/**
 * Admin BusinessContext resolver (docs/admin-platform §1.2, §5).
 *
 * Builds the per-request `BusinessContext` the admin runs against: a
 * `SettingsReader` over `store_settings`, the vertical preset's capabilities,
 * and the acting admin's permission grants. Every config read, capability check
 * and permission check flows through this — the seam that lets us add shared
 * multi-tenancy later without touching module code.
 *
 * Today it resolves the single 'default' business (Kakao). `business_settings`
 * (namespaced) will supersede `store_settings` in a later increment; the reader
 * already accepts a `(namespace, key)` shape and degrades to the flat key.
 *
 * SERVER-ONLY: uses @kakoa/db.
 */
import { db, storeSettings } from '@kakoa/db';
import {
  createBusinessContext,
  resolveCapabilities,
  type BusinessContext,
  type BusinessProfile,
  type Capability,
  type SettingsReader,
} from '@platform/kernel';
import { BRAND } from '@/lib/seo/site';
import { resolveAdminSession, type AdminIdentity } from './session';

/** The current business vertical. Config-driven later; 'chocolate' for Kakao. */
const VERTICAL = 'chocolate' as const;

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

/** Build the BusinessContext for the acting admin (grants drive `can()`). */
export async function buildBusinessContext(
  admin: AdminIdentity,
): Promise<BusinessContext> {
  const map = await loadSettings();
  const settings = makeSettingsReader(map);

  const profile: BusinessProfile = {
    businessId: 'default',
    name: BRAND.name,
    legalName: settings.getString('legal', 'seller_legal_name', BRAND.name),
    currency: 'INR',
    country: 'IN',
    locale: 'en-IN',
    identifierPrefix: 'KK',
    vertical: VERTICAL,
  };

  // Capability overrides from settings (`capability.<key>.enabled`).
  const overrides: Partial<Record<Capability, boolean>> = {};
  const capabilities = resolveCapabilities(VERTICAL, overrides);

  return createBusinessContext({
    profile,
    capabilities,
    enabledModules: new Set(),
    settings,
    grants: admin.grants,
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
