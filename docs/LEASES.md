# Lease Templates and Leases

## Overview

Leases are created from **lease templates**, filled with unit/tenant data, and can be sent to tenants for signature via DocuSign. Landlords and tenants can view or download draft and signed PDFs at any time. Automated reminders are sent for unsigned leases and leases about to expire.

## Workflow

1. **Template** – Landlord creates a template with HTML body and placeholders (`{{variable_name}}`).
2. **Create lease** – Landlord selects property, unit, template, and fills variables (or uses defaults). A draft PDF is generated and stored.
3. **Send for signature** – Landlord sends the lease to DocuSign; tenant (and optionally landlord) sign.
4. **Completed** – DocuSign webhook marks the lease completed and uploads the signed PDF to storage.
5. **View/Download** – Both parties can view or download the signed PDF from the app (Documents modal for tenant, Leases page for both).

## Template Variables

Templates use `{{variable_name}}` placeholders. Common variables (used by the Create Lease wizard and sample template):

| Variable | Description |
|----------|-------------|
| `tenant_name`, `tenant_email`, `tenant_phone` | Tenant info |
| `landlord_name`, `landlord_email`, `landlord_phone` | Landlord info |
| `property_name`, `property_address`, `unit_number` | Property/unit |
| `rent_amount`, `deposit_amount` | Rent and deposit |
| `lease_start_date`, `lease_end_date` | Lease term (also stored on `leases.start_date` / `leases.end_date` for reminders) |
| `late_fee_amount`, `late_fee_type` | Late fee |
| `occupants`, `pet_deposit`, `parking_fee`, `utilities_included` | Optional terms |

The template editor’s **variables schema** (`variables_schema_json`) defines which variables appear in the UI when creating a lease; it is an array of `{ "key": "variable_name", "label": "Display Label" }`.

## PDF Access

- **Serve PDF** – Edge Function `serve-lease-pdf`:
  - **New:** `?leaseId=<uuid>&type=draft|signed` – serves draft or signed PDF for that lease (RLS: landlord or tenant of the lease).
  - **Legacy:** `?unitId=<uuid>` – serves PDF from `units.lease_pdf_url` for that unit.
- Tenant **Documents** modal uses the latest completed lease for their unit when available; otherwise falls back to legacy unit lease URL.
- **Tenant Leases** page uses storage signed URLs for `pdf_draft_url` / `pdf_signed_url` when present.

## Reminders

- **Lease needs signing** – For leases in `sent` or `delivered` status for more than 3 days, a reminder email is sent to the tenant (throttled: no duplicate within 7 days).
- **Lease about to expire** – For completed leases with `end_date` in 90, 60, or 30 days, both landlord and tenant receive an email (once per threshold).
- **Scheduling** – The Edge Function `schedule-lease-reminders` runs daily (e.g. via pg_cron at 3 AM UTC or external cron). See migration `20260126231000_schedule_lease_reminders.sql`; replace `PROJECT_REF` and `YOUR_SERVICE_ROLE_KEY` before use.

## DocuSign

- Landlords connect DocuSign in **Admin > Settings** (OAuth).
- Sending a lease for signature uses the draft PDF and creates a DocuSign envelope; the webhook updates status and stores the signed PDF when the envelope is completed.

## Database

- **lease_templates** – `name`, `body_html`, `variables_schema_json`.
- **leases** – `landlord_id`, `tenant_id`, `unit_id`, `template_id`, `lease_data_json`, `status`, `docusign_envelope_id`, `pdf_draft_url`, `pdf_signed_url`, `start_date`, `end_date`.
- **lease_events** – Audit log (created, sent, delivered, signed, completed, reminder_sent, etc.).
