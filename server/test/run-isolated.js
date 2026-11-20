import 'dotenv/config';
import pg from 'pg';
import { spawnSync } from 'node:child_process';
// Create an isolated database using the configured PostgreSQL connection.
// Requires CREATEDB privilege; no production tables are read or changed.
const name = `ezcentriko_areas_test_${Date.now()}`;
const admin = new pg.Client({ connectionString: process.env.DATABASE_URL });
await admin.connect();
let created = false;
try {
  await admin.query(`CREATE DATABASE "${name}"`); created = true;
  const url = new URL(process.env.DATABASE_URL); url.pathname = `/${name}`;
  const result = spawnSync(process.execPath, ['--test', new URL('./areas.test.js', import.meta.url).pathname], {
    env: { ...process.env, TEST_DATABASE_URL: url.href }, stdio: 'inherit'
  });
  process.exitCode = result.status ?? 1;
} finally {
  if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
  await admin.end();
}
