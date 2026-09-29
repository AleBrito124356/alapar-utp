// =====================================================================
// api/_lib/auth.js — Sesiones con cookie HttpOnly.
//
// El navegador guarda un token aleatorio en la cookie "alapar_sesion"
// (HttpOnly: el JavaScript de la página no puede leerla; SameSite=Lax:
// no viaja en peticiones de otros sitios; Secure en HTTPS). En la base solo
// se guarda la huella SHA-256 del token, así que una copia de la tabla de
// sesiones no sirve para suplantar a nadie.
// =====================================================================
import { consulta, una } from "./db.js";
import { ErrorHttp, leerCookies, esSeguro } from "./http.js";
import { nuevoToken, huella } from "./claves.js";

export const COOKIE = "alapar_sesion";
const DIAS = 7;

export function usuarioPublico(u) {
  return { id: u.id, nombre: u.nombre, correo: u.correo, rol: u.rol, carrera: u.carrera ?? null, creado: u.creado };
}

function ponerCookie(req, res, valor, segundos) {
  const partes = [`${COOKIE}=${valor}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${segundos}`];
  if (esSeguro(req)) partes.push("Secure");
  res.setHeader("Set-Cookie", partes.join("; "));
}

export async function crearSesion(req, res, usuarioId) {
  const token = nuevoToken();
  await consulta(
    "insert into sesiones (token, usuario_id, expira) values ($1, $2, now() + make_interval(days => $3::int))",
    [huella(token), usuarioId, DIAS]
  );
  // Limpieza oportunista de sesiones vencidas de este usuario.
  await consulta("delete from sesiones where usuario_id = $1 and expira < now()", [usuarioId]);
  ponerCookie(req, res, token, DIAS * 24 * 60 * 60);
}

export async function cerrarSesion(req, res) {
  const token = leerCookies(req)[COOKIE];
  if (token) await consulta("delete from sesiones where token = $1", [huella(token)]);
  ponerCookie(req, res, "", 0);
}

export async function usuarioActual(req) {
  const token = leerCookies(req)[COOKIE];
  if (!token || token.length > 100) return null;
  return una(
    `select u.id, u.nombre, u.correo, u.rol, u.carrera, u.creado
       from sesiones s
       join usuarios u on u.id = s.usuario_id
      where s.token = $1 and s.expira > now()`,
    [huella(token)]
  );
}

/** Devuelve el usuario de la sesión o corta con 401/403. */
export async function exigirUsuario(req, rol = null) {
  const usuario = await usuarioActual(req);
  if (!usuario) throw new ErrorHttp(401, "sin_sesion", "Inicia sesión para continuar.");
  if (rol && usuario.rol !== rol) throw new ErrorHttp(403, "sin_permiso", "Tu cuenta no tiene permiso para ver esto.");
  return usuario;
}
