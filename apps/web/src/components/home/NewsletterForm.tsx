"use client";

import type { FormEvent, ReactNode } from "react";
import { useToast } from "@kakoa/ui/client";

/**
 * Chocolate Club signup panel (home subscription CTA, right column).
 * Prototype behaviour: submitting fires a success toast — the mailing-list
 * backend lands with the Content/SEO module, so nothing is persisted yet.
 */
export function NewsletterForm(): ReactNode {
  const { toast } = useToast();

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    toast({ kind: "success", message: "Welcome to the Club! Check your inbox." });
    event.currentTarget.reset();
  }

  return (
    <div className="relative rounded-[18px] border border-[rgba(233,199,176,.28)] bg-[rgba(251,246,239,.1)] p-6">
      <form onSubmit={handleSubmit} aria-label="Join the Chocolate Club">
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
            className="rounded-pill bg-[#e8c9a0] px-[22px] py-3.5 font-body text-sm font-bold whitespace-nowrap text-ink transition-colors hover:bg-[#f0d6ac] focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-cocoa focus-visible:outline-none"
          >
            Join
          </button>
        </div>
        <div className="mt-2.5 text-xs text-[#B8A88F]">
          No spam, ever. Unsubscribe in one click.
        </div>
      </form>
    </div>
  );
}
