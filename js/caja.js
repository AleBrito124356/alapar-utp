/* =====================================================================
   caja.js — La caja: pago SIMULADO de una reserva, con su animación (POO)

   Recibo         → el ticket de la reserva (HTML)
   Coreografia    → animaciones con la Web Animations API: solo transform,
                    opacity y clip-path; se pueden saltar con un clic y con
                    «reducir movimiento» van directo al estado final
   TarjetaPrueba  → la tarjeta dibujada que se rellena mientras escribes
   Caja           → la ventana: método → procesando → pagado (+ intercambio)
   CajaSimulada   → una sola caja por página

   Nada de esto cobra dinero: el servidor solo acepta la tarjeta de prueba
   4242 y del navegador solo salen sus cuatro últimos dígitos.
   ===================================================================== */
"use strict";

const CURVAS = Object.freeze({
  salida: "cubic-bezier(0.22, 1, 0.36, 1)",      // la curva --suave del sitio
  expo: "cubic-bezier(0.16, 1, 0.3, 1)",
  vaiven: "cubic-bezier(0.65, 0, 0.35, 1)"       // de un lugar visible a otro
});

const MODALIDAD_TEXTO = { presencial: "presencial", virtual: "virtual" };

/* ------------------------------------------------------------------ */
class Recibo {
  static fechaLarga(iso) { return fechaLegible(iso); }

  static fechaSello(iso) {
    const d = iso ? new Date(iso) : new Date();
    const dos = (n) => String(n).padStart(2, "0");
    return `${dos(d.getDate())} · ${dos(d.getMonth() + 1)} · ${d.getFullYear()}`;
  }

  static html(r, { sello = "Pagado" } = {}) {
    const lineas = r.lineas.map((l, i) => `
      <li class="recibo__linea" style="--i:${i}">
        <span class="recibo__concepto"><strong>${escaparHTML(l.materiaNombre)}</strong> · ${l.horas} h
          <small>${escaparHTML(l.tutorNombre)} · ${escaparHTML(MODALIDAD_TEXTO[l.modalidad] ?? l.modalidad)}</small></span>
        <span class="recibo__importe">${l.intercambio ? "Intercambio" : Dinero.formato(l.subtotal)}</span>
      </li>`).join("");
    return `
      <div class="recibo-sombra">
      <article class="recibo" aria-label="Recibo de la reserva ${escaparHTML(r.folio)}">
        <header class="recibo__cabecera">
          <span class="recibo__marca">
            <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><rect x="11.5" y="8" width="10" height="25" rx="5" fill="currentColor"/><rect x="26.5" y="3" width="10" height="30" rx="5" fill="currentColor"/><path d="M7.5 40.2C14 38.6 34 38.6 40.5 39.8" stroke="#FFD400" stroke-width="6" stroke-linecap="round" fill="none"/></svg>
            a la par
          </span>
          <span class="recibo__folio">${escaparHTML(r.folio)}</span>
        </header>
        <p class="recibo__fecha">${escaparHTML(Recibo.fechaLarga(r.creada))}</p>
        <ul class="recibo__lineas">${lineas}</ul>
        <dl class="recibo__totales">
          <div><dt>Subtotal</dt><dd>${Dinero.formato(r.subtotal)}</dd></div>
          ${r.descuento ? `<div class="is-descuento"><dt>Paquete de parcial</dt><dd>−${Dinero.formato(r.descuento)}</dd></div>` : ""}
          <div class="recibo__total"><dt>Total</dt><dd><span class="recibo__cifra">${Dinero.formato(r.total)}<i class="recibo__trazo" data-caja="trazo" aria-hidden="true"></i></span></dd></div>
        </dl>
        ${r.ofreceNombre ? `<p class="recibo__intercambio">Intercambio: das <strong>${escaparHTML(r.ofreceNombre)}</strong></p>` : ""}
        <p class="recibo__pie">Gracias por estudiar a la par.</p>
        <div class="sello${r.estado === "pagada" ? " is-puesto" : ""}" data-caja="sello" aria-hidden="true">
          <span class="sello__texto">${escaparHTML(sello)}</span>
          <span class="sello__fecha">${Recibo.fechaSello(r.pagada ?? r.creada)}</span>
        </div>
      </article>
      </div>`;
  }
}

/* ------------------------------------------------------------------ */
class Coreografia {
  #vivas = new Set(); #esperas = new Set();

  static get reducida() { return prefiereMenosMovimiento(); }

  /**
   * Anima un elemento. Al terminar deja el estado final a cargo del CSS
   * (clase `alTerminar`) y suelta la animación, así nada queda «congelado».
   */
  animar(el, fotogramas, opciones = {}, alTerminar = null) {
    if (!el) return Promise.resolve();
    const terminar = () => { if (alTerminar) el.classList.add(alTerminar); };
    if (Coreografia.reducida || typeof el.animate !== "function") { terminar(); return Promise.resolve(); }
    const animacion = el.animate(fotogramas, { duration: 240, easing: CURVAS.salida, fill: "both", ...opciones });
    this.#vivas.add(animacion);
    return animacion.finished
      .catch(() => {})
      .then(() => {
        terminar();
        this.#vivas.delete(animacion);
        if (alTerminar) animacion.cancel();
      });
  }

  esperar(ms) {
    if (Coreografia.reducida) return Promise.resolve();
    return new Promise((resolver) => {
      const espera = { resolver, temporizador: window.setTimeout(() => { this.#esperas.delete(espera); resolver(); }, ms) };
      this.#esperas.add(espera);
    });
  }

  /** Salta al final de todo lo que esté en marcha (clic durante la animación). */
  saltar() {
    for (const animacion of [...this.#vivas]) { try { animacion.finish(); } catch (_) { /* ya terminó */ } }
    for (const espera of [...this.#esperas]) { window.clearTimeout(espera.temporizador); espera.resolver(); }
    this.#esperas.clear();
  }

  get enMarcha() { return this.#vivas.size > 0 || this.#esperas.size > 0; }
}

/* ------------------------------------------------------------------ */
class TarjetaPrueba {
  static NUMERO = "4242 4242 4242 4242";
  #el;

  constructor(el) { this.#el = el; }

  static html() {
    return `
      <div class="tarjeta-prueba" data-tarjeta aria-hidden="true">
        <div class="tarjeta-prueba__giro">
          <div class="tarjeta-prueba__cara tarjeta-prueba__frente">
            <span class="tarjeta-prueba__banco">a la par · tarjeta de prueba</span>
            <span class="tarjeta-prueba__chip"></span>
            <span class="tarjeta-prueba__numero" data-t="numero">•••• •••• •••• ••••</span>
            <span class="tarjeta-prueba__pie"><span data-t="nombre">NOMBRE APELLIDO</span><span data-t="vence">MM/AA</span></span>
            <span class="tarjeta-prueba__brillo"></span>
          </div>
          <div class="tarjeta-prueba__cara tarjeta-prueba__dorso">
            <span class="tarjeta-prueba__banda"></span>
            <span class="tarjeta-prueba__firma"><span data-t="cvc">•••</span></span>
          </div>
        </div>
      </div>`;
  }

  pintar({ numero = "", nombre = "", vence = "", cvc = "" }) {
    const poner = (clave, valor, vacio) => { const el = $(`[data-t="${clave}"]`, this.#el); if (el) el.textContent = valor || vacio; };
    const digitos = numero.replace(/\D/g, "").padEnd(16, "•");
    poner("numero", digitos.match(/.{1,4}/g).join(" "), "");
    poner("nombre", nombre.toUpperCase(), "NOMBRE APELLIDO");
    poner("vence", vence, "MM/AA");
    poner("cvc", cvc.replace(/\d/g, "•") || "", "•••");
  }

  voltear(detras) { this.#el?.classList.toggle("is-volteada", detras); }
  leyendo(si) { this.#el?.classList.toggle("is-leyendo", si); }
}

/* ------------------------------------------------------------------ */
class Caja {
  #el; #cuerpo; #recibo; #panel; #anuncio; #titulo; #cerrar;
  #coreo = new Coreografia();
  #reserva = null; #alTerminar = null; #ocupada = false; #terminada = false;
  #metodo = "yappy"; #campos = new Map(); #tarjeta = null;

  constructor() {
    this.#el = $("#modalCaja");
    if (!this.#el) return;
    this.#cuerpo = $(".caja", this.#el);
    this.#recibo = $('[data-caja="recibo"]', this.#el);
    this.#panel = $('[data-caja="panel"]', this.#el);
    this.#anuncio = $('[data-caja="anuncio"]', this.#el);
    this.#titulo = $("#cajaTitulo", this.#el);
    this.#cerrar = $("[data-caja-cerrar]", this.#el);

    this.#cerrar.addEventListener("click", () => this.cerrar());
    // Mientras se procesa el pago la caja no se cierra (ni con Esc).
    this.#el.addEventListener("hide.bs.modal", (e) => { if (this.#ocupada) e.preventDefault(); });
    this.#el.addEventListener("hidden.bs.modal", () => this.#alCerrar());
    // Un clic durante la animación la salta.
    this.#cuerpo.addEventListener("click", (e) => {
      if (this.#coreo.enMarcha && !e.target.closest("button, a, input, select")) this.#coreo.saltar();
    });
  }

  get disponible() { return Boolean(this.#el && window.bootstrap); }

  abrir(reserva, { alTerminar } = {}) {
    if (!this.disponible) { window.location.assign("mi-cuenta.html"); return; }
    this.#reserva = reserva;
    this.#alTerminar = alTerminar ?? null;
    this.#terminada = reserva.estado === "pagada";
    this.#ocupada = false;
    this.#fase("metodo");
    const soloIntercambio = reserva.total === 0;
    this.#titulo.textContent = soloIntercambio ? "Confirma tu intercambio" : `Paga tu reserva · ${Dinero.formato(reserva.total)}`;
    this.#recibo.innerHTML = Recibo.html(reserva, { sello: soloIntercambio ? "Acordado" : "Pagado" });
    this.#panel.innerHTML = soloIntercambio ? this.#htmlSoloIntercambio() : this.#htmlMetodos();
    this.#prepararPanel();

    const modal = bootstrap.Modal.getOrCreateInstance(this.#el);
    this.#el.addEventListener("shown.bs.modal", () => this.#imprimirRecibo(), { once: true });
    modal.show();
  }

  cerrar() {
    if (this.#ocupada) return;
    bootstrap.Modal.getInstance(this.#el)?.hide();
  }

  /* ---------------- fase 1: elegir método ---------------- */

  #lineasIntercambio() { return this.#reserva.lineas.filter((l) => l.intercambio); }

  #htmlIntercambioAviso() {
    const recibe = this.#lineasIntercambio();
    if (!recibe.length) return "";
    const materias = recibe.map((l) => `<strong>${escaparHTML(l.materiaNombre)}</strong> con ${escaparHTML(l.tutorNombre)}`).join(" y ");
    return `<p class="caja__intercambio">⇄ Además acuerdas un intercambio: das <strong>${escaparHTML(this.#reserva.ofreceNombre ?? "")}</strong> a cambio de ${materias}.</p>`;
  }

  #htmlMetodos() {
    const telefono = String(this.#reserva.telefono ?? "");
    const yappy = /^6\d{7}$/.test(telefono) ? `${telefono.slice(0, 4)}-${telefono.slice(4)}` : "";
    return `
      <div class="caja-paso" data-paso>
        <p class="caja__rotulo">1 · Elige cómo pagar</p>
        <div class="pestanas pestanas--caja" role="tablist" aria-label="Método de pago">
          <button class="pestana is-activa" type="button" role="tab" id="cajaPestanaYappy" aria-selected="true" aria-controls="cajaYappyPanel" data-metodo="yappy">Yappy</button>
          <button class="pestana" type="button" role="tab" id="cajaPestanaTarjeta" aria-selected="false" aria-controls="cajaTarjetaPanel" tabindex="-1" data-metodo="tarjeta">Tarjeta de prueba</button>
          <span class="pestanas__marcador" aria-hidden="true"></span>
        </div>
        <form class="caja__form" novalidate autocomplete="off">
          <div id="cajaYappyPanel" role="tabpanel" aria-labelledby="cajaPestanaYappy" data-panel-metodo="yappy">
            <div data-campo="yappy">
              <label class="form-label" for="cajaYappy">Celular de tu Yappy</label>
              <input class="form-control" type="tel" id="cajaYappy" name="yappy" inputmode="tel" placeholder="6XXX-XXXX" value="${escaparHTML(yappy)}" autocomplete="off">
              <div class="form-text">Te llegará una solicitud de pago simulada. No se cobra nada.</div>
              <div class="invalid-feedback"></div>
            </div>
          </div>
          <div id="cajaTarjetaPanel" role="tabpanel" aria-labelledby="cajaPestanaTarjeta" data-panel-metodo="tarjeta" hidden>
            ${TarjetaPrueba.html()}
            <button class="btn btn-linea btn-sm mb-3" type="button" data-usar-prueba>Rellenar con la tarjeta de prueba</button>
            <div class="row g-2">
              <div class="col-12" data-campo="numero">
                <label class="form-label" for="cajaNumero">Número de tarjeta</label>
                <input class="form-control" type="text" id="cajaNumero" name="numero" inputmode="numeric" placeholder="4242 4242 4242 4242" maxlength="19" autocomplete="off">
                <div class="invalid-feedback"></div>
              </div>
              <div class="col-12" data-campo="nombreTarjeta">
                <label class="form-label" for="cajaNombre">Nombre en la tarjeta</label>
                <input class="form-control" type="text" id="cajaNombre" name="nombreTarjeta" placeholder="Como aparece en la tarjeta" autocomplete="off">
                <div class="invalid-feedback"></div>
              </div>
              <div class="col-6" data-campo="vence">
                <label class="form-label" for="cajaVence">Vence</label>
                <input class="form-control" type="text" id="cajaVence" name="vence" inputmode="numeric" placeholder="MM/AA" maxlength="5" autocomplete="off">
                <div class="invalid-feedback"></div>
              </div>
              <div class="col-6" data-campo="cvc">
                <label class="form-label" for="cajaCvc">CVC</label>
                <input class="form-control" type="text" id="cajaCvc" name="cvc" inputmode="numeric" placeholder="123" maxlength="3" autocomplete="off">
                <div class="invalid-feedback"></div>
              </div>
            </div>
          </div>
          ${this.#htmlIntercambioAviso()}
          <button class="btn btn-tinta btn-lg w-100 justify-content-center mt-4" type="submit">
            Pagar ${Dinero.formato(this.#reserva.total)}
            <svg class="flecha" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </button>
          <p class="caja__nota">Caja de demostración: no se cobra dinero real y ningún dato de tarjeta sale de tu navegador.</p>
          <div class="caja__error" role="alert" hidden></div>
        </form>
      </div>`;
  }

  #htmlSoloIntercambio() {
    const recibe = this.#lineasIntercambio().map((l) => `<li><strong>${escaparHTML(l.materiaNombre)}</strong> con ${escaparHTML(l.tutorNombre)} · ${l.horas} h</li>`).join("");
    return `
      <div class="caja-paso" data-paso>
        <p class="caja__rotulo">Intercambio de materias</p>
        <p class="caja__texto">No hay dinero de por medio: cada hora que recibes la devuelves enseñando <strong>${escaparHTML(this.#reserva.ofreceNombre ?? "")}</strong>.</p>
        <ul class="caja__lista">${recibe}</ul>
        <button class="btn btn-tinta btn-lg w-100 justify-content-center mt-3" type="button" data-confirmar-intercambio>
          Confirmar intercambio
          <svg class="flecha" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </button>
        <div class="caja__error" role="alert" hidden></div>
      </div>`;
  }

  #prepararPanel() {
    this.#campos.clear();
    this.#metodo = "yappy";
    $("[data-confirmar-intercambio]", this.#panel)?.addEventListener("click", () => this.#pagar("intercambio"));

    const form = $(".caja__form", this.#panel);
    if (!form) return;

    const esCelular = (v) => /^6\d{7}$/.test(String(v).replace(/[\s\-().]/g, "").replace(/^\+?507/, ""));
    const venceValido = (v) => {
      const m = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(v);
      if (!m) return false;
      const ahora = new Date();
      const anio = 2000 + Number(m[2]);
      return anio > ahora.getFullYear() || (anio === ahora.getFullYear() && Number(m[1]) >= ahora.getMonth() + 1);
    };
    const definicion = {
      yappy: [Validador.requerido("Escribe el celular de tu Yappy."), Validador.personalizada(esCelular, "Debe ser un celular de Panamá: 6XXX-XXXX.")],
      numero: [Validador.requerido("Escribe el número de la tarjeta."),
        Validador.personalizada((v) => v.replace(/\s/g, "") === TarjetaPrueba.NUMERO.replace(/\s/g, ""), "Esta caja solo acepta la tarjeta de prueba 4242 4242 4242 4242.")],
      nombreTarjeta: [Validador.requerido("Escribe el nombre que aparece en la tarjeta."), Validador.soloLetras()],
      vence: [Validador.requerido("Escribe el vencimiento."), Validador.personalizada(venceValido, "Usa el formato MM/AA y una fecha que no haya pasado.")],
      cvc: [Validador.requerido("Escribe el CVC."), Validador.patron(/^\d{3}$/, "Son 3 dígitos.")]
    };
    for (const [nombre, reglas] of Object.entries(definicion)) {
      const campo = new CampoFormulario(nombre, form, reglas);
      campo.escuchar();
      this.#campos.set(nombre, campo);
    }

    // Pestañas de método (flechas izquierda/derecha como en cualquier tablist).
    const pestanas = $$("[data-metodo]", this.#panel);
    const elegir = (pestana, enfocar = false) => {
      this.#metodo = pestana.dataset.metodo;
      for (const p of pestanas) {
        const activa = p === pestana;
        p.classList.toggle("is-activa", activa);
        p.setAttribute("aria-selected", String(activa));
        p.tabIndex = activa ? 0 : -1;
      }
      $(".pestanas", this.#panel).dataset.activa = String(pestanas.indexOf(pestana));
      for (const panel of $$("[data-panel-metodo]", this.#panel)) panel.hidden = panel.dataset.panelMetodo !== this.#metodo;
      if (enfocar) pestana.focus();
    };
    for (const p of pestanas) {
      p.addEventListener("click", () => elegir(p));
      p.addEventListener("keydown", (e) => {
        if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
        e.preventDefault();
        const i = (pestanas.indexOf(p) + (e.key === "ArrowRight" ? 1 : -1) + pestanas.length) % pestanas.length;
        elegir(pestanas[i], true);
      });
    }

    // Tarjeta dibujada: se rellena al escribir y se voltea al pedir el CVC.
    this.#tarjeta = new TarjetaPrueba($("[data-tarjeta]", this.#panel));
    const numero = $("#cajaNumero", form), nombre = $("#cajaNombre", form), vence = $("#cajaVence", form), cvc = $("#cajaCvc", form);
    const pintar = () => this.#tarjeta.pintar({ numero: numero.value, nombre: nombre.value, vence: vence.value, cvc: cvc.value });
    numero.addEventListener("input", () => {
      numero.value = numero.value.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
      pintar();
    });
    vence.addEventListener("input", (e) => {
      let v = vence.value.replace(/\D/g, "").slice(0, 4);
      if (v.length >= 3 || (v.length === 2 && e.inputType !== "deleteContentBackward")) v = `${v.slice(0, 2)}/${v.slice(2)}`;
      vence.value = v;
      pintar();
    });
    cvc.addEventListener("input", () => { cvc.value = cvc.value.replace(/\D/g, "").slice(0, 3); pintar(); });
    nombre.addEventListener("input", pintar);
    cvc.addEventListener("focus", () => this.#tarjeta.voltear(true));
    cvc.addEventListener("blur", () => this.#tarjeta.voltear(false));
    $("[data-usar-prueba]", form).addEventListener("click", () => {
      const anio = String((new Date().getFullYear() + 3) % 100).padStart(2, "0");
      numero.value = TarjetaPrueba.NUMERO;
      nombre.value = Cuenta.sesion?.usuario?.nombre ?? "Estudiante Demo";
      vence.value = `12/${anio}`;
      cvc.value = "123";
      pintar();
      ["numero", "nombreTarjeta", "vence", "cvc"].forEach((n) => this.#campos.get(n).validar());
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const nombres = this.#metodo === "yappy" ? ["yappy"] : ["numero", "nombreTarjeta", "vence", "cvc"];
      let primero = null;
      for (const n of nombres) {
        const campo = this.#campos.get(n);
        if (!campo.validar() && !primero) primero = campo;
      }
      if (primero) { primero.primerControl.focus(); return; }
      this.#pagar(this.#metodo);
    });
  }

  /* ---------------- fase 2: procesando ---------------- */

  async #pagar(metodo) {
    if (this.#ocupada) return;
    this.#ocupada = true;
    this.#cerrar.disabled = true;
    const r = this.#reserva;
    const datos = { folio: r.folio, metodo };
    if (metodo === "yappy") datos.telefono = this.#campos.get("yappy").valor;
    if (metodo === "tarjeta") datos.ultimos4 = this.#campos.get("numero").valor.replace(/\D/g, "").slice(-4);

    this.#anunciar(metodo === "intercambio" ? "Confirmando el intercambio…" : "Procesando el pago…");
    await this.#cambiarPanel(this.#htmlProceso(metodo));
    this.#fase("procesando");
    const animacion = this.#animarProceso(metodo);

    try {
      const [{ reserva }] = await Promise.all([ClienteApi.pagar(datos), this.#coreo.esperar(metodo === "intercambio" ? 1100 : 1900)]);
      await animacion;
      this.#reserva = reserva;
      await this.#celebrar(reserva);
    } catch (error) {
      this.#ocupada = false;
      this.#cerrar.disabled = false;
      this.#fase("metodo");
      this.#panel.innerHTML = r.total === 0 ? this.#htmlSoloIntercambio() : this.#htmlMetodos();
      this.#prepararPanel();
      const aviso = $(".caja__error", this.#panel);
      if (aviso) { aviso.textContent = error.message; aviso.hidden = false; }
      this.#anunciar(error.message);
    }
  }

  #htmlProceso(metodo) {
    const total = Dinero.formato(this.#reserva.total);
    if (metodo === "yappy") {
      const ahora = new Date();
      const hora = `${ahora.getHours() % 12 || 12}:${String(ahora.getMinutes()).padStart(2, "0")}`;
      return `
        <div class="caja-proceso" data-paso>
          <div class="telefono" data-anim="telefono" aria-hidden="true">
            <span class="telefono__isla"></span>
            <span class="telefono__hora">${escaparHTML(hora)}</span>
            <div class="notificacion" data-anim="notificacion">
              <span class="notificacion__app">Yappy · ahora</span>
              <strong>Solicitud de pago</strong>
              <span>A la Par te pide ${total}</span>
              <span class="notificacion__botones"><span>Rechazar</span><span class="notificacion__aprobar" data-anim="aprobar">Aprobar</span></span>
            </div>
          </div>
          <p class="caja__estado" data-anim="estado">Esperando que apruebes el pago en Yappy<span class="puntos"></span></p>
        </div>`;
    }
    if (metodo === "tarjeta") {
      return `
        <div class="caja-proceso" data-paso>
          <div data-anim="tarjeta">${TarjetaPrueba.html()}</div>
          <div class="barra-proceso" aria-hidden="true"><i></i></div>
          <p class="caja__estado" data-anim="estado">Autorizando con el banco<span class="puntos"></span> <small>(simulado)</small></p>
        </div>`;
    }
    return `
      <div class="caja-proceso" data-paso>
        <div class="barra-proceso" aria-hidden="true"><i></i></div>
        <p class="caja__estado" data-anim="estado">Avisando a tu tutora del intercambio<span class="puntos"></span></p>
      </div>`;
  }

  async #animarProceso(metodo) {
    if (metodo === "yappy") {
      const telefono = $('[data-anim="telefono"]', this.#panel);
      const notificacion = $('[data-anim="notificacion"]', this.#panel);
      const aprobar = $('[data-anim="aprobar"]', this.#panel);
      await this.#coreo.animar(telefono, [{ opacity: 0, transform: "translateY(24px) rotate(-2deg)" }, { opacity: 1, transform: "none" }], { duration: 380, easing: CURVAS.expo });
      await this.#coreo.esperar(250);
      await this.#coreo.animar(notificacion, [{ opacity: 0, transform: "translateY(-110%)" }, { opacity: 1, transform: "none" }], { duration: 320, easing: CURVAS.expo });
      await this.#coreo.esperar(650);
      // El «dedo» aprueba: una onda sale del botón y el botón se pone verde.
      aprobar?.classList.add("is-tocado");
      await this.#coreo.animar(aprobar, [{ transform: "scale(1)" }, { transform: "scale(0.94)" }, { transform: "scale(1)" }], { duration: 220 });
    } else if (metodo === "tarjeta") {
      const cont = $('[data-anim="tarjeta"]', this.#panel);
      const tarjeta = new TarjetaPrueba($("[data-tarjeta]", cont));
      tarjeta.pintar({ numero: TarjetaPrueba.NUMERO, nombre: this.#campos.get("nombreTarjeta")?.valor ?? "", vence: this.#campos.get("vence")?.valor ?? "" });
      await this.#coreo.animar(cont, [{ opacity: 0, transform: "translateY(16px) scale(0.97)" }, { opacity: 1, transform: "none" }], { duration: 320, easing: CURVAS.expo });
      tarjeta.leyendo(true);
    }
  }

  /* ---------------- fase 3: pagado ---------------- */

  async #celebrar(reserva) {
    const soloIntercambio = reserva.total === 0;
    this.#fase("pagado");
    this.#anunciar(soloIntercambio
      ? `Intercambio acordado. Referencia ${reserva.referencia}.`
      : `Pago aprobado. Referencia ${reserva.referencia}.`);

    const recibo = $(".recibo", this.#recibo);
    const trazo = $('[data-caja="trazo"]', this.#recibo);
    const sello = $('[data-caja="sello"]', this.#recibo);

    // 1. El total se subraya con marcador.
    await this.#coreo.animar(trazo, [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)" }], { duration: 340, easing: CURVAS.salida }, "is-visible");
    // 2. Cae el sello: llega de arriba, golpea, el papel acusa el golpe.
    const golpe = this.#coreo.animar(sello, [
      { opacity: 0, transform: "translate(-50%, -50%) rotate(-20deg) scale(1.55)" },
      { opacity: 1, transform: "translate(-50%, -50%) rotate(-11deg) scale(0.93)", offset: 0.62 },
      { opacity: 0.94, transform: "translate(-50%, -50%) rotate(-12deg) scale(1)" }
    ], { duration: 460, easing: CURVAS.expo }, "is-puesto");
    await this.#coreo.esperar(280);
    this.#coreo.animar(recibo, [{ transform: "none" }, { transform: "translateY(3px) scale(0.995)" }, { transform: "none" }], { duration: 200 });
    this.#confeti(sello);
    await golpe;

    // 3. El panel de la derecha cuenta lo que pasó.
    await this.#cambiarPanel(this.#htmlExito(reserva));
    const intercambio = $("[data-intercambio]", this.#panel);
    if (intercambio) await this.#animarIntercambio(intercambio);

    this.#ocupada = false;
    this.#terminada = true;
    this.#cerrar.disabled = false;
    $("h3", this.#panel)?.focus({ preventScroll: true });
  }

  #htmlExito(r) {
    const soloIntercambio = r.total === 0;
    const metodo = { yappy: "Yappy", tarjeta: "Tarjeta de prueba •••• 4242", intercambio: "Intercambio de materias" }[r.metodoPago] ?? r.metodoPago;
    const telefono = /^\d{7,8}$/.test(r.telefono ?? "") ? r.telefono.replace(/^(\d{3,4})(\d{4})$/, "$1-$2") : r.telefono;
    const recibe = r.lineas.filter((l) => l.intercambio);
    const fichas = recibe.length && r.ofreceNombre ? `
      <div class="intercambio" data-intercambio aria-label="Intercambio: das ${escaparHTML(r.ofreceNombre)} y recibes ${escaparHTML(recibe.map((l) => l.materiaNombre).join(" y "))}">
        <div class="ficha ficha--das" data-ficha="das"><small>Das</small><strong>${escaparHTML(r.ofreceNombre)}</strong><span>tu materia</span></div>
        <span class="intercambio__signo" aria-hidden="true">
          <svg class="intercambio__flechas" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h11l-3-3M17 17H6l3 3"/></svg>
          <svg class="intercambio__check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>
        </span>
        <div class="ficha ficha--recibes" data-ficha="recibes"><small>Recibes</small><strong>${escaparHTML(recibe[0].materiaNombre)}</strong><span>con ${escaparHTML(recibe[0].tutorNombre.split(" ")[0])}${recibe.length > 1 ? ` y ${recibe.length - 1} más` : ""}</span></div>
      </div>` : "";
    return `
      <div class="caja-exito" data-paso>
        <span class="caja-exito__icono" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></span>
        <h3 tabindex="-1">${soloIntercambio ? "¡Intercambio acordado!" : "¡Pago aprobado!"}</h3>
        <p class="caja__texto">Tu reserva <strong>${escaparHTML(r.folio)}</strong> está confirmada. Tus tutores te escribirán al ${escaparHTML(telefono ?? "")} en menos de 24 horas para fijar el día.</p>
        ${fichas}
        <dl class="caja-exito__datos">
          <div><dt>Referencia</dt><dd>${escaparHTML(r.referencia ?? "")}</dd></div>
          <div><dt>Método</dt><dd>${escaparHTML(metodo)}</dd></div>
          <div><dt>${soloIntercambio ? "Horas" : "Total"}</dt><dd>${soloIntercambio ? `${r.horas} h` : Dinero.formato(r.total)}</dd></div>
        </dl>
        <div class="d-flex flex-wrap gap-2">
          <a class="btn btn-tinta" href="mi-cuenta.html">Ver mis reservas</a>
          <a class="btn btn-linea" href="tutores.html">Seguir buscando tutores</a>
        </div>
      </div>`;
  }

  /** Las dos fichas se cruzan en arco y cambian de lugar; ⇄ se convierte en ✓. */
  async #animarIntercambio(caja) {
    const das = $('[data-ficha="das"]', caja);
    const recibes = $('[data-ficha="recibes"]', caja);
    const signo = $(".intercambio__signo", caja);
    await this.#coreo.esperar(250);
    const distancia = recibes.getBoundingClientRect().left - das.getBoundingClientRect().left;
    const vuelo = { duration: 820, easing: CURVAS.vaiven };
    das.classList.add("is-volando");
    await Promise.all([
      this.#coreo.animar(das, [
        { transform: "none" },
        { transform: `translate(${distancia / 2}px, -30px) rotate(-6deg)`, offset: 0.5 },
        { transform: `translateX(${distancia}px)` }
      ], vuelo),
      this.#coreo.animar(recibes, [
        { transform: "none" },
        { transform: `translate(${-distancia / 2}px, 30px) rotate(6deg)`, offset: 0.5 },
        { transform: `translateX(${-distancia}px)` }
      ], vuelo),
      this.#coreo.animar(signo, [{ transform: "rotate(0)" }, { transform: "rotate(180deg)" }], { duration: 820, easing: CURVAS.vaiven })
    ]);
    // Se intercambian de verdad en el DOM y se sueltan las animaciones.
    das.classList.remove("is-volando");
    caja.insertBefore(recibes, signo);
    caja.append(das);
    das.getAnimations().forEach((a) => a.cancel());
    recibes.getAnimations().forEach((a) => a.cancel());
    signo.getAnimations().forEach((a) => a.cancel());
    caja.classList.add("is-acordado");
    await this.#coreo.animar($(".intercambio__check", caja), [{ opacity: 0, transform: "scale(0.7)" }, { opacity: 1, transform: "scale(1)" }], { duration: 260, easing: CURVAS.expo });
  }

  /** Trazos de marcador que saltan del sello (en una capa fuera del recibo, que recorta). */
  #confeti(sello) {
    if (!sello || Coreografia.reducida) return;
    const columna = this.#recibo.getBoundingClientRect();
    const centro = sello.getBoundingClientRect();
    const contenedor = document.createElement("div");
    contenedor.className = "caja__confeti";
    contenedor.setAttribute("aria-hidden", "true");
    contenedor.style.left = `${centro.left + centro.width / 2 - columna.left}px`;
    contenedor.style.top = `${centro.top + centro.height / 2 - columna.top}px`;
    this.#recibo.append(contenedor);
    window.setTimeout(() => contenedor.remove(), 1400);
    const colores = ["var(--marcador-2)", "var(--marcador)", "var(--azul)", "var(--coral)", "var(--verde)"];
    for (let i = 0; i < 18; i++) {
      const trazo = document.createElement("i");
      trazo.style.background = colores[i % colores.length];
      contenedor.append(trazo);
      const angulo = (Math.PI * 2 * i) / 18 + (Math.random() - 0.5) * 0.5;
      const distancia = 70 + Math.random() * 90;
      const x = Math.cos(angulo) * distancia;
      const y = Math.sin(angulo) * distancia * 0.8;
      const giro = Math.round((Math.random() - 0.5) * 540);
      trazo.animate([
        { opacity: 1, transform: "translate(-50%, -50%) rotate(0deg) scale(0.9)" },
        { opacity: 1, transform: `translate(calc(-50% + ${x * 0.8}px), calc(-50% + ${y * 0.8}px)) rotate(${giro * 0.7}deg) scale(1)`, offset: 0.7 },
        { opacity: 0, transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y + 24}px)) rotate(${giro}deg) scale(0.9)` }
      ], { duration: 760 + Math.random() * 260, easing: CURVAS.salida, fill: "forwards" }).finished.finally(() => trazo.remove());
    }
  }

  /* ---------------- utilidades ---------------- */

  /** El recibo «sale de la impresora» al abrir la caja. */
  #imprimirRecibo() {
    const recibo = $(".recibo", this.#recibo);
    if (!recibo || this.#terminada) return;
    this.#coreo.animar(recibo, [{ clipPath: "inset(0 0 100% 0)", transform: "translateY(-14px)" }, { clipPath: "inset(0 0 0% 0)", transform: "none" }], { duration: 620, easing: CURVAS.salida });
    $$(".recibo__linea", recibo).forEach((linea, i) => {
      this.#coreo.animar(linea, [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 260, delay: 180 + i * 60 });
    });
  }

  /** Cambia el contenido del panel derecho con un fundido corto. */
  async #cambiarPanel(html) {
    const actual = $("[data-paso]", this.#panel);
    if (actual) await this.#coreo.animar(actual, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-6px)" }], { duration: 140, easing: "cubic-bezier(0.4, 0, 1, 1)" });
    this.#panel.innerHTML = html;
    const nuevo = $("[data-paso]", this.#panel);
    const hijos = nuevo ? [...nuevo.children] : [];
    await Promise.all(hijos.map((hijo, i) => this.#coreo.animar(hijo, [{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 260, delay: i * 40, easing: CURVAS.expo })));
  }

  #fase(nombre) { if (this.#cuerpo) this.#cuerpo.dataset.cajaFase = nombre; }
  #anunciar(texto) { if (this.#anuncio) this.#anuncio.textContent = texto; }

  #alCerrar() {
    this.#coreo.saltar();
    const reserva = this.#reserva;
    const pagada = this.#terminada && reserva?.estado === "pagada";
    if (reserva && !pagada) {
      Aviso.mostrar(`Tu reserva ${reserva.folio} quedó pendiente de pago: puedes pagarla desde «Mis reservas».`, 5200);
    }
    this.#alTerminar?.(pagada ? reserva : null, reserva);
    this.#reserva = null;
  }
}

/* ------------------------------------------------------------------ */
const CajaSimulada = {
  caja: null,
  abrir(reserva, opciones) {
    this.caja ??= new Caja();
    this.caja.abrir(reserva, opciones);
  }
};
