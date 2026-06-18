import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { sendError } from '../utils/http.js';

const router = Router();
router.use(requireAuth);

const querySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  userId: z.string().uuid().optional()
});

router.get('/monthly-installments', async (req, res) => {
  try {
    const query = querySchema.parse(req.query);
    const isAdmin = req.user?.role === 'admin';
    const targetUserId = isAdmin ? query.userId : req.user?.id;
    const targetMonth = query.month ?? new Date().toISOString().slice(0, 7);

    const result = await pool.query(
      `SELECT expense_id AS "expenseId",
              installment_number AS "installmentNumber",
              total_installments AS "totalInstallments",
              installment_amount AS "installmentAmount",
              TO_CHAR(reference_month, 'YYYY-MM-DD') AS "referenceMonth",
              TO_CHAR(invoice_month, 'YYYY-MM-DD') AS "invoiceMonth",
              TO_CHAR(payment_date, 'YYYY-MM-DD') AS "paymentDate",
              description,
              total_amount AS "totalAmount",
              TO_CHAR(purchase_date, 'YYYY-MM-DD') AS "purchaseDate",
              user_id AS "userId",
              user_name AS "userName",
              card_id AS "cardId",
              card_name AS "cardName",
              card_last_four AS "cardLastFour",
              category_id AS "categoryId",
              category_name AS "categoryName",
              category_color AS "categoryColor"
       FROM expense_installments
       WHERE reference_month = TO_DATE($1, 'YYYY-MM')
         AND ($2::uuid IS NULL OR user_id = $2)
       ORDER BY user_name, description, installment_number`,
      [targetMonth, targetUserId ?? null]
    );

    const total = result.rows.reduce((sum, row) => sum + Number(row.installmentAmount), 0);
    res.json({ month: targetMonth, total, items: result.rows });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/summary', async (req, res) => {
  const isAdmin = req.user?.role === 'admin';
  const result = await pool.query(
    `SELECT TO_CHAR(reference_month, 'YYYY-MM') AS month,
            user_id AS "userId",
            user_name AS "userName",
            SUM(installment_amount)::numeric(12,2) AS total
     FROM expense_installments
     WHERE ($1::boolean OR user_id = $2)
     GROUP BY reference_month, user_id, user_name
     ORDER BY month DESC, user_name`,
    [isAdmin, req.user?.id]
  );
  res.json(result.rows);
});

export default router;
