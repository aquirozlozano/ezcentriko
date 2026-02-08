import express from "express";
import { query } from "../db.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/", requireAuth, requireAdmin, async (req, res) => {
  const result = await query(
    `SELECT ll.id,
            ll.logged_in_at AS occurred_at,
            u.email AS user_email
     FROM login_logs ll
     JOIN users u ON u.id = ll.user_id
     WHERE ll.company_id = $1
     ORDER BY ll.logged_in_at DESC
     LIMIT 200`,
    [req.user.company_id]
  );

  return res.json({ history: result.rows });
});

export default router;
