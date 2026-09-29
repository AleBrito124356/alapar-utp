/* =====================================================================
   paginas.js — Controladores de cada página (POO)

   Pagina (base)      → navegación, animaciones y contadores comunes
   PaginaInicio       → hero con vídeo, marquesina, destacados, testimonios
   PaginaMaterias     → catálogo con filtros por área, búsqueda y orden
   PaginaTutores      → directorio con filtros por área, materia, modalidad…
   PaginaComoFunciona → preguntas frecuentes
   PaginaNosotros     → cifras
   PaginaContacto     → formulario con validación
   PaginaCarrito      → sesiones del carrito, datos, pago y confirmación
   App                → arranca la clase que corresponde a <body data-pagina>

   Todas las páginas arrancan la Tienda (carrito.js): el botón del carrito
   y el panel lateral están en la cabecera de cada página.
   ===================================================================== */
"use strict";

class Pagina {
  constructor() {
    this.navegacion = new Navegacion();
    this.revelador = new Revelador();
    this.tienda = Tienda.iniciar();
    ContadorAnimado.observarTodos();
  }

  /** Renderiza HTML en un contenedor y activa animaciones, contadores y botones del carrito. */
  render(contenedor, html) {
    if (!contenedor) return;
    contenedor.innerHTML = html;
    this.revelador.refrescar(contenedor);
    ContadorAnimado.observarTodos(contenedor);
    this.tienda.vista.marcarBotones(contenedor);
  }

  leerParametro(nombre) {
    return new URLSearchParams(window.location.search).get(nombre);
  }

  /** Actualiza la URL sin recargar, para que los filtros se puedan compartir. */
  escribirParametros(objeto) {
    const params = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(objeto)) {
      if (v === null || v === undefined || v === "" || v === "todas" || v === false) params.delete(k);
      else params.set(k, v);
    }
    const consulta = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${consulta ? "?" + consulta : ""}`);
  }
}

/* ------------------------------------------------------------------ */
class PaginaInicio extends Pagina {
  constructor() {
    super();
    const hero = $("#hero");
    if (hero) new HeroScrollVideo(hero);

    new Marquesina($("#marquesina"), Repositorio.materias.ordenarPor("demanda").mapear((m) => m.nombre));

    this.render($("#estadisticas"), Repositorio.estadisticas.map(Plantillas.estadistica).join(""));
    this.render($("#materiasDestacadas"), Repositorio.materias.masDemandadas(6).mapear(Plantillas.materia).join(""));
    this.render($("#tutoresDestacados"), Repositorio.tutores.destacados(3).mapear(Plantillas.tutor).join(""));
    this.render($("#listaTestimonios"), Repositorio.testimonios.mapear(Plantillas.nota).join(""));

    const totalMaterias = $("#totalMaterias");
    if (totalMaterias) totalMaterias.textContent = Repositorio.materias.total;
  }
}

/* ------------------------------------------------------------------ */
class PaginaMaterias extends Pagina {
  #estado = { area: "todas", texto: "", orden: "demanda" };
  #lista; #conteo; #chips; #buscador; #orden;

  constructor() {
    super();
    this.#lista = $("#listaMaterias");
    this.#conteo = $("#conteo");
    this.#chips = $("#filtroAreas");
    this.#buscador = $("#buscador");
    this.#orden = $("#orden");

    this.#estado.area = this.leerParametro("area") ?? "todas";
    this.#estado.texto = this.leerParametro("q") ?? "";
    if (this.#buscador) this.#buscador.value = this.#estado.texto;

    this.#pintarChips();
    this.#escuchar();
    this.#actualizar();
  }

  #pintarChips() {
    if (!this.#chips) return;
    const conteo = Repositorio.materias.contarPorArea();
    let html = Plantillas.chipArea("todas", "Todas", Repositorio.materias.total, this.#estado.area === "todas");
    for (const [id, area] of Repositorio.areas) html += Plantillas.chipArea(id, area.corto, conteo[id] ?? 0, this.#estado.area === id);
    this.#chips.innerHTML = html;
  }

  #escuchar() {
    this.#chips?.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      this.#estado.area = chip.dataset.area;
      $$(".chip", this.#chips).forEach((c) => {
        const activa = c === chip;
        c.classList.toggle("is-active", activa);
        c.setAttribute("aria-pressed", String(activa));
      });
      this.#actualizar();
    });

    let temporizador;
    this.#buscador?.addEventListener("input", () => {
      window.clearTimeout(temporizador);
      temporizador = window.setTimeout(() => {
        this.#estado.texto = this.#buscador.value.trim();
        this.#actualizar();
      }, 160);
    });

    this.#orden?.addEventListener("change", () => {
      this.#estado.orden = this.#orden.value;
      this.#actualizar();
    });

    $("#limpiarFiltros")?.addEventListener("click", () => {
      this.#estado = { area: "todas", texto: "", orden: "demanda" };
      if (this.#buscador) this.#buscador.value = "";
      if (this.#orden) this.#orden.value = "demanda";
      this.#pintarChips();
      this.#actualizar();
    });
  }

  #actualizar() {
    const resultado = Repositorio.materias
      .porArea(this.#estado.area)
      .buscar(this.#estado.texto)
      .ordenarPor(this.#estado.orden);

    if (this.#conteo) {
      const n = resultado.total;
      this.#conteo.textContent = `${n} ${n === 1 ? "materia" : "materias"}${this.#estado.area !== "todas" ? ` · ${Repositorio.nombreArea(this.#estado.area)}` : ""}`;
    }

    const html = resultado.vacio
      ? Plantillas.vacio("No encontramos esa materia", "Prueba con otro nombre o cuéntanos cuál necesitas y buscamos un tutor.", { href: "contacto.html", texto: "Pedir una materia nueva" })
      : resultado.mapear(Plantillas.materia).join("");
    this.render(this.#lista, html);
    this.escribirParametros({ area: this.#estado.area, q: this.#estado.texto });
  }
}

/* ------------------------------------------------------------------ */
class PaginaTutores extends Pagina {
  #estado = { area: "todas", materia: "", modalidad: "", disponibles: false, texto: "", orden: "calificacion" };
  #lista; #conteo; #chips; #materia; #modalidad; #disponibles; #buscador; #orden; #avisoMateria;

  constructor() {
    super();
    this.#lista = $("#listaTutores");
    this.#conteo = $("#conteo");
    this.#chips = $("#filtroAreas");
    this.#materia = $("#filtroMateria");
    this.#modalidad = $("#filtroModalidad");
    this.#disponibles = $("#soloDisponibles");
    this.#buscador = $("#buscador");
    this.#orden = $("#orden");
    this.#avisoMateria = $("#avisoMateria");

    this.#estado.materia = this.leerParametro("materia") ?? "";
    this.#estado.area = this.leerParametro("area") ?? "todas";

    this.#pintarChips();
    this.#pintarSelectMaterias();
    this.#escuchar();
    this.#actualizar();
  }

  #pintarChips() {
    if (!this.#chips) return;
    const conteo = {};
    for (const [area, lista] of Repositorio.tutores.agrupar((t) => t.area)) conteo[area] = lista.length;
    let html = Plantillas.chipArea("todas", "Todas", Repositorio.tutores.total, this.#estado.area === "todas");
    for (const [id, area] of Repositorio.areas) html += Plantillas.chipArea(id, area.corto, conteo[id] ?? 0, this.#estado.area === id);
    this.#chips.innerHTML = html;
  }

  #pintarSelectMaterias() {
    if (!this.#materia) return;
    let html = '<option value="">Todas las materias</option>';
    for (const [area, materias] of Repositorio.materias.ordenarPor("nombre").agrupar((m) => m.area)) {
      html += `<optgroup label="${escaparHTML(Repositorio.nombreArea(area))}">`;
      html += materias.map((m) => `<option value="${escaparHTML(m.codigo)}">${escaparHTML(m.nombre)}</option>`).join("");
      html += "</optgroup>";
    }
    this.#materia.innerHTML = html;
    this.#materia.value = this.#estado.materia;
    if (this.#materia.value !== this.#estado.materia) this.#estado.materia = "";
  }

  #escuchar() {
    this.#chips?.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      this.#estado.area = chip.dataset.area;
      $$(".chip", this.#chips).forEach((c) => {
        const activa = c === chip;
        c.classList.toggle("is-active", activa);
        c.setAttribute("aria-pressed", String(activa));
      });
      this.#actualizar();
    });
    this.#materia?.addEventListener("change", () => { this.#estado.materia = this.#materia.value; this.#actualizar(); });
    this.#modalidad?.addEventListener("change", () => { this.#estado.modalidad = this.#modalidad.value; this.#actualizar(); });
    this.#disponibles?.addEventListener("change", () => { this.#estado.disponibles = this.#disponibles.checked; this.#actualizar(); });
    this.#orden?.addEventListener("change", () => { this.#estado.orden = this.#orden.value; this.#actualizar(); });

    let temporizador;
    this.#buscador?.addEventListener("input", () => {
      window.clearTimeout(temporizador);
      temporizador = window.setTimeout(() => { this.#estado.texto = this.#buscador.value.trim(); this.#actualizar(); }, 160);
    });

    $("#limpiarFiltros")?.addEventListener("click", () => {
      this.#estado = { area: "todas", materia: "", modalidad: "", disponibles: false, texto: "", orden: "calificacion" };
      if (this.#materia) this.#materia.value = "";
      if (this.#modalidad) this.#modalidad.value = "";
      if (this.#disponibles) this.#disponibles.checked = false;
      if (this.#buscador) this.#buscador.value = "";
      if (this.#orden) this.#orden.value = "calificacion";
      this.#pintarChips();
      this.#actualizar();
    });

    this.#avisoMateria?.querySelector("button")?.addEventListener("click", () => {
      this.#estado.materia = "";
      if (this.#materia) this.#materia.value = "";
      this.#actualizar();
    });
  }

  #actualizar() {
    const resultado = Repositorio.tutores
      .porArea(this.#estado.area)
      .porMateria(this.#estado.materia)
      .porModalidad(this.#estado.modalidad)
      .disponiblesHoy(this.#estado.disponibles)
      .buscar(this.#estado.texto)
      .ordenarPor(this.#estado.orden);

    const materia = this.#estado.materia ? Repositorio.materias.porCodigo(this.#estado.materia) : null;
    if (this.#avisoMateria) {
      this.#avisoMateria.hidden = !materia;
      if (materia) this.#avisoMateria.querySelector("[data-nombre]").textContent = `${materia.nombre} (${materia.codigo})`;
    }

    if (this.#conteo) {
      const n = resultado.total;
      this.#conteo.textContent = `${n} ${n === 1 ? "tutor" : "tutores"}${materia ? ` para ${materia.nombre}` : ""}`;
    }

    const html = resultado.vacio
      ? Plantillas.vacio("Nadie da esa combinación todavía", "Cambia los filtros o déjanos la solicitud: buscamos a alguien que haya aprobado la materia y te avisamos.", { href: `contacto.html${materia ? `?materia=${encodeURIComponent(materia.codigo)}` : ""}`, texto: "Pedir un tutor" })
      : resultado.mapear(Plantillas.tutor).join("");
    this.render(this.#lista, html);
    this.escribirParametros({ area: this.#estado.area, materia: this.#estado.materia });
  }
}

/* ------------------------------------------------------------------ */
class PaginaComoFunciona extends Pagina {
  constructor() {
    super();
    this.render($("#faq"), Repositorio.preguntas.mapear((p, i) => Plantillas.pregunta(p, i, "faq")).join(""));
  }
}

/* ------------------------------------------------------------------ */
class PaginaNosotros extends Pagina {
  constructor() {
    super();
    this.render($("#estadisticas"), Repositorio.estadisticas.map(Plantillas.estadistica).join(""));
  }
}

/* ------------------------------------------------------------------ */
class PaginaContacto extends Pagina {
  constructor() {
    super();
    this.#pintarSelectMaterias();
    const formulario = $("#formularioContacto");
    if (formulario) this.formulario = new FormularioContacto(formulario);
    this.render($("#faqContacto"), Repositorio.preguntas.primeros(3).mapear((p, i) => Plantillas.pregunta(p, i, "faqContacto")).join(""));
  }

  #pintarSelectMaterias() {
    const select = $("#materia");
    if (!select) return;
    let html = '<option value="" selected disabled>Elige una materia…</option>';
    for (const [area, materias] of Repositorio.materias.ordenarPor("nombre").agrupar((m) => m.area)) {
      html += `<optgroup label="${escaparHTML(Repositorio.nombreArea(area))}">`;
      html += materias.map((m) => `<option value="${escaparHTML(m.codigo)}">${escaparHTML(m.nombre)}</option>`).join("");
      html += "</optgroup>";
    }
    html += '<optgroup label="Otra"><option value="OTRA">Otra materia (la indico en el mensaje)</option></optgroup>';
    select.innerHTML = html;
  }
}

/* ------------------------------------------------------------------ */
class PaginaCarrito extends Pagina {
  #lleno; #vacio; #exito; #historial; #listaHistorial; #confirmada = false;

  constructor() {
    super();
    this.#lleno = $("#carritoLleno");
    this.#vacio = $("#carritoVacio");
    this.#exito = $("#exitoReserva");
    this.#historial = $("#historial");
    this.#listaHistorial = $("#listaHistorial");

    this.render($("#tutoresSugeridos"), Repositorio.tutores.destacados(3).mapear(Plantillas.tutor).join(""));

    const formulario = $("#formularioReserva");
    if (formulario) {
      this.formulario = new FormularioReserva(formulario, this.tienda.carrito, {
        alConfirmar: (reserva) => this.#mostrarConfirmacion(reserva)
      });
    }

    $("#imprimirReserva")?.addEventListener("click", () => window.print());

    this.tienda.carrito.suscribir((evento) => {
      // Si después de confirmar se añade algo, se vuelve al carrito.
      if (evento === "agregado") this.#confirmada = false;
      this.#actualizar();
    });
    this.#actualizar();
    this.#pintarHistorial();
  }

  /** Tres estados: carrito con sesiones, carrito vacío o reserva recién confirmada. */
  #actualizar() {
    const vacio = this.tienda.carrito.vacio;
    if (this.#lleno) this.#lleno.hidden = vacio || this.#confirmada;
    if (this.#vacio) this.#vacio.hidden = !vacio || this.#confirmada;
    if (this.#exito) this.#exito.classList.toggle("is-visible", this.#confirmada);
  }

  #mostrarConfirmacion(reserva) {
    this.#confirmada = true;
    const poner = (clave, texto) => {
      const el = this.#exito?.querySelector(`[data-resumen="${clave}"]`);
      if (el) el.textContent = texto;
    };
    const ofrece = reserva.ofrece ? Repositorio.materias.porCodigo(reserva.ofrece)?.nombre ?? reserva.ofrece : "";
    const pago = [reserva.pago !== "intercambio" ? Reserva.textoPago(reserva.pago) : "", ofrece ? `Intercambio: das ${ofrece}` : ""]
      .filter(Boolean).join(" · ") || Reserva.textoPago("intercambio");

    poner("folio", reserva.folio);
    poner("nombre", reserva.nombre);
    poner("correo", reserva.correo);
    poner("telefono", reserva.telefono);
    poner("fecha", reserva.fechaTexto);
    poner("pago", pago);
    poner("total", Dinero.formato(reserva.total));
    poner("horas", `${reserva.horas} h`);
    const sesiones = this.#exito?.querySelector('[data-resumen="sesiones"]');
    if (sesiones) sesiones.innerHTML = reserva.sesiones.map(PlantillasCarrito.sesionConfirmada).join("");

    this.#actualizar();
    this.#pintarHistorial();
    this.#exito?.scrollIntoView({ block: "start", behavior: "smooth" });
    this.#exito?.querySelector("h2")?.focus({ preventScroll: true });
  }

  #pintarHistorial() {
    if (!this.#historial || !this.#listaHistorial || !this.formulario) return;
    const reservas = this.formulario.listarReservas().slice(-5).reverse();
    this.#historial.hidden = reservas.length === 0;
    this.#listaHistorial.innerHTML = reservas.map(PlantillasCarrito.reservaPrevia).join("");
  }
}

/* ------------------------------------------------------------------ */
const App = {
  paginas: {
    inicio: PaginaInicio,
    materias: PaginaMaterias,
    tutores: PaginaTutores,
    "como-funciona": PaginaComoFunciona,
    nosotros: PaginaNosotros,
    contacto: PaginaContacto,
    carrito: PaginaCarrito
  },

  iniciar() {
    const clave = document.body.dataset.pagina;
    const Clase = this.paginas[clave] ?? Pagina;
    try {
      this.actual = new Clase();
    } catch (error) {
      console.error("Error al iniciar la página", error);
      new Pagina();
    }
  }
};

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => App.iniciar());
else App.iniciar();
