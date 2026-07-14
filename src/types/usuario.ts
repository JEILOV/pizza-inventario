// Refleja el futuro documento `usuarios/{uid}` de Firestore. Por ahora se
// usa solo para el selector de rol simulado en page.tsx — cuando conectemos
// Firebase Auth, este mismo tipo describirá lo que devuelve el hook de
// sesión real (uid vendrá de auth.currentUser.uid).

export type RolUsuario = "admin" | "cocina" | "salon";

export interface Usuario {
  uid: string;
  nombre: string;
  rol: RolUsuario;
}