import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm tracking-widest uppercase opacity-60">404</p>
      <h1
        className="text-4xl"
        style={{ fontFamily: "var(--font-display), serif" }}
      >
        This page has melted away.
      </h1>
      <p className="max-w-md opacity-70">
        The page you&apos;re looking for doesn&apos;t exist — but the chocolate
        does.
      </p>
      <Link href="/" className="underline underline-offset-4">
        Back to the shop
      </Link>
    </main>
  );
}
