// Perfil autenticado con un rol activo en usuarios/{uid}.
export type RolUsuario = "admin" | "cocina" | "salon";

export interface Usuario {
  uid: string;
  nombre: string;
  rol: RolUsuario;
}