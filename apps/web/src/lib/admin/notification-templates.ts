/**
 * Notification templates (HANDOFF-Notifications §5). DB overrides on top of the
 * code-default catalog: rendering looks up the `(key, channel)` override; absent
 * or inactive ⇒ the code default. Admins edit copy without a deploy, and the
 * store works with ZERO rows.
 *
 * `resolveOverrideEmail` / `resolveOverrideSms` are what the SEND paths call to
 * pick up an active override (they return `null` to signal "use the code default").
 *
 * SERVER-ONLY: uses @kakoa/db.
 */
import { adminAuditLog, adminUsers, db, notificationTemplates } from '@kakoa/db';
import { and, eq, sql } from 'drizzle-orm';
import { wrapEmailBody } from '@/lib/email/templates';
import { withConstraintMapping } from './db-errors';
import {
  TEMPLATE_CATALOG,
  catalogEntry,
  renderTemplate,
  unknownPlaceholders,
  type NotificationChannel,
} from './notification-catalog';

export interface MergedTemplate {
  key: string;
  channel: NotificationChannel;
  label: string;
  subject: string | null;
  body: string;
  isActive: boolean;
  isOverridden: boolean;
  placeholders: string[];
  updatedByEmail: string | null;
  updatedAt: string | null;
}

/** All catalog templates merged with their DB override (if any). */
export async function listTemplates(): Promise<MergedTemplate[]> {
  const overrides = await db
    .select({
      key: notificationTemplates.key,
      channel: notificationTemplates.channel,
      subject: notificationTemplates.subject,
      body: notificationTemplates.body,
      isActive: notificationTemplates.isActive,
      updatedAt: notificationTemplates.updatedAt,
      updatedByEmail: adminUsers.email,
    })
    .from(notificationTemplates)
    .leftJoin(adminUsers, eq(adminUsers.id, notificationTemplates.updatedBy));
  const byKey = new Map(overrides.map((o) => [`${o.key}:${o.channel}`, o]));

  return TEMPLATE_CATALOG.map((c) => {
    const o = byKey.get(`${c.key}:${c.channel}`);
    return {
      key: c.key,
      channel: c.channel,
      label: c.label,
      subject: o ? o.subject : (c.defaultSubject ?? null),
      body: o ? o.body : c.defaultBody,
      isActive: o ? o.isActive : true,
      isOverridden: o !== undefined,
      placeholders: c.placeholders,
      updatedByEmail: o?.updatedByEmail ?? null,
      updatedAt: o?.updatedAt ? new Date(o.updatedAt).toISOString() : null,
    };
  });
}

/** One merged template for the editor, or `null` if `(key, channel)` is unknown. */
export async function getTemplate(
  key: string,
  channel: string,
): Promise<MergedTemplate | null> {
  const c = catalogEntry(key, channel);
  if (c === undefined) return null;
  const [o] = await db
    .select({
      subject: notificationTemplates.subject,
      body: notificationTemplates.body,
      isActive: notificationTemplates.isActive,
      updatedAt: notificationTemplates.updatedAt,
      updatedByEmail: adminUsers.email,
    })
    .from(notificationTemplates)
    .leftJoin(adminUsers, eq(adminUsers.id, notificationTemplates.updatedBy))
    .where(and(eq(notificationTemplates.key, key), eq(notificationTemplates.channel, channel)))
    .limit(1);
  return {
    key: c.key,
    channel: c.channel,
    label: c.label,
    subject: o ? o.subject : (c.defaultSubject ?? null),
    body: o ? o.body : c.defaultBody,
    isActive: o ? o.isActive : true,
    isOverridden: o !== undefined,
    placeholders: c.placeholders,
    updatedByEmail: o?.updatedByEmail ?? null,
    updatedAt: o?.updatedAt ? new Date(o.updatedAt).toISOString() : null,
  };
}

export type TemplateResult =
  | { ok: true }
  | { ok: false; code: 'VALIDATION_ERROR' | 'NOT_FOUND'; message: string };

/**
 * Upsert a template override for `(key, channel)`. Rejects an unknown
 * `(key, channel)` and any `{{placeholder}}` outside the catalog's allowed set.
 * Audited in-tx.
 */
export async function upsertTemplate(
  input: { key: string; channel: string; subject?: string | null; body: string; isActive: boolean },
  adminUserId: string,
): Promise<TemplateResult> {
  const entry = catalogEntry(input.key, input.channel);
  if (entry === undefined) {
    return { ok: false, code: 'NOT_FOUND', message: 'Unknown template.' };
  }
  const body = typeof input.body === 'string' ? input.body : '';
  if (body.trim().length === 0 || body.length > 5000) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Enter a template body (up to 5000 characters).' };
  }
  const subject = entry.channel === 'email' ? (typeof input.subject === 'string' ? input.subject : '') : null;
  if (entry.channel === 'email' && (subject === null || subject.trim().length === 0 || subject.length > 200)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Enter an email subject (up to 200 characters).' };
  }

  // Placeholder subset check across body + subject.
  const bad = [
    ...unknownPlaceholders(body, entry.placeholders),
    ...(subject !== null ? unknownPlaceholders(subject, entry.placeholders) : []),
  ];
  if (bad.length > 0) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: `Unknown placeholder(s): ${[...new Set(bad)].map((p) => `{{${p}}}`).join(', ')}.`,
    };
  }

  return withConstraintMapping(() =>
    db.transaction(async (tx): Promise<TemplateResult> => {
      const [before] = await tx
        .select({ subject: notificationTemplates.subject, body: notificationTemplates.body, isActive: notificationTemplates.isActive })
        .from(notificationTemplates)
        .where(and(eq(notificationTemplates.key, input.key), eq(notificationTemplates.channel, input.channel)))
        .limit(1);

      await tx
        .insert(notificationTemplates)
        .values({
          key: input.key,
          channel: input.channel,
          subject,
          body,
          isActive: input.isActive,
          updatedBy: adminUserId,
        })
        .onConflictDoUpdate({
          target: [notificationTemplates.key, notificationTemplates.channel],
          set: { subject, body, isActive: input.isActive, updatedBy: adminUserId, updatedAt: sql`now()` },
        });

      await tx.insert(adminAuditLog).values({
        adminUserId,
        action: 'notification_template.update',
        entityType: 'notification_template',
        entityId: null,
        before: before ?? null,
        after: { key: input.key, channel: input.channel, isActive: input.isActive },
      });
      return { ok: true };
    }),
  );
}

/**
 * Resolve an ACTIVE email override for a send → a fully-rendered
 * `{ subject, html, text }` (body substituted, HTML-escaped + wrapped in the
 * brand shell), or `null` to signal the caller to use the rich code template.
 * Best-effort: any error resolves to `null` (fall back to the code default).
 */
export async function resolveOverrideEmail(
  key: string,
  vars: Record<string, string | number | null | undefined>,
): Promise<{ subject: string; html: string; text: string } | null> {
  try {
    const [o] = await db
      .select({ subject: notificationTemplates.subject, body: notificationTemplates.body })
      .from(notificationTemplates)
      .where(
        and(
          eq(notificationTemplates.key, key),
          eq(notificationTemplates.channel, 'email'),
          eq(notificationTemplates.isActive, true),
        ),
      )
      .limit(1);
    if (!o) return null;
    return {
      subject: renderTemplate(o.subject ?? '', vars, { escapeHtml: false }),
      html: wrapEmailBody(renderTemplate(o.body, vars, { escapeHtml: true })),
      text: renderTemplate(o.body, vars, { escapeHtml: false }),
    };
  } catch {
    return null;
  }
}

/** Resolve an ACTIVE SMS override for a send (plain text), or `null`. Best-effort. */
export async function resolveOverrideSms(
  key: string,
  vars: Record<string, string | number | null | undefined>,
): Promise<string | null> {
  try {
    const [o] = await db
      .select({ body: notificationTemplates.body })
      .from(notificationTemplates)
      .where(
        and(
          eq(notificationTemplates.key, key),
          eq(notificationTemplates.channel, 'sms'),
          eq(notificationTemplates.isActive, true),
        ),
      )
      .limit(1);
    if (!o) return null;
    return renderTemplate(o.body, vars, { escapeHtml: false });
  } catch {
    return null;
  }
}
