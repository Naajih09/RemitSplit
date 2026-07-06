-- RemitSplit Supabase setup.
-- Run this once in Supabase Dashboard > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_ref text not null unique,
  name text not null,
  type text not null check (type in ('remit', 'split')),
  target_amount numeric(14, 2),
  current_balance numeric(14, 2) not null default 0,
  beneficiary_bank_details jsonb,
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists wallets_user_name_type_uidx
  on public.wallets(user_id, name, type);

create index if not exists wallets_account_ref_idx
  on public.wallets(account_ref);

create table if not exists public.wallet_contributors (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists wallet_contributors_wallet_user_uidx
  on public.wallet_contributors(wallet_id, user_id);

create index if not exists wallet_contributors_user_id_idx
  on public.wallet_contributors(user_id);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  type text not null check (type in ('credit', 'debit')),
  amount numeric(14, 2) not null check (amount >= 0),
  currency text not null default 'NGN',
  provider text not null default 'nomba',
  provider_transaction_id text,
  status text not null default 'successful',
  metadata jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists wallet_transactions_provider_transaction_id_uidx
  on public.wallet_transactions(provider_transaction_id)
  where provider_transaction_id is not null;

create index if not exists wallet_transactions_wallet_id_created_at_idx
  on public.wallet_transactions(wallet_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists wallets_set_updated_at on public.wallets;

create trigger wallets_set_updated_at
before update on public.wallets
for each row
execute function public.set_updated_at();

alter table public.wallets enable row level security;
alter table public.wallet_contributors enable row level security;
alter table public.wallet_transactions enable row level security;

drop policy if exists "wallet owners can read wallets" on public.wallets;
create policy "wallet owners can read wallets"
on public.wallets for select
using (auth.uid() = user_id);

drop policy if exists "wallet contributors can read wallets" on public.wallets;
create policy "wallet contributors can read wallets"
on public.wallets for select
using (
  exists (
    select 1
    from public.wallet_contributors wc
    where wc.wallet_id = wallets.id
      and wc.user_id = auth.uid()
  )
);

drop policy if exists "wallet contributors can read contributor rows" on public.wallet_contributors;
create policy "wallet contributors can read contributor rows"
on public.wallet_contributors for select
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.wallets w
    where w.id = wallet_contributors.wallet_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "wallet users can read transactions" on public.wallet_transactions;
create policy "wallet users can read transactions"
on public.wallet_transactions for select
using (
  exists (
    select 1
    from public.wallets w
    where w.id = wallet_transactions.wallet_id
      and w.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.wallet_contributors wc
    where wc.wallet_id = wallet_transactions.wallet_id
      and wc.user_id = auth.uid()
  )
);
