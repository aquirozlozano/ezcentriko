import express from "express";
import { query } from "../db.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

const router = express.Router();

const isCronValid = (value) => {
  if (typeof value !== "string") return false;
  const parts = value.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  return parts.every((part) => /^[\d*/,-]+$/.test(part));
};

router.get("/", requireAuth, requireAdmin, async (req, res) => {
  const result = await query(
    `SELECT o.id,
            o.name,
            o.destinations,
            o.cron,
            o.timezone,
            o.status,
            o.report_id,
            r.name AS report_name
     FROM orchestrations o
     JOIN reports r ON r.id = o.report_id
     WHERE o.user_id = $1
     ORDER BY o.created_at DESC`,
    [req.user.id]
  );

  return res.json({ orchestrations: result.rows });
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const { name, reportId, destinations, cron, timezone } = req.body || {};
  if (!name || !reportId || !destinations || !cron) {
    return res.status(400).json({ error: "Missing fields" });
  }
  if (!isCronValid(cron)) {
    return res.status(400).json({ error: "Invalid cron" });
  }

  const result = await query(
    `WITH selected_report AS (
       SELECT r.id AS report_id,
              r.name AS report_name,
              u.company_id,
              u.role_id,
              u.id AS user_id
       FROM reports r
       JOIN users u ON u.id = $6
       WHERE r.id = $1
         AND r.user_id = u.id
     ),
     inserted AS (
       INSERT INTO orchestrations
         (company_id, role_id, user_id, report_id, name, destinations, cron, timezone, status)
       SELECT company_id,
              role_id,
              user_id,
              report_id,
              $2,
              $3,
              $4,
              COALESCE($5, 'America/Lima'),
              'activo'
       FROM selected_report
       RETURNING *
     )
     SELECT inserted.id,
            inserted.name,
            inserted.destinations,
            inserted.cron,
            inserted.timezone,
            inserted.status,
            inserted.report_id,
            selected_report.report_name
     FROM inserted
     JOIN selected_report ON selected_report.report_id = inserted.report_id`,
    [reportId, name, destinations, cron, timezone, req.user.id]
  );

  if (!result.rows.length) {
    return res.status(404).json({ error: "Reporte no encontrado" });
  }

  return res.status(201).json({ orchestration: result.rows[0] });
});

router.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  const { name, cron } = req.body || {};
  if (!name && !cron) {
    return res.status(400).json({ error: "Missing fields" });
  }
  if (cron && !isCronValid(cron)) {
    return res.status(400).json({ error: "Invalid cron" });
  }

  const result = await query(
    `WITH updated AS (
       UPDATE orchestrations
       SET name = COALESCE($1, name),
           cron = COALESCE($2, cron),
           updated_at = NOW()
       WHERE id = $3
         AND user_id = $4
       RETURNING *
     )
     SELECT updated.id,
            updated.name,
            updated.destinations,
            updated.cron,
            updated.timezone,
            updated.status,
            updated.report_id,
            r.name AS report_name
     FROM updated
     JOIN reports r ON r.id = updated.report_id`,
    [name || null, cron || null, req.params.id, req.user.id]
  );

  if (!result.rows.length) {
    return res.status(404).json({ error: "Orquestacion no encontrada" });
  }

  return res.json({ orchestration: result.rows[0] });
});

router.put("/:id/destinations", requireAuth, requireAdmin, async (req, res) => {
  const { destinations } = req.body || {};
  if (!destinations) {
    return res.status(400).json({ error: "Missing destinations" });
  }

  const result = await query(
    `WITH updated AS (
       UPDATE orchestrations
       SET destinations = $1,
           updated_at = NOW()
       WHERE id = $2
         AND user_id = $3
       RETURNING *
     )
     SELECT updated.id,
            updated.name,
            updated.destinations,
            updated.cron,
            updated.timezone,
            updated.status,
            updated.report_id,
            r.name AS report_name
     FROM updated
     JOIN reports r ON r.id = updated.report_id`,
    [destinations, req.params.id, req.user.id]
  );

  if (!result.rows.length) {
    return res.status(404).json({ error: "Orquestacion no encontrada" });
  }

  return res.json({ orchestration: result.rows[0] });
});

router.put("/:id/status", requireAuth, requireAdmin, async (req, res) => {
  const { status } = req.body || {};
  if (!status || !["activo", "pausado"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const result = await query(
    `WITH updated AS (
       UPDATE orchestrations
       SET status = $1,
           updated_at = NOW()
       WHERE id = $2
         AND user_id = $3
       RETURNING *
     )
     SELECT updated.id,
            updated.name,
            updated.destinations,
            updated.cron,
            updated.timezone,
            updated.status,
            updated.report_id,
            r.name AS report_name
     FROM updated
     JOIN reports r ON r.id = updated.report_id`,
    [status, req.params.id, req.user.id]
  );

  if (!result.rows.length) {
    return res.status(404).json({ error: "Orquestacion no encontrada" });
  }

  return res.json({ orchestration: result.rows[0] });
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const result = await query(
    `DELETE FROM orchestrations
     WHERE id = $1
       AND user_id = $2
     RETURNING id`,
    [req.params.id, req.user.id]
  );

  if (!result.rows.length) {
    return res.status(404).json({ error: "Orquestacion no encontrada" });
  }

  return res.json({ ok: true });
});

export default router;
