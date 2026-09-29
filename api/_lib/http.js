// =====================================================================
// api/_lib/http.js — Utilidades HTTP compartidas por las funciones.
//
// Solo usan la API estándar de Node (IncomingMessage / ServerResponse),
// así que funcionan igual en Vercel y en el servidor de desarrollo
// (desarrollo/servidor.mjs). Las carpetas que empiezan por "_" no se
// publican como funciones.
// =====================================================================

/** Error con código HTTP y un código corto que el navegador sabe traducir. */
export class ErrorHttp extends Error {
  constructor(estado, codigo, mensaje, detalles = null) {
    super(mensaje);
    this.estado = estado;
    this.codigo = codigo;
    this.detalles = detalles;
  }
}

export function responder(res, estado, datos, cabeceras = {}) {
  if (res.headersSent) return;
  res.statusCode = estado;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  for (const [clave, valor] of Object.entries(cabeceras)) res.setHeader(clave, valor);
  res.end(JSON.stringify(datos));
}

/** Lee el cuerpo JSON (Vercel ya lo trae en req.body; en local se lee del flujo). */
export async function leerCuerpo(req, limite = 32 * 1024) {
  let previo;
  try { previo = req.body; }   // en Vercel, leer req.body con un JSON roto lanza un error
  catch (_) { throw new ErrorHttp(400, "json_invalido", "El cuerpo de la petición no es JSON válido."); }
  if (previo !== undefined && previo !== null && typeof previo === "object") return previo;
  if (typeof previo === "string") return parsearJSON(previo);
  let texto = "";
  for await (const trozo of req) {
    texto += trozo;
    if (texto.length > limite) throw new ErrorHttp(413, "cuerpo_grande", "La petición es demasiado grande.");
  }
  return texto ? parsearJSON(texto) : {};
}

function parsearJSON(texto) {
  try { return JSON.parse(texto); }
  catch (_) { throw new ErrorHttp(400, "json_invalido", "El cuerpo de la petición no es JSON válido."); }
}

export function leerCookies(req) {
  const cookies = {};
  for (const parte of String(req.headers.cookie ?? "").split(";")) {
    const i = parte.indexOf("=");
    if (i < 0) continue;
    const nombre = parte.slice(0, i).trim();
    if (nombre) cookies[nombre] = decodeURIComponent(parte.slice(i + 1).trim());
  }
  return cookies;
}

export function esSeguro(req) {
  return req.headers["x-forwarded-proto"] === "https" || Boolean(req.socket?.encrypted);
}

/**
 * Protección contra CSRF para las peticiones que cambian datos: deben ser JSON
 * (un formulario de otro sitio no puede enviarlo sin permiso CORS) y, si el
 * navegador manda Origin, debe coincidir con este mismo sitio.
 */
export function comprobarMismoOrigen(req) {
  const tipo = String(req.headers["content-type"] ?? "");
  if (!tipo.includes("application/json")) {
    throw new ErrorHttp(415, "tipo_no_admitido", "Las peticiones deben enviarse como JSON.");
  }
  const origen = req.headers.origin;
  if (!origen) return;
  const anfitrion = req.headers["x-forwarded-host"] ?? req.headers.host;
  let hostOrigen = "";
  try { hostOrigen = new URL(origen).host; } catch (_) { /* origen mal formado */ }
  if (!anfitrion || hostOrigen !== anfitrion) {
    throw new ErrorHttp(403, "origen_no_permitido", "Petición rechazada: no viene de este sitio.");
  }
}

export function exigirMetodo(req, ...metodos) {
  if (!metodos.includes(req.method)) {
    throw new ErrorHttp(405, "metodo_no_permitido", `Método ${req.method} no permitido.`);
  }
}

/** Envuelve un manejador: traduce ErrorHttp a JSON y oculta los errores internos. */
export function manejador(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (error) {
      if (error instanceof ErrorHttp) {
        responder(res, error.estado, { error: error.codigo, mensaje: error.message, ...(error.detalles ? { detalles: error.detalles } : {}) });
        return;
      }
      console.error("[api]", error);
      responder(res, 500, { error: "error_interno", mensaje: "Algo falló en el servidor. Inténtalo de nuevo en un momento." });
    }
  };
}

/** Parámetro de la ruta: Vercel lo pone en req.query; en local se deduce de la URL. */
export function parametroRuta(req, nombre) {
  if (req.query && req.query[nombre] !== undefined) return String(req.query[nombre]);
  const partes = new URL(req.url, "http://x").pathname.split("/").filter(Boolean);
  return partes[partes.length - 1] ?? "";
}
