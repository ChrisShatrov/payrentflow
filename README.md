# RentFlow

**Pay Rent, Stress-Free.**

RentFlow is a comprehensive property management and rent collection platform that simplifies rental operations for landlords and tenants. Manage multiple properties, collect rent online, generate statements, track payments, and handle lease agreements—all from one unified platform.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Setup Instructions](#setup-instructions)
- [Development](#development)
- [Deployment](#deployment)
- [Key Features](#key-features)

## Features

### For Landlords
- **Property Management**: Create and manage multiple properties and units
- **Tenant Management**: Invite tenants, assign units, and track tenant information
- **Rent Collection**: Accept online payments via Stripe Connect
- **Statement Generation**: Automated monthly rent statements with pro-rated calculations
- **Lease Management**: Create, customize, and send lease agreements via DocuSign
- **Payment Tracking**: Monitor payments, late fees, and outstanding balances
- **Dashboard Analytics**: View property statistics, payment history, and financial summaries

### For Tenants
- **Dashboard**: View unit information, rent due, and payment history
- **Online Payments**: Make rent payments securely through Stripe
- **Document Access**: View and download lease agreements and statements
- **Maintenance Requests**: Submit and track maintenance requests
- **Lease Signing**: Sign lease agreements electronically via DocuSign

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling
- **React Router** for navigation
- **shadcn/ui** component library
- **Tailwind CSS** for styling
- **Zod** for form validation
- **date-fns** for date manipulation

### Backend
- **Supabase** (PostgreSQL database, Authentication, Storage, Edge Functions)
- **Stripe** for payment processing
- **DocuSign** for e-signatures
- **Resend** for email notifications
- **Browserless** for PDF generation

### Infrastructure
- **Supabase Edge Functions** (Deno runtime)
- **Row Level Security (RLS)** for data access control
- **Supabase Storage** for file management

## Getting Started

### Prerequisites

- Node.js 18+ and npm (or use [nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- Supabase account and project
- Stripe account (for payment processing)
- DocuSign account (for e-signatures, optional)
- Resend account (for email notifications)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd payrentflow
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Run database migrations**
   ```bash
   supabase migration up
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to `http://localhost:5173`

## Project Structure

```
payrentflow/
├── src/
│   ├── components/          # Reusable React components
│   │   ├── admin/          # Admin/landlord components
│   │   ├── tenant/         # Tenant components
│   │   ├── ui/             # shadcn/ui components
│   │   └── shared/         # Shared components
│   ├── pages/              # Page components
│   │   ├── admin/          # Admin dashboard pages
│   │   └── tenant/         # Tenant dashboard pages
│   ├── hooks/              # Custom React hooks
│   ├── integrations/       # Third-party integrations
│   │   └── supabase/       # Supabase client and types
│   └── lib/                # Utility functions
├── supabase/
│   ├── migrations/         # Database migrations
│   └── functions/          # Edge Functions
├── public/                 # Static assets
└── scripts/                # Build and utility scripts
```

## Setup Instructions

### 1. Database Setup

Run all migrations in order:
```bash
supabase migration up
```

Key migrations include:
- Initial schema setup
- Profile creation triggers
- Tenant invite system
- Lease templates and leases
- Move-in date and pro-rated rent support

### 2. Supabase Storage Buckets

Create storage buckets for lease PDFs:

```sql
-- Run in Supabase SQL Editor
INSERT INTO storage.buckets (id, name, public)
VALUES ('leases', 'leases', false);
```

Set up storage policies:
```sql
CREATE POLICY "Users can upload leases"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'leases' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can download leases"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'leases');
```

### 3. Environment Variables

#### Frontend (.env)
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

#### Supabase Edge Functions (set in Supabase Dashboard)

**Required:**
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
RESEND_API_KEY=your_resend_api_key
FRONTEND_URL=https://your-domain.com
```

**Stripe (for payments):**

**Which key to use:** Only the **Secret key** (`sk_live_...` or `sk_test_...`) is needed. The publishable key is not used.

**For Production (Supabase Dashboard → Edge Functions → Secrets):**
```env
STRIPE_SECRET_KEY_PROD=sk_live_your_production_secret_key
STRIPE_MODE=prod  # REQUIRED for production
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
```

**For Local Development:**
```env
STRIPE_SECRET_KEY_TEST=sk_test_your_test_key
# STRIPE_MODE not needed - automatically uses test keys
```

**Note:** See `STRIPE_KEYS_SETUP.md` for detailed setup instructions. The system automatically prevents using production keys in local development for safety.

**DocuSign (for e-signatures, optional):**
```env
DOCUSIGN_INTEGRATION_KEY=your_integration_key
DOCUSIGN_SECRET_KEY=your_secret_key
DOCUSIGN_ACCOUNT_ID=your_account_id
DOCUSIGN_BASE_URL=https://account-d.docusign.com
DOCUSIGN_REDIRECT_URI=https://your-project.supabase.co/functions/v1/docusign-callback
DOCUSIGN_WEBHOOK_SECRET=your_webhook_secret
```

**Browserless (for PDF generation):**
```env
BROWSERLESS_API_KEY=your_browserless_api_key
```

### 4. Stripe Setup

1. Create a Stripe account
2. Set up Stripe Connect for multi-party payments
3. Configure webhook endpoint: `https://your-project.supabase.co/functions/v1/stripe-webhook`
4. Add webhook events: `payment_intent.succeeded`, `payment_intent.payment_failed`, etc.

### 5. DocuSign Setup (Optional)

**Important:** Integration keys can only be created in a **DocuSign Developer (demo)** account, not in production. See **[docs/DOCUSIGN_SETUP.md](docs/DOCUSIGN_SETUP.md)** for step-by-step testing instructions.

1. Go to [developer.docusign.com](https://developer.docusign.com) (not production) → Apps and Keys → Add App and Integration Key.
2. Copy Integration Key and Secret Key; add them as Supabase secrets: `DOCUSIGN_INTEGRATION_KEY`, `DOCUSIGN_SECRET_KEY`.
3. Add redirect URI: `https://your-project-ref.supabase.co/functions/v1/docusign-callback` (must match exactly).
4. Set `DOCUSIGN_BASE_URL=https://account-d.docusign.com` for demo.
5. Optional: Set up Connect webhook for envelope events; see [docs/DOCUSIGN_SETUP.md](docs/DOCUSIGN_SETUP.md).

### 6. Resend Setup

1. Create a Resend account
2. Verify your domain (see `RESEND_DOMAIN_SETUP.md`)
3. Add `RESEND_API_KEY` to Supabase Edge Function secrets
4. Set `RESEND_FROM_EMAIL` environment variable

### 7. Deploy Edge Functions

```bash
# Deploy all functions
supabase functions deploy

# Or deploy individual functions
supabase functions deploy generate-statement
supabase functions deploy create-rent-payment
supabase functions deploy send-tenant-invite
# ... etc
```

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run generate-sitemap` - Generate sitemap.xml

### Development Workflow

1. Make changes to code
2. Test locally with `npm run dev`
3. Run migrations if database changes are needed
4. Deploy edge functions if backend changes were made
5. Test in staging environment before production

## Deployment

### Build for Production

```bash
npm run build
```

This generates an optimized production build in the `dist/` directory.

### Deploy to Vercel

1. Connect your repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Deploy Edge Functions

```bash
supabase functions deploy
```

## Key Features

### Dynamic Lease Generation + DocuSign Integration

Create customizable lease templates and send them for electronic signature.

**Setup:**
1. Run migration: `supabase/migrations/20260120000000_lease_templates_and_leases.sql`
2. Create storage bucket (see Database Setup above)
3. Configure DocuSign environment variables
4. Connect DocuSign account in Admin Settings

**Usage:**
1. Create lease template at `/admin/lease-templates`
2. Connect DocuSign account at `/admin/settings`
3. Create lease at `/admin/leases`
4. Send for signature
5. Tenant signs at `/tenant/leases`

### Pro-Rated Rent Calculation

Automatically calculates pro-rated rent for tenants moving in mid-month:
- Supports move-in date tracking
- Calculates prorated amounts based on days remaining in month
- Handles "first month paid" scenarios
- No late fees for move-in month

### Tenant Invitation System

Landlords can invite tenants via email:
- Pre-fills tenant information
- Auto-confirms tenant accounts
- Assigns units automatically
- Sends welcome emails

### Automated Statement Generation

- Monthly statements generated automatically
- Pro-rated calculations for move-in month
- Late fee calculations
- Payment tracking and history

### Payment Processing

- Stripe Connect integration
- Secure payment processing
- Split payment support
- Payment history and receipts

## Troubleshooting

### Common Issues

**PDF generation fails:**
- Verify Browserless API key is set
- Check edge function logs for errors

**DocuSign OAuth fails:**
- Ensure redirect URI matches exactly in DocuSign settings
- Check integration key and secret are correct

**Webhook not receiving events:**
- Verify webhook URL is accessible
- Check HMAC secret matches
- Review edge function logs

**Email not sending:**
- Verify Resend API key is set
- Check domain verification status
- Review email function logs

**Database connection issues:**
- Verify Supabase URL and keys are correct
- Check RLS policies are properly configured
- Review migration status

## Support

For questions or issues:
- Email: support@payrentflow.com
- Check documentation in `/docs` directory
- Review migration files for database schema

## License

[Add your license information here]
