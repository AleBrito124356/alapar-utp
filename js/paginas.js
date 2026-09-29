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
    this.cuenta = Cuenta.iniciar();
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
  #lleno; #vacio; #aviso; #acceso; #sinServidor; #datos;

  constructor() {
    super();
    this.#lleno = $("#carritoLleno");
    this.#vacio = $("#carritoVacio");
    this.#aviso = $("#avisoReserva");
    this.#acceso = $("#accesoRequerido");
    this.#sinServidor = $("#sinServidor");
    this.#datos = $("#datosReserva");

    this.render($("#tutoresSugeridos"), Repositorio.tutores.destacados(3).mapear(Plantillas.tutor).join(""));

    const formulario = $("#formularioReserva");
    if (formulario) {
      this.formulario = new FormularioReserva(formulario, this.tienda.carrito, {
        alReservar: (reserva) => this.#cobrar(reserva)
      });
    }
    $("#entrarDemo")?.addEventListener("click", (e) => this.#entrarDemo(e.currentTarget));

    this.tienda.carrito.suscribir(() => this.#actualizar());
    this.cuenta.sesion.suscribir(() => this.#actualizar());
    this.#actualizar();
  }

  /** Carrito lleno o vacío; y dentro, sin sesión, con sesión o sin servidor. */
  #actualizar() {
    const vacio = this.tienda.carrito.vacio;
    if (this.#lleno) this.#lleno.hidden = vacio;
    if (this.#vacio) this.#vacio.hidden = !vacio;
    const s = this.cuenta.sesion;
    if (this.#sinServidor) this.#sinServidor.hidden = !s.sinServidor;
    if (this.#acceso) this.#acceso.hidden = s.activa || s.sinServidor;
    if (this.#datos) this.#datos.hidden = !s.activa;
  }

  /** Entra con la cuenta demo sin salir de la página: el carrito no se pierde. */
  async #entrarDemo(boton) {
    const texto = boton.textContent;
    boton.disabled = true;
    boton.textContent = "Entrando…";
    try {
      const usuario = await this.cuenta.sesion.entrar("estudiante@alapar.demo", "Estudiante2026");
      Aviso.mostrar(`Entraste como ${usuario.nombre}. Tu carrito sigue aquí.`);
      window.setTimeout(() => $("#telefono")?.focus({ preventScroll: false }), 60);
    } catch (error) {
      Aviso.mostrar(error.message, 5000);
    } finally {
      boton.disabled = false;
      boton.textContent = texto;
    }
  }

  #cobrar(reserva) {
    CajaSimulada.abrir(reserva, { alTerminar: (pagada, r) => this.#mostrarAviso(pagada, r) });
  }

  #mostrarAviso(pagada, reserva) {
    if (!this.#aviso || !reserva) return;
    $("[data-aviso-titulo]", this.#aviso).textContent = pagada
      ? `Reserva ${reserva.folio} confirmada`
      : `Reserva ${reserva.folio} pendiente de pago`;
    $("[data-aviso-texto]", this.#aviso).textContent = pagada
      ? "Tus tutores te escribirán en menos de 24 horas para fijar el día."
      : "La guardamos en tu cuenta: puedes pagarla cuando quieras desde «Mis reservas».";
    this.#aviso.classList.toggle("is-pendiente", !pagada);
    this.#aviso.hidden = false;
    this.#aviso.scrollIntoView({ block: "center", behavior: "smooth" });
  }
}

/* ------------------------------------------------------------------ */
class PaginaEntrar extends Pagina {
  #siguiente; #pestanas = []; #formularios = {}; #campos = { entrar: new Map(), registro: new Map() };

  constructor() {
    super();
    this.#siguiente = PaginaEntrar.destinoSeguro(this.leerParametro("siguiente"));
    this.#formularios = { entrar: $("#formEntrar"), registro: $("#formRegistro") };
    this.#prepararPestanas();
    this.#definirCampos();
    this.#formularios.entrar?.addEventListener("submit", (e) => this.#entrar(e));
    this.#formularios.registro?.addEventListener("submit", (e) => this.#registrar(e));
    for (const boton of $$("[data-demo]")) boton.addEventListener("click", () => this.#entrarDemo(boton));
    for (const boton of $$("[data-ver-clave]")) boton.addEventListener("click", () => PaginaEntrar.alternarClave(boton));
    this.cuenta.sesion.suscribir(() => this.#pintarEstado());
    this.#pintarEstado();
    if (this.leerParametro("modo") === "registro") this.#mostrar("registro");
  }

  /** Solo se vuelve a páginas del propio sitio: nada de redirecciones abiertas. */
  static destinoSeguro(valor) {
    return ["carrito.html", "mi-cuenta.html", "admin.html", "tutores.html", "index.html"].includes(valor) ? valor : null;
  }

  static alternarClave(boton) {
    const campo = document.getElementById(boton.dataset.verClave);
    if (!campo) return;
    const ver = campo.type === "password";
    campo.type = ver ? "text" : "password";
    boton.setAttribute("aria-pressed", String(ver));
    boton.setAttribute("aria-label", ver ? "Ocultar contraseña" : "Mostrar contraseña");
    boton.classList.toggle("is-visible", ver);
  }

  #pintarEstado() {
    const s = this.cuenta.sesion;
    const aviso = $("#avisoServidor");
    if (aviso) aviso.hidden = !s.sinServidor;
    const dentro = $("#yaDentro");
    if (dentro) dentro.hidden = !s.activa;
    const acceso = $("#panelFormularios");
    if (acceso) acceso.hidden = s.activa;
    const irPanel = $("#irPanel");
    if (irPanel) irPanel.hidden = !s.esAdmin;
  }

  #prepararPestanas() {
    this.#pestanas = $$("[data-pestana]");
    for (const pestana of this.#pestanas) {
      pestana.addEventListener("click", () => this.#mostrar(pestana.dataset.pestana));
      pestana.addEventListener("keydown", (e) => {
        if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
        e.preventDefault();
        const i = (this.#pestanas.indexOf(pestana) + 1) % this.#pestanas.length;
        this.#mostrar(this.#pestanas[i].dataset.pestana, true);
      });
    }
    for (const enlace of $$("[data-ir-pestana]")) {
      enlace.addEventListener("click", (e) => { e.preventDefault(); this.#mostrar(enlace.dataset.irPestana, true); });
    }
  }

  #mostrar(nombre, enfocar = false) {
    this.#pestanas.forEach((pestana, i) => {
      const activa = pestana.dataset.pestana === nombre;
      pestana.classList.toggle("is-activa", activa);
      pestana.setAttribute("aria-selected", String(activa));
      pestana.tabIndex = activa ? 0 : -1;
      if (activa) {
        pestana.closest(".pestanas").dataset.activa = String(i);
        if (enfocar) pestana.focus();
      }
    });
    for (const [clave, form] of Object.entries(this.#formularios)) if (form) form.hidden = clave !== nombre;
  }

  #definirCampos() {
    const definiciones = {
      entrar: [
        ["correo", [Validador.requerido("Escribe tu correo."), Validador.correo()]],
        ["clave", [Validador.requerido("Escribe tu contraseña.")]]
      ],
      registro: [
        ["nombre", [Validador.requerido("Escribe tu nombre."), Validador.longitudMinima(3, "Mínimo 3 letras."), Validador.soloLetras()]],
        ["correo", [Validador.requerido("Escribe tu correo."), Validador.correo()]],
        ["clave", [Validador.requerido("Crea una contraseña."), Validador.longitudMinima(8, "La contraseña necesita al menos 8 caracteres."), Validador.longitudMaxima(72, "Máximo 72 caracteres.")]],
        ["acepto", [Validador.marcado("Confirma que leíste el aviso.")]]
      ]
    };
    for (const [formulario, lista] of Object.entries(definiciones)) {
      const form = this.#formularios[formulario];
      if (!form) continue;
      for (const [nombre, reglas] of lista) {
        const campo = new CampoFormulario(nombre, form, reglas);
        campo.escuchar();
        this.#campos[formulario].set(nombre, campo);
      }
    }
  }

  #validar(formulario) {
    let primero = null;
    for (const campo of this.#campos[formulario].values()) if (!campo.validar() && !primero) primero = campo;
    if (primero) primero.primerControl.focus();
    return !primero;
  }

  #alerta(formulario, texto) {
    const alerta = $(".alerta-form", this.#formularios[formulario]);
    if (!alerta) return;
    alerta.textContent = texto ?? "";
    alerta.hidden = !texto;
    if (texto && !prefiereMenosMovimiento()) {
      const panel = $("#panelFormularios");
      panel?.animate([{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(5px)" }, { transform: "translateX(-3px)" }, { transform: "translateX(0)" }], { duration: 320, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
    }
  }

  async #conBoton(form, texto, fn) {
    const boton = $('button[type="submit"]', form);
    const original = boton.innerHTML;
    boton.disabled = true;
    boton.textContent = texto;
    try { return await fn(); }
    finally { boton.disabled = false; boton.innerHTML = original; }
  }

  #bienvenida(usuario, nuevo = false) {
    Aviso.mostrar(nuevo ? `¡Bienvenida o bienvenido, ${usuario.nombre.split(" ")[0]}! Tu cuenta está lista.` : `Hola de nuevo, ${usuario.nombre.split(" ")[0]}.`);
    const destino = this.#siguiente ?? (usuario.rol === "admin" ? "admin.html" : "mi-cuenta.html");
    window.setTimeout(() => window.location.assign(destino), 450);
  }

  async #entrar(evento) {
    evento.preventDefault();
    this.#alerta("entrar", "");
    if (!this.#validar("entrar")) return;
    const c = this.#campos.entrar;
    await this.#conBoton(this.#formularios.entrar, "Entrando…", async () => {
      try {
        const usuario = await this.cuenta.sesion.entrar(c.get("correo").valor, c.get("clave").valor);
        this.#bienvenida(usuario);
      } catch (error) {
        this.#alerta("entrar", error.message);
        if (error.codigo === "credenciales_invalidas") c.get("clave").primerControl.select();
      }
    });
  }

  async #registrar(evento) {
    evento.preventDefault();
    this.#alerta("registro", "");
    if (!this.#validar("registro")) return;
    const c = this.#campos.registro;
    await this.#conBoton(this.#formularios.registro, "Creando tu cuenta…", async () => {
      try {
        const usuario = await this.cuenta.sesion.registrar({
          nombre: c.get("nombre").valor,
          correo: c.get("correo").valor,
          clave: c.get("clave").valor,
          carrera: $("#registroCarrera")?.value.trim() || null
        });
        this.#bienvenida(usuario, true);
      } catch (error) {
        for (const [nombre, mensaje] of Object.entries(error.detalles ?? {})) c.get(nombre)?.marcarError(mensaje);
        this.#alerta("registro", error.message);
      }
    });
  }

  /** Las notas de demostración rellenan el formulario y entran. */
  async #entrarDemo(boton) {
    const cuentas = {
      estudiante: ["estudiante@alapar.demo", "Estudiante2026"],
      admin: ["admin@alapar.demo", "Admin2026"]
    };
    const [correo, clave] = cuentas[boton.dataset.demo] ?? [];
    if (!correo) return;
    this.#mostrar("entrar");
    this.#campos.entrar.get("correo").valor = correo;
    this.#campos.entrar.get("clave").valor = clave;
    this.#campos.entrar.forEach((campo) => campo.validar());
    boton.closest(".nota")?.classList.add("is-elegida");
    this.#formularios.entrar.requestSubmit();
  }
}

/* ------------------------------------------------------------------ */
class PaginaCuenta extends Pagina {
  #reservas = [];

  constructor() {
    super();
    $("#listaReservas")?.addEventListener("click", (e) => {
      const boton = e.target.closest("[data-pagar]");
      if (boton) this.#pagar(boton.dataset.pagar);
    });
    this.cuenta.sesion.cargar().then(() => this.#iniciar());
  }

  async #iniciar() {
    const s = this.cuenta.sesion;
    if (s.sinServidor) { $("#cuentaSinServidor").hidden = false; $("#cuentaContenido").hidden = true; return; }
    if (!s.activa) { window.location.replace("entrar.html?siguiente=mi-cuenta.html"); return; }
    const nombre = $("#cuentaNombre");
    if (nombre) nombre.textContent = s.usuario.nombre.split(" ")[0];
    const detalle = $("#cuentaDetalle");
    if (detalle) detalle.textContent = [s.usuario.carrera, s.usuario.correo].filter(Boolean).join(" · ");
    $("#irPanelAdmin").hidden = !s.esAdmin;
    await this.#cargar();
  }

  async #cargar() {
    const lista = $("#listaReservas");
    try {
      const { reservas } = await ClienteApi.misReservas();
      this.#reservas = reservas.map((r) => new Reserva(r));
    } catch (error) {
      if (error.estado === 401) { window.location.replace("entrar.html?siguiente=mi-cuenta.html"); return; }
      this.render(lista, Plantillas.vacio("No pudimos cargar tus reservas", error.message));
      return;
    }
    const pagadas = this.#reservas.filter((r) => r.pagada);
    const cifras = [
      { valor: this.#reservas.length, texto: this.#reservas.length === 1 ? "reserva hecha" : "reservas hechas" },
      { valor: pagadas.reduce((s, r) => s + r.datos.horas, 0), texto: "horas de tutoría confirmadas" },
      { valor: pagadas.reduce((s, r) => s + r.datos.total, 0), decimales: 2, prefijo: "$", texto: "pagados en la caja (simulado)" }
    ];
    this.render($("#cuentaCifras"), cifras.map(Plantillas.estadistica).join(""));
    const pendientes = this.#reservas.length - pagadas.length;
    const aviso = $("#cuentaPendientes");
    if (aviso) {
      aviso.hidden = pendientes === 0;
      aviso.textContent = pendientes === 1 ? "Tienes 1 reserva pendiente de pago." : `Tienes ${pendientes} reservas pendientes de pago.`;
    }
    this.render(lista, this.#reservas.length
      ? this.#reservas.map((r) => PaginaCuenta.tarjeta(r)).join("")
      : Plantillas.vacio("Aún no has reservado", "Elige un tutor, añade horas al carrito y págalas en la caja: aparecerán aquí.", { href: "tutores.html", texto: "Buscar tutor" }));
    const destacada = this.leerParametro("reserva");
    if (destacada) $(`[data-folio="${CSS.escape(destacada)}"]`)?.classList.add("is-destacada");
  }

  static tarjeta(r) {
    const d = r.datos;
    return `
      <div class="col-md-6 col-xl-4 reveal">
        <div class="reserva-cuenta${r.pagada ? "" : " is-pendiente"}" data-folio="${escaparHTML(d.folio)}">
          ${Recibo.html(d, { sello: r.soloIntercambio ? "Acordado" : "Pagado" })}
          <div class="reserva-cuenta__pie">
            <span class="insignia ${r.pagada ? "insignia--ok" : "insignia--pendiente"}">${escaparHTML(r.estadoTexto)}</span>
            ${r.pagada
              ? `<span class="small txt-suave">${escaparHTML(r.metodoTexto)} · ${escaparHTML(d.referencia ?? "")}</span>`
              : `<button class="btn btn-tinta btn-sm" type="button" data-pagar="${escaparHTML(d.folio)}">${r.soloIntercambio ? "Confirmar intercambio" : `Pagar ${Dinero.formato(d.total)}`}</button>`}
          </div>
        </div>
      </div>`;
  }

  #pagar(folio) {
    const reserva = this.#reservas.find((r) => r.folio === folio);
    if (!reserva) return;
    CajaSimulada.abrir(reserva.datos, { alTerminar: () => this.#cargar() });
  }
}

/* ------------------------------------------------------------------ */
class PaginaAdmin extends Pagina {
  constructor() {
    super();
    this.panel = new PanelAdmin($("#panelAdmin"));
    this.cuenta.sesion.cargar().then(() => {
      const s = this.cuenta.sesion;
      if (s.sinServidor) { $("#adminSinServidor").hidden = false; return; }
      if (!s.activa) { window.location.replace("entrar.html?siguiente=admin.html"); return; }
      if (!s.esAdmin) { $("#adminSinPermiso").hidden = false; return; }
      $("#panelAdmin").hidden = false;
      this.panel.cargar();
    });
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
    carrito: PaginaCarrito,
    entrar: PaginaEntrar,
    "mi-cuenta": PaginaCuenta,
    admin: PaginaAdmin
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
