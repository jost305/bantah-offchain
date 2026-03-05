# Bantah Technical Documentation

Version: 1.0
Last Updated: 2026-02-21


## 1. Purpose And Scope
This document defines the production technical architecture and operating model of Bantah across two live product modes:
- Offchain Bantah (fiat + internal settlement rails)
- Onchain Bantah (EVM wallet-native + smart-contract escrow rails)

It is written for GitBook publication and grant due diligence.

## 2. Platform Summary
Bantah is a peer-to-peer challenge platform where users create or accept prediction challenges, stake value, submit proof, vote outcomes, and settle transparently.

Core challenge types:
- Direct P2P Challenge: creator targets a specific opponent.
- Open Challenge: creator publishes to a feed; first eligible user accepts.
- Group Challenge: managed challenge format used for platform campaigns.
- Community/Partner Challenge: managed challenge streams under partner programs.

## 3. Live Product Variants
| Variant | Primary Unit | Auth UX | Settlement Rail | Current Status |
|---|---|---|---|---|
| Onchain | ETH / USDC / USDT (testnets) | Wallet + Email + Telegram (Privy) | Wallet tx + escrow contract | Live |

## 4. Repositories And Deployment Topology
Primary codebases:
- `Onchain` (onchain product deployment)
- `dnej5yh84940-main` (offchain product deployment)

Current production endpoints:
- Onchain: `https://onchain-web-production.up.railway.app`
- Offchain: `https://offchain-web-production.up.railway.app`

Deployment model:
- Single service per product on Railway.
- Each service serves both frontend static bundle and backend API.
- PostgreSQL (Supabase-compatible connection) via `DATABASE_URL`.

## 5. Technology Stack
Frontend:
- React 18 + TypeScript
- Vite build pipeline
- Wouter routing
- TanStack Query for API state
- TailwindCSS + Radix UI + shadcn-style components

Backend:
- Node.js + Express + TypeScript
- Drizzle ORM + PostgreSQL
- Multer for file uploads
- Pusher for realtime events

Auth:
- Privy (`@privy-io/react-auth`, `@privy-io/server-auth`)
- Wallet identity support in Onchain build

Onchain-specific:
- Viem-based client tx execution (`client/src/lib/onchainEscrow.ts`)
- EVM smart contracts via Hardhat
- Escrow contract: `contracts/BantahEscrow.sol`

Offchain-specific:
- Paystack integration for fiat deposit/withdraw rails

## 6. High-Level Architecture
```text
[Client (React/Vite)]
   |  HTTPS + JSON
   v
[Express API Layer]
   |-- Auth (Privy)
   |-- Challenge Engine
   |-- Wallet Engine (offchain / onchain mode aware)
   |-- Realtime Events (Pusher)
   |-- Notifications
   v
[PostgreSQL + Drizzle]

Onchain mode extends:
Client Wallet -> Chain RPC -> Escrow Contract Events/Tx Hash -> API Verification -> DB State
```

## 7. Core Domain Model (Shared)
Key shared tables in `shared/schema.ts`:
- `users`
- `challenges`
- `pair_queue`
- `challenge_messages`
- `notifications`
- `transactions`

Important challenge fields (used across both modes):
- `challenger`, `challenged`, `challengedWalletAddress`
- `challengerSide`, `challengedSide`
- `status`, `result`, `dueDate`
- `settlementRail`, `chainId`, `tokenSymbol`, `stakeAtomic`
- `escrowTxHash`, `settleTxHash`

## 8. Authentication And Access Control
Base auth pattern:
- Read endpoints are selectively public.
- Write/financial/state-changing endpoints require Privy auth.

Onchain action protection:
- `requireOnchainWallet` middleware enforces a valid EVM wallet before protected challenge actions.
- Wallet identity may be read from auth payload and normalized into user profile (`primaryWalletAddress`, `walletAddresses`).

Challenge page access model (Onchain current behavior):
- Challenge detail/activity pages are publicly viewable.
- Private challenge chat/messages are not publicly readable for non-participants.
- Actions (accept, send message, vote, dispute, proof upload, queue join) are sign-in gated.

## 9. Challenge Lifecycle
### 9.1 Shared Logical Lifecycle
1. Challenge created (direct/open/admin/community).
2. Stake intent established.
3. Counterparty acceptance/matching.
4. Challenge active until `dueDate`.
5. Proof upload and voting.
6. Settlement resolution.
7. Payout release + notification fanout.

### 9.2 Offchain Lifecycle
- Creation and acceptance are backend-led state transitions.
- Wallet funding and withdrawal are fiat rails.
- Payouts resolve to offchain wallet balance.

### 9.3 Onchain Lifecycle
Config endpoint:
- `GET /api/onchain/config`

Execution modes:
- `metadata_only`: onchain fields are tracked but no enforced contract tx requirement.
- `contract`: escrow tx verification and settlement tx pathways are active.

Onchain flow in contract mode:
1. User creates/accepts challenge with wallet-authenticated request.
2. User executes escrow tx (native send or ERC20 approve + `depositToken`).
3. Backend verifies tx hash against configured chain + escrow contract.
4. Challenge transitions to active state.
5. Vote/proof phase remains app-mediated.
6. Optional settlement tx (`settle(...)`) recorded and linked.

## 10. Smart Contract Layer (Onchain)
Escrow contract file:
- `Onchain/contracts/BantahEscrow.sol`

Supported actions:
- Native escrow lock (via `receive()`)
- ERC20 escrow lock (`depositToken(address,uint256)`)
- Settlement signaling (`settle()` and `settle(uint256,uint8)`)
- Owner-managed withdrawals (`withdrawNative`, `withdrawToken`)

Design note:
- Contract provides custody + auditable events.
- Application backend remains source of challenge business logic and dispute flow.

## 11. Chain And Token Support (Onchain)
Default testnet chain configs are defined in:
- `Onchain/shared/onchainConfig.ts`

Current configured chain set supports:
- Base Sepolia (`84532`)
- BSC Testnet (`97`)
- Arbitrum Sepolia (`421614`)
- Celo Sepolia (`11142220`)
- Unichain Sepolia (`1301`)

Token symbols:
- `ETH` (native)
- `USDC` (ERC20)
- `USDT` (ERC20)

- Onchain: challenge escrow tx flow via challenge endpoints + onchain config, with wallet enforcement middleware for sensitive actions.

## 13. Realtime And Notification Model
Realtime:
- Pusher channels broadcast challenge joins, new messages, and activity updates.

Notification system:
- Persistent notification records in DB.
- Navigation badge counts and user feed endpoints.
- Treasury, challenge, and admin-notification pathways are supported.

## 14. Partner/Community Control Plane
Partner capabilities:
- Program creation and membership roles
- Program challenge creation
- Monitoring of challenge activity and fees
- Wallet summary + withdrawal request workflow

Admin capabilities:
- Partner application review
- Program-level oversight
- Withdrawal approval/rejection
- Cross-platform moderation control

## 15. Security Model
Authentication and identity:
- Privy token verification at API layer
- Wallet normalization and storage for onchain mode

Integrity controls:
- Tx hash format validation and chain-aware verification
- Escrow contract address enforcement by chain config
- Role-based admin and partner control paths

Operational security requirements:
- Never expose private keys in client or docs
- Rotate API keys and service secrets on schedule
- Enforce HTTPS and secure cookie/token policy in production


### 16.2 Offchain-Specific Variables
- Paystack keys and webhook configuration
- Fiat wallet operational parameters
- Per-chain RPC URLs
- Per-chain escrow addresses
- Per-chain token addresses for ERC20 rails

## 17. Dev And Operations Runbook
Install:
- `npm install`

Run local:
- `npm run dev`

Build:
- `npm run build`

DB push:
- `npm run db:push`

Onchain contract actions (Onchain repo):
- `npm run onchain:compile`
- `npm run onchain:deploy:base`
- `npm run onchain:deploy:arb`
- `npm run onchain:deploy:bsc`

## 18. QA Checklist (Grant-Ready)
Minimum acceptance paths:
- Unauthenticated user can view challenge feed + public detail pages.
- Unauthenticated user cannot execute state-changing actions.
- Authenticated offchain user can create/accept/settle and receive wallet updates.
- Authenticated onchain user can create/accept with wallet chain/token and escrow tx flow.
- Notification paths (challenge sent/accepted/active/settled) are generated correctly.
- Partner program controls and admin oversight paths are operational.

## 19. Known Constraints And Active Roadmap
Current constraint:
- Onchain creation currently depends on app state + tx-linked verification, with full factory-native challenge creation planned as future evolution.

Roadmap direction:
- Expanded chain coverage and contract verification pipelines
- Deeper onchain indexing for explorer-native transparency
- Enhanced grant/report telemetry dashboard

---

## 20. Screenshot Placeholders (GitBook Assets)
Use this section to embed production screenshots without rewriting the doc.

### 20.1 Platform Overview
![Bantah Landing / Global Navigation](./screenshots/01-platform-overview.png)

### 20.2 Challenges Feed
![Challenges Feed - Filters and Cards](./screenshots/02-challenges-feed.png)

### 20.3 Open Challenge Card
![Open Challenge Card UI](./screenshots/03-open-challenge-card.png)

### 20.4 Direct Challenge Card
![Direct Challenge Card UI](./screenshots/04-direct-challenge-card.png)

### 20.5 Accept Challenge Modal
![Accept Challenge Modal](./screenshots/05-accept-modal.png)

### 20.6 Challenge Activity Page
![Challenge Activity Page](./screenshots/06-challenge-activity-page.png)

### 20.7 Private Challenge Chat (Desktop)
![Private Challenge Chat Desktop](./screenshots/07-chat-desktop.png)

### 20.8 Private Challenge Chat (Mobile)
![Private Challenge Chat Mobile](./screenshots/08-chat-mobile.png)

### 20.9 Proof Upload And Vote Panel
![Proof Upload and Vote](./screenshots/09-proof-vote-panel.png)

### 20.10 Notifications Center
![Notifications Center](./screenshots/10-notifications.png)

### 20.11 Wallet (Offchain)
![Offchain Wallet - Deposit/Withdraw](./screenshots/11-wallet-offchain.png)

### 20.12 Wallet (Onchain)
![Onchain Wallet - Chain/Token Context](./screenshots/12-wallet-onchain.png)

### 20.13 Onchain Challenge Create Form
![Onchain Create Form with Chain/Token](./screenshots/13-onchain-create-form.png)

### 20.14 Escrow Transaction Evidence
![Explorer Transaction Evidence](./screenshots/14-escrow-explorer.png)

### 20.15 Admin Dashboard
![Admin Dashboard](./screenshots/15-admin-dashboard.png)

### 20.16 Partner Signup
![Partner Signup Form](./screenshots/16-partner-signup.png)

### 20.17 Partner Workspace
![Partner Workspace](./screenshots/17-partner-workspace.png)

### 20.18 Communities Tab
![Communities Tab and Cards](./screenshots/18-communities-tab.png)

### 20.19 About / Terms / Privacy (Onchain Version)
![Onchain About-Terms-Privacy Pages](./screenshots/19-onchain-doc-pages.png)

### 20.20 Leaderboard And History
![Leaderboard and History](./screenshots/20-leaderboard-history.png)

---