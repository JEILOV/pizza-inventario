"use client";

import { ChefHat } from "lucide-react";
import ZoneDashboard from "@/components/shared/ZoneDashboard";

interface KitchenDashboardProps {
  usuarioId: string;
  onIrAlChecklist?: () => void;
}

export default function KitchenDashboard({ usuarioId, onIrAlChecklist }: KitchenDashboardProps) {
  return (
    <ZoneDashboard
      zona="cocina"
      titulo="Cocina — Panel del turno"
      nombreZona="cocina"
      usuarioId={usuarioId}
      icono={<ChefHat className="h-6 w-6 text-orange-700" strokeWidth={1.75} />}
      onIrAlChecklist={onIrAlChecklist}
    />
  );
}