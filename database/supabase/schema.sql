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

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
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
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

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

create index if not exists leads_event_date_idx on public.leads (event_date);
create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_source_idx on public.leads (source);
create index if not exists followups_lead_id_idx on public.followups (lead_id);
create index if not exists followups_due_date_idx on public.followups (due_date);
create index if not exists payments_lead_id_idx on public.payments (lead_id);
create index if not exists campaigns_status_idx on public.campaigns (status);
create index if not exists gmail_imports_imported_at_idx on public.gmail_imports (imported_at);

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

alter table public.leads enable row level security;
alter table public.followups enable row level security;
alter table public.payments enable row level security;
alter table public.campaigns enable row level security;

drop policy if exists "booth fairy admins can manage leads" on public.leads;
create policy "booth fairy admins can manage leads"
on public.leads
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
