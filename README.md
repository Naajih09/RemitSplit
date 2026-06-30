# RemitSplit
Send money home, split it instantly — built on Nomba's API for DevCareer x Nomba Hackathon 2026

# RemitSplit Frontend

## Setup
1. `pnpm install`
2. `.env` already configured to point at local backend (http://localhost:3000)
3. `pnpm run dev`

## What's already done
- Vite + React + Tailwind CSS v4 configured and working
- `src/lib/api.js` has working signup/login helpers connected to the backend

## Backend routes available
See backend/index.js for the full list: /auth/signup, /auth/login, /wallets, /withdraw, /contribute/quote, /banks, /exchange-rate, /convert, /verify-account, /webhooks/nomba

## What's needed (see PRD Section 9 for full breakdown)
- Login/Signup pages
- Wallet creation flow
- Contribution flow
- Withdrawal flow
- Dashboard with balance + transaction history
