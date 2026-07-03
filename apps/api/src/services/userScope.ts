import { pool } from '../db/pool.js';

export async function getJointUserScope(userId?: string | null) {
  if (!userId) return null;

  const userResult = await pool.query<{ joint_account: boolean; card_buyer_only: boolean }>(
    `SELECT joint_account, card_buyer_only FROM users WHERE id = $1`,
    [userId]
  );
  const user = userResult.rows[0];
  if (!user) return [userId];
  if (user.card_buyer_only) return [userId];
  if (!user.joint_account) return [userId];

  const scopeResult = await pool.query<{ id: string }>(
    `SELECT id FROM users WHERE active = TRUE AND joint_account = TRUE ORDER BY name`
  );
  return scopeResult.rows.map((row) => row.id);
}

export async function isCardBuyerOnly(userId?: string | null) {
  if (!userId) return false;
  const result = await pool.query<{ card_buyer_only: boolean }>(
    `SELECT card_buyer_only FROM users WHERE id = $1`,
    [userId]
  );
  return result.rows[0]?.card_buyer_only ?? false;
}
