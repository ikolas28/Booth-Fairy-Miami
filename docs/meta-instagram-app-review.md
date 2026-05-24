# Booth Fairy Miami Meta Instagram App Review

Use this checklist to move the Meta app live and connect Instagram inquiries to the CRM.

## Production URLs

- Website: `https://www.boothfairymiami.com`
- Admin CRM: `https://www.boothfairymiami.com/admin`
- Instagram webhook callback URL: `https://www.boothfairymiami.com/api/instagram/webhook`
- Instagram lead intake URL: `https://www.boothfairymiami.com/api/instagram/lead`
- Privacy policy URL: `https://www.boothfairymiami.com/privacy-policy.html`
- Data deletion instructions URL: `https://www.boothfairymiami.com/data-deletion.html`

## Required Vercel Environment Variables

- `SUPABASE_SERVICE_ROLE_KEY`
- `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`
- `INSTAGRAM_APP_SECRET`

Use the same `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` in Meta's webhook setup.

## App Products And Permissions

Recommended app use case:

- Instagram API
- Business messaging / customer communication

Request these permissions/features for review:

- `instagram_business_basic`
- `instagram_business_manage_messages`
- `instagram_business_manage_comments`

Only request publishing permissions later if the CRM adds direct Instagram posting:

- `instagram_business_content_publish`

## Webhook Setup

1. Meta Developers -> My Apps -> Booth Fairy Miami Instagram app.
2. Go to Instagram API setup.
3. Add required messaging permissions.
4. Configure webhooks.
5. Callback URL: `https://www.boothfairymiami.com/api/instagram/webhook`.
6. Verify token: the exact value from `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`.
7. Click Verify and Save.
8. Subscribe to message/comment fields available for Instagram:
   - messages
   - messaging_postbacks
   - messaging_seen
   - comments
   - mentions, if available

## App Settings

Add these before submission:

- App domain: `boothfairymiami.com`
- Privacy policy URL: `https://www.boothfairymiami.com/privacy-policy.html`
- Data deletion instructions URL: `https://www.boothfairymiami.com/data-deletion.html`
- Contact email: `boothfairyllc@gmail.com`

## Review Notes For Meta

Use this explanation:

Booth Fairy Miami uses Instagram messaging and comment events to capture customer inquiries for DSLR digital photo booth and DJ services. When a customer sends an Instagram DM or comment asking about availability, pricing, event date, venue, photo booth, DJ services, or booking, the webhook creates or updates a CRM lead in the private admin dashboard. The business owner then reviews the lead, drafts a response, checks calendar availability, and sends booking/payment next steps manually. The app does not sell data and does not auto-confirm bookings.

## Reviewer Test Steps

1. Log in to the Meta test Instagram account or send a DM/comment to the connected Booth Fairy Miami Instagram professional account.
2. Send this sample message:
   `Hi, I need a photo booth and DJ for a birthday in Miami on August 15. Can I get pricing? My email is test@example.com.`
3. Meta sends the webhook event to `https://www.boothfairymiami.com/api/instagram/webhook`.
4. The webhook creates a CRM lead with source `Instagram`.
5. Open `https://www.boothfairymiami.com/admin`.
6. Sign in with the approved Booth Fairy Miami admin account.
7. Open the Instagram section or Leads section.
8. Confirm the new Instagram lead appears with missing info/follow-up status.
9. The owner can review the lead, create a follow-up, check calendar availability, and draft replies before sending.

## Owner Safety Rules

- Do not auto-confirm bookings.
- Do not auto-send paid ads.
- Do not offer print packages.
- Do not store Instagram data outside the CRM/business tools needed for customer service.
- Delete or anonymize records when requested unless business/legal retention is required.
