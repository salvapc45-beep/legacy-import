// Legacy Import · panel admin
import { getDB, stockKey } from "./db.js";
import { DEMO, DEMO_ADMIN } from "./config.js";
import {
  $, $$, esc, imgSrc, usd, bsRaw, icon, shield, fill, waLink, toast, copyText, dateTime, ago,
  PAY_METHODS, DELIVERY, STATUS
} from "./util.js";

const root = $("#root");
let db, user = null, settings = null, products = [], orders = [], coupons = [];
let view = "", unsub = [];
const known = new Set(); let ordersLoaded = false, unseen = 0;
const of = { status: "activos", q: "" };   // filtros de pedidos
const pf = { q: "", cat: "", sorting: false };

const VIEWS = {
  inicio: { label: "Inicio", icon: "chart" },
  pedidos: { label: "Pedidos", icon: "receipt" },
  productos: { label: "Productos", icon: "grid" },
  ofertas: { label: "Ofertas", icon: "tag" },
  ajustes: { label: "Ajustes", icon: "settings" }
};
const brandHTML = () => `${shield()}<span class="brand-word"><b>Legacy</b><span>Import</span></span>`;
const catName = (id) => settings?.categories?.find((c) => c.id === id)?.name || "Sin categoría";
const totalStock = (p) => Object.values(p.stock || {}).reduce((s, n) => s + (+n || 0), 0);
const waPhone = (ph = "") => { const d = ph.replace(/\D/g, ""); return d.startsWith("58") ? d : "58" + d.replace(/^0/, ""); };
const pendingCount = () => orders.filter((o) => o.status === "por_verificar" || o.status === "pendiente").length;
const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ───────── Arranque y sesión ─────────
(async function boot() {
  db = await getDB();
  db.onAuth((u) => {
    user = u;
    unsub.forEach((f) => f && f()); unsub = [];
    if (!u) return renderLogin();
    if (!u.admin) return renderLogin("Esta cuenta no tiene permisos de administrador.");
    startSession();
  });
})();

function renderLogin(msg = "") {
  root.innerHTML = `<div class="login"><form class="login-card" id="lf" novalidate>
    <a class="brand" href="index.html" aria-label="Ver la tienda">${brandHTML()}</a>
    <h1>Panel de administración</h1>
    ${DEMO ? `<div class="login-hint">Modo demo. Entra con <b>${DEMO_ADMIN.email}</b> y la clave <b>${DEMO_ADMIN.password}</b>.</div>` : ""}
    <label class="field"><span>Correo</span><input class="input" name="email" type="email" autocomplete="username" required value="${DEMO ? DEMO_ADMIN.email : ""}"></label>
    <label class="field"><span>Contraseña</span><input class="input" name="password" type="password" autocomplete="current-password" required></label>
    <div class="login-err" id="lerr">${esc(msg)}</div>
    <button class="btn block">Entrar</button>
  </form></div>`;
  $("#lf").onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target)), b = e.target.querySelector(".btn");
    b.classList.add("is-loading"); $("#lerr").textContent = "";
    try { if (user && !user.admin) await db.logout(); await db.login(f.email, f.password); }
    catch (err) { $("#lerr").textContent = err.message; b.classList.remove("is-loading"); }
  };
}

function startSession() {
  root.innerHTML = `<div class="shell">
    <nav class="side" aria-label="Secciones">
      <a class="brand" href="index.html" target="_blank" title="Ver la tienda">${brandHTML()}</a>
      ${Object.entries(VIEWS).map(([k, v]) => `<a class="nav" href="#${k}" data-v="${k}">${icon(v.icon)}${v.label}<span class="pill" data-pill="${k}" hidden></span></a>`).join("")}
      <div class="side-foot">
        <a class="nav" href="index.html" target="_blank">${icon("external")}Ver la tienda</a>
        <a class="nav" href="#" data-logout>${icon("logout")}Salir</a>
        <small>${esc(user.email || "")}</small>
      </div>
    </nav>
    <div class="main">
      <header class="bar"><h1 id="vtitle"></h1>
        <button class="icon-btn bell" id="bell" title="Activar avisos de pedidos nuevos" aria-label="Avisos de pedidos nuevos">${icon("bell")}<span class="dot"></span></button>
        <a class="icon-btn" href="index.html" target="_blank" title="Ver la tienda" aria-label="Ver la tienda">${icon("external")}</a>
        <button class="icon-btn" data-logout title="Salir" aria-label="Salir">${icon("logout")}</button>
      </header>
      <div id="view"></div>
    </div>
    <nav class="tabs" aria-label="Secciones">${Object.entries(VIEWS).map(([k, v]) => `<a class="tab" href="#${k}" data-v="${k}">${icon(v.icon)}${v.label}<span class="pill" data-pill="${k}" hidden></span></a>`).join("")}</nav>
  </div>
  <div class="sheet-scrim" id="scrim"></div>
  <aside class="sheet" id="sheet" aria-hidden="true"></aside>`;
  if (DEMO) { const f = document.createElement("div"); f.className = "demo-flag"; f.textContent = "Modo demo"; document.body.append(f); }

  $$("[data-logout]").forEach((a) => (a.onclick = async (e) => { e.preventDefault(); await db.logout(); }));
  $("#bell").onclick = async () => {
    unseen = 0; paintBadges();
    if ("Notification" in window && Notification.permission === "default") {
      const p = await Notification.requestPermission();
      toast(p === "granted" ? "Avisos activados en este dispositivo" : "No se activaron los avisos del navegador");
    } else if (Notification?.permission === "granted") toast("Los avisos ya están activos. Deja el panel abierto para recibirlos.");
    navigate("pedidos");
  };
  $("#scrim").onclick = closeSheet;
  addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });

  if (db.seedIfEmpty) db.seedIfEmpty().catch((e) => console.warn(e));
  let gotS = false, gotP = false, gotO = false;
  const first = () => { if (gotS && gotP && gotO && !view) route(); };
  unsub.push(db.watchSettings((s) => { settings = s; gotS = true; first(); refresh("settings"); }));
  unsub.push(db.watchProducts((ps) => { products = ps; gotP = true; first(); refresh("products"); }, { all: true }));
  unsub.push(db.watchOrders((os) => { onOrders(os); gotO = true; first(); refresh("orders"); }));
  db.listCoupons().then((c) => { coupons = c; refresh("coupons"); });
  addEventListener("hashchange", route);
}

function navigate(v) { if (location.hash !== "#" + v) location.hash = v; else route(); }
function route() {
  const v = location.hash.slice(1) || "inicio";
  view = VIEWS[v] ? v : "inicio";
  $$("[data-v]").forEach((a) => a.classList.toggle("on", a.dataset.v === view));
  $("#vtitle").textContent = VIEWS[view].label;
  document.title = `${VIEWS[view].label} · Panel Legacy Import`;
  closeSheet();
  render();
  scrollTo({ top: 0 });
}
function render() {
  const el = $("#view");
  ({ inicio: viewHome, pedidos: viewOrders, productos: viewProducts, ofertas: viewOffers, ajustes: viewSettings })[view](el);
}
// Repinta la vista activa cuando cambian los datos (sin pisar formularios en edición)
function refresh(kind) {
  if (!view) return;
  paintBadges();
  if (view === "ajustes" && kind === "settings" && dirty) return;
  if (view === "ofertas" && kind !== "orders") return render();
  if (view === "inicio" || (view === "pedidos" && kind !== "settings") || (view === "productos" && kind !== "orders" && !pf.sorting)) render();
  if (openOrderNo && kind === "orders") { const o = orders.find((x) => x.number === openOrderNo); if (o) paintOrder(o); }
}

// ───────── Aviso de pedidos nuevos ─────────
function onOrders(os) {
  const fresh = [];
  os.forEach((o) => { if (!known.has(o.number)) { known.add(o.number); if (ordersLoaded) fresh.push(o); } });
  orders = os;
  ordersLoaded = true;
  if (!fresh.length) return;
  unseen += fresh.length;
  freshSet = new Set(fresh.map((o) => o.number));
  const o = fresh[0];
  chime();
  toast(`Nuevo pedido ${o.number} · ${usd(o.pricing.total)} · ${o.customer.name}`);
  $("#bell")?.classList.remove("ring"); void $("#bell")?.offsetWidth; $("#bell")?.classList.add("ring");
  document.title = `(${unseen}) Nuevo pedido · Legacy Import`;
  if ("Notification" in window && Notification.permission === "granted" && document.visibilityState !== "visible") {
    const n = new Notification(`Nuevo pedido ${o.number}`, { body: `${o.customer.name} · ${usd(o.pricing.total)} · ${o.payment.label}`, icon: "img/favicon.svg", tag: o.number });
    n.onclick = () => { focus(); navigate("pedidos"); openOrder(o.number); };
  }
}
let freshSet = new Set();
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && view) setTimeout(() => (document.title = `${VIEWS[view].label} · Panel Legacy Import`), 3000); });
function chime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [[880, 0], [1318.5, .16]].forEach(([f, t]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0, ctx.currentTime + t); g.gain.linearRampToValueAtTime(.18, ctx.currentTime + t + .02);
      g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + t + .6);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + .65);
    });
  } catch {}
}
function paintBadges() {
  const n = pendingCount();
  $$("[data-pill='pedidos']").forEach((p) => { p.hidden = !n; p.textContent = n; });
  $("#bell")?.classList.toggle("on", unseen > 0);
}

// ───────── Inicio (estadísticas) ─────────
const PAID = new Set(["pagado", "preparando", "listo_retiro", "enviado", "entregado"]);
function viewHome(el) {
  const now = new Date(), day0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const month0 = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const paid = orders.filter((o) => PAID.has(o.status));
  const sum = (arr) => arr.reduce((s, o) => s + (o.pricing?.total || 0), 0);
  const today = paid.filter((o) => o.createdAt >= day0), month = paid.filter((o) => o.createdAt >= month0);
  const low = products.filter((p) => p.visible && totalStock(p) <= 2);
  const days = Array.from({ length: 14 }, (_, i) => { const d = day0 - (13 - i) * 86400000; return { d, v: sum(paid.filter((o) => o.createdAt >= d && o.createdAt < d + 86400000)) }; });
  const max = Math.max(10, ...days.map((x) => x.v));
  const top = {}; month.forEach((o) => o.items.forEach((i) => { top[i.name] = (top[i.name] || 0) + i.qty; }));
  const topL = Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const byM = {}; month.forEach((o) => { byM[o.payment.label] = (byM[o.payment.label] || 0) + o.pricing.total; });
  const byML = Object.entries(byM).sort((a, b) => b[1] - a[1]);
  const mTot = byML.reduce((s, x) => s + x[1], 0) || 1;
  const W = 560, H = 200, bw = W / 14;

  el.innerHTML = `<div class="content">
    <div class="kpis">
      <div class="kpi" style="--i:0"><span>Ventas de hoy</span><b class="num">${usd(sum(today))}</b><small>${today.length} ${today.length === 1 ? "pedido pagado" : "pedidos pagados"}</small></div>
      <div class="kpi" style="--i:1"><span>Ventas del mes</span><b class="num">${usd(sum(month))}</b><small>${month.length} pedidos · ticket ${usd(month.length ? sum(month) / month.length : 0)}</small></div>
      <a class="kpi ${pendingCount() ? "alert" : ""}" style="--i:2" href="#pedidos" data-go-status="verificar"><span>Pagos por verificar</span><b class="num">${pendingCount()}</b><small>${pendingCount() ? "Revísalos ahora" : "Todo al día"}</small></a>
      <a class="kpi ${low.length ? "alert" : ""}" style="--i:3" href="#productos"><span>Poco stock</span><b class="num">${low.length}</b><small>${low.length ? esc(low.slice(0, 2).map((p) => p.name).join(", ")) : "Inventario sano"}</small></a>
    </div>
    <div class="two">
      <section class="card-a"><h2>Ventas de los últimos 14 días</h2><p class="sub">Pedidos con pago confirmado, en USD.</p>
        <svg class="chart" viewBox="0 0 ${W} ${H + 22}" preserveAspectRatio="none" role="img" aria-label="Ventas por día">
          ${days.map((x, i) => { const h = Math.max(2, (x.v / max) * H); return `<g><title>${new Date(x.d).toLocaleDateString("es-VE", { day: "2-digit", month: "short" })}: ${usd(x.v)}</title><rect class="b bar-grow ${i === 13 ? "today" : ""}" style="--i:${i}" x="${i * bw + 4}" y="${H - h}" width="${bw - 8}" height="${h}" rx="4"/>${i % 2 === 1 || i === 13 ? `<text x="${i * bw + bw / 2}" y="${H + 16}" text-anchor="middle">${new Date(x.d).getDate()}</text>` : ""}</g>`; }).join("")}
        </svg></section>
      <section class="card-a"><h2>Métodos de pago del mes</h2><p class="sub">Monto cobrado por método.</p>
        ${byML.length ? `<div class="hbar">${byML.map(([k, v]) => `<div class="hbar-row"><div><span>${esc(k)}</span><b class="num">${usd(v)}</b></div><i style="--w:${(v / mTot) * 100}%"></i></div>`).join("")}</div>` : `<p class="muted">Aún no hay pagos confirmados este mes.</p>`}
      </section>
    </div>
    <div class="two">
      <section class="card-a"><h2>Pedidos recientes</h2><p class="sub">Los últimos que entraron.</p>
        <div class="olist">${orders.slice(0, 5).map(orderRow).join("") || `<p class="muted">Todavía no hay pedidos.</p>`}</div></section>
      <section class="card-a"><h2>Más vendidos del mes</h2><p class="sub">Unidades vendidas.</p>
        ${topL.length ? `<div class="hbar">${topL.map(([k, v]) => `<div class="hbar-row"><div><span>${esc(k)}</span><b class="num">${v}</b></div><i style="--w:${(v / topL[0][1]) * 100}%"></i></div>`).join("")}</div>` : `<p class="muted">Sin ventas confirmadas este mes.</p>`}</section>
    </div>
  </div>`;
  el.querySelector("[data-go-status]")?.addEventListener("click", () => { of.status = "verificar"; });
  bindOrderRows(el);
}

// ───────── Pedidos ─────────
const FILTERS = {
  activos: { label: "Activos", test: (o) => !["entregado", "cancelado"].includes(o.status) },
  verificar: { label: "Por verificar", test: (o) => o.status === "por_verificar" || o.status === "pendiente" },
  pagados: { label: "Pagados", test: (o) => o.status === "pagado" || o.status === "preparando" },
  despacho: { label: "Enviados / listos", test: (o) => o.status === "enviado" || o.status === "listo_retiro" },
  entregados: { label: "Entregados", test: (o) => o.status === "entregado" },
  cancelados: { label: "Cancelados", test: (o) => o.status === "cancelado" },
  todos: { label: "Todos", test: () => true }
};
function orderRow(o, i = 0) {
  const st = STATUS[o.status] || {};
  return `<button class="orow ${freshSet.has(o.number) ? "fresh" : ""}" data-order="${esc(o.number)}" style="--i:${Math.min(i, 12)}">
    <span class="no num">${esc(o.number)}<small>${ago(o.createdAt)}</small></span>
    <span class="amt num">${usd(o.pricing.total)}</span>
    <span class="who">${esc(o.customer.name)}</span>
    <span class="meta">
      <span>${icon(PAY_METHODS[o.payment.method]?.icon || "card")}${esc(o.payment.label)}</span>
      <span>${icon(DELIVERY[o.delivery.type]?.icon || "box")}${esc(o.delivery.label)}</span>
      <span><span class="status ${st.tone}">${st.label || o.status}</span></span>
    </span></button>`;
}
function bindOrderRows(el) { el.onclick = (e) => { const r = e.target.closest("[data-order]"); if (r) openOrder(r.dataset.order); }; }

function viewOrders(el) {
  const q = of.q.trim().toLowerCase();
  const list = orders.filter(FILTERS[of.status].test).filter((o) => !q || `${o.number} ${o.customer.name} ${o.customer.phone} ${o.payment.reference || ""}`.toLowerCase().includes(q));
  el.innerHTML = `<div class="content">
    <div class="toolbar"><label class="search">${icon("search")}<span class="sr">Buscar pedidos</span><input class="input" id="oq" placeholder="Buscar por número, cliente, teléfono o referencia" value="${esc(of.q)}"></label></div>
    <div class="chips">${Object.entries(FILTERS).map(([k, f]) => `<button class="chip ${of.status === k ? "on" : ""}" data-f="${k}">${f.label}<b>${orders.filter(f.test).length}</b></button>`).join("")}</div>
    <div class="olist" id="olist">${list.map(orderRow).join("") || `<div class="empty-a">${icon("receipt")}<b>No hay pedidos aquí</b><span>Cuando entren pedidos nuevos te avisamos con sonido y notificación.</span></div>`}</div>
  </div>`;
  freshSet = new Set();
  $("#oq", el).oninput = (e) => { of.q = e.target.value; const pos = e.target.selectionStart; viewOrders(el); const i = $("#oq", el); i.focus(); i.setSelectionRange(pos, pos); };
  el.querySelector(".chips").onclick = (e) => { const c = e.target.closest("[data-f]"); if (c) { of.status = c.dataset.f; viewOrders(el); } };
  bindOrderRows($("#olist", el));
}

let openOrderNo = null;
function openSheet() { $("#sheet").classList.add("on"); $("#scrim").classList.add("on"); $("#sheet").setAttribute("aria-hidden", "false"); document.body.style.overflow = "hidden"; }
function closeSheet() { const s = $("#sheet"); if (!s) return; s.classList.remove("on"); $("#scrim").classList.remove("on"); s.setAttribute("aria-hidden", "true"); document.body.style.overflow = ""; openOrderNo = null; editing = null; }

function openOrder(number) {
  const o = orders.find((x) => x.number === number); if (!o) return;
  openOrderNo = number; paintOrder(o); openSheet();
}
function tplData(o) {
  return { cliente: o.customer.name.split(" ")[0], numero: o.number, total: usd(o.pricing.total), agencia: o.shipping?.agency || o.delivery.agency || "", guia: o.shipping?.guide || "" };
}
async function paintOrder(o) {
  const sh = $("#sheet"), st = STATUS[o.status] || {}, d = o.delivery, pm = o.payment;
  const needsAction = o.status === "por_verificar" || o.status === "pendiente";
  const tpls = settings.templates || {};
  const waBtn = (k, label) => tpls[k] ? `<a class="wa-chip" target="_blank" rel="noopener" href="${waLink(waPhone(o.customer.phone), fill(tpls[k], tplData(o)))}">${icon("whatsapp")}${label}</a>` : "";
  const scroll = $(".sheet-body", sh)?.scrollTop || 0;
  sh.innerHTML = `
    <div class="sheet-head"><h2 class="num">${esc(o.number)}</h2><span class="status ${st.tone}">${st.label}</span><button class="icon-btn" data-close aria-label="Cerrar">${icon("x")}</button></div>
    <div class="sheet-body">
      <p class="muted" style="margin:0">Recibido ${dateTime(o.createdAt)} · ${ago(o.createdAt)}</p>
      <div class="block-a"><h3>Pago</h3>
        <div class="kv-a"><span>Método</span><b>${esc(pm.label)}</b></div>
        <div class="kv-a"><span>Monto</span><b class="num">${pm.currency === "bs" ? `${bsRaw(o.pricing.totalBs)} <span class="muted">(${usd(o.pricing.total)} · tasa ${bsRaw(o.pricing.rate)})</span>` : usd(o.pricing.total)}</b></div>
        ${pm.reference ? `<div class="kv-a"><span>Referencia</span><b class="num">${esc(pm.reference)} <button class="copy" data-copy="${esc(pm.reference)}" style="vertical-align:middle">${icon("copy", "xs")}Copiar</button></b></div>` : ""}
        ${pm.payer ? `<div class="kv-a"><span>Pagador</span><b>${esc(pm.payer)}</b></div>` : ""}
        <div id="proofSlot">${pm.proofUrl || pm.proofId ? `<div class="skel" style="height:180px"></div>` : `<p class="muted" style="margin:0">${PAY_METHODS[pm.method]?.needsRef ? "El cliente no subió captura." : "Este método no requiere comprobante."}</p>`}</div>
      </div>
      <div class="block-a"><h3>Cliente</h3>
        <div class="kv-a"><span>Nombre</span><b>${esc(o.customer.name)}</b></div>
        <div class="kv-a"><span>Teléfono</span><b><a href="${waLink(waPhone(o.customer.phone), `Hola ${o.customer.name.split(" ")[0]}, te escribimos de Legacy Import por tu pedido ${o.number}.`)}" target="_blank" rel="noopener">${esc(o.customer.phone)}</a></b></div>
        <div class="kv-a"><span>Cédula</span><b>${esc(o.customer.idDoc)}</b></div>
        ${o.customer.email ? `<div class="kv-a"><span>Correo</span><b>${esc(o.customer.email)}</b></div>` : ""}
      </div>
      <div class="block-a"><h3>Entrega · ${esc(d.label)}</h3>
        ${d.type === "delivery" ? `<div class="kv-a"><span>Zona</span><b>${esc(d.zone)} · ${usd(d.cost)}</b></div><div class="kv-a"><span>Dirección</span><b>${esc(d.address)}</b></div>` : ""}
        ${d.type === "nacional" ? `<div class="kv-a"><span>Agencia</span><b>${esc(d.agency)}</b></div><div class="kv-a"><span>Destino</span><b>${esc(d.office)} · ${esc(d.city)}, ${esc(d.state)}</b></div><div class="kv-a"><span>Retira</span><b>${esc(d.receiver)} · ${esc(d.receiverId)}</b></div>
          <div class="grid-f c2" style="margin-top:4px"><label class="field"><span>Agencia del envío</span><input class="input" id="shAg" value="${esc(o.shipping?.agency || d.agency || "")}"></label><label class="field"><span>Número de guía</span><input class="input" id="shGu" value="${esc(o.shipping?.guide || "")}"></label></div>` : ""}
        ${d.type === "retiro" ? `<p class="muted" style="margin:0">Retira en ${esc(settings.address)}.</p>` : ""}
        ${o.notes ? `<div class="kv-a"><span>Notas</span><b>${esc(o.notes)}</b></div>` : ""}
      </div>
      <div class="block-a"><h3>Productos</h3>
        ${o.items.map((i) => `<div class="prow" style="box-shadow:none;padding:0;background:none"><img ${imgSrc(i.image)} alt=""><div><div class="nm">${esc(i.name)}</div><div class="sb">${esc([i.color, i.size && `Talla ${i.size}`].filter(Boolean).join(" · "))} · ×${i.qty}</div></div><b class="num">${usd(i.price * i.qty)}</b></div>`).join("")}
        <div class="sum num" style="border-top:1px solid var(--line);padding-top:10px;display:grid;gap:4px;font-size:14px">
          <div style="display:flex;justify-content:space-between"><span class="muted">Subtotal</span><span>${usd(o.pricing.subtotal)}</span></div>
          ${o.pricing.offerDiscount ? `<div style="display:flex;justify-content:space-between"><span class="muted">Ofertas</span><span>−${usd(o.pricing.offerDiscount)}</span></div>` : ""}
          ${o.pricing.couponDiscount ? `<div style="display:flex;justify-content:space-between"><span class="muted">Cupón ${esc(o.coupon)}</span><span>−${usd(o.pricing.couponDiscount)}</span></div>` : ""}
          ${o.pricing.shipping ? `<div style="display:flex;justify-content:space-between"><span class="muted">Envío</span><span>${usd(o.pricing.shipping)}</span></div>` : ""}
          <div style="display:flex;justify-content:space-between;font-weight:720;font-size:16px"><span>Total</span><span>${usd(o.pricing.total)}</span></div>
        </div>
      </div>
      <div class="block-a"><h3>Mensajes por WhatsApp</h3>
        <div class="wa-row">${waBtn("aprobado", "Pago confirmado")}${waBtn("rechazado", "Pago no verificado")}${d.type === "retiro" ? waBtn("retiro", "Listo para retirar") : waBtn("enviado", "Enviado")}${waBtn("entregado", "Gracias")}</div>
      </div>
      <div class="block-a"><h3>Estado</h3>
        <label class="field"><span>Cambiar estado</span><select class="select" id="stSel">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${k === o.status ? "selected" : ""}>${v.label}</option>`).join("")}</select></label>
        <div class="muted">${(o.history || []).map((h) => `${STATUS[h.status]?.label || h.status} · ${dateTime(h.at)}`).join("<br>")}</div>
        ${o.stockApplied ? `<p class="muted" style="margin:0">${icon("check", "xs")} El stock ya se descontó.</p>` : `<p class="muted" style="margin:0">El stock se descuenta al aprobar el pago.</p>`}
      </div>
    </div>
    <div class="sheet-foot">
      ${needsAction ? `<button class="btn badb" data-act="cancel">Cancelar pedido</button><button class="btn okb" data-act="approve">${icon("check", "sm")}Aprobar pago</button>` : `<button class="btn" data-act="save">Guardar cambios</button>`}
    </div>`;
  $(".sheet-body", sh).scrollTop = scroll;
  if (pm.proofUrl || pm.proofId) db.proofURL(o).then((url) => { const s = $("#proofSlot"); if (!s || openOrderNo !== o.number) return; s.innerHTML = url ? `<img class="proof" ${imgSrc(url)} alt="Comprobante de pago" data-zoom>` : `<p class="muted">No se pudo cargar el comprobante.</p>`; });

  sh.onclick = async (e) => {
    if (e.target.closest("[data-close]")) return closeSheet();
    const cp = e.target.closest("[data-copy]"); if (cp) return copyText(cp.dataset.copy);
    const z = e.target.closest("[data-zoom]"); if (z) { const lb = document.createElement("div"); lb.className = "lightbox"; lb.innerHTML = `<img src="${z.src}" alt="Comprobante">`; lb.onclick = () => lb.remove(); document.body.append(lb); return; }
    const a = e.target.closest("[data-act]"); if (!a) return;
    a.classList.add("is-loading");
    try {
      if (a.dataset.act === "approve") {
        await db.approvePayment(o.number);
        toast("Pago aprobado y stock descontado");
        const msg = tpls.aprobado && waLink(waPhone(o.customer.phone), fill(tpls.aprobado, tplData(o)));
        if (msg && confirm("¿Abrir WhatsApp para avisarle al cliente que su pago fue confirmado?")) window.open(msg, "_blank");
      } else if (a.dataset.act === "cancel") {
        if (!confirm(`¿Cancelar el pedido ${o.number}? El cliente verá el pedido como cancelado.`)) return a.classList.remove("is-loading");
        await db.updateOrder(o.number, {}, "cancelado"); toast("Pedido cancelado");
      } else {
        const ns = $("#stSel").value;
        const patch = {};
        if ($("#shGu")) patch.shipping = { agency: $("#shAg").value.trim(), guide: $("#shGu").value.trim() };
        if (ns === "pagado" && !o.stockApplied && PAID.has(ns)) await db.approvePayment(o.number);
        await db.updateOrder(o.number, patch, ns);
        toast("Pedido actualizado");
      }
    } catch (err) { console.error(err); toast("No se pudo guardar. Revisa tu conexión.", "error"); }
    a.classList.remove("is-loading");
  };
  sh.onchange = (e) => {
    if (e.target.id !== "stSel" || !$("[data-act='approve']")) return;
    const f = $(".sheet-foot"); f.innerHTML = `<button class="btn" data-act="save">Guardar cambios</button>`;
  };
}

// ───────── Productos ─────────
function viewProducts(el) {
  if (pf.sorting) return viewSort(el);
  const q = pf.q.trim().toLowerCase();
  const list = products.filter((p) => (!pf.cat || p.category === pf.cat) && (!q || p.name.toLowerCase().includes(q)));
  el.innerHTML = `<div class="content">
    <div class="toolbar">
      <label class="search">${icon("search")}<span class="sr">Buscar productos</span><input class="input" id="pq" placeholder="Buscar producto" value="${esc(pf.q)}"></label>
      <button class="btn soft sm" id="sortBtn">${icon("drag", "sm")}Ordenar catálogo</button>
      <button class="btn sm" id="newP">${icon("plus", "sm")}Nuevo producto</button>
    </div>
    <div class="chips"><button class="chip ${!pf.cat ? "on" : ""}" data-c="">Todos<b>${products.length}</b></button>${(settings.categories || []).map((c) => `<button class="chip ${pf.cat === c.id ? "on" : ""}" data-c="${esc(c.id)}">${esc(c.name)}<b>${products.filter((p) => p.category === c.id).length}</b></button>`).join("")}</div>
    <div class="plist" id="plist">${list.map((p, i) => {
      const st = totalStock(p);
      return `<div class="prow ${p.visible ? "" : "hidden-p"}" style="--i:${Math.min(i, 14)}">
        <img ${imgSrc(p.images?.[0] || "")} alt="">
        <div><div class="nm">${esc(p.name)}</div><div class="sb"><span>${esc(catName(p.category))}</span><span class="num">${usd(p.price)}</span><span class="num ${st <= 2 ? "low" : ""}">${st <= 0 ? "Agotado" : `${st} en stock`}</span>${p.visible ? "" : "<span>Oculto</span>"}</div></div>
        <div class="act">
          <label class="switch" title="${p.visible ? "Visible en la tienda" : "Oculto"}"><input type="checkbox" data-vis="${esc(p.id)}" ${p.visible ? "checked" : ""} aria-label="Visible en la tienda"><span class="tr"></span></label>
          <button class="icon-btn" data-edit="${esc(p.id)}" aria-label="Editar ${esc(p.name)}">${icon("edit")}</button>
        </div></div>`;
    }).join("") || `<div class="empty-a">${icon("grid")}<b>No hay productos</b><span>Crea el primero con “Nuevo producto”.</span></div>`}</div>
  </div>`;
  $("#pq", el).oninput = (e) => { pf.q = e.target.value; const pos = e.target.selectionStart; viewProducts(el); const i = $("#pq", el); i.focus(); i.setSelectionRange(pos, pos); };
  $("#newP", el).onclick = () => editProduct(null);
  $("#sortBtn", el).onclick = () => { pf.sorting = true; viewProducts(el); };
  el.querySelector(".chips").onclick = (e) => { const c = e.target.closest("[data-c]"); if (c) { pf.cat = c.dataset.c; viewProducts(el); } };
  $("#plist", el).onclick = (e) => { const b = e.target.closest("[data-edit]"); if (b) editProduct(b.dataset.edit); };
  $("#plist", el).onchange = async (e) => {
    const v = e.target.closest("[data-vis]"); if (!v) return;
    const p = products.find((x) => x.id === v.dataset.vis);
    await db.saveProduct({ ...p, visible: v.checked });
    toast(v.checked ? "Producto visible en la tienda" : "Producto oculto");
  };
}

function viewSort(el) {
  el.innerHTML = `<div class="content">
    <div class="card-a"><h2>Ordenar catálogo</h2><p class="sub">Arrastra los productos al orden en que quieres que aparezcan en la tienda. El primero sale arriba a la izquierda.</p>
      <div class="sortgrid" id="sg">${products.map((p, i) => `<div class="sortitem" data-id="${esc(p.id)}"><b class="num">${i + 1}</b><img ${imgSrc(p.images?.[0] || "")} alt=""><span>${esc(p.name)}</span></div>`).join("")}</div>
    </div>
    <div class="toolbar" style="justify-content:flex-end"><button class="btn soft" id="sCancel">Cancelar</button><button class="btn" id="sSave">Guardar orden</button></div>
  </div>`;
  const renum = () => $$("#sg .sortitem b").forEach((b, i) => (b.textContent = i + 1));
  if (window.Sortable) Sortable.create($("#sg"), { animation: 220, easing: "cubic-bezier(.16,1,.3,1)", delay: 120, delayOnTouchOnly: true, onEnd: renum });
  else toast("No se pudo cargar la herramienta de arrastre. Revisa tu conexión.", "error");
  $("#sCancel").onclick = () => { pf.sorting = false; render(); };
  $("#sSave").onclick = async (e) => {
    e.target.classList.add("is-loading");
    await db.reorderProducts($$("#sg .sortitem").map((x) => x.dataset.id));
    pf.sorting = false; toast("Orden del catálogo guardado"); render();
  };
}

let editing = null;
function editProduct(id) {
  const base = id ? products.find((p) => p.id === id) : null;
  editing = base ? JSON.parse(JSON.stringify(base)) : { name: "", category: settings.categories?.[0]?.id || "", price: "", compareAt: "", description: "", images: [], colors: [], sizes: [], stock: {}, badge: "nuevo", visible: true };
  const e = editing;
  const sh = $("#sheet");
  sh.innerHTML = `
    <div class="sheet-head"><h2>${base ? "Editar producto" : "Nuevo producto"}</h2><button class="icon-btn" data-close aria-label="Cerrar">${icon("x")}</button></div>
    <form class="sheet-body" id="pe" novalidate>
      <div class="block-a"><h3>Fotos</h3><p class="muted" style="margin:0">La primera es la principal. Arrastra para ordenar.</p><div class="imgs" id="imgs"></div></div>
      <div class="block-a"><h3>Información</h3>
        <label class="field"><span>Nombre</span><input class="input" name="name" value="${esc(e.name)}" required></label>
        <div class="grid-f c3">
          <label class="field"><span>Categoría</span><select class="select" name="category">${(settings.categories || []).map((c) => `<option value="${esc(c.id)}" ${c.id === e.category ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>
          <label class="field"><span>Precio (USD)</span><input class="input" name="price" type="number" step="0.01" min="0" inputmode="decimal" value="${esc(e.price)}" required></label>
          <label class="field"><span>Precio antes (opcional)</span><input class="input" name="compareAt" type="number" step="0.01" min="0" inputmode="decimal" value="${esc(e.compareAt || "")}"></label>
        </div>
        <label class="field"><span>Descripción</span><textarea class="textarea" name="description">${esc(e.description || "")}</textarea></label>
        <div class="grid-f c2">
          <label class="field"><span>Etiqueta</span><select class="select" name="badge"><option value="">Ninguna</option><option value="nuevo" ${e.badge === "nuevo" ? "selected" : ""}>Nuevo</option><option value="disponible" ${e.badge === "disponible" ? "selected" : ""}>Disponible ya</option></select></label>
          <div class="field"><span>Visibilidad</span><label class="switch" style="min-height:48px"><input type="checkbox" name="visible" ${e.visible ? "checked" : ""}><span class="tr"></span>Visible en la tienda</label></div>
        </div>
      </div>
      <div class="block-a"><h3>Colores</h3><div class="set-list" id="cols"></div><button type="button" class="btn soft sm" id="addCol" style="justify-self:start">${icon("plus", "sm")}Agregar color</button></div>
      <div class="block-a"><h3>Tallas</h3>
        <div class="taglist" id="sizes"></div>
        <div class="presets"><button type="button" data-pre="S,M,L,XL">Ropa S–XL</button><button type="button" data-pre="XS,S,M,L,XL,XXL">Ropa XS–XXL</button><button type="button" data-pre="35,36,37,38,39,40,41,42,43,44">Zapatos 35–44</button><button type="button" data-pre="">Sin tallas</button></div>
      </div>
      <div class="block-a"><h3>Inventario</h3><p class="muted" style="margin:0">Unidades disponibles por combinación.</p><div class="matrix" id="mx"></div></div>
    </form>
    <div class="sheet-foot">${base ? `<button class="btn badb" data-del>Eliminar</button>` : ""}<button class="btn" data-save>Guardar producto</button></div>`;
  openSheet();
  paintImgs(); paintCols(); paintSizes(); paintMatrix();

  function paintImgs() {
    const box = $("#imgs");
    box.innerHTML = e.images.map((src, i) => `<div class="im" data-i="${i}"><img ${imgSrc(src)} alt=""><button type="button" data-rmimg="${i}" aria-label="Quitar foto">${icon("x", "xs")}</button></div>`).join("") +
      `<label class="add">${icon("image")}<span>Agregar fotos</span><input type="file" accept="image/*" multiple hidden id="imgIn"></label>`;
    $("#imgIn").onchange = async (ev) => {
      const files = [...ev.target.files];
      for (const f of files) {
        const ph = document.createElement("div"); ph.className = "im up"; ph.innerHTML = `<span class="skel" style="position:absolute;inset:0"></span>`;
        box.insertBefore(ph, box.querySelector(".add"));
        try { e.images.push(await db.uploadImage(f)); } catch (err) { toast(err.message || "No se pudo subir la foto", "error"); }
      }
      paintImgs();
    };
    if (window.Sortable) Sortable.create(box, { animation: 200, filter: ".add", draggable: ".im", delay: 120, delayOnTouchOnly: true, onEnd: () => { e.images = $$(".im", box).map((x) => e.images[+x.dataset.i]); paintImgs(); } });
  }
  function paintCols() {
    $("#cols").innerHTML = e.colors.map((c, i) => `<div class="colrow"><input type="color" value="${esc(c.hex || "#000000")}" data-ch="${i}" aria-label="Color"><input class="input" value="${esc(c.name)}" placeholder="Nombre del color" data-cn="${i}"><button type="button" class="icon-btn" data-rmc="${i}" aria-label="Quitar color">${icon("trash", "sm")}</button></div>`).join("") || `<p class="muted" style="margin:0">Sin colores: el producto tiene una sola variante.</p>`;
  }
  function paintSizes() {
    $("#sizes").innerHTML = e.sizes.map((z, i) => `<span class="t">${esc(z)}<button type="button" data-rms="${i}" aria-label="Quitar talla ${esc(z)}">${icon("x", "xs")}</button></span>`).join("") + `<input id="szIn" placeholder="${e.sizes.length ? "Otra talla" : "Escribe una talla y presiona Enter"}" aria-label="Agregar talla">`;
    $("#szIn").onkeydown = (ev) => {
      if (ev.key !== "Enter" && ev.key !== ",") return; ev.preventDefault();
      const v = ev.target.value.trim(); if (v && !e.sizes.includes(v)) { e.sizes.push(v); paintSizes(); paintMatrix(); $("#szIn").focus(); }
    };
  }
  function paintMatrix() {
    const cols = e.colors.length ? e.colors : [{ name: "", hex: "" }];
    const sizes = e.sizes.length ? e.sizes : [""];
    const v = (c, z) => e.stock[stockKey(c, z)] ?? 0;
    $("#mx").innerHTML = `<table><thead><tr><th>${e.colors.length ? "Color" : ""}</th>${sizes.map((z) => `<th>${z ? esc(z) : "Unidades"}</th>`).join("")}</tr></thead>
      <tbody>${cols.map((c) => `<tr><td>${c.name ? `<span class="sw-dot" style="background:${esc(c.hex)}"></span>${esc(c.name)}` : "—"}</td>${sizes.map((z) => `<td><input type="number" min="0" inputmode="numeric" value="${v(c.name, z)}" data-k="${esc(stockKey(c.name, z))}" aria-label="Stock ${esc(c.name)} ${esc(z)}"></td>`).join("")}</tr>`).join("")}</tbody></table>`;
  }

  const form = $("#pe");
  form.oninput = (ev) => {
    const t = ev.target;
    if (t.dataset.k) e.stock[t.dataset.k] = Math.max(0, parseInt(t.value || "0", 10) || 0);
    if (t.dataset.cn !== undefined) { const i = +t.dataset.cn, old = e.colors[i].name; e.colors[i].name = t.value; renameStock(old, t.value); }
    if (t.dataset.ch !== undefined) { e.colors[+t.dataset.ch].hex = t.value; }
  };
  form.onchange = (ev) => { if (ev.target.dataset.cn !== undefined || ev.target.dataset.ch !== undefined) paintMatrix(); };
  function renameStock(o, n) { Object.keys(e.stock).forEach((k) => { const [c, z] = k.split("|"); if (c === (o || "-")) { e.stock[stockKey(n, z === "-" ? "" : z)] = e.stock[k]; if (o !== n) delete e.stock[k]; } }); }
  sh.onclick = async (ev) => {
    if (ev.target.closest("[data-close]")) return closeSheet();
    const ri = ev.target.closest("[data-rmimg]"); if (ri) { e.images.splice(+ri.dataset.rmimg, 1); return paintImgs(); }
    if (ev.target.closest("#addCol")) { e.colors.push({ name: `Color ${e.colors.length + 1}`, hex: "#B88A2E" }); paintCols(); paintMatrix(); $$("[data-cn]").at(-1)?.select(); return; }
    const rc = ev.target.closest("[data-rmc]"); if (rc) { const c = e.colors.splice(+rc.dataset.rmc, 1)[0]; Object.keys(e.stock).forEach((k) => k.startsWith((c.name || "-") + "|") && delete e.stock[k]); paintCols(); return paintMatrix(); }
    const rs = ev.target.closest("[data-rms]"); if (rs) { e.sizes.splice(+rs.dataset.rms, 1); paintSizes(); return paintMatrix(); }
    const pre = ev.target.closest("[data-pre]"); if (pre) { e.sizes = pre.dataset.pre ? pre.dataset.pre.split(",") : []; paintSizes(); return paintMatrix(); }
    if (ev.target.closest("[data-del]")) {
      if (!confirm(`¿Eliminar “${base.name}”? Esta acción no se puede deshacer.`)) return;
      await db.deleteProduct(base.id); toast("Producto eliminado"); return closeSheet();
    }
    const sv = ev.target.closest("[data-save]");
    if (sv) {
      const f = Object.fromEntries(new FormData(form));
      if (!f.name.trim()) return toast("Escribe el nombre del producto", "error");
      if (!(+f.price > 0)) return toast("Escribe un precio válido", "error");
      if (!e.images.length) return toast("Agrega al menos una foto", "error");
      // limpia stock de combinaciones que ya no existen
      const keys = new Set((e.colors.length ? e.colors : [{ name: "" }]).flatMap((c) => (e.sizes.length ? e.sizes : [""]).map((z) => stockKey(c.name, z))));
      const stock = {}; keys.forEach((k) => (stock[k] = +e.stock[k] || 0));
      const out = { ...e, name: f.name.trim(), category: f.category, price: +f.price, compareAt: +f.compareAt || 0, description: f.description.trim(), badge: f.badge, visible: !!f.visible, stock };
      if (base) out.id = base.id;
      sv.classList.add("is-loading");
      try { await db.saveProduct(out); toast(base ? "Producto actualizado" : "Producto creado"); closeSheet(); }
      catch (err) { console.error(err); sv.classList.remove("is-loading"); toast(err.message || "No se pudo guardar", "error"); }
    }
  };
}

// ───────── Ofertas, cupones y banners ─────────
function viewOffers(el) {
  const offers = settings.offers || [], banners = settings.banners || [];
  el.innerHTML = `<div class="content">
    <section class="card-a"><h2>Combos</h2><p class="sub">Precio especial al llevar varias unidades de una categoría, por ejemplo 2 camisas por 25$. Se aplica solo en la bolsa.</p>
      <div class="set-list">${offers.map((o, i) => `<div class="offer-item"><div><b>${esc(o.name)}</b><small>${o.qty} unidades de ${esc(o.categoryId ? catName(o.categoryId) : "cualquier categoría")} por ${usd(o.price)}</small></div>
        <div class="act"><label class="switch"><input type="checkbox" data-of-on="${i}" ${o.active ? "checked" : ""} aria-label="Activo"><span class="tr"></span></label><button class="icon-btn" data-of-rm="${i}" aria-label="Eliminar combo">${icon("trash", "sm")}</button></div></div>`).join("") || `<p class="muted">No hay combos.</p>`}</div>
      <form class="grid-f c3" id="ofF" style="margin-top:14px;align-items:end">
        <label class="field"><span>Nombre</span><input class="input" name="name" placeholder="Camisas 2×25$" required></label>
        <label class="field"><span>Categoría</span><select class="select" name="categoryId"><option value="">Cualquiera</option>${(settings.categories || []).map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("")}</select></label>
        <div class="grid-f c2"><label class="field"><span>Unidades</span><input class="input" name="qty" type="number" min="2" value="2"></label><label class="field"><span>Precio total</span><input class="input" name="price" type="number" min="0" step="0.01" placeholder="25"></label></div>
        <button class="btn sm" style="grid-column:1/-1;justify-self:start">${icon("plus", "sm")}Agregar combo</button>
      </form></section>

    <section class="card-a"><h2>Cupones</h2><p class="sub">Códigos de descuento que el cliente escribe en su bolsa.</p>
      <div class="set-list">${coupons.map((c) => `<div class="offer-item"><div><b class="num">${esc(c.code)}</b><small>${c.type === "percent" ? `${c.value}%` : usd(c.value)} de descuento${c.min ? ` · desde ${usd(c.min)}` : ""} · usado ${c.uses || 0} ${c.uses === 1 ? "vez" : "veces"}</small></div>
        <div class="act"><label class="switch"><input type="checkbox" data-cp-on="${esc(c.code)}" ${c.active ? "checked" : ""} aria-label="Activo"><span class="tr"></span></label><button class="icon-btn" data-cp-rm="${esc(c.code)}" aria-label="Eliminar cupón">${icon("trash", "sm")}</button></div></div>`).join("") || `<p class="muted">No hay cupones.</p>`}</div>
      <form class="grid-f c3" id="cpF" style="margin-top:14px;align-items:end">
        <label class="field"><span>Código</span><input class="input" name="code" placeholder="VERANO15" style="text-transform:uppercase" required></label>
        <div class="grid-f c2"><label class="field"><span>Tipo</span><select class="select" name="type"><option value="percent">%</option><option value="fixed">USD</option></select></label><label class="field"><span>Valor</span><input class="input" name="value" type="number" min="0" step="0.01"></label></div>
        <label class="field"><span>Compra mínima (USD)</span><input class="input" name="min" type="number" min="0" step="0.01" value="0"></label>
        <button class="btn sm" style="grid-column:1/-1;justify-self:start">${icon("plus", "sm")}Crear cupón</button>
      </form></section>

    <section class="card-a"><h2>Banners del catálogo</h2><p class="sub">Aparecen arriba del catálogo. Si hay varios activos, rotan cada día.</p>
      <div class="set-list">${banners.map((b, i) => `<div class="offer-item banner-prev"><img ${imgSrc(b.image)} alt=""><div><b>${esc(b.title)}</b><small>${esc(b.subtitle || "")} · ${esc(b.category ? catName(b.category) : "Todo")}</small></div>
        <div class="act"><label class="switch"><input type="checkbox" data-bn-on="${i}" ${b.active ? "checked" : ""} aria-label="Activo"><span class="tr"></span></label><button class="icon-btn" data-bn-rm="${i}" aria-label="Eliminar banner">${icon("trash", "sm")}</button></div></div>`).join("") || `<p class="muted">No hay banners.</p>`}</div>
      <form class="grid-f c2" id="bnF" style="margin-top:14px;align-items:end">
        <label class="field"><span>Título</span><input class="input" name="title" placeholder="Camisas 2×25$" required></label>
        <label class="field"><span>Texto</span><input class="input" name="subtitle" placeholder="Llévate dos camisas por 25$"></label>
        <label class="field"><span>Lleva a la categoría</span><select class="select" name="category"><option value="">Todo el catálogo</option>${(settings.categories || []).map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("")}</select></label>
        <label class="field"><span>Imagen</span><input class="input" name="image" type="file" accept="image/*" style="padding:10px"></label>
        <button class="btn sm" style="grid-column:1/-1;justify-self:start">${icon("plus", "sm")}Agregar banner</button>
      </form></section>
  </div>`;

  const saveOffers = (arr) => db.saveSettings({ offers: arr });
  const saveBanners = (arr) => db.saveSettings({ banners: arr });
  $("#ofF").onsubmit = async (ev) => {
    ev.preventDefault(); const f = Object.fromEntries(new FormData(ev.target));
    if (!f.name.trim() || !(+f.price > 0) || !(+f.qty >= 2)) return toast("Completa nombre, unidades (2 o más) y precio", "error");
    await saveOffers([...offers, { id: "o" + Date.now(), name: f.name.trim(), type: "bundle", qty: +f.qty, price: +f.price, categoryId: f.categoryId, active: true }]); toast("Combo creado");
  };
  $("#cpF").onsubmit = async (ev) => {
    ev.preventDefault(); const f = Object.fromEntries(new FormData(ev.target));
    if (!f.code.trim() || !(+f.value > 0)) return toast("Completa código y valor", "error");
    if (f.type === "percent" && +f.value > 90) return toast("El porcentaje no puede pasar de 90%", "error");
    await db.saveCoupon({ code: f.code, type: f.type, value: +f.value, min: +f.min || 0, active: true });
    coupons = await db.listCoupons(); toast("Cupón creado"); render();
  };
  $("#bnF").onsubmit = async (ev) => {
    ev.preventDefault(); const fd = new FormData(ev.target), file = fd.get("image");
    if (!fd.get("title").trim()) return toast("Escribe un título", "error");
    if (!file || !file.size) return toast("Elige una imagen para el banner", "error");
    const b = ev.target.querySelector(".btn"); b.classList.add("is-loading");
    try { const image = await db.uploadImage(file); await saveBanners([...banners, { id: "b" + Date.now(), image, title: fd.get("title").trim(), subtitle: fd.get("subtitle").trim(), category: fd.get("category"), active: true }]); toast("Banner agregado"); }
    catch (err) { toast(err.message || "No se pudo subir la imagen", "error"); b.classList.remove("is-loading"); }
  };
  el.onchange = async (ev) => {
    const t = ev.target;
    if (t.dataset.ofOn) { const a = [...offers]; a[+t.dataset.ofOn] = { ...a[+t.dataset.ofOn], active: t.checked }; await saveOffers(a); }
    if (t.dataset.bnOn) { const a = [...banners]; a[+t.dataset.bnOn] = { ...a[+t.dataset.bnOn], active: t.checked }; await saveBanners(a); }
    if (t.dataset.cpOn) { const c = coupons.find((x) => x.code === t.dataset.cpOn); await db.saveCoupon({ ...c, active: t.checked }); coupons = await db.listCoupons(); }
  };
  el.onclick = async (ev) => {
    const o = ev.target.closest("[data-of-rm]"); if (o && confirm("¿Eliminar este combo?")) { await saveOffers(offers.filter((_, i) => i !== +o.dataset.ofRm)); toast("Combo eliminado"); }
    const b = ev.target.closest("[data-bn-rm]"); if (b && confirm("¿Eliminar este banner?")) { await saveBanners(banners.filter((_, i) => i !== +b.dataset.bnRm)); toast("Banner eliminado"); }
    const c = ev.target.closest("[data-cp-rm]"); if (c && confirm(`¿Eliminar el cupón ${c.dataset.cpRm}?`)) { await db.deleteCoupon(c.dataset.cpRm); coupons = await db.listCoupons(); toast("Cupón eliminado"); render(); }
  };
}

// ───────── Ajustes ─────────
let dirty = false, draft = null;
function viewSettings(el) {
  draft = JSON.parse(JSON.stringify(settings)); dirty = false;
  const s = draft, pay = s.payments || {}, sh = s.shipping || {};
  const payFields = {
    pagomovil: [["bank", "Banco"], ["phone", "Teléfono"], ["id", "Cédula / RIF"], ["holder", "Titular"]],
    transferencia: [["bank", "Banco"], ["account", "Número de cuenta"], ["holder", "Titular"], ["id", "Cédula / RIF"]],
    zelle: [["email", "Correo Zelle"], ["holder", "Titular"]],
    binance: [["payId", "Binance Pay ID"], ["email", "Correo"]],
    cashea: [["note", "Mensaje para el cliente"]],
    efectivo: [["note", "Mensaje para el cliente"]]
  };
  const tplNames = { order: "Mensaje del cliente al hacer el pedido", aprobado: "Pago confirmado", rechazado: "Pago no verificado", enviado: "Pedido enviado", retiro: "Listo para retirar", entregado: "Agradecimiento" };
  const PH = ["cliente", "numero", "total", "totalBs", "productos", "metodo", "referencia", "entrega", "agencia", "guia"];
  const inp = (path, label, val, type = "text", extra = "") => `<label class="field"><span>${label}</span><input class="input" data-p="${path}" type="${type}" value="${esc(val ?? "")}" ${extra}></label>`;

  el.innerHTML = `<div class="content">
    <section class="card-a"><h2>Tasa BCV</h2><p class="sub">Los precios en bolívares de toda la tienda se calculan con esta tasa.</p>
      <div class="rate-box">${inp("bcvRate", "Bs. por dólar", s.bcvRate, "number", 'step="0.01" min="0" inputmode="decimal"')}<span class="muted" style="padding-bottom:14px">Actualizada ${s.rateUpdatedAt ? ago(s.rateUpdatedAt) : "—"}</span></div></section>

    <section class="card-a"><h2>Tienda</h2><p class="sub">Datos de contacto que aparecen en la web y en los mensajes.</p>
      <div class="grid-f c2">
        ${inp("storeName", "Nombre", s.storeName)}${inp("tagline", "Frase", s.tagline)}
        ${inp("whatsapp", "WhatsApp que recibe los pedidos (con código de país)", s.whatsapp, "tel", 'placeholder="584121234567"')}${inp("instagram", "Instagram", s.instagram)}
        ${inp("address", "Dirección", s.address)}${inp("hours", "Horario", s.hours)}
      </div></section>

    <section class="card-a"><h2>Categorías</h2><p class="sub">Arrastra para cambiar el orden de las píldoras del catálogo.</p>
      <div class="set-list" id="catList">${(s.categories || []).map((c, i) => `<div class="cat-row" data-ci="${i}"><span class="h">${icon("drag", "sm")}</span><input class="input" data-cat="${i}" value="${esc(c.name)}" aria-label="Nombre de la categoría"><button class="icon-btn" data-rmcat="${i}" aria-label="Eliminar categoría">${icon("trash", "sm")}</button></div>`).join("")}</div>
      <button class="btn soft sm" id="addCat" style="margin-top:12px">${icon("plus", "sm")}Agregar categoría</button></section>

    <section class="card-a"><h2>Métodos de pago</h2><p class="sub">Activa los que aceptas y escribe los datos que verá el cliente al pagar.</p>
      <div class="set-list">${Object.entries(payFields).map(([k, fs]) => `<div class="set-row">
        <div class="set-row-h"><span class="left">${icon(PAY_METHODS[k].icon)}${PAY_METHODS[k].label}</span><label class="switch"><input type="checkbox" data-p="payments.${k}.enabled" ${pay[k]?.enabled ? "checked" : ""} aria-label="Activar ${PAY_METHODS[k].label}"><span class="tr"></span></label></div>
        <div class="grid-f c2">${fs.map(([f, l]) => inp(`payments.${k}.${f}`, l, pay[k]?.[f])).join("")}</div></div>`).join("")}</div></section>

    <section class="card-a"><h2>Entregas</h2><p class="sub">Opciones que el cliente puede elegir.</p>
      <div class="set-list">
        <div class="set-row"><div class="set-row-h"><span class="left">${icon("store")}Retiro en tienda</span><label class="switch"><input type="checkbox" data-p="shipping.retiro.enabled" ${sh.retiro?.enabled ? "checked" : ""}><span class="tr"></span></label></div>${inp("shipping.retiro.note", "Mensaje", sh.retiro?.note)}</div>
        <div class="set-row"><div class="set-row-h"><span class="left">${icon("truck")}Delivery en Maracay</span><label class="switch"><input type="checkbox" data-p="shipping.delivery.enabled" ${sh.delivery?.enabled ? "checked" : ""}><span class="tr"></span></label></div>
          <div class="set-list" id="zones">${(sh.delivery?.zones || []).map((z, i) => `<div class="mini-row"><input class="input" data-z="${i}" data-zf="name" value="${esc(z.name)}" aria-label="Zona"><input class="input" data-z="${i}" data-zf="cost" type="number" step="0.5" min="0" value="${esc(z.cost)}" aria-label="Costo USD"><button class="icon-btn" data-rmz="${i}" aria-label="Quitar zona">${icon("trash", "sm")}</button></div>`).join("")}</div>
          <button class="btn soft sm" id="addZone" style="justify-self:start">${icon("plus", "sm")}Agregar zona</button></div>
        <div class="set-row"><div class="set-row-h"><span class="left">${icon("box")}Envío nacional</span><label class="switch"><input type="checkbox" data-p="shipping.nacional.enabled" ${sh.nacional?.enabled ? "checked" : ""}><span class="tr"></span></label></div>
          <div class="grid-f c2">${inp("shipping.nacional.agenciesText", "Agencias (separadas por coma)", (sh.nacional?.agencies || []).join(", "))}${inp("shipping.nacional.cost", "Costo fijo (0 = cobro a destino)", sh.nacional?.cost ?? 0, "number", 'step="0.5" min="0"')}</div>
          ${inp("shipping.nacional.note", "Mensaje", sh.nacional?.note)}</div>
      </div></section>

    <section class="card-a"><h2>Mensajes predeterminados</h2><p class="sub">Toca una variable para copiarla. Se reemplaza sola al enviar.</p>
      <div class="ph" style="margin-bottom:14px">${PH.map((p) => `<code data-ph="{${p}}">{${p}}</code>`).join("")}</div>
      <div class="grid-f">${Object.entries(tplNames).map(([k, l]) => `<label class="field"><span>${l}</span><textarea class="textarea" data-p="templates.${k}" rows="${k === "order" ? 7 : 3}">${esc(s.templates?.[k] || "")}</textarea></label>`).join("")}</div></section>

    <section class="card-a"><h2>Información de la ficha</h2><p class="sub">Los desplegables que aparecen debajo de cada producto.</p>
      <div class="set-list" id="infoList">${(s.info || []).map((it, i) => `<div class="set-row"><div class="mini-row" style="grid-template-columns:1fr 40px"><input class="input" data-inf="${i}" data-if="title" value="${esc(it.title)}" aria-label="Título"><button class="icon-btn" data-rminf="${i}" aria-label="Quitar">${icon("trash", "sm")}</button></div><textarea class="textarea" data-inf="${i}" data-if="body" aria-label="Texto">${esc(it.body)}</textarea></div>`).join("")}</div>
      <button class="btn soft sm" id="addInfo" style="margin-top:12px">${icon("plus", "sm")}Agregar sección</button></section>

    ${DEMO ? `<section class="card-a"><h2>Modo demo</h2><p class="sub">Borra los pedidos y vuelve a los productos de ejemplo de este navegador.</p><button class="btn badb sm" id="resetDemo">Reiniciar datos de prueba</button></section>` : ""}
    <div class="save-bar" id="saveBar"><span>Tienes cambios sin guardar</span><div style="display:flex;gap:8px"><button class="btn soft sm" id="discard">Descartar</button><button class="btn gold sm" id="saveS">Guardar</button></div></div>
  </div>`;

  const mark = () => { dirty = true; $("#saveBar").classList.add("on"); };
  const setPath = (path, val) => { const ks = path.split("."); let o = draft; ks.slice(0, -1).forEach((k) => (o = o[k] ??= {})); o[ks.at(-1)] = val; };
  el.oninput = (ev) => {
    const t = ev.target;
    if (t.dataset.p) { setPath(t.dataset.p, t.type === "checkbox" ? t.checked : t.type === "number" ? +t.value : t.value); if (t.dataset.p === "bcvRate") draft.rateUpdatedAt = Date.now(); mark(); }
    if (t.dataset.cat !== undefined) { draft.categories[+t.dataset.cat].name = t.value; mark(); }
    if (t.dataset.z !== undefined) { draft.shipping.delivery.zones[+t.dataset.z][t.dataset.zf] = t.dataset.zf === "cost" ? +t.value : t.value; mark(); }
    if (t.dataset.inf !== undefined) { draft.info[+t.dataset.inf][t.dataset.if] = t.value; mark(); }
  };
  el.onchange = el.oninput;
  el.onclick = async (ev) => {
    const ph = ev.target.closest("[data-ph]"); if (ph) return copyText(ph.dataset.ph, `${ph.dataset.ph} copiado`);
    if (ev.target.closest("#addCat")) { const name = prompt("Nombre de la nueva categoría"); if (name?.trim()) { let id = slug(name) || "cat"; while (draft.categories.some((c) => c.id === id)) id += "-2"; draft.categories.push({ id, name: name.trim() }); await commit("Categoría agregada"); } return; }
    const rc = ev.target.closest("[data-rmcat]"); if (rc) { const c = draft.categories[+rc.dataset.rmcat]; const n = products.filter((p) => p.category === c.id).length; if (n) return toast(`“${c.name}” tiene ${n} productos. Muévelos a otra categoría primero.`, "error"); if (confirm(`¿Eliminar la categoría “${c.name}”?`)) { draft.categories.splice(+rc.dataset.rmcat, 1); await commit("Categoría eliminada"); } return; }
    if (ev.target.closest("#addZone")) { draft.shipping.delivery.zones.push({ name: "Nueva zona", cost: 0 }); await commit(); return; }
    const rz = ev.target.closest("[data-rmz]"); if (rz) { draft.shipping.delivery.zones.splice(+rz.dataset.rmz, 1); await commit("Zona eliminada"); return; }
    if (ev.target.closest("#addInfo")) { (draft.info ??= []).push({ title: "Nueva sección", body: "" }); await commit(); return; }
    const ri = ev.target.closest("[data-rminf]"); if (ri) { draft.info.splice(+ri.dataset.rminf, 1); await commit("Sección eliminada"); return; }
    if (ev.target.closest("#discard")) { dirty = false; render(); return; }
    if (ev.target.closest("#saveS")) { await commit("Ajustes guardados"); return; }
    if (ev.target.closest("#resetDemo") && confirm("¿Borrar todos los pedidos y productos de prueba de este navegador?")) db.resetDemo();
  };
  async function commit(msg) {
    const nat = draft.shipping?.nacional;
    if (nat && "agenciesText" in nat) { nat.agencies = nat.agenciesText.split(",").map((x) => x.trim()).filter(Boolean); delete nat.agenciesText; }
    const b = $("#saveS"); b?.classList.add("is-loading");
    try { await db.saveSettings(draft); dirty = false; if (msg) toast(msg); render(); }
    catch (err) { console.error(err); toast("No se pudieron guardar los ajustes", "error"); b?.classList.remove("is-loading"); }
  }
  if (window.Sortable) Sortable.create($("#catList"), { handle: ".h", animation: 200, onEnd: () => { draft.categories = $$("#catList .cat-row").map((r) => draft.categories[+r.dataset.ci]); commit("Orden de categorías guardado"); } });
}
