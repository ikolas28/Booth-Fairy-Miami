-- Booth Fairy Miami security hardening migration
-- Run this in Supabase SQL Editor.

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_email text,
  action text not null,
  entity_type text,
  entity_id text,
  source text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text,
  event_type text,
  status text not null default 'received',
  lead_id uuid references public.leads(id) on delete set null,
  payload_summary text,
  received_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz,
  unique (provider, event_id)
);

create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index if not exists webhook_events_received_at_idx on public.webhook_events (received_at);
create index if not exists webhook_events_provider_idx on public.webhook_events (provider, event_type);

alter table public.gmail_connections enable row level security;
alter table public.gmail_imports enable row level security;
alter table public.audit_logs enable row level security;
alter table public.webhook_events enable row level security;

revoke all on table public.gmail_connections from anon;
revoke all on table public.gmail_imports from anon;
revoke all on table public.audit_logs from anon;
revoke all on table public.webhook_events from anon;

drop policy if exists "booth fairy admins can manage gmail connections" on public.gmail_connections;
create policy "booth fairy admins can manage gmail connections"
on public.gmail_connections
for all
to authenticated
using (public.bfm_is_admin())
with check (public.bfm_is_admin());

drop policy if exists "booth fairy admins can manage gmail imports" on public.gmail_imports;
create policy "booth fairy admins can manage gmail imports"
on public.gmail_imports
for all
to authenticated
using (public.bfm_is_admin())
with check (public.bfm_is_admin());

drop policy if exists "booth fairy admins can read audit logs" on public.audit_logs;
create policy "booth fairy admins can read audit logs"
on public.audit_logs
for select
to authenticated
using (public.bfm_is_admin());

drop policy if exists "booth fairy admins can read webhook events" on public.webhook_events;
create policy "booth fairy admins can read webhook events"
on public.webhook_events
for select
to authenticated
using (public.bfm_is_admin());
