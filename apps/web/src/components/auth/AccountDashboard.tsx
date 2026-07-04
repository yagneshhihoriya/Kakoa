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

const TABS: ReadonlyArray<{ key: Tab; label: string; icon: string }> = [
  { key: "orders", label: "Orders", icon: "▤" },
  { key: "addresses", label: "Addresses", icon: "⌂" },
  { key: "wishlist", label: "Wishlist", icon: "♡" },
  { key: "profile", label: "Profile", icon: "◔" },
];

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

function initialsFor(name: string | null, phone: string | null): string {
  if (name !== null && name.trim() !== "") {
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? "";
    const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
    return (first + second).toUpperCase() || "•";
  }
  if (phone !== null && phone.length >= 2) return phone.slice(-2);
  return "•";
}

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
  const initials = initialsFor(customer.name, customer.phone);
  const displayName = customer.name ?? "there";

  return (
    <main className="mx-auto max-w-[1240px] px-8 pb-[72px] pt-[34px] max-[900px]:px-5">
      <div className="grid grid-cols-[262px_1fr] items-start gap-9 max-[900px]:grid-cols-1 max-[900px]:gap-6">
        {/* SIDEBAR */}
        <aside
          className={cx(
            CARD,
            "sticky top-[98px] p-[22px] max-[900px]:static",
          )}
        >
          <div className="mb-4 flex items-center gap-3 border-b border-[#EADBC6] pb-5">
            <span className="grid h-[46px] w-[46px] place-items-center rounded-pill bg-gradient-to-br from-[#8a5a34] to-[#4a2e1c] font-body text-[17px] font-semibold text-[#e8c9a0]">
              {initials}
            </span>
            <div className="min-w-0">
              <div className="truncate font-body text-[15.5px] font-semibold text-ink">
                {customer.name ?? "Kakao member"}
              </div>
              <div className="truncate font-body text-[12.5px] text-[#8a7a68]">
                {customer.phone ?? customer.email ?? ""}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                aria-current={tab === t.key ? "page" : undefined}
                className={cx(
                  "flex items-center gap-3 rounded-[12px] px-[14px] py-3 text-left font-body text-[14.5px] font-semibold transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
                  tab === t.key
                    ? "bg-ink text-card"
                    : "text-espresso hover:bg-[#F3E7D5]",
                )}
              >
                <span aria-hidden="true" className="w-[18px] text-center text-[15px]">
                  {t.icon}
                </span>
                {t.label}
              </button>
            ))}
          </div>

          <LogoutButton className="mt-[14px] flex w-full items-center gap-3 rounded-none border-t border-[#EADBC6] px-[14px] pt-[18px] pb-3 text-left font-body text-[14.5px] font-semibold text-[#a08a72] transition-colors hover:text-raspberry">
            <span aria-hidden="true" className="w-[18px] text-center text-[15px]">
              →
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
        {orders.map((order) => {
          const meta = STATUS_META[order.status];
          return (
            <div
              key={order.id}
              className={cx(CARD, "flex flex-wrap items-center gap-4 p-5")}
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
  return (
    <>
      <SectionHeading>Your wishlist</SectionHeading>
      {wishlist.length === 0 ? (
        <EmptyState
          title="Nothing saved yet"
          body="Tap the heart on any chocolate to save it here."
          ctaHref="/shop"
          ctaLabel="Browse chocolates"
        />
      ) : (
        <div className="grid grid-cols-3 gap-5 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
          {wishlist.map((item) => (
            <div key={item.productId} className={cx(CARD, "overflow-hidden")}>
              <div className="p-4">
                <Link
                  href={`/product/${item.slug}`}
                  className="font-display text-[15.5px] text-ink no-underline"
                >
                  {item.name}
                </Link>
                <div className="mt-2 font-body text-[15px] font-bold text-[#8a5a34]">
                  {formatPaise(item.fromPricePaise)}
                </div>
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
  return (
    <>
      <SectionHeading>Profile</SectionHeading>
      <div className={cx(CARD, "max-w-[520px] p-[26px]")}>
        <dl className="flex flex-col gap-5">
          <Field label="Name" value={customer.name ?? "Not set yet"} />
          <Field label="Mobile" value={customer.phone ?? "—"} />
          <Field label="Email" value={customer.email ?? "Not set yet"} />
          <Field
            label="Member since"
            value={formatIST(new Date(customer.createdAt))}
          />
        </dl>
        <div className="mt-7 border-t border-[#EADBC6] pt-6">
          <LogoutButton className="rounded-pill bg-ink px-6 py-3 font-body text-[14px] font-semibold text-card transition-colors hover:bg-[#3f2c1b]" />
        </div>
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <div>
      <dt className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8a5a34]">
        {label}
      </dt>
      <dd className="font-body text-[15.5px] text-ink">{value}</dd>
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
