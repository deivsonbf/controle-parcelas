import { Router } from 'express';
import { z } from 'zod';
import { login } from '../services/authService.js';
import { sendError } from '../utils/http.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Autentica usuario por e-mail e senha
 */
router.post('/login', async (req, res) => {
  try {
    const body = loginSchema.parse(req.body);
    res.json(await login(body.email, body.password));
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json(req.user);
});

export default router;
