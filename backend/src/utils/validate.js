import { HttpError } from "./errors.js";

const messages = {
  "any.required": "{{#label}} es obligatorio",
  "string.base": "{{#label}} debe ser texto",
  "string.empty": "{{#label}} no puede estar vacío",
  "string.min": "{{#label}} debe tener al menos {{#limit}} caracteres",
  "string.max": "{{#label}} debe tener como máximo {{#limit}} caracteres",
  "string.email": "{{#label}} no es un correo válido",
  "string.pattern.base": "{{#label}} no tiene un formato válido",
  "string.pattern.name": "{{#label}} debe incluir {{#name}}",
  "number.base": "{{#label}} debe ser un número",
  "number.integer": "{{#label}} debe ser un número entero",
  "number.min": "{{#label}} debe ser como mínimo {{#limit}}",
  "number.max": "{{#label}} debe ser como máximo {{#limit}}",
  "array.base": "{{#label}} debe ser una lista",
  "array.min": "{{#label}} debe tener al menos {{#limit}} elemento(s)",
  "array.max": "{{#label}} admite como máximo {{#limit}} elementos",
  "boolean.base": "{{#label}} debe ser verdadero o falso",
  "any.only": "{{#label}} no tiene un valor permitido",
};

// Valida y devuelve los datos limpios (campos desconocidos eliminados).
export function validate(schema, data) {
  const { value, error } = schema.validate(data ?? {}, {
    abortEarly: false,
    stripUnknown: true,
    errors: { wrap: { label: false } },
    messages,
  });
  if (error) {
    const details = error.details.map((d) => d.message);
    throw new HttpError(400, details[0], details);
  }
  return value;
}
