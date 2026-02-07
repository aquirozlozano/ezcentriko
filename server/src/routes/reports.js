import express from "express";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  const result = await query(
    "SELECT id, name, embed_url FROM reports WHERE user_id = $1 ORDER BY name ASC",
    [req.user.id]
  );
  return res.json({ reports: result.rows });
});

router.post("/", requireAuth, async (req, res) => {
  const { name, embedUrl } = req.body || {};
  if (!name || !embedUrl) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const result = await query(
    `INSERT INTO reports (company_id, user_id, name, embed_url)
     SELECT company_id, id, $1, $2 FROM users WHERE id = $3
     RETURNING id, name, embed_url`,
    [name, embedUrl, req.user.id]
  );

  return res.status(201).json({ report: result.rows[0] });
});

export default router;
