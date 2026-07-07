-- RemitSplit Production-Grade Schema
-- Focus: Data Integrity and Reconciliation

create extension if not exists pgcrypto;

-- 1. WALLETS TABLE
create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_ref text not null unique,
  name text not null,
  type text not null check (type in ('remit', 'split')),
  target_amount numeric(14, 2), -- Required for Split mode
  current_balance numeric(14, 2) not null default 0,
  beneficiary_bank_details jsonb, -- Encrypted or structured bank data
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for fast webhook lookups
create index if not exists wallets_account_ref_idx on public.wallets(account_ref);
create unique index if not exists wallets_user_name_type_uidx on public.wallets(user_id, name, type);

-- 2. CONTRIBUTORS TABLE
create table if not exists public.wallet_contributors (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 3. TRANSACTION LEDGER (The Reconciliation Layer)
create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  type text not null check (type in ('credit', 'debit')),
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null default 'NGN',
  provider text not null default 'nomba',
  -- UNIQUE CONSTRAINT: This is your primary defense against double-crediting webhooks
  provider_transaction_id text unique, 
  status text not null default 'successful',
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- 4. UPDATED_AT TRIGGER (Safe Version)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Drop the trigger first if it exists, then create it
drop trigger if exists wallets_set_updated_at on public.wallets;
create trigger wallets_set_updated_at 
before update on public.wallets
for each row execute function public.set_updated_at();

-- 5. ROW LEVEL SECURITY (Safe Version)
alter table public.wallets enable row level security;
alter table public.wallet_contributors enable row level security;
alter table public.wallet_transactions enable row level security;

-- Drop existing policies first to avoid "already exists" errors
drop policy if exists "Owners/Contributors can read wallets" on public.wallets;
create policy "Owners/Contributors can read wallets" on public.wallets
for select using (
  auth.uid() = user_id or 
  exists (select 1 from public.wallet_contributors wc where wc.wallet_id = id and wc.user_id = auth.uid())
);

drop policy if exists "Users can see their transactions" on public.wallet_transactions;
create policy "Users can see their transactions" on public.wallet_transactions
for select using (
  exists (select 1 from public.wallets w where w.id = wallet_id and w.user_id = auth.uid()) or
  exists (select 1 from public.wallet_contributors wc where wc.wallet_id = wallet_transactions.wallet_id and wc.user_id = auth.uid())
);