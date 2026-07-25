-- Private client galleries for Booth Fairy Miami.
-- Run after database/supabase/schema.sql.

create table if not exists public.client_galleries (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null,
  client_name text,
  event_date date,
  welcome_message text,
  expiration_notice text,
  expired_message text not null default 'This online gallery is no longer available. Please contact Booth Fairy Miami if you need assistance accessing your event photos.',
  touchpix_embed_url text not null,
  password_hash text,
  enabled boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.gallery_events (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.client_galleries(id) on delete cascade,
  event_type text not null check (
    event_type in ('gallery_visit', 'button_click', 'booking_inquiry')
  ),
  button_name text,
  session_id text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists client_galleries_slug_idx
on public.client_galleries (slug);

create index if not exists client_galleries_expires_at_idx
on public.client_galleries (expires_at);

create index if not exists gallery_events_gallery_created_idx
on public.gallery_events (gallery_id, created_at desc);

create unique index if not exists gallery_events_unique_visit_idx
on public.gallery_events (gallery_id, session_id)
where event_type = 'gallery_visit' and session_id is not null;

drop trigger if exists set_client_galleries_updated_at on public.client_galleries;
create trigger set_client_galleries_updated_at
before update on public.client_galleries
for each row
execute function public.set_updated_at();

alter table public.client_galleries enable row level security;
alter table public.gallery_events enable row level security;

revoke all on table public.client_galleries from anon;
revoke all on table public.gallery_events from anon;

drop policy if exists "booth fairy admins can manage client galleries" on public.client_galleries;
create policy "booth fairy admins can manage client galleries"
on public.client_galleries
for all
to authenticated
using (public.bfm_is_admin())
with check (public.bfm_is_admin());

drop policy if exists "booth fairy admins can read gallery events" on public.gallery_events;
create policy "booth fairy admins can read gallery events"
on public.gallery_events
for select
to authenticated
using (public.bfm_is_admin());
