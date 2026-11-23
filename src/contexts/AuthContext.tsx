"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { doc, onSnapshot, runTransaction, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase";
import type { Usuario, RolUsuario } from "@/types/usuario";
interface AuthState {
  usuario: Usuario | null; cargando: boolean; cuentaPendiente: boolean;
  cuentaDesactivada: boolean; nombreCuenta: string; error: string | null;
  iniciarSesionConGoogle: () => Promise<void>; cerrarSesion: () => Promise<void>;
  recargarPermisos: () => Promise<void>;
}
const AuthContext = createContext<AuthState | null>(null);
const roles: readonly string[] = ["admin", "cocina", "salon"];
export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [cuentaPendiente, setPendiente] = useState(false);
  const [cuentaDesactivada, setDesactivada] = useState(false);
  const [nombreCuenta, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    let vigente = true;
    let generacion = 0;
    let detenerPerfil: (() => void) | undefined;
    const detenerAuth = onAuthStateChanged(auth, async (persona) => {
      const actual = ++generacion;
      detenerPerfil?.(); setUsuario(null); setPendiente(false); setDesactivada(false); setError(null);
      setNombre(persona?.displayName ?? persona?.email ?? "");
      if (!persona) { setCargando(false); return; }
      setCargando(true);
      const ref = doc(db, "usuarios", persona.uid);
      try {
        // Nunca reemplazar un perfil existente, sus permisos o su estado.
        await runTransaction(db, async (tx) => {
          const perfil = await tx.get(ref);
          if (!perfil.exists()) tx.set(ref, {
            nombre: persona.displayName ?? "Nuevo integrante", email: persona.email ?? "",
            rol: null, activo: true, creadoEn: serverTimestamp(),
          });
        });
        if (!vigente || actual !== generacion) return;
        detenerPerfil = onSnapshot(ref, (snap) => {
          if (!vigente || actual !== generacion) return;
          setError(null);
          const data = snap.data();
          const activo = !!data && data.activo !== false;
          const rol = data?.rol;
          setDesactivada(!!data && !activo); setPendiente(!activo || !roles.includes(rol));
          setUsuario(activo && roles.includes(rol) ? {
            uid: persona.uid, nombre: data?.nombre || persona.displayName || "Integrante", rol: rol as RolUsuario,
          } : null);
          setCargando(false);
        }, () => {
          if (!vigente || actual !== generacion) return;
          setUsuario(null); setPendiente(true); setCargando(false);
          setError("No se pudieron leer tus permisos. Revisa tu conexión y vuelve a intentar.");
        });
      } catch {
        if (!vigente || actual !== generacion) return;
        setPendiente(true); setCargando(false);
        setError("No se pudo registrar tu acceso. Revisa la conexión o contacta al administrador.");
      }
    });
    return () => { vigente = false; generacion++; detenerPerfil?.(); detenerAuth(); };
  }, [intento]);
  async function iniciarSesionConGoogle() {
    setError(null);
    try { await signInWithPopup(auth, googleProvider); }
    catch (e) {
      const codigo = (e as { code?: string }).code;
      if (codigo === "auth/popup-closed-by-user" || codigo === "auth/cancelled-popup-request") return;
      setError(codigo === "auth/popup-blocked" ? "Permite las ventanas emergentes para iniciar con Google." : "No se pudo iniciar sesión. Intenta de nuevo.");
    }
  }
  async function cerrarSesion() {
    try { await signOut(auth); } catch { setError("No se pudo cerrar la sesión. Intenta de nuevo."); }
  }
  async function recargarPermisos() { setIntento((n) => n + 1); }
  return <AuthContext.Provider value={{ usuario, cargando, cuentaPendiente, cuentaDesactivada, nombreCuenta, error, iniciarSesionConGoogle, cerrarSesion, recargarPermisos }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth requiere AuthProvider");
  return ctx;
}
