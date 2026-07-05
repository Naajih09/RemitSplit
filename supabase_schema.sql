-- Optional RemitSplit ledger table for PRD transaction history and webhook idempotency.
-- Run this in Supabase SQL editor before the final demo if the table does not exist yet.

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
