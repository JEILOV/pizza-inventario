import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/", name: "Pizza Republic · Operación", short_name: "Pizza Republic",
    description: "Inventario, preparación y turnos de Pizza Republic.",
    lang: "es-PE", start_url: "/", scope: "/", display: "standalone",
    background_color: "#ffffff", theme_color: "#006654",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
