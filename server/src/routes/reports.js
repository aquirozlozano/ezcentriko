import express from "express";
import { query } from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { reportAccess, accessParams } from "../report-access.js";

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT r.id, r.name, r.embed_url FROM reports r WHERE ${reportAccess} ORDER BY r.name`,
      accessParams(req.user)
    );
    return res.json({ reports: result.rows });
  } catch (error) { return res.status(500).json({ error: "No se pudieron cargar los reportes" }); }
});

router.post("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
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

  return res.status(201).json({ report: result.rows[0] });
  } catch (error) { next(error); }
});

export default router;
