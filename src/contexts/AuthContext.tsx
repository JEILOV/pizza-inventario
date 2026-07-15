"use client";



import {

  createContext,

  useContext,

  useEffect,

  useState,

  useCallback,

  type ReactNode,

} from "react";

import {

  onAuthStateChanged,

  signInWithRedirect,

  getRedirectResult,

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



  useEffect(() => {

    let cancelado = false;



    // Recoge el resultado de un signInWithRedirect que recién volvió de

    // Google (navegación completa, no popup — ver `iniciarSesionConGoogle`

    // más abajo para el porqué). Se corre en paralelo al listener de

    // abajo: `onAuthStateChanged` es la fuente de verdad para apagar

    // `cargando`, esto solo hace el refresh forzado del token cuando

    // corresponde (mismo caso que antes: el admin pudo haber creado el

    // rol segundos antes de este primer login).

    getRedirectResult(auth)

      .then(async (resultado) => {

        if (cancelado || !resultado?.user) return;

        try {

          await sincronizarDesdeFirebaseUser(resultado.user, true);

        } catch (e) {

          console.error("Error al leer los permisos tras el login con Google:", e);

        }

      })

      .catch((e) => {

        if (cancelado) return;

        console.error("Error al completar el login con Google:", e);

        setError("No se pudo completar el inicio de sesión con Google. Intenta de nuevo.");

      });



    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {

      setError(null);



      if (!fbUser) {

        setUsuario(null);

        setCuentaPendiente(false);

        setCargando(false);

        return;

      }



      try {

        // No forzamos refresh en el listener normal — el refresh forzado

        // de un login recién hecho lo maneja `getRedirectResult` arriba.

        await sincronizarDesdeFirebaseUser(fbUser, false);

      } catch (e) {

        console.error("Error al leer los permisos de la cuenta:", e);

        setError("No se pudo verificar tu cuenta. Intenta de nuevo.");

        setUsuario(null);

        setCuentaPendiente(false);

      } finally {

        setCargando(false);

      }

    });



    return () => {

      cancelado = true;

      unsubscribe();

    };

  }, [sincronizarDesdeFirebaseUser]);



  const iniciarSesionConGoogle = useCallback(async () => {

    setError(null);

    try {

      // signInWithRedirect en vez de signInWithPopup: en navegadores

      // móviles el popup es poco confiable (bloqueo de terceros,

      // storage partitioning, el propio bloqueador de pop-ups) y deja

      // la sesión a medio resolver — el resultado es justamente una

      // pantalla en blanco/rota justo después de tocar "Continuar con

      // Google", que a veces "aparece" recién tras varios refresh.

      // El redirect es una navegación completa, sin esa fragilidad.

      // El resultado se procesa en el useEffect de arriba, con

      // getRedirectResult, al volver de Google.

      await signInWithRedirect(auth, googleProvider);

    } catch (e) {

      console.error("Error al iniciar sesión con Google:", e);

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

