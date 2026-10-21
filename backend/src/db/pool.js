import mysql from "mysql2/promise";
import { config } from "../config.js";

export const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.name,
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true, // DECIMAL llega como numero y no como texto
  charset: "utf8mb4",
  dateStrings: ["DATE"], // las fechas sin hora llegan como "YYYY-MM-DD"
});
