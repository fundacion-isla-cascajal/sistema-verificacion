"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import ProtectedRoute from "@/components/protected-route";
import { useEmpleados, DIAS_SEMANA, MODALIDADES, calcularResumenHorario, normalizarHorario } from "@/hooks/use-empleados";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  Briefcase,
  Monitor,
  CalendarDays,
  Save,
  RefreshCcw,
  ShieldAlert,
  Home,
  LogOut,
} from "lucide-react";

// ─── config visual por modalidad ─────────────────────────────────────────────

const MODALIDAD_CONFIG = {
  presencial: {
    label: "Presencial",
    color: "bg-success/15 text-success border-success/30",
    badge: "bg-success text-success-foreground",
    icon: Briefcase,
  },
  teletrabajo: {
    label: "Teletrabajo",
    color: "bg-primary/15 text-primary border-primary/30",
    badge: "bg-primary text-primary-foreground",
    icon: Monitor,
  },
  libre: {
    label: "Libre",
    color: "bg-muted text-muted-foreground border-border",
    badge: "bg-muted text-muted-foreground",
    icon: Home,
  },
};

const DIA_LABELS = {
  lunes: "Lun",
  martes: "Mar",
  miercoles: "Mié",
  jueves: "Jue",
  viernes: "Vie",
  sabado: "Sáb",
  domingo: "Dom",
};

// ─── componente tarjeta por empleado ─────────────────────────────────────────

function TarjetaEmpleado({ empleado, onGuardar }) {
  const [horario, setHorario] = useState(() =>
    normalizarHorario(empleado.horarioModalidad)
  );
  const [guardando, setGuardando] = useState(false);
  const resumen = calcularResumenHorario(horario);
  const tieneCambios = JSON.stringify(horario) !== JSON.stringify(normalizarHorario(empleado.horarioModalidad));

  const handleCambio = (dia, valor) => {
    setHorario((prev) => ({ ...prev, [dia]: valor }));
  };

  const handleGuardar = async () => {
    setGuardando(true);
    try {
      await onGuardar(empleado.id, horario);
      toast.success(`Programación de ${empleado.nombre} actualizada`);
    } catch (err) {
      console.error(err);
      toast.error("Error al guardar. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Card className={`transition-all duration-200 ${tieneCambios ? "border-primary/40 shadow-md" : ""}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold leading-tight">
                {empleado.nombre || "Sin nombre"}
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {empleado.cargo || "Sin cargo"} {empleado.email ? `· ${empleado.email}` : ""}
              </CardDescription>
            </div>
          </div>
          {/* Badge resumen */}
          <div className="flex gap-1.5 flex-wrap justify-end">
            {resumen.presencial > 0 && (
              <Badge className="text-xs bg-success/15 text-success border border-success/30 font-medium">
                <Briefcase className="h-2.5 w-2.5 mr-1" />
                {resumen.presencial}d pres.
              </Badge>
            )}
            {resumen.teletrabajo > 0 && (
              <Badge className="text-xs bg-primary/15 text-primary border border-primary/30 font-medium">
                <Monitor className="h-2.5 w-2.5 mr-1" />
                {resumen.teletrabajo}d TT
              </Badge>
            )}
            {resumen.libre > 0 && (
              <Badge className="text-xs bg-muted text-muted-foreground border font-medium">
                <Home className="h-2.5 w-2.5 mr-1" />
                {resumen.libre}d libre
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Matriz de días */}
        <div className="grid grid-cols-7 gap-1.5">
          {DIAS_SEMANA.map((dia) => {
            const modalidad = horario[dia];
            const cfg = MODALIDAD_CONFIG[modalidad] || MODALIDAD_CONFIG.libre;
            return (
              <div key={dia} className="flex flex-col gap-1">
                <span className="text-xs font-medium text-center text-muted-foreground">
                  {DIA_LABELS[dia]}
                </span>
                <Select value={modalidad} onValueChange={(v) => handleCambio(dia, v)}>
                  <SelectTrigger
                    className={`h-8 text-xs px-1.5 border ${cfg.color} font-medium`}
                    title={`${DIA_LABELS[dia]}: ${cfg.label}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODALIDADES.map((m) => {
                      const mc = MODALIDAD_CONFIG[m];
                      const Ic = mc.icon;
                      return (
                        <SelectItem key={m} value={m} className="text-xs">
                          <span className="flex items-center gap-1.5">
                            <Ic className="h-3 w-3" />
                            {mc.label}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>

        {/* Botón guardar */}
        <div className="flex justify-end pt-1">
          <Button
            size="sm"
            onClick={handleGuardar}
            disabled={guardando || !tieneCambios}
            className="gap-2"
          >
            {guardando ? (
              <Spinner className="h-3.5 w-3.5" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {guardando ? "Guardando…" : "Guardar Programación"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── página principal ─────────────────────────────────────────────────────────

function ModalidadLaboralContent() {
  const { user, userData, loading: authLoading, logout } = useAuth();
  const { empleados, isLoading, error, recargar, actualizarModalidad } = useEmpleados();
  const [busqueda, setBusqueda] = useState("");

  const esSuperAdmin = userData?.rol === "superadmin";

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <Spinner className="h-10 w-10 text-primary" />
        <p className="text-sm text-muted-foreground">Cargando programación laboral…</p>
      </div>
    );
  }

  if (!user) return null;

  if (!esSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-sm w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
              <ShieldAlert className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-lg font-semibold">Acceso denegado</h2>
            <p className="text-sm text-muted-foreground">
              Esta sección es exclusiva para administradores del sistema.
            </p>
            <Button asChild variant="outline" className="mt-2">
              <Link href="/dashboard">Volver al Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const empleadosFiltrados = empleados.filter((e) => {
    if (!busqueda.trim()) return true;
    const t = busqueda.toLowerCase();
    return (
      e.nombre?.toLowerCase().includes(t) ||
      e.cargo?.toLowerCase().includes(t) ||
      e.email?.toLowerCase().includes(t)
    );
  });

  return (
    <div className="min-h-screen bg-background">
      {/* ── header ─────────────────────────────────────────────────────────── */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <Image src="/logo.png" alt="Logo" width={36} height={36} className="rounded-full" />
            <div>
              <h1 className="font-semibold text-foreground text-sm leading-tight">
                Gestión de Modalidad Laboral
              </h1>
              <p className="text-xs text-muted-foreground">Fundación Isla Cascajal</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={recargar} title="Recargar">
              <RefreshCcw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4 mr-2" />
              Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-5xl">

        {/* ── intro ──────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <CalendarDays className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Programación Semanal</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Asigna la modalidad de trabajo para cada día de la semana por empleado.
            El módulo de asistencia impone automáticamente esta configuración.
          </p>
        </div>

        {/* ── leyenda ─────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-3 mb-6">
          {Object.entries(MODALIDAD_CONFIG).map(([key, cfg]) => {
            const Icon = cfg.icon;
            return (
              <div
                key={key}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${cfg.color}`}
              >
                <Icon className="h-3.5 w-3.5" />
                {cfg.label}
              </div>
            );
          })}
        </div>

        {/* ── búsqueda ────────────────────────────────────────────────────── */}
        <div className="relative mb-6 max-w-sm">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar empleado, cargo o email…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full border rounded-lg pl-10 pr-4 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* ── error ───────────────────────────────────────────────────────── */}
        {error && (
          <Card className="border-destructive/30 bg-destructive/5 mb-4">
            <CardContent className="pt-4 pb-4 text-sm text-destructive">
              Error al cargar empleados: {error}
            </CardContent>
          </Card>
        )}

        {/* ── lista ───────────────────────────────────────────────────────── */}
        {empleadosFiltrados.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <CalendarDays className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-sm text-muted-foreground">
                {busqueda ? "No se encontraron empleados con ese criterio." : "No hay empleados registrados."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {empleadosFiltrados.length} empleado{empleadosFiltrados.length !== 1 ? "s" : ""} encontrado{empleadosFiltrados.length !== 1 ? "s" : ""}
            </p>
            {empleadosFiltrados.map((empleado) => (
              <TarjetaEmpleado
                key={empleado.id}
                empleado={empleado}
                onGuardar={actualizarModalidad}
              />
            ))}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground py-8">
          Fundación Isla Cascajal · Gestión de Modalidad Laboral
        </p>
      </main>
    </div>
  );
}

export default function ModalidadLaboralPage() {
  return (
    <ProtectedRoute allowedRoles={["superadmin"]}>
      <ModalidadLaboralContent />
    </ProtectedRoute>
  );
}
