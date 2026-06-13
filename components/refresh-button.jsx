"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export default function RefreshButton() {
  const pathname = usePathname();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Ocultar botón en pantallas específicas para evitar distracciones
  if (
    pathname?.startsWith('/registro') ||
    pathname?.startsWith('/afiliado') ||
    pathname?.startsWith('/login')
  ) {
    return null;
  }

  const handleRefresh = () => {
    setIsRefreshing(true);
    // Realizamos un reload completo de la página después de una breve animación para dar feedback visual
    setTimeout(() => {
      window.location.reload();
    }, 600);
  };

  return (
    <button
      onClick={handleRefresh}
      disabled={isRefreshing}
      aria-label="Refrescar página"
      title="Refrescar página"
      className={cn(
        "fixed bottom-24 right-6 z-50 flex items-center justify-center h-12 w-12 rounded-full",
        "bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50",
        "shadow-lg hover:shadow-xl hover:bg-white dark:hover:bg-slate-900",
        "text-slate-700 dark:text-slate-200 transition-all duration-300 ease-in-out cursor-pointer",
        "hover:scale-110 active:scale-95 disabled:pointer-events-none",
        "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      )}
    >
      <RefreshCw
        className={cn(
          "h-5 w-5 transition-transform duration-500 ease-out",
          isRefreshing ? "animate-spin text-primary" : "hover:rotate-45"
        )}
      />
    </button>
  );
}
