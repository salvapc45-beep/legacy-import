// Utilidades compartidas: formato, íconos, plantillas, precios, avisos.

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
// Las fotos guardadas en Firestore llegan como "media:<id>" y se cargan al aparecer en pantalla
export const imgSrc = (src = "") => String(src).startsWith("media:") ? `src="${PIXEL}" data-media="${esc(String(src).slice(6))}"` : `src="${esc(src)}"`;
export const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

const usdF = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2 });
const bsF = new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const usd = (n) => usdF.format(Math.round((+n || 0) * 100) / 100);
export const bs = (n, rate) => "Bs. " + bsF.format((+n || 0) * (+rate || 0));
export const bsRaw = (n) => "Bs. " + bsF.format(+n || 0);
export const dateTime = (t) => new Date(t).toLocaleString("es-VE", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" });
export const dateShort = (t) => new Date(t).toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" });
export const ago = (t) => {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "ahora"; if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60); if (h < 24) return `hace ${h} h`;
  return dateShort(t);
};

// ───────── Íconos (trazo 1.6, dibujados a mano en una sola familia) ─────────
const P = {
  bag: '<path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8Z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  trash: '<path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l.8 12a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9l.8-12M9 7V4.8c0-.4.4-.8.8-.8h4.4c.4 0 .8.4.8.8V7"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3"/>',
  pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3"/>',
  truck: '<path d="M3 6.5h11v9H3zM14 9.5h3.6l3.4 3.6v2.4h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  box: '<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5v-9Z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>',
  store: '<path d="M4 9.5V20h16V9.5M3 9.5 4.6 4h14.8L21 9.5a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0Z"/><path d="M10 20v-5h4v5"/>',
  card: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3"/>',
  phone: '<rect x="7" y="2.8" width="10" height="18.4" rx="2.2"/><path d="M11 17.5h2"/>',
  bank: '<path d="M3.5 9.5 12 4.5l8.5 5M5 10v7.5M9.5 10v7.5M14.5 10v7.5M19 10v7.5M3.5 20h17"/>',
  cash: '<rect x="2.5" y="6.5" width="19" height="11" rx="1.8"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M14.6 9.6c-.4-.9-1.4-1.4-2.6-1.4-1.5 0-2.6.8-2.6 1.9 0 2.6 5.4 1.3 5.4 4 0 1.1-1.2 1.9-2.8 1.9-1.3 0-2.4-.6-2.8-1.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  tag: '<path d="M3.5 12.6V4.5a1 1 0 0 1 1-1h8.1l8 8a1.5 1.5 0 0 1 0 2.1l-6.9 6.9a1.5 1.5 0 0 1-2.1 0l-8.1-7.9Z"/><circle cx="8" cy="8" r="1.4"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2"/>',
  list: '<path d="M8.5 6.5h11M8.5 12h11M8.5 17.5h11"/><circle cx="4.5" cy="6.5" r=".6"/><circle cx="4.5" cy="12" r=".6"/><circle cx="4.5" cy="17.5" r=".6"/>',
  settings: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  chart: '<path d="M4 20h16"/><path d="M7 16.5V11M12 16.5V6.5M17 16.5v-3.5"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15l1.5-2Z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  logout: '<path d="M14 4.5h4a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-4M10 16.5 5.5 12 10 7.5M5.5 12h10"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/>',
  eyeOff: '<path d="M4 4l16 16M9.9 6A9.8 9.8 0 0 1 12 5.5C18 5.5 21.5 12 21.5 12a17 17 0 0 1-3 3.8M6.6 7.7C4 9.5 2.5 12 2.5 12S6 18.5 12 18.5c1.4 0 2.6-.3 3.7-.8"/>',
  drag: '<circle cx="9" cy="6.5" r="1.1"/><circle cx="15" cy="6.5" r="1.1"/><circle cx="9" cy="12" r="1.1"/><circle cx="15" cy="12" r="1.1"/><circle cx="9" cy="17.5" r="1.1"/><circle cx="15" cy="17.5" r="1.1"/>',
  edit: '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="m14 7 3 3"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m4 18 5-5 4 4 2.5-2.5L20 19"/>',
  external: '<path d="M14 4.5h5.5V10M19.5 4.5 11 13M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
  receipt: '<path d="M6 3.5h12v17l-2.4-1.5-2.4 1.5-2.4-1.5-2.4 1.5L6 20.5v-17Z"/><path d="M9 8h6M9 11.5h6M9 15h3.5"/>',
  sparkle: '<path d="M12 3.5 13.8 10 20.5 12l-6.7 2L12 20.5 10.2 14 3.5 12l6.7-2L12 3.5Z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4"/>',
  user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1-3.8 4-5.6 7.5-5.6s6.5 1.8 7.5 5.6"/>',
  whatsapp: '<path d="M4.2 19.8 5.3 16a8.3 8.3 0 1 1 3 3l-4.1.8Z"/><path d="M9.1 8.6c.2-.5.5-.6.8-.6h.5c.2 0 .4 0 .5.4l.7 1.7c.1.2 0 .4-.1.6l-.5.6c-.1.1-.2.3 0 .5.3.6 1.3 2 3 2.6.2.1.4 0 .5-.1l.7-.8c.1-.2.3-.2.5-.1l1.6.8c.2.1.3.2.3.4 0 .5-.2 1.2-.8 1.6-.6.3-1.6.6-3.6-.4-2.3-1.2-3.8-3.7-4-4.1-.3-.4-.6-1.3-.6-2.1 0-.6.3-1 .5-1.2Z" fill="currentColor" stroke="none"/>',
  instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".9" fill="currentColor" stroke="none"/>'
};
export const icon = (name, cls = "") => `<svg class="i ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ""}</svg>`;

// Escudo de Legacy Import (versión vectorial provisional del logo; reemplazable por el archivo oficial)
export const shield = (cls = "") => `<svg class="shield ${cls}" viewBox="0 0 40 46" aria-hidden="true">
  <defs><linearGradient id="lg-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E7C77A"/><stop offset=".45" stop-color="#B88A2E"/><stop offset="1" stop-color="#7E5A16"/></linearGradient></defs>
  <path d="M20 1.5 37.5 6v16.2c0 10.4-7.3 18.3-17.5 22.3C9.8 40.5 2.5 32.6 2.5 22.2V6L20 1.5Z" fill="none" stroke="url(#lg-gold)" stroke-width="3"/>
  <path d="M20 7 32 10.2v12c0 7.4-5 13.1-12 16.1-7-3-12-8.7-12-16.1v-12L20 7Z" fill="url(#lg-gold)" opacity=".16"/>
  <path d="M15 12.5h4.6v16.2h8.2v4.3H15V12.5Z" fill="url(#lg-gold)"/></svg>`;

// ───────── Plantillas de mensajes ─────────
export const fill = (tpl = "", data = {}) => tpl.replace(/\{(\w+)\}/g, (_, k) => (data[k] ?? "").toString());
export const waLink = (phone, text) => `https://wa.me/${String(phone || "").replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;

export const PAY_METHODS = {
  pagomovil: { label: "Pago Móvil", icon: "phone", currency: "bs", needsRef: true },
  transferencia: { label: "Transferencia", icon: "bank", currency: "bs", needsRef: true },
  zelle: { label: "Zelle", icon: "card", currency: "usd", needsRef: true },
  binance: { label: "Binance (USDT)", icon: "coin", currency: "usd", needsRef: true },
  cashea: { label: "Cashea", icon: "sparkle", currency: "usd", needsRef: false },
  efectivo: { label: "Efectivo", icon: "cash", currency: "usd", needsRef: false }
};
export const DELIVERY = {
  retiro: { label: "Retiro en tienda", icon: "store" },
  delivery: { label: "Delivery en Maracay", icon: "truck" },
  nacional: { label: "Envío nacional", icon: "box" }
};
export const STATUS = {
  pendiente: { label: "Pendiente de pago", tone: "wait" },
  por_verificar: { label: "Pago por verificar", tone: "check" },
  pagado: { label: "Pago confirmado", tone: "ok" },
  preparando: { label: "Preparando", tone: "ok" },
  listo_retiro: { label: "Listo para retirar", tone: "go" },
  enviado: { label: "Enviado", tone: "go" },
  entregado: { label: "Entregado", tone: "done" },
  cancelado: { label: "Cancelado", tone: "bad" }
};
export const STATUS_FLOW = ["por_verificar", "pagado", "preparando", "enviado", "entregado"];

// ───────── Motor de precios (carrito, checkout y admin usan el mismo) ─────────
export function priceCart(lines, { offers = [], coupon = null, shipping = 0 } = {}) {
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const applied = [];
  let offerDiscount = 0;
  for (const of of offers.filter((o) => o.active && o.type === "bundle" && o.qty > 1)) {
    const units = [];
    lines.forEach((l) => { if (!of.categoryId || l.category === of.categoryId) for (let i = 0; i < l.qty; i++) units.push(l.price); });
    const groups = Math.floor(units.length / of.qty);
    if (!groups) continue;
    units.sort((a, b) => b - a);
    const grouped = units.slice(0, groups * of.qty).reduce((s, x) => s + x, 0);
    const d = grouped - groups * of.price;
    if (d > 0) { offerDiscount += d; applied.push({ name: of.name, amount: d, times: groups }); }
  }
  const base = subtotal - offerDiscount;
  let couponDiscount = 0, couponError = "";
  if (coupon) {
    if (base < (coupon.min || 0)) couponError = `Este cupón aplica desde ${usd(coupon.min)}.`;
    else couponDiscount = coupon.type === "percent" ? base * (coupon.value / 100) : Math.min(base, coupon.value);
  }
  const total = Math.max(0, base - couponDiscount + (+shipping || 0));
  const r2 = (n) => Math.round(n * 100) / 100;
  return { subtotal: r2(subtotal), offerDiscount: r2(offerDiscount), offers: applied, couponDiscount: r2(couponDiscount), couponError, shipping: r2(+shipping || 0), total: r2(total) };
}

// ───────── Avisos ─────────
export function toast(msg, kind = "") {
  let host = $("#toasts");
  if (!host) { host = document.createElement("div"); host.id = "toasts"; host.setAttribute("aria-live", "polite"); document.body.append(host); }
  const t = document.createElement("div");
  t.className = `toast ${kind}`;
  t.innerHTML = `${icon(kind === "error" ? "x" : "check")}<span>${esc(msg)}</span>`;
  host.append(t);
  setTimeout(() => { t.classList.add("out"); t.addEventListener("animationend", () => t.remove(), { once: true }); }, 2800);
}

export async function copyText(text, label = "Copiado") {
  try { await navigator.clipboard.writeText(text); toast(label); }
  catch { const ta = document.createElement("textarea"); ta.value = text; document.body.append(ta); ta.select(); document.execCommand("copy"); ta.remove(); toast(label); }
}

// Revela elementos al entrar en pantalla (ya visibles por defecto si no hay JS)
export function revealOnScroll(root = document) {
  if (reduceMotion() || !("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" });
  $$("[data-reveal]:not(.in)", root).forEach((el) => io.observe(el));
}
