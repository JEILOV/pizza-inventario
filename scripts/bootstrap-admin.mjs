/**
 * scripts/bootstrap-admin.mjs
 *
 * Script LOCAL de alta/actualización de empleados. Corre fuera de
 * Next.js (no vive bajo `src/`, así que el bundler de la app nunca lo
 * toca) y usa el Admin SDK de Firebase, que ignora las Security Rules
 * por diseño — por eso puede escribir en `usuarios` aunque la regla
 * diga "solo el admin puede escribir ahí".
 *
 * ─────────────────────────────────────────────────────────────────
 * NOTA DE ARQUITECTURA (plan Spark, sin Cloud Functions):
 *
 * El proyecto se mantiene en el plan gratuito Spark, así que NO hay
 * una Cloud Function escuchando `usuarios/{uid}` para sincronizar el
 * Custom Claim automáticamente. Este script es, por lo tanto, la
 * ÚNICA forma de dar de alta o cambiar el rol de una persona:
 * hace las dos escrituras a mano, en el mismo lugar:
 *
 *   1. Custom Claim en Firebase Auth  → admin.auth().setCustomUserClaims
 *   2. Documento en Firestore         → usuarios/{uid}
 *
 * Si en el futuro se sube a Blaze y se reintroduce la Cloud Function,
 * este script sigue funcionando igual (ambas cosas quedan
 * consistentes) — simplemente dejaría de ser el único camino.
 * ─────────────────────────────────────────────────────────────────
 *
 * Qué hace:
 *   1. Le asigna el Custom Claim `{ rol: "<rol>" }` a un UID de
 *      Firebase Auth ya existente (por defecto "admin").
 *   2. Crea/actualiza su documento en `usuarios/{uid}`.
 *
 * Uso:
 *   node scripts/bootstrap-admin.mjs <uid> <nombre> [email] [--rol=admin|cocina|salon]
 *
 * Ejemplos:
 *   # Dar de alta al primer admin
 *   node scripts/bootstrap-admin.mjs abC123XyZ "Ana Pérez" ana@pizzarepublic.com
 *
 *   # Dar de alta a alguien de cocina
 *   node scripts/bootstrap-admin.mjs def456 "Luis Cocina" luis@pizzarepublic.com --rol=cocina
 *
 *   # Dar de alta a alguien de salón
 *   node scripts/bootstrap-admin.mjs ghi789 "Marta Salón" marta@pizzarepublic.com --rol=salon
 *
 *   # Cambiar el rol de alguien que ya existe (mismo uid, rol nuevo)
 *   node scripts/bootstrap-admin.mjs def456 "Luis Cocina" luis@pizzarepublic.com --rol=salon
 *
 * Dónde conseguir el <uid>: Firebase Console → Authentication → Users
 * → columna "User UID" de la fila con la cuenta de Google de la
 * persona (ya debe existir ahí porque inició sesión al menos una vez
 * en la app y quedó esperando en la pantalla de "sin rol asignado").
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
      `para que el rol nuevo se refleje. Como no hay Cloud Function corriendo, ` +
      `este script es el único paso que sincroniza el claim: si el rol de alguien ` +
      `cambia, hay que volver a correrlo con el mismo uid y el --rol nuevo.`
  );
}

main()
  .catch((e) => {
    console.error("Error al ejecutar el script:", e);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
