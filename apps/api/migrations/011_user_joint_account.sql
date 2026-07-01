ALTER TABLE users
  ADD COLUMN IF NOT EXISTS joint_account BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_users_joint_account ON users(joint_account);
