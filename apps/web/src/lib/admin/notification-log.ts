/**
 * Notification send log (HANDOFF-Notifications §5). `recordNotification` is the
 * best-effort insert every send path calls after an attempt — it MASKS the
 * recipient at write (never stores full PII) and NEVER throws (a log failure must
 * not break an already-best-effort send). `listNotificationLog` is the read UI.
 *
 * SERVER-ONLY: uses @kakoa/db.
 */
import { db, notificationLog, orders } from '@kakoa/db';
import { maskPhone } from '@kakoa/core';
import { and, desc, eq, sql, type SQL } from 'drizzle-orm';
import { maskEmail } from './customer-privacy';

export type NotificationChannel = 'email' | 'sms';
export type NotificationStatus = 'sent' | 'failed' | 'skipped';

export interface RecordNotificationInput {
  channel: NotificationChannel;
  templateKey: string;
  /** RAW recipient — masked here before storage. */
  recipient: string;
  orderId?: string | null;
  status: NotificationStatus;
  providerMessageId?: string | null;
  error?: string | null;
}

function maskRecipient(channel: NotificationChannel, recipient: string): string {
  const masked = channel === 'email' ? maskEmail(recipient) : maskPhone(recipient);
  return masked ?? '•••';
}

/** Best-effort append to the send log. Never throws. */
export async function recordNotification(input: RecordNotificationInput): Promise<void> {
  try {
    await db.insert(notificationLog).values({
      channel: input.channel,
      templateKey: input.templateKey,
      recipient: maskRecipient(input.channel, input.recipient),
      orderId: input.orderId ?? null,
      status: input.status,
      providerMessageId: input.providerMessageId ?? null,
      error: input.error ? input.error.slice(0, 500) : null,
    });
  } catch (cause) {
    console.error('notification.log_insert_failed', {
      template_key: input.templateKey,
      cause: cause instanceof Error ? cause.message : 'unknown',
    });
  }
}

export const NOTIFICATION_LOG_PAGE_SIZE = 50;

export interface NotificationLogRow {
  id: string;
  channel: string;
  templateKey: string;
  recipient: string;
  status: string;
  providerMessageId: string | null;
  error: string | null;
  orderNumber: string | null;
  createdAt: string;
}

export interface NotificationLogList {
  rows: NotificationLogRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

function likeParam(s: string): string {
  return `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export async function listNotificationLog(input: {
  channel?: string;
  status?: string;
  search?: string;
  page?: number;
}): Promise<NotificationLogList> {
  const page = Math.min(1_000_000, Math.max(1, Math.floor(Number(input.page ?? 1)) || 1));
  const pageSize = NOTIFICATION_LOG_PAGE_SIZE;

  const conds: SQL[] = [];
  if (input.channel === 'email' || input.channel === 'sms') {
    conds.push(eq(notificationLog.channel, input.channel));
  }
  if (input.status === 'sent' || input.status === 'failed' || input.status === 'skipped') {
    conds.push(eq(notificationLog.status, input.status));
  }
  const search = input.search?.trim();
  if (search) {
    const p = likeParam(search);
    conds.push(sql`(${notificationLog.templateKey} ilike ${p} or ${notificationLog.recipient} ilike ${p})`);
  }
  const where = conds.length > 0 ? and(...conds) : undefined;

  const [totalRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(notificationLog)
    .where(where);
  const total = Number(totalRow?.total ?? 0);

  const rows = await db
    .select({
      id: notificationLog.id,
      channel: notificationLog.channel,
      templateKey: notificationLog.templateKey,
      recipient: notificationLog.recipient,
      status: notificationLog.status,
      providerMessageId: notificationLog.providerMessageId,
      error: notificationLog.error,
      orderNumber: orders.orderNumber,
      createdAt: notificationLog.createdAt,
    })
    .from(notificationLog)
    .leftJoin(orders, eq(orders.id, notificationLog.orderId))
    .where(where)
    .orderBy(desc(notificationLog.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      channel: r.channel,
      templateKey: r.templateKey,
      recipient: r.recipient,
      status: r.status,
      providerMessageId: r.providerMessageId,
      error: r.error,
      orderNumber: r.orderNumber,
      createdAt: new Date(r.createdAt).toISOString(),
    })),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}
