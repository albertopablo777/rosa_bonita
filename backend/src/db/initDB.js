// Crea la base de datos, las tablas, los productos de ejemplo y el administrador inicial.
//   npm run initDB          -> crea lo que falte (no borra nada)
//   npm run initDB:reset    -> BORRA las tablas y las recrea (solo desarrollo)
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import { config } from "../config.js";

const sqlDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../sql");
const reset = process.argv.includes("--reset");

if (reset && process.env.NODE_ENV === "production") {
  console.error("initDB:reset esta bloqueado cuando NODE_ENV=production");
  process.exit(1);
}

let conn;
try {
  conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    multipleStatements: true,
  });
} catch (err) {
  console.error(`No se pudo conectar a MySQL (${err.code || err.message}). Revisa DB_HOST, DB_USER y DB_PASSWORD en el .env y que MySQL esté encendido.`);
  process.exit(1);
}

try {
  const db = config.db.name;
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.query(`USE \`${db}\``);

  if (reset) {
    console.log("Borrando tablas...");
    await conn.query(
      "SET FOREIGN_KEY_CHECKS=0; DROP TABLE IF EXISTS order_items, orders, contact_messages, products, users; SET FOREIGN_KEY_CHECKS=1;"
    );
  }

  console.log("Creando tablas...");
  await conn.query(await fs.readFile(path.join(sqlDir, "schema.sql"), "utf8"));

  const [[{ n }]] = await conn.query("SELECT COUNT(*) AS n FROM products");
  if (n === 0) {
    console.log("Insertando productos de ejemplo...");
    await conn.query(await fs.readFile(path.join(sqlDir, "seed.sql"), "utf8"));
  } else {
    console.log(`La tabla products ya tiene ${n} registros: no se insertan ejemplos.`);
  }

  if (config.adminEmail && config.adminPassword.length >= 8) {
    const [rows] = await conn.query("SELECT id FROM users WHERE email = ?", [config.adminEmail]);
    if (rows.length === 0) {
      const hash = await bcrypt.hash(config.adminPassword, 10);
      await conn.query(
        "INSERT INTO users (first_name, last_name, email, password_hash, role) VALUES ('Admin', 'Rosa Bonita', ?, ?, 'admin')",
        [config.adminEmail, hash]
      );
      console.log(`Administrador creado: ${config.adminEmail}`);
    } else {
      console.log("El administrador ya existe.");
    }
  } else {
    console.warn("ADMIN_EMAIL / ADMIN_PASSWORD (min. 8 caracteres) no definidos: no se creo administrador.");
  }

  console.log("Base de datos lista.");
} catch (err) {
  console.error("Error preparando la base de datos:", err.message);
  process.exitCode = 1;
} finally {
  await conn.end();
}
