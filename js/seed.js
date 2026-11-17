// Datos de ejemplo para el MODO DEMO y para la carga inicial de Firebase.
// Todo se puede editar desde el panel admin.
const U = (id, w = 900) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=72`;

export const seedSettings = {
  storeName: "Legacy Import",
  tagline: "Detalles que elevan tu día",
  whatsapp: "584120000000",
  instagram: "legacy._import.ve",
  address: "CC Galería Plaza, Maracay",
  hours: "Lun a Sáb · 10:00 a 7:00 pm",
  bcvRate: 914.02,
  rateUpdatedAt: Date.now(),
  categories: [
    { id: "bolsos", name: "Bolsos" },
    { id: "camisas", name: "Camisas" },
    { id: "zapatos", name: "Zapatos" },
    { id: "termos", name: "Termos" },
    { id: "accesorios", name: "Accesorios" }
  ],
  payments: {
    pagomovil: { enabled: true, bank: "Banesco (0134)", phone: "0412-000-0000", id: "J-00000000-0", holder: "Legacy Import C.A." },
    transferencia: { enabled: true, bank: "Banesco", account: "0134-0000-00-0000000000", id: "J-00000000-0", holder: "Legacy Import C.A." },
    zelle: { enabled: true, email: "pagos@legacyimport.com", holder: "Legacy Import" },
    binance: { enabled: true, payId: "000000000", email: "binance@legacyimport.com" },
    cashea: { enabled: true, note: "Al confirmar tu pedido te escribimos por WhatsApp para completar la compra con Cashea." },
    efectivo: { enabled: true, note: "Pagas en dólares en efectivo al retirar en tienda o al recibir tu delivery en Maracay." }
  },
  shipping: {
    retiro: { enabled: true, note: "Retira en CC Galería Plaza, Maracay. Te avisamos cuando esté listo." },
    delivery: { enabled: true, zones: [
      { name: "Maracay centro", cost: 2 },
      { name: "Maracay norte / Las Delicias", cost: 3 },
      { name: "Turmero / Cagua", cost: 5 }
    ] },
    nacional: { enabled: true, agencies: ["MRW", "Zoom", "Tealca"], cost: 0, note: "El envío se paga en destino al retirar en la agencia. Despachamos de martes a sábado." }
  },
  templates: {
    order: "Hola Legacy Import 👋 Acabo de hacer el pedido *{numero}*.\n\n{productos}\n\nTotal: *{total}* ({totalBs})\nPago: {metodo} · Ref. {referencia}\nEntrega: {entrega}\n\nA nombre de {cliente}.",
    aprobado: "¡Hola {cliente}! ✨ Confirmamos el pago de tu pedido *{numero}*. Ya lo estamos preparando.",
    rechazado: "Hola {cliente}, no pudimos verificar el pago del pedido *{numero}*. ¿Nos envías de nuevo la referencia o el comprobante?",
    enviado: "¡Tu pedido *{numero}* va en camino! 🚚 Agencia: {agencia} · Guía: {guia}. Sigue tu pedido en la web con tu número de orden.",
    retiro: "¡Hola {cliente}! Tu pedido *{numero}* está listo para retirar en CC Galería Plaza, Maracay. Te esperamos.",
    entregado: "¡Gracias por tu compra, {cliente}! Esperamos que tu pedido *{numero}* te encante. Etiquétanos en Instagram @legacy._import.ve ✨"
  },
  banners: [
    { id: "b1", image: "img/camisas-barca.jpg", title: "Camisas 2×25$", subtitle: "Llévate dos camisas de fútbol por 25$", category: "camisas", active: true }
  ],
  offers: [
    { id: "o1", name: "Camisas 2×25$", type: "bundle", qty: 2, price: 25, categoryId: "camisas", active: true }
  ],
  info: [
    { title: "Métodos de pago", body: "Pago Móvil, transferencia, Zelle, Binance (USDT), Cashea y efectivo. Al finalizar recibes tu número de orden y un mensaje listo para WhatsApp." },
    { title: "Envíos nacionales", body: "Enviamos a toda Venezuela por MRW, Zoom o Tealca, cobro a destino. Despachos de martes a sábado, una vez verificado el pago." },
    { title: "Retiro y delivery", body: "Retira gratis en CC Galería Plaza, Maracay, o pide delivery en Maracay, Turmero y Cagua." },
    { title: "Cambios", body: "Tienes 3 días para cambios por talla presentando tu número de orden. El producto debe estar sin uso y con etiquetas." }
  ]
};

export const seedProducts = [
  {
    id: "p-cartera-milano", name: "Cartera Milano", category: "bolsos", price: 28, compareAt: 35,
    description: "Cartera estructurada de cuero sintético con herrajes dorados, correa ajustable y bolsillo interior con cierre.",
    images: [U("1546333456-3e8ed81f41e2")], colors: [{ name: "Caramelo", hex: "#9A5B2E" }, { name: "Negro", hex: "#1A1714" }, { name: "Crema", hex: "#EFE4CF" }],
    sizes: [], stock: { "Caramelo|-": 4, "Negro|-": 6, "Crema|-": 0 }, badge: "nuevo", visible: true, order: 1
  },
  {
    id: "p-tote-urban", name: "Tote Urban", category: "bolsos", price: 22,
    description: "Tote amplia de tela resistente, ideal para el día a día. Cabe una laptop de 14\".",
    images: [U("1572196223922-d8b7e0ab0b4d")], colors: [{ name: "Negro", hex: "#1A1714" }],
    sizes: [], stock: { "Negro|-": 9 }, badge: "disponible", visible: true, order: 2
  },
  {
    id: "p-camisa-barca-rosa", name: "Camisa Barça Rosa 24/25", category: "camisas", price: 15,
    description: "Camisa versión fan, tela transpirable. Aplica la promo 2×25$ en camisas.",
    images: ["img/camisas-barca.jpg"], colors: [{ name: "Rosa", hex: "#F29BB6" }, { name: "Negra", hex: "#151515" }],
    sizes: ["S", "M", "L", "XL"], stock: { "Rosa|S": 3, "Rosa|M": 5, "Rosa|L": 2, "Rosa|XL": 0, "Negra|S": 1, "Negra|M": 4, "Negra|L": 4, "Negra|XL": 2 },
    badge: "disponible", visible: true, order: 3
  },
  {
    id: "p-camisa-naranja", name: "Camisa Visitante Naranja", category: "camisas", price: 15,
    description: "Camisa versión fan con escudo bordado. Aplica la promo 2×25$ en camisas.",
    images: [U("1764116679127-dc9d2c1138a7")], colors: [{ name: "Naranja", hex: "#E8742A" }],
    sizes: ["S", "M", "L", "XL"], stock: { "Naranja|S": 2, "Naranja|M": 3, "Naranja|L": 3, "Naranja|XL": 1 },
    badge: "", visible: true, order: 4
  },
  {
    id: "p-salomon-xt6", name: "Salomon XT-6", category: "zapatos", price: 95, compareAt: 110,
    description: "Zapato trail con malla transpirable, cordones de ajuste rápido y suela de alto agarre.",
    images: ["img/salomon.jpg"], colors: [{ name: "Blanco", hex: "#ECEBE6" }],
    sizes: ["38", "39", "40", "41", "42", "43"], stock: { "Blanco|38": 1, "Blanco|39": 2, "Blanco|40": 2, "Blanco|41": 0, "Blanco|42": 1, "Blanco|43": 1 },
    badge: "nuevo", visible: true, order: 5
  },
  {
    id: "p-runner-blanco", name: "Runner Blanco", category: "zapatos", price: 48,
    description: "Zapato deportivo liviano, amortiguación suave para uso diario.",
    images: [U("1615743472612-93b21e520fad")], colors: [{ name: "Blanco", hex: "#F2F1EE" }],
    sizes: ["37", "38", "39", "40", "41", "42"], stock: { "Blanco|37": 2, "Blanco|38": 3, "Blanco|39": 3, "Blanco|40": 2, "Blanco|41": 2, "Blanco|42": 1 },
    badge: "", visible: true, order: 6
  },
  {
    id: "p-classic-574", name: "Classic 574", category: "zapatos", price: 52,
    description: "Clásico retro de gamuza y malla, cómodo y fácil de combinar.",
    images: [U("1542272604-78d13c1f741a")], colors: [{ name: "Blanco", hex: "#EDEDEA" }, { name: "Gris", hex: "#9C9A94" }],
    sizes: ["38", "39", "40", "41", "42"], stock: { "Blanco|38": 1, "Blanco|39": 2, "Blanco|40": 2, "Blanco|41": 1, "Blanco|42": 0, "Gris|38": 0, "Gris|39": 1, "Gris|40": 2, "Gris|41": 2, "Gris|42": 1 },
    badge: "", visible: true, order: 7
  },
  {
    id: "p-termo-steel", name: "Termo Steel 750 ml", category: "termos", price: 14,
    description: "Termo de acero inoxidable de doble pared. Mantiene frío 24 h y caliente 12 h.",
    images: [U("1544003484-3cd181d17917")], colors: [{ name: "Negro mate", hex: "#232220" }, { name: "Acero", hex: "#B9B8B3" }, { name: "Arena", hex: "#D8C6A3" }],
    sizes: [], stock: { "Negro mate|-": 12, "Acero|-": 7, "Arena|-": 5 }, badge: "disponible", visible: true, order: 8
  }
];
