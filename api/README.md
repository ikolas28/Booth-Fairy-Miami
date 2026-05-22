# API Placeholders

This folder contains integration modules and server endpoints used by the private CRM.

Planned integrations:

- Gmail
- Stripe
- Calendar
- Tidio
- Instagram

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
