-- Drizzle-compatible SQL migration: add offchain challenge voting/escrow tables
-- Reuses same schema as top-level migration; placed here for projects using Drizzle SQL migrations

BEGIN;

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

CREATE TABLE IF NOT EXISTS challenge_proofs (
  id SERIAL PRIMARY KEY,
  challenge_id VARCHAR(128) NOT NULL,
  participant_id VARCHAR(128) NOT NULL,
  proof_uri TEXT NOT NULL,
  proof_hash VARCHAR(128) NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS challenge_state_history (
  id SERIAL PRIMARY KEY,
  challenge_id VARCHAR(128) NOT NULL,
  prev_state VARCHAR(64),
  new_state VARCHAR(64) NOT NULL,
  changed_by VARCHAR(128),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT
);

ALTER TABLE IF EXISTS challenges ADD COLUMN IF NOT EXISTS settlement_method VARCHAR(32) DEFAULT 'VOTING';
ALTER TABLE IF EXISTS challenges ADD COLUMN IF NOT EXISTS escrow_total NUMERIC(30,8) DEFAULT 0;
ALTER TABLE IF EXISTS challenges ADD COLUMN IF NOT EXISTS vote_deadline TIMESTAMPTZ;

COMMIT;
