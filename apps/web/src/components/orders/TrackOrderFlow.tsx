"use client";

/**
 * Guest order-tracking flow (order-tracking.md §2, prototype 73-tracking.html).
 *
 * Two entry paths converge on the SAME tracking view:
 *   1. Lookup:  order# + phone → request-otp → 6-box OTP → verify → 30-min JWT
 *               held IN MEMORY (never localStorage/cookie/URL, §6) → tracking.
 *   2. Direct:  `?order=&accessToken=` from the success page → read-only
 *               tracking (accessToken can't cancel, ≤24h).
 *
 * Every §5 error code is surfaced inline; a 410 `TOKEN_EXPIRED` mid-session
 * swaps back to the lookup step (prefilled) with a "verify again" notice.
 * Cancel is offered only on the JWT path (accessToken is read-only).
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  maskPhone,
  normalizePhoneE164,
  type OrderSummary,
  type OrderTracking,
} from "@kakoa/core";
import { cx } from "@kakoa/ui";
import { useToast } from "@kakoa/ui/client";
import { OrderTrackingView } from "./OrderTrackingView";
import { CancelOrderDialog } from "./CancelOrderDialog";
import { useTracking, type TrackingCredential } from "./useTracking";

const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;
const ORDER_NUMBER_RE = /^KK-\d{5}$/;
const SERIF = { fontFamily: "var(--font-display), serif" } as const;
const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold";

type Step = "lookup" | "otp" | "tracking";

function formatCountdown(total: number): string {
  const s = Math.max(0, total);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

/** 1Hz countdown; `start(n)` re-arms it. */
function useCountdown(): { remaining: number; start: (seconds: number) => void } {
  const [remaining, setRemaining] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  const clear = useCallback((): void => {
    if (ref.current !== null) {
      clearInterval(ref.current);
      ref.current = null;
    }
  }, []);
  const start = useCallback(
    (seconds: number): void => {
      clear();
      setRemaining(seconds);
      if (seconds <= 0) return;
      ref.current = setInterval(() => {
        setRemaining((c) => {
          if (c <= 1) {
            clear();
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    },
    [clear],
  );
  useEffect(() => clear, [clear]);
  return { remaining, start };
}

export interface TrackOrderFlowProps {
  /** Success-page continuity: `?order=` prefilled / direct-load candidate. */
  initialOrderNumber?: string;
  /** Success-page continuity: `?accessToken=` (read-only, ≤24h). */
  initialAccessToken?: string;
}

export function TrackOrderFlow({
  initialOrderNumber,
  initialAccessToken,
}: TrackOrderFlowProps): ReactNode {
  const { requestOtp, verifyOtp, fetchTracking, cancelOrder } = useTracking();
  const { toast } = useToast();

  // Attempt a direct accessToken load if both params are present & well-formed.
  const directCandidate =
    typeof initialOrderNumber === "string" &&
    ORDER_NUMBER_RE.test(initialOrderNumber) &&
    typeof initialAccessToken === "string" &&
    initialAccessToken !== "";

  const [step, setStep] = useState<Step>(directCandidate ? "tracking" : "lookup");

  // Lookup step
  const [orderNumberRaw, setOrderNumberRaw] = useState(initialOrderNumber ?? "");
  const [phoneRaw, setPhoneRaw] = useState("");
  const [orderError, setOrderError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [upstreamError, setUpstreamError] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // OTP step
  const [digits, setDigits] = useState<string[]>(() =>
    Array<string>(OTP_LENGTH).fill(""),
  );
  const [otpError, setOtpError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [maskedPhone, setMaskedPhone] = useState("");

  // Tracking step
  const [credential, setCredential] = useState<TrackingCredential | null>(
    directCandidate
      ? { kind: "accessToken", token: initialAccessToken as string }
      : null,
  );
  const [orderNumber, setOrderNumber] = useState(
    directCandidate ? (initialOrderNumber as string) : "",
  );
  const [tracking, setTracking] = useState<OrderTracking | null>(null);
  const [loadingTracking, setLoadingTracking] = useState(directCandidate);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const rateCountdown = useCountdown();
  const resendCountdown = useCountdown();
  const boxRefs = useRef<Array<HTMLInputElement | null>>([]);
  const orderInputRef = useRef<HTMLInputElement | null>(null);

  const normalizedPhone =
    phoneRaw.trim() === "" ? null : normalizePhoneE164(phoneRaw);

  /* ---------------- tracking fetch ---------------- */

  const loadTracking = useCallback(
    async (num: string, cred: TrackingCredential): Promise<void> => {
      setLoadingTracking(true);
      setTrackingError(null);
      const result = await fetchTracking(num, cred);
      setLoadingTracking(false);
      if (result.ok) {
        setTracking(result.data);
        return;
      }
      switch (result.error.code) {
        case "TOKEN_EXPIRED":
          // JWT expired mid-session, or accessToken >24h → back to lookup.
          setTracking(null);
          setCredential(null);
          setStep("lookup");
          setDigits(Array<string>(OTP_LENGTH).fill(""));
          setNotice(
            cred.kind === "accessToken"
              ? "This link has expired. Verify with OTP to keep tracking."
              : "Your tracking link expired. Verify again with the code we'll text you.",
          );
          requestAnimationFrame(() => orderInputRef.current?.focus());
          break;
        case "NOT_FOUND":
          setTrackingError("We couldn't find that order.");
          break;
        case "UNAUTHORIZED":
          setTrackingError("Please verify with OTP to view this order.");
          break;
        default:
          setTrackingError(result.error.message);
      }
    },
    [fetchTracking],
  );

  // Kick off the direct accessToken load once on mount.
  const directLoadedRef = useRef(false);
  useEffect(() => {
    if (directCandidate && !directLoadedRef.current) {
      directLoadedRef.current = true;
      void loadTracking(
        initialOrderNumber as string,
        { kind: "accessToken", token: initialAccessToken as string },
      );
    }
  }, [directCandidate, initialAccessToken, initialOrderNumber, loadTracking]);

  /* ---------------- STEP 1: request OTP ---------------- */

  const submitLookup = useCallback(
    async (event?: FormEvent): Promise<void> => {
      event?.preventDefault();
      if (requesting || rateCountdown.remaining > 0) return;

      setOrderError(null);
      setPhoneError(null);
      setUpstreamError(false);
      setRateLimited(false);

      const num = orderNumberRaw.trim().toUpperCase();
      let invalid = false;
      if (!ORDER_NUMBER_RE.test(num)) {
        setOrderError("Enter a valid order number like KK-48210.");
        invalid = true;
      }
      const normalized = normalizePhoneE164(phoneRaw);
      if (normalized === null) {
        setPhoneError("Enter the 10-digit mobile number used on the order.");
        invalid = true;
      }
      if (invalid || normalized === null) return;

      setRequesting(true);
      try {
        const { result, retryAfter } = await requestOtp({
          orderNumber: num,
          phone: normalized,
        });
        if (result.ok) {
          setOrderNumber(num);
          setMaskedPhone(maskPhone(normalized));
          setDigits(Array<string>(OTP_LENGTH).fill(""));
          setOtpError(null);
          setNotice(null);
          setStep("otp");
          resendCountdown.start(result.data.resendAfterSec || RESEND_SECONDS);
          requestAnimationFrame(() => boxRefs.current[0]?.focus());
          return;
        }
        switch (result.error.code) {
          case "VALIDATION_ERROR":
            setOrderError(
              result.error.fieldErrors?.orderNumber?.[0] ?? null,
            );
            setPhoneError(result.error.fieldErrors?.phone?.[0] ?? null);
            break;
          case "RATE_LIMITED": {
            const wait = retryAfter ?? 60;
            setRateLimited(true);
            rateCountdown.start(wait > 0 ? wait : 60);
            break;
          }
          case "UPSTREAM_ERROR":
            setUpstreamError(true);
            break;
          default:
            setOrderError(result.error.message);
        }
      } catch {
        setUpstreamError(true);
      } finally {
        setRequesting(false);
      }
    },
    [
      orderNumberRaw,
      phoneRaw,
      requesting,
      rateCountdown,
      resendCountdown,
      requestOtp,
    ],
  );

  /* ---------------- STEP 2: verify OTP ---------------- */

  const backToLookup = useCallback((message: string): void => {
    setStep("lookup");
    setDigits(Array<string>(OTP_LENGTH).fill(""));
    setOtpError(null);
    setNotice(message === "" ? null : message);
    requestAnimationFrame(() => orderInputRef.current?.focus());
  }, []);

  const submitOtp = useCallback(
    async (code: string): Promise<void> => {
      if (verifying) return;
      const normalized = normalizePhoneE164(phoneRaw);
      if (normalized === null) {
        backToLookup("Re-enter your details to continue.");
        return;
      }
      if (code.length !== OTP_LENGTH) {
        setOtpError("Enter the 6-digit code we sent you.");
        return;
      }

      setVerifying(true);
      setOtpError(null);
      try {
        const result = await verifyOtp({
          orderNumber,
          phone: normalized,
          code,
        });
        if (result.ok) {
          const cred: TrackingCredential = {
            kind: "bearer",
            token: result.data.trackingToken,
          };
          setCredential(cred);
          setStep("tracking");
          seedFromSummary(result.data.order);
          void loadTracking(orderNumber, cred);
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
            backToLookup("That code expired. Request a new one.");
            break;
          case "VALIDATION_ERROR":
            setOtpError("Enter the 6-digit code we sent you.");
            break;
          default:
            setOtpError(result.error.message);
        }
      } catch {
        setOtpError("Something went wrong. Please try again.");
      } finally {
        setVerifying(false);
      }
    },
    [
      backToLookup,
      loadTracking,
      orderNumber,
      phoneRaw,
      verifyOtp,
      verifying,
    ],
  );

  // Seed a provisional tracking view from the verify payload's OrderSummary so
  // the header renders instantly while the full tracking read is in flight.
  const seedFromSummary = useCallback((order: OrderSummary): void => {
    setTracking((current) =>
      current !== null
        ? current
        : { order, timeline: [], shipment: null },
    );
  }, []);

  /* ---------------- OTP box handlers ---------------- */

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
      setDigits((current) => {
        const next = [...current];
        let cursor = index;
        for (const char of value) {
          if (cursor >= OTP_LENGTH) break;
          next[cursor] = char;
          cursor += 1;
        }
        requestAnimationFrame(() =>
          boxRefs.current[Math.min(cursor, OTP_LENGTH - 1)]?.focus(),
        );
        const joined = next.join("");
        if (joined.length === OTP_LENGTH) void submitOtp(joined);
        return next;
      });
      setOtpError(null);
    },
    [setDigitAt, submitOtp],
  );

  const handleBoxKeyDown = useCallback(
    (index: number, event: KeyboardEvent<HTMLInputElement>): void => {
      if (event.key === "Backspace" && digits[index] === "" && index > 0) {
        event.preventDefault();
        setDigitAt(index - 1, "");
        boxRefs.current[index - 1]?.focus();
      } else if (event.key === "ArrowLeft" && index > 0) {
        event.preventDefault();
        boxRefs.current[index - 1]?.focus();
      } else if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) {
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
      requestAnimationFrame(() =>
        boxRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus(),
      );
      if (pasted.length === OTP_LENGTH) void submitOtp(pasted);
    },
    [submitOtp],
  );

  const resend = useCallback((): void => {
    if (resendCountdown.remaining > 0) return;
    void submitLookup();
  }, [resendCountdown.remaining, submitLookup]);

  /* ---------------- cancel ---------------- */

  const handleCancelled = useCallback((order: OrderSummary): void => {
    setCancelOpen(false);
    toast({ kind: "success", message: "Order cancelled." });
    // Re-fetch so the timeline shows the cancelled step from the server.
    setTracking((current) =>
      current !== null ? { ...current, order } : current,
    );
    if (credential !== null) void loadTracking(orderNumber, credential);
  }, [credential, loadTracking, orderNumber, toast]);

  /* ---------------- render ---------------- */

  return (
    <main className="mx-auto max-w-[960px] px-8 pb-[72px] pt-8 max-[560px]:px-5">
      <div className="mb-6 font-body text-[13px] text-[#8a7a68]">
        <Link href="/account" className="text-[#8a7a68] hover:text-ink">
          Account
        </Link>{" "}
        / <span className="text-ink">Track order</span>
      </div>

      <h1 className="mb-2 text-[38px] leading-none text-ink max-[560px]:text-[30px]" style={SERIF}>
        Track your order
      </h1>
      <p className="mb-8 font-body text-[15px] text-espresso">
        {step === "tracking"
          ? "Here's where your chocolate is right now."
          : "Enter your order number and the mobile number you used at checkout."}
      </p>

      {step === "lookup" ? (
        <LookupCard
          orderNumberRaw={orderNumberRaw}
          phoneRaw={phoneRaw}
          orderError={orderError}
          phoneError={phoneError}
          requesting={requesting}
          rateLimited={rateLimited}
          rateRemaining={rateCountdown.remaining}
          upstreamError={upstreamError}
          notice={notice}
          normalizedPhone={normalizedPhone}
          orderInputRef={orderInputRef}
          onOrderChange={(v) => {
            setOrderNumberRaw(v);
            setOrderError(null);
          }}
          onPhoneChange={(v) => {
            setPhoneRaw(v);
            setPhoneError(null);
          }}
          onSubmit={submitLookup}
        />
      ) : null}

      {step === "otp" ? (
        <OtpCard
          maskedPhone={maskedPhone}
          digits={digits}
          otpError={otpError}
          verifying={verifying}
          resendRemaining={resendCountdown.remaining}
          requesting={requesting}
          boxRefs={boxRefs}
          onBoxChange={handleBoxChange}
          onBoxKeyDown={handleBoxKeyDown}
          onPaste={handlePaste}
          onSubmit={() => void submitOtp(digits.join(""))}
          onResend={resend}
          onBack={() => backToLookup("")}
        />
      ) : null}

      {step === "tracking" ? (
        loadingTracking && tracking === null ? (
          <TrackingSkeleton />
        ) : trackingError !== null && tracking === null ? (
          <ErrorCard
            message={trackingError}
            onRetry={
              credential !== null
                ? () => void loadTracking(orderNumber, credential)
                : undefined
            }
          />
        ) : tracking !== null ? (
          <>
            <OrderTrackingView
              tracking={tracking}
              onCancel={
                credential !== null && credential.kind === "bearer"
                  ? () => setCancelOpen(true)
                  : undefined
              }
            />
            {credential !== null && credential.kind === "accessToken" ? (
              <p className="mt-5 rounded-[14px] border border-[#E8DBC6] bg-[#F9F3EA] px-4 py-3 font-body text-[13px] text-[#7a6a58]">
                You're viewing a read-only link. To cancel this order, verify
                with a one-time code.{" "}
                <button
                  type="button"
                  onClick={() => backToLookup("")}
                  className="font-semibold text-espresso underline"
                >
                  Verify now
                </button>
              </p>
            ) : null}
          </>
        ) : null
      ) : null}

      {cancelOpen && tracking !== null && credential !== null ? (
        <CancelOrderDialog
          orderNumber={orderNumber}
          onSubmit={(reason) => cancelOrder(orderNumber, { reason }, credential)}
          onCancelled={handleCancelled}
          onClose={() => setCancelOpen(false)}
        />
      ) : null}
    </main>
  );
}

/* ================================================================== */
/* Sub-cards                                                           */
/* ================================================================== */

const CARD = "rounded-[18px] border border-[#EEE1CE] bg-white";

function LookupCard({
  orderNumberRaw,
  phoneRaw,
  orderError,
  phoneError,
  requesting,
  rateLimited,
  rateRemaining,
  upstreamError,
  notice,
  normalizedPhone,
  orderInputRef,
  onOrderChange,
  onPhoneChange,
  onSubmit,
}: {
  orderNumberRaw: string;
  phoneRaw: string;
  orderError: string | null;
  phoneError: string | null;
  requesting: boolean;
  rateLimited: boolean;
  rateRemaining: number;
  upstreamError: boolean;
  notice: string | null;
  normalizedPhone: string | null;
  orderInputRef: React.RefObject<HTMLInputElement | null>;
  onOrderChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  onSubmit: (event?: FormEvent) => void;
}): ReactNode {
  return (
    <div className={cx(CARD, "max-w-[520px] p-7 max-[560px]:p-5")}>
      {notice !== null ? (
        <div
          role="status"
          className="mb-5 rounded-xl border border-[#E8DBC6] bg-[#F5E3C4]/50 px-4 py-3 font-body text-[13.5px] text-[#7a5a1e]"
        >
          {notice}
        </div>
      ) : null}

      <form onSubmit={onSubmit} noValidate>
        {/* Order number */}
        <label
          htmlFor="track-order-number"
          className="mb-2 block font-body text-[13px] font-semibold text-[#5C4B3A]"
        >
          Order number
        </label>
        <input
          id="track-order-number"
          ref={orderInputRef}
          type="text"
          inputMode="text"
          autoCapitalize="characters"
          placeholder="KK-48210"
          value={orderNumberRaw}
          onChange={(e) => onOrderChange(e.target.value)}
          aria-invalid={orderError !== null}
          aria-describedby={orderError !== null ? "track-order-error" : undefined}
          className={cx(
            "w-full rounded-xl border bg-[#F9F3EA] px-4 py-[13px] font-body text-[15px] uppercase text-ink outline-none transition-colors focus:ring-2 focus:ring-gold placeholder:normal-case placeholder:text-[#b3a288]",
            orderError !== null ? "border-danger" : "border-[#E8DBC6]",
          )}
        />
        {orderError !== null ? (
          <p id="track-order-error" role="alert" className="mt-1.5 font-body text-[12.5px] font-medium text-danger">
            {orderError}
          </p>
        ) : null}

        {/* Phone */}
        <label
          htmlFor="track-phone"
          className="mb-2 mt-5 block font-body text-[13px] font-semibold text-[#5C4B3A]"
        >
          Mobile number
        </label>
        <div
          className={cx(
            "flex items-center overflow-hidden rounded-xl border bg-[#F9F3EA] transition-colors focus-within:ring-2 focus-within:ring-gold",
            phoneError !== null ? "border-danger" : "border-[#E8DBC6]",
          )}
        >
          <span className="select-none border-r border-[#E8DBC6] px-4 py-[13px] font-body text-[15px] font-semibold text-espresso">
            +91
          </span>
          <input
            id="track-phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="98765 43210"
            value={phoneRaw}
            onChange={(e) => onPhoneChange(e.target.value)}
            aria-invalid={phoneError !== null}
            aria-describedby={phoneError !== null ? "track-phone-error" : undefined}
            className="w-full bg-transparent px-4 py-[13px] font-body text-[15px] text-ink outline-none placeholder:text-[#b3a288]"
          />
        </div>
        {normalizedPhone !== null && phoneError === null ? (
          <p className="mt-1.5 font-body text-[12.5px] text-[#8a7a68]">
            We'll text a code to {maskPhone(normalizedPhone)}
          </p>
        ) : null}
        {phoneError !== null ? (
          <p id="track-phone-error" role="alert" className="mt-1.5 font-body text-[12.5px] font-medium text-danger">
            {phoneError}
          </p>
        ) : null}

        {rateLimited && rateRemaining > 0 ? (
          <p role="alert" className="mt-4 rounded-xl border border-[#E8DBC6] bg-[#F5E3C4]/50 px-4 py-3 font-body text-[13px] text-[#7a5a1e]">
            Too many attempts — try again in{" "}
            <span className="font-semibold tabular-nums">
              {formatCountdown(rateRemaining)}
            </span>
            .
          </p>
        ) : null}

        {upstreamError ? (
          <div role="alert" className="mt-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3">
            <p className="font-body text-[13px] text-danger">
              We couldn't send the code. Try again in a minute.
            </p>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={requesting || rateRemaining > 0}
          className={cx(
            "mt-6 flex w-full items-center justify-center gap-2 rounded-pill bg-ink px-6 py-[15px] font-body text-[15.5px] font-bold text-card transition-colors hover:bg-[#3f2c1b] disabled:cursor-not-allowed disabled:opacity-60",
            FOCUS_RING,
          )}
        >
          {requesting ? "Sending…" : "Send code"}
        </button>
      </form>
    </div>
  );
}

function OtpCard({
  maskedPhone,
  digits,
  otpError,
  verifying,
  resendRemaining,
  requesting,
  boxRefs,
  onBoxChange,
  onBoxKeyDown,
  onPaste,
  onSubmit,
  onResend,
  onBack,
}: {
  maskedPhone: string;
  digits: string[];
  otpError: string | null;
  verifying: boolean;
  resendRemaining: number;
  requesting: boolean;
  boxRefs: React.MutableRefObject<Array<HTMLInputElement | null>>;
  onBoxChange: (index: number, value: string) => void;
  onBoxKeyDown: (index: number, event: KeyboardEvent<HTMLInputElement>) => void;
  onPaste: (event: ClipboardEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
  onResend: () => void;
  onBack: () => void;
}): ReactNode {
  const complete = digits.join("").length === OTP_LENGTH;
  return (
    <div className={cx(CARD, "max-w-[520px] p-7 max-[560px]:p-5")}>
      <p className="mb-1 font-body text-[14.5px] text-espresso">
        Enter the 6-digit code sent to
      </p>
      <p className="mb-6 font-body text-[15px] font-semibold text-ink">
        {maskedPhone}
      </p>

      <div className="flex justify-between gap-2" role="group" aria-label="One-time passcode">
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
            onChange={(e) => onBoxChange(index, e.target.value)}
            onKeyDown={(e) => onBoxKeyDown(index, e)}
            onPaste={onPaste}
            className={cx(
              "h-[54px] w-full rounded-xl border bg-[#F9F3EA] text-center font-body text-[22px] font-semibold text-ink outline-none transition-colors focus:ring-2 focus:ring-gold disabled:opacity-60",
              otpError !== null ? "border-danger" : "border-[#E8DBC6]",
            )}
          />
        ))}
      </div>

      {otpError !== null ? (
        <p role="alert" className="mt-3 font-body text-[13px] font-medium text-danger">
          {otpError}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onSubmit}
        disabled={verifying || !complete}
        className={cx(
          "mt-6 flex w-full items-center justify-center gap-2 rounded-pill bg-ink px-6 py-[15px] font-body text-[15.5px] font-bold text-card transition-colors hover:bg-[#3f2c1b] disabled:cursor-not-allowed disabled:opacity-60",
          FOCUS_RING,
        )}
      >
        {verifying ? "Verifying…" : "Verify & track"}
      </button>

      <div className="mt-5 text-center font-body text-[13px] text-[#8a7a68]">
        {resendRemaining > 0 ? (
          <span>
            Resend code in{" "}
            <span className="font-semibold tabular-nums text-espresso">
              {formatCountdown(resendRemaining)}
            </span>
          </span>
        ) : (
          <button
            type="button"
            onClick={onResend}
            disabled={requesting}
            className={cx("font-semibold text-espresso underline disabled:opacity-60", FOCUS_RING)}
          >
            {requesting ? "Sending…" : "Resend code"}
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onBack}
        className={cx("mt-4 w-full text-center font-body text-[13.5px] font-semibold text-[#6B5A49]", FOCUS_RING)}
      >
        ← Use a different order
      </button>
    </div>
  );
}

function TrackingSkeleton(): ReactNode {
  return (
    <div className="grid grid-cols-[1.4fr_0.9fr] items-start gap-6 max-[860px]:grid-cols-1" aria-hidden="true">
      <div className={cx(CARD, "p-7")}>
        <div className="mb-6 h-6 w-32 animate-pulse rounded bg-[#F0E4D2]" />
        <div className="flex flex-col gap-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-4">
              <span className="h-6 w-6 flex-none animate-pulse rounded-pill bg-[#F0E4D2]" />
              <div className="flex-1">
                <div className="mb-2 h-4 w-40 animate-pulse rounded bg-[#F0E4D2]" />
                <div className="h-3 w-24 animate-pulse rounded bg-[#F5EEE2]" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <div className={cx(CARD, "h-[220px] animate-pulse")} />
        <div className={cx(CARD, "h-[110px] animate-pulse")} />
      </div>
    </div>
  );
}

function ErrorCard({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}): ReactNode {
  return (
    <div className={cx(CARD, "max-w-[520px] px-6 py-12 text-center")}>
      <div className="mb-2 text-[22px] text-ink" style={SERIF}>
        {message}
      </div>
      <p className="mb-5 font-body text-[14px] text-espresso">
        Double-check the details, or reach out to support if this keeps
        happening.
      </p>
      {onRetry !== undefined ? (
        <button
          type="button"
          onClick={onRetry}
          className={cx(
            "inline-block rounded-pill bg-ink px-[26px] py-[13px] font-body text-[14px] font-semibold text-card transition-colors hover:bg-[#3f2c1b]",
            FOCUS_RING,
          )}
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
