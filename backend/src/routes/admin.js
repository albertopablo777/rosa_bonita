import { Router } from "express";
import Joi from "joi";
import { pool } from "../db/pool.js";
import { requireAuth, requireAdmin } from "../middlewares/auth.js";
import { HttpError } from "../utils/errors.js";
import { validate } from "../utils/validate.js";
import { PRODUCT_COLUMNS, toProduct } from "../utils/sql.js";

const router = Router();
router.use(requireAuth, requireAdmin);

/* ---------- Productos ---------- */
const productSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required().label("El nombre"),
  description: Joi.string().trim().max(1000).allow("", null).label("La descripción"),
  price: Joi.number().min(0).max(100000).precision(2).required().label("El precio"),
  discountPercent: Joi.number().integer().min(0).max(100).default(0).label("El descuento"),
  image: Joi.string().trim().max(200).pattern(/^[\w\-. ()/]+$/).allow("", null).label("La imagen"),
  stock: Joi.number().integer().min(0).max(100000).default(0).label("El stock"),
  isActive: Joi.boolean().default(true).label("El estado"),
});

const toRow = (d) => [d.name, d.description || null, d.price, d.discountPercent, d.image || null, d.stock, d.isActive];

router.get("/products", async (req, res) => {
  const [rows] = await pool.query(`SELECT ${PRODUCT_COLUMNS} FROM products ORDER BY id`);
  res.json({ products: rows.map(toProduct) });
});

router.post("/products", async (req, res) => {
  const d = validate(productSchema, req.body);
  const [r] = await pool.query(
    "INSERT INTO products (name, description, price, discount_percent, image, stock, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)",
    toRow(d)
  );
  res.status(201).json({ id: r.insertId });
});

router.put("/products/:id", async (req, res) => {
  const d = validate(productSchema, req.body);
  const [r] = await pool.query(
    "UPDATE products SET name=?, description=?, price=?, discount_percent=?, image=?, stock=?, is_active=? WHERE id=?",
    [...toRow(d), req.params.id]
  );
  if (!r.affectedRows) throw new HttpError(404, "Producto no encontrado");
  res.json({ message: "Producto actualizado" });
});

// Baja logica: los pedidos antiguos conservan su referencia al producto.
router.delete("/products/:id", async (req, res) => {
  const [r] = await pool.query("UPDATE products SET is_active = FALSE WHERE id = ?", [req.params.id]);
  if (!r.affectedRows) throw new HttpError(404, "Producto no encontrado");
  res.json({ message: "Producto desactivado" });
});

/* ---------- Pedidos ---------- */
const STATUSES = ["pendiente", "confirmado", "entregado", "cancelado"];

router.get("/orders", async (req, res) => {
  const status = STATUSES.includes(req.query.status) ? req.query.status : null;
  const [orders] = await pool.query(
    `SELECT id, user_id AS userId, first_name AS firstName, last_name AS lastName, email, phone, city,
            delivery_date AS deliveryDate, notes, total, status, created_at AS createdAt
       FROM orders ${status ? "WHERE status = ?" : ""} ORDER BY id DESC LIMIT 200`,
    status ? [status] : []
  );
  if (orders.length) {
    const [items] = await pool.query(
      `SELECT oi.order_id AS orderId, p.name, oi.quantity, oi.unit_price AS unitPrice
         FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id IN (?)`,
      [orders.map((o) => o.id)]
    );
    for (const o of orders) o.items = items.filter((i) => i.orderId === o.id);
  }
  res.json({ orders });
});

router.patch("/orders/:id/status", async (req, res) => {
  const { status } = validate(Joi.object({ status: Joi.string().valid(...STATUSES).required().label("El estado") }), req.body);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query("SELECT status FROM orders WHERE id = ? FOR UPDATE", [req.params.id]);
    if (!rows.length) throw new HttpError(404, "Pedido no encontrado");
    const current = rows[0].status;
    if (current === "cancelado" && status !== "cancelado") {
      throw new HttpError(409, "Un pedido cancelado no se puede reactivar");
    }
    if (status === "cancelado" && current !== "cancelado") {
      // Devuelve el stock de los productos del pedido cancelado.
      await conn.query(
        "UPDATE products p JOIN order_items oi ON oi.product_id = p.id SET p.stock = p.stock + oi.quantity WHERE oi.order_id = ?",
        [req.params.id]
      );
    }
    await conn.query("UPDATE orders SET status = ? WHERE id = ?", [status, req.params.id]);
    await conn.commit();
    res.json({ message: "Estado actualizado", status });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

/* ---------- Mensajes de contacto ---------- */
router.get("/messages", async (req, res) => {
  const [rows] = await pool.query(
    "SELECT id, name, email, phone, message, created_at AS createdAt FROM contact_messages ORDER BY id DESC LIMIT 200"
  );
  res.json({ messages: rows });
});

export default router;
