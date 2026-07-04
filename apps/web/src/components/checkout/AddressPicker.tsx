"use client";

/**
 * `AddressPicker` — the checkout address chooser (smart-address Phase 1).
 *
 * A focus-trapped bottom-sheet (mobile) / centred dialog (desktop) listing the
 * saved book default-first, each an `AddressCard` with its own serviceability
 * verdict. Tap a card to select it; unserviceable cards are disabled with a
 * reason. A "+ Add new address" row opens the shared `AddressForm` inline; an
 * "Edit" affordance on a card opens the same form seeded from that row.
 *
 * The picker owns NO placement state — it hands the chosen `SavedAddress` back
 * to the caller (which copies the values into checkout state) and closes.
 * Add / edit go through the `useAddresses` hook the caller passes in.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { SavedAddress } from "@kakoa/core";
import { cx } from "@kakoa/ui";
import { AddressCard } from "./AddressCard";
import {
  AddressForm,
  addressToFormValues,
  EMPTY_ADDRESS_FORM,
  type AddressFormValues,
} from "@/components/account/AddressForm";
import type { UseAddresses } from "@/components/account/useAddresses";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold";

/** Turn a form payload into the create/update wire shape. */
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

type Mode =
  | { kind: "list" }
  | { kind: "add" }
  | { kind: "edit"; address: SavedAddress };

export interface AddressPickerProps {
  addresses: SavedAddress[];
  selectedId: string | null;
  book: UseAddresses;
  /** Called with the chosen row — the parent copies values into checkout. */
  onSelect: (address: SavedAddress) => void;
  onClose: () => void;
}

export function AddressPicker({
  addresses,
  selectedId,
  book,
  onSelect,
  onClose,
}: AddressPickerProps): ReactNode {
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [formError, setFormError] = useState<string | null>(null);
  const [serviceable, setServiceable] = useState<Record<string, boolean>>({});
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Focus trap + Escape-to-close + restore focus on unmount.
  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const node = dialogRef.current;
    const focusFirst = (): void => {
      const focusables = node?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      focusables?.[0]?.focus();
    };
    focusFirst();

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || node === null) return;
      const focusables = Array.from(
        node.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled"));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (first === undefined || last === undefined) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [onClose, mode]);

  const reportSvc = useCallback((id: string, ok: boolean) => {
    setServiceable((prev) => (prev[id] === ok ? prev : { ...prev, [id]: ok }));
  }, []);

  const handleCreate = useCallback(
    async (values: AddressFormValues) => {
      setFormError(null);
      const result = await book.create(toWirePayload(values));
      if (result.ok) {
        onSelect(result.data);
        onClose();
        return;
      }
      setFormError(result.error.message);
    },
    [book, onSelect, onClose],
  );

  const handleUpdate = useCallback(
    async (id: string, values: AddressFormValues) => {
      setFormError(null);
      const result = await book.update({ id, ...toWirePayload(values) });
      if (result.ok) {
        onSelect(result.data);
        onClose();
        return;
      }
      setFormError(result.error.message);
    },
    [book, onSelect, onClose],
  );

  const titleId = "address-picker-title";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 px-4 pb-0 backdrop-blur-[2px] sm:items-center sm:pb-4">
      {/* Backdrop dismiss */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[85vh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-[22px] bg-card shadow-[0_30px_70px_rgba(42,29,18,.3)] sm:rounded-[22px]"
      >
        <div className="flex items-center justify-between border-b border-[#EADBC6] px-6 py-4">
          <h2
            id={titleId}
            className="text-[20px] text-ink"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            {mode.kind === "add"
              ? "Add a new address"
              : mode.kind === "edit"
                ? "Edit address"
                : "Choose an address"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={cx(
              "grid h-8 w-8 place-items-center rounded-pill text-[18px] text-espresso hover:bg-[#F3E7D5]",
              FOCUS_RING,
            )}
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          {mode.kind === "list" ? (
            <div className="flex flex-col gap-3">
              {addresses.map((address) => {
                const undeliverable = serviceable[address.id] === false;
                return (
                  <AddressCard
                    key={address.id}
                    address={address}
                    selected={address.id === selectedId}
                    disabled={undeliverable}
                    onServiceability={reportSvc}
                    onSelect={() => {
                      onSelect(address);
                      onClose();
                    }}
                    onEdit={() => {
                      setFormError(null);
                      setMode({ kind: "edit", address });
                    }}
                  />
                );
              })}

              <button
                type="button"
                onClick={() => {
                  setFormError(null);
                  setMode({ kind: "add" });
                }}
                className={cx(
                  "flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[18px] border-[1.5px] border-dashed border-[#D8C3A6] bg-transparent font-body text-[14.5px] font-semibold text-espresso transition-colors hover:bg-[#F3E7D5]",
                  FOCUS_RING,
                )}
              >
                + Add new address
              </button>
            </div>
          ) : mode.kind === "add" ? (
            <AddressForm
              submitLabel="Save address"
              submitting={book.busy}
              formError={formError}
              showDefaultToggle={addresses.length > 0}
              stickyActions
              initial={{
                ...EMPTY_ADDRESS_FORM,
                isDefault: addresses.length === 0,
              }}
              onSubmit={(values) => void handleCreate(values)}
              onCancel={() => setMode({ kind: "list" })}
            />
          ) : (
            <AddressForm
              submitLabel="Save changes"
              submitting={book.busy}
              formError={formError}
              stickyActions
              initial={addressToFormValues(mode.address)}
              onSubmit={(values) => void handleUpdate(mode.address.id, values)}
              onCancel={() => setMode({ kind: "list" })}
            />
          )}
        </div>
      </div>
    </div>
  );
}
