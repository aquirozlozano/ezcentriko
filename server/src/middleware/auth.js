import jwt from "jsonwebtoken";
import { query } from "../db.js";

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
  try {
    const result = await query(`SELECT u.id, u.company_id, u.area_id, r.name AS role
      FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`, [payload.id]);
    if (!result.rows.length) return res.status(401).json({ error: "Invalid token" });
    req.user = result.rows[0];
    return next();
  } catch (error) { return next(error); }
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "administrador") {
    return res.status(403).json({ error: "Forbidden" });
  }
  return next();
}
