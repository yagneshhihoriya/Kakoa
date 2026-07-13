import Link from "next/link";

export const metadata = { title: "Sign in" };

/** Placeholder — replaced by the Auth/OTP module (PROJECT_PLAN §3.5). */
export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-[50vh] w-full max-w-[720px] flex-col items-center justify-center gap-4 px-8 py-24 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-espresso">
        Coming soon
      </p>
      <h1
        className="text-4xl text-ink"
        style={{ fontFamily: "var(--font-display), serif" }}
      >
        Sign in
      </h1>
      <p className="font-body text-[15px] text-espresso">Passwordless OTP sign-in is on its way.</p>
      <Link
        href="/shop"
        className="mt-2 rounded-full bg-ink px-6 py-3 font-body text-sm font-semibold text-cream no-underline"
      >
        Browse the collection
      </Link>
    </main>
  );
}
