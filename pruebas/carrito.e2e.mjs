// =====================================================================
// Prueba de extremo a extremo del carrito de A la Par (Playwright).
//
// Recorre el sitio como una persona: añade horas con varios tutores,
// comprueba importes y descuento, recarga, valida el formulario, confirma
// la reserva y revisa el historial, el equipo y la vista de teléfono.
// Con una carpeta como segundo argumento guarda además las capturas del
// README (docs/capturas).
//
// Uso:
//   npm install                         (instala Playwright; una sola vez)
//   npx playwright install chromium     (si no tienes el navegador)
//   npx http-server . -p 5183 -c-1      (en otra terminal)
//   node pruebas/carrito.e2e.mjs http://localhost:5183/ [docs/capturas]
// =====================================================================
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:5183/";
const CAPTURAS = process.argv[3] ?? null;
if (CAPTURAS) fs.mkdirSync(CAPTURAS, { recursive: true });

let fallos = 0;
const ok = (cond, texto) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${texto}`);
  if (!cond) fallos++;
};
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const navegador = await chromium.launch();
const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: "no-preference" });
const hoja = await ctx.newPage();
const errores = [];
hoja.on("pageerror", (e) => errores.push("pageerror: " + e.message));
hoja.on("console", (m) => { if (m.type() === "error") errores.push("console: " + m.text()); });

const foto = async (nombre, opciones = {}) => {
  if (!CAPTURAS) return;
  await hoja.screenshot({ path: path.join(CAPTURAS, nombre), type: "jpeg", quality: 84, ...opciones });
};
const texto = (sel) => hoja.locator(sel).first().innerText();
const resumenDrawer = () => hoja.locator("#carritoLateral [data-carrito-resumen]").innerText();

/* ---------- 1. Inicio ---------- */
console.log("Inicio");
await hoja.goto(BASE + "index.html", { waitUntil: "load" });
await esperar(1200);
await foto("01-inicio.jpg");
ok(await hoja.locator("[data-carrito-boton]").isVisible(), "botón del carrito visible en la cabecera");
ok(await hoja.locator("[data-carrito-num]").isHidden(), "contador oculto con el carrito vacío");
await hoja.locator("#tutoresDestacados").scrollIntoViewIfNeeded();
await esperar(900);
ok(await hoja.locator("#tutoresDestacados [data-agregar-tutor]").count() === 3, "3 tutores destacados con botón «Al carrito»");

/* ---------- 2. Directorio y ventana de reserva ---------- */
console.log("Tutores");
await hoja.goto(BASE + "tutores.html", { waitUntil: "load" });
await esperar(900);
ok(await hoja.locator("[data-agregar-tutor]").count() === 9, "9 tarjetas con botón «Al carrito»");

await hoja.locator('[data-agregar-tutor="maria-castillo"]').click();
await hoja.locator("#modalReserva.show").waitFor();
await esperar(400);
ok((await hoja.locator("#reservaMateria option").count()) === 3, "la ventana ofrece las 3 materias de la tutora");
ok((await hoja.locator('#modalReserva input[name="modalidad"]').count()) === 2, "y sus 2 modalidades");
ok((await texto('[data-reserva="importe"]')) === "$6.00", "importe inicial $6.00 (1 h × $6)");
await hoja.locator('#modalReserva [data-horas="1"]').click();
await hoja.locator('#modalReserva [data-horas="1"]').click();
ok((await texto("#reservaHoras")) === "3 h", "el contador sube a 3 h");
ok((await texto('[data-reserva="importe"]')) === "$18.00", "importe $18.00");
await hoja.locator("#reservaMateria").selectOption("EDD-1");
await foto("03-reservar.jpg");
await hoja.locator('#modalReserva button[type="submit"]').click();
await hoja.locator("#carritoLateral.show").waitFor();
await esperar(500);
ok((await texto("[data-carrito-num]")) === "3", "el contador de la cabecera marca 3 horas");
ok((await hoja.locator("#carritoLateral .linea-carrito").count()) === 1, "una línea en el panel lateral");
ok((await resumenDrawer()).includes("$18.00"), "subtotal $18.00 en el panel");
ok((await resumenDrawer()).includes("falta 1 hora"), "aviso: falta 1 hora para el descuento");
await hoja.locator("#carritoLateral .btn-close").click();
await hoja.locator("#carritoLateral.show").waitFor({ state: "detached" }).catch(() => {});
await esperar(500);

// Segunda tutora: 1 h virtual → 4 h pagadas → descuento
await hoja.locator('[data-agregar-tutor="daniela-chen"]').click();
await hoja.locator("#modalReserva.show").waitFor();
await esperar(300);
await hoja.locator('#reservaModalidad-virtual').check();
await hoja.locator('#modalReserva button[type="submit"]').click();
await hoja.locator("#carritoLateral.show").waitFor();
await esperar(500);
let r = await resumenDrawer();
ok(r.includes("$26.00") && r.includes("−$2.60") && r.includes("$23.40"), "4 h pagadas: $26.00 − 10 % ($2.60) = $23.40");
await hoja.locator("#carritoLateral .btn-close").click();
await esperar(600);

// Tutora de intercambio (precio 0)
await hoja.locator('[data-agregar-tutor="ana-rios"]').click();
await hoja.locator("#modalReserva.show").waitFor();
await esperar(300);
ok((await texto('[data-reserva="importe"]')) === "Intercambio", "la tutora de intercambio no tiene precio");
await hoja.locator('#modalReserva [data-horas="1"]').click();
await hoja.locator('#modalReserva button[type="submit"]').click();
await hoja.locator("#carritoLateral.show").waitFor();
await esperar(700);
r = await resumenDrawer();
ok(r.includes("6 h") && r.includes("2 por intercambio") && r.includes("$23.40"), "6 h (2 por intercambio) y el total no cambia");
await foto("04-carrito-lateral.jpg");

// Controles del panel: + , − y quitar
const lineaMaria = hoja.locator('#carritoLateral .linea-carrito[data-clave^="maria-castillo"]');
await lineaMaria.locator('[data-carrito-accion="mas"]').click();
await esperar(250);
r = await resumenDrawer();
ok(r.includes("$32.00") && r.includes("−$3.20") && r.includes("$28.80"), "+1 h: $32.00 − $3.20 = $28.80");
ok(await hoja.evaluate(() => document.activeElement?.dataset?.carritoAccion === "mas"), "el foco se queda en el botón + tras repintar");
await hoja.locator('#carritoLateral .linea-carrito[data-clave^="maria-castillo"] [data-carrito-accion="menos"]').click();
await esperar(250);
await hoja.locator('#carritoLateral .linea-carrito[data-clave^="daniela-chen"] [data-carrito-accion="quitar"]').click();
await esperar(300);
ok((await hoja.locator("#carritoLateral .linea-carrito").count()) === 2, "quitar deja 2 líneas");
r = await resumenDrawer();
ok(r.includes("$18.00") && !r.includes("−$"), "sin la segunda tutora vuelve a $18.00 sin descuento");
ok((await hoja.locator("#carritoAnuncio").innerText()).startsWith("Quitaste"), "la región viva anuncia el cambio");
await hoja.locator("#carritoLateral .btn-close").click();
await esperar(600);
const botonMaria = hoja.locator('#listaTutores [data-agregar-tutor="maria-castillo"]');
ok((await botonMaria.innerText()).includes("En carrito · 3 h"), "la tarjeta de la tutora dice «En carrito · 3 h»");
await hoja.evaluate(() => {
  const lista = document.getElementById("listaTutores");
  window.scrollTo(0, lista.getBoundingClientRect().top + window.scrollY - 170);
});
await hoja.setViewportSize({ width: 1440, height: 1080 });
await esperar(1200);
await foto("02-tutores.jpg");
await hoja.setViewportSize({ width: 1440, height: 900 });

// Persistencia
await hoja.reload({ waitUntil: "load" });
await esperar(600);
ok((await texto("[data-carrito-num]")) === "5", "tras recargar, el carrito sigue con 5 h");

/* ---------- 3. Página del carrito ---------- */
console.log("Carrito");
await hoja.goto(BASE + "carrito.html", { waitUntil: "load" });
await esperar(900);
ok(await hoja.locator("#carritoLleno").isVisible(), "la página muestra el carrito lleno");
ok(await hoja.locator("#carritoVacio").isHidden(), "y oculta el estado vacío");
ok(await hoja.locator('[data-grupo="intercambio"]').isVisible(), "pide la materia a cambio porque hay intercambio");
ok(await hoja.locator('[data-grupo="pago"]').isVisible(), "pide la forma de pago porque hay horas pagadas");
await hoja.evaluate(() => {
  const t = document.getElementById("sesiones-titulo");
  window.scrollTo(0, t.getBoundingClientRect().top + window.scrollY - 130);
});
await esperar(1000);
await foto("05-carrito.jpg");

await hoja.locator('#formularioReserva button[type="submit"]').click();
await esperar(400);
const invalidos = await hoja.locator("#formularioReserva .is-invalid").count();
ok(invalidos >= 7, `enviar vacío marca los campos obligatorios (${invalidos} marcas)`);

await hoja.fill("#nombre", "Ana Pérez");
await hoja.fill("#correo", "ana.perez@utp.ac.pa");
await hoja.fill("#telefono", "1234");
await hoja.locator("#telefono").blur();
ok((await hoja.locator('[data-campo="telefono"] .invalid-feedback').innerText()).includes("Panamá"), "rechaza un teléfono que no es de Panamá");
await hoja.fill("#telefono", "6123-4567");
await hoja.locator('#pago-yappy').check();
await hoja.selectOption("#ofrece", "PRO-1");
await hoja.fill("#disponibilidad", "Martes y jueves después de las 4:00 p. m.; el parcial es el viernes.");
await hoja.evaluate(() => document.getElementById("acepto").scrollIntoView({ block: "center", behavior: "instant" }));
await esperar(300);
await hoja.locator("#acepto").check();

await hoja.locator('#formularioReserva button[type="submit"]').click();
await hoja.locator("#exitoReserva.is-visible").waitFor({ timeout: 5000 });
await esperar(1200);
const folio = await texto('#exitoReserva [data-resumen="folio"]');
ok(/^RES-\d{6}-\d{3}$/.test(folio), `folio de reserva con prefijo propio (${folio})`);
ok((await texto('#exitoReserva [data-resumen="total"]')) === "$18.00", "total confirmado $18.00");
ok((await hoja.locator("#exitoReserva .sesiones-confirmadas li").count()) === 2, "2 sesiones en la confirmación");
ok((await texto('#exitoReserva [data-resumen="pago"]')).includes("Programación I"), "la confirmación dice qué materia da a cambio");
ok(await hoja.locator("[data-carrito-num]").isHidden(), "el carrito queda vacío");
ok(await hoja.locator("#historial").isVisible(), "aparece el historial de reservas");
const guardadas = await hoja.evaluate(() => JSON.parse(localStorage.getItem("alapar:reservas") || "[]"));
ok(guardadas.length === 1 && guardadas[0].sesiones.length === 2 && guardadas[0].total === 18, "la reserva queda guardada en localStorage");
await hoja.locator("#exitoReserva").scrollIntoViewIfNeeded();
await hoja.evaluate(() => window.scrollBy(0, -120));
await esperar(600);
await foto("06-confirmacion.jpg");

// Vaciar con doble toque
await hoja.goto(BASE + "tutores.html", { waitUntil: "load" });
await esperar(600);
await hoja.locator('[data-agregar-tutor="kevin-rodriguez"]').click();
await hoja.locator("#modalReserva.show").waitFor();
await esperar(300);
ok((await hoja.locator('#modalReserva input[name="modalidad"]').count()) === 1, "un tutor solo virtual ofrece una modalidad");
await hoja.locator('#modalReserva button[type="submit"]').click();
await hoja.locator("#carritoLateral.show").waitFor();
await hoja.goto(BASE + "carrito.html", { waitUntil: "load" });
await esperar(600);
const vaciar = hoja.locator('#carritoLleno [data-carrito-accion="vaciar"]');
await vaciar.click();
ok((await vaciar.innerText()).includes("Seguro"), "vaciar pide un segundo toque");
await vaciar.click();
await esperar(400);
ok(await hoja.locator("#carritoVacio").isVisible(), "tras vaciar aparece el estado vacío");
ok((await hoja.locator("#tutoresSugeridos [data-agregar-tutor]").count()) === 3, "con tres tutores sugeridos para empezar");

/* ---------- 4. Nosotros y pie ---------- */
console.log("Nosotros");
await hoja.goto(BASE + "nosotros.html", { waitUntil: "load" });
await esperar(500);
const nombres = await hoja.locator("#equipo .persona h3").allInnerTexts();
ok(nombres.length === 5, `5 integrantes en el equipo: ${nombres.join(", ")}`);
const pie = await hoja.locator(".pie__aviso").innerText();
ok(["Luis Amaral", "Alejandro Brito Olivera", "Marcos Gaitán", "Pedro Garay", "David González"].every((n) => pie.includes(n)), "el pie lista a los cinco");
await hoja.locator("#equipo").scrollIntoViewIfNeeded();
await hoja.evaluate(() => window.scrollBy(0, -40));
await esperar(1400);
await foto("07-equipo.jpg");

/* ---------- 5. Contacto sigue funcionando ---------- */
await hoja.goto(BASE + "contacto.html?tutor=maria-castillo", { waitUntil: "load" });
await esperar(500);
ok(await hoja.locator("#avisoTutor").isVisible(), "«Preguntar» sigue prellenando el formulario de contacto");

/* ---------- 6. Teléfono ---------- */
console.log("Móvil");
const movil = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const hm = await movil.newPage();
hm.on("pageerror", (e) => errores.push("móvil pageerror: " + e.message));
await hm.goto(BASE + "tutores.html", { waitUntil: "load" });
await esperar(900);
ok(await hm.locator("[data-carrito-boton]").isVisible(), "móvil: botón del carrito visible junto al menú");
await hm.locator('[data-agregar-tutor="luis-batista"]').tap();
await hm.locator("#modalReserva.show").waitFor();
await esperar(400);
await hm.locator('#modalReserva [data-horas="1"]').tap();
if (CAPTURAS) await hm.screenshot({ path: path.join(CAPTURAS, "08-movil-reservar.jpg"), type: "jpeg", quality: 84 });
await hm.locator('#modalReserva button[type="submit"]').tap();
await hm.locator("#carritoLateral.show").waitFor();
await esperar(700);
if (CAPTURAS) await hm.screenshot({ path: path.join(CAPTURAS, "09-movil-carrito.jpg"), type: "jpeg", quality: 84 });
const anchoDoc = await hm.evaluate(() => document.documentElement.scrollWidth);
ok(anchoDoc <= 390, `móvil: sin desplazamiento horizontal (${anchoDoc} px)`);

ok(errores.length === 0, "sin errores de JavaScript" + (errores.length ? ": " + errores.join(" | ") : ""));
await navegador.close();
console.log(fallos ? `\n${fallos} comprobación(es) fallida(s)` : "\nTodo correcto");
process.exit(fallos ? 1 : 0);
