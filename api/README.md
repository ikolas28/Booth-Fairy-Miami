# API Placeholders

## Private client galleries

The private gallery API is served from `/api/gallery/*`. It validates pasted
Touchpix iframe URLs, keeps access codes server-side as salted hashes, returns
the embed URL only after authorization, applies expiration rules, and records
basic privacy-safe analytics.

Required Vercel environment variables:

- `SUPABASE_SERVICE_ROLE_KEY`
- `GALLERY_SESSION_SECRET` (a long random secret used to sign HttpOnly gallery sessions)

Optional:

- `TOUCHPIX_ALLOWED_HOSTS` for an exact comma-separated list of additional
  Touchpix-owned embed hostnames if the provided iframe is not hosted on
  `touchpix.com` or one of its subdomains

This folder contains integration modules and server endpoints used by the private CRM.

Integrations:

- Gmail
- Stripe
- Calendar
- Tidio
- Instagram
- HubSpot
- Website form intake

## Google rating proof strip

The public homepage can auto-update the Google rating and review count through the existing website API function:

- [api/website/lead.js](C:\Users\andyy\OneDrive\Documents\Andy's projects\Photo Booth website\api\website\lead.js)

Route:
- `/api/website/lead?resource=google-rating`

Required Vercel environment variables:
- `GOOGLE_PLACES_API_KEY`: Google Maps Platform API key with Places API access.

Optional Vercel environment variables:
- `GOOGLE_PLACE_ID`: Booth Fairy Miami's Google Place ID. Recommended for the most exact match.
- `GOOGLE_PLACE_TEXT_QUERY`: Exact search text used if no Place ID is configured. If omitted, the endpoint tries a short list of Booth Fairy Miami search phrases.

If the API key is missing, the homepage keeps the safe fallback values already printed in `website/index.html`.
The response is cached for one hour. Use `/api/website/lead?resource=google-rating&refresh=1` for a one-time manual refresh check.

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

Optional HubSpot sync:
- Add `HUBSPOT_PRIVATE_APP_TOKEN` to create/update a HubSpot contact and deal after a clean website lead is saved.
- The website lead endpoint treats HubSpot sync failures as non-blocking, so the public form keeps working even if HubSpot needs setup.
- Optional mapping env vars: `HUBSPOT_PIPELINE_ID`, `HUBSPOT_OWNER_ID`, `HUBSPOT_DEAL_STAGE_NEW`, `HUBSPOT_DEAL_STAGE_CONTACTED`, `HUBSPOT_DEAL_STAGE_QUOTE_SENT`, `HUBSPOT_DEAL_STAGE_AWAITING_DEPOSIT`, `HUBSPOT_DEAL_STAGE_BOOKED`, `HUBSPOT_DEAL_STAGE_COMPLETED`, `HUBSPOT_DEAL_STAGE_LOST`.

## HubSpot CRM sync

The project includes HubSpot admin endpoints inside:

- [api/admin/[...route].js](C:\Users\andyy\OneDrive\Documents\Andy's projects\Photo Booth website\api\admin\[...route].js)

Routes:
- `/api/admin/hubspot-status`
- `/api/admin/hubspot-sync-lead`

Expected use:
- HubSpot becomes the main contact/deal system.
- Supabase remains the business operations mirror for bookings, payments, calendar sync, contracts, expenses, and marketing automation.
- New website, Tidio, and Instagram leads attempt to sync into HubSpot when `HUBSPOT_PRIVATE_APP_TOKEN` is configured.
- The sync uses standard HubSpot fields first and automatically skips custom properties that do not exist yet.

Recommended custom deal properties:
- `booth_fairy_event_date`
- `booth_fairy_event_start_time`
- `booth_fairy_event_end_time`
- `booth_fairy_event_type`
- `booth_fairy_venue`
- `booth_fairy_event_city`
- `booth_fairy_service_requested`
- `booth_fairy_guest_count`
- `booth_fairy_deposit_amount`
- `booth_fairy_balance_due`
- `booth_fairy_lead_source`
- `booth_fairy_crm_lead_id`
- `booth_fairy_crm_booking_id`

Recommended custom contact properties:
- `booth_fairy_lead_source`
- `booth_fairy_event_type`
- `booth_fairy_preferred_service`
- `booth_fairy_crm_lead_id`

## Gmail inbox sync

The project now includes a Gmail OAuth + sync path for CRM lead capture:

- [api/gmail/connect.js](C:\Users\andyy\OneDrive\Documents\Andy's projects\Photo Booth website\api\gmail\connect.js)
- [api/gmail/callback.js](C:\Users\andyy\OneDrive\Documents\Andy's projects\Photo Booth website\api\gmail\callback.js)
- [api/gmail/status.js](C:\Users\andyy\OneDrive\Documents\Andy's projects\Photo Booth website\api\gmail\status.js)
- [api/gmail/sync.js](C:\Users\andyy\OneDrive\Documents\Andy's projects\Photo Booth website\api\gmail\sync.js)
- [api/gmail/disconnect.js](C:\Users\andyy\OneDrive\Documents\Andy's projects\Photo Booth website\api\gmail\disconnect.js)

Expected use:
- connect `info@boothfairymiami.com` through `/admin`
- label real inbox leads in Gmail with `CRM-Lead`
- sync only those labeled lead candidates into CRM leads
- skip newsletters, social notifications, platform promos, security emails, and messages without enough event-booking intent
- reconnect Google after deploying scope changes so Calendar free/busy checks are authorized

Required Vercel environment variables:
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Optional Vercel environment variables:
- `GOOGLE_REDIRECT_URI`
- `GMAIL_ACCOUNT_EMAIL`
- `GMAIL_SYNC_QUERY`
- `GMAIL_IGNORED_SENDERS` - comma-separated emails or domains to skip during Gmail lead sync. Defaults already skip common social, platform, payment, website-builder, and notification senders.
- `GOOGLE_CALENDAR_ID`

Default Gmail sync query:

- `newer_than:30d label:CRM-Lead -category:promotions -category:social -category:forums`

The sync intentionally does not import every message sent to the mailbox. This prevents newsletters, TikTok/Yelp/Blinq/Formspree notifications, and other non-leads from becoming `Missing Info` CRM leads.

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
- creates a finalized Stripe-hosted 50% retainer invoice with Florida sales tax
- keeps Stripe email sending disabled and creates a Gmail draft for owner review
- creates a Gmail draft when Gmail is reconnected with compose permission
- returns the contract URL, untaxed retainer, tax, taxed total, remaining balance, draft status, and invoice link status
- defaults the service agreement link to the public read-only page at `/service-agreement.html`

Additional Vercel environment variables:
- `STRIPE_SECRET_KEY`
- `STRIPE_SALES_TAX_RATE_ID` (the active exclusive Florida 7% Stripe tax rate, beginning with `txr_`)
- `SERVICE_AGREEMENT_URL`
- `SITE_URL`

## Stripe retainer payment confirmation

Stripe invoices and legacy Checkout Sessions call the payment confirmation webhook:

- [api/stripe/webhook.js](C:\Users\andyy\OneDrive\Documents\Andy's projects\Photo Booth website\api\stripe\webhook.js)

Route:
- `/api/stripe/webhook`

Expected use:
- Stripe sends `invoice.paid` or `invoice.payment_succeeded` after an invoice is paid; legacy Checkout uses `checkout.session.completed`
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
- `/api/admin/instagram-publish`

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
- `INSTAGRAM_ACCESS_TOKEN`
- `INSTAGRAM_USER_ID`
- `INSTAGRAM_GRAPH_HOST` (optional; defaults to `graph.facebook.com`; use `graph.instagram.com` only if your token came from Instagram Login publishing)
- `INSTAGRAM_GRAPH_VERSION` (optional; defaults to `v23.0`)

Instagram publishing:
- CRM Instagram campaigns must be approved first, which moves the campaign to `Scheduled`.
- Add `Caption:` and `Media URL:` to the campaign notes before publishing.
- Add `Media type: image`, `Media type: reel`, or `Media type: story` depending on the publish target.
- The media URL must be a direct public HTTPS image/video URL that Meta can fetch without a login.
- Publishing uses Meta's two-step flow: create a media container, then publish that container.
- Keep the access token in Vercel environment variables only. Do not paste Meta access tokens into chat, campaign notes, or GitHub.

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
