import { hashPassword } from '../utils/password.js';
import { pool } from './pool.js';

async function seed() {
  const passwordHash = await hashPassword('Admin@123456');
  await pool.query(
    `UPDATE users SET password_hash = $1 WHERE email = $2`,
    [passwordHash, 'admin@example.com']
  );
  console.log('Seed completed. Admin: admin@example.com / Admin@123456');
  await pool.end();
}

seed().catch(async (error) => {
  console.error('Seed failed', error);
  await pool.end();
  process.exit(1);
});
