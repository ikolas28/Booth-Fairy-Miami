# Booth Fairy Miami Private Client Galleries

## Architecture

One reusable public template serves every private route:

`https://www.boothfairymiami.com/gallery/client-event-randomsuffix`

Gallery records live in Supabase in `client_galleries`. Analytics live in
`gallery_events`. The page asks the server for the record identified by the
slug. If an access code is enabled, gallery metadata and the Touchpix iframe
URL remain hidden until the server verifies the code.

Gallery requests are routed through the existing consolidated admin serverless
function so the Vercel project stays within its function-count limit.

The admin workflow lives inside `/admin` under **Client Galleries**.

## What is stored

- private URL slug
- gallery title, client name, event date, and messages
- validated Touchpix HTTPS iframe URL
- salted access-code hash (never the plain access code)
- enabled/disabled status and expiration time
- privacy-safe event counts with no client IP address or image data

Touchpix images are not duplicated while the Touchpix gallery is active.

## Required setup before deployment

1. Run `database/supabase/client_galleries.sql` in the Supabase SQL Editor.
2. Add a long random `GALLERY_SESSION_SECRET` to the Vercel Production and Preview environments.
3. If the real Touchpix iframe uses a host outside `touchpix.com`, add the exact
   hostname to `TOUCHPIX_ALLOWED_HOSTS` as a comma-separated value and add the
   same HTTPS host to `frame-src` in `vercel.json`.
4. Deploy only after testing one real Touchpix embed in a preview environment.

## Owner workflow

1. Sign in at `/admin`.
2. Open **Client Galleries** and choose **Add Gallery**.
3. Enter event information, paste the Touchpix iframe embed, set an access code,
   and choose an expiration date.
4. Save, copy the private URL, and send the URL and access code separately.
5. Disable a gallery to take it offline without deleting analytics. Delete only
   when the record and analytics are no longer needed.

## Touchpix limitation

The iframe is a window into the original Touchpix-hosted gallery. It does not
copy or preserve the photos. If Touchpix deletes, disables, moves, or blocks
embedding of the original gallery, the iframe cannot continue to display it.
The local expiration setting prevents a broken embed by replacing it with the
owner's custom expired message, but it cannot extend Touchpix storage.

Touchpix must also allow its page to be framed. A Touchpix response using
`X-Frame-Options` or a restrictive `frame-ancestors` policy will block the
embed even when Booth Fairy Miami's page is configured correctly.

## Long-term archive recommendation

Use a private cloud object store for full-resolution archives, not the public
website filesystem. Keep each event in a private bucket with lifecycle rules,
restricted access, and a documented retention period. Do not publish the
archive directly.

For a small number of showcase galleries, use a dedicated client-gallery
service or a separate protected gallery backed by private object storage.
Archive or publicly reuse selected images only when the contract/model release
or explicit client permission allows it. This avoids storing every event twice
while Touchpix is active and keeps long-term retention intentional.
