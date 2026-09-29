// =====================================================================
// Prueba de la API de A la Par contra el servidor de desarrollo con una
// base PGlite en memoria (limpia en cada ejecución).
//
// Uso: node pruebas/api.prueba.mjs
// =====================================================================
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUERTO = 5191;
const BASE = `http://localhost:${PUERTO}`;

let fallos = 0;
const ok = (condicion, texto) => {
  console.log(`${condicion ? "  ✓" : "  ✗"} ${texto}`);
  if (!condicion) fallos++;
};

/** Cliente con su propia cookie de sesión, como un navegador. */
class Cliente {
  cookie = "";
  async pedir(metodo, ruta, cuerpo, cabeceras = {}) {
    const respuesta = await fetch(BASE + ruta, {
      method: metodo,
      headers: {
        ...(cuerpo !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(this.cookie ? { Cookie: this.cookie } : {}),
        Origin: BASE,
        ...cabeceras
      },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined
    });
    const galleta = respuesta.headers.get("set-cookie");
    if (galleta) this.cookie = galleta.split(";")[0].endsWith("=") ? "" : galleta.split(";")[0];
    let datos = null;
    try { datos = await respuesta.json(); } catch (_) { /* sin cuerpo */ }
    return { estado: respuesta.status, datos, galleta };
  }
}

const servidor = spawn(process.execPath, [path.join(RAIZ, "desarrollo", "servidor.mjs"), "--memoria", "--puerto", String(PUERTO)], { cwd: RAIZ });
let salida = "";
servidor.stdout.on("data", (d) => { salida += d; });
servidor.stderr.on("data", (d) => { salida += d; });
for (let i = 0; i < 100 && !salida.includes("http://localhost"); i++) await new Promise((r) => setTimeout(r, 100));

try {
  const anonimo = new Cliente();
  console.log("Sesión");
  let r = await anonimo.pedir("GET", "/api/auth/yo");
  ok(r.estado === 200 && r.datos.usuario === null, "sin sesión, /yo devuelve usuario null");

  r = await anonimo.pedir("POST", "/api/auth/entrar", { correo: "estudiante@alapar.demo", clave: "mala-clave" });
  ok(r.estado === 401 && r.datos.error === "credenciales_invalidas", "contraseña equivocada → 401");
  r = await anonimo.pedir("POST", "/api/auth/entrar", { correo: "nadie@alapar.demo", clave: "loquesea123" });
  ok(r.estado === 401, "correo inexistente → el mismo 401, sin delatar cuentas");

  r = await anonimo.pedir("POST", "/api/auth/entrar", { correo: "estudiante@alapar.demo", clave: "Estudiante2026" }, { Origin: "https://otro-sitio.example" });
  ok(r.estado === 403 && r.datos.error === "origen_no_permitido", "entrar desde otro origen → 403");

  const estudiante = new Cliente();
  r = await estudiante.pedir("POST", "/api/auth/entrar", { correo: "Estudiante@Alapar.demo", clave: "Estudiante2026" });
  ok(r.estado === 200 && r.datos.usuario.rol === "estudiante", "la cuenta demo de estudiante entra (correo sin distinguir mayúsculas)");
  ok(/HttpOnly/.test(r.galleta) && /SameSite=Lax/.test(r.galleta) && !/Estudiante2026/.test(r.galleta), "cookie HttpOnly + SameSite=Lax, sin datos dentro");
  ok(!("clave" in r.datos.usuario), "la respuesta nunca incluye el hash de la contraseña");
  r = await estudiante.pedir("GET", "/api/auth/yo");
  ok(r.datos.usuario?.correo === "estudiante@alapar.demo", "/yo reconoce la sesión");

  r = await estudiante.pedir("GET", "/api/admin/resumen");
  ok(r.estado === 403, "un estudiante no puede ver el panel de administración");
  r = await anonimo.pedir("GET", "/api/admin/resumen");
  ok(r.estado === 401, "sin sesión tampoco");

  console.log("Reservas");
  r = await anonimo.pedir("POST", "/api/reservas", { lineas: [] });
  ok(r.estado === 401, "reservar sin sesión → 401");

  const pedidoValido = {
    telefono: "6123-4567",
    disponibilidad: "Martes y jueves después de las 4:00 p. m.",
    lineas: [
      { tutor: "maria-castillo", materia: "CAL-2", modalidad: "presencial", horas: 3, precioHora: 0.01 },
      { tutor: "daniela-chen", materia: "ESTA-1", modalidad: "virtual", horas: 1, subtotal: 0 }
    ]
  };
  r = await estudiante.pedir("POST", "/api/reservas", pedidoValido, { "Content-Type": "text/plain" });
  ok(r.estado === 415, "una petición que no es JSON → 415 (protección CSRF)");

  r = await estudiante.pedir("POST", "/api/reservas", { ...pedidoValido, lineas: [{ tutor: "maria-castillo", materia: "FIS-1", modalidad: "presencial", horas: 1 }] });
  ok(r.estado === 422 && r.datos.error === "linea_invalida", "una materia que el tutor no da → 422");
  r = await estudiante.pedir("POST", "/api/reservas", { ...pedidoValido, lineas: [{ tutor: "maria-castillo", materia: "CAL-2", modalidad: "presencial", horas: 9 }] });
  ok(r.estado === 422, "más de 8 horas por línea → 422");
  r = await estudiante.pedir("POST", "/api/reservas", { ...pedidoValido, telefono: "1234" });
  ok(r.estado === 422 && r.datos.detalles?.telefono, "teléfono que no es de Panamá → 422 con el campo señalado");

  r = await estudiante.pedir("POST", "/api/reservas", pedidoValido);
  const reserva = r.datos?.reserva;
  ok(r.estado === 201 && reserva?.estado === "pendiente", `reserva creada pendiente de pago (${reserva?.folio})`);
  ok(reserva?.subtotal === 26 && reserva?.descuento === 2.6 && reserva?.total === 23.4, "el servidor ignora los precios del navegador: $26.00 − 10 % = $23.40");
  ok(/^RES-\d{6}-\d{4,}$/.test(reserva?.folio ?? ""), "folio con fecha de Panamá y secuencia");
  ok(reserva?.lineas?.length === 2 && reserva.lineas[0].tutorNombre === "María Fernanda Castillo", "las sesiones vienen con nombres de tutor y materia");

  console.log("Pago simulado");
  r = await estudiante.pedir("POST", "/api/reservas/pagar", { folio: reserva.folio, metodo: "tarjeta", ultimos4: "1111" });
  ok(r.estado === 422 && r.datos.detalles?.tarjeta, "una tarjeta que no es la de prueba → 422");
  r = await estudiante.pedir("POST", "/api/reservas/pagar", { folio: reserva.folio, metodo: "yappy", telefono: "2345678" });
  ok(r.estado === 422, "Yappy exige un celular");
  const intruso = new Cliente();
  await intruso.pedir("POST", "/api/auth/registro", { nombre: "Intruso Prueba", correo: "intruso@prueba.test", clave: "unaClaveLarga1" });
  r = await intruso.pedir("POST", "/api/reservas/pagar", { folio: reserva.folio, metodo: "tarjeta", ultimos4: "4242" });
  ok(r.estado === 404, "nadie puede pagar (ni ver) la reserva de otra persona");
  r = await estudiante.pedir("POST", "/api/reservas/pagar", { folio: reserva.folio, metodo: "tarjeta", ultimos4: "4242" });
  ok(r.estado === 200 && r.datos.reserva.estado === "pagada" && /^TJ-4242-[A-Z0-9]{6}$/.test(r.datos.reserva.referencia), `pago con la tarjeta de prueba (${r.datos?.reserva?.referencia})`);
  r = await estudiante.pedir("POST", "/api/reservas/pagar", { folio: reserva.folio, metodo: "tarjeta", ultimos4: "4242" });
  ok(r.estado === 409, "pagar dos veces → 409");

  console.log("Intercambio");
  const soloIntercambio = { telefono: "61234567", disponibilidad: "Sábados por la mañana, en la biblioteca.", lineas: [{ tutor: "ana-rios", materia: "FIS-2", modalidad: "presencial", horas: 2 }] };
  r = await estudiante.pedir("POST", "/api/reservas", soloIntercambio);
  ok(r.estado === 422 && r.datos.detalles?.ofrece, "intercambio sin materia a cambio → 422");
  r = await estudiante.pedir("POST", "/api/reservas", { ...soloIntercambio, ofrece: "PRO-1" });
  const intercambio = r.datos?.reserva;
  ok(r.estado === 201 && intercambio?.total === 0 && intercambio?.ofreceNombre === "Programación I", "reserva de intercambio: total $0 y materia a cambio");
  r = await estudiante.pedir("POST", "/api/reservas/pagar", { folio: intercambio.folio, metodo: "yappy", telefono: "61234567" });
  ok(r.estado === 422, "una reserva de intercambio no se paga con dinero");
  r = await estudiante.pedir("POST", "/api/reservas/pagar", { folio: intercambio.folio, metodo: "intercambio" });
  ok(r.estado === 200 && r.datos.reserva.metodoPago === "intercambio" && /^INT-/.test(r.datos.reserva.referencia), "el intercambio se confirma");

  r = await estudiante.pedir("GET", "/api/reservas");
  ok(r.estado === 200 && r.datos.reservas.length === 4, `«Mis reservas» trae las 2 nuevas y las 2 de la demo (${r.datos?.reservas?.length})`);

  console.log("Registro");
  const nuevo = new Cliente();
  r = await nuevo.pedir("POST", "/api/auth/registro", { nombre: "Ana", correo: "ana@", clave: "123" });
  ok(r.estado === 422 && r.datos.detalles?.correo && r.datos.detalles?.clave, "datos inválidos → 422 con cada campo señalado");
  r = await nuevo.pedir("POST", "/api/auth/registro", { nombre: "Laura Prueba Registro", correo: "laura@prueba.test", clave: "unaClaveLarga1", carrera: "Ing. Civil", rol: "admin" });
  ok(r.estado === 201 && r.datos.usuario.rol === "estudiante", "registro nuevo → 201; el rol que manda el navegador se ignora");
  r = await new Cliente().pedir("POST", "/api/auth/registro", { nombre: "Otra Laura", correo: "LAURA@prueba.test", clave: "otraClaveLarga2" });
  ok(r.estado === 409 && r.datos.error === "correo_en_uso", "el mismo correo no se registra dos veces");

  console.log("Administración");
  const admin = new Cliente();
  r = await admin.pedir("POST", "/api/auth/entrar", { correo: "admin@alapar.demo", clave: "Admin2026" });
  ok(r.estado === 200 && r.datos.usuario.rol === "admin", "la cuenta demo de administrador entra");
  r = await admin.pedir("GET", "/api/admin/resumen");
  const panel = r.datos;
  ok(r.estado === 200, "el administrador ve el panel");
  ok(panel.usuarios.some((u) => u.correo === "laura@prueba.test"), "la persona recién registrada aparece en la lista");
  ok(panel.reservas.some((x) => x.folio === reserva.folio && x.usuarioCorreo === "estudiante@alapar.demo"), "y la compra recién pagada también");
  ok(panel.kpis.reservas === 16 && panel.kpis.estudiantes === 12, `cifras: ${panel.kpis.reservas} reservas, ${panel.kpis.estudiantes} estudiantes`);
  ok(panel.serie.length === 14 && panel.serie.at(-1).reservas >= 2, "serie de los últimos 14 días, con las reservas de hoy");
  ok(panel.tutores.length === 9 && panel.tutores[0].horas >= panel.tutores.at(-1).horas, "tutores ordenados por horas vendidas");

  r = await estudiante.pedir("POST", "/api/auth/salir", {});
  ok(r.estado === 200 && /Max-Age=0/.test(r.galleta), "salir borra la cookie");
  r = await estudiante.pedir("GET", "/api/auth/yo");
  ok(r.datos.usuario === null, "y la sesión deja de valer");
} catch (error) {
  console.error(error);
  fallos++;
} finally {
  servidor.kill();
}

if (fallos) console.log("\n--- salida del servidor ---\n" + salida.split("\n").slice(-25).join("\n"));
console.log(fallos ? `\n${fallos} comprobación(es) fallida(s)` : "\nAPI: todo correcto");
process.exit(fallos ? 1 : 0);
