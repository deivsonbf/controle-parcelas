CREATE TABLE IF NOT EXISTS monthly_incomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reference_month DATE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  received_date DATE NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS monthly_expense_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_month DATE NOT NULL,
  expense_kind TEXT NOT NULL CHECK (expense_kind IN ('fixed_expense', 'card_invoice')),
  fixed_expense_id UUID REFERENCES fixed_expenses(id) ON DELETE CASCADE,
  card_id UUID REFERENCES cards(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  paid_date DATE NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (expense_kind = 'fixed_expense' AND fixed_expense_id IS NOT NULL AND card_id IS NULL)
    OR
    (expense_kind = 'card_invoice' AND card_id IS NOT NULL AND fixed_expense_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_monthly_incomes_month_user ON monthly_incomes(reference_month, user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_expense_payments_month ON monthly_expense_payments(reference_month);
CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_expense_payments_fixed_unique
  ON monthly_expense_payments(reference_month, fixed_expense_id)
  WHERE expense_kind = 'fixed_expense';
CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_expense_payments_card_unique
  ON monthly_expense_payments(reference_month, card_id)
  WHERE expense_kind = 'card_invoice';
