import { readFile } from 'node:fs/promises';
import { pool } from '../src/db.js';
try {
  const sql = await readFile(new URL('../sql/migrations/001_areas.sql', import.meta.url), 'utf8');
  await pool.query(sql);
  console.log('Migración de áreas aplicada.');
} finally {
  await pool.end();
}
