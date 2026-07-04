import { z } from "zod";

/**
 * Environment variable contracts for KAKOA (PROJECT_PLAN §4.2).
 *
 * - Required at boot in every environment: DATABASE_URL, NEXT_PUBLIC_SITE_URL,
 *   OTP_PEPPER, SESSION_SECRET, APP_ENV.
 * - Integration keys (Razorpay, Shiprocket, MSG91, Resend, Inngest, Sentry) are
 *   .optional() for Phase 0/1 — checkout runs against in-repo mocks until real
 *   keys exist. Later phases tighten these via refinement at the call sites.
 */

export const APP_ENVS = ["local", "preview", "staging", "production"] as const;
export type AppEnv = (typeof APP_ENVS)[number];

const nonEmpty = z.string().min(1);

export const serverEnvSchema = z.object({
  // ── Core (required) ────────────────────────────────────────────────
  DATABASE_URL: z.string().url(),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  OTP_PEPPER: z.string().min(32, "OTP_PEPPER must be at least 32 characters"),
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters"),
  APP_ENV: z.enum(APP_ENVS),

  // ── Razorpay (optional until Phase 2 go-live) ──────────────────────
  RAZORPAY_KEY_ID: nonEmpty.optional(),
  RAZORPAY_KEY_SECRET: nonEmpty.optional(),
  RAZORPAY_WEBHOOK_SECRET: nonEmpty.optional(),

  // ── Shiprocket (optional until fulfilment goes live) ───────────────
  SHIPROCKET_EMAIL: z.string().email().optional(),
  SHIPROCKET_PASSWORD: nonEmpty.optional(),
  SHIPROCKET_WEBHOOK_TOKEN: nonEmpty.optional(),

  // ── MSG91 SMS/OTP (optional; mocked locally) ───────────────────────
  MSG91_AUTH_KEY: nonEmpty.optional(),
  MSG91_OTP_TEMPLATE_ID: nonEmpty.optional(),
  // Non-prod only: fixed OTP "000000" + in-memory FakeSmsProvider (Playwright + local login).
  OTP_TEST_MODE: z.enum(["0", "1"]).optional(),

  // ── Resend email (optional; mocked locally) ────────────────────────
  RESEND_API_KEY: nonEmpty.optional(),
  EMAIL_FROM: z.string().email().optional(),

  // ── Inngest (optional; dev server needs no keys) ───────────────────
  INNGEST_EVENT_KEY: nonEmpty.optional(),
  INNGEST_SIGNING_KEY: nonEmpty.optional(),

  // ── Observability (optional) ───────────────────────────────────────
  SENTRY_DSN: z.string().url().optional(),
});

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
}

/**
 * Parse and validate all server-side env vars. Call once at boot.
 * Throws with a readable list of every missing/invalid var.
 */
export function parseServerEnv(
  source: Record<string, string | undefined> = process.env,
): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(
      `Invalid server environment variables:\n${formatIssues(result.error)}`,
    );
  }
  return result.data;
}

/**
 * Parse and validate client-exposed (NEXT_PUBLIC_*) env vars.
 * Throws with a readable list of every missing/invalid var.
 */
export function parseClientEnv(
  source: Record<string, string | undefined> = process.env,
): ClientEnv {
  const result = clientEnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(
      `Invalid client environment variables:\n${formatIssues(result.error)}`,
    );
  }
  return result.data;
}
