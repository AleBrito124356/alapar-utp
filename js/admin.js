/* =====================================================================
   admin.js — Panel de administración (POO)

   Fechas          → «hace 3 h», «ayer», fechas cortas en español
   GraficoDias     → columnas de ingresos de los últimos 14 días, con
                     tooltip por columna (ratón y teclado) y tabla de datos
   RankingTutores  → barras horizontales de horas vendidas por tutor
   TablaPersonas   → personas registradas, con búsqueda
   TablaCompras    → compras, con búsqueda y filtros por estado
   DetalleCompra   → panel lateral con el recibo de una compra
   PanelAdmin      → pide /api/admin/resumen y reparte los datos

   Todo lo que viene del servidor se escapa antes de pintarlo: los nombres
   los escriben las personas al registrarse.
   ===================================================================== */
"use strict";

class Fechas {
  static #relativo = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

  static relativa(iso) {
    if (!iso) return "—";
    const segundos = (new Date(iso).getTime() - Date.now()) / 1000;
    const pasos = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
    for (const [unidad, s] of pasos) {
      if (Math.abs(segundos) >= s) return Fechas.#relativo.format(Math.round(segundos / s), unidad);
    }
    return "ahora mismo";
  }

  static corta(iso) {
    return new Date(iso).toLocaleDateString("es-PA", { day: "numeric", month: "short" });
  }

  static completa(iso) { return fechaLegible(iso); }

  /** "2026-09-29" → fecha local sin desfase de zona horaria. */
  static deDia(dia) {
    const [a, m, d] = dia.split("-").map(Number);
    return new Date(a, m - 1, d);
  }
}

/* ------------------------------------------------------------------ */
class GraficoDias {
  #el; #tabla;

  constructor(el, tabla) {
    this.#el = el;
    this.#tabla = tabla;
    el?.addEventListener("pointerover", (e) => this.#mostrarTooltip(e.target.closest(".grafico__col")));
    el?.addEventListener("focusin", (e) => this.#mostrarTooltip(e.target.closest(".grafico__col")));
    el?.addEventListener("pointerleave", () => this.#ocultarTooltip());
    el?.addEventListener("focusout", () => this.#ocultarTooltip());
  }

  /** Techo «redondo» para el eje: 0 / 25 / 50, 0 / 50 / 100… */
  static techo(maximo) {
    if (maximo <= 0) return 10;
    const pasos = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
    const paso = pasos.find((p) => p * 2 >= maximo) ?? Math.ceil(maximo / 2);
    return paso * 2;
  }

  pintar(serie, animar = true) {
    if (!this.#el) return;
    const maximo = Math.max(...serie.map((d) => d.ingresos));
    const techo = GraficoDias.techo(maximo);
    const hoy = serie.at(-1)?.dia;
    const indiceMaximo = serie.findIndex((d) => d.ingresos === maximo && maximo > 0);
    const columnas = serie.map((d, i) => {
      const fecha = Fechas.deDia(d.dia);
      const dia = d.dia === hoy ? "Hoy" : fecha.toLocaleDateString("es-PA", { day: "numeric" });
      const semana = fecha.toLocaleDateString("es-PA", { weekday: "short" }).replace(".", "");
      const etiqueta = `${fecha.toLocaleDateString("es-PA", { weekday: "long", day: "numeric", month: "long" })}: ${Dinero.formato(d.ingresos)} en ${d.reservas} ${d.reservas === 1 ? "reserva" : "reservas"}`;
      return `
        <li class="grafico__dia${d.dia === hoy ? " is-hoy" : ""}" style="--i:${i}">
          <button class="grafico__col" type="button" style="--v:${(d.ingresos / techo).toFixed(4)}"
                  data-dia="${escaparHTML(d.dia)}" data-ingresos="${d.ingresos}" data-reservas="${d.reservas}"
                  aria-label="${escaparHTML(etiqueta)}">
            <i class="grafico__barra${d.ingresos === 0 ? " is-cero" : ""}"></i>
            ${i === indiceMaximo ? `<span class="grafico__valor">${Dinero.formato(d.ingresos)}</span>` : ""}
          </button>
          <span class="grafico__eje-x" aria-hidden="true"><span>${escaparHTML(semana)}</span>${escaparHTML(dia)}</span>
        </li>`;
    }).join("");
    const marcas = [0, 0.5, 1].map((f) => `<span class="grafico__marca" style="--y:${f}"><span>${Dinero.formato(techo * f).replace(".00", "")}</span></span>`).join("");
    this.#el.innerHTML = `
      <div class="grafico__rejilla" aria-hidden="true">${marcas}</div>
      <ol class="grafico__columnas${animar && !prefiereMenosMovimiento() ? " is-entrando" : ""}">${columnas}</ol>
      <div class="grafico__tooltip" aria-hidden="true" hidden></div>`;
    if (this.#tabla) {
      this.#tabla.innerHTML = `
        <thead><tr><th scope="col">Día</th><th scope="col">Reservas</th><th scope="col">Ingresos (simulados)</th></tr></thead>
        <tbody>${serie.map((d) => `<tr><th scope="row">${escaparHTML(Fechas.deDia(d.dia).toLocaleDateString("es-PA", { weekday: "short", day: "numeric", month: "short" }))}</th><td>${d.reservas}</td><td>${Dinero.formato(d.ingresos)}</td></tr>`).join("")}</tbody>`;
    }
  }

  #mostrarTooltip(columna) {
    const tooltip = $(".grafico__tooltip", this.#el);
    if (!columna || !tooltip) return;
    const fecha = Fechas.deDia(columna.dataset.dia);
    const reservas = Number(columna.dataset.reservas);
    tooltip.replaceChildren();
    const valor = document.createElement("strong");
    valor.textContent = Dinero.formato(Number(columna.dataset.ingresos));
    const detalle = document.createElement("span");
    detalle.textContent = `${reservas} ${reservas === 1 ? "reserva" : "reservas"} · ${fecha.toLocaleDateString("es-PA", { weekday: "short", day: "numeric", month: "short" })}`;
    tooltip.append(valor, detalle);
    tooltip.hidden = false;
    const caja = this.#el.getBoundingClientRect();
    const col = columna.getBoundingClientRect();
    const x = Math.min(Math.max(col.left + col.width / 2 - caja.left, 60), caja.width - 60);
    tooltip.style.setProperty("--x", `${x}px`);
    for (const c of $$(".grafico__col", this.#el)) c.classList.toggle("is-activa", c === columna);
  }

  #ocultarTooltip() {
    const tooltip = $(".grafico__tooltip", this.#el);
    if (tooltip) tooltip.hidden = true;
    for (const c of $$(".grafico__col", this.#el)) c.classList.remove("is-activa");
  }
}

/* ------------------------------------------------------------------ */
class RankingTutores {
  static html(tutores) {
    const maximo = Math.max(1, ...tutores.map((t) => t.horas));
    return tutores.slice(0, 6).map((t) => `
      <li class="ranking__fila">
        <span class="ranking__nombre">${escaparHTML(t.nombre)}</span>
        <span class="ranking__pista" aria-hidden="true"><i style="--v:${(t.horas / maximo).toFixed(4)}"></i></span>
        <span class="ranking__valor">${t.horas} h<small>${t.precio === 0 ? "intercambio" : Dinero.formato(t.importe)}</small></span>
      </li>`).join("");
  }
}

/* ------------------------------------------------------------------ */
class TablaPersonas {
  #cuerpo; #conteo; #buscador; #personas = [];

  constructor({ cuerpo, conteo, buscador }) {
    this.#cuerpo = cuerpo;
    this.#conteo = conteo;
    this.#buscador = buscador;
    let espera;
    buscador?.addEventListener("input", () => { window.clearTimeout(espera); espera = window.setTimeout(() => this.#pintar(), 120); });
  }

  cargar(personas) { this.#personas = personas; this.#pintar(); }

  static esNueva(p) { return !p.demo && Date.now() - new Date(p.creado).getTime() < 24 * 3600 * 1000; }

  #pintar() {
    const texto = normalizarTexto(this.#buscador?.value ?? "");
    const lista = this.#personas.filter((p) => !texto || [p.nombre, p.correo, p.carrera].some((c) => normalizarTexto(c ?? "").includes(texto)));
    if (this.#conteo) this.#conteo.textContent = `${lista.length} ${lista.length === 1 ? "persona" : "personas"}`;
    if (!lista.length) {
      this.#cuerpo.innerHTML = `<tr><td colspan="6" class="tabla-admin__vacia">Nadie coincide con «${escaparHTML(this.#buscador.value)}».</td></tr>`;
      return;
    }
    this.#cuerpo.innerHTML = lista.map((p) => {
      const iniciales = p.nombre.split(" ").filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase();
      return `
        <tr>
          <td>
            <span class="persona-fila">
              <span class="persona-fila__avatar${p.rol === "admin" ? " is-admin" : ""}" aria-hidden="true">${escaparHTML(iniciales)}</span>
              <span><strong>${escaparHTML(p.nombre)}</strong>${p.rol === "admin" ? ' <span class="insignia insignia--admin">Admin</span>' : ""}${TablaPersonas.esNueva(p) ? ' <span class="insignia insignia--nueva">Nueva</span>' : ""}
                <span class="d-block txt-suave small">${escaparHTML(p.correo)}</span></span>
            </span>
          </td>
          <td>${escaparHTML(p.carrera ?? "—")}</td>
          <td><span title="${escaparHTML(Fechas.completa(p.creado))}">${escaparHTML(Fechas.relativa(p.creado))}</span></td>
          <td><span title="${p.ultimoAcceso ? escaparHTML(Fechas.completa(p.ultimoAcceso)) : ""}">${escaparHTML(p.ultimoAcceso ? Fechas.relativa(p.ultimoAcceso) : "nunca")}</span></td>
          <td class="num">${p.reservas}</td>
          <td class="num">${Dinero.formato(p.gastado)}</td>
        </tr>`;
    }).join("");
  }
}

/* ------------------------------------------------------------------ */
class TablaCompras {
  #cuerpo; #conteo; #buscador; #filtros; #filtro = "todas"; #compras = []; #alElegir;

  constructor({ cuerpo, conteo, buscador, filtros, alElegir }) {
    this.#cuerpo = cuerpo;
    this.#conteo = conteo;
    this.#buscador = buscador;
    this.#filtros = filtros;
    this.#alElegir = alElegir;
    let espera;
    buscador?.addEventListener("input", () => { window.clearTimeout(espera); espera = window.setTimeout(() => this.#pintar(), 120); });
    filtros?.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-filtro]");
      if (!chip) return;
      this.#filtro = chip.dataset.filtro;
      for (const c of $$("[data-filtro]", filtros)) {
        c.classList.toggle("is-active", c === chip);
        c.setAttribute("aria-pressed", String(c === chip));
      }
      this.#pintar();
    });
    cuerpo?.addEventListener("click", (e) => {
      const fila = e.target.closest("tr[data-folio]");
      if (fila) this.#alElegir?.(fila.dataset.folio);
    });
  }

  cargar(compras) { this.#compras = compras.map((c) => new Reserva(c)); this.#pintar(); }

  buscar(folio) { return this.#compras.find((c) => c.folio === folio) ?? null; }

  #pasaFiltro(r, filtro = this.#filtro) {
    switch (filtro) {
      case "pagadas": return r.pagada;
      case "pendientes": return !r.pagada;
      case "intercambio": return r.tieneIntercambio;
      default: return true;
    }
  }

  #pintar() {
    const texto = this.#buscador?.value ?? "";
    const lista = this.#compras.filter((r) => this.#pasaFiltro(r) && r.coincide(texto));
    if (this.#conteo) this.#conteo.textContent = `${lista.length} ${lista.length === 1 ? "compra" : "compras"}`;
    for (const chip of $$("[data-filtro]", this.#filtros)) {
      const n = this.#compras.filter((r) => this.#pasaFiltro(r, chip.dataset.filtro)).length;
      const num = $(".num", chip);
      if (num) num.textContent = n;
    }
    if (!lista.length) {
      this.#cuerpo.innerHTML = `<tr><td colspan="8" class="tabla-admin__vacia">No hay compras con esos filtros.</td></tr>`;
      return;
    }
    this.#cuerpo.innerHTML = lista.map((r) => {
      const d = r.datos;
      const primera = d.lineas[0];
      const resumen = primera ? `${primera.materiaNombre} · ${primera.tutorNombre.split(" ")[0]}${d.lineas.length > 1 ? ` +${d.lineas.length - 1}` : ""}` : "—";
      return `
        <tr data-folio="${escaparHTML(d.folio)}">
          <td><button class="enlace-folio" type="button" aria-label="Ver el detalle de ${escaparHTML(d.folio)}">${escaparHTML(d.folio)}</button></td>
          <td><span title="${escaparHTML(Fechas.completa(d.creada))}">${escaparHTML(Fechas.relativa(d.creada))}</span></td>
          <td><strong>${escaparHTML(d.usuarioNombre)}</strong><span class="d-block txt-suave small">${escaparHTML(d.usuarioCorreo)}</span></td>
          <td>${escaparHTML(resumen)}${r.tieneIntercambio ? ' <span class="insignia insignia--intercambio" title="Incluye intercambio">⇄</span>' : ""}</td>
          <td class="num">${d.horas} h</td>
          <td class="num">${Dinero.formato(d.total)}</td>
          <td>${escaparHTML(r.pagada ? r.metodoTexto : "—")}</td>
          <td><span class="insignia ${r.pagada ? "insignia--ok" : "insignia--pendiente"}">${escaparHTML(r.estadoTexto)}</span></td>
        </tr>`;
    }).join("");
  }
}

/* ------------------------------------------------------------------ */
class DetalleCompra {
  #el; #cuerpo; #titulo;

  constructor(el) {
    this.#el = el;
    this.#cuerpo = $("[data-detalle-cuerpo]", el ?? document);
    this.#titulo = $("[data-detalle-titulo]", el ?? document);
  }

  abrir(reserva) {
    if (!this.#el || !reserva || !window.bootstrap) return;
    const d = reserva.datos;
    const telefono = /^\d{7,8}$/.test(d.telefono ?? "") ? d.telefono.replace(/^(\d{3,4})(\d{4})$/, "$1-$2") : d.telefono;
    this.#titulo.textContent = d.folio;
    this.#cuerpo.innerHTML = `
      <span class="insignia ${reserva.pagada ? "insignia--ok" : "insignia--pendiente"} mb-3">${escaparHTML(reserva.estadoTexto)}</span>
      ${Recibo.html(d, { sello: reserva.soloIntercambio ? "Acordado" : "Pagado" })}
      <dl class="ficha ficha--detalle mt-4">
        <dt>Estudiante</dt><dd>${escaparHTML(d.usuarioNombre)}<span class="d-block txt-suave">${escaparHTML(d.usuarioCorreo)}</span></dd>
        <dt>WhatsApp</dt><dd>${escaparHTML(telefono ?? "—")}</dd>
        <dt>Disponibilidad</dt><dd>${escaparHTML(d.disponibilidad ?? "—")}</dd>
        <dt>Creada</dt><dd>${escaparHTML(Fechas.completa(d.creada))}</dd>
        <dt>Pago</dt><dd>${reserva.pagada ? `${escaparHTML(reserva.metodoTexto)} · ${escaparHTML(Fechas.completa(d.pagada))}` : "Pendiente"}</dd>
        ${d.referencia ? `<dt>Referencia</dt><dd class="txt-mono-normal">${escaparHTML(d.referencia)}</dd>` : ""}
        ${d.ofreceNombre ? `<dt>Da a cambio</dt><dd>${escaparHTML(d.ofreceNombre)}</dd>` : ""}
      </dl>`;
    bootstrap.Offcanvas.getOrCreateInstance(this.#el).show();
  }
}

/* ------------------------------------------------------------------ */
class PanelAdmin {
  #raiz; #grafico; #personas; #compras; #detalle; #cargando = false; #generado = null; #reloj = null;

  constructor(raiz) {
    this.#raiz = raiz;
    if (!raiz) return;
    this.#grafico = new GraficoDias($("#graficoDias", raiz), $("#tablaDias", raiz));
    this.#personas = new TablaPersonas({ cuerpo: $("#tablaPersonas tbody", raiz), conteo: $("#conteoPersonas", raiz), buscador: $("#buscarPersonas", raiz) });
    this.#detalle = new DetalleCompra($("#detalleCompra"));
    this.#compras = new TablaCompras({
      cuerpo: $("#tablaCompras tbody", raiz),
      conteo: $("#conteoCompras", raiz),
      buscador: $("#buscarCompras", raiz),
      filtros: $("#filtrosCompras", raiz),
      alElegir: (folio) => this.#detalle.abrir(this.#compras.buscar(folio))
    });
    $("#actualizarPanel", raiz)?.addEventListener("click", () => this.cargar());
    // Al volver a la pestaña, el panel se pone al día solo.
    document.addEventListener("visibilitychange", () => { if (!document.hidden && this.#generado) this.cargar(); });
  }

  async cargar() {
    if (this.#cargando || !this.#raiz) return;
    this.#cargando = true;
    const primera = !this.#generado;
    this.#raiz.classList.add("is-cargando");
    const boton = $("#actualizarPanel", this.#raiz);
    if (boton) boton.disabled = true;
    try {
      const datos = await ClienteApi.resumenAdmin();
      this.#pintar(datos, primera);
      this.#generado = datos.generado;
      this.#pintarHora();
      window.clearInterval(this.#reloj);
      this.#reloj = window.setInterval(() => this.#pintarHora(), 30000);
    } catch (error) {
      if (error.estado === 401 || error.estado === 403) { window.location.replace("entrar.html?siguiente=admin.html"); return; }
      Aviso.mostrar(error.message, 5000);
    } finally {
      this.#cargando = false;
      this.#raiz.classList.remove("is-cargando");
      if (boton) boton.disabled = false;
    }
  }

  #pintarHora() {
    const el = $("#panelActualizado", this.#raiz);
    if (el && this.#generado) el.textContent = `Actualizado ${Fechas.relativa(this.#generado)}`;
  }

  #pintar({ kpis, serie, usuarios, reservas, tutores }, primera) {
    const promedio = kpis.pagadas ? kpis.ingresos / kpis.pagadas : 0;
    const tiles = [
      { rotulo: "Estudiantes registrados", valor: kpis.estudiantes, detalle: `+${kpis.estudiantesSemana} en los últimos 7 días` },
      { rotulo: "Reservas", valor: kpis.reservas, detalle: `${kpis.pagadas} pagadas · ${kpis.pendientes} pendientes` },
      { rotulo: "Ingresos (simulados)", valor: kpis.ingresos, decimales: 2, prefijo: "$", detalle: `Ticket promedio ${Dinero.formato(promedio)}` },
      { rotulo: "Horas de tutoría vendidas", valor: kpis.horas, detalle: `${kpis.intercambios} ${kpis.intercambios === 1 ? "reserva incluye" : "reservas incluyen"} intercambio` }
    ];
    const contenedor = $("#kpis", this.#raiz);
    contenedor.innerHTML = tiles.map((t) => `
      <div class="col-6 col-xl-3">
        <div class="kpi">
          <span class="kpi__rotulo">${escaparHTML(t.rotulo)}</span>
          <span class="kpi__valor"><span data-contar="${t.valor}" data-decimales="${t.decimales ?? 0}" data-prefijo="${escaparHTML(t.prefijo ?? "")}">${primera ? `${escaparHTML(t.prefijo ?? "")}0` : escaparHTML((t.prefijo ?? "") + t.valor.toLocaleString("es-PA", { minimumFractionDigits: t.decimales ?? 0, maximumFractionDigits: t.decimales ?? 0 }))}</span></span>
          <span class="kpi__detalle">${escaparHTML(t.detalle)}</span>
        </div>
      </div>`).join("");
    if (primera) ContadorAnimado.observarTodos(contenedor);

    this.#grafico.pintar(serie, primera);
    const total14 = serie.reduce((s, d) => s + d.ingresos, 0);
    const resumen = $("#resumenDias", this.#raiz);
    if (resumen) resumen.textContent = `${Dinero.formato(total14)} en ${serie.reduce((s, d) => s + d.reservas, 0)} reservas`;
    $("#rankingTutores", this.#raiz).innerHTML = RankingTutores.html(tutores);
    this.#personas.cargar(usuarios);
    this.#compras.cargar(reservas);
  }
}
