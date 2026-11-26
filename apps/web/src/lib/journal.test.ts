import { describe, expect, it } from 'vitest';
import { brand, routeEnabled, staticNav } from './brand';
import {
  formatArticleDate,
  getArticleBySlug,
  getJournalArticles,
  journalEnabled,
  journalSlugs,
} from './journal';

describe('journal helpers (over brand.journal)', () => {
  it('orders newest-first and exposes every slug', () => {
    const articles = getJournalArticles();
    expect(articles.map((a) => a.slug).sort()).toEqual([...journalSlugs()].sort());
    for (let i = 1; i < articles.length; i += 1) {
      expect(articles[i - 1]!.dateIso >= articles[i]!.dateIso).toBe(true);
    }
  });

  it('looks up by slug and misses cleanly', () => {
    const [first] = journalSlugs();
    expect(first).toBeDefined();
    expect(getArticleBySlug(first!)?.slug).toBe(first);
    expect(getArticleBySlug('no-such-article')).toBeUndefined();
  });

  it('formats fixed ISO dates in the legal-page style and never throws on junk', () => {
    expect(formatArticleDate('2026-05-14')).toBe('14 May 2026');
    expect(formatArticleDate('2026-12-01')).toBe('1 December 2026');
    expect(formatArticleDate('2026-13-01')).toBe('2026-13-01');
    expect(formatArticleDate('garbage')).toBe('garbage');
  });

  it('is enabled for a brand with the feature on AND articles present', () => {
    expect(journalEnabled()).toBe(brand.profile.features.journal && brand.journal.length > 0);
  });
});

describe('feature-gated routes', () => {
  it('keeps every always-on route and gates /journal and /locator on the profile features', () => {
    expect(routeEnabled('/shop')).toBe(true);
    expect(routeEnabled('/shop?category=gifts')).toBe(true);
    expect(routeEnabled('/about')).toBe(true);
    expect(routeEnabled('/journal')).toBe(journalEnabled());
    expect(routeEnabled('/journal/some-article')).toBe(journalEnabled());
    expect(routeEnabled('/locator')).toBe(brand.profile.features.locator);
    // A route that merely starts with the word is not the section.
    expect(routeEnabled('/journalism')).toBe(true);
  });

  it('staticNav filters a pack nav list by those rules and keeps order', () => {
    const links = [
      { href: '/about', label: 'Our story' },
      { href: '/journal', label: 'Journal' },
      { href: '/locator', label: 'Store locator' },
      { href: '/account', label: 'My account' },
    ];
    const out = staticNav(links);
    expect(out.map((l) => l.label)).toEqual(
      links.filter((l) => routeEnabled(l.href)).map((l) => l.label),
    );
    expect(out[0]?.label).toBe('Our story');
    expect(out.at(-1)?.label).toBe('My account');
  });
});
