import Link from "next/link";
import { notFound } from "next/navigation";

const DOCS = {
  privacy: "Privacy Policy",
  terms: "Terms & Conditions",
  shipping: "Shipping Policy",
  refund: "Refund Policy",
} as const;

type Doc = keyof typeof DOCS;

/** Placeholder — replaced by the Content module (PROJECT_PLAN §3.7) with India-specific copy + FSSAI display. */
export default async function LegalPage({
  params,
}: {
  params: Promise<{ doc: string }>;
}) {
  const { doc } = await params;
  if (!(doc in DOCS)) notFound();
  const title = DOCS[doc as Doc];
  return (
    <main className="mx-auto flex min-h-[50vh] w-full max-w-[720px] flex-col items-center justify-center gap-4 px-8 py-24 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-espresso">
        Legal
      </p>
      <h1
        className="text-4xl text-ink"
        style={{ fontFamily: "var(--font-display), serif" }}
      >
        {title}
      </h1>
      <p className="font-body text-[15px] text-espresso">
        This policy is being finalised for launch and will appear here.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-full bg-ink px-6 py-3 font-body text-sm font-semibold text-cream no-underline"
      >
        Back to home
      </Link>
    </main>
  );
}
