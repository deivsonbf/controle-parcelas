ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS recurring BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_expenses_recurring ON expenses(recurring);
