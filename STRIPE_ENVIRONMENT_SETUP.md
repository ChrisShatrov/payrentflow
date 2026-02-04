# Stripe Environment Setup - Dynamic Test/Production Mode

## Overview

The system **automatically detects** whether you're running locally or in production and uses the appropriate Stripe keys:

- **Local Development** → Always uses **TEST mode** (fake payments)
- **Production** → Uses **PRODUCTION mode** (real payments) when `STRIPE_MODE=prod` is set

## How It Works

### Automatic Detection

The system detects the environment by checking:

1. **SUPABASE_URL**: 
   - If it contains `localhost`, `127.0.0.1`, or `.local` → **Local Development**
   - If it contains `.supabase.co` or `supabase.com` → **Production**

2. **Environment Variables**:
   - `ENVIRONMENT`, `NODE_ENV`, or `SUPABASE_ENV` can override (but localhost always wins)

### Local Development (Automatic Test Mode)

When running locally:
- ✅ **Always uses test keys** (even if `STRIPE_MODE=prod` is set)
- ✅ **Prevents accidental production transactions**
- ✅ **Works with test Stripe account IDs**

**Setup for Local:**
```bash
# Set these secrets for local development
supabase secrets set STRIPE_SECRET_KEY_TEST=sk_test_...
# STRIPE_MODE is optional - defaults to test mode locally
```

### Production (Real Payments)

When deployed to production:
- ✅ Uses production keys when `STRIPE_MODE=prod` is set
- ✅ Real tenants make real payments
- ✅ Works with production Stripe account IDs

**Setup for Production:**
```bash
# In Supabase Dashboard → Edge Functions → Secrets
STRIPE_SECRET_KEY_PROD=sk_live_...
STRIPE_MODE=prod
```

## Configuration Examples

### Scenario 1: Local Development Only

**Local `.env` (frontend):**
```env
VITE_SUPABASE_URL=http://localhost:54321
```

**Supabase Secrets (for Edge Functions):**
```bash
supabase secrets set STRIPE_SECRET_KEY_TEST=sk_test_...
# No STRIPE_MODE needed - auto-detects test mode
```

**Result:** ✅ Uses test mode automatically

### Scenario 2: Production Only

**Supabase Dashboard → Edge Functions → Secrets:**
```
STRIPE_SECRET_KEY_PROD=sk_live_...
STRIPE_MODE=prod
```

**Result:** ✅ Uses production mode for real payments

### Scenario 3: Both Local and Production

**Local Development:**
```bash
supabase secrets set STRIPE_SECRET_KEY_TEST=sk_test_...
```

**Production (Supabase Dashboard):**
```
STRIPE_SECRET_KEY_TEST=sk_test_...  # Keep for testing
STRIPE_SECRET_KEY_PROD=sk_live_...  # Production key
STRIPE_MODE=prod                     # Enable production mode
```

**Result:** 
- ✅ Local → Uses test keys automatically
- ✅ Production → Uses production keys when `STRIPE_MODE=prod`

## Safety Features

1. **Localhost Detection**: If `SUPABASE_URL` contains localhost, it **always** uses test mode
2. **Production Key Protection**: Throws error if production key detected locally
3. **Explicit Production Mode**: Requires `STRIPE_MODE=prod` in production
4. **Logging**: Logs which mode is being used for debugging

## Verification

Check the Edge Function logs to see which mode is active:

**Local Development:**
```
[STRIPE-CONFIG] Local development detected (localhost in SUPABASE_URL) - will use TEST mode
[STRIPE-CONFIG] Using STRIPE_SECRET_KEY_TEST for local development
```

**Production:**
```
[STRIPE-CONFIG] Production mode enabled - using production Stripe keys
[STRIPE-CONFIG] Using STRIPE_SECRET_KEY_PROD
```

## Troubleshooting

### "Production mode detected in local environment" Warning

This is **expected and safe**. The system detects you're local and automatically switches to test mode, even if `STRIPE_MODE=prod` is set.

### "No such destination" Error

This means you're trying to use a **test account ID** with a **production key** (or vice versa). The system should prevent this automatically, but if you see this:

1. Check that you're using test account IDs locally
2. Check that you're using production account IDs in production
3. Verify the correct keys are set for each environment

### Setting Secrets

**For Local Development:**
```bash
supabase login
supabase secrets set STRIPE_SECRET_KEY_TEST=sk_test_...
```

**For Production:**
Go to Supabase Dashboard → Project Settings → Edge Functions → Secrets and add:
- `STRIPE_SECRET_KEY_PROD=sk_live_...`
- `STRIPE_MODE=prod`

## Summary

✅ **You don't need to change anything** when switching between local and production  
✅ **Local always uses test mode** automatically  
✅ **Production uses production mode** when `STRIPE_MODE=prod` is set  
✅ **No manual switching needed** - it's fully automatic!
