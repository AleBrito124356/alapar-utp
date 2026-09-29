// =====================================================================
// api/_lib/reservas.js — Lectura de reservas con sus sesiones.
// =====================================================================
import { consulta } from "./db.js";

const SELECCION = `
  select r.folio, r.estado, r.horas,
         r.subtotal::float8 as subtotal, r.descuento::float8 as descuento, r.total::float8 as total,
         r.metodo_pago as "metodoPago", r.referencia, r.ofrece, mo.nombre as "ofreceNombre",
         r.telefono, r.disponibilidad, r.creada, r.pagada,
         u.id as "usuarioId", u.nombre as "usuarioNombre", u.correo as "usuarioCorreo",
         coalesce((
           select json_agg(json_build_object(
                    'tutor', l.tutor_id, 'tutorNombre', t.nombre, 'tutorFoto', t.foto,
                    'materia', l.materia, 'materiaNombre', m.nombre,
                    'modalidad', l.modalidad, 'horas', l.horas,
                    'precioHora', l.precio_hora::float8, 'subtotal', l.subtotal::float8,
                    'intercambio', l.intercambio) order by l.id)
             from reserva_lineas l
             join tutores t on t.id = l.tutor_id
             join materias m on m.codigo = l.materia
            where l.reserva_id = r.id), '[]'::json) as lineas
    from reservas r
    join usuarios u on u.id = r.usuario_id
    left join materias mo on mo.codigo = r.ofrece`;

/** Reservas con sus sesiones, de la más reciente a la más antigua. */
export async function listarReservas({ usuarioId = null, folio = null, limite = 200 } = {}) {
  const condiciones = [];
  const params = [];
  if (usuarioId !== null) { params.push(usuarioId); condiciones.push(`r.usuario_id = $${params.length}`); }
  if (folio !== null) { params.push(folio); condiciones.push(`r.folio = $${params.length}`); }
  params.push(limite);
  const donde = condiciones.length ? `where ${condiciones.join(" and ")}` : "";
  return consulta(`${SELECCION} ${donde} order by r.creada desc, r.id desc limit $${params.length}`, params);
}
