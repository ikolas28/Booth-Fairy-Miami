# CRM

This folder contains the private Booth Fairy Miami admin CRM.

Primary route:
- `/admin`

Current implementation:
- static admin shell with real Supabase-ready auth flow
- email/password sign-in through Supabase
- Google OAuth button for future provider setup
- localStorage cache for offline/dev fallback
- Supabase-backed records for leads, bookings, follow-ups, payments, and campaigns once the schema is installed
- source-specific lead views for Gmail, Tidio, and Instagram
- Gmail connect/sync controls inside `/admin`
- data structure prepared for future Supabase and API integrations

Important:
- this is intentionally separated from the public `website/` experience
- the admin route is still a static frontend, so real protection comes from Supabase Auth + RLS
- if the Supabase tables are not installed yet, the CRM falls back to cached local demo data after sign-in
- localhost supports a development-only fallback login:
  - `admin@boothfairymiami.com`
  - `BoothFairyAdmin!`

Planned integrations:
- Supabase
- Gmail
- Tidio
- Instagram
- Stripe
- Google Calendar / Calendly

## Current production login direction

Approved admin email:
- `boothfairyllc@gmail.com`

Recommended setup:
- disable public signups in Supabase
- create admin users manually
- keep Google OAuth optional until you finish provider setup
