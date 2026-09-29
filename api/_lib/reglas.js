// =====================================================================
// api/_lib/reglas.js — Reglas del carrito, del lado del servidor.
//
// Son las mismas que aplica js/carrito.js en el navegador, pero aquí son
// las que cuentan: el servidor recalcula cada importe con las tarifas de la
// base de datos y no se fía de ningún precio que venga del navegador.
// =====================================================================
export const MAX_HORAS = 8;
export const MAX_LINEAS = 12;
export const UMBRAL_DESCUENTO = 4;   // horas pagadas en una misma reserva
export const TASA_DESCUENTO = 0.1;   // paquete de parcial: 10 %

export const redondear = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/** lineas: [{ precioHora, horas, intercambio }] → importes de la reserva. */
export function calcularImportes(lineas) {
  let horas = 0, horasPagadas = 0, subtotal = 0;
  for (const l of lineas) {
    horas += l.horas;
    if (!l.intercambio) {
      horasPagadas += l.horas;
      subtotal += l.precioHora * l.horas;
    }
  }
  subtotal = redondear(subtotal);
  const descuento = horasPagadas >= UMBRAL_DESCUENTO ? redondear(subtotal * TASA_DESCUENTO) : 0;
  return { horas, horasPagadas, subtotal, descuento, total: redondear(subtotal - descuento) };
}
