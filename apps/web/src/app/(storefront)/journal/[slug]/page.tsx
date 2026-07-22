import type { ReactNode } from "react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ContentPageShell,
  ContentClosingCta,
  CONTENT_FOCUS_RING,
} from "@/components/content/ContentPageShell";
import { PhotoSlot } from "@/components/home/PhotoSlot";
import {
  getArticleBySlug,
  journalSlugs,
  formatArticleDate,
  type Article,
  type ArticleBlock,
} from "@/lib/content/journal";

const SITE_URL = "https://kakoa.in";

export function generateStaticParams(): { slug: string }[] {
  return journalSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (article === undefined) {
    return { title: "Journal" };
  }
  return {
    title: article.title,
    description: article.excerpt,
    alternates: { canonical: `/journal/${article.slug}` },
  };
}

/** Render a single prose block as nodes — never `dangerouslySetInnerHTML`. */
function ArticleBody({ blocks }: { blocks: readonly ArticleBlock[] }): ReactNode {
  return (
    <div className="max-w-[68ch]">
      {blocks.map((block, index) => {
        if (block.type === "h2") {
          return (
            <h2
              key={index}
              className="mt-11 mb-3 font-display text-[26px] leading-[1.14] text-balance text-ink md:text-[30px]"
            >
              {block.text}
            </h2>
          );
        }
        if (block.type === "ul") {
          return (
            <ul key={index} className="my-6 flex flex-col gap-3">
              {block.items.map((item, itemIndex) => (
                <li
                  key={itemIndex}
                  className="flex gap-3 font-body text-[17px] leading-[1.65] text-ink-soft"
                >
                  <span
                    aria-hidden="true"
                    className="mt-[11px] h-[6px] w-[6px] flex-none rounded-pill bg-gold"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p
            key={index}
            className="mt-5 font-body text-[17px] leading-[1.72] text-ink-soft first:mt-0"
          >
            {block.text}
          </p>
        );
      })}
    </div>
  );
}

export default async function JournalArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<ReactNode> {
  const { slug } = await params;
  const article: Article | undefined = getArticleBySlug(slug);
  if (article === undefined) {
    notFound();
  }

  const formattedDate = formatArticleDate(article.dateIso);

  // BlogPosting structured data — brand-authored, never a fabricated individual.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.excerpt,
    datePublished: article.dateIso,
    dateModified: article.dateIso,
    articleSection: article.category,
    inLanguage: "en-IN",
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE_URL}/journal/${article.slug}`,
    },
    author: {
      "@type": "Organization",
      name: "KAKOA Kitchen",
    },
    publisher: {
      "@type": "Organization",
      name: "KAKOA",
      url: SITE_URL,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ContentPageShell
        breadcrumb={[
          { label: "Home", href: "/" },
          { label: "Journal", href: "/journal" },
          { label: article.title, href: `/journal/${article.slug}` as Route },
        ]}
        eyebrow={article.category}
        title={article.title}
        meta={`${formattedDate} · ${article.readMinutes} min read`}
        lede={article.excerpt}
        width="narrow"
        footer={
          <ContentClosingCta
            eyebrow="Keep exploring"
            title="From the page to the palate."
            body="Put what you've read to the test with a bar from our latest small batch — shipped cold, ready to taste square by square."
            primary={{ label: "Shop the collection", href: "/shop" }}
            secondary={{ label: "Back to the Journal", href: "/journal" }}
          />
        }
      >
        {/* Framed cover — real photo when present, else a token-gradient slot. */}
        <figure className="relative mb-11 aspect-[16/9] overflow-hidden rounded-[24px] border border-line-soft bg-cream-2 shadow-soft">
          <PhotoSlot
            alt=""
            sizes="(max-width: 820px) 100vw, 820px"
            priority
          >
            <div
              className={`absolute inset-0 bg-gradient-to-br ${article.coverTone}`}
            />
          </PhotoSlot>
          <span className="absolute bottom-3 left-3 z-10 rounded-pill bg-cream/[0.92] px-[10px] py-[5px] font-mono text-[11px] font-semibold tracking-[0.06em] text-ink uppercase shadow-soft backdrop-blur-sm">
            {article.category}
          </span>
        </figure>

        <article>
          <ArticleBody blocks={article.body} />

          <p className="mt-12 font-mono text-[11.5px] tracking-[0.08em] text-ink-muted uppercase">
            Written by the KAKOA Kitchen
          </p>
        </article>

        <div className="mt-8 border-t border-line-soft pt-8">
          <Link
            href="/journal"
            className={`inline-flex items-center gap-1.5 rounded-sm font-body text-[14.5px] font-bold text-ink transition-[gap] hover:gap-2.5 ${CONTENT_FOCUS_RING}`}
          >
            <span aria-hidden="true">←</span> Back to the Journal
          </Link>
        </div>
      </ContentPageShell>
    </>
  );
}
