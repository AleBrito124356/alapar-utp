// =====================================================================
// POST /api/reservas/pagar — pago SIMULADO de una reserva pendiente.
//
// { folio, metodo: "yappy", telefono }       → celular de Panamá
// { folio, metodo: "tarjeta", ultimos4 }      → solo la tarjeta de prueba 4242
// { folio, metodo: "intercambio" }            → reservas sin importe
//
// No hay pasarela real ni se guarda ningún dato de tarjeta: el navegador
// solo manda los cuatro últimos dígitos, y únicamente se acepta 4242.
// =====================================================================
import { randomInt } from "node:crypto";
import { manejador, responder, leerCuerpo, comprobarMismoOrigen, exigirMetodo, ErrorHttp } from "../_lib/http.js";
import { una } from "../_lib/db.js";
import { exigirUsuario } from "../_lib/auth.js";
import { listarReservas } from "../_lib/reservas.js";
import { Validacion, limpiarTelefono, esCelular, texto } from "../_lib/validar.js";

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const digitos = (n) => Array.from({ length: n }, () => randomInt(10)).join("");
const codigo = (n) => Array.from({ length: n }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");

export default manejador(async (req, res) => {
  exigirMetodo(req, "POST");
  comprobarMismoOrigen(req);
  const usuario = await exigirUsuario(req);
  const cuerpo = await leerCuerpo(req);
  const folio = texto(cuerpo.folio);

  const reserva = await una(
    "select id, estado, total::float8 as total from reservas where folio = $1 and usuario_id = $2",
    [folio, usuario.id]
  );
  if (!reserva) throw new ErrorHttp(404, "no_encontrada", "No encontramos esa reserva en tu cuenta.");
  if (reserva.estado !== "pendiente") throw new ErrorHttp(409, "ya_pagada", "Esta reserva ya estaba pagada.");

  const metodo = texto(cuerpo.metodo);
  let metodoFinal;
  let referencia;
  if (reserva.total > 0) {
    if (metodo === "yappy") {
      const telefono = limpiarTelefono(cuerpo.telefono);
      new Validacion()
        .campo("telefono", telefono !== null && esCelular(telefono), "Escribe el celular de tu Yappy: 6XXX-XXXX.")
        .terminar();
      referencia = `YAP-${digitos(8)}`;
    } else if (metodo === "tarjeta") {
      new Validacion()
        .campo("tarjeta", texto(cuerpo.ultimos4) === "4242", "Usa la tarjeta de prueba 4242 4242 4242 4242: aquí no se cobran tarjetas reales.")
        .terminar();
      referencia = `TJ-4242-${codigo(6)}`;
    } else {
      throw new ErrorHttp(422, "metodo_invalido", "Elige Yappy o la tarjeta de prueba.");
    }
    metodoFinal = metodo;
  } else {
    if (metodo !== "intercambio") throw new ErrorHttp(422, "metodo_invalido", "Esta reserva es solo de intercambio: no hay nada que pagar.");
    metodoFinal = "intercambio";
    referencia = `INT-${codigo(6)}`;
  }

  const actualizada = await una(
    `update reservas set estado = 'pagada', metodo_pago = $2, referencia = $3, pagada = now()
      where id = $1 and estado = 'pendiente'
      returning folio`,
    [reserva.id, metodoFinal, referencia]
  );
  if (!actualizada) throw new ErrorHttp(409, "ya_pagada", "Esta reserva ya estaba pagada.");

  const [final] = await listarReservas({ folio, limite: 1 });
  responder(res, 200, { reserva: final });
});
