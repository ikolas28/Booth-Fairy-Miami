alter table public.payments
add column if not exists subtotal numeric(10, 2) not null default 0 check (subtotal >= 0);

alter table public.payments
add column if not exists tax_amount numeric(10, 2) not null default 0 check (tax_amount >= 0);

alter table public.payments
add column if not exists total_amount numeric(10, 2) not null default 0 check (total_amount >= 0);

alter table public.payments
add column if not exists stripe_invoice_id text;

update public.payments
set subtotal = amount,
    total_amount = amount
where subtotal = 0 and tax_amount = 0 and total_amount = 0 and amount > 0;

create index if not exists payments_stripe_invoice_id_idx on public.payments (stripe_invoice_id);
