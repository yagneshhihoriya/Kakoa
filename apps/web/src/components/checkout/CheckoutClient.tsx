"use client";

/**
 * `CheckoutClient` — the 4-step checkout wizard (checkout.md §2), driven by
 * `useCheckout`. Layout & tokens follow the prototype (50-checkout.html):
 * a centred step indicator, a form column, and a sticky order-summary aside;
 * mobile-first, the aside stacks below the form and the summary also renders
 * as a collapsible header on narrow screens.
 *
 * Money is never trusted here — the quote/placement Route Handlers recompute
 * everything. This component holds display copies and the refs the server
 * needs, and renders the five UI states (loading / empty / error / partial /
 * success) per step plus the blocking PRICE_CHANGED / OUT_OF_STOCK sheets.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  formatPaise,
  formatIST,
  GST_STATES,
  stateByCode,
  stateCodeFromPincode,
  type CartView,
  type CheckoutQuote,
  type SavedAddress,
} from "@kakoa/core";
import { cx } from "@kakoa/ui";
import { Skeleton } from "@kakoa/ui";
import { useToast } from "@kakoa/ui/client";
import { ChocoPlaceholder } from "@/components/catalog/ChocoPlaceholder";
import { useCart } from "@/components/cart/CartProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAddresses } from "@/components/account/useAddresses";
import {
  useCheckout,
  type CheckoutInitial,
  type PlaceOrderOutcome,
  type UseCheckout,
} from "./useCheckout";
import { AddressCard } from "./AddressCard";
import { AddressPicker } from "./AddressPicker";
import {
  savedAddressToState,
  type AddressState,
  type CheckoutStep,
  type CheckoutSummarySettings,
  type RazorpayHandoff,
  type SoldOutLine,
} from "./types";

/* ------------------------------------------------------------------ */
/* Shared tokens                                                       */
/* ------------------------------------------------------------------ */

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold";

const INPUT_BASE =
  "w-full rounded-xl border bg-[#F9F3EA] px-4 py-[14px] font-body text-[15px] text-ink outline-none transition-colors placeholder:text-[#b3a288] focus:ring-2 focus:ring-gold";

const LABEL =
  "mb-[7px] block font-body text-[13px] font-semibold text-[#5C4B3A]";

const PRIMARY_BTN =
  "flex w-full items-center justify-center gap-2 rounded-pill bg-ink px-6 py-4 font-body text-[15.5px] font-bold text-card transition-colors hover:bg-[#3f2c1b] disabled:cursor-not-allowed disabled:opacity-60";

const GHOST_BTN =
  "rounded-pill border-[1.5px] border-[#E0CFB6] bg-transparent px-[26px] py-4 font-body text-[15px] font-bold text-ink transition-colors hover:bg-[#F3E7D5]";

const STEP_LABELS: Record<CheckoutStep, string> = {
  1: "Information",
  2: "Delivery",
  3: "Payment",
  4: "Review",
};

const RAZORPAY_MOCK_KEY = "rzp_test_mock";
const RAZORPAY_SDK_URL = "https://checkout.razorpay.com/v1/checkout.js";

/* ------------------------------------------------------------------ */
/* Small presentational helpers                                        */
/* ------------------------------------------------------------------ */

function Spinner({ className }: { className?: string }): ReactNode {
  return (
    <svg
      className={cx("h-4 w-4 animate-spin", className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M12 2a10 10 0 0 1 10 10h-3a7 7 0 0 0-7-7V2z"
      />
    </svg>
  );
}

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

function FieldError({ id, message }: { id: string; message: string }): ReactNode {
  return (
    <p
      id={id}
      role="alert"
      className="mt-2 font-body text-[12.5px] font-medium text-danger"
    >
      {message}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Step indicator                                                      */
/* ------------------------------------------------------------------ */

function StepIndicator({
  current,
  maxReached,
  onGo,
}: {
  current: CheckoutStep;
  maxReached: CheckoutStep;
  onGo: (step: CheckoutStep) => void;
}): ReactNode {
  const steps: CheckoutStep[] = [1, 2, 3, 4];
  return (
    <ol className="mb-9 flex items-center justify-center gap-1 sm:gap-2">
      {steps.map((n, i) => {
        const active = n === current;
        const done = n < current;
        const reachable = n <= maxReached;
        return (
          <li key={n} className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              disabled={!reachable}
              onClick={() => reachable && onGo(n)}
              aria-current={active ? "step" : undefined}
              className={cx(
                "flex items-center gap-2.5 rounded-pill px-1.5 py-1",
                reachable ? "cursor-pointer" : "cursor-not-allowed",
                FOCUS_RING,
              )}
            >
              <span
                className={cx(
                  "grid h-[30px] w-[30px] place-items-center rounded-pill font-body text-[13px] font-bold transition-colors",
                  active || done
                    ? "bg-ink text-card"
                    : "bg-[#EFE3CE] text-[#a08a72]",
                )}
              >
                {done ? <CheckIcon className="text-card" /> : n}
              </span>
              <span
                className={cx(
                  "hidden font-body text-[14px] font-semibold sm:inline",
                  active ? "text-ink" : "text-[#8a7a68]",
                )}
              >
                {STEP_LABELS[n]}
              </span>
            </button>
            {i < steps.length - 1 ? (
              <span
                aria-hidden="true"
                className="h-px w-5 bg-[#DCC9AE] sm:w-9"
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* Order summary aside                                                 */
/* ------------------------------------------------------------------ */

function SummaryRow({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}): ReactNode {
  return (
    <div className="mb-2.5 flex items-baseline justify-between font-body text-[14px]">
      <span className={muted ? "text-[#8a7a68]" : "text-[#5C4B3A]"}>{label}</span>
      <span
        className={cx(
          "tabular-nums",
          strong ? "font-semibold text-ink" : "text-ink",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function OrderSummary({
  cart,
  quote,
  quoteLoading,
  paymentMode,
}: {
  cart: CartView;
  quote: CheckoutQuote | null;
  quoteLoading: boolean;
  paymentMode: "prepaid" | "cod";
}): ReactNode {
  // Lines come from the quote when it is fresh, else the initial cart view.
  const lines = quote?.lines ?? cart.lines;

  return (
    <div className="rounded-[22px] border border-line bg-card p-6">
      <h2
        className="mb-4 text-[20px] text-ink"
        style={{ fontFamily: "var(--font-display), serif" }}
      >
        In your bag
      </h2>

      <ul className="mb-[18px] flex max-h-[240px] flex-col gap-3 overflow-y-auto">
        {lines.map((line) => (
          <li key={line.itemId} className="flex items-center gap-3">
            <div className="relative w-[44px] flex-none">
              <ChocoPlaceholder tone={line.tone} ratio="44 / 52" />
              <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-pill bg-ink px-1 font-body text-[11px] font-bold text-card">
                {line.qty}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-body text-[13.5px] font-semibold text-ink">
                {line.name}
              </p>
              {line.variantName !== "" ? (
                <p className="truncate font-body text-[12px] text-[#8a7a68]">
                  {line.variantName}
                </p>
              ) : null}
            </div>
            <span className="font-body text-[14px] font-bold tabular-nums text-ink">
              {formatPaise(line.lineTotalPaise)}
            </span>
          </li>
        ))}
      </ul>

      <div className="border-t border-[#EADBC6] pt-4">
        {quote === null || quoteLoading ? (
          <div className="space-y-2.5" aria-hidden="true">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="mt-3 h-7 w-1/2" />
          </div>
        ) : (
          <>
            <SummaryRow
              label="Subtotal"
              value={formatPaise(quote.subtotalPaise)}
            />
            {quote.discountPaise > 0 ? (
              <SummaryRow
                label={
                  quote.coupon !== null
                    ? `Discount · ${quote.coupon.code}`
                    : "Discount"
                }
                value={`− ${formatPaise(quote.discountPaise)}`}
              />
            ) : null}
            <SummaryRow
              label="Shipping"
              value={
                quote.shippingFeePaise === 0
                  ? "Free"
                  : formatPaise(quote.shippingFeePaise)
              }
            />
            {quote.giftWrapTotalPaise > 0 ? (
              <SummaryRow
                label="Gift wrap"
                value={formatPaise(quote.giftWrapTotalPaise)}
              />
            ) : null}
            {paymentMode === "cod" && quote.codFeePaise > 0 ? (
              <SummaryRow
                label="COD fee"
                value={formatPaise(quote.codFeePaise)}
              />
            ) : null}

            <div className="mt-3 flex items-baseline justify-between border-t border-[#EADBC6] pt-4">
              <span className="font-body text-[15px] font-semibold text-ink">
                Total
              </span>
              <span className="font-body text-[22px] font-bold tabular-nums text-ink">
                {formatPaise(quote.totalPaise)}
              </span>
            </div>

            {/* GST is EXTRACTED from the inclusive prices — informational only,
                NEVER added to the total. Rendered as a note under Total (not a
                summable row) so it can't read as an extra charge. */}
            {(() => {
              const gstPaise =
                quote.taxIncluded.igstPaise > 0
                  ? quote.taxIncluded.igstPaise
                  : quote.taxIncluded.cgstPaise + quote.taxIncluded.sgstPaise;
              const gstLabel =
                quote.taxIncluded.igstPaise > 0 ? "IGST" : "CGST + SGST";
              return gstPaise > 0 ? (
                <p className="mt-2 font-body text-[12.5px] text-[#8a7a68]">
                  Inclusive of {formatPaise(gstPaise)} {gstLabel} · MRP includes
                  all taxes
                </p>
              ) : null;
            })()}

            {quote.etaDaysMin > 0 ? (
              <p className="mt-1.5 font-body text-[12.5px] text-[#8a7a68]">
                Estimated delivery in {quote.etaDaysMin}–{quote.etaDaysMax} days
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/* Root                                                                */
/* ================================================================== */

export interface CheckoutClientProps {
  initial: CheckoutInitial;
  cart: CartView;
  summarySettings: CheckoutSummarySettings;
}

export function CheckoutClient({
  initial,
  cart,
  summarySettings,
}: CheckoutClientProps): ReactNode {
  const router = useRouter();
  const { refresh: refreshCart } = useCart();
  const { toast } = useToast();
  const auth = useAuth();
  const co = useCheckout(initial);

  // A guest who signs in DURING checkout (via the Step-1 "Sign in for faster
  // checkout" CTA): once the session lands, re-seed the whole flow from the
  // server so their saved addresses + contact prefill load and Step 1 switches
  // to the logged-in experience. Guarded by `!initial.loggedIn` so it fires at
  // most once — after the reload the page is seeded logged-in and never loops.
  useEffect(() => {
    if (!initial.loggedIn && auth.customer !== null) {
      window.location.reload();
    }
  }, [initial.loggedIn, auth.customer]);

  // Shared saved-address book, seeded from the server list. The picker mutates
  // through this; we mirror successful create/update back into checkout state so
  // the selected card, the book list, and the DB stay in lockstep without a
  // reload. `upsertSavedAddress` also demotes stale defaults locally.
  const rawBook = useAddresses(initial.savedAddresses);
  const book: typeof rawBook = {
    ...rawBook,
    create: async (input) => {
      const result = await rawBook.create(input);
      if (result.ok) co.upsertSavedAddress(result.data);
      return result;
    },
    update: async (input) => {
      const result = await rawBook.update(input);
      if (result.ok) co.upsertSavedAddress(result.data);
      return result;
    },
  };

  // Highest step the customer has advanced to (drives indicator reachability).
  const [maxReached, setMaxReached] = useState<CheckoutStep>(1);
  useEffect(() => {
    setMaxReached((prev) => (co.step > prev ? co.step : prev));
  }, [co.step]);

  // Blocking dialogs raised by placement failures.
  const [priceChange, setPriceChange] = useState<{
    oldTotalPaise: number;
    quote: CheckoutQuote;
  } | null>(null);
  const [soldOut, setSoldOut] = useState<SoldOutLine[] | null>(null);
  const [upstreamError, setUpstreamError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const advance = useCallback(
    (to: CheckoutStep) => {
      co.goToStep(to);
    },
    [co],
  );

  /* ---- prepaid handoff (§2 step 7) ---- */

  const finishToSuccess = useCallback(
    (orderNumber: string, accessToken: string) => {
      void refreshCart();
      const params = new URLSearchParams({
        order: orderNumber,
        token: accessToken,
      });
      router.push(`/order/success?${params.toString()}` as Route);
    },
    [refreshCart, router],
  );

  const verifyPrepaid = useCallback(
    async (payload: {
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    }): Promise<boolean> => {
      setConfirming(true);
      try {
        const response = await fetch("/api/checkout/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = (await response.json()) as
          | { ok: true; data: { orderNumber: string; status: string } }
          | { ok: false; error: { code: string; message: string } };
        if (result.ok) return true;
        toast({ kind: "error", message: result.error.message });
        return false;
      } catch {
        toast({
          kind: "error",
          message: "We couldn't confirm your payment. Please retry.",
        });
        return false;
      } finally {
        setConfirming(false);
      }
    },
    [toast],
  );

  const openRazorpay = useCallback(
    async (
      razorpay: RazorpayHandoff,
      orderNumber: string,
      accessToken: string,
    ): Promise<void> => {
      // MOCK provider (dev): the backend hands back a devSignature we can post
      // straight to /verify — no external script, prod path stays untouched.
      const devSignature = (razorpay as RazorpayHandoff & {
        devSignature?: string;
        paymentId?: string;
      }).devSignature;
      if (
        razorpay.keyId === RAZORPAY_MOCK_KEY &&
        typeof devSignature === "string"
      ) {
        const ok = await verifyPrepaid({
          razorpayOrderId: razorpay.orderId,
          razorpayPaymentId:
            (razorpay as RazorpayHandoff & { paymentId?: string }).paymentId ??
            `pay_mock_${razorpay.orderId}`,
          razorpaySignature: devSignature,
        });
        if (ok) finishToSuccess(orderNumber, accessToken);
        return;
      }

      // Real Razorpay Standard Checkout (§2 step 7).
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        toast({
          kind: "error",
          message: "Payment temporarily unavailable — please retry.",
        });
        return;
      }
      const RazorpayCtor = (
        window as unknown as { Razorpay?: RazorpayConstructor }
      ).Razorpay;
      if (RazorpayCtor === undefined) {
        toast({
          kind: "error",
          message: "Payment temporarily unavailable — please retry.",
        });
        return;
      }
      const rzp = new RazorpayCtor({
        key: razorpay.keyId,
        order_id: razorpay.orderId,
        amount: razorpay.amountPaise,
        currency: razorpay.currency,
        name: "KAKOA",
        description: `Order ${orderNumber}`,
        prefill: {
          contact: razorpay.prefill.contact,
          email: razorpay.prefill.email,
        },
        handler: (rzpResponse: RazorpayHandlerResponse) => {
          void (async () => {
            const ok = await verifyPrepaid({
              razorpayOrderId: rzpResponse.razorpay_order_id,
              razorpayPaymentId: rzpResponse.razorpay_payment_id,
              razorpaySignature: rzpResponse.razorpay_signature,
            });
            if (ok) finishToSuccess(orderNumber, accessToken);
          })();
        },
      });
      rzp.open();
    },
    [verifyPrepaid, finishToSuccess, toast],
  );

  /* ---- placement (§2 steps 5–8) ---- */

  const handlePlace = useCallback(async (): Promise<void> => {
    const oldTotal = co.quote?.totalPaise ?? 0;
    const outcome: PlaceOrderOutcome = await co.placeOrder();
    switch (outcome.kind) {
      case "placed": {
        const placed = co.placedOrder;
        if (placed === null) return;
        if (placed.paymentMode === "cod" || placed.razorpay === null) {
          finishToSuccess(placed.orderNumber, placed.accessToken);
          return;
        }
        await openRazorpay(
          placed.razorpay,
          placed.orderNumber,
          placed.accessToken,
        );
        return;
      }
      case "price_changed": {
        if (outcome.freshQuote !== undefined) {
          setPriceChange({
            oldTotalPaise: oldTotal,
            quote: outcome.freshQuote,
          });
        } else {
          await co.refreshQuote();
        }
        return;
      }
      case "out_of_stock":
        setSoldOut(outcome.soldOut ?? []);
        void refreshCart();
        return;
      case "cart_expired":
        toast({ kind: "error", message: "Your cart has expired." });
        router.push("/cart");
        return;
      case "otp":
        toast({
          kind: "error",
          message: outcome.message ?? "Please re-verify your phone.",
        });
        co.goToStep(3);
        return;
      case "upstream":
        setUpstreamError(
          outcome.message ??
            "Payment setup failed — your card was not charged.",
        );
        return;
      default:
        toast({
          kind: "error",
          message: outcome.message ?? "Something went wrong. Please try again.",
        });
    }
  }, [co, finishToSuccess, openRazorpay, refreshCart, router, toast]);

  return (
    <main className="mx-auto max-w-[1120px] px-5 pb-20 pt-7 sm:px-8">
      <StepIndicator
        current={co.step}
        maxReached={maxReached}
        onGo={co.goToStep}
      />

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_360px] lg:gap-10">
        <section className="rounded-[22px] border border-line bg-card p-6 sm:p-8">
          {co.step === 1 ? (
            <Step1Information
              co={co}
              book={book}
              onContinue={() => advance(2)}
            />
          ) : null}
          {co.step === 2 ? (
            <Step2Delivery
              co={co}
              onBack={() => advance(1)}
              onContinue={() => advance(3)}
            />
          ) : null}
          {co.step === 3 ? (
            <Step3Payment
              co={co}
              summarySettings={summarySettings}
              onBack={() => advance(2)}
              onContinue={() => advance(4)}
            />
          ) : null}
          {co.step === 4 ? (
            <Step4Review
              co={co}
              onBack={() => advance(3)}
              onPlace={handlePlace}
            />
          ) : null}
        </section>

        <aside className="lg:sticky lg:top-[98px]">
          <OrderSummary
            cart={cart}
            quote={co.quote}
            quoteLoading={co.quoteStatus === "loading"}
            paymentMode={co.paymentMode}
          />
        </aside>
      </div>

      {priceChange !== null ? (
        <PriceChangedSheet
          oldTotalPaise={priceChange.oldTotalPaise}
          quote={priceChange.quote}
          onAccept={() => {
            setPriceChange(null);
          }}
        />
      ) : null}

      {soldOut !== null ? (
        <SoldOutSheet
          lines={soldOut}
          cart={cart}
          quote={co.quote}
          onClose={() => {
            setSoldOut(null);
            void co.refreshQuote();
          }}
        />
      ) : null}

      {upstreamError !== null ? (
        <UpstreamSheet
          message={upstreamError}
          retrying={co.placing}
          onRetry={() => {
            setUpstreamError(null);
            void handlePlace();
          }}
          onClose={() => setUpstreamError(null)}
        />
      ) : null}

      {confirming ? (
        <div
          role="status"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-ink/50 backdrop-blur-[2px]"
        >
          <div className="flex items-center gap-3 rounded-2xl bg-card px-6 py-5 shadow-[0_20px_50px_rgba(42,29,18,.3)]">
            <Spinner className="h-5 w-5 text-ink" />
            <span className="font-body text-[15px] font-semibold text-ink">
              Confirming payment…
            </span>
          </div>
        </div>
      ) : null}
    </main>
  );
}

/* ================================================================== */
/* Step 1 — Information (smart-address surface)                        */
/* ================================================================== */

/**
 * Step-1 dispatcher (smart-address Phase 1). Branches on the saved-address book
 * and auth state into five UI states:
 *   A — one serviceable saved address: default card, auto-selected, no form.
 *   B — multiple saved addresses: default preselected + "Change" → picker.
 *   C — logged-in, no saved address: the raw form, prefilled, + save toggle.
 *   D — guest / not logged in: the raw form + an optional non-blocking hint.
 * A/B share the SavedAddressStep; C/D share Step1AddressForm.
 */
function Step1Information({
  co,
  book,
  onContinue,
}: {
  co: UseCheckout;
  book: ReturnType<typeof useAddresses>;
  onContinue: () => void;
}): ReactNode {
  const hasSaved = co.savedAddresses.length > 0;
  if (hasSaved) {
    return <SavedAddressStep co={co} book={book} onContinue={onContinue} />;
  }
  return <Step1AddressForm co={co} onContinue={onContinue} />;
}

/* ---- States A/B — pick from the saved book ---- */

function SavedAddressStep({
  co,
  book,
  onContinue,
}: {
  co: UseCheckout;
  book: ReturnType<typeof useAddresses>;
  onContinue: () => void;
}): ReactNode {
  const [pickerOpen, setPickerOpen] = useState(false);
  const svcStatus = co.serviceabilityStatus;

  const selected =
    co.savedAddresses.find((a) => a.id === co.selectedAddressId) ??
    co.savedAddresses[0] ??
    null;

  // Fire serviceability + a fresh quote for the auto-selected address on mount.
  const primed = useRef(false);
  useEffect(() => {
    if (primed.current || selected === null) return;
    primed.current = true;
    void co.checkServiceability(selected.pincode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applySelection = useCallback(
    (address: SavedAddress) => {
      co.setSelectedAddressId(address.id);
      co.replaceAddress(savedAddressToState(address));
      // A picked saved row is never re-saved on placement.
      co.setSaveToBook(false);
      void co.checkServiceability(address.pincode);
    },
    [co],
  );

  const handleContinue = useCallback(() => {
    if (selected === null) return;
    if (svcStatus === "idle" || svcStatus === "error") {
      void co.checkServiceability(selected.pincode);
      return;
    }
    if (svcStatus === "unserviceable") return;
    const first = co.serviceability?.options[0];
    if (first !== undefined) co.setDeliveryOption(first.option);
    void co.refreshQuote();
    onContinue();
  }, [selected, svcStatus, co, onContinue]);

  if (selected === null) {
    // Defensive — book emptied out; fall back to the form path.
    return <Step1AddressForm co={co} onContinue={onContinue} />;
  }

  const canContinue =
    svcStatus === "serviceable" || svcStatus === "fallback";

  return (
    <div>
      <h1
        className="mb-6 text-[28px] text-ink"
        style={{ fontFamily: "var(--font-display), serif" }}
      >
        Delivery address
      </h1>

      <div className="mb-4">
        <AddressCard
          address={selected}
          selected
          onSelect={() => setPickerOpen(true)}
          onEdit={() => setPickerOpen(true)}
        />
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className={cx(GHOST_BTN, "flex-1", FOCUS_RING)}
        >
          {co.savedAddresses.length > 1 ? "Change address" : "Add / change"}
        </button>
      </div>

      {svcStatus === "unserviceable" ? (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 font-body text-[13.5px] text-danger"
        >
          Sorry, we can&apos;t deliver to PIN code {selected.pincode} yet. Please
          choose or add a different address.
        </div>
      ) : null}
      {svcStatus === "error" ? (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3"
        >
          <p className="font-body text-[13.5px] text-danger">
            We couldn&apos;t check delivery just now.
          </p>
          <button
            type="button"
            onClick={() => void co.checkServiceability(selected.pincode)}
            className={cx(
              "mt-1.5 font-body text-[13px] font-semibold text-espresso underline",
              FOCUS_RING,
            )}
          >
            Retry
          </button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleContinue}
        disabled={
          co.quoteStatus === "loading" ||
          svcStatus === "loading" ||
          svcStatus === "unserviceable" ||
          (!canContinue && svcStatus !== "idle" && svcStatus !== "error")
        }
        className={cx(PRIMARY_BTN, FOCUS_RING)}
      >
        Continue to delivery
      </button>

      {pickerOpen ? (
        <AddressPicker
          addresses={co.savedAddresses}
          selectedId={co.selectedAddressId}
          book={book}
          onSelect={applySelection}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
    </div>
  );
}

/* ---- States C/D — the raw address form ---- */

function Step1AddressForm({
  co,
  onContinue,
}: {
  co: UseCheckout;
  onContinue: () => void;
}): ReactNode {
  const auth = useAuth();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const svcStatus = co.serviceabilityStatus;
  const svc = co.serviceability;

  const setField = useCallback(
    (key: keyof AddressState, value: string) => {
      co.setAddress({ [key]: value } as Partial<AddressState>);
      setErrors((prev) => {
        if (prev[key] === undefined) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    [co],
  );

  const onStateChange = useCallback(
    (code: string) => {
      const match = GST_STATES.find((s) => s.code === code);
      co.setAddress({ stateCode: code, state: match?.name ?? "" });
      setErrors((prev) => {
        if (prev["state"] === undefined) return prev;
        const next = { ...prev };
        delete next["state"];
        return next;
      });
    },
    [co],
  );

  // Pincode autofill: on the 6th digit, infer the GST state and preselect the
  // dropdown when the customer hasn't already picked one (never clobber a pick).
  const onPincodeChange = useCallback(
    (raw: string) => {
      const pincode = raw.replace(/[^\d]/g, "").slice(0, 6);
      const patch: Partial<AddressState> = { pincode };
      if (pincode.length === 6 && co.address.stateCode === "") {
        const code = stateCodeFromPincode(pincode);
        if (code !== null) {
          patch.stateCode = code;
          patch.state = stateByCode(code)?.name ?? "";
        }
      }
      co.setAddress(patch);
      setErrors((prev) => {
        if (prev["pincode"] === undefined && prev["state"] === undefined) {
          return prev;
        }
        const next = { ...prev };
        delete next["pincode"];
        if (patch.stateCode !== undefined) delete next["state"];
        return next;
      });
    },
    [co],
  );

  const onPincodeBlur = useCallback(() => {
    const pincode = co.address.pincode.trim();
    if (/^[1-9][0-9]{5}$/.test(pincode)) {
      void co.checkServiceability(pincode);
    }
  }, [co]);

  const validate = useCallback((): boolean => {
    const next: Record<string, string> = {};
    const a = co.address;
    if (!/^[6-9][0-9]{9}$/.test(co.contact.phone.trim())) {
      next["contactPhone"] =
        "Enter a valid 10-digit Indian mobile number starting with 6–9.";
    }
    if (
      co.contact.email.trim() !== "" &&
      !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(
        co.contact.email.trim(),
      )
    ) {
      next["contactEmail"] = "Enter a valid email address (e.g., name@example.com).";
    }
    if (a.fullName.trim().length < 2) {
      next["fullName"] = "Enter the recipient's full name (2–100 characters).";
    }
    if (!/^[6-9][0-9]{9}$/.test(a.phone.trim())) {
      next["phone"] = "Enter a valid 10-digit mobile number for delivery updates.";
    }
    if (a.line1.trim().length < 3) {
      next["line1"] =
        "Address line 1 is required (house/flat, street — min 3 characters).";
    }
    if (a.city.trim().length < 2) next["city"] = "Enter a valid city name.";
    if (a.stateCode === "") next["state"] = "Select your state from the list.";
    if (!/^[1-9][0-9]{5}$/.test(a.pincode.trim())) {
      next["pincode"] = "Enter a valid 6-digit Indian PIN code.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [co.address, co.contact]);

  const canContinue =
    svcStatus === "serviceable" || svcStatus === "fallback";

  const handleContinue = useCallback(() => {
    if (!validate()) return;
    const pincode = co.address.pincode.trim();
    if (svcStatus === "idle" || svcStatus === "error") {
      void co.checkServiceability(pincode);
      return;
    }
    if (!canContinue) return;
    // Default the delivery option to the first serviceable option.
    const first = svc?.options[0];
    if (first !== undefined) co.setDeliveryOption(first.option);
    void co.refreshQuote();
    onContinue();
  }, [validate, co, svcStatus, canContinue, svc, onContinue]);

  return (
    <div>
      <h1
        className="mb-6 text-[28px] text-ink"
        style={{ fontFamily: "var(--font-display), serif" }}
      >
        Contact &amp; shipping
      </h1>

      {/* Optional sign-in for returning customers (guests only) — never a wall.
          Amazon/Shopify pattern: log in to auto-fill saved addresses. */}
      {!co.loggedIn ? (
        <div className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-[#E8DBC6] bg-[#F9F3EA] px-4 py-3 font-body text-[13.5px] text-espresso">
          <span>Already have an account?</span>
          <button
            type="button"
            onClick={() => auth.open("Sign in for faster checkout")}
            className={cx(
              "font-semibold text-ink underline decoration-gold decoration-2 underline-offset-2 transition-colors hover:text-cocoa",
              FOCUS_RING,
              "rounded-sm",
            )}
          >
            Sign in for faster checkout
          </button>
        </div>
      ) : null}

      {/* Contact */}
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="co-phone" className={LABEL}>
            Mobile number
          </label>
          <div
            className={cx(
              "flex items-center overflow-hidden rounded-xl border bg-[#F9F3EA] transition-colors focus-within:ring-2 focus-within:ring-gold",
              errors["contactPhone"] ? "border-danger" : "border-[#E8DBC6]",
            )}
          >
            <span className="select-none border-r border-[#E8DBC6] px-3.5 py-[14px] font-body text-[15px] font-semibold text-espresso">
              +91
            </span>
            <input
              id="co-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="98765 43210"
              value={co.contact.phone}
              onChange={(e) => {
                co.setContact({ phone: e.target.value.replace(/[^\d]/g, "") });
                setErrors((p) => {
                  const n = { ...p };
                  delete n["contactPhone"];
                  return n;
                });
              }}
              maxLength={10}
              className="w-full bg-transparent px-4 py-[14px] font-body text-[15px] text-ink outline-none placeholder:text-[#b3a288]"
            />
          </div>
          {errors["contactPhone"] ? (
            <FieldError id="co-phone-err" message={errors["contactPhone"]} />
          ) : null}
        </div>
        <div>
          <label htmlFor="co-email" className={LABEL}>
            Email <span className="font-normal text-[#a08a72]">(optional)</span>
          </label>
          <input
            id="co-email"
            type="email"
            autoComplete="email"
            placeholder="you@email.com"
            value={co.contact.email}
            onChange={(e) => {
              co.setContact({ email: e.target.value });
              setErrors((p) => {
                const n = { ...p };
                delete n["contactEmail"];
                return n;
              });
            }}
            className={cx(
              INPUT_BASE,
              errors["contactEmail"] ? "border-danger" : "border-[#E8DBC6]",
            )}
          />
          {errors["contactEmail"] ? (
            <FieldError id="co-email-err" message={errors["contactEmail"]} />
          ) : null}
        </div>
      </div>

      {/* Recipient */}
      <div className="mb-4">
        <label htmlFor="co-name" className={LABEL}>
          Full name
        </label>
        <input
          id="co-name"
          autoComplete="name"
          placeholder="Amara Patel"
          value={co.address.fullName}
          onChange={(e) => setField("fullName", e.target.value)}
          className={cx(
            INPUT_BASE,
            errors["fullName"] ? "border-danger" : "border-[#E8DBC6]",
          )}
        />
        {errors["fullName"] ? (
          <FieldError id="co-name-err" message={errors["fullName"]} />
        ) : null}
      </div>

      <div className="mb-4">
        <label htmlFor="co-recipient-phone" className={LABEL}>
          Recipient phone
        </label>
        <div
          className={cx(
            "flex items-center overflow-hidden rounded-xl border bg-[#F9F3EA] transition-colors focus-within:ring-2 focus-within:ring-gold",
            errors["phone"] ? "border-danger" : "border-[#E8DBC6]",
          )}
        >
          <span className="select-none border-r border-[#E8DBC6] px-3.5 py-[14px] font-body text-[15px] font-semibold text-espresso">
            +91
          </span>
          <input
            id="co-recipient-phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="98765 43210"
            value={co.address.phone}
            onChange={(e) => setField("phone", e.target.value.replace(/[^\d]/g, ""))}
            maxLength={10}
            className="w-full bg-transparent px-4 py-[14px] font-body text-[15px] text-ink outline-none placeholder:text-[#b3a288]"
          />
        </div>
        {errors["phone"] ? (
          <FieldError id="co-recipient-phone-err" message={errors["phone"]} />
        ) : null}
      </div>

      <div className="mb-4">
        <label htmlFor="co-line1" className={LABEL}>
          Address line 1
        </label>
        <input
          id="co-line1"
          autoComplete="address-line1"
          placeholder="House / flat, street"
          value={co.address.line1}
          onChange={(e) => setField("line1", e.target.value)}
          className={cx(
            INPUT_BASE,
            errors["line1"] ? "border-danger" : "border-[#E8DBC6]",
          )}
        />
        {errors["line1"] ? (
          <FieldError id="co-line1-err" message={errors["line1"]} />
        ) : null}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="co-line2" className={LABEL}>
            Address line 2{" "}
            <span className="font-normal text-[#a08a72]">(optional)</span>
          </label>
          <input
            id="co-line2"
            autoComplete="address-line2"
            placeholder="Area, colony"
            value={co.address.line2}
            onChange={(e) => setField("line2", e.target.value)}
            className={cx(INPUT_BASE, "border-[#E8DBC6]")}
          />
        </div>
        <div>
          <label htmlFor="co-landmark" className={LABEL}>
            Landmark{" "}
            <span className="font-normal text-[#a08a72]">(optional)</span>
          </label>
          <input
            id="co-landmark"
            placeholder="Near…"
            value={co.address.landmark}
            onChange={(e) => setField("landmark", e.target.value)}
            className={cx(INPUT_BASE, "border-[#E8DBC6]")}
          />
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <label htmlFor="co-city" className={LABEL}>
            City
          </label>
          <input
            id="co-city"
            autoComplete="address-level2"
            placeholder="Mumbai"
            value={co.address.city}
            onChange={(e) => setField("city", e.target.value)}
            className={cx(
              INPUT_BASE,
              errors["city"] ? "border-danger" : "border-[#E8DBC6]",
            )}
          />
          {errors["city"] ? (
            <FieldError id="co-city-err" message={errors["city"]} />
          ) : null}
        </div>
        <div>
          <label htmlFor="co-state" className={LABEL}>
            State
          </label>
          <select
            id="co-state"
            value={co.address.stateCode}
            onChange={(e) => onStateChange(e.target.value)}
            className={cx(
              INPUT_BASE,
              "appearance-none",
              errors["state"] ? "border-danger" : "border-[#E8DBC6]",
              co.address.stateCode === "" ? "text-[#b3a288]" : "",
            )}
          >
            <option value="">Select…</option>
            {GST_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
          {errors["state"] ? (
            <FieldError id="co-state-err" message={errors["state"]} />
          ) : null}
        </div>
        <div>
          <label htmlFor="co-pincode" className={LABEL}>
            PIN code
          </label>
          <input
            id="co-pincode"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="400001"
            value={co.address.pincode}
            onChange={(e) => onPincodeChange(e.target.value)}
            onBlur={onPincodeBlur}
            maxLength={6}
            className={cx(
              INPUT_BASE,
              errors["pincode"] ? "border-danger" : "border-[#E8DBC6]",
            )}
          />
          {errors["pincode"] ? (
            <FieldError id="co-pincode-err" message={errors["pincode"]} />
          ) : null}
        </div>
      </div>

      {/* Serviceability feedback */}
      {svcStatus === "loading" ? (
        <p className="mb-5 flex items-center gap-2 font-body text-[13px] text-espresso">
          <Spinner className="text-espresso" />
          Checking delivery to {co.address.pincode}…
        </p>
      ) : null}
      {svcStatus === "serviceable" ? (
        <p className="mb-5 flex items-center gap-2 font-body text-[13px] font-medium text-[#5f6d3a]">
          <CheckIcon className="text-[#7C8A4E]" />
          Great — we deliver to {co.address.pincode}.
        </p>
      ) : null}
      {svcStatus === "unserviceable" ? (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 font-body text-[13.5px] text-danger"
        >
          Sorry, we can&apos;t deliver to PIN code {co.address.pincode} yet.
          Please try a different PIN code.
        </div>
      ) : null}
      {svcStatus === "fallback" ? (
        <div
          role="status"
          className="mb-5 rounded-xl border border-[#E8DBC6] bg-[#F5E3C4]/50 px-4 py-3 font-body text-[13.5px] text-[#7a5a1e]"
        >
          Standard delivery only — final serviceability verified at dispatch.
        </div>
      ) : null}
      {svcStatus === "error" ? (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3"
        >
          <p className="font-body text-[13.5px] text-danger">
            We couldn&apos;t check delivery just now.
          </p>
          <button
            type="button"
            onClick={() => void co.checkServiceability(co.address.pincode)}
            className={cx(
              "mt-1.5 font-body text-[13px] font-semibold text-espresso underline",
              FOCUS_RING,
            )}
          >
            Retry
          </button>
        </div>
      ) : null}

      {/* State C — logged-in with no saved address: offer to save it. */}
      {co.loggedIn ? (
        <label className="mb-5 flex cursor-pointer items-center gap-3 font-body text-[14px] text-espresso">
          <input
            type="checkbox"
            checked={co.saveToBook}
            onChange={(e) => co.setSaveToBook(e.target.checked)}
            className="h-[18px] w-[18px] accent-[#2a1d12]"
          />
          Save this to my address book for next time
        </label>
      ) : (
        /* State D — guest: a non-blocking hint, no account wall (visual only).
           Returning customers use the "Sign in for faster checkout" CTA above. */
        <p className="mb-5 font-body text-[13px] text-[#8a7a68]">
          Checking out as a guest.{" "}
          <span className="text-espresso">
            Sign in anytime to save your details for next time.
          </span>
        </p>
      )}

      <button
        type="button"
        onClick={handleContinue}
        disabled={co.quoteStatus === "loading"}
        className={cx(PRIMARY_BTN, FOCUS_RING)}
      >
        Continue to delivery
      </button>
    </div>
  );
}

/* ================================================================== */
/* Step 2 — Delivery                                                   */
/* ================================================================== */

function Step2Delivery({
  co,
  onBack,
  onContinue,
}: {
  co: UseCheckout;
  onBack: () => void;
  onContinue: () => void;
}): ReactNode {
  const options = co.serviceability?.options ?? [];

  // The quote's shipping fee is 0 exactly when the subtotal clears the
  // free-shipping threshold — so deriving "free" from the live quote keeps the
  // delivery cards perfectly in sync with the summary (no threshold to re-plumb).
  const shipsFree = co.quote?.shippingFeePaise === 0;

  const pick = useCallback(
    (option: "standard" | "express") => {
      if (option === co.deliveryOption) return;
      co.setDeliveryOption(option);
      void co.refreshQuote();
    },
    [co],
  );

  return (
    <div>
      <h1
        className="mb-6 text-[28px] text-ink"
        style={{ fontFamily: "var(--font-display), serif" }}
      >
        Delivery method
      </h1>

      {options.length === 0 ? (
        <div className="mb-6 rounded-xl border border-[#E8DBC6] bg-[#F5E3C4]/50 px-4 py-3 font-body text-[13.5px] text-[#7a5a1e]">
          Standard delivery only for this PIN code.
        </div>
      ) : (
        <div className="mb-6 flex flex-col gap-3">
          {options.map((opt) => {
            const selected = co.deliveryOption === opt.option;
            return (
              <button
                key={opt.option}
                type="button"
                onClick={() => pick(opt.option)}
                aria-pressed={selected}
                className={cx(
                  "flex items-center justify-between gap-3 rounded-[14px] border-2 bg-[#F9F3EA] px-5 py-[18px] text-left transition-colors",
                  selected ? "border-ink" : "border-transparent hover:border-[#E0CFB6]",
                  FOCUS_RING,
                )}
              >
                <span>
                  <span className="block font-body text-[15.5px] font-semibold text-ink">
                    {opt.option === "express" ? "Express" : "Standard"} ·{" "}
                    {opt.etaDaysMin}–{opt.etaDaysMax} days
                  </span>
                  <span className="block font-body text-[13px] text-[#8a7a68]">
                    {opt.option === "express"
                      ? "Priority handling & tracking"
                      : "Insulated, ships cold & safe"}
                  </span>
                </span>
                <span
                  className={cx(
                    "font-body text-[15px] font-bold tabular-nums",
                    shipsFree || opt.feePaise === 0
                      ? "text-[#7C8A4E]"
                      : "text-ink",
                  )}
                >
                  {shipsFree || opt.feePaise === 0
                    ? "Free"
                    : formatPaise(opt.feePaise)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="mb-6">
        <label htmlFor="co-note" className={LABEL}>
          Order note{" "}
          <span className="font-normal text-[#a08a72]">(optional)</span>
        </label>
        <textarea
          id="co-note"
          value={co.customerNote}
          onChange={(e) => co.setCustomerNote(e.target.value.slice(0, 500))}
          placeholder="Anything we should know?"
          className={cx(
            INPUT_BASE,
            "h-[72px] resize-none border-[#E8DBC6]",
          )}
        />
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className={cx(GHOST_BTN, "flex-none", FOCUS_RING)}
        >
          Back
        </button>
        <button
          type="button"
          onClick={onContinue}
          disabled={co.quoteStatus === "loading"}
          className={cx(PRIMARY_BTN, "flex-1", FOCUS_RING)}
        >
          Continue to payment
        </button>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Billing address (Step 3 toggle)                                     */
/* ================================================================== */

/** Client-side completeness gate for a billing address (mirrors Step-1). */
function isAddressComplete(a: AddressState): boolean {
  return (
    a.fullName.trim().length >= 2 &&
    /^[6-9][0-9]{9}$/.test(a.phone.trim()) &&
    a.line1.trim().length >= 3 &&
    a.city.trim().length >= 2 &&
    a.stateCode !== "" &&
    /^[1-9][0-9]{5}$/.test(a.pincode.trim())
  );
}

/**
 * Inline billing-address fields (§ billing toggle). Binds `co.billingAddress`
 * directly — no label/isDefault, not saved to the book — and reuses the Step-1
 * field styling + pincode→state autofill. Sent as `billingAddress` at placement
 * (the place-order contract already supports it).
 */
function BillingAddressFields({ co }: { co: UseCheckout }): ReactNode {
  const b = co.billingAddress;

  const onPincodeChange = useCallback(
    (raw: string) => {
      const pincode = raw.replace(/[^\d]/g, "").slice(0, 6);
      const patch: Partial<AddressState> = { pincode };
      if (pincode.length === 6 && b.stateCode === "") {
        const code = stateCodeFromPincode(pincode);
        if (code !== null) {
          patch.stateCode = code;
          patch.state = stateByCode(code)?.name ?? "";
        }
      }
      co.setBillingAddress(patch);
    },
    [co, b.stateCode],
  );

  return (
    <div>
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="bi-name" className={LABEL}>
            Full name
          </label>
          <input
            id="bi-name"
            autoComplete="name"
            placeholder="Amara Patel"
            value={b.fullName}
            onChange={(e) => co.setBillingAddress({ fullName: e.target.value })}
            className={cx(INPUT_BASE, "border-[#E8DBC6]")}
          />
        </div>
        <div>
          <label htmlFor="bi-phone" className={LABEL}>
            Phone
          </label>
          <div className="flex items-center overflow-hidden rounded-xl border border-[#E8DBC6] bg-[#F9F3EA] transition-colors focus-within:ring-2 focus-within:ring-gold">
            <span className="select-none border-r border-[#E8DBC6] px-3.5 py-[14px] font-body text-[15px] font-semibold text-espresso">
              +91
            </span>
            <input
              id="bi-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="98765 43210"
              value={b.phone}
              onChange={(e) =>
                co.setBillingAddress({
                  phone: e.target.value.replace(/[^\d]/g, "").slice(0, 10),
                })
              }
              maxLength={10}
              className="w-full bg-transparent px-4 py-[14px] font-body text-[15px] text-ink outline-none placeholder:text-[#b3a288]"
            />
          </div>
        </div>
      </div>

      <div className="mb-4">
        <label htmlFor="bi-line1" className={LABEL}>
          Address line 1
        </label>
        <input
          id="bi-line1"
          autoComplete="address-line1"
          placeholder="House / flat, street"
          value={b.line1}
          maxLength={150}
          onChange={(e) => co.setBillingAddress({ line1: e.target.value })}
          className={cx(INPUT_BASE, "border-[#E8DBC6]")}
        />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="bi-line2" className={LABEL}>
            Address line 2{" "}
            <span className="font-normal text-[#a08a72]">(optional)</span>
          </label>
          <input
            id="bi-line2"
            autoComplete="address-line2"
            placeholder="Area, colony"
            value={b.line2}
            maxLength={150}
            onChange={(e) => co.setBillingAddress({ line2: e.target.value })}
            className={cx(INPUT_BASE, "border-[#E8DBC6]")}
          />
        </div>
        <div>
          <label htmlFor="bi-landmark" className={LABEL}>
            Landmark{" "}
            <span className="font-normal text-[#a08a72]">(optional)</span>
          </label>
          <input
            id="bi-landmark"
            placeholder="Near…"
            value={b.landmark}
            maxLength={100}
            onChange={(e) => co.setBillingAddress({ landmark: e.target.value })}
            className={cx(INPUT_BASE, "border-[#E8DBC6]")}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <label htmlFor="bi-city" className={LABEL}>
            City
          </label>
          <input
            id="bi-city"
            autoComplete="address-level2"
            placeholder="Mumbai"
            value={b.city}
            onChange={(e) => co.setBillingAddress({ city: e.target.value })}
            className={cx(INPUT_BASE, "border-[#E8DBC6]")}
          />
        </div>
        <div>
          <label htmlFor="bi-state" className={LABEL}>
            State
          </label>
          <select
            id="bi-state"
            value={b.stateCode}
            onChange={(e) =>
              co.setBillingAddress({
                stateCode: e.target.value,
                state: stateByCode(e.target.value)?.name ?? "",
              })
            }
            className={cx(
              INPUT_BASE,
              "appearance-none border-[#E8DBC6]",
              b.stateCode === "" ? "text-[#b3a288]" : "",
            )}
          >
            <option value="">Select…</option>
            {GST_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="bi-pincode" className={LABEL}>
            PIN code
          </label>
          <input
            id="bi-pincode"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="400001"
            value={b.pincode}
            onChange={(e) => onPincodeChange(e.target.value)}
            maxLength={6}
            className={cx(INPUT_BASE, "border-[#E8DBC6]")}
          />
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Step 3 — Payment                                                    */
/* ================================================================== */

function Step3Payment({
  co,
  summarySettings,
  onBack,
  onContinue,
}: {
  co: UseCheckout;
  summarySettings: CheckoutSummarySettings;
  onBack: () => void;
  onContinue: () => void;
}): ReactNode {
  // Master COD switch (store_settings `cod_enabled`, default false). When off
  // the whole Cash-on-Delivery option is HIDDEN — prepaid/online only — and the
  // server independently rejects COD placement (defense-in-depth).
  const codEnabled = summarySettings.codEnabled;
  const codAvailable = co.serviceability?.codAvailable ?? false;
  const total = co.quote?.totalPaise ?? 0;
  const codCap = summarySettings.codMaxOrderPaise;

  // COD eligibility (recomputed on render, checkout.md §7.7): pincode COD flag
  // AND order total ≤ cap. The RTO-flag check is authoritative server-side
  // (COD_UNAVAILABLE at quote/placement); the two client-visible signals are
  // gated here so the option disables live as the bag/total changes.
  const overCap = codCap > 0 && total > codCap;
  const codDisabled = !codAvailable || overCap;
  const codReason = !codAvailable
    ? "Cash on Delivery isn't available for this PIN code."
    : overCap
      ? `Cash on Delivery is unavailable over ${formatPaise(codCap)}.`
      : null;

  const needsOtp =
    codEnabled && co.paymentMode === "cod" && !co.codPhoneVerified;

  const pick = useCallback(
    (mode: "prepaid" | "cod") => {
      if (mode === "cod" && codDisabled) return;
      co.setPaymentMode(mode);
    },
    [co, codDisabled],
  );

  const billingValid =
    co.billingSameAsShipping || isAddressComplete(co.billingAddress);

  const canContinue =
    billingValid &&
    (co.paymentMode === "prepaid" ||
      (co.paymentMode === "cod" && co.codPhoneVerified));

  return (
    <div>
      <h1
        className="mb-6 text-[28px] text-ink"
        style={{ fontFamily: "var(--font-display), serif" }}
      >
        Payment
      </h1>

      <div className="mb-6 flex flex-col gap-3">
        <PaymentOption
          selected={co.paymentMode === "prepaid"}
          title="Pay online"
          subtitle="UPI, cards, net-banking via Razorpay"
          onClick={() => pick("prepaid")}
        />
        {codEnabled ? (
          <PaymentOption
            selected={co.paymentMode === "cod"}
            disabled={codDisabled}
            title="Cash on Delivery"
            subtitle="Pay in cash when your order arrives"
            reason={codReason}
            onClick={() => pick("cod")}
          />
        ) : null}
      </div>

      {needsOtp ? <CodOtpBlock co={co} /> : null}

      {/* Billing address (§ billing toggle) — default OFF ⇒ same as shipping. */}
      <div className="mt-6 border-t border-[#EADBC6] pt-6">
        <label className="flex cursor-pointer items-center gap-3 font-body text-[14px] text-espresso">
          <input
            type="checkbox"
            checked={!co.billingSameAsShipping}
            onChange={(e) => co.setBillingSameAsShipping(!e.target.checked)}
            className="h-[18px] w-[18px] accent-[#2a1d12]"
          />
          Billing address is different from shipping
        </label>
        {!co.billingSameAsShipping ? (
          <div className="mt-5">
            <BillingAddressFields co={co} />
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className={cx(GHOST_BTN, "flex-none", FOCUS_RING)}
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => {
            void co.refreshQuote();
            onContinue();
          }}
          disabled={!canContinue || co.quoteStatus === "loading"}
          className={cx(PRIMARY_BTN, "flex-1", FOCUS_RING)}
        >
          Review order
        </button>
      </div>
    </div>
  );
}

function PaymentOption({
  selected,
  disabled,
  title,
  subtitle,
  reason,
  onClick,
}: {
  selected: boolean;
  disabled?: boolean;
  title: string;
  subtitle: string;
  reason?: string | null;
  onClick: () => void;
}): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cx(
        "flex items-start gap-3 rounded-[14px] border-2 bg-[#F9F3EA] px-5 py-[18px] text-left transition-colors",
        disabled
          ? "cursor-not-allowed border-transparent opacity-55"
          : selected
            ? "border-ink"
            : "border-transparent hover:border-[#E0CFB6]",
        FOCUS_RING,
      )}
    >
      <span
        className={cx(
          "mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-pill border-2",
          selected ? "border-ink bg-ink" : "border-[#C9B394]",
        )}
      >
        {selected ? (
          <span className="h-2 w-2 rounded-pill bg-card" />
        ) : null}
      </span>
      <span className="flex-1">
        <span className="block font-body text-[15.5px] font-semibold text-ink">
          {title}
        </span>
        <span className="block font-body text-[13px] text-[#8a7a68]">
          {subtitle}
        </span>
        {reason !== null && reason !== undefined ? (
          <span className="mt-1 block font-body text-[12.5px] font-medium text-danger">
            {reason}
          </span>
        ) : null}
      </span>
    </button>
  );
}

/* ---- COD OTP (§2 step 4 / §1.3) ---- */

const OTP_LENGTH = 6;

function CodOtpBlock({ co }: { co: UseCheckout }): ReactNode {
  const [phase, setPhase] = useState<"prompt" | "entry">("prompt");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [digits, setDigits] = useState<string[]>(() =>
    Array<string>(OTP_LENGTH).fill(""),
  );
  const [requesting, setRequesting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upstream, setUpstream] = useState(false);
  const boxRefs = useRef<Array<HTMLInputElement | null>>([]);

  const code = digits.join("");

  const request = useCallback(async () => {
    if (requesting) return;
    setRequesting(true);
    setError(null);
    setUpstream(false);
    try {
      const response = await fetch("/api/checkout/cod-otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: co.contact.phone.trim() }),
      });
      const result = (await response.json()) as
        | { ok: true; data: { challengeId: string } }
        | { ok: false; error: { code: string; message: string } };
      if (result.ok) {
        setChallengeId(result.data.challengeId);
        setDigits(Array<string>(OTP_LENGTH).fill(""));
        setPhase("entry");
        requestAnimationFrame(() => boxRefs.current[0]?.focus());
        return;
      }
      if (result.error.code === "UPSTREAM_ERROR") {
        setUpstream(true);
        return;
      }
      setError(result.error.message);
    } catch {
      setUpstream(true);
    } finally {
      setRequesting(false);
    }
  }, [co.contact.phone, requesting]);

  const verify = useCallback(
    async (submitted: string) => {
      if (verifying || challengeId === null) return;
      if (submitted.length !== OTP_LENGTH) {
        setError("Enter the 6-digit code we sent you.");
        return;
      }
      setVerifying(true);
      setError(null);
      try {
        const response = await fetch("/api/checkout/cod-otp/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ challengeId, code: submitted }),
        });
        const result = (await response.json()) as
          | { ok: true; data: unknown }
          | { ok: false; error: { code: string; message: string } };
        if (result.ok) {
          // Hold the verified handle for placement (§1.3).
          co.setCodOtp({ challengeId, code: submitted });
          return;
        }
        if (result.error.code === "OTP_EXPIRED") {
          setPhase("prompt");
          setChallengeId(null);
          setError("That code expired — request a new one.");
        } else {
          setError(result.error.message);
          setDigits(Array<string>(OTP_LENGTH).fill(""));
          requestAnimationFrame(() => boxRefs.current[0]?.focus());
        }
      } catch {
        setError("Something went wrong — please try again.");
      } finally {
        setVerifying(false);
      }
    },
    [challengeId, verifying, co],
  );

  const setDigit = useCallback(
    (index: number, raw: string) => {
      const value = raw.replace(/\D/g, "");
      if (value === "") {
        setDigits((cur) => {
          const next = [...cur];
          next[index] = "";
          return next;
        });
        return;
      }
      setDigits((cur) => {
        const next = [...cur];
        let cursor = index;
        for (const char of value) {
          if (cursor >= OTP_LENGTH) break;
          next[cursor] = char;
          cursor += 1;
        }
        const focus = Math.min(cursor, OTP_LENGTH - 1);
        requestAnimationFrame(() => boxRefs.current[focus]?.focus());
        const joined = next.join("");
        if (joined.length === OTP_LENGTH) void verify(joined);
        return next;
      });
      setError(null);
    },
    [verify],
  );

  const onKeyDown = useCallback(
    (index: number, e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && digits[index] === "" && index > 0) {
        e.preventDefault();
        boxRefs.current[index - 1]?.focus();
      }
    },
    [digits],
  );

  const onPaste = useCallback(
    (e: ClipboardEvent<HTMLInputElement>) => {
      const pasted = e.clipboardData
        .getData("text")
        .replace(/\D/g, "")
        .slice(0, OTP_LENGTH);
      if (pasted === "") return;
      e.preventDefault();
      const next = Array<string>(OTP_LENGTH).fill("");
      for (let i = 0; i < pasted.length; i += 1) next[i] = pasted[i] ?? "";
      setDigits(next);
      setError(null);
      if (pasted.length === OTP_LENGTH) void verify(pasted);
    },
    [verify],
  );

  // Already verified — a confirmation panel, nothing to do.
  if (co.codOtp !== null) {
    return (
      <div className="mb-2 flex items-center gap-2 rounded-xl border border-[#E8DBC6] bg-[#F6EEE1] px-4 py-3 font-body text-[13.5px] font-medium text-[#5f6d3a]">
        <CheckIcon className="text-[#7C8A4E]" />
        Phone verified — you&apos;re ready to place a COD order.
      </div>
    );
  }

  return (
    <div className="mb-2 rounded-[14px] border border-[#E8DBC6] bg-[#F6EEE1] p-5">
      {phase === "prompt" ? (
        <>
          <p className="mb-3 font-body text-[14px] text-espresso">
            Verify your phone to place a Cash on Delivery order.
          </p>
          {error !== null ? (
            <FieldError id="cod-otp-prompt-err" message={error} />
          ) : null}
          {upstream ? (
            <div
              role="alert"
              className="mb-3 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 font-body text-[13px] text-danger"
            >
              Couldn&apos;t send the code — try again shortly.
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => void request()}
            disabled={requesting}
            className={cx(
              "flex items-center justify-center gap-2 rounded-pill bg-ink px-5 py-3 font-body text-[14px] font-bold text-card transition-colors hover:bg-[#3f2c1b] disabled:opacity-60",
              FOCUS_RING,
            )}
          >
            {requesting ? (
              <>
                <Spinner />
                Sending…
              </>
            ) : (
              "Verify phone"
            )}
          </button>
        </>
      ) : (
        <>
          <p className="mb-3 font-body text-[14px] text-espresso">
            Enter the 6-digit code sent to your phone.
          </p>
          <div
            className="flex justify-between gap-2"
            role="group"
            aria-label="COD verification code"
          >
            {digits.map((digit, index) => (
              <input
                // eslint-disable-next-line react/no-array-index-key
                key={index}
                ref={(el) => {
                  boxRefs.current[index] = el;
                }}
                type="text"
                inputMode="numeric"
                autoComplete={index === 0 ? "one-time-code" : "off"}
                maxLength={1}
                value={digit}
                disabled={verifying}
                aria-label={`Digit ${index + 1}`}
                onChange={(e) => setDigit(index, e.target.value)}
                onKeyDown={(e) => onKeyDown(index, e)}
                onPaste={onPaste}
                className={cx(
                  "h-[52px] w-full rounded-xl border bg-card text-center font-body text-[20px] font-semibold text-ink outline-none transition-colors focus:ring-2 focus:ring-gold disabled:opacity-60",
                  error !== null ? "border-danger" : "border-[#E8DBC6]",
                )}
              />
            ))}
          </div>
          {error !== null ? (
            <FieldError id="cod-otp-entry-err" message={error} />
          ) : null}
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => void verify(code)}
              disabled={verifying || code.length !== OTP_LENGTH}
              className={cx(
                "flex items-center justify-center gap-2 rounded-pill bg-ink px-5 py-2.5 font-body text-[14px] font-bold text-card transition-colors hover:bg-[#3f2c1b] disabled:opacity-60",
                FOCUS_RING,
              )}
            >
              {verifying ? "Verifying…" : "Verify"}
            </button>
            <button
              type="button"
              onClick={() => void request()}
              disabled={requesting}
              className={cx(
                "font-body text-[13px] font-semibold text-espresso underline disabled:opacity-60",
                FOCUS_RING,
              )}
            >
              Resend code
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ================================================================== */
/* Step 4 — Review                                                     */
/* ================================================================== */

function Step4Review({
  co,
  onBack,
  onPlace,
}: {
  co: UseCheckout;
  onBack: () => void;
  onPlace: () => void | Promise<void>;
}): ReactNode {
  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  // Fresh quote + a new idempotency key when Review first mounts (§2 step 5).
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    co.regenerateKey();
    void co.refreshQuote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyCoupon = useCallback(async () => {
    const code = couponInput.trim().toUpperCase();
    if (code === "") return;
    setApplyingCoupon(true);
    setCouponError(null);
    co.setCouponCode(code);
    const result = await co.refreshQuote();
    setApplyingCoupon(false);
    if (!result.ok) {
      setCouponError(result.error.message);
      return;
    }
    setCouponInput("");
  }, [couponInput, co]);

  const removeCoupon = useCallback(async () => {
    co.setCouponCode(null);
    setCouponError(null);
    await co.refreshQuote();
  }, [co]);

  const quote = co.quote;
  const a = co.address;

  return (
    <div>
      <h1
        className="mb-6 text-[28px] text-ink"
        style={{ fontFamily: "var(--font-display), serif" }}
      >
        Review your order
      </h1>

      {/* Ship-to + payment recap */}
      <div className="mb-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <div className="rounded-[14px] bg-[#F6EEE1] px-[18px] py-4">
          <p className="mb-2 font-mono text-[12px] uppercase tracking-[0.1em] text-[#8a5a34]">
            Ship to
          </p>
          <p className="font-body text-[14px] leading-relaxed text-ink">
            {a.fullName}
            <br />
            {a.line1}
            {a.line2 !== "" ? (
              <>
                <br />
                {a.line2}
              </>
            ) : null}
            <br />
            {a.city}, {a.state} {a.pincode}
            <br />
            +91 {a.phone}
          </p>
        </div>
        <div className="rounded-[14px] bg-[#F6EEE1] px-[18px] py-4">
          <p className="mb-2 font-mono text-[12px] uppercase tracking-[0.1em] text-[#8a5a34]">
            Payment &amp; delivery
          </p>
          <p className="font-body text-[14px] leading-relaxed text-ink">
            {co.paymentMode === "cod" ? "Cash on Delivery" : "Pay online"}
            <br />
            {co.deliveryOption === "express" ? "Express" : "Standard"} delivery
            {quote !== null && quote.etaDaysMin > 0 ? (
              <>
                <br />
                {quote.etaDaysMin}–{quote.etaDaysMax} business days
              </>
            ) : null}
          </p>
        </div>
      </div>

      {/* Coupon */}
      <div className="mb-5">
        {quote?.coupon != null ? (
          <div className="flex items-center justify-between rounded-[12px] border border-[#7C8A4E]/40 bg-[#7C8A4E]/10 px-4 py-3">
            <span className="font-body text-[13.5px] font-semibold text-[#5f6d3a]">
              {quote.coupon.code} applied · −{" "}
              {formatPaise(quote.coupon.discountPaise)}
            </span>
            <button
              type="button"
              onClick={() => void removeCoupon()}
              className={cx(
                "font-body text-[13px] font-semibold text-espresso underline",
                FOCUS_RING,
              )}
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              value={couponInput}
              onChange={(e) => {
                setCouponInput(e.target.value.toUpperCase());
                setCouponError(null);
              }}
              placeholder="Discount code"
              className={cx(
                "min-w-0 flex-1 rounded-pill border bg-[#F6EEE1] px-4 py-3 font-body text-[14px] font-medium text-ink outline-none placeholder:text-[#a08a72] focus:ring-2 focus:ring-gold",
                couponError !== null ? "border-danger" : "border-[#E8DBC6]",
              )}
            />
            <button
              type="button"
              onClick={() => void applyCoupon()}
              disabled={applyingCoupon || couponInput.trim() === ""}
              className={cx(
                "rounded-pill bg-card px-[18px] font-body text-[13.5px] font-bold text-ink transition-colors hover:bg-[#e8d6bc] disabled:opacity-50",
                FOCUS_RING,
              )}
            >
              {applyingCoupon ? "…" : "Apply"}
            </button>
          </div>
        )}
        {couponError !== null ? (
          <FieldError id="co-coupon-err" message={couponError} />
        ) : null}
      </div>

      {/* Line items + totals */}
      {quote === null || co.quoteStatus === "loading" ? (
        <div className="mb-6 space-y-3 rounded-[14px] border border-[#EADBC6] p-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-6 w-1/2" />
        </div>
      ) : co.quoteStatus === "error" ? (
        <div
          role="alert"
          className="mb-6 rounded-[14px] border border-danger/40 bg-danger/10 px-4 py-4"
        >
          <p className="font-body text-[14px] text-danger">
            {co.quoteError ?? "We couldn't load your order."}
          </p>
          <button
            type="button"
            onClick={() => void co.refreshQuote()}
            className={cx(
              "mt-2 font-body text-[13px] font-semibold text-espresso underline",
              FOCUS_RING,
            )}
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="mb-6 rounded-[14px] border border-[#EADBC6] px-[18px]">
          {quote.lines.map((line) => (
            <div
              key={line.itemId}
              className="flex items-center gap-3.5 border-b border-[#F0E4D2] py-3 last:border-b-0"
            >
              <div className="w-[44px] flex-none">
                <ChocoPlaceholder tone={line.tone} ratio="44 / 52" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-body text-[14.5px] font-semibold text-ink">
                  {line.name}
                </p>
                <p className="font-body text-[12.5px] text-[#8a7a68]">
                  Qty {line.qty}
                  {line.giftWrap ? " · Gift wrapped" : ""}
                </p>
              </div>
              <span className="font-body text-[15px] font-bold tabular-nums text-ink">
                {formatPaise(line.lineTotalPaise)}
              </span>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => void onPlace()}
        disabled={co.placing || quote === null || co.quoteStatus !== "ready"}
        className={cx(
          PRIMARY_BTN,
          "shadow-[0_12px_30px_rgba(42,29,18,.24)]",
          FOCUS_RING,
        )}
      >
        {co.placing ? (
          <>
            <Spinner />
            Placing order…
          </>
        ) : quote !== null ? (
          `Place order · ${formatPaise(quote.totalPaise)}`
        ) : (
          "Place order"
        )}
      </button>
      <button
        type="button"
        onClick={onBack}
        className={cx(
          "mt-3 w-full text-center font-body text-[13.5px] font-semibold text-[#6B5A49]",
          FOCUS_RING,
        )}
      >
        ← Back to payment
      </button>
    </div>
  );
}

/* ================================================================== */
/* Blocking failure sheets                                             */
/* ================================================================== */

function Backdrop({ children }: { children: ReactNode }): ReactNode {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 px-4 pb-4 backdrop-blur-[2px] sm:items-center sm:pb-0">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-[440px] rounded-[22px] bg-card p-6 shadow-[0_30px_70px_rgba(42,29,18,.3)]"
      >
        {children}
      </div>
    </div>
  );
}

function PriceChangedSheet({
  oldTotalPaise,
  quote,
  onAccept,
}: {
  oldTotalPaise: number;
  quote: CheckoutQuote;
  onAccept: () => void;
}): ReactNode {
  const delta = quote.totalPaise - oldTotalPaise;
  return (
    <Backdrop>
      <h2
        className="mb-2 text-[22px] text-ink"
        style={{ fontFamily: "var(--font-display), serif" }}
      >
        Your total changed
      </h2>
      <p className="mb-4 font-body text-[14px] leading-relaxed text-espresso">
        Prices have changed since you started checkout. Please review the
        updated total before placing your order.
      </p>
      <div className="mb-5 rounded-[14px] bg-[#F6EEE1] px-4 py-3">
        <div className="mb-2 flex items-baseline justify-between font-body text-[14px]">
          <span className="text-[#8a7a68] line-through">Previous</span>
          <span className="tabular-nums text-[#8a7a68] line-through">
            {formatPaise(oldTotalPaise)}
          </span>
        </div>
        <div className="flex items-baseline justify-between font-body">
          <span className="text-[15px] font-semibold text-ink">New total</span>
          <span className="text-[20px] font-bold tabular-nums text-ink">
            {formatPaise(quote.totalPaise)}
          </span>
        </div>
        <p className="mt-2 font-body text-[12.5px] text-[#8a7a68]">
          {delta > 0
            ? `That's ${formatPaise(delta)} more.`
            : delta < 0
              ? `That's ${formatPaise(-delta)} less.`
              : "The total is unchanged, but stock or delivery shifted."}
        </p>
      </div>
      <button type="button" onClick={onAccept} className={cx(PRIMARY_BTN, FOCUS_RING)}>
        Got it — review order
      </button>
    </Backdrop>
  );
}

function SoldOutSheet({
  lines,
  cart,
  quote,
  onClose,
}: {
  lines: SoldOutLine[];
  cart: CartView;
  quote: CheckoutQuote | null;
  onClose: () => void;
}): ReactNode {
  const source = quote?.lines ?? cart.lines;
  const nameFor = (variantId: string): string =>
    source.find((l) => l.variantId === variantId)?.name ?? "An item";
  return (
    <Backdrop>
      <h2
        className="mb-2 text-[22px] text-ink"
        style={{ fontFamily: "var(--font-display), serif" }}
      >
        Just sold out
      </h2>
      <p className="mb-4 font-body text-[14px] leading-relaxed text-espresso">
        Some items sold out while you were checking out. No order was placed and
        your card was not charged.
      </p>
      <ul className="mb-5 flex flex-col gap-2">
        {lines.map((line) => (
          <li
            key={line.variantId}
            className="rounded-[12px] bg-[#F6EEE1] px-4 py-3 font-body text-[13.5px] text-ink"
          >
            <span className="font-semibold">{nameFor(line.variantId)}</span> —{" "}
            {line.available > 0
              ? `only ${line.available} left (you wanted ${line.requested})`
              : "now out of stock"}
          </li>
        ))}
      </ul>
      <button type="button" onClick={onClose} className={cx(PRIMARY_BTN, FOCUS_RING)}>
        Update my bag
      </button>
    </Backdrop>
  );
}

function UpstreamSheet({
  message,
  retrying,
  onRetry,
  onClose,
}: {
  message: string;
  retrying: boolean;
  onRetry: () => void;
  onClose: () => void;
}): ReactNode {
  return (
    <Backdrop>
      <h2
        className="mb-2 text-[22px] text-ink"
        style={{ fontFamily: "var(--font-display), serif" }}
      >
        Payment setup failed
      </h2>
      <p className="mb-5 font-body text-[14px] leading-relaxed text-espresso">
        {message} You can try again.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className={cx(GHOST_BTN, "flex-none", FOCUS_RING)}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className={cx(PRIMARY_BTN, "flex-1", FOCUS_RING)}
        >
          {retrying ? "Retrying…" : "Retry payment"}
        </button>
      </div>
    </Backdrop>
  );
}

/* ================================================================== */
/* Razorpay script loader + types                                      */
/* ================================================================== */

interface RazorpayHandlerResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open: () => void;
}

type RazorpayConstructor = new (options: {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill: { contact: string; email?: string };
  handler: (response: RazorpayHandlerResponse) => void;
}) => RazorpayInstance;

let razorpayScriptPromise: Promise<boolean> | null = null;

/** Load the Razorpay Standard Checkout script once; resolves false on failure. */
function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (
    (window as unknown as { Razorpay?: RazorpayConstructor }).Razorpay !==
    undefined
  ) {
    return Promise.resolve(true);
  }
  if (razorpayScriptPromise !== null) return razorpayScriptPromise;
  razorpayScriptPromise = new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    script.src = RAZORPAY_SDK_URL;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      razorpayScriptPromise = null;
      resolve(false);
    };
    document.body.appendChild(script);
  });
  return razorpayScriptPromise;
}
