ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

UPDATE cards c
SET owner_user_id = u.id
FROM users u
WHERE c.owner_user_id IS NULL
  AND LOWER(c.owner_name) LIKE LOWER(u.name) || '%';

CREATE INDEX IF NOT EXISTS idx_cards_owner_user_id ON cards(owner_user_id);
