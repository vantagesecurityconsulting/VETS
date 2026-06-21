/**
 * Environment variable validation.
 * Throws a clear error at import time if required variables are missing or invalid.
 */
import "./db-env"; // normalize DATABASE_URL -> POSTGRES_URL before validating

function requireEnv(name: string, opts?: { minLength?: number }): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Please set it in your .env.local (locally) or in Vercel → Project Settings → Environment Variables.`
    );
  }
  if (opts?.minLength && value.length < opts.minLength) {
    throw new Error(
      `Environment variable ${name} must be at least ${opts.minLength} characters long.`
    );
  }
  return value;
}

/**
 * Validate all environment variables the app depends on.
 * Called lazily from places that need DB / session access so that
 * tooling (e.g. `next build`) doesn't fail purely on import.
 */
export function validateEnv(): void {
  // POSTGRES_URL is provided automatically by Vercel Postgres.
  requireEnv("POSTGRES_URL");
  // SESSION_SECRET must be supplied manually (see README).
  requireEnv("SESSION_SECRET", { minLength: 32 });
}

export function getSessionSecret(): string {
  return requireEnv("SESSION_SECRET", { minLength: 32 });
}
