-- Migration: Add signing public key column to users
-- Date: 2026-02-12

BEGIN;

ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS signing_pubkey TEXT;

-- Add vote_nonce column to challenge_votes (if not present)
ALTER TABLE IF EXISTS challenge_votes ADD COLUMN IF NOT EXISTS vote_nonce TEXT;

COMMIT;

-- Rollback:
-- BEGIN;
-- ALTER TABLE IF EXISTS challenge_votes DROP COLUMN IF EXISTS vote_nonce;
-- ALTER TABLE IF EXISTS users DROP COLUMN IF EXISTS signing_pubkey;
-- COMMIT;
