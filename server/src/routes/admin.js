import express from "express";
import { query } from "../db.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

const router = express.Router();
router.use(requireAuth, requireAdmin);
router.get("/users", async (req, res, next) => {
  try {
    const result = await query(
      `SELECT u.id, u.name, u.email, u.area_id, a.name AS area_name, r.name AS role
       FROM users u JOIN roles r ON r.id = u.role_id
       LEFT JOIN areas a ON a.id = u.area_id AND a.company_id = u.company_id
       WHERE u.company_id = $1 ORDER BY u.name`, [req.user.company_id]);
    res.json({ users: result.rows });
  } catch (error) { next(error); }
});
router.get("/reports", async (req, res, next) => {
  try {
    const result = await query(
      "SELECT id, name FROM reports WHERE company_id = $1 ORDER BY name", [req.user.company_id]);
    res.json({ reports: result.rows });
  } catch (error) { next(error); }
});
export default router;
