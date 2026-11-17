// Legacy Import · tienda
import { getDB, stockKey } from "./db.js";
import { DEMO } from "./config.js";
import {
  $, $$, esc, imgSrc, usd, bs, bsRaw, icon, shield, fill, waLink, priceCart, toast, copyText, reduceMotion, dateTime,
  PAY_METHODS, DELIVERY, STATUS
} from "./util.js";

const app = $("#app");
let db, settings = null, products = [], ready = false;
const S = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
let cart = S.get("li_cart", []);           // [{productId, color, size, qty}]
let couponCode = S.get("li_coupon", "");
let coupon = null;
let catalogScroll = 0, lastRoute = "", lastProductId = null;
const co = { step: 1, customer: S.get("li_customer", { name: "", phone: "", idDoc: "", email: "" }), delivery: { type: "" }, payment: { method: "" }, notes: "" };

// ───────── Íconos estáticos del shell ─────────
$$("[data-icon]").forEach((el) => (el.outerHTML = icon(el.dataset.icon)));
$$("[data-clear]").forEach((b) => (b.innerHTML = icon("x", "sm")));
$("#brand").innerHTML = `${shield()}<span class="brand-word"><b>Legacy</b><span>Import</span></span>`;

// ───────── Utilidades de producto ─────────
const rate = () => +settings?.bcvRate || 0;
const byId = (id) => products.find((p) => p.id === id);
const catName = (id) => settings?.categories?.find((c) => c.id === id)?.name || "";
const colorsOf = (p) => (p.colors?.length ? p.colors : [{ name: "", hex: "" }]);
const sizesOf = (p) => (p.sizes?.length ? p.sizes : [""]);
const stockOf = (p, color, size) => +(p.stock?.[stockKey(color, size)] || 0);
const totalStock = (p) => Object.values(p.stock || {}).reduce((s, n) => s + (+n || 0), 0);
const colorStock = (p, c) => sizesOf(p).reduce((s, z) => s + stockOf(p, c, z), 0);
const inCartQty = (pid, c, z) => cart.filter((l) => l.productId === pid && l.color === c && l.size === z).reduce((s, l) => s + l.qty, 0);
const offersFor = (p) => (settings?.offers || []).filter((o) => o.active && (!o.categoryId || o.categoryId === p.category));
const pct = (p) => (p.compareAt > p.price ? Math.round((1 - p.price / p.compareAt) * 100) : 0);

function cartLines() {
  return cart.map((l) => {
    const p = byId(l.productId);
    if (!p) return null;
    const avail = stockOf(p, l.color, l.size);
    return { ...l, p, name: p.name, price: +p.price, category: p.category, image: p.images?.[0] || "", avail };
  }).filter(Boolean);
}
const saveCart = () => { S.set("li_cart", cart); paintBagCount(); };

// ───────── Navegación ─────────
function navigate(hash, opts = {}) {
  if (location.hash === hash) return route(opts);
  history.pushState(null, "", hash);
  route(opts);
}
window.addEventListener("popstate", () => route({ pop: true }));
document.addEventListener("click", (e) => {
  const a = e.target.closest("a[href^='#/']");
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
  e.preventDefault();
  const heroFrom = a.matches(".card") ? a.querySelector(".card-media img") : null;
  navigate(a.getAttribute("href"), { heroFrom });
});

function parse() {
  const h = location.hash.replace(/^#/, "") || "/";
  const [path, qs] = h.split("?");
  const parts = path.split("/").filter(Boolean);
  return { parts, q: new URLSearchParams(qs || ""), key: path };
}

async function route(opts = {}) {
  if (!ready) return;
  const r = parse();
  const [a, b] = r.parts;
  const from = lastRoute;
  if (from === "catalog") catalogScroll = scrollY;
  let render, heroTo = null, scroll = 0;

  if (!a) {
    render = () => renderCatalog(r.q);
    if (lastProductId) heroTo = `.card[data-id="${CSS.escape(lastProductId)}"] .card-media img`;
    scroll = opts.pop || from === "product" ? catalogScroll : 0;
    lastRoute = "catalog";
  } else if (a === "p" && b) {
    render = () => renderProduct(decodeURIComponent(b));
    heroTo = ".gallery-main figure:first-child img";
    lastRoute = "product"; lastProductId = decodeURIComponent(b);
  } else if (a === "checkout") { render = renderCheckout; lastRoute = "checkout"; }
  else if (a === "orden" && b) { render = () => renderDone(decodeURIComponent(b)); lastRoute = "done"; }
  else if (a === "seguimiento") { render = () => renderTrack(b ? decodeURIComponent(b) : ""); lastRoute = "track"; }
  else { render = () => renderCatalog(new URLSearchParams()); lastRoute = "catalog"; }

  const heroFrom = opts.heroFrom || (from === "product" && !a ? $(".gallery-main figure:first-child img") : null);
  const useVT = document.startViewTransition && !reduceMotion() && (heroFrom || heroTo) && (from === "catalog" || from === "product") && lastRoute !== from;

  const commit = () => { render(); window.scrollTo({ top: scroll, behavior: "instant" }); closeCart(true); };
  if (!useVT) { commit(); return; }
  if (heroFrom) heroFrom.style.viewTransitionName = "hero";
  document.documentElement.classList.add("vt");
  const t = document.startViewTransition(() => {
    if (heroFrom) heroFrom.style.viewTransitionName = "";
    commit();
    const to = heroTo && $(heroTo);
    if (to && heroFrom) to.style.viewTransitionName = "hero";
  });
  t.finished.finally(() => { document.documentElement.classList.remove("vt"); $$("img").forEach((i) => i.style.viewTransitionName && (i.style.viewTransitionName = "")); });
}

// ───────── Header ─────────
addEventListener("scroll", () => $("#top").classList.toggle("scrolled", scrollY > 8), { passive: true });
function paintChrome() {
  const where = `${icon("pin")}<span>${esc(settings.address || "Maracay")}</span>`;
  $("#whereD").innerHTML = where;
  const ig = settings.instagram ? `https://instagram.com/${settings.instagram.replace(/^@/, "")}` : "#";
  $("#foot").innerHTML = `
    <div class="wrap">
      <div class="foot-grid">
        <div><a class="brand" href="#/">${shield()}<span class="brand-word"><b>Legacy</b><span>Import</span></span></a>
          <p>Importadores directos de China. ${esc(settings.tagline || "")}.</p></div>
        <div><h3>Compra</h3><ul>
          <li><a href="#/">Catálogo</a></li>
          <li><a href="#/seguimiento">Seguir mi pedido</a></li>
          <li><button class="linklike" data-open-bag>Mi bolsa</button></li></ul></div>
        <div><h3>Contacto</h3><ul>
          <li><a href="${waLink(settings.whatsapp, "Hola Legacy Import 👋")}" target="_blank" rel="noopener">${icon("whatsapp")}WhatsApp</a></li>
          <li><a href="${ig}" target="_blank" rel="noopener">${icon("instagram")}@${esc((settings.instagram || "").replace(/^@/, ""))}</a></li>
          <li><span class="foot-plain">${icon("clock")}${esc(settings.hours || "")}</span></li></ul></div>
        <div><h3>Visítanos</h3>
          <div class="visit"><img src="img/tienda-frente.jpg" alt="Fachada de la tienda Legacy Import" loading="lazy">
          <ul><li><span class="foot-plain">${icon("pin")}${esc(settings.address || "")}</span></li><li><span class="foot-plain">${icon("truck")}Envíos a toda Venezuela</span></li></ul></div></div>
      </div>
      <div class="foot-legal"><span>© ${new Date().getFullYear()} Legacy Import</span><span>Precios en USD · Bs. a tasa BCV ${bsRaw(rate())}</span></div>
    </div>`;
}

// búsqueda
let qTimer;
document.addEventListener("input", (e) => {
  if (!e.target.matches("[data-search]")) return;
  const v = e.target.value;
  $$("[data-search]").forEach((i) => i !== e.target && (i.value = v));
  $$(".search").forEach((s) => s.classList.toggle("has-q", !!v));
  clearTimeout(qTimer);
  qTimer = setTimeout(() => {
    const r = parse();
    const q = new URLSearchParams(r.parts.length ? "" : r.q);
    v ? q.set("q", v) : q.delete("q");
    const h = "#/" + (q.toString() ? "?" + q : "");
    if (r.parts.length) navigate(h); else { history.replaceState(null, "", h); paintGrid(q, true); }
  }, 180);
});
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-clear]")) {
    $$("[data-search]").forEach((i) => (i.value = ""));
    $$("[data-search]")[0].dispatchEvent(new Event("input", { bubbles: true }));
  }
  if (e.target.closest("[data-open-bag]")) openCart();
});

// ───────── Catálogo ─────────
function cardHTML(p, i = 0) {
  const st = totalStock(p);
  const colors = p.colors || [];
  const badge = st <= 0 ? "" : p.badge === "nuevo" ? `<span class="badge new">Nuevo</span>` : p.badge === "disponible" ? `<span class="badge now">${icon("sparkle")}Disponible ya</span>` : "";
  const off = pct(p) ? `<span class="badge off">−${pct(p)}%</span>` : "";
  return `<a class="card" href="#/p/${encodeURIComponent(p.id)}" data-id="${esc(p.id)}" style="--i:${Math.min(i, 14)}">
    <div class="card-media">
      ${badge}${off}
      <img ${imgSrc(p.images?.[0] || "")} alt="${esc(p.name)}" loading="${i < 4 ? "eager" : "lazy"}" decoding="async">
      ${p.images?.[1] ? `<img class="alt" ${imgSrc(p.images[1])} alt="" loading="lazy" decoding="async">` : ""}
      ${st <= 0 ? `<span class="soldout">Agotado</span>` : ""}
    </div>
    <div class="card-body">
      <div class="card-name">${esc(p.name)}</div>
      <div class="card-price num"><b>${usd(p.price)}</b>${p.compareAt > p.price ? `<s>${usd(p.compareAt)}</s>` : ""}</div>
      <div class="card-bs num">${bs(p.price, rate())}</div>
      ${colors.length > 1 ? `<div class="dots">${colors.slice(0, 4).map((c) => `<i style="background:${esc(c.hex)}" title="${esc(c.name)}"></i>`).join("")}${colors.length > 4 ? `<small>+${colors.length - 4}</small>` : ""}</div>` : ""}
    </div></a>`;
}

function filtered(q) {
  const cat = q.get("c") || "";
  const term = (q.get("q") || "").trim().toLowerCase();
  const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return products.filter((p) => (!cat || p.category === cat) && (!term || norm(`${p.name} ${catName(p.category)} ${p.description || ""}`).includes(norm(term))));
}

function renderCatalog(q) {
  const cat = q.get("c") || "";
  const banners = (settings.banners || []).filter((b) => b.active);
  const bn = banners.length ? banners[Math.floor(Date.now() / 86400000) % banners.length] : null;
  const term = q.get("q") || "";
  $$("[data-search]").forEach((i) => (i.value = term));
  app.innerHTML = `<div class="view">
    <div class="wrap top-sub">
      <span class="where">${icon("pin")}<span>${esc(settings.address || "")}</span></span>
      <label class="search ${term ? "has-q" : ""}"><span class="sr">Buscar productos</span>${icon("search")}
        <input type="search" placeholder="Buscar bolsos, camisas, termos…" autocomplete="off" data-search value="${esc(term)}">
        <button type="button" class="clear" data-clear aria-label="Borrar búsqueda">${icon("x", "sm")}</button></label>
    </div>
    <div class="wrap">
      <nav class="cats" id="cats" aria-label="Categorías">
        <span class="cat-ink" id="catInk"></span>
        <a class="cat ${!cat ? "on" : ""}" href="#/" data-cat="">Todo</a>
        ${(settings.categories || []).filter((c) => products.some((p) => p.category === c.id)).map((c) => `<a class="cat ${cat === c.id ? "on" : ""}" href="#/?c=${encodeURIComponent(c.id)}" data-cat="${esc(c.id)}">${esc(c.name)}</a>`).join("")}
      </nav>
      ${bn && !cat && !term ? `<a class="promo" href="#/?c=${encodeURIComponent(bn.category || "")}">
        <div class="promo-txt"><div class="promo-title">${esc(bn.title)}</div><div class="promo-sub">${esc(bn.subtitle || "")}</div>
        <span class="promo-cta">Ver ${esc(catName(bn.category) || "productos").toLowerCase()}${icon("chevron")}</span></div>
        <div class="promo-img"><img ${imgSrc(bn.image)} alt="" loading="eager"></div></a>` : ""}
      <div class="grid-head"><h1 id="gridTitle"></h1><span class="n num" id="gridN"></span></div>
      <div class="grid" id="grid"></div>
    </div></div>`;
  paintGrid(q, false);
  requestAnimationFrame(() => moveInk(false));
}

function paintGrid(q, animate = true) {
  const grid = $("#grid"); if (!grid) return;
  const list = filtered(q);
  const cat = q.get("c"), term = q.get("q");
  $("#gridTitle").textContent = term ? `“${term}”` : cat ? catName(cat) : "Catálogo";
  $("#gridN").textContent = `${list.length} ${list.length === 1 ? "producto" : "productos"}`;
  grid.innerHTML = list.length ? list.map(cardHTML).join("") :
    `<div class="empty" style="grid-column:1/-1">${icon("search")}<h2>No encontramos “${esc(term || "")}”</h2><p>Prueba con otra palabra o explora las categorías.</p></div>`;
  if (!animate) return;
}

function moveInk(anim = true) {
  const ink = $("#catInk"), on = $(".cat.on"), wrap = $("#cats");
  if (!ink || !on) return;
  if (!anim) ink.style.transition = "none";
  ink.style.width = on.offsetWidth + "px";
  ink.style.transform = `translateX(${on.offsetLeft}px)`;
  if (!anim) { ink.offsetWidth; ink.style.transition = ""; }
  const target = on.offsetLeft - wrap.clientWidth / 2 + on.offsetWidth / 2;
  wrap.scrollTo({ left: target, behavior: anim ? "smooth" : "instant" });
}

// cambio de categoría sin re-render de toda la vista
document.addEventListener("click", (e) => {
  const c = e.target.closest(".cat");
  if (!c || !$("#grid")) return;
  e.preventDefault(); e.stopPropagation();
  $$(".cat").forEach((x) => x.classList.toggle("on", x === c));
  moveInk();
  const q = new URLSearchParams(); if (c.dataset.cat) q.set("c", c.dataset.cat);
  history.pushState(null, "", "#/" + (q.toString() ? "?" + q : ""));
  $$("[data-search]").forEach((i) => (i.value = ""));
  $(".promo")?.remove();
  const swap = () => paintGrid(q);
  if (document.startViewTransition && !reduceMotion()) {
    document.documentElement.classList.add("vt");
    document.startViewTransition(swap).finished.finally(() => document.documentElement.classList.remove("vt"));
  } else swap();
}, true);

// ───────── Ficha de producto ─────────
function renderProduct(id) {
  app._repaint = null;
  const p = byId(id);
  if (!p) {
    app.innerHTML = `<div class="view wrap"><div class="empty">${icon("box")}<h2>Este producto ya no está disponible</h2><p>Puede que se haya agotado o lo hayamos retirado del catálogo.</p><a class="btn" href="#/">Ver el catálogo</a></div></div>`;
    return;
  }
  document.title = `${p.name} · Legacy Import`;
  const colors = colorsOf(p), sizes = sizesOf(p);
  let color = colors.find((c) => colorStock(p, c.name) > 0)?.name ?? colors[0].name;
  let size = sizes.length === 1 ? sizes[0] : null;
  let qty = 1;
  const imgs = p.images?.length ? p.images : [""];
  const offers = offersFor(p);
  const related = products.filter((x) => x.id !== p.id && x.category === p.category).concat(products.filter((x) => x.id !== p.id && x.category !== p.category)).slice(0, 8);

  app.innerHTML = `<div class="view">
    <div class="wrap pd">
      <a class="pd-back" href="#/${p.category ? "?c=" + encodeURIComponent(p.category) : ""}">${icon("back", "sm")}Volver al catálogo</a>
      <div class="gallery">
        <div class="thumbs" ${imgs.length < 2 ? "hidden" : ""}>${imgs.map((src, i) => `<button class="${i ? "" : "on"}" data-thumb="${i}" aria-label="Ver foto ${i + 1}"><img ${imgSrc(src)} alt=""></button>`).join("")}</div>
        <div style="position:relative">
          <div class="gallery-main" id="gmain">${imgs.map((src, i) => `<figure><img ${imgSrc(src)} alt="${esc(p.name)}${i ? ` · foto ${i + 1}` : ""}" ${i ? 'loading="lazy"' : ""}></figure>`).join("")}</div>
          ${imgs.length > 1 ? `<div class="g-dots" id="gdots">${imgs.map((_, i) => `<i class="${i ? "" : "on"}"></i>`).join("")}</div>` : ""}
        </div>
      </div>
      <div class="pd-info">
        <div style="display:grid;gap:8px">
          ${p.category ? `<a class="pd-cat" href="#/?c=${encodeURIComponent(p.category)}">${esc(catName(p.category))}</a>` : ""}
          <h1 class="pd-title">${esc(p.name)}</h1>
          <div class="pd-price num"><div class="usd">${usd(p.price)}${p.compareAt > p.price ? `<s>${usd(p.compareAt)}</s>` : ""}</div><div class="bsv">${bs(p.price, rate())}</div></div>
          ${offers.map((o) => `<span class="offer-chip">${icon("tag")}Promo ${esc(o.name)}</span>`).join("")}
        </div>
        ${p.description ? `<p class="note" style="max-width:56ch">${esc(p.description)}</p>` : ""}
        ${p.colors?.length ? `<div class="opt"><div class="opt-head"><b>Color</b><span id="colorName"></span></div><div class="swatches" id="sw"></div></div>` : ""}
        ${p.sizes?.length ? `<div class="opt"><div class="opt-head"><b>Talla</b><span id="sizeName">Elige tu talla</span></div><div class="sizes" id="sz"></div></div>` : ""}
        <div class="opt" style="gap:12px">
          <div class="stock-hint" id="hint"></div>
          <div class="buy-row">
            <div class="qty" id="qty"><button data-q="-1" aria-label="Quitar uno">${icon("minus", "sm")}</button><output id="qn">1</output><button data-q="1" aria-label="Agregar uno">${icon("plus", "sm")}</button></div>
            <button class="btn" id="add">${icon("bag", "sm")}<span id="addTxt">Agregar a la bolsa</span></button>
          </div>
          <button class="btn ghost" id="buyNow">Comprar ahora</button>
        </div>
        <div class="acc" id="acc">${(settings.info || []).map((it) => `<div class="acc-item"><button class="acc-btn" aria-expanded="false">${esc(it.title)}${icon("chevronDown", "sm")}</button><div class="acc-panel"><div><p>${esc(it.body)}</p></div></div></div>`).join("")}</div>
      </div>
    </div>
    ${related.length ? `<section class="wrap related"><h2>También te puede gustar</h2><div class="rail">${related.map(cardHTML).join("")}</div></section>` : ""}
  </div>`;

  const avail = () => stockOf(p, color, size) - inCartQty(p.id, color, size);
  function paint() {
    if ($("#sw")) {
      $("#sw").innerHTML = p.colors.map((c) => `<button class="sw ${c.name === color ? "on" : ""} ${colorStock(p, c.name) <= 0 ? "out" : ""}" data-color="${esc(c.name)}" aria-label="${esc(c.name)}" aria-pressed="${c.name === color}"><i style="background:${esc(c.hex)}"></i></button>`).join("");
      $("#colorName").textContent = color;
    }
    if ($("#sz")) {
      $("#sz").innerHTML = p.sizes.map((z) => `<button class="sz ${z === size ? "on" : ""} ${stockOf(p, color, z) <= 0 ? "out" : ""}" data-size="${esc(z)}" aria-pressed="${z === size}" ${stockOf(p, color, z) <= 0 ? 'aria-disabled="true"' : ""}>${esc(z)}</button>`).join("");
      $("#sizeName").textContent = size ? `Talla ${size}` : "Elige tu talla";
    }
    const hint = $("#hint"), a = size !== null ? avail() : null;
    hint.className = "stock-hint";
    if (totalStock(p) <= 0) { hint.textContent = "Agotado por ahora"; hint.classList.add("bad"); }
    else if (size === null) hint.textContent = "";
    else if (a <= 0) { hint.textContent = stockOf(p, color, size) > 0 ? "Ya tienes todas las unidades disponibles en tu bolsa" : "Sin unidades en esta combinación"; hint.classList.add("bad"); }
    else if (a <= 3) hint.textContent = a === 1 ? "¡Queda 1 unidad!" : `Quedan ${a} unidades`;
    else hint.textContent = "Disponible para entrega inmediata";
    qty = Math.max(1, Math.min(qty, Math.max(1, a ?? 1)));
    $("#qn").textContent = qty;
    $("#qty [data-q='-1']").disabled = qty <= 1;
    $("#qty [data-q='1']").disabled = a !== null && qty >= a;
    const blocked = totalStock(p) <= 0 || (size !== null && a <= 0);
    $("#add").disabled = $("#buyNow").disabled = blocked;
    $("#addTxt").textContent = size === null ? "Elige tu talla" : `Agregar a la bolsa · ${usd(p.price * qty)}`;
  }
  paint();
  app._repaint = paint;

  const pd = $(".pd");
  pd.addEventListener("click", (e) => {
    const sw = e.target.closest("[data-color]");
    if (sw) { color = sw.dataset.color; if (size && stockOf(p, color, size) <= 0 && sizes.length > 1) size = null; paint(); return; }
    const sz = e.target.closest("[data-size]");
    if (sz) { if (stockOf(p, color, sz.dataset.size) <= 0) return; size = sz.dataset.size; paint(); return; }
    const q = e.target.closest("[data-q]");
    if (q) { qty += +q.dataset.q; paint(); return; }
    const th = e.target.closest("[data-thumb]");
    if (th) { const g = $("#gmain"); g.scrollTo({ left: g.clientWidth * +th.dataset.thumb, behavior: "smooth" }); return; }
    const acc = e.target.closest(".acc-btn");
    if (acc) { const it = acc.parentElement; const o = !it.classList.contains("open"); it.classList.toggle("open", o); acc.setAttribute("aria-expanded", o); return; }
    const fig = e.target.closest(".gallery-main figure");
    if (fig && matchMedia("(hover: hover)").matches) {
      const r = fig.getBoundingClientRect();
      fig.style.setProperty("--zx", ((e.clientX - r.left) / r.width) * 100 + "%");
      fig.style.setProperty("--zy", ((e.clientY - r.top) / r.height) * 100 + "%");
      fig.classList.toggle("zoom");
    }
  });
  $$(".gallery-main figure").forEach((f) => f.addEventListener("mousemove", (e) => {
    if (!f.classList.contains("zoom")) return;
    const r = f.getBoundingClientRect();
    f.style.setProperty("--zx", ((e.clientX - r.left) / r.width) * 100 + "%");
    f.style.setProperty("--zy", ((e.clientY - r.top) / r.height) * 100 + "%");
  }));
  const g = $("#gmain");
  g.addEventListener("scroll", () => {
    const i = Math.round(g.scrollLeft / g.clientWidth);
    $$("#gdots i").forEach((d, k) => d.classList.toggle("on", k === i));
    $$("[data-thumb]").forEach((d, k) => d.classList.toggle("on", k === i));
  }, { passive: true });

  const add = (then) => {
    if (size === null) { $("#sz")?.animate([{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(0)" }], { duration: 360, easing: "ease-out" }); toast("Elige una talla primero", "error"); return; }
    addToCart(p, color, size, qty, $(".gallery-main figure:first-child img"), then);
  };
  $("#add").onclick = () => add();
  $("#buyNow").onclick = () => add(() => navigate("#/checkout"));
}

// ───────── Bolsa ─────────
function addToCart(p, color, size, qty, imgEl, then) {
  const line = cart.find((l) => l.productId === p.id && l.color === color && l.size === size);
  line ? (line.qty += qty) : cart.push({ productId: p.id, color, size, qty });
  saveCart();
  flyToBag(imgEl, () => {
    $("#bagBtn").classList.remove("bump"); void $("#bagBtn").offsetWidth; $("#bagBtn").classList.add("bump");
    if (then) then(); else toast(`${p.name} agregado a tu bolsa`);
  });
  app._repaint?.();
}

function flyToBag(img, done) {
  const target = $("#bagBtn").getBoundingClientRect();
  if (!img || reduceMotion()) return done();
  const r = img.getBoundingClientRect();
  if (r.bottom < 0 || r.top > innerHeight) return done();
  const f = document.createElement("img");
  f.src = img.currentSrc || img.src; f.className = "fly";
  const w = Math.min(r.width, 220), h = w * 1.25;
  Object.assign(f.style, { left: r.left + (r.width - w) / 2 + "px", top: r.top + Math.min(40, r.height * .1) + "px", width: w + "px", height: h + "px" });
  document.body.append(f);
  const dx = target.left + target.width / 2 - (r.left + r.width / 2), dy = target.top + target.height / 2 - (r.top + Math.min(40, r.height * .1) + h / 2);
  const anim = f.animate([
    { transform: "translate(0,0) scale(1)", opacity: 1, borderRadius: "12px" },
    { transform: `translate(${dx * .55}px, ${dy * .35 - 60}px) scale(.45) rotate(-8deg)`, opacity: 1, borderRadius: "18px", offset: .55 },
    { transform: `translate(${dx}px, ${dy}px) scale(.08) rotate(-14deg)`, opacity: .2, borderRadius: "50%" }
  ], { duration: 820, easing: "cubic-bezier(.5,0,.25,1)" });
  anim.onfinish = () => { f.remove(); done(); };
}

function paintBagCount() {
  const n = cart.reduce((s, l) => s + l.qty, 0);
  const c = $("#bagCount"); c.textContent = n; c.classList.toggle("on", n > 0);
  $("#bagBtn").setAttribute("aria-label", n ? `Abrir la bolsa, ${n} ${n === 1 ? "producto" : "productos"}` : "Abrir la bolsa");
}

async function loadCoupon() {
  coupon = couponCode ? await db.getCoupon(couponCode) : null;
  if (couponCode && !coupon) { couponCode = ""; S.set("li_coupon", ""); }
}

function totals(shipping = 0) {
  return priceCart(cartLines(), { offers: settings.offers || [], coupon, shipping });
}

function sumHTML(t, { showShip = false } = {}) {
  return `<div class="sum num">
    <div class="sum-row"><span>Subtotal</span><span>${usd(t.subtotal)}</span></div>
    ${t.offers.map((o) => `<div class="sum-row disc"><span>${esc(o.name)}${o.times > 1 ? ` ×${o.times}` : ""}</span><span>−${usd(o.amount)}</span></div>`).join("")}
    ${t.couponDiscount ? `<div class="sum-row disc"><span>Cupón ${esc(couponCode)}</span><span>−${usd(t.couponDiscount)}</span></div>` : ""}
    ${showShip ? `<div class="sum-row"><span>Envío</span><span>${t.shipping ? usd(t.shipping) : co.delivery.type === "nacional" ? "Cobro a destino" : co.delivery.type ? "Gratis" : "—"}</span></div>` : ""}
    <div class="sum-row total"><span>Total</span><span>${usd(t.total)}<small>${bs(t.total, rate())}</small></span></div>
  </div>`;
}

function renderCart() {
  const lines = cartLines();
  const n = lines.reduce((s, l) => s + l.qty, 0);
  $("#bagN").textContent = n ? `(${n})` : "";
  if (!lines.length) {
    $("#bagBody").innerHTML = `<div class="empty">${icon("bag")}<h2>Tu bolsa está vacía</h2><p>Explora el catálogo y agrega lo que te guste.</p><button class="btn sm" id="bagShop">Ver el catálogo</button></div>`;
    $("#bagFoot").hidden = true;
    $("#bagShop").onclick = () => { closeCart(); navigate("#/"); };
    return;
  }
  $("#bagFoot").hidden = false;
  $("#bagBody").innerHTML = lines.map((l, i) => {
    const vr = [l.color, l.size && `Talla ${l.size}`].filter(Boolean).join(" · ");
    return `<div class="line" style="--i:${i}" data-i="${i}">
      <img ${imgSrc(l.image)} alt="">
      <div>
        <div class="line-top"><div><a class="line-name" href="#/p/${encodeURIComponent(l.productId)}">${esc(l.name)}</a><div class="line-var">${esc(vr)}</div></div>
          <button class="line-rm" data-rm="${i}" aria-label="Quitar ${esc(l.name)}">${icon("trash", "sm")}</button></div>
        <div class="line-bottom">
          <div class="qty"><button data-lq="${i}" data-d="-1" aria-label="Quitar uno" ${l.qty <= 1 ? "disabled" : ""}>${icon("minus", "xs")}</button><output>${l.qty}</output><button data-lq="${i}" data-d="1" aria-label="Agregar uno" ${l.qty >= l.avail ? "disabled" : ""}>${icon("plus", "xs")}</button></div>
          <div class="line-price num">${usd(l.price * l.qty)}<small>${bs(l.price * l.qty, rate())}</small></div>
        </div>
      </div>
      ${l.qty > l.avail ? `<div class="line-warn">${l.avail ? `Solo quedan ${l.avail} unidades` : "Se agotó, quítalo para continuar"}</div>` : ""}
    </div>`;
  }).join("");
  const t = totals();
  const short = lines.some((l) => l.qty > l.avail);
  $("#bagFoot").innerHTML = `
    ${coupon ? `<div class="coupon-on"><span>${icon("tag", "xs")} Cupón ${esc(couponCode)} aplicado</span><button id="cpOff">Quitar</button></div>`
      : `<form class="coupon" id="cpForm"><input class="input" name="c" placeholder="Código de cupón" aria-label="Código de cupón" autocomplete="off"><button class="btn soft sm">Aplicar</button></form>`}
    ${t.couponError ? `<div class="coupon-err">${esc(t.couponError)}</div>` : ""}
    ${sumHTML(t)}
    <button class="btn block" id="toCheckout" ${short ? "disabled" : ""}>Finalizar compra · ${usd(t.total)}</button>`;
  $("#toCheckout").onclick = () => { closeCart(); navigate("#/checkout"); };
  $("#cpOff") && ($("#cpOff").onclick = () => { couponCode = ""; coupon = null; S.set("li_coupon", ""); renderCart(); });
  $("#cpForm") && ($("#cpForm").onsubmit = async (e) => {
    e.preventDefault();
    const code = e.target.c.value.trim().toUpperCase(); if (!code) return;
    const btn = e.target.querySelector("button"); btn.classList.add("is-loading");
    const c = await db.getCoupon(code); btn.classList.remove("is-loading");
    if (!c) return toast("Ese cupón no existe o ya no está activo", "error");
    couponCode = code; coupon = c; S.set("li_coupon", code); renderCart(); toast("Cupón aplicado");
  });
}

$("#bagBody").addEventListener("click", (e) => {
  const rm = e.target.closest("[data-rm]");
  if (rm) {
    const i = +rm.dataset.rm, row = rm.closest(".line");
    const go = () => { cart.splice(i, 1); saveCart(); renderCart(); };
    if (reduceMotion()) return go();
    row.style.height = row.offsetHeight + "px"; row.classList.add("leaving"); row.addEventListener("animationend", go, { once: true });
    return;
  }
  const q = e.target.closest("[data-lq]");
  if (q) { const l = cart[+q.dataset.lq]; l.qty = Math.max(1, l.qty + +q.dataset.d); saveCart(); renderCart(); }
  if (e.target.closest(".line-name")) closeCart();
});

function openCart() {
  renderCart();
  $("#drawer").classList.add("on"); $("#scrim").classList.add("on");
  $("#drawer").setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  setTimeout(() => $("#bagClose").focus(), 50);
}
function closeCart(silent) {
  if (!$("#drawer").classList.contains("on")) return;
  $("#drawer").classList.remove("on"); $("#scrim").classList.remove("on");
  $("#drawer").setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  if (!silent) $("#bagBtn").focus();
}
$("#bagBtn").onclick = openCart;
$("#bagClose").onclick = () => closeCart();
$("#scrim").onclick = () => closeCart();
addEventListener("keydown", (e) => { if (e.key === "Escape") closeCart(); });

// ───────── Checkout ─────────
const enabled = (group) => Object.entries(settings[group] || {}).filter(([, v]) => v.enabled).map(([k]) => k);
function shipCost() {
  const d = co.delivery, sh = settings.shipping || {};
  if (d.type === "delivery") return +(sh.delivery?.zones || []).find((z) => z.name === d.zone)?.cost || 0;
  if (d.type === "nacional") return +sh.nacional?.cost || 0;
  return 0;
}

function renderCheckout() {
  document.title = "Finalizar compra · Legacy Import";
  const lines = cartLines();
  if (!lines.length) {
    app.innerHTML = `<div class="view wrap"><div class="empty">${icon("bag")}<h2>Tu bolsa está vacía</h2><p>Agrega productos para finalizar tu compra.</p><a class="btn" href="#/">Ver el catálogo</a></div></div>`;
    return;
  }
  app.innerHTML = `<div class="view wrap co">
    <div class="co-head" style="display:grid;gap:14px">
      <a class="pd-back" href="#/">${icon("back", "sm")}Seguir comprando</a>
      <h1>Finalizar compra</h1>
      <div class="steps" id="steps">${["Tus datos", "Entrega", "Pago"].map((s, i) => `<div class="step" data-s="${i + 1}"><i></i>${s}</div>`).join("")}</div>
    </div>
    <section class="panel" id="coPanel" aria-live="polite"></section>
    <aside class="panel co-sum" id="coSum"></aside>
  </div>`;
  paintStep();
}

function paintSummary() {
  const t = totals(shipCost());
  const lines = cartLines();
  const n = lines.reduce((s, l) => s + l.qty, 0);
  const open = $("#coSum").classList.contains("open");
  $("#coSum").innerHTML = `
    <button class="co-sum-toggle" id="sumT" aria-expanded="${open}"><span>Resumen · ${n} ${n === 1 ? "producto" : "productos"}</span><span style="display:flex;align-items:center;gap:6px" class="num">${usd(t.total)}${icon("chevronDown", "sm")}</span></button>
    <div class="co-sum-body"><div>
      <div class="mini-list">${lines.map((l) => `<div class="mini"><img ${imgSrc(l.image)} alt=""><div>${esc(l.name)}<small>${esc([l.color, l.size && `Talla ${l.size}`, `×${l.qty}`].filter(Boolean).join(" · "))}</small></div><b class="num">${usd(l.price * l.qty)}</b></div>`).join("")}</div>
      ${sumHTML(t, { showShip: true })}
    </div></div>`;
  $("#sumT").onclick = () => { $("#coSum").classList.toggle("open"); $("#sumT").setAttribute("aria-expanded", $("#coSum").classList.contains("open")); };
}

function paintStep(dir = 1) {
  $$("#steps .step").forEach((s) => { const n = +s.dataset.s; s.classList.toggle("on", n === co.step); s.classList.toggle("done", n < co.step); });
  paintSummary();
  const P = $("#coPanel");
  const c = co.customer, d = co.delivery, pm = co.payment;
  const err = (k) => `<span class="err" data-err="${k}"></span>`;
  if (co.step === 1) {
    P.innerHTML = `<form class="co-step ${dir < 0 ? "back" : ""}" id="f1" novalidate>
      <div><h2>Tus datos</h2><p class="lead">Los usamos para confirmar tu pedido por WhatsApp.</p></div>
      <label class="field"><span>Nombre y apellido</span><input class="input" name="name" autocomplete="name" value="${esc(c.name)}" required>${err("name")}</label>
      <div class="row2">
        <label class="field"><span>Teléfono (WhatsApp)</span><input class="input" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="0412 123 4567" value="${esc(c.phone)}" required>${err("phone")}</label>
        <label class="field"><span>Cédula</span><input class="input" name="idDoc" inputmode="numeric" placeholder="V-12345678" value="${esc(c.idDoc)}" required>${err("idDoc")}</label>
      </div>
      <label class="field"><span>Correo (opcional)</span><input class="input" name="email" type="email" autocomplete="email" value="${esc(c.email)}"></label>
      <div class="co-nav"><button class="btn">Continuar a entrega</button></div>
    </form>`;
    $("#f1").onsubmit = (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      const errs = {};
      if (f.name.trim().length < 3) errs.name = "Escribe tu nombre y apellido.";
      const ph = f.phone.replace(/\D/g, "").replace(/^58/, "0");
      if (!/^0?4\d{9}$/.test(ph)) errs.phone = "Usa un número venezolano, por ejemplo 0412 123 4567.";
      if (!/^\d{6,9}$/.test(f.idDoc.replace(/\D/g, ""))) errs.idDoc = "Escribe tu número de cédula.";
      if (showErrs(errs)) return;
      co.customer = { name: f.name.trim(), phone: ph.startsWith("0") ? ph : "0" + ph, idDoc: f.idDoc.trim(), email: f.email.trim() };
      S.set("li_customer", co.customer);
      co.step = 2; paintStep();
    };
  }
  if (co.step === 2) {
    const sh = settings.shipping || {};
    const opts = enabled("shipping");
    const tileSub = { retiro: "Gratis · CC Galería Plaza", delivery: `Desde ${usd(Math.min(...(sh.delivery?.zones || [{ cost: 0 }]).map((z) => +z.cost)))}`, nacional: sh.nacional?.cost ? usd(sh.nacional.cost) : "Cobro a destino" };
    P.innerHTML = `<form class="co-step ${dir < 0 ? "back" : ""}" id="f2" novalidate>
      <div><h2>¿Cómo quieres recibirlo?</h2><p class="lead">Elige una opción de entrega.</p></div>
      <div class="tiles" role="radiogroup">${opts.map((k) => `<button type="button" class="tile ${d.type === k ? "on" : ""}" data-del="${k}" role="radio" aria-checked="${d.type === k}">${icon(DELIVERY[k].icon)}<b>${DELIVERY[k].label}</b><small>${tileSub[k]}</small></button>`).join("")}</div>
      ${err("type")}
      <div id="delFields"></div>
      <label class="field"><span>Notas para el pedido (opcional)</span><textarea class="textarea" name="notes" placeholder="Ej.: es para regalo">${esc(co.notes)}</textarea></label>
      <div class="co-nav"><button type="button" class="btn soft" data-back>Atrás</button><button class="btn">Continuar al pago</button></div>
    </form>`;
    const fields = () => {
      const box = $("#delFields");
      if (d.type === "retiro") box.innerHTML = `<div class="paybox"><p class="note">${esc(sh.retiro?.note || "")}</p><div class="kv"><span>Dirección</span><b>${esc(settings.address)}</b></div><div class="kv"><span>Horario</span><b>${esc(settings.hours || "")}</b></div></div>`;
      else if (d.type === "delivery") box.innerHTML = `<div class="co-step">
        <label class="field"><span>Zona</span><select class="select" name="zone"><option value="">Elige tu zona</option>${(sh.delivery?.zones || []).map((z) => `<option ${d.zone === z.name ? "selected" : ""} value="${esc(z.name)}">${esc(z.name)} · ${usd(z.cost)}</option>`).join("")}</select>${err("zone")}</label>
        <label class="field"><span>Dirección exacta</span><textarea class="textarea" name="address" placeholder="Urbanización, calle, casa o edificio, punto de referencia">${esc(d.address || "")}</textarea>${err("address")}</label></div>`;
      else if (d.type === "nacional") box.innerHTML = `<div class="co-step">
        <p class="note">${esc(sh.nacional?.note || "")}</p>
        <label class="field"><span>Agencia</span><select class="select" name="agency"><option value="">Elige la agencia</option>${(sh.nacional?.agencies || []).map((a) => `<option ${d.agency === a ? "selected" : ""}>${esc(a)}</option>`).join("")}</select>${err("agency")}</label>
        <div class="row2"><label class="field"><span>Estado</span><input class="input" name="state" value="${esc(d.state || "")}">${err("state")}</label>
        <label class="field"><span>Ciudad</span><input class="input" name="city" value="${esc(d.city || "")}">${err("city")}</label></div>
        <label class="field"><span>Oficina o dirección de la agencia</span><input class="input" name="office" value="${esc(d.office || "")}" placeholder="Ej.: MRW Av. Bolívar, Valencia">${err("office")}</label>
        <div class="row2"><label class="field"><span>Quién retira</span><input class="input" name="receiver" value="${esc(d.receiver ?? c.name)}">${err("receiver")}</label>
        <label class="field"><span>Cédula de quien retira</span><input class="input" name="receiverId" value="${esc(d.receiverId ?? c.idDoc)}">${err("receiverId")}</label></div></div>`;
      else box.innerHTML = "";
    };
    fields();
    P.onclick = (e) => {
      const t = e.target.closest("[data-del]");
      if (t) { saveDel(); d.type = t.dataset.del; $$("[data-del]").forEach((x) => { x.classList.toggle("on", x === t); x.setAttribute("aria-checked", x === t); }); showErrs({}); fields(); paintSummary(); }
      if (e.target.closest("[data-back]")) { saveDel(); co.step = 1; paintStep(-1); }
    };
    P.onchange = (e) => { if (e.target.name === "zone") { d.zone = e.target.value; paintSummary(); } };
    function saveDel() { const f = $("#f2"); if (!f) return; const v = Object.fromEntries(new FormData(f)); co.notes = v.notes || ""; delete v.notes; Object.assign(d, v); }
    $("#f2").onsubmit = (e) => {
      e.preventDefault(); saveDel();
      const errs = {};
      if (!d.type) errs.type = "Elige una opción de entrega.";
      if (d.type === "delivery") { if (!d.zone) errs.zone = "Elige tu zona."; if ((d.address || "").trim().length < 8) errs.address = "Escribe la dirección completa."; }
      if (d.type === "nacional") ["agency", "state", "city", "office", "receiver", "receiverId"].forEach((k) => { if (!(d[k] || "").trim()) errs[k] = "Este dato es necesario para el envío."; });
      if (showErrs(errs)) return;
      co.step = 3; paintStep();
    };
  }
  if (co.step === 3) {
    const methods = enabled("payments");
    P.innerHTML = `<form class="co-step ${dir < 0 ? "back" : ""}" id="f3" novalidate>
      <div><h2>Pago</h2><p class="lead">Elige cómo pagar. Verificamos tu pago y te confirmamos por WhatsApp.</p></div>
      <div class="tiles" role="radiogroup">${methods.map((k) => `<button type="button" class="tile ${pm.method === k ? "on" : ""}" data-pay="${k}" role="radio" aria-checked="${pm.method === k}">${icon(PAY_METHODS[k].icon)}<b>${PAY_METHODS[k].label}</b><small>${PAY_METHODS[k].currency === "bs" ? "En bolívares" : "En dólares"}</small></button>`).join("")}</div>
      ${err("method")}
      <div id="payFields"></div>
      <div class="co-nav"><button type="button" class="btn soft" data-back>Atrás</button><button class="btn" id="place">Confirmar pedido</button></div>
    </form>`;
    const payFields = () => {
      const box = $("#payFields"), m = pm.method; if (!m) return (box.innerHTML = "");
      const cfg = settings.payments[m] || {}, meta = PAY_METHODS[m];
      const t = totals(shipCost());
      const amount = meta.currency === "bs" ? bs(t.total, rate()) : usd(t.total);
      const amountRaw = meta.currency === "bs" ? (t.total * rate()).toFixed(2) : t.total.toFixed(2);
      const kv = (label, val) => val ? `<div class="kv"><div><span>${label}</span><br><b>${esc(val)}</b></div><button type="button" class="copy" data-copy="${esc(val)}">${icon("copy")}Copiar</button></div>` : "";
      const rows = {
        pagomovil: kv("Banco", cfg.bank) + kv("Teléfono", cfg.phone) + kv("Cédula / RIF", cfg.id),
        transferencia: kv("Banco", cfg.bank) + kv("Cuenta", cfg.account) + kv("Titular", cfg.holder) + kv("Cédula / RIF", cfg.id),
        zelle: kv("Correo Zelle", cfg.email) + kv("Titular", cfg.holder),
        binance: kv("Binance Pay ID", cfg.payId) + kv("Correo", cfg.email),
        cashea: `<p class="note">${esc(cfg.note || "")}</p>`,
        efectivo: `<p class="note">${esc(cfg.note || "")}</p>`
      }[m];
      box.innerHTML = `<div class="paybox">
        <div class="paybox-amount"><div><span>Monto a pagar</span><b class="num">${amount}</b>${meta.currency === "bs" ? `<span class="num">${usd(t.total)} · tasa BCV ${bsRaw(rate())}</span>` : ""}</div>
        ${meta.needsRef ? `<button type="button" class="copy" data-copy="${amountRaw}">${icon("copy")}Copiar</button>` : ""}</div>
        ${rows}
      </div>
      ${meta.needsRef ? `<div class="co-step">
        <div class="row2">
          <label class="field"><span>Número de referencia</span><input class="input" name="reference" inputmode="numeric" value="${esc(pm.reference || "")}" placeholder="Últimos 6 dígitos o más">${err("reference")}</label>
          <label class="field"><span>${m === "zelle" ? "Nombre del titular Zelle" : m === "binance" ? "Usuario o correo de Binance" : "Teléfono o banco de origen"}</span><input class="input" name="payer" value="${esc(pm.payer || "")}">${err("payer")}</label>
        </div>
        <div class="field"><span>Comprobante (captura del pago)</span>
          <div id="proofBox">${pm.proof ? proofPrev() : `<label class="drop" id="drop"><input type="file" accept="image/*" hidden id="proofIn">${icon("upload")}<b>Sube la captura</b><span>Toca para elegirla o arrástrala aquí</span></label>`}</div>
          ${err("proof")}</div>
      </div>` : ""}`;
      bindProof();
    };
    const proofPrev = () => `<div class="drop-prev"><img src="${URL.createObjectURL(pm.proof)}" alt="Comprobante"><div><b>${esc(pm.proof.name)}</b><span class="note">${(pm.proof.size / 1024 / 1024).toFixed(1)} MB</span></div><button type="button" class="line-rm" id="proofRm" aria-label="Quitar comprobante">${icon("trash", "sm")}</button></div>`;
    function bindProof() {
      const inp = $("#proofIn"), drop = $("#drop");
      const take = (file) => {
        if (!file) return;
        if (!file.type.startsWith("image/")) return toast("El comprobante debe ser una imagen", "error");
        if (file.size > 12 * 1024 * 1024) return toast("La imagen pesa más de 12 MB", "error");
        pm.proof = file; $("#proofBox").innerHTML = proofPrev(); bindProof();
      };
      if (inp) inp.onchange = () => take(inp.files[0]);
      if (drop) {
        drop.ondragover = (e) => { e.preventDefault(); drop.classList.add("over"); };
        drop.ondragleave = () => drop.classList.remove("over");
        drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove("over"); take(e.dataTransfer.files[0]); };
      }
      const rm = $("#proofRm"); if (rm) rm.onclick = () => { pm.proof = null; payFields(); };
    }
    payFields();
    const savePay = () => { const f = $("#f3"); if (!f) return; const v = Object.fromEntries(new FormData(f)); if ("reference" in v) pm.reference = v.reference; if ("payer" in v) pm.payer = v.payer; };
    P.onclick = (e) => {
      const t = e.target.closest("[data-pay]");
      if (t) { savePay(); pm.method = t.dataset.pay; $$("[data-pay]").forEach((x) => { x.classList.toggle("on", x === t); x.setAttribute("aria-checked", x === t); }); showErrs({}); payFields(); }
      const cp = e.target.closest("[data-copy]"); if (cp) copyText(cp.dataset.copy);
      if (e.target.closest("[data-back]")) { savePay(); co.step = 2; paintStep(-1); }
    };
    P.onchange = null;
    $("#f3").onsubmit = async (e) => {
      e.preventDefault(); savePay();
      const errs = {};
      if (!pm.method) errs.method = "Elige un método de pago.";
      else if (PAY_METHODS[pm.method].needsRef && !/^\d{4,}$/.test((pm.reference || "").replace(/\D/g, ""))) errs.reference = "Escribe la referencia del pago (al menos 4 dígitos).";
      if (showErrs(errs)) return;
      await placeOrder($("#place"));
    };
  }
}

function showErrs(errs) {
  $$("[data-err]").forEach((el) => { el.textContent = errs[el.dataset.err] || ""; el.closest(".field")?.classList.toggle("has-error", !!errs[el.dataset.err]); });
  const first = Object.keys(errs)[0];
  if (first) {
    const el = $(`[name="${first}"]`) || $(`[data-err="${first}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" }); el?.focus?.({ preventScroll: true });
    if (first === "type" || first === "method") toast(errs[first], "error");
  }
  return !!first;
}

async function placeOrder(btn) {
  const lines = cartLines();
  // revisa existencias con datos frescos
  const fresh = await db.listProducts();
  products = fresh;
  const short = cartLines().filter((l) => l.qty > l.avail);
  if (short.length) { toast(`${short[0].name}: solo quedan ${short[0].avail}. Ajusta tu bolsa.`, "error"); openCart(); return; }
  btn.classList.add("is-loading");
  const t = totals(shipCost());
  const m = co.payment.method, meta = PAY_METHODS[m];
  const d = { ...co.delivery };
  d.label = DELIVERY[d.type].label; d.cost = shipCost();
  const order = {
    status: meta.needsRef ? "por_verificar" : "pendiente",
    customer: co.customer,
    delivery: d,
    items: lines.map((l) => ({ productId: l.productId, name: l.name, image: l.image, color: l.color || "", size: l.size || "", qty: l.qty, price: l.price, category: l.category || "" })),
    pricing: { ...t, rate: rate(), totalBs: Math.round(t.total * rate() * 100) / 100 },
    coupon: coupon ? couponCode : "",
    payment: { method: m, label: meta.label, currency: meta.currency, reference: (co.payment.reference || "").trim(), payer: (co.payment.payer || "").trim() },
    notes: co.notes || ""
  };
  try {
    const number = await db.createOrder(order, co.payment.proof || null);
    const full = { ...order, number, createdAt: Date.now() };
    try { sessionStorage.setItem("li_last", JSON.stringify(full)); } catch {}
    cart = []; saveCart(); couponCode = ""; coupon = null; S.set("li_coupon", "");
    co.step = 1; co.delivery = { type: "" }; co.payment = { method: "" }; co.notes = "";
    navigate(`#/orden/${number}`);
  } catch (err) {
    console.error(err);
    btn.classList.remove("is-loading");
    toast("No pudimos registrar tu pedido. Revisa tu conexión e inténtalo de nuevo.", "error");
  }
}

function waMessage(o) {
  const prods = o.items.map((i) => `• ${i.qty}× ${i.name}${[i.color, i.size && `T. ${i.size}`].filter(Boolean).length ? ` (${[i.color, i.size && `T. ${i.size}`].filter(Boolean).join(", ")})` : ""} — ${usd(i.price * i.qty)}`).join("\n");
  const d = o.delivery;
  const entrega = d.type === "retiro" ? "Retiro en tienda" : d.type === "delivery" ? `Delivery · ${d.zone} · ${d.address}` : `${d.agency} · ${d.office}, ${d.city}, ${d.state} · Retira ${d.receiver} (${d.receiverId})`;
  return fill(settings.templates?.order, {
    numero: o.number, productos: prods, total: usd(o.pricing.total), totalBs: bsRaw(o.pricing.totalBs),
    metodo: o.payment.label, referencia: o.payment.reference || "—", entrega, cliente: o.customer.name
  });
}

// ───────── Confirmación ─────────
function renderDone(number) {
  let o = null;
  try { o = JSON.parse(sessionStorage.getItem("li_last") || "null"); } catch {}
  if (!o || o.number !== number) return renderTrack(number);
  document.title = `Pedido ${number} · Legacy Import`;
  const needsRef = PAY_METHODS[o.payment.method]?.needsRef;
  app.innerHTML = `<div class="view wrap"><div class="thanks">
    <svg class="thanks-check" viewBox="0 0 84 84" aria-hidden="true"><circle cx="42" cy="42" r="38"/><path d="M27 43.5 37.5 54 58 32"/></svg>
    <h1>¡Pedido recibido, ${esc(o.customer.name.split(" ")[0])}!</h1>
    <p>Tu número de orden es</p>
    <div class="order-no"><b class="num">${esc(number)}</b><button class="copy" data-copy="${esc(number)}">${icon("copy")}Copiar</button></div>
    <p>${needsRef ? "Envíanos el mensaje por WhatsApp para agilizar la verificación de tu pago. Te confirmamos apenas lo validemos." : o.payment.method === "cashea" ? "Escríbenos por WhatsApp para completar tu compra con Cashea." : "Te escribiremos por WhatsApp para coordinar el pago y la entrega."}</p>
    <div class="thanks-actions">
      <a class="btn wa block" href="${waLink(settings.whatsapp, waMessage(o))}" target="_blank" rel="noopener">${icon("whatsapp")}Enviar pedido por WhatsApp</a>
      <a class="btn soft block" href="#/seguimiento/${encodeURIComponent(number)}">Ver estado del pedido</a>
    </div>
    <div class="panel">
      <div class="mini-list" style="padding:0 0 14px">${o.items.map((l) => `<div class="mini"><img ${imgSrc(l.image)} alt=""><div>${esc(l.name)}<small>${esc([l.color, l.size && `Talla ${l.size}`, `×${l.qty}`].filter(Boolean).join(" · "))}</small></div><b class="num">${usd(l.price * l.qty)}</b></div>`).join("")}</div>
      <div class="sum num">
        <div class="sum-row"><span>Pago</span><span>${esc(o.payment.label)}${o.payment.reference ? ` · Ref. ${esc(o.payment.reference)}` : ""}</span></div>
        <div class="sum-row"><span>Entrega</span><span>${esc(o.delivery.label)}</span></div>
        <div class="sum-row total"><span>Total</span><span>${usd(o.pricing.total)}<small>${bsRaw(o.pricing.totalBs)}</small></span></div>
      </div>
    </div>
  </div></div>`;
  app.querySelector("[data-copy]").onclick = (e) => copyText(e.currentTarget.dataset.copy, "Número de orden copiado");
}

// ───────── Seguimiento ─────────
async function renderTrack(number = "") {
  document.title = "Seguir mi pedido · Legacy Import";
  app.innerHTML = `<div class="view wrap track">
    <a class="pd-back" href="#/">${icon("back", "sm")}Volver al catálogo</a>
    <div><h1>Seguir mi pedido</h1><p class="note">Escribe tu número de orden, por ejemplo LI-00012.</p></div>
    <form id="tf"><label class="sr" for="tn">Número de orden</label><input class="input" id="tn" name="n" value="${esc(number)}" placeholder="LI-00000" autocomplete="off"><button class="btn">Buscar</button></form>
    <div id="tres"></div>
  </div>`;
  $("#tf").onsubmit = (e) => { e.preventDefault(); const n = normalizeNo(e.target.n.value); if (n) navigate(`#/seguimiento/${n}`); };
  if (!number) return;
  const res = $("#tres");
  res.innerHTML = `<div class="skel" style="height:220px"></div>`;
  const tr = await db.getTracking(normalizeNo(number)).catch(() => null);
  if (!tr) { res.innerHTML = `<div class="panel"><h2>No encontramos ese pedido</h2><p class="lead" style="margin:0">Revisa el número o escríbenos por <a href="${waLink(settings.whatsapp, `Hola, quiero consultar mi pedido ${number}`)}" target="_blank" rel="noopener">WhatsApp</a>.</p></div>`; return; }
  const flow = tr.status === "pendiente" ? ["pendiente"] : ["por_verificar"];
  flow.push("pagado", "preparando", tr.deliveryType === "retiro" ? "listo_retiro" : "enviado", "entregado");
  const reached = new Map((tr.history || []).map((h) => [h.status, h.at]));
  const cur = flow.indexOf(tr.status);
  res.innerHTML = `<div class="panel" style="display:grid;gap:18px">
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">
      <div><span class="note">Pedido</span><div style="font-variation-settings:'wdth' 68;font-weight:780;font-size:30px;line-height:1" class="num">${esc(tr.number)}</div></div>
      <span class="status ${STATUS[tr.status]?.tone}">${STATUS[tr.status]?.label || tr.status}</span>
    </div>
    ${tr.status === "cancelado" ? `<p class="note">Este pedido fue cancelado. Si tienes dudas, escríbenos por WhatsApp.</p>` : `
    <ol class="timeline">${flow.map((s, i) => `<li class="${i < cur ? "done" : i === cur ? "now" : "todo"}" style="--i:${i}"><span class="dot">${i <= cur ? icon("check") : ""}</span><div><b>${STATUS[s].label}</b>${reached.get(s) ? `<small>${dateTime(reached.get(s))}</small>` : ""}${s === "enviado" && tr.shipping?.guide && i <= cur ? `<small> · ${esc(tr.shipping.agency || "")} guía ${esc(tr.shipping.guide)}</small>` : ""}</div></li>`).join("")}</ol>`}
    <div class="sum num" style="border-top:1px solid var(--line);padding-top:14px">
      ${tr.items.map((i) => `<div class="sum-row"><span>${i.qty}× ${esc(i.name)}</span><span>${esc([i.color, i.size].filter(Boolean).join(" · "))}</span></div>`).join("")}
      <div class="sum-row total"><span>Total</span><span>${usd(tr.total)}</span></div>
    </div>
  </div>`;
}
const normalizeNo = (v) => { const d = String(v).replace(/\D/g, ""); return d ? "LI-" + d.padStart(5, "0") : ""; };

// ───────── Arranque ─────────
(async function boot() {
  app.innerHTML = `<div class="wrap" style="padding-top:20px"><div class="grid">${Array.from({ length: 8 }, () => `<div style="display:grid;gap:10px"><div class="skel" style="aspect-ratio:4/5"></div><div class="skel" style="height:14px;width:70%"></div><div class="skel" style="height:14px;width:40%"></div></div>`).join("")}</div></div>`;
  try { db = await getDB(); }
  catch (e) { app.innerHTML = `<div class="wrap empty">${icon("x")}<h2>No pudimos conectar con la tienda</h2><p>Revisa tu conexión y recarga la página.</p></div>`; return; }
  if (DEMO) { const f = document.createElement("div"); f.className = "demo-flag"; f.textContent = "Modo demo"; f.title = "Los datos se guardan solo en este navegador hasta conectar Firebase"; document.body.append(f); }
  let gotS = false, gotP = false;
  const start = () => { if (ready || !gotS || !gotP) return; ready = true; loadCoupon().then(() => { paintBagCount(); route(); }); };
  db.watchSettings((s) => { settings = s; gotS = true; paintChrome(); if (ready && lastRoute === "catalog") paintGrid(parse().q, false); start(); });
  db.watchProducts((ps) => {
    products = ps; gotP = true;
    if (!ready) return start();
    if (lastRoute === "catalog") paintGrid(parse().q, false);
    if ($("#drawer").classList.contains("on")) renderCart();
  });
})();
