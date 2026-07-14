/**
 * functions/index.js
 *
 * Cloud Function de 2da generación que sincroniza el campo `rol` de
 * cada documento `usuarios/{uid}` con el Custom Claim `rol` del token
 * de Firebase Auth de esa misma persona.
 *
 * Es la pieza que cierra el círculo: el AuthContext del frontend lee
 * `token.claims.rol` de forma fail-closed, y esta función es la única
 * fuente de verdad que escribe ese claim — nunca se hace desde el
 * cliente, porque setCustomUserClaims requiere el Admin SDK, que solo
 * corre en un entorno de confianza como este.
 */

const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();

// Región explícita para que coincida con el resto de la infra del
// proyecto — ajustar si Firestore/Auth no viven en us-central1.
setGlobalOptions({ region: "us-central1", maxInstances: 10 });

const ROLES_VALIDOS = ["admin", "cocina", "salon"];

exports.sincronizarRolClaim = onDocumentWritten(
  "usuarios/{uid}",
  async (event) => {
    const { uid } = event.params;
    const before = event.data?.before;
    const after = event.data?.after;

    // Documento borrado (baja de un empleado): se le quita el rol del
    // token. Deliberadamente NO se borra a la persona de Auth acá —
    // esa es una decisión operativa aparte, fuera del alcance de esta
    // función.
    if (!after?.exists) {
      logger.info(`usuarios/${uid} borrado — revocando claim de rol.`);
      await admin.auth().setCustomUserClaims(uid, { rol: null });
      return;
    }

    const rolNuevo = after.data()?.rol;
    const rolAnterior = before?.exists ? before.data()?.rol : undefined;

    // Nada que hacer si el rol no cambió (por ejemplo, el panel de
    // admin o el bootstrap script tocaron solo `nombre` o
    // `actualizadoEn`) — evita una llamada innecesaria a la Admin API.
    if (rolNuevo === rolAnterior) {
      return;
    }

    if (!ROLES_VALIDOS.includes(rolNuevo)) {
      logger.error(
        `usuarios/${uid} tiene un rol inválido: "${rolNuevo}". ` +
          `Se esperaba uno de: ${ROLES_VALIDOS.join(", ")}. No se modifica el claim.`
      );
      return;
    }

    logger.info(`Sincronizando claim { rol: "${rolNuevo}" } para uid ${uid}.`);
    await admin.auth().setCustomUserClaims(uid, { rol: rolNuevo });
  }
);