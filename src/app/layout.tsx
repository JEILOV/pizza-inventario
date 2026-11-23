import InstalarApp from "@/components/shared/InstalarApp";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/contexts/AuthContext";
import { InsumosProvider } from "@/contexts/InsumosContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pizza Republic · Operación",
  applicationName: "Pizza Republic",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Pizza Republic" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  description: "Inventario, compras, preparación y turnos de Pizza Republic.",
  // "other" es el escape hatch de la Metadata API de Next para metas
  // arbitrarios que no tienen un campo dedicado (como "description" o
  // "openGraph"). Esto renderiza <meta name="google" content="notranslate" />
  // en el <head>, que es la señal que Google Translate / el traductor
  // integrado de Chrome respeta para NO ofrecer ni forzar la traducción
  // de la página.
  other: {
    google: "notranslate",
  },
};

export const viewport: Viewport = { themeColor: "#006654", width: "device-width", initialScale: 1 };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // lang="es": la página es en español, así que el traductor ya no
    // tiene un "idioma detectado ≠ idioma declarado" que lo dispare
    // automáticamente. translate="no" es el atributo estándar (soportado
    // por Chrome y Google Translate) que le dice explícitamente al
    // traductor que no toque el DOM de esta página. Ambos + el meta tag
    // de arriba son necesarios en conjunto: cada uno cubre un mecanismo
    // distinto (heurística de idioma, atributo por elemento, y meta a
    // nivel de documento) por el que el traductor se pudo haber
    // activado en Chrome Android.
    <html
      lang="es"
      translate="no"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <InstalarApp />
        <AuthProvider>
          <InsumosProvider>{children}</InsumosProvider>
        </AuthProvider>
      </body>
    </html>
  );
}