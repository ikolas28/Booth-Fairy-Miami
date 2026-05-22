# API Placeholders

This folder contains integration modules and server endpoints used by the private CRM.

Planned integrations:

- Gmail
- Stripe
- Calendar
- Tidio
- Instagram

## Gmail inbox sync

The project now includes a Gmail OAuth + sync path for CRM lead capture:

- [api/gmail/connect.js](C:\Users\andyy\OneDrive\Documents\Andy's projects\Photo Booth website\api\gmail\connect.js)
- [api/gmail/callback.js](C:\Users\andyy\OneDrive\Documents\Andy's projects\Photo Booth website\api\gmail\callback.js)
- [api/gmail/status.js](C:\Users\andyy\OneDrive\Documents\Andy's projects\Photo Booth website\api\gmail\status.js)
- [api/gmail/sync.js](C:\Users\andyy\OneDrive\Documents\Andy's projects\Photo Booth website\api\gmail\sync.js)
- [api/gmail/disconnect.js](C:\Users\andyy\OneDrive\Documents\Andy's projects\Photo Booth website\api\gmail\disconnect.js)

Expected use:
- connect `info@boothfairymiami.com` through `/admin`
- label inbox leads in Gmail
- sync those labeled messages into CRM leads

Required Vercel environment variables:
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Optional Vercel environment variables:
- `GOOGLE_REDIRECT_URI`
- `GMAIL_ACCOUNT_EMAIL`
- `GMAIL_SYNC_QUERY`

## Tidio lead intake

The project now includes a Vercel serverless endpoint for Tidio lead capture:

- [api/tidio/lead.js](C:\Users\andyy\OneDrive\Documents\Andy's projects\Photo Booth website\api\tidio\lead.js)

Route:
- `/api/tidio/lead`

Expected use:
- Tidio Flow -> `API call` action
- `POST` JSON payload to `https://www.boothfairymiami.com/api/tidio/lead`
- Bearer token auth using `TIDIO_WEBHOOK_SECRET`

Required Vercel environment variables:
- `SUPABASE_SERVICE_ROLE_KEY`
- `TIDIO_WEBHOOK_SECRET`

Recommended payload fields:
- `name`
- `email`
- `phone`
- `eventType`
- `eventDate`
- `venue`
- `city`
- `serviceRequested`
- `guestCount`
- `budget`
- `message`
- `transcript`
