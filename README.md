# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## Dynamic Lease Generation + DocuSign Integration

This project includes a complete lease generation and e-signature system with DocuSign integration.

### Setup Instructions

#### 1. Database Migration

Run the migration to create the necessary tables:

```bash
# Apply the migration
supabase migration up
```

Or manually run: `supabase/migrations/20260120000000_lease_templates_and_leases.sql`

#### 2. Supabase Storage Bucket

Create a storage bucket for lease PDFs:

```sql
-- Run in Supabase SQL Editor
INSERT INTO storage.buckets (id, name, public)
VALUES ('leases', 'leases', false);
```

Set up storage policies:

```sql
-- Allow authenticated users to upload/download their own leases
CREATE POLICY "Users can upload leases"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'leases' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can download leases"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'leases');
```

#### 3. Environment Variables

Add these to your `.env` file (or Supabase Edge Function secrets):

```env
# DocuSign
DOCUSIGN_INTEGRATION_KEY=your_integration_key
DOCUSIGN_SECRET_KEY=your_secret_key
DOCUSIGN_ACCOUNT_ID=your_account_id
DOCUSIGN_BASE_URL=https://demo.docusign.net  # Use https://www.docusign.net for production
DOCUSIGN_REDIRECT_URI=https://your-project.supabase.co/functions/v1/docusign-callback
DOCUSIGN_WEBHOOK_SECRET=your_webhook_secret

# Resend (for email notifications)
RESEND_API_KEY=your_resend_api_key

# Encryption (optional, defaults to DOCUSIGN_INTEGRATION_KEY)
ENCRYPTION_KEY=your_32_byte_key

# Frontend URL (for redirects)
FRONTEND_URL=http://localhost:5173  # Update for production
```

#### 4. DocuSign Setup

1. Create a DocuSign Integration (OAuth app) in the DocuSign Developer Center
2. Set the redirect URI to: `https://your-project.supabase.co/functions/v1/docusign-callback`
3. Enable scopes: `signature`, `impersonation`
4. Set up a Connect webhook pointing to: `https://your-project.supabase.co/functions/v1/docusign-webhook`
5. Configure webhook events: `envelope-sent`, `envelope-delivered`, `envelope-signed`, `envelope-completed`, `envelope-declined`, `envelope-voided`

#### 5. Dependencies

The PDF generation uses Puppeteer. For Supabase Edge Functions, you may need to:

- Use `npm:puppeteer@21.5.0` (already configured in the function)
- Or use a headless browser service like Browserless

#### 6. Testing the Flow

1. **Landlord creates template**: Navigate to `/admin/lease-templates` and create a template
2. **Connect DocuSign**: Go to `/admin/settings` and connect DocuSign account
3. **Create lease**: Navigate to `/admin/leases` and create a new lease
4. **Send for signature**: Click "Send for Signature" on a draft lease
5. **Tenant signs**: Tenant receives email and can sign at `/tenant/leases`
6. **Webhook updates**: DocuSign webhook automatically updates lease status
7. **Download executed PDF**: Both parties can download the signed PDF

### Features

- **Template Editor**: Create customizable lease templates with variable placeholders
- **Dynamic PDF Generation**: Generate PDFs from HTML templates with variable replacement
- **DocuSign Integration**: Full OAuth flow per landlord, embedded signing, webhook handling
- **Email Notifications**: Automated emails via Resend (ready to sign, reminders, completed)
- **Audit Trail**: Complete event log for each lease
- **Security**: RLS policies, encrypted token storage, webhook signature verification

### File Structure

```
supabase/
  migrations/
    20260120000000_lease_templates_and_leases.sql
  functions/
    generate-lease-pdf/
      index.ts
    docusign-connect/
      index.ts
    docusign-callback/
      index.ts
    create-lease/
      index.ts
    send-lease-for-signature/
      index.ts
    get-embedded-signing-url/
      index.ts
    docusign-webhook/
      index.ts
    send-lease-email/
      index.ts
    _shared/
      docusign-service.ts

src/
  pages/
    admin/
      AdminLeaseTemplates.tsx
      AdminLeases.tsx
    tenant/
      TenantLeases.tsx
  components/
    admin/
      LeaseTemplateEditor.tsx
      CreateLeaseWizard.tsx
      LeasePreviewModal.tsx
      DocuSignConnectDialog.tsx
    tenant/
      LeaseSigningModal.tsx
    shared/
      LeaseStatusBadge.tsx
      LeaseTimeline.tsx
```

### Troubleshooting

- **PDF generation fails**: Ensure Puppeteer dependencies are available in the Edge Function environment
- **DocuSign OAuth fails**: Check redirect URI matches exactly in DocuSign settings
- **Webhook not receiving events**: Verify webhook URL is accessible and HMAC secret matches
- **Email not sending**: Check Resend API key and domain verification
