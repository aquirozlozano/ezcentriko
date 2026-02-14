import express from "express";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  const isAdmin = req.user?.role === "administrador";
  const result = await query(
    isAdmin
      ? "SELECT id, name, embed_url FROM reports WHERE company_id = $1 ORDER BY name ASC"
      : `SELECT r.id, r.name, r.embed_url
         FROM reports r
         JOIN report_permissions rp ON rp.report_id = r.id
         WHERE rp.user_id = $1
         ORDER BY r.name ASC`,
    [isAdmin ? req.user.company_id : req.user.id]
  );
  return res.json({ reports: result.rows });
});

router.post("/", requireAuth, async (req, res) => {
  const { name, embedUrl } = req.body || {};
  if (!name || !embedUrl) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const result = await query(
    `INSERT INTO reports (company_id, role_id, user_id, name, embed_url)
     SELECT company_id, role_id, id, $1, $2 FROM users WHERE id = $3
     RETURNING id, name, embed_url`,
    [name, embedUrl, req.user.id]
  );

  await query(
    `INSERT INTO report_permissions (user_id, report_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [req.user.id, result.rows[0].id]
  );

  return res.status(201).json({ report: result.rows[0] });
});

export default router;
