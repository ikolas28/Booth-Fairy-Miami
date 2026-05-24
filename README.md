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

## Website Lead Intake

The public contact form now posts to:

- [api/website/lead.js](C:\Users\andyy\OneDrive\Documents\Andy's projects\Photo Booth website\api\website\lead.js)

The endpoint stores website inquiries in Supabase, marks leads as `Missing Info` when the event date, venue/city, or phone number is missing, and keeps calendar availability unchecked until the receptionist agent or admin CRM verifies it.

## CRM Spreadsheet

The Google Sheets CRM includes auto-generated lead IDs like `BFM-0001`, package templates, and quote response templates:

- Leads
- Contacts
- Bookings
- FollowUps
- Quotes
- Payments
- MarketingCampaigns
- MessageHistory
- PackageTemplates
- QuoteTemplates

Starter Digital Package pricing:

- 2 hours: $450
- 3 hours: $575
- 4 hours: $700
- 50% non-refundable retainer/deposit due at contract signing
- Remaining 50% due on the day of the event

## Calendar Availability

The admin CRM can call:

- [api/calendar/availability.js](C:\Users\andyy\OneDrive\Documents\Andy's projects\Photo Booth website\api\calendar\availability.js)

This endpoint checks Google Calendar free/busy status. Gmail/Google must be reconnected after deploying the updated OAuth scopes so the account grants `calendar.freebusy` access.

## Receptionist Contract And Deposit Step

After a lead's calendar availability is checked open, the admin CRM can run **Prepare Contract + Deposit**.

This does not confirm the booking. It:

- moves the lead to `Deposit Pending`
- creates a deposit payment record
- creates a next-day follow-up
- creates a Gmail draft when Gmail has compose permission
- creates a Stripe Checkout retainer link when `STRIPE_SECRET_KEY` is configured

Required for full automation:

- reconnect Gmail after deployment so Google grants `gmail.compose`
- add `STRIPE_SECRET_KEY` in Vercel
- optionally set `SERVICE_AGREEMENT_URL` to override the public read-only agreement page at `https://www.boothfairymiami.com/service-agreement.html`
- set `STRIPE_WEBHOOK_SECRET` after creating the Stripe webhook endpoint so paid retainers are confirmed in the CRM automatically

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
