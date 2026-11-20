import express from 'express';
import { pool, query } from '../db.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth, requireAdmin);
const validId = (value) => /^[1-9]\d*$/.test(String(value)) && Number(value) <= 2147483647;
const fail = (status, message) => Object.assign(new Error(message), { status });
const route = (handler) => async (req, res, next) => {
  try { await handler(req, res); } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Ya existe un área con ese nombre.' });
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
};
const areaName = (value) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 100) {
    throw fail(400, 'El nombre debe tener entre 1 y 100 caracteres.');
  }
  return value.trim();
};
async function transaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
async function ownedArea(client, req) {
  if (!validId(req.params.id)) throw fail(400, 'Área inválida.');
  const result = await client.query('SELECT id FROM areas WHERE id = $1 AND company_id = $2 FOR UPDATE',
    [req.params.id, req.user.company_id]);
  if (!result.rows.length) throw fail(404, 'Área no encontrada.');
}

router.get('/areas', route(async (req, res) => {
  const result = await query(`SELECT a.id, a.name,
    (SELECT count(*)::int FROM users u WHERE u.area_id = a.id) AS user_count,
    ARRAY(SELECT ar.report_id FROM area_reports ar WHERE ar.area_id = a.id ORDER BY ar.report_id) AS report_ids
    FROM areas a WHERE a.company_id = $1 ORDER BY a.name`, [req.user.company_id]);
  res.json({ areas: result.rows });
}));

router.post('/areas', route(async (req, res) => {
  const name = areaName(req.body?.name);
  const result = await query('INSERT INTO areas(company_id, name) VALUES ($1, $2) RETURNING id, name',
    [req.user.company_id, name]);
  res.status(201).json({ area: { ...result.rows[0], user_count: 0, report_ids: [] } });
}));

router.put('/areas/:id', route(async (req, res) => {
  const name = areaName(req.body?.name);
  if (!validId(req.params.id)) throw fail(400, 'Área inválida.');
  const result = await query('UPDATE areas SET name = $1 WHERE id = $2 AND company_id = $3 RETURNING id, name',
    [name, req.params.id, req.user.company_id]);
  if (!result.rows.length) throw fail(404, 'Área no encontrada.');
  res.json({ area: result.rows[0] });
}));

router.put('/areas/:id/reports', route(async (req, res) => {
  const ids = req.body?.reportIds;
  if (!Array.isArray(ids) || ids.length > 10000 || !ids.every(id => Number.isInteger(id) && validId(id))) {
    throw fail(400, 'Selecciona reportes válidos.');
  }
  const reportIds = [...new Set(ids)];
  await transaction(async (client) => {
    await ownedArea(client, req);
    const allowed = await client.query('SELECT id FROM reports WHERE company_id = $1 AND id = ANY($2::int[]) FOR SHARE',
      [req.user.company_id, reportIds]);
    if (allowed.rows.length !== reportIds.length) throw fail(400, 'Los reportes deben pertenecer a tu empresa.');
    await client.query('DELETE FROM area_reports WHERE area_id = $1', [req.params.id]);
    await client.query(`INSERT INTO area_reports(area_id, report_id, company_id)
      SELECT $1, id, company_id FROM reports WHERE company_id = $2 AND id = ANY($3::int[])`,
      [req.params.id, req.user.company_id, reportIds]);
  });
  res.json({ ok: true });
}));

router.put('/users/:userId/area', route(async (req, res) => {
  const areaId = req.body?.areaId;
  if (!validId(req.params.userId) || (areaId !== null && (!Number.isInteger(areaId) || !validId(areaId)))) {
    throw fail(400, 'Usuario o área inválidos.');
  }
  await transaction(async (client) => {
    const member = await client.query('SELECT id FROM users WHERE id = $1 AND company_id = $2 FOR UPDATE',
      [req.params.userId, req.user.company_id]);
    if (!member.rows.length) throw fail(404, 'Usuario no encontrado.');
    if (areaId !== null) {
      const area = await client.query('SELECT id FROM areas WHERE id = $1 AND company_id = $2 FOR SHARE',
        [areaId, req.user.company_id]);
      if (!area.rows.length) throw fail(404, 'Área no encontrada.');
    }
    await client.query('UPDATE users SET area_id = $1 WHERE id = $2', [areaId, req.params.userId]);
  });
  res.json({ ok: true });
}));

// Old clients must not change dormant per-user permissions after migration.
router.all('/permissions/:userId', (req, res) => {
  res.status(410).json({ error: 'Los permisos ahora se administran por área. Recarga la plataforma.' });
});
export default router;
