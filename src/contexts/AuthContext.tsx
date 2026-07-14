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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setError(null);

      if (!fbUser) {
        setUsuario(null);
        setCuentaPendiente(false);
        setCargando(false);
        return;
      }

      try {
        // No forzamos refresh en el listener normal — solo al iniciar
        // sesión recién (más abajo) y en `recargarPermisos` explícito.
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

    return () => unsubscribe();
  }, [sincronizarDesdeFirebaseUser]);

  const iniciarSesionConGoogle = useCallback(async () => {
    setError(null);
    try {
      const credencial = await signInWithPopup(auth, googleProvider);
      // Forzamos refresh aquí: si es la primera vez que esta persona
      // entra, el admin pudo haber creado su `usuarios/{uid}` apenas
      // segundos antes, y el token que Firebase entrega en el propio
      // signInWithPopup podría no traer el claim todavía.
      await sincronizarDesdeFirebaseUser(credencial.user, true);
    } catch (e) {
      console.error("Error al iniciar sesión con Google:", e);
      setError("No se pudo iniciar sesión con Google. Intenta de nuevo.");
    }
  }, [sincronizarDesdeFirebaseUser]);

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