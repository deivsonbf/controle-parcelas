ALTER TABLE fixed_expenses
  ADD COLUMN IF NOT EXISTS recurring BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_fixed_expenses_recurring ON fixed_expenses(recurring);
