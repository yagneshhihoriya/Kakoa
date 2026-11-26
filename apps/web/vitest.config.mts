import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Vitest for apps/web — unit tests only (pure, dep-free lib modules like the
 * OTP/session crypto primitives and the rate-window math). Route Handlers and
 * DB-touching modules are covered by the integration suite (ephemeral Postgres),
 * not here.
 *
 * `@brand` mirrors the tsconfig path (the kakoa pack) — unit tests exercise the
 * pack the typecheck proves, not the BRAND_KEY of the shell they run in.
 */
export default defineConfig({
  // Components are authored with the automatic runtime (Next's `jsx: preserve`
  // leaves it to the bundler); vitest's esbuild must do the same.
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@brand': path.resolve(__dirname, 'src/brands/kakoa'),
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['.next/**', 'node_modules/**'],
  },
});
