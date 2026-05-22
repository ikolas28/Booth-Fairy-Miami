# Booth Fairy Miami

This repository now supports two parallel goals:

1. The current live public website
2. A private CRM and automation system

## Important Deployment Note

The public website now lives in [website/](C:\Users\andyy\OneDrive\Documents\Andy's projects\Photo Booth website\website).

The repository root is kept only as the deployment/control layer for:

- [vercel.json](C:\Users\andyy\OneDrive\Documents\Andy's projects\Photo Booth website\vercel.json)
- repository docs
- CRM, agent, API, and database work

Vercel rewrites route public traffic to the files inside [website/](C:\Users\andyy\OneDrive\Documents\Andy's projects\Photo Booth website\website).

## Project Structure

```text
boothfairymiami/
|-- AGENTS.md
|-- README.md
|-- website/
|   `-- current public website files
|-- crm/
|   |-- index.html
|   |-- styles.css
|   |-- script.js
|   |-- dashboard/
|   |-- leads/
|   |-- bookings/
|   |-- follow-ups/
|   |-- payments/
|   `-- marketing/
|-- agents/
|   |-- receptionist.md
|   `-- marketing.md
|-- api/
|   |-- gmail/
|   |-- stripe/
|   |-- calendar/
|   |-- tidio/
|   `-- instagram/
`-- database/
    `-- supabase/
```

## Public Website Files

The active public website source now lives in:

- [website/index.html](C:\Users\andyy\OneDrive\Documents\Andy's projects\Photo Booth website\website\index.html)
- [website/styles.css](C:\Users\andyy\OneDrive\Documents\Andy's projects\Photo Booth website\website\styles.css)
- [website/script.js](C:\Users\andyy\OneDrive\Documents\Andy's projects\Photo Booth website\website\script.js)
- [website/thank-you.html](C:\Users\andyy\OneDrive\Documents\Andy's projects\Photo Booth website\website\thank-you.html)
- [website/wedding-photo-booth-miami.html](C:\Users\andyy\OneDrive\Documents\Andy's projects\Photo Booth website\website\wedding-photo-booth-miami.html)
- [website/robots.txt](C:\Users\andyy\OneDrive\Documents\Andy's projects\Photo Booth website\website\robots.txt)
- [website/sitemap.xml](C:\Users\andyy\OneDrive\Documents\Andy's projects\Photo Booth website\website\sitemap.xml)
- [website/google04f5f8c2c05f04bb.html](C:\Users\andyy\OneDrive\Documents\Andy's projects\Photo Booth website\website\google04f5f8c2c05f04bb.html)
- [website/assets/](C:\Users\andyy\OneDrive\Documents\Andy's projects\Photo Booth website\website\assets)

## CRM Goal

The CRM should remain private and separate from the public marketing site. It is intended to manage:

- leads
- bookings
- follow-ups
- payments
- Gmail inquiries
- Tidio chat leads
- Instagram leads
- marketing campaigns

Preferred admin route:
- `/admin`

## Planned Integrations

- Supabase
- Gmail
- Stripe
- Google Calendar or Calendly
- Tidio
- Instagram

## Tidio CRM Intake

The repo now includes a secure Tidio lead intake endpoint:

- [api/tidio/lead.js](C:\Users\andyy\OneDrive\Documents\Andy's projects\Photo Booth website\api\tidio\lead.js)

Recommended setup:
- use Tidio `Flows -> API call`
- send `POST` requests to `/api/tidio/lead`
- protect the endpoint with a bearer token stored as `TIDIO_WEBHOOK_SECRET`
- use `SUPABASE_SERVICE_ROLE_KEY` in Vercel so the endpoint can safely write to the CRM

## CRM Auth And Data

The admin CRM at `/admin` now supports:

- Supabase email/password sign-in
- Google OAuth button wiring
- approved-admin email gating for `boothfairyllc@gmail.com`
- local cached fallback if the Supabase schema is not installed yet

Supabase schema files now live in:

- [database/supabase/schema.sql](C:\Users\andyy\OneDrive\Documents\Andy's projects\Photo Booth website\database\supabase\schema.sql)
- [database/supabase/README.md](C:\Users\andyy\OneDrive\Documents\Andy's projects\Photo Booth website\database\supabase\README.md)

## Business Rules Summary

- Booth Fairy Miami offers DSLR photo booth services
- Digital photos only for now
- Do not offer prints
- Booth Fairy Miami also offers high-end DJ services
- Never confirm booking without checking calendar availability
- Never confirm booking without deposit or payment confirmation
- Brand voice should stay elegant, fun, modern, professional, and Miami-focused

## Next Suggested Implementation Steps

1. Keep public website work inside [website/](C:\Users\andyy\OneDrive\Documents\Andy's projects\Photo Booth website\website)
2. Extend the CRM inside [crm/](C:\Users\andyy\OneDrive\Documents\Andy's projects\Photo Booth website\crm)
3. Add Supabase schema files and migrations in [database/supabase/](C:\Users\andyy\OneDrive\Documents\Andy's projects\Photo Booth website\database\supabase)
4. Replace API placeholders with real integration clients
