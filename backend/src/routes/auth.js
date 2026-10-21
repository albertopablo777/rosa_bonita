import { Router } from "express";
import bcrypt from "bcryptjs";
import Joi from "joi";
import rateLimit from "express-rate-limit";
import { pool } from "../db/pool.js";
import { signToken, requireAuth } from "../middlewares/auth.js";
import { HttpError } from "../utils/errors.js";
import { validate } from "../utils/validate.js";

const router = Router();

// Limita intentos para frenar fuerza bruta (por IP).
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Demasiados intentos. Espera unos minutos." },
});

export const PHONE_RE = /^\+?[0-9][0-9\s-]{6,18}$/;

const registerSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(60).required().label("El nombre"),
  lastName: Joi.string().trim().min(2).max(60).required().label("El apellido"),
  email: Joi.string().trim().lowercase().email().max(100).required().label("El correo"),
  password: Joi.string()
    .min(8)
    .max(72) // bcrypt solo usa los primeros 72 bytes
    .pattern(/[a-z]/, "una minúscula")
    .pattern(/[A-Z]/, "una mayúscula")
    .pattern(/[\d\W_]/, "un número o símbolo")
    .required()
    .label("La contraseña"),
  address: Joi.string().trim().max(200).allow("", null).label("La dirección"),
  phone: Joi.string().trim().pattern(PHONE_RE).allow("", null).label("El teléfono"),
});

const loginSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required().label("El correo"),
  password: Joi.string().max(72).required().label("La contraseña"),
});

// Hash falso para igualar el tiempo de respuesta cuando el correo no existe.
const DUMMY_HASH = bcrypt.hashSync("no-existe", 10);

const publicUser = (u) => ({
  id: u.id,
  firstName: u.firstName ?? u.first_name,
  lastName: u.lastName ?? u.last_name,
  email: u.email,
  role: u.role,
});

router.post("/register", limiter, async (req, res) => {
  const data = validate(registerSchema, req.body);

  const [exists] = await pool.query("SELECT id FROM users WHERE email = ?", [data.email]);
  if (exists.length) throw new HttpError(409, "Ese correo ya está registrado");

  const hash = await bcrypt.hash(data.password, 10);
  const [result] = await pool.query(
    "INSERT INTO users (first_name, last_name, email, password_hash, address, phone) VALUES (?, ?, ?, ?, ?, ?)",
    [data.firstName, data.lastName, data.email, hash, data.address || null, data.phone || null]
  );

  const user = { id: result.insertId, ...data, role: "customer" };
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

router.post("/login", limiter, async (req, res) => {
  const { email, password } = validate(loginSchema, req.body);

  const [rows] = await pool.query(
    "SELECT id, first_name, last_name, email, password_hash, role FROM users WHERE email = ?",
    [email]
  );
  const user = rows[0];
  const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !ok) throw new HttpError(401, "Correo o contraseña incorrectos");

  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

export default router;
