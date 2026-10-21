export function notFoundApi(req, res) {
  res.status(404).json({ message: "Ruta no encontrada" });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "JSON inválido" });
  }
  if (err.status && err.status < 500) {
    return res.status(err.status).json({ message: err.message, details: err.details });
  }
  if (err.code === "ER_DUP_ENTRY") {
    return res.status(409).json({ message: "El registro ya existe" });
  }
  console.error(err);
  res.status(500).json({ message: "Error interno del servidor" });
}
