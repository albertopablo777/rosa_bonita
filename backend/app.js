import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { config, assertAuthConfig } from "./src/config.js";
import { pool } from "./src/db/pool.js";
import { errorHandler, notFoundApi } from "./src/middlewares/errorHandler.js";
import authRoutes from "./src/routes/auth.js";
import productRoutes from "./src/routes/products.js";
import orderRoutes from "./src/routes/orders.js";
import contactRoutes from "./src/routes/contact.js";
import adminRoutes from "./src/routes/admin.js";

assertAuthConfig();

const frontendDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../frontend");
const app = express();

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.set({ "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin", "X-Frame-Options": "SAMEORIGIN" });
  next();
});
app.use(cors({ origin: config.corsOrigin === "*" ? true : config.corsOrigin.split(",").map((s) => s.trim()) }));
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", async (req, res) => {
  await pool.query("SELECT 1");
  res.json({ status: "ok" });
});
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", notFoundApi);

// El mismo servidor entrega el frontend: http://localhost:3000
app.use(express.static(frontendDir, { index: "home.html" }));

app.use(errorHandler);

try {
  await pool.query("SELECT 1");
} catch (err) {
  console.error(`No se pudo conectar a MySQL (${err.code || err.message}). Revisa el .env y ejecuta: npm run initDB`);
  process.exit(1);
}

app.listen(config.port, () => {
  console.log(`Rosa Bonita lista en http://localhost:${config.port}`);
});
