import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { pool } from "../db/pool.js";
import { HttpError } from "../utils/errors.js";

export function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

async function loadUser(req) {
  const header = req.headers.authorization;
  if (!header) return null;
  if (!header.startsWith("Bearer ")) throw new HttpError(401, "Formato de token no válido");

  let payload;
  try {
    payload = jwt.verify(header.slice(7), config.jwtSecret);
  } catch {
    throw new HttpError(401, "Sesión inválida o vencida");
  }

  // Se consulta la BD para respetar cambios de rol o usuarios eliminados.
  const [rows] = await pool.query(
    "SELECT id, first_name AS firstName, last_name AS lastName, email, role FROM users WHERE id = ?",
    [payload.id]
  );
  if (rows.length === 0) throw new HttpError(401, "Usuario no encontrado");
  return rows[0];
}

export async function requireAuth(req, res, next) {
  const user = await loadUser(req);
  if (!user) throw new HttpError(401, "Debes iniciar sesión");
  req.user = user;
  next();
}

export async function optionalAuth(req, res, next) {
  req.user = (await loadUser(req)) || null;
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") throw new HttpError(403, "No tienes permiso para esta acción");
  next();
}
