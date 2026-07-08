import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendError } from '../utils/http.js';
import { getJointUserScope } from '../services/userScope.js';

const router = Router();
router.use(requireAuth);

const expenseSchema = z.object({
  description: z.string().min(2),
  totalAmount: z.number().positive(),
  installments: z.number().int().min(1).max(120),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expenseType: z.enum(['fixed', 'card', 'unplanned']).default('card'),
  recurring: z.boolean().default(false),
  userId: z.string().uuid(),
  cardId: z.string().uuid(),
  categoryId: z.string().uuid(),
  notes: z.string().optional().nullable()
});

const querySchema = z.object({
  userId: z.string().uuid().optional(),
  cardId: z.string().uuid().optional()
});

router.get('/', async (req, res) => {
  try {
    const query = querySchema.parse(req.query);
    const scopedUserIds = req.user?.role === 'admin' ? null : await getJointUserScope(req.user?.id);
    const result = await pool.query(
      `SELECT e.id, e.description, e.total_amount AS "totalAmount", e.installments,
              e.purchase_date AS "purchaseDate", e.expense_type AS "expenseType", e.recurring, e.notes,
              u.id AS "userId", u.name AS "userName",
              c.id AS "cardId", c.name AS "cardName",
              cat.id AS "categoryId", cat.name AS "categoryName"
       FROM expenses e
       JOIN users u ON u.id = e.user_id
       JOIN cards c ON c.id = e.card_id
       JOIN categories cat ON cat.id = e.category_id
       WHERE ($1::uuid[] IS NULL OR e.user_id = ANY($1::uuid[]))
         AND ($2::uuid IS NULL OR e.user_id = $2)
         AND ($3::uuid IS NULL OR e.card_id = $3)
       ORDER BY e.purchase_date DESC, e.created_at DESC`,
      [scopedUserIds, query.userId ?? null, query.cardId ?? null]
    );
    res.json(result.rows);
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const body = expenseSchema.parse(req.body);
    const result = await pool.query(
      `INSERT INTO expenses
       (description, total_amount, installments, purchase_date, expense_type, recurring, user_id, card_id, category_id, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        body.description,
        body.totalAmount,
        body.installments,
        body.purchaseDate,
        body.expenseType,
        body.recurring,
        body.userId,
        body.cardId,
        body.categoryId,
        body.notes,
        req.user?.id
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const body = expenseSchema.parse(req.body);
    const result = await pool.query(
      `UPDATE expenses
       SET description = $1, total_amount = $2, installments = $3, purchase_date = $4,
           expense_type = $5, recurring = $6, user_id = $7, card_id = $8, category_id = $9, notes = $10, updated_at = NOW()
       WHERE id = $11
       RETURNING id`,
      [
        body.description,
        body.totalAmount,
        body.installments,
        body.purchaseDate,
        body.expenseType,
        body.recurring,
        body.userId,
        body.cardId,
        body.categoryId,
        body.notes,
        req.params.id
      ]
    );
    res.json(result.rows[0]);
  } catch (error) {
    sendError(res, error);
  }
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  await pool.query(`DELETE FROM expenses WHERE id = $1`, [req.params.id]);
  res.status(204).send();
});

export default router;
