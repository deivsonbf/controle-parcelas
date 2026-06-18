CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'user');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'user',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  last_four TEXT NOT NULL CHECK (last_four ~ '^[0-9]{4}$'),
  owner_name TEXT NOT NULL,
  closing_day INTEGER NOT NULL CHECK (closing_day BETWEEN 1 AND 31),
  due_day INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#2563eb',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount > 0),
  installments INTEGER NOT NULL CHECK (installments > 0 AND installments <= 120),
  purchase_date DATE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE RESTRICT,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP VIEW IF EXISTS expense_installments;

CREATE VIEW expense_installments AS
SELECT
  e.id AS expense_id,
  gs.installment_number,
  e.installments AS total_installments,
  CASE
    WHEN gs.installment_number = e.installments THEN
      e.total_amount - (ROUND(e.total_amount / e.installments, 2) * (e.installments - 1))
    ELSE
      ROUND(e.total_amount / e.installments, 2)
  END AS installment_amount,
  (
    DATE_TRUNC('month', e.purchase_date)::DATE
    + (
      (
        gs.installment_number
        + CASE
            WHEN EXTRACT(DAY FROM e.purchase_date)::INTEGER > c.closing_day THEN 1
            ELSE 0
          END
      ) || ' months'
    )::INTERVAL
  )::DATE AS reference_month,
  e.description,
  e.total_amount,
  e.purchase_date,
  e.user_id,
  u.name AS user_name,
  e.card_id,
  c.name AS card_name,
  c.last_four AS card_last_four,
  e.category_id,
  cat.name AS category_name,
  cat.color AS category_color
FROM expenses e
JOIN users u ON u.id = e.user_id
JOIN cards c ON c.id = e.card_id
JOIN categories cat ON cat.id = e.category_id
CROSS JOIN LATERAL generate_series(1, e.installments) AS gs(installment_number);

CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_card_id ON expenses(card_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_purchase_date ON expenses(purchase_date);

INSERT INTO users (name, email, password_hash, role)
VALUES ('Administrador', 'admin@example.com', '$2a$10$yRYLa2cELJyUkwvcqPWd9eXXiKGA/1xKkm6Qn0BmWb/4gPy18PoBW', 'admin')
ON CONFLICT (email) DO NOTHING;

INSERT INTO categories (name, color)
VALUES
  ('Mercado', '#0891b2'),
  ('Casa', '#16a34a'),
  ('Saude', '#dc2626'),
  ('Transporte', '#ca8a04'),
  ('Outros', '#4f46e5')
ON CONFLICT (name) DO NOTHING;
