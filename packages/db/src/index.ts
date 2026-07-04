/**
 * @kakoa/db — Drizzle schema + client for the KAKOA store.
 * Schema is safe anywhere; `db`/`queryClient` are server-only.
 */
export * from './schema/index';
export { db, queryClient, type Db } from './client';
