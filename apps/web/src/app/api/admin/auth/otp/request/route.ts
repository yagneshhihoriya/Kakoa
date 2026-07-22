/**
 * POST /api/admin/auth/otp/request — admin email OTP request (admin-staff-roles.md).
 *
 * Only an ACTIVE admin gets a real challenge + emailed code. An unknown email
 * returns an indistinguishable 200 with a throwaway id (no enumeration, no
 * challenge row, no email). Reuses the shared OTP infra with purpose
 * `admin_login` + channel `email`. In OTP_TEST_MODE the code is `000000`.
 */
import { randomUUID } from 'node:crypto';
import { adminUsers, db } from '@kakoa/db';
import { getEmailProvider } from '@kakoa/integrations';
import { and, eq } from 'drizzle-orm';
import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { createChallenge } from '@/lib/auth/otp';
import { isOtpTestMode } from '@/lib/auth/otp-crypto';
import { clientIp } from '@/lib/auth/request-context';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function readEmail(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const raw = (body as { email?: unknown }).email;
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  return EMAIL_RE.test(email) && email.length <= 254 ? email : null;
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr('VALIDATION_ERROR', 'Invalid request body.');
  }

  const email = readEmail(body);
  if (email === null) {
    return jsonErr('VALIDATION_ERROR', 'Enter a valid email address.', {
      fieldErrors: { email: ['Enter a valid email address.'] },
    });
  }

  const [admin] = await db
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .where(and(eq(adminUsers.email, email), eq(adminUsers.isActive, true)))
    .limit(1);

  // Unknown / inactive email → indistinguishable response; nothing issued.
  if (!admin) {
    return jsonOk(
      { challengeId: randomUUID(), testMode: isOtpTestMode() },
      { cacheControl: NO_STORE },
    );
  }

  const { challengeId, code } = await createChallenge({
    channel: 'email',
    destination: email,
    purpose: 'admin_login',
    ip: clientIp(req),
  });

  // Best-effort delivery — never blocks issuing the challenge.
  void getEmailProvider()
    .send({
      to: email,
      subject: 'Your KAKOA admin sign-in code',
      html: `<p>Your admin sign-in code is <strong>${code}</strong>. It expires in 10 minutes.</p>`,
      text: `Your admin sign-in code is ${code}. It expires in 10 minutes.`,
      idempotencyKey: `admin-otp-${challengeId}`,
    })
    .catch(() => {});

  return jsonOk(
    { challengeId, testMode: isOtpTestMode() },
    { cacheControl: NO_STORE },
  );
}
