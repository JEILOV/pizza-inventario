"use client";
import { useEffect, useState } from "react";
interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
export default function InstalarApp() {
  const [evento, setEvento] = useState<InstallEvent | null>(null);
  const [instalada, setInstalada] = useState(true);
  const [ayuda, setAyuda] = useState(false);
  const [sinConexion, setSinConexion] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const actualizar = () => setInstalada(media.matches || !!(navigator as Navigator & { standalone?: boolean }).standalone);
    const red = () => setSinConexion(!navigator.onLine);
    actualizar(); red();
    const preparar = (e: Event) => { e.preventDefault(); setEvento(e as InstallEvent); };
    const instalado = () => { setInstalada(true); setEvento(null); setAyuda(false); };
    window.addEventListener("beforeinstallprompt", preparar);
    window.addEventListener("appinstalled", instalado);
    window.addEventListener("online", red); window.addEventListener("offline", red);
    media.addEventListener("change", actualizar);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") navigator.serviceWorker.register("/sw.js").catch(() => { /* La web funciona sin caché offline. */ });
    return () => { window.removeEventListener("beforeinstallprompt", preparar); window.removeEventListener("appinstalled", instalado); window.removeEventListener("online", red); window.removeEventListener("offline", red); media.removeEventListener("change", actualizar); };
  }, []);
  async function instalar() {
    if (!evento) { setAyuda(!ayuda); return; }
    try { await evento.prompt(); await evento.userChoice; } catch { setAyuda(true); }
    setEvento(null);
  }
  return <>
    {sinConexion && <p role="status" className="bg-amber-100 p-3 text-center text-sm text-amber-950">Sin conexión. Conéctate para consultar datos actualizados y confirmar cambios.</p>}
    {!instalada && <aside className="border-b border-stone-200 bg-white px-4 py-2 text-stone-800">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2"><span className="text-sm">Pizza Republic en tu celular</span><button className="ops-secondary" onClick={instalar}>Instalar / agregar al inicio</button></div>
      {ayuda && <div className="mx-auto max-w-6xl py-3 text-sm leading-relaxed"><p><strong>Android:</strong> abre esta web en Chrome y busca «Instalar aplicación» o «Agregar a pantalla principal» en el menú ⋮.</p><p><strong>iPhone:</strong> abre esta web en Safari, toca Compartir y «Agregar a pantalla de inicio».</p><p>Si ya la instalaste, abre el ícono desde tu pantalla de inicio. Necesitas internet para trabajar con el inventario.</p><button className="mt-2 underline" onClick={() => setAyuda(false)}>Cerrar instrucciones</button></div>}
    </aside>}
  </>;
}
