import type { ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ShipmentStatus } from "@kakoa/core";
import { resolveAdminContext } from "@/lib/admin/context";
import { getShipmentDetail } from "@/lib/admin/shipping";
import { NoAccess } from "@/components/admin/NoAccess";
import { ShipmentStatusBadge } from "@/components/admin/ShipmentStatusBadge";
import { StatusPill } from "@/components/admin/StatusPill";
import { ShipmentActions } from "@/components/admin/ShipmentActions";

export const dynamic = "force-dynamic";

const DATE_FMT = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

const SOURCE_CLS: Record<string, string> = {
  manual: "bg-[#ece6df] text-[#8a7a68]",
  webhook: "bg-[#dfeaf6] text-[#4a6b8a]",
  poll: "bg-[#f5e3c4] text-[#9a6b1e]",
};

export default async function AdminShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactNode> {
  const resolved = await resolveAdminContext();
  if (resolved === null) return null;
  if (!resolved.ctx.can("shipping:read")) return <NoAccess module="Shipping" />;

  const { id } = await params;
  const shipment = await getShipmentDetail(id);
  if (shipment === null) notFound();

  const canManage = resolved.ctx.can("shipping:manage");

  return (
    <div className="mx-auto max-w-6xl">
      <Link href={"/admin/shipping" as Route} className="text-[13px] text-[#8a7a68] hover:text-[#2a1d12]">
        ← Shipping
      </Link>
      <div className="mb-6 mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-[24px] text-[#2a1d12]" style={{ fontFamily: "var(--font-display), serif" }}>
          <Link href={`/admin/orders/${shipment.orderNumber}` as Route} className="hover:text-[#8a5a34]">
            {shipment.orderNumber}
          </Link>
        </h1>
        <ShipmentStatusBadge status={shipment.status} />
        <span className="rounded-full bg-[#f3e7d5] px-2.5 py-1 text-[11.5px] font-medium text-[#5c4b3a]">
          {shipment.cod ? "COD" : "Prepaid"}
        </span>
        {shipment.superseded ? <StatusPill tone="neutral" label="Superseded" /> : null}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Shipment">
            <div className="grid gap-3 sm:grid-cols-2">
              <Row label="AWB" value={shipment.awbCode ?? "—"} mono />
              <Row label="Courier" value={shipment.courierName ?? "—"} />
              <Row label="Destination" value={`${shipment.city}${shipment.state ? `, ${shipment.state}` : ""}`} />
              <Row label="Order status" value={shipment.orderStatus.replace(/_/g, " ")} />
              {shipment.pickupScheduledAt ? (
                <Row label="Pickup scheduled" value={DATE_FMT.format(new Date(shipment.pickupScheduledAt))} />
              ) : null}
              {shipment.expectedDeliveryAt ? (
                <Row label="Expected delivery" value={DATE_FMT.format(new Date(shipment.expectedDeliveryAt))} />
              ) : null}
              <Row label="Created" value={DATE_FMT.format(new Date(shipment.createdAt))} />
            </div>
          </Card>

          <Card title="Tracking timeline">
            {shipment.events.length === 0 ? (
              <p className="text-[13px] text-[#8a7a68]">No events recorded yet.</p>
            ) : (
              <ol className="space-y-3">
                {shipment.events.map((e) => (
                  <li key={e.id} className="flex items-start gap-3 text-[13px]">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#c69a4c]" />
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <ShipmentStatusBadge status={e.status} />
                      {e.activity ? <span className="text-[#5c4b3a]">{e.activity}</span> : null}
                      {e.location ? <span className="text-[#8a7a68]">· {e.location}</span> : null}
                      <span className="text-[#b8a88f]">· {DATE_FMT.format(new Date(e.occurredAt))}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${SOURCE_CLS[e.source] ?? SOURCE_CLS.manual}`}>
                        {e.source}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Order">
            <div className="text-[13px] text-[#2a1d12]">{shipment.customerName}</div>
            <Link
              href={`/admin/orders/${shipment.orderNumber}` as Route}
              className="mt-2 inline-block text-[12.5px] font-medium text-[#8a5a34] hover:underline"
            >
              View order →
            </Link>
          </Card>

          {canManage ? (
            <ShipmentActions
              shipmentId={shipment.id}
              status={shipment.status as ShipmentStatus}
              superseded={shipment.superseded}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }): ReactNode {
  return (
    <div className="rounded-2xl border border-[#eadbc6] bg-white p-5">
      <div className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-[#8a7a68]">{title}</div>
      {children}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }): ReactNode {
  return (
    <div>
      <div className="text-[11.5px] uppercase tracking-wide text-[#b8a88f]">{label}</div>
      <div className={"mt-0.5 text-[13.5px] text-[#2a1d12] " + (mono ? "font-mono" : "capitalize")}>{value}</div>
    </div>
  );
}
