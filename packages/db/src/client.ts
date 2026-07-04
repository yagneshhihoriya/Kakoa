/**
 * Database client — postgres-js + drizzle.
 *
 * SERVER-ONLY: never import this module from client components or any
 * browser bundle. (Deliberately NOT using the `server-only` package so the
 * seed script and other tsx/node tooling can import it directly.)
 *
 * Uses the POOLED connection string (Supabase pgbouncer/Supavisor in
 * transaction mode), hence `prepare: false` — prepared statements are not
 * supported through transaction-mode pooling.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set (expected the pooled connection URL)');
}

/** Raw postgres-js client — exported for lifecycle control (e.g. seed exit). */
export const queryClient = postgres(databaseUrl, {
  prepare: false,
  max: 10,
});

/** Drizzle instance with the full KAKOA schema attached. */
export const db = drizzle(queryClient, { schema });

export type Db = typeof db;
