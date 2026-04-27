"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useDocumentos } from "@/hooks/use-documentos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Empty } from "@/components/ui/empty";
import { toast } from "sonner";
import {
  Plus,
  Search,
  FileSpreadsheet,
  GraduationCap,
  Users,
  LogOut,
  Trash2,
  QrCode,
  User,
  FileText,
  ToggleLeft,
  ToggleRight,
  Info,
  IdCard,
  Calendar as CalendarIcon,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

const VERIFICACION_BASE_URL = "https://sistema-verificacion.vercel.app/verificar?doc=";

const { user, userData, empleadoData, empleadoId, loading } = useAuth();

console.log("USER AUTH:", user);
console.log("USER DATA:", userData);
console.log("EMPLEADO DATA:", empleadoData);
console.log("EMPLEADO ID:", empleadoId);

// Función auxiliar para dar formato legible a la fecha (por ejemplo: "22 oct 2023, 14:30")
function formatearFecha(fecha) {
  if (!fecha) return "-";
  return new Date(fecha).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Función encargada de exportar la información actual a un archivo CSV (Excel)
function exportarCSV(lista, nombre) {
  if (lista.length === 0) {
    toast.error("No hay datos para exportar");
    return;
  }
  const encabezados = ["Código", "Nombre", "NUIP", "Tipo", "Detalle", "Estado", "Fecha"];
  const filas = lista.map((item) => {
    let detalle = "Miembro";
    if (item.tipo === "certificado") {
      detalle = item.evento ? `${item.evento} ${item.descripcion ? `(${item.descripcion})` : ''}` : (item.descripcion || "Evento");
    } else if (item.tipo === "documento") {
      detalle = item.descripcion || "General";
    }
    return [item.codigo, item.nombre, item.cedula || "", item.tipo, detalle, item.estado, formatearFecha(item.fecha)];
  });
  const csv = [encabezados, ...filas].map((fila) => fila.map((valor) => `"${valor}"`).join(" ;")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${nombre}.csv`;
  link.click();
  toast.success(`Exportado: ${nombre}.csv`);
}

// Función asíncrona para generar un código QR con el mismo estilo que /generar y descargarlo como PNG
async function descargarQR(docObj) {
  const codigo = typeof docObj === "string" ? docObj : docObj.codigo;
  const link = VERIFICACION_BASE_URL + codigo;
  try {
    const QRCode = (await import("qrcode")).default;
    const qrDataUrl = await QRCode.toDataURL(link, {
      width: 400,
      margin: 2,
      color: {
        dark: "#1e3a5f",
        light: "#ffffff",
      },
    });
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `QR_${codigo}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("QR descargado");
  } catch {
    toast.error("Error al descargar QR");
  }
}

// Componente Principal: Vista del panel de administración (Dashboard)
export default function DashboardPage() {
  // Extraemos variables de autenticación y métodos del custom hook (useAuth y useDocumentos)
  const { user, loading: authLoading, logout } = useAuth();
  const { documentos, isLoading, eliminarDocumento, actualizarEstado } = useDocumentos();

  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [codigoAEliminar, setCodigoAEliminar] = useState(null);
  const [infoDoc, setInfoDoc] = useState(null);
  const [confirmarInactivacion, setConfirmarInactivacion] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [reactivarDoc, setReactivarDoc] = useState(null);
  const [duracionReactivacion, setDuracionReactivacion] = useState("6_meses");
  const [periodosExpandidos, setPeriodosExpandidos] = useState({});

  // Hook useMemo para filtrar documentos de acuerdo a las opciones de búsqueda y tipo seleccionadas. 
  // Esto previene que se re-genere si cambian otras cosas.
  const documentosFiltrados = useMemo(() => {
    let resultado = documentos;
    if (busqueda) {
      const termino = busqueda.toLowerCase();
      resultado = resultado.filter(
        (d) =>
          d.nombre?.toLowerCase().includes(termino) ||
          d.codigo.toLowerCase().includes(termino) ||
          d.cedula?.toLowerCase().includes(termino)
      );
    }
    if (filtroTipo !== "todos") {
      resultado = resultado.filter((d) => d.tipo === filtroTipo);
    }
    return resultado;
  }, [documentos, busqueda, filtroTipo]);

  // useMemo para calcular las estadísticas globales (total, cantidad de certificados, etc.)
  const stats = useMemo(() => {
    const certificados = documentos.filter((d) => d.tipo === "certificado").length;
    const afiliados = documentos.filter((d) => d.tipo === "afiliado").length;
    const documentosGenerales = documentos.filter((d) => d.tipo === "documento").length;
    return { total: documentos.length, certificados, afiliados, documentosGenerales };
  }, [documentos]);

  // Lista de fechas de expiración para marcar en el calendario
  const expirationDates = useMemo(() => {
    return documentos
      .filter((d) => d.tipo === "afiliado" && d.fechaExpiracion)
      .map((d) => new Date(d.fechaExpiracion));
  }, [documentos]);

  // Afiliados que expiran en el día seleccionado del calendario
  const expirandoEnDiaSeleccionado = useMemo(() => {
    if (!selectedDate) return [];
    return documentos.filter((d) => {
      if (d.tipo !== "afiliado" || !d.fechaExpiracion) return false;
      const fecha = new Date(d.fechaExpiracion);
      return (
        fecha.getDate() === selectedDate.getDate() &&
        fecha.getMonth() === selectedDate.getMonth() &&
        fecha.getFullYear() === selectedDate.getFullYear()
      );
    });
  }, [documentos, selectedDate]);

  // Elimina un documento seleccionado y resetea la variable de "codigoAEliminar"
  const handleEliminar = async () => {
    if (!codigoAEliminar) return;
    try {
      await eliminarDocumento(codigoAEliminar);
      toast.success("Documento eliminado");
    } catch {
      toast.error("Error al eliminar");
    } finally {
      setCodigoAEliminar(null);
    }
  };

  // Reactivar directamente (sin confirmación). Desactivar requiere confirmación.
  const handleToggleEstado = async (codigo, estadoActual) => {
    if (estadoActual === "activo") return; // desactivar va por confirmación
    setUpdatingStatus(codigo);
    try {
      await actualizarEstado(codigo, "activo", { desactivadoManualmente: null, fechaDesactivacion: null });
      toast.success("Afiliado activado");
    } catch {
      toast.error("Error al cambiar estado");
    } finally {
      setUpdatingStatus(null);
    }
  };

  // Confirmar inactivación manual: guarda metadatos adicionales en Firestore
  const handleConfirmarInactivar = async () => {
    if (!confirmarInactivacion) return;
    setUpdatingStatus(confirmarInactivacion.codigo);
    try {
      await actualizarEstado(confirmarInactivacion.codigo, "inactivo", {
        desactivadoManualmente: true,
        fechaDesactivacion: new Date().toISOString(),
      });
      toast.success("Afiliado desactivado manualmente");
    } catch {
      toast.error("Error al desactivar");
    } finally {
      setUpdatingStatus(null);
      setConfirmarInactivacion(null);
    }
  };

  // Reactivar afiliado vencido: archiva el periodo anterior y crea uno nuevo
  const handleReactivar = async () => {
    if (!reactivarDoc || !duracionReactivacion) return;
    setUpdatingStatus(reactivarDoc.codigo);
    try {
      const ahora = new Date();
      const nuevaExpiracion = new Date(ahora);
      if (duracionReactivacion === "6_meses") {
        nuevaExpiracion.setMonth(nuevaExpiracion.getMonth() + 6);
      } else {
        nuevaExpiracion.setFullYear(nuevaExpiracion.getFullYear() + 1);
      }
      // Construir el periodo anterior para agregar al historial
      const periodoAnterior = {
        inicio: reactivarDoc.fechaInicioPeriodo || reactivarDoc.fecha,
        fin: reactivarDoc.fechaExpiracion,
        duracion: reactivarDoc.duracion,
        tipo: (reactivarDoc.periodos?.length ?? 0) === 0 ? "registro" : "renovacion",
      };
      const periodosAnteriores = Array.isArray(reactivarDoc.periodos)
        ? [...reactivarDoc.periodos, periodoAnterior]
        : [periodoAnterior];
      await actualizarEstado(reactivarDoc.codigo, "activo", {
        duracion: duracionReactivacion,
        fechaExpiracion: nuevaExpiracion.toISOString(),
        fechaInicioPeriodo: ahora.toISOString(),
        desactivadoManualmente: null,
        fechaDesactivacion: null,
        periodos: periodosAnteriores,
      });
      toast.success("Afiliado reactivado exitosamente");
    } catch {
      toast.error("Error al reactivar el afiliado");
    } finally {
      setUpdatingStatus(null);
      setReactivarDoc(null);
      setDuracionReactivacion("6_meses");
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Logo" width={40} height={40} className="rounded-full" />
            <div>
              <h1 className="font-semibold text-foreground">Panel de Control</h1>
              <p className="text-xs text-muted-foreground">Fundación Isla Cascajal</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">{user.displayName || user.email}</span>
            </div>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4 mr-2" />
              Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Documentos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{stats.total}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Certificados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-success" />
                <span className="text-2xl font-bold">{stats.certificados}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Afiliados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-info" />
                <span className="text-2xl font-bold">{stats.afiliados}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Documentos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{stats.documentosGenerales}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions & Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col lg:flex-row gap-4 justify-between">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => exportarCSV(documentos, "todos")}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Todos
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-success border-success/30 hover:bg-success/10"
                  onClick={() => exportarCSV(documentos.filter((d) => d.tipo === "certificado"), "certificados")}
                >
                  <GraduationCap className="h-4 w-4 mr-2" />
                  Certificados
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-info border-info/30 hover:bg-info/10"
                  onClick={() => exportarCSV(documentos.filter((d) => d.tipo === "afiliado"), "afiliados")}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Afiliados
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-primary border-primary/30 hover:bg-primary/10"
                  onClick={() => exportarCSV(documentos.filter((d) => d.tipo === "documento"), "documentos_generales")}
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Documentos
                </Button>
              </div>

              <div className="flex flex-1 gap-3 max-w-xl">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre, código o NUIP..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={filtroTipo} onValueChange={(value) => setFiltroTipo(value)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="certificado">Certificados</SelectItem>
                    <SelectItem value="afiliado">Afiliados</SelectItem>
                    <SelectItem value="documento">Documentos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowCalendar(true)}>
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Calendario</span>
                </Button>
                <Button asChild>
                  <Link href="/generar">
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner className="h-8 w-8" />
              </div>
            ) : documentosFiltrados.length === 0 ? (
              <Empty
                title="Sin documentos"
                description={
                  busqueda || filtroTipo !== "todos"
                    ? "No se encontraron documentos con los filtros aplicados"
                    : "Aún no hay documentos registrados"
                }
                className="py-12"
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Código</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead className="hidden md:table-cell">NUIP</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="hidden lg:table-cell">Detalle</TableHead>
                      <TableHead className="hidden sm:table-cell">Estado</TableHead>
                      <TableHead className="hidden xl:table-cell">Fecha</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documentosFiltrados.map((doc) => {
                      const isExpired = doc.tipo === "afiliado" && doc.fechaExpiracion && new Date() > new Date(doc.fechaExpiracion);
                      const esActivo = doc.estado === "activo" && !isExpired;
                      const cargando = updatingStatus === doc.codigo;

                      return (
                        <TableRow key={doc.codigo}>
                          <TableCell className="font-mono text-sm">{doc.codigo}</TableCell>
                          <TableCell className="font-medium">{doc.nombre}</TableCell>
                          <TableCell className="hidden md:table-cell">{doc.cedula || "-"}</TableCell>
                          <TableCell>
                            <Badge
                              variant={doc.tipo === "certificado" ? "default" : doc.tipo === "documento" ? "outline" : "secondary"}
                              className={
                                doc.tipo === "certificado"
                                  ? "bg-success/10 text-success border-success/20"
                                  : doc.tipo === "documento"
                                    ? "bg-primary/10 text-primary border-primary/20"
                                    : "bg-info/10 text-info border-info/20"
                              }
                            >
                              {doc.tipo === "certificado" ? "Certificado" : doc.tipo === "documento" ? "Documento" : "Afiliado"}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {doc.tipo === "certificado" ? (doc.evento ? `${doc.evento} ${doc.descripcion ? `(${doc.descripcion})` : ''}` : doc.descripcion || "Evento") : doc.tipo === "documento" ? doc.descripcion || "General" : "Miembro"}
                          </TableCell>

                          {/* ESTADO — toggle con confirmación para desactivar */}
                          <TableCell className="hidden sm:table-cell">
                            {doc.tipo === "afiliado" ? (
                              <button
                                onClick={() => {
                                  if (isExpired) {
                                    setReactivarDoc(doc);
                                    setDuracionReactivacion("6_meses");
                                  } else if (esActivo) {
                                    setConfirmarInactivacion(doc);
                                  } else {
                                    handleToggleEstado(doc.codigo, doc.estado);
                                  }
                                }}
                                disabled={cargando}
                                className={`
                                  inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium
                                  border transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                                  ${isExpired
                                    ? "bg-amber-500/10 text-amber-600 border-amber-500/30 hover:bg-amber-500/20"
                                    : esActivo
                                      ? "bg-success/10 text-success border-success/30 hover:bg-success/20"
                                      : "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20"
                                  }
                                `}
                              >
                                {cargando ? (
                                  <Spinner className="h-3 w-3" />
                                ) : esActivo ? (
                                  <ToggleRight className="h-3.5 w-3.5" />
                                ) : (
                                  <ToggleLeft className="h-3.5 w-3.5" />
                                )}
                                {isExpired ? "Vencido" : esActivo ? "Activo" : "Inactivo"}
                              </button>
                            ) : (
                              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border bg-success/10 text-success border-success/30 opacity-80 cursor-default">
                                <ToggleRight className="h-3.5 w-3.5" />
                                Activo
                              </div>
                            )}
                          </TableCell>

                          <TableCell className="hidden xl:table-cell text-muted-foreground text-sm">
                            {formatearFecha(doc.fecha)}
                          </TableCell>

                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-info hover:text-info"
                                title="Información"
                                onClick={() => setInfoDoc(doc)}
                              >
                                <Info className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => descargarQR(doc)}
                                title="Descargar QR"
                              >
                                <QrCode className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                title="Eliminar"
                                onClick={() => setCodigoAEliminar(doc.codigo)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* AlertDialog único fuera del map */}
      <AlertDialog open={!!codigoAEliminar} onOpenChange={(open) => !open && setCodigoAEliminar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar documento</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de eliminar el documento{" "}
              <span className="font-mono font-semibold">{codigoAEliminar}</span>? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEliminar}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de confirmación para desactivar manualmente */}
      <AlertDialog open={!!confirmarInactivacion} onOpenChange={(open) => !open && setConfirmarInactivacion(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar manualmente?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de desactivar a{" "}
              <span className="font-semibold text-foreground">{confirmarInactivacion?.nombre}</span>{" "}
              de forma manual antes de su fecha de expiración. ¿Deseas continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarInactivar}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de reactivación de afiliado vencido */}
      <Dialog open={!!reactivarDoc} onOpenChange={(open) => !open && setReactivarDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reactivar Afiliado</DialogTitle>
            <DialogDescription>
              Selecciona la nueva duración de afiliación para{" "}
              <span className="font-semibold text-foreground">{reactivarDoc?.nombre}</span>.
              El periodo anterior quedará guardado en el historial.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setDuracionReactivacion("6_meses")}
                className={`p-4 rounded-xl border-2 text-center transition-all ${duracionReactivacion === "6_meses"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-muted hover:border-primary/40"
                  }`}
              >
                <p className="text-2xl font-bold">6</p>
                <p className="text-sm font-medium">Meses</p>
              </button>
              <button
                onClick={() => setDuracionReactivacion("1_ano")}
                className={`p-4 rounded-xl border-2 text-center transition-all ${duracionReactivacion === "1_ano"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-muted hover:border-primary/40"
                  }`}
              >
                <p className="text-2xl font-bold">1</p>
                <p className="text-sm font-medium">Año</p>
              </button>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setReactivarDoc(null)}>
                Cancelar
              </Button>
              <Button
                className="flex-1"
                disabled={updatingStatus === reactivarDoc?.codigo}
                onClick={handleReactivar}
              >
                {updatingStatus === reactivarDoc?.codigo ? (
                  <><Spinner className="mr-2" /> Reactivando...</>
                ) : (
                  "Confirmar Reactivación"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de información de afiliación con historial de periodos */}
      <Dialog open={!!infoDoc} onOpenChange={(open) => !open && setInfoDoc(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Información del Documento</DialogTitle>
            <DialogDescription>
              Detalles del registro de{" "}
              <span className="font-semibold text-foreground">{infoDoc?.nombre}</span>.
            </DialogDescription>
          </DialogHeader>
          {infoDoc && (
            <div className="space-y-3 pt-2">
              {/* Periodo actual solo para afiliados */}
              {infoDoc.tipo === "afiliado" && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-3">
                  <p className="text-xs text-primary uppercase font-bold tracking-wider">Periodo Actual</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-background p-3 rounded-lg border space-y-1">
                      <p className="text-xs text-muted-foreground uppercase font-semibold">Inicio</p>
                      <p className="font-medium text-sm">{formatearFecha(infoDoc.fechaInicioPeriodo || infoDoc.fecha)}</p>
                    </div>
                    <div className="bg-background p-3 rounded-lg border space-y-1">
                      <p className="text-xs text-muted-foreground uppercase font-semibold">Duración</p>
                      <p className="font-medium text-sm">
                        {infoDoc.duracion === "6_meses" ? "6 Meses" : infoDoc.duracion === "1_ano" ? "1 Año" : "No especificada"}
                      </p>
                    </div>
                  </div>
                  <div className="bg-background p-3 rounded-lg border text-center space-y-1">
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Expira</p>
                    <p className={`font-semibold text-base ${infoDoc.fechaExpiracion && new Date() > new Date(infoDoc.fechaExpiracion)
                      ? "text-destructive" : "text-success"
                      }`}>
                      {infoDoc.fechaExpiracion ? formatearFecha(infoDoc.fechaExpiracion) : "Sin expiración"}
                    </p>
                  </div>
                </div>
              )}

              {/* NUIP */}
              <div className="bg-muted/50 p-3 rounded-lg border flex items-center gap-3">
                <IdCard className="h-5 w-5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-semibold">NUIP</p>
                  <p className="font-medium text-sm font-mono">{infoDoc.cedula || "-"}</p>
                </div>
              </div>

              {/* Emisión (Oficina y Dependencia) */}
              {(infoDoc.oficina || infoDoc.dependencia) && (
                <div className="bg-muted/30 p-3 rounded-lg border space-y-2">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Emisión</p>
                  {infoDoc.oficina && (
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <p className="text-sm font-medium">{infoDoc.oficina}</p>
                    </div>
                  )}
                  {infoDoc.dependencia && (
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <p className="text-sm font-medium text-muted-foreground">{infoDoc.dependencia}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Desactivado manualmente */}
              {infoDoc.desactivadoManualmente && (
                <div className="bg-destructive/10 border border-destructive/20 p-3 rounded-lg space-y-1">
                  <p className="text-xs text-destructive uppercase font-semibold">Desactivado Manualmente</p>
                  <p className="font-medium text-sm text-destructive">{formatearFecha(infoDoc.fechaDesactivacion)}</p>
                </div>
              )}

              {/* Historial de periodos anteriores */}
              {Array.isArray(infoDoc.periodos) && infoDoc.periodos.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider pt-1">Historial de Periodos</p>
                  {[...infoDoc.periodos].reverse().map((periodo, idx) => {
                    const key = `${infoDoc.codigo}-${idx}`;
                    const expandido = periodosExpandidos[key];
                    const numero = infoDoc.periodos.length - idx;
                    return (
                      <div key={key} className="border rounded-lg overflow-hidden">
                        <button
                          onClick={() => setPeriodosExpandidos((prev) => ({ ...prev, [key]: !prev[key] }))}
                          className="w-full flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5 font-mono">#{numero}</span>
                            <span className="text-sm font-medium">
                              {periodo.tipo === "registro" ? "Registro Inicial" : `Renovación`}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              — {periodo.duracion === "6_meses" ? "6 Meses" : "1 Año"}
                            </span>
                          </div>
                          <span className="text-muted-foreground text-xs">{expandido ? "▲" : "▼"}</span>
                        </button>
                        {expandido && (
                          <div className="p-3 grid grid-cols-2 gap-3 bg-background">
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground uppercase font-semibold">Inicio</p>
                              <p className="text-sm font-medium">{formatearFecha(periodo.inicio)}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground uppercase font-semibold">Fin</p>
                              <p className="text-sm font-medium text-destructive">{formatearFecha(periodo.fin)}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Calendario de Vencimientos */}
      <Dialog open={showCalendar} onOpenChange={setShowCalendar}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Calendario de Vencimientos</DialogTitle>
            <DialogDescription>
              Los días resaltados tienen afiliaciones que expiran. Seleccione un día para ver el detalle.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col lg:flex-row gap-6 mt-4">
            {/* Calendario */}
            <div className="bg-muted/30 p-2 rounded-xl flex justify-center border w-fit mx-auto lg:mx-0">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(day) => day && setSelectedDate(day)}
                modifiers={{ expirations: expirationDates }}
                modifiersClassNames={{ expirations: "bg-destructive/20 text-destructive font-bold rounded-md" }}
              />
            </div>
            {/* Panel de afiliados del día seleccionado */}
            <div className="flex-1 bg-card rounded-xl border flex flex-col overflow-hidden">
              <div className="bg-muted/50 p-4 border-b">
                <h3 className="font-semibold text-lg flex items-center gap-2 text-primary">
                  <CalendarIcon className="h-5 w-5" />
                  {selectedDate.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" })}
                </h3>
              </div>
              <div className="p-4 flex-1">
                {expirandoEnDiaSeleccionado.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full min-h-[180px] text-muted-foreground gap-3">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                      <CalendarIcon className="h-6 w-6 opacity-50" />
                    </div>
                    <p className="text-sm">No hay afiliados que expiren este día.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                    {expirandoEnDiaSeleccionado.map((doc) => {
                      const vencido = doc.fechaExpiracion && new Date() > new Date(doc.fechaExpiracion);
                      return (
                        <div key={doc.codigo} className="bg-background p-4 rounded-lg border">
                          <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-2">
                            <div>
                              <p className="font-semibold">{doc.nombre}</p>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono mt-1">
                                <span className="flex items-center gap-1">
                                  <IdCard className="h-3.5 w-3.5" /> {doc.cedula}
                                </span>
                                <span className="flex items-center gap-1">
                                  <QrCode className="h-3.5 w-3.5" /> {doc.codigo}
                                </span>
                              </div>
                            </div>
                            <Badge
                              variant={vencido || doc.estado === "inactivo" ? "destructive" : "default"}
                              className="w-fit shrink-0"
                            >
                              {vencido || doc.estado === "inactivo" ? "Vencido / Inactivo" : "Por expirar"}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}