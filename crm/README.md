# CRM

This folder contains the private Booth Fairy Miami admin CRM.

Primary route:
- `/admin`

Current implementation:
- static admin shell with placeholder login protection
- localStorage-backed records for leads, bookings, follow-ups, payments, and campaigns
- source-specific lead views for Gmail, Tidio, and Instagram
- data structure prepared for future Supabase and API integrations

Important:
- this is intentionally separated from the public `website/` experience
- the current login is only a placeholder and is not true server-side security
- replace the placeholder auth with Supabase Auth or another real provider before storing live sensitive customer data

Planned integrations:
- Supabase
- Gmail
- Tidio
- Instagram
- Stripe
- Google Calendar / Calendly
