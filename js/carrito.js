/* =====================================================================
   carrito.js — Carrito de reservas de tutorías (POO)

   En A la Par no se compran objetos: se compran horas de tutoría. Cada
   línea del carrito es «N horas de <materia> con <tutor>, <modalidad>».

   Clases:
     Dinero            → redondeo a centavos y formato ($12.60)
     AlmacenLocal      → lectura y escritura segura en localStorage
     ArticuloCarrito   → una línea: tutor + materia + modalidad + horas
     Carrito           → las líneas, los totales, el descuento por paquete
                         y el aviso a quien esté mirando (patrón observador)
     Reserva           → hereda de Solicitud (validacion.js): folio y fecha,
                         más las sesiones y los importes congelados
     PlantillasCarrito → HTML de las líneas, el resumen y el historial
     ModalReserva      → ventana para elegir materia, modalidad y horas
     VistaCarrito      → botón de la cabecera, panel lateral y botones
                         «Al carrito» de las tarjetas de tutor
     FormularioReserva → datos del estudiante, forma de pago y confirmación
     Tienda            → arranca el carrito una sola vez por página

   Aún no hay base de datos: el carrito y las reservas viven en el
   navegador. En el Proyecto 2 la reserva se enviará al servidor.
   ===================================================================== */
"use strict";

class Dinero {
  static redondear(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }
  static formato(n) { return `$${Dinero.redondear(n).toFixed(2)}`; }
}

/* ------------------------------------------------------------------ */
class AlmacenLocal {
  #clave;

  constructor(clave) { this.#clave = clave; }

  get clave() { return this.#clave; }

  leer() {
    try {
      const valor = JSON.parse(localStorage.getItem(this.#clave) ?? "[]");
      return Array.isArray(valor) ? valor : [];
    } catch (_) { return []; }
  }

  escribir(lista) {
    try { localStorage.setItem(this.#clave, JSON.stringify(lista)); return true; }
    catch (_) { return false; }
  }

  agregar(elemento) {
    const lista = this.leer();
    lista.push(elemento);
    return this.escribir(lista);
  }
}

/* ------------------------------------------------------------------ */
class ArticuloCarrito {
  static MAX_HORAS = 8;
  #tutor; #materia; #modalidad; #horas = 1;

  constructor({ tutor, materia, modalidad, horas = 1 }) {
    const t = tutor instanceof Tutor ? tutor : Repositorio.tutores.porId(tutor);
    if (!t) throw new Error(`No existe el tutor «${tutor}»`);
    if (!t.ensena(materia)) throw new Error(`${t.nombre} no da la materia «${materia}»`);
    if (!modalidad || !t.ofrece(modalidad)) throw new Error(`${t.nombre} no ofrece la modalidad «${modalidad}»`);
    this.#tutor = t;
    this.#materia = materia;
    this.#modalidad = modalidad;
    this.horas = horas;
  }

  /** Mismo tutor, misma materia y misma modalidad = misma línea. */
  get clave() { return `${this.#tutor.id}|${this.#materia}|${this.#modalidad}`; }
  get tutor() { return this.#tutor; }
  get materia() { return this.#materia; }
  get materiaNombre() { return Repositorio.materias.porCodigo(this.#materia)?.nombre ?? this.#materia; }
  get modalidad() { return this.#modalidad; }
  get modalidadTexto() { return { presencial: "Presencial", virtual: "Virtual" }[this.#modalidad] ?? this.#modalidad; }
  get horas() { return this.#horas; }
  set horas(n) { this.#horas = ArticuloCarrito.limitar(n); }
  get enTope() { return this.#horas >= ArticuloCarrito.MAX_HORAS; }

  /** La tarifa se lee siempre del catálogo, nunca de lo guardado en el navegador. */
  get precioHora() { return this.#tutor.precio; }
  get esIntercambio() { return this.#tutor.esIntercambio; }
  get subtotal() { return Dinero.redondear(this.precioHora * this.#horas); }

  /** Entre 1 y MAX_HORAS horas enteras. */
  static limitar(n) {
    const v = Math.round(Number(n));
    if (!Number.isFinite(v)) return 1;
    return Math.min(ArticuloCarrito.MAX_HORAS, Math.max(1, v));
  }

  toJSON() {
    return { tutor: this.#tutor.id, materia: this.#materia, modalidad: this.#modalidad, horas: this.#horas };
  }

  /** Reconstruye una línea guardada; si ya no es válida devuelve null. */
  static desdeObjeto(obj) {
    try { return new ArticuloCarrito(obj ?? {}); }
    catch (_) { return null; }
  }
}

/* ------------------------------------------------------------------ */
class Carrito {
  static UMBRAL_DESCUENTO = 4;   // horas pagadas en una misma reserva
  static TASA_DESCUENTO = 0.1;   // «paquete de parcial»: 10 % menos

  #lineas = new Map(); #suscriptores = new Set(); #almacen;

  constructor(almacen = new AlmacenLocal("alapar:carrito")) {
    this.#almacen = almacen;
    this.#cargar();
    // Si otra pestaña cambia el carrito, esta se pone al día.
    window.addEventListener("storage", (e) => {
      if (e.key !== this.#almacen.clave) return;
      this.#cargar();
      this.#avisar("sincronizado");
    });
  }

  #cargar() {
    this.#lineas.clear();
    for (const obj of this.#almacen.leer()) {
      const linea = ArticuloCarrito.desdeObjeto(obj);
      if (!linea) continue;
      const previa = this.#lineas.get(linea.clave);
      if (previa) previa.horas += linea.horas;
      else this.#lineas.set(linea.clave, linea);
    }
  }

  #guardar() { this.#almacen.escribir(this.articulos.map((a) => a.toJSON())); }

  #avisar(evento, linea = null) {
    for (const fn of this.#suscriptores) {
      try { fn(evento, linea, this); } catch (error) { console.error(error); }
    }
  }

  /** Registra una función que se llama con (evento, línea, carrito) en cada cambio. */
  suscribir(fn) {
    this.#suscriptores.add(fn);
    return () => this.#suscriptores.delete(fn);
  }

  get articulos() { return [...this.#lineas.values()]; }
  get cantidad() { return this.#lineas.size; }
  get vacio() { return this.#lineas.size === 0; }
  get totalHoras() { return this.articulos.reduce((s, a) => s + a.horas, 0); }
  get horasPagadas() { return this.articulos.filter((a) => !a.esIntercambio).reduce((s, a) => s + a.horas, 0); }
  get horasIntercambio() { return this.totalHoras - this.horasPagadas; }
  get tienePagados() { return this.horasPagadas > 0; }
  get tieneIntercambio() { return this.horasIntercambio > 0; }
  get subtotal() { return Dinero.redondear(this.articulos.reduce((s, a) => s + a.subtotal, 0)); }
  get conDescuento() { return this.horasPagadas >= Carrito.UMBRAL_DESCUENTO; }
  get descuento() { return this.conDescuento ? Dinero.redondear(this.subtotal * Carrito.TASA_DESCUENTO) : 0; }
  get total() { return Dinero.redondear(this.subtotal - this.descuento); }
  get faltanParaDescuento() { return Math.max(0, Carrito.UMBRAL_DESCUENTO - this.horasPagadas); }

  obtener(clave) { return this.#lineas.get(clave) ?? null; }

  horasCon(idTutor) {
    return this.articulos.filter((a) => a.tutor.id === idTutor).reduce((s, a) => s + a.horas, 0);
  }

  /** Añade horas. Si la línea ya existe, suma. Lanza error si la combinación no existe. */
  agregar(datos) {
    const nueva = new ArticuloCarrito(datos);
    const previa = this.#lineas.get(nueva.clave);
    if (previa) previa.horas += nueva.horas;
    else this.#lineas.set(nueva.clave, nueva);
    const linea = previa ?? nueva;
    this.#guardar();
    this.#avisar("agregado", linea);
    return linea;
  }

  cambiarHoras(clave, horas) {
    const linea = this.#lineas.get(clave);
    if (!linea) return null;
    linea.horas = horas;
    this.#guardar();
    this.#avisar("actualizado", linea);
    return linea;
  }

  quitar(clave) {
    const linea = this.#lineas.get(clave);
    if (!linea) return null;
    this.#lineas.delete(clave);
    this.#guardar();
    this.#avisar("quitado", linea);
    return linea;
  }

  vaciar() {
    if (this.vacio) return;
    this.#lineas.clear();
    this.#guardar();
    this.#avisar("vaciado");
  }
}

/* ------------------------------------------------------------------ */
/** Una reserva confirmada. Hereda folio y fecha de Solicitud. */
class Reserva extends Solicitud {
  static prefijo = "RES";

  /** Congela el carrito: si mañana cambia una tarifa, esta reserva no cambia. */
  constructor(cliente, carrito) {
    super({
      ...cliente,
      sesiones: carrito.articulos.map((a) => ({
        tutor: a.tutor.id,
        tutorNombre: a.tutor.nombre,
        materia: a.materia,
        materiaNombre: a.materiaNombre,
        modalidad: a.modalidad,
        horas: a.horas,
        precioHora: a.precioHora,
        subtotal: a.subtotal,
        intercambio: a.esIntercambio
      })),
      horas: carrito.totalHoras,
      subtotal: carrito.subtotal,
      descuento: carrito.descuento,
      total: carrito.total
    });
  }

  static textoPago(pago) {
    return {
      yappy: "Yappy al tutor, al terminar cada sesión",
      efectivo: "Efectivo al tutor, al terminar cada sesión",
      intercambio: "Intercambio de materias, sin dinero"
    }[pago] ?? pago;
  }
}

/* ------------------------------------------------------------------ */
class PlantillasCarrito {
  static avatar(tutor) {
    return tutor.foto
      ? `<img class="avatar-tutor" src="${escaparHTML(tutor.foto)}" alt="" width="56" height="56" loading="lazy" decoding="async">`
      : `<span class="avatar-tutor avatar-tutor--iniciales" aria-hidden="true">${escaparHTML(tutor.iniciales)}</span>`;
  }

  static linea(a) {
    const t = a.tutor;
    const precio = a.esIntercambio
      ? '<span class="linea-carrito__precio linea-carrito__precio--intercambio">Intercambio</span>'
      : `<span class="linea-carrito__precio">${Dinero.formato(a.subtotal)}</span>`;
    const tarifa = a.esIntercambio ? "Intercambio de materias" : `${Dinero.formato(a.precioHora)} por hora`;
    return `
      <li class="linea-carrito" data-clave="${escaparHTML(a.clave)}">
        ${PlantillasCarrito.avatar(t)}
        <div class="linea-carrito__info">
          <p class="linea-carrito__tutor">${escaparHTML(t.nombre)}</p>
          <p class="linea-carrito__detalle">${escaparHTML(a.materiaNombre)} · ${escaparHTML(a.modalidadTexto)}</p>
          <p class="linea-carrito__tarifa">${escaparHTML(tarifa)}</p>
        </div>
        ${precio}
        <div class="linea-carrito__controles">
          <div class="contador-horas" role="group" aria-label="Horas de ${escaparHTML(a.materiaNombre)} con ${escaparHTML(t.nombreCorto)}">
            <button type="button" data-carrito-accion="menos" aria-label="Una hora menos"${a.horas <= 1 ? " disabled" : ""}>−</button>
            <output>${a.horas} h</output>
            <button type="button" data-carrito-accion="mas" aria-label="Una hora más"${a.enTope ? " disabled" : ""}>+</button>
          </div>
          <button type="button" class="linea-carrito__quitar" data-carrito-accion="quitar" aria-label="Quitar ${escaparHTML(a.materiaNombre)} con ${escaparHTML(t.nombreCorto)}">Quitar</button>
        </div>
      </li>`;
  }

  static barraDescuento(c) {
    if (!c.tienePagados) return "";
    const umbral = Carrito.UMBRAL_DESCUENTO;
    const hechas = Math.min(umbral, c.horasPagadas);
    const faltan = c.faltanParaDescuento;
    const texto = c.conDescuento
      ? "<strong>Paquete de parcial aplicado:</strong> pagas un 10 % menos."
      : `Te ${faltan === 1 ? "falta 1 hora" : `faltan ${faltan} horas`} para el <strong>10 % de descuento</strong> del paquete de parcial.`;
    return `
      <div class="barra-descuento${c.conDescuento ? " is-completa" : ""}">
        <p class="barra-descuento__texto">${texto}</p>
        <div class="barra-descuento__pista" role="progressbar" aria-label="Horas pagadas para el descuento" aria-valuemin="0" aria-valuemax="${umbral}" aria-valuenow="${hechas}"><i style="--p:${(hechas / umbral).toFixed(3)}"></i></div>
      </div>`;
  }

  static resumen(c) {
    const intercambio = c.horasIntercambio ? ` <span class="txt-suave">(${c.horasIntercambio} por intercambio)</span>` : "";
    return `
      ${PlantillasCarrito.barraDescuento(c)}
      <dl class="resumen-carrito">
        <div><dt>Horas</dt><dd>${c.totalHoras} h${intercambio}</dd></div>
        <div><dt>Subtotal</dt><dd>${Dinero.formato(c.subtotal)}</dd></div>
        ${c.descuento ? `<div class="is-descuento"><dt>Paquete de parcial (−10 %)</dt><dd>−${Dinero.formato(c.descuento)}</dd></div>` : ""}
        <div class="is-total"><dt>Total</dt><dd>${Dinero.formato(c.total)}</dd></div>
      </dl>`;
  }

  static sesionConfirmada(s) {
    const modalidad = { presencial: "presencial", virtual: "virtual" }[s.modalidad] ?? s.modalidad;
    return `
      <li>
        <span><strong>${escaparHTML(s.materiaNombre)}</strong> con ${escaparHTML(s.tutorNombre)} · ${s.horas} h ${escaparHTML(modalidad)}</span>
        <span class="text-nowrap">${s.intercambio ? "Intercambio" : Dinero.formato(s.subtotal)}</span>
      </li>`;
  }

  static reservaPrevia(r) {
    const fecha = new Date(r.fecha).toLocaleString("es-PA", { dateStyle: "medium", timeStyle: "short" });
    const tutores = [...new Set((r.sesiones ?? []).map((s) => s.tutorNombre))].join(", ");
    return `
      <li class="reserva-previa">
        <div>
          <strong class="reserva-previa__folio">${escaparHTML(r.folio)}</strong>
          <span class="txt-suave small d-block">${escaparHTML(fecha)} · ${escaparHTML(tutores)}</span>
        </div>
        <div class="text-end">
          <strong>${Dinero.formato(r.total ?? 0)}</strong>
          <span class="txt-suave small d-block">${r.horas ?? 0} h</span>
        </div>
      </li>`;
  }
}

/* ------------------------------------------------------------------ */
class ModalReserva {
  #carrito; #alAgregar; #el; #form; #tutor = null; #horas = 1; #agregado = false;
  #materia; #modalidades; #salidaHoras; #importe; #calculo; #cabecera; #horario;

  constructor(carrito, alAgregar) {
    this.#carrito = carrito;
    this.#alAgregar = alAgregar;
    this.#el = $("#modalReserva");
    if (!this.#el) return;

    this.#form = $("form", this.#el);
    this.#materia = $("#reservaMateria", this.#el);
    this.#modalidades = $('[data-reserva="modalidades"]', this.#el);
    this.#salidaHoras = $("#reservaHoras", this.#el);
    this.#importe = $('[data-reserva="importe"]', this.#el);
    this.#calculo = $('[data-reserva="calculo"]', this.#el);
    this.#cabecera = $('[data-reserva="tutor"]', this.#el);
    this.#horario = $('[data-reserva="horario"]', this.#el);

    this.#el.addEventListener("click", (e) => {
      const boton = e.target.closest("[data-horas]");
      if (boton) this.#ponerHoras(this.#horas + Number(boton.dataset.horas));
    });
    this.#form.addEventListener("submit", (e) => { e.preventDefault(); this.#agregar(); });
    // El panel del carrito se abre cuando la ventana ya se cerró del todo.
    this.#el.addEventListener("hidden.bs.modal", () => {
      if (!this.#agregado) return;
      this.#agregado = false;
      this.#alAgregar?.();
    });
  }

  abrir(idTutor) {
    const tutor = Repositorio.tutores.porId(idTutor);
    if (!tutor) return;

    // Sin la ventana (o sin Bootstrap) se añade lo más habitual: 1 h de su primera materia.
    if (!this.#el || !window.bootstrap) {
      this.#carrito.agregar({ tutor, materia: tutor.materias[0], modalidad: tutor.modalidades[0], horas: 1 });
      Aviso.mostrar(`Añadiste 1 h con ${tutor.nombreCorto} al carrito.`);
      return;
    }

    this.#tutor = tutor;
    this.#pintarCabecera();
    this.#pintarMaterias();
    this.#pintarModalidades();
    const horario = tutor.horario.trim().replace(/\.?$/, ".");
    this.#horario.textContent = `Horario habitual: ${horario} El día exacto lo acuerdas con ${tutor.nombreCorto.split(" ")[0]} al confirmar.`;
    this.#ponerHoras(1);
    bootstrap.Modal.getOrCreateInstance(this.#el).show();
  }

  #pintarCabecera() {
    const t = this.#tutor;
    const tarifa = t.esIntercambio ? "Intercambio de materias" : `${Dinero.formato(t.precio)} por hora`;
    this.#cabecera.innerHTML = `
      ${PlantillasCarrito.avatar(t)}
      <div>
        <span class="eyebrow mb-1">Reservar horas</span>
        <h2 class="modal-title" id="modalReservaTitulo">${escaparHTML(t.nombre)}</h2>
        <p>${escaparHTML(t.carrera)} · ★ ${t.calificacion.toFixed(1)} · ${escaparHTML(tarifa)}</p>
      </div>`;
  }

  #pintarMaterias() {
    // Si el directorio está filtrado por una materia que este tutor da, se preselecciona.
    const preferida = new URLSearchParams(window.location.search).get("materia");
    this.#materia.innerHTML = this.#tutor.materias.map((codigo) => {
      const nombre = Repositorio.materias.porCodigo(codigo)?.nombre ?? codigo;
      return `<option value="${escaparHTML(codigo)}">${escaparHTML(nombre)} (${escaparHTML(codigo)})</option>`;
    }).join("");
    if (preferida && this.#tutor.ensena(preferida)) this.#materia.value = preferida;
  }

  #pintarModalidades() {
    const detalle = { presencial: "En el campus", virtual: "Videollamada" };
    const nombre = { presencial: "Presencial", virtual: "Virtual" };
    this.#modalidades.innerHTML = this.#tutor.modalidades.map((m, i) => `
      <div class="col-6 opcion-rol">
        <input type="radio" id="reservaModalidad-${escaparHTML(m)}" name="modalidad" value="${escaparHTML(m)}"${i === 0 ? " checked" : ""}>
        <label for="reservaModalidad-${escaparHTML(m)}"><strong>${escaparHTML(nombre[m] ?? m)}</strong><small>${escaparHTML(detalle[m] ?? "")}</small></label>
      </div>`).join("");
  }

  #ponerHoras(n) {
    this.#horas = ArticuloCarrito.limitar(n);
    this.#salidaHoras.textContent = `${this.#horas} h`;
    $('[data-horas="-1"]', this.#el).disabled = this.#horas <= 1;
    $('[data-horas="1"]', this.#el).disabled = this.#horas >= ArticuloCarrito.MAX_HORAS;
    const t = this.#tutor;
    if (t.esIntercambio) {
      this.#importe.textContent = "Intercambio";
      this.#calculo.textContent = `Das ${this.#horas} h de otra materia a cambio`;
    } else {
      this.#importe.textContent = Dinero.formato(t.precio * this.#horas);
      this.#calculo.textContent = `${this.#horas} h × ${Dinero.formato(t.precio)}`;
    }
  }

  #agregar() {
    const modalidad = $('input[name="modalidad"]:checked', this.#form)?.value;
    const materia = this.#materia.value;
    const clave = `${this.#tutor.id}|${materia}|${modalidad}`;
    const antes = this.#carrito.obtener(clave)?.horas ?? 0;
    try {
      const linea = this.#carrito.agregar({ tutor: this.#tutor, materia, modalidad, horas: this.#horas });
      if (antes + this.#horas > linea.horas) {
        Aviso.mostrar(`Máximo ${ArticuloCarrito.MAX_HORAS} h por materia con un mismo tutor: quedó en ${linea.horas} h.`);
      }
      this.#agregado = true;
      bootstrap.Modal.getInstance(this.#el)?.hide();
    } catch (error) {
      console.error(error);
      Aviso.mostrar("No pudimos añadir esa sesión. Revisa la materia y la modalidad.");
    }
  }
}

/* ------------------------------------------------------------------ */
class VistaCarrito {
  #carrito; #modal; #lateral; #anuncio;

  constructor(carrito) {
    this.#carrito = carrito;
    this.#lateral = $("#carritoLateral");
    this.#anuncio = $("#carritoAnuncio");
    this.#modal = new ModalReserva(carrito, () => this.abrirLateral());
    carrito.suscribir((evento, linea) => this.#alCambiar(evento, linea));
    document.addEventListener("click", (e) => this.#alHacerClic(e));
    this.pintar();
  }

  abrirLateral() {
    if (!this.#lateral || !window.bootstrap) { window.location.href = "carrito.html"; return; }
    bootstrap.Offcanvas.getOrCreateInstance(this.#lateral).show();
  }

  /** Pinta todo lo que depende del carrito: contador, listas, resúmenes y botones. */
  pintar() {
    const c = this.#carrito;
    for (const num of $$("[data-carrito-num]")) { num.textContent = c.totalHoras; num.hidden = c.vacio; }
    for (const boton of $$("[data-carrito-boton]")) {
      boton.setAttribute("aria-label", c.vacio
        ? "Carrito vacío"
        : `Carrito: ${c.totalHoras} ${c.totalHoras === 1 ? "hora" : "horas"}, total ${Dinero.formato(c.total)}`);
    }
    for (const lista of $$("[data-carrito-lista]")) lista.innerHTML = c.articulos.map(PlantillasCarrito.linea).join("");
    for (const resumen of $$("[data-carrito-resumen]")) {
      const previo = $(".barra-descuento__pista i", resumen)?.style.getPropertyValue("--p");
      resumen.innerHTML = c.vacio ? "" : PlantillasCarrito.resumen(c);
      this.#animarBarra(resumen, previo);
    }
    for (const el of $$("[data-si-vacio]")) el.hidden = !c.vacio;
    for (const el of $$("[data-si-lleno]")) el.hidden = c.vacio;
    this.marcarBotones();
  }

  /** La barra de marcador crece desde donde estaba, no desde cero. */
  #animarBarra(contenedor, previo) {
    const barra = $(".barra-descuento__pista i", contenedor);
    if (!barra || !previo) return;
    const destino = barra.style.getPropertyValue("--p");
    if (destino === previo) return;
    barra.style.setProperty("--p", previo);
    requestAnimationFrame(() => requestAnimationFrame(() => barra.style.setProperty("--p", destino)));
  }

  /** Estado de los botones «Al carrito» de las tarjetas de tutor. */
  marcarBotones(contexto = document) {
    for (const boton of $$("[data-agregar-tutor]", contexto)) {
      const horas = this.#carrito.horasCon(boton.dataset.agregarTutor);
      boton.classList.toggle("is-en-carrito", horas > 0);
      const texto = $("[data-texto]", boton);
      if (texto) texto.textContent = horas > 0 ? `En carrito · ${horas} h` : "Al carrito";
    }
  }

  #alHacerClic(e) {
    const agregar = e.target.closest("[data-agregar-tutor]");
    if (agregar) {
      e.preventDefault();
      this.#modal.abrir(agregar.dataset.agregarTutor);
      return;
    }

    const accion = e.target.closest("[data-carrito-accion]");
    if (!accion) return;
    const clave = accion.closest("[data-clave]")?.dataset.clave;
    const linea = clave ? this.#carrito.obtener(clave) : null;
    switch (accion.dataset.carritoAccion) {
      case "mas": if (linea) this.#carrito.cambiarHoras(clave, linea.horas + 1); break;
      case "menos": if (linea) this.#carrito.cambiarHoras(clave, linea.horas - 1); break;
      case "quitar": if (linea) this.#carrito.quitar(clave); break;
      case "vaciar": this.#confirmarVaciado(accion); break;
    }
  }

  /** Vaciar pide un segundo toque: nada de ventanas del navegador. */
  #confirmarVaciado(boton) {
    if (boton.dataset.confirmar === "1") {
      boton.dataset.confirmar = "";
      this.#carrito.vaciar();
      return;
    }
    const original = boton.textContent;
    boton.dataset.confirmar = "1";
    boton.textContent = "¿Seguro? Toca otra vez";
    boton.classList.add("is-confirmando");
    window.setTimeout(() => {
      boton.dataset.confirmar = "";
      boton.textContent = original;
      boton.classList.remove("is-confirmando");
    }, 3500);
  }

  #alCambiar(evento, linea) {
    // Repintar reemplaza los botones: se recuerda cuál tenía el foco para devolvérselo.
    const activo = document.activeElement;
    const lista = activo?.closest?.("[data-carrito-lista]");
    const clave = activo?.closest?.("[data-clave]")?.dataset.clave;
    const accion = activo?.dataset?.carritoAccion;

    this.pintar();

    if (lista && clave && accion) {
      const fila = $$("[data-clave]", lista).find((li) => li.dataset.clave === clave);
      const destino = fila ? ($(`[data-carrito-accion="${accion}"]:not(:disabled)`, fila) ?? $('[data-carrito-accion="quitar"]', fila)) : null;
      (destino ?? lista.closest("[data-carrito-zona]")?.querySelector("[data-carrito-titulo]"))?.focus({ preventScroll: true });
    }

    this.#anunciar(evento, linea);
    if (evento === "agregado") this.#rebotar();
  }

  #anunciar(evento, linea) {
    if (!this.#anuncio) return;
    const c = this.#carrito;
    const total = `Total: ${Dinero.formato(c.total)}.`;
    const quien = linea ? `${linea.materiaNombre} con ${linea.tutor.nombreCorto}` : "";
    const textos = {
      agregado: linea && `Añadiste ${quien}: ${linea.horas} h en el carrito. ${total}`,
      actualizado: linea && `${quien}: ${linea.horas} h. ${total}`,
      quitado: linea && `Quitaste ${quien}. ${c.vacio ? "El carrito está vacío." : total}`,
      vaciado: "Vaciaste el carrito."
    };
    const texto = textos[evento];
    if (texto) this.#anuncio.textContent = texto;
  }

  #rebotar() {
    for (const boton of $$("[data-carrito-boton]")) {
      boton.classList.remove("is-rebote");
      void boton.offsetWidth; // reinicia la animación
      boton.classList.add("is-rebote");
    }
  }
}

/* ------------------------------------------------------------------ */
class FormularioReserva {
  #form; #carrito; #almacen; #alConfirmar; #campos = new Map(); #enviando = false;
  #grupoPago; #grupoIntercambio;

  constructor(formulario, carrito, { almacen, alConfirmar } = {}) {
    this.#form = formulario;
    this.#carrito = carrito;
    this.#almacen = almacen ?? new AlmacenLocal("alapar:reservas");
    this.#alConfirmar = alConfirmar;
    this.#grupoPago = $('[data-grupo="pago"]', formulario);
    this.#grupoIntercambio = $('[data-grupo="intercambio"]', formulario);

    this.#form.setAttribute("novalidate", "");
    this.#pintarMaterias();
    this.#definirCampos();
    this.#form.addEventListener("submit", (e) => this.#enviar(e));
    carrito.suscribir(() => this.#ajustarGrupos());
    this.#ajustarGrupos();
  }

  #definirCampos() {
    const c = this.#carrito;
    const definicion = [
      ["nombre", [Validador.requerido("Dinos a nombre de quién va la reserva."), Validador.longitudMinima(3, "El nombre debe tener al menos 3 letras."), Validador.soloLetras()]],
      ["correo", [Validador.requerido("Necesitamos un correo para enviarte la confirmación."), Validador.correo()]],
      ["telefono", [Validador.requerido("Tu tutor te escribe por WhatsApp para fijar la hora."), Validador.telefonoPanama()]],
      ["pago", [Validador.personalizada((v) => !c.tienePagados || v !== "", "Elige cómo le pagarás al tutor.")]],
      ["ofrece", [Validador.personalizada((v) => !c.tieneIntercambio || v !== "", "Elige la materia que das a cambio.")]],
      ["disponibilidad", [Validador.requerido("Cuéntanos qué días y a qué horas puedes."), Validador.longitudMinima(10, "Danos un poco más de detalle: mínimo 10 caracteres."), Validador.longitudMaxima(300, "Máximo 300 caracteres.")]],
      ["acepto", [Validador.marcado("Confirma que entiendes cómo se paga.")]]
    ];
    for (const [nombre, reglas] of definicion) {
      const campo = new CampoFormulario(nombre, this.#form, reglas);
      campo.escuchar();
      this.#campos.set(nombre, campo);
    }
  }

  #pintarMaterias() {
    const select = $("#ofrece", this.#form);
    if (!select) return;
    let html = '<option value="" selected disabled>Elige la materia que dominas…</option>';
    for (const [area, materias] of Repositorio.materias.ordenarPor("nombre").agrupar((m) => m.area)) {
      html += `<optgroup label="${escaparHTML(Repositorio.nombreArea(area))}">`;
      html += materias.map((m) => `<option value="${escaparHTML(m.codigo)}">${escaparHTML(m.nombre)}</option>`).join("");
      html += "</optgroup>";
    }
    select.innerHTML = html;
  }

  /** La forma de pago solo aparece si hay horas pagadas; la materia a cambio, si hay intercambio. */
  #ajustarGrupos() {
    const c = this.#carrito;
    if (this.#grupoPago) {
      this.#grupoPago.hidden = !c.tienePagados;
      if (!c.tienePagados) this.#campos.get("pago")?.limpiar();
    }
    if (this.#grupoIntercambio) {
      this.#grupoIntercambio.hidden = !c.tieneIntercambio;
      if (!c.tieneIntercambio) this.#campos.get("ofrece")?.limpiar();
    }
  }

  #enviar(evento) {
    evento.preventDefault();
    if (this.#enviando) return;
    if (this.#form.elements.sitio?.value) return; // trampa anti-bots
    if (this.#carrito.vacio) { Aviso.mostrar("Tu carrito está vacío: añade horas con algún tutor."); return; }

    let primerInvalido = null;
    for (const campo of this.#campos.values()) {
      if (!campo.validar() && !primerInvalido) primerInvalido = campo;
    }
    if (primerInvalido) {
      primerInvalido.primerControl.focus({ preventScroll: true });
      primerInvalido.primerControl.scrollIntoView({ block: "center", behavior: "smooth" });
      Aviso.mostrar("Revisa los campos marcados en rojo.");
      return;
    }

    this.#enviando = true;
    const boton = $('button[type="submit"]', this.#form);
    const textoOriginal = boton.innerHTML;
    boton.disabled = true;
    boton.textContent = "Confirmando…";

    const c = this.#carrito;
    const datos = {};
    for (const [nombre, campo] of this.#campos) datos[nombre] = campo.valor;
    delete datos.acepto;
    if (!c.tienePagados) datos.pago = "intercambio";
    if (!c.tieneIntercambio) delete datos.ofrece;

    const reserva = new Reserva(datos, c);
    this.#almacen.agregar(reserva);

    // Simulamos la latencia de red. En el Proyecto 2 aquí irá el envío real a la BD.
    window.setTimeout(() => {
      c.vaciar();
      this.#form.reset();
      this.#campos.forEach((campo) => campo.limpiar());
      boton.disabled = false;
      boton.innerHTML = textoOriginal;
      this.#enviando = false;
      this.#alConfirmar?.(reserva);
    }, 700);
  }

  listarReservas() { return this.#almacen.leer(); }
}

/* ------------------------------------------------------------------ */
/** Un solo carrito por página, compartido por todas las vistas. */
const Tienda = {
  carrito: null,
  vista: null,

  iniciar() {
    if (!this.carrito) {
      this.carrito = new Carrito();
      this.vista = new VistaCarrito(this.carrito);
    }
    return this;
  }
};
