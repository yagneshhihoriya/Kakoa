"use client";

/**
 * `AddressForm` — the shared saved-address editor (smart-address Phase 1).
 *
 * One form for the whole book: the account page's Add / Edit, and the checkout
 * AddressPicker's "add new" / "edit this". Binds every `addressInputSchema`
 * field plus the book metadata (`label`, `isDefault`) and mirrors the checkout
 * Step-1 field styling so the two never look different.
 *
 * Pincode autofill: on the 6th PIN digit we infer the GST state via
 * `stateCodeFromPincode` and preselect the dropdown (+ set `stateCode`). The
 * user can still override it; city stays a normal editable field.
 *
 * Validation is client-side and mirrors the checkout Step-1 gate; the server
 * schema is the real authority and its `fieldErrors` are surfaced if a submit
 * is rejected. The form owns NO network — the caller supplies `onSubmit` and
 * decides create vs update.
 */
import { useCallback, useState, type ReactNode } from "react";
import {
  GST_STATES,
  stateByCode,
  stateCodeFromPincode,
  type SavedAddress,
} from "@kakoa/core";
import { cx } from "@kakoa/ui";

/* ------------------------------------------------------------------ */
/* Shared tokens (kept identical to CheckoutClient Step 1)             */
/* ------------------------------------------------------------------ */

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold";
const INPUT_BASE =
  "w-full rounded-xl border bg-[#F9F3EA] px-4 py-[14px] font-body text-[15px] text-ink outline-none transition-colors placeholder:text-[#b3a288] focus:ring-2 focus:ring-gold";
const LABEL =
  "mb-[7px] block font-body text-[13px] font-semibold text-[#5C4B3A]";
const PRIMARY_BTN =
  "flex items-center justify-center gap-2 rounded-pill bg-ink px-6 py-3.5 font-body text-[15px] font-bold text-card transition-colors hover:bg-[#3f2c1b] disabled:cursor-not-allowed disabled:opacity-60";
const GHOST_BTN =
  "rounded-pill border-[1.5px] border-[#E0CFB6] bg-transparent px-[22px] py-3.5 font-body text-[15px] font-bold text-ink transition-colors hover:bg-[#F3E7D5]";

/** The editable shape the form holds (all strings; never `undefined`). */
export interface AddressFormValues {
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  landmark: string;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
  isDefault: boolean;
}

export const EMPTY_ADDRESS_FORM: AddressFormValues = {
  label: "Home",
  fullName: "",
  phone: "",
  line1: "",
  line2: "",
  landmark: "",
  city: "",
  state: "",
  stateCode: "",
  pincode: "",
  isDefault: false,
};

/** Seed the form from a saved row (Edit). */
export function addressToFormValues(saved: SavedAddress): AddressFormValues {
  return {
    label: saved.label,
    fullName: saved.fullName,
    phone: saved.phone,
    line1: saved.line1,
    line2: saved.line2 ?? "",
    landmark: saved.landmark ?? "",
    city: saved.city,
    state: saved.state,
    stateCode: saved.stateCode,
    pincode: saved.pincode,
    isDefault: saved.isDefault,
  };
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

function validate(v: AddressFormValues): Record<string, string> {
  const next: Record<string, string> = {};
  if (v.label.trim() === "") next["label"] = "Give this address a short label.";
  if (v.fullName.trim().length < 2) {
    next["fullName"] = "Enter the recipient's full name (2–100 characters).";
  }
  if (!/^[6-9][0-9]{9}$/.test(v.phone.trim())) {
    next["phone"] = "Enter a valid 10-digit mobile number.";
  }
  if (v.line1.trim().length < 3) {
    next["line1"] =
      "Address line 1 is required (house/flat, street — min 3 characters).";
  }
  if (v.city.trim().length < 2) next["city"] = "Enter a valid city name.";
  if (v.stateCode === "") next["state"] = "Select your state from the list.";
  if (!/^[1-9][0-9]{5}$/.test(v.pincode.trim())) {
    next["pincode"] = "Enter a valid 6-digit Indian PIN code.";
  }
  return next;
}

export interface AddressFormProps {
  initial?: AddressFormValues;
  /** Submit label — "Save address" (add) or "Save changes" (edit). */
  submitLabel: string;
  /** Whether to offer the "Set as default" checkbox (hidden for the 1st row). */
  showDefaultToggle?: boolean;
  submitting?: boolean;
  /** A server-side error banner (e.g. CONFLICT `address_limit`). */
  formError?: string | null;
  /** Per-field errors returned by the server (merged over local validation). */
  serverFieldErrors?: Record<string, string> | null;
  /**
   * Pin the Cancel/Save actions to a sticky footer at the bottom of the
   * scroll container. Used inside the checkout `AddressPicker` bottom-sheet
   * (whose scroll body has `px-6 py-5`) so the primary action stays reachable
   * on a long mobile form. Off for the inline account card.
   */
  stickyActions?: boolean;
  onSubmit: (values: AddressFormValues) => void;
  onCancel: () => void;
}

export function AddressForm({
  initial = EMPTY_ADDRESS_FORM,
  submitLabel,
  showDefaultToggle = true,
  submitting = false,
  formError = null,
  serverFieldErrors = null,
  stickyActions = false,
  onSubmit,
  onCancel,
}: AddressFormProps): ReactNode {
  const [values, setValues] = useState<AddressFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const merged = { ...errors, ...(serverFieldErrors ?? {}) };

  const setField = useCallback(
    (key: keyof AddressFormValues, value: string | boolean) => {
      setValues((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => {
        if (prev[key as string] === undefined) return prev;
        const next = { ...prev };
        delete next[key as string];
        return next;
      });
    },
    [],
  );

  const onPincodeChange = useCallback((raw: string) => {
    const pincode = raw.replace(/[^\d]/g, "").slice(0, 6);
    setValues((prev) => {
      const next = { ...prev, pincode };
      // Autofill the GST state the moment a full 6-digit PIN is present, but
      // only when the state hasn't been chosen yet — never clobber a manual pick.
      if (pincode.length === 6 && prev.stateCode === "") {
        const code = stateCodeFromPincode(pincode);
        if (code !== null) {
          next.stateCode = code;
          next.state = stateByCode(code)?.name ?? "";
        }
      }
      return next;
    });
    setErrors((prev) => {
      if (prev["pincode"] === undefined) return prev;
      const nextErr = { ...prev };
      delete nextErr["pincode"];
      return nextErr;
    });
  }, []);

  const onStateChange = useCallback((code: string) => {
    setValues((prev) => ({
      ...prev,
      stateCode: code,
      state: stateByCode(code)?.name ?? "",
    }));
    setErrors((prev) => {
      if (prev["state"] === undefined) return prev;
      const next = { ...prev };
      delete next["state"];
      return next;
    });
  }, []);

  const handleSubmit = useCallback(() => {
    const found = validate(values);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    onSubmit(values);
  }, [values, onSubmit]);

  return (
    <div>
      {formError !== null ? (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 font-body text-[13.5px] text-danger"
        >
          {formError}
        </div>
      ) : null}

      {/* Label */}
      <div className="mb-4">
        <label htmlFor="af-label" className={LABEL}>
          Label
        </label>
        <input
          id="af-label"
          placeholder="Home, Work, Mom's place…"
          value={values.label}
          maxLength={30}
          onChange={(e) => setField("label", e.target.value)}
          className={cx(
            INPUT_BASE,
            merged["label"] ? "border-danger" : "border-[#E8DBC6]",
          )}
        />
        {merged["label"] ? (
          <FieldError id="af-label-err" message={merged["label"]} />
        ) : null}
      </div>

      {/* Recipient */}
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="af-name" className={LABEL}>
            Full name
          </label>
          <input
            id="af-name"
            autoComplete="name"
            placeholder="Amara Patel"
            value={values.fullName}
            onChange={(e) => setField("fullName", e.target.value)}
            className={cx(
              INPUT_BASE,
              merged["fullName"] ? "border-danger" : "border-[#E8DBC6]",
            )}
          />
          {merged["fullName"] ? (
            <FieldError id="af-name-err" message={merged["fullName"]} />
          ) : null}
        </div>
        <div>
          <label htmlFor="af-phone" className={LABEL}>
            Phone
          </label>
          <div
            className={cx(
              "flex items-center overflow-hidden rounded-xl border bg-[#F9F3EA] transition-colors focus-within:ring-2 focus-within:ring-gold",
              merged["phone"] ? "border-danger" : "border-[#E8DBC6]",
            )}
          >
            <span className="select-none border-r border-[#E8DBC6] px-3.5 py-[14px] font-body text-[15px] font-semibold text-espresso">
              +91
            </span>
            <input
              id="af-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="98765 43210"
              value={values.phone}
              onChange={(e) =>
                setField("phone", e.target.value.replace(/[^\d]/g, "").slice(0, 10))
              }
              maxLength={10}
              className="w-full bg-transparent px-4 py-[14px] font-body text-[15px] text-ink outline-none placeholder:text-[#b3a288]"
            />
          </div>
          {merged["phone"] ? (
            <FieldError id="af-phone-err" message={merged["phone"]} />
          ) : null}
        </div>
      </div>

      {/* Line 1 */}
      <div className="mb-4">
        <label htmlFor="af-line1" className={LABEL}>
          Address line 1
        </label>
        <input
          id="af-line1"
          autoComplete="address-line1"
          placeholder="House / flat, street"
          value={values.line1}
          maxLength={150}
          onChange={(e) => setField("line1", e.target.value)}
          className={cx(
            INPUT_BASE,
            merged["line1"] ? "border-danger" : "border-[#E8DBC6]",
          )}
        />
        {merged["line1"] ? (
          <FieldError id="af-line1-err" message={merged["line1"]} />
        ) : null}
      </div>

      {/* Line 2 + landmark */}
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="af-line2" className={LABEL}>
            Address line 2{" "}
            <span className="font-normal text-[#a08a72]">(optional)</span>
          </label>
          <input
            id="af-line2"
            autoComplete="address-line2"
            placeholder="Area, colony"
            value={values.line2}
            maxLength={150}
            onChange={(e) => setField("line2", e.target.value)}
            className={cx(INPUT_BASE, "border-[#E8DBC6]")}
          />
        </div>
        <div>
          <label htmlFor="af-landmark" className={LABEL}>
            Landmark{" "}
            <span className="font-normal text-[#a08a72]">(optional)</span>
          </label>
          <input
            id="af-landmark"
            placeholder="Near…"
            value={values.landmark}
            maxLength={100}
            onChange={(e) => setField("landmark", e.target.value)}
            className={cx(INPUT_BASE, "border-[#E8DBC6]")}
          />
        </div>
      </div>

      {/* City / state / pincode */}
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <label htmlFor="af-city" className={LABEL}>
            City
          </label>
          <input
            id="af-city"
            autoComplete="address-level2"
            placeholder="Mumbai"
            value={values.city}
            onChange={(e) => setField("city", e.target.value)}
            className={cx(
              INPUT_BASE,
              merged["city"] ? "border-danger" : "border-[#E8DBC6]",
            )}
          />
          {merged["city"] ? (
            <FieldError id="af-city-err" message={merged["city"]} />
          ) : null}
        </div>
        <div>
          <label htmlFor="af-state" className={LABEL}>
            State
          </label>
          <select
            id="af-state"
            value={values.stateCode}
            onChange={(e) => onStateChange(e.target.value)}
            className={cx(
              INPUT_BASE,
              "appearance-none",
              merged["state"] ? "border-danger" : "border-[#E8DBC6]",
              values.stateCode === "" ? "text-[#b3a288]" : "",
            )}
          >
            <option value="">Select…</option>
            {GST_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
          {merged["state"] ? (
            <FieldError id="af-state-err" message={merged["state"]} />
          ) : null}
        </div>
        <div>
          <label htmlFor="af-pincode" className={LABEL}>
            PIN code
          </label>
          <input
            id="af-pincode"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="400001"
            value={values.pincode}
            onChange={(e) => onPincodeChange(e.target.value)}
            maxLength={6}
            className={cx(
              INPUT_BASE,
              merged["pincode"] ? "border-danger" : "border-[#E8DBC6]",
            )}
          />
          {merged["pincode"] ? (
            <FieldError id="af-pincode-err" message={merged["pincode"]} />
          ) : null}
        </div>
      </div>

      {/* Default toggle */}
      {showDefaultToggle ? (
        <label className="mb-5 flex cursor-pointer items-center gap-3 font-body text-[14px] text-espresso">
          <input
            type="checkbox"
            checked={values.isDefault}
            onChange={(e) => setField("isDefault", e.target.checked)}
            className="h-[18px] w-[18px] accent-[#2a1d12]"
          />
          Set as my default address
        </label>
      ) : null}

      <div
        className={cx(
          "flex gap-3",
          stickyActions &&
            "sticky bottom-0 z-10 -mx-6 -mb-5 border-t border-[#EADBC6] bg-card px-6 pb-5 pt-4",
        )}
      >
        <button
          type="button"
          onClick={onCancel}
          className={cx(GHOST_BTN, "flex-none", FOCUS_RING)}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className={cx(PRIMARY_BTN, "flex-1", FOCUS_RING)}
        >
          {submitting ? "Saving…" : submitLabel}
        </button>
      </div>
    </div>
  );
}
