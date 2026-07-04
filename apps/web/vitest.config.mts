import { defineConfig } from 'vitest/config';

/**
 * Vitest for apps/web — unit tests only (pure, dep-free lib modules like the
 * OTP/session crypto primitives and the rate-window math). Route Handlers and
 * DB-touching modules are covered by the integration suite (ephemeral Postgres),
 * not here.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['.next/**', 'node_modules/**'],
  },
});
