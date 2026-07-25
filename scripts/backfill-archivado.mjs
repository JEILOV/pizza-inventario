/**
 * scripts/backfill-archivado.mjs
 *
 * Uso único: corre esto UNA vez antes de desplegar el filtro
 * where("archivado", "==", false) en notasService.ts, para que los
 * documentos de ajustes/cierres creados durante pruebas (sin el campo
 * `archivado`) no desaparezcan del Buzón de Notas. Documentos nuevos ya
 * lo traen desde ajustesService.ts / cierresService.ts — esto es solo
 * para el histórico.
 *
 * Mismo mecanismo de credenciales que bootstrap-admin.mjs: lee
 * secrets/serviceAccountKey.json (o GOOGLE_APPLICATION_CREDENTIALS).
 *
 * Ejecutar UNA sola vez:
 *   node scripts/backfill-archivado.mjs
 */

import admin from "firebase-admin";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const rutaKey =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ??
  path.resolve(__dirname, "..", "secrets", "serviceAccountKey.json");

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(rutaKey, "utf-8"));
} catch (e) {
  console.error(`No se pudo leer la Service Account Key en: ${rutaKey}`);
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function backfillColeccion(nombre) {
  // Firestore no puede filtrar "campo no existe" directamente, así que
  // traemos todo y filtramos en memoria — aceptable porque esto corre
  // UNA sola vez, no en producción recurrente.
  const todos = await db.collection(nombre).get();
  const sinCampo = todos.docs.filter((d) => d.data().archivado === undefined);

  if (sinCampo.length === 0) {
    console.log(`${nombre}: nada que migrar (${todos.size} documentos revisados).`);
    return;
  }

  const batch = db.batch();
  sinCampo.forEach((d) => batch.update(d.ref, { archivado: false }));
  await batch.commit();
  console.log(`${nombre}: ${sinCampo.length} de ${todos.size} documentos actualizados.`);
}

await backfillColeccion("ajustes");
await backfillColeccion("cierres");
console.log("Backfill completo.");
