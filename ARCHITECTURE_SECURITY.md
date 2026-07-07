# RemitSplit: Architecture & Security Technical Note
**Track:** Infrastructure | **Focus:** Dedicated Virtual Account Systems

## 🏗️ System Architecture
RemitSplit is built on a decoupled three-tier architecture designed for high availability and strict data consistency:

1. **Frontend (React/Vite):** A stateless UI that communicates with the backend via REST. All sensitive logic and Nomba credentials remain server-side.
2. **Backend (Node/Express):** The orchestration layer. It manages Nomba API token lifecycles, processes inbound webhooks, handles FX conversion logic, and triggers automated payouts.
3. **Database (Supabase/PostgreSQL):** The source of truth. Uses a relational schema with Row-Level Security (RLS) to ensure multi-tenant data isolation.

## 🔗 Nomba Infrastructure Integration
- **Dedicated Virtual Accounts:** Utilizes Nomba's `POST /v1/accounts/virtual` to generate unique collection accounts for every wallet (Static for Remit, Dynamic/Targeted for Split).
- **Global Payout Engine:** Deep integration with the `Fetch Exchange Rate` and `Convert Money` endpoints to lock FX quotes at the point of funding.
- **Verification Layer:** Implements `Bank Lookup` for KYC-compliant payouts.
- **Automated Settlement:** Uses the `Transfer API` for both on-demand beneficiary withdrawals and automated "Target-Reached" split payouts.

## 🛡️ Security & Integrity Controls
- **Signature Verification:** Validates every Nomba webhook using HMAC-SHA256 signatures to prevent Replay and Man-in-the-Middle attacks.
- **Idempotent Webhook Processing:** Implements a strict deduplication logic. Every incoming `transactionId` from Nomba is recorded in a unique-constrained ledger. Duplicate events are acknowledged (HTTP 200) but discarded to prevent double-crediting.
- **Server-Side Balance Guard:** Withdrawal amounts are validated against the internal PostgreSQL ledger before calling Nomba APIs.
- **Zero-Trust Frontend:** The UI never initiates a transfer; it only "requests" one. All final math, rate applications, and fee calculations are performed on the backend.

## 📊 Reconciliation & Under/Overpayment Logic
- **Partial Payments:** For Split mode, the system tracks cumulative balances. If a contributor underpays, the wallet reflects the partial credit, and the status remains `active`.
- **Automated Payout Trigger:** The system calculates `current_balance >= target_amount` on every successful webhook. Payouts are triggered only when the ledger is fully reconciled.
- **Transaction Verification:** In addition to webhooks, the system is designed to perform a "Single Transaction Check" (`GET /v1/transactions/accounts/single`) for inconclusive events, as per Nomba best practices.

## 🚀 Production Roadmap
- Migrate in-process deduplication to a persistent Redis-based idempotency cache.
- Implement automated "Stale Split" expiration to recycle virtual account references.
