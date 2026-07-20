"use client";

/**
 * `useCheckout` — the client 4-step state machine (docs/modules/checkout.md §2).
 *
 * Owns: which step is active, the contact/address/delivery/payment/coupon
 * inputs, the serviceability lookup on pincode, the (always-fresh) quote, the
 * COD-OTP verification handle, and the terminal placement result. Every money
 * figure is server-derived — the hook stores display copies and the refs the
 * server needs (address, coupon code, expectedTotalPaise), never its own math.
 *
 * All network calls go through the Route Handlers (§5): serviceability, quote,
 * orders. Errors are surfaced as typed status flags the step components render
 * inline — the hook never throws for an expected failure.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import type {
  ApiResult,
  CheckoutQuote,
  DeliveryOption,
  PaymentMode,
  SavedAddress,
  ServiceabilityResult,
} from "@kakoa/core";

import type {
  AddressState,
  CheckoutStep,
  ContactState,
  PlacedOrder,
  QuoteStatus,
  ServiceabilityStatus,
  SoldOutLine,
  VerifiedCodOtp,
} from "./types";
import { savedAddressToState, toAddressInput, toTenDigitPhone } from "./types";

/** Prefill shape handed down from the RSC shell (logged-in customer). */
export interface CheckoutInitial {
  contact: { phone: string; email: string; name?: string };
  address: Partial<AddressState> | null;
  /**
   * The customer's saved address book, default-first (empty for guests). The
   * Step-1 smart-address surface branches on this: pick / edit / add instead of
   * always rendering the raw form (smart-address Phase 1).
   */
  savedAddresses: SavedAddress[];
  /** True when the visitor has a live authenticated session (drives State C/D). */
  loggedIn: boolean;
  /** True when a live session already has a verified matching phone (§7.8). */
  phoneVerified: boolean;
}

const EMPTY_ADDRESS: AddressState = {
  fullName: "",
  phone: "",
  line1: "",
  line2: "",
  landmark: "",
  city: "",
  state: "",
  stateCode: "",
  pincode: "",
};

/** A pincode that has passed the `^[1-9][0-9]{5}$` shape gate. */
function isPincodeShaped(pincode: string): boolean {
  return /^[1-9][0-9]{5}$/.test(pincode.trim());
}

export interface PlaceOrderOutcome {
  kind:
    | "placed"
    | "price_changed"
    | "out_of_stock"
    | "cart_expired"
    | "upstream"
    | "otp"
    | "error";
  /** For `price_changed` — the fresh server quote to diff and re-accept. */
  freshQuote?: CheckoutQuote;
  /** For `out_of_stock` — per-line sold-out markers. */
  soldOut?: SoldOutLine[];
  /** For `otp` — the OTP error message (incorrect / expired). */
  message?: string;
}

export interface UseCheckout {
  step: CheckoutStep;
  goToStep: (step: CheckoutStep) => void;

  contact: ContactState;
  setContact: (patch: Partial<ContactState>) => void;

  /** Prefill name for the "logged-in, no saved address" form (State C). */
  profileName: string;
  /** True when the visitor is authenticated (drives State C vs D). */
  loggedIn: boolean;

  address: AddressState;
  setAddress: (patch: Partial<AddressState>) => void;
  /** Replace the whole shipping address (picking a saved card, add/edit). */
  replaceAddress: (address: AddressState) => void;

  /** The customer's saved address book (default-first; empty for guests). */
  savedAddresses: SavedAddress[];
  /** Merge freshly-created / edited rows back into the in-memory book. */
  upsertSavedAddress: (address: SavedAddress) => void;
  /** Id of the saved address currently selected (null ⇒ form / guest). */
  selectedAddressId: string | null;
  setSelectedAddressId: (id: string | null) => void;

  /** When true, a new checkout address is saved to the book on placement. */
  saveToBook: boolean;
  setSaveToBook: (save: boolean) => void;

  /* billing (§ Step-3 billing toggle) */
  billingSameAsShipping: boolean;
  setBillingSameAsShipping: (same: boolean) => void;
  billingAddress: AddressState;
  setBillingAddress: (patch: Partial<AddressState>) => void;

  /* serviceability */
  serviceability: ServiceabilityResult | null;
  serviceabilityStatus: ServiceabilityStatus;
  checkServiceability: (pincode: string) => Promise<void>;

  /* delivery */
  deliveryOption: DeliveryOption;
  setDeliveryOption: (option: DeliveryOption) => void;

  /* gift wrap toggle is per-line in cart; checkout only surfaces the note */
  customerNote: string;
  setCustomerNote: (note: string) => void;

  /* payment */
  paymentMode: PaymentMode;
  setPaymentMode: (mode: PaymentMode) => void;
  /** True once the session has (or the customer has verified) a matching phone. */
  codPhoneVerified: boolean;
  codOtp: VerifiedCodOtp | null;
  setCodOtp: (otp: VerifiedCodOtp | null) => void;

  /* coupon */
  couponCode: string | null;
  setCouponCode: (code: string | null) => void;

  /* quote */
  quote: CheckoutQuote | null;
  quoteStatus: QuoteStatus;
  quoteError: string | null;
  refreshQuote: () => Promise<ApiResult<CheckoutQuote>>;

  /* placement */
  idempotencyKey: string;
  regenerateKey: () => void;
  placing: boolean;
  placeOrder: () => Promise<PlaceOrderOutcome>;
  placedOrder: PlacedOrder | null;
}

/** Read a quote/order error code off an ApiErr envelope. */
interface ApiErrShape {
  ok: false;
  error: { code: string; message: string; details?: unknown };
}

function isErr(result: unknown): result is ApiErrShape {
  return (
    typeof result === "object" &&
    result !== null &&
    "ok" in result &&
    (result as { ok: unknown }).ok === false
  );
}

export function useCheckout(initial: CheckoutInitial): UseCheckout {
  const [step, setStep] = useState<CheckoutStep>(1);

  const [contact, setContactState] = useState<ContactState>({
    phone: initial.contact.phone,
    email: initial.contact.email,
  });

  // The default saved address (already default-first from the server) seeds the
  // active shipping address so State A/B render pre-selected with no form.
  const defaultSaved = initial.savedAddresses[0] ?? null;

  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>(
    initial.savedAddresses,
  );
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    defaultSaved?.id ?? null,
  );

  const [address, setAddressState] = useState<AddressState>(() => {
    if (defaultSaved !== null) return savedAddressToState(defaultSaved);
    return {
      ...EMPTY_ADDRESS,
      ...(initial.address ?? {}),
      // Prefill recipient name/phone from the profile when logged-in (State C).
      fullName: initial.address?.fullName ?? initial.contact.name ?? "",
      phone: initial.address?.phone ?? initial.contact.phone,
    };
  });

  // Save-to-book toggle: default ON for logged-in customers with no book yet
  // (State C); irrelevant for guests (never surfaced) and for picked rows.
  const [saveToBook, setSaveToBook] = useState<boolean>(
    initial.loggedIn && initial.savedAddresses.length === 0,
  );

  /* billing */
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [billingAddress, setBillingAddressState] =
    useState<AddressState>(EMPTY_ADDRESS);

  const [serviceability, setServiceability] =
    useState<ServiceabilityResult | null>(null);
  const [serviceabilityStatus, setServiceabilityStatus] =
    useState<ServiceabilityStatus>("idle");

  const [deliveryOption, setDeliveryOptionState] =
    useState<DeliveryOption>("standard");
  const [customerNote, setCustomerNote] = useState("");

  const [paymentMode, setPaymentModeState] = useState<PaymentMode>("prepaid");
  const [codOtp, setCodOtp] = useState<VerifiedCodOtp | null>(null);

  const [couponCode, setCouponCode] = useState<string | null>(null);

  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [quoteStatus, setQuoteStatus] = useState<QuoteStatus>("idle");
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const [idempotencyKey, setIdempotencyKey] = useState<string>(() =>
    crypto.randomUUID(),
  );
  const [placing, setPlacing] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null);

  // The last pincode a serviceability response was fetched for — guards
  // against a stale in-flight response overwriting a newer lookup.
  const lastPincodeRef = useRef<string>("");

  const codPhoneVerified = initial.phoneVerified || codOtp !== null;

  const setContact = useCallback((patch: Partial<ContactState>): void => {
    setContactState((prev) => ({ ...prev, ...patch }));
  }, []);

  const setAddress = useCallback((patch: Partial<AddressState>): void => {
    setAddressState((prev) => ({ ...prev, ...patch }));
  }, []);

  const replaceAddress = useCallback((next: AddressState): void => {
    setAddressState(next);
  }, []);

  const upsertSavedAddress = useCallback((row: SavedAddress): void => {
    setSavedAddresses((prev) => {
      const withoutRow = prev.filter((a) => a.id !== row.id);
      // If this row is now the default, demote every other row locally so the
      // "Default" badge never shows twice before the next server round-trip.
      const normalised = row.isDefault
        ? withoutRow.map((a) => ({ ...a, isDefault: false }))
        : withoutRow;
      const merged = [...normalised, row];
      // Keep default-first ordering to match the server list.
      return merged.sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
    });
  }, []);

  const setBillingAddress = useCallback((patch: Partial<AddressState>): void => {
    setBillingAddressState((prev) => ({ ...prev, ...patch }));
  }, []);

  const goToStep = useCallback((next: CheckoutStep): void => {
    setStep(next);
  }, []);

  /* ---- serviceability (§5.1) ---- */

  const checkServiceability = useCallback(
    async (pincode: string): Promise<void> => {
      const trimmed = pincode.trim();
      if (!isPincodeShaped(trimmed)) {
        setServiceability(null);
        setServiceabilityStatus("idle");
        return;
      }
      lastPincodeRef.current = trimmed;
      setServiceabilityStatus("loading");
      try {
        const response = await fetch(
          `/api/shipping/serviceability?pincode=${encodeURIComponent(trimmed)}&cod=true`,
          { cache: "no-store" },
        );
        // A newer lookup started while this was in flight — drop this result.
        if (lastPincodeRef.current !== trimmed) return;
        const result = (await response.json()) as ApiResult<ServiceabilityResult>;
        if (result.ok) {
          setServiceability(result.data);
          setServiceabilityStatus(
            result.data.serviceable ? "serviceable" : "unserviceable",
          );
          return;
        }
        if (isErr(result) && result.error.code === "PINCODE_UNSERVICEABLE") {
          setServiceability({
            serviceable: false,
            codAvailable: false,
            options: [],
          });
          setServiceabilityStatus("unserviceable");
          return;
        }
        if (isErr(result) && result.error.code === "UPSTREAM_ERROR") {
          // Degrade: standard-only, verified at dispatch (§2 step 2).
          setServiceability({
            serviceable: true,
            codAvailable: false,
            options: [
              {
                option: "standard",
                feePaise: 0,
                etaDaysMin: 3,
                etaDaysMax: 5,
              },
            ],
          });
          setServiceabilityStatus("fallback");
          return;
        }
        setServiceabilityStatus("error");
      } catch {
        if (lastPincodeRef.current !== trimmed) return;
        setServiceabilityStatus("error");
      }
    },
    [],
  );

  const setDeliveryOption = useCallback((option: DeliveryOption): void => {
    setDeliveryOptionState(option);
  }, []);

  const setPaymentMode = useCallback((mode: PaymentMode): void => {
    setPaymentModeState(mode);
    // Switching away from COD drops any held OTP handle.
    if (mode !== "cod") setCodOtp(null);
  }, []);

  /* ---- quote (§5.2) — always fresh, never cached ---- */

  const buildQuoteBody = useCallback(() => {
    const body: {
      pincode: string;
      deliveryOption: DeliveryOption;
      paymentMode: PaymentMode;
      couponCode?: string;
    } = {
      pincode: address.pincode.trim(),
      deliveryOption,
      paymentMode,
    };
    if (couponCode !== null && couponCode.trim() !== "") {
      body.couponCode = couponCode.trim().toUpperCase();
    }
    return body;
  }, [address.pincode, deliveryOption, paymentMode, couponCode]);

  const refreshQuote = useCallback(async (): Promise<ApiResult<CheckoutQuote>> => {
    setQuoteStatus("loading");
    setQuoteError(null);
    try {
      const response = await fetch("/api/checkout/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildQuoteBody()),
      });
      const result = (await response.json()) as ApiResult<{
        quote: CheckoutQuote;
      }>;
      if (result.ok) {
        setQuote(result.data.quote);
        setQuoteStatus("ready");
        return { ok: true, data: result.data.quote } as ApiResult<CheckoutQuote>;
      }
      // Coupon codes auto-detach: clear the applied code so the next quote is clean.
      if (isErr(result) && result.error.code.startsWith("COUPON_")) {
        setCouponCode(null);
      }
      setQuoteStatus("error");
      setQuoteError(result.error.message);
      return result as ApiResult<CheckoutQuote>;
    } catch {
      setQuoteStatus("error");
      setQuoteError("We couldn't refresh your total. Please try again.");
      return {
        ok: false,
        error: {
          code: "INTERNAL",
          message: "We couldn't refresh your total. Please try again.",
        },
      } as unknown as ApiResult<CheckoutQuote>;
    }
  }, [buildQuoteBody]);

  const regenerateKey = useCallback((): void => {
    setIdempotencyKey(crypto.randomUUID());
  }, []);

  /* ---- placement (§5.3) ---- */

  const placeOrder = useCallback(async (): Promise<PlaceOrderOutcome> => {
    if (quote === null) return { kind: "error" };
    setPlacing(true);
    try {
      const body: Record<string, unknown> = {
        idempotencyKey,
        contact: {
          phone: toTenDigitPhone(contact.phone),
          ...(contact.email.trim() !== ""
            ? { email: contact.email.trim() }
            : {}),
        },
        shippingAddress: toAddressInput(address),
        deliveryOption,
        paymentMode,
        expectedTotalPaise: quote.totalPaise,
      };
      if (!billingSameAsShipping) {
        body["billingAddress"] = toAddressInput(billingAddress);
      }
      if (couponCode !== null && couponCode.trim() !== "") {
        body["couponCode"] = couponCode.trim().toUpperCase();
      }
      if (customerNote.trim() !== "") body["customerNote"] = customerNote.trim();
      if (paymentMode === "cod" && codOtp !== null) body["codOtp"] = codOtp;

      const response = await fetch("/api/checkout/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as ApiResult<{
        paymentMode: PaymentMode;
        orderId: string;
        orderNumber: string;
        accessToken: string;
        razorpay?: PlacedOrder["razorpay"];
      }>;

      if (result.ok) {
        const placed: PlacedOrder = {
          orderId: result.data.orderId,
          orderNumber: result.data.orderNumber,
          accessToken: result.data.accessToken,
          paymentMode: result.data.paymentMode,
          razorpay: result.data.razorpay ?? null,
        };
        setPlacedOrder(placed);
        return { kind: "placed" };
      }

      if (!isErr(result)) return { kind: "error" };
      switch (result.error.code) {
        case "PRICE_CHANGED": {
          const details = result.error.details as
            | { quote?: CheckoutQuote }
            | undefined;
          if (details?.quote !== undefined) {
            setQuote(details.quote);
            return { kind: "price_changed", freshQuote: details.quote };
          }
          return { kind: "price_changed" };
        }
        case "OUT_OF_STOCK": {
          const details = result.error.details as
            | { lines?: SoldOutLine[] }
            | SoldOutLine[]
            | undefined;
          const soldOut = Array.isArray(details) ? details : details?.lines;
          return { kind: "out_of_stock", soldOut: soldOut ?? [] };
        }
        case "CART_EXPIRED":
          return { kind: "cart_expired" };
        case "OTP_INCORRECT":
        case "OTP_EXPIRED":
          return { kind: "otp", message: result.error.message };
        case "UPSTREAM_ERROR":
          // Razorpay create failed, stock released — mint a NEW key (§5.3).
          setIdempotencyKey(crypto.randomUUID());
          return { kind: "upstream", message: result.error.message };
        default:
          return { kind: "error", message: result.error.message };
      }
    } catch {
      return { kind: "error" };
    } finally {
      setPlacing(false);
    }
  }, [
    quote,
    idempotencyKey,
    contact,
    address,
    billingSameAsShipping,
    billingAddress,
    deliveryOption,
    paymentMode,
    couponCode,
    customerNote,
    codOtp,
  ]);

  return useMemo<UseCheckout>(
    () => ({
      step,
      goToStep,
      contact,
      setContact,
      profileName: initial.contact.name ?? "",
      loggedIn: initial.loggedIn,
      address,
      setAddress,
      replaceAddress,
      savedAddresses,
      upsertSavedAddress,
      selectedAddressId,
      setSelectedAddressId,
      saveToBook,
      setSaveToBook,
      billingSameAsShipping,
      setBillingSameAsShipping,
      billingAddress,
      setBillingAddress,
      serviceability,
      serviceabilityStatus,
      checkServiceability,
      deliveryOption,
      setDeliveryOption,
      customerNote,
      setCustomerNote,
      paymentMode,
      setPaymentMode,
      codPhoneVerified,
      codOtp,
      setCodOtp,
      couponCode,
      setCouponCode,
      quote,
      quoteStatus,
      quoteError,
      refreshQuote,
      idempotencyKey,
      regenerateKey,
      placing,
      placeOrder,
      placedOrder,
    }),
    [
      step,
      goToStep,
      contact,
      setContact,
      initial.contact.name,
      initial.loggedIn,
      address,
      setAddress,
      replaceAddress,
      savedAddresses,
      upsertSavedAddress,
      selectedAddressId,
      saveToBook,
      billingSameAsShipping,
      billingAddress,
      setBillingAddress,
      serviceability,
      serviceabilityStatus,
      checkServiceability,
      deliveryOption,
      setDeliveryOption,
      customerNote,
      paymentMode,
      setPaymentMode,
      codPhoneVerified,
      codOtp,
      couponCode,
      quote,
      quoteStatus,
      quoteError,
      refreshQuote,
      idempotencyKey,
      regenerateKey,
      placing,
      placeOrder,
      placedOrder,
    ],
  );
}
