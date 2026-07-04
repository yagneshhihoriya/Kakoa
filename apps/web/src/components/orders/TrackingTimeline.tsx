/**
 * Vertical order-tracking timeline (order-tracking.md §3, prototype
 * 73-tracking.html). Renders the `TimelineStep[]` the tracking read derives
 * from `order_status_history`: a rail of dots + labels + IST timestamps.
 *
 * Dot states mirror the contract's `TimelineStepState`:
 *   - `done`   → filled disc with a check
 *   - `active` → filled disc with a soft pulsing halo (the order's live step)
 *   - `future` → hollow ring
 *
 * The cancelled / RTO branch rails already come pre-shaped from the server
 * (the delivery tail is replaced upstream); this component only styles them —
 * a `cancelled` step reads danger-toned, `rto_initiated` shows the honest
 * "Returning to seller" copy. Timestamps are ISO-UTC on the wire and rendered
 * exclusively client-side via `formatIST` (never a server-formatted string),
 * so the IST boundary stays correct. Mobile-first; no interactivity, so this
 * is a plain (server-safe) component.
 */
import type { ReactNode } from "react";
import { formatIST, type TimelineStep, type TimelineStepKey } from "@kakoa/core";
import { cx } from "@kakoa/ui";

/** Keys that render on the danger-toned (unhappy) branch. */
const BRANCH_KEYS: ReadonlySet<TimelineStepKey> = new Set<TimelineStepKey>([
  "cancelled",
  "rto_initiated",
  "rto_delivered",
]);

/** Sub-copy shown under a branch step's label. */
const BRANCH_SUBLABEL: Partial<Record<TimelineStepKey, string>> = {
  cancelled: "This order was cancelled.",
  rto_initiated: "Returning to seller.",
  rto_delivered: "Returned to seller.",
};

/** Future-step hint copy (pre-AWB honesty — never a fake "shipped"). */
const FUTURE_SUBLABEL: Partial<Record<TimelineStepKey, string>> = {
  confirmed: "We'll confirm your order shortly.",
  packed: "Preparing your shipment.",
  shipped: "Not shipped yet.",
  out_for_delivery: "",
  delivered: "",
};

export interface TrackingTimelineProps {
  steps: TimelineStep[];
  /** Extra classes for the outer list wrapper. */
  className?: string;
}

/** Safe IST render — a malformed `at` degrades to no date rather than throwing. */
function safeIST(iso: string | null): string | null {
  if (iso === null) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return formatIST(date);
}

export function TrackingTimeline({
  steps,
  className,
}: TrackingTimelineProps): ReactNode {
  if (steps.length === 0) {
    return (
      <p className="font-body text-[14px] text-[#8a7a68]">
        Timeline details will appear here as your order progresses.
      </p>
    );
  }

  return (
    <ol className={cx("m-0 list-none p-0", className)}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const isBranch = BRANCH_KEYS.has(step.key);
        const at = safeIST(step.at);
        const expected = safeIST(step.expected);

        return (
          <li key={step.key} className="flex gap-4">
            {/* Rail: dot + connector */}
            <div className="flex flex-none flex-col items-center">
              <Dot state={step.state} isBranch={isBranch} />
              {!isLast ? (
                <span
                  aria-hidden="true"
                  className={cx(
                    "w-[2px] flex-1 min-h-[36px]",
                    step.state === "done" && !isBranch
                      ? "bg-[#7C8A4E]"
                      : isBranch && step.state !== "future"
                        ? "bg-[#E0B9B0]"
                        : "bg-[#EADBC6]",
                  )}
                />
              ) : null}
            </div>

            {/* Label + timestamp */}
            <div className="min-w-0 flex-1 pb-6">
              <div
                className={cx(
                  "font-body text-[15.5px] font-semibold leading-tight",
                  step.state === "future"
                    ? "text-[#a08a72]"
                    : isBranch
                      ? "text-raspberry"
                      : "text-ink",
                )}
              >
                {step.label}
                {step.state === "active" && !isBranch ? (
                  <span className="ml-2 align-middle font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[#5f6d3a]">
                    Now
                  </span>
                ) : null}
              </div>

              <div className="mt-1 font-body text-[13px] text-[#8a7a68]">
                {at !== null ? (
                  at
                ) : expected !== null ? (
                  <span className="text-[#7C8A4E]">Expected {expected}</span>
                ) : (
                  (isBranch ? BRANCH_SUBLABEL[step.key] : undefined) ??
                  FUTURE_SUBLABEL[step.key] ??
                  ""
                )}
              </div>

              {/* Branch sub-copy even when a timestamp is present. */}
              {isBranch && at !== null && BRANCH_SUBLABEL[step.key] ? (
                <div className="mt-0.5 font-body text-[12.5px] text-raspberry/80">
                  {BRANCH_SUBLABEL[step.key]}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** A single timeline dot, styled by state. */
function Dot({
  state,
  isBranch,
}: {
  state: TimelineStep["state"];
  isBranch: boolean;
}): ReactNode {
  if (state === "future") {
    return (
      <span
        aria-hidden="true"
        className="grid h-6 w-6 place-items-center rounded-pill border-2 border-[#E0CFB6] bg-cream"
      />
    );
  }

  if (state === "active" && !isBranch) {
    return (
      <span className="relative grid h-6 w-6 flex-none place-items-center">
        <span
          aria-hidden="true"
          className="absolute inset-0 animate-ping rounded-pill bg-[#7C8A4E]/40"
        />
        <span
          aria-hidden="true"
          className="relative grid h-6 w-6 place-items-center rounded-pill bg-[#7C8A4E] text-card"
        >
          <span className="h-2 w-2 rounded-pill bg-card" />
        </span>
      </span>
    );
  }

  // done, or a branch (cancelled / rto) node
  return (
    <span
      aria-hidden="true"
      className={cx(
        "grid h-6 w-6 flex-none place-items-center rounded-pill text-card",
        isBranch ? "bg-raspberry" : "bg-[#7C8A4E]",
      )}
    >
      {isBranch ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M6 6l12 12M18 6L6 18"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 12l5 5L20 6"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  );
}
