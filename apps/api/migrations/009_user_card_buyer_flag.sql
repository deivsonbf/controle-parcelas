ALTER TABLE users
  ADD COLUMN IF NOT EXISTS card_buyer_only BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_users_card_buyer_only ON users(card_buyer_only);
