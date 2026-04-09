"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { collection, doc, setDoc, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
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
import { ArrowLeft, Eye, FileCheck, QrCode, Download, ExternalLink, User, IdCard, Calendar, Award } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import QRCode from "qrcode";

const VERIFICACION_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL + "/verificar?doc=";

// Función auxiliar para generar un código alfanumérico aleatorio (ejemplo: FICONG-4F8A0X1P)
function generarCodigo() {
  const caracteres = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let codigo = "FICONG-";
  for (let i = 0; i < 8; i++) {
    codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
  }
  return codigo;
}

// Componente de Generar: Se encarga de la captura de datos y subida a Firebase
export default function GenerarPage() {
  const { user, loading: authLoading } = useAuth();
  const [formData, setFormData] = useState({
    nombre: "",
    cedula: "",
    tipo: "",
    evento: "",
    descripcion: "",
  });
  const [isCreating, setIsCreating] = useState(false);
  const [documentoCreado, setDocumentoCreado] = useState(null);
  const [mostrarPreview, setMostrarPreview] = useState(false);

  // Cuando el usuario modifica un input en el formulario, actualizamos el respectivo estado
  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setDocumentoCreado(null);
    setMostrarPreview(false);
  };

  // Valida que los campos obligatorios del formulario no estén vacíos.
  const isFormValid = () => {
    if (!formData.nombre || !formData.cedula || !formData.tipo) return false;
    if (formData.tipo === "certificado" && !formData.evento) return false;
    return true;
  };

  const handlePreview = () => {
    if (!isFormValid()) {
      toast.error("Por favor, completa todos los campos requeridos");
      return;
    }
    setMostrarPreview(true);
  };

  // Ejecuta la creación del registro y lo guarda en la base de datos Firestore
  const handleCrear = async () => {
    if (!isFormValid()) {
      toast.error("Por favor, completa todos los campos requeridos");
      return;
    }

    setIsCreating(true);

    try {
      if (formData.tipo === "afiliado") {
        const q = query(
          collection(db, "documentos"),
          where("cedula", "==", formData.cedula),
          where("tipo", "==", "afiliado")
        );
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          toast.error("Esta persona ya está afiliada");
          setIsCreating(false);
          return;
        }
      }

      const codigo = generarCodigo();
      const link = VERIFICACION_BASE_URL + codigo;

      await setDoc(doc(db, "documentos", codigo), {
        nombre: formData.nombre.trim(),
        cedula: formData.cedula.trim(),
        tipo: formData.tipo,
        evento: formData.tipo === "certificado" ? formData.evento : null,
        descripcion: (formData.tipo === "certificado" || formData.tipo === "documento") ? formData.descripcion.trim() : null,
        estado: "activo", // ← siempre "activo" al crear
        fecha: new Date().toISOString(),
      });

      // Crea en paralelo un código QR visual con la librería qrcode
      const qrDataUrl = await QRCode.toDataURL(link, {
        width: 200,
        margin: 2,
        color: {
          dark: "#1e3a5f",
          light: "#ffffff",
        },
      });

      setDocumentoCreado({ codigo, link, qrDataUrl });
      toast.success("Documento creado exitosamente");
    } catch (error) {
      console.error(error);
      toast.error("Error al crear el documento");
    } finally {
      setIsCreating(false);
    }
  };

  // Automatiza la descarga del código QR una vez se generó el registro con éxito
  const handleDescargarQR = () => {
    if (!documentoCreado) return;
    const link = document.createElement("a");
    link.href = documentoCreado.qrDataUrl;
    link.download = `QR_${documentoCreado.codigo}.png`;
    link.click();
    toast.success("QR descargado");
  };

  const handleNuevoDocumento = () => {
    setFormData({ nombre: "", cedula: "", tipo: "", evento: "", descripcion: "" });
    setDocumentoCreado(null);
    setMostrarPreview(false);
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
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Logo" width={40} height={40} className="rounded-full" />
            <div>
              <h1 className="font-semibold text-foreground">Generar Documento</h1>
              <p className="text-xs text-muted-foreground">Fundación Isla Cascajal</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {documentoCreado ? (
          <Card className="text-center">
            <CardHeader className="pb-4">
              <div className="mx-auto w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mb-4">
                <FileCheck className="h-8 w-8 text-success" />
              </div>
              <CardTitle className="text-success">Documento Creado</CardTitle>
              <CardDescription>
                El documento ha sido registrado exitosamente en el sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="inline-block p-4 bg-muted rounded-xl">
                <Image
                  src={documentoCreado.qrDataUrl}
                  alt="Código QR"
                  width={200}
                  height={200}
                  className="mx-auto"
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Código del documento</p>
                <Badge variant="secondary" className="text-lg font-mono px-4 py-2">
                  {documentoCreado.codigo}
                </Badge>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={handleDescargarQR} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Descargar QR
                </Button>
                <Button variant="outline" asChild>
                  <a href={`${documentoCreado.link}&source=generar`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Verificar
                  </a>
                </Button>
                <Button onClick={handleNuevoDocumento}>
                  <QrCode className="h-4 w-4 mr-2" />
                  Nuevo Documento
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Información del Documento</CardTitle>
                <CardDescription>
                  Complete los datos para generar un nuevo documento verificable
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <Field>
                  <FieldLabel htmlFor="nombre">Nombre completo</FieldLabel>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="nombre"
                      placeholder="Ingrese el nombre completo"
                      value={formData.nombre}
                      onChange={(e) => handleInputChange("nombre", e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </Field>

                <Field>
                  <FieldLabel htmlFor="cedula">Cédula</FieldLabel>
                  <div className="relative">
                    <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="cedula"
                      placeholder="Número de identificación"
                      value={formData.cedula}
                      onChange={(e) => handleInputChange("cedula", e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </Field>

                <Field>
                  <FieldLabel htmlFor="tipo">Tipo de documento</FieldLabel>
                  <Select
                    value={formData.tipo}
                    onValueChange={(value) => handleInputChange("tipo", value)}
                  >
                    <SelectTrigger id="tipo">
                      <SelectValue placeholder="Seleccione el tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="certificado">Certificado</SelectItem>
                      <SelectItem value="afiliado">Afiliado</SelectItem>
                      <SelectItem value="documento">Documento</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                {formData.tipo === "certificado" && (
                  <Field>
                    <FieldLabel htmlFor="evento">Nombre del evento</FieldLabel>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="evento"
                        placeholder="Ej: Diplomado en Gestión Comunitaria"
                        value={formData.evento}
                        onChange={(e) => handleInputChange("evento", e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </Field>
                )}

                {(formData.tipo === "certificado" || formData.tipo === "documento") && (
                  <Field>
                    <FieldLabel htmlFor="descripcion">Descripción (Opcional)</FieldLabel>
                    <div className="relative">
                      <FileCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="descripcion"
                        placeholder="Breve descripción del documento"
                        value={formData.descripcion}
                        onChange={(e) => handleInputChange("descripcion", e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </Field>
                )}

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePreview}
                    disabled={!isFormValid()}
                    className="flex-1"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Previsualizar
                  </Button>
                  <Button
                    type="button"
                    onClick={handleCrear}
                    disabled={!isFormValid() || isCreating}
                    className="flex-1"
                  >
                    {isCreating ? (
                      <>
                        <Spinner className="mr-2" />
                        Generando...
                      </>
                    ) : (
                      <>
                        <FileCheck className="h-4 w-4 mr-2" />
                        Generar Documento
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {mostrarPreview && (
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    Vista Previa
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{formData.nombre}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <IdCard className="h-4 w-4 text-muted-foreground" />
                      <span>{formData.cedula}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Award className="h-4 w-4 text-muted-foreground" />
                      <Badge
                        variant={formData.tipo === "certificado" ? "default" : formData.tipo === "documento" ? "outline" : "secondary"}
                        className={
                          formData.tipo === "certificado"
                            ? "bg-success/10 text-success border-success/20"
                            : formData.tipo === "documento"
                              ? "bg-primary/10 text-primary border-primary/20"
                              : "bg-info/10 text-info border-info/20"
                        }
                      >
                        {formData.tipo === "certificado" ? "Certificado" : formData.tipo === "documento" ? "Documento" : "Afiliado"}
                      </Badge>
                    </div>
                    {formData.tipo === "certificado" && formData.evento && (
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{formData.evento}</span>
                      </div>
                    )}
                    {(formData.tipo === "certificado" || formData.tipo === "documento") && formData.descripcion && (
                      <div className="flex items-center gap-3">
                        <FileCheck className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{formData.descripcion}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
}