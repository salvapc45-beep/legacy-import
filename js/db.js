// Capa de datos de Legacy Import.
// Con claves de Firebase en config.js usa Firestore + Auth (plan gratuito Spark).
// Sin claves usa localStorage (MODO DEMO) con la misma interfaz.
import { firebaseConfig, DEMO, DEMO_ADMIN, FIREBASE_VERSION } from "./config.js";
import { seedSettings, seedProducts } from "./seed.js";

const clone = (o) => JSON.parse(JSON.stringify(o));
export const pad = (n) => "LI-" + String(n).padStart(5, "0");
export const stockKey = (color, size) => `${color || "-"}|${size || "-"}`;

// ───────────────────────── Imágenes ─────────────────────────
// Reduce y comprime antes de subir (máx. 1400 px, WebP o JPEG).
export async function compressImage(file, max = 1400, quality = 0.82) {
  if (!file.type.startsWith("image/")) throw new Error("El archivo debe ser una imagen.");
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  const type = c.toDataURL("image/webp").startsWith("data:image/webp") ? "image/webp" : "image/jpeg";
  return await new Promise((res) => c.toBlob((b) => res(b), type, quality));
}
const blobToDataURL = (b) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });

// ───────────────────────── MODO DEMO ─────────────────────────
function makeLocal() {
  const K = { s: "li_settings", p: "li_products", o: "li_orders", c: "li_counter", cp: "li_coupons", a: "li_admin" };
  const mem = {};
  const get = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return k in mem ? mem[k] : d; } };
  const set = (k, v) => {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { mem[k] = v; if (e.name === "QuotaExceededError") throw new Error("El navegador se quedó sin espacio para el modo demo. Usa imágenes más livianas o conecta Firebase."); }
    window.dispatchEvent(new CustomEvent("li:change", { detail: k }));
  };
  if (!get(K.s)) set(K.s, seedSettings);
  if (!get(K.p)) set(K.p, seedProducts.map((p) => ({ ...p, createdAt: Date.now() })));
  if (!get(K.cp)) set(K.cp, { BIENVENIDA10: { code: "BIENVENIDA10", type: "percent", value: 10, min: 20, active: true, uses: 0 } });

  const listeners = (key, fn) => {
    const h = (e) => { if (!e.detail || e.detail === key || e.key === key) fn(); };
    window.addEventListener("li:change", h); window.addEventListener("storage", h);
    fn();
    return () => { window.removeEventListener("li:change", h); window.removeEventListener("storage", h); };
  };

  return {
    mode: "demo",
    async getSettings() { return get(K.s, seedSettings); },
    watchSettings(cb) { return listeners(K.s, () => cb(get(K.s, seedSettings))); },
    async saveSettings(patch) { set(K.s, { ...get(K.s, seedSettings), ...patch }); },

    async listProducts({ all = false } = {}) {
      const ps = get(K.p, []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      return all ? ps : ps.filter((p) => p.visible);
    },
    watchProducts(cb, { all = false } = {}) { return listeners(K.p, async () => cb(await this.listProducts({ all }))); },
    async saveProduct(p) {
      const ps = get(K.p, []);
      if (!p.id) { p.id = "p-" + Math.random().toString(36).slice(2, 9); p.createdAt = Date.now(); p.order = (Math.max(0, ...ps.map((x) => x.order || 0))) + 1; }
      const i = ps.findIndex((x) => x.id === p.id);
      i >= 0 ? (ps[i] = p) : ps.push(p);
      set(K.p, ps); return p.id;
    },
    async deleteProduct(id) { set(K.p, get(K.p, []).filter((p) => p.id !== id)); },
    async reorderProducts(ids) { const ps = get(K.p, []); ids.forEach((id, i) => { const p = ps.find((x) => x.id === id); if (p) p.order = i + 1; }); set(K.p, ps); },

    async uploadImage(file) { return blobToDataURL(await compressImage(file)); },

    async getCoupon(code) { const c = get(K.cp, {})[code.trim().toUpperCase()]; return c && c.active ? c : null; },
    async listCoupons() { return Object.values(get(K.cp, {})); },
    async saveCoupon(c) { const all = get(K.cp, {}); c.code = c.code.trim().toUpperCase(); all[c.code] = { uses: 0, ...all[c.code], ...c }; set(K.cp, all); },
    async deleteCoupon(code) { const all = get(K.cp, {}); delete all[code]; set(K.cp, all); },

    async createOrder(order, proofFile) {
      if (proofFile) order.payment.proofUrl = await blobToDataURL(await compressImage(proofFile, 1200, 0.7));
      const n = get(K.c, 0) + 1; set(K.c, n);
      const number = pad(n);
      const now = Date.now();
      const full = { ...order, number, n, createdAt: now, updatedAt: now, history: [{ status: order.status, at: now }] };
      const os = get(K.o, []); os.unshift(full); set(K.o, os);
      if (order.coupon) { const all = get(K.cp, {}); if (all[order.coupon]) { all[order.coupon].uses = (all[order.coupon].uses || 0) + 1; set(K.cp, all); } }
      return number;
    },
    async getTracking(number) {
      const o = get(K.o, []).find((x) => x.number === number.trim().toUpperCase());
      return o ? trackingOf(o) : null;
    },
    watchOrders(cb) { return listeners(K.o, () => cb(get(K.o, []))); },
    async updateOrder(number, patch, newStatus) {
      const os = get(K.o, []); const o = os.find((x) => x.number === number); if (!o) return;
      Object.assign(o, patch, { updatedAt: Date.now() });
      if (newStatus && newStatus !== o.status) { o.status = newStatus; o.history = [...(o.history || []), { status: newStatus, at: Date.now() }]; }
      set(K.o, os);
    },
    async approvePayment(number) {
      const os = get(K.o, []); const o = os.find((x) => x.number === number); if (!o || o.stockApplied) return this.updateOrder(number, {}, "pagado");
      const ps = get(K.p, []);
      for (const it of o.items) { const p = ps.find((x) => x.id === it.productId); if (p) { const k = stockKey(it.color, it.size); p.stock[k] = Math.max(0, (p.stock[k] || 0) - it.qty); } }
      set(K.p, ps);
      await this.updateOrder(number, { stockApplied: true }, "pagado");
    },
    async proofURL(o) { return o.payment?.proofUrl || null; },

    async login(email, password) {
      if (email.trim().toLowerCase() === DEMO_ADMIN.email && password === DEMO_ADMIN.password) { set(K.a, { email, at: Date.now() }); return true; }
      throw new Error("Correo o contraseña incorrectos.");
    },
    async logout() { set(K.a, null); },
    onAuth(cb) { return listeners(K.a, () => { const s = get(K.a, null); cb(s ? { email: s.email, admin: true } : null); }); },
    async resetDemo() { Object.values(K).forEach((k) => { try { localStorage.removeItem(k); } catch {} }); location.reload(); }
  };
}

export function trackingOf(o) {
  return {
    number: o.number, status: o.status, createdAt: o.createdAt, updatedAt: o.updatedAt || o.createdAt,
    total: o.pricing.total, deliveryType: o.delivery.type, history: o.history || [],
    items: o.items.map((i) => ({ name: i.name, qty: i.qty, color: i.color || "", size: i.size || "" })),
    shipping: o.shipping || null
  };
}

// ───────────────────────── FIREBASE ─────────────────────────
// Plan gratuito (Spark): sin Cloud Storage. Las fotos y comprobantes se comprimen
// y se guardan en Firestore (colecciones "media" y "proofs").
const MEDIA_MAX = 900000; // bytes de texto por documento (Firestore admite 1 MiB)
async function toDataURLUnder(file, max, q, limit = MEDIA_MAX) {
  let size = max, quality = q, url = "";
  for (let i = 0; i < 5; i++) {
    url = await blobToDataURL(await compressImage(file, size, quality));
    if (url.length < limit) return url;
    size = Math.round(size * 0.8); quality = Math.max(0.5, quality - 0.08);
  }
  throw new Error("La imagen es demasiado pesada. Prueba con otra foto.");
}

async function makeFirebase() {
  const v = FIREBASE_VERSION;
  const [{ initializeApp }, fs, au] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${v}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${v}/firebase-firestore.js`),
    import(`https://www.gstatic.com/firebasejs/${v}/firebase-auth.js`)
  ]);
  const app = initializeApp(firebaseConfig);
  const db = fs.getFirestore(app), auth = au.getAuth(app);
  const { doc, getDoc, setDoc, deleteDoc, collection, query, where, getDocs, onSnapshot, runTransaction, writeBatch, orderBy, limit, increment } = fs;
  const settingsRef = doc(db, "settings", "store");
  const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);
  const productsQ = (all) => all ? collection(db, "products") : query(collection(db, "products"), where("visible", "==", true));
  const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  // Caché de fotos: memoria + Cache Storage del navegador (las fotos no cambian)
  const memo = new Map();
  async function media(id) {
    if (memo.has(id)) return memo.get(id);
    const p = (async () => {
      let cache = null;
      try { cache = await caches.open("li-media-v1"); const hit = await cache.match("/media/" + id); if (hit) return await hit.text(); } catch {}
      const s = await getDoc(doc(db, "media", id));
      const data = s.exists() ? s.data().data : "";
      if (data && cache) cache.put("/media/" + id, new Response(data)).catch(() => {});
      return data;
    })();
    memo.set(id, p);
    return p;
  }
  const hydrate = (img) => {
    const id = img.dataset.media; if (!id || img.dataset.mediaDone) return;
    img.dataset.mediaDone = "1";
    media(id).then((d) => { if (d) img.src = d; }).catch(() => {});
  };
  const mo = new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => {
    if (n.nodeType !== 1) return;
    if (n.matches?.("img[data-media]")) hydrate(n);
    n.querySelectorAll?.("img[data-media]").forEach(hydrate);
  })));
  mo.observe(document.documentElement, { childList: true, subtree: true });

  return {
    mode: "firebase",
    async getSettings() { const s = await getDoc(settingsRef); return s.exists() ? s.data() : seedSettings; },
    watchSettings(cb) { return onSnapshot(settingsRef, (s) => cb(s.exists() ? s.data() : seedSettings), (e) => console.error(e)); },
    async saveSettings(patch) { await setDoc(settingsRef, clone(patch), { merge: true }); },

    async listProducts({ all = false } = {}) { const s = await getDocs(productsQ(all)); return s.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byOrder); },
    watchProducts(cb, { all = false } = {}) { return onSnapshot(productsQ(all), (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byOrder)), (e) => console.error(e)); },
    async saveProduct(p) {
      const data = clone(p);
      if (!data.id) {
        const s = await getDocs(query(collection(db, "products"), orderBy("order", "desc"), limit(1)));
        data.order = (s.docs[0]?.data().order || 0) + 1; data.createdAt = Date.now();
        data.id = "p-" + rid();
      }
      const id = data.id; delete data.id;
      await setDoc(doc(db, "products", id), data); return id;
    },
    async deleteProduct(id) { await deleteDoc(doc(db, "products", id)); },
    async reorderProducts(ids) { const b = writeBatch(db); ids.forEach((id, i) => b.update(doc(db, "products", id), { order: i + 1 })); await b.commit(); },

    async uploadImage(file) {
      const data = await toDataURLUnder(file, 1200, 0.8);
      const id = rid();
      await setDoc(doc(db, "media", id), { data, createdAt: Date.now() });
      memo.set(id, Promise.resolve(data));
      return "media:" + id;
    },

    async getCoupon(code) { try { const s = await getDoc(doc(db, "coupons", code.trim().toUpperCase())); return s.exists() && s.data().active ? s.data() : null; } catch { return null; } },
    async listCoupons() { const s = await getDocs(collection(db, "coupons")); return s.docs.map((d) => d.data()); },
    async saveCoupon(c) { c.code = c.code.trim().toUpperCase(); await setDoc(doc(db, "coupons", c.code), { uses: 0, ...c }, { merge: true }); },
    async deleteCoupon(code) { await deleteDoc(doc(db, "coupons", code)); },

    async createOrder(order, proofFile) {
      if (proofFile) {
        const data = await toDataURLUnder(proofFile, 1400, 0.72);
        const pid = rid();
        await setDoc(doc(db, "proofs", pid), { data, createdAt: Date.now() });
        order.payment.proofId = pid;
      }
      const counterRef = doc(db, "meta", "counter");
      return await runTransaction(db, async (tx) => {
        const c = await tx.get(counterRef);
        const n = (c.exists() ? c.data().n : 0) + 1;
        const number = pad(n);
        const now = Date.now();
        const full = { ...clone(order), number, n, createdAt: now, updatedAt: now, history: [{ status: order.status, at: now }] };
        tx.set(counterRef, { n });
        tx.set(doc(db, "orders", number), full);
        tx.set(doc(db, "tracking", number), trackingOf(full));
        if (order.coupon) tx.update(doc(db, "coupons", order.coupon), { uses: increment(1) });
        return number;
      });
    },
    async getTracking(number) { const s = await getDoc(doc(db, "tracking", number.trim().toUpperCase())); return s.exists() ? s.data() : null; },
    watchOrders(cb) { return onSnapshot(query(collection(db, "orders"), orderBy("n", "desc"), limit(500)), (s) => cb(s.docs.map((d) => d.data())), (e) => console.error(e)); },
    async updateOrder(number, patch, newStatus) {
      const ref = doc(db, "orders", number);
      await runTransaction(db, async (tx) => {
        const s = await tx.get(ref); if (!s.exists()) return;
        const o = { ...s.data(), ...clone(patch), updatedAt: Date.now() };
        if (newStatus && newStatus !== o.status) { o.status = newStatus; o.history = [...(o.history || []), { status: newStatus, at: Date.now() }]; }
        tx.set(ref, o); tx.set(doc(db, "tracking", number), trackingOf(o));
      });
    },
    async approvePayment(number) {
      const ref = doc(db, "orders", number);
      await runTransaction(db, async (tx) => {
        const s = await tx.get(ref); if (!s.exists()) return;
        const o = s.data();
        const prods = {};
        if (!o.stockApplied) for (const it of o.items) { if (!prods[it.productId]) { const ps = await tx.get(doc(db, "products", it.productId)); if (ps.exists()) prods[it.productId] = ps.data(); } }
        if (!o.stockApplied) {
          for (const it of o.items) { const p = prods[it.productId]; if (p) { const k = stockKey(it.color, it.size); p.stock = p.stock || {}; p.stock[k] = Math.max(0, (p.stock[k] || 0) - it.qty); } }
          for (const [id, p] of Object.entries(prods)) tx.update(doc(db, "products", id), { stock: p.stock });
        }
        const now = Date.now();
        const up = { ...o, stockApplied: true, status: "pagado", updatedAt: now, history: [...(o.history || []), { status: "pagado", at: now }] };
        tx.set(ref, up); tx.set(doc(db, "tracking", number), trackingOf(up));
      });
    },
    async proofURL(o) {
      if (o.payment?.proofUrl) return o.payment.proofUrl;
      if (!o.payment?.proofId) return null;
      try { const s = await getDoc(doc(db, "proofs", o.payment.proofId)); return s.exists() ? s.data().data : null; } catch { return null; }
    },

    async login(email, password) {
      try { await au.signInWithEmailAndPassword(auth, email.trim(), password); }
      catch (e) { throw new Error(e.code === "auth/too-many-requests" ? "Demasiados intentos. Espera unos minutos." : "Correo o contraseña incorrectos."); }
    },
    async logout() { await au.signOut(auth); },
    onAuth(cb) {
      return au.onAuthStateChanged(auth, async (u) => {
        if (!u) return cb(null);
        let admin = false;
        try { admin = (await getDoc(doc(db, "admins", u.uid))).exists(); } catch {}
        cb({ email: u.email, uid: u.uid, admin });
      });
    },
    // Carga los datos de ejemplo la primera vez (solo admin)
    async seedIfEmpty() {
      const s = await getDoc(settingsRef);
      if (!s.exists()) await setDoc(settingsRef, seedSettings);
      const p = await getDocs(collection(db, "products"));
      if (p.empty) { const b = writeBatch(db); seedProducts.forEach(({ id, ...d }) => b.set(doc(db, "products", id), { ...d, createdAt: Date.now() })); await b.commit(); }
    }
  };
}

let _db;
export async function getDB() {
  if (_db) return _db;
  _db = DEMO ? makeLocal() : await makeFirebase();
  return _db;
}
