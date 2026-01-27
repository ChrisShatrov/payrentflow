# Stripe Keys Setup Guide

## Which Keys You Need

From your Stripe dashboard, you only need **ONE key** for the backend:

✅ **Secret key** (`sk_live_...581F`) - **THIS IS THE ONE YOU NEED**

❌ **Publishable key** (`pk_live_...`) - NOT needed (frontend doesn't use Stripe.js directly)
❌ **Restricted keys** (`rk_live_...`) - NOT needed (these are for specific API access)

## Where to Put the Production Key

### For Production Environment (Supabase Dashboard)

1. Go to your **Supabase Dashboard** → Your Project
2. Navigate to **Project Settings** → **Edge Functions** → **Secrets**
3. Add these secrets:

```
STRIPE_SECRET_KEY_PROD=sk_live_...581F
STRIPE_MODE=prod
```

**Important:** 
- Copy the **full** secret key (the one that starts with `sk_live_` and ends with `...581F`)
- Make sure to set `STRIPE_MODE=prod` - this is REQUIRED for production

### For Local Development (Test Keys)

1. In Stripe Dashboard, switch to **Test mode** (toggle in top right)
2. Copy your **Test secret key** (starts with `sk_test_...`)
3. In your local Supabase environment (or `.env.local`):

```
STRIPE_SECRET_KEY_TEST=sk_test_...your_test_key
```

**Note:** You don't need to set `STRIPE_MODE` for local - it automatically uses test keys

## Quick Setup Checklist

### Production Setup:
- [ ] Copy production **Secret key** (`sk_live_...`) from Stripe Dashboard
- [ ] Go to Supabase Dashboard → Project Settings → Edge Functions → Secrets
- [ ] Add `STRIPE_SECRET_KEY_PROD=sk_live_...` (paste full key)
- [ ] Add `STRIPE_MODE=prod`
- [ ] Save secrets

### Local Development Setup:
- [ ] Switch Stripe Dashboard to **Test mode**
- [ ] Copy test **Secret key** (`sk_test_...`)
- [ ] Add `STRIPE_SECRET_KEY_TEST=sk_test_...` to local environment
- [ ] Done! System will automatically use test keys

## Security Notes

- ⚠️ **Never commit keys to git** - always use environment variables
- ⚠️ **Production keys should ONLY be in production Supabase project**
- ⚠️ **Test keys should ONLY be in local development**
- ✅ The system prevents accidental production key usage in local development

## Verifying It Works

After setting up, check the edge function logs. You should see:
- Production: `[STRIPE-CONFIG] Using production key`
- Local: `[STRIPE-CONFIG] Using test key (detected from prefix)`
