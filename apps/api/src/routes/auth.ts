import { Router } from 'express';
import { z } from 'zod';
import { login } from '../services/authService.js';
import { sendError } from '../utils/http.js';
import { requireAuth } from '../middleware/auth.js';
import { pool } from '../db/pool.js';

const router = Router();
const loginSchema = z.object({
  email: z.string().trim().min(2),
  password: z.string().min(6)
});

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Autentica usuario por e-mail ou nome e senha
 */
router.post('/login', async (req, res) => {
  try {
    const body = loginSchema.parse(req.body);
    res.json(await login(body.email, body.password));
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, role, card_buyer_only AS "cardBuyerOnly"
       FROM users
       WHERE id = $1 AND active = TRUE`,
      [req.user?.id]
    );
    res.json(result.rows[0] ?? req.user);
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
