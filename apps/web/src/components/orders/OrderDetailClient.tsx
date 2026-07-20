"use client";

/**
 * Client half of the logged-in order-detail page. Ownership was already proven
 * server-side, so the credential here is the implicit `session` (the
 * `kakoa_session` cookie rides along automatically on the tracking/cancel
 * fetches). Fetches the tracking read on mount, renders the shared
 * `OrderTrackingView` with the item list slotted in, and hosts the cancel
 * dialog (session credential CAN cancel).
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  formatPaise,
  type OrderSummary,
  type OrderTracking,
} from "@kakoa/core";
import { cx } from "@kakoa/ui";
import { useToast } from "@kakoa/ui/client";
import { OrderTrackingView } from "./OrderTrackingView";
import { CancelOrderDialog } from "./CancelOrderDialog";
import { useTracking, type TrackingCredential } from "./useTracking";
import type { OrderDetailItem } from "@/lib/orders/order-detail-data";

const SERIF = { fontFamily: "var(--font-display), serif" } as const;
const CARD = "rounded-[18px] border border-[#EEE1CE] bg-white";

const SESSION_CREDENTIAL: TrackingCredential = { kind: "session" };

export interface OrderDetailClientProps {
  orderNumber: string;
  items: OrderDetailItem[];
  invoiceAvailable: boolean;
}

export function OrderDetailClient({
  orderNumber,
  items,
  invoiceAvailable,
}: OrderDetailClientProps): ReactNode {
  const { fetchTracking, cancelOrder } = useTracking();
  const { toast } = useToast();

  const [tracking, setTracking] = useState<OrderTracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    const result = await fetchTracking(orderNumber, SESSION_CREDENTIAL);
    setLoading(false);
    if (result.ok) {
      setTracking(result.data);
      return;
    }
    setError(
      result.error.code === "NOT_FOUND"
        ? "We couldn't load this order right now."
        : result.error.message,
    );
  }, [fetchTracking, orderNumber]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCancelled = useCallback(
    (order: OrderSummary): void => {
      setCancelOpen(false);
      toast({ kind: "success", message: "Order cancelled." });
      setTracking((current) =>
        current !== null ? { ...current, order } : current,
      );
      void load();
    },
    [load, toast],
  );

  const itemsSlot = (
    <div className="mb-6 border-b border-[#EEE1CE] pb-6">
      <div className="mb-3 font-mono text-[12px] font-semibold uppercase tracking-[0.1em] text-[#8a5a34]">
        Items
      </div>
      <div className="flex flex-col gap-2.5">
        {items.map((item) => (
          <div key={item.id} className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-body text-[14.5px] font-semibold text-ink">
                {item.productName}
              </div>
              <div className="font-body text-[12.5px] text-[#8a7a68]">
                {item.variantName} · Qty {item.quantity}
                {item.giftWrap ? " · Gift-wrapped" : ""}
              </div>
            </div>
            <span className="flex-none font-body text-[14px] font-bold tabular-nums text-ink">
              {formatPaise(item.lineTotalPaise)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <main className="mx-auto max-w-[960px] px-8 pb-[72px] pt-8 max-[560px]:px-5">
      <div className="mb-6 font-body text-[13px] text-[#8a7a68]">
        <Link href="/account" className="text-[#8a7a68] hover:text-ink">
          Account
        </Link>{" "}
        / <span className="text-ink">Order #{orderNumber}</span>
      </div>

      <h1
        className="mb-8 text-[38px] leading-none text-ink max-[560px]:text-[30px]"
        style={SERIF}
      >
        Order #{orderNumber}
      </h1>

      {invoiceAvailable ? (
        <div className={cx(CARD, "mb-6 flex flex-wrap items-center justify-between gap-3 p-5")}>
          <div>
            <div className="font-body text-[15px] font-semibold text-ink">Tax invoice</div>
            <div className="font-body text-[13px] text-[#8a7a68]">View your GST invoice — download the PDF from there.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/account/orders/${orderNumber}/invoice` as Route}
              className="rounded-pill bg-ink px-[18px] py-2 font-body text-[13px] font-semibold text-card no-underline transition-colors hover:bg-[#3f2c1b]"
            >
              View invoice
            </Link>
          </div>
        </div>
      ) : null}

      {loading && tracking === null ? (
        <DetailSkeleton />
      ) : error !== null && tracking === null ? (
        <div className={cx(CARD, "max-w-[520px] px-6 py-12 text-center")}>
          <div className="mb-2 text-[22px] text-ink" style={SERIF}>
            {error}
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 inline-block rounded-pill bg-ink px-[26px] py-[13px] font-body text-[14px] font-semibold text-card transition-colors hover:bg-[#3f2c1b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            Try again
          </button>
        </div>
      ) : tracking !== null ? (
        <OrderTrackingView
          tracking={tracking}
          itemsSlot={itemsSlot}
          onCancel={() => setCancelOpen(true)}
        />
      ) : null}

      {cancelOpen && tracking !== null ? (
        <CancelOrderDialog
          orderNumber={orderNumber}
          onSubmit={(reason) =>
            cancelOrder(orderNumber, { reason }, SESSION_CREDENTIAL)
          }
          onCancelled={handleCancelled}
          onClose={() => setCancelOpen(false)}
        />
      ) : null}
    </main>
  );
}

function DetailSkeleton(): ReactNode {
  return (
    <div
      className="grid grid-cols-[1.4fr_0.9fr] items-start gap-6 max-[860px]:grid-cols-1"
      aria-hidden="true"
    >
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
