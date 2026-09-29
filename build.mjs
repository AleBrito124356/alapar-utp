// =====================================================================
// build.mjs — ensambla las páginas finales del sitio.
//
// Cada página vive en src/pages/<nombre>.html y contiene SOLO su <main>.
// La cabecera (<head> + <header>), el pie y los scripts están una sola vez
// en src/partials/. Este script los une y escribe los .html finales en la
// raíz del proyecto, marcando el enlace activo del menú.
//
// Uso:  node build.mjs
// (Los .html de la raíz son el sitio entregable; src/ es la fuente.)
// =====================================================================
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = dirname(fileURLToPath(import.meta.url));
const src = join(raiz, "src");
const BASE = process.env.BASE_URL ?? "https://alapar-utp.vercel.app/";

const leer = (ruta) => readFileSync(ruta, "utf8");
const partials = Object.fromEntries(
  ["head", "header", "footer", "scripts"].map((n) => [n, leer(join(src, "partials", `${n}.html`))])
);

const porDefecto = {
  navclase: "nav-ap--solida",
  bodyclase: "con-nav-solido",
  head_extra: "",
  base: BASE,
};

const paginas = readdirSync(join(src, "pages")).filter((f) => f.endsWith(".html"));
let escritas = 0;

for (const archivo of paginas) {
  const contenido = leer(join(src, "pages", archivo));
  const coincidencia = contenido.match(/^<!--\s*(\{[\s\S]*?\})\s*-->/);
  if (!coincidencia) throw new Error(`${archivo}: falta el bloque de metadatos al inicio`);

  const meta = { ...porDefecto, ...JSON.parse(coincidencia[1]) };
  const cuerpo = contenido.slice(coincidencia[0].length).trim();
  const salida = meta.salida ?? archivo;
  meta.url = BASE + (salida === "index.html" ? "" : salida.replace(/\.html$/, ""));

  let html = partials.head + partials.header + "\n" + cuerpo + "\n" + partials.footer + partials.scripts;
  html = html
    .replace(/\{\{act:([a-z-]+)\}\}/g, (_, p) => (p === meta.pagina ? " active" : ""))
    .replace(/\{\{aria:([a-z-]+)\}\}/g, (_, p) => (p === meta.pagina ? ' aria-current="page"' : ""))
    .replace(/\{\{(\w+)\}\}/g, (_, clave) => {
      if (!(clave in meta)) throw new Error(`${archivo}: variable {{${clave}}} sin valor`);
      return meta[clave];
    });

  writeFileSync(join(raiz, salida), html, "utf8");
  escritas++;
  console.log(`✓ ${salida}`);
}

console.log(`\n${escritas} página(s) generadas en ${raiz}`);
