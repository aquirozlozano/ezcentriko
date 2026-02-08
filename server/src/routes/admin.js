import express from "express";
import { query } from "../db.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/users", requireAuth, requireAdmin, async (req, res) => {
  const result = await query(
    `SELECT u.id, u.name, u.email, r.name AS role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.company_id = $1
     ORDER BY u.name ASC`,
    [req.user.company_id]
  );

  return res.json({ users: result.rows });
});

router.get("/reports", requireAuth, requireAdmin, async (req, res) => {
  const result = await query(
    `SELECT id, name
     FROM reports
     WHERE company_id = $1
     ORDER BY name ASC`,
    [req.user.company_id]
  );

  return res.json({ reports: result.rows });
});

router.get("/permissions/:userId", requireAuth, requireAdmin, async (req, res) => {
  const result = await query(
    `SELECT rp.report_id
     FROM report_permissions rp
     JOIN users u ON u.id = rp.user_id
     WHERE rp.user_id = $1
       AND u.company_id = $2`,
    [req.params.userId, req.user.company_id]
  );

  return res.json({ reportIds: result.rows.map((row) => row.report_id) });
});

router.put("/permissions/:userId", requireAuth, requireAdmin, async (req, res) => {
  const { reportIds } = req.body || {};
  if (!Array.isArray(reportIds)) {
    return res.status(400).json({ error: "Missing fields" });
  }

  await query(
    `DELETE FROM report_permissions rp
     USING users u
     WHERE rp.user_id = u.id
       AND u.id = $1
       AND u.company_id = $2`,
    [req.params.userId, req.user.company_id]
  );

  if (reportIds.length) {
    await query(
      `INSERT INTO report_permissions (user_id, report_id)
       SELECT $1, r.id
       FROM reports r
       WHERE r.company_id = $2
         AND r.id = ANY($3::int[])
       ON CONFLICT DO NOTHING`,
      [req.params.userId, req.user.company_id, reportIds]
    );
  }

  return res.json({ ok: true });
});

export default router;
