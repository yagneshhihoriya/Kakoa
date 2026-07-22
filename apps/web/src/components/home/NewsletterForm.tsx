"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { cx } from "@kakoa/ui";
import { useToast } from "@kakoa/ui/client";

export interface NewsletterFormProps {
  /**
   * `card` (default) — bordered dark panel used by the home Chocolate-Club CTA.
   * `bare` — no card chrome; a centered input + button row for the footer band.
   */
  variant?: "card" | "bare";
}

type Status = "idle" | "busy" | "success" | "error";

/** Small check mark for the in-place success confirmation. */
function CheckIcon(): ReactNode {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="flex-none"
    >
      <path d="M5 12l4.5 4.5L19 7" />
    </svg>
  );
}

/**
 * Newsletter signup (footer "Sweeten your inbox" band). Persists the email via
 * `POST /api/newsletter` (idempotent). Feedback is inline and persistent — an
 * idle → busy → success/error state machine rendered in the form — with a toast
 * kept only as a secondary cue, so the outcome survives after the toast fades
 * and is announced to screen readers. The input id is per-instance (`useId`).
 */
export function NewsletterForm({ variant = "card" }: NewsletterFormProps): ReactNode {
  const { toast } = useToast();
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const emailId = useId();
  const msgId = useId();
  const bare = variant === "bare";
  const busy = status === "busy";

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget;
    const email = new FormData(form).get("email");
    if (typeof email !== "string" || email.trim() === "") return;
    setStatus("busy");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, source: bare ? "footer" : "home" }),
      });
      const data = await res.json();
      if (data.ok) {
        setStatus("success");
        toast({ kind: "success", message: "Welcome to the Club! Check your inbox." });
        form.reset();
      } else {
        const message = data.error?.message ?? "Enter a valid email address.";
        setStatus("error");
        setErrorMsg(message);
        toast({ kind: "error", message });
      }
    } catch {
      const message = "Network error — please try again.";
      setStatus("error");
      setErrorMsg(message);
      toast({ kind: "error", message });
    }
  }

  const form = (
    <form onSubmit={(e) => void handleSubmit(e)} aria-label="Join the newsletter">
      {bare ? (
        <label htmlFor={emailId} className="sr-only">
          Email address
        </label>
      ) : (
        <label htmlFor={emailId} className="mb-2 block text-[13px] text-cream/85">
          Get 15% off your first box
        </label>
      )}

      {status === "success" ? (
        <p
          role="status"
          aria-live="polite"
          className="flex items-center justify-center gap-2.5 rounded-pill bg-cream/[0.1] px-5 py-3.5 font-body text-sm font-semibold text-cream"
        >
          <span className="text-gold-soft">
            <CheckIcon />
          </span>
          You&rsquo;re in — check your inbox for 15% off.
        </p>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              id={emailId}
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@email.com"
              aria-invalid={status === "error"}
              aria-describedby={status === "error" ? msgId : undefined}
              className="min-w-0 flex-1 rounded-pill border-none bg-cream px-[18px] py-3.5 font-body text-sm font-medium text-ink outline-none placeholder:text-espresso/60 focus-visible:ring-2 focus-visible:ring-gold"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-pill bg-gold-soft px-[22px] py-3.5 font-body text-sm font-bold whitespace-nowrap text-ink transition-colors hover:bg-gold focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-cocoa focus-visible:outline-none disabled:opacity-60"
            >
              {busy ? "Joining…" : "Join"}
            </button>
          </div>
          {status === "error" ? (
            <p
              id={msgId}
              role="alert"
              className={cx(
                "mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-gold-soft",
                bare && "justify-center",
              )}
            >
              <span aria-hidden="true">⚠</span>
              {errorMsg}
            </p>
          ) : (
            <div className={cx("mt-2.5 text-xs text-cream/55", bare && "text-center")}>
              No spam, ever. Unsubscribe in one click.
            </div>
          )}
        </>
      )}
    </form>
  );

  if (bare) return form;

  return (
    <div className="relative rounded-[18px] border border-cream/20 bg-cream/[0.06] p-6">
      {form}
    </div>
  );
}
