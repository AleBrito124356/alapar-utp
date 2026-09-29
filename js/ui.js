/* =====================================================================
   ui.js — Componentes de interfaz de A la Par (POO)

   Utilidades: $, $$, escaparHTML, prefiereMenosMovimiento, ordinal
   Clases:
     Navegacion       → cabecera que se vuelve sólida al hacer scroll
     Revelador        → animaciones de entrada (IntersectionObserver)
     ContadorAnimado  → cifras que cuentan hacia arriba al verse
     HeroScrollVideo  → vídeo del hero controlado por la posición del scroll
     Marquesina       → cinta de materias en movimiento continuo
     Aviso            → toast global de Bootstrap
     Plantillas       → generadores de HTML para tutores, materias, notas…
                        (la tarjeta de tutor lleva el botón «Al carrito»)
   ===================================================================== */
"use strict";

const $ = (selector, contexto = document) => contexto.querySelector(selector);
const $$ = (selector, contexto = document) => Array.from(contexto.querySelectorAll(selector));

/** Escapa texto antes de insertarlo en HTML (evita inyecciones). */
const escaparHTML = (valor) =>
  String(valor ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const prefiereMenosMovimiento = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** 1 → "1.er", 2 → "2.º", 3 → "3.er" */
const ordinal = (n) => `${n}.${n === 1 || n === 3 ? "er" : "º"}`;

const ICONOS = Object.freeze({
  flecha: '<svg class="flecha" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  estrella: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.2 6.8.8-5 4.7 1.3 6.7L12 17.6 6 20.9l1.3-6.7-5-4.7 6.8-.8z"/></svg>',
  cerrar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  carrito: '<svg class="icono-carrito" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h2.2l2.1 10.2a1.6 1.6 0 0 0 1.6 1.3h8.4a1.6 1.6 0 0 0 1.5-1.2L20.5 8H6.1"/><circle cx="9.5" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/></svg>',
  check: '<svg class="icono-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>'
});

/* ------------------------------------------------------------------ */
class Navegacion {
  #header; #umbral;

  constructor(selector = "#cabecera", umbral = 24) {
    this.#header = $(selector);
    this.#umbral = umbral;
    if (this.#header) this.#iniciar();
  }

  #iniciar() {
    const actualizar = () => this.#header.classList.toggle("is-scrolled", window.scrollY > this.#umbral);
    actualizar();
    window.addEventListener("scroll", actualizar, { passive: true });
  }
}

/* ------------------------------------------------------------------ */
class Revelador {
  #observador = null; #selector;

  constructor({ selector = ".reveal, .pasos, .cta, mark:not([data-manual])", margen = "0px 0px -8% 0px", umbral = 0.12 } = {}) {
    this.#selector = selector;
    if ("IntersectionObserver" in window && !prefiereMenosMovimiento()) {
      this.#observador = new IntersectionObserver((entradas) => {
        for (const entrada of entradas) {
          if (!entrada.isIntersecting) continue;
          this.#mostrar(entrada.target);
          this.#observador.unobserve(entrada.target);
        }
      }, { rootMargin: margen, threshold: umbral });
    }
    this.refrescar();
  }

  /** Observa los elementos nuevos (por ejemplo, tras renderizar con JS). */
  refrescar(contexto = document) {
    $$("[data-stagger]", contexto).forEach((grupo) => {
      $$(".reveal", grupo).forEach((el, i) => {
        if (!el.style.getPropertyValue("--d")) el.style.setProperty("--d", `${Math.min(i, 8) * 90}ms`);
      });
    });
    $$(this.#selector, contexto).forEach((el) => {
      if (el.dataset.observado) return;
      el.dataset.observado = "1";
      if (this.#observador) this.#observador.observe(el);
      else this.#mostrar(el);
    });
  }

  #mostrar(el) { el.classList.add("is-visible"); }
}

/* ------------------------------------------------------------------ */
class ContadorAnimado {
  #el; #valor; #decimales; #sufijo; #duracion; #iniciado = false;

  constructor(el, duracion = 1700) {
    this.#el = el;
    this.#valor = parseFloat(el.dataset.contar);
    this.#decimales = Number(el.dataset.decimales ?? 0);
    this.#sufijo = el.dataset.sufijo ?? "";
    this.#duracion = duracion;
  }

  iniciar() {
    if (this.#iniciado) return;
    this.#iniciado = true;
    if (prefiereMenosMovimiento()) { this.#el.textContent = this.#formatear(this.#valor); return; }
    const inicio = performance.now();
    const paso = (ahora) => {
      const p = Math.min(1, (ahora - inicio) / this.#duracion);
      const suavizado = 1 - Math.pow(1 - p, 3);
      this.#el.textContent = this.#formatear(this.#valor * suavizado);
      if (p < 1) requestAnimationFrame(paso);
      else this.#el.textContent = this.#formatear(this.#valor);
    };
    requestAnimationFrame(paso);
  }

  #formatear(n) {
    return n.toLocaleString("es-PA", { minimumFractionDigits: this.#decimales, maximumFractionDigits: this.#decimales }) + this.#sufijo;
  }

  static observarTodos(contexto = document) {
    const elementos = $$("[data-contar]", contexto).filter((el) => !el.dataset.contadorListo);
    if (!elementos.length) return;
    elementos.forEach((el) => (el.dataset.contadorListo = "1"));
    const contadores = new Map(elementos.map((el) => [el, new ContadorAnimado(el)]));
    if (!("IntersectionObserver" in window)) { contadores.forEach((c) => c.iniciar()); return; }
    const observador = new IntersectionObserver((entradas) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue;
        contadores.get(e.target).iniciar();
        observador.unobserve(e.target);
      }
    }, { threshold: 0.5 });
    elementos.forEach((el) => observador.observe(el));
  }
}

/* ------------------------------------------------------------------ */
/**
 * Hero con vídeo que reacciona al scroll.
 * En escritorio el bloque mide varias pantallas de alto; mientras el usuario
 * baja, la posición del vídeo avanza (currentTime) y los textos cambian.
 * En móvil o con "reducir movimiento" se convierte en un hero normal con el
 * vídeo en bucle.
 */
class HeroScrollVideo {
  #raiz; #video; #beats; #rail; #num; #consulta;
  #srcEscritorio; #estatico = null;
  #progreso = 0; #objetivo = 0; #duracion = 0; #listo = false; #rafId = null;
  #umbrales = [0.3, 0.6];

  constructor(raiz) {
    this.#raiz = raiz;
    this.#video = $(".hero-video", raiz);
    this.#beats = $$(".hero-beat", raiz);
    this.#rail = $(".hero-rail__linea i", raiz);
    this.#num = $(".hero-rail__num", raiz);
    if (!this.#video) return;

    this.#srcEscritorio = this.#video.getAttribute("src");
    this.#consulta = window.matchMedia("(max-width: 767.98px), (hover: none) and (pointer: coarse)");
    this.#aplicarModo();
    // Si la ventana cruza el umbral (o cambia el tipo de puntero), se cambia de modo.
    this.#consulta.addEventListener?.("change", () => this.#aplicarModo());
    window.addEventListener("scroll", () => this.#programar(), { passive: true });
    window.addEventListener("resize", () => this.#programar(), { passive: true });
  }

  #aplicarModo() {
    const estatico = this.#consulta.matches || prefiereMenosMovimiento();
    if (estatico === this.#estatico) return;
    this.#estatico = estatico;
    if (estatico) this.#modoEstatico();
    else this.#modoScroll();
  }

  #modoEstatico() {
    this.#raiz.classList.add("hero--static");
    const video = this.#video;
    const movil = video.dataset.srcMovil;
    if (movil && window.innerWidth < 900 && video.getAttribute("src") !== movil) video.src = movil;
    video.muted = true;
    video.playsInline = true;
    video.loop = true;
    if (!prefiereMenosMovimiento()) video.play().catch(() => {});
    window.setTimeout(() => $$("mark", this.#raiz).forEach((m) => m.classList.add("is-visible")), 350);
  }

  #modoScroll() {
    this.#raiz.classList.remove("hero--static");
    const video = this.#video;
    video.loop = false;
    video.pause();
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    if (video.getAttribute("src") !== this.#srcEscritorio) {
      this.#listo = false;
      video.src = this.#srcEscritorio;
    }

    const alListo = () => {
      this.#duracion = video.duration || 0;
      this.#listo = true;
      this.#actualizar(true);
    };
    if (video.readyState >= 1 && video.getAttribute("src") === this.#srcEscritorio && this.#listo !== false) alListo();
    else video.addEventListener("loadedmetadata", alListo, { once: true });
    try { video.load(); } catch (_) { /* algunos navegadores no lo necesitan */ }

    this.#actualizar(true);
  }

  #calcularProgreso() {
    const rect = this.#raiz.getBoundingClientRect();
    const recorrido = this.#raiz.offsetHeight - window.innerHeight;
    if (recorrido <= 0) return 0;
    return Math.min(1, Math.max(0, -rect.top / recorrido));
  }

  #programar() {
    if (this.#rafId) return;
    this.#rafId = requestAnimationFrame(() => {
      this.#rafId = null;
      this.#actualizar();
    });
  }

  #actualizar(forzar = false) {
    this.#objetivo = this.#calcularProgreso();
    const diferencia = this.#objetivo - this.#progreso;
    this.#progreso = forzar || Math.abs(diferencia) < 0.0008 ? this.#objetivo : this.#progreso + diferencia * 0.16;

    if (this.#listo && this.#duracion > 0) {
      const tiempo = this.#progreso * Math.max(0, this.#duracion - 0.06);
      if (Math.abs(this.#video.currentTime - tiempo) > 0.015) {
        try { this.#video.currentTime = tiempo; } catch (_) { /* aún no se puede buscar */ }
      }
    }

    this.#actualizarBeats(this.#objetivo);
    if (this.#rail) this.#rail.style.setProperty("--p", this.#progreso.toFixed(4));
    this.#raiz.classList.toggle("is-avanzado", this.#objetivo > 0.04);

    if (!forzar && Math.abs(diferencia) >= 0.0008) this.#programar();
  }

  #actualizarBeats(p) {
    const total = this.#beats.length;
    if (!total) return;
    let indice = this.#umbrales.findIndex((u) => p < u);
    if (indice === -1) indice = total - 1;
    indice = Math.min(indice, total - 1);

    this.#beats.forEach((beat, i) => {
      const activo = i === indice;
      if (activo && !beat.classList.contains("is-active")) {
        requestAnimationFrame(() => $$("mark", beat).forEach((m) => m.classList.add("is-visible")));
      }
      if (!activo) $$("mark", beat).forEach((m) => m.classList.remove("is-visible"));
      beat.classList.toggle("is-active", activo);
      beat.classList.toggle("is-past", i < indice);
    });
    if (this.#num) this.#num.textContent = `${String(indice + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
  }
}

/* ------------------------------------------------------------------ */
class Marquesina {
  constructor(el, textos = []) {
    if (!el || !textos.length) return;
    const grupo = (oculto) =>
      `<div class="marquesina__grupo"${oculto ? ' aria-hidden="true"' : ""}>` +
      textos.map((t) => `<span class="marquesina__item">${escaparHTML(t)}</span>`).join("") +
      "</div>";
    el.innerHTML = `<div class="marquesina__pista">${grupo(false)}${grupo(true)}</div>`;
  }
}

/* ------------------------------------------------------------------ */
class Aviso {
  static mostrar(texto, retraso = 3600) {
    const el = $("#avisoGlobal");
    if (!el || !window.bootstrap) { console.info(texto); return; }
    $(".toast-body", el).textContent = texto;
    bootstrap.Toast.getOrCreateInstance(el, { delay: retraso }).show();
  }
}

/* ------------------------------------------------------------------ */
class Plantillas {
  static estrellas(calificacion, sesiones) {
    return `<span class="estrellas" title="${calificacion.toFixed(1)} de 5 en ${sesiones} sesiones">${ICONOS.estrella}<span>${calificacion.toFixed(1)}</span><span class="txt-suave fw-normal">(${sesiones})</span></span>`;
  }

  static tutor(t) {
    const materias = t.materias.map((c) => Repositorio.materias.porCodigo(c)?.nombre ?? c);
    const foto = t.foto
      ? `<img src="${escaparHTML(t.foto)}" alt="Retrato de ${escaparHTML(t.nombre)}" width="720" height="960" loading="lazy" decoding="async">`
      : `<div class="tutor__avatar" aria-hidden="true"><span>${escaparHTML(t.iniciales)}</span></div>`;
    return `
      <div class="col-md-6 col-xl-4 reveal">
        <article class="tarjeta tutor" data-tutor="${escaparHTML(t.id)}">
          <div class="tutor__foto">
            ${foto}
            <span class="verificado">Verificado UTP</span>
            ${t.disponibleHoy ? '<span class="disponible">Disponible hoy</span>' : ""}
          </div>
          <div class="tutor__cuerpo">
            <div>
              <h3 class="tutor__nombre">${escaparHTML(t.nombre)}</h3>
              <p class="tutor__carrera">${escaparHTML(t.carrera)} · ${ordinal(t.semestre)} semestre</p>
            </div>
            <div class="chips">${materias.map((m) => `<span class="etiqueta">${escaparHTML(m)}</span>`).join("")}</div>
            <p class="tutor__frase">“${escaparHTML(t.frase)}”</p>
            <div class="tutor__meta">
              ${Plantillas.estrellas(t.calificacion, t.sesiones)}
              <span class="tutor__precio${t.esIntercambio ? " tutor__precio--intercambio" : ""}">${escaparHTML(t.precioTexto)}</span>
            </div>
            <p class="tutor__modalidad">${escaparHTML(t.modalidadesTexto)} · ${escaparHTML(t.horario)}</p>
            <div class="tutor__acciones">
              <button class="btn btn-tinta btn-sm btn-carrito" type="button" data-agregar-tutor="${escaparHTML(t.id)}" aria-haspopup="dialog">${ICONOS.carrito}${ICONOS.check}<span data-texto>Al carrito</span><span class="visually-hidden">: horas con ${escaparHTML(t.nombreCorto)}</span></button>
              <a class="btn btn-linea btn-sm" href="contacto.html?tutor=${encodeURIComponent(t.id)}" aria-label="Preguntar a ${escaparHTML(t.nombreCorto)} antes de reservar">Preguntar</a>
            </div>
          </div>
        </article>
      </div>`;
  }

  static materia(m) {
    const barras = Array.from({ length: 5 }, (_, i) => `<i class="${i < m.demanda ? "on" : ""}"></i>`).join("");
    const demanda = m.demandaTexto.toLowerCase();
    return `
      <div class="col-sm-6 col-lg-4 reveal">
        <article class="tarjeta materia">
          <div class="materia__codigo"><span>${escaparHTML(m.codigo)}</span><span class="etiqueta">${escaparHTML(Repositorio.areaCorta(m.area))}</span></div>
          <h3 class="materia__nombre">${escaparHTML(m.nombre)}</h3>
          <p class="small txt-suave mb-0">${escaparHTML(m.semestreTexto)} · ${m.temas.map(escaparHTML).join(", ")}</p>
          <div class="materia__pie">
            <span class="d-inline-flex align-items-center gap-2" title="Demanda ${escaparHTML(demanda)}"><span class="demanda" aria-hidden="true">${barras}</span><span class="small">Demanda ${escaparHTML(demanda)}</span></span>
            <span><strong>${m.tutores}</strong> ${m.tutores === 1 ? "tutor" : "tutores"}</span>
          </div>
          <a class="enlace-flecha align-self-start" href="tutores.html?materia=${encodeURIComponent(m.codigo)}">Ver tutores ${ICONOS.flecha}</a>
        </article>
      </div>`;
  }

  static nota(t) {
    return `
      <div class="reveal">
        <article class="nota" style="--nota-bg:${escaparHTML(t.color)};--rot:${t.rotacion}deg">
          <blockquote>${escaparHTML(t.texto)}</blockquote>
          <footer>
            <span class="avatar-iniciales" aria-hidden="true">${escaparHTML(t.iniciales)}</span>
            <div><strong>${escaparHTML(t.nombre)}</strong>${escaparHTML(t.detalle)} · ${escaparHTML(t.materia)}</div>
          </footer>
        </article>
      </div>`;
  }

  static pregunta(p, i, idPadre = "faq") {
    const id = `${idPadre}-${i}`;
    const abierta = i === 0;
    return `
      <div class="accordion-item">
        <h3 class="accordion-header">
          <button class="accordion-button${abierta ? "" : " collapsed"}" type="button" data-bs-toggle="collapse" data-bs-target="#${id}" aria-expanded="${abierta}" aria-controls="${id}">${escaparHTML(p.pregunta)}</button>
        </h3>
        <div id="${id}" class="accordion-collapse collapse${abierta ? " show" : ""}" data-bs-parent="#${idPadre}">
          <div class="accordion-body">${escaparHTML(p.respuesta)}</div>
        </div>
      </div>`;
  }

  static estadistica(e) {
    return `
      <div class="col-6 col-lg-3 reveal">
        <div class="dato">
          <span class="dato__valor"><span data-contar="${e.valor}" data-decimales="${e.decimales ?? 0}" data-sufijo="${escaparHTML(e.sufijo ?? "")}">0</span></span>
          <span class="dato__texto">${escaparHTML(e.texto)}</span>
        </div>
      </div>`;
  }

  static chipArea(area, nombre, cantidad, activa) {
    return `<button type="button" class="chip${activa ? " is-active" : ""}" data-area="${escaparHTML(area)}" aria-pressed="${activa}">${escaparHTML(nombre)}${cantidad != null ? ` <span class="num">${cantidad}</span>` : ""}</button>`;
  }

  static vacio(titulo, texto, enlace) {
    return `
      <div class="col-12">
        <div class="vacio">
          <h3>${escaparHTML(titulo)}</h3>
          <p class="txt-suave mb-3">${escaparHTML(texto)}</p>
          ${enlace ? `<a class="btn btn-linea" href="${escaparHTML(enlace.href)}">${escaparHTML(enlace.texto)}</a>` : ""}
        </div>
      </div>`;
  }
}
