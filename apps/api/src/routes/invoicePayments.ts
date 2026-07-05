import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendError } from '../utils/http.js';

const router = Router();
router.use(requireAuth);

const querySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  cardId: z.string().uuid().optional()
});

const invoicePaymentSchema = z.object({
  cardId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  amount: z.number().positive(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional().nullable()
});

router.get('/', async (req, res) => {
  try {
    const query = querySchema.parse(req.query);
    const targetMonth = query.month ?? new Date().toISOString().slice(0, 7);
    const result = await pool.query(
      `SELECT ip.id,
              ip.card_id AS "cardId",
              c.name AS "cardName",
              c.last_four AS "cardLastFour",
              TO_CHAR(ip.reference_month, 'YYYY-MM') AS month,
              ip.amount,
              TO_CHAR(ip.payment_date, 'YYYY-MM-DD') AS "paymentDate",
              ip.notes
       FROM invoice_payments ip
       JOIN cards c ON c.id = ip.card_id
       WHERE ip.reference_month = TO_DATE($1, 'YYYY-MM')
         AND ($2::uuid IS NULL OR ip.card_id = $2)
       ORDER BY ip.payment_date DESC, ip.created_at DESC`,
      [targetMonth, query.cardId ?? null]
    );
    res.json(result.rows);
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const body = invoicePaymentSchema.parse(req.body);
    const result = await pool.query(
      `INSERT INTO invoice_payments (card_id, reference_month, amount, payment_date, notes, created_by)
       VALUES ($1, TO_DATE($2, 'YYYY-MM'), $3, $4, $5, $6)
       RETURNING id`,
      [body.cardId, body.month, body.amount, body.paymentDate, body.notes ?? null, req.user?.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    sendError(res, error);
  }
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  await pool.query(`DELETE FROM invoice_payments WHERE id = $1`, [req.params.id]);
  res.status(204).send();
});

export default router;
