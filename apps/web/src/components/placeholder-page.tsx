import { Card } from "@kakoa/ui";

export function PlaceholderPage({ name }: { name: string }) {
  return (
    <main className="flex min-h-[60vh] items-center justify-center px-6 py-16">
      <Card>
        <div className="flex flex-col items-center gap-2 px-10 py-8 text-center">
          <h1
            className="text-3xl"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            {name}
          </h1>
          <p className="text-sm opacity-70">
            Placeholder — this page ships with its module.
          </p>
        </div>
      </Card>
    </main>
  );
}
