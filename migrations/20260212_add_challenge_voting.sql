-- Migration: Add offchain challenge voting/escrow tables and nullable fields
-- Date: 2026-02-12
-- Purpose: Minimal, non-breaking additions to support offchain escrow reservations,
-- votes, proofs and challenge state history. All columns are nullable or have
-- sensible defaults to avoid breaking existing code.

BEGIN;

-- Escrow reservations: track reserved amounts per participant for a challenge
CREATE TABLE IF NOT EXISTS escrow_reservations (
  id SERIAL PRIMARY KEY,
  challenge_id VARCHAR(128) NOT NULL,
  participant_id VARCHAR(128) NOT NULL,
  reserved_amount NUMERIC(30,8) NOT NULL,
  reserved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status VARCHAR(32) NOT NULL DEFAULT 'reserved',
  ledger_tx_id VARCHAR(255),
  UNIQUE (challenge_id, participant_id)
);

-- Votes: one vote record per participant per challenge
CREATE TABLE IF NOT EXISTS challenge_votes (
  id SERIAL PRIMARY KEY,
  challenge_id VARCHAR(128) NOT NULL,
  participant_id VARCHAR(128) NOT NULL,
  vote_choice VARCHAR(64) NOT NULL,
  proof_hash VARCHAR(128) NOT NULL,
  proof_uri TEXT,
  signed_vote TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, participant_id)
);

-- Proofs: stored artifacts uploaded by participants (one or more per participant)
CREATE TABLE IF NOT EXISTS challenge_proofs (
  id SERIAL PRIMARY KEY,
  challenge_id VARCHAR(128) NOT NULL,
  participant_id VARCHAR(128) NOT NULL,
  proof_uri TEXT NOT NULL,
  proof_hash VARCHAR(128) NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- State history for challenges (audit trail)
CREATE TABLE IF NOT EXISTS challenge_state_history (
  id SERIAL PRIMARY KEY,
  challenge_id VARCHAR(128) NOT NULL,
  prev_state VARCHAR(64),
  new_state VARCHAR(64) NOT NULL,
  changed_by VARCHAR(128),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT
);

-- Minimal non-breaking additions to the existing challenges table.
-- Use IF EXISTS/IF NOT EXISTS to avoid errors if table/columns differ across environments.
ALTER TABLE IF EXISTS challenges ADD COLUMN IF NOT EXISTS settlement_method VARCHAR(32) DEFAULT 'VOTING';
ALTER TABLE IF EXISTS challenges ADD COLUMN IF NOT EXISTS escrow_total NUMERIC(30,8) DEFAULT 0;
ALTER TABLE IF EXISTS challenges ADD COLUMN IF NOT EXISTS vote_deadline TIMESTAMPTZ;

COMMIT;

-- Down / rollback: drop the new tables and remove the added columns
-- NOTE: Running the down section will delete proof records and reservations. Run only when safe.
-- To rollback, run the commands below in a transaction.

-- BEGIN;
-- ALTER TABLE IF EXISTS challenges DROP COLUMN IF EXISTS vote_deadline;
-- ALTER TABLE IF EXISTS challenges DROP COLUMN IF EXISTS escrow_total;
-- ALTER TABLE IF EXISTS challenges DROP COLUMN IF EXISTS settlement_method;
-- DROP TABLE IF EXISTS challenge_state_history;
-- DROP TABLE IF EXISTS challenge_proofs;
-- DROP TABLE IF EXISTS challenge_votes;
-- DROP TABLE IF EXISTS escrow_reservations;
-- COMMIT;
