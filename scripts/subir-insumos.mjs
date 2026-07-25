/**
 * scripts/subir-insumos.mjs
 *
 * Carga masiva de insumos desde un CSV hacia la colección `insumos`
 * de Firestore. Corre fuera de Next.js (Admin SDK, ignora Security
 * Rules) — mismo patrón que scripts/bootstrap-admin.mjs.
 *
 * Uso:
 *   node scripts/subir-insumos.mjs <ruta-al-csv>
 *
 * Ejemplo:
 *   node scripts/subir-insumos.mjs ./insumos-plantilla.csv
 *
 * Credenciales: igual que bootstrap-admin.mjs — service account en
 * secrets/serviceAccountKey.json, o GOOGLE_APPLICATION_CREDENTIALS.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import admin from "firebase-admin";
import csv from "csv-parser";
import { Readable } from "node:stream";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─────────────────────────────────────────────────────────────
// 1. Argumentos
// ─────────────────────────────────────────────────────────────

const rutaCsv = process.argv[2];

if (!rutaCsv) {
  console.error("Uso: node scripts/subir-insumos.mjs <ruta-al-csv>");
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────
// 2. Credenciales — mismo patrón que bootstrap-admin.mjs
// ─────────────────────────────────────────────────────────────

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

const db = admin.firestore();
const COLECCION = "insumos";
const LIMITE_BATCH = 500; // límite duro de Firestore por batch

// ─────────────────────────────────────────────────────────────
// 3. Validación y conversión de tipos por fila
// ─────────────────────────────────────────────────────────────
//
// El modelo real vive en src/types/insumo.ts. Ojo: el campo de
// estado del insumo es `activo: boolean` (no "estado"), y el
// timestamp que usa el resto de la app es `actualizadoEn` (no
// "fechaCreacion") — lo replico tal cual para que useInsumos /
// insumosService lean estos documentos sin diferencias.

const ZONAS_VALIDAS = ["cocina", "salon"];
const TIPOS_VALIDOS = ["interno", "externo"];

function numeroOpcional(valor) {
  if (valor === undefined || valor === null || String(valor).trim() === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function numeroObligatorio(valor, campo, fila) {
  const n = Number(valor);
  if (valor === undefined || String(valor).trim() === "" || !Number.isFinite(n)) {
    throw new Error(`Fila ${fila}: "${campo}" debe ser un número válido (llegó: "${valor}").`);
  }
  return n;
}

function convertirFila(raw, indiceFila) {
  const nombre = (raw.nombre ?? "").trim();
  const zona = (raw.zona ?? "").trim().toLowerCase();
  const tipo = (raw.tipo ?? "").trim().toLowerCase();
  const unidad = (raw.unidad ?? "").trim();

  if (!nombre) throw new Error(`Fila ${indiceFila}: "nombre" es obligatorio.`);
  if (!ZONAS_VALIDAS.includes(zona)) {
    throw new Error(`Fila ${indiceFila}: "zona" debe ser "cocina" o "salon" (llegó: "${raw.zona}").`);
  }
  if (!TIPOS_VALIDOS.includes(tipo)) {
    throw new Error(`Fila ${indiceFila}: "tipo" debe ser "interno" o "externo" (llegó: "${raw.tipo}").`);
  }
  if (!unidad) throw new Error(`Fila ${indiceFila}: "unidad" es obligatoria.`);

  const stockActual = numeroObligatorio(raw.stockActual, "stockActual", indiceFila);
  const stockMinimo = numeroObligatorio(raw.stockMinimo, "stockMinimo", indiceFila);
  const stockMinimoFinDeSemana = numeroOpcional(raw.stockMinimoFinDeSemana);
  const leadTimeDias = numeroOpcional(raw.leadTimeDias) ?? 0;
  const diasAnticipacionAlerta = numeroOpcional(raw.diasAnticipacionAlerta) ?? 0;
  const rendimientoPorLote = tipo === "interno" ? numeroOpcional(raw.rendimientoPorLote) : null;
  const loteUnidad = tipo === "interno" ? (raw.loteUnidad ?? "").trim() : "";

  return {
    nombre,
    zona,
    tipo,
    unidad,
    stockActual,
    stockMinimo,
    stockMinimoFinDeSemana,
    leadTimeDias,
    diasAnticipacionAlerta,
    rendimientoPorLote,
    loteUnidad,
    activo: true,
    actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
  };
}

// ─────────────────────────────────────────────────────────────
// 4. Lectura del CSV
// ─────────────────────────────────────────────────────────────

function leerCsv(ruta) {
  return new Promise((resolve, reject) => {
    const filas = [];
    const contenido = readFileSync(ruta, "utf-8");
    Readable.from(contenido)
      .pipe(csv())
      .on("data", (fila) => filas.push(fila))
      .on("end", () => resolve(filas))
      .on("error", reject);
  });
}

// ─────────────────────────────────────────────────────────────
// 5. Carga en batches de máximo 500 escrituras
// ─────────────────────────────────────────────────────────────

async function main() {
  console.log(`Leyendo ${rutaCsv}...`);
  const filasRaw = await leerCsv(rutaCsv);

  if (filasRaw.length === 0) {
    console.error("El CSV no tiene filas de datos.");
    process.exit(1);
  }

  console.log(`Validando ${filasRaw.length} filas...`);
  const insumos = filasRaw.map((raw, i) => convertirFila(raw, i + 2)); // +2: fila 1 es el header

  console.log(`Todas las filas son válidas. Subiendo a "${COLECCION}"...`);

  const coleccion = db.collection(COLECCION);
  let subidos = 0;

  for (let inicio = 0; inicio < insumos.length; inicio += LIMITE_BATCH) {
    const lote = insumos.slice(inicio, inicio + LIMITE_BATCH);
    const batch = db.batch();

    for (const insumo of lote) {
      const ref = coleccion.doc(); // ID autogenerado, igual que addDoc en el front
      batch.set(ref, insumo);
    }

    await batch.commit();
    subidos += lote.length;
    console.log(`  Batch subido: ${subidos}/${insumos.length}`);
  }

  console.log(`Listo ✅  ${subidos} insumos creados en "${COLECCION}".`);
}

main()
  .catch((e) => {
    console.error("Error al ejecutar el script:", e.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => process.exit());