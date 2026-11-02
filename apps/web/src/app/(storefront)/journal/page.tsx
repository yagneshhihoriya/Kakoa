import type { ReactNode } from "react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ContentPageShell,
  ClosingCta,
  CONTENT_FOCUS_RING,
} from "@/components/content/ContentPageShell";
import { PhotoSlot } from "@/components/home/PhotoSlot";
import {
  getJournalArticles,
  formatArticleDate,
  journalEnabled,
  type Article,
} from "@/lib/journal";
import { brand } from "@/lib/brand";

const { index: copy } = brand.copy.journal;

export const metadata: Metadata = {
  title: "The Journal",
  description: copy.metaDescription,
  alternates: { canonical: "/journal" },
};

/**
 * The Journal index — an editorial card grid of brand-authored articles. Each
 * card reuses the catalog `ProductCard` hover-rise vocabulary (raised paper,
 * rounded-[20px], border-line-soft, shadow-card → hover:shadow-lift, a group
 * cover that slowly zooms) and links, whole-card, to the article. Server
 * component — imagery is a token-gradient `PhotoSlot` placeholder for now, so
 * real photography drops in later with no markup change.
 */

/** One editorial card in the Journal grid. */
function ArticleCard({ article }: { article: Article }): ReactNode {
  return (
    <article
      className={`group relative flex h-full flex-col overflow-hidden rounded-[20px] border border-line-soft bg-surface shadow-card transition-[box-shadow,transform] duration-[var(--duration-base)] ease-brand hover:-translate-y-1 hover:shadow-lift motion-reduce:transition-none motion-reduce:hover:translate-y-0`}
    >
      {/* Cover — real photo when present, else a token-gradient placeholder. */}
      <div className="relative aspect-[3/2] overflow-hidden bg-cream-2">
        <div className="absolute inset-0 transition-transform duration-[650ms] ease-brand group-hover:scale-[1.045] motion-reduce:transition-none motion-reduce:group-hover:scale-100">
          <PhotoSlot
            alt=""
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          >
            <div
              className={`absolute inset-0 bg-gradient-to-br ${article.coverTone}`}
            />
          </PhotoSlot>
        </div>
        <span className="absolute top-3 left-3 z-10 rounded-pill bg-cream/[0.92] px-[10px] py-[5px] font-mono text-[11px] font-semibold tracking-[0.06em] text-ink uppercase shadow-soft backdrop-blur-sm">
          {article.category}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col px-[18px] pt-[18px] pb-5">
        <p className="font-mono text-[11px] font-medium tracking-[0.08em] text-ink-muted uppercase">
          <time dateTime={article.dateIso}>
            {formatArticleDate(article.dateIso)}
          </time>
          <span aria-hidden="true" className="mx-1.5 text-line">
            ·
          </span>
          {article.readMinutes} min read
        </p>
        <h2 className="mt-2 font-display text-[21px] leading-snug text-balance text-ink">
          <Link
            href={`/journal/${article.slug}` as Route}
            className={`transition-colors group-hover:text-espresso focus-visible:outline-none after:absolute after:inset-0 after:z-0 after:content-[''] ${CONTENT_FOCUS_RING} rounded-sm`}
          >
            {article.title}
          </Link>
        </h2>
        <p className="mt-2 line-clamp-3 flex-1 font-body text-[14px] leading-relaxed text-ink-soft">
          {article.excerpt}
        </p>
        <p className="mt-4 inline-flex items-center gap-1.5 font-body text-[13.5px] font-bold text-ink transition-[gap] group-hover:gap-2.5">
          Read the story <span aria-hidden="true">→</span>
        </p>
      </div>
    </article>
  );
}

export default function JournalPage(): ReactNode {
  // A brand without a Journal (feature off, or no articles) has no such page.
  if (!journalEnabled()) notFound();
  const articles = getJournalArticles();

  return (
    <ContentPageShell
      eyebrow="The Journal"
      title={copy.title}
      width="wide"
      lede={copy.lede}
      footer={<ClosingCta copy={copy.closing} />}
    >
      {articles.length > 0 ? (
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-[22px] lg:grid-cols-3">
          {articles.map((article) => (
            <li key={article.slug} className="h-full">
              <ArticleCard article={article} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-[22px] border border-line-soft bg-cream-2 px-8 py-16 text-center">
          <div className="flex justify-center">
            <span className="font-mono text-eyebrow font-medium tracking-[0.12em] text-espresso uppercase">
              {copy.empty.eyebrow}
            </span>
          </div>
          <h2 className="mx-auto mt-4 max-w-[24ch] font-display text-h3 leading-[1.1] text-balance text-ink">
            {copy.empty.title}
          </h2>
          <p className="mx-auto mt-3 max-w-[46ch] font-body text-lead text-ink-soft">
            {copy.empty.body}
          </p>
          <div className="mt-7">
            <Link
              href={copy.empty.cta.href as Route}
              className={`inline-block rounded-pill bg-ink px-[30px] py-4 font-body text-[15.5px] font-bold text-cream shadow-lift transition-[transform,background-color] duration-[var(--duration-base)] ease-brand hover:-translate-y-0.5 hover:bg-ink-hover motion-reduce:transform-none ${CONTENT_FOCUS_RING}`}
            >
              {copy.empty.cta.label}
            </Link>
          </div>
        </div>
      )}
    </ContentPageShell>
  );
}
