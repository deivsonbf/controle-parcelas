import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendError } from '../utils/http.js';
import { hashPassword } from '../utils/password.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

const userSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8).optional(),
  role: z.enum(['admin', 'user']).default('user'),
  active: z.boolean().default(true),
  cardBuyerOnly: z.boolean().default(false)
});

router.get('/', async (_req, res) => {
  const result = await pool.query(
    `SELECT id,
            name,
            email,
            role,
            active,
            card_buyer_only AS "cardBuyerOnly",
            created_at
     FROM users
     ORDER BY name`
  );
  res.json(result.rows);
});

router.post('/', async (req, res) => {
  try {
    const body = userSchema.extend({ password: z.string().min(8) }).parse(req.body);
    const passwordHash = await hashPassword(body.password);
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, active, card_buyer_only)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, role, active, card_buyer_only AS "cardBuyerOnly", created_at`,
      [body.name, body.email.toLowerCase(), passwordHash, body.role, body.active, body.cardBuyerOnly]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/:id', async (req, res) => {
  try {
    const body = userSchema.parse(req.body);
    const passwordHash = body.password ? await hashPassword(body.password) : null;
    const result = await pool.query(
      `UPDATE users
       SET name = $1,
           email = $2,
           role = $3,
           active = $4,
           card_buyer_only = $5,
           password_hash = COALESCE($6, password_hash),
           updated_at = NOW()
       WHERE id = $7
       RETURNING id, name, email, role, active, card_buyer_only AS "cardBuyerOnly", created_at`,
      [body.name, body.email.toLowerCase(), body.role, body.active, body.cardBuyerOnly, passwordHash, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
