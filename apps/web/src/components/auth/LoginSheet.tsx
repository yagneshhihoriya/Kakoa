"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  maskPhone,
  normalizePhoneE164,
  type ApiResult,
  type AuthVerifyResult,
} from "@kakoa/core";
import { cx } from "@kakoa/ui";
import { useToast } from "@kakoa/ui/client";
import { useCart } from "@/components/cart/CartProvider";
import { useAuth } from "./AuthProvider";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;
const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold";

/**
 * Dev hint: only rendered when the app is NOT production AND the test-mode
 * flag is exposed. `NEXT_PUBLIC_OTP_TEST_MODE` is inlined at build time by
 * Next; it is a UI convenience only (the server is the OTP authority).
 */
const DEV_TEST_MODE =
  process.env.NEXT_PUBLIC_APP_ENV !== "production" &&
  process.env.NEXT_PUBLIC_OTP_TEST_MODE === "1";

type Step = "phone" | "otp";

interface RequestData {
  challengeId: string;
  resendAfterSec: number;
}

/** Format seconds as `m:ss` for the rate-limit / resend countdowns. */
function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Countdown hook                                                      */
/* ------------------------------------------------------------------ */

/** A 1Hz countdown to zero. Returns remaining seconds; `start(n)` (re)arms it. */
function useCountdown(): { remaining: number; start: (seconds: number) => void } {
  const [remaining, setRemaining] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = useCallback((): void => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(
    (seconds: number): void => {
      clear();
      setRemaining(seconds);
      if (seconds <= 0) return;
      timerRef.current = setInterval(() => {
        setRemaining((current) => {
          if (current <= 1) {
            clear();
            return 0;
          }
          return current - 1;
        });
      }, 1000);
    },
    [clear],
  );

  useEffect(() => clear, [clear]);

  return { remaining, start };
}

/* ------------------------------------------------------------------ */
/* Sheet                                                               */
/* ------------------------------------------------------------------ */

export interface LoginSheetProps {
  isOpen: boolean;
  /** Why the sheet opened (e.g. "wishlist") — shown as a subheading. */
  reason?: string;
  onClose: () => void;
}

const REASON_COPY: Record<string, string> = {
  wishlist: "Sign in to save this to your wishlist.",
  checkout: "Sign in to check out faster.",
  account: "Sign in to view your account.",
};

/**
 * OTP login sheet (docs/modules/auth-otp.md §2) — visual style from the
 * prototype auth screen (62-auth.html) but a two-step OTP flow, not
 * login/register/forgot. Focus-trapped modal; right drawer on desktop,
 * bottom sheet on mobile. STEP 1 phone entry → `POST /api/auth/otp/request`;
 * STEP 2 six-box code → `POST /api/auth/otp/verify`. Handles all five UI
 * states (loading / empty / error / success / partial) and every §5 error
 * code inline.
 */
export function LoginSheet({
  isOpen,
  reason,
  onClose,
}: LoginSheetProps): ReactNode {
  const { toast } = useToast();
  const { refresh: refreshAuth } = useAuth();
  const { refresh: refreshCart } = useCart();

  const [step, setStep] = useState<Step>("phone");

  // Phone step
  const [phoneRaw, setPhoneRaw] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [upstreamError, setUpstreamError] = useState(false);

  // OTP step
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [maskedDestination, setMaskedDestination] = useState("");
  const [digits, setDigits] = useState<string[]>(() =>
    Array<string>(OTP_LENGTH).fill(""),
  );
  const [otpError, setOtpError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const rateCountdown = useCountdown();
  const resendCountdown = useCountdown();

  const panelRef = useRef<HTMLDivElement | null>(null);
  const phoneInputRef = useRef<HTMLInputElement | null>(null);
  const boxRefs = useRef<Array<HTMLInputElement | null>>([]);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  /* ---- lifecycle: reset when opened, restore focus on close ---- */

  const resetAll = useCallback((): void => {
    setStep("phone");
    setPhoneRaw("");
    setPhoneError(null);
    setRequesting(false);
    setRateLimited(false);
    setUpstreamError(false);
    setChallengeId(null);
    setMaskedDestination("");
    setDigits(Array<string>(OTP_LENGTH).fill(""));
    setOtpError(null);
    setVerifying(false);
    setNotice(null);
  }, []);

  useEffect(() => {
    if (isOpen) {
      resetAll();
      previousFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      // Focus the phone input after paint.
      const raf = requestAnimationFrame(() => {
        phoneInputRef.current?.focus();
      });
      return () => {
        cancelAnimationFrame(raf);
      };
    }
    previousFocusRef.current?.focus();
    return undefined;
  }, [isOpen, resetAll]);

  // Body scroll lock while open (restored on close/unmount).
  useEffect(() => {
    if (!isOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  // ESC to close + Tab focus trap.
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (panel === null) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusables.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (first === undefined || last === undefined) return;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  /* ---- derived ---- */

  const normalizedForDisplay = useMemo(
    () => (phoneRaw.trim() === "" ? null : normalizePhoneE164(phoneRaw)),
    [phoneRaw],
  );
  const code = digits.join("");
  const otpComplete = code.length === OTP_LENGTH;

  /* ---- STEP 1: request OTP ---- */

  const submitPhone = useCallback(
    async (event?: FormEvent): Promise<void> => {
      event?.preventDefault();
      if (requesting || rateCountdown.remaining > 0) return;

      setPhoneError(null);
      setUpstreamError(false);
      setRateLimited(false);

      const normalized = normalizePhoneE164(phoneRaw);
      if (normalized === null) {
        // Client-side guard mirrors §1.1 — server is still authoritative.
        setPhoneError("Enter a valid 10-digit Indian mobile number.");
        return;
      }

      setRequesting(true);
      try {
        const response = await fetch("/api/auth/otp/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel: "sms",
            destination: normalized,
            purpose: "customer_login",
          }),
        });
        const result = (await response.json()) as ApiResult<RequestData>;

        if (result.ok) {
          setChallengeId(result.data.challengeId);
          setMaskedDestination(maskPhone(normalized));
          setDigits(Array<string>(OTP_LENGTH).fill(""));
          setOtpError(null);
          setNotice(null);
          setStep("otp");
          resendCountdown.start(result.data.resendAfterSec || RESEND_SECONDS);
          requestAnimationFrame(() => boxRefs.current[0]?.focus());
          return;
        }

        // Error envelope → inline surface per §5.1.
        switch (result.error.code) {
          case "VALIDATION_ERROR": {
            const fieldMessage =
              result.error.fieldErrors?.destination?.[0] ??
              result.error.message;
            setPhoneError(fieldMessage);
            break;
          }
          case "RATE_LIMITED": {
            const retryAfter = Number(
              response.headers.get("Retry-After") ?? "60",
            );
            setRateLimited(true);
            rateCountdown.start(
              Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 60,
            );
            break;
          }
          case "UPSTREAM_ERROR":
            setUpstreamError(true);
            break;
          default:
            setPhoneError(result.error.message);
        }
      } catch {
        setUpstreamError(true);
      } finally {
        setRequesting(false);
      }
    },
    [phoneRaw, requesting, rateCountdown, resendCountdown],
  );

  /* ---- STEP 2: verify OTP ---- */

  const gateBackToPhone = useCallback(
    (message: string): void => {
      setStep("phone");
      setChallengeId(null);
      setDigits(Array<string>(OTP_LENGTH).fill(""));
      setOtpError(null);
      setNotice(message);
      requestAnimationFrame(() => phoneInputRef.current?.focus());
    },
    [],
  );

  const submitOtp = useCallback(
    async (submittedCode: string): Promise<void> => {
      if (verifying || challengeId === null) return;
      if (submittedCode.length !== OTP_LENGTH) {
        setOtpError("Enter the 6-digit code we sent you.");
        return;
      }

      setVerifying(true);
      setOtpError(null);
      try {
        const response = await fetch("/api/auth/otp/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ challengeId, code: submittedCode }),
        });
        const result = (await response.json()) as ApiResult<AuthVerifyResult>;

        if (result.ok) {
          // Success — reconcile auth + cart, toast, close (stay on page).
          await Promise.all([refreshAuth(), refreshCart()]);
          toast({ kind: "success", message: "Welcome to Kakao." });
          if (result.data.cartMerged) {
            toast({
              kind: "info",
              message: "Your cart items were saved.",
            });
          }
          onCloseRef.current();
          return;
        }

        switch (result.error.code) {
          case "OTP_INCORRECT": {
            const details = result.error.details as
              | { attemptsLeft?: number }
              | undefined;
            const left = details?.attemptsLeft;
            setOtpError(
              typeof left === "number"
                ? `Incorrect code — ${left} ${left === 1 ? "attempt" : "attempts"} left.`
                : result.error.message,
            );
            setDigits(Array<string>(OTP_LENGTH).fill(""));
            requestAnimationFrame(() => boxRefs.current[0]?.focus());
            break;
          }
          case "OTP_EXPIRED":
            gateBackToPhone("That code expired — request a new one.");
            break;
          case "VALIDATION_ERROR":
            setOtpError("Enter the 6-digit code we sent you.");
            break;
          default:
            setOtpError(result.error.message);
        }
      } catch {
        setOtpError("Something went wrong — please try again.");
      } finally {
        setVerifying(false);
      }
    },
    [challengeId, verifying, refreshAuth, refreshCart, toast, gateBackToPhone],
  );

  /* ---- OTP box input handlers ---- */

  const setDigitAt = useCallback((index: number, value: string): void => {
    setDigits((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  }, []);

  const handleBoxChange = useCallback(
    (index: number, rawValue: string): void => {
      const value = rawValue.replace(/\D/g, "");
      if (value === "") {
        setDigitAt(index, "");
        return;
      }
      // Auto-advance across as many boxes as typed characters (handles fast typing).
      setDigits((current) => {
        const next = [...current];
        let cursor = index;
        for (const char of value) {
          if (cursor >= OTP_LENGTH) break;
          next[cursor] = char;
          cursor += 1;
        }
        const focusTarget = Math.min(cursor, OTP_LENGTH - 1);
        requestAnimationFrame(() => boxRefs.current[focusTarget]?.focus());
        const joined = next.join("");
        if (joined.length === OTP_LENGTH) {
          void submitOtp(joined);
        }
        return next;
      });
      setOtpError(null);
    },
    [setDigitAt, submitOtp],
  );

  const handleBoxKeyDown = useCallback(
    (index: number, event: KeyboardEvent<HTMLInputElement>): void => {
      if (event.key === "Backspace") {
        if (digits[index] === "" && index > 0) {
          event.preventDefault();
          setDigitAt(index - 1, "");
          boxRefs.current[index - 1]?.focus();
        }
        return;
      }
      if (event.key === "ArrowLeft" && index > 0) {
        event.preventDefault();
        boxRefs.current[index - 1]?.focus();
      }
      if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) {
        event.preventDefault();
        boxRefs.current[index + 1]?.focus();
      }
    },
    [digits, setDigitAt],
  );

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLInputElement>): void => {
      const pasted = event.clipboardData
        .getData("text")
        .replace(/\D/g, "")
        .slice(0, OTP_LENGTH);
      if (pasted === "") return;
      event.preventDefault();
      const next = Array<string>(OTP_LENGTH).fill("");
      for (let i = 0; i < pasted.length; i += 1) next[i] = pasted[i] ?? "";
      setDigits(next);
      setOtpError(null);
      const focusTarget = Math.min(pasted.length, OTP_LENGTH - 1);
      requestAnimationFrame(() => boxRefs.current[focusTarget]?.focus());
      if (pasted.length === OTP_LENGTH) void submitOtp(pasted);
    },
    [submitOtp],
  );

  const resend = useCallback((): void => {
    if (resendCountdown.remaining > 0) return;
    // Re-run the request path for the same number (server enforces the 60s window).
    void submitPhone();
  }, [resendCountdown.remaining, submitPhone]);

  if (!isOpen) return null;

  const reasonCopy = reason !== undefined ? REASON_COPY[reason] : undefined;

  /* ------------------------------------------------------------------ */
  /* Render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <div className="fixed inset-0 z-50">
      <div
        aria-hidden="true"
        onClick={() => onCloseRef.current()}
        className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Sign in to Kakao"
        tabIndex={-1}
        className={cx(
          "absolute flex flex-col bg-cream shadow-[0_30px_70px_rgba(42,29,18,.28)] focus-visible:outline-none",
          // Desktop: right panel. Mobile: bottom sheet.
          "inset-y-0 right-0 w-full max-w-[440px]",
          "max-[560px]:inset-x-0 max-[560px]:inset-y-auto max-[560px]:bottom-0 max-[560px]:max-h-[92vh] max-[560px]:w-full max-[560px]:max-w-none max-[560px]:rounded-t-[26px]",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-7 py-5">
          <span
            className="text-[22px] text-ink"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            {step === "phone" ? "Sign in" : "Enter code"}
          </span>
          <button
            type="button"
            aria-label="Close sign in"
            onClick={() => onCloseRef.current()}
            className={cx(
              "grid h-10 w-10 place-items-center rounded-pill text-espresso transition-colors hover:bg-[#F0E4D2]",
              FOCUS_RING,
            )}
          >
            <span aria-hidden="true" className="text-xl">
              ×
            </span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-7 py-7">
          {step === "phone" ? (
            <form onSubmit={submitPhone} noValidate>
              <p className="mb-6 font-body text-[14.5px] leading-relaxed text-espresso">
                {reasonCopy ??
                  "We'll text you a one-time code — no password needed."}
              </p>

              {/* Gated-back notice (from an expired OTP) */}
              {notice !== null ? (
                <div
                  role="status"
                  className="mb-4 rounded-xl border border-[#E8DBC6] bg-[#F5E3C4]/50 px-4 py-3 font-body text-[13.5px] text-[#7a5a1e]"
                >
                  {notice}
                </div>
              ) : null}

              <label
                htmlFor="login-phone"
                className="mb-2 block font-body text-[13px] font-semibold text-[#5C4B3A]"
              >
                Mobile number
              </label>
              <div
                className={cx(
                  "flex items-center overflow-hidden rounded-xl border bg-[#F9F3EA] transition-colors focus-within:ring-2 focus-within:ring-gold",
                  phoneError !== null ? "border-danger" : "border-[#E8DBC6]",
                )}
              >
                <span className="select-none border-r border-[#E8DBC6] px-4 py-[14px] font-body text-[15px] font-semibold text-espresso">
                  +91
                </span>
                <input
                  id="login-phone"
                  ref={phoneInputRef}
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="98765 43210"
                  value={phoneRaw}
                  onChange={(event) => {
                    setPhoneRaw(event.target.value);
                    setPhoneError(null);
                  }}
                  aria-invalid={phoneError !== null}
                  aria-describedby={
                    phoneError !== null ? "login-phone-error" : undefined
                  }
                  className="w-full bg-transparent px-4 py-[14px] font-body text-[15px] text-ink outline-none placeholder:text-[#b3a288]"
                />
              </div>

              {/* Live normalized preview (partial state) */}
              {normalizedForDisplay !== null && phoneError === null ? (
                <p className="mt-2 font-body text-[12.5px] text-[#8a7a68]">
                  We'll send the code to {maskPhone(normalizedForDisplay)}
                </p>
              ) : null}

              {/* Inline field error */}
              {phoneError !== null ? (
                <p
                  id="login-phone-error"
                  role="alert"
                  className="mt-2 font-body text-[12.5px] font-medium text-danger"
                >
                  {phoneError}
                </p>
              ) : null}

              {/* Rate-limited (429) countdown */}
              {rateLimited && rateCountdown.remaining > 0 ? (
                <p
                  role="alert"
                  className="mt-3 rounded-xl border border-[#E8DBC6] bg-[#F5E3C4]/50 px-4 py-3 font-body text-[13px] text-[#7a5a1e]"
                >
                  Too many requests — try again in{" "}
                  <span className="font-semibold tabular-nums">
                    {formatCountdown(rateCountdown.remaining)}
                  </span>
                  .
                </p>
              ) : null}

              {/* Upstream (502) error with retry */}
              {upstreamError ? (
                <div
                  role="alert"
                  className="mt-3 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3"
                >
                  <p className="font-body text-[13px] text-danger">
                    Couldn't send the code — try again shortly.
                  </p>
                  <button
                    type="button"
                    onClick={() => void submitPhone()}
                    className={cx(
                      "mt-2 font-body text-[13px] font-semibold text-espresso underline",
                      FOCUS_RING,
                    )}
                  >
                    Retry
                  </button>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={requesting || rateCountdown.remaining > 0}
                className={cx(
                  "mt-6 flex w-full items-center justify-center gap-2 rounded-pill bg-ink px-6 py-[15px] font-body text-[15.5px] font-bold text-card transition-colors hover:bg-[#3f2c1b] disabled:cursor-not-allowed disabled:opacity-60",
                  FOCUS_RING,
                )}
              >
                {requesting ? (
                  <>
                    <Spinner />
                    Sending…
                  </>
                ) : (
                  "Send code"
                )}
              </button>

              {DEV_TEST_MODE ? (
                <p className="mt-4 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-[#a08a72]">
                  Dev: use 000000
                </p>
              ) : null}

              <p className="mt-5 text-center font-body text-[12px] leading-relaxed text-[#8a7a68]">
                By continuing you agree to Kakao's Terms &amp; Privacy Policy.
              </p>
            </form>
          ) : (
            <div>
              <p className="mb-1 font-body text-[14.5px] text-espresso">
                Enter the 6-digit code sent to
              </p>
              <p className="mb-6 font-body text-[15px] font-semibold text-ink">
                {maskedDestination}
              </p>

              {/* Six-box code entry */}
              <div
                className="flex justify-between gap-2"
                role="group"
                aria-label="One-time passcode"
              >
                {digits.map((digit, index) => (
                  <input
                    // eslint-disable-next-line react/no-array-index-key
                    key={index}
                    ref={(el) => {
                      boxRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    maxLength={1}
                    value={digit}
                    disabled={verifying}
                    aria-label={`Digit ${index + 1}`}
                    onChange={(event) =>
                      handleBoxChange(index, event.target.value)
                    }
                    onKeyDown={(event) => handleBoxKeyDown(index, event)}
                    onPaste={handlePaste}
                    className={cx(
                      "h-[54px] w-full rounded-xl border bg-[#F9F3EA] text-center font-body text-[22px] font-semibold text-ink outline-none transition-colors focus:ring-2 focus:ring-gold disabled:opacity-60",
                      otpError !== null ? "border-danger" : "border-[#E8DBC6]",
                    )}
                  />
                ))}
              </div>

              {/* Inline verify error (attempts left) */}
              {otpError !== null ? (
                <p
                  role="alert"
                  className="mt-3 font-body text-[13px] font-medium text-danger"
                >
                  {otpError}
                </p>
              ) : null}

              {/* Verifying (success-in-progress) state */}
              {verifying ? (
                <p className="mt-3 flex items-center gap-2 font-body text-[13px] text-espresso">
                  <Spinner />
                  Verifying…
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => void submitOtp(code)}
                disabled={verifying || !otpComplete}
                className={cx(
                  "mt-6 flex w-full items-center justify-center gap-2 rounded-pill bg-ink px-6 py-[15px] font-body text-[15.5px] font-bold text-card transition-colors hover:bg-[#3f2c1b] disabled:cursor-not-allowed disabled:opacity-60",
                  FOCUS_RING,
                )}
              >
                {verifying ? "Verifying…" : "Verify & sign in"}
              </button>

              {/* Resend countdown */}
              <div className="mt-5 text-center font-body text-[13px] text-[#8a7a68]">
                {resendCountdown.remaining > 0 ? (
                  <span>
                    Resend code in{" "}
                    <span className="font-semibold tabular-nums text-espresso">
                      {formatCountdown(resendCountdown.remaining)}
                    </span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={resend}
                    disabled={requesting}
                    className={cx(
                      "font-semibold text-espresso underline disabled:opacity-60",
                      FOCUS_RING,
                    )}
                  >
                    {requesting ? "Sending…" : "Resend code"}
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => gateBackToPhone("")}
                className={cx(
                  "mt-4 w-full text-center font-body text-[13.5px] font-semibold text-[#6B5A49]",
                  FOCUS_RING,
                )}
              >
                ← Use a different number
              </button>

              {DEV_TEST_MODE ? (
                <p className="mt-4 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-[#a08a72]">
                  Dev: use 000000
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Inline loading spinner (matches chrome button affordances). */
function Spinner(): ReactNode {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M12 2a10 10 0 0 1 10 10h-3a7 7 0 0 0-7-7V2z"
      />
    </svg>
  );
}
