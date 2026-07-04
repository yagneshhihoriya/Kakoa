/**
 * OTP code generation, storage, and verification — auth-otp.md §1.3, §2, §7.
 *
 * KAKOA is the sole source of truth for OTP codes (§3): generate with a CSPRNG,
 * store only `sha256(code || OTP_PEPPER)`, compute TTL and enforce it entirely
 * on DB `now()`, and consume atomically so exactly one verify wins any race.
 *
 * NEVER logged: the raw code, the pepper, or the raw destination — structured
 * logs use `sha256(destination)` (§6).
 *
 * SERVER-ONLY: uses node:crypto + @kakoa/db.
 */
import type { OtpChannel } from '@kakoa/core';
import { db, otpChallenges } from '@kakoa/db';
import { and, eq, sql } from 'drizzle-orm';

import {
  generateCode,
  hashCode,
  hashDestination,
  hashesEqual,
  OTP_MAX_ATTEMPTS,
} from './otp-crypto';

/**
 * OTP purposes wired so far. `customer_login` is the auth route;
 * `cod_verification` is the checkout COD phone-verification challenge
 * (checkout.md §1.3 / cod.md); `order_lookup` is the guest order-tracking
 * challenge (order-tracking.md §1.1) — all share the same generate/store/
 * verify/consume machinery, differing only by `purpose` + `context`.
 */
export type OtpPurpose = 'customer_login' | 'cod_verification' | 'order_lookup';

// Re-export the dep-free crypto primitives so the pinned interface is stable.
export {
  generateCode,
  hashCode,
  hashDestination,
  OTP_MAX_ATTEMPTS,
} from './otp-crypto';

/**
 * Create an OTP challenge row and return its id + the raw code (to hand to the
 * SMS provider — never persisted). `expires_at = now() + interval '10 minutes'`
 * is computed by Postgres in the INSERT (§1.3): the app clock is never an
 * authority. The row is kept even if delivery later fails (it still counts
 * toward rate limits — the cost was attempted, §2 step 4).
 */
export async function createChallenge(input: {
  channel: OtpChannel;
  destination: string;
  purpose: OtpPurpose;
  ip: string | null;
  /** Correlation payload, e.g. `{ order_number: 'KK-48210' }` for `order_lookup`. */
  context?: Record<string, string>;
}): Promise<{ challengeId: string; code: string }> {
  const code = generateCode();
  const [row] = await db
    .insert(otpChallenges)
    .values({
      channel: input.channel,
      destination: input.destination,
      purpose: input.purpose,
      codeHash: hashCode(code),
      context: input.context ?? null,
      expiresAt: sql`now() + interval '10 minutes'`,
      ip: input.ip ?? null,
    })
    .returning({ id: otpChallenges.id });
  if (!row) throw new Error('otp_challenges insert returned no row');
  return { challengeId: row.id, code };
}

/**
 * Resolve the id of the LATEST open challenge for a `(destination, purpose)`
 * pair, optionally filtered by `context->>order_number` (order_lookup). Open =
 * `consumed_at IS NULL AND expires_at > now() AND attempts < 5` — the same
 * "live challenge" predicate `verifyCode` enforces. Returns `null` when none
 * exists (the guest posted a code without a matching request, or it lapsed) —
 * the caller maps `null` to the unified 410 `OTP_EXPIRED` (no oracle, §6).
 *
 * Latest-open-challenge-wins mirrors auth-otp.md's convention (§7 edge case 12):
 * a re-request after the 60s cooldown supersedes the older code on verify.
 */
export async function findOpenChallengeId(input: {
  destination: string;
  purpose: OtpPurpose;
  orderNumber?: string;
}): Promise<string | null> {
  const [row] = await db
    .select({ id: otpChallenges.id })
    .from(otpChallenges)
    .where(
      and(
        eq(otpChallenges.destination, input.destination),
        eq(otpChallenges.purpose, input.purpose),
        sql`${otpChallenges.consumedAt} IS NULL`,
        sql`${otpChallenges.expiresAt} > now()`,
        sql`${otpChallenges.attempts} < ${OTP_MAX_ATTEMPTS}`,
        ...(input.orderNumber !== undefined
          ? [sql`${otpChallenges.context}->>'order_number' = ${input.orderNumber}`]
          : []),
      ),
    )
    .orderBy(sql`${otpChallenges.createdAt} DESC`)
    .limit(1);
  return row?.id ?? null;
}

/**
 * Outcome of a verify attempt. `expired` is the umbrella for every 410 cause
 * (expired / consumed / exhausted / unknown-or-malformed id / race lost) — the
 * caller maps them all to one message with no oracle (§5.2, §6).
 */
export type VerifyOutcome =
  | { status: 'ok'; challenge: { destination: string; purpose: OtpPurpose } }
  | { status: 'incorrect'; attemptsLeft: number }
  | { status: 'expired' };

/**
 * Verify a submitted code against a challenge and, on success, atomically
 * consume it (§2 steps 6–7):
 *
 *  1. Load the open challenge (`consumed_at IS NULL AND expires_at > now()`).
 *     Missing / consumed / expired / attempts exhausted ⇒ `expired`.
 *  2. Constant-time hash compare. Wrong ⇒ `UPDATE attempts = attempts + 1
 *     WHERE consumed_at IS NULL AND attempts < 5 RETURNING attempts` — zero
 *     rows means the challenge just died elsewhere ⇒ `expired`; otherwise
 *     `incorrect` with `attemptsLeft` (0 ⇒ this was the 5th, now dead but the
 *     caller still surfaces "incorrect" for this response, then future verifies
 *     get 410).
 *  3. Correct ⇒ atomic consume `UPDATE consumed_at = now() WHERE id = $1 AND
 *     consumed_at IS NULL AND expires_at > now()`. One row = winner; zero rows
 *     = a racing verify won or the clock lapsed ⇒ `expired`.
 *
 * The consume UPDATE is optionally run inside the caller's transaction (`tx`),
 * so a post-consume tx failure rolls the consume back (§7 edge case 8).
 */
export async function verifyCode(input: {
  challengeId: string;
  code: string;
}): Promise<VerifyOutcome> {
  const { challengeId, code } = input;

  // Open = not consumed and not past TTL. `attempts < 5` is enforced in the
  // increment guard below; a row at attempts = 5 that is still un-consumed is
  // treated as dead here (its increment already returned zero rows).
  const [challenge] = await db
    .select({
      id: otpChallenges.id,
      codeHash: otpChallenges.codeHash,
      attempts: otpChallenges.attempts,
      destination: otpChallenges.destination,
      purpose: otpChallenges.purpose,
    })
    .from(otpChallenges)
    .where(
      and(
        eq(otpChallenges.id, challengeId),
        sql`${otpChallenges.consumedAt} IS NULL`,
        sql`${otpChallenges.expiresAt} > now()`,
        sql`${otpChallenges.attempts} < ${OTP_MAX_ATTEMPTS}`,
      ),
    )
    .limit(1);

  if (!challenge) return { status: 'expired' };

  const correct = hashesEqual(hashCode(code), challenge.codeHash);

  if (!correct) {
    const rows = await db
      .update(otpChallenges)
      .set({ attempts: sql`${otpChallenges.attempts} + 1` })
      .where(
        and(
          eq(otpChallenges.id, challengeId),
          sql`${otpChallenges.consumedAt} IS NULL`,
          sql`${otpChallenges.attempts} < ${OTP_MAX_ATTEMPTS}`,
        ),
      )
      .returning({ attempts: otpChallenges.attempts });

    const updated = rows[0];
    // Zero rows ⇒ the challenge died between the load and the increment
    // (consumed or 5th attempt elsewhere) ⇒ no oracle, treat as expired.
    if (!updated) return { status: 'expired' };
    return { status: 'incorrect', attemptsLeft: OTP_MAX_ATTEMPTS - updated.attempts };
  }

  const purpose = challenge.purpose as OtpPurpose;
  return {
    status: 'ok',
    challenge: { destination: challenge.destination, purpose },
  };
}

/**
 * Atomic consume of a challenge (§2 step 7). Returns `true` for the single
 * winner, `false` if a racing verify already consumed it or the TTL lapsed.
 * Runs inside the caller's transaction so a later failure un-consumes the code
 * on rollback (§7 edge case 8).
 */
export async function consumeChallenge(
  challengeId: string,
  tx: Pick<typeof db, 'update'>,
): Promise<boolean> {
  const rows = await tx
    .update(otpChallenges)
    .set({ consumedAt: sql`now()` })
    .where(
      and(
        eq(otpChallenges.id, challengeId),
        sql`${otpChallenges.consumedAt} IS NULL`,
        sql`${otpChallenges.expiresAt} > now()`,
      ),
    )
    .returning({ id: otpChallenges.id });
  return rows.length === 1;
}
