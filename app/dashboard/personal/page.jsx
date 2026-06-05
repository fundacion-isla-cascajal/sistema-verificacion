"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import ProtectedRoute from "@/components/protected-route";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc, query, where } from "firebase/firestore";
import { useEmpleados, DIAS_SEMANA, MODALIDADES, calcularResumenHorario, HORARIO_DEFAULT } from "@/hooks/use-empleados";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Users, UserPlus, RefreshCcw, LogOut, ArrowLeft, Mail, Lock, User, Briefcase, CalendarDays,
  Monitor, Home, CheckCircle2, Eye, EyeOff, Search, MapPin, Phone, Building, QrCode, FileText, Trash2, PowerOff, Power, PawPrint, Pencil
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { crearUsuarioInstitucional, eliminarUsuarioInstitucional } from "@/app/actions/usuarios";
import { registrarAuditoria } from "@/lib/auditoria";

// Librerías para PDF y QR
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import QRCode from "qrcode";

const COLORS = {
  azul: "#05318a",
  verde: "#0e6235",
  amarillo: "#f3de4d",
  rojo: "#ce181b"
};

const TIPOS_PERSONAL = [
  "Empleado", "Practicante", "Contratista", "Administrativo", "Coordinador", "Directivo", "Otro"
];

function PersonalContent() {
  const { user, userData, logout } = useAuth();
  const esSuperAdmin = userData?.rol === "superadmin";
  const esRRHH = userData?.rol === "recursos_humanos";

  const [usuarios, setUsuarios] = useState([]);
  const { empleados: personalList, isLoading: cargandoPersonal, recargar: recargarPersonal, actualizarModalidad } = useEmpleados();
  const [cargandoUsuarios, setCargandoUsuarios] = useState(true);

  // Vistas: 'table', 'create', 'success'
  const [view, setView] = useState("table");

  // Estados para Creación y Edición
  const [formData, setFormData] = useState({
    nombres: "",
    primerApellido: "",
    segundoApellido: "",
    nombre: "",
    documento: "",
    correo: "",
    telefono: "",
    direccion: "",
    rh: "",
    cargo: "",
    tipoPersonal: "Empleado",
    fechaIngreso: new Date().toISOString().split("T")[0],
    estado: "activo",
    rol: "empleado",
    password: "",
    modalidadLaboral: "Presencial",
    diasTeletrabajo: "",
    afiliarAutomaticamente: false,
    beneficiarios: [],
    mascotas: [],
    foto: null,
    horarioModalidad: HORARIO_DEFAULT,
    memorandos: []
  });
  const [fotoPreview, setFotoPreview] = useState(null);
  const [creando, setCreando] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [permitirModificarNiup, setPermitirModificarNiup] = useState(false);
  const [editId, setEditId] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [personalReciente, setPersonalReciente] = useState(null);
  const [qrPersonal, setQrPersonal] = useState(null);
  const [fechaCertificado, setFechaCertificado] = useState("");

  // Estados Table
  const [searchQuery, setSearchQuery] = useState("");
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState(null);
  const [horarioEdit, setHorarioEdit] = useState({});
  const [guardandoHorario, setGuardandoHorario] = useState(false);
  const [confirmDuplicado, setConfirmDuplicado] = useState(false);

  const cargarDatos = async () => {
    setCargandoUsuarios(true);
    try {
      const usersSnap = await getDocs(collection(db, "usuarios"));
      const usersList = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setUsuarios(usersList);
      await recargarPersonal();
    } catch (error) {
      console.error(error);
      toast.error("Error al cargar los datos");
    } finally {
      setCargandoUsuarios(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const removerTildes = (str) => {
    if (!str) return "";
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  useEffect(() => {
    if (view === "create" && !isEditing && formData.nombres && formData.primerApellido) {
      const generarCorreoAsync = async () => {
        const primerNombre = removerTildes(formData.nombres.trim().split(" ")[0].toLowerCase());
        const primerApe = removerTildes(formData.primerApellido.trim().split(" ")[0].toLowerCase());
        
        if (!primerNombre || !primerApe) return;

        const baseCorreo = `${primerNombre}.${primerApe}`;
        let correoSugerido = `${baseCorreo}@islacascajal.org`;
        
        try {
          const qBase = query(collection(db, "usuarios"), where("correo", ">=", baseCorreo), where("correo", "<=", baseCorreo + "\uf8ff"));
          const snapshot = await getDocs(qBase);
          
          if (!snapshot.empty) {
            const correosExistentes = snapshot.docs.map(doc => doc.data().correo);
            if (correosExistentes.includes(correoSugerido)) {
              let contador = 0;
              while (correosExistentes.includes(`${baseCorreo}${contador.toString().padStart(2, '0')}@islacascajal.org`)) {
                contador++;
              }
              correoSugerido = `${baseCorreo}${contador.toString().padStart(2, '0')}@islacascajal.org`;
            }
          }
          
          setFormData(prev => ({ ...prev, correo: correoSugerido }));
        } catch (error) {
          console.error("Error al generar correo automático:", error);
        }
      };
      
      const timeoutId = setTimeout(() => {
        generarCorreoAsync();
      }, 800);
      return () => clearTimeout(timeoutId);
    }
  }, [formData.nombres, formData.primerApellido, view, isEditing]);

  const comprimirImagen = (base64Str, quality = 0.7, maxWidth = 500) => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
    });
  };

  const handleFotoChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("La foto es demasiado pesada (máx 5MB)");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const originalBase64 = reader.result;
          const compressedBase64 = await comprimirImagen(originalBase64);
          setFotoPreview(compressedBase64);
          setFormData(prev => ({ ...prev, foto: compressedBase64 }));
        } catch (err) {
          console.error("Error al comprimir imagen:", err);
          toast.error("Error al procesar la imagen");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBeneficiarioChange = (index, field, value) => {
    const newBeneficiarios = [...(formData.beneficiarios || [])];
    if (field === "nuip") {
      const numbersOnly = value.replace(/\D/g, "");
      value = numbersOnly.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }
    newBeneficiarios[index][field] = value;
    setFormData(prev => ({ ...prev, beneficiarios: newBeneficiarios }));
  };

  const handleMascotaChange = (index, field, value) => {
    const newMascotas = [...(formData.mascotas || [])];
    newMascotas[index][field] = value;
    setFormData(prev => ({ ...prev, mascotas: newMascotas }));
  };

  const handleCrearUsuario = async (e) => {
    e.preventDefault();
    if (!formData.correo || !formData.password || !formData.nombre || !formData.rol || !formData.documento) {
      toast.error("Faltan campos obligatorios");
      return;
    }

    if (formData.password.length < 4) {
      toast.error("La contraseña debe tener al menos 4 caracteres");
      return;
    }

    // Verificar si ya existe un empleado con esa cédula
    if (!confirmDuplicado) {
      try {
        const docNumeroLimpio = formData.documento.replace(/\./g, "");
        const q = query(collection(db, "empleados"), where("documento", "in", [formData.documento, docNumeroLimpio]));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const existente = snap.docs[0].data();
          const confirmar = window.confirm(
            `⚠️ Ya existe un empleado registrado con este número de cédula:\n\n👤 ${existente.nombre}\n📋 Documento: ${existente.documento}\n\n¿Deseas continuar de todas formas con el registro?`
          );
          if (!confirmar) return;
          setConfirmDuplicado(true);
        }
      } catch (err) {
        console.warn("No se pudo verificar duplicado:", err);
      }
    }

    setCreando(true);
    try {
      const codigoG = "FIC-" + Math.random().toString(36).substr(2, 6).toUpperCase();

      const beneficiariosValidos = formData.afiliarAutomaticamente ? (formData.beneficiarios || []).filter(b => b.nombre.trim() !== "") : [];
      const mascotasValidas = formData.afiliarAutomaticamente ? (formData.mascotas || []).filter(m => m.nombre.trim() !== "") : [];

      const payload = {
        ...formData,
        beneficiarios: beneficiariosValidos,
        mascotas: mascotasValidas,
        codigoInstitucional: codigoG,
        creadoPorUid: user.uid
      };

      const result = await crearUsuarioInstitucional(payload);

      if (result.success) {
        await registrarAuditoria({
          user,
          userData,
          accion: "Crear Personal",
          documentoId: result.personalId || formData.correo,
          detalles: `Se registró personal ${formData.nombre} (${formData.tipoPersonal}).`
        });

        setPersonalReciente({
          ...payload,
          id: result.personalId,
          uid: result.uid
        });

        toast.success("Personal registrado correctamente");
        setView("success");
        cargarDatos();
      } else {
        toast.error(result.error || "Error al crear el usuario");
      }
    } catch (error) {
      console.error(error);
      toast.error("Error inesperado");
    } finally {
      setCreando(false);
      setConfirmDuplicado(false);
    }
  };

  const handleToggleEstado = async (empleadoId, uId, estadoActual) => {
    const nuevoEstado = estadoActual === "activo" ? "inactivo" : "activo";
    const accion = nuevoEstado === "activo" ? "habilitar" : "inhabilitar";
    const confirmar = window.confirm(
      `¿Deseas ${accion} a este empleado? ${nuevoEstado === "inactivo" ? "No podrá acceder al sistema." : "Podrá volver a acceder al sistema."}`
    );
    if (!confirmar) return;

    try {
      const nuevoActivo = nuevoEstado === "activo";
      if (uId) await updateDoc(doc(db, "usuarios", uId), { activo: nuevoActivo, estado: nuevoEstado });

      if (empleadoId) {
        await updateDoc(doc(db, "empleados", empleadoId), { estado: nuevoEstado });

        // Sincronizar estado con afiliación institucional
        const q = query(collection(db, "afiliados"), where("personalId", "==", empleadoId));
        const snap = await getDocs(q);
        const promesas = snap.docs.map(async (d) => {
          await updateDoc(doc(db, "afiliados", d.id), { estado: nuevoEstado });
        });
        await Promise.all(promesas);
      }

      toast.success(`Empleado ${nuevoEstado === "activo" ? "habilitado" : "inhabilitado"} correctamente`);
      cargarDatos();
    } catch (error) {
      console.error(error);
      toast.error("Error al cambiar el estado del empleado");
    }
  };

  const abrirEdicion = (usuarioObj, personalObj) => {
    const target = personalObj && !personalObj.isMock ? personalObj : usuarioObj;
    
    const parts = (target.nombre || "").trim().split(/\s+/);
    let n = "", p1 = "", p2 = "";
    if (parts.length >= 3) {
      p2 = parts.pop();
      p1 = parts.pop();
      n = parts.join(" ");
    } else if (parts.length === 2) {
      p1 = parts[1];
      n = parts[0];
    } else {
      n = parts[0] || "";
    }

    setFormData({
      nombres: n,
      primerApellido: p1,
      segundoApellido: p2,
      nombre: target.nombre || "",
      documento: target.documento || "",
      correo: target.correo || "",
      telefono: target.telefono || "",
      direccion: target.direccion || "",
      rh: target.rh || "",
      cargo: target.cargo || "",
      tipoPersonal: target.tipoPersonal || "Empleado",
      fechaIngreso: target.fechaIngreso || new Date().toISOString().split("T")[0],
      tipoVinculacion: target.tipoVinculacion || "",
      tienePeriodoPrueba: target.tienePeriodoPrueba || false,
      tiempoPeriodoPrueba: target.tiempoPeriodoPrueba || "",
      tipoContrato: target.tipoContrato || "",
      tiempoContrato: target.tiempoContrato || "",
      fechaTerminacion: target.fechaTerminacion || "",
      motivoTerminacion: target.motivoTerminacion || "",
      salario: target.salario || "",
      estado: target.estado || "activo",
      rol: usuarioObj.rol || "empleado",
      password: "",
      modalidadLaboral: target.modalidadLaboral || "Presencial",
      diasTeletrabajo: target.diasTeletrabajo || "",
      afiliarAutomaticamente: false,
      beneficiarios: target.beneficiarios || [],
      mascotas: target.mascotas || [],
      foto: target.foto || null,
      horarioModalidad: target.horarioModalidad || HORARIO_DEFAULT,
      memorandos: target.memorandos || []
    });
    setFotoPreview(target.foto || null);
    setIsEditing(true);
    setPermitirModificarNiup(false);
    setEditId({ uId: usuarioObj.id, empleadoId: target.id || null });
    setView("create");
  };

  const handleNameChange = (field, value) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      next.nombre = `${next.nombres} ${next.primerApellido} ${next.segundoApellido || ''}`.trim().replace(/\s+/g, ' ');
      return next;
    });
  };

  useEffect(() => {
    if (isEditing) return;

    const generateEmail = async () => {
      const { nombres, primerApellido } = formData;
      if (nombres && primerApellido) {
        const primerNombre = nombres.trim().split(/\s+/)[0].toLowerCase();
        const apellido1 = primerApellido.trim().toLowerCase().replace(/\s+/g, '');
        
        // Limpiar acentos y caracteres especiales
        const cleanName = primerNombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
        const cleanLast = apellido1.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
        
        if (!cleanName || !cleanLast) return;

        const baseEmail = `${cleanName}.${cleanLast}@islacascajal.org`;
        
        let finalEmail = baseEmail;
        let counter = 0;
        
        while (true) {
          const q = query(collection(db, "usuarios"), where("correo", "==", finalEmail));
          const snap = await getDocs(q);
          if (snap.empty) {
            break;
          }
          const counterStr = counter.toString().padStart(2, '0');
          finalEmail = `${cleanName}.${cleanLast}${counterStr}@islacascajal.org`;
          counter++;
        }
        
        setFormData(prev => {
          // Solo actualizamos si realmente cambió para evitar ciclos de renderizado
          if (prev.correo !== finalEmail) {
            return { ...prev, correo: finalEmail };
          }
          return prev;
        });
      }
    };

    const timeoutId = setTimeout(generateEmail, 500);
    return () => clearTimeout(timeoutId);
  }, [formData.nombres, formData.primerApellido, isEditing]);

  const handleDocumentChange = (e) => {
    const numbersOnly = e.target.value.replace(/\D/g, "");
    const finalValue = numbersOnly.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    setFormData(prev => ({
      ...prev,
      documento: finalValue,
      password: isEditing ? prev.password : numbersOnly
    }));
  };

  const handleEditarUsuario = async (e) => {
    e.preventDefault();
    setCreando(true);
    try {
      if (editId.uId) {
        await updateDoc(doc(db, "usuarios", editId.uId), {
          nombre: formData.nombre,
          correo: formData.correo,
          rol: formData.rol,
        });
      }
      if (editId.empleadoId) {
        await updateDoc(doc(db, "empleados", editId.empleadoId), {
          nombre: formData.nombre,
          documento: formData.documento,
          correo: formData.correo,
          telefono: formData.telefono,
          direccion: formData.direccion,
          rh: formData.rh,
          cargo: formData.cargo,
          tipoPersonal: formData.tipoPersonal,
          fechaIngreso: formData.fechaIngreso,
          tipoVinculacion: formData.tipoVinculacion,
          tienePeriodoPrueba: formData.tienePeriodoPrueba,
          tiempoPeriodoPrueba: formData.tiempoPeriodoPrueba,
          tipoContrato: formData.tipoContrato,
          tiempoContrato: formData.tiempoContrato,
          fechaTerminacion: formData.fechaTerminacion,
          motivoTerminacion: formData.motivoTerminacion,
          salario: formData.salario,
          modalidadLaboral: formData.modalidadLaboral,
          foto: formData.foto,
          memorandos: formData.memorandos || [],
        });
      }
      toast.success("Personal actualizado correctamente");
      cargarDatos();
      setView("table");
    } catch (err) {
      console.error(err);
      toast.error("Error al actualizar personal");
    } finally {
      setCreando(false);
      setIsEditing(false);
      setPermitirModificarNiup(false);
      setEditId(null);
    }
  };



  const handleEliminarPersonal = async (uId, empleadoId) => {
    if (!window.confirm("¿Estás seguro de que deseas ELIMINAR este personal permanentemente? Esta acción no se puede deshacer.")) return;
    try {
      const result = await eliminarUsuarioInstitucional(uId, empleadoId);
      if (result.success) {
        toast.success("Personal eliminado correctamente");
        cargarDatos();
      } else {
        toast.error(result.error || "Error al eliminar");
      }
    } catch (error) {
      console.error(error);
      toast.error("Error al eliminar personal");
    }
  };

  // ==========================================
  // GENERACIÓN DE DOCUMENTOS (SILENCIOSA)
  // ==========================================

  const generarCarnetPersonal = async (persona) => {
    toast.info("Generando carnet...");
    try {
      const VERIFICACION_BASE_URL = `${window.location.origin}/verificar?doc=`;
      const qrUrl = await QRCode.toDataURL(`${VERIFICACION_BASE_URL}${persona.codigoInstitucional}`);
      setQrPersonal(qrUrl);
      setPersonalReciente(persona);

      await new Promise(resolve => setTimeout(resolve, 600));

      const element = document.getElementById("hidden-carnet-personal");
      if (!element) throw new Error("Template no encontrado");

      const canvas = await html2canvas(element, {
        scale: 4,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff"
      });

      const imgData = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `Carnet_${persona.tipoPersonal}_${persona.nombre.replace(/\s+/g, "_")}.png`;
      link.href = imgData;
      link.click();
      toast.success("Carnet descargado");
    } catch (err) {
      console.error(err);
      toast.error("Error al generar carnet");
    }
  };

  const generarCertificadoPersonal = async (persona) => {
    toast.info("Generando certificado...");
    try {
      setPersonalReciente(persona);
      await new Promise(resolve => setTimeout(resolve, 500));

      const element = document.getElementById("hidden-cert-personal");
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
      const VERIFICACION_BASE_URL = `${window.location.origin}/verificar?doc=`;
      const qrDataUrl = await QRCode.toDataURL(`${VERIFICACION_BASE_URL}${persona.codigoInstitucional}`);
      const qrSize = 35;
      const marginX = pdfWidth - qrSize - 20;
      const marginY = pdf.internal.pageSize.getHeight() - qrSize - 30;

      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(marginX - 2, marginY - 2, qrSize + 4, qrSize + 4, 3, 3, 'F');
      pdf.addImage(qrDataUrl, "PNG", marginX, marginY, qrSize, qrSize);

      pdf.save(`Certificado_${persona.tipoPersonal}_${persona.nombre.replace(/\s+/g, "_")}.pdf`);
      toast.success("Certificado descargado");
    } catch (err) {
      console.error(err);
      toast.error("Error al generar PDF");
    }
  };

  const resetForm = () => {
    setFormData({
      nombre: "", documento: "", correo: "", telefono: "", direccion: "", rh: "", cargo: "",
      tipoPersonal: "Empleado", fechaIngreso: new Date().toISOString().split("T")[0],
      estado: "activo", rol: "empleado", password: "", modalidadLaboral: "Presencial",
      diasTeletrabajo: "", afiliarAutomaticamente: false, beneficiarios: [], mascotas: [], foto: null,
      horarioModalidad: HORARIO_DEFAULT
    });
    setFotoPreview(null);
    setPersonalReciente(null);
    setView("create");
  };

  const usuariosFiltrados = usuarios.filter((u) => {
    const query = searchQuery.toLowerCase();
    return (
      u.nombre?.toLowerCase().includes(query) ||
      u.correo?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="border-b bg-card sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <Image src="/logo.png" alt="Logo" width={36} height={36} className="rounded-full" />
            <div>
              <h1 className="font-semibold text-foreground text-sm leading-tight">Módulo de Personal</h1>
              <p className="text-xs text-muted-foreground">Institucional</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={cargarDatos} title="Recargar">
              <RefreshCcw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4 mr-2" /> Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-6xl">

        {/* ================================================== */}
        {/* VISTA: TABLA DASHBOARD PERSONAL */}
        {/* ================================================== */}
        {view === "table" && (
          <div className="space-y-6">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                  <Briefcase className="h-7 w-7 text-primary" />
                  Directorio de Personal
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Administra accesos, roles, cargos e información institucional de los colaboradores.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre o correo..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-10 bg-card border-primary/20 focus-visible:ring-primary shadow-sm"
                  />
                </div>
                <Button onClick={() => setView("create")} className="gap-2 shrink-0 h-10 w-full sm:w-auto shadow-sm">
                  <UserPlus className="h-4 w-4" /> Nuevo Personal
                </Button>
              </div>
            </div>

            {cargandoUsuarios || cargandoPersonal ? (
              <div className="flex justify-center py-12"><Spinner className="h-8 w-8 text-primary" /></div>
            ) : (
              <Card>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Colaborador</TableHead>
                        <TableHead>Rol / Cargo</TableHead>
                        <TableHead>Modalidad / Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usuariosFiltrados.map((u) => {
                        const personal = u.empleadoId ? personalList.find(p => p.id === u.empleadoId) : {
                          id: null,
                          nombre: u.nombre,
                          documento: "No Registrado",
                          cargo: "Administrador / RRHH",
                          tipoPersonal: u.rol,
                          codigoInstitucional: u.uid?.substring(0, 8),
                          fechaIngreso: new Date().toISOString().split("T")[0],
                          horarioModalidad: HORARIO_DEFAULT,
                          isMock: true
                        };

                        return (
                          <TableRow key={u.id} className={u.activo === false ? "opacity-60 bg-muted/20" : ""}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                {personal?.foto ? (
                                  <img src={personal.foto} alt="" className="w-10 h-10 rounded-full object-cover border" />
                                ) : (
                                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                    <User className="h-5 w-5 text-primary" />
                                  </div>
                                )}
                                <div className="flex flex-col">
                                  <span className="font-semibold text-sm">{u.nombre}</span>
                                  <span className="text-xs text-muted-foreground">{u.correo}</span>
                                  <span className="text-[10px] text-muted-foreground">ID: {personal?.documento || "—"}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1 items-start">
                                <Badge variant="outline" className={
                                  u.rol === 'superadmin' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                                    u.rol === 'recursos_humanos' ? 'bg-primary/10 text-primary border-primary/20' :
                                      'bg-muted'
                                }>
                                  {u.rol}
                                </Badge>
                                {personal?.memorandos?.filter(m => typeof m === 'string' && m.trim() !== "").length > 0 && (
                                  <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[9px] mt-1 flex gap-1 items-center w-fit">
                                    <AlertCircle className="w-3 h-3" />
                                    {personal.memorandos.filter(m => typeof m === 'string' && m.trim() !== "").length} Memorando(s)
                                  </Badge>
                                )}
                                {personal && (
                                  <span className="text-xs text-muted-foreground font-medium flex items-center gap-1 mt-1" title={personal.cargo}>
                                    <Briefcase className="h-3 w-3" /> {personal.cargo} ({personal.tipoPersonal})
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-2 items-start">
                                {u.activo !== false ? (
                                  <Badge className="bg-success text-white border-none text-[10px] uppercase">Activo</Badge>
                                ) : (
                                  <Badge variant="destructive" className="text-[10px] uppercase">Bloqueado</Badge>
                                )}
                                {personal && !personal.isMock && (
                                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                                    {personal.modalidadLaboral === "Teletrabajo" ? <Monitor className="w-3 h-3" /> : <Building className="w-3 h-3" />}
                                    {personal.modalidadLaboral}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                {personal && (
                                  <>
                                    <Button variant="ghost" size="icon" onClick={() => abrirEdicion(u, personal)} title="Editar Personal" className="text-warning hover:bg-warning/10">
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => { if(!personal.isMock) { setEmpleadoSeleccionado(personal); setHorarioEdit(personal.horarioModalidad); } else { toast.info("Super Admins no tienen gestión de horario."); } }} title="Gestionar Horario">
                                      <CalendarDays className="h-4 w-4 text-primary" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => generarCarnetPersonal(personal)} title="Descargar Carnet">
                                      <QrCode className="h-4 w-4 text-info" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => generarCertificadoPersonal(personal)} title="Descargar Certificado">
                                      <FileText className="h-4 w-4 text-success" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleToggleEstado(u.empleadoId, u.id, personal?.estado || "activo")}
                                      title={personal?.estado === "inactivo" ? "Habilitar Empleado" : "Inhabilitar Empleado"}
                                      className={personal?.estado === "inactivo" ? "text-success hover:bg-success/10" : "text-orange-500 hover:bg-orange-500/10"}
                                    >
                                      {personal?.estado === "inactivo" ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                                    </Button>
                                  </>
                                )}
                                <Button variant="ghost" size="icon" onClick={() => handleEliminarPersonal(u.id, u.empleadoId)} title="Eliminar Personal" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {usuariosFiltrados.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                            No se encontraron registros.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ================================================== */}
        {/* VISTA: CREAR PERSONAL */}
        {/* ================================================== */}
        {view === "create" && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4 border-b pb-4">
              <Button variant="ghost" size="icon" onClick={() => setView("table")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h2 className="text-2xl font-bold text-foreground">
                  {isEditing ? "Actualizar Información de Personal" : "Registrar Nuevo Personal"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {isEditing ? "Edite los datos administrativos del trabajador." : "Llene los datos administrativos para habilitar un nuevo trabajador."}
                </p>
              </div>
            </div>

            <Card>
              <CardContent className="p-6">
                <form onSubmit={isEditing ? handleEditarUsuario : handleCrearUsuario} className="space-y-8">
                  {/* FOTO Y DATOS BÁSICOS */}
                  <div className="flex flex-col md:flex-row gap-8">
                    <div className="flex flex-col items-center gap-3 shrink-0">
                      <div className="relative w-32 h-32 rounded-xl overflow-hidden border-2 border-dashed bg-muted flex items-center justify-center group cursor-pointer hover:border-primary transition-colors">
                        {fotoPreview ? (
                          <img src={fotoPreview} alt="Foto" className="w-full h-full object-cover" />
                        ) : (
                          <UserPlus className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
                        )}
                        <input type="file" accept="image/*" required={!isEditing && !fotoPreview} onChange={handleFotoChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                      </div>
                      <p className="text-xs text-muted-foreground font-medium">Foto oficial (requerida)*</p>
                    </div>

                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase text-muted-foreground">Nombres *</label>
                        <Input required value={formData.nombres} onChange={e => handleNameChange("nombres", e.target.value)} placeholder="Ej. Juan Carlos" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase text-muted-foreground">Primer Apellido *</label>
                        <Input required value={formData.primerApellido} onChange={e => handleNameChange("primerApellido", e.target.value)} placeholder="Ej. Pérez" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase text-muted-foreground">Segundo Apellido</label>
                        <Input value={formData.segundoApellido} onChange={e => handleNameChange("segundoApellido", e.target.value)} placeholder="Ej. Gómez (Opcional)" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase text-muted-foreground flex items-center justify-between">
                          <span>Documento (NIUP) *</span>
                          {isEditing && !permitirModificarNiup && (
                            <button
                              type="button"
                              onClick={() => {
                                const seguro = window.confirm("¿Está seguro de que desea modificar el NIUP? Esto cambiará el número de documento de este personal.");
                                if (seguro) {
                                  setPermitirModificarNiup(true);
                                }
                              }}
                              className="text-xs font-semibold text-amber-500 hover:text-amber-600 hover:underline cursor-pointer"
                            >
                              Modificar NIUP
                            </button>
                          )}
                        </label>
                        <Input 
                          required 
                          value={formData.documento} 
                          onChange={handleDocumentChange} 
                          placeholder="1.234.567.890" 
                          disabled={isEditing && !permitirModificarNiup} 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase text-muted-foreground">Teléfono</label>
                        <Input value={formData.telefono} onChange={e => setFormData({ ...formData, telefono: e.target.value })} placeholder="300 000 0000" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase text-muted-foreground">Dirección</label>
                        <Input value={formData.direccion} onChange={e => setFormData({ ...formData, direccion: e.target.value })} placeholder="Ej. Calle 1 # 2-3" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase text-muted-foreground">RH</label>
                        <Select value={formData.rh} onValueChange={v => setFormData({ ...formData, rh: v })}>
                          <SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="O+">O+</SelectItem><SelectItem value="O-">O-</SelectItem>
                            <SelectItem value="A+">A+</SelectItem><SelectItem value="A-">A-</SelectItem>
                            <SelectItem value="B+">B+</SelectItem><SelectItem value="B-">B-</SelectItem>
                            <SelectItem value="AB+">AB+</SelectItem><SelectItem value="AB-">AB-</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* INFORMACIÓN INSTITUCIONAL */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-primary border-b pb-2 flex items-center gap-2"><Building className="w-4 h-4" /> Cargo y Funciones</h3>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-xs font-semibold uppercase text-muted-foreground">Tipo de Personal *</label>
                          <Select value={formData.tipoPersonal} onValueChange={v => setFormData({ ...formData, tipoPersonal: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {TIPOS_PERSONAL.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-semibold uppercase text-muted-foreground">Cargo Oficial *</label>
                          <Input required value={formData.cargo} onChange={e => setFormData({ ...formData, cargo: e.target.value })} placeholder="Ej. Coordinador de Proyectos" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-semibold uppercase text-muted-foreground">Modalidad Laboral</label>
                          <Select value={formData.modalidadLaboral} onValueChange={v => setFormData({ ...formData, modalidadLaboral: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Presencial">Presencial</SelectItem>
                              <SelectItem value="Teletrabajo">Teletrabajo</SelectItem>
                              <SelectItem value="Híbrido">Híbrido</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* ACCESOS AL SISTEMA */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-primary border-b pb-2 flex items-center gap-2"><Lock className="w-4 h-4" /> Acceso al Sistema</h3>
                      <div className="space-y-4 bg-muted/30 p-4 rounded-lg border border-dashed">
                        <div className="space-y-2">
                          <label className="text-xs font-semibold uppercase text-muted-foreground">Correo de Ingreso *</label>
                          <Input required type="email" value={formData.correo} onChange={e => setFormData({ ...formData, correo: e.target.value })} placeholder="usuario@islacascajal.org" disabled={isEditing} />
                        </div>
                        {!isEditing && (
                          <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase text-muted-foreground">Contraseña Inicial *</label>
                            <div className="relative">
                              <Input required type={showPassword ? "text" : "password"} value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} placeholder="Min. 4 caracteres" />
                              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          </div>
                        )}
                        <div className="space-y-2">
                          <label className="text-xs font-semibold uppercase text-muted-foreground">Rol de Permisos *</label>
                          <Select value={formData.rol} onValueChange={v => setFormData({ ...formData, rol: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="empleado">Empleado</SelectItem>
                              <SelectItem value="recursos_humanos">Recursos Humanos</SelectItem>
                              {esSuperAdmin && <SelectItem value="superadmin">Súper Administrador</SelectItem>}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* INFORMACION CONTRACTUAL */}
                  <div className="pt-8 border-t">
                    <h3 className="text-sm font-bold text-primary border-b pb-2 flex items-center gap-2 mb-4"><Briefcase className="w-4 h-4" /> Información Contractual</h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 bg-muted/10 p-5 rounded-xl border">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase text-muted-foreground">Tipo de Vinculación</label>
                        <Select value={formData.tipoVinculacion} onValueChange={v => setFormData({ ...formData, tipoVinculacion: v, tiempoContrato: "", tiempoPeriodoPrueba: "" })}>
                          <SelectTrigger><SelectValue placeholder="Seleccione..."/></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Contrato">Contrato</SelectItem>
                            <SelectItem value="Nombramiento">Nombramiento</SelectItem>
                            <SelectItem value="Periodo de Prueba">Período de Prueba</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {/* Tipo de contrato: solo visible si es Contrato o Nombramiento */}
                      {(formData.tipoVinculacion === "Contrato" || formData.tipoVinculacion === "Nombramiento") && (
                        <div className="space-y-2 animate-in fade-in zoom-in duration-200">
                          <label className="text-xs font-semibold uppercase text-muted-foreground">Tipo de Contrato</label>
                          <Select value={formData.tipoContrato} onValueChange={v => setFormData({ ...formData, tipoContrato: v })}>
                            <SelectTrigger><SelectValue placeholder="Seleccione..."/></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="A Término Fijo">A Término Fijo</SelectItem>
                              <SelectItem value="A Término Indefinido">A Término Indefinido</SelectItem>
                              <SelectItem value="De Obra o Labor">De Obra o Labor</SelectItem>
                              <SelectItem value="Por Prestación de Servicios">Por Prestación de Servicios</SelectItem>
                              <SelectItem value="Ocasional, Accidental o Transitorio">Ocasional, Accidental o Transitorio</SelectItem>
                              <SelectItem value="De Aprendizaje">De Aprendizaje</SelectItem>
                              <SelectItem value="De Prácticas">De Prácticas</SelectItem>
                              <SelectItem value="De Pasantías">De Pasantías</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Tiempo del período de prueba: 1-20 días */}
                      {formData.tipoVinculacion === "Periodo de Prueba" && (
                        <div className="space-y-2 animate-in fade-in zoom-in duration-200">
                          <label className="text-xs font-semibold uppercase text-muted-foreground">Tiempo del Período de Prueba</label>
                          <Select value={formData.tiempoPeriodoPrueba} onValueChange={v => setFormData({ ...formData, tiempoPeriodoPrueba: v })}>
                            <SelectTrigger><SelectValue placeholder="Seleccione días..."/></SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 20 }, (_, i) => i + 1).map(d => (
                                <SelectItem key={d} value={String(d)}>{d} {d === 1 ? "día" : "días"}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Tiempo del contrato: 1-60 meses, solo para Contrato o Nombramiento */}
                      {(formData.tipoVinculacion === "Contrato" || formData.tipoVinculacion === "Nombramiento") && (
                        <div className="space-y-2 animate-in fade-in zoom-in duration-200">
                          <label className="text-xs font-semibold uppercase text-muted-foreground">Tiempo del Contrato</label>
                          <Select value={formData.tiempoContrato} onValueChange={v => setFormData({ ...formData, tiempoContrato: v })}>
                            <SelectTrigger><SelectValue placeholder="Seleccione meses..."/></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Indefinido">Indefinido</SelectItem>
                              {Array.from({ length: 60 }, (_, i) => i + 1).map(m => (
                                <SelectItem key={m} value={String(m)}>{m} {m === 1 ? "mes" : "meses"}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase text-muted-foreground">Salario u Honorario</label>
                        <Input 
                          value={formData.salario} 
                          onChange={e => {
                            let val = e.target.value.replace(/\D/g, "");
                            if (!val) {
                              setFormData({ ...formData, salario: "" });
                            } else {
                              const formatted = "$ " + parseInt(val, 10).toLocaleString("es-CO");
                              setFormData({ ...formData, salario: formatted });
                            }
                          }} 
                          placeholder="Ej. $ 1.500.000" 
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase text-muted-foreground">Fecha de Ingreso *</label>
                        <Input required type="date" value={formData.fechaIngreso} onChange={e => setFormData({ ...formData, fechaIngreso: e.target.value })} />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase text-muted-foreground">Fecha de Terminación</label>
                        <Input type="date" value={formData.fechaTerminacion} onChange={e => setFormData({ ...formData, fechaTerminacion: e.target.value })} />
                      </div>

                      {formData.fechaTerminacion && (
                        <div className="space-y-2 md:col-span-2 lg:col-span-3 animate-in fade-in zoom-in duration-200">
                          <label className="text-xs font-semibold uppercase text-muted-foreground">Motivo de Terminación</label>
                          <Input value={formData.motivoTerminacion} onChange={e => setFormData({ ...formData, motivoTerminacion: e.target.value })} placeholder="Razón o motivo de la terminación..." />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* HORARIO SEMANAL */}
                  <div className="pt-8 border-t">
                    <div className="space-y-4 bg-muted/10 p-5 rounded-xl border border-dashed">
                      <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                        <CalendarDays className="w-4 h-4" /> Horario y Modalidad Semanal
                      </h3>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold mb-4">Configure la jornada y modalidad por cada día</p>

                      <div className="flex flex-col space-y-3">
                        {DIAS_SEMANA.map((dia) => (
                          <div key={dia} className="flex flex-col md:flex-row md:items-center justify-between bg-card p-4 rounded-lg border shadow-sm gap-4 transition-colors hover:bg-muted/30">
                            <div className="w-full md:w-32 font-black uppercase text-primary text-sm border-b md:border-b-0 pb-1 md:pb-0">
                              {dia}
                            </div>

                            <div className="w-full md:w-48 shrink-0">
                              <Select
                                value={formData.horarioModalidad[dia].modalidad}
                                onValueChange={(v) => setFormData({
                                  ...formData,
                                  horarioModalidad: {
                                    ...formData.horarioModalidad,
                                    [dia]: { ...formData.horarioModalidad[dia], modalidad: v }
                                  }
                                })}
                              >
                                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="presencial">Presencial</SelectItem>
                                  <SelectItem value="teletrabajo">Teletrabajo</SelectItem>
                                  <SelectItem value="libre">No Laboral</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="flex-1 flex justify-end w-full">
                              {formData.horarioModalidad[dia].modalidad !== "libre" ? (
                                <div className="flex flex-row gap-4 items-center w-full lg:w-auto bg-muted/20 lg:bg-transparent p-2 lg:p-0 rounded-md">
                                  <div className="flex items-center gap-2 w-1/2 lg:w-auto justify-between lg:justify-start">
                                    <label className="text-xs font-bold text-muted-foreground uppercase">Entrada</label>
                                    <Input
                                      type="time"
                                      className="w-[120px] lg:w-[130px] h-9 text-sm"
                                      value={formData.horarioModalidad[dia].entrada}
                                      onChange={(e) => setFormData({
                                        ...formData,
                                        horarioModalidad: {
                                          ...formData.horarioModalidad,
                                          [dia]: { ...formData.horarioModalidad[dia], entrada: e.target.value }
                                        }
                                      })}
                                    />
                                  </div>
                                  <div className="flex items-center gap-2 w-1/2 lg:w-auto justify-between lg:justify-start border-l lg:border-l-0 pl-3 lg:pl-0 border-muted-foreground/20">
                                    <label className="text-xs font-bold text-muted-foreground uppercase">Salida</label>
                                    <Input
                                      type="time"
                                      className="w-[120px] lg:w-[130px] h-9 text-sm"
                                      value={formData.horarioModalidad[dia].salida}
                                      onChange={(e) => setFormData({
                                        ...formData,
                                        horarioModalidad: {
                                          ...formData.horarioModalidad,
                                          [dia]: { ...formData.horarioModalidad[dia], salida: e.target.value }
                                        }
                                      })}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div className="w-full lg:w-auto text-center lg:text-right text-sm text-muted-foreground italic py-2 lg:py-0">
                                  Día de descanso
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-6">
                    <div className="flex items-start space-x-3 bg-primary/5 p-4 rounded-lg border border-primary/20">
                      <Checkbox
                        id="afiliarAuto"
                        checked={formData.afiliarAutomaticamente}
                        onCheckedChange={(c) => {
                          const isAuto = !!c;
                          setFormData(prev => ({
                            ...prev,
                            afiliarAutomaticamente: isAuto,
                            beneficiarios: isAuto && prev.beneficiarios.length === 0 ? Array.from({ length: 5 }, () => ({ nombre: "", nuip: "" })) : prev.beneficiarios,
                            mascotas: isAuto && prev.mascotas.length === 0 ? Array.from({ length: 2 }, () => ({ nombre: "", tipo: "", raza: "" })) : prev.mascotas
                          }));
                        }}
                      />
                      <div className="space-y-1 leading-none w-full">
                        <label htmlFor="afiliarAuto" className="text-sm font-bold text-primary cursor-pointer">
                          Afiliar automáticamente a la fundación
                        </label>
                        <p className="text-xs text-muted-foreground">
                          Si activas esto, el trabajador también obtendrá beneficios institucionales. La afiliación se marcará como indefinida mientras el empleado siga activo en la institución.
                        </p>

                        {formData.afiliarAutomaticamente && (
                          <div className="mt-4 space-y-6 bg-background/50 p-4 rounded-xl border border-primary/10">
                            {/* Beneficiarios */}
                            <div className="space-y-3">
                              <p className="text-xs font-black uppercase text-primary flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                Beneficiarios
                              </p>
                              {formData.beneficiarios?.map((ben, idx) => (
                                <div key={idx} className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-card p-3 rounded-lg border shadow-sm">
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Nombre Completo</label>
                                    <Input
                                      value={ben.nombre}
                                      onChange={(e) => handleBeneficiarioChange(idx, "nombre", e.target.value)}
                                      className="h-8 text-xs"
                                      placeholder={`Beneficiario ${idx + 1}`}
                                      disabled={creando}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Documento (NUIP)</label>
                                    <Input
                                      value={ben.nuip}
                                      onChange={(e) => handleBeneficiarioChange(idx, "nuip", e.target.value)}
                                      className="h-8 text-xs"
                                      placeholder="Opcional"
                                      disabled={creando}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Mascotas */}
                            <div className="space-y-3">
                              <p className="text-xs font-black uppercase text-primary flex items-center gap-2">
                                <PawPrint className="h-4 w-4" />
                                Mascotas (Plan Integra)
                              </p>
                              {formData.mascotas?.map((mascota, idx) => (
                                <div key={idx} className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-card p-3 rounded-lg border shadow-sm">
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Nombre</label>
                                    <Input
                                      value={mascota.nombre}
                                      onChange={(e) => handleMascotaChange(idx, "nombre", e.target.value)}
                                      className="h-8 text-xs"
                                      placeholder={`Mascota ${idx + 1}`}
                                      disabled={creando}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Tipo de Animal</label>
                                    <Input
                                      value={mascota.tipo}
                                      onChange={(e) => handleMascotaChange(idx, "tipo", e.target.value)}
                                      className="h-8 text-xs"
                                      placeholder="Ej: Perro, Gato"
                                      disabled={creando}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Raza (Opcional)</label>
                                    <Input
                                      value={mascota.raza}
                                      onChange={(e) => handleMascotaChange(idx, "raza", e.target.value)}
                                      className="h-8 text-xs"
                                      placeholder="Raza"
                                      disabled={creando}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ANOTACIONES DE MEMORANDO */}
                  <div className="pt-8 border-t">
                    <h3 className="text-sm font-bold text-destructive border-b pb-2 flex items-center gap-2 mb-4">
                      <AlertCircle className="w-4 h-4" /> Anotaciones de Memorando
                    </h3>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold mb-4">Máximo tres anotaciones formales. Se visualizarán en el expediente.</p>
                    
                    <div className="space-y-3">
                      {[0, 1, 2].map((idx) => (
                        <div key={idx} className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold uppercase text-muted-foreground">Memorando {idx + 1}</label>
                          <Input
                            value={formData.memorandos?.[idx] || ""}
                            onChange={(e) => {
                              const newMemorandos = [...(formData.memorandos || [])];
                              newMemorandos[idx] = e.target.value;
                              setFormData({ ...formData, memorandos: newMemorandos });
                            }}
                            placeholder={idx === 0 ? "Ej. Llamado de atención por llegadas tarde..." : "Opcional"}
                            disabled={creando}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-6 border-t">
                    <Button type="button" variant="outline" onClick={() => { setView("table"); setIsEditing(false); setPermitirModificarNiup(false); setEditId(null); }} disabled={creando}>Cancelar</Button>
                    <Button type="submit" className="min-w-[150px]" disabled={creando}>
                      {creando ? <Spinner className="w-4 h-4 mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                      {isEditing ? "Actualizar Personal" : "Crear Personal"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ================================================== */}
        {/* VISTA: CONFIRMACIÓN (SUCCESS) */}
        {/* ================================================== */}
        {view === "success" && personalReciente && (
          <div className="max-w-2xl mx-auto py-12">
            <Card className="text-center border-success/20 shadow-lg shadow-success/5 overflow-hidden">
              <div className="bg-success/10 py-8 flex flex-col items-center">
                <div className="w-16 h-16 bg-success rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-2xl font-black text-success uppercase">Personal Registrado Exitosamente</h2>
                <p className="text-muted-foreground">Se han generado los accesos y credenciales.</p>
              </div>

              <CardContent className="p-8">
                <div className="bg-muted/30 border rounded-xl p-6 text-left grid grid-cols-2 gap-y-4 gap-x-8 mb-8">
                  <div><p className="text-xs text-muted-foreground uppercase font-bold">Nombre</p><p className="font-medium text-sm">{personalReciente.nombre}</p></div>
                  <div><p className="text-xs text-muted-foreground uppercase font-bold">NIUP</p><p className="font-medium text-sm">{personalReciente.documento}</p></div>
                  <div><p className="text-xs text-muted-foreground uppercase font-bold">Cargo</p><p className="font-medium text-sm text-primary">{personalReciente.cargo} ({personalReciente.tipoPersonal})</p></div>
                  <div><p className="text-xs text-muted-foreground uppercase font-bold">Código Institucional</p><p className="font-medium text-sm">{personalReciente.codigoInstitucional}</p></div>
                  <div><p className="text-xs text-muted-foreground uppercase font-bold">Estado</p><Badge className="bg-success text-white">ACTIVO</Badge></div>
                  <div><p className="text-xs text-muted-foreground uppercase font-bold">Afiliación</p><p className="font-medium text-sm">{personalReciente.afiliarAutomaticamente ? "✅ Activa (Indefinida)" : "❌ No requerida"}</p></div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Button onClick={() => generarCarnetPersonal(personalReciente)} className="h-12 w-full gap-2 text-base font-semibold shadow-md border border-black" style={{ backgroundColor: COLORS.azul }}>
                    <QrCode className="h-5 w-5" /> Descargar Carnet
                  </Button>
                  <Button onClick={() => generarCertificadoPersonal(personalReciente)} variant="outline" className="h-12 w-full gap-2 text-base font-semibold shadow-sm border-2" style={{ borderColor: COLORS.verde, color: COLORS.verde }}>
                    <FileText className="h-5 w-5" /> Descargar Certificado
                  </Button>
                  <Button onClick={() => setView("table")} variant="ghost" className="h-12 w-full gap-2 col-span-1 sm:col-span-2 mt-4 text-muted-foreground">
                    <ArrowLeft className="h-4 w-4" /> Volver al Directorio
                  </Button>
                  <Button onClick={resetForm} variant="ghost" className="h-12 w-full gap-2 col-span-1 sm:col-span-2 text-muted-foreground">
                    <UserPlus className="h-4 w-4" /> Ingresar Otro
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* DIALOGO: EDITAR HORARIO */}
        <Dialog open={!!empleadoSeleccionado} onOpenChange={(open) => !open && setEmpleadoSeleccionado(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                Gestionar Horario Institucional
              </DialogTitle>
              <DialogDescription>
                Configure la jornada semanal para <strong>{empleadoSeleccionado?.nombre}</strong>.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col space-y-3 max-h-[60vh] overflow-y-auto pr-2">
              {DIAS_SEMANA.map((dia) => (
                <div key={dia} className="flex flex-col md:flex-row md:items-center justify-between bg-muted/30 p-3 rounded-lg border border-dashed gap-3 transition-colors hover:bg-muted/50">
                  <div className="w-full md:w-28 font-black uppercase text-primary text-sm border-b md:border-b-0 pb-1 md:pb-0">
                    {dia}
                  </div>

                  <div className="w-full md:w-40">
                    <Select
                      value={horarioEdit[dia]?.modalidad}
                      onValueChange={(v) => setHorarioEdit({
                        ...horarioEdit,
                        [dia]: { ...horarioEdit[dia], modalidad: v }
                      })}
                    >
                      <SelectTrigger className="bg-card h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="presencial">Presencial</SelectItem>
                        <SelectItem value="teletrabajo">Teletrabajo</SelectItem>
                        <SelectItem value="libre">No Laboral</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex-1 flex justify-end">
                    {horarioEdit[dia]?.modalidad !== "libre" ? (
                      <div className="flex flex-row gap-4 items-center w-full md:w-auto bg-card md:bg-transparent p-2 md:p-0 rounded-md border md:border-0 shadow-sm md:shadow-none">
                        <div className="flex items-center gap-2 w-1/2 md:w-auto justify-between md:justify-start">
                          <label className="text-xs font-bold text-muted-foreground uppercase">Entrada</label>
                          <Input
                            type="time"
                            className="w-[110px] sm:w-[130px] h-9 text-sm"
                            value={horarioEdit[dia]?.entrada}
                            onChange={(e) => setHorarioEdit({
                              ...horarioEdit,
                              [dia]: { ...horarioEdit[dia], entrada: e.target.value }
                            })}
                          />
                        </div>
                        <div className="flex items-center gap-2 w-1/2 md:w-auto justify-between md:justify-start border-l md:border-l-0 pl-3 md:pl-0 border-muted-foreground/20">
                          <label className="text-xs font-bold text-muted-foreground uppercase">Salida</label>
                          <Input
                            type="time"
                            className="w-[110px] sm:w-[130px] h-9 text-sm"
                            value={horarioEdit[dia]?.salida}
                            onChange={(e) => setHorarioEdit({
                              ...horarioEdit,
                              [dia]: { ...horarioEdit[dia], salida: e.target.value }
                            })}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="w-full md:w-auto text-center md:text-right text-sm text-muted-foreground italic py-2 md:py-0">
                        Día de descanso
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setEmpleadoSeleccionado(null)}>Cancelar</Button>
              <Button
                onClick={async () => {
                  setGuardandoHorario(true);
                  try {
                    await actualizarModalidad(empleadoSeleccionado.id, horarioEdit);
                    await registrarAuditoria({
                      user, userData,
                      accion: "Actualizar Horario",
                      documentoId: empleadoSeleccionado.id,
                      detalles: `Se actualizó horario semanal de ${empleadoSeleccionado.nombre}`
                    });
                    toast.success("Horario actualizado correctamente");
                    setEmpleadoSeleccionado(null);
                    cargarDatos();
                  } catch (e) {
                    toast.error("Error al guardar el horario");
                  } finally {
                    setGuardandoHorario(false);
                  }
                }}
                disabled={guardandoHorario}
              >
                {guardandoHorario ? <Spinner className="w-4 h-4 mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Guardar Horario
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>

      {/* ================================================== */}
      {/* TEMPLATES OCULTOS PARA GENERACIÓN SILENCIOSA */}
      {/* ================================================== */}
      <div style={{ position: "fixed", left: "-9999px", top: 0, zIndex: -1 }}>
        {personalReciente && (
          <>
            {/* Template de Carnet de Personal */}
            <div
              id="hidden-carnet-personal"
              style={{ width: '380px', height: '580px', background: '#ffffff', position: 'relative', overflow: 'hidden', borderRadius: '32px', fontFamily: 'sans-serif' }}
            >
              {/* Decoración Superior Tierra */}
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '180px', overflow: 'hidden', background: `linear-gradient(135deg, #5c4033 0%, #8b5a2b 100%)` }}>
              </div>

              {/* Logo y Encabezado */}
              <div style={{ position: 'relative', zIndex: 10, paddingTop: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ backgroundColor: '#ffffff', padding: '8px', borderRadius: '9999px', marginBottom: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                  <img src="/logo.png" alt="Logo" style={{ width: '60px', height: '60px', borderRadius: '9999px' }} />
                </div>
                <h2 style={{ color: '#ffffff', fontWeight: 900, fontSize: '24px', margin: 0, textShadow: '0 2px 4px rgba(0,0,0,0.5)', letterSpacing: '-0.05em' }}>ISLA CASCAJAL</h2>
                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '2px', marginTop: '4px' }}>Fundación</p>
              </div>

              {/* Foto de Perfil y Badge LÍDER */}
              <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '24px' }}>
                <div style={{ position: 'relative', width: '160px', height: '160px', borderRadius: '24px', border: '6px solid #ffffff', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', backgroundColor: '#f1f5f9' }}>
                  {personalReciente.foto ? (
                    <img src={personalReciente.foto} alt="Foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '-20px', position: 'relative', zIndex: 20, padding: '6px 32px', borderRadius: '9999px', border: '2px solid #ffffff', backgroundColor: '#5c4033', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                  <span style={{ color: '#ffffff', fontWeight: 900, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '2px' }}>LÍDER</span>
                </div>
              </div>

              {/* Información Personal */}
              <div style={{ marginTop: '16px', padding: '0 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '96px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 900, textTransform: 'uppercase', color: '#1e293b', margin: 0, lineHeight: 1.1 }}>
                  {personalReciente.nombre}
                </h3>
                <p style={{ fontWeight: 'bold', fontSize: '12px', color: '#8b5a2b', marginTop: '4px', textTransform: 'uppercase', margin: '4px 0 0 0' }}>
                  {personalReciente.cargo}
                </p>

                <div style={{ marginTop: '16px', width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', textAlign: 'left' }}>
                  <div>
                    <p style={{ fontSize: '9px', fontWeight: 900, color: '#94a3b8', margin: 0, textTransform: 'uppercase' }}>NIUP</p>
                    <p style={{ fontSize: '14px', fontWeight: 900, color: '#334155', margin: 0, fontFamily: 'monospace', letterSpacing: '-0.05em' }}>{personalReciente.documento}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '9px', fontWeight: 900, color: '#94a3b8', margin: 0, textTransform: 'uppercase' }}>RH</p>
                    <p style={{ fontSize: '14px', fontWeight: 900, color: '#334155', margin: 0, textTransform: 'uppercase' }}>{personalReciente.rh || "—"}</p>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <p style={{ fontSize: '9px', fontWeight: 900, color: '#94a3b8', margin: 0, textTransform: 'uppercase' }}>CÓDIGO INSTITUCIONAL</p>
                    <p style={{ fontSize: '16px', fontWeight: 900, color: '#8b5a2b', margin: 0, fontFamily: 'monospace', letterSpacing: '-0.05em' }}>{personalReciente.codigoInstitucional}</p>
                  </div>
                </div>
              </div>

              {/* Bottom Area (QR and Footer) */}
              <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', paddingTop: '16px', paddingBottom: '24px', paddingLeft: '40px', paddingRight: '24px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <p style={{ fontSize: '10px', fontWeight: 900, color: '#5c4033', margin: 0 }}>@fundacionislacascajal</p>
                </div>

                <div style={{ backgroundColor: '#ffffff', padding: '4px', borderRadius: '8px', border: '2px solid #8b5a2b', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                  {qrPersonal ? (
                    <img src={qrPersonal} alt="QR" style={{ width: '70px', height: '70px' }} />
                  ) : (
                    <QrCode style={{ width: '70px', height: '70px', opacity: 0.2 }} />
                  )}
                </div>
              </div>

              {/* Franjas de color decorativas (Tierra) */}
              <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '6px', display: 'flex' }}>
                <div style={{ flex: 1, backgroundColor: '#3e2723' }} />
                <div style={{ flex: 1, backgroundColor: '#5c4033' }} />
                <div style={{ flex: 1, backgroundColor: '#8b5a2b' }} />
                <div style={{ flex: 1, backgroundColor: '#cd853f' }} />
              </div>
            </div>

            {/* Template de Certificado Laboral / Personal */}
            <div
              id="hidden-cert-personal"
              style={{ width: "800px", padding: "80px", background: "white", fontFamily: "'Times New Roman', serif", color: "#1a1a1a", lineHeight: "1.6", boxSizing: "border-box" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px", borderBottom: `2px solid ${COLORS.azul}`, paddingBottom: "15px" }}>
                <img src="/logo.png" alt="Logo" style={{ width: "90px", height: "90px", borderRadius: "50%" }} />
                <div style={{ textAlign: "right" }}>
                  <h1 style={{ fontSize: "24px", fontWeight: "900", margin: 0, color: COLORS.azul }}>FUNDACIÓN ISLA CASCAJAL</h1>
                  <p style={{ fontSize: "10px", fontWeight: "bold", margin: 0, color: "#666", textTransform: "uppercase" }}>NIT: 900.248.351-0</p>
                </div>
              </div>

              <div style={{ fontSize: "16px", textAlign: "justify" }}>
                <p>La Fundación Isla Cascajal certifica que reconoce a:</p>
                
                <p style={{ fontSize: "20px", fontWeight: "900", textAlign: "center", margin: "25px 0", textTransform: "uppercase" }}>
                  {personalReciente.nombre}
                </p>
                
                <p>
                  con identificación número <strong>{personalReciente.documento}</strong>, y vinculación a nuestra institución bajo la modalidad de <strong>{personalReciente.tipoContrato || personalReciente.tipoVinculacion || "Contrato"}</strong> y con el código <strong>{personalReciente.codigoInstitucional}</strong>.
                </p>
                
                <p>
                  La orientación de sus funciones institucionales se asocian propiamente a las que corresponden al cargo de <strong>{personalReciente.cargo}</strong>.
                </p>
                
                <div style={{ marginTop: "30px", marginBottom: "30px", fontWeight: "bold" }}>
                  <p>FECHA DE INGRESO: {personalReciente.fechaIngreso}</p>
                  <p>TERMINACIÓN DEL CONTRATO: {personalReciente.fechaTerminacion || "No aplica"}</p>
                  <p>MOTIVO DE TERMINACIÓN: {personalReciente.motivoTerminacion || "No aplica"}</p>
                  <p>SALARIO U HONORARIO MENSUAL: {personalReciente.salario || "No especificado"}</p>
                </div>

                <p style={{ marginTop: "30px" }}>
                  El presente documento se expide a solicitud de la parte interesada el día {fechaCertificado || new Date().toLocaleDateString("es-CO")}.
                </p>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "80px" }}>
                <div>
                  <div style={{ width: "200px", borderBottom: "1px solid #000", marginBottom: "10px" }}></div>
                  <p style={{ margin: 0, fontWeight: "bold", fontSize: "14px" }}>Área de Talento Humano</p>
                  <p style={{ margin: 0, fontSize: "12px" }}>Fundación Isla Cascajal</p>
                </div>
              </div>
              
              <div style={{ marginTop: "50px", fontSize: "12px", color: "#666", fontStyle: "italic" }}>
                Documento electrónico Verificable con el código QR
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function PersonalPage() {
  return (
    <ProtectedRoute allowedRoles={["superadmin", "recursos_humanos"]}>
      <PersonalContent />
    </ProtectedRoute>
  );
}
