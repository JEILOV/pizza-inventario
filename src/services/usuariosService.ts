import { collection, onSnapshot, type FirestoreError, type Unsubscribe } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type MapaNombresUsuarios = Record<string, string>;

/**
 * Suscribe a la colección `usuarios` y arma un mapa uid -> nombre.
 * Por las Security Rules, `usuarios` solo es legible por admin — este
 * servicio, en consecuencia, solo se debe llamar desde vistas
 * exclusivas de ese rol (ej. el Buzón de Notas). Si quien llama no es
 * admin, Firestore rechaza la lectura y el callback de error se activa;
 * el llamador puede tratarlo como "no hay nombres, se muestra el uid".
 */
export function subscribeNombresUsuarios(
  onData: (mapa: MapaNombresUsuarios) => void,
  onError?: (error: FirestoreError) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, "usuarios"),
    (snapshot) => {
      const mapa: MapaNombresUsuarios = {};
      snapshot.docs.forEach((d) => {
        const nombre = d.data().nombre as string | undefined;
        if (nombre) mapa[d.id] = nombre;
      });
      onData(mapa);
    },
    (error) => {
      console.error("Error al escuchar usuarios:", error);
      onError?.(error);
    }
  );
}