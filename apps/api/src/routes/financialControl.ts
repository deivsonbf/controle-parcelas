import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getJointUserScope, isCardBuyerOnly } from '../services/userScope.js';
import { sendError } from '../utils/http.js';

const router = Router();
router.use(requireAuth);

const querySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  userId: z.string().uuid().optional()
});

const incomeSchema = z.object({
  userId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  description: z.string().min(2),
  amount: z.number().positive(),
  receivedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional().nullable()
});

const paymentSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  expenseKind: z.enum(['fixed_expense', 'card_invoice']),
  fixedExpenseId: z.string().uuid().optional().nullable(),
  cardId: z.string().uuid().optional().nullable(),
  amount: z.number().positive(),
  paidDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional().nullable()
});

router.get('/', async (req, res) => {
  try {
    const query = querySchema.parse(req.query);
    const isAdmin = req.user?.role === 'admin';
    const viewerCardBuyerOnly = !isAdmin && await isCardBuyerOnly(req.user?.id);
    const targetUserId = isAdmin ? query.userId : req.user?.id;
    const targetUserIds = targetUserId ? await getJointUserScope(targetUserId) : null;
    const targetMonth = query.month ?? new Date().toISOString().slice(0, 7);

    const [incomesResult, fixedResult, cardsResult, paymentsResult] = await Promise.all([
      pool.query(
        `SELECT mi.id,
                mi.user_id AS "userId",
                u.name AS "userName",
                TO_CHAR(mi.reference_month, 'YYYY-MM') AS month,
                mi.description,
                mi.amount,
                TO_CHAR(mi.received_date, 'YYYY-MM-DD') AS "receivedDate",
                mi.notes
         FROM monthly_incomes mi
         JOIN users u ON u.id = mi.user_id
         WHERE mi.reference_month = TO_DATE($1, 'YYYY-MM')
           AND ($2::uuid[] IS NULL OR mi.user_id = ANY($2::uuid[]))
         ORDER BY mi.received_date DESC, mi.created_at DESC`,
        [targetMonth, targetUserIds]
      ),
      viewerCardBuyerOnly
        ? Promise.resolve({ rows: [] })
        : pool.query(
            `SELECT fe.id,
                    fe.description,
                    fe.amount,
                    fe.due_day AS "dueDay",
                    u.id AS "userId",
                    u.name AS "userName",
                    cat.name AS "categoryName"
             FROM fixed_expenses fe
             JOIN users u ON u.id = fe.user_id
             JOIN categories cat ON cat.id = fe.category_id
             WHERE fe.active = TRUE
               AND fe.starts_on <= (TO_DATE($1, 'YYYY-MM') + INTERVAL '1 month - 1 day')::date
               AND ($2::uuid[] IS NULL OR fe.user_id = ANY($2::uuid[]))
             ORDER BY fe.due_day, fe.description`,
            [targetMonth, targetUserIds]
          ),
      pool.query(
        `WITH card_totals AS (
           SELECT ei.card_id,
                  ei.card_name,
                  ei.card_last_four,
                  c.owner_user_id,
                  owner.name AS owner_name,
                  SUM(ei.installment_amount)::numeric(12,2) AS gross_total
           FROM expense_installments ei
           JOIN cards c ON c.id = ei.card_id
           LEFT JOIN users owner ON owner.id = c.owner_user_id
           WHERE ei.reference_month = TO_DATE($1, 'YYYY-MM')
             AND ($2::uuid[] IS NULL OR ei.user_id = ANY($2::uuid[]) OR c.owner_user_id = ANY($2::uuid[]))
           GROUP BY ei.card_id, ei.card_name, ei.card_last_four, c.owner_user_id, owner.name
         ),
         invoice_payments AS (
           SELECT card_id, SUM(amount)::numeric(12,2) AS payments_total
           FROM invoice_payments
           WHERE reference_month = TO_DATE($1, 'YYYY-MM')
           GROUP BY card_id
         )
         SELECT ct.card_id AS "cardId",
                ct.card_name AS "cardName",
                ct.card_last_four AS "cardLastFour",
                ct.owner_user_id AS "ownerUserId",
                ct.owner_name AS "ownerUserName",
                ct.gross_total AS "grossTotal",
                COALESCE(ip.payments_total, 0)::numeric(12,2) AS "invoicePaymentsTotal",
                (ct.gross_total - COALESCE(ip.payments_total, 0))::numeric(12,2) AS "amount"
         FROM card_totals ct
         LEFT JOIN invoice_payments ip ON ip.card_id = ct.card_id
         ORDER BY ct.card_name`,
        [targetMonth, targetUserIds]
      ),
      pool.query(
        `SELECT mep.id,
                mep.expense_kind AS "expenseKind",
                mep.fixed_expense_id AS "fixedExpenseId",
                mep.card_id AS "cardId",
                mep.amount,
                TO_CHAR(mep.paid_date, 'YYYY-MM-DD') AS "paidDate",
                mep.notes
         FROM monthly_expense_payments mep
         WHERE mep.reference_month = TO_DATE($1, 'YYYY-MM')`,
        [targetMonth]
      )
    ]);

    const paymentsByFixed = new Map(paymentsResult.rows
      .filter((payment) => payment.expenseKind === 'fixed_expense')
      .map((payment) => [payment.fixedExpenseId, payment]));
    const paymentsByCard = new Map(paymentsResult.rows
      .filter((payment) => payment.expenseKind === 'card_invoice')
      .map((payment) => [payment.cardId, payment]));

    const fixedExpenses = fixedResult.rows.map((expense) => {
      const payment = paymentsByFixed.get(expense.id);
      return {
        ...expense,
        paid: Boolean(payment),
        paymentId: payment?.id ?? null,
        paidAmount: payment?.amount ?? '0.00',
        paidDate: payment?.paidDate ?? null,
        paymentNotes: payment?.notes ?? null
      };
    });
    const cardInvoices = cardsResult.rows.map((card) => {
      const payment = paymentsByCard.get(card.cardId);
      return {
        ...card,
        paid: Boolean(payment),
        paymentId: payment?.id ?? null,
        paidAmount: payment?.amount ?? '0.00',
        paidDate: payment?.paidDate ?? null,
        paymentNotes: payment?.notes ?? null
      };
    });

    const incomeTotal = incomesResult.rows.reduce((sum, row) => sum + Number(row.amount), 0);
    const fixedExpensesTotal = fixedExpenses.reduce((sum, row) => sum + Number(row.amount), 0);
    const cardInvoicesTotal = cardInvoices.reduce((sum, row) => sum + Number(row.amount), 0);
    const paidTotal = [...fixedExpenses, ...cardInvoices].reduce((sum, row) => sum + Number(row.paidAmount), 0);
    const expensesTotal = fixedExpensesTotal + cardInvoicesTotal;

    res.json({
      month: targetMonth,
      incomeTotal,
      fixedExpensesTotal,
      cardInvoicesTotal,
      expensesTotal,
      paidTotal,
      unpaidTotal: expensesTotal - paidTotal,
      balanceAfterExpenses: incomeTotal - expensesTotal,
      incomes: incomesResult.rows,
      fixedExpenses,
      cardInvoices
    });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/incomes', requireRole('admin'), async (req, res) => {
  try {
    const body = incomeSchema.parse(req.body);
    const result = await pool.query(
      `INSERT INTO monthly_incomes (user_id, reference_month, description, amount, received_date, notes, created_by)
       VALUES ($1, TO_DATE($2, 'YYYY-MM'), $3, $4, $5, $6, $7)
       RETURNING id`,
      [body.userId, body.month, body.description, body.amount, body.receivedDate, body.notes ?? null, req.user?.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    sendError(res, error);
  }
});

router.delete('/incomes/:id', requireRole('admin'), async (req, res) => {
  await pool.query(`DELETE FROM monthly_incomes WHERE id = $1`, [req.params.id]);
  res.status(204).send();
});

router.post('/payments', requireRole('admin'), async (req, res) => {
  try {
    const body = paymentSchema.parse(req.body);
    await pool.query('BEGIN');
    if (body.expenseKind === 'fixed_expense') {
      await pool.query(
        `DELETE FROM monthly_expense_payments
         WHERE reference_month = TO_DATE($1, 'YYYY-MM')
           AND expense_kind = 'fixed_expense'
           AND fixed_expense_id = $2`,
        [body.month, body.fixedExpenseId]
      );
    } else {
      await pool.query(
        `DELETE FROM monthly_expense_payments
         WHERE reference_month = TO_DATE($1, 'YYYY-MM')
           AND expense_kind = 'card_invoice'
           AND card_id = $2`,
        [body.month, body.cardId]
      );
    }
    const result = await pool.query(
      `INSERT INTO monthly_expense_payments
       (reference_month, expense_kind, fixed_expense_id, card_id, amount, paid_date, notes, created_by)
       VALUES (TO_DATE($1, 'YYYY-MM'), $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        body.month,
        body.expenseKind,
        body.expenseKind === 'fixed_expense' ? body.fixedExpenseId : null,
        body.expenseKind === 'card_invoice' ? body.cardId : null,
        body.amount,
        body.paidDate,
        body.notes ?? null,
        req.user?.id
      ]
    );
    await pool.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await pool.query('ROLLBACK');
    sendError(res, error);
  }
});

router.delete('/payments/:id', requireRole('admin'), async (req, res) => {
  await pool.query(`DELETE FROM monthly_expense_payments WHERE id = $1`, [req.params.id]);
  res.status(204).send();
});

export default router;
