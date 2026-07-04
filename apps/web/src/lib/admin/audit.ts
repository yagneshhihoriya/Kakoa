/**
 * Admin audit log (HANDOFF-Staff-Roles-Audit §7). READ-ONLY. Exposes every
 * mutating admin action across the store — sensitive, `audit:read` (Owner) gated
 * at the route/page. Actor may be null (system action / deleted admin) → "system".
 *
 * SERVER-ONLY: uses @kakoa/db.
 */
import { adminAuditLog, adminUsers, db } from '@kakoa/db';
import { and, desc, eq, sql, type SQL } from 'drizzle-orm';
import { isUuid } from './product-validation';

export const AUDIT_PAGE_SIZE = 50;

export interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  actorEmail: string | null;
  actorName: string | null;
  createdAt: string;
}

export interface AuditList {
  rows: AuditRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

function clampPage(raw: number | undefined): number {
  const n = Math.floor(Number(raw ?? 1));
  return Number.isFinite(n) ? Math.min(1_000_000, Math.max(1, n)) : 1;
}

export async function listAudit(input: {
  actorId?: string;
  entityType?: string;
  action?: string;
  page?: number;
}): Promise<AuditList> {
  const page = clampPage(input.page);
  const pageSize = AUDIT_PAGE_SIZE;

  const conds: SQL[] = [];
  if (input.entityType) conds.push(eq(adminAuditLog.entityType, input.entityType));
  if (input.action) conds.push(eq(adminAuditLog.action, input.action));
  // Malformed actorId filter is dropped (never a 22P02 → 500), not applied.
  if (input.actorId && isUuid(input.actorId)) conds.push(eq(adminAuditLog.adminUserId, input.actorId));
  const where = conds.length > 0 ? and(...conds) : undefined;

  const [totalRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(adminAuditLog)
    .where(where);
  const total = Number(totalRow?.total ?? 0);

  const rows = await db
    .select({
      id: adminAuditLog.id,
      action: adminAuditLog.action,
      entityType: adminAuditLog.entityType,
      entityId: adminAuditLog.entityId,
      before: adminAuditLog.before,
      after: adminAuditLog.after,
      actorEmail: adminUsers.email,
      actorName: adminUsers.name,
      createdAt: adminAuditLog.createdAt,
    })
    .from(adminAuditLog)
    .leftJoin(adminUsers, eq(adminUsers.id, adminAuditLog.adminUserId))
    .where(where)
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      before: r.before,
      after: r.after,
      actorEmail: r.actorEmail,
      actorName: r.actorName,
      createdAt: new Date(r.createdAt).toISOString(),
    })),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Distinct entity types + actions present in the log — drives the filter dropdowns. */
export async function auditFilterOptions(): Promise<{ entityTypes: string[]; actions: string[] }> {
  const [types, actions] = await Promise.all([
    db.selectDistinct({ v: adminAuditLog.entityType }).from(adminAuditLog).orderBy(adminAuditLog.entityType),
    db.selectDistinct({ v: adminAuditLog.action }).from(adminAuditLog).orderBy(adminAuditLog.action),
  ]);
  return {
    entityTypes: types.map((t) => t.v),
    actions: actions.map((a) => a.v),
  };
}
