# Legacy Import · Tienda en línea

Catálogo, bolsa de compras, checkout con número de orden, mensajes de WhatsApp listos y panel de administración.
HTML + CSS + JavaScript sin frameworks. Base de datos en **Firebase (plan gratuito Spark, sin tarjeta)**.

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | La tienda (catálogo, ficha, bolsa, checkout, confirmación, seguimiento) |
| `admin.html` | Panel de administración |
| `js/config.js` | **Aquí van las claves de Firebase.** Vacío = modo demo |
| `js/db.js` | Conexión a datos (Firebase o modo demo) |
| `js/store.js` / `js/admin.js` | Lógica de la tienda y del panel |
| `js/seed.js` | Datos iniciales de ejemplo (se cargan la primera vez) |
| `css/` | Estilos |
| `firestore.rules` | Reglas de seguridad de la base de datos |
| `firebase.json` | Configuración por si usas Firebase Hosting |

## Probar en modo demo

Sin claves de Firebase la tienda funciona igual, pero los datos se guardan solo en ese navegador.
Necesitas abrirla desde un servidor (no con doble clic), por ejemplo:

```
npx serve .
```

Panel demo: `admin.html` → `admin@legacyimport.demo` / `legacy2026`.

## Conectar Firebase (plan gratuito)

1. Entra a https://console.firebase.google.com y crea un proyecto (puedes desactivar Google Analytics).
2. **Firestore Database** → Crear base de datos → modo producción → ubicación `nam5` o la más cercana.
3. **Firestore → Reglas**: pega todo el contenido de `firestore.rules` y publica.
4. **Authentication** → Comenzar → activa **Correo electrónico/contraseña**.
5. **Authentication → Usuarios → Agregar usuario**: el correo y la contraseña del administrador. Copia su **UID**.
6. **Firestore → Datos**: crea la colección `admins` con un documento cuyo ID sea ese **UID** (puede tener un campo `email`). Solo los usuarios en `admins` entran al panel.
7. **Configuración del proyecto → Tus apps → Web (</>)**: registra la app y copia el objeto `firebaseConfig` dentro de `js/config.js`.
8. Abre `admin.html` y entra: la primera vez se cargan los ajustes y productos de ejemplo. Edítalos desde el panel.

> **Por qué no se usa Firebase Storage:** desde febrero de 2026 Storage exige el plan Blaze (con tarjeta).
> Las fotos y comprobantes se comprimen (máx. ~1 MB) y se guardan en Firestore (`media` y `proofs`), así todo funciona en el plan gratuito.
> Límites gratis de Firestore: 1 GiB de datos, 50.000 lecturas y 20.000 escrituras por día. Las fotos quedan en caché en el navegador del cliente.

## Publicar

Es un sitio estático: sube la carpeta tal cual a **GitHub Pages**, Netlify, Vercel o Firebase Hosting (`firebase deploy --only hosting,firestore:rules`).

## Cómo funciona una compra

1. El cliente elige color y talla → bolsa (aplica combos como 2×25$ y cupones).
2. Checkout en 3 pasos: datos, entrega (retiro / delivery Maracay / envío nacional) y pago.
3. Ve los datos de pago con botón **Copiar** y el monto exacto en Bs (tasa BCV) o USD; escribe la referencia y sube la captura.
4. Se genera el número de orden **LI-00001** y se abre WhatsApp con el mensaje ya escrito.
5. En el panel suena un aviso de pedido nuevo (con notificación del navegador si la activas con la campana).
6. El admin revisa el comprobante y toca **Aprobar pago**: se descuenta el stock y puede avisar al cliente por WhatsApp con un toque.
7. El cliente sigue su pedido en **Seguir mi pedido** con su número de orden.

## Panel

- **Inicio**: ventas del día y del mes, pagos por verificar, poco stock, gráfica de 14 días, más vendidos.
- **Pedidos**: filtros por estado, búsqueda, comprobante, aprobar/cancelar, número de guía, mensajes de WhatsApp.
- **Productos**: crear y editar, fotos, colores, tallas, stock por combinación, ocultar, **ordenar catálogo** arrastrando.
- **Ofertas**: combos, cupones y banners del catálogo.
- **Ajustes**: tasa BCV, WhatsApp, datos de pago, zonas de delivery, agencias, mensajes predeterminados, categorías.

## Notas

- El aviso de pedido nuevo funciona mientras el panel esté abierto (en el celular o la computadora). Para avisos con el panel cerrado haría falta Cloud Functions (plan Blaze).
- La verificación del pago es semi-automática: los bancos venezolanos no ofrecen una API pública para confirmar Pago Móvil.
- Las fotos de ejemplo vienen de Unsplash y de Instagram de la tienda: reemplázalas por las reales desde el panel. El escudo del logo es una versión vectorial provisional; cambia `shield()` en `js/util.js` o `img/favicon.svg` por el logo oficial.
