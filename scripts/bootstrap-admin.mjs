/**
 * scripts/bootstrap-admin.mjs
 *
 * Script LOCAL de un solo uso. Corre fuera de Next.js (no vive bajo
 * `src/`, así que el bundler de la app nunca lo toca ni lo empaqueta
 * para el cliente) y usa el Admin SDK de Firebase, que ignora las
 * Security Rules por diseño — por eso puede escribir en `usuarios`
 * aunque la regla diga "solo el admin puede escribir ahí": todavía no
 * existe ningún admin, y este script es precisamente lo que resuelve
 * ese huevo-y-la-gallina.
 *
 * Qué hace:
 *   1. Le asigna el Custom Claim `{ rol: "<rol>" }` a un UID de
 *      Firebase Auth ya existente (por defecto "admin").
 *   2. Crea/actualiza su documento en `usuarios/{uid}`.
 *
 * Uso:
 *   node scripts/bootstrap-admin.mjs <uid> <nombre> [email] [--rol=admin]
 *
 * Ejemplo (el caso de hoy — darte tu propio acceso de admin):
 *   node scripts/bootstrap-admin.mjs abC123XyZ "Ana Pérez" ana@pizzarepublic.com
 *
 * Ejemplo (crear a alguien de cocina para pruebas, antes de tener la
 * Cloud Function y el panel de admin de usuarios listos):
 *   node scripts/bootstrap-admin.mjs def456 "Luis Cocina" luis@pizzarepublic.com --rol=cocina
 *
 * Dónde conseguir el <uid>: Firebase Console → Authentication → Users
 * → columna "User UID" de la fila con tu cuenta de Google (ya debe
 * existir ahí porque iniciaste sesión al menos una vez en la app).
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import admin from "firebase-admin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROLES_VALIDOS = ["admin", "cocina", "salon"];

// ─────────────────────────────────────────────────────────────
// 1. Parseo de argumentos
// ─────────────────────────────────────────────────────────────

const argsPosicionales = [];
let rol = "admin";

for (const arg of process.argv.slice(2)) {
  if (arg.startsWith("--rol=")) {
    rol = arg.slice("--rol=".length);
  } else {
    argsPosicionales.push(arg);
  }
}

const [uid, nombre, email] = argsPosicionales;

if (!uid || !nombre) {
  console.error(
    "Uso: node scripts/bootstrap-admin.mjs <uid> <nombre> [email] [--rol=admin|cocina|salon]"
  );
  process.exit(1);
}

if (!ROLES_VALIDOS.includes(rol)) {
  console.error(`Rol inválido: "${rol}". Debe ser uno de: ${ROLES_VALIDOS.join(", ")}.`);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────
// 2. Credenciales — Service Account Key
// ─────────────────────────────────────────────────────────────
//
// La key NUNCA se sube al repo. Vive en secrets/serviceAccountKey.json
// (ver .gitignore, ya cubierto) o en la ruta que indiques con la
// variable de entorno GOOGLE_APPLICATION_CREDENTIALS.

const rutaKey =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ??
  path.resolve(__dirname, "..", "secrets", "serviceAccountKey.json");

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(rutaKey, "utf-8"));
} catch (e) {
  console.error(`No se pudo leer la Service Account Key en: ${rutaKey}`);
  console.error(
    "Descárgala desde Firebase Console → Configuración del proyecto → " +
      "Cuentas de servicio → Generar nueva clave privada, y colócala en esa ruta " +
      "(o exporta GOOGLE_APPLICATION_CREDENTIALS apuntando a otra)."
  );
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// ─────────────────────────────────────────────────────────────
// 3. Custom Claim + documento en Firestore
// ─────────────────────────────────────────────────────────────

async function main() {
  console.log(`Asignando Custom Claim { rol: "${rol}" } al uid ${uid}...`);
  await admin.auth().setCustomUserClaims(uid, { rol });

  console.log(`Creando/actualizando usuarios/${uid} en Firestore...`);
  await admin
    .firestore()
    .collection("usuarios")
    .doc(uid)
    .set(
      {
        nombre,
        email: email ?? null,
        rol,
        actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

  console.log("Listo ✅");
  console.log(
    `El navegador donde tengas sesión iniciada todavía tiene el token viejo — ` +
      `usa el botón "Ya me activaron" en la app (o cierra sesión y vuelve a entrar) ` +
      `para que el rol nuevo se refleje.`
  );
}

main()
  .catch((e) => {
    console.error("Error al ejecutar el bootstrap:", e);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
