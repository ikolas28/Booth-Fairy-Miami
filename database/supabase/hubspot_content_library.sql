alter table public.leads
add column if not exists hubspot_contact_id text,
add column if not exists hubspot_deal_id text,
add column if not exists hubspot_sync_status text not null default 'Not Synced',
add column if not exists hubspot_sync_error text,
add column if not exists hubspot_synced_at timestamptz;

alter table public.contacts
add column if not exists hubspot_contact_id text,
add column if not exists hubspot_sync_status text not null default 'Not Synced',
add column if not exists hubspot_sync_error text,
add column if not exists hubspot_synced_at timestamptz;

alter table public.bookings
add column if not exists hubspot_deal_id text,
add column if not exists hubspot_sync_status text not null default 'Not Synced',
add column if not exists hubspot_sync_error text,
add column if not exists hubspot_synced_at timestamptz;

create table if not exists public.content_library_items (
  id uuid primary key default gen_random_uuid(),
  google_drive_file_id text unique,
  file_name text not null,
  file_url text,
  preview_url text,
  media_type text not null default 'Unknown' check (media_type in ('Image', 'Video', 'Unknown')),
  platform text not null default 'Both' check (platform in ('Instagram', 'TikTok', 'Both')),
  content_type text,
  campaign_name text,
  caption text,
  hashtags text,
  scheduled_date date,
  posted_date date,
  status text not null default 'Draft' check (status in ('Draft', 'Ready', 'Scheduled', 'Posted', 'Archived')),
  analytics_summary text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists leads_hubspot_contact_idx on public.leads (hubspot_contact_id);
create index if not exists leads_hubspot_deal_idx on public.leads (hubspot_deal_id);
create index if not exists bookings_hubspot_deal_idx on public.bookings (hubspot_deal_id);
create index if not exists content_library_status_idx on public.content_library_items (status, scheduled_date);
create index if not exists content_library_campaign_idx on public.content_library_items (campaign_name);

drop trigger if exists set_content_library_items_updated_at on public.content_library_items;
create trigger set_content_library_items_updated_at
before update on public.content_library_items
for each row
execute function public.set_updated_at();

alter table public.content_library_items enable row level security;

drop policy if exists content_library_items_admin_select on public.content_library_items;
create policy content_library_items_admin_select on public.content_library_items
for select using (public.bfm_is_admin());

drop policy if exists content_library_items_admin_insert on public.content_library_items;
create policy content_library_items_admin_insert on public.content_library_items
for insert with check (public.bfm_is_admin());

drop policy if exists content_library_items_admin_update on public.content_library_items;
create policy content_library_items_admin_update on public.content_library_items
for update using (public.bfm_is_admin()) with check (public.bfm_is_admin());

drop policy if exists content_library_items_admin_delete on public.content_library_items;
create policy content_library_items_admin_delete on public.content_library_items
for delete using (public.bfm_is_admin());
