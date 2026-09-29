// =====================================================================
// desarrollo/servidor.mjs — Servidor local de A la Par.
//
// Sirve las páginas estáticas y las funciones de /api igual que Vercel
// (rutas por carpetas, [parametro].js, URLs sin .html). La base de datos es:
//   · PGlite (Postgres real compilado a WebAssembly) guardado en
//     desarrollo/.pglite, o en memoria con --memoria (lo usan las pruebas);
//   · o la base Neon de .env.local si existe DATABASE_URL.
//
// Uso:
//   node desarrollo/servidor.mjs                 → http://localhost:5183
//   node desarrollo/servidor.mjs --memoria --puerto 5190
// =====================================================================
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opcion = (nombre) => { const i = args.indexOf(nombre); return i >= 0 ? args[i + 1] : undefined; };
const PUERTO = Number(opcion("--puerto") ?? process.env.PORT ?? 5183);
const EN_MEMORIA = args.includes("--memoria");

cargarEntorno(path.join(RAIZ, ".env.local"));

if (EN_MEMORIA || !process.env.DATABASE_URL) {
  const { PGlite } = await import("@electric-sql/pglite");
  const base = EN_MEMORIA ? new PGlite() : new PGlite(path.join(RAIZ, "desarrollo", ".pglite"));
  await base.waitReady;
  // Una sola conexión: las consultas se encolan para que ninguna pise a otra.
  let cola = Promise.resolve();
  globalThis.__alaparBase = {
    consulta(texto, params = []) {
      const resultado = cola.then(() => base.query(texto, params)).then((r) => r.rows);
      cola = resultado.catch(() => {});
      return resultado;
    }
  };
  console.log(`Base de datos: PGlite ${EN_MEMORIA ? "(en memoria)" : "(desarrollo/.pglite)"}`);
} else {
  console.log("Base de datos: DATABASE_URL de .env.local");
}

const TIPOS = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".webp": "image/webp",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".ico": "image/x-icon",
  ".mp4": "video/mp4", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8"
};

/** Resuelve /api/... como Vercel: archivo, index.js o [parametro].js. */
function rutaApi(ruta) {
  const partes = ruta.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  if (partes.some((p) => p.startsWith("_") || p.startsWith(".") || p.includes(".."))) return null;
  let dir = path.join(RAIZ, "api");
  const params = {};
  for (let i = 0; i < partes.length; i++) {
    const parte = partes[i];
    const ultima = i === partes.length - 1;
    if (ultima) {
      for (const candidato of [`${parte}.js`, path.join(parte, "index.js")]) {
        const archivo = path.join(dir, candidato);
        if (fs.existsSync(archivo)) return { archivo, params };
      }
    } else if (fs.existsSync(path.join(dir, parte))) {
      dir = path.join(dir, parte);
      continue;
    }
    const dinamico = fs.readdirSync(dir).find((f) => /^\[\w+\](\.js)?$/.test(f));
    if (!dinamico) return null;
    params[dinamico.replace(/^\[|\](\.js)?$/g, "")] = decodeURIComponent(parte);
    if (dinamico.endsWith(".js")) return ultima ? { archivo: path.join(dir, dinamico), params } : null;
    dir = path.join(dir, dinamico);
  }
  const indice = path.join(dir, "index.js");
  return fs.existsSync(indice) ? { archivo: indice, params } : null;
}

async function servirApi(req, res, url) {
  const destino = rutaApi(url.pathname);
  if (!destino) {
    res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "no_encontrado", mensaje: "Esa ruta de la API no existe." }));
    return;
  }
  req.query = { ...Object.fromEntries(url.searchParams), ...destino.params };
  const modulo = await import(pathToFileURL(destino.archivo).href);
  await modulo.default(req, res);
}

function servirArchivo(req, res, url) {
  let ruta = decodeURIComponent(url.pathname);
  if (ruta.endsWith("/")) ruta += "index.html";
  let archivo = path.resolve(RAIZ, "." + ruta);
  const relativo = path.relative(RAIZ, archivo);
  const prohibido = relativo.startsWith("..") || path.isAbsolute(relativo)
    || relativo.split(path.sep).some((p) => p.startsWith(".") || p === "node_modules" || p === "desarrollo");
  if (prohibido) return noEncontrado(res);
  if (!path.extname(archivo) && fs.existsSync(archivo + ".html")) archivo += ".html";   // URLs limpias
  if (!fs.existsSync(archivo) || !fs.statSync(archivo).isFile()) return noEncontrado(res);

  const tamano = fs.statSync(archivo).size;
  const tipo = TIPOS[path.extname(archivo).toLowerCase()] ?? "application/octet-stream";
  const rango = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? "");
  if (rango) {
    // El vídeo de la portada avanza con el scroll: necesita peticiones por rangos.
    const inicio = rango[1] ? Number(rango[1]) : 0;
    const fin = rango[2] ? Math.min(Number(rango[2]), tamano - 1) : tamano - 1;
    res.writeHead(206, { "Content-Type": tipo, "Content-Range": `bytes ${inicio}-${fin}/${tamano}`, "Accept-Ranges": "bytes", "Content-Length": fin - inicio + 1, "Cache-Control": "no-cache" });
    fs.createReadStream(archivo, { start: inicio, end: fin }).pipe(res);
    return;
  }
  res.writeHead(200, { "Content-Type": tipo, "Content-Length": tamano, "Accept-Ranges": "bytes", "Cache-Control": "no-cache" });
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(archivo).pipe(res);
}

function noEncontrado(res) {
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("No encontrado");
}

function cargarEntorno(archivo) {
  if (!fs.existsSync(archivo)) return;
  for (const linea of fs.readFileSync(archivo, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*["']?(.*?)["']?\s*$/.exec(linea);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

const servidor = http.createServer(async (req, res) => {
  const inicio = Date.now();
  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
  if (url.pathname.startsWith("/api/")) {
    res.on("finish", () => console.log(`${req.method} ${url.pathname} ${res.statusCode} ${Date.now() - inicio} ms`));
  }
  try {
    if (url.pathname.startsWith("/api/")) await servirApi(req, res, url);
    else servirArchivo(req, res, url);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Error del servidor de desarrollo");
  }
});

servidor.listen(PUERTO, () => console.log(`A la Par en http://localhost:${PUERTO}`));
