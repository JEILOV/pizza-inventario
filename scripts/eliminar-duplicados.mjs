/**
 * scripts/eliminar-duplicados.mjs
 *
 * Detecta insumos duplicados en la colección `insumos` (mismo
 * nombre + zona + tipo + unidad) y borra las copias de más,
 * dejando un solo documento por insumo.
 *
 * Por defecto corre en modo DRY-RUN: solo muestra qué borraría,
 * sin tocar Firestore. Hay que pasar --confirmar para que borre
 * de verdad.
 *
 * Uso:
 *   node scripts/eliminar-duplicados.mjs              # dry-run (solo reporte)
 *   node scripts/eliminar-duplicados.mjs --confirmar   # borra de verdad
 *
 * Credenciales: mismo patrón que bootstrap-admin.mjs / subir-insumos.mjs
 * (secrets/serviceAccountKey.json o GOOGLE_APPLICATION_CREDENTIALS).
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import admin from "firebase-admin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CONFIRMAR = process.argv.includes("--confirmar");

// ─────────────────────────────────────────────────────────────
// Credenciales
// ─────────────────────────────────────────────────────────────

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

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const COLECCION = "insumos";
const LIMITE_BATCH = 500;

// ─────────────────────────────────────────────────────────────
// Clave de "mismo insumo": nombre + zona + tipo + unidad,
// normalizado (trim + mayúsculas) para no fallar por espacios
// o diferencias de mayúsculas/minúsculas.
// ─────────────────────────────────────────────────────────────

function claveDuplicado(data) {
  const nombre = String(data.nombre ?? "").trim().toUpperCase();
  const zona = String(data.zona ?? "").trim().toLowerCase();
  const tipo = String(data.tipo ?? "").trim().toLowerCase();
  const unidad = String(data.unidad ?? "").trim().toLowerCase();
  return `${nombre}__${zona}__${tipo}__${unidad}`;
}

async function main() {
  console.log(`Leyendo colección "${COLECCION}"...`);
  const snapshot = await db.collection(COLECCION).get();
  console.log(`Total de documentos: ${snapshot.size}`);

  const grupos = new Map(); // clave -> [{ id, createTime, nombre }]

  snapshot.forEach((doc) => {
    const data = doc.data();
    const clave = claveDuplicado(data);
    const lista = grupos.get(clave) ?? [];
    lista.push({
      id: doc.id,
      createTime: doc.createTime?.toMillis?.() ?? 0,
      nombre: data.nombre ?? "(sin nombre)",
      zona: data.zona,
      tipo: data.tipo,
      unidad: data.unidad,
    });
    grupos.set(clave, lista);
  });

  const aBorrar = [];
  let gruposConDuplicados = 0;

  for (const [, docs] of grupos) {
    if (docs.length <= 1) continue;
    gruposConDuplicados++;
    // Se conserva el más antiguo (createTime menor); el resto se borra.
    docs.sort((a, b) => a.createTime - b.createTime);
    const [conservar, ...duplicados] = docs;
    console.log(
      `\n"${conservar.nombre}" (${conservar.zona}/${conservar.tipo}/${conservar.unidad}): ` +
        `${docs.length} copias → se conserva 1 (id ${conservar.id}), se borran ${duplicados.length}`
    );
    aBorrar.push(...duplicados);
  }

  console.log(`\n─────────────────────────────────────────`);
  console.log(`Insumos con duplicados: ${gruposConDuplicados}`);
  console.log(`Documentos a borrar: ${aBorrar.length}`);

  if (aBorrar.length === 0) {
    console.log("No hay duplicados que borrar. Todo limpio ✅");
    return;
  }

  if (!CONFIRMAR) {
    console.log(
      `\nEsto fue un DRY-RUN — no se borró nada todavía.\n` +
        `Si la lista de arriba se ve bien, vuelve a correr:\n` +
        `  node scripts/eliminar-duplicados.mjs --confirmar`
    );
    return;
  }

  console.log(`\nBorrando ${aBorrar.length} documentos duplicados...`);
  const coleccion = db.collection(COLECCION);

  for (let inicio = 0; inicio < aBorrar.length; inicio += LIMITE_BATCH) {
    const lote = aBorrar.slice(inicio, inicio + LIMITE_BATCH);
    const batch = db.batch();
    for (const doc of lote) {
      batch.delete(coleccion.doc(doc.id));
    }
    await batch.commit();
    console.log(`  Borrados: ${Math.min(inicio + LIMITE_BATCH, aBorrar.length)}/${aBorrar.length}`);
  }

  console.log("Listo ✅ Duplicados eliminados.");
}

main()
  .catch((e) => {
    console.error("Error al ejecutar el script:", e.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
