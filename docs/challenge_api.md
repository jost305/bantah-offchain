# Challenge API - Reserve / Vote / Release / Dispute (Offchain)

This document describes the minimal API endpoints to implement the offchain voting + custodial escrow model for `Open` and `Direct` challenges. Keep these endpoints additive and non-breaking.

Auth: Bearer JWT / session cookie. All endpoints require authenticated user.

Common types
- `challengeId` : string
- `participantId` : string (user id)
- `amount` : decimal (string encoded)
- `proofUri` : string (S3/IPFS/URL)
- `proofHash` : string (keccak256 or sha256 hex)

1) POST /api/challenges/:id/reserve
- Purpose: Reserve (stake) funds into platform escrow for a challenge
- Request body:
  - `participantId` (implicit from auth)
  - `amount` (required)
  - `paymentMethodId` (optional, e.g., internal balance / card / external)
  - `autoCapture` (boolean) — for card holds; default false
- Response: 200 { reservationId, challengeId, reservedAmount, reservedAt }
- Validation: check user balance or perform payment hold. Create `escrow_reservations` row and atomically decrement withdrawable balance.

2) POST /api/challenges/:id/accept
- Purpose: Accept a challenge (for Direct) and optionally reserve in one step
- Request body:
  - `participantId` (implicit)
  - `reserveNow` (boolean) — if true, server will create reservation as in `/reserve`
- Response: 200 { status: 'accepted' | 'waiting_creator_reserve', acceptanceId }

3) GET /api/challenges/:id/state
- Purpose: Return canonical challenge state (including escrow_total, participants' reservation statuses, vote statuses)
- Response: 200 { challenge, reservations: [...], votesSummary, state }

4) POST /api/challenges/:id/proofs
- Purpose: Upload proof metadata (file upload handled separately)
- Request body:
  - `proofUri`, `proofHash`
- Response: 201 { proofId }
- Note: server should verify `proofHash` matches uploaded file; store file in S3/IPFS and record `challenge_proofs`.

5) POST /api/challenges/:id/vote
- Purpose: Submit vote + proof reference (signed client-side)
- Request body:
  - `voteChoice` (e.g., 'creator' | 'opponent')
  - `proofId` (or `proofUri` + `proofHash`)
  - `signedVote` (string) — client ECDSA signature over `challengeId|voteChoice|proofHash|timestamp`
- Response: 200 { voteId, submittedAt }
- Server verifies signature and creates `challenge_votes` row. If after this submission both participants have matching votes and proofs, server triggers `tryAutoRelease`.

6) POST /api/challenges/:id/try-release
- Purpose: Attempt automatic release (idempotent). Can be called by backend worker or user client.
- Request body: none
- Response: 200 { released: boolean, reason }
- Logic: If both votes exist, match, and proofs present, compute platform fee, create ledger transfer (debit escrow reservations, credit winner withdrawable balance), write `challenge_state_history` with RESOLVED.

7) POST /api/challenges/:id/dispute
- Purpose: Open a dispute (if votes mismatch or proof is insufficient)
- Request body:
  - `reason` (string)
  - `evidence` (optional)
- Response: 200 { disputeId }
- Effect: mark challenge state DISPUTE, notify admin; funds remain reserved.

8) POST /api/admin/challenges/:id/resolve
- Purpose: Admin-only endpoint to resolve disputes and execute payout/refund/split
- Request body:
  - `resolution` : { type: 'winner'|'split'|'refund', winnerParticipantId?, split?: [{participantId, pct}] }
  - `note` : optional
- Response: 200 { success: true, ledgerTxId }
- Effect: Create ledger operations to move reserved funds accordingly, create `challenge_state_history` entry.

Additional endpoints (for UX)
- GET /api/challenges/:id/proofs — list proofs
- POST /api/challenges/:id/cancel — cancel challenge before ACTIVE
- GET /api/users/:id/balance — show withdrawable/reserved balances

Security & validation notes
- Require client signatures for votes. Verify signature server-side to bind vote to user. Reject replayed signatures (use timestamp and nonce).
- Validate `proofHash` matches uploaded file. Retain proof files with hash and backup/retention policy.
- All ledger movements must be ACID transactions: changes to `escrow_reservations`, user balances, and `challenge_state_history` should be in a single DB transaction.

Workers & automation
- Background worker watches for conditions to call `/try-release` (e.g., both votes present) and for deadlines (`creatorStakeDeadline`, `voteDeadline`).
- Reminders: notify users when creator needs to reserve or when vote deadline is approaching.

Examples (short)
- Submit vote (client signs payload, then POST `/api/challenges/abc/vote`):
  {
    "voteChoice":"creator",
    "proofId": 42,
    "signedVote":"0xabc..."
  }

Implementation: integrate these endpoints into existing challenge controllers, add minimal migrations (see migrations/20260212_add_challenge_voting.sql), and gate frontend behavior behind feature flag `feature:challenge_voting`.
