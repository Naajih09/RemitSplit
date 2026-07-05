# RemitSplit

Send money home. Share it instantly.

RemitSplit is a dual-mode payment MVP for the DevCareer x Nomba Hackathon 2026. It combines persistent family remittance wallets and one-off split collections on top of Nomba Dedicated Virtual Accounts, Global Payout, Transfers, and Webhooks.

## Apps

- `frontend`: React + Tailwind CSS
- `backend`: Express + Supabase + Nomba APIs

## Local Setup

Backend:

```bash
cd backend
npm install
npm start
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Required Environment

Backend `.env`:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `NOMBA_SUPABASE_SERVICE_KEY`
- `NOMBA_BASE_URL`
- `NOMBA_CLIENT_ID`
- `NOMBA_PRIVATE_KEY`
- `NOMBA_ACCOUNT_ID`
- `NOMBA_WEBHOOK_SECRET`

Frontend `.env`:

- `VITE_API_URL`

## Main Backend Routes

- `POST /auth/signup`
- `POST /auth/login`
- `GET /wallets`
- `POST /wallets`
- `GET /wallets/:walletId/balance`
- `GET /wallets/:walletId/contributors`
- `POST /wallets/:walletId/contributors`
- `GET /wallets/:walletId/transactions`
- `POST /contribute/quote`
- `POST /withdraw`
- `GET /banks`
- `POST /verify-account`
- `GET /public/split/:accountRef`
- `POST /webhooks/nomba`

## Submission Notes

- Architecture and security summary: `ARCHITECTURE_SECURITY.md`
- Optional Supabase ledger SQL: `supabase_schema.sql`
- Split auto-payout needs organizer bank details during split creation.
- Public split payment links use `/pay/:accountRef`.
