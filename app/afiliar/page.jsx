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

export default function AfiliarPage() {
  const { user, userData, loading: authLoading } = useAuth();
  const carnetRef = useRef(null);
  const exportRef = useRef(null);

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
    duracion: "1_ano",
    foto: null, // base64 o blob url
    oficina: "",
    dependencia: "",
    pais: "Colombia",
    ciudad: "",
    beneficiarios: [], // Array de { nombre: "", nuip: "" }
  });

  const [qrDataUrl, setQrDataUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [fotoPreview, setFotoPreview] = useState(null);

  // Generar QR en tiempo real cuando cambia el código
  useEffect(() => {
    const generateQR = async () => {
      try {
        const link = VERIFICACION_BASE_URL + formData.codigo;
        const url = await QRCode.toDataURL(link, {
          width: 150,
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

  const handleFotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("La foto es muy pesada (máx 2MB)");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFotoPreview(reader.result);
        setFormData(prev => ({ ...prev, foto: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGuardar = async () => {
    if (!formData.nombre || !formData.cedula || !formData.rh || !formData.telefono || !formData.oficina || !formData.dependencia) {
      toast.error("Por favor completa los campos obligatorios (incluye oficina y dependencia)");
      return;
    }

    setIsSaving(true);
    try {
      // Verificar si ya existe el documento
      const q = query(collection(db, "afiliados"), where("cedula", "==", formData.cedula));
      const snap = await getDocs(q);
      if (!snap.empty) {
        toast.error("Este número de documento ya está registrado como afiliado");
        setIsSaving(false);
        return;
      }

      // Calcular fecha de expiración
      const fIngreso = new Date(formData.fechaIngreso + "T12:00:00");
      let fExpiracion = new Date(fIngreso);
      if (formData.duracion === "6_meses") {
        fExpiracion.setMonth(fExpiracion.getMonth() + 6);
      } else {
        fExpiracion.setFullYear(fExpiracion.getFullYear() + 1);
      }

      const isoExpiracion = fExpiracion.toISOString();

      await setDoc(doc(db, "afiliados", formData.codigo), {
        ...formData,
        fechaExpiracion: isoExpiracion,
        fechaInicioPeriodo: new Date(formData.fechaIngreso + "T12:00:00").toISOString(),
        fecha: new Date(formData.fechaIngreso + "T12:00:00").toISOString(),
        periodos: [
          {
            inicio: new Date(formData.fechaIngreso + "T12:00:00").toISOString(),
            fin: isoExpiracion,
            duracion: formData.duracion,
            tipo: "registro",
            fecha: new Date().toISOString()
          }
        ],
        creadoPor: user.uid,
        fechaCreacion: new Date().toISOString(),
      });

      await registrarAuditoria({
        user,
        userData,
        accion: "Nueva Afiliación",
        documentoId: formData.codigo,
        detalles: `Se afilió a ${formData.nombre} con el código ${formData.codigo}`
      });

      toast.success("Afiliación guardada correctamente");

      // Limpiar formulario o redirigir
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
        duracion: "1_ano",
        foto: null,
        oficina: "",
        dependencia: "",
      });
      setFotoPreview(null);

    } catch (err) {
      console.error(err);
      toast.error("Error al guardar la afiliación");
    } finally {
      setIsSaving(false);
    }
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
                  <Select value={formData.estado} onValueChange={(v) => handleInputChange("estado", v)}>
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
                    />
                  </div>
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field>
                  <FieldLabel>País</FieldLabel>
                  <Select value={formData.pais} onValueChange={(v) => handleInputChange("pais", v)}>
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
                    />
                  </div>
                </Field>
              </div>

              <Field className="max-w-[200px]">
                <FieldLabel>Duración de Afiliación</FieldLabel>
                <Select
                  value={formData.duracion}
                  onValueChange={(val) => handleInputChange("duracion", val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione duración" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6_meses">6 Meses</SelectItem>
                    <SelectItem value="1_ano">1 Año</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel>Oficina que emite</FieldLabel>
                <Select
                  value={formData.oficina}
                  onValueChange={(value) => handleInputChange("oficina", value)}
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
                  <Button type="button" variant="outline" size="xs" onClick={handleAddBeneficiario} className="h-7 text-[10px]">
                    <Plus className="h-3 w-3 mr-1" /> Agregar
                  </Button>
                </FieldLabel>
                <div className="space-y-3">
                  {formData.beneficiarios.length === 0 && (
                    <p className="text-xs text-muted-foreground italic bg-muted/50 p-2 rounded-lg text-center">No hay beneficiarios agregados</p>
                  )}
                  {formData.beneficiarios.map((ben, idx) => (
                    <div key={idx} className="bg-muted/30 p-3 rounded-lg border space-y-2 relative">
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 absolute top-1 right-1 text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemoveBeneficiario(idx)}
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
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-muted-foreground">NUIP</label>
                          <Input 
                            value={ben.nuip} 
                            onChange={(e) => handleBeneficiarioChange(idx, "nuip", e.target.value)}
                            className="h-8 text-xs font-mono"
                            placeholder="Documento"
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
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={handleFotoChange}
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Click en el recuadro para subir foto.</p>
                    <p className="text-[10px] text-muted-foreground mt-1 italic">Preferiblemente fondo blanco y buena iluminación.</p>
                  </div>
                </div>
              </Field>

              <div className="pt-4 flex gap-3">
                <Button
                  className="flex-1 h-12 text-base font-bold shadow-md shadow-primary/20"
                  onClick={handleGuardar}
                  disabled={isSaving}
                >
                  {isSaving ? <Spinner className="mr-2" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
                  GUARDAR AFILIACIÓN
                </Button>
                <Button
                  variant="outline"
                  className="h-12 px-6 border-2"
                  onClick={descargarCarnet}
                  disabled={isDownloading}
                  title="Descargar como Imagen"
                >
                  {isDownloading ? <Spinner /> : <Download className="h-5 w-5" />}
                </Button>
              </div>
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
                </div>

                {formData.beneficiarios?.length > 0 && (
                  <div className="mt-4 w-full bg-muted/20 p-2 rounded-xl border border-dashed border-muted-foreground/30">
                    <p className="text-[8px] font-black uppercase text-muted-foreground mb-1 text-center">Beneficiarios</p>
                    <div className="grid grid-cols-1 gap-1">
                      {formData.beneficiarios.map((b, i) => (
                        <div key={i} className="flex justify-between items-center px-2">
                          <span className="text-[9px] font-bold text-primary truncate max-w-[120px] uppercase">{b.nombre}</span>
                          <span className="text-[9px] font-mono text-muted-foreground">{b.nuip}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
                    <p style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', color: '#94a3b8', margin: 0 }}>Código</p>
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
                </div>

                {formData.beneficiarios?.length > 0 && (
                  <div style={{ marginTop: '12px', width: '100%', backgroundColor: '#f1f5f9', padding: '8px', borderRadius: '12px', border: '1px dashed #94a3b8' }}>
                    <p style={{ fontSize: '8px', fontWeight: 900, textTransform: 'uppercase', color: '#64748b', marginBottom: '4px', textAlign: 'center', margin: 0 }}>Beneficiarios</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '4px' }}>
                      {formData.beneficiarios.map((b, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: '8px', paddingRight: '8px' }}>
                          <span style={{ fontSize: '9px', fontWeight: 'bold', color: COLORS.azul, textTransform: 'uppercase', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: '120px' }}>{b.nombre}</span>
                          <span style={{ fontSize: '9px', fontFamily: 'monospace', color: '#64748b' }}>{b.nuip}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
        </main>
      </div>
    );
  }
