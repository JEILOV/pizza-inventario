import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";

// Variables NEXT_PUBLIC_* — van en .env.local y en las variables de
// entorno del proyecto en Vercel. Son públicas por diseño (el SDK cliente
// de Firebase siempre las expone); la seguridad real la dan las
// Security Rules de Firestore, no ocultar estas claves.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// getApps().length evita "Firebase App named '[DEFAULT]' already exists"
// durante hot-reload en desarrollo o renders repetidos en el servidor.
const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db: Firestore = getFirestore(app);
export const auth: Auth = getAuth(app);

// Instancia única del proveedor de Google — se reutiliza en cada login,
// no hace falta (ni conviene) crear una nueva en cada click.
export const googleProvider = new GoogleAuthProvider();

export default app;