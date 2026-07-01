import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { getJointUserScope } from '../services/userScope.js';
import { sendError } from '../utils/http.js';

const router = Router();
router.use(requireAuth);

const querySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  userId: z.string().uuid().optional(),
  cardId: z.string().uuid().optional()
});

router.get('/dashboard', async (req, res) => {
  try {
    const query = querySchema.parse(req.query);
    const isAdmin = req.user?.role === 'admin';
    const targetUserId = isAdmin ? query.userId : req.user?.id;
    const targetUserIds = targetUserId ? await getJointUserScope(targetUserId) : null;
    const targetMonth = query.month ?? new Date().toISOString().slice(0, 7);
    const targetCardId = query.cardId ?? null;

    const [cardsResult, fixedExpensesResult, userGroupsResult] = await Promise.all([
      pool.query(
        `SELECT ei.card_id AS "cardId",
                ei.card_name AS "cardName",
                ei.card_last_four AS "cardLastFour",
                c.owner_name AS "ownerName",
                c.owner_user_id AS "ownerUserId",
                owner.name AS "ownerUserName",
                SUM(ei.installment_amount)::numeric(12,2) AS total,
                COUNT(*)::integer AS installments,
                SUM(CASE WHEN c.owner_user_id IS NOT NULL AND ei.user_id = c.owner_user_id THEN ei.installment_amount ELSE 0 END)::numeric(12,2) AS "ownerTotal",
                COUNT(*) FILTER (WHERE c.owner_user_id IS NOT NULL AND ei.user_id = c.owner_user_id)::integer AS "ownerInstallments",
                SUM(CASE WHEN c.owner_user_id IS NULL OR ei.user_id <> c.owner_user_id THEN ei.installment_amount ELSE 0 END)::numeric(12,2) AS "buyerTotal",
                COUNT(*) FILTER (WHERE c.owner_user_id IS NULL OR ei.user_id <> c.owner_user_id)::integer AS "buyerInstallments"
         FROM expense_installments ei
         JOIN cards c ON c.id = ei.card_id
         LEFT JOIN users owner ON owner.id = c.owner_user_id
         WHERE ei.reference_month = TO_DATE($1, 'YYYY-MM')
           AND ($2::uuid[] IS NULL OR ei.user_id = ANY($2::uuid[]))
           AND ($3::uuid IS NULL OR ei.card_id = $3)
         GROUP BY ei.card_id, ei.card_name, ei.card_last_four, c.owner_name, c.owner_user_id, owner.name
         ORDER BY total DESC, ei.card_name`,
        [targetMonth, targetUserIds, targetCardId]
      ),
      pool.query(
        `SELECT fe.id,
                fe.description,
                fe.amount,
                fe.due_day AS "dueDay",
                TO_CHAR(fe.starts_on, 'YYYY-MM-DD') AS "startsOn",
                fe.active,
                u.id AS "userId",
                u.name AS "userName",
                cat.id AS "categoryId",
                cat.name AS "categoryName",
                cat.color AS "categoryColor"
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
        `WITH groups AS (
           SELECT FALSE AS card_buyer_only, 'Donos do cartao'::text AS label
           UNION ALL
           SELECT TRUE AS card_buyer_only, 'Utilizadores do cartao'::text AS label
         ),
         users_by_group AS (
           SELECT card_buyer_only, COUNT(*)::integer AS users
           FROM users
           WHERE active = TRUE
             AND ($2::uuid[] IS NULL OR id = ANY($2::uuid[]))
           GROUP BY card_buyer_only
         ),
         cards_by_group AS (
           SELECT CASE
                    WHEN c.owner_user_id IS NOT NULL AND ei.user_id = c.owner_user_id THEN FALSE
                    ELSE TRUE
                  END AS card_buyer_only,
                  SUM(ei.installment_amount)::numeric(12,2) AS total
           FROM expense_installments ei
           JOIN cards c ON c.id = ei.card_id
           WHERE ei.reference_month = TO_DATE($1, 'YYYY-MM')
             AND ($2::uuid[] IS NULL OR ei.user_id = ANY($2::uuid[]))
             AND ($3::uuid IS NULL OR ei.card_id = $3)
           GROUP BY CASE
                      WHEN c.owner_user_id IS NOT NULL AND ei.user_id = c.owner_user_id THEN FALSE
                      ELSE TRUE
                    END
         )
         SELECT CASE WHEN g.card_buyer_only THEN 'buyers' ELSE 'owners' END AS key,
                g.label,
                COALESCE(ubg.users, 0)::integer AS users,
                COALESCE(cbg.total, 0)::numeric(12,2) AS "cardsTotal",
                0::numeric(12,2) AS "fixedExpensesTotal",
                COALESCE(cbg.total, 0)::numeric(12,2) AS "grandTotal"
         FROM groups g
         LEFT JOIN users_by_group ubg ON ubg.card_buyer_only = g.card_buyer_only
         LEFT JOIN cards_by_group cbg ON cbg.card_buyer_only = g.card_buyer_only
         ORDER BY g.card_buyer_only`,
        [targetMonth, targetUserIds, targetCardId]
      )
    ]);

    const cardsTotal = cardsResult.rows.reduce((sum, row) => sum + Number(row.total), 0);
    const fixedExpensesTotal = fixedExpensesResult.rows.reduce((sum, row) => sum + Number(row.amount), 0);

    res.json({
      month: targetMonth,
      cardsTotal,
      fixedExpensesTotal,
      grandTotal: cardsTotal + fixedExpensesTotal,
      cards: cardsResult.rows,
      fixedExpenses: fixedExpensesResult.rows,
      userGroups: userGroupsResult.rows
    });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/monthly-installments', async (req, res) => {
  try {
    const query = querySchema.parse(req.query);
    const isAdmin = req.user?.role === 'admin';
    const targetUserId = isAdmin ? query.userId : req.user?.id;
    const targetUserIds = targetUserId ? await getJointUserScope(targetUserId) : null;
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
              expense_type AS "expenseType",
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
         AND ($2::uuid[] IS NULL OR user_id = ANY($2::uuid[]))
       ORDER BY purchase_date DESC, description, installment_number`,
      [targetMonth, targetUserIds]
    );

    const total = result.rows.reduce((sum, row) => sum + Number(row.installmentAmount), 0);
    res.json({ month: targetMonth, total, items: result.rows });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/summary', async (req, res) => {
  const isAdmin = req.user?.role === 'admin';
  const scopedUserIds = isAdmin ? null : await getJointUserScope(req.user?.id);

  if (!isAdmin) {
    const result = await pool.query(
      `SELECT TO_CHAR(reference_month, 'YYYY-MM') AS month,
              $2::uuid AS "userId",
              $3::text AS "userName",
              SUM(installment_amount)::numeric(12,2) AS total
       FROM expense_installments
       WHERE user_id = ANY($1::uuid[])
       GROUP BY reference_month
       ORDER BY month DESC`,
      [scopedUserIds, req.user?.id, req.user?.name]
    );
    res.json(result.rows);
    return;
  }

  const result = await pool.query(
    `SELECT TO_CHAR(reference_month, 'YYYY-MM') AS month,
            user_id AS "userId",
            user_name AS "userName",
            SUM(installment_amount)::numeric(12,2) AS total
     FROM expense_installments
     GROUP BY reference_month, user_id, user_name
     ORDER BY month DESC, user_name`
  );
  res.json(result.rows);
});

export default router;
