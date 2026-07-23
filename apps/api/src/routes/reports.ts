import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { getJointUserScope, isCardBuyerOnly } from '../services/userScope.js';
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
    const selectedUserCardBuyerOnly = isAdmin && query.userId ? await isCardBuyerOnly(query.userId) : false;
    const viewerCardBuyerOnly = selectedUserCardBuyerOnly || (!isAdmin && await isCardBuyerOnly(req.user?.id));
    const targetUserId = isAdmin ? query.userId : req.user?.id;
    const targetUserIds = targetUserId ? await getJointUserScope(targetUserId) : null;
    const targetMonth = query.month ?? new Date().toISOString().slice(0, 7);
    const targetCardId = query.cardId ?? null;

    const [cardsResult, fixedExpensesResult, userGroupsResult, paymentsResult] = await Promise.all([
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
                fe.recurring,
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
           AND (
             fe.recurring = TRUE
             OR DATE_TRUNC('month', fe.starts_on)::date = TO_DATE($1, 'YYYY-MM')
           )
           AND ($2::uuid[] IS NULL OR fe.user_id = ANY($2::uuid[]))
         ORDER BY fe.due_day, fe.description`,
        [targetMonth, targetUserIds]
      ),
      pool.query(
        `WITH groups AS (
           SELECT FALSE AS card_buyer_only, 'Compra no cartao'::text AS label
           UNION ALL
           SELECT TRUE AS card_buyer_only, 'Compras de terceiros'::text AS label
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
      ),
      pool.query(
        `SELECT ip.card_id AS "cardId",
                SUM(ip.amount)::numeric(12,2) AS total
         FROM invoice_payments ip
         JOIN cards c ON c.id = ip.card_id
         WHERE ip.reference_month = TO_DATE($1, 'YYYY-MM')
           AND ($2::uuid[] IS NULL OR c.owner_user_id = ANY($2::uuid[]))
           AND ($3::uuid IS NULL OR ip.card_id = $3)
         GROUP BY ip.card_id`,
        [targetMonth, targetUserIds, targetCardId]
      )
    ]);

    const visibleFixedExpenses = viewerCardBuyerOnly ? [] : fixedExpensesResult.rows;
    const fixedExpensesTotal = visibleFixedExpenses.reduce((sum, row) => sum + Number(row.amount), 0);
    const paymentsByCard = new Map(paymentsResult.rows.map((row) => [row.cardId, Number(row.total)]));
    const visibleCards = viewerCardBuyerOnly
      ? cardsResult.rows.map((card) => ({
          ...card,
          grossTotal: card.total,
          netTotal: card.total,
          invoicePaymentsTotal: '0.00',
          ownerName: null,
          ownerUserId: null,
          ownerUserName: null,
          ownerTotal: '0.00',
          ownerNetTotal: '0.00',
          ownerInstallments: 0,
          buyerTotal: card.total,
          buyerInstallments: card.installments
        }))
      : cardsResult.rows.map((card) => {
          const invoicePaymentsTotal = paymentsByCard.get(card.cardId) ?? 0;
          const ownerTotal = Number(card.ownerTotal);
          const grossTotal = Number(card.total);
          return {
            ...card,
            grossTotal: grossTotal.toFixed(2),
            invoicePaymentsTotal: invoicePaymentsTotal.toFixed(2),
            ownerNetTotal: (ownerTotal - invoicePaymentsTotal).toFixed(2),
            netTotal: (grossTotal - invoicePaymentsTotal).toFixed(2)
          };
        });
    const invoicePaymentsTotal = visibleCards.reduce((sum, row) => sum + Number(row.invoicePaymentsTotal ?? 0), 0);
    const grossCardsTotal = visibleCards.reduce(
      (sum, row) => sum + Number(viewerCardBuyerOnly ? row.total : row.ownerTotal),
      0
    );
    const cardsTotal = grossCardsTotal - invoicePaymentsTotal;
    const visibleUserGroups = userGroupsResult.rows.map((group) => {
      if (group.key !== 'owners') return group;
      const cardsTotal = Number(group.cardsTotal) - invoicePaymentsTotal;
      return {
        ...group,
        cardsTotal: cardsTotal.toFixed(2),
        grandTotal: cardsTotal.toFixed(2)
      };
    });

    res.json({
      month: targetMonth,
      cardsTotal,
      grossCardsTotal,
      invoicePaymentsTotal,
      fixedExpensesTotal,
      grandTotal: cardsTotal + fixedExpensesTotal,
      cards: visibleCards,
      fixedExpenses: visibleFixedExpenses,
      viewerCardBuyerOnly,
      userGroups: visibleUserGroups
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

router.get('/card-invoices', async (req, res) => {
  try {
    const query = querySchema.parse(req.query);
    const isAdmin = req.user?.role === 'admin';
    const viewerCardBuyerOnly = !isAdmin && await isCardBuyerOnly(req.user?.id);
    if (viewerCardBuyerOnly) {
      res.status(403).json({ message: 'Acesso restrito aos donos de cartao' });
      return;
    }

    const targetMonth = query.month ?? new Date().toISOString().slice(0, 7);
    const scopedUserIds = isAdmin ? null : await getJointUserScope(req.user?.id);

    const [cardsResult, installmentsResult] = await Promise.all([
      pool.query(
        `SELECT c.id AS "cardId",
                c.name AS "cardName",
                c.last_four AS "cardLastFour",
                c.owner_user_id AS "ownerUserId",
                owner.name AS "ownerUserName",
                c.due_day AS "dueDay",
                c.closing_day AS "closingDay"
         FROM cards c
         JOIN users owner ON owner.id = c.owner_user_id
         WHERE c.active = TRUE
           AND owner.card_buyer_only = FALSE
           AND ($1::uuid[] IS NULL OR c.owner_user_id = ANY($1::uuid[]))
         ORDER BY c.name, c.last_four`,
        [scopedUserIds]
      ),
      pool.query(
        `SELECT ei.expense_id AS "expenseId",
                ei.installment_number AS "installmentNumber",
                ei.total_installments AS "totalInstallments",
                ei.installment_amount AS "installmentAmount",
                TO_CHAR(ei.reference_month, 'YYYY-MM-DD') AS "referenceMonth",
                TO_CHAR(ei.invoice_month, 'YYYY-MM-DD') AS "invoiceMonth",
                TO_CHAR(ei.payment_date, 'YYYY-MM-DD') AS "paymentDate",
                ei.description,
                ei.expense_type AS "expenseType",
                ei.total_amount AS "totalAmount",
                TO_CHAR(ei.purchase_date, 'YYYY-MM-DD') AS "purchaseDate",
                ei.user_id AS "userId",
                ei.user_name AS "userName",
                ei.card_id AS "cardId",
                ei.card_name AS "cardName",
                ei.card_last_four AS "cardLastFour",
                ei.category_id AS "categoryId",
                ei.category_name AS "categoryName",
                ei.category_color AS "categoryColor"
         FROM expense_installments ei
         JOIN cards c ON c.id = ei.card_id
         JOIN users owner ON owner.id = c.owner_user_id
         WHERE ei.reference_month = TO_DATE($1, 'YYYY-MM')
           AND ei.user_id = c.owner_user_id
           AND owner.card_buyer_only = FALSE
           AND ($2::uuid[] IS NULL OR c.owner_user_id = ANY($2::uuid[]))
         ORDER BY ei.card_name, ei.purchase_date DESC, ei.description, ei.installment_number`,
        [targetMonth, scopedUserIds]
      )
    ]);

    const installmentsByCard = new Map<string, typeof installmentsResult.rows>();
    for (const installment of installmentsResult.rows) {
      const items = installmentsByCard.get(installment.cardId) ?? [];
      items.push(installment);
      installmentsByCard.set(installment.cardId, items);
    }

    const cards = cardsResult.rows.map((card) => {
      const items = installmentsByCard.get(card.cardId) ?? [];
      const oneTimeItems = items.filter((item) => Number(item.totalInstallments) === 1);
      const installmentItems = items.filter((item) => Number(item.totalInstallments) > 1);
      const total = items.reduce((sum, item) => sum + Number(item.installmentAmount), 0);
      const oneTimeTotal = oneTimeItems.reduce((sum, item) => sum + Number(item.installmentAmount), 0);
      const installmentTotal = installmentItems.reduce((sum, item) => sum + Number(item.installmentAmount), 0);

      return {
        ...card,
        total: total.toFixed(2),
        installments: items.length,
        oneTimeTotal: oneTimeTotal.toFixed(2),
        oneTimeCount: oneTimeItems.length,
        installmentTotal: installmentTotal.toFixed(2),
        installmentCount: installmentItems.length,
        items
      };
    });

    const grandTotal = cards.reduce((sum, card) => sum + Number(card.total), 0);
    res.json({ month: targetMonth, grandTotal, cards });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/installment-projection', async (req, res) => {
  try {
    const query = querySchema.parse(req.query);
    const isAdmin = req.user?.role === 'admin';
    const targetUserId = isAdmin ? query.userId : req.user?.id;
    const targetUserIds = targetUserId ? await getJointUserScope(targetUserId) : null;
    const includeBuyerOnlyCardData = !isAdmin || await isCardBuyerOnly(query.userId);
    const targetMonth = query.month ?? new Date().toISOString().slice(0, 7);
    const targetCardId = query.cardId ?? null;

    const [monthsResult, cardCategoriesResult, fixedCategoriesResult] = await Promise.all([
      pool.query(
        `WITH months AS (
           SELECT generate_series(
             (TO_DATE($1, 'YYYY-MM') - INTERVAL '6 months')::date,
             (TO_DATE($1, 'YYYY-MM') + INTERVAL '6 months')::date,
             INTERVAL '1 month'
           )::date AS reference_month
         ),
         card_totals AS (
           SELECT ei.reference_month,
                  SUM(ei.installment_amount)::numeric(12,2) AS total,
                  COUNT(*)::integer AS installments
           FROM expense_installments ei
           JOIN users buyer ON buyer.id = ei.user_id
           WHERE ei.reference_month BETWEEN (TO_DATE($1, 'YYYY-MM') - INTERVAL '6 months')::date
                                        AND (TO_DATE($1, 'YYYY-MM') + INTERVAL '6 months')::date
             AND ($4::boolean = TRUE OR buyer.card_buyer_only = FALSE)
             AND ($2::uuid[] IS NULL OR ei.user_id = ANY($2::uuid[]))
             AND ($3::uuid IS NULL OR ei.card_id = $3)
           GROUP BY ei.reference_month
         ),
         fixed_totals AS (
           SELECT m.reference_month,
                  SUM(fe.amount)::numeric(12,2) AS total,
                  COUNT(*)::integer AS expenses
           FROM months m
           JOIN fixed_expenses fe
             ON fe.active = TRUE
            AND fe.starts_on <= (m.reference_month + INTERVAL '1 month - 1 day')::date
            AND (
              fe.recurring = TRUE
              OR DATE_TRUNC('month', fe.starts_on)::date = m.reference_month
            )
           JOIN users fixed_user ON fixed_user.id = fe.user_id
           WHERE fixed_user.card_buyer_only = FALSE
             AND ($2::uuid[] IS NULL OR fe.user_id = ANY($2::uuid[]))
           GROUP BY m.reference_month
         )
         SELECT TO_CHAR(m.reference_month, 'YYYY-MM') AS month,
                COALESCE(ct.total, 0)::numeric(12,2) AS "cardTotal",
                COALESCE(ct.installments, 0)::integer AS "cardInstallments",
                COALESCE(ft.total, 0)::numeric(12,2) AS "fixedTotal",
                COALESCE(ft.expenses, 0)::integer AS "fixedExpenses",
                (COALESCE(ct.total, 0) + COALESCE(ft.total, 0))::numeric(12,2) AS total,
                (COALESCE(ct.installments, 0) + COALESCE(ft.expenses, 0))::integer AS installments
         FROM months m
         LEFT JOIN card_totals ct ON ct.reference_month = m.reference_month
         LEFT JOIN fixed_totals ft ON ft.reference_month = m.reference_month
         ORDER BY m.reference_month`,
        [targetMonth, targetUserIds, targetCardId, includeBuyerOnlyCardData]
      ),
      pool.query(
        `SELECT TO_CHAR(ei.reference_month, 'YYYY-MM') AS month,
                ei.category_id AS "categoryId",
                ei.category_name AS "categoryName",
                ei.category_color AS "categoryColor",
                SUM(ei.installment_amount)::numeric(12,2) AS total,
                COUNT(*)::integer AS installments
         FROM expense_installments ei
         JOIN users buyer ON buyer.id = ei.user_id
         WHERE ei.reference_month BETWEEN (TO_DATE($1, 'YYYY-MM') - INTERVAL '6 months')::date
                                      AND (TO_DATE($1, 'YYYY-MM') + INTERVAL '6 months')::date
           AND ($4::boolean = TRUE OR buyer.card_buyer_only = FALSE)
           AND ($2::uuid[] IS NULL OR ei.user_id = ANY($2::uuid[]))
           AND ($3::uuid IS NULL OR ei.card_id = $3)
         GROUP BY ei.reference_month, ei.category_id, ei.category_name, ei.category_color
         ORDER BY ei.reference_month, total DESC, ei.category_name`,
        [targetMonth, targetUserIds, targetCardId, includeBuyerOnlyCardData]
      ),
      pool.query(
        `WITH months AS (
           SELECT generate_series(
             (TO_DATE($1, 'YYYY-MM') - INTERVAL '6 months')::date,
             (TO_DATE($1, 'YYYY-MM') + INTERVAL '6 months')::date,
             INTERVAL '1 month'
           )::date AS reference_month
         )
         SELECT TO_CHAR(m.reference_month, 'YYYY-MM') AS month,
                cat.id AS "categoryId",
                cat.name AS "categoryName",
                cat.color AS "categoryColor",
                SUM(fe.amount)::numeric(12,2) AS total,
                COUNT(*)::integer AS installments
         FROM months m
         JOIN fixed_expenses fe
           ON fe.active = TRUE
          AND fe.starts_on <= (m.reference_month + INTERVAL '1 month - 1 day')::date
          AND (
            fe.recurring = TRUE
            OR DATE_TRUNC('month', fe.starts_on)::date = m.reference_month
          )
         JOIN users fixed_user ON fixed_user.id = fe.user_id
         JOIN categories cat ON cat.id = fe.category_id
         WHERE fixed_user.card_buyer_only = FALSE
           AND ($2::uuid[] IS NULL OR fe.user_id = ANY($2::uuid[]))
         GROUP BY m.reference_month, cat.id, cat.name, cat.color
         ORDER BY m.reference_month, total DESC, cat.name`,
        [targetMonth, targetUserIds]
      )
    ]);

    const cardCategoriesByMonth = new Map<string, typeof cardCategoriesResult.rows>();
    for (const category of cardCategoriesResult.rows) {
      const items = cardCategoriesByMonth.get(category.month) ?? [];
      items.push(category);
      cardCategoriesByMonth.set(category.month, items);
    }

    const fixedCategoriesByMonth = new Map<string, typeof fixedCategoriesResult.rows>();
    for (const category of fixedCategoriesResult.rows) {
      const items = fixedCategoriesByMonth.get(category.month) ?? [];
      items.push(category);
      fixedCategoriesByMonth.set(category.month, items);
    }

    const months = monthsResult.rows.map((month) => ({
      ...month,
      categories: cardCategoriesByMonth.get(month.month) ?? [],
      cardCategories: cardCategoriesByMonth.get(month.month) ?? [],
      fixedCategories: fixedCategoriesByMonth.get(month.month) ?? []
    }));

    const grandTotal = Number(months.reduce((sum, month) => sum + Number(month.total), 0).toFixed(2));
    const installments = months.reduce((sum, month) => sum + Number(month.installments), 0);
    const cardTotal = Number(months.reduce((sum, month) => sum + Number(month.cardTotal), 0).toFixed(2));
    const fixedTotal = Number(months.reduce((sum, month) => sum + Number(month.fixedTotal), 0).toFixed(2));
    const cardInstallments = months.reduce((sum, month) => sum + Number(month.cardInstallments), 0);
    const fixedExpenses = months.reduce((sum, month) => sum + Number(month.fixedExpenses), 0);

    res.json({
      startMonth: months[0]?.month ?? targetMonth,
      endMonth: months.at(-1)?.month ?? targetMonth,
      grandTotal,
      cardTotal,
      fixedTotal,
      installments,
      cardInstallments,
      fixedExpenses,
      months
    });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/summary', async (req, res) => {
  try {
    const query = querySchema.parse(req.query);
    const targetMonth = query.month ?? new Date().toISOString().slice(0, 7);
    const isAdmin = req.user?.role === 'admin';
    const scopedUserIds = isAdmin ? null : await getJointUserScope(req.user?.id);

    if (!isAdmin) {
      const result = await pool.query(
        `WITH months AS (
           SELECT generate_series(
             (TO_DATE($4, 'YYYY-MM') - INTERVAL '6 months')::date,
             (TO_DATE($4, 'YYYY-MM') + INTERVAL '6 months')::date,
             INTERVAL '1 month'
           )::date AS reference_month
         ),
         totals AS (
           SELECT ei.reference_month,
                  SUM(ei.installment_amount)::numeric(12,2) AS total,
                  COUNT(*)::integer AS installments
           FROM expense_installments ei
           JOIN users buyer ON buyer.id = ei.user_id
           WHERE ei.user_id = ANY($1::uuid[])
             AND ei.reference_month BETWEEN (TO_DATE($4, 'YYYY-MM') - INTERVAL '6 months')::date
                                        AND (TO_DATE($4, 'YYYY-MM') + INTERVAL '6 months')::date
           GROUP BY ei.reference_month
         )
         SELECT TO_CHAR(m.reference_month, 'YYYY-MM') AS month,
                $2::uuid AS "userId",
                $3::text AS "userName",
                COALESCE(t.total, 0)::numeric(12,2) AS total,
                COALESCE(t.installments, 0)::integer AS installments
         FROM months m
         LEFT JOIN totals t ON t.reference_month = m.reference_month
         ORDER BY month DESC`,
        [scopedUserIds, req.user?.id, req.user?.name, targetMonth]
      );
      res.json(result.rows);
      return;
    }

    const result = await pool.query(
      `SELECT TO_CHAR(ei.reference_month, 'YYYY-MM') AS month,
              ei.user_id AS "userId",
              ei.user_name AS "userName",
              SUM(ei.installment_amount)::numeric(12,2) AS total,
              COUNT(*)::integer AS installments
       FROM expense_installments ei
       JOIN users buyer ON buyer.id = ei.user_id
       WHERE ei.reference_month BETWEEN (TO_DATE($1, 'YYYY-MM') - INTERVAL '6 months')::date
                                    AND (TO_DATE($1, 'YYYY-MM') + INTERVAL '6 months')::date
         AND buyer.card_buyer_only = FALSE
       GROUP BY ei.reference_month, ei.user_id, ei.user_name
       ORDER BY month DESC, ei.user_name`,
      [targetMonth]
    );
    res.json(result.rows);
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
