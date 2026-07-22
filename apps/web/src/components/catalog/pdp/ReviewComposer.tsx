"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useAuthOptional } from "@/components/auth/AuthProvider";

interface Eligibility {
  signedIn: boolean;
  canReview: boolean;
  alreadyReviewed: boolean;
}

const DEFAULT_TRIGGER =
  "rounded-pill bg-ink px-[22px] py-3 font-body text-sm font-bold text-card transition-colors hover:bg-ink-hover " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-cream";

/**
 * "Write a review" flow for verified buyers. The trigger button is fully
 * styleable via `triggerClassName` (so callers can place a gold CTA in the
 * reviews summary or empty state); the form itself opens in an accessible modal
 * dialog. Logic is unchanged: it resolves the signed-in customer's eligibility
 * (GET /api/reviews/eligibility) and, when they have an unreviewed purchase,
 * POSTs the rating/title/body to /api/reviews. Reviews publish immediately, so
 * on success it refreshes the page to surface the new review.
 */
export function ReviewComposer({
  productId,
  triggerLabel = "Write a review",
  triggerClassName,
}: {
  productId: string;
  triggerLabel?: string;
  triggerClassName?: string;
}): ReactNode {
  const auth = useAuthOptional();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [elig, setElig] = useState<Eligibility | null>(null);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const starsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const doneRef = useRef(done);
  const titleId = useId();

  useEffect(() => setMounted(true), []);
  // Mirror `done` into a ref so the Escape handler (whose closure is frozen on
  // the render where the modal opened) always resets from the current state.
  useEffect(() => {
    doneRef.current = done;
  }, [done]);

  // Escape-to-close, Tab focus-trap, body scroll lock, and focus restoration
  // while the modal is open.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (panel === null) return;
      const nodes = panel.querySelectorAll<HTMLElement>(
        'a[href], button, textarea, input, select, [tabindex]',
      );
      const focusables = Array.from(nodes).filter(
        (el) => !el.hasAttribute("disabled") && el.tabIndex >= 0 && el.offsetParent !== null,
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !panel.contains(active)) {
          e.preventDefault();
          last?.focus();
        }
      } else if (active === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [open]);

  function close(): void {
    setOpen(false);
    setError(null);
    if (doneRef.current) {
      setDone(false);
      setElig(null);
      setRating(0);
      setTitle("");
      setBody("");
    }
  }

  async function start(): Promise<void> {
    if (auth?.customer == null) {
      auth?.open("review");
      return;
    }
    setOpen(true);
    setError(null);
    if (elig !== null) return;
    try {
      const res = await fetch(`/api/reviews/eligibility?productId=${encodeURIComponent(productId)}`);
      const data = await res.json();
      if (data.ok) setElig(data.data as Eligibility);
    } catch {
      setError("Couldn't load the review form. Try again.");
    }
  }

  async function submit(): Promise<void> {
    setError(null);
    if (rating < 1) {
      setError("Please choose a star rating.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId, rating, title, body }),
      });
      const data = await res.json();
      if (data.ok) {
        setDone(true);
        // Review publishes immediately — re-fetch the PDP so it appears in the
        // list (and the rating updates) without a manual reload.
        router.refresh();
      } else {
        setError(data.error?.message ?? "Couldn't submit your review.");
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  const trigger = (
    <button type="button" onClick={() => void start()} className={triggerClassName ?? DEFAULT_TRIGGER}>
      {triggerLabel}
    </button>
  );

  function modalBody(): ReactNode {
    if (done) {
      return (
        <p className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 font-body text-[13.5px] text-pistachio-deep">
          Thanks! Your review is now live on this page.
        </p>
      );
    }
    if (elig === null) {
      return <p className="font-body text-[13.5px] text-ink-soft">Loading…</p>;
    }
    if (!elig.signedIn) {
      return (
        <div>
          <p className="font-body text-[13.5px] text-ink">Please sign in to write a review.</p>
          <button
            type="button"
            onClick={() => {
              close();
              auth?.open("review");
            }}
            className="mt-3 rounded-pill bg-ink px-5 py-2.5 font-body text-[13px] font-bold text-card"
          >
            Sign in
          </button>
        </div>
      );
    }
    if (elig.alreadyReviewed) {
      return <p className="font-body text-[13.5px] text-ink">You&apos;ve already reviewed this product. Thank you!</p>;
    }
    if (!elig.canReview) {
      return (
        <p className="font-body text-[13.5px] text-ink">
          Reviews are for verified buyers — you can write one once you&apos;ve ordered and received this product.
        </p>
      );
    }
    return (
      <div>
        <div className="mb-3">
          <span className="mb-1 block font-body text-[12.5px] font-semibold text-ink">Your rating</span>
          <div className="flex gap-1" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n, i) => (
              <button
                key={n}
                ref={(el) => {
                  starsRef.current[i] = el;
                }}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} star${n === 1 ? "" : "s"}`}
                tabIndex={rating === n || (rating === 0 && n === 1) ? 0 : -1}
                onClick={() => setRating(n)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight" || e.key === "ArrowUp") {
                    e.preventDefault();
                    const next = Math.min(5, (rating || 1) + 1);
                    setRating(next);
                    starsRef.current[next - 1]?.focus();
                  } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
                    e.preventDefault();
                    const prev = Math.max(1, (rating || 1) - 1);
                    setRating(prev);
                    starsRef.current[prev - 1]?.focus();
                  }
                }}
                className={"text-[28px] leading-none transition-colors " + (n <= rating ? "text-gold" : "text-line")}
              >
                ★
              </button>
            ))}
          </div>
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="Title (optional)"
          className="mb-2 w-full rounded-lg border border-line bg-cream px-3 py-2 font-body text-[14px] text-ink outline-none transition-colors focus:border-gold"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="Tell others what you thought (min 10 characters)…"
          className="w-full resize-none rounded-lg border border-line bg-cream px-3 py-2 font-body text-[14px] text-ink outline-none transition-colors focus:border-gold"
        />
        {error !== null ? <p className="mt-2 font-body text-[12.5px] text-danger">{error}</p> : null}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="rounded-pill bg-ink px-5 py-2.5 font-body text-[13px] font-bold text-card transition-colors hover:bg-ink-hover disabled:opacity-60"
          >
            {busy ? "Submitting…" : "Submit review"}
          </button>
          <button type="button" onClick={close} className="rounded-pill px-4 py-2.5 font-body text-[13px] font-semibold text-espresso">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {trigger}
      {mounted && open
        ? createPortal(
            <div
              className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center sm:p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
            >
              <button
                type="button"
                aria-label="Close review form"
                tabIndex={-1}
                onClick={close}
                className="absolute inset-0 cursor-default bg-ink/50 backdrop-blur-[2px] motion-safe:animate-[kk-overlay_.2s_var(--ease-entrance)]"
              />
              <div
                ref={panelRef}
                tabIndex={-1}
                className="relative z-10 w-full max-w-[460px] rounded-t-[22px] bg-surface p-6 shadow-float outline-none motion-safe:animate-[kk-rise_.28s_var(--ease-entrance)] sm:rounded-[22px]"
              >
                <div className="mb-4 flex items-center justify-between">
                  <h3 id={titleId} className="font-display text-[22px] leading-none text-ink">
                    Write a review
                  </h3>
                  <button
                    type="button"
                    onClick={close}
                    aria-label="Close"
                    className="flex h-8 w-8 items-center justify-center rounded-pill text-ink-muted transition-colors hover:bg-card hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>
                {modalBody()}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
