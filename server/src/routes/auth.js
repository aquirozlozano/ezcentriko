import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "../db.js";

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
  );
}

router.post("/register", async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const existing = await query("SELECT id FROM users WHERE email = $1", [email]);
  if (existing.rowCount > 0) {
    return res.status(409).json({ error: "Email already registered" });
  }

  const hash = await bcrypt.hash(password, 10);
  const result = await query(
    "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email",
    [name, email, hash]
  );

  const user = result.rows[0];
  const token = signToken(user);
  return res.json({ token, user });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const result = await query(
    "SELECT u.id, u.name, u.email, u.password_hash, u.company_id, c.company_name FROM users u JOIN companies c ON c.id = u.company_id WHERE u.email = $1",
    [email]
  );

  if (result.rowCount === 0) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const user = result.rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  await query(
    "INSERT INTO login_logs (company_id, user_id) VALUES ($1, $2)",
    [user.company_id, user.id]
  );

  const token = signToken(user);
  return res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      company_name: user.company_name
    }
  });
});

export default router;
