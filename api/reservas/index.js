// =====================================================================
// /api/reservas
//   GET  → las reservas de quien tiene la sesión abierta
//   POST → crea una reserva pendiente de pago a partir del carrito
//
// El navegador solo manda qué quiere (tutor, materia, modalidad, horas):
// tarifas, descuento y total se calculan aquí con los datos de la base.
// =====================================================================
import { manejador, responder, leerCuerpo, comprobarMismoOrigen, exigirMetodo, ErrorHttp } from "../_lib/http.js";
import { consulta, una } from "../_lib/db.js";
import { exigirUsuario } from "../_lib/auth.js";
import { listarReservas } from "../_lib/reservas.js";
import { calcularImportes, redondear, MAX_HORAS, MAX_LINEAS } from "../_lib/reglas.js";
import { Validacion, limpiarTelefono, texto } from "../_lib/validar.js";

async function crear(req, res) {
  comprobarMismoOrigen(req);
  const usuario = await exigirUsuario(req);
  const cuerpo = await leerCuerpo(req);

  const telefono = limpiarTelefono(cuerpo.telefono);
  const disponibilidad = texto(cuerpo.disponibilidad);
  const pedidas = Array.isArray(cuerpo.lineas) ? cuerpo.lineas : [];
  new Validacion()
    .campo("telefono", telefono !== null, "Escribe un número de Panamá: celular 6XXX-XXXX o fijo de 7 dígitos.")
    .campo("disponibilidad", disponibilidad.length >= 10, "Cuéntanos qué días y a qué horas puedes (mínimo 10 caracteres).")
    .campo("disponibilidad", disponibilidad.length <= 300, "Máximo 300 caracteres.")
    .campo("lineas", pedidas.length > 0, "El carrito está vacío.")
    .campo("lineas", pedidas.length <= MAX_LINEAS, `Máximo ${MAX_LINEAS} sesiones por reserva.`)
    .terminar();

  const tutores = new Map(
    (await consulta("select id, precio::float8 as precio, modalidades, materias from tutores")).map((t) => [t.id, t])
  );

  // Se comprueba cada línea contra el catálogo y se juntan las repetidas.
  const unidas = new Map();
  for (const pedida of pedidas) {
    const tutor = tutores.get(String(pedida?.tutor ?? ""));
    const materia = String(pedida?.materia ?? "");
    const modalidad = String(pedida?.modalidad ?? "");
    const horas = Number(pedida?.horas);
    const valida = tutor && tutor.materias.includes(materia) && tutor.modalidades.includes(modalidad)
      && Number.isInteger(horas) && horas >= 1 && horas <= MAX_HORAS;
    if (!valida) {
      throw new ErrorHttp(422, "linea_invalida", "Una de las sesiones del carrito ya no está disponible. Revisa el carrito y vuelve a intentarlo.");
    }
    const clave = `${tutor.id}|${materia}|${modalidad}`;
    const previa = unidas.get(clave);
    if (previa) previa.horas = Math.min(MAX_HORAS, previa.horas + horas);
    else unidas.set(clave, { tutor: tutor.id, materia, modalidad, horas, precioHora: tutor.precio, intercambio: tutor.precio === 0 });
  }
  const lineas = [...unidas.values()].map((l) => ({ ...l, subtotal: redondear(l.precioHora * l.horas) }));
  const importes = calcularImportes(lineas);

  let ofrece = null;
  if (lineas.some((l) => l.intercambio)) {
    ofrece = texto(cuerpo.ofrece);
    const existe = ofrece ? await una("select codigo from materias where codigo = $1", [ofrece]) : null;
    new Validacion().campo("ofrece", Boolean(existe), "Elige la materia que das a cambio.").terminar();
  }

  // Reserva y sesiones en una sola sentencia: o se guarda todo o nada.
  const nueva = await una(
    `with nueva as (
       insert into reservas (usuario_id, telefono, disponibilidad, ofrece, horas, subtotal, descuento, total)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning id, folio
     ), sesiones as (
       insert into reserva_lineas (reserva_id, tutor_id, materia, modalidad, horas, precio_hora, subtotal, intercambio)
       select nueva.id, l.tutor, l.materia, l.modalidad, l.horas, l."precioHora", l.subtotal, l.intercambio
         from nueva, jsonb_to_recordset($9::jsonb)
           as l(tutor text, materia text, modalidad text, horas int, "precioHora" numeric, subtotal numeric, intercambio boolean)
       returning 1
     )
     select folio from nueva`,
    [usuario.id, telefono, disponibilidad, ofrece, importes.horas, importes.subtotal, importes.descuento, importes.total, JSON.stringify(lineas)]
  );

  const [reserva] = await listarReservas({ folio: nueva.folio, limite: 1 });
  responder(res, 201, { reserva });
}

export default manejador(async (req, res) => {
  exigirMetodo(req, "GET", "POST");
  if (req.method === "POST") return crear(req, res);
  const usuario = await exigirUsuario(req);
  const reservas = await listarReservas({ usuarioId: usuario.id, limite: 100 });
  responder(res, 200, { reservas });
});
