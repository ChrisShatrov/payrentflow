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
  // PRIMARY CHECK: If SUPABASE_URL contains localhost, we're definitely local
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const isLocalhostInUrl = supabaseUrl.includes("localhost") || 
                           supabaseUrl.includes("127.0.0.1") ||
                           supabaseUrl.includes(".local") ||
                           supabaseUrl.startsWith("http://localhost") ||
                           supabaseUrl.startsWith("http://127.0.0.1");
  
  // SECONDARY CHECK: Check if we're running via Supabase CLI (local dev server)
  // When running locally with 'supabase functions serve', the function runs on localhost:9999
  // We can detect this by checking if there's no production Supabase URL set
  // OR by checking if we're in a local Supabase CLI context
  const isSupabaseProjectUrl = supabaseUrl.includes(".supabase.co") || 
                               supabaseUrl.includes("supabase.com");
  
  // If SUPABASE_URL points to localhost, we're definitely local
  if (isLocalhostInUrl) {
    console.log("[STRIPE-CONFIG] Local development detected (localhost in SUPABASE_URL) - will use TEST mode");
    return true;
  }
  
  // If SUPABASE_URL is NOT a real Supabase project URL, we're likely local
  // (Supabase CLI local dev might not set SUPABASE_URL, or might set it to localhost)
  if (!isSupabaseProjectUrl && !supabaseUrl) {
    console.log("[STRIPE-CONFIG] Local development detected (no production SUPABASE_URL) - will use TEST mode");
    return true;
  }
  
  // Check environment variables as a fallback
  const env = Deno.env.get("ENVIRONMENT")?.toLowerCase() || 
              Deno.env.get("NODE_ENV")?.toLowerCase() ||
              Deno.env.get("SUPABASE_ENV")?.toLowerCase();
  
  // If we have a real Supabase URL and explicit production env, it's production
  if (isSupabaseProjectUrl && (env === "production" || env === "prod")) {
    console.log("[STRIPE-CONFIG] Production environment detected - will use PROD mode if STRIPE_MODE=prod");
    return false;
  }
  
  // If we have a real Supabase URL but no explicit env, check STRIPE_MODE
  // (This handles the case where production doesn't set ENVIRONMENT but sets STRIPE_MODE=prod)
  if (isSupabaseProjectUrl) {
    // Will be determined by STRIPE_MODE in getStripeKey()
    // But if STRIPE_MODE is not set, default to test for safety
    const stripeMode = Deno.env.get("STRIPE_MODE")?.toLowerCase();
    if (!stripeMode || stripeMode === "test") {
      console.log("[STRIPE-CONFIG] Real Supabase URL but STRIPE_MODE not set to 'prod' - defaulting to TEST mode for safety");
      return true; // Default to test for safety
    }
    return false; // Production if STRIPE_MODE=prod is explicitly set
  }
  
  // Default to local if no explicit production setting and not a real Supabase URL
  console.log("[STRIPE-CONFIG] Defaulting to local development (no production indicators found) - will use TEST mode");
  return !env || env === "development" || env === "dev" || env === "local";
}

export function getStripeKey(): string {
  const mode = Deno.env.get("STRIPE_MODE")?.toLowerCase();
  const isLocal = isLocalDevelopment();
  
  // SAFETY: If running locally and no explicit mode, default to test
  if (!mode && isLocal) {
    console.log("[STRIPE-CONFIG] No STRIPE_MODE set and running locally - defaulting to TEST mode for safety");
    const testKey = Deno.env.get("STRIPE_SECRET_KEY_TEST");
    if (testKey) {
      console.log("[STRIPE-CONFIG] Using STRIPE_SECRET_KEY_TEST for local development");
      return testKey;
    }
    const singleKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (singleKey && singleKey.startsWith("sk_test_")) {
      console.log("[STRIPE-CONFIG] Using STRIPE_SECRET_KEY (test key detected) for local development");
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
    // SAFETY: Force test mode if running locally, even if STRIPE_MODE=prod
    // Also check: if we don't have a clear production indicator (real Supabase URL + ENVIRONMENT=prod),
    // default to test mode for safety
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const isSupabaseProjectUrl = supabaseUrl.includes(".supabase.co") || supabaseUrl.includes("supabase.com");
    const env = Deno.env.get("ENVIRONMENT")?.toLowerCase() || Deno.env.get("NODE_ENV")?.toLowerCase();
    const hasClearProductionIndicator = isSupabaseProjectUrl && (env === "production" || env === "prod");
    
    if (isLocal || !hasClearProductionIndicator) {
      console.warn(
        "[STRIPE-CONFIG] Production mode requested but " +
        (isLocal ? "running locally" : "no clear production indicator found") + "! " +
        "Forcing TEST mode to prevent using production keys with test account IDs. " +
        "This is intentional - local development always uses test mode for safety."
      );
      // Force test mode for local development or ambiguous environments
      const testKey = Deno.env.get("STRIPE_SECRET_KEY_TEST");
      if (testKey) {
        console.log("[STRIPE-CONFIG] Using STRIPE_SECRET_KEY_TEST (forced test mode)");
        return testKey;
      }
      const singleKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (singleKey && singleKey.startsWith("sk_test_")) {
        console.log("[STRIPE-CONFIG] Using STRIPE_SECRET_KEY (test key, forced)");
        return singleKey;
      }
      throw new Error(
        "Cannot use production mode " + (isLocal ? "locally" : "without clear production indicators") + ". " +
        "Set STRIPE_SECRET_KEY_TEST=sk_test_... for local development, or remove STRIPE_MODE=prod."
      );
    }
    
    // Production environment - use production keys (only if we have clear production indicators)
    console.log("[STRIPE-CONFIG] Production mode enabled - using production Stripe keys");
    const prodKey = Deno.env.get("STRIPE_SECRET_KEY_PROD");
    if (prodKey) {
      console.log("[STRIPE-CONFIG] Using STRIPE_SECRET_KEY_PROD");
      return prodKey;
    }
    // Fallback to single key if prod key not set
    const singleKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (singleKey && singleKey.startsWith("sk_live_")) {
      console.log("[STRIPE-CONFIG] Using STRIPE_SECRET_KEY (production key detected)");
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
