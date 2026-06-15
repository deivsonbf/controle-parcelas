import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(__dirname, '../../migrations');

async function migrate() {
  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();

  for (const file of files) {
    const sql = await readFile(resolve(migrationsDir, file), 'utf8');
    await pool.query(sql);
    console.log(`Migration applied: ${file}`);
  }

  console.log('Database migrated');
  await pool.end();
}

migrate().catch(async (error) => {
  console.error('Migration failed', error);
  await pool.end();
  process.exit(1);
});
