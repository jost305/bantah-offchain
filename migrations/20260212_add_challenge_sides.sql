-- Migration: Add challenged_side and challenger_side columns to challenges table
-- Date: 2026-02-12
-- Purpose: Support P2P and Open challenge position designations
-- Details: These columns track which side (YES/NO) the challenger and challenged users take

BEGIN;

-- Add the missing columns to the challenges table
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS challenger_side VARCHAR(16);
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS challenged_side VARCHAR(16);

-- Create indexes for these columns for better query performance
CREATE INDEX IF NOT EXISTS idx_challenges_challenger_side ON challenges(challenger_side);
CREATE INDEX IF NOT EXISTS idx_challenges_challenged_side ON challenges(challenged_side);

COMMIT;

-- Rollback section (uncomment to undo if needed):
-- BEGIN;
-- ALTER TABLE challenges DROP COLUMN IF EXISTS challenged_side;
-- ALTER TABLE challenges DROP COLUMN IF EXISTS challenger_side;
-- DROP INDEX IF EXISTS idx_challenges_challenged_side;
-- DROP INDEX IF EXISTS idx_challenges_challenger_side;
-- COMMIT;
