import express from "express";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  const result = await query(
    "SELECT id, report_id, name, embed_url FROM reports ORDER BY name ASC"
  );
  return res.json({ reports: result.rows });
});

router.post("/", requireAuth, async (req, res) => {
  const { reportId, name, embedUrl } = req.body || {};
  if (!reportId || !name || !embedUrl) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const result = await query(
    "INSERT INTO reports (report_id, name, embed_url) VALUES ($1, $2, $3) RETURNING id, report_id, name, embed_url",
    [reportId, name, embedUrl]
  );

  return res.status(201).json({ report: result.rows[0] });
});

export default router;
