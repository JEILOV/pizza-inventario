"use client";

import { Store } from "lucide-react";
import ZoneDashboard from "@/components/shared/ZoneDashboard";

interface SalonDashboardProps {
  onIrAlChecklist?: () => void;
}

export default function SalonDashboard({ onIrAlChecklist }: SalonDashboardProps) {
  return (
    <ZoneDashboard
      zona="salon"
      titulo="Salón — Panel del turno"
      nombreZona="salón"
      icono={<Store className="h-6 w-6 text-blue-700" strokeWidth={1.75} />}
      onIrAlChecklist={onIrAlChecklist}
    />
  );
}