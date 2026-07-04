/**
 * `/checkout` — the 4-step checkout entry (checkout.md §2).
 *
 * Server component: loads the active cart (empty ⇒ redirect to `/cart`),
 * the logged-in customer (contact prefill + phone-verified flag for COD),
 * and the fee/policy thresholds for the summary panel. Everything money-
 * truthful is re-derived by the quote/placement Route Handlers — this shell
 * only hands down display refs and prefill.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { SavedAddress } from "@kakoa/core";
import { getCart } from "@/lib/cart/actions";
import { getCurrentCustomer } from "@/lib/auth/session";
import { loadCustomerAddresses } from "@/lib/auth/account-data";
import { loadCheckoutSettings } from "@/lib/checkout/settings";
import { CheckoutClient } from "@/components/checkout/CheckoutClient";
import type { CheckoutInitial } from "@/components/checkout/useCheckout";
import type { CheckoutSummarySettings } from "@/components/checkout/types";

export const metadata: Metadata = {
  title: "Checkout · Kakoa",
  robots: { index: false, follow: false },
};

// Money-truthful path — never statically cached.
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const cart = await getCart();

  // Empty / expired cart never reaches the wizard (checkout.md §2 step 1).
  if (cart.lines.length === 0) {
    redirect("/cart");
  }

  const [customer, settings] = await Promise.all([
    getCurrentCustomer(),
    loadCheckoutSettings(),
  ]);

  // Contact prefill: a live customer's phone/email seeds Step 1. The phone
  // is already E.164 (`+91…`) in the DB — strip the prefix to the 10-digit
  // input the form binds to.
  const rawPhone = customer?.phone ?? "";
  const phoneInput = rawPhone.startsWith("+91") ? rawPhone.slice(3) : rawPhone;
  const phoneVerified =
    customer?.phone != null && customer.phoneVerifiedAt != null;

  // Saved-address book (smart-address Phase 1): a logged-in customer's addresses
  // are loaded default-first so Step 1 can auto-select the default card and let
  // them switch/edit/add. Guests get an empty book and the form-first flow.
  const savedAddresses: SavedAddress[] = customer
    ? (await loadCustomerAddresses(customer.id)).map((row) => ({
        id: row.id,
        label: row.label,
        fullName: row.fullName,
        phone: row.phone,
        line1: row.line1,
        ...(row.line2 !== null ? { line2: row.line2 } : {}),
        ...(row.landmark !== null ? { landmark: row.landmark } : {}),
        city: row.city,
        state: row.state,
        stateCode: row.stateCode,
        pincode: row.pincode,
        isDefault: row.isDefault,
      }))
    : [];

  const initial: CheckoutInitial = {
    contact: {
      phone: phoneInput,
      email: customer?.email ?? "",
      ...(customer?.name ? { name: customer.name } : {}),
    },
    // Legacy single-address prefill stays null; the picker consumes
    // `savedAddresses` and seeds Step 1 from the chosen/default card.
    address: null,
    savedAddresses,
    loggedIn: customer !== null,
    phoneVerified,
  };

  const summary: CheckoutSummarySettings = {
    freeShippingThresholdPaise: settings.freeShippingThresholdPaise,
    giftWrapFeePaise: settings.giftWrapFeePaise,
    codFeePaise: settings.codFeePaise,
    codMaxOrderPaise: settings.codMaxOrderPaise,
    codEnabled: settings.codEnabled,
  };

  return (
    <CheckoutClient initial={initial} cart={cart} summarySettings={summary} />
  );
}
