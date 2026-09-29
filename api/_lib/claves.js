// =====================================================================
// api/_lib/claves.js — Contraseñas y tokens (solo node:crypto).
//
// Las contraseñas se guardan con scrypt, una función lenta a propósito:
// con sal aleatoria por usuario y comparación en tiempo constante. Nunca
// se guarda ni se devuelve la contraseña en claro.
// =====================================================================
import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";

const PARAMETROS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const LARGO = 64;

function derivar(clave, sal, largo = LARGO) {
  return new Promise((resolver, rechazar) => {
    scrypt(String(clave).normalize("NFKC"), sal, largo, PARAMETROS, (error, clavederivada) =>
      error ? rechazar(error) : resolver(clavederivada));
  });
}

export async function hashClave(clave) {
  const sal = randomBytes(16);
  const hash = await derivar(clave, sal);
  return `scrypt$${sal.toString("base64")}$${hash.toString("base64")}`;
}

export async function verificarClave(clave, guardada) {
  const [tipo, sal64, hash64] = String(guardada ?? "").split("$");
  if (tipo !== "scrypt" || !sal64 || !hash64) return false;
  const esperado = Buffer.from(hash64, "base64");
  const hash = await derivar(clave, Buffer.from(sal64, "base64"), esperado.length);
  return hash.length === esperado.length && timingSafeEqual(hash, esperado);
}

/**
 * Hash señuelo: si el correo no existe se verifica contra él igualmente, para
 * que la respuesta tarde lo mismo y no delate qué correos están registrados.
 */
let senuelo = null;
export function hashSenuelo() {
  senuelo ??= hashClave(randomBytes(12).toString("hex"));
  return senuelo;
}

/** Token de sesión: 256 bits aleatorios. En la base solo se guarda su huella. */
export const nuevoToken = () => randomBytes(32).toString("base64url");
export const huella = (token) => createHash("sha256").update(String(token)).digest("hex");
