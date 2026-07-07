# RemitSplit 🚀
### **Send Money Home. Share it Instantly.**
**DevCareer x Nomba Hackathon 2026**  
*Track: Infrastructure | Focus Area: Dedicated Virtual Accounts*

---

## 📌 Executive Summary
RemitSplit is a dual-mode payment orchestration platform built on **Nomba's API infrastructure**. It solves two critical Nigerian financial challenges—diaspora remittance and group contribution management—using a single underlying engine: **Dedicated Virtual Accounts.**

By leveraging Nomba, RemitSplit represents a complete payments lifecycle: money flows in from global or local sources, lands in a dedicated virtual account, and is disbursed automatically to the right person without manual reconciliation.

---

## 🛠️ Core Features

### 1. 🌍 REMIT MODE (Shared Family Wallet)
A persistent, shared family fund for the Nigerian diaspora (UK, Europe, Canada).
*   **Persistent Infrastructure:** A standing Dedicated Virtual Account representing a family fund.
*   **FX Rate Locking:** Contributions lock exchange rates at the point of funding via Nomba's Global Payout API, protecting against NGN volatility.
*   **Shared Visibility:** Multiple siblings abroad can fund the same wallet, while a single beneficiary at home withdraws funds as needed.

### 2. 🤝 SPLIT MODE (Group Payment Coordinator)
A one-off collection tool for Ajo/Esusu, event fundraising, or shared bills.
*   **Dynamic Virtual Accounts:** Every split gets a unique account number with a specific `expectedAmount`.
*   **Frictionless Payments:** Contributors pay via simple bank transfer to a shared link—no app install required.
*   **Automated Settlement:** The system triggers an automated payout to the organizer once the target is met.

---

## ⚙️ Nomba API Integration Map
As an Infrastructure Track submission, RemitSplit demonstrates deep integration across the Nomba ecosystem:

| Nomba API Module | Implementation Logic |
| :--- | :--- |
| **Dedicated Virtual Accounts** | `POST /v1/accounts/virtual` - Generates unique collection accounts for every wallet and split. |
| **Global Payout (FX)** | `GET /exchange-rates` & `POST /convert-money` - Displays and locks live GBP/USD to NGN rates. |
| **Webhooks** | Inbound payment detection used to update ledger balances in real-time. |
| **Bank Transfers** | `POST /v1/transfers/bank` - Automated payouts for split completion and manual beneficiary withdrawals. |
| **Bank Account Lookup** | `POST /v1/transfers/bank/lookup` - Verifies beneficiary identity before funds are disbursed. |

---

## 🏗️ System Architecture
RemitSplit is a three-tier application designed for security and scalability:

*   **Frontend:** React + Tailwind CSS (Vite) - Clean, purpose-driven dashboards for both contributors and organizers.
*   **Backend:** Node.js + Express - The orchestration layer handling Nomba API credential lifecycles and business logic.
*   **Database:** Supabase (PostgreSQL) - Real-time ledger tracking and secure authentication.

### 🔒 Security & Reliability
*   **Webhook Signature Validation:** Ensures all payment notifications originate from Nomba.
*   **Idempotency Keys:** Prevent double-spending on payout and transfer routes.
*   **Server-Side Validation:** All withdrawal requests are validated against the internal ledger before calling Nomba APIs.
*   **Encryption:** Beneficiary bank details and API credentials are encrypted at rest.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Nomba API Credentials (Client ID & Secret)
- Supabase Project URL & Service Key

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/naajih09/RemitSplit.git
   
2. **Backend:**
   cd backend
npm install
# Create a .env file with NOMBA_CLIENT_ID, NOMBA_CLIENT_SECRET, SUPABASE_URL, SUPABASE_KEY
node index.js

3. **Frontend**
cd frontend
pnpm install
pnpm run dev

⚖️ Judging Criteria Alignment
Problem Relevance (20%): Directly addresses the $20B+ annual remittance transparency gap and the manual nature of "Ajo" group collections.
Technical Execution (25%): Full-cycle payment orchestration using Webhooks, Virtual Accounts, and Global Payout APIs.
Nomba Integration Depth (20%): Uses 5+ distinct Nomba modules to build a production-ready financial lifecycle.
Security & Reliability (20%): JWT Auth, Webhook validation, and Idempotency key implementation.
Built with ❤️ for the DevCareer x Nomba Hackathon 2026.
