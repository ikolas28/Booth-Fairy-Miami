alter table public.leads
add column if not exists marketing_attribution jsonb not null default '{}'::jsonb;

create index if not exists leads_marketing_utm_source_idx
on public.leads ((marketing_attribution ->> 'utm_source'));

create index if not exists leads_marketing_utm_campaign_idx
on public.leads ((marketing_attribution ->> 'utm_campaign'));
