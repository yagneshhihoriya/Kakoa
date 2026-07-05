/**
 * Send-test (HANDOFF-Notifications §5). Renders the merged (override-or-default)
 * template with SAMPLE vars, sends via the active provider, records a masked
 * `notification_log` row, and audits. Rate-limited per admin. Never leaks secrets.
 *
 * SERVER-ONLY: uses @kakoa/db + @kakoa/integrations.
 */
import { adminAuditLog, db } from '@kakoa/db';
import { getEmailProvider, getSmsProvider } from '@kakoa/integrations';
import { wrapEmailBody } from '@/lib/email/templates';
import { getTemplate } from './notification-templates';
import { recordNotification } from './notification-log';
import { renderTemplate } from './notification-catalog';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+91[6-9][0-9]{9}$/;

/** Sample substitution values for the preview / test render. */
const SAMPLE_VARS: Record<string, string> = {
  orderNumber: 'KK-TEST01',
  customerName: 'Test Customer',
  trackingUrl: 'https://kakoa.in/account/track?order=KK-TEST01',
  amount: '₹1,299.00',
  awb: 'KKTEST12345',
  courierName: 'Mock Express',
  eta: 'Fri, 10 Jul',
};

/* Rate limit: ≤ 5 test-sends per admin per rolling 60s (per-process). */
const RATE_MAX = 5;
const RATE_WINDOW_MS = 60_000;
const recentByAdmin = new Map<string, number[]>();

function rateLimited(adminUserId: string): boolean {
  const now = Date.now();
  const times = (recentByAdmin.get(adminUserId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (times.length >= RATE_MAX) {
    recentByAdmin.set(adminUserId, times);
    return true;
  }
  times.push(now);
  recentByAdmin.set(adminUserId, times);
  return false;
}

export type TestResult =
  | { ok: true; status: 'sent' | 'failed' }
  | { ok: false; code: 'VALIDATION_ERROR' | 'NOT_FOUND' | 'RATE_LIMITED'; message: string };

export async function sendTestNotification(
  input: { key: string; channel: string; to: string },
  adminUserId: string,
): Promise<TestResult> {
  const merged = await getTemplate(input.key, input.channel);
  if (merged === null) return { ok: false, code: 'NOT_FOUND', message: 'Unknown template.' };

  const to = typeof input.to === 'string' ? input.to.trim() : '';
  if (merged.channel === 'email' && !EMAIL_RE.test(to)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Enter a valid email address.' };
  }
  if (merged.channel === 'sms' && !PHONE_RE.test(to)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Enter a valid Indian phone (+91XXXXXXXXXX).' };
  }

  if (rateLimited(adminUserId)) {
    return { ok: false, code: 'RATE_LIMITED', message: 'Too many test sends — wait a minute and try again.' };
  }

  let status: 'sent' | 'failed' = 'sent';
  let providerMessageId: string | null = null;
  let error: string | null = null;

  try {
    if (merged.channel === 'email') {
      const subject = `[TEST] ${renderTemplate(merged.subject ?? '', SAMPLE_VARS, { escapeHtml: false })}`;
      const html = wrapEmailBody(renderTemplate(merged.body, SAMPLE_VARS, { escapeHtml: true }));
      const text = renderTemplate(merged.body, SAMPLE_VARS, { escapeHtml: false });
      const r = await getEmailProvider().send({ to, subject, html, text, idempotencyKey: `test-${input.key}-${Date.now()}` });
      providerMessageId = r.providerMessageId;
    } else {
      const message = renderTemplate(merged.body, SAMPLE_VARS, { escapeHtml: false });
      const r = await getSmsProvider().sendText({ phoneE164: to, message, template: input.key });
      providerMessageId = r.providerMessageId;
    }
  } catch (cause) {
    status = 'failed';
    error = cause instanceof Error ? cause.message : 'send failed';
  }

  await recordNotification({
    channel: merged.channel,
    templateKey: input.key,
    recipient: to,
    status,
    providerMessageId,
    error,
  });

  await db.insert(adminAuditLog).values({
    adminUserId,
    action: 'notification.test',
    entityType: 'notification_template',
    entityId: null,
    before: null,
    after: { key: input.key, channel: merged.channel, status },
  });

  return { ok: true, status };
}
