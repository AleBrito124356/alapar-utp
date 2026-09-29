// =====================================================================
// api/_lib/esquema.js — Tablas, catálogo y datos de demostración.
//
// La primera petición de cada instancia comprueba la versión del esquema.
// Si la base está vacía crea las tablas y siembra los datos de demostración;
// así basta con conectar una base Neon al proyecto y desplegar. Todo es
// idempotente (create … if not exists, on conflict do nothing): si dos
// instancias arrancan a la vez no se pisan.
//
// El catálogo (materias y tutores) se sincroniza en cada arranque con
// api/_lib/catalogo.js, que build.mjs genera a partir de js/datos.js.
// =====================================================================
import { randomUUID } from "node:crypto";
import { hashClave } from "./claves.js";
import { MATERIAS, TUTORES } from "./catalogo.js";
import { calcularImportes } from "./reglas.js";

export const VERSION = 1;

/** Fecha de Panamá (UTC−5 todo el año, sin horario de verano). */
export const HOY_PANAMA = "((now() at time zone 'UTC') - interval '5 hours')";

const TABLAS = [
  `create table if not exists esquema (
     version int primary key,
     aplicado timestamptz not null default now()
   )`,
  `create table if not exists usuarios (
     id serial primary key,
     nombre text not null check (char_length(nombre) between 3 and 80),
     correo text not null check (char_length(correo) <= 120),
     clave text not null,
     rol text not null default 'estudiante' check (rol in ('estudiante', 'admin')),
     carrera text,
     demo boolean not null default false,
     creado timestamptz not null default now(),
     ultimo_acceso timestamptz
   )`,
  `create unique index if not exists usuarios_correo_unico on usuarios (lower(correo))`,
  `create table if not exists sesiones (
     token text primary key,
     usuario_id int not null references usuarios(id) on delete cascade,
     creada timestamptz not null default now(),
     expira timestamptz not null
   )`,
  `create index if not exists sesiones_usuario on sesiones (usuario_id)`,
  `create table if not exists materias (
     codigo text primary key,
     nombre text not null,
     area text not null
   )`,
  `create table if not exists tutores (
     id text primary key,
     nombre text not null,
     carrera text not null,
     precio numeric(6,2) not null check (precio >= 0),
     modalidades text[] not null,
     materias text[] not null,
     foto text
   )`,
  `create sequence if not exists folio_reserva start 1001`,
  `create table if not exists reservas (
     id serial primary key,
     folio text not null unique default (
       'RES-' || to_char(${HOY_PANAMA}, 'YYMMDD') || '-' || nextval('folio_reserva')
     ),
     usuario_id int not null references usuarios(id) on delete cascade,
     estado text not null default 'pendiente' check (estado in ('pendiente', 'pagada', 'cancelada')),
     telefono text not null,
     disponibilidad text not null,
     ofrece text references materias(codigo),
     horas int not null check (horas > 0),
     subtotal numeric(8,2) not null check (subtotal >= 0),
     descuento numeric(8,2) not null default 0 check (descuento >= 0),
     total numeric(8,2) not null check (total >= 0),
     metodo_pago text check (metodo_pago in ('yappy', 'tarjeta', 'intercambio')),
     referencia text,
     creada timestamptz not null default now(),
     pagada timestamptz
   )`,
  `create index if not exists reservas_usuario on reservas (usuario_id, creada desc)`,
  `create index if not exists reservas_creada on reservas (creada desc)`,
  `create table if not exists reserva_lineas (
     id serial primary key,
     reserva_id int not null references reservas(id) on delete cascade,
     tutor_id text not null references tutores(id),
     materia text not null references materias(codigo),
     modalidad text not null check (modalidad in ('presencial', 'virtual')),
     horas int not null check (horas between 1 and 8),
     precio_hora numeric(6,2) not null,
     subtotal numeric(8,2) not null,
     intercambio boolean not null,
     unique (reserva_id, tutor_id, materia, modalidad)
   )`
];

export async function asegurarEsquema(q) {
  let version = 0;
  try {
    version = (await q("select coalesce(max(version), 0)::int as v from esquema"))[0].v;
  } catch (error) {
    if (error?.code !== "42P01") throw error; // 42P01: la tabla no existe todavía
  }
  if (version < VERSION) {
    for (const sentencia of TABLAS) await q(sentencia);
  }
  await sincronizarCatalogo(q);
  if (version < VERSION) {
    await sembrarDemo(q);
    await q("insert into esquema (version) values ($1) on conflict do nothing", [VERSION]);
  }
}

async function sincronizarCatalogo(q) {
  await q(
    `insert into materias (codigo, nombre, area)
     select codigo, nombre, area from jsonb_to_recordset($1::jsonb) as m(codigo text, nombre text, area text)
     on conflict (codigo) do update set nombre = excluded.nombre, area = excluded.area`,
    [JSON.stringify(MATERIAS)]
  );
  await q(
    `insert into tutores (id, nombre, carrera, precio, modalidades, materias, foto)
     select t.id, t.nombre, t.carrera, t.precio,
            array(select jsonb_array_elements_text(t.modalidades)),
            array(select jsonb_array_elements_text(t.materias)),
            t.foto
       from jsonb_to_recordset($1::jsonb)
         as t(id text, nombre text, carrera text, precio numeric, modalidades jsonb, materias jsonb, foto text)
     on conflict (id) do update set
       nombre = excluded.nombre, carrera = excluded.carrera, precio = excluded.precio,
       modalidades = excluded.modalidades, materias = excluded.materias, foto = excluded.foto`,
    [JSON.stringify(TUTORES)]
  );
}

/* ------------------------------------------------------------------ */
/* Datos de demostración: dos cuentas para entrar y una semana de uso. */

export const CUENTAS_DEMO = Object.freeze({
  estudiante: { correo: "estudiante@alapar.demo", clave: "Estudiante2026" },
  admin: { correo: "admin@alapar.demo", clave: "Admin2026" }
});

const PERSONAS = [
  // nombre, correo, carrera, hace (días)
  ["Administración A la Par", CUENTAS_DEMO.admin.correo, null, 30, "admin"],
  ["Estudiante Demo", CUENTAS_DEMO.estudiante.correo, "Lic. en Ingeniería de Software", 21],
  ["Carlos Méndez", "carlos.mendez@correo.demo", "Ing. de Sistemas y Computación", 20],
  ["Stephanie Pinzón", "stephanie.pinzon@correo.demo", "Ing. Industrial", 17],
  ["Fernando Ríos", "fernando.rios@correo.demo", "Ing. Eléctrica y Electrónica", 15],
  ["Yaritza Castillo", "yaritza.castillo@correo.demo", "Ing. Civil", 12],
  ["Diego Saldaña", "diego.saldana@correo.demo", "Ing. Mecánica", 10],
  ["Katherine Vega", "katherine.vega@correo.demo", "Lic. en Ingeniería de Software", 8],
  ["José Montenegro", "jose.montenegro@correo.demo", "Ing. de Sistemas y Computación", 5],
  ["Ana Lucía Herrera", "analucia.herrera@correo.demo", "Ing. Industrial", 3],
  ["Ricardo Arosemena", "ricardo.arosemena@correo.demo", "Ing. Civil", 2]
];

// folio, correo, hace días, hace horas, estado, método, referencia, ofrece, líneas [tutor, materia, modalidad, horas]
const RESERVAS = [
  ["RES-DEMO-01", "carlos.mendez@correo.demo", 18, 6, "pagada", "yappy", "YAP-48302915", null, [["maria-castillo", "CAL-2", "presencial", 2]]],
  ["RES-DEMO-02", "stephanie.pinzon@correo.demo", 16, 3, "pagada", "tarjeta", "TJ-4242-7QK2M9", null, [["jose-pimentel", "EST-1", "virtual", 3], ["jose-pimentel", "IOP-1", "presencial", 1]]],
  ["RES-DEMO-03", "fernando.rios@correo.demo", 14, 9, "pagada", "intercambio", "INT-5C81A2", "PRO-1", [["ana-rios", "CIR-1", "presencial", 2]]],
  ["RES-DEMO-04", CUENTAS_DEMO.estudiante.correo, 13, 4, "pagada", "yappy", "YAP-11820374", null, [["gabriel-samaniego", "BDD-1", "virtual", 2]]],
  ["RES-DEMO-05", "yaritza.castillo@correo.demo", 11, 7, "pagada", "yappy", "YAP-90213557", null, [["daniela-chen", "ESTA-1", "presencial", 3]]],
  ["RES-DEMO-06", "diego.saldana@correo.demo", 9, 2, "pagada", "tarjeta", "TJ-4242-P3LX8D", null, [["luis-batista", "TER-1", "presencial", 2], ["daniela-chen", "CAL-3", "virtual", 2]]],
  ["RES-DEMO-07", "katherine.vega@correo.demo", 7, 5, "pagada", "yappy", "YAP-66401829", null, [["gabriel-samaniego", "WEB-1", "virtual", 1], ["kevin-rodriguez", "RED-1", "virtual", 2]]],
  ["RES-DEMO-08", "carlos.mendez@correo.demo", 6, 8, "pagada", "tarjeta", "TJ-4242-Z81NQW", null, [["maria-castillo", "EDD-1", "virtual", 2], ["andres-tejada", "ECU-1", "presencial", 2]]],
  ["RES-DEMO-09", "jose.montenegro@correo.demo", 4, 6, "pagada", "yappy", "YAP-20739461", "EST-1", [["valeria-quintero", "CAL-1", "presencial", 2], ["maria-castillo", "PRO-2", "presencial", 1]]],
  ["RES-DEMO-10", CUENTAS_DEMO.estudiante.correo, 3, 2, "pagada", "intercambio", "INT-9D04F7", "WEB-1", [["valeria-quintero", "ALG-1", "presencial", 1]]],
  ["RES-DEMO-11", "analucia.herrera@correo.demo", 2, 10, "pendiente", null, null, null, [["jose-pimentel", "IEC-1", "virtual", 2]]],
  ["RES-DEMO-12", "ricardo.arosemena@correo.demo", 1, 7, "pagada", "tarjeta", "TJ-4242-H6T2RB", null, [["daniela-chen", "RMA-1", "presencial", 4]]],
  ["RES-DEMO-13", "stephanie.pinzon@correo.demo", 0, 9, "pagada", "yappy", "YAP-57310284", null, [["andres-tejada", "SYS-1", "virtual", 1]]],
  ["RES-DEMO-14", "fernando.rios@correo.demo", 0, 3, "pendiente", null, null, null, [["luis-batista", "FIS-1", "virtual", 2]]]
];

const DISPONIBILIDAD = [
  "Martes y jueves después de las 4:00 p. m.",
  "Lunes a miércoles por la mañana; el parcial es el viernes.",
  "Fines de semana, preferiblemente sábado temprano.",
  "Cualquier día después de las 6:00 p. m., en línea.",
  "Miércoles y viernes entre clases, en la biblioteca."
];

async function sembrarDemo(q) {
  const claveEstudiante = await hashClave(CUENTAS_DEMO.estudiante.clave);
  const claveAdmin = await hashClave(CUENTAS_DEMO.admin.clave);
  // Las demás personas de la demostración no pueden entrar: su contraseña es aleatoria.
  const claveBloqueada = await hashClave(randomUUID());

  const usuarios = PERSONAS.map(([nombre, correo, carrera, dias, rol = "estudiante"]) => ({
    nombre, correo, carrera, dias, rol,
    clave: correo === CUENTAS_DEMO.admin.correo ? claveAdmin
      : correo === CUENTAS_DEMO.estudiante.correo ? claveEstudiante : claveBloqueada
  }));
  await q(
    `insert into usuarios (nombre, correo, clave, rol, carrera, demo, creado)
     select u.nombre, u.correo, u.clave, u.rol, u.carrera, true, now() - make_interval(days => u.dias, hours => 2)
       from jsonb_to_recordset($1::jsonb) as u(nombre text, correo text, clave text, rol text, carrera text, dias int)
     on conflict ((lower(correo))) do nothing`,
    [JSON.stringify(usuarios)]
  );

  const tarifas = new Map(TUTORES.map((t) => [t.id, t.precio]));
  const reservas = [];
  const lineas = [];
  RESERVAS.forEach(([folio, correo, dias, horasAtras, estado, metodo, referencia, ofrece, detalle], i) => {
    const filas = detalle.map(([tutor, materia, modalidad, horas]) => {
      const precioHora = tarifas.get(tutor) ?? 0;
      return { folio, tutor, materia, modalidad, horas, precio_hora: precioHora, subtotal: precioHora * horas, intercambio: precioHora === 0, precioHora };
    });
    const importes = calcularImportes(filas);
    reservas.push({
      folio, correo, estado, metodo, referencia, ofrece, dias, horas_atras: horasAtras,
      telefono: `6${String(1000000 + i * 734219).slice(-7)}`,
      disponibilidad: DISPONIBILIDAD[i % DISPONIBILIDAD.length],
      horas: importes.horas, subtotal: importes.subtotal, descuento: importes.descuento, total: importes.total
    });
    lineas.push(...filas.map(({ precioHora, ...fila }) => fila));
  });

  await q(
    `insert into reservas (folio, usuario_id, estado, telefono, disponibilidad, ofrece, horas, subtotal, descuento, total,
                           metodo_pago, referencia, creada, pagada)
     select r.folio, u.id, r.estado, r.telefono, r.disponibilidad, r.ofrece, r.horas, r.subtotal, r.descuento, r.total,
            r.metodo, r.referencia,
            now() - make_interval(days => r.dias, hours => r.horas_atras),
            case when r.estado = 'pagada'
                 then now() - make_interval(days => r.dias, hours => r.horas_atras) + interval '3 minutes' end
       from jsonb_to_recordset($1::jsonb)
         as r(folio text, correo text, estado text, metodo text, referencia text, ofrece text, dias int, horas_atras int,
              telefono text, disponibilidad text, horas int, subtotal numeric, descuento numeric, total numeric)
       join usuarios u on lower(u.correo) = lower(r.correo)
     on conflict (folio) do nothing`,
    [JSON.stringify(reservas)]
  );
  await q(
    `insert into reserva_lineas (reserva_id, tutor_id, materia, modalidad, horas, precio_hora, subtotal, intercambio)
     select r.id, l.tutor, l.materia, l.modalidad, l.horas, l.precio_hora, l.subtotal, l.intercambio
       from jsonb_to_recordset($1::jsonb)
         as l(folio text, tutor text, materia text, modalidad text, horas int, precio_hora numeric, subtotal numeric, intercambio boolean)
       join reservas r on r.folio = l.folio
     on conflict (reserva_id, tutor_id, materia, modalidad) do nothing`,
    [JSON.stringify(lineas)]
  );
}
