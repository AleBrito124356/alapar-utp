// =====================================================================
// api/_lib/validar.js — Validación del lado del servidor.
//
// El navegador ya valida cada formulario, pero cualquiera puede llamar a la
// API sin pasar por él: aquí se vuelve a comprobar todo.
// =====================================================================
import { ErrorHttp } from "./http.js";

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const LETRAS = /^[\p{L}\s'.\-]+$/u;

const texto = (v) => (typeof v === "string" ? v.trim() : "");

/** Junta los errores campo a campo y los devuelve todos juntos en un 422. */
export class Validacion {
  #errores = {};

  campo(nombre, condicion, mensaje) {
    if (!condicion && !this.#errores[nombre]) this.#errores[nombre] = mensaje;
    return this;
  }

  terminar() {
    if (Object.keys(this.#errores).length) {
      throw new ErrorHttp(422, "datos_invalidos", "Revisa los datos marcados.", this.#errores);
    }
  }
}

export function datosRegistro(cuerpo) {
  const nombre = texto(cuerpo.nombre).replace(/\s+/g, " ");
  const correo = texto(cuerpo.correo).toLowerCase();
  const clave = typeof cuerpo.clave === "string" ? cuerpo.clave : "";
  const carrera = texto(cuerpo.carrera).slice(0, 80) || null;
  new Validacion()
    .campo("nombre", nombre.length >= 3, "Escribe tu nombre (mínimo 3 letras).")
    .campo("nombre", nombre.length <= 80, "El nombre es demasiado largo.")
    .campo("nombre", LETRAS.test(nombre), "Usa solo letras y espacios.")
    .campo("correo", CORREO.test(correo) && correo.length <= 120, "Escribe un correo válido.")
    .campo("clave", clave.length >= 8, "La contraseña necesita al menos 8 caracteres.")
    .campo("clave", clave.length <= 72, "La contraseña es demasiado larga.")
    .terminar();
  return { nombre, correo, clave, carrera };
}

export function datosEntrada(cuerpo) {
  const correo = texto(cuerpo.correo).toLowerCase();
  const clave = typeof cuerpo.clave === "string" ? cuerpo.clave : "";
  new Validacion()
    .campo("correo", CORREO.test(correo), "Escribe tu correo.")
    .campo("clave", clave.length > 0 && clave.length <= 72, "Escribe tu contraseña.")
    .terminar();
  return { correo, clave };
}

/** Celular de Panamá (6XXX-XXXX) o fijo de 7 dígitos; devuelve solo los dígitos. */
export function limpiarTelefono(valor) {
  const limpio = texto(valor).replace(/[\s\-().]/g, "").replace(/^\+?507/, "");
  return /^6\d{7}$/.test(limpio) || /^[2-9]\d{6}$/.test(limpio) ? limpio : null;
}

export const esCelular = (digitos) => /^6\d{7}$/.test(String(digitos ?? ""));

export { texto };
