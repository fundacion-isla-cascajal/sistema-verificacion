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
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

const VERIFICACION_BASE_URL = "https://sistemainstitucional.vercel.app/verificar?doc=";

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
  const encabezados = ["Código", "Nombre", "Cédula", "Tipo", "Detalle", "Estado", "Fecha"];
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

// Función asíncrona para generar un código QR y forzar su descarga como imagen PNG
async function descargarQR(codigo) {
  const link = VERIFICACION_BASE_URL + codigo;
  const urlQR = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(link)}`;
  try {
    const res = await fetch(urlQR);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `QR_${codigo}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

  // Toggle directo: si está activo lo pasa a inactivo y viceversa
  // Alternador visual y lógico para los afiliados (Activo <-> Inactivo). Actualiza directo en Firebase
  const handleToggleEstado = async (codigo, estadoActual) => {
    const nuevoEstado = estadoActual === "activo" ? "inactivo" : "activo";
    setUpdatingStatus(codigo);
    try {
      await actualizarEstado(codigo, nuevoEstado);
      toast.success(nuevoEstado === "activo" ? "Documento activado" : "Documento desactivado");
    } catch {
      toast.error("Error al cambiar estado");
    } finally {
      setUpdatingStatus(null);
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
                    placeholder="Buscar por nombre, código o cédula..."
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

              <Button asChild>
                <Link href="/generar">
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar
                </Link>
              </Button>
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
                      <TableHead className="hidden md:table-cell">Cédula</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="hidden lg:table-cell">Detalle</TableHead>
                      <TableHead className="hidden sm:table-cell">Estado</TableHead>
                      <TableHead className="hidden xl:table-cell">Fecha</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documentosFiltrados.map((doc) => {
                      const esActivo = doc.estado === "activo";
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

                          {/* ESTADO — botón toggle simple, sin DropdownMenu ni portal */}
                          <TableCell className="hidden sm:table-cell">
                            {doc.tipo === "afiliado" ? (
                              <button
                                onClick={() => handleToggleEstado(doc.codigo, doc.estado)}
                                disabled={cargando}
                                className={`
                                  inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium
                                  border transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                                  ${esActivo
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
                                {esActivo ? "Activo" : "Inactivo"}
                              </button>
                            ) : (
                              <div
                                className={`
                                  inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium
                                  border bg-success/10 text-success border-success/30 opacity-80 cursor-default
                                `}
                              >
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
                                onClick={() => descargarQR(doc.codigo)}
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
    </div>
  );
}