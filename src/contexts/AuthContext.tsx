"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import type { RolUsuario, Usuario } from "@/types/usuario";

// ─────────────────────────────────────────────────────────────

// Tipos

// ─────────────────────────────────────────────────────────────

interface AuthContextValue {

  /** null mientras carga, mientras no hay sesión, o mientras la cuenta

   *  no tiene rol asignado todavía (ver `cuentaPendiente`). */

  usuario: Usuario | null;

  /** true solo durante la resolución inicial de sesión (primer render). */

  cargando: boolean;

  /** true si hay un usuario de Firebase Auth válido pero SIN Custom

   *  Claim `rol` — típicamente porque un admin aún no le creó su

   *  documento en `usuarios/{uid}`, o la Cloud Function que sincroniza

   *  el claim todavía no corrió. Fail-closed: nunca se asume un rol

   *  por defecto en este caso. */

  cuentaPendiente: boolean;

  error: string | null;

  iniciarSesionConGoogle: () => Promise<void>;

  cerrarSesion: () => Promise<void>;

  /** Fuerza un refresh del ID token (getIdToken(true)) y vuelve a leer

   *  los claims — útil cuando un admin te acaba de asignar/cambiar el

   *  rol y no quieres esperar el refresh natural (~1h) ni cerrar sesión. */

  recargarPermisos: () => Promise<void>;

}

const AuthContext = createContext<AuthContextValue | null>(null);

// Roles válidos — cualquier otro valor en el claim (typo, rol viejo,

// etc.) se trata como "sin rol" en vez de dejarlo pasar.

const ROLES_VALIDOS: readonly RolUsuario[] = ["admin", "cocina", "salon"];

function esRolValido(valor: unknown): valor is RolUsuario {

  return typeof valor === "string" && (ROLES_VALIDOS as readonly string[]).includes(valor);

}

// ─────────────────────────────────────────────────────────────

// Provider

// ─────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {

  const [usuario, setUsuario] = useState<Usuario | null>(null);

  const [cargando, setCargando] = useState(true);

  const [cuentaPendiente, setCuentaPendiente] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // Lee el ID token (forzando refresh o no) de un usuario de Firebase

  // ya logueado, y deriva el estado de la app (usuario con rol, o

  // cuenta pendiente) a partir del claim `rol`.

  const sincronizarDesdeFirebaseUser = useCallback(

    async (fbUser: FirebaseUser, forzarRefresh: boolean) => {

      const token = await fbUser.getIdTokenResult(forzarRefresh);

      const rolClaim = token.claims.rol;

      if (!esRolValido(rolClaim)) {

        // Autenticado en Firebase, pero sin rol asignado todavía.

        setUsuario(null);

        setCuentaPendiente(true);

        return;

      }

      setUsuario({

        uid: fbUser.uid,

        nombre: fbUser.displayName ?? fbUser.email ?? "Sin nombre",

        rol: rolClaim,

      });

      setCuentaPendiente(false);

    },

    []

  );

  // Guarda de montaje: en móviles con poca RAM, un hard refresh puede
  // desmontar este provider mientras `getIdTokenResult` todavía está en
  // vuelo (la pestaña se descarta y se recrea a medio camino). Sin esta
  // guarda, el `then`/`catch` de esa promesa llega tarde y llama a
  // `setState` sobre un componente ya desmontado — eso por sí solo no
  // "revienta" la pestaña, pero sí es la clase de callback colgado que,
  // sumado a un listener de Firebase que se re-suscribe en cada render,
  // termina en el bucle de renders que sí la revienta. Aquí cortamos esa
  // cadena en la raíz: nunca tocamos el estado si ya nos desmontamos.
  const montadoRef = useRef(true);

  useEffect(() => {
    montadoRef.current = true;

    // onAuthStateChanged se suscribe UNA sola vez por montaje del
    // provider: el array de dependencias es [] (no
    // `[sincronizarDesdeFirebaseUser]`) para que ni siquiera un cambio de
    // identidad de esa función (que en teoría no debería ocurrir, al
    // estar memoizada con `useCallback(..., [])`, pero que sí puede
    // ocurrir en desarrollo con Fast Refresh) dispare una nueva
    // suscripción. Una nueva suscripción en cada render es exactamente
    // el patrón que produce el "Aw, Snap!" en dispositivos con poca RAM:
    // cada listener viejo queda vivo hasta que se desmonta, y si el
    // desmontaje no llega a tiempo (hard refresh a medio hidratar), se
    // acumulan listeners y callbacks async pendientes hasta agotar la
    // memoria de la pestaña.
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      if (!montadoRef.current) return;

      setError(null);

      if (!fbUser) {
        setUsuario(null);
        setCuentaPendiente(false);
        setCargando(false);
        return;
      }

      // La lectura de claims es async y separada del propio callback de
      // onAuthStateChanged a propósito: así el callback termina de
      // ejecutarse de inmediato (no queda una promesa "colgando" dentro
      // del listener de Firebase) y la única responsabilidad async que
      // sobrevive es esta, protegida por `montadoRef`.
      sincronizarDesdeFirebaseUser(fbUser, false)
        .catch((e) => {
          if (!montadoRef.current) return;
          console.error("Error al leer los permisos de la cuenta:", e);
          setError("No se pudo verificar tu cuenta. Intenta de nuevo.");
          setUsuario(null);
          setCuentaPendiente(false);
        })
        .finally(() => {
          if (!montadoRef.current) return;
          setCargando(false);
        });
    });

    return () => {
      montadoRef.current = false;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const iniciarSesionConGoogle = useCallback(async () => {
    setError(null);
    try {
      // Volvemos a signInWithPopup a propósito. El redirect fallaba en
      // móvil porque, al volver de accounts.google.com, el navegador
      // trata la cookie de sesión de Firebase (en el dominio de
      // Firebase/Google) como cookie de terceros respecto del dominio de
      // Vercel — Safari (ITP) y Chrome en modo incógnito/Android la
      // bloquean por defecto. Sin esa cookie, `getRedirectResult` nunca
      // encuentra el resultado pendiente y el usuario vuelve a caer en
      // el login: un rebote infinito. El popup evita el problema porque
      // toda la negociación con Google ocurre en una ventana/contexto
      // aparte que sí puede leer sus propias cookies de primera parte;
      // el resultado vuelve directo a esta promesa, sin depender de
      // cookies cruzadas ni de un segundo ciclo de carga de la página.
      const resultado = await signInWithPopup(auth, googleProvider);
      // No hace falta llamar a sincronizarDesdeFirebaseUser aquí: el
      // propio signInWithPopup dispara onAuthStateChanged, que ya se
      // encarga de leer los claims. Forzamos igual un refresh del token
      // (sin tocar el estado) por si el admin asignó el rol segundos
      // antes de este login y el token recién emitido todavía no lo
      // trae — así el listener de arriba, que corre justo después, ya
      // ve el claim actualizado en vez de tener que esperar otra ronda.
      if (resultado?.user) {
        await resultado.user.getIdToken(true);
      }
    } catch (e) {
      console.error("Error al iniciar sesión con Google:", e);
      const codigo = (e as { code?: string })?.code;
      if (codigo === "auth/popup-closed-by-user" || codigo === "auth/cancelled-popup-request") {
        // El usuario cerró el popup o lo canceló a propósito — no es un
        // error real del sistema, no mostramos mensaje de error.
        return;
      }
      if (codigo === "auth/popup-blocked") {
        setError(
          "Tu navegador bloqueó la ventana de Google. Habilita las ventanas emergentes para este sitio e intenta de nuevo."
        );
        return;
      }
      setError("No se pudo iniciar sesión con Google. Intenta de nuevo.");
    }
  }, []);

  const cerrarSesion = useCallback(async () => {

    setError(null);

    try {

      await signOut(auth);

    } catch (e) {

      console.error("Error al cerrar sesión:", e);

      setError("No se pudo cerrar la sesión. Intenta de nuevo.");

    }

  }, []);

  const recargarPermisos = useCallback(async () => {

    if (!auth.currentUser) return;

    setError(null);

    try {

      await sincronizarDesdeFirebaseUser(auth.currentUser, true);

    } catch (e) {

      console.error("Error al recargar permisos:", e);

      setError("No se pudieron recargar tus permisos. Intenta de nuevo.");

    }

  }, [sincronizarDesdeFirebaseUser]);

  return (

    <AuthContext.Provider

      value={{

        usuario,

        cargando,

        cuentaPendiente,

        error,

        iniciarSesionConGoogle,

        cerrarSesion,

        recargarPermisos,

      }}

    >

      {children}

    </AuthContext.Provider>

  );

}

// ─────────────────────────────────────────────────────────────

// Hook de consumo

// ─────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {

  const ctx = useContext(AuthContext);

  if (!ctx) {

    throw new Error("useAuth debe usarse dentro de un <AuthProvider>.");

  }

  return ctx;

}