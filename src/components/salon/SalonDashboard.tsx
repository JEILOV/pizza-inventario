"use client";

import { Store } from "lucide-react";
import ZoneDashboard from "@/components/shared/ZoneDashboard";

interface SalonDashboardProps {
  usuarioId: string;
  onIrAlChecklist?: () => void;
}

export default function SalonDashboard({ usuarioId, onIrAlChecklist }: SalonDashboardProps) {
  return (
    <ZoneDashboard
      zona="salon"
      titulo="Salón — Panel del turno"
      nombreZona="salón"
      usuarioId={usuarioId}
      icono={<Store className="h-6 w-6 text-blue-700" strokeWidth={1.75} />}
      onIrAlChecklist={onIrAlChecklist}
    />
  );
}