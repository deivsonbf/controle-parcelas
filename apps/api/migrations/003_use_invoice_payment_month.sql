CREATE OR REPLACE VIEW expense_installments AS
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
