"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { collection, doc, setDoc, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { registrarAuditoria } from "@/lib/auditoria";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  ArrowLeft,
  User,
  IdCard,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Droplets,
  Camera,
  Download,
  CheckCircle2,
  QrCode,
  Globe,
  Map,
  Plus,
  Trash2,
  Users
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import QRCode from "qrcode";
import html2canvas from "html2canvas";
import { FileText as FileTextIcon } from "lucide-react";

const VERIFICACION_BASE_URL = "https://sistema-verificacion.vercel.app/verificar?doc=";

const PAISES = [
  "Colombia", "Venezuela", "Ecuador", "Perú", "Chile", "Argentina", "Brasil", "Panamá", "México", "Estados Unidos", "España", "Otro"
];

// Colores Institucionales
const COLORS = {
  azul: "#05318a",
  verde: "#0e6235",
  amarillo: "#f3de4d",
  rojo: "#ce181b"
};

function generarCodigoAfiliado() {
  const caracteres = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let codigo = "FICONG-";
  for (let i = 0; i < 8; i++) {
    codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
  }
  return codigo;
}

function generarCodigoAfiliacion() {
  const caracteres = "0123456789";
  let codigo = "AF-";
  for (let i = 0; i < 8; i++) {
    codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
  }
  return codigo;
}

export default function AfiliarPage() {
  const { user, userData, loading: authLoading } = useAuth();
  const carnetRef = useRef(null);
  const exportRef = useRef(null);
  const certificadoRef = useRef(null);

  const [formData, setFormData] = useState({
    codigo: generarCodigoAfiliado(),
    nombre: "",
    cedula: "",
    rh: "",
    fechaIngreso: new Date().toISOString().split("T")[0],
    telefono: "",
    correo: "",
    direccion: "",
    estado: "activo",
    cargo: "Afiliado",
    foto: null,
    oficina: "",
    dependencia: "",
    pais: "Colombia",
    ciudad: "",
    beneficiarios: [],
    seleccionMembresias: {
      educativa: true,
      integral: false,
      duracionIntegral: "6_meses"
    }
  });

  const [qrDataUrl, setQrDataUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadingCert, setIsDownloadingCert] = useState(false);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Generar QR en tiempo real cuando cambia el código
  useEffect(() => {
    const generateQR = async () => {
      try {
        const link = VERIFICACION_BASE_URL + formData.codigo;
        const url = await QRCode.toDataURL(link, {
          width: 400,
          margin: 1,
          color: {
            dark: COLORS.azul,
            light: "#ffffff",
          },
        });
        setQrDataUrl(url);
      } catch (err) {
        console.error("Error generating QR", err);
      }
    };
    generateQR();
  }, [formData.codigo]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => {
      const newData = { ...prev, [field]: value };
      if (field === "oficina") {
        newData.dependencia = "";
      }
      return newData;
    });
  };

  const handleAddBeneficiario = () => {
    if (formData.beneficiarios.length >= 5) {
      toast.error("Máximo 5 beneficiarios permitidos");
      return;
    }
    setFormData(prev => ({
      ...prev,
      beneficiarios: [...prev.beneficiarios, { nombre: "", nuip: "" }]
    }));
  };

  const handleBeneficiarioChange = (index, field, value) => {
    const newBeneficiarios = [...formData.beneficiarios];
    newBeneficiarios[index][field] = value;
    setFormData(prev => ({ ...prev, beneficiarios: newBeneficiarios }));
  };

  const handleRemoveBeneficiario = (index) => {
    setFormData(prev => ({
      ...prev,
      beneficiarios: prev.beneficiarios.filter((_, i) => i !== index)
    }));
  };

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
      // Permitimos subir hasta 5MB pero luego comprimimos
      if (file.size > 5 * 1024 * 1024) {
        toast.error("La foto es demasiado pesada (máx 5MB)");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const originalBase64 = reader.result;
          // Comprimir la imagen antes de guardarla
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

  const handleGuardar = async () => {
    if (!formData.nombre || !formData.cedula || !formData.rh || !formData.telefono || !formData.oficina || !formData.dependencia) {
      toast.error("Por favor completa los campos obligatorios");
      return;
    }

    if (!formData.seleccionMembresias.educativa && !formData.seleccionMembresias.integral) {
      toast.error("Seleccione al menos un tipo de membresía");
      return;
    }

    setIsSaving(true);
    try {
      const fIngreso = new Date(formData.fechaIngreso + "T12:00:00");
      const year = fIngreso.getFullYear();
      const month = fIngreso.getMonth();
      
      const nuevasMembresias = [];

      if (formData.seleccionMembresias.educativa) {
        let fExpEdu;
        if (month <= 4) fExpEdu = new Date(year, 4, 30, 23, 59, 59);
        else if (month <= 10) fExpEdu = new Date(year, 10, 30, 23, 59, 59);
        else fExpEdu = new Date(year + 1, 4, 30, 23, 59, 59);

        nuevasMembresias.push({
          tipo: "educativa",
          estado: "activo",
          fechaInicio: fIngreso.toISOString(),
          fechaExpiracion: fExpEdu.toISOString(),
          codigo: `EDU-${Math.random().toString(36).substr(2, 6).toUpperCase()}`
        });
      }

      if (formData.seleccionMembresias.integral) {
        const fExpInt = new Date(fIngreso);
        const meses = formData.seleccionMembresias.duracionIntegral === "6_meses" ? 6 : 12;
        fExpInt.setMonth(fExpInt.getMonth() + meses);

        nuevasMembresias.push({
          tipo: "integral",
          estado: "activo",
          fechaInicio: fIngreso.toISOString(),
          fechaExpiracion: fExpInt.toISOString(),
          codigo: `INT-${Math.random().toString(36).substr(2, 6).toUpperCase()}`
        });
      }

      // Buscar si ya existe
      const q = query(collection(db, "afiliados"), where("cedula", "==", formData.cedula));
      const snap = await getDocs(q);
      
      let finalId = formData.codigo;
      let dataToSave = {
        nombre: formData.nombre,
        cedula: formData.cedula,
        telefono: formData.telefono,
        correo: formData.correo,
        direccion: formData.direccion,
        rh: formData.rh,
        foto: formData.foto,
        pais: formData.pais,
        ciudad: formData.ciudad,
        oficina: formData.oficina,
        dependencia: formData.dependencia,
        beneficiarios: formData.beneficiarios,
        estado: "activo",
        membresias: nuevasMembresias,
        fechaUltimaActualizacion: new Date().toISOString()
      };

      if (!snap.empty) {
        finalId = snap.docs[0].id;
        // Fusionar membresías si ya existen (opcional, pero aquí las sobrescribimos/agregamos según la lógica de 'Nueva Afiliación')
        await setDoc(doc(db, "afiliados", finalId), dataToSave, { merge: true });
      } else {
        dataToSave.codigoInstitucional = finalId;
        dataToSave.fechaCreacion = new Date().toISOString();
        dataToSave.creadoPor = user.uid;
        await setDoc(doc(db, "afiliados", finalId), dataToSave);
      }

      await registrarAuditoria({
        user,
        userData,
        accion: "Registro/Actualización Afiliado",
        documentoId: finalId,
        detalles: `Registro completo con membresías: ${nuevasMembresias.map(m => m.tipo).join(", ")}`
      });

      setFormData(prev => ({ ...prev, codigo: finalId, membresias: nuevasMembresias }));
      toast.success("Afiliación guardada correctamente");
      setIsSuccess(true);
    } catch (err) {
      console.error(err);
      toast.error("Error al guardar");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setFormData({
      codigo: generarCodigoAfiliado(),
      nombre: "",
      cedula: "",
      rh: "",
      fechaIngreso: new Date().toISOString().split("T")[0],
      telefono: "",
      correo: "",
      direccion: "",
      estado: "activo",
      cargo: "Afiliado",
      foto: null,
      oficina: "",
      dependencia: "",
      pais: "Colombia",
      ciudad: "",
      beneficiarios: [],
      tipoAfiliacion: "educativa",
    });
    setFotoPreview(null);
    setIsSuccess(false);
  };

  const descargarCarnet = async () => {
    if (!exportRef.current) return;
    setIsDownloading(true);

    try {
      const canvas = await html2canvas(exportRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        allowTaint: true,
      });

      const imgData = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `Carnet_${formData.nombre.trim().replace(/\s+/g, "_") || "Afiliado"}.png`;
      link.href = imgData;
      link.click();
      toast.success("Carnet descargado correctamente");
    } catch (err) {
      console.error("Error carnet:", err);
      toast.error("Error al generar el carnet");
    } finally {
      setIsDownloading(false);
    }
  };

  const descargarCertificado = async () => {
    if (!certificadoRef.current) return;
    setIsDownloadingCert(true);

    try {
      const canvas = await html2canvas(certificadoRef.current, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        onclone: (clonedDoc) => {
          // Asegurarse de que el elemento sea visible para html2canvas en el clon
          const el = clonedDoc.querySelector('[data-certificate]');
          if (el) el.style.position = 'static';
        }
      });

      const imgData = canvas.toDataURL("image/png");
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF("p", "mm", "a4");

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const ratio = canvas.height / canvas.width;

      let finalImgWidth = pdfWidth;
      let finalImgHeight = pdfWidth * ratio;

      // Si la altura calculada supera la página, ajustamos proporcionalmente
      if (finalImgHeight > pageHeight) {
        finalImgHeight = pageHeight;
        finalImgWidth = finalImgHeight / ratio;
      }

      // Centrar horizontalmente si el ancho es menor al de la página
      const xOffset = (pdfWidth - finalImgWidth) / 2;
      pdf.addImage(imgData, "PNG", xOffset, 0, finalImgWidth, finalImgHeight);

      // INSERTAR QR DIRECTAMENTE EN EL PDF (Capa superior)
      if (qrDataUrl) {
        const qrSize = 35; // 35mm
        const marginX = pdfWidth - qrSize - 20;
        const marginY = pageHeight - qrSize - 30;

        pdf.setFillColor(255, 255, 255);
        pdf.roundedRect(marginX - 2, marginY - 2, qrSize + 4, qrSize + 4, 3, 3, 'F');

        pdf.setDrawColor(5, 49, 138);
        pdf.setLineWidth(0.5);
        pdf.roundedRect(marginX - 2, marginY - 2, qrSize + 4, qrSize + 4, 3, 3, 'D');

        pdf.addImage(qrDataUrl, "PNG", marginX, marginY, qrSize, qrSize);

        pdf.setTextColor(5, 49, 138);
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "bold");
        pdf.text("VERIFICACIÓN DIGITAL", marginX + (qrSize / 2), marginY + qrSize + 6, { align: "center" });
      }

      pdf.save(`Certificado_Afiliacion_${formData.nombre.trim().replace(/\s+/g, "_")}.pdf`);

      toast.success("Certificado generado correctamente");
    } catch (err) {
      console.error("Error certificado:", err);
      toast.error("Error al generar el certificado");
    } finally {
      setIsDownloadingCert(false);
    }
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Spinner /></div>;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-muted/30 pb-10">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Logo" width={40} height={40} className="rounded-full" />
            <div>
              <h1 className="font-semibold text-foreground">Nueva Afiliación</h1>
              <p className="text-xs text-muted-foreground">Sistema Institucional de Afiliados</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {!isSuccess ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

          {/* Formulario */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Datos del Afiliado</CardTitle>
              <CardDescription>Complete la información para generar el carnet institucional.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field>
                  <FieldLabel>Código Institucional</FieldLabel>
                  <Input value={formData.codigo} readOnly className="bg-muted font-mono font-bold text-primary" />
                </Field>
                <Field>
                  <FieldLabel>Estado</FieldLabel>
                  <Select value={formData.estado} onValueChange={(v) => handleInputChange("estado", v)} disabled={isSaving}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="activo">Activo</SelectItem>
                      <SelectItem value="inactivo">Inactivo</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field>
                <FieldLabel>Nombre Completo</FieldLabel>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Escriba el nombre completo"
                    className="pl-10"
                    value={formData.nombre}
                    onChange={(e) => handleInputChange("nombre", e.target.value)}
                    disabled={isSaving}
                  />
                </div>
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field>
                  <FieldLabel>Cédula / Documento</FieldLabel>
                  <div className="relative">
                    <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Número de identidad"
                      className="pl-10"
                      value={formData.cedula}
                      onChange={(e) => handleInputChange("cedula", e.target.value)}
                      disabled={isSaving}
                    />
                  </div>
                </Field>
                <Field>
                  <FieldLabel>Grupo Sanguíneo RH</FieldLabel>
                  <div className="relative">
                    <Droplets className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
                    <Input
                      placeholder="Ej: O+"
                      className="pl-10 uppercase"
                      value={formData.rh}
                      onChange={(e) => handleInputChange("rh", e.target.value.toUpperCase())}
                      disabled={isSaving}
                    />
                  </div>
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field>
                  <FieldLabel>Fecha de Afiliación</FieldLabel>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="date"
                      className="pl-10"
                      value={formData.fechaIngreso}
                      onChange={(e) => handleInputChange("fechaIngreso", e.target.value)}
                      disabled={isSaving}
                    />
                  </div>
                </Field>
                <Field>
                  <FieldLabel>Teléfono</FieldLabel>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Número de celular"
                      className="pl-10"
                      value={formData.telefono}
                      onChange={(e) => handleInputChange("telefono", e.target.value)}
                      disabled={isSaving}
                    />
                  </div>
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field>
                  <FieldLabel>País</FieldLabel>
                  <Select value={formData.pais} onValueChange={(v) => handleInputChange("pais", v)} disabled={isSaving}>
                    <SelectTrigger className="pl-10 relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <SelectValue placeholder="Seleccione país" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAISES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Ciudad</FieldLabel>
                  <div className="relative">
                    <Map className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Escriba la ciudad"
                      className="pl-10"
                      value={formData.ciudad}
                      onChange={(e) => handleInputChange("ciudad", e.target.value)}
                      disabled={isSaving}
                    />
                  </div>
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field>
                  <FieldLabel>Correo Electrónico</FieldLabel>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="correo@ejemplo.com"
                      className="pl-10"
                      value={formData.correo}
                      onChange={(e) => handleInputChange("correo", e.target.value)}
                      disabled={isSaving}
                    />
                  </div>
                </Field>
                <Field>
                  <FieldLabel>Dirección</FieldLabel>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Dirección de residencia"
                      className="pl-10"
                      value={formData.direccion}
                      onChange={(e) => handleInputChange("direccion", e.target.value)}
                      disabled={isSaving}
                    />
                  </div>
                </Field>
              </div>

              <div className="space-y-4 p-4 bg-muted/30 rounded-xl border">
                <p className="text-xs font-bold uppercase text-muted-foreground">Seleccione las Membresías</p>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edu"
                      checked={formData.seleccionMembresias.educativa}
                      onCheckedChange={(v) => setFormData(p => ({
                        ...p,
                        seleccionMembresias: { ...p.seleccionMembresias, educativa: !!v }
                      }))}
                    />
                    <label htmlFor="edu" className="text-sm font-medium leading-none cursor-pointer">Afiliación Educativa</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="int"
                      checked={formData.seleccionMembresias.integral}
                      onCheckedChange={(v) => setFormData(p => ({
                        ...p,
                        seleccionMembresias: { ...p.seleccionMembresias, integral: !!v }
                      }))}
                    />
                    <label htmlFor="int" className="text-sm font-medium leading-none cursor-pointer">Afiliación Integral</label>
                  </div>
                </div>

                {formData.seleccionMembresias.integral && (
                  <div className="pt-2 animate-in slide-in-from-top-1 duration-200">
                    <FieldLabel>Duración de Afiliación Integral</FieldLabel>
                    <Select
                      value={formData.seleccionMembresias.duracionIntegral}
                      onValueChange={(v) => setFormData(p => ({
                        ...p,
                        seleccionMembresias: { ...p.seleccionMembresias, duracionIntegral: v }
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="6_meses">6 Meses</SelectItem>
                        <SelectItem value="1_ano">1 Año</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <Field>
                <FieldLabel>Oficina que emite</FieldLabel>
                <Select
                  value={formData.oficina}
                  onValueChange={(value) => handleInputChange("oficina", value)}
                  disabled={isSaving}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione la oficina" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sede Principal">Sede Principal</SelectItem>
                    <SelectItem value="Subdirección Regional Pacífico Norte">Subdirección Regional Pacífico Norte</SelectItem>
                    <SelectItem value="Subdirección Regional Pacífico Sur">Subdirección Regional Pacífico Sur</SelectItem>
                    <SelectItem value="Subdirección Regional Eje Cafetero">Subdirección Regional Eje Cafetero</SelectItem>
                    <SelectItem value="Subdirección Regional Sur Central">Subdirección Regional Sur Central</SelectItem>
                    <SelectItem value="Subdirección Regional Nor Caribe">Subdirección Regional Nor Caribe</SelectItem>
                    <SelectItem value="Subdirección Regional Sur Caribe">Subdirección Regional Sur Caribe</SelectItem>
                    <SelectItem value="Subdirección Regional Nor Oriente">Subdirección Regional Nor Oriente</SelectItem>
                    <SelectItem value="Subdirección Regional Sur Oriente">Subdirección Regional Sur Oriente</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel>Dependencia que emite</FieldLabel>
                <Select
                  value={formData.dependencia}
                  onValueChange={(value) => handleInputChange("dependencia", value)}
                  disabled={!formData.oficina}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione la dependencia" />
                  </SelectTrigger>
                  <SelectContent>
                    {formData.oficina === "Sede Principal" ? (
                      <>
                        <SelectItem value="Representante Legal">Representante Legal</SelectItem>
                        <SelectItem value="Dirección ejecutiva">Dirección Ejecutiva</SelectItem>
                        <SelectItem value="Dirección administrativa">Dirección Administrativa</SelectItem>
                        <SelectItem value="Revisaría fiscal">Revisaría Fiscal</SelectItem>
                        <SelectItem value="Secretaría general">Secretaría General</SelectItem>
                        <SelectItem value="Subdireccion de áreas">Subdireccion de Áreas</SelectItem>
                        <SelectItem value="Subdireccion de turismo, las artes,las culturas y los saberes">Subdireccion de Turismo, las Artes, las Culturas y los Saberes</SelectItem>
                        <SelectItem value="Subdireccion de extensión y cosmovision etnoeducativa">Subdireccion de Extensión y Cosmovision Etnoeducativa</SelectItem>
                        <SelectItem value="Subdireccion de recreación, deporte,salud y ambiente saludable">Subdireccion de Recreación, Deporte, Salud y Ambiente Saludable</SelectItem>
                        <SelectItem value="Subdireccion de bienestar social, inclusión y equidad">Subdireccion de Bienestar Social, Inclusión y Equidad</SelectItem>
                        <SelectItem value="Coordinación jurídica">Coordinación Jurídica</SelectItem>
                        <SelectItem value="Coordinación comercial">Coordinación Comercial</SelectItem>
                        <SelectItem value="Coordinación de plantación y calidad">Coordinación de Planeación y Calidad</SelectItem>
                        <SelectItem value="Coordinación de proyectos e internacionalización">Coordinación de Proyectos e Internacionalización</SelectItem>
                        <SelectItem value="Coordinación de operaciones financieras">Coordinación de Operaciones Financieras</SelectItem>
                        <SelectItem value="Coordinación del talento humano">Coordinación del Talento Humano</SelectItem>
                        <SelectItem value="Coordinación de comunicaciones y canales digitales">Coordinación de Comunicaciones y Canales Digitales</SelectItem>
                        <SelectItem value="Área de operaciones logísticas">Área de Operaciones Logísticas</SelectItem>
                        <SelectItem value="Área de tesorería">Área de Tesorería</SelectItem>
                        <SelectItem value="Área de contabilidad">Área de Contabilidad</SelectItem>
                        <SelectItem value="Área de práctica y pasantías">Área de Prácticas y Pasantías</SelectItem>
                      </>
                    ) : formData.oficina ? (
                      <>
                        <SelectItem value="Dirección Regional">Dirección Regional</SelectItem>
                        <SelectItem value="Coordinación Jurídica">Coordinación Jurídica</SelectItem>
                        <SelectItem value="Coordinación Comercial">Coordinación Comercial</SelectItem>
                        <SelectItem value="Coordinación de Planeación y Calidad">Coordinación de Planeación y Calidad</SelectItem>
                        <SelectItem value="Coordinación de Proyectos e Internacionalización">Coordinación de Proyectos e Internacionalización</SelectItem>
                        <SelectItem value="Coordinación de Operaciones Financieras">Coordinación de Operaciones Financieras</SelectItem>
                        <SelectItem value="Coordinación del Talento Humano">Coordinación del Talento Humano</SelectItem>
                        <SelectItem value="Coordinación de Comunicaciones y Canales Digitales">Coordinación de Comunicaciones y Canales Digitales</SelectItem>
                        <SelectItem value="Área de Operaciones Logísticas">Área de Operaciones Logísticas</SelectItem>
                        <SelectItem value="Área de Tesorería">Área de Tesorería</SelectItem>
                        <SelectItem value="Área de Contabilidad">Área de Contabilidad</SelectItem>
                        <SelectItem value="Área de Práctica y Pasantías">Área de Práctica y Pasantías</SelectItem>
                      </>
                    ) : null}
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel className="flex justify-between items-center">
                  Beneficiarios (Opcional - Máx 5)
                  <Button type="button" variant="outline" size="xs" onClick={handleAddBeneficiario} className="h-7 text-[10px]" disabled={isSaving}>
                    <Plus className="h-3 w-3 mr-1" /> Agregar
                  </Button>
                </FieldLabel>
                <div className="space-y-3">
                  {formData.beneficiarios?.length === 0 && (
                    <p className="text-xs text-muted-foreground italic bg-muted/50 p-2 rounded-lg text-center">No hay beneficiarios agregados</p>
                  )}
                  {formData.beneficiarios?.map((ben, idx) => (
                    <div key={idx} className="bg-muted/30 p-3 rounded-lg border space-y-2 relative">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 absolute top-1 right-1 text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemoveBeneficiario(idx)}
                        disabled={isSaving}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-muted-foreground">Nombre</label>
                          <Input
                            value={ben.nombre}
                            onChange={(e) => handleBeneficiarioChange(idx, "nombre", e.target.value)}
                            className="h-8 text-xs"
                            placeholder="Nombre"
                            disabled={isSaving}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-muted-foreground">NUIP</label>
                          <Input
                            value={ben.nuip}
                            onChange={(e) => handleBeneficiarioChange(idx, "nuip", e.target.value)}
                            className="h-8 text-xs font-mono"
                            placeholder="Documento"
                            disabled={isSaving}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Field>

              <Field>
                <FieldLabel>Foto del Afiliado</FieldLabel>
                <div className="flex items-center gap-4">
                  <div className="relative h-20 w-20 rounded-xl overflow-hidden bg-muted border-2 border-dashed border-primary/20 flex items-center justify-center group cursor-pointer hover:border-primary/50 transition-all">
                    {fotoPreview ? (
                      <Image src={fotoPreview} alt="Preview" fill className="object-cover" />
                    ) : (
                      <Camera className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                      onChange={handleFotoChange}
                      disabled={isSaving}
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Click en el recuadro para subir foto.</p>
                    <p className="text-[10px] text-muted-foreground mt-1 italic">Preferiblemente fondo blanco y buena iluminación.</p>
                  </div>
                </div>
              </Field>

                <Button
                  className="w-full h-12 text-base font-bold shadow-md shadow-primary/20"
                  onClick={handleGuardar}
                  disabled={isSaving}
                >
                  {isSaving ? <Spinner className="mr-2" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
                  GUARDAR AFILIACIÓN
                </Button>
              </CardContent>
            </Card>

          {/* Preview Carnet */}
          <div className="sticky top-24">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
              <QrCode className="h-4 w-4" /> Vista Previa del Carnet
            </h3>

            <div
              id="carnet-a-imprimir"
              ref={carnetRef}
              className="relative w-[380px] h-[580px] rounded-[2rem] overflow-hidden mx-auto"
              style={{
                fontFamily: 'sans-serif',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
              }}
            >
              {/* Decoración Superior */}
              <div className="absolute top-0 left-0 w-full h-[180px] overflow-hidden">
                <div
                  className="absolute -top-10 -left-10 w-[120%] h-[120%] rotate-[15deg]"
                  style={{ background: `linear-gradient(135deg, ${COLORS.azul} 0%, ${COLORS.verde} 100%)` }}
                />
                <div
                  className="absolute top-0 right-0 w-1/3 h-full"
                  style={{ backgroundColor: COLORS.amarillo, opacity: 0.2, clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }}
                />
              </div>

              <div className="relative z-10 pt-8 px-8 flex flex-col items-center">
                <div className="bg-white p-2 rounded-full shadow-lg mb-3" style={{ backgroundColor: '#ffffff' }}>
                  <img src="/logo.png" alt="Logo" style={{ width: "60px", height: "60px", borderRadius: "9999px" }} />
                </div>
                <h2 className="font-black text-2xl tracking-tighter leading-none" style={{ color: '#ffffff' }}>ISLA CASCAJAL</h2>
                <p className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: 'rgba(255,255,255,0.8)' }}>Fundación</p>
              </div>

              {/* Foto de Perfil */}
              <div className="relative z-10 flex flex-col items-center mt-6">
                <div
                  className="relative w-40 h-40 rounded-3xl border-[6px] border-white shadow-2xl overflow-hidden"
                  style={{ backgroundColor: "#f1f5f9", borderColor: '#ffffff' }}
                >
                  {fotoPreview ? (
                    <img src={fotoPreview} alt="Foto" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' }}>
                      <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Badge AFILIADO */}
                <div
                  className="mt-[-20px] relative z-20 px-8 py-1.5 rounded-full border-2 border-white"
                  style={{ backgroundColor: COLORS.rojo, borderColor: '#ffffff', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                >
                  <span className="text-white font-black text-sm uppercase tracking-widest" style={{ color: '#ffffff' }}>AFILIADO</span>
                </div>
              </div>

              {/* Información Personal */}
              <div className="mt-4 px-10 flex flex-col items-center text-center">
                <h3 className="text-xl font-black leading-tight uppercase" style={{ color: "#1e293b", margin: 0 }}>
                  {formData.nombre || "NOMBRE COMPLETO"}
                </h3>
                <p className="font-bold text-xs mt-1" style={{ color: "#64748b", margin: 0 }}>
                  C.C. {formData.cedula || "XXXXXXXX"}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 w-full">
                  <div className="text-left">
                    <p className="text-[9px] font-black uppercase" style={{ color: "#94a3b8", margin: 0 }}>Código</p>
                    <p className="text-sm font-black font-mono tracking-tighter" style={{ color: "#334155", margin: 0 }}>{formData.codigo}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-[9px] font-black uppercase" style={{ color: "#94a3b8", margin: 0 }}>RH</p>
                    <p className="text-sm font-black uppercase" style={{ color: "#334155", margin: 0 }}>{formData.rh || "—"}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-[9px] font-black uppercase" style={{ color: "#94a3b8", margin: 0 }}>País</p>
                    <p className="text-sm font-black uppercase" style={{ color: "#334155", margin: 0 }}>{formData.pais || "—"}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-[9px] font-black uppercase" style={{ color: "#94a3b8", margin: 0 }}>Cargo</p>
                    <p className="text-sm font-black uppercase" style={{ color: "#334155", margin: 0 }}>{formData.cargo}</p>
                  </div>
                  <div className="text-left col-span-2">
                    <p className="text-[9px] font-black uppercase" style={{ color: "#94a3b8", margin: 0 }}>Membresías Activas</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {formData.seleccionMembresias.educativa && (
                        <span className="text-[9px] font-black px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">EDUCATIVA</span>
                      )}
                      {formData.seleccionMembresias.integral && (
                        <span className="text-[9px] font-black px-2 py-0.5 rounded bg-success/10 text-success border border-success/20">INTEGRAL</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="absolute bottom-0 left-0 w-full pt-4 pb-6 pl-10 pr-6 flex items-end justify-between">
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] font-black" style={{ color: COLORS.azul, margin: 0 }}>@fundacionislacascajal</p>
                </div>

                <div className="bg-white p-1 rounded-lg border-2" style={{ borderColor: COLORS.azul, backgroundColor: '#ffffff' }}>
                  {qrDataUrl && (
                    <img src={qrDataUrl} alt="QR" style={{ width: "70px", height: "70px" }} />
                  )}
                </div>
              </div>

              {/* Franjas de color decorativas */}
              <div className="absolute bottom-0 left-0 w-full h-1.5 flex">
                <div style={{ flex: 1, backgroundColor: COLORS.azul }} />
                <div style={{ flex: 1, backgroundColor: COLORS.verde }} />
                <div style={{ flex: 1, backgroundColor: COLORS.amarillo }} />
                <div style={{ flex: 1, backgroundColor: COLORS.rojo }} />
              </div>
            </div>

            <p className="text-center text-xs text-muted-foreground mt-4 italic">
              * El carnet se genera automáticamente mientras completas el formulario.
            </p>
          </div>

        </div>
        ) : (
          /* Pantalla de Éxito */
          <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in zoom-in duration-500">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="h-12 w-12 text-success" />
              </div>
              <h2 className="text-3xl font-black text-foreground">Afiliación Registrada Correctamente</h2>
              <p className="text-muted-foreground">El registro ha sido procesado y guardado de forma segura en la base de datos institucional.</p>
            </div>

            <Card className="border-2 border-success/20 shadow-xl overflow-hidden">
              <div className="bg-success/5 border-b border-success/10 px-6 py-4 flex justify-between items-center">
                <h3 className="font-bold text-success flex items-center gap-2">
                  <IdCard className="h-4 w-4" /> Resumen de Afiliación
                </h3>
                <Badge className="bg-success text-success-foreground font-mono">{formData.codigo}</Badge>
              </div>
              <CardContent className="p-0">
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
                  <div className="p-6 space-y-4">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Nombre Completo</p>
                      <p className="text-lg font-bold">{formData.nombre}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Documento / NUIP</p>
                      <p className="font-mono font-bold text-lg">{formData.cedula}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Membresías Activas</p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {formData.membresias?.map(m => (
                          <Badge key={m.tipo} variant="secondary" className="capitalize">
                            {m.tipo}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="p-6 space-y-4 bg-muted/20">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Fecha de Registro</p>
                      <p className="font-bold">
                        {new Date(formData.fechaIngreso + "T12:00:00").toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" })}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Estado General</p>
                      <Badge className="bg-success text-success-foreground">ACTIVO</Badge>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Oficina / Dependencia</p>
                      <p className="text-sm font-medium">{formData.oficina} — {formData.dependencia}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Button 
                variant="outline" 
                size="lg" 
                className="h-14 border-2 font-bold gap-3 hover:bg-primary hover:text-primary-foreground transition-all"
                onClick={descargarCarnet}
                disabled={isDownloading}
              >
                {isDownloading ? <Spinner /> : <Download className="h-5 w-5" />}
                DESCARGAR CARNET
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="h-14 border-2 font-bold gap-3 hover:bg-primary hover:text-primary-foreground transition-all"
                onClick={descargarCertificado}
                disabled={isDownloadingCert}
              >
                {isDownloadingCert ? <Spinner /> : <FileTextIcon className="h-5 w-5" />}
                CERTIFICADO PDF
              </Button>
              <Button 
                variant="secondary" 
                size="lg" 
                className="h-14 font-bold gap-3"
                asChild
              >
                <Link href={`/verificar?doc=${formData.codigo}`} target="_blank">
                  <QrCode className="h-5 w-5" />
                  VER AFILIACIÓN PÚBLICA
                </Link>
              </Button>
              <Button 
                variant="default" 
                size="lg" 
                className="h-14 font-bold gap-3 shadow-lg shadow-primary/20"
                onClick={handleReset}
              >
                <Plus className="h-5 w-5" />
                NUEVA AFILIACIÓN
              </Button>
            </div>

            <div className="pt-6 text-center">
              <Button variant="ghost" asChild>
                <Link href="/dashboard" className="text-muted-foreground hover:text-primary">
                  <ArrowLeft className="h-4 w-4 mr-2" /> Volver al Dashboard
                </Link>
              </Button>
            </div>
          </div>
        )}

        {/* CONTENEDOR DE EXPORTACIÓN AISLADO (INVISIBLE) - PURO HEX / SIN TAILWIND */}
        <div
          style={{
            position: "fixed",
            left: "-99999px",
            top: 0,
            width: "380px",
            height: "580px",
            background: "#ffffff",
            zIndex: -1
          }}
        >
          <div ref={exportRef} style={{ width: '380px', height: '580px', background: '#ffffff', position: 'relative', overflow: 'hidden', borderRadius: '32px' }}>
            {/* Decoración Superior */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '180px', overflow: 'hidden' }}>
              <div style={{
                position: 'absolute',
                top: '-40px',
                left: '-40px',
                width: '120%',
                height: '120%',
                transform: 'rotate(15deg)',
                background: `linear-gradient(135deg, ${COLORS.azul} 0%, ${COLORS.verde} 100%)`
              }} />
              <div style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: '33.33%',
                height: '100%',
                backgroundColor: COLORS.amarillo,
                opacity: 0.2
              }} />
            </div>

            {/* Logo y Header */}
            <div style={{ position: 'relative', zIndex: 10, paddingTop: '32px', paddingLeft: '32px', paddingRight: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ backgroundColor: '#ffffff', padding: '8px', borderRadius: '9999px', marginBottom: '12px' }}>
                <img src="/logo.png" alt="Logo" style={{ width: '60px', height: '60px', borderRadius: '9999px' }} />
              </div>
              <h2 style={{ color: '#ffffff', fontWeight: 900, fontSize: '24px', margin: 0, lineHeight: 1 }}>ISLA CASCAJAL</h2>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '4px', margin: 0 }}>Fundación</p>
            </div>

            {/* Foto de Perfil */}
            <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '24px' }}>
              <div style={{
                position: 'relative',
                width: '160px',
                height: '160px',
                borderRadius: '24px',
                border: '6px solid #ffffff',
                backgroundColor: '#f1f5f9',
                overflow: 'hidden'
              }}>
                {fotoPreview ? (
                  <img src={fotoPreview} alt="Foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' }}>
                    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                )}
              </div>

              <div style={{
                marginTop: '-20px',
                position: 'relative',
                zIndex: 20,
                paddingLeft: '32px',
                paddingRight: '32px',
                paddingTop: '6px',
                paddingBottom: '6px',
                borderRadius: '9999px',
                border: '2px solid #ffffff',
                backgroundColor: COLORS.rojo
              }}>
                <span style={{ color: '#ffffff', fontWeight: 900, fontSize: '14px', textTransform: 'uppercase' }}>AFILIADO</span>
              </div>
            </div>

            {/* Información Personal */}
            <div style={{ marginTop: '16px', paddingLeft: '40px', paddingRight: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 900, lineHeight: 1.2, textTransform: 'uppercase', color: '#1e293b', margin: 0, width: '100%' }}>
                {formData.nombre || "NOMBRE COMPLETO"}
              </h3>
              <p style={{ fontWeight: 'bold', fontSize: '12px', marginTop: '4px', color: '#64748b', margin: 0 }}>
                C.C. {formData.cedula || "XXXXXXXX"}
              </p>

              <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', width: '100%' }}>
                <div style={{ textAlign: 'left' }}>
                  <p style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', color: '#94a3b8', margin: 0 }}>Cód. Institucional</p>
                  <p style={{ fontSize: '14px', fontWeight: 900, color: '#334155', margin: 0 }}>{formData.codigo}</p>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <p style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', color: '#94a3b8', margin: 0 }}>RH</p>
                  <p style={{ fontSize: '14px', fontWeight: 900, textTransform: 'uppercase', color: '#334155', margin: 0 }}>{formData.rh || "—"}</p>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <p style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', color: '#94a3b8', margin: 0 }}>País</p>
                  <p style={{ fontSize: '14px', fontWeight: 900, textTransform: 'uppercase', color: '#334155', margin: 0 }}>{formData.pais || "—"}</p>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <p style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', color: '#94a3b8', margin: 0 }}>Cargo</p>
                  <p style={{ fontSize: '14px', fontWeight: 900, textTransform: 'uppercase', color: '#334155', margin: 0 }}>{formData.cargo}</p>
                </div>
                <div style={{ marginTop: '12px', width: '100%' }}>
                  <p style={{ fontSize: '9px', fontWeight: 900, color: '#94a3b8', margin: 0, textTransform: 'uppercase' }}>Membresías Activas</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px', justifyContent: 'center' }}>
                    {formData.membresias?.map(m => (
                      <span key={m.tipo} style={{ fontSize: '10px', fontWeight: 900, padding: '2px 8px', borderRadius: '4px', background: COLORS.azul + '20', color: COLORS.azul, border: `1px solid ${COLORS.azul}40` }}>
                        {m.tipo.toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* QR y Footer */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', paddingTop: '16px', paddingBottom: '24px', paddingLeft: '40px', paddingRight: '24px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <p style={{ fontSize: '10px', fontWeight: 900, color: COLORS.azul, margin: 0 }}>@fundacionislacascajal</p>
              </div>

              <div style={{ backgroundColor: '#ffffff', padding: '4px', borderRadius: '8px', border: `2px solid ${COLORS.azul}` }}>
                {qrDataUrl && (
                  <img src={qrDataUrl} alt="QR" style={{ width: '70px', height: '70px' }} />
                )}
              </div>
            </div>

            {/* Franjas de color decorativas */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '6px', display: 'flex' }}>
              <div style={{ flex: 1, backgroundColor: COLORS.azul }} />
              <div style={{ flex: 1, backgroundColor: COLORS.verde }} />
              <div style={{ flex: 1, backgroundColor: COLORS.amarillo }} />
              <div style={{ flex: 1, backgroundColor: COLORS.rojo }} />
            </div>
          </div>
        </div>

        {/* CERTIFICADO DE AFILIACIÓN (INVISIBLE PARA EXPORTACIÓN) */}
        <div style={{ position: "fixed", left: "-9999px", top: 0, zIndex: -1 }}>
          <div
            ref={certificadoRef}
            data-certificate="true"
            style={{
              width: "800px",
              padding: "80px",
              background: "white",
              fontFamily: "'Times New Roman', serif",
              color: "#1a1a1a",
              lineHeight: "1.8",
              boxSizing: "border-box"
            }}
          >
            {/* Header con Logo */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "60px", borderBottom: `2px solid ${COLORS.azul}`, paddingBottom: "20px" }}>
              <img src="/logo.png" alt="Logo" style={{ width: "100px", height: "100px", borderRadius: "50%" }} />
              <div style={{ textAlign: "right" }}>
                <h1 style={{ fontSize: "28px", fontWeight: "900", margin: 0, color: COLORS.azul, letterSpacing: "-1px" }}>FUNDACIÓN ISLA CASCAJAL</h1>
                <p style={{ fontSize: "12px", fontWeight: "bold", margin: 0, color: "#666", textTransform: "uppercase", letterSpacing: "2px" }}>Sistema Institucional de Afiliaciones</p>
              </div>
            </div>

            {/* Título */}
            <div style={{ textAlign: "center", marginBottom: "50px" }}>
              <h2 style={{ fontSize: "24px", fontWeight: "bold", textDecoration: "underline", margin: 0 }}>CERTIFICADO DE AFILIACIÓN</h2>
            </div>

            {/* Contenido */}
            <div style={{ fontSize: "18px", textAlign: "justify" }}>
              <p style={{ marginBottom: "25px" }}>
                La Fundación Isla Cascajal certifica que el(la) ciudadano(a):
              </p>

              <p style={{ fontSize: "22px", fontWeight: "900", textAlign: "center", margin: "30px 0", textTransform: "uppercase", color: "#000" }}>
                {formData.nombre || "[NOMBRE COMPLETO DEL AFILIADO]"}
              </p>

              <p style={{ marginBottom: "25px" }}>
                identificado(a) con NUIP / documento de identidad No. <strong>{formData.cedula || "[NÚMERO DE DOCUMENTO]"}</strong>, se encuentra afiliado(a) y registrado(a) oficialmente en nuestra base institucional como miembro activo de la organización.
              </p>

              <p style={{ marginBottom: "25px" }}>
                La presente afiliación fue realizada en fecha <strong>{new Date(formData.fechaIngreso).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" })}</strong>, bajo el código institucional de afiliado <strong>{formData.codigo}</strong> y con el código de registro de membresía <strong>{formData.codigoAfiliacion}</strong>, y le permite acceder a los programas, actividades, beneficios y procesos desarrollados por la Fundación Isla Cascajal, conforme a los lineamientos internos y vigencia establecida.
              </p>

              <div style={{ margin: "40px auto", padding: "25px", border: "1px solid #ddd", borderRadius: "12px", width: "90%", backgroundColor: "#f9f9f9" }}>
                <p style={{ fontSize: "16px", fontWeight: "bold", color: COLORS.azul, marginBottom: "15px", borderBottom: "1px solid #eee", paddingBottom: "5px" }}>MEMBRESÍAS VIGENTES:</p>
                {formData.membresias?.map((m, idx) => (
                  <div key={idx} style={{ marginBottom: "10px", paddingBottom: "10px", borderBottom: idx === formData.membresias.length - 1 ? "none" : "1px dashed #ddd" }}>
                    <p style={{ margin: "2px 0", fontSize: "16px" }}>• <strong>{m.tipo.toUpperCase()}</strong></p>
                    <p style={{ margin: "2px 0", fontSize: "14px", color: "#666" }}>Vigente hasta el {new Date(m.fechaExpiracion).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" })}</p>
                    <p style={{ margin: "2px 0", fontSize: "12px", color: "#999", fontStyle: "italic" }}>Cód. Registro: {m.codigo}</p>
                  </div>
                ))}
                <div style={{ marginTop: "15px", paddingTop: "10px", borderTop: "1px solid #eee" }}>
                  <p style={{ margin: "2px 0", fontSize: "16px" }}><strong>Cargo / Relación:</strong> {formData.cargo || "Afiliado"}</p>
                  <p style={{ margin: "2px 0", fontSize: "16px" }}><strong>Estado:</strong> <span style={{ color: COLORS.verde, fontWeight: "bold" }}>ACTIVO</span></p>
                </div>
              </div>

              {formData.beneficiarios?.length > 0 && (
                <div style={{ margin: "25px 0", padding: "20px", border: "1px solid #eee", borderRadius: "12px", backgroundColor: "#fff" }}>
                  <p style={{ fontSize: "15px", fontWeight: "bold", marginBottom: "12px", color: COLORS.azul, borderBottom: "1px solid #eee", paddingBottom: "5px" }}>Beneficiarios Autorizados:</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    {formData.beneficiarios.map((b, i) => (
                      <div key={i} style={{ fontSize: "14px", color: "#444" }}>
                        • <span style={{ fontWeight: "bold" }}>{b.nombre}</span> <br />
                        <span style={{ fontSize: "12px", marginLeft: "12px" }}>NUIP: {b.nuip}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p style={{ marginBottom: "60px" }}>
                Este certificado se expide a solicitud del interesado para los fines que estime convenientes.
              </p>
            </div>

            {/* Footer / Firmas */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "80px" }}>
              <div style={{ textAlign: "left" }}>
                <p style={{ margin: 0, fontWeight: "bold", fontSize: "16px" }}>Fundación Isla Cascajal</p>
                <p style={{ margin: 0, fontSize: "14px", color: "#666" }}>Sistema Institucional de Afiliaciones</p>
                <p style={{ margin: "15px 0 30px 0", fontSize: "14px" }}>Fecha de expedición: {new Date().toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" })}</p>

                <div style={{ marginTop: "50px" }}>
                  <div style={{ width: "250px", borderBottom: "1px solid #000", marginBottom: "10px" }}></div>
                  <p style={{ margin: 0, fontWeight: "bold", fontSize: "16px" }}>Coordinación Comercial</p>
                  <p style={{ margin: 0, fontSize: "14px" }}>Fundación Isla Cascajal</p>
                </div>
              </div>

              <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "center", minWidth: "150px" }}>
                {/* El QR se inserta directamente en el PDF para mayor precisión */}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

