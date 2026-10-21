import { Router } from "express";
import Joi from "joi";
import { pool } from "../db/pool.js";
import { optionalAuth, requireAuth } from "../middlewares/auth.js";
import { HttpError } from "../utils/errors.js";
import { validate } from "../utils/validate.js";
import { FINAL_PRICE_SQL } from "../utils/sql.js";
import { PHONE_RE } from "./auth.js";

const router = Router();

const orderSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(60).required().label("El nombre"),
  lastName: Joi.string().trim().min(2).max(60).required().label("El apellido"),
  email: Joi.string().trim().lowercase().email().max(100).required().label("El correo"),
  phone: Joi.string().trim().pattern(PHONE_RE).required().label("El teléfono"),
  city: Joi.string().trim().min(2).max(80).required().label("La ciudad"),
  deliveryDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .allow("", null)
    .label("La fecha de entrega"),
  notes: Joi.string().trim().max(500).allow("", null).label("Las notas"),
  items: Joi.array()
    .items(
      Joi.object({
        productId: Joi.number().integer().min(1).required().label("El producto"),
        quantity: Joi.number().integer().min(1).max(50).required().label("La cantidad"),
      })
    )
    .min(1)
    .max(50)
    .required()
    .label("El pedido"),
});

// Convierte "YYYY-MM-DD" valido y no pasado (con 1 dia de margen por zonas horarias).
function checkDeliveryDate(value) {
  if (!value) return null;
  const valid = !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);
  if (!valid) throw new HttpError(400, "La fecha de entrega no es válida");
  const minDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  if (value < minDate) throw new HttpError(400, "La fecha de entrega no puede ser anterior a hoy");
  return value;
}

// POST /api/orders  (con o sin sesion iniciada)
router.post("/", optionalAuth, async (req, res) => {
  const data = validate(orderSchema, req.body);
  const deliveryDate = checkDeliveryDate(data.deliveryDate);

  // Unir lineas repetidas del mismo producto.
  const wanted = new Map();
  for (const { productId, quantity } of data.items) {
    wanted.set(productId, (wanted.get(productId) || 0) + quantity);
  }
  const ids = [...wanted.keys()].sort((a, b) => a - b);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Bloquea las filas para que dos pedidos simultaneos no vendan el mismo stock.
    const [products] = await conn.query(
      `SELECT id, name, stock, is_active, ${FINAL_PRICE_SQL} AS unitPrice
         FROM products WHERE id IN (?) ORDER BY id FOR UPDATE`,
      [ids]
    );
    const byId = new Map(products.map((p) => [p.id, p]));

    let totalCents = 0;
    const lines = [];
    for (const id of ids) {
      const p = byId.get(id);
      const qty = wanted.get(id);
      if (!p || !p.is_active) throw new HttpError(400, "Uno de los productos ya no está disponible");
      if (p.stock < qty) throw new HttpError(409, `No hay stock suficiente de "${p.name}" (disponibles: ${p.stock})`);
      const unitCents = Math.round(p.unitPrice * 100);
      totalCents += unitCents * qty;
      lines.push({ id, qty, unitPrice: unitCents / 100 });
    }
    const total = totalCents / 100;

    const [order] = await conn.query(
      `INSERT INTO orders (user_id, first_name, last_name, email, phone, city, delivery_date, notes, total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user?.id ?? null, data.firstName, data.lastName, data.email, data.phone, data.city, deliveryDate, data.notes || null, total]
    );

    await conn.query("INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ?", [
      lines.map((l) => [order.insertId, l.id, l.qty, l.unitPrice]),
    ]);
    for (const l of lines) {
      await conn.query("UPDATE products SET stock = stock - ? WHERE id = ?", [l.qty, l.id]);
    }

    await conn.commit();
    res.status(201).json({ order: { id: order.insertId, total, status: "pendiente" } });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

// GET /api/orders/mine  -> pedidos del usuario con sesion
router.get("/mine", requireAuth, async (req, res) => {
  const [orders] = await pool.query(
    `SELECT id, total, status, city, delivery_date AS deliveryDate, created_at AS createdAt
       FROM orders WHERE user_id = ? ORDER BY id DESC`,
    [req.user.id]
  );
  if (orders.length) {
    const [items] = await pool.query(
      `SELECT oi.order_id AS orderId, p.name, oi.quantity, oi.unit_price AS unitPrice
         FROM order_items oi JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id IN (?)`,
      [orders.map((o) => o.id)]
    );
    for (const o of orders) o.items = items.filter((i) => i.orderId === o.id);
  }
  res.json({ orders });
});

export default router;
