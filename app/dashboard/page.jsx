"use client";


import { useState, useMemo, useEffect, useCallback } from "react";
export const dynamic = "force-dynamic";
import { useAuth } from "@/hooks/use-auth";
import ProtectedRoute from "@/components/protected-route";
import { PersonalReadOnlyList } from "@/components/personal-read-only";
import { useDocumentos } from "@/hooks/use-documentos";
import { collection, getDocs, query, where, orderBy, deleteDoc, doc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { registrarAuditoria } from "@/lib/auditoria";
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
import { setDoc } from "firebase/firestore";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import QRCode from "qrcode";

const COLORS = {
  azul: "#05318a",
  verde: "#0e6235",
  amarillo: "#f3de4d",
  rojo: "#ce181b"
};
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Empty } from "@/components/ui/empty";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
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
  Filter,
  Download,
  MoreVertical,
  Briefcase,
  Monitor,
  CheckCircle2,
  Clock,
  Home,
  RefreshCcw,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  MapPin,
  ListChecks,
  Activity,
  History,
  Coffee,
  ClipboardList,
  Droplets,
  Phone,
  Mail,
  Globe,
  Map,
  PawPrint
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

const getVerificacionBaseUrl = () => `${window.location.origin}/verificar?doc=`;



// Función auxiliar para dar formato legible a la fecha (por ejemplo: "22 oct 2023, 14:30")
function formatearFecha(fecha) {
  if (!fecha) return "-";

  let dateObj;
  if (typeof fecha.toDate === "function") {
    dateObj = fecha.toDate();
  } else if (fecha && typeof fecha.seconds === "number") {
    dateObj = new Date(fecha.seconds * 1000);
  } else {
    dateObj = new Date(fecha);
  }

  if (isNaN(dateObj.getTime())) return "Fecha inválida";

  return dateObj.toLocaleDateString("es-CO", {
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
  const link = getVerificacionBaseUrl() + codigo;
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

// ─── helpers de asistencia ───────────────────────────────────────────────────

const ESTADO_ASISTENCIA = {
  trabajando: { label: "En jornada", color: "bg-success/15 text-success border-success/30", icon: Briefcase, dot: "bg-success" },
  almuerzo: { label: "En almuerzo", color: "bg-amber-500/15 text-amber-600 border-amber-500/30", icon: Coffee, dot: "bg-amber-500" },
  teletrabajo_activo: { label: "Teletrabajo", color: "bg-primary/15 text-primary border-primary/30", icon: Monitor, dot: "bg-primary" },
  finalizado: { label: "Finalizado", color: "bg-muted text-muted-foreground border-border", icon: CheckCircle2, dot: "bg-muted-foreground" },
  fuera_de_jornada: { label: "Sin registro", color: "bg-muted text-muted-foreground border-border", icon: Clock, dot: "bg-muted-foreground" },
};

function BadgeEstado({ estado }) {
  const cfg = ESTADO_ASISTENCIA[estado] || ESTADO_ASISTENCIA.fuera_de_jornada;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function formatearHoraAsistencia(h) {
  if (!h) return "—";
  if (typeof h.toDate === "function") {
    return h.toDate().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: true });
  }
  if (h && typeof h.seconds === "number") {
    return new Date(h.seconds * 1000).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: true });
  }
  return typeof h === "object" ? "—" : h;
}

function calcularHorasTrabajadasDashboard(r) {
  if (!r || !r.horaEntrada) return "—";

  const sec = (ts) => {
    if (!ts) return 0;
    if (ts.seconds) return ts.seconds;
    if (ts.toDate) return Math.floor(ts.toDate().getTime() / 1000);
    return Math.floor(new Date(ts).getTime() / 1000);
  };

  const entrada = sec(r.horaEntrada);
  const salidaAlmuerzo = sec(r.horaSalidaAlmuerzo);
  const entradaAlmuerzo = sec(r.horaEntradaAlmuerzo);

  let salida = 0;
  // Verificar si es el día actual comparando con formato local (Y-M-D)
  const hoy = new Date().toLocaleDateString("en-CA"); // Formato YYYY-MM-DD
  const esHoy = r.fecha === hoy || r.fecha === new Date().toISOString().split("T")[0];

  if (r.horaSalida) {
    salida = sec(r.horaSalida);
  } else if (esHoy) {
    salida = Math.floor(Date.now() / 1000);
  } else {
    return "Incompleto";
  }

  let totalSegundos = 0;

  if (salidaAlmuerzo) {
    totalSegundos += (salidaAlmuerzo - entrada);
    if (entradaAlmuerzo) {
      totalSegundos += (salida - entradaAlmuerzo);
    }
  } else {
    totalSegundos += (salida - entrada);
  }

  if (totalSegundos < 0) totalSegundos = 0;

  const horas = Math.floor(totalSegundos / 3600);
  const minutos = Math.floor((totalSegundos % 3600) / 60);
  return `${horas}h ${minutos}m`;
}

function fmtDiferencia(minutos) {
  const m = Math.abs(minutos);
  if (m < 60) return `${m} min`;
  const hrs = Math.floor(m / 60);
  const mins = m % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

// ─── hook de registros de asistencia ─────────────────────────────────────────

function useAsistencias(fecha) {
  const [registros, setRegistros] = useState([]);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    if (!fecha) return;
    setCargando(true);
    try {
      const q = query(
        collection(db, "asistencias"),
        where("fecha", "==", fecha)
      );
      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // ordenar por nombre
      data.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
      setRegistros(data);
    } catch (err) {
      console.error(err);
    } finally {
      setCargando(false);
    }
  }, [fecha]);

  useEffect(() => { cargar(); }, [cargar]);

  return { registros, cargando, recargar: cargar };
}

// ─── Componente Principal ─────────────────────────────────────────────────────

function DashboardContent() {

  const {
    user,
    userData,
    empleadoData,
    empleadoId,
    loading: authLoading,
    logout
  } = useAuth();

  const { documentos, isLoading, eliminarDocumento, actualizarEstado } = useDocumentos();

  const esSuperAdmin = userData?.rol === "superadmin";
  const puedeVerAsistenciasYPersonal = esSuperAdmin;

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
  const [isDownloadingCert, setIsDownloadingCert] = useState(null); // null o el código de la membresía
  const exportRef = useMemo(() => ({ current: null }), []);
  const certificadoRef = useMemo(() => ({ current: null }), []);
  const [currentCertData, setCurrentCertData] = useState(null);
  const [periodosExpandidos, setPeriodosExpandidos] = useState({});

  // ── estado para la pestaña de asistencia ────────────────────────────────
  const [fechaAsistencia, setFechaAsistencia] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [busquedaAsistencia, setBusquedaAsistencia] = useState("");
  const [logsAuditoria, setLogsAuditoria] = useState([]);
  const [cargandoAuditoria, setCargandoAuditoria] = useState(false);
  const [busquedaAuditoria, setBusquedaAuditoria] = useState("");
  const [seleccionadosAuditoria, setSeleccionadosAuditoria] = useState([]);
  const [verBitacoraDoc, setVerBitacoraDoc] = useState(null);
  const { registros, cargando: cargandoAsistencias, recargar } = useAsistencias(fechaAsistencia);

  const registrosFiltrados = useMemo(() => {
    if (!busquedaAsistencia.trim()) return registros;
    const t = busquedaAsistencia.toLowerCase();
    return registros.filter(
      (r) =>
        r.nombre?.toLowerCase().includes(t) ||
        r.cargo?.toLowerCase().includes(t)
    );
  }, [registros, busquedaAsistencia]);

  const statsAsistencia = useMemo(() => {
    const total = registros.length;
    const trabajando = registros.filter((r) => r.estadoActual === "trabajando" || r.estadoActual === "teletrabajo_activo").length;
    const almuerzo = registros.filter((r) => r.estadoActual === "almuerzo").length;
    const finalizados = registros.filter((r) => r.estadoActual === "finalizado").length;
    return { total, trabajando, almuerzo, finalizados };
  }, [registros]);

  const logsAuditoriaFiltrados = useMemo(() => {
    if (!busquedaAuditoria.trim()) return logsAuditoria;
    const t = busquedaAuditoria.toLowerCase();
    return logsAuditoria.filter(
      (log) =>
        log.usuarioNombre?.toLowerCase().includes(t) ||
        log.usuarioEmail?.toLowerCase().includes(t) ||
        log.accion?.toLowerCase().includes(t) ||
        log.documentoId?.toLowerCase().includes(t) ||
        log.detalles?.toLowerCase().includes(t)
    );
  }, [logsAuditoria, busquedaAuditoria]);

  const cargarAuditoria = useCallback(async () => {
    if (!esSuperAdmin) return;
    setCargandoAuditoria(true);
    try {
      const q = query(collection(db, "auditoria"), orderBy("fecha", "desc"));
      const snap = await getDocs(q);
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setLogsAuditoria(logs);
    } catch (e) {
      console.error("Error cargando auditoría:", e);
    } finally {
      setCargandoAuditoria(false);
    }
  }, [esSuperAdmin]);

  const handleEliminarTodoAuditoria = async () => {
    if (!confirm("¿Estás seguro de eliminar TODOS los registros de auditoría? Esta acción es irreversible.")) return;
    setCargandoAuditoria(true);
    try {
      const snap = await getDocs(collection(db, "auditoria"));
      const docs = snap.docs;

      // Eliminar en lotes de 500 (límite de Firestore)
      for (let i = 0; i < docs.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = docs.slice(i, i + 500);
        chunk.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }

      toast.success("Todos los registros de auditoría han sido eliminados");
      setSeleccionadosAuditoria([]);
      cargarAuditoria();
    } catch (e) {
      console.error(e);
      toast.error("Error al eliminar registros");
    } finally {
      setCargandoAuditoria(false);
    }
  };

  const handleEliminarSeleccionadosAuditoria = async () => {
    if (seleccionadosAuditoria.length === 0) return;
    if (!confirm(`¿Estás seguro de eliminar los ${seleccionadosAuditoria.length} registros seleccionados?`)) return;
    setCargandoAuditoria(true);
    try {
      const batch = writeBatch(db);
      seleccionadosAuditoria.forEach((id) => {
        batch.delete(doc(db, "auditoria", id));
      });
      await batch.commit();
      toast.success("Registros seleccionados eliminados");
      setSeleccionadosAuditoria([]);
      cargarAuditoria();
    } catch (e) {
      console.error(e);
      toast.error("Error al eliminar registros");
    } finally {
      setCargandoAuditoria(false);
    }
  };

  const handleSelectAllAuditoria = (checked) => {
    if (checked) {
      setSeleccionadosAuditoria(logsAuditoriaFiltrados.map(log => log.id));
    } else {
      setSeleccionadosAuditoria([]);
    }
  };

  const handleSelectOneAuditoria = (id, checked) => {
    if (checked) {
      setSeleccionadosAuditoria(prev => [...prev, id]);
    } else {
      setSeleccionadosAuditoria(prev => prev.filter(item => item !== id));
    }
  };

  const handleEliminarAsistencia = async (asistencia) => {
    if (!confirm(`¿Estás seguro de eliminar el registro de asistencia de ${asistencia.nombre} del día ${asistencia.fecha}?`)) return;

    try {
      await deleteDoc(doc(db, "asistencias", asistencia.id));
      await registrarAuditoria({
        user,
        userData,
        accion: "Eliminar Asistencia",
        documentoId: asistencia.id,
        detalles: `Se eliminó el registro de asistencia de ${asistencia.nombre} para la fecha ${asistencia.fecha}.`
      });
      toast.success("Asistencia eliminada");
      recargar(); // Recargar tabla de asistencia
      cargarAuditoria(); // Recargar logs
    } catch (error) {
      console.error(error);
      toast.error("Error al eliminar asistencia");
    }
  };

  useEffect(() => {
    if (esSuperAdmin) cargarAuditoria();
  }, [esSuperAdmin, cargarAuditoria]);

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

  const handleEliminar = async () => {
    if (!codigoAEliminar) return;
    const docEncontrado = documentos.find(d => (d.id === codigoAEliminar || d.codigo === codigoAEliminar));
    const colName = docEncontrado?._collection || "documentos";

    try {
      await eliminarDocumento(codigoAEliminar, colName);
      await registrarAuditoria({
        user,
        userData,
        accion: "Eliminar Registro",
        documentoId: codigoAEliminar,
        detalles: `Eliminación permanente del registro ${codigoAEliminar} de la colección ${colName}`
      });
      toast.success("Eliminado correctamente");
      cargarAuditoria();
    } catch (err) {
      console.error("Detalle del error al eliminar:", err);
      toast.error(`Error al eliminar: ${err.message}`);
    } finally {
      setCodigoAEliminar(null);
    }
  };

  // Reactivar directamente (sin confirmación). Desactivar requiere confirmación.
  const handleToggleEstado = async (idDocumento, estadoActual) => {
    if (estadoActual === "activo") return;
    const docEncontrado = documentos.find(d => (d.id === idDocumento || d.codigo === idDocumento));
    const colName = docEncontrado?._collection || "documentos";

    setUpdatingStatus(idDocumento);
    try {
      await actualizarEstado(idDocumento, "activo", { desactivadoManualmente: null, fechaDesactivacion: null }, colName);
      await registrarAuditoria({
        user,
        userData,
        accion: "Activar Registro",
        documentoId: codigo,
        detalles: `Re-activación manual de registro inactivo en ${colName}`
      });
      toast.success("Activado correctamente");
      cargarAuditoria();
    } catch {
      toast.error("Error al cambiar estado");
    } finally {
      setUpdatingStatus(null);
    }
  };

  // Confirmar inactivación manual: guarda metadatos adicionales en Firestore
  const handleConfirmarInactivar = async () => {
    if (!confirmarInactivacion) return;
    const colName = confirmarInactivacion._collection || "documentos";
    const docId = confirmarInactivacion.id || confirmarInactivacion.codigo;
    setUpdatingStatus(docId);
    try {
      await actualizarEstado(docId, "inactivo", {
        desactivadoManualmente: true,
        fechaDesactivacion: new Date().toISOString(),
      }, colName);
      await registrarAuditoria({
        user,
        userData,
        accion: "Inactivar Registro",
        documentoId: docId,
        detalles: `Desactivación manual por el administrador en ${colName}`
      });
      toast.success("Desactivado manualmente");
      cargarAuditoria();
    } catch (err) {
      console.error("Detalle del error al desactivar:", err);
      toast.error(`Error al desactivar: ${err.message}`);
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
      let nuevaExpiracion;
      const tipoMembresia = duracionReactivacion === "1_ano" ? "educativa" : "integral";

      if (tipoMembresia === "educativa") {
        const year = ahora.getFullYear();
        const month = ahora.getMonth();
        if (month <= 4) nuevaExpiracion = new Date(year, 4, 30, 23, 59, 59);
        else if (month <= 10) nuevaExpiracion = new Date(year, 10, 30, 23, 59, 59);
        else nuevaExpiracion = new Date(year + 1, 4, 30, 23, 59, 59);
      } else {
        nuevaExpiracion = new Date(ahora);
        nuevaExpiracion.setMonth(nuevaExpiracion.getMonth() + 12); // Ahora 1 año por defecto
      }

      // Nueva membresía a insertar/actualizar
      const nuevaMembresia = {
        tipo: tipoMembresia,
        fechaInicio: ahora.toISOString(),
        fechaExpiracion: nuevaExpiracion.toISOString(),
        codigo: `FIC-MEM-${Math.random().toString(36).substr(2, 6).toUpperCase()}`
      };

      // Actualizar el documento del afiliado
      const nuevasMembresias = [...(reactivarDoc.membresias || [])];
      // Si ya tiene una de este tipo, la reemplazamos (renovación) o la agregamos
      const index = nuevasMembresias.findIndex(m => m.tipo === tipoMembresia);
      if (index >= 0) {
        nuevasMembresias[index] = nuevaMembresia;
      } else {
        nuevasMembresias.push(nuevaMembresia);
      }

      await actualizarEstado(reactivarDoc.codigo, "activo", {
        membresias: nuevasMembresias,
        desactivadoManualmente: null,
        fechaDesactivacion: null
      }, "afiliados");

      await registrarAuditoria({
        user,
        userData,
        accion: "Renovación/Reactivación",
        documentoId: reactivarDoc.codigo,
        detalles: `Renovación de membresía ${tipoMembresia} para ${reactivarDoc.nombre}`
      });
      toast.success("Membresía procesada exitosamente");
      cargarAuditoria();
      setReactivarDoc(null);
    } catch (err) {
      console.error(err);
      toast.error("Error al procesar la renovación");
    } finally {
      setUpdatingStatus(null);
      setDuracionReactivacion("integral");
    }
  };

  const descargarCertificadoEspecifico = async (persona, membresia) => {
    setCurrentCertData({ persona, membresia });
    setIsDownloadingCert(membresia.codigo);
    toast.info(`Generando certificado ${membresia.tipo}...`);

    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const templateId = membresia.tipo === "educativa" ? "hidden-cert-edu" : "hidden-cert-integral";
      const element = document.getElementById(templateId);
      if (!element) throw new Error("Template no encontrado");

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff"
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);

      // Generar QR
      const qrDataUrl = await QRCode.toDataURL(`${getVerificacionBaseUrl()}${persona.codigo}`);
      const qrSize = 35;
      const marginX = pdfWidth - qrSize - 20;
      const marginY = pdf.internal.pageSize.getHeight() - qrSize - 30;

      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(marginX - 2, marginY - 2, qrSize + 4, qrSize + 4, 3, 3, 'F');
      pdf.addImage(qrDataUrl, "PNG", marginX, marginY, qrSize, qrSize);

      pdf.save(`Certificado_${membresia.tipo.toUpperCase()}_${persona.nombre.replace(/\s+/g, "_")}.pdf`);
      toast.success("Certificado descargado");
    } catch (err) {
      console.error(err);
      toast.error("Error al generar PDF");
    } finally {
      setIsDownloadingCert(null);
    }
  };

  const getPeriodoEducativo = (fechaExp) => {
    if (!fechaExp) return "";
    const date = new Date(fechaExp);
    const year = date.getFullYear();
    const month = date.getMonth();
    const letra = month <= 5 ? "A" : "B";
    return `${year}${letra}`;
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

        <Tabs defaultValue="documentos">
          {/* Pestañas de Navegación */}
          <TabsList className="grid w-full grid-cols-2 md:flex md:w-auto overflow-x-auto overflow-y-hidden mb-6 h-auto p-1 bg-card border shadow-sm">
            <TabsTrigger value="documentos" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Documentos</span>
            </TabsTrigger>
            {(esSuperAdmin || esRRHH) && (
              <TabsTrigger value="asistencia" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Clock className="h-4 w-4" />
                <span className="hidden sm:inline">Asistencia</span>
              </TabsTrigger>
            )}
            {(esSuperAdmin || esRRHH) && (
              <TabsTrigger value="personal" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Briefcase className="h-4 w-4" />
                <span className="hidden sm:inline">Personal</span>
              </TabsTrigger>
            )}
            {esSuperAdmin && (
              <TabsTrigger value="auditoria" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <ListChecks className="h-4 w-4" />
                <span className="hidden sm:inline">Auditoría</span>
              </TabsTrigger>
            )}
          </TabsList>

          {/* ══════════════════ PESTAÑA: DOCUMENTOS ══════════════════ */}
          <TabsContent value="documentos">
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
                  <CardTitle className="text-sm font-medium text-muted-foreground">Personas Afiliadas</CardTitle>
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
                  <CardTitle className="text-sm font-medium text-muted-foreground">Otros Documentos</CardTitle>
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
                    <Button asChild variant="outline" className="border-info text-info hover:bg-info/10">
                      <Link href="/afiliar">
                        <Users className="h-4 w-4 mr-2" />
                        Afiliar
                      </Link>
                    </Button>
                    <Button asChild>
                      <Link href="/generar">
                        <Plus className="h-4 w-4 mr-2" />
                        Emitir Documentos
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
                                  variant={doc.tipo === "certificado" ? "default" : doc.tipo === "documento" ? "outline" : doc.tipo === "afiliacion_individual" ? "secondary" : "default"}
                                  className={
                                    doc.tipo === "certificado"
                                      ? "bg-success/10 text-success border-success/20"
                                      : doc.tipo === "documento"
                                        ? "bg-primary/10 text-primary border-primary/20"
                                        : doc.tipo === "afiliacion_individual"
                                          ? "bg-purple-500/10 text-purple-600 border-purple-500/20"
                                          : "bg-info/10 text-info border-info/20"
                                  }
                                >
                                  {doc.tipo === "certificado" ? "Certificado" : doc.tipo === "documento" ? "Documento" : "AFILIADO"}
                                </Badge>
                              </TableCell>
                              <TableCell className="hidden lg:table-cell">
                                {doc.tipo === "certificado" 
                                  ? (doc.evento ? `${doc.evento} ${doc.descripcion ? `(${doc.descripcion})` : ''}` : doc.descripcion || "Evento") 
                                  : doc.tipo === "documento" 
                                    ? doc.descripcion || "General" 
                                    : doc.tipo === "afiliacion_individual"
                                      ? (doc.tipoAfiliacion === "educativa" ? "Edu: " : "Int: ") + (doc.estado || "Activo")
                                      : "Perfil Institucional"
                                }
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
                                        handleToggleEstado(doc.id || doc.codigo, doc.estado);
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
                                 {formatearFecha(doc.tipo === 'afiliado' ? (doc.fechaCreacion || doc.fechaIngreso) : (doc.fecha || doc.fechaIngreso))}
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
                                  {esSuperAdmin && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="text-destructive hover:text-destructive"
                                      title="Eliminar"
                                      onClick={() => setCodigoAEliminar(doc.id || doc.codigo)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
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

          </TabsContent>

          {/* ══════════════════ PESTAÑA: ASISTENCIA ══════════════════ */}
          {(esSuperAdmin || esRRHH) && (
            <TabsContent value="asistencia">

              {/* stats rápidos */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                {[
                  { label: "Registros hoy", val: statsAsistencia.total, icon: Users, color: "text-primary" },
                  { label: "En jornada", val: statsAsistencia.trabajando, icon: Briefcase, color: "text-success" },
                  { label: "En almuerzo", val: statsAsistencia.almuerzo, icon: Coffee, color: "text-amber-500" },
                  { label: "Finalizados", val: statsAsistencia.finalizados, icon: CheckCircle2, color: "text-muted-foreground" },
                ].map(({ label, val, icon: Icon, color }) => (
                  <Card key={label}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <Icon className={`h-5 w-5 ${color}`} />
                        <span className="text-2xl font-bold">{val}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* filtros */}
              <Card className="mb-4">
                <CardContent className="pt-4 pb-4">
                  <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground font-medium block mb-1">Fecha</label>
                        <input
                          type="date"
                          value={fechaAsistencia}
                          onChange={(e) => setFechaAsistencia(e.target.value)}
                          className="border rounded-md px-3 py-1.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    </div>
                    <div className="relative flex-1 sm:max-w-xs">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar empleado o cargo…"
                        value={busquedaAsistencia}
                        onChange={(e) => setBusquedaAsistencia(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* tabla de registros */}
              <Card>
                <CardContent className="p-0">
                  {cargandoAsistencias ? (
                    <div className="flex items-center justify-center py-16">
                      <Spinner className="h-8 w-8" />
                    </div>
                  ) : registrosFiltrados.length === 0 ? (
                    <Empty
                      title="Sin registros"
                      description={`No hay registros de asistencia para el ${fechaAsistencia}`}
                      className="py-14"
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>Empleado</TableHead>
                            <TableHead className="hidden sm:table-cell">Cargo</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="hidden md:table-cell">Entrada</TableHead>
                            <TableHead className="hidden lg:table-cell">Sal. Almuerzo</TableHead>
                            <TableHead className="hidden lg:table-cell">Reg. Almuerzo</TableHead>
                            <TableHead className="hidden md:table-cell">Salida</TableHead>
                            <TableHead>T. Laborado</TableHead>
                            <TableHead className="hidden xl:table-cell">Modo</TableHead>
                            <TableHead>Acciones</TableHead>
                            <TableHead className="text-right">Eliminar</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {registrosFiltrados.map((reg) => (
                            <TableRow key={reg.id}>
                              <TableCell className="font-medium">{reg.nombre}</TableCell>
                              <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">{reg.cargo || "—"}</TableCell>
                              <TableCell>
                                <BadgeEstado estado={reg.estadoActual} />
                              </TableCell>
                              <TableCell className="hidden md:table-cell text-sm tabular-nums">
                                <div className="flex flex-col">
                                  <span>{formatearHoraAsistencia(reg.horaEntrada)}</span>
                                  {reg.entradaDiferenciaMinutos > 0 && (
                                    <span className="text-[10px] text-destructive font-bold">
                                      +{fmtDiferencia(reg.entradaDiferenciaMinutos)} tarde
                                    </span>
                                  )}
                                  {reg.entradaDiferenciaMinutos < 0 && (
                                    <span className="text-[10px] text-success font-bold">
                                      {fmtDiferencia(reg.entradaDiferenciaMinutos)} antes
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="hidden lg:table-cell text-sm tabular-nums">{formatearHoraAsistencia(reg.horaSalidaAlmuerzo)}</TableCell>
                              <TableCell className="hidden lg:table-cell text-sm tabular-nums">{formatearHoraAsistencia(reg.horaEntradaAlmuerzo)}</TableCell>
                              <TableCell className="hidden md:table-cell text-sm tabular-nums">
                                <div className="flex flex-col">
                                  <span>{formatearHoraAsistencia(reg.horaSalida)}</span>
                                  {reg.salidaDiferenciaMinutos < 0 && (
                                    <span className="text-[10px] text-destructive font-bold">
                                      {fmtDiferencia(reg.salidaDiferenciaMinutos)} antes
                                    </span>
                                  )}
                                  {reg.salidaDiferenciaMinutos > 0 && (
                                    <span className="text-[10px] text-success font-bold">
                                      +{fmtDiferencia(reg.salidaDiferenciaMinutos)} extra
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="font-semibold text-primary whitespace-nowrap">
                                {calcularHorasTrabajadasDashboard(reg)}
                              </TableCell>
                              <TableCell className="hidden xl:table-cell">
                                {reg.modoTrabajo === "teletrabajo" ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-primary">
                                    <Home className="h-3 w-3" /> Remoto
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                    <Briefcase className="h-3 w-3" /> Presencial
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {reg.bitacora?.length > 0 && (
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" onClick={() => setVerBitacoraDoc(reg)} title="Ver Bitácora">
                                      <ListChecks className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {reg.ubicacion && (
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-success" asChild title="Ver Ubicación">
                                      <a href={`https://www.google.com/maps?q=${reg.ubicacion.lat},${reg.ubicacion.lng}`} target="_blank" rel="noopener noreferrer">
                                        <MapPin className="h-4 w-4" />
                                      </a>
                                    </Button>
                                  )}
                                  {!reg.bitacora && !reg.ubicacion && (
                                    <span className="text-xs text-muted-foreground italic">Ninguna</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                {esSuperAdmin && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                    onClick={() => handleEliminarAsistencia(reg)}
                                    title="Eliminar Asistencia"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

            </TabsContent>
          )}

          {esSuperAdmin && (
            <TabsContent value="auditoria">
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                  <Card className="flex-1 w-full">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex flex-col sm:flex-row gap-3 items-center">
                        <div className="relative flex-1 w-full">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Buscar en auditoría (usuario, acción, ID...)"
                            value={busquedaAuditoria}
                            onChange={(e) => setBusquedaAuditoria(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                        <div className="flex gap-2 shrink-0">
                          {seleccionadosAuditoria.length > 0 && (
                            <Button variant="destructive" size="sm" onClick={handleEliminarSeleccionadosAuditoria}>
                              <Trash2 className="h-4 w-4 mr-2" />
                              Eliminar ({seleccionadosAuditoria.length})
                            </Button>
                          )}
                          <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={handleEliminarTodoAuditoria} disabled={cargandoAuditoria || logsAuditoria.length === 0}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Borrar Todo
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <History className="h-5 w-5 text-primary" /> Historial de Auditoría
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">Registro de acciones administrativas realizadas en el sistema.</p>
                  </CardHeader>
                  <CardContent className="p-0">
                    {cargandoAuditoria ? (
                      <div className="flex items-center justify-center py-20"><Spinner className="h-8 w-8" /></div>
                    ) : logsAuditoriaFiltrados.length === 0 ? (
                      <div className="py-20 text-center text-muted-foreground">
                        {busquedaAuditoria ? "No se encontraron resultados para tu búsqueda." : "No hay registros de auditoría aún."}
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="w-12">
                                <Checkbox
                                  checked={seleccionadosAuditoria.length === logsAuditoriaFiltrados.length && logsAuditoriaFiltrados.length > 0}
                                  onCheckedChange={handleSelectAllAuditoria}
                                />
                              </TableHead>
                              <TableHead>Fecha/Hora</TableHead>
                              <TableHead>Administrador</TableHead>
                              <TableHead>Acción</TableHead>
                              <TableHead>Documento/ID</TableHead>
                              <TableHead>Detalles</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {logsAuditoriaFiltrados.map((log) => (
                              <TableRow key={log.id} className={seleccionadosAuditoria.includes(log.id) ? "bg-muted/30" : ""}>
                                <TableCell>
                                  <Checkbox
                                    checked={seleccionadosAuditoria.includes(log.id)}
                                    onCheckedChange={(checked) => handleSelectOneAuditoria(log.id, checked)}
                                  />
                                </TableCell>
                                <TableCell className="text-xs font-medium whitespace-nowrap">
                                  {log.fecha?.toDate ? log.fecha.toDate().toLocaleString('es-CO') : 'Reciente'}
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-col">
                                    <span className="text-sm font-semibold">{log.usuarioNombre}</span>
                                    <span className="text-[10px] text-muted-foreground">{log.usuarioEmail}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary" className="text-[10px] uppercase">{log.accion}</Badge>
                                </TableCell>
                                <TableCell className="text-xs font-mono">{log.documentoId}</TableCell>
                                <TableCell className="text-xs text-muted-foreground max-w-xs">{log.detalles}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}

          {/* ══════════════════ PESTAÑA: GESTIÓN DE PERSONAL ══════════════════ */}
          {puedeVerAsistenciasYPersonal && (
            <TabsContent value="personal">
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Gestión de Personal Integrada
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Crea y administra las cuentas de acceso, perfiles administrativos y horarios de trabajo de todo el personal en un solo lugar.
                  </p>
                </div>

                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="pt-6 pb-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
                      <div className="space-y-1">
                        <p className="font-semibold text-foreground flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-primary" />
                          Directorio Central
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Asigna correos, contraseñas, roles, cargos y la modalidad laboral semana a semana. Todo integrado sin vinculaciones manuales.
                        </p>
                      </div>
                      <Button asChild size="lg" className="shrink-0">
                        <Link href="/dashboard/personal">
                          <Users className="h-4 w-4 mr-2" />
                          Administrar Personal
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <PersonalReadOnlyList />
              </div>
            </TabsContent>
          )}

        </Tabs>

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
              onClick={(e) => {
                e.preventDefault();
                handleEliminar();
              }}
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
            <AlertDialogCancel disabled={!!updatingStatus}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" disabled={!!updatingStatus} onClick={(e) => {
              e.preventDefault();
              handleConfirmarInactivar();
            }}>
              {updatingStatus === (confirmarInactivacion?.id || confirmarInactivacion?.codigo) ? <Spinner className="w-4 h-4 mr-2" /> : null}
              Desactivar
            </Button>
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
                <p className="text-xl font-bold uppercase">Integral</p>
                <p className="text-[10px] font-medium opacity-70">1 AÑO (PREDETERMINADO)</p>
              </button>
              <button
                onClick={() => setDuracionReactivacion("1_ano")}
                className={`p-4 rounded-xl border-2 text-center transition-all ${duracionReactivacion === "1_ano"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-muted hover:border-primary/40"
                  }`}
              >
                <p className="text-xl font-bold uppercase">Educativa</p>
                <p className="text-[10px] font-medium opacity-70">CORTES FIJOS</p>
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
              {/* MEMBRESÍAS (DENTRO DEL AFILIADO) */}
              {infoDoc.tipo === "afiliado" && (
                <div className="space-y-3">
                  <p className="text-xs text-primary uppercase font-bold tracking-wider">Membresías Activas</p>
                  <div className="space-y-2">
                    {infoDoc.membresias?.map((m, idx) => {
                      const isExpired = m.fechaExpiracion && new Date() > new Date(m.fechaExpiracion);
                      return (
                        <div key={idx} className="bg-background border rounded-lg p-3 flex justify-between items-center shadow-sm">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="capitalize text-[10px]">
                                {m.tipo}
                              </Badge>
                              <span className={`text-[10px] font-bold ${isExpired ? "text-destructive" : "text-success"}`}>
                                {isExpired ? "VENCIDA" : "ACTIVA"}
                              </span>
                            </div>
                            <p className="text-xs font-medium">Cód: {m.codigo}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {formatearFecha(m.fechaInicio)} — {formatearFecha(m.fechaExpiracion)}
                            </p>
                          </div>
                           <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-success hover:bg-success/10"
                            onClick={() => descargarCertificadoEspecifico(infoDoc, m)}
                            disabled={!!isDownloadingCert}
                            title="Descargar Certificado"
                          >
                            {isDownloadingCert === m.codigo ? (
                              <Spinner className="h-3 w-3" />
                            ) : (
                              <FileText className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      );
                    })}
                    {(!infoDoc.membresias || infoDoc.membresias.length === 0) && (
                      <div className="bg-muted/30 border border-dashed rounded-lg p-6 text-center">
                        <p className="text-xs text-muted-foreground italic">No se encontraron membresías registradas.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}



              {/* Datos de Registro y Origen */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-muted/50 p-3 rounded-lg border flex items-center gap-3">
                  <Globe className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold">País de Registro</p>
                    <p className="font-medium text-sm">{infoDoc.pais || "Colombia"}</p>
                  </div>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg border flex items-center gap-3">
                  <CalendarIcon className="h-5 w-5 text-success shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Fecha de Emisión</p>
                    <p className="font-medium text-sm">
                      {formatearFecha(infoDoc.tipo === 'afiliado' ? (infoDoc.fechaCreacion || infoDoc.fechaIngreso) : (infoDoc.fecha || infoDoc.fechaIngreso))}
                    </p>
                  </div>
                </div>
              </div>

              {/* NUIP y Datos de Afiliado */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-muted/50 p-3 rounded-lg border flex items-center gap-3">
                  <IdCard className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold">NUIP</p>
                    <p className="font-medium text-sm font-mono">{infoDoc.cedula || "-"}</p>
                  </div>
                </div>
                {infoDoc.tipo === "afiliado" && (
                  <div className="bg-muted/50 p-3 rounded-lg border flex items-center gap-3">
                    <Droplets className="h-5 w-5 text-destructive shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-semibold">RH</p>
                      <p className="font-medium text-sm uppercase">{infoDoc.rh || "-"}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Datos de contacto para afiliados */}
              {infoDoc.tipo === "afiliado" && (
                <div className="bg-muted/30 p-3 rounded-lg border space-y-3">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Contacto y Ubicación</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-primary shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Teléfono</p>
                        <p className="text-sm font-medium">{infoDoc.telefono || "-"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-primary shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Correo</p>
                        <p className="text-sm font-medium truncate max-w-[150px]">{infoDoc.correo || "-"}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1 border-t">
                    <MapPin className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Dirección</p>
                      <p className="text-sm font-medium">{infoDoc.direccion || "-"}</p>
                    </div>
                  </div>
                  {(infoDoc.pais || infoDoc.ciudad) && (
                    <div className="grid grid-cols-2 gap-4 pt-1 border-t">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-primary shrink-0" />
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase">País</p>
                          <p className="text-sm font-medium">{infoDoc.pais || "-"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Map className="h-4 w-4 text-primary shrink-0" />
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase">Ciudad</p>
                          <p className="text-sm font-medium">{infoDoc.ciudad || "-"}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Beneficiarios */}
              {infoDoc.tipo === "afiliado" && Array.isArray(infoDoc.beneficiarios) && infoDoc.beneficiarios.length > 0 && (
                <div className="bg-muted/30 p-3 rounded-lg border space-y-2">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Beneficiarios</p>
                  <div className="grid grid-cols-1 gap-2">
                    {infoDoc.beneficiarios.map((ben, i) => (
                      <div key={i} className="flex justify-between items-center p-2 bg-background rounded border border-dashed">
                        <div className="flex items-center gap-2">
                          <Users className="h-3 w-3 text-primary" />
                          <span className="text-xs font-semibold uppercase">{ben.nombre}</span>
                        </div>
                        <span className="text-xs font-mono text-muted-foreground">{ben.nuip}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mascotas */}
              {infoDoc.tipo === "afiliado" && Array.isArray(infoDoc.mascotas) && infoDoc.mascotas.length > 0 && (
                <div className="bg-muted/30 p-3 rounded-lg border space-y-2">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Mascotas (Plan Integra Dog-Cat)</p>
                  <div className="grid grid-cols-1 gap-2">
                    {infoDoc.mascotas.map((mascota, i) => (
                      <div key={i} className="flex justify-between items-center p-2 bg-background rounded border border-dashed">
                        <div className="flex items-center gap-2">
                          <PawPrint className="h-3 w-3 text-primary" />
                          <span className="text-xs font-semibold uppercase">{mascota.nombre}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">({mascota.tipo}{mascota.raza ? ` - ${mascota.raza}` : ''})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                              — {periodo.duracion === "educativa" ? "Educativa" : periodo.duracion === "integral" ? "Integral" : (periodo.duracion === "1_ano" ? "Educativa (Antiguo)" : periodo.duracion === "6_meses" ? "Integral (Antiguo)" : "No especificada")}
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
      {/* Modal para ver bitácora de asistencia */}
      <Dialog open={!!verBitacoraDoc} onOpenChange={(open) => !open && setVerBitacoraDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-primary" />
              Bitácora de Actividades
            </DialogTitle>
            <DialogDescription>
              Resumen de tareas reportadas por <span className="font-semibold text-foreground">{verBitacoraDoc?.nombre}</span> el {fechaAsistencia}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {verBitacoraDoc?.bitacora?.length > 0 ? (
                [...verBitacoraDoc.bitacora].reverse().map((item, i) => (
                  <div key={i} className="bg-muted/40 border rounded-xl p-3 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-primary uppercase bg-primary/10 px-2 py-0.5 rounded-full">
                        {item.hora}
                      </span>
                      <Clock className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <p className="text-sm italic">"{item.actividad}"</p>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-10">No hay actividades registradas.</p>
              )}
            </div>
            <Button className="w-full" onClick={() => setVerBitacoraDoc(null)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* TEMPLATE OCULTO PARA CERTIFICADOS (Dashboard) */}
      <div style={{ position: "fixed", left: "-9999px", top: 0, zIndex: -1 }}>
        {currentCertData && (
          <>
            {/* Template de Aval Educativo */}
            <div
              id="hidden-cert-edu"
              style={{
                width: "800px",
                padding: "80px",
                background: "white",
                fontFamily: "'Times New Roman', serif",
                color: "#1a1a1a",
                lineHeight: "1.6",
                boxSizing: "border-box"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px", borderBottom: `2px solid ${COLORS.azul}`, paddingBottom: "15px" }}>
                <img src="/logo.png" alt="Logo" style={{ width: "90px", height: "90px", borderRadius: "50%" }} />
                <div style={{ textAlign: "right" }}>
                  <h1 style={{ fontSize: "24px", fontWeight: "900", margin: 0, color: COLORS.azul }}>FUNDACIÓN ISLA CASCAJAL</h1>
                  <p style={{ fontSize: "10px", fontWeight: "bold", margin: 0, color: "#666", textTransform: "uppercase" }}>NIT: 900.248.351-0</p>
                </div>
              </div>

              <div style={{ textAlign: "center", marginBottom: "20px" }}>
                <h2 style={{ fontSize: "20px", fontWeight: "bold", textDecoration: "underline", margin: 0 }}>CERTIFICADO DE AVAL EDUCATIVO</h2>
              </div>

              <div style={{ fontSize: "14px", textAlign: "justify" }}>
                <p>
                  La presente organización de base denominada FUNDACIÓN ISLA CASCAJAL “FICong”, identificada con NIT: 900.248.351-0, con domicilio principal en el Distrito de Santiago de Cali, República de Colombia, se permite presentar a <strong>{currentCertData.persona.nombre}</strong> con NUIP. <strong>{currentCertData.persona.cedula}</strong>, quien cuenta con registro oficial en nuestra base de datos institucional y con membresía activa para acceder a nuestros convenios educativos.
                </p>

                <p>
                  Esta membresía fue realizada el día {formatearFecha(currentCertData.persona.fechaCreacion || currentCertData.persona.fechaIngreso)}, bajo el código institucional <strong>{currentCertData.persona.codigo}</strong> y tiene validez y cobertura para los convenios Nacionales e Internacionales y le permite acceder a los programas, actividades y procesos académicos establecidos y ofertados por los aliados estratégicos de la Fundación Isla Cascajal y por ella misma.
                </p>

                <p>
                  Después de corroborar que se asumirán los compromisos académicos, sociales y morales por parte del titular de este documento, se procede a conceder AVAL y se le solicita a la institución educativa receptora de este documento, que, de acuerdo al convenio interinstitucional firmado por las partes, se avance en el otorgamiento de los correspondientes descuentos para programas académicos y demás servicios educativos para el período académico {getPeriodoEducativo(currentCertData.membresia.fechaExpiracion)}. El presente documento se expide a los {new Date().getDate().toString().padStart(2, '0')} días del mes de {new Date().toLocaleString('es-CO', { month: 'long' })} de {new Date().getFullYear()} en Santiago de Cali por interés del solicitante.
                </p>
              </div>

              <div style={{ marginTop: "20px", paddingBottom: "10px" }}>
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
                  <img src="/firma.jpeg" alt="Firma" style={{ height: "60px", marginBottom: "5px" }} onError={(e) => e.target.style.display = 'none'} />
                  <p style={{ margin: 0, fontWeight: "bold", fontSize: "14px" }}>Diana C. Rojas V.</p>
                  <p style={{ margin: 0, fontWeight: "bold", fontSize: "14px" }}>Directora Administrativa</p>
                  <p style={{ margin: 0, fontSize: "12px", fontStyle: "italic" }}>Fundación Isla Cascajal</p>
                  <p style={{ margin: 0, fontSize: "10px", fontStyle: "italic" }}>Documento electrónico verificable con el código QR.</p>
                </div>
              </div>
            </div>

            {/* Template de Afiliación Integral */}
            <div
              id="hidden-cert-integral"
              style={{
                width: "800px",
                padding: "80px",
                background: "white",
                fontFamily: "'Times New Roman', serif",
                color: "#1a1a1a",
                lineHeight: "1.6",
                boxSizing: "border-box"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px", borderBottom: `2px solid ${COLORS.azul}`, paddingBottom: "15px" }}>
                <img src="/logo.png" alt="Logo" style={{ width: "90px", height: "90px", borderRadius: "50%" }} />
                <div style={{ textAlign: "right" }}>
                  <h1 style={{ fontSize: "24px", fontWeight: "900", margin: 0, color: COLORS.azul }}>FUNDACIÓN ISLA CASCAJAL</h1>
                  <p style={{ fontSize: "10px", fontWeight: "bold", margin: 0, color: "#666", textTransform: "uppercase" }}>NIT: 900.248.351-0</p>
                </div>
              </div>

              <div style={{ textAlign: "center", marginBottom: "20px" }}>
                <h2 style={{ fontSize: "20px", fontWeight: "bold", textDecoration: "underline", margin: 0 }}>CERTIFICADO DE AFILIACIÓN INTEGRAL</h2>
              </div>

              <div style={{ fontSize: "14px", textAlign: "justify" }}>
                <p>
                  La presente organización de base denominada FUNDACIÓN ISLA CASCAJAL “FICong”, identificada con NIT: 900.248.351-0, con domicilio principal en el Distrito de Santiago de Cali, República de Colombia, se permite presentar a <strong>{currentCertData.persona.nombre}</strong> con NUIP. <strong>{currentCertData.persona.cedula}</strong>, bajo el código institucional <strong>{currentCertData.persona.codigo}</strong> y le permite acceder a los descuentos que otorgan nuestros convenios interinstitucionales.
                </p>

                <p>
                  Esta membresía tiene validez y cobertura para los convenios Nacionales e Internacionales y le permite acceder a los programas, actividades y procesos establecidos por la Fundación Isla Cascajal, así pues; después de corroborar que se asumirán los compromisos sociales y morales por parte del titular de este documento, se procede a reconocer su AFILIACIÓN ACTIVA y se le solicita a la organización receptora de este documento, que, de acuerdo al convenio interinstitucional firmado por las partes, se avance en el otorgamiento de los correspondientes descuentos especiales tanto al titular de la membresía como a sus beneficiarios y mascotas hasta las 11:59 p.m. del día {formatearFecha(currentCertData.membresia.fechaExpiracion)}.
                </p>
              </div>

              {currentCertData.persona.beneficiarios?.length > 0 && (
                <div style={{ marginTop: "15px", border: "1px solid #000", padding: "8px", paddingBottom: "10px" }}>
                  <p style={{ color: "#0070C0", margin: 0, marginBottom: "8px", fontSize: "12px", fontWeight: "bold" }}>BENEFICIARIOS:</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    {currentCertData.persona.beneficiarios.map((b, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", paddingRight: "20px" }}>
                        <span>{b.nombre}</span>
                        <span>NUIP: {b.nuip || "Sin registro"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {currentCertData.persona.mascotas?.length > 0 && (
                <div style={{ marginTop: "10px", border: "1px solid #000", padding: "8px", paddingBottom: "10px" }}>
                  <p style={{ color: "#0070C0", margin: 0, marginBottom: "8px", fontSize: "12px", fontWeight: "bold" }}>MASCOTAS (PLAN INTEGRAL):</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                    {currentCertData.persona.mascotas.map((m, i) => (
                      <div key={i} style={{ fontSize: "11px" }}>
                        {m.nombre} ({m.tipo}{m.raza ? ` - ${m.raza}` : ''})
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginTop: "20px", paddingBottom: "10px" }}>
                <p style={{ margin: 0, fontSize: "12px", marginBottom: "20px" }}>El presente documento se expide a los {new Date().getDate().toString().padStart(2, '0')} días del mes de {new Date().toLocaleString('es-CO', { month: 'long' })} de {new Date().getFullYear()} en Santiago de Cali.</p>
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
                  <img src="/firma.jpeg" alt="Firma" style={{ height: "60px", marginBottom: "5px" }} onError={(e) => e.target.style.display = 'none'} />
                  <p style={{ margin: 0, fontWeight: "bold", fontSize: "14px" }}>Diana C. Rojas V.</p>
                  <p style={{ margin: 0, fontWeight: "bold", fontSize: "14px" }}>Directora Administrativa</p>
                  <p style={{ margin: 0, fontSize: "12px", fontStyle: "italic" }}>Fundación Isla Cascajal</p>
                  <p style={{ margin: 0, fontSize: "10px", fontStyle: "italic" }}>Documento electrónico verificable con el código QR.</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute allowedRoles={["superadmin"]}>
      <DashboardContent />
    </ProtectedRoute>
  );
}