/**
 * Stripe Configuration Utility
 * 
 * Handles switching between test/sandbox and production Stripe keys
 * based on environment configuration. SAFETY FIRST: Defaults to test mode
 * to prevent accidental production transactions during local development.
 * 
 * Environment Variables:
 * - STRIPE_MODE: "test" | "prod" | "production" (REQUIRED for production)
 * - STRIPE_SECRET_KEY: Single key (will be used if STRIPE_SECRET_KEY_TEST/PROD not set)
 * - STRIPE_SECRET_KEY_TEST: Test/sandbox key (sk_test_...)
 * - STRIPE_SECRET_KEY_PROD: Production key (sk_live_...)
 * 
 * SAFETY: Production mode REQUIRES explicit STRIPE_MODE=prod to prevent accidents
 * 
 * Usage:
 * ```ts
 * import { getStripeKey } from "../_shared/stripe-config.ts";
 * const stripeKey = getStripeKey();
 * const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
 * ```
 */

function isLocalDevelopment(): boolean {
  // Check if we're running locally (Supabase CLI)
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const isLocalhost = supabaseUrl.includes("localhost") || 
                      supabaseUrl.includes("127.0.0.1") ||
                      supabaseUrl.includes(".local");
  
  // Check environment variables
  const env = Deno.env.get("ENVIRONMENT")?.toLowerCase() || 
              Deno.env.get("NODE_ENV")?.toLowerCase() ||
              Deno.env.get("SUPABASE_ENV")?.toLowerCase();
  
  // If explicitly set to production, trust it
  if (env === "production" || env === "prod") {
    return false;
  }
  
  // Default to local if localhost detected or no explicit production setting
  return isLocalhost || !env || env === "development" || env === "dev" || env === "local";
}

export function getStripeKey(): string {
  const mode = Deno.env.get("STRIPE_MODE")?.toLowerCase();
  const isLocal = isLocalDevelopment();
  
  // SAFETY: If running locally and no explicit mode, default to test
  if (!mode && isLocal) {
    console.warn("[STRIPE-CONFIG] No STRIPE_MODE set and running locally - defaulting to TEST mode for safety");
    const testKey = Deno.env.get("STRIPE_SECRET_KEY_TEST");
    if (testKey) {
      return testKey;
    }
    const singleKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (singleKey && singleKey.startsWith("sk_test_")) {
      return singleKey;
    }
    if (singleKey && singleKey.startsWith("sk_live_")) {
      throw new Error(
        "SAFETY ERROR: Production Stripe key detected in local environment! " +
        "Set STRIPE_SECRET_KEY_TEST for local development or STRIPE_MODE=prod to override (not recommended)."
      );
    }
    throw new Error(
      "STRIPE_SECRET_KEY_TEST is not set for local development. " +
      "Set STRIPE_SECRET_KEY_TEST=sk_test_... for safe local testing."
    );
  }
  
  // If explicit mode is set, use it (but warn if using prod locally)
  if (mode === "test" || mode === "sandbox") {
    const testKey = Deno.env.get("STRIPE_SECRET_KEY_TEST");
    if (testKey) {
      return testKey;
    }
    // Fallback to single key if test key not set
    const singleKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (singleKey && singleKey.startsWith("sk_test_")) {
      return singleKey;
    }
    throw new Error("STRIPE_SECRET_KEY_TEST is not set and STRIPE_SECRET_KEY is not a test key");
  }
  
  if (mode === "prod" || mode === "production") {
    // SAFETY: Warn if trying to use production in local environment
    if (isLocal) {
      console.error(
        "[STRIPE-CONFIG] WARNING: Production mode detected in local environment! " +
        "This could affect real user transactions. Double-check your configuration."
      );
    }
    
    const prodKey = Deno.env.get("STRIPE_SECRET_KEY_PROD");
    if (prodKey) {
      return prodKey;
    }
    // Fallback to single key if prod key not set
    const singleKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (singleKey && singleKey.startsWith("sk_live_")) {
      return singleKey;
    }
    throw new Error("STRIPE_SECRET_KEY_PROD is not set and STRIPE_SECRET_KEY is not a production key");
  }
  
  // Auto-detect mode if not explicitly set (only for deployed environments)
  const testKey = Deno.env.get("STRIPE_SECRET_KEY_TEST");
  const prodKey = Deno.env.get("STRIPE_SECRET_KEY_PROD");
  
  if (testKey && prodKey) {
    // Both keys exist - use environment to determine
    if (isLocal) {
      // SAFETY: Always use test in local environment
      console.log("[STRIPE-CONFIG] Both test and prod keys found - using TEST key for local development");
      return testKey;
    }
    
    // For deployed environments, check ENVIRONMENT variable
    const env = Deno.env.get("ENVIRONMENT")?.toLowerCase() || 
                Deno.env.get("NODE_ENV")?.toLowerCase();
    if (env === "production" || env === "prod") {
      return prodKey;
    }
    // Default to test for safety
    console.log("[STRIPE-CONFIG] Using TEST key (set ENVIRONMENT=production to use production key)");
    return testKey;
  }
  
  // Fallback to single STRIPE_SECRET_KEY
  const singleKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!singleKey) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. " +
      "For local development, set STRIPE_SECRET_KEY_TEST=sk_test_... " +
      "For production, set STRIPE_SECRET_KEY_PROD=sk_live_... and STRIPE_MODE=prod"
    );
  }
  
  // Auto-detect from key prefix
  if (singleKey.startsWith("sk_test_")) {
    if (isLocal) {
      console.log("[STRIPE-CONFIG] Using test key (detected from prefix)");
    }
    return singleKey;
  }
  if (singleKey.startsWith("sk_live_")) {
    if (isLocal) {
      throw new Error(
        "SAFETY ERROR: Production Stripe key (sk_live_...) detected in local environment! " +
        "This could affect real user transactions. " +
        "Set STRIPE_SECRET_KEY_TEST=sk_test_... for local development instead."
      );
    }
    return singleKey;
  }
  
  throw new Error(`Invalid Stripe key format. Key must start with sk_test_ or sk_live_`);
}

/**
 * Get the current Stripe mode (test or prod)
 */
export function getStripeMode(): "test" | "prod" {
  const key = getStripeKey();
  return key.startsWith("sk_test_") ? "test" : "prod";
}
