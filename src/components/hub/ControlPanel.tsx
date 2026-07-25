import AdminInsumosCRUD from "@/components/admin/AdminInsumosCRUD";
import BuzonNotas from "@/components/admin/BuzonNotas";
import KitchenDashboard from "@/components/cocina/KitchenDashboard";
import SalonDashboard from "@/components/salon/SalonDashboard";
import ShiftCloseChecklist from "@/components/salon/ShiftCloseChecklist";
import type { VistaId } from "@/components/hub/tipos";

interface ControlPanelProps {
  vista: VistaId;
  usuarioId: string;
  onIrACierreCocina: () => void;
  onIrACierreSalon: () => void;
}

/**
 * Cuerpo del Hub: qué vista mostrar según `vista`. Sigue siendo montaje
 * condicional (cada vista se desmonta al salir de ella) — eso es
 * intencional para el DOM y el estado local de UI, y ya no es un
 * problema de lecturas porque los datos de Firestore que consume cada
 * vista vienen de InsumosProvider/AuthProvider, montados arriba en el
 * layout raíz, no de listeners propios de estos componentes.
 */
export default function ControlPanel({
  vista,
  usuarioId,
  onIrACierreCocina,
  onIrACierreSalon,
}: ControlPanelProps) {
  switch (vista) {
    case "insumos":
      return <AdminInsumosCRUD />;
    case "cocina-dashboard":
      return <KitchenDashboard usuarioId={usuarioId} onIrAlChecklist={onIrACierreCocina} />;
    case "cocina-cierre":
      return <ShiftCloseChecklist zona="cocina" usuarioId={usuarioId} />;
    case "salon-dashboard":
      return <SalonDashboard usuarioId={usuarioId} onIrAlChecklist={onIrACierreSalon} />;
    case "salon-cierre":
      return <ShiftCloseChecklist zona="salon" usuarioId={usuarioId} />;
    case "notas":
      return <BuzonNotas />;
  }
}
