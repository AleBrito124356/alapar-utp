/* =====================================================================
   modelos.js — Modelo de dominio de A la Par (Programación Orientada a Objetos)

   Clases:
     Materia, Tutor, Testimonio, Pregunta   → entidades con campos privados
     Catalogo                                → colección genérica (filtrar, ordenar, buscar)
     CatalogoMaterias, CatalogoTutores       → heredan de Catalogo y añaden
                                               consultas propias del negocio
     Repositorio                             → punto único de acceso a los datos
   ===================================================================== */
"use strict";

/** Quita tildes y pasa a minúsculas para comparar texto sin sorpresas. */
const normalizarTexto = (texto = "") =>
  String(texto).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/* ------------------------------------------------------------------ */
class Materia {
  #codigo; #nombre; #area; #semestre; #tutores; #demanda; #temas;

  constructor({ codigo, nombre, area, semestre, tutores = 0, demanda = 1, temas = [] }) {
    if (!codigo || !nombre) throw new Error("Una materia necesita código y nombre");
    this.#codigo = codigo;
    this.#nombre = nombre;
    this.#area = area;
    this.#semestre = Number(semestre);
    this.#tutores = Number(tutores);
    this.#demanda = Math.min(5, Math.max(1, Number(demanda)));
    this.#temas = [...temas];
  }

  get codigo() { return this.#codigo; }
  get nombre() { return this.#nombre; }
  get area() { return this.#area; }
  get semestre() { return this.#semestre; }
  get tutores() { return this.#tutores; }
  get demanda() { return this.#demanda; }
  get temas() { return [...this.#temas]; }

  /** Texto legible del nivel de demanda (1..5). */
  get demandaTexto() {
    return ["Baja", "Media", "Alta", "Muy alta", "Máxima"][this.#demanda - 1];
  }

  get semestreTexto() {
    return `${this.#semestre}.${this.#semestre === 1 || this.#semestre === 3 ? "er" : "º"} semestre`;
  }

  /** ¿Coincide con un texto de búsqueda? (nombre, código o temas) */
  coincide(texto) {
    const t = normalizarTexto(texto);
    if (!t) return true;
    return [this.#nombre, this.#codigo, ...this.#temas].some((campo) => normalizarTexto(campo).includes(t));
  }

  toJSON() {
    return { codigo: this.#codigo, nombre: this.#nombre, area: this.#area, semestre: this.#semestre, tutores: this.#tutores, demanda: this.#demanda, temas: this.temas };
  }

  static desdeObjeto(obj) { return new Materia(obj); }
}

/* ------------------------------------------------------------------ */
class Tutor {
  #id; #nombre; #carrera; #area; #semestre; #materias; #calificacion; #sesiones;
  #precio; #modalidades; #disponibleHoy; #horario; #foto; #frase; #bio;

  constructor(datos) {
    const { id, nombre, carrera, area, semestre, materias = [], calificacion = 0, sesiones = 0,
      precio = 0, modalidades = [], disponibleHoy = false, horario = "", foto = null, frase = "", bio = "" } = datos;
    if (!id || !nombre) throw new Error("Un tutor necesita id y nombre");
    this.#id = id;
    this.#nombre = nombre;
    this.#carrera = carrera;
    this.#area = area;
    this.#semestre = Number(semestre);
    this.#materias = [...materias];
    this.#calificacion = Number(calificacion);
    this.#sesiones = Number(sesiones);
    this.#precio = Number(precio);
    this.#modalidades = [...modalidades];
    this.#disponibleHoy = Boolean(disponibleHoy);
    this.#horario = horario;
    this.#foto = foto;
    this.#frase = frase;
    this.#bio = bio;
  }

  get id() { return this.#id; }
  get nombre() { return this.#nombre; }
  get carrera() { return this.#carrera; }
  get area() { return this.#area; }
  get semestre() { return this.#semestre; }
  get materias() { return [...this.#materias]; }
  get calificacion() { return this.#calificacion; }
  get sesiones() { return this.#sesiones; }
  get precio() { return this.#precio; }
  get modalidades() { return [...this.#modalidades]; }
  get disponibleHoy() { return this.#disponibleHoy; }
  get horario() { return this.#horario; }
  get foto() { return this.#foto; }
  get frase() { return this.#frase; }
  get bio() { return this.#bio; }

  /** Nombre corto: "María Fernanda Castillo" → "María Castillo" */
  get nombreCorto() {
    const partes = this.#nombre.split(" ");
    return partes.length > 2 ? `${partes[0]} ${partes[partes.length - 1]}` : this.#nombre;
  }

  /** Iniciales para el avatar cuando no hay foto. */
  get iniciales() {
    const partes = this.#nombre.split(" ").filter(Boolean);
    return (partes[0][0] + (partes.length > 2 ? partes[2][0] : partes[1]?.[0] ?? "")).toUpperCase();
  }

  get esIntercambio() { return this.#precio === 0; }

  get precioTexto() { return this.esIntercambio ? "Intercambio" : `$${this.#precio}/h`; }

  get modalidadesTexto() {
    const mapa = { presencial: "Presencial", virtual: "Virtual" };
    return this.#modalidades.map((m) => mapa[m] ?? m).join(" · ");
  }

  ensena(codigoMateria) { return this.#materias.includes(codigoMateria); }

  ofrece(modalidad) { return !modalidad || this.#modalidades.includes(modalidad); }

  coincide(texto) {
    const t = normalizarTexto(texto);
    if (!t) return true;
    return [this.#nombre, this.#carrera, ...this.#materias].some((campo) => normalizarTexto(campo).includes(t));
  }

  toJSON() {
    return { id: this.#id, nombre: this.#nombre, carrera: this.#carrera, area: this.#area, semestre: this.#semestre, materias: this.materias,
      calificacion: this.#calificacion, sesiones: this.#sesiones, precio: this.#precio, modalidades: this.modalidades,
      disponibleHoy: this.#disponibleHoy, horario: this.#horario, foto: this.#foto, frase: this.#frase, bio: this.#bio };
  }

  static desdeObjeto(obj) { return new Tutor(obj); }
}

/* ------------------------------------------------------------------ */
class Testimonio {
  #nombre; #detalle; #materia; #texto; #color; #rotacion;

  constructor({ nombre, detalle, materia, texto, color = "#fff9d6", rotacion = 0 }) {
    this.#nombre = nombre;
    this.#detalle = detalle;
    this.#materia = materia;
    this.#texto = texto;
    this.#color = color;
    this.#rotacion = Number(rotacion);
  }

  get nombre() { return this.#nombre; }
  get detalle() { return this.#detalle; }
  get materia() { return this.#materia; }
  get texto() { return this.#texto; }
  get color() { return this.#color; }
  get rotacion() { return this.#rotacion; }
  get iniciales() { return this.#nombre.split(" ").map((p) => p[0]).join("").replace(".", "").slice(0, 2).toUpperCase(); }

  coincide(texto) { return normalizarTexto(this.#texto + this.#materia).includes(normalizarTexto(texto)); }

  static desdeObjeto(obj) { return new Testimonio(obj); }
}

/* ------------------------------------------------------------------ */
class Pregunta {
  #pregunta; #respuesta;

  constructor({ pregunta, respuesta }) {
    this.#pregunta = pregunta;
    this.#respuesta = respuesta;
  }

  get pregunta() { return this.#pregunta; }
  get respuesta() { return this.#respuesta; }

  coincide(texto) { return normalizarTexto(this.#pregunta + this.#respuesta).includes(normalizarTexto(texto)); }

  static desdeObjeto(obj) { return new Pregunta(obj); }
}

/* ------------------------------------------------------------------ */
/** Colección genérica e inmutable: cada operación devuelve un catálogo nuevo. */
class Catalogo {
  #items;

  constructor(items = []) {
    this.#items = [...items];
  }

  get items() { return [...this.#items]; }
  get total() { return this.#items.length; }
  get vacio() { return this.#items.length === 0; }

  filtrar(predicado) { return new this.constructor(this.#items.filter(predicado)); }
  ordenar(comparador) { return new this.constructor([...this.#items].sort(comparador)); }
  primeros(n) { return new this.constructor(this.#items.slice(0, n)); }
  buscar(texto) { return texto ? this.filtrar((item) => item.coincide(texto)) : this; }
  encontrar(predicado) { return this.#items.find(predicado) ?? null; }
  mapear(fn) { return this.#items.map(fn); }

  /** Agrupa por el valor que devuelva la función clave. Devuelve un Map. */
  agrupar(clave) {
    const grupos = new Map();
    for (const item of this.#items) {
      const k = clave(item);
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push(item);
    }
    return grupos;
  }

  [Symbol.iterator]() { return this.#items[Symbol.iterator](); }
}

/* ------------------------------------------------------------------ */
class CatalogoMaterias extends Catalogo {
  porArea(area) {
    return !area || area === "todas" ? this : this.filtrar((m) => m.area === area);
  }

  masDemandadas(n = 8) {
    return this.ordenar((a, b) => b.demanda - a.demanda || b.tutores - a.tutores).primeros(n);
  }

  porCodigo(codigo) {
    return this.encontrar((m) => m.codigo === codigo);
  }

  /** Conteo de materias por área: { basicas: 9, fisc: 10, ... } */
  contarPorArea() {
    const conteo = {};
    for (const [area, lista] of this.agrupar((m) => m.area)) conteo[area] = lista.length;
    return conteo;
  }

  ordenarPor(criterio = "nombre") {
    const comparadores = {
      nombre: (a, b) => a.nombre.localeCompare(b.nombre, "es"),
      semestre: (a, b) => a.semestre - b.semestre || a.nombre.localeCompare(b.nombre, "es"),
      demanda: (a, b) => b.demanda - a.demanda || b.tutores - a.tutores,
      tutores: (a, b) => b.tutores - a.tutores
    };
    return this.ordenar(comparadores[criterio] ?? comparadores.nombre);
  }
}

/* ------------------------------------------------------------------ */
class CatalogoTutores extends Catalogo {
  porArea(area) {
    return !area || area === "todas" ? this : this.filtrar((t) => t.area === area);
  }

  porMateria(codigo) {
    return codigo ? this.filtrar((t) => t.ensena(codigo)) : this;
  }

  porModalidad(modalidad) {
    return modalidad ? this.filtrar((t) => t.ofrece(modalidad)) : this;
  }

  disponiblesHoy(soloDisponibles) {
    return soloDisponibles ? this.filtrar((t) => t.disponibleHoy) : this;
  }

  destacados(n = 3) {
    return this.ordenar((a, b) => b.calificacion - a.calificacion || b.sesiones - a.sesiones).primeros(n);
  }

  porId(id) {
    return this.encontrar((t) => t.id === id);
  }

  ordenarPor(criterio = "calificacion") {
    const comparadores = {
      calificacion: (a, b) => b.calificacion - a.calificacion || b.sesiones - a.sesiones,
      sesiones: (a, b) => b.sesiones - a.sesiones,
      precio: (a, b) => a.precio - b.precio || b.calificacion - a.calificacion,
      nombre: (a, b) => a.nombre.localeCompare(b.nombre, "es")
    };
    return this.ordenar(comparadores[criterio] ?? comparadores.calificacion);
  }
}

/* ------------------------------------------------------------------ */
/** Punto único de acceso a los datos. En el Proyecto 2 leerá de la API/BD. */
const Repositorio = Object.freeze({
  areas: new Map(DATOS.areas.map((a) => [a.id, a])),
  materias: new CatalogoMaterias(DATOS.materias.map(Materia.desdeObjeto)),
  tutores: new CatalogoTutores(DATOS.tutores.map(Tutor.desdeObjeto)),
  testimonios: new Catalogo(DATOS.testimonios.map(Testimonio.desdeObjeto)),
  preguntas: new Catalogo(DATOS.preguntas.map(Pregunta.desdeObjeto)),
  estadisticas: DATOS.estadisticas,

  nombreArea(id) { return this.areas.get(id)?.nombre ?? id; },
  areaCorta(id) { return this.areas.get(id)?.corto ?? id; }
});
