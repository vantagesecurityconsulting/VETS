/**
 * Normalize the database connection environment variable.
 *
 * `@vercel/postgres` reads `POSTGRES_URL`. Depending on how the database was
 * provisioned, Vercel may instead provide the connection string under a
 * different name (the newer Neon integration commonly uses `DATABASE_URL`).
 * To make the app work regardless of which name is present, copy the first
 * available connection string into `POSTGRES_URL` before anything uses it.
 *
 * This module is imported for its side effect and must run before
 * `@vercel/postgres` is first used.
 */
if (!process.env.POSTGRES_URL) {
  const fallback =
    process.env.POSTGRES_PRISMA_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.NEON_DATABASE_URL ||
    process.env.DATABASE_POSTGRES_URL;
  if (fallback) {
    process.env.POSTGRES_URL = fallback;
  }
}

export {};
