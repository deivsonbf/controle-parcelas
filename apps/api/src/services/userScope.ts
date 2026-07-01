import { pool } from '../db/pool.js';

export async function getJointUserScope(userId?: string | null) {
  if (!userId) return null;

  const userResult = await pool.query<{ joint_account: boolean }>(
    `SELECT joint_account FROM users WHERE id = $1`,
    [userId]
  );
  const user = userResult.rows[0];
  if (!user) return [userId];
  if (!user.joint_account) return [userId];

  const scopeResult = await pool.query<{ id: string }>(
    `SELECT id FROM users WHERE active = TRUE AND joint_account = TRUE ORDER BY name`
  );
  return scopeResult.rows.map((row) => row.id);
}
