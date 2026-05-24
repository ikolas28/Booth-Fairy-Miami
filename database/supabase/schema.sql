create extension if not exists pgcrypto;

create or replace function public.bfm_is_admin()
returns boolean
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'boothfairyllc@gmail.com'
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create sequence if not exists public.lead_code_seq start with 1 increment by 1;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  lead_code text unique default ('BFM-' || lpad(nextval('public.lead_code_seq')::text, 4, '0')),
  client_name text not null,
  phone text not null,
  email text not null,
  event_type text not null,
  event_date date,
  venue text,
  city text,
  service_requested text not null,
  guest_count integer not null default 0 check (guest_count >= 0),
  budget numeric(10, 2) not null default 0 check (budget >= 0),
  notes text,
  status text not null default 'New Lead' check (
    status in (
      'New Lead',
      'Missing Info',
      'Quote Sent',
      'Follow-Up Needed',
      'Deposit Pending',
      'Booked',
      'Paid',
      'Completed',
      'Lost'
    )
  ),
  payment_status text not null default 'Not Requested' check (
    payment_status in ('Not Requested', 'Pending', 'Paid')
  ),
  calendar_checked boolean not null default false,
  source text not null default 'Website' check (
    source in ('Website', 'Gmail', 'Tidio', 'Instagram', 'Referral')
  ),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.leads
add column if not exists lead_code text;

alter table public.leads
add column if not exists tags text[] not null default '{}'::text[];

alter table public.leads
add column if not exists lead_score integer not null default 0 check (lead_score >= 0 and lead_score <= 100);

alter table public.leads
add column if not exists start_time time;

alter table public.leads
add column if not exists end_time time;

alter table public.leads
alter column lead_code set default ('BFM-' || lpad(nextval('public.lead_code_seq')::text, 4, '0'));

alter table public.leads
drop constraint if exists leads_status_check;

alter table public.leads
add constraint leads_status_check check (
  status in (
    'New Lead',
    'Contacted',
    'Qualified',
    'Deposit Pending',
    'Booked',
    'Completed',
    'Archived',
    -- Legacy values kept so old records do not fail until manually cleaned up.
    'Missing Info',
    'Quote Sent',
    'Follow-Up',
    'Follow-Up Needed',
    'Deposit Paid',
    'Event Completed',
    'Review Requested',
    'Repeat Client',
    'Paid',
    'Lost'
  )
);

update public.leads
set lead_code = 'BFM-' || lpad(nextval('public.lead_code_seq')::text, 4, '0')
where lead_code is null;

create unique index if not exists leads_lead_code_idx on public.leads (lead_code);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  email text,
  phone text,
  instagram text,
  company text,
  city text,
  preferred_contact_method text,
  marketing_opt_in boolean not null default false,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  client_name text not null,
  email text,
  phone text,
  event_type text,
  event_date date,
  start_time time,
  end_time time,
  venue text,
  city text,
  service_requested text,
  guest_count integer not null default 0 check (guest_count >= 0),
  package_interest text,
  total_quote numeric(10, 2) not null default 0 check (total_quote >= 0),
  deposit_required numeric(10, 2) not null default 0 check (deposit_required >= 0),
  deposit_status text not null default 'Not Requested',
  payment_link text,
  calendar_link text,
  booking_status text not null default 'Deposit Pending',
  contract_sent boolean not null default false,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.bookings
add column if not exists google_calendar_event_id text;

alter table public.bookings
add column if not exists calendar_sync_status text not null default 'Pending';

alter table public.bookings
add column if not exists calendar_sync_error text;

alter table public.bookings
add column if not exists calendar_synced_at timestamptz;

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  client_name text not null,
  service_requested text,
  package_name text,
  package_details text,
  subtotal numeric(10, 2) not null default 0 check (subtotal >= 0),
  travel_fee numeric(10, 2) not null default 0 check (travel_fee >= 0),
  discount_approval_status text not null default 'No Discount',
  total_quote numeric(10, 2) not null default 0 check (total_quote >= 0),
  deposit_required numeric(10, 2) generated always as (round(total_quote * 0.5, 2)) stored,
  quote_status text not null default 'Draft',
  valid_until date,
  owner_notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.message_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  message_at timestamptz not null default timezone('utc', now()),
  channel text not null,
  direction text not null,
  from_value text,
  to_value text,
  subject text,
  gmail_thread_id text,
  gmail_message_id text,
  summary text,
  draft_created boolean not null default false,
  sent_by text,
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.package_templates (
  id text primary key,
  service text not null,
  package_name text not null,
  hours numeric(5, 2),
  base_price numeric(10, 2),
  deposit_due numeric(10, 2) generated always as (round(coalesce(base_price, 0) * 0.5, 2)) stored,
  balance_due numeric(10, 2) generated always as (round(coalesce(base_price, 0) - round(coalesce(base_price, 0) * 0.5, 2), 2)) stored,
  includes text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.package_templates (id, service, package_name, hours, base_price, includes, notes, active)
values
  ('PKG-001', 'DSLR Photo Booth - Digital Sharing', 'Starter Digital Package - 2 Hours', 2, 450, 'DSLR booth; instant sharing; one premium backdrop; professional lighting; custom overlay; props; attendant', 'Digital photos only. No prints. No 360 booth.', true),
  ('PKG-002', 'DSLR Photo Booth - Digital Sharing', 'Starter Digital Package - 3 Hours', 3, 575, 'DSLR booth; instant sharing; one premium backdrop; professional lighting; custom overlay; props; attendant', 'Digital photos only. No prints. No 360 booth.', true),
  ('PKG-003', 'DSLR Photo Booth - Digital Sharing', 'Starter Digital Package - 4 Hours', 4, 700, 'DSLR booth; instant sharing; one premium backdrop; professional lighting; custom overlay; props; attendant', 'Digital photos only. No prints. No 360 booth.', true),
  ('PKG-004', 'Premium DJ Services', 'Premium DJ Services', null, null, 'High-end DJ services for Miami and South Florida events', 'Quote per event. Do not publish paid ads or discounts without owner approval.', true),
  ('PKG-005', 'Photo Booth + DJ Bundle', 'Photo Booth + DJ Bundle', null, null, 'DSLR digital photo booth package plus premium DJ services', 'Bundle quote requires owner-approved final pricing.', true)
on conflict (id) do update
set service = excluded.service,
    package_name = excluded.package_name,
    hours = excluded.hours,
    base_price = excluded.base_price,
    includes = excluded.includes,
    notes = excluded.notes,
    active = excluded.active,
    updated_at = timezone('utc', now());

create table if not exists public.quote_templates (
  id text primary key,
  trigger text not null,
  recommended_package text,
  draft_copy text not null,
  owner_approval_needed boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.quote_templates (id, trigger, recommended_package, draft_copy, owner_approval_needed, active)
values
  ('QT-001', 'Client asks for photo booth pricing', 'Starter Digital Package', 'Thank you for reaching out to Booth Fairy Miami. Our Starter Digital Package includes a DSLR booth, instant digital sharing, one premium backdrop, professional lighting, custom overlay, props, and an attendant. Pricing is $450 for 2 hours, $575 for 3 hours, and $700 for 4 hours. To check availability, please send your event date, venue/city, phone number, and guest count.', false, true),
  ('QT-002', 'Client wants to book', 'Calendar availability check', 'I would love to help reserve your date. Before confirming, I need to check calendar availability. Once availability is confirmed, booking is secured with a signed agreement and a non-refundable 50% retainer. The remaining 50% is due on the day of the event.', false, true),
  ('QT-003', 'Client asks about DJ services', 'Premium DJ Services', 'We also offer premium DJ services for Miami and South Florida events. DJ pricing is quoted based on event date, venue, hours, sound needs, timeline, and whether you want to bundle DJ with the DSLR digital photo booth.', true, true),
  ('QT-004', 'Client asks for prints or 360 booth', 'DSLR Digital Photo Booth', 'At this time Booth Fairy Miami offers DSLR digital photo booth service with high-quality digital photos and instant digital sharing. We do not currently offer print packages or 360 photo booth services.', false, true)
on conflict (id) do update
set trigger = excluded.trigger,
    recommended_package = excluded.recommended_package,
    draft_copy = excluded.draft_copy,
    owner_approval_needed = excluded.owner_approval_needed,
    active = excluded.active,
    updated_at = timezone('utc', now());

create table if not exists public.followups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  due_date date not null,
  channel text not null default 'Email' check (
    channel in ('Email', 'Phone', 'Text', 'Instagram', 'Tidio')
  ),
  status text not null default 'Open' check (
    status in ('Open', 'Completed')
  ),
  notes text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  type text not null default 'Stripe Payment Link' check (
    type in ('Stripe Payment Link', 'Invoice', 'Deposit Request')
  ),
  amount numeric(10, 2) not null default 0 check (amount >= 0),
  status text not null default 'Pending' check (
    status in ('Pending', 'Paid', 'Expired')
  ),
  link text,
  stripe_session_id text,
  stripe_payment_intent_id text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.payments
add column if not exists stripe_session_id text;

alter table public.payments
add column if not exists stripe_payment_intent_id text;

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  channel text not null default 'Instagram' check (
    channel in ('Instagram', 'Email', 'Google Business', 'Meta Ads', 'Website SEO')
  ),
  status text not null default 'Idea' check (
    status in ('Idea', 'Drafting', 'Ready for Review', 'Scheduled', 'Published')
  ),
  priority text not null default 'Medium' check (
    priority in ('Low', 'Medium', 'High')
  ),
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.gmail_connections (
  id text primary key,
  connected_email text not null,
  access_token text not null,
  refresh_token text not null,
  token_type text,
  scope text,
  expires_at timestamptz,
  connected_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.gmail_imports (
  id uuid primary key default gen_random_uuid(),
  gmail_message_id text not null unique,
  gmail_thread_id text,
  lead_id uuid references public.leads(id) on delete set null,
  subject text,
  from_email text,
  imported_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.instagram_imports (
  id uuid primary key default gen_random_uuid(),
  instagram_reference text not null unique,
  instagram_user_id text,
  instagram_handle text,
  lead_id uuid references public.leads(id) on delete set null,
  message_summary text,
  imported_at timestamptz not null default timezone('utc', now())
);

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

create index if not exists leads_event_date_idx on public.leads (event_date);
create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_source_idx on public.leads (source);
create index if not exists leads_lead_score_idx on public.leads (lead_score);
create index if not exists contacts_email_idx on public.contacts (email);
create index if not exists bookings_event_date_idx on public.bookings (event_date);
create index if not exists bookings_lead_id_idx on public.bookings (lead_id);
create index if not exists quotes_lead_id_idx on public.quotes (lead_id);
create index if not exists message_history_lead_id_idx on public.message_history (lead_id);
create index if not exists followups_lead_id_idx on public.followups (lead_id);
create index if not exists followups_due_date_idx on public.followups (due_date);
create index if not exists payments_lead_id_idx on public.payments (lead_id);
create index if not exists payments_stripe_session_id_idx on public.payments (stripe_session_id);
create index if not exists campaigns_status_idx on public.campaigns (status);
create index if not exists gmail_imports_imported_at_idx on public.gmail_imports (imported_at);
create index if not exists instagram_imports_lead_id_idx on public.instagram_imports (lead_id);
create index if not exists instagram_imports_imported_at_idx on public.instagram_imports (imported_at);
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index if not exists webhook_events_received_at_idx on public.webhook_events (received_at);
create index if not exists webhook_events_provider_idx on public.webhook_events (provider, event_type);
create index if not exists lead_duplicates_created_at_idx on public.lead_duplicates (created_at);
create index if not exists lead_duplicates_matched_lead_id_idx on public.lead_duplicates (matched_lead_id);
create index if not exists automation_runs_started_at_idx on public.automation_runs (started_at);
create index if not exists automation_runs_agent_idx on public.automation_runs (agent, status);
create index if not exists lead_scores_lead_id_idx on public.lead_scores (lead_id);
create index if not exists blocked_senders_sender_idx on public.blocked_senders (sender);

drop trigger if exists set_leads_updated_at on public.leads;
create trigger set_leads_updated_at
before update on public.leads
for each row
execute function public.set_updated_at();

drop trigger if exists set_followups_updated_at on public.followups;
create trigger set_followups_updated_at
before update on public.followups
for each row
execute function public.set_updated_at();

drop trigger if exists set_payments_updated_at on public.payments;
create trigger set_payments_updated_at
before update on public.payments
for each row
execute function public.set_updated_at();

drop trigger if exists set_campaigns_updated_at on public.campaigns;
create trigger set_campaigns_updated_at
before update on public.campaigns
for each row
execute function public.set_updated_at();

drop trigger if exists set_gmail_connections_updated_at on public.gmail_connections;
create trigger set_gmail_connections_updated_at
before update on public.gmail_connections
for each row
execute function public.set_updated_at();

drop trigger if exists set_contacts_updated_at on public.contacts;
create trigger set_contacts_updated_at
before update on public.contacts
for each row
execute function public.set_updated_at();

drop trigger if exists set_bookings_updated_at on public.bookings;
create trigger set_bookings_updated_at
before update on public.bookings
for each row
execute function public.set_updated_at();

drop trigger if exists set_quotes_updated_at on public.quotes;
create trigger set_quotes_updated_at
before update on public.quotes
for each row
execute function public.set_updated_at();

drop trigger if exists set_package_templates_updated_at on public.package_templates;
create trigger set_package_templates_updated_at
before update on public.package_templates
for each row
execute function public.set_updated_at();

drop trigger if exists set_quote_templates_updated_at on public.quote_templates;
create trigger set_quote_templates_updated_at
before update on public.quote_templates
for each row
execute function public.set_updated_at();

alter table public.leads enable row level security;
alter table public.contacts enable row level security;
alter table public.bookings enable row level security;
alter table public.followups enable row level security;
alter table public.quotes enable row level security;
alter table public.payments enable row level security;
alter table public.campaigns enable row level security;
alter table public.message_history enable row level security;
alter table public.package_templates enable row level security;
alter table public.quote_templates enable row level security;
alter table public.gmail_connections enable row level security;
alter table public.gmail_imports enable row level security;
alter table public.instagram_imports enable row level security;
alter table public.audit_logs enable row level security;
alter table public.webhook_events enable row level security;
alter table public.lead_duplicates enable row level security;
alter table public.automation_runs enable row level security;
alter table public.lead_scores enable row level security;
alter table public.blocked_senders enable row level security;
alter table public.event_files enable row level security;

revoke all on table public.gmail_connections from anon;
revoke all on table public.gmail_imports from anon;
revoke all on table public.audit_logs from anon;
revoke all on table public.webhook_events from anon;
revoke all on table public.lead_duplicates from anon;
revoke all on table public.automation_runs from anon;
revoke all on table public.lead_scores from anon;
revoke all on table public.blocked_senders from anon;
revoke all on table public.event_files from anon;

drop policy if exists "booth fairy admins can manage leads" on public.leads;
create policy "booth fairy admins can manage leads"
on public.leads
for all
to authenticated
using (public.bfm_is_admin())
with check (public.bfm_is_admin());

drop policy if exists "booth fairy admins can manage contacts" on public.contacts;
create policy "booth fairy admins can manage contacts"
on public.contacts
for all
to authenticated
using (public.bfm_is_admin())
with check (public.bfm_is_admin());

drop policy if exists "booth fairy admins can manage bookings" on public.bookings;
create policy "booth fairy admins can manage bookings"
on public.bookings
for all
to authenticated
using (public.bfm_is_admin())
with check (public.bfm_is_admin());

drop policy if exists "booth fairy admins can manage followups" on public.followups;
create policy "booth fairy admins can manage followups"
on public.followups
for all
to authenticated
using (public.bfm_is_admin())
with check (public.bfm_is_admin());

drop policy if exists "booth fairy admins can manage quotes" on public.quotes;
create policy "booth fairy admins can manage quotes"
on public.quotes
for all
to authenticated
using (public.bfm_is_admin())
with check (public.bfm_is_admin());

drop policy if exists "booth fairy admins can manage payments" on public.payments;
create policy "booth fairy admins can manage payments"
on public.payments
for all
to authenticated
using (public.bfm_is_admin())
with check (public.bfm_is_admin());

drop policy if exists "booth fairy admins can manage campaigns" on public.campaigns;
create policy "booth fairy admins can manage campaigns"
on public.campaigns
for all
to authenticated
using (public.bfm_is_admin())
with check (public.bfm_is_admin());

drop policy if exists "booth fairy admins can manage message history" on public.message_history;
create policy "booth fairy admins can manage message history"
on public.message_history
for all
to authenticated
using (public.bfm_is_admin())
with check (public.bfm_is_admin());

drop policy if exists "booth fairy admins can manage package templates" on public.package_templates;
create policy "booth fairy admins can manage package templates"
on public.package_templates
for all
to authenticated
using (public.bfm_is_admin())
with check (public.bfm_is_admin());

drop policy if exists "booth fairy admins can manage quote templates" on public.quote_templates;
create policy "booth fairy admins can manage quote templates"
on public.quote_templates
for all
to authenticated
using (public.bfm_is_admin())
with check (public.bfm_is_admin());

drop policy if exists "booth fairy admins can manage instagram imports" on public.instagram_imports;
create policy "booth fairy admins can manage instagram imports"
on public.instagram_imports
for all
to authenticated
using (public.bfm_is_admin())
with check (public.bfm_is_admin());

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
