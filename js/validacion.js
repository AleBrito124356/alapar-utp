/* =====================================================================
   validacion.js — Validación del formulario de contacto (POO)

   ReglaValidacion     → una comprobación + su mensaje de error
   Validador           → fábrica de reglas reutilizables (requerido, correo…)
   CampoFormulario     → un campo (o grupo de radios) con sus reglas y su
                         retroalimentación visual estilo Bootstrap
   Solicitud           → lo que el usuario envía, con folio y fecha
                         (Reserva, en carrito.js, hereda de ella)
   AlmacenSolicitudes  → guarda las solicitudes en localStorage (hasta que
                         exista la base de datos en el Proyecto 2)
   FormularioContacto  → orquesta todo: prellenado, validación en vivo,
                         envío simulado y pantalla de éxito
   ===================================================================== */
"use strict";

class ReglaValidacion {
  #prueba; #mensaje;

  constructor(prueba, mensaje) {
    this.#prueba = prueba;
    this.#mensaje = mensaje;
  }

  /** Devuelve null si el valor es válido o el mensaje de error si no. */
  validar(valor, campo) {
    return this.#prueba(valor, campo) ? null : this.#mensaje;
  }
}

class Validador {
  static requerido(mensaje = "Este campo es obligatorio.") {
    return new ReglaValidacion((v) => (typeof v === "boolean" ? v : String(v ?? "").trim().length > 0), mensaje);
  }

  static longitudMinima(n, mensaje = `Escribe al menos ${n} caracteres.`) {
    return new ReglaValidacion((v) => String(v).trim().length === 0 || String(v).trim().length >= n, mensaje);
  }

  static longitudMaxima(n, mensaje = `Máximo ${n} caracteres.`) {
    return new ReglaValidacion((v) => String(v).trim().length <= n, mensaje);
  }

  static patron(regex, mensaje) {
    return new ReglaValidacion((v) => String(v).trim() === "" || regex.test(String(v).trim()), mensaje);
  }

  static soloLetras(mensaje = "Usa solo letras y espacios.") {
    return Validador.patron(/^[\p{L}\s'.\-]+$/u, mensaje);
  }

  static correo(mensaje = "Escribe un correo válido, por ejemplo nombre@utp.ac.pa.") {
    return Validador.patron(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, mensaje);
  }

  /** Teléfonos de Panamá: celular 6XXX-XXXX (8 dígitos) o fijo de 7 dígitos. Opcional. */
  static telefonoPanama(mensaje = "Escribe un número de Panamá: celular 6XXX-XXXX o fijo de 7 dígitos.") {
    return new ReglaValidacion((v) => {
      const limpio = String(v ?? "").replace(/[\s\-().]/g, "").replace(/^\+?507/, "");
      if (limpio === "") return true;
      return /^6\d{7}$/.test(limpio) || /^[2-9]\d{6}$/.test(limpio);
    }, mensaje);
  }

  static marcado(mensaje = "Debes marcar esta casilla.") {
    return new ReglaValidacion((v) => v === true, mensaje);
  }

  static personalizada(fn, mensaje) {
    return new ReglaValidacion(fn, mensaje);
  }
}

/* ------------------------------------------------------------------ */
class CampoFormulario {
  #nombre; #controles; #contenedor; #feedback; #reglas; #tocado = false;

  constructor(nombre, formulario, reglas = []) {
    this.#nombre = nombre;
    this.#controles = Array.from(formulario.querySelectorAll(`[name="${nombre}"]`));
    if (!this.#controles.length) throw new Error(`No existe el campo "${nombre}" en el formulario`);
    this.#contenedor = this.#controles[0].closest("[data-campo]") ?? this.#controles[0].parentElement;
    this.#feedback = this.#contenedor.querySelector(".invalid-feedback");
    this.#reglas = reglas;
  }

  get nombre() { return this.#nombre; }
  get tipo() { return this.#controles[0].type; }
  get primerControl() { return this.#controles[0]; }

  get valor() {
    const control = this.#controles[0];
    if (control.type === "checkbox" && this.#controles.length === 1) return control.checked;
    if (control.type === "radio") return this.#controles.find((r) => r.checked)?.value ?? "";
    return control.value.trim();
  }

  set valor(nuevo) {
    const control = this.#controles[0];
    if (control.type === "radio") this.#controles.forEach((r) => (r.checked = r.value === nuevo));
    else if (control.type === "checkbox") control.checked = Boolean(nuevo);
    else control.value = nuevo ?? "";
  }

  /** Valida y (opcionalmente) pinta el resultado. Devuelve true si es válido. */
  validar(mostrar = true) {
    // Un campo que ya enseñó su resultado se revalida en cada tecla: así el
    // error desaparece mientras se corrige, y no al salir del campo, cuando el
    // salto de la página haría que el siguiente clic cayera en el vacío.
    if (mostrar) this.#tocado = true;
    const valor = this.valor;
    let mensaje = null;
    for (const regla of this.#reglas) {
      mensaje = regla.validar(valor, this);
      if (mensaje) break;
    }
    if (mostrar) this.#pintar(mensaje);
    return mensaje === null;
  }

  /** Muestra un error que viene de fuera del formulario (por ejemplo, del servidor). */
  marcarError(mensaje) {
    this.#tocado = true;
    this.#pintar(mensaje);
  }

  limpiar() {
    this.#tocado = false;
    for (const c of this.#controles) {
      c.classList.remove("is-invalid", "is-valid");
      c.removeAttribute("aria-invalid");
    }
    this.#contenedor.classList.remove("is-invalid");
    if (this.#feedback) { this.#feedback.textContent = ""; this.#feedback.style.display = ""; }
  }

  /** Validación en vivo: al salir del campo la primera vez, y en cada tecla después. */
  escuchar(alValidar) {
    const inmediato = ["checkbox", "radio", "select-one"].includes(this.tipo);
    const eventoFinal = inmediato ? "change" : "blur";
    for (const control of this.#controles) {
      control.addEventListener(eventoFinal, () => {
        const validar = () => {
          this.#tocado = true;
          this.validar();
          alValidar?.(this);
        };
        // Al salir de un campo, su mensaje aparece un instante después. Si apareciera
        // en el mismo mousedown, empujaría la página y el clic que va en camino (a otro
        // campo o al botón de enviar) caería en el vacío.
        if (inmediato) validar();
        else window.setTimeout(validar, 200);
      });
      control.addEventListener("input", () => {
        if (!this.#tocado) return;
        this.validar();
        alValidar?.(this);
      });
    }
  }

  #pintar(mensaje) {
    const invalido = mensaje !== null;
    const valor = this.valor;
    const vacio = valor === "" || valor === false;
    for (const c of this.#controles) {
      c.classList.toggle("is-invalid", invalido);
      c.classList.toggle("is-valid", !invalido && !vacio);
      c.setAttribute("aria-invalid", String(invalido));
    }
    this.#contenedor.classList.toggle("is-invalid", invalido);
    if (this.#feedback) {
      this.#feedback.textContent = mensaje ?? "";
      this.#feedback.style.display = invalido ? "block" : "";
    }
  }
}

/* ------------------------------------------------------------------ */
class Solicitud {
  /** Las clases hijas cambian el prefijo del folio (Reserva usa "RES"). */
  static prefijo = "AP";

  constructor(datos) {
    Object.assign(this, datos);
    this.folio = this.constructor.generarFolio();
    this.fecha = new Date().toISOString();
  }

  get fechaTexto() {
    return new Date(this.fecha).toLocaleString("es-PA", { dateStyle: "long", timeStyle: "short" });
  }

  static generarFolio() {
    const hoy = new Date().toISOString().slice(2, 10).replace(/-/g, "");
    const azar = Math.floor(Math.random() * 900 + 100);
    return `${this.prefijo}-${hoy}-${azar}`;
  }
}

class AlmacenSolicitudes {
  static #clave = "alapar:solicitudes";

  static listar() {
    try { return JSON.parse(localStorage.getItem(AlmacenSolicitudes.#clave) ?? "[]"); }
    catch (_) { return []; }
  }

  static guardar(solicitud) {
    try {
      const lista = AlmacenSolicitudes.listar();
      lista.push(solicitud);
      localStorage.setItem(AlmacenSolicitudes.#clave, JSON.stringify(lista));
      return true;
    } catch (_) { return false; }
  }
}

/* ------------------------------------------------------------------ */
class FormularioContacto {
  #form; #campos = new Map(); #panelExito; #enviando = false;

  constructor(formulario) {
    this.#form = formulario;
    this.#panelExito = document.getElementById("exito");
    this.#form.setAttribute("novalidate", "");
    this.#definirCampos();
    this.#configurarContador();
    this.#prefijarDesdeURL();
    this.#form.addEventListener("submit", (e) => this.#enviar(e));
    document.getElementById("nuevaSolicitud")?.addEventListener("click", () => this.reiniciar());
  }

  #definirCampos() {
    const definicion = [
      ["nombre", [Validador.requerido("Dinos tu nombre para saber a quién escribirle."), Validador.longitudMinima(3, "El nombre debe tener al menos 3 letras."), Validador.soloLetras()]],
      ["correo", [Validador.requerido("Necesitamos un correo para responderte."), Validador.correo()]],
      ["telefono", [Validador.telefonoPanama()]],
      ["rol", [Validador.requerido("Cuéntanos si buscas o das tutorías.")]],
      ["materia", [Validador.requerido("Selecciona la materia.")]],
      ["modalidad", [Validador.requerido("Elige cómo prefieres la sesión.")]],
      ["mensaje", [Validador.requerido("Cuéntanos qué necesitas."), Validador.longitudMinima(20, "Danos un poco más de contexto: mínimo 20 caracteres."), Validador.longitudMaxima(500, "Máximo 500 caracteres.")]],
      ["acepto", [Validador.marcado("Necesitamos tu permiso para contactarte.")]]
    ];
    for (const [nombre, reglas] of definicion) {
      const campo = new CampoFormulario(nombre, this.#form, reglas);
      campo.escuchar();
      this.#campos.set(nombre, campo);
    }
  }

  #configurarContador() {
    const mensaje = this.#campos.get("mensaje");
    const salida = document.getElementById("contadorMensaje");
    if (!salida) return;
    const actualizar = () => {
      const n = mensaje.primerControl.value.length;
      salida.textContent = `${n} / 500`;
      salida.classList.toggle("is-limite", n > 500);
    };
    mensaje.primerControl.addEventListener("input", actualizar);
    this._actualizarContador = actualizar;
    actualizar();
  }

  /** Prellena el formulario según la URL: ?tutor=id, ?materia=CODIGO, ?rol=tutor */
  #prefijarDesdeURL() {
    const params = new URLSearchParams(window.location.search);
    const idTutor = params.get("tutor");
    const codigoMateria = params.get("materia");
    const rol = params.get("rol");
    const banner = document.getElementById("avisoTutor");

    const tutor = idTutor ? Repositorio.tutores.porId(idTutor) : null;
    if (tutor) {
      const materia = Repositorio.materias.porCodigo(tutor.materias[0]);
      this.#campos.get("materia").valor = tutor.materias[0];
      this.#campos.get("rol").valor = "estudiante";
      this.#campos.get("modalidad").valor = tutor.modalidades[0];
      this.#campos.get("mensaje").valor = `Hola, me gustaría agendar una tutoría de ${materia?.nombre ?? "esta materia"} con ${tutor.nombreCorto}. Mi disponibilidad es: `;
      if (banner) {
        banner.hidden = false;
        banner.querySelector("[data-nombre]").textContent = tutor.nombre;
        banner.querySelector("[data-detalle]").textContent = `${tutor.carrera} · ${tutor.horario}`;
      }
      this._actualizarContador?.();
    } else if (codigoMateria && Repositorio.materias.porCodigo(codigoMateria)) {
      this.#campos.get("materia").valor = codigoMateria;
    }

    if (rol === "tutor" || rol === "estudiante") this.#campos.get("rol").valor = rol;
  }

  /** Valida todos los campos y devuelve el primero inválido (o null). */
  validarTodo() {
    let primerInvalido = null;
    for (const campo of this.#campos.values()) {
      const valido = campo.validar();
      if (!valido && !primerInvalido) primerInvalido = campo;
    }
    return primerInvalido;
  }

  #datos() {
    const datos = {};
    for (const [nombre, campo] of this.#campos) datos[nombre] = campo.valor;
    return datos;
  }

  #enviar(evento) {
    evento.preventDefault();
    if (this.#enviando) return;
    if (this.#form.elements.sitio && this.#form.elements.sitio.value) return; // trampa anti-bots

    const invalido = this.validarTodo();
    if (invalido) {
      invalido.primerControl.focus({ preventScroll: true });
      invalido.primerControl.scrollIntoView({ block: "center", behavior: "smooth" });
      Aviso.mostrar("Revisa los campos marcados en rojo.");
      return;
    }

    this.#enviando = true;
    const boton = this.#form.querySelector('button[type="submit"]');
    const textoOriginal = boton.innerHTML;
    boton.disabled = true;
    boton.textContent = "Enviando…";

    const solicitud = new Solicitud(this.#datos());
    AlmacenSolicitudes.guardar(solicitud);

    // Simulamos la latencia de red. En el Proyecto 2 aquí irá el envío real a la BD.
    window.setTimeout(() => {
      this.#mostrarExito(solicitud);
      boton.disabled = false;
      boton.innerHTML = textoOriginal;
      this.#enviando = false;
    }, 700);
  }

  #mostrarExito(solicitud) {
    if (!this.#panelExito) { Aviso.mostrar(`Solicitud ${solicitud.folio} enviada.`); return; }
    const materia = Repositorio.materias.porCodigo(solicitud.materia);
    const roles = { estudiante: "Busco tutoría", tutor: "Quiero ser tutor" };
    const modalidades = { presencial: "Presencial", virtual: "Virtual", indiferente: "Cualquiera" };
    const poner = (clave, texto) => {
      const el = this.#panelExito.querySelector(`[data-resumen="${clave}"]`);
      if (el) el.textContent = texto;
    };
    poner("folio", solicitud.folio);
    poner("nombre", solicitud.nombre);
    poner("correo", solicitud.correo);
    poner("rol", roles[solicitud.rol] ?? solicitud.rol);
    poner("materia", materia ? `${materia.nombre} (${materia.codigo})` : solicitud.materia);
    poner("modalidad", modalidades[solicitud.modalidad] ?? solicitud.modalidad);
    poner("fecha", solicitud.fechaTexto);

    this.#form.hidden = true;
    this.#panelExito.classList.add("is-visible");
    this.#panelExito.scrollIntoView({ block: "start", behavior: "smooth" });
    this.#panelExito.querySelector("h2")?.focus?.();
  }

  reiniciar() {
    this.#form.reset();
    this.#campos.forEach((campo) => campo.limpiar());
    this._actualizarContador?.();
    this.#panelExito?.classList.remove("is-visible");
    this.#form.hidden = false;
    this.#form.scrollIntoView({ block: "start", behavior: "smooth" });
    this.#campos.get("nombre").primerControl.focus({ preventScroll: true });
  }
}
