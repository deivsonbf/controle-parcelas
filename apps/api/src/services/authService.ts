import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';
import { pool } from '../db/pool.js';
import type { AuthUser } from '../types.js';
import { HttpError } from '../utils/http.js';
import { comparePassword } from '../utils/password.js';

type UserRow = AuthUser & {
  password_hash: string;
  active: boolean;
};

export async function login(identifier: string, password: string) {
  const normalizedIdentifier = identifier.trim().toLowerCase();
  const result = await pool.query<UserRow>(
    `SELECT id, name, email, role, card_buyer_only AS "cardBuyerOnly", password_hash, active
     FROM users
     WHERE LOWER(email) = $1 OR LOWER(name) = $1
     ORDER BY active DESC, created_at
     LIMIT 1`,
    [normalizedIdentifier]
  );
  const user = result.rows[0];

  if (!user || !user.active || !(await comparePassword(password, user.password_hash))) {
    throw new HttpError(401, 'E-mail ou senha invalidos');
  }

  const payload: AuthUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    cardBuyerOnly: user.cardBuyerOnly
  };

  const token = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn']
  });
  return { token, user: payload };
}
