import { Router } from "express";
import Joi from "joi";
import rateLimit from "express-rate-limit";
import { pool } from "../db/pool.js";
import { validate } from "../utils/validate.js";
import { PHONE_RE } from "./auth.js";

const router = Router();

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Has enviado muchos mensajes. Inténtalo más tarde." },
});

const contactSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required().label("El nombre"),
  email: Joi.string().trim().email().max(100).allow("", null).label("El correo"),
  phone: Joi.string().trim().pattern(PHONE_RE).allow("", null).label("El teléfono"),
  message: Joi.string().trim().min(5).max(2000).required().label("El mensaje"),
});

router.post("/", limiter, async (req, res) => {
  const d = validate(contactSchema, req.body);
  await pool.query("INSERT INTO contact_messages (name, email, phone, message) VALUES (?, ?, ?, ?)", [
    d.name,
    d.email || null,
    d.phone || null,
    d.message,
  ]);
  res.status(201).json({ message: "Mensaje enviado" });
});

export default router;
