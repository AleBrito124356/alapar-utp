// =====================================================================
// Prueba de extremo a extremo de A la Par en Chromium (Playwright).
//
// Recorre el sitio como una persona: arma el carrito, entra con la cuenta
// demo sin perderlo, paga en la caja simulada (tarjeta de prueba y Yappy),
// confirma un intercambio, revisa «Mis reservas», crea una cuenta nueva y
// entra al panel de administración. Con una carpeta como segundo argumento
// guarda las capturas del README.
//
// Uso:
//   node pruebas/sitio.e2e.mjs                         → levanta su propio servidor
//   node pruebas/sitio.e2e.mjs https://alapar-utp.vercel.app/   (sitio publicado)
//   node pruebas/sitio.e2e.mjs "" docs/capturas        → y guarda capturas
// =====================================================================
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CAPTURAS = process.argv[3] || null;
let BASE = process.argv[2] || "";
let servidor = null;
if (!BASE) {
  const puerto = 5193;
  servidor = spawn(process.execPath, [path.join(RAIZ, "desarrollo", "servidor.mjs"), "--memoria", "--puerto", String(puerto)], { cwd: RAIZ });
  let salida = "";
  servidor.stdout.on("data", (d) => { salida += d; });
  for (let i = 0; i < 100 && !salida.includes("http://localhost"); i++) await new Promise((r) => setTimeout(r, 100));
  BASE = `http://localhost:${puerto}/`;
}
if (CAPTURAS) fs.mkdirSync(CAPTURAS, { recursive: true });
const PUBLICO = !servidor;   // contra el sitio publicado se usan correos únicos
const sello = Date.now().toString(36);

let fallos = 0;
const ok = (condicion, texto) => { console.log(`${condicion ? "  ✓" : "  ✗"} ${texto}`); if (!condicion) fallos++; };
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const navegador = await chromium.launch();
const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const hoja = await ctx.newPage();
const errores = [];
hoja.on("pageerror", (e) => errores.push("pageerror: " + e.message));
hoja.on("console", (m) => { if (m.type() === "error" && !/401|403/.test(m.text())) errores.push("console: " + m.text()); });

const foto = async (nombre, pagina = hoja) => {
  if (!CAPTURAS) return;
  // Los avisos flotantes de pasos anteriores no salen en las capturas.
  await pagina.evaluate(() => document.querySelectorAll(".toast.show").forEach((t) => t.classList.remove("show")));
  await pagina.screenshot({ path: path.join(CAPTURAS, nombre), type: "jpeg", quality: 84 });
};
const texto = (sel) => hoja.locator(sel).first().innerText();
const ir = async (ruta) => { await hoja.goto(BASE + ruta, { waitUntil: "load" }); await esperar(700); };
const alBorde = async (sel, margen = 130) => {
  await hoja.evaluate(([s, m]) => { const el = document.querySelector(s); window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - m); }, [sel, margen]);
  await esperar(900);
};
async function anadir(tutor, { horasExtra = 0, modalidad = null, materia = null, captura = null } = {}) {
  await hoja.locator(`#listaTutores [data-agregar-tutor="${tutor}"]`).click();
  await hoja.locator("#modalReserva.show").waitFor();
  await esperar(350);
  if (materia) await hoja.locator("#reservaMateria").selectOption(materia);
  if (modalidad) await hoja.locator(`#reservaModalidad-${modalidad}`).check();
  for (let i = 0; i < horasExtra; i++) await hoja.locator('#modalReserva [data-horas="1"]').click();
  if (captura) await foto(captura);
  await hoja.locator('#modalReserva button[type="submit"]').click();
  await hoja.locator("#carritoLateral.show").waitFor();
  await esperar(500);
}
const cerrarLateral = async () => { await hoja.locator("#carritoLateral .btn-close").click(); await esperar(600); };

try {
  /* ---------- 1. Inicio y catálogo ---------- */
  console.log("Inicio");
  await ir("index.html");
  await foto("01-inicio.jpg");
  ok(await hoja.locator("[data-carrito-boton]").isVisible(), "botón del carrito en la cabecera");
  ok(await hoja.locator("[data-sesion-invitado]").first().isVisible(), "botón «Entrar» en la cabecera (sin sesión)");

  console.log("Carrito");
  await ir("tutores.html");
  ok((await hoja.locator("[data-agregar-tutor]").count()) === 9, "9 tutores con «Al carrito»");
  await anadir("maria-castillo", { horasExtra: 2, materia: "EDD-1", captura: "03-reservar.jpg" });
  ok((await texto("[data-carrito-num]")) === "3", "3 horas en el contador");
  await cerrarLateral();
  await anadir("daniela-chen", { modalidad: "virtual" });
  let resumen = await hoja.locator("#carritoLateral [data-carrito-resumen]").innerText();
  ok(resumen.includes("$26.00") && resumen.includes("$23.40"), "4 h pagadas: $26.00 − 10 % = $23.40");
  await cerrarLateral();
  await anadir("ana-rios", { horasExtra: 1 });
  await foto("04-carrito-lateral.jpg");
  await cerrarLateral();
  await hoja.setViewportSize({ width: 1440, height: 1080 });
  await alBorde("#listaTutores", 170);
  await foto("02-tutores.jpg");
  await hoja.setViewportSize({ width: 1440, height: 900 });

  /* ---------- 2. Entrar sin perder el carrito ---------- */
  console.log("Reserva con cuenta");
  await ir("carrito.html");
  ok(await hoja.locator("#accesoRequerido").isVisible(), "sin sesión, el carrito pide entrar");
  ok(await hoja.locator("#datosReserva").isHidden(), "y no muestra el formulario");
  await hoja.locator("#entrarDemo").click();
  await hoja.locator("#datosReserva").waitFor({ state: "visible" });
  await esperar(400);
  ok((await texto("#datosReserva [data-sesion-nombre]")) === "Estudiante Demo", "entra con la cuenta demo sin salir del carrito");
  ok((await texto("[data-carrito-num]")) === "6", "el carrito sigue intacto (6 h)");
  ok(await hoja.locator("[data-sesion-menu] [data-sesion-boton]").isVisible(), "la cabecera muestra las iniciales de la cuenta");

  await hoja.locator('#formularioReserva button[type="submit"]').click();
  await esperar(400);
  ok((await hoja.locator("#formularioReserva .is-invalid").count()) >= 4, "enviar vacío marca teléfono, materia a cambio, disponibilidad y aceptación");
  await hoja.fill("#telefono", "6123-4567");
  await hoja.selectOption("#ofrece", "PRO-1");
  await hoja.fill("#disponibilidad", "Martes y jueves después de las 4:00 p. m.; el parcial es el viernes.");
  await hoja.evaluate(() => document.getElementById("acepto").scrollIntoView({ block: "center", behavior: "instant" }));
  await hoja.locator("#acepto").check();
  await alBorde("#sesiones-titulo");
  await foto("05-carrito.jpg");
  await hoja.locator('#formularioReserva button[type="submit"]').click();

  /* ---------- 3. La caja: tarjeta de prueba ---------- */
  console.log("Caja · tarjeta de prueba");
  await hoja.locator("#modalCaja.show").waitFor();
  await esperar(1100);
  const folio = (await texto(".recibo__folio")).trim();
  ok(/^RES-\d{6}-\d{4,}$/.test(folio), `la reserva se creó en el servidor (${folio})`);
  ok((await texto(".caja__recibo .recibo__total")).includes("$23.40"), "el recibo trae el total calculado por el servidor");
  ok(await hoja.locator("[data-carrito-num]").isHidden(), "el carrito se vació al guardar la reserva");
  ok((await texto(".caja__intercambio")).includes("Programación I"), "la caja recuerda el intercambio acordado");
  await foto("10-caja-metodo.jpg");

  await hoja.locator('[data-metodo="tarjeta"]').click();
  await hoja.fill("#cajaNumero", "4000 0000 0000 0002");
  await hoja.fill("#cajaNombre", "Estudiante Demo");
  await hoja.fill("#cajaVence", "12/29");
  await hoja.fill("#cajaCvc", "123");
  await hoja.locator('.caja__form button[type="submit"]').click();
  await esperar(300);
  ok((await texto('[data-campo="numero"] .invalid-feedback')).includes("tarjeta de prueba"), "rechaza una tarjeta que no es la de prueba (sin enviarla)");
  await hoja.locator("[data-usar-prueba]").click();
  await hoja.locator("#cajaCvc").focus();
  await esperar(600);
  ok(await hoja.locator(".caja [data-tarjeta].is-volteada").isVisible(), "la tarjeta dibujada se voltea al escribir el CVC");
  await hoja.locator("#cajaNombre").focus();
  await esperar(600);
  await foto("11-caja-tarjeta.jpg");
  await hoja.locator('.caja__form button[type="submit"]').click();
  await esperar(900);
  ok(await hoja.locator(".caja-proceso .barra-proceso").isVisible(), "procesando: barra y tarjeta leyéndose");
  ok(await hoja.locator("[data-caja-cerrar]").isDisabled(), "mientras se procesa no se puede cerrar la caja");
  await hoja.locator(".caja-exito").waitFor({ timeout: 15000 });
  await hoja.locator(".intercambio.is-acordado").waitFor({ timeout: 15000 });
  await esperar(500);
  ok((await texto(".caja-exito h3")).includes("Pago aprobado"), "¡Pago aprobado!");
  ok(await hoja.locator(".caja__recibo .sello.is-puesto").isVisible(), "el sello «Pagado» quedó en el recibo");
  ok(/^TJ-4242-/.test(await texto(".caja-exito__datos dd")), "referencia de la tarjeta de prueba");
  ok(/recibes/i.test(await hoja.locator(".intercambio .ficha").first().innerText()), "las fichas del intercambio cambiaron de lugar");
  await foto("12-caja-pagado.jpg");
  await hoja.locator("[data-caja-cerrar]").click();
  await esperar(700);
  ok((await texto("#avisoReserva")).includes("confirmada"), "al cerrar, el carrito avisa que la reserva quedó confirmada");

  /* ---------- 4. Reserva pendiente que se paga después con Yappy ---------- */
  console.log("Pendiente y Yappy");
  await ir("tutores.html");
  await anadir("kevin-rodriguez");
  await hoja.goto(BASE + "carrito.html");
  await esperar(700);
  await hoja.fill("#telefono", "6987-6543");
  await hoja.fill("#disponibilidad", "Sábados por la mañana, en línea.");
  await hoja.locator("#acepto").check();
  await hoja.locator('#formularioReserva button[type="submit"]').click();
  await hoja.locator("#modalCaja.show").waitFor();
  await esperar(900);
  const folioPendiente = (await texto(".recibo__folio")).trim();
  await hoja.locator("[data-caja-cerrar]").click();
  await esperar(800);
  ok((await texto("#avisoReserva")).includes("pendiente"), `cerrar sin pagar deja ${folioPendiente} pendiente`);

  await ir("mi-cuenta.html");
  await hoja.locator(".reserva-cuenta").first().waitFor();
  ok((await hoja.locator(".reserva-cuenta").count()) === 4, "«Mis reservas»: las 2 nuevas y las 2 de la demo");
  ok(await hoja.locator("#cuentaPendientes").isVisible(), "avisa de la reserva pendiente");
  await esperar(1900);   // que terminen de contar las cifras
  await foto("13-mi-cuenta.jpg");
  await hoja.locator(`[data-pagar="${folioPendiente}"]`).click();
  await hoja.locator("#modalCaja.show").waitFor();
  await esperar(900);
  ok((await hoja.locator("#cajaYappy").inputValue()) === "6987-6543", "Yappy trae el celular de la reserva");
  await hoja.locator('.caja__form button[type="submit"]').click();
  await hoja.locator('.notificacion__aprobar.is-tocado').waitFor({ timeout: 8000 });
  await esperar(150);
  await foto("14-caja-yappy.jpg");
  await hoja.locator(".caja-exito").waitFor({ timeout: 15000 });
  await esperar(900);
  ok(/^YAP-\d{8}$/.test(await texto(".caja-exito__datos dd")), "pago con Yappy aprobado");
  await hoja.locator("[data-caja-cerrar]").click();
  await esperar(1200);
  ok(await hoja.locator("#cuentaPendientes").isHidden(), "ya no quedan reservas pendientes");

  /* ---------- 5. Salir y crear una cuenta ---------- */
  console.log("Cuentas");
  await hoja.locator("[data-sesion-menu] [data-sesion-boton]").click();
  await esperar(300);
  ok(await hoja.locator(".menu-cuenta.show").isVisible(), "el menú de la cuenta se despliega");
  await hoja.locator(".menu-cuenta [data-sesion-salir]").click();
  await hoja.waitForURL(/entrar/, { timeout: 5000 });
  await esperar(600);
  ok(await hoja.locator("[data-sesion-invitado]").first().isVisible(), "cerrar sesión lleva a «Entrar»");
  await foto("15-entrar.jpg");

  await hoja.locator("#pestanaRegistro").click();
  await esperar(350);
  const correoNuevo = `laura.${PUBLICO ? sello : "prueba"}@prueba.test`;
  await hoja.fill("#registroNombre", "Laura Prueba");
  await hoja.fill("#registroCorreo", correoNuevo);
  await hoja.fill("#registroClave", "corta");
  await hoja.locator("#registroAcepto").check();
  await hoja.locator('#formRegistro button[type="submit"]').click();
  await esperar(300);
  ok((await texto('#formRegistro [data-campo="clave"] .invalid-feedback')).includes("8 caracteres"), "contraseña corta rechazada en el navegador");
  await hoja.fill("#registroClave", "unaClaveLarga1");
  await hoja.locator('#formRegistro button[type="submit"]').click();
  await hoja.waitForURL(/mi-cuenta/, { timeout: 8000 });
  await esperar(900);
  ok((await texto("#cuentaNombre")) === "Laura", "la cuenta nueva entra directo a «Mis reservas»");
  ok((await texto("#listaReservas")).includes("Aún no has reservado"), "y todavía no tiene reservas");
  await ir("admin.html");
  ok(await hoja.locator("#adminSinPermiso").isVisible(), "una cuenta de estudiante no ve el panel");
  await hoja.locator("[data-sesion-menu] [data-sesion-boton]").click();
  await hoja.locator(".menu-cuenta [data-sesion-salir]").click();
  await hoja.waitForURL(/entrar/, { timeout: 5000 });
  await esperar(500);

  /* ---------- 6. Administración ---------- */
  console.log("Administración");
  await hoja.locator('.notas-demo [data-demo="admin"]').click();
  await hoja.waitForURL(/admin/, { timeout: 8000 });
  await hoja.locator("#tablaCompras tbody tr").first().waitFor();
  await esperar(1800);
  ok(await hoja.locator("[data-sesion-menu] .is-admin").isVisible(), "la cabecera marca la cuenta de administración");
  ok((await hoja.locator("#tablaCompras tbody tr").filter({ hasText: folio }).count()) === 1, "la compra pagada con tarjeta está en «Compras»");
  ok((await hoja.locator("#tablaPersonas tbody tr").filter({ hasText: correoNuevo }).count()) === 1, "la persona recién registrada está en «Personas registradas»");
  ok((await hoja.locator("#graficoDias .grafico__col").count()) === 14, "gráfico de 14 días");
  await foto("16-admin.jpg");
  await hoja.locator('#filtrosCompras [data-filtro="pendientes"]').click();
  await esperar(250);
  const pendientes = await hoja.locator("#tablaCompras tbody tr[data-folio]").count();
  ok(pendientes >= 1 && (await texto("#conteoCompras")).startsWith(String(pendientes)), `filtro «Pendientes» (${pendientes})`);
  await hoja.locator('#filtrosCompras [data-filtro="todas"]').click();
  await hoja.fill("#buscarCompras", folio);
  await esperar(300);
  ok((await hoja.locator("#tablaCompras tbody tr[data-folio]").count()) === 1, "la búsqueda encuentra la compra por folio");
  await hoja.locator("#tablaCompras tbody tr[data-folio] .enlace-folio").click();
  await hoja.locator("#detalleCompra.show").waitFor();
  await esperar(600);
  ok((await texto("#detalleCompra")).includes("6123-4567"), "el detalle muestra el recibo y los datos de contacto");
  await foto("17-admin-detalle.jpg");
  await hoja.locator("#detalleCompra .btn-close").click();
  await esperar(400);
  await alBorde("#graficoDias", 180);
  await hoja.locator("#graficoDias .grafico__col").last().hover();
  await esperar(300);
  ok((await hoja.locator("#graficoDias .grafico__tooltip").innerText()).includes("$"), "el tooltip del gráfico muestra el importe del día");

  await ir("nosotros.html");
  await alBorde("#equipo", 40);
  await esperar(900);
  await foto("07-equipo.jpg");

  /* ---------- 7. Teléfono ---------- */
  console.log("Teléfono");
  const movil = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const hm = await movil.newPage();
  hm.on("pageerror", (e) => errores.push("móvil pageerror: " + e.message));
  await hm.goto(BASE + "entrar.html", { waitUntil: "load" });
  await esperar(700);
  ok(await hm.locator("[data-sesion-invitado]").first().isVisible() && await hm.locator("[data-carrito-boton]").isVisible(), "móvil: cuenta y carrito en la cabecera");
  if (CAPTURAS) await hm.screenshot({ path: path.join(CAPTURAS, "18-movil-entrar.jpg"), type: "jpeg", quality: 84 });
  ok(await hm.evaluate(() => Math.max(window.innerWidth, document.documentElement.scrollWidth) <= 390), "móvil: sin desplazamiento horizontal");
  // La caja en el teléfono: entra con la demo, arma un carrito y abre la caja.
  await hm.locator('.demo-rapida [data-demo="estudiante"]').tap();
  await hm.waitForURL(/mi-cuenta/, { timeout: 8000 });
  await hm.evaluate(() => localStorage.setItem("alapar:carrito", JSON.stringify([{ tutor: "luis-batista", materia: "TER-1", modalidad: "presencial", horas: 2 }])));
  await hm.goto(BASE + "carrito.html", { waitUntil: "load" });
  await esperar(700);
  await hm.fill("#telefono", "6555-0101");
  await hm.fill("#disponibilidad", "Viernes por la tarde, en el campus.");
  await hm.locator("#acepto").check();
  await hm.locator('#formularioReserva button[type="submit"]').tap();
  await hm.locator("#modalCaja.show").waitFor();
  await esperar(1200);
  ok(await hm.evaluate(() => Math.max(window.innerWidth, document.documentElement.scrollWidth) <= 390), "móvil: la caja cabe en la pantalla");
  if (CAPTURAS) await hm.screenshot({ path: path.join(CAPTURAS, "19-movil-caja.jpg"), type: "jpeg", quality: 84 });
  await hm.locator('.caja__form button[type="submit"]').tap();
  await hm.locator(".caja-exito").waitFor({ timeout: 15000 });
  await esperar(1000);
  if (CAPTURAS) await hm.screenshot({ path: path.join(CAPTURAS, "20-movil-pagado.jpg"), type: "jpeg", quality: 84 });
  ok((await hm.locator(".caja-exito h3").innerText()).includes("Pago aprobado"), "móvil: pago aprobado");
  await movil.close();
} catch (error) {
  console.error(error);
  fallos++;
}

ok(errores.length === 0, "sin errores de JavaScript" + (errores.length ? ": " + errores.join(" | ") : ""));
await navegador.close();
servidor?.kill();
console.log(fallos ? `\n${fallos} comprobación(es) fallida(s)` : "\nSitio: todo correcto");
process.exit(fallos ? 1 : 0);
