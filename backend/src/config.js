import dotenv from "dotenv";

dotenv.config();

const env = process.env;

export const config = {
  port: Number(env.PORT) || 3000,
  corsOrigin: env.CORS_ORIGIN || "*",
  db: {
    host: env.DB_HOST || "localhost",
    port: Number(env.DB_PORT) || 3306,
    user: env.DB_USER || "root",
    password: env.DB_PASSWORD || "",
    name: env.DB_NAME || "rosa_bonita",
  },
  jwtSecret: env.JWT_SECRET || "",
  jwtExpiresIn: env.JWT_EXPIRES_IN || "7d",
  adminEmail: (env.ADMIN_EMAIL || "").trim().toLowerCase(),
  adminPassword: env.ADMIN_PASSWORD || "",
};

// El nombre de la BD se interpola en SQL (no admite parametros): lo validamos.
if (!/^[A-Za-z0-9_]+$/.test(config.db.name)) {
  throw new Error("DB_NAME solo puede contener letras, numeros y guion bajo");
}

export function assertAuthConfig() {
  if (config.jwtSecret.length < 16) {
    throw new Error("Falta JWT_SECRET en .env (minimo 16 caracteres). Copia .env.example a .env y completalo.");
  }
}
