"use client";

import { useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";

interface CouponDetail {
  id: string;
  code: string;
  description: string;
  percentBp: number | null;
  flatPaise: number | null;
  maxDiscountPaise: number | null;
  minSubtotalPaise: number;
  startsAt: string;
  endsAt: string | null;
  usageLimit: number | null;
  perCustomerLimit: number;
  firstOrderOnly: boolean;
  isActive: boolean;
  redemptionCount: number;
}

const LABEL = "mb-1 block text-[12.5px] font-medium text-[#5c4b3a]";
const INPUT =
  "w-full rounded-lg border border-[#eadbc6] bg-white px-3 py-2 text-[13.5px] outline-none focus:border-[#c69a4c]";
const HINT = "mt-1 text-[11.5px] text-[#b8a88f]";

/** ISO (UTC) → datetime-local value in the admin's browser timezone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const rupees = (paise: number | null) => (paise === null ? "" : String(paise / 100));

export function CouponForm({ coupon }: { coupon?: CouponDetail }): React.ReactNode {
  const router = useRouter();
  const editing = coupon !== undefined;

  const [code, setCode] = useState(coupon?.code ?? "");
  const [description, setDescription] = useState(coupon?.description ?? "");
  const [kind, setKind] = useState<"percent" | "flat">(coupon?.flatPaise !== null && coupon?.flatPaise !== undefined ? "flat" : "percent");
  const [percent, setPercent] = useState(coupon?.percentBp != null ? String(coupon.percentBp / 100) : "");
  const [flatRupees, setFlatRupees] = useState(rupees(coupon?.flatPaise ?? null));
  const [maxDiscountRupees, setMaxDiscountRupees] = useState(rupees(coupon?.maxDiscountPaise ?? null));
  const [minSubtotalRupees, setMinSubtotalRupees] = useState(coupon ? String(coupon.minSubtotalPaise / 100) : "0");
  const [startsAt, setStartsAt] = useState(toLocalInput(coupon?.startsAt ?? new Date().toISOString()));
  const [endsAt, setEndsAt] = useState(toLocalInput(coupon?.endsAt ?? null));
  const [usageLimit, setUsageLimit] = useState(coupon?.usageLimit != null ? String(coupon.usageLimit) : "");
  const [perCustomerLimit, setPerCustomerLimit] = useState(String(coupon?.perCustomerLimit ?? 1));
  const [firstOrderOnly, setFirstOrderOnly] = useState(coupon?.firstOrderOnly ?? false);
  const [isActive, setIsActive] = useState(coupon?.isActive ?? true);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(): Promise<void> {
    setSaving(true);
    setErr(null);
    const payload = {
      code,
      description,
      kind,
      percent: kind === "percent" ? Number(percent) : undefined,
      flatRupees: kind === "flat" ? Number(flatRupees) : undefined,
      maxDiscountRupees: kind === "percent" && maxDiscountRupees !== "" ? Number(maxDiscountRupees) : null,
      minSubtotalRupees: minSubtotalRupees === "" ? 0 : Number(minSubtotalRupees),
      // datetime-local (browser tz) → unambiguous ISO for the server.
      startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
      endsAt: endsAt ? new Date(endsAt).toISOString() : null,
      usageLimit: usageLimit === "" ? null : Number(usageLimit),
      perCustomerLimit: Number(perCustomerLimit),
      firstOrderOnly,
      isActive,
    };
    try {
      const url = editing ? `/api/admin/coupons/${coupon.id}` : "/api/admin/coupons";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.ok) {
        setErr(data.error?.message ?? "Save failed.");
        setSaving(false);
        return;
      }
      router.push("/admin/coupons" as Route);
    } catch {
      setErr("Network error.");
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card title="Details">
          <div className="space-y-3">
            <div>
              <label className={LABEL} htmlFor="c-code">Code</label>
              <input id="c-code" className={INPUT + " font-mono uppercase"} value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="SAVE10" />
              <p className={HINT}>3–24 characters, A–Z and 0–9. Case-insensitive at checkout.</p>
            </div>
            <div>
              <label className={LABEL} htmlFor="c-desc">Description (internal)</label>
              <input id="c-desc" className={INPUT} value={description}
                onChange={(e) => setDescription(e.target.value)} placeholder="Diwali launch offer" />
            </div>
          </div>
        </Card>

        <Card title="Discount">
          <div className="space-y-3">
            <div className="flex gap-2">
              {(["percent", "flat"] as const).map((k) => (
                <button key={k} type="button" onClick={() => setKind(k)}
                  className={
                    "rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors " +
                    (kind === k ? "bg-[#2a1d12] text-[#f3e7d5]" : "bg-white text-[#5c4b3a] ring-1 ring-[#eadbc6] hover:bg-[#f3e7d5]")
                  }>
                  {k === "percent" ? "Percent off" : "Flat ₹ off"}
                </button>
              ))}
            </div>
            {kind === "percent" ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL} htmlFor="c-pct">Percent</label>
                  <input id="c-pct" type="number" className={INPUT} value={percent} placeholder="10"
                    onChange={(e) => setPercent(e.target.value)} />
                </div>
                <div>
                  <label className={LABEL} htmlFor="c-max">Max discount ₹ (optional)</label>
                  <input id="c-max" type="number" className={INPUT} value={maxDiscountRupees} placeholder="500"
                    onChange={(e) => setMaxDiscountRupees(e.target.value)} />
                </div>
              </div>
            ) : (
              <div>
                <label className={LABEL} htmlFor="c-flat">Flat discount ₹</label>
                <input id="c-flat" type="number" className={INPUT} value={flatRupees} placeholder="200"
                  onChange={(e) => setFlatRupees(e.target.value)} />
              </div>
            )}
            <div>
              <label className={LABEL} htmlFor="c-min">Minimum order ₹</label>
              <input id="c-min" type="number" className={INPUT} value={minSubtotalRupees}
                onChange={(e) => setMinSubtotalRupees(e.target.value)} />
            </div>
          </div>
        </Card>

        <Card title="Schedule & limits">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={LABEL} htmlFor="c-start">Starts</label>
              <input id="c-start" type="datetime-local" className={INPUT} value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div>
              <label className={LABEL} htmlFor="c-end">Ends (optional)</label>
              <input id="c-end" type="datetime-local" className={INPUT} value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)} />
            </div>
            <div>
              <label className={LABEL} htmlFor="c-usage">Total uses (optional)</label>
              <input id="c-usage" type="number" className={INPUT} value={usageLimit} placeholder="Unlimited"
                onChange={(e) => setUsageLimit(e.target.value)} />
            </div>
            <div>
              <label className={LABEL} htmlFor="c-pcl">Uses per customer</label>
              <input id="c-pcl" type="number" className={INPUT} value={perCustomerLimit}
                onChange={(e) => setPerCustomerLimit(e.target.value)} />
            </div>
          </div>
          <label className="mt-3 flex items-center gap-2 text-[13px] text-[#5c4b3a]">
            <input type="checkbox" className="h-4 w-4 accent-[#2a1d12]" checked={firstOrderOnly}
              onChange={(e) => setFirstOrderOnly(e.target.checked)} />
            First order only
          </label>
        </Card>
      </div>

      <div className="space-y-4">
        <Card title="Status">
          <label className="flex items-center gap-2 text-[13px] text-[#5c4b3a]">
            <input type="checkbox" className="h-4 w-4 accent-[#2a1d12]" checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)} />
            Active
          </label>
          {editing ? (
            <p className={HINT}>
              Redeemed {coupon.redemptionCount} time{coupon.redemptionCount === 1 ? "" : "s"}.
            </p>
          ) : null}
        </Card>

        <Card title={editing ? "Save coupon" : "Create coupon"}>
          <button type="button" disabled={saving} onClick={submit}
            className="w-full rounded-lg bg-[#2a1d12] px-4 py-2.5 text-[13.5px] font-semibold text-[#f3e7d5] transition-opacity hover:opacity-90 disabled:opacity-50">
            {saving ? "Saving…" : editing ? "Save changes" : "Create coupon"}
          </button>
          {err !== null ? <p className="mt-2 text-[12.5px] text-[#b25b5b]">{err}</p> : null}
        </Card>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }): React.ReactNode {
  return (
    <div className="rounded-2xl border border-[#eadbc6] bg-white p-5">
      <div className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-[#8a7a68]">{title}</div>
      {children}
    </div>
  );
}
