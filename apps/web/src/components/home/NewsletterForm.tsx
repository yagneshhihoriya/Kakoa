"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useToast } from "@kakoa/ui/client";

/**
 * Chocolate Club signup panel (home subscription CTA). Persists the email via
 * `POST /api/newsletter` (idempotent) and toasts the outcome.
 */
export function NewsletterForm(): ReactNode {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

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
        body: JSON.stringify({ email, source: "home" }),
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

  return (
    <div className="relative rounded-[18px] border border-[rgba(233,199,176,.28)] bg-[rgba(251,246,239,.1)] p-6">
      <form onSubmit={(e) => void handleSubmit(e)} aria-label="Join the Chocolate Club">
        <label
          htmlFor="club-email"
          className="mb-2 block text-[13px] text-[#E4D3BC]"
        >
          Get 15% off your first box
        </label>
        <div className="flex gap-2">
          <input
            id="club-email"
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
            className="rounded-pill bg-[#e8c9a0] px-[22px] py-3.5 font-body text-sm font-bold whitespace-nowrap text-ink transition-colors hover:bg-[#f0d6ac] focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-cocoa focus-visible:outline-none disabled:opacity-60"
          >
            {busy ? "Joining…" : "Join"}
          </button>
        </div>
        <div className="mt-2.5 text-xs text-[#B8A88F]">
          No spam, ever. Unsubscribe in one click.
        </div>
      </form>
    </div>
  );
}
