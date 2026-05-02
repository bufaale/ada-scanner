/**
 * Vitest global setup.
 *
 * Loads .env.test.local (then .env.local as fallback) so tests can read
 * Supabase + Stripe + AI keys without baking them in.
 *
 * Also sets STATE_SIGNING_SECRET to a stable value so tokens.test.ts can run
 * without depending on a real production secret.
 */
import { config } from "dotenv";
import path from "node:path";

const root = path.resolve(__dirname, "..", "..");
// dotenv stops on first match — load test-local first, then dev local.
config({ path: path.join(root, ".env.test.local") });
config({ path: path.join(root, ".env.local") });

// Provide a deterministic signing secret if the env doesn't supply one.
// Tests for signState/verifyState require a stable secret across the process.
if (!process.env.STATE_SIGNING_SECRET && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.STATE_SIGNING_SECRET =
    "vitest-only-state-signing-secret-do-not-use-in-prod";
}
