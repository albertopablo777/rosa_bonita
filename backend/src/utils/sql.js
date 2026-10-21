// Precio final = precio con el descuento aplicado, redondeado a 2 decimales.
export const FINAL_PRICE_SQL = "ROUND(price * (100 - discount_percent) / 100, 2)";

export const PRODUCT_COLUMNS = `
  id, name, description, price,
  discount_percent AS discountPercent,
  ${FINAL_PRICE_SQL} AS finalPrice,
  image, stock, is_active AS isActive`;

// MySQL devuelve BOOLEAN como 0/1: lo convertimos a true/false para el JSON.
export const toProduct = (row) => ({ ...row, isActive: Boolean(row.isActive) });
