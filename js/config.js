// ─────────────────────────────────────────────────────────────
//  Legacy Import · Configuración
//  Pega aquí las claves de tu proyecto de Firebase
//  (Consola de Firebase → Configuración del proyecto → Tus apps → Web).
//  Mientras apiKey esté vacío, la tienda funciona en MODO DEMO:
//  los datos se guardan solo en este navegador.
// ─────────────────────────────────────────────────────────────
export const firebaseConfig = {
  apiKey: "AIzaSyAAs7JYtIVxOX3y90alNzUykGpkjB_8nAA",
  authDomain: "legacy-import-b47e8.firebaseapp.com",
  projectId: "legacy-import-b47e8",
  storageBucket: "legacy-import-b47e8.firebasestorage.app",
  messagingSenderId: "553744307671",
  appId: "1:553744307671:web:34278283e174f042ef6792"
};

export const DEMO = !firebaseConfig.apiKey;

// Credenciales del panel en modo demo (no se usan con Firebase)
export const DEMO_ADMIN = { email: "admin@legacyimport.demo", password: "legacy2026" };

// Versión del SDK de Firebase que se carga desde la CDN de Google
export const FIREBASE_VERSION = "11.0.2";
