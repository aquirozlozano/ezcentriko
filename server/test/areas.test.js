import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import express from 'express';
import jwt from 'jsonwebtoken';

// Only a disposable test database is accepted. Never seed the production DB.
if (!process.env.TEST_DATABASE_URL || !new URL(process.env.TEST_DATABASE_URL).pathname.startsWith('/ezcentriko_areas_test_')) {
  throw new Error('TEST_DATABASE_URL debe apuntar a una base desechable ezcentriko_areas_test_*.');
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.JWT_SECRET = 'isolated-test-secret';
const { pool } = await import('../src/db.js');
const { default: areas } = await import('../src/routes/areas.js');
const { default: reports } = await import('../src/routes/reports.js');
const { default: powerbi } = await import('../src/routes/powerbi.js');
const { default: adminRoutes } = await import('../src/routes/admin.js');
const sql = await readFile(new URL('../sql/migrations/001_areas.sql', import.meta.url), 'utf8');

test('Áreas: migración, herencia, revocación y aislamiento entre empresas', async (t) => {
  let server;
  t.after(async () => { if (server) await new Promise(resolve => server.close(resolve)); await pool.end(); });
  await pool.query(`
    CREATE TABLE companies(id SERIAL PRIMARY KEY, company_name TEXT);
    CREATE TABLE roles(id SERIAL PRIMARY KEY, name TEXT);
    CREATE TABLE users(id SERIAL PRIMARY KEY, company_id INT REFERENCES companies(id), role_id INT REFERENCES roles(id), name TEXT, email TEXT);
    CREATE TABLE reports(id SERIAL PRIMARY KEY, company_id INT REFERENCES companies(id), name TEXT, embed_url TEXT);
    CREATE TABLE report_permissions(user_id INT REFERENCES users(id), report_id INT REFERENCES reports(id), PRIMARY KEY(user_id, report_id));
    INSERT INTO companies VALUES(1, 'A'), (2, 'B');
    INSERT INTO roles VALUES(1, 'administrador'), (2, 'visitante');
    INSERT INTO users(id,company_id,role_id,name) VALUES(1,1,1,'Admin A'), (2,1,2,'User A'), (3,2,1,'Admin B'), (4,2,2,'User B'), (5,1,2,'Unassigned');
    INSERT INTO reports VALUES(1,1,'Sales','https://app.powerbi.com/reportEmbed?reportId=test'), (2,1,'Stock',''), (3,2,'Secret','');
    INSERT INTO report_permissions VALUES(2,1), (4,3);
  `);
  await pool.query(sql);
  const before = await pool.query('SELECT id, area_id FROM users ORDER BY id');
  await pool.query(sql);
  assert.deepEqual((await pool.query('SELECT id, area_id FROM users ORDER BY id')).rows, before.rows, 'Migration is idempotent');

  const app = express(); app.use(express.json());
  app.use('/admin', areas); app.use('/admin', adminRoutes); app.use('/reports', reports); app.use('/powerbi', powerbi);
  app.use((err, req, res, next) => res.status(500).json({ error: err.message }));
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const tokens = Object.fromEntries([1,2,3,4,5].map(id => [id, jwt.sign({ id, role: 'administrador', company_id: 999 }, process.env.JWT_SECRET)]));
  async function call(user, method, path, data) {
    const response = await fetch(url + path, { method,
      headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${tokens[user]}` } : {}) },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
    return { status: response.status, body: await response.json() };
  }
  assert.equal((await call(null, 'GET', '/admin/areas')).status, 401);
  assert.deepEqual((await call(1, 'GET', '/admin/users')).body.users.map(u => u.id).sort(), [1,2,5]);
  assert.equal((await call(2, 'GET', '/admin/users')).status, 403);
  assert.equal((await call(2, 'POST', '/admin/areas', { name: 'No' })).status, 403, 'A forged role claim is ignored');
  assert.deepEqual((await call(2, 'GET', '/reports')).body.reports.map(r => r.id), [1], 'Legacy access preserved');
  assert.equal((await call(5, 'GET', '/reports')).body.reports.length, 0);
  assert.equal((await call(2, 'GET', '/powerbi/embed/2')).status, 404, 'No embed token without area permission');
  assert.equal((await call(1, 'GET', '/powerbi/embed/3')).status, 404, 'Admin cannot cross company boundary');
  assert.equal((await call(2, 'POST', '/reports', { name: 'Bypass', embedUrl: 'x' })).status, 403);
  assert.equal((await call(1, 'POST', '/admin/areas', { name: '   ' })).status, 400);
  const created = await call(1, 'POST', '/admin/areas', { name: ' Finanzas ' });
  assert.equal(created.status, 201); const areaId = created.body.area.id;
  assert.equal((await call(1, 'POST', '/admin/areas', { name: 'finanzas' })).status, 409);
  const other = (await call(3, 'POST', '/admin/areas', { name: 'Finanzas' })).body.area.id;
  assert.equal((await call(1, 'PUT', `/admin/areas/${other}`, { name: 'Stolen' })).status, 404);
  assert.equal((await call(1, 'PUT', `/admin/areas/${areaId}/reports`, { reportIds: [2,2] })).status, 200);
  assert.equal((await call(1, 'PUT', `/admin/areas/${areaId}/reports`, { reportIds: [1,3] })).status, 400);
  assert.deepEqual((await pool.query('SELECT report_id FROM area_reports WHERE area_id=$1', [areaId])).rows, [{ report_id: 2 }], 'Invalid batch rolls back');
  assert.equal((await call(1, 'PUT', `/admin/areas/${areaId}/reports`, { reportIds: ['bad'] })).status, 400);
  assert.equal((await call(1, 'PUT', '/admin/users/4/area', { areaId })).status, 404);
  assert.equal((await call(1, 'PUT', '/admin/users/2/area', { areaId: other })).status, 404);
  assert.equal((await call(1, 'PUT', '/admin/users/2/area', { areaId })).status, 200);
  assert.deepEqual((await call(2, 'GET', '/reports')).body.reports.map(r => r.id), [2], 'Existing session immediately inherits new area');
  assert.equal((await call(2, 'GET', '/powerbi/embed/2')).status, 400, 'Authorized embed reaches Power BI configuration validation');
  assert.equal((await call(2, 'GET', '/powerbi/embed/1')).status, 404);
  assert.equal((await call(1, 'PUT', '/admin/users/5/area', { areaId })).status, 200);
  assert.deepEqual((await call(5, 'GET', '/reports')).body.reports.map(r => r.id), [2], 'Members share area permissions');
  assert.equal((await call(1, 'PUT', `/admin/areas/${areaId}/reports`, { reportIds: [] })).status, 200);
  assert.equal((await call(2, 'GET', '/reports')).body.reports.length, 0, 'Revocation affects existing session');
  assert.equal((await call(1, 'PUT', '/admin/users/2/area', { areaId: null })).status, 200);
  assert.equal((await call(2, 'GET', '/reports')).body.reports.length, 0, 'No fallback to old per-user permissions');
  assert.equal((await call(1, 'GET', '/reports')).body.reports.length, 2);
  assert.equal((await call(1, 'PUT', '/admin/permissions/2', { reportIds: [1] })).status, 410);
  await assert.rejects(pool.query('UPDATE users SET area_id=$1 WHERE id=4', [areaId]), { code: '23503' });
  await assert.rejects(pool.query('INSERT INTO area_reports VALUES($1,3,1)', [areaId]), { code: '23503' });
});
