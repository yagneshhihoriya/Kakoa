"use client";

import { useState, type FormEvent } from "react";

/**
 * Admin sign-in — email OTP (docs/admin-platform §4). Two steps: email → code.
 * On success the 12h admin cookie is set server-side and we hard-navigate to
 * `/admin` so the gated shell picks up the session.
 */
export default function AdminLoginPage(): React.ReactNode {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [testMode, setTestMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestOtp(e: FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/auth/otp/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error?.message ?? "Something went wrong.");
        return;
      }
      setChallengeId(data.data.challengeId);
      setTestMode(Boolean(data.data.testMode));
      setStep("otp");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(e: FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/auth/otp/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengeId, code: code.trim() }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error?.message ?? "Invalid code.");
        setBusy(false);
        return;
      }
      window.location.href = "/admin";
    } catch {
      setError("Network error. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#1c130c] px-4 text-white">
      <div className="w-full max-w-sm">
        <div
          className="mb-1 text-2xl"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          Kakao
        </div>
        <p className="mb-8 text-sm text-white/50">Admin sign-in</p>

        {step === "email" ? (
          <form onSubmit={requestOtp} className="space-y-4">
            <label className="block text-[13px] text-white/70">
              Email
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@business.com"
                className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
              />
            </label>
            {error !== null ? (
              <p className="text-[13px] text-red-400">{error}</p>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-white px-4 py-2.5 font-semibold text-[#1c130c] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send code"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="space-y-4">
            <p className="text-[13px] text-white/60">
              We sent a 6-digit code to{" "}
              <span className="text-white">{email}</span>.
            </p>
            {testMode ? (
              <p className="rounded-md bg-amber-400/10 px-3 py-2 text-[12px] text-amber-300">
                Test mode — the code is <strong>000000</strong>.
              </p>
            ) : null}
            <input
              inputMode="numeric"
              maxLength={6}
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-center text-xl tracking-[0.4em] text-white placeholder:text-white/25 focus:border-white/40 focus:outline-none"
            />
            {error !== null ? (
              <p className="text-[13px] text-red-400">{error}</p>
            ) : null}
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="w-full rounded-lg bg-white px-4 py-2.5 font-semibold text-[#1c130c] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Verifying…" : "Sign in"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setCode("");
                setError(null);
              }}
              className="w-full text-center text-[13px] text-white/50 hover:text-white/80"
            >
              Use a different email
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
