-- Booth Fairy Miami lead event time fields
-- Run in Supabase SQL Editor if the CRM reports missing start_time/end_time columns.

alter table public.leads
add column if not exists start_time time;

alter table public.leads
add column if not exists end_time time;

alter table public.bookings
add column if not exists start_time time;

alter table public.bookings
add column if not exists end_time time;
