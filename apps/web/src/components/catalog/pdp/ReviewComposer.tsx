"use client";

import { useState, type ReactNode } from "react";
import { useAuthOptional } from "@/components/auth/AuthProvider";

interface Eligibility {
  signedIn: boolean;
  canReview: boolean;
  alreadyReviewed: boolean;
}

/**
 * "Write a review" flow for verified buyers. Opens on demand, resolves the
 * signed-in customer's eligibility (GET /api/reviews/eligibility), and — when
 * they have an unreviewed purchase — shows the rating/title/body form that POSTs
 * to /api/reviews. Submitted reviews are held for moderation.
 */
export function ReviewComposer({ productId }: { productId: string }): ReactNode {
  const auth = useAuthOptional();
  const [open, setOpen] = useState(false);
  const [elig, setElig] = useState<Eligibility | null>(null);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(): Promise<void> {
    if (auth?.customer == null) {
      auth?.open("review");
      return;
    }
    setOpen(true);
    setError(null);
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
      } else {
        setError(data.error?.message ?? "Couldn't submit your review.");
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => void start()}
        className="mt-5 rounded-pill bg-ink px-[22px] py-3 font-body text-sm font-bold text-card transition-colors hover:bg-[#3f2c1b]"
      >
        Write a review
      </button>
    );
  }

  if (done) {
    return (
      <p className="mt-5 rounded-[14px] border border-[#dcead0] bg-[#f0f5e8] px-4 py-3 font-body text-[13.5px] text-[#4b6b34]">
        Thanks! Your review has been submitted and will appear once it's approved.
      </p>
    );
  }

  const box = "mt-5 rounded-[16px] border border-[#EEE1CE] bg-white p-5";

  if (elig === null) {
    return <p className={`${box} font-body text-[13.5px] text-[#6B5A49]`}>Loading…</p>;
  }
  if (!elig.signedIn) {
    return (
      <div className={box}>
        <p className="font-body text-[13.5px] text-[#4C3B2A]">Please sign in to write a review.</p>
        <button
          type="button"
          onClick={() => auth?.open("review")}
          className="mt-3 rounded-pill bg-ink px-5 py-2.5 font-body text-[13px] font-bold text-card"
        >
          Sign in
        </button>
      </div>
    );
  }
  if (elig.alreadyReviewed) {
    return <p className={`${box} font-body text-[13.5px] text-[#4C3B2A]`}>You've already reviewed this product. Thank you!</p>;
  }
  if (!elig.canReview) {
    return (
      <p className={`${box} font-body text-[13.5px] text-[#4C3B2A]`}>
        Reviews are for verified buyers — you can write one once you've ordered and received this product.
      </p>
    );
  }

  return (
    <div className={box}>
      <div className="mb-3">
        <span className="mb-1 block font-body text-[12.5px] font-semibold text-ink">Your rating</span>
        <div className="flex gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              onClick={() => setRating(n)}
              className={"text-[26px] leading-none " + (n <= rating ? "text-[#c69a4c]" : "text-[#e0d4c0]")}
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
        className="mb-2 w-full rounded-lg border border-[#eadbc6] bg-white px-3 py-2 font-body text-[14px] outline-none focus:border-[#c69a4c]"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        maxLength={2000}
        placeholder="Tell others what you thought (min 10 characters)…"
        className="w-full rounded-lg border border-[#eadbc6] bg-white px-3 py-2 font-body text-[14px] outline-none focus:border-[#c69a4c]"
      />
      {error !== null ? <p className="mt-2 font-body text-[12.5px] text-[#b25b5b]">{error}</p> : null}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="rounded-pill bg-ink px-5 py-2.5 font-body text-[13px] font-bold text-card disabled:opacity-60"
        >
          {busy ? "Submitting…" : "Submit review"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-pill px-4 py-2.5 font-body text-[13px] font-semibold text-espresso">
          Cancel
        </button>
      </div>
    </div>
  );
}
