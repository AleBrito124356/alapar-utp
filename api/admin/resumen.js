// =====================================================================
// GET /api/admin/resumen — todo lo que ve el panel de administración.
// Solo para cuentas con rol "admin" (se comprueba aquí, no en la página).
// =====================================================================
import { manejador, responder, exigirMetodo } from "../_lib/http.js";
import { consulta } from "../_lib/db.js";
import { exigirUsuario } from "../_lib/auth.js";
import { listarReservas } from "../_lib/reservas.js";
import { HOY_PANAMA } from "../_lib/esquema.js";

export default manejador(async (req, res) => {
  exigirMetodo(req, "GET");
  await exigirUsuario(req, "admin");

  const [[kpis], serie, usuarios, reservas, tutores] = await Promise.all([
    consulta(`
      select
        (select count(*)::int from usuarios where rol = 'estudiante') as estudiantes,
        (select count(*)::int from usuarios where rol = 'estudiante' and creado > now() - interval '7 days') as "estudiantesSemana",
        (select count(*)::int from reservas) as reservas,
        (select count(*)::int from reservas where estado = 'pagada') as pagadas,
        (select count(*)::int from reservas where estado = 'pendiente') as pendientes,
        (select coalesce(sum(total), 0)::float8 from reservas where estado = 'pagada') as ingresos,
        (select coalesce(sum(horas), 0)::int from reservas where estado = 'pagada') as horas,
        (select count(*)::int from reservas r
          where exists (select 1 from reserva_lineas l where l.reserva_id = r.id and l.intercambio)) as intercambios`),
    consulta(`
      with dias as (select (${HOY_PANAMA})::date - g as dia from generate_series(0, 13) as g)
      select to_char(d.dia, 'YYYY-MM-DD') as dia,
             count(r.id)::int as reservas,
             coalesce(sum(r.total) filter (where r.estado = 'pagada'), 0)::float8 as ingresos
        from dias d
        left join reservas r on ((r.creada at time zone 'UTC') - interval '5 hours')::date = d.dia
       group by d.dia
       order by d.dia`),
    consulta(`
      select u.id, u.nombre, u.correo, u.rol, u.carrera, u.demo, u.creado, u.ultimo_acceso as "ultimoAcceso",
             count(r.id)::int as reservas,
             coalesce(sum(r.total) filter (where r.estado = 'pagada'), 0)::float8 as gastado,
             coalesce(sum(r.horas) filter (where r.estado = 'pagada'), 0)::int as horas
        from usuarios u
        left join reservas r on r.usuario_id = u.id
       group by u.id
       order by u.creado desc
       limit 500`),
    listarReservas({ limite: 300 }),
    consulta(`
      select t.id, t.nombre, t.foto, t.precio::float8 as precio,
             coalesce(sum(l.horas) filter (where r.estado = 'pagada'), 0)::int as horas,
             coalesce(sum(l.subtotal) filter (where r.estado = 'pagada'), 0)::float8 as importe
        from tutores t
        left join reserva_lineas l on l.tutor_id = t.id
        left join reservas r on r.id = l.reserva_id
       group by t.id
       order by horas desc, t.nombre`)
  ]);

  responder(res, 200, { generado: new Date().toISOString(), kpis, serie, usuarios, reservas, tutores });
});
