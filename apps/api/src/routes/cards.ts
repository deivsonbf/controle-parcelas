import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendError } from '../utils/http.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

const cardSchema = z.object({
  name: z.string().min(2),
  lastFour: z.string().regex(/^[0-9]{4}$/),
  ownerName: z.string().min(2),
  ownerUserId: z.string().uuid().nullable().optional(),
  closingDay: z.number().int().min(1).max(31),
  dueDay: z.number().int().min(1).max(31),
  active: z.boolean().default(true)
});

router.get('/', async (_req, res) => {
  const result = await pool.query(
    `SELECT c.id,
            c.name,
            c.last_four AS "lastFour",
            c.owner_name AS "ownerName",
            c.owner_user_id AS "ownerUserId",
            u.name AS "ownerUserName",
            c.closing_day AS "closingDay",
            c.due_day AS "dueDay",
            c.active
     FROM cards c
     LEFT JOIN users u ON u.id = c.owner_user_id
     ORDER BY c.name`
  );
  res.json(result.rows);
});

router.post('/', async (req, res) => {
  try {
    const body = cardSchema.parse(req.body);
    const result = await pool.query(
      `INSERT INTO cards (name, last_four, owner_name, owner_user_id, closing_day, due_day, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, last_four AS "lastFour", owner_name AS "ownerName",
                 owner_user_id AS "ownerUserId", closing_day AS "closingDay", due_day AS "dueDay", active`,
      [body.name, body.lastFour, body.ownerName, body.ownerUserId ?? null, body.closingDay, body.dueDay, body.active]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/:id', async (req, res) => {
  try {
    const body = cardSchema.parse(req.body);
    const result = await pool.query(
      `UPDATE cards
       SET name = $1, last_four = $2, owner_name = $3, owner_user_id = $4, closing_day = $5, due_day = $6, active = $7
       WHERE id = $8
       RETURNING id, name, last_four AS "lastFour", owner_name AS "ownerName",
                 owner_user_id AS "ownerUserId", closing_day AS "closingDay", due_day AS "dueDay", active`,
      [body.name, body.lastFour, body.ownerName, body.ownerUserId ?? null, body.closingDay, body.dueDay, body.active, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
