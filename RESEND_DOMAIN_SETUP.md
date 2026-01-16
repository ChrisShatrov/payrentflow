# Resend Domain Verification Setup Guide

To use `support@payrentflow.com` for sending emails, you need to verify your domain in Resend.

## Step 1: Verify Your Domain in Resend

1. **Go to Resend Dashboard**: https://resend.com/domains
2. **Click "Add Domain"**
3. **Enter your domain**: `payrentflow.com`
4. **Add DNS Records**: Resend will provide you with DNS records to add to your domain

## Step 2: Add DNS Records

You'll need to add these DNS records to your domain provider (wherever you purchased `payrentflow.com`):

### Required DNS Records:

1. **SPF Record** (TXT record):
   - Name: `@` or `payrentflow.com`
   - Value: `v=spf1 include:resend.com ~all`
   - TTL: 3600

2. **DKIM Records** (TXT records):
   - Resend will provide 2-3 DKIM records with specific names and values
   - Example format:
     - Name: `resend._domainkey` or similar
     - Value: (provided by Resend)
     - TTL: 3600

3. **DMARC Record** (TXT record):
   - Name: `_dmarc`
   - Value: `v=DMARC1; p=none; rua=mailto:dmarc@payrentflow.com`
   - TTL: 3600

## Step 3: Wait for Verification

- DNS propagation can take 24-48 hours
- Resend will show verification status in the dashboard
- Once verified, you'll see a green checkmark

## Step 4: Set Environment Variable in Supabase

After domain verification:

1. **Go to Supabase Dashboard**: https://supabase.com/dashboard/project/heismaqehgqxcrndtqmz
2. **Navigate to**: Settings → Edge Functions → Environment Variables
3. **Add/Update**:
   - Key: `RESEND_FROM_EMAIL`
   - Value: `RentFlow <support@payrentflow.com>`

## Step 5: Redeploy Edge Functions

After setting the environment variable, redeploy all email functions:

```bash
supabase functions deploy send-contact-email
supabase functions deploy send-tenant-email
supabase functions deploy send-tenant-invite
supabase functions deploy send-notification-email
```

Or deploy all at once:
```bash
supabase functions deploy
```

## Testing

Once everything is set up:
1. Test the contact form on your homepage
2. Check that emails arrive at `support@payrentflow.com`
3. Verify the "From" address shows as `RentFlow <support@payrentflow.com>`

## Troubleshooting

- **Emails not sending**: Check Resend dashboard for error logs
- **Domain not verified**: Wait 24-48 hours for DNS propagation
- **Still using onboarding@resend.dev**: Make sure `RESEND_FROM_EMAIL` is set in Supabase
- **403 errors**: Domain might not be fully verified yet

## Current Status

✅ All email functions updated to use `support@payrentflow.com`
⏳ Domain verification pending in Resend
⏳ Environment variable needs to be set in Supabase
