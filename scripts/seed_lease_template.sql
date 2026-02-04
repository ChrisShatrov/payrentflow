-- Sample lease template and variables schema.
-- Run after migrations. Replace YOUR_LANDLORD_ID with a real profiles.id (landlord).

INSERT INTO lease_templates (
  id,
  landlord_id,
  name,
  body_html,
  variables_schema_json,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'YOUR_LANDLORD_ID',
  'Standard Residential Lease',
  '<h1>Residential Lease Agreement</h1>
<p>This Lease Agreement is entered into on {{lease_start_date}} between <strong>{{landlord_name}}</strong> ("Landlord") and <strong>{{tenant_name}}</strong> ("Tenant").</p>

<h2>1. Property</h2>
<p>Landlord agrees to lease to Tenant the property located at <strong>{{property_address}}</strong>, Unit <strong>{{unit_number}}</strong> (the "Premises").</p>

<h2>2. Term</h2>
<p>Lease term: from <strong>{{lease_start_date}}</strong> through <strong>{{lease_end_date}}</strong>.</p>

<h2>3. Rent</h2>
<p>Monthly rent: <strong>${{rent_amount}}</strong>, due on the first of each month. Security deposit: <strong>${{deposit_amount}}</strong>.</p>

<h2>4. Late Fees</h2>
<p>Late fee: <strong>${{late_fee_amount}}</strong> ({{late_fee_type}}).</p>

<h2>5. Utilities and Other</h2>
<p>Utilities included: {{utilities_included}}. Occupants: {{occupants}}. Pet deposit: {{pet_deposit}}. Parking: {{parking_fee}}.</p>

<h2>6. Signatures</h2>
<p>Landlord: {{landlord_name}} – {{landlord_email}} – {{landlord_phone}}</p>
<p>Tenant: {{tenant_name}} – {{tenant_email}} – {{tenant_phone}}</p>
<p>By signing below, both parties agree to the terms of this lease.</p>',
  '[
    {"key":"tenant_name","label":"Tenant Name"},
    {"key":"tenant_email","label":"Tenant Email"},
    {"key":"tenant_phone","label":"Tenant Phone"},
    {"key":"landlord_name","label":"Landlord Name"},
    {"key":"landlord_email","label":"Landlord Email"},
    {"key":"landlord_phone","label":"Landlord Phone"},
    {"key":"property_name","label":"Property Name"},
    {"key":"property_address","label":"Property Address"},
    {"key":"unit_number","label":"Unit Number"},
    {"key":"rent_amount","label":"Monthly Rent"},
    {"key":"deposit_amount","label":"Security Deposit"},
    {"key":"lease_start_date","label":"Lease Start Date"},
    {"key":"lease_end_date","label":"Lease End Date"},
    {"key":"late_fee_amount","label":"Late Fee Amount"},
    {"key":"late_fee_type","label":"Late Fee Type"},
    {"key":"occupants","label":"Occupants"},
    {"key":"pet_deposit","label":"Pet Deposit"},
    {"key":"parking_fee","label":"Parking Fee"},
    {"key":"utilities_included","label":"Utilities Included"}
  ]'::jsonb,
  NOW(),
  NOW()
);
