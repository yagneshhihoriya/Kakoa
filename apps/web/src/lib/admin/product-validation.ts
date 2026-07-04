/**
 * Pure product validation helpers — NO @kakoa/db import, so they're unit-testable
 * in isolation and safe to use from Edge/route code. `validateAttributes` is the
 * generic, business-agnostic mechanism that keeps the catalog vertical-neutral.
 */
import type { AttributeDef, Capability } from '@platform/kernel';

/** Postgres uuid shape — guard before comparing against a uuid column (else 22P02). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(s: unknown): s is string {
  return typeof s === 'string' && UUID_RE.test(s);
}

/**
 * Sanitize/validate an attributes object against the vertical preset's schema.
 * Unknown keys are dropped; attributes gated on a disabled capability are
 * dropped; each value is coerced/validated per its declared type + options.
 * Pure — only ever writes trusted schema keys (no __proto__/constructor path).
 */
export function validateAttributes(
  schema: readonly AttributeDef[],
  capabilities: ReadonlySet<Capability>,
  input: unknown,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (typeof input !== 'object' || input === null) return out;
  const src = input as Record<string, unknown>;
  for (const def of schema) {
    if (def.capability !== undefined && !capabilities.has(def.capability)) continue;
    const v = src[def.key];
    if (v === undefined || v === null || v === '') continue;
    switch (def.type) {
      case 'number': {
        const n = Number(v);
        if (Number.isFinite(n)) out[def.key] = n;
        break;
      }
      case 'boolean':
        out[def.key] = Boolean(v);
        break;
      case 'enum':
        if (typeof v === 'string' && (def.options ?? []).includes(v)) out[def.key] = v;
        break;
      case 'multi-enum':
        if (Array.isArray(v)) {
          out[def.key] = v.filter(
            (x): x is string => typeof x === 'string' && (def.options ?? []).includes(x),
          );
        }
        break;
      case 'text':
      case 'rich':
        if (typeof v === 'string') out[def.key] = v.slice(0, 5000);
        break;
    }
  }
  return out;
}
