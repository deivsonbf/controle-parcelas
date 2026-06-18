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
    schedule.first_invoice_month
    + ((gs.installment_number - 1) || ' months')::INTERVAL
  )::DATE AS invoice_month,
  (
    schedule.first_payment_month
    + ((gs.installment_number - 1) || ' months')::INTERVAL
  )::DATE AS reference_month,
  (
    schedule.first_payment_month
    + ((gs.installment_number - 1) || ' months')::INTERVAL
    + (
      LEAST(
        c.due_day,
        EXTRACT(
          DAY FROM (
            schedule.first_payment_month
            + ((gs.installment_number - 1) || ' months')::INTERVAL
            + INTERVAL '1 month - 1 day'
          )
        )::INTEGER
      ) - 1
    ) * INTERVAL '1 day'
  )::DATE AS payment_date,
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
CROSS JOIN LATERAL (
  SELECT
    (
      DATE_TRUNC('month', e.purchase_date)::DATE
      + (
        CASE
          WHEN EXTRACT(DAY FROM e.purchase_date)::INTEGER > c.closing_day THEN 1
          ELSE 0
        END || ' months'
      )::INTERVAL
    )::DATE AS first_invoice_month,
    (
      DATE_TRUNC('month', e.purchase_date)::DATE
      + (
        CASE
          WHEN EXTRACT(DAY FROM e.purchase_date)::INTEGER > c.closing_day THEN 2
          ELSE 1
        END || ' months'
      )::INTERVAL
    )::DATE AS first_payment_month
) schedule
CROSS JOIN LATERAL generate_series(1, e.installments) AS gs(installment_number);
