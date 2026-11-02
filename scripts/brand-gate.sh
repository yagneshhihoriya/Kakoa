#!/usr/bin/env bash
# brand-gate — fails when brand- or vertical-specific literals leak outside the
# brand packs. The storefront, admin and shared packages must be brand-neutral:
# everything KAKOA/chocolate lives in the pack directories, the brand seed, the
# kernel preset catalogue, tests and docs. Run: pnpm brand-gate
#
# Exit 1 lists every offending `file:line: text`; exit 0 prints the scan size.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

# The words that may only appear inside a brand pack (case-insensitive), plus
# the identifiers Phase 1 retired (a reintroduction is a leak, not a revival).
PATTERN='KAKOA|kakoa|chocolate|cocoa|cacao|praline|truffle|bean-to-bar|ships cold|ChocoScene|HeroShowcase|SEEDED_SLUGS|lib/content/journal'

# Paths that are allowed to carry the brand: the two kakoa packs, the brand
# registry (the ONE place that enumerates brand keys), the kakoa seed, the
# kernel preset catalogue (vertical templates), tests, docs, CI config and the
# local editor launch config.
EXEMPT_PATHS='^(apps/web/src/brands/kakoa/|packages/brands/src/kakoa/|packages/brands/src/(index|keys)\.ts$|packages/db/src/seed[^/]*\.ts$|packages/kernel/src/presets\.ts$|docs/|\.github/|\.claude/|scripts/brand-gate\.sh$)'
# File kinds that are not source: tests, markdown, lockfiles/manifests (the
# `@kakoa/*` package scope and the kakoa tsconfig/alias defaults live there),
# binary assets.
EXEMPT_FILES='(\.test\.[cm]?[jt]sx?$|\.md$|(^|/)(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|turbo\.json|tsconfig[^/]*\.json|\.env\.example)$|\.(png|jpe?g|webp|avif|gif|ico|svg|otf|ttf|woff2?|pdf|dump)$)'

# Tokens that contain a forbidden word but are identifiers, not brand copy.
# Each is stripped from a line before the pattern is applied.
#   @kakoa/<pkg>                 workspace package scopes (Phase P renames them)
#   *-cocoa / *-espresso / ...   Tailwind utilities + CSS custom properties: the
#                                token NAMES stay chocolate-flavoured by design,
#                                only their VALUES move per brand (theme.css)
#   kakoa.tracking.jwt.v1        HMAC info string — changing it would invalidate
#                                every issued guest-tracking token
#   mock.kakoa.local             the mock shipping provider's fake label host
#   brands/kakoa                 the build-time pack path in alias/config plumbing
ALLOW_TOKENS=(
  '@kakoa/[a-z0-9-]+'
  '[A-Za-z0-9_-]*-(cocoa|espresso|caramel)[A-Za-z0-9_/.%-]*'
  'kakoa\.tracking\.jwt\.v1'
  'mock\.kakoa\.local'
  'brands/kakoa'
)

list_files() {
  git ls-files | grep -vE "$EXEMPT_PATHS" | grep -vE "$EXEMPT_FILES" || true
}

scanned=$(list_files | wc -l | tr -d ' ')

# grep narrows to candidate lines; perl strips comments + allowlisted tokens and
# re-tests, so a mention that only explains history does not fail the gate.
hits=$(
  list_files | tr '\n' '\0' | xargs -0 grep -nIiE -- "$PATTERN" 2>/dev/null |
    PATTERN="$PATTERN" ALLOW="$(IFS='|'; echo "${ALLOW_TOKENS[*]}")" perl -ne '
      chomp;
      my ($file, $line, $text) = /^(.+?):(\d+):(.*)$/ or next;
      my $s = $text;
      # comments: html, block (same line), line, continuation lines of a block,
      # # comments in shell/yaml/env files and -- comments in SQL migrations
      $s =~ s{<!--.*?-->}{}g;
      $s =~ s{/\*.*?\*/}{}g;
      $s =~ s{(^|\s)//.*$}{};
      $s = "" if $s =~ m{^\s*(\*|/\*|//)};
      $s = "" if $file =~ /\.(sh|ya?ml|toml|env[^\/]*)$/ && $s =~ /^\s*#/;
      $s =~ s{(^|\s)--.*$}{} if $file =~ /\.sql$/;
      # allowlisted identifiers
      $s =~ s{$ENV{ALLOW}}{}gi;
      print "$file:$line: $text\n" if $s =~ /$ENV{PATTERN}/i;
    '
) || true

if [ -n "$hits" ]; then
  count=$(printf '%s\n' "$hits" | wc -l | tr -d ' ')
  echo "brand-gate: $count brand/vertical literal(s) outside the brand packs (scanned $scanned files):" >&2
  printf '%s\n' "$hits" >&2
  exit 1
fi
echo "brand-gate: clean ($scanned files scanned, 0 leaks)"
