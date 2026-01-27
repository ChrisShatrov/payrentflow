# Stripe Configuration Guide

This guide explains how to configure Stripe keys for test/sandbox and production environments.

## Overview

The application now supports automatic switching between Stripe test and production keys based on environment configuration. All edge functions use a shared utility (`_shared/stripe-config.ts`) to get the appropriate Stripe key.

## ⚠️ Safety Features

**IMPORTANT:** The system is designed with safety in mind to prevent accidental production transactions during local development:

- **Local development ALWAYS defaults to test mode** - even if production keys are present
- **Production mode requires explicit `STRIPE_MODE=prod`** - cannot be accidentally enabled
- **Warnings are logged** when production keys are detected in local environments
- **Errors are thrown** if you try to use production keys locally without explicit override

This ensures you can safely test locally without affecting real user transactions.

## Configuration Options

### Option 1: Separate Test and Production Keys (Recommended)

Set both keys in your Supabase project environment variables:

```env
STRIPE_SECRET_KEY_TEST=sk_test_your_test_key_here
STRIPE_SECRET_KEY_PROD=sk_live_your_production_key_here
STRIPE_MODE=test  # Only set to "prod" in production environment
```

**For Local Development:**
- **DO NOT set `STRIPE_MODE=prod`** - the system will automatically use test keys
- Set only `STRIPE_SECRET_KEY_TEST=sk_test_...` 
- The system will default to test mode automatically
- Even if you accidentally set a production key, it will error out for safety

**For Production:**
- Set `STRIPE_MODE=prod` in your production Supabase environment (REQUIRED)
- Set `STRIPE_SECRET_KEY_PROD=sk_live_...`
- The system will use the production key only when explicitly set

### Option 2: Single Key (Auto-Detection)

If you only set one key, the system will auto-detect test vs production based on the key prefix:

```env
STRIPE_SECRET_KEY=sk_test_your_key_here  # Test key (starts with sk_test_)
# OR
STRIPE_SECRET_KEY=sk_live_your_key_here  # Production key (starts with sk_live_)
```

## Environment Variable Priority & Safety

The system checks for keys in this order with safety checks:

1. **Local Development (automatic detection):**
   - If running on localhost or no explicit production environment → **ALWAYS uses test keys**
   - Even if `STRIPE_SECRET_KEY_PROD` is set, it will use `STRIPE_SECRET_KEY_TEST`
   - **Will error if only production key is found** (prevents accidents)

2. **If `STRIPE_MODE` is explicitly set:**
   - `STRIPE_MODE=test` → Uses `STRIPE_SECRET_KEY_TEST` (or falls back to `STRIPE_SECRET_KEY` if it starts with `sk_test_`)
   - `STRIPE_MODE=prod` → Uses `STRIPE_SECRET_KEY_PROD` (with warning if in local environment)

3. **If `STRIPE_MODE` is NOT set (deployed environments only):**
   - If both `STRIPE_SECRET_KEY_TEST` and `STRIPE_SECRET_KEY_PROD` exist:
     - Checks `ENVIRONMENT` or `NODE_ENV` environment variable
     - If `ENVIRONMENT=production` or `NODE_ENV=production` → Uses production key
     - Otherwise → Uses test key (safe default)
   - If only one key exists → Uses that key (auto-detects from prefix)

## Setting Environment Variables in Supabase

### For Local Development (Supabase CLI)

1. Create or edit `.env.local` in your project root:
```env
STRIPE_SECRET_KEY_TEST=sk_test_...
STRIPE_SECRET_KEY_PROD=sk_live_...
STRIPE_MODE=test
```

2. Or set in Supabase Dashboard:
   - Go to Project Settings → Edge Functions → Secrets
   - Add each variable

### For Production (Supabase Dashboard)

1. Go to your Supabase project dashboard
2. Navigate to **Project Settings** → **Edge Functions** → **Secrets**
3. Add the following secrets:
   - `STRIPE_SECRET_KEY_TEST` (your test key)
   - `STRIPE_SECRET_KEY_PROD` (your production key)
   - `STRIPE_MODE=prod` (for production environment)

## Testing

To verify which key is being used, check the function logs. The utility logs the mode when keys are verified:

```
[CREATE-CONNECT-ACCOUNT] Stripe key verified - {"mode":"test"}
```

## Updated Functions

All Stripe-related edge functions have been updated to use the new configuration:

- `create-rent-payment`
- `create-connect-account`
- `check-connect-status`
- `get-stripe-login-link`
- `sync-payment-status`
- `stripe-webhook`

## Troubleshooting

**Error: "STRIPE_SECRET_KEY is not set"**
- Make sure you've set at least one of: `STRIPE_SECRET_KEY`, `STRIPE_SECRET_KEY_TEST`, or `STRIPE_SECRET_KEY_PROD`

**Error: "SAFETY ERROR: Production Stripe key detected in local environment!"**
- This is a **safety feature** to prevent accidental production transactions
- For local development, set `STRIPE_SECRET_KEY_TEST=sk_test_...` instead
- Do NOT use production keys (`sk_live_...`) in local development

**Error: "Invalid Stripe key format"**
- Stripe keys must start with `sk_test_` (test) or `sk_live_` (production)
- Check that your key is copied correctly

**Using wrong key in production**
- Set `STRIPE_MODE=prod` in your production environment (REQUIRED)
- Ensure `STRIPE_SECRET_KEY_PROD=sk_live_...` is set
- The system will NOT use production keys without explicit `STRIPE_MODE=prod`

**Local development using test keys automatically**
- This is correct behavior! The system defaults to test mode for safety
- You don't need to set `STRIPE_MODE=test` - it's automatic
- Only set `STRIPE_MODE=prod` in your actual production Supabase project
