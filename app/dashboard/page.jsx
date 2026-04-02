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
  AlertDialogTrigger,
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
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { doc, updateDoc } from "firebase/firestore"; // ✅
import { db } from "@/lib/firebase";

const VERIFICACION_BASE_URL = "https://sistemainstitucional.vercel.app/verificar?doc=";

// ✅ FUNCIÓN NUEVA
const cambiarEstado = async (codigo, estadoActual) => {
  try {
    const nuevoEstado = estadoActual === "activo" ? "inactivo" : "activo";

    await updateDoc(doc(db, "documentos", codigo), {
      estado: nuevoEstado,
    });

    toast.success(`Ahora está ${nuevoEstado}`);
  } catch {
    toast.error("Error al cambiar estado");
  }
};

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

function exportarCSV(lista, nombre) {
  if (lista.length === 0) {
    toast.error("No hay datos para exportar");
    return;
  }

  const encabezados = ["Código", "Nombre", "Cédula", "Tipo", "Detalle", "Estado", "Fecha"];

  const filas = lista.map((item) => {
    const detalle = item.tipo === "certificado" ? (item.evento || "Evento") : "Miembro";
    return [
      item.codigo,
      item.nombre,
      item.cedula || "",
      item.tipo,
      detalle,
      item.estado,
      formatearFecha(item.fecha),
    ];
  });

  const csv = [encabezados, ...filas]
    .map((fila) => fila.map((valor) => `"${valor}"`).join(" ;"))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${nombre}.csv`;
  link.click();

  toast.success(`Exportado: ${nombre}.csv`);
}

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

export default function DashboardPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const { documentos, isLoading, eliminarDocumento } = useDocumentos();
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");

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

  const stats = useMemo(() => {
    const certificados = documentos.filter((d) => d.tipo === "certificado").length;
    const afiliados = documentos.filter((d) => d.tipo === "afiliado").length;
    return { total: documentos.length, certificados, afiliados };
  }, [documentos]);

  const handleEliminar = async (codigo) => {
    try {
      await eliminarDocumento(codigo);
      toast.success("Documento eliminado");
    } catch {
      toast.error("Error al eliminar");
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
      {/* HEADER OMITIDO (igual al tuyo) */}

      <main className="container mx-auto px-4 py-6">
        {/* TODO LO ANTERIOR IGUAL */}

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner className="h-8 w-8" />
              </div>
            ) : documentosFiltrados.length === 0 ? (
              <Empty title="Sin documentos" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Código</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {documentosFiltrados.map((doc) => (
                      <TableRow key={doc.codigo}>
                        <TableCell>{doc.codigo}</TableCell>
                        <TableCell>{doc.nombre}</TableCell>

                        {/* ✅ ESTADO CON COLOR */}
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              doc.estado === "activo"
                                ? "text-success border-success/30"
                                : "text-destructive border-destructive/30"
                            }
                          >
                            {doc.estado}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">

                            {/* ✅ BOTÓN NUEVO */}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => cambiarEstado(doc.codigo, doc.estado)}
                              title="Activar / Desactivar"
                            >
                              {doc.estado === "activo" ? "🟢" : "🔴"}
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => descargarQR(doc.codigo)}
                            >
                              <QrCode className="h-4 w-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEliminar(doc.codigo)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>

                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}