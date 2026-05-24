# API Placeholders

This folder contains integration modules and server endpoints used by the private CRM.

Integrations:

- Gmail
- Stripe
- Calendar
- Tidio
- Instagram
- Website form intake

## Website lead intake

The public website contact form posts to:

- [api/website/lead.js](C:\Users\andyy\OneDrive\Documents\Andy's projects\Photo Booth website\api\website\lead.js)

Route:
- `/api/website/lead`

Expected use:
- public contact form submits structured lead data
- Supabase stores the lead
- lead status becomes `Missing Info` when phone, event date, or venue/city is missing
- calendar remains unchecked until the admin CRM verifies availability

Required Vercel environment variables:
- `SUPABASE_SERVICE_ROLE_KEY`

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
- reconnect Google after deploying scope changes so Calendar free/busy checks are authorized

Required Vercel environment variables:
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Optional Vercel environment variables:
- `GOOGLE_REDIRECT_URI`
- `GMAIL_ACCOUNT_EMAIL`
- `GMAIL_SYNC_QUERY`
- `GMAIL_IGNORED_SENDERS` - comma-separated emails or domains to skip during Gmail lead sync. Defaults already skip Facebook/ManyChat notification senders.
- `GOOGLE_CALENDAR_ID`

## Calendar availability

The project includes a Google Calendar free/busy check:

- [api/calendar/availability.js](C:\Users\andyy\OneDrive\Documents\Andy's projects\Photo Booth website\api\calendar\availability.js)

Route:
- `/api/calendar/availability`

Expected use:
- admin CRM calls this before marking a lead as calendar checked
- response says whether the requested date/time window is available
- booking still requires a signed contract and confirmed 50% retainer/deposit

## Receptionist booking next step

The CRM includes a receptionist automation endpoint:

- [api/receptionist/prepare-booking.js](C:\Users\andyy\OneDrive\Documents\Andy's projects\Photo Booth website\api\receptionist\prepare-booking.js)

Route:
- `/api/receptionist/prepare-booking`

Expected use:
- only after calendar availability is checked open
- creates a Stripe Checkout retainer link when `STRIPE_SECRET_KEY` is configured
- creates a Gmail draft when Gmail is reconnected with compose permission
- returns the contract URL, deposit amount, draft status, and payment link status
- defaults the service agreement link to the public read-only page at `/service-agreement.html`

Additional Vercel environment variables:
- `STRIPE_SECRET_KEY`
- `SERVICE_AGREEMENT_URL`
- `SITE_URL`

## Stripe retainer payment confirmation

Stripe Checkout should call the payment confirmation webhook:

- [api/stripe/webhook.js](C:\Users\andyy\OneDrive\Documents\Andy's projects\Photo Booth website\api\stripe\webhook.js)

Route:
- `/api/stripe/webhook`

Expected use:
- Stripe sends `checkout.session.completed` after the client pays the 50% retainer
- the matching CRM payment record is marked `Paid`
- the lead payment status is marked `Paid`
- the lead status becomes `Paid`, not `Booked`, so the receptionist still confirms the signed agreement before final booking confirmation
- a follow-up task is created to verify the signed agreement and send event prep details

Additional Vercel environment variables:
- `STRIPE_WEBHOOK_SECRET`

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

## Instagram lead intake

The project now includes Instagram CRM endpoints:

- [api/instagram/[...route].js](C:\Users\andyy\OneDrive\Documents\Andy's projects\Photo Booth website\api\instagram\[...route].js)

Routes:
- `/api/instagram/webhook`
- `/api/instagram/lead`
- `/api/instagram/status`

Expected use:
- Meta Developer App -> Webhooks callback URL: `https://www.boothfairymiami.com/api/instagram/webhook`
- Meta webhook verify token must match `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`
- Tools like Zapier or ManyChat can also `POST` JSON to `https://www.boothfairymiami.com/api/instagram/lead`
- Bearer token auth uses `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`

Required Vercel environment variables:
- `SUPABASE_SERVICE_ROLE_KEY`
- `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`

Recommended Vercel environment variables:
- `INSTAGRAM_APP_SECRET`

Recommended payload fields for `/api/instagram/lead`:
- `instagramHandle`
- `instagramUserId`
- `message`
- `email`
- `phone`
- `eventType`
- `eventDate`
- `venue`
- `city`
- `serviceRequested`
- `guestCount`
- `budget`

Inbound Instagram leads are saved with source `Instagram`, message history is recorded when possible, and an Instagram follow-up is created for the Receptionist Agent. The Marketing Agent reads Instagram lead volume and drafts Instagram campaign ideas for owner review.

Meta app review checklist:
- [docs/meta-instagram-app-review.md](C:\Users\andyy\OneDrive\Documents\Andy's projects\Photo Booth website\docs\meta-instagram-app-review.md)

Public Meta compliance URLs:
- `https://www.boothfairymiami.com/privacy-policy.html`
- `https://www.boothfairymiami.com/data-deletion.html`
