import { Router } from "express";
import { pool } from "../db/pool.js";
import { HttpError } from "../utils/errors.js";
import { PRODUCT_COLUMNS, toProduct } from "../utils/sql.js";

const router = Router();

// GET /api/products?limit=3&q=rosa
router.get("/", async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 100);
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

  let sql = `SELECT ${PRODUCT_COLUMNS} FROM products WHERE is_active = TRUE`;
  const params = [];
  if (q) {
    sql += " AND (name LIKE ? OR description LIKE ?)";
    params.push(`%${q}%`, `%${q}%`);
  }
  sql += " ORDER BY id LIMIT ?";
  params.push(limit);

  const [rows] = await pool.query(sql, params);
  res.json({ products: rows.map(toProduct) });
});

router.get("/:id", async (req, res) => {
  const [rows] = await pool.query(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE id = ? AND is_active = TRUE`, [
    req.params.id,
  ]);
  if (!rows.length) throw new HttpError(404, "Producto no encontrado");
  res.json({ product: toProduct(rows[0]) });
});

export default router;
