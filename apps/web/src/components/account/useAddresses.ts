"use client";

/**
 * `useAddresses` — client CRUD hook over the saved-address book endpoints
 * (smart-address Phase 1). Wraps the customer-tier Route Handlers:
 *
 *   GET    /api/account/addresses            → list (default-first)
 *   POST   /api/account/addresses            → create
 *   PATCH  /api/account/addresses/[id]       → update
 *   DELETE /api/account/addresses/[id]       → delete
 *   POST   /api/account/addresses/[id]/default → set default (returns list)
 *
 * Every call returns the typed `ApiResult` envelope so callers can surface the
 * exact server message (e.g. CONFLICT `address_limit`). The hook keeps a local
 * `addresses` copy in sync after each successful mutation so the account page
 * re-renders without a full reload. It NEVER throws for an expected failure —
 * network faults collapse to an `INTERNAL` envelope.
 *
 * Used by the account Address book (full CRUD) and the checkout AddressPicker's
 * add/edit flow (create/update only).
 */
import { useCallback, useState } from "react";
import type {
  ApiResult,
  CreateAddressInput,
  SavedAddress,
  UpdateAddressInput,
} from "@kakoa/core";

/** A shipping-address-shaped payload for create (label + isDefault optional). */
export type CreateAddressPayload = CreateAddressInput;
/** A partial patch keyed by row id. */
export type UpdateAddressPayload = UpdateAddressInput;

export interface UseAddresses {
  addresses: SavedAddress[];
  /** True while any mutation is in flight (disables buttons, shows spinners). */
  busy: boolean;
  refresh: () => Promise<void>;
  create: (input: CreateAddressPayload) => Promise<ApiResult<SavedAddress>>;
  update: (input: UpdateAddressPayload) => Promise<ApiResult<SavedAddress>>;
  remove: (id: string) => Promise<ApiResult<Record<string, never>>>;
  setDefault: (id: string) => Promise<ApiResult<SavedAddress[]>>;
}

const INTERNAL_ERR = {
  ok: false as const,
  error: {
    code: "INTERNAL" as const,
    message: "Something went wrong. Please try again.",
  },
  requestId: "",
};

async function readJson<T>(response: Response): Promise<ApiResult<T>> {
  return (await response.json()) as ApiResult<T>;
}

/** Default-first ordering, matching the server list. */
function sortDefaultFirst(rows: SavedAddress[]): SavedAddress[] {
  return [...rows].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
}

export function useAddresses(initial: SavedAddress[] = []): UseAddresses {
  const [addresses, setAddresses] = useState<SavedAddress[]>(initial);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch("/api/account/addresses", {
        cache: "no-store",
      });
      const result = await readJson<SavedAddress[]>(response);
      if (result.ok) setAddresses(sortDefaultFirst(result.data));
    } catch {
      // Leave the last-known list in place on a transient read failure.
    }
  }, []);

  const create = useCallback(
    async (input: CreateAddressPayload): Promise<ApiResult<SavedAddress>> => {
      setBusy(true);
      try {
        const response = await fetch("/api/account/addresses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const result = await readJson<SavedAddress>(response);
        if (result.ok) {
          setAddresses((prev) => {
            const next = result.data.isDefault
              ? prev.map((a) => ({ ...a, isDefault: false }))
              : prev;
            return sortDefaultFirst([...next, result.data]);
          });
        }
        return result;
      } catch {
        return INTERNAL_ERR;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const update = useCallback(
    async (input: UpdateAddressPayload): Promise<ApiResult<SavedAddress>> => {
      setBusy(true);
      try {
        const response = await fetch(`/api/account/addresses/${input.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const result = await readJson<SavedAddress>(response);
        if (result.ok) {
          setAddresses((prev) => {
            const withoutRow = prev.filter((a) => a.id !== result.data.id);
            const next = result.data.isDefault
              ? withoutRow.map((a) => ({ ...a, isDefault: false }))
              : withoutRow;
            return sortDefaultFirst([...next, result.data]);
          });
        }
        return result;
      } catch {
        return INTERNAL_ERR;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const remove = useCallback(
    async (id: string): Promise<ApiResult<Record<string, never>>> => {
      setBusy(true);
      try {
        const response = await fetch(`/api/account/addresses/${id}`, {
          method: "DELETE",
        });
        const result = await readJson<Record<string, never>>(response);
        if (result.ok) {
          // Re-fetch: deleting a default may have promoted another row
          // server-side, so trust the server's fresh ordering.
          await refresh();
        }
        return result;
      } catch {
        return INTERNAL_ERR;
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const setDefault = useCallback(
    async (id: string): Promise<ApiResult<SavedAddress[]>> => {
      setBusy(true);
      try {
        const response = await fetch(`/api/account/addresses/${id}/default`, {
          method: "POST",
        });
        const result = await readJson<SavedAddress[]>(response);
        if (result.ok) setAddresses(sortDefaultFirst(result.data));
        return result;
      } catch {
        return INTERNAL_ERR;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  return {
    addresses,
    busy,
    refresh,
    create,
    update,
    remove,
    setDefault,
  };
}
