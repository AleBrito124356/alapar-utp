// =====================================================================
// /api/auth/:accion — registro, entrar, salir, yo
// Una sola función para las cuatro acciones (el plan gratuito de Vercel
// limita el número de funciones por proyecto).
// =====================================================================
import { manejador, responder, leerCuerpo, comprobarMismoOrigen, exigirMetodo, parametroRuta, ErrorHttp } from "../_lib/http.js";
import { consulta, una } from "../_lib/db.js";
import { crearSesion, cerrarSesion, usuarioActual, usuarioPublico } from "../_lib/auth.js";
import { hashClave, verificarClave, hashSenuelo } from "../_lib/claves.js";
import { datosRegistro, datosEntrada } from "../_lib/validar.js";

const ACCIONES = {
  /** GET: quién soy (null si no hay sesión). */
  async yo(req, res) {
    exigirMetodo(req, "GET");
    const usuario = await usuarioActual(req);
    responder(res, 200, { usuario: usuario ? usuarioPublico(usuario) : null });
  },

  /** POST { correo, clave } */
  async entrar(req, res) {
    exigirMetodo(req, "POST");
    comprobarMismoOrigen(req);
    const { correo, clave } = datosEntrada(await leerCuerpo(req));
    const usuario = await una(
      "select id, nombre, correo, rol, carrera, creado, clave from usuarios where lower(correo) = $1",
      [correo]
    );
    // Se verifica siempre (contra un señuelo si el correo no existe) para no delatar cuentas.
    const valida = await verificarClave(clave, usuario?.clave ?? await hashSenuelo());
    if (!usuario || !valida) {
      throw new ErrorHttp(401, "credenciales_invalidas", "El correo o la contraseña no coinciden.");
    }
    await consulta("update usuarios set ultimo_acceso = now() where id = $1", [usuario.id]);
    await crearSesion(req, res, usuario.id);
    responder(res, 200, { usuario: usuarioPublico(usuario) });
  },

  /** POST { nombre, correo, clave, carrera? } — las cuentas nuevas siempre son de estudiante. */
  async registro(req, res) {
    exigirMetodo(req, "POST");
    comprobarMismoOrigen(req);
    const datos = datosRegistro(await leerCuerpo(req));
    const clave = await hashClave(datos.clave);
    let usuario;
    try {
      usuario = await una(
        `insert into usuarios (nombre, correo, clave, carrera, ultimo_acceso)
         values ($1, $2, $3, $4, now())
         returning id, nombre, correo, rol, carrera, creado`,
        [datos.nombre, datos.correo, clave, datos.carrera]
      );
    } catch (error) {
      if (error?.code === "23505") {
        throw new ErrorHttp(409, "correo_en_uso", "Ya hay una cuenta con ese correo.", {
          correo: "Ya hay una cuenta con ese correo. ¿Quieres entrar?"
        });
      }
      throw error;
    }
    await crearSesion(req, res, usuario.id);
    responder(res, 201, { usuario: usuarioPublico(usuario) });
  },

  /** POST: cierra la sesión y borra la cookie. */
  async salir(req, res) {
    exigirMetodo(req, "POST");
    comprobarMismoOrigen(req);
    await cerrarSesion(req, res);
    responder(res, 200, { ok: true });
  }
};

export default manejador(async (req, res) => {
  const accion = parametroRuta(req, "accion");
  if (!Object.hasOwn(ACCIONES, accion)) throw new ErrorHttp(404, "no_encontrado", "Esa acción no existe.");
  await ACCIONES[accion](req, res);
});
