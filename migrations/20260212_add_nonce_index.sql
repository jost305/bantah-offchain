-- Add unique index on vote_nonce to prevent replay attacks
CREATE UNIQUE INDEX IF NOT EXISTS idx_challenge_votes_vote_nonce ON challenge_votes (vote_nonce);

-- Helpful index for queries ordered by submission time
CREATE INDEX IF NOT EXISTS idx_challenge_votes_submitted_at ON challenge_votes (submitted_at);
