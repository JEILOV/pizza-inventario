"use client";
import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type { RolUsuario } from "@/types/usuario";

interface Persona { id: string; nombre: string; email: string; rol: RolUsuario | null; activo: boolean }
export default function PersonalPanel() {
  const { usuario } = useAuth();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  useEffect(() => onSnapshot(collection(db, "usuarios"), (snap) => {
    setPersonas(snap.docs.map((d) => ({ id: d.id, nombre: d.data().nombre || "Sin nombre", email: d.data().email || "", rol: d.data().rol ?? null, activo: d.data().activo !== false })).sort((a, b) => Number(!!a.rol) - Number(!!b.rol) || a.nombre.localeCompare(b.nombre)));
    setCargando(false);
  }, () => { setError("No se pudo cargar el personal."); setCargando(false); }), []);
  async function cambiar(p: Persona, cambios: Partial<Pick<Persona, "rol" | "activo">>) {
    if (p.id === usuario?.uid) return;
    setOcupado(p.id); setError("");
    try { await updateDoc(doc(db, "usuarios", p.id), { ...cambios, actualizadoEn: serverTimestamp() }); }
    catch { setError("No se pudo guardar el cambio. Intenta de nuevo."); }
    finally { setOcupado(null); }
  }
  return <section className="ops-page">
    <h1 className="ops-title">Personal</h1>
    <p className="ops-muted">Los nuevos integrantes aparecen al entrar con Google. Asigna su área aquí; el acceso se actualiza automáticamente.</p>
    {error && <p role="alert" className="ops-error">{error}</p>}
    {cargando && <p>Cargando personal…</p>}
    <div className="mt-5 grid gap-3">
      {personas.map((p) => <article key={p.id} className="ops-card flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0"><h2 className="font-semibold">{p.nombre} {p.id === usuario?.uid && "(tú)"}</h2><p className="ops-muted break-all">{p.email}</p><p className="text-sm">{!p.activo ? "Acceso desactivado" : !p.rol ? "Nuevo · asignar área" : "Acceso activo"}</p></div>
        <div className="flex flex-wrap gap-2">
          <label className="text-sm">Rol<select aria-label={`Rol de ${p.nombre}`} className="ops-input" disabled={!!ocupado || p.id === usuario?.uid} value={p.rol ?? ""} onChange={(e) => cambiar(p, { rol: (e.target.value || null) as Persona["rol"] })}><option value="">Sin asignar</option><option value="cocina">Cocina</option><option value="salon">Salón</option><option value="admin">Administrador</option></select></label>
          <button className="ops-secondary self-end" disabled={!!ocupado || p.id === usuario?.uid} onClick={() => cambiar(p, { activo: !p.activo })}>{ocupado === p.id ? "Guardando…" : p.activo ? "Desactivar" : "Reactivar"}</button>
        </div>
      </article>)}
    </div>
    <p className="ops-muted mt-4">Al desactivar a una persona se conserva su historial. Tu propia cuenta se mantiene activa para evitar perder el acceso administrativo.</p>
  </section>;
}
