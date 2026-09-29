/* =====================================================================
   sesion.js — Conexión con el servidor y sesión del usuario (POO)

   ErrorApi     → error con el código y los detalles que devuelve la API
   ClienteApi   → fetch con JSON y la cookie de sesión; errores legibles
   Sesion       → quién ha entrado; avisa a quien esté mirando
   VistaSesion  → el botón de cuenta de la cabecera y su menú
   Cuenta       → arranca la sesión una sola vez por página

   La cookie de sesión es HttpOnly: este archivo nunca la ve ni la toca.
   Solo pregunta al servidor quién es el usuario (/api/auth/yo).
   ===================================================================== */
"use strict";

class ErrorApi extends Error {
  constructor(estado, codigo, mensaje, detalles = null) {
    super(mensaje);
    this.estado = estado;
    this.codigo = codigo;
    this.detalles = detalles;
  }

  /** Sin servidor: sitio abierto con doble clic, hosting estático o base sin configurar. */
  get sinServidor() {
    return this.estado === 0 || this.estado === 404 || this.codigo === "sin_base_de_datos";
  }
}

/* ------------------------------------------------------------------ */
class ClienteApi {
  static async pedir(ruta, { metodo = "GET", cuerpo } = {}) {
    if (window.location.protocol === "file:") {
      throw new ErrorApi(0, "sin_servidor", "Abre el sitio publicado (o ejecuta npm run dev) para entrar con tu cuenta.");
    }
    let respuesta;
    try {
      respuesta = await fetch(`/api/${ruta}`, {
        method: metodo,
        credentials: "same-origin",
        headers: cuerpo !== undefined ? { "Content-Type": "application/json" } : {},
        body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined
      });
    } catch (_) {
      throw new ErrorApi(0, "sin_conexion", "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.");
    }
    let datos = null;
    try { datos = await respuesta.json(); } catch (_) { /* respuesta sin JSON */ }
    if (!respuesta.ok) {
      throw new ErrorApi(respuesta.status, datos?.error ?? "error", datos?.mensaje ?? "Algo salió mal. Inténtalo de nuevo.", datos?.detalles ?? null);
    }
    return datos ?? {};
  }

  static yo() { return ClienteApi.pedir("auth/yo"); }
  static entrar(correo, clave) { return ClienteApi.pedir("auth/entrar", { metodo: "POST", cuerpo: { correo, clave } }); }
  static registrar(datos) { return ClienteApi.pedir("auth/registro", { metodo: "POST", cuerpo: datos }); }
  static salir() { return ClienteApi.pedir("auth/salir", { metodo: "POST", cuerpo: {} }); }
  static misReservas() { return ClienteApi.pedir("reservas"); }
  static crearReserva(datos) { return ClienteApi.pedir("reservas", { metodo: "POST", cuerpo: datos }); }
  static pagar(datos) { return ClienteApi.pedir("reservas/pagar", { metodo: "POST", cuerpo: datos }); }
  static resumenAdmin() { return ClienteApi.pedir("admin/resumen"); }
}

/* ------------------------------------------------------------------ */
class Sesion {
  static #cache = "alapar:usuario";
  #usuario = null; #estado = "cargando"; #carga = null; #suscriptores = new Set();

  constructor() {
    // Lo último que se supo, para pintar la cabecera sin esperar al servidor.
    try { this.#usuario = JSON.parse(sessionStorage.getItem(Sesion.#cache) ?? "null"); }
    catch (_) { this.#usuario = null; }
  }

  get usuario() { return this.#usuario; }
  get estado() { return this.#estado; }
  get activa() { return this.#usuario !== null; }
  get esAdmin() { return this.#usuario?.rol === "admin"; }
  get sinServidor() { return this.#estado === "sin_servidor"; }

  get iniciales() {
    const partes = String(this.#usuario?.nombre ?? "").split(" ").filter(Boolean);
    return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || "·";
  }

  suscribir(fn) {
    this.#suscriptores.add(fn);
    return () => this.#suscriptores.delete(fn);
  }

  /** Pregunta al servidor quién es el usuario (una sola vez por página). */
  cargar() {
    this.#carga ??= ClienteApi.yo()
      .then((datos) => this.#poner(datos.usuario ?? null, "lista"))
      .catch((error) => this.#poner(null, error.sinServidor ? "sin_servidor" : "lista"));
    return this.#carga;
  }

  /** Vuelve a preguntar (por ejemplo, si el servidor dice que la sesión caducó). */
  recargar() {
    this.#carga = null;
    return this.cargar();
  }

  async entrar(correo, clave) {
    const { usuario } = await ClienteApi.entrar(correo, clave);
    this.#poner(usuario, "lista");
    return usuario;
  }

  async registrar(datos) {
    const { usuario } = await ClienteApi.registrar(datos);
    this.#poner(usuario, "lista");
    return usuario;
  }

  async salir() {
    try { await ClienteApi.salir(); }
    finally { this.#poner(null, "lista"); }
  }

  #poner(usuario, estado) {
    this.#usuario = usuario;
    this.#estado = estado;
    try {
      if (usuario) sessionStorage.setItem(Sesion.#cache, JSON.stringify(usuario));
      else sessionStorage.removeItem(Sesion.#cache);
    } catch (_) { /* navegación privada */ }
    for (const fn of this.#suscriptores) {
      try { fn(this); } catch (error) { console.error(error); }
    }
  }
}

/* ------------------------------------------------------------------ */
class VistaSesion {
  #sesion;

  constructor(sesion) {
    this.#sesion = sesion;
    sesion.suscribir(() => this.pintar());
    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-sesion-salir]")) this.#salir();
    });
    this.pintar();
  }

  pintar() {
    const s = this.#sesion;
    const u = s.usuario;
    for (const el of $$("[data-sesion-invitado]")) el.hidden = s.activa;
    for (const el of $$("[data-sesion-menu]")) el.hidden = !s.activa;
    for (const el of $$("[data-solo-admin]")) el.hidden = !s.esAdmin;
    for (const el of $$("[data-sesion-iniciales]")) el.textContent = s.iniciales;
    for (const el of $$("[data-sesion-nombre]")) el.textContent = u?.nombre ?? "";
    for (const el of $$("[data-sesion-correo]")) el.textContent = u?.correo ?? "";
    for (const el of $$("[data-sesion-rol]")) el.textContent = s.esAdmin ? "Administración" : "Estudiante";
    for (const boton of $$("[data-sesion-boton]")) {
      boton.setAttribute("aria-label", u ? `Tu cuenta: ${u.nombre}` : "Entrar");
      boton.classList.toggle("is-admin", s.esAdmin);
    }
    document.documentElement.classList.toggle("con-sesion", s.activa);
  }

  async #salir() {
    const nombre = this.#sesion.usuario?.nombre?.split(" ")[0] ?? "";
    await this.#sesion.salir();
    Aviso.mostrar(`Cerraste sesión${nombre ? `, ${nombre}` : ""}. ¡Hasta pronto!`);
    // Las páginas privadas no se quedan abiertas sin sesión.
    if (["mi-cuenta", "admin"].includes(document.body.dataset.pagina)) {
      window.setTimeout(() => window.location.assign("entrar.html"), 700);
    }
  }
}

/* ------------------------------------------------------------------ */
/** Una sola sesión por página, compartida por todas las vistas. */
const Cuenta = {
  sesion: null,
  vista: null,

  iniciar() {
    if (!this.sesion) {
      this.sesion = new Sesion();
      this.vista = new VistaSesion(this.sesion);
      this.sesion.cargar();
    }
    return this;
  }
};
