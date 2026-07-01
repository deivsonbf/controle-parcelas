import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendError } from '../utils/http.js';
import { getJointUserScope } from '../services/userScope.js';

const router = Router();
router.use(requireAuth);

const fixedExpenseSchema = z.object({
  description: z.string().min(2),
  amount: z.number().positive(),
  dueDay: z.number().int().min(1).max(31),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  active: z.boolean().default(true),
  userId: z.string().uuid(),
  categoryId: z.string().uuid(),
  notes: z.string().optional().nullable()
});

router.get('/', async (req, res) => {
  const scopedUserIds = req.user?.role === 'admin' ? null : await getJointUserScope(req.user?.id);
  const result = await pool.query(
    `SELECT fe.id,
            fe.description,
            fe.amount,
            fe.due_day AS "dueDay",
            TO_CHAR(fe.starts_on, 'YYYY-MM-DD') AS "startsOn",
            fe.active,
            fe.notes,
            u.id AS "userId",
            u.name AS "userName",
            cat.id AS "categoryId",
            cat.name AS "categoryName",
            cat.color AS "categoryColor"
     FROM fixed_expenses fe
     JOIN users u ON u.id = fe.user_id
     JOIN categories cat ON cat.id = fe.category_id
     WHERE ($1::uuid[] IS NULL OR fe.user_id = ANY($1::uuid[]))
     ORDER BY fe.active DESC, fe.due_day, fe.description`,
    [scopedUserIds]
  );
  res.json(result.rows);
});

router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const body = fixedExpenseSchema.parse(req.body);
    const result = await pool.query(
      `INSERT INTO fixed_expenses
       (description, amount, due_day, starts_on, active, user_id, category_id, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        body.description,
        body.amount,
        body.dueDay,
        body.startsOn,
        body.active,
        body.userId,
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
    const body = fixedExpenseSchema.parse(req.body);
    const result = await pool.query(
      `UPDATE fixed_expenses
       SET description = $1,
           amount = $2,
           due_day = $3,
           starts_on = $4,
           active = $5,
           user_id = $6,
           category_id = $7,
           notes = $8,
           updated_at = NOW()
       WHERE id = $9
       RETURNING id`,
      [
        body.description,
        body.amount,
        body.dueDay,
        body.startsOn,
        body.active,
        body.userId,
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
  await pool.query(`DELETE FROM fixed_expenses WHERE id = $1`, [req.params.id]);
  res.status(204).send();
});

export default router;
