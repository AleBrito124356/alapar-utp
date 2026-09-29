// =====================================================================
// api/_lib/db.js — Acceso a PostgreSQL.
//
// En producción la base es Neon y se habla con ella por HTTP
// (@neondatabase/serverless), que es lo que mejor encaja con funciones que
// arrancan y se apagan. El servidor de desarrollo puede inyectar su propia
// conexión (PGlite, Postgres en WebAssembly) en globalThis.__alaparBase, así
// el código de producción no depende de nada local.
//
// Todas las consultas van parametrizadas ($1, $2…): nunca se pega texto del
// usuario dentro del SQL.
// =====================================================================
import { neon } from "@neondatabase/serverless";
import { ErrorHttp } from "./http.js";
import { asegurarEsquema } from "./esquema.js";

let conexion = null;
let preparada = null;

function abrir() {
  if (globalThis.__alaparBase) return globalThis.__alaparBase;
  if (conexion) return conexion;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    throw new ErrorHttp(503, "sin_base_de_datos", "El servidor todavía no tiene base de datos configurada.");
  }
  const cliente = neon(url);
  conexion = { consulta: (texto, params) => cliente.query(texto, params) };
  return conexion;
}

/** Las fechas salen como texto ISO: igual en Neon y en PGlite, y listas para JSON. */
function normalizar(filas) {
  for (const fila of filas) {
    for (const [clave, valor] of Object.entries(fila)) {
      if (valor instanceof Date) fila[clave] = valor.toISOString();
    }
  }
  return filas;
}

/** Ejecuta una consulta sin preparar el esquema (lo usa la propia migración). */
export async function consultaCruda(texto, params = []) {
  return normalizar(await abrir().consulta(texto, params));
}

/** Ejecuta una consulta; la primera vez de cada instancia se asegura el esquema. */
export async function consulta(texto, params = []) {
  preparada ??= asegurarEsquema(consultaCruda).catch((error) => { preparada = null; throw error; });
  await preparada;
  return consultaCruda(texto, params);
}

/** Etiqueta de plantilla: sql`select * from t where id = ${id}` → consulta parametrizada. */
export function sql(partes, ...valores) {
  let texto = partes[0];
  for (let i = 0; i < valores.length; i++) texto += `$${i + 1}` + partes[i + 1];
  return consulta(texto, valores);
}

export async function una(texto, params = []) {
  const filas = await consulta(texto, params);
  return filas[0] ?? null;
}
