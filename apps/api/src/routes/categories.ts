import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendError } from '../utils/http.js';

const router = Router();
router.use(requireAuth);

const categorySchema = z.object({
  name: z.string().min(2),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/)
});

router.get('/', async (_req, res) => {
  const result = await pool.query(`SELECT id, name, color FROM categories ORDER BY name`);
  res.json(result.rows);
});

router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const body = categorySchema.parse(req.body);
    const result = await pool.query(
      `INSERT INTO categories (name, color) VALUES ($1, $2)
       RETURNING id, name, color`,
      [body.name, body.color]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const body = categorySchema.parse(req.body);
    const result = await pool.query(
      `UPDATE categories SET name = $1, color = $2 WHERE id = $3 RETURNING id, name, color`,
      [body.name, body.color, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
