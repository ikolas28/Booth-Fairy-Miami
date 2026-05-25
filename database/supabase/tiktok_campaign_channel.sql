alter table public.campaigns
drop constraint if exists campaigns_channel_check;

alter table public.campaigns
add constraint campaigns_channel_check check (
  channel in ('Instagram', 'TikTok', 'Email', 'Google Business', 'Meta Ads', 'Website SEO')
);
