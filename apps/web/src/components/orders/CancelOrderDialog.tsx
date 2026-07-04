"use client";

/**
 * Cancel-order confirmation dialog (order-tracking.md §1.4 / §5.4). Collects a
 * 3–500 grapheme `reason`, POSTs the cancel via the parent-provided handler,
 * and surfaces the two settled error states:
 *   - 422 `INVALID_TRANSITION` → "already packed, contact support" (blocking)
 *   - anything else            → inline error, retry allowed
 *
 * The caller owns the credential + the resulting `OrderSummary`; this dialog
 * only reports success (via `onCancelled`) so the parent can re-render the
 * timeline with the `cancelled` step. Focus-trapped modal matching the account
 * DeleteAddressDialog conventions.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  CANCEL_REASON_MAX,
  CANCEL_REASON_MIN,
  cancelOrderSchema,
  countGraphemes,
  type ApiResult,
  type OrderSummary,
} from "@kakoa/core";
import { cx } from "@kakoa/ui";

const SERIF = { fontFamily: "var(--font-display), serif" } as const;
const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold";

export interface CancelOrderDialogProps {
  orderNumber: string;
  /** Performs the cancel with whatever credential the parent holds. */
  onSubmit: (reason: string) => Promise<ApiResult<{ order: OrderSummary }>>;
  /** Called with the cancelled order on a 200 — parent re-renders the timeline. */
  onCancelled: (order: OrderSummary) => void;
  onClose: () => void;
}

export function CancelOrderDialog({
  orderNumber,
  onSubmit,
  onCancelled,
  onClose,
}: CancelOrderDialogProps): ReactNode {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const graphemeCount = useMemo(() => countGraphemes(reason.trim()), [reason]);
  const withinBounds =
    graphemeCount >= CANCEL_REASON_MIN && graphemeCount <= CANCEL_REASON_MAX;
  const overLimit = graphemeCount > CANCEL_REASON_MAX;

  // Focus the textarea on mount; restore prior focus on unmount.
  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const raf = requestAnimationFrame(() => textareaRef.current?.focus());
    return () => {
      cancelAnimationFrame(raf);
      previous?.focus();
    };
  }, []);

  // Body scroll lock.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // ESC to close + Tab focus trap.
  useEffect(() => {
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
          'a[href], button:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusables.length === 0) return;
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
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const submit = useCallback(async (): Promise<void> => {
    if (submitting || blocked) return;
    setError(null);

    // Client-side validation mirrors the contract (server is authoritative).
    const parsed = cancelOrderSchema.safeParse({ reason });
    if (!parsed.success) {
      setError(
        parsed.error.issues[0]?.message ??
          `Tell us why in ${CANCEL_REASON_MIN}–${CANCEL_REASON_MAX} characters.`,
      );
      return;
    }

    setSubmitting(true);
    try {
      const result = await onSubmit(parsed.data.reason);
      if (result.ok) {
        onCancelled(result.data.order);
        return;
      }
      switch (result.error.code) {
        case "INVALID_TRANSITION":
          // Order already packed / terminal — a blocking, settled state.
          setBlocked(true);
          break;
        case "TOKEN_EXPIRED":
        case "UNAUTHORIZED":
          setError(
            "Your session expired. Verify again with OTP to cancel this order.",
          );
          break;
        case "VALIDATION_ERROR":
          setError(
            result.error.fieldErrors?.reason?.[0] ?? result.error.message,
          );
          break;
        default:
          setError(result.error.message);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [blocked, onCancelled, onSubmit, reason, submitting]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 px-4 backdrop-blur-[2px]">
      <button
        type="button"
        aria-label="Close"
        onClick={() => onCloseRef.current()}
        className="absolute inset-0 cursor-default"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-order-title"
        tabIndex={-1}
        className="relative w-full max-w-[460px] rounded-[22px] bg-card p-6 shadow-[0_30px_70px_rgba(42,29,18,.3)] focus-visible:outline-none"
      >
        {blocked ? (
          <>
            <h2
              id="cancel-order-title"
              className="mb-2 text-[22px] text-ink"
              style={SERIF}
            >
              This order can't be cancelled online
            </h2>
            <p className="mb-5 font-body text-[14px] leading-relaxed text-espresso">
              Order <span className="font-semibold text-ink">#{orderNumber}</span>{" "}
              is already packed and on its way into fulfilment, so it can't be
              cancelled here. Our support team can still help — reach out and
              we'll sort it out.
            </p>
            <div className="flex justify-end gap-3">
              <a
                href="mailto:hello@kakoa.in"
                className={cx(
                  "rounded-pill border-[1.5px] border-[#E0CFB6] bg-transparent px-[22px] py-3 font-body text-[14px] font-bold text-ink no-underline transition-colors hover:bg-[#F3E7D5]",
                  FOCUS_RING,
                )}
              >
                Contact support
              </a>
              <button
                type="button"
                onClick={() => onCloseRef.current()}
                className={cx(
                  "rounded-pill bg-ink px-[22px] py-3 font-body text-[14px] font-bold text-card transition-colors hover:bg-[#3f2c1b]",
                  FOCUS_RING,
                )}
              >
                Got it
              </button>
            </div>
          </>
        ) : (
          <>
            <h2
              id="cancel-order-title"
              className="mb-2 text-[22px] text-ink"
              style={SERIF}
            >
              Cancel this order?
            </h2>
            <p className="mb-4 font-body text-[14px] leading-relaxed text-espresso">
              Tell us why you're cancelling{" "}
              <span className="font-semibold text-ink">#{orderNumber}</span>.
              We'll refund your original payment method automatically — it
              usually reaches you within 5–7 business days.
            </p>

            <label
              htmlFor="cancel-reason"
              className="mb-2 block font-body text-[13px] font-semibold text-[#5C4B3A]"
            >
              Reason for cancelling
            </label>
            <textarea
              id="cancel-reason"
              ref={textareaRef}
              value={reason}
              rows={4}
              maxLength={CANCEL_REASON_MAX * 4}
              onChange={(event) => {
                setReason(event.target.value);
                setError(null);
              }}
              aria-invalid={error !== null}
              aria-describedby="cancel-reason-help"
              placeholder="e.g. Ordered the wrong flavour, changed my mind…"
              className={cx(
                "w-full resize-none rounded-xl border bg-[#F9F3EA] px-4 py-3 font-body text-[14.5px] text-ink outline-none transition-colors focus:ring-2 focus:ring-gold",
                error !== null || overLimit ? "border-danger" : "border-[#E8DBC6]",
              )}
            />

            <div
              id="cancel-reason-help"
              className="mt-1.5 flex items-center justify-between gap-3"
            >
              <span
                role={error !== null ? "alert" : undefined}
                className={cx(
                  "font-body text-[12.5px]",
                  error !== null ? "font-medium text-danger" : "text-[#8a7a68]",
                )}
              >
                {error ?? `At least ${CANCEL_REASON_MIN} characters.`}
              </span>
              <span
                className={cx(
                  "flex-none font-mono text-[11.5px] tabular-nums",
                  overLimit ? "text-danger" : "text-[#a08a72]",
                )}
              >
                {graphemeCount}/{CANCEL_REASON_MAX}
              </span>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => onCloseRef.current()}
                disabled={submitting}
                className={cx(
                  "rounded-pill border-[1.5px] border-[#E0CFB6] bg-transparent px-[22px] py-3 font-body text-[14px] font-bold text-ink transition-colors hover:bg-[#F3E7D5] disabled:opacity-60",
                  FOCUS_RING,
                )}
              >
                Keep order
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={submitting || !withinBounds}
                className={cx(
                  "flex-1 rounded-pill bg-raspberry px-6 py-3 font-body text-[14px] font-bold text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60",
                  FOCUS_RING,
                )}
              >
                {submitting ? "Cancelling…" : "Cancel order"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
