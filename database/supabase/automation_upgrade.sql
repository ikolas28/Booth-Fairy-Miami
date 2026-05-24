-- Booth Fairy Miami CRM automation upgrade
-- Run this in Supabase SQL Editor after security_hardening.sql.

alter table public.leads
add column if not exists tags text[] not null default '{}'::text[];

alter table public.leads
add column if not exists lead_score integer not null default 0 check (lead_score >= 0 and lead_score <= 100);

alter table public.leads
drop constraint if exists leads_status_check;

alter table public.leads
add constraint leads_status_check check (
  status in (
    'New Lead',
    'Contacted',
    'Missing Info',
    'Quote Sent',
    'Follow-Up',
    'Follow-Up Needed',
    'Deposit Pending',
    'Deposit Paid',
    'Booked',
    'Event Completed',
    'Review Requested',
    'Repeat Client',
    'Paid',
    'Completed',
    'Lost'
  )
);

create table if not exists public.lead_duplicates (
  id uuid primary key default gen_random_uuid(),
  incoming_email text,
  incoming_phone text,
  incoming_source text,
  matched_lead_id uuid references public.leads(id) on delete set null,
  match_reason text not null,
  confidence integer not null default 0 check (confidence >= 0 and confidence <= 100),
  resolved boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  agent text not null check (agent in ('receptionist', 'marketing', 'system')),
  status text not null default 'started' check (status in ('started', 'completed', 'failed')),
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  summary jsonb not null default '{}'::jsonb,
  error text
);

alter table public.automation_runs
drop constraint if exists automation_runs_agent_check;

alter table public.automation_runs
add constraint automation_runs_agent_check
check (agent in ('receptionist', 'marketing', 'system'));

create table if not exists public.lead_scores (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  score integer not null check (score >= 0 and score <= 100),
  tags text[] not null default '{}'::text[],
  reason text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.blocked_senders (
  id uuid primary key default gen_random_uuid(),
  sender text not null unique,
  reason text,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.event_files (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  file_type text,
  file_name text,
  file_url text,
  source text,
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists leads_lead_score_idx on public.leads (lead_score);
create index if not exists lead_duplicates_created_at_idx on public.lead_duplicates (created_at);
create index if not exists lead_duplicates_matched_lead_id_idx on public.lead_duplicates (matched_lead_id);
create index if not exists automation_runs_started_at_idx on public.automation_runs (started_at);
create index if not exists automation_runs_agent_idx on public.automation_runs (agent, status);
create index if not exists lead_scores_lead_id_idx on public.lead_scores (lead_id);
create index if not exists blocked_senders_sender_idx on public.blocked_senders (sender);

alter table public.lead_duplicates enable row level security;
alter table public.automation_runs enable row level security;
alter table public.lead_scores enable row level security;
alter table public.blocked_senders enable row level security;
alter table public.event_files enable row level security;

revoke all on table public.lead_duplicates from anon;
revoke all on table public.automation_runs from anon;
revoke all on table public.lead_scores from anon;
revoke all on table public.blocked_senders from anon;
revoke all on table public.event_files from anon;

drop policy if exists "booth fairy admins can manage lead duplicates" on public.lead_duplicates;
create policy "booth fairy admins can manage lead duplicates"
on public.lead_duplicates
for all
to authenticated
using (public.bfm_is_admin())
with check (public.bfm_is_admin());

drop policy if exists "booth fairy admins can read automation runs" on public.automation_runs;
create policy "booth fairy admins can read automation runs"
on public.automation_runs
for select
to authenticated
using (public.bfm_is_admin());

drop policy if exists "booth fairy admins can read lead scores" on public.lead_scores;
create policy "booth fairy admins can read lead scores"
on public.lead_scores
for select
to authenticated
using (public.bfm_is_admin());

drop policy if exists "booth fairy admins can manage blocked senders" on public.blocked_senders;
create policy "booth fairy admins can manage blocked senders"
on public.blocked_senders
for all
to authenticated
using (public.bfm_is_admin())
with check (public.bfm_is_admin());





drop policy if exists "booth fairy admins can manage event files" on public.event_files;
create policy "booth fairy admins can manage event files"
on public.event_files
for all
to authenticated
using (public.bfm_is_admin())
with check (public.bfm_is_admin());
