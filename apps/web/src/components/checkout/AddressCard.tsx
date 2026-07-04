"use client";

/**
 * `AddressCard` — a premium saved-address card for the checkout Step-1 picker
 * (smart-address Phase 1). Reuses the visual language of the account Address
 * book: a label chip + "Default" badge, the recipient, a one-line address +
 * PIN, the phone, plus a live serviceability verdict resolved per-card via
 * `GET /api/shipping/serviceability`.
 *
 * Selected state paints an accent ring + check; the whole card is one
 * full-width tap target (≥44px). Unserviceable cards render a "Not deliverable"
 * reason and are visually disabled by the parent (the picker sets `disabled`).
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ApiResult, SavedAddress, ServiceabilityResult } from "@kakoa/core";
import { cx } from "@kakoa/ui";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold";

type Serviceability =
  | { status: "loading" }
  | { status: "serviceable" }
  | { status: "unserviceable" }
  | { status: "unknown" };

function CheckIcon({ className }: { className?: string }): ReactNode {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      aria-hidden="true"
    >
      <path d="M4 12l5 5L20 6" />
    </svg>
  );
}

/** One-line "line1, line2, landmark" summary (drops empty parts). */
function oneLine(a: SavedAddress): string {
  return [a.line1, a.line2, a.landmark].filter((p) => p && p !== "").join(", ");
}

/** Stored phones are E.164 (`+91XXXXXXXXXX`); render as `+91 XXXXX XXXXX`. */
function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "").slice(-10);
  return digits.length === 10
    ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`
    : phone;
}

export interface AddressCardProps {
  address: SavedAddress;
  selected: boolean;
  /** Disabled (e.g. unserviceable) — non-interactive, dimmed. */
  disabled?: boolean;
  onSelect: () => void;
  /** Report the resolved verdict up so the picker can gate selection. */
  onServiceability?: (id: string, serviceable: boolean) => void;
  /** Inline Edit affordance (opens the shared form in the parent). */
  onEdit?: () => void;
}

export function AddressCard({
  address,
  selected,
  disabled = false,
  onSelect,
  onServiceability,
  onEdit,
}: AddressCardProps): ReactNode {
  const [svc, setSvc] = useState<Serviceability>({ status: "loading" });
  const reportRef = useRef(onServiceability);
  reportRef.current = onServiceability;

  useEffect(() => {
    let cancelled = false;
    setSvc({ status: "loading" });
    void (async () => {
      try {
        const response = await fetch(
          `/api/shipping/serviceability?pincode=${encodeURIComponent(address.pincode)}&cod=true`,
          { cache: "no-store" },
        );
        const result =
          (await response.json()) as ApiResult<ServiceabilityResult>;
        if (cancelled) return;
        if (result.ok) {
          const serviceable = result.data.serviceable;
          setSvc({ status: serviceable ? "serviceable" : "unserviceable" });
          reportRef.current?.(address.id, serviceable);
          return;
        }
        if (result.error.code === "PINCODE_UNSERVICEABLE") {
          setSvc({ status: "unserviceable" });
          reportRef.current?.(address.id, false);
          return;
        }
        // Upstream/degraded — treat as unknown but selectable (verified at
        // dispatch), mirroring the Step-1 form's fallback posture.
        setSvc({ status: "unknown" });
        reportRef.current?.(address.id, true);
      } catch {
        if (cancelled) return;
        setSvc({ status: "unknown" });
        reportRef.current?.(address.id, true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address.id, address.pincode]);

  return (
    <div
      className={cx(
        "relative rounded-[18px] border bg-white p-[18px] transition-colors",
        selected
          ? "border-[#8a5a34] ring-2 ring-[#8a5a34]/40"
          : "border-[#EEE1CE]",
        disabled ? "opacity-55" : "",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        aria-pressed={selected}
        className={cx(
          "block w-full min-h-[44px] text-left",
          disabled ? "cursor-not-allowed" : "cursor-pointer",
          FOCUS_RING,
        )}
      >
        <div className="mb-2 flex items-center gap-2">
          <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.1em] text-[#8a5a34]">
            {address.label}
          </span>
          {address.isDefault ? (
            <span className="rounded-pill bg-[#E1EAD0] px-[10px] py-1 font-body text-[11px] font-semibold text-[#5C6B34]">
              Default
            </span>
          ) : null}
          {selected ? (
            <span className="ml-auto grid h-6 w-6 place-items-center rounded-pill bg-[#8a5a34] text-white">
              <CheckIcon />
            </span>
          ) : null}
        </div>

        <div className="font-body text-[15px] leading-[1.55] text-ink">
          <span className="font-semibold">{address.fullName}</span>
          <br />
          {oneLine(address)}
          <br />
          {address.city}, {address.state} {address.pincode}
          <br />
          <span className="text-[#8a7a68]">{formatPhone(address.phone)}</span>
        </div>

        {/* Serviceability verdict */}
        <div className="mt-3">
          {svc.status === "loading" ? (
            <span className="font-body text-[12.5px] text-[#8a7a68]">
              Checking delivery…
            </span>
          ) : svc.status === "serviceable" ? (
            <span className="inline-flex items-center gap-1.5 font-body text-[12.5px] font-medium text-[#5f6d3a]">
              <CheckIcon className="text-[#7C8A4E]" />
              Deliverable
            </span>
          ) : svc.status === "unserviceable" ? (
            <span className="font-body text-[12.5px] font-medium text-danger">
              Not deliverable to {address.pincode}
            </span>
          ) : (
            <span className="font-body text-[12.5px] text-[#7a5a1e]">
              Delivery confirmed at dispatch
            </span>
          )}
        </div>
      </button>

      {onEdit !== undefined ? (
        <button
          type="button"
          onClick={onEdit}
          className={cx(
            "absolute right-[18px] top-[18px] font-body text-[13px] font-semibold text-espresso underline",
            FOCUS_RING,
          )}
        >
          Edit
        </button>
      ) : null}
    </div>
  );
}
