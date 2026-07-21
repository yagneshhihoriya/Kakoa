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

/**
 * Newsletter signup (footer "Sweeten your inbox" band). Persists the email via
 * `POST /api/newsletter` (idempotent) and toasts the outcome. The input id is
 * per-instance (`useId`) so multiple forms can coexist on one page.
 */
export function NewsletterForm({ variant = "card" }: NewsletterFormProps): ReactNode {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const emailId = useId();
  const bare = variant === "bare";

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget;
    const email = new FormData(form).get("email");
    if (typeof email !== "string" || email.trim() === "") return;
    setBusy(true);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, source: bare ? "footer" : "home" }),
      });
      const data = await res.json();
      if (data.ok) {
        toast({ kind: "success", message: "Welcome to the Club! Check your inbox." });
        form.reset();
      } else {
        toast({ kind: "error", message: data.error?.message ?? "Enter a valid email address." });
      }
    } catch {
      toast({ kind: "error", message: "Network error — please try again." });
    } finally {
      setBusy(false);
    }
  }

  const form = (
    <form onSubmit={(e) => void handleSubmit(e)} aria-label="Join the newsletter">
      {bare ? null : (
        <label htmlFor={emailId} className="mb-2 block text-[13px] text-[#E4D3BC]">
          Get 15% off your first box
        </label>
      )}
      <div className="flex gap-2">
        <input
          id={emailId}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@email.com"
          className="min-w-0 flex-1 rounded-pill border-none bg-cream px-[18px] py-3.5 font-body text-sm font-medium text-ink outline-none placeholder:text-espresso/60 focus-visible:ring-2 focus-visible:ring-gold"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-pill bg-gold-soft px-[22px] py-3.5 font-body text-sm font-bold whitespace-nowrap text-ink transition-colors hover:bg-[#f0d6ac] focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-cocoa focus-visible:outline-none disabled:opacity-60"
        >
          {busy ? "Joining…" : "Join"}
        </button>
      </div>
      <div className={cx("mt-2.5 text-xs text-[#B8A88F]", bare && "text-center")}>
        No spam, ever. Unsubscribe in one click.
      </div>
    </form>
  );

  if (bare) return form;

  return (
    <div className="relative rounded-[18px] border border-[rgba(233,199,176,.28)] bg-[rgba(251,246,239,.1)] p-6">
      {form}
    </div>
  );
}
