# Supabase

This folder now contains the first real Supabase setup for the Booth Fairy Miami admin CRM.

## Files

- [schema.sql](C:\Users\andyy\OneDrive\Documents\Andy's projects\Photo Booth website\database\supabase\schema.sql)

## What `schema.sql` creates

- `leads`
- `followups`
- `payments`
- `campaigns`
- `gmail_connections`
- `gmail_imports`
- `updated_at` triggers
- RLS policies that only allow the approved admin email to read and write CRM data

Approved admin email in the current policy:
- `boothfairyllc@gmail.com`

If you want to allow additional admin users later, update the `public.bfm_is_admin()` function in:
- [schema.sql](C:\Users\andyy\OneDrive\Documents\Andy's projects\Photo Booth website\database\supabase\schema.sql)

## Supabase dashboard setup

1. In Supabase, open `SQL Editor`
2. Paste and run:
   - [schema.sql](C:\Users\andyy\OneDrive\Documents\Andy's projects\Photo Booth website\database\supabase\schema.sql)
3. In `Authentication -> Sign In / Providers`
   - keep `Email` enabled
   - enable `Google` when you are ready
4. In `Authentication -> URL Configuration`
   - Site URL: `https://www.boothfairymiami.com/admin`
   - Redirect URLs:
     - `https://www.boothfairymiami.com/admin`
     - `http://localhost:3000/admin`
5. In `Authentication -> Users`
   - create your admin user manually with `boothfairyllc@gmail.com`
6. Recommended:
   - disable public signups so random users cannot create accounts

## Google login note

The CRM frontend already includes a Google sign-in button, but it will only work after Google is configured in Supabase.

You will need:
- the Google provider enabled in Supabase
- the Google OAuth app configured in Google Cloud
- the Supabase callback URL added in Google Cloud exactly as Supabase shows it in the provider setup screen

## Security approach

The anon key is used only in the browser for auth and data requests. Actual access is limited by:

- Supabase Auth
- Row Level Security
- the admin email allowlist in `public.bfm_is_admin()`

That means the CRM data is not open to the public just because the site is static.
