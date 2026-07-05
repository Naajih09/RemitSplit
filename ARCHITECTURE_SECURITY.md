# RemitSplit Architecture and Security Note

## Architecture

RemitSplit has three layers:

- Frontend: React + Tailwind. The browser only talks to the RemitSplit backend.
- Backend: Express. It owns Nomba credentials, Supabase access, wallet orchestration, webhook ingestion, FX quote calls, bank lookup, and transfers.
- Database: Supabase/PostgreSQL. It stores wallets, contributors, balances, payout details, and optional transaction ledger entries.

## Nomba Integration

- Dedicated Virtual Accounts: created for remit wallets and split collections.
- Global Payout Convert Money: used to lock a contribution quote before funding.
- Bank Lookup: used before beneficiary withdrawal.
- Transfers to Bank: used for remit withdrawals and split auto-payout.
- Webhooks: used to detect incoming virtual account payments and update wallet balances.

## Security Controls

- Nomba keys are server-side environment variables only.
- User routes require Supabase JWT authentication through the `Authorization: Bearer <token>` header.
- Wallet balance, contributors, transactions, quote, and withdrawal routes check wallet ownership or contributor access.
- Webhook signatures are validated when `NOMBA_WEBHOOK_SECRET` is configured.
- Webhook transaction IDs are de-duplicated in process to reduce accidental double-crediting during demos.
- Withdrawals validate amount server-side against the current wallet balance before transfer.
- Bank lookup runs before withdrawal transfer.
- Transfer references include wallet IDs and transaction IDs where available for traceability.

## Current MVP Notes

- The optional `wallet_transactions` table is used when present. If it is absent, the backend continues running and logs that ledger persistence was skipped.
- Split auto-payout requires organizer bank details at split creation time.
- Split virtual account `expectedAmount` is calculated as `target_amount / contributors_count`.
- For production, replace in-process webhook de-duplication with a unique database constraint on `provider_transaction_id`.
