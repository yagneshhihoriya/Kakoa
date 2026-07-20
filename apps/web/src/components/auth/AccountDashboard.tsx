"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  formatIST,
  formatPaise,
  type CustomerView,
  type OrderStatus,
  type SavedAddress,
} from "@kakoa/core";
import { cx } from "@kakoa/ui";
import { useToast } from "@kakoa/ui/client";
import { useAddresses } from "@/components/account/useAddresses";
import {
  AddressForm,
  addressToFormValues,
  EMPTY_ADDRESS_FORM,
  type AddressFormValues,
} from "@/components/account/AddressForm";
import { LogoutButton } from "./LogoutButton";
import { CustomerAvatar } from "./CustomerAvatar";

/* ------------------------------------------------------------------ */
/* Serialized props (dates as ISO strings — server → client boundary)  */
/* ------------------------------------------------------------------ */

export interface AccountOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  placedAtIso: string;
  totalPaise: number;
  itemCount: number;
  /** A tax invoice is available (order confirmed) — enables the Invoice actions. */
  invoiceAvailable: boolean;
}

export interface AccountAddress {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  /** GST state code — needed to seed the edit form's state dropdown. */
  stateCode: string;
  pincode: string;
  isDefault: boolean;
}

/** Normalise the RSC's serialized row into the API `SavedAddress` shape. */
function toSavedAddress(a: AccountAddress): SavedAddress {
  return {
    id: a.id,
    label: a.label,
    fullName: a.fullName,
    phone: a.phone,
    line1: a.line1,
    ...(a.line2 !== null && a.line2 !== "" ? { line2: a.line2 } : {}),
    ...(a.landmark !== null && a.landmark !== "" ? { landmark: a.landmark } : {}),
    city: a.city,
    state: a.state,
    stateCode: a.stateCode,
    pincode: a.pincode,
    isDefault: a.isDefault,
  };
}

export interface AccountWishlistItem {
  productId: string;
  slug: string;
  name: string;
  fromPricePaise: number;
}

export interface AccountDashboardProps {
  customer: CustomerView;
  orders: AccountOrder[];
  addresses: AccountAddress[];
  wishlist: AccountWishlistItem[];
  /** Non-fatal partial-load flag — one section failed to load server-side. */
  loadError?: boolean;
}

type Tab = "orders" | "addresses" | "wishlist" | "profile";

const TABS: ReadonlyArray<{ key: Tab; label: string }> = [
  { key: "orders", label: "Orders" },
  { key: "addresses", label: "Addresses" },
  { key: "wishlist", label: "Wishlist" },
  { key: "profile", label: "Profile" },
];

/** Crisp stroke icons for the account nav (replaces the old glyph chars). */
function TabIcon({ tab }: { tab: Tab }): ReactNode {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (tab) {
    case "orders":
      return (
        <svg {...common}>
          <path d="M6 2h9l3 3v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" />
          <path d="M9 8h6M9 12h6M9 16h4" />
        </svg>
      );
    case "addresses":
      return (
        <svg {...common}>
          <path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );
    case "wishlist":
      return (
        <svg {...common}>
          <path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.4-7 10-7 10Z" />
        </svg>
      );
    case "profile":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
        </svg>
      );
  }
}

function LogoutIcon(): ReactNode {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 17l5-5-5-5M20 12H9M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
    </svg>
  );
}

/** Human-readable order status + prototype badge palette. */
const STATUS_META: Record<OrderStatus, { label: string; bg: string; fg: string }> = {
  pending_payment: { label: "Payment pending", bg: "#F5E3C4", fg: "#9A6B1E" },
  payment_failed: { label: "Payment failed", bg: "#F6D9D9", fg: "#B2453F" },
  cod_pending_confirmation: { label: "Confirming", bg: "#F5E3C4", fg: "#9A6B1E" },
  confirmed: { label: "Confirmed", bg: "#E1EAD0", fg: "#5C6B34" },
  packed: { label: "Packed", bg: "#E1EAD0", fg: "#5C6B34" },
  shipped: { label: "Shipped", bg: "#DCE6EF", fg: "#3D5A73" },
  out_for_delivery: { label: "Out for delivery", bg: "#DCE6EF", fg: "#3D5A73" },
  delivered: { label: "Delivered", bg: "#E1EAD0", fg: "#5C6B34" },
  cancelled: { label: "Cancelled", bg: "#EDE6DD", fg: "#7A6A58" },
  rto_initiated: { label: "Return in transit", bg: "#F6D9D9", fg: "#B2453F" },
  rto_delivered: { label: "Returned", bg: "#EDE6DD", fg: "#7A6A58" },
};

const CARD = "rounded-[18px] border border-[#EEE1CE] bg-white";
const SERIF = { fontFamily: "var(--font-display), serif" } as const;

/**
 * Account dashboard shell (prototype 61-dashboard.html): sticky sidebar with
 * avatar + nav + logout, and a content pane that switches between Orders,
 * Addresses, Wishlist and Profile. Address/wishlist are read-only in Module 3
 * (full CRUD lands with the accounts module); all money via `formatPaise`, all
 * dates via `formatIST`. Renders empty/partial/error states per section.
 */
export function AccountDashboard({
  customer,
  orders,
  addresses,
  wishlist,
  loadError = false,
}: AccountDashboardProps): ReactNode {
  const [tab, setTab] = useState<Tab>("orders");
  const displayName = customer.name ?? "there";

  return (
    <main className="mx-auto max-w-[1240px] px-8 pb-[72px] pt-[34px] max-[900px]:px-5">
      <div className="grid grid-cols-[262px_1fr] items-start gap-9 max-[900px]:grid-cols-1 max-[900px]:gap-6">
        {/* SIDEBAR */}
        <aside
          className={cx(
            CARD,
            "sticky top-[98px] p-[22px] max-[900px]:static max-[900px]:p-4",
          )}
        >
          <div className="mb-4 flex items-center gap-3 border-b border-[#EADBC6] pb-5 max-[900px]:mb-3 max-[900px]:pb-4">
            <CustomerAvatar
              name={customer.name}
              phone={customer.phone}
              email={customer.email}
              size={48}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate font-body text-[15.5px] font-semibold text-ink">
                {customer.name ?? "KAKOA member"}
              </div>
              <div className="truncate font-body text-[12.5px] text-[#8a7a68]">
                {customer.phone ?? customer.email ?? ""}
              </div>
            </div>
            {/* Mobile-only logout — desktop keeps the bottom row. */}
            <LogoutButton className="hidden shrink-0 rounded-pill border border-[#EADBC6] px-3.5 py-1.5 font-body text-[12.5px] font-semibold text-[#a08a72] transition-colors hover:text-raspberry max-[900px]:inline-block">
              Log out
            </LogoutButton>
          </div>

          {/* Nav — vertical rail on desktop; horizontal scroll pill-tabs on mobile. */}
          <div className="flex flex-col gap-1 max-[900px]:-mx-1 max-[900px]:flex-row max-[900px]:gap-2 max-[900px]:overflow-x-auto max-[900px]:px-1 max-[900px]:pb-1 max-[900px]:[scrollbar-width:none] max-[900px]:[&::-webkit-scrollbar]:hidden">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                aria-current={tab === t.key ? "page" : undefined}
                className={cx(
                  "flex items-center gap-3 rounded-[12px] px-[14px] py-3 text-left font-body text-[14.5px] font-semibold transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
                  "max-[900px]:shrink-0 max-[900px]:gap-2 max-[900px]:whitespace-nowrap max-[900px]:rounded-pill max-[900px]:border max-[900px]:px-3.5 max-[900px]:py-2.5",
                  tab === t.key
                    ? "bg-ink text-card max-[900px]:border-ink"
                    : "text-espresso hover:bg-[#F3E7D5] max-[900px]:border-[#EADBC6]",
                )}
              >
                <span className="grid w-[18px] place-items-center max-[900px]:w-auto">
                  <TabIcon tab={t.key} />
                </span>
                {t.label}
              </button>
            ))}
          </div>

          <LogoutButton className="mt-[14px] flex w-full items-center gap-3 rounded-none border-t border-[#EADBC6] px-[14px] pt-[18px] pb-3 text-left font-body text-[14.5px] font-semibold text-[#a08a72] transition-colors hover:text-raspberry max-[900px]:hidden">
            <span className="grid w-[18px] place-items-center">
              <LogoutIcon />
            </span>
            Log out
          </LogoutButton>
        </aside>

        {/* CONTENT */}
        <div>
          {loadError ? (
            <div
              role="alert"
              className="mb-6 rounded-[14px] border border-danger/40 bg-danger/10 px-5 py-4 font-body text-[13.5px] text-danger"
            >
              Some of your account details couldn't be loaded. Please refresh to
              try again.
            </div>
          ) : null}

          {tab === "orders" ? (
            <OrdersSection orders={orders} name={displayName} />
          ) : null}
          {tab === "addresses" ? (
            <AddressesSection addresses={addresses} />
          ) : null}
          {tab === "wishlist" ? (
            <WishlistSection wishlist={wishlist} />
          ) : null}
          {tab === "profile" ? (
            <ProfileSection customer={customer} />
          ) : null}
        </div>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

function SectionHeading({ children }: { children: ReactNode }): ReactNode {
  return (
    <h1 className="mb-6 text-[36px] leading-none text-ink" style={SERIF}>
      {children}
    </h1>
  );
}

function OrdersSection({
  orders,
  name,
}: {
  orders: AccountOrder[];
  name: string;
}): ReactNode {
  if (orders.length === 0) {
    return (
      <>
        <SectionHeading>Welcome back, {name}</SectionHeading>
        <EmptyState
          title="No orders yet"
          body="When you place an order it'll show up here with live tracking."
          ctaHref="/shop"
          ctaLabel="Browse chocolates"
        />
        <p className="mt-5 font-body text-[13px] text-[#8a7a68]">
          Placed an order as a guest?{" "}
          <Link
            href={"/account/track" as Route}
            className="font-semibold text-espresso underline"
          >
            Track it with your order number
          </Link>
          .
        </p>
      </>
    );
  }
  return (
    <>
      <SectionHeading>My orders</SectionHeading>
      <div className="flex flex-col gap-[14px]">
        {orders.map((order, index) => {
          const meta = STATUS_META[order.status];
          return (
            <div
              key={order.id}
              style={{ animationDelay: `${index * 55}ms` }}
              className={cx(
                CARD,
                "flex flex-wrap items-center gap-4 p-5 transition-all duration-200 ease-out",
                "animate-[kk-rise_0.45s_ease_both] hover:-translate-y-0.5 hover:border-[#e0cfb6] hover:shadow-[0_12px_28px_-14px_rgba(42,29,18,0.35)]",
                "motion-reduce:animate-none motion-reduce:transition-none motion-reduce:hover:translate-y-0",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-[10px]">
                  <Link
                    href={`/account/orders/${order.orderNumber}` as Route}
                    className="font-body text-[16px] font-semibold text-ink no-underline hover:text-[#8a5a34]"
                  >
                    Order #{order.orderNumber}
                  </Link>
                  <span
                    className="rounded-pill px-[10px] py-1 font-body text-[11.5px] font-semibold"
                    style={{ background: meta.bg, color: meta.fg }}
                  >
                    {meta.label}
                  </span>
                </div>
                <div className="font-body text-[13px] text-[#8a7a68]">
                  {formatIST(new Date(order.placedAtIso))} ·{" "}
                  {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="font-body text-[17px] font-bold text-ink">
                    {formatPaise(order.totalPaise)}
                  </div>
                </div>
                <Link
                  href={`/account/orders/${order.orderNumber}` as Route}
                  className="rounded-pill bg-ink px-[18px] py-2.5 font-body text-[12.5px] font-semibold text-card no-underline transition-colors hover:bg-[#3f2c1b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  Track
                </Link>
              </div>

              {/* Actions row: order details only — invoice actions live on the
                  order detail page (single entry point). */}
              <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#EEE1CE] pt-3 font-body text-[13px]">
                <Link href={`/account/orders/${order.orderNumber}` as Route} className="font-semibold text-espresso underline">
                  View details
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-5 font-body text-[13px] text-[#8a7a68]">
        Placed an order without signing in?{" "}
        <Link
          href={"/account/track" as Route}
          className="font-semibold text-espresso underline"
        >
          Track it with your order number
        </Link>
        .
      </p>
    </>
  );
}

/** Create/update payload from the shared form values. */
function toWirePayload(v: AddressFormValues): {
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
  isDefault: boolean;
} {
  const out = {
    label: v.label.trim(),
    fullName: v.fullName.trim(),
    phone: v.phone.trim(),
    line1: v.line1.trim(),
    city: v.city.trim(),
    state: v.state,
    stateCode: v.stateCode,
    pincode: v.pincode.trim(),
    isDefault: v.isDefault,
  } as ReturnType<typeof toWirePayload>;
  const line2 = v.line2.trim();
  if (line2 !== "") out.line2 = line2;
  const landmark = v.landmark.trim();
  if (landmark !== "") out.landmark = landmark;
  return out;
}

type AddressPane =
  | { kind: "list" }
  | { kind: "add" }
  | { kind: "edit"; address: SavedAddress };

function AddressesSection({
  addresses,
}: {
  addresses: AccountAddress[];
}): ReactNode {
  const { toast } = useToast();
  const book = useAddresses(addresses.map(toSavedAddress));
  const [pane, setPane] = useState<AddressPane>({ kind: "list" });
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SavedAddress | null>(null);

  // Refresh from the API on mount so full rows (incl. stateCode / landmark)
  // back the edit form even if the RSC seed was partial.
  useEffect(() => {
    void book.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = book.addresses;

  const handleCreate = async (values: AddressFormValues): Promise<void> => {
    setFormError(null);
    const result = await book.create(toWirePayload(values));
    if (result.ok) {
      setPane({ kind: "list" });
      toast({ kind: "success", message: "Address saved." });
      return;
    }
    setFormError(result.error.message);
  };

  const handleUpdate = async (
    id: string,
    values: AddressFormValues,
  ): Promise<void> => {
    setFormError(null);
    const result = await book.update({ id, ...toWirePayload(values) });
    if (result.ok) {
      setPane({ kind: "list" });
      toast({ kind: "success", message: "Address updated." });
      return;
    }
    setFormError(result.error.message);
  };

  const handleDelete = async (id: string): Promise<void> => {
    const result = await book.remove(id);
    setConfirmDelete(null);
    if (result.ok) {
      toast({ kind: "success", message: "Address removed." });
      return;
    }
    toast({ kind: "error", message: result.error.message });
  };

  const handleSetDefault = async (id: string): Promise<void> => {
    const result = await book.setDefault(id);
    if (!result.ok) {
      toast({ kind: "error", message: result.error.message });
    }
  };

  if (pane.kind === "add" || pane.kind === "edit") {
    return (
      <>
        <SectionHeading>
          {pane.kind === "add" ? "Add an address" : "Edit address"}
        </SectionHeading>
        <div className={cx(CARD, "max-w-[640px] p-[26px]")}>
          <AddressForm
            submitLabel={pane.kind === "add" ? "Save address" : "Save changes"}
            submitting={book.busy}
            formError={formError}
            showDefaultToggle={pane.kind === "edit" || rows.length > 0}
            initial={
              pane.kind === "edit"
                ? addressToFormValues(pane.address)
                : { ...EMPTY_ADDRESS_FORM, isDefault: rows.length === 0 }
            }
            onSubmit={(values) =>
              void (pane.kind === "edit"
                ? handleUpdate(pane.address.id, values)
                : handleCreate(values))
            }
            onCancel={() => {
              setFormError(null);
              setPane({ kind: "list" });
            }}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <SectionHeadingInline>Address book</SectionHeadingInline>
        {rows.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setPane({ kind: "add" });
            }}
            className="rounded-pill bg-ink px-[18px] py-2.5 font-body text-[13.5px] font-semibold text-card transition-colors hover:bg-[#3f2c1b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            + Add address
          </button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <div className={cx(CARD, "px-6 py-[60px] text-center")}>
          <div className="mb-2 text-[22px] text-ink" style={SERIF}>
            No saved addresses
          </div>
          <div className="mb-5 font-body text-[14px] text-espresso">
            Add an address once and reuse it at checkout every time.
          </div>
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setPane({ kind: "add" });
            }}
            className="inline-block rounded-pill bg-ink px-[26px] py-[13px] font-body text-[14px] font-semibold text-card transition-colors hover:bg-[#3f2c1b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            Add your first address
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 max-[720px]:grid-cols-1">
          {rows.map((address) => (
            <div key={address.id} className={cx(CARD, "flex flex-col p-[22px]")}>
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.1em] text-[#8a5a34]">
                  {address.label}
                </span>
                {address.isDefault ? (
                  <span className="rounded-pill bg-[#E1EAD0] px-[10px] py-1 font-body text-[11px] font-semibold text-[#5C6B34]">
                    Default
                  </span>
                ) : null}
              </div>
              <div className="flex-1 font-body text-[15px] leading-[1.6] text-ink">
                {address.fullName}
                <br />
                {address.line1}
                {address.line2 !== undefined && address.line2 !== "" ? (
                  <>
                    <br />
                    {address.line2}
                  </>
                ) : null}
                <br />
                {address.city}, {address.state} {address.pincode}
                <br />
                {address.phone}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#EEE1CE] pt-4">
                {!address.isDefault ? (
                  <button
                    type="button"
                    onClick={() => void handleSetDefault(address.id)}
                    disabled={book.busy}
                    className="font-body text-[13px] font-semibold text-[#5f6d3a] underline disabled:opacity-50"
                  >
                    Set as default
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setFormError(null);
                    setPane({ kind: "edit", address });
                  }}
                  className="font-body text-[13px] font-semibold text-espresso underline"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(address)}
                  disabled={book.busy}
                  className="ml-auto font-body text-[13px] font-semibold text-raspberry underline disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmDelete !== null ? (
        <DeleteAddressDialog
          address={confirmDelete}
          busy={book.busy}
          onConfirm={() => void handleDelete(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
        />
      ) : null}
    </>
  );
}

/** Section heading variant that sits inline next to an action button. */
function SectionHeadingInline({ children }: { children: ReactNode }): ReactNode {
  return (
    <h1 className="text-[36px] leading-none text-ink" style={SERIF}>
      {children}
    </h1>
  );
}

function DeleteAddressDialog({
  address,
  busy,
  onConfirm,
  onCancel,
}: {
  address: SavedAddress;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}): ReactNode {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 px-4 backdrop-blur-[2px]">
      <button
        type="button"
        aria-label="Cancel"
        onClick={onCancel}
        className="absolute inset-0 cursor-default"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="del-addr-title"
        className="relative w-full max-w-[420px] rounded-[22px] bg-card p-6 shadow-[0_30px_70px_rgba(42,29,18,.3)]"
      >
        <h2
          id="del-addr-title"
          className="mb-2 text-[22px] text-ink"
          style={SERIF}
        >
          Delete this address?
        </h2>
        <p className="mb-1 font-body text-[14px] leading-relaxed text-espresso">
          Remove “{address.label}” ({address.city}, {address.state}) from your
          address book?
        </p>
        <p className="mb-5 font-body text-[13px] text-[#8a7a68]">
          Orders already placed with this address are not affected.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-pill border-[1.5px] border-[#E0CFB6] bg-transparent px-[22px] py-3 font-body text-[14px] font-bold text-ink transition-colors hover:bg-[#F3E7D5]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 rounded-pill bg-raspberry px-6 py-3 font-body text-[14px] font-bold text-white transition-colors hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Deleting…" : "Delete address"}
          </button>
        </div>
      </div>
    </div>
  );
}

function WishlistSection({
  wishlist,
}: {
  wishlist: AccountWishlistItem[];
}): ReactNode {
  const { toast } = useToast();
  const [items, setItems] = useState<AccountWishlistItem[]>(wishlist);
  useEffect(() => setItems(wishlist), [wishlist]);

  async function remove(productId: string): Promise<void> {
    const prev = items;
    setItems((cur) => cur.filter((i) => i.productId !== productId));
    try {
      const res = await fetch("/api/wishlist", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error();
    } catch {
      setItems(prev);
      toast({ kind: "error", message: "Couldn't remove that item." });
    }
  }

  return (
    <>
      <SectionHeading>Your wishlist</SectionHeading>
      {items.length === 0 ? (
        <EmptyState
          title="Nothing saved yet"
          body="Tap the heart on any chocolate to save it here."
          ctaHref="/shop"
          ctaLabel="Browse chocolates"
        />
      ) : (
        <div className="grid grid-cols-3 gap-5 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
          {items.map((item) => (
            <div key={item.productId} className={cx(CARD, "flex flex-col overflow-hidden")}>
              <div className="flex flex-1 flex-col p-4">
                <Link
                  href={`/product/${item.slug}`}
                  className="font-display text-[15.5px] text-ink no-underline"
                >
                  {item.name}
                </Link>
                <div className="mt-2 font-body text-[15px] font-bold text-[#8a5a34]">
                  {formatPaise(item.fromPricePaise)}
                </div>
                <button
                  type="button"
                  onClick={() => void remove(item.productId)}
                  className="mt-3 self-start font-body text-[12.5px] font-semibold text-raspberry underline"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function ProfileSection({
  customer,
}: {
  customer: CustomerView;
}): ReactNode {
  const { toast } = useToast();
  const [name, setName] = useState(customer.name ?? "");
  const [email, setEmail] = useState(customer.email ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dirty = name !== (customer.name ?? "") || email !== (customer.email ?? "");

  async function save(): Promise<void> {
    setSaving(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json();
      if (data.ok) toast({ kind: "success", message: "Profile updated." });
      else toast({ kind: "error", message: data.error?.message ?? "Couldn't save changes." });
    } catch {
      toast({ kind: "error", message: "Network error." });
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount(): Promise<void> {
    setDeleting(true);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        window.location.assign("/");
        return;
      }
      toast({ kind: "error", message: data.error?.message ?? "Couldn't delete your account." });
      setDeleting(false);
    } catch {
      toast({ kind: "error", message: "Network error." });
      setDeleting(false);
    }
  }

  return (
    <>
      <SectionHeading>Profile</SectionHeading>
      <div className={cx(CARD, "max-w-[520px] p-[26px]")}>
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8a5a34]" htmlFor="pf-name">
              Name
            </label>
            <input
              id="pf-name"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-[#eadbc6] bg-white px-3 py-2.5 font-body text-[15px] text-ink outline-none focus:border-[#c69a4c]"
            />
          </div>
          <div>
            <label className="mb-1 block font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8a5a34]" htmlFor="pf-email">
              Email
            </label>
            <input
              id="pf-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="w-full rounded-lg border border-[#eadbc6] bg-white px-3 py-2.5 font-body text-[15px] text-ink outline-none focus:border-[#c69a4c]"
            />
          </div>
          <Field label="Mobile" value={customer.phone ?? "—"} />
          <Field label="Member since" value={formatIST(new Date(customer.createdAt))} />
        </div>

        <div className="mt-6 flex items-center gap-3 max-sm:flex-col max-sm:items-stretch max-sm:gap-4">
          <button
            type="button"
            disabled={saving || !dirty}
            onClick={() => void save()}
            className="rounded-pill bg-ink px-6 py-3 font-body text-[14px] font-semibold text-card transition-colors hover:bg-[#3f2c1b] disabled:opacity-50 max-sm:w-full"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          <LogoutButton className="font-body text-[14px] font-semibold text-espresso underline max-sm:py-1 max-sm:text-center" />
        </div>
      </div>

      {/* Danger zone — DPDP right to erasure. */}
      <div className={cx(CARD, "mt-5 max-w-[520px] border-danger/30 p-[26px]")}>
        <div className="mb-1 font-body text-[15px] font-semibold text-ink">Delete account</div>
        <p className="mb-4 font-body text-[13.5px] leading-relaxed text-[#8a7a68]">
          Permanently delete your account and personal data (addresses, wishlist, reviews).
          Your past orders and invoices are kept as required by law but are de-linked from you.
          This cannot be undone.
        </p>
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="rounded-pill border-[1.5px] border-[#e2c4c4] px-5 py-2.5 font-body text-[13.5px] font-bold text-raspberry transition-colors hover:bg-[#f6dede]"
          >
            Delete my account
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-body text-[13.5px] font-semibold text-ink">Are you sure?</span>
            <button
              type="button"
              disabled={deleting}
              onClick={() => void deleteAccount()}
              className="rounded-pill bg-raspberry px-5 py-2.5 font-body text-[13.5px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {deleting ? "Deleting…" : "Yes, delete everything"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="font-body text-[13.5px] font-semibold text-espresso underline"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <div>
      <div className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8a5a34]">
        {label}
      </div>
      <div className="font-body text-[15.5px] text-ink">{value}</div>
    </div>
  );
}

function EmptyState({
  title,
  body,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  body: string;
  ctaHref: Route;
  ctaLabel: string;
}): ReactNode {
  return (
    <div className={cx(CARD, "px-6 py-[60px] text-center")}>
      <div className="mb-2 text-[22px] text-ink" style={SERIF}>
        {title}
      </div>
      <div className="mb-5 font-body text-[14px] text-espresso">{body}</div>
      <Link
        href={ctaHref}
        className="inline-block rounded-pill bg-ink px-[26px] py-[13px] font-body text-[14px] font-semibold text-card no-underline transition-colors hover:bg-[#3f2c1b]"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
