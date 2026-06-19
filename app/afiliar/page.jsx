"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { collection, doc, setDoc, query, where, getDocs, limit, updateDoc, increment, arrayUnion } from "firebase/firestore";
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
  Users,
  ShieldAlert,
  HeartPulse,
  GraduationCap,
  HeartHandshake
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import QRCode from "qrcode";
import html2canvas from "html2canvas";
import { FileText as FileTextIcon } from "lucide-react";

const getVerificacionBaseUrl = () => `${window.location.origin}/verificar?doc=`;

const PAISES = [
  "Colombia", "Venezuela", "Ecuador", "Perú", "Chile", "Argentina", "Brasil", "Panamá", "México", "Estados Unidos", "España", "Otro"
];

const DEPARTAMENTOS_COLOMBIA = [
  "Amazonas", "Antioquia", "Arauca", "Atlántico", "Bolívar", "Boyacá", "Caldas", "Caquetá", "Casanare", "Cauca", "Cesar", "Chocó", "Córdoba", "Cundinamarca", "Guainía", "Guaviare", "Huila", "La Guajira", "Magdalena", "Meta", "Nariño", "Norte de Santander", "Putumayo", "Quindío", "Risaralda", "San Andrés y Providencia", "Santander", "Sucre", "Tolima", "Valle del Cauca", "Vaupés", "Vichada"
];

const ETNIAS = ["Afrodiaspórico (Negro)", "Afrodiaspórico (Afro)", "Afrodiaspórico (Palenquero)", "Afrodiaspórico (Raizal)", "Originario (Indígena)", "Mestizo", "ROM", "Caucásico (Blanco)"];
const TIPOS_VICTIMA = ["Desplazamiento", "Homicidio", "Amenazas", "Desaparición forzosa", "Pérdida de bienes", "Atentados", "Secuestros", "Delitos contra la libertad sexual", "Daños por explosivos", "Abandono o expulsión de tierras", "Torturas", "Reclutamiento de NNA"];
const TIPOS_DISCRIMINACION = ["Raza", "Por país de origen", "Por lugar de nacimiento", "Lugar de origen/procedencia/destino", "Por género", "Por religión", "Por discapacidad", "Por identidad cultural", "Por identidad ideológica", "Por situación socioeconómica", "Por nivel académico", "Por edad", "Por situación de salud", "Por condición familiar", "Por aspecto físico"];
const NIVELES_EDUCATIVOS = ["Ninguno", "Primaria", "Bachiller", "Técnico", "Tecnólogo", "Pregrado (Universitario)", "Especialización o posgrado", "Maestría", "Doctorado", "Posdoctorado"];
const TIPOS_DISCAPACIDAD = ["Múltiple", "Auditiva", "Visual", "Física", "Intelectual", "Psicosocial", "Del habla", "Otro"];
const TIPOS_TRASTORNO = ["Dislexia", "Autismo", "De la percepción visual", "De la memoria", "Otro"];

// Colores Institucionales
const COLORS = {
  azul: "#3f7384",
  verde: "#606f3a",
  amarillo: "#f4b958",
  rojo: "#cd7243"
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
    fechaNacimiento: "",
    lugarNacimiento: "",
    edad: "",
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
    otroPais: "",
    departamento: "",
    ciudad: "",
    beneficiarios: [],
    mascotas: [],
    seleccionMembresias: {
      educativa: true,
      integral: false,
    },
    // Nuevos Campos Perfil (Igual a /registro)
    sexo: "", orientacionSexual: "", orientacionOtro: "", estrato: "", etnia: "",
    sisben: "", sisbenPuntaje: "", asesoriaSisben: "", victimaConflicto: "", victimaTipo: "", victimaInscrito: "",
    discriminacion: "", discriminacionTipo: "",
    educacionNivel: "", educacionEstudio: "", educacionSemestre: "", educacionPlantel: "",
    eps: "", arl: "", enfermedad: "", enfermedadCual: "", alergia: "", alergiaCual: "",
    discapacidad: "", discapacidadTipo: "", discapacidadOtro: "", trastorno: "", trastornoTipo: "", trastornoOtro: "", condicionEspecial: "", condicionEspecialCual: "",
    comoEntero: "", referido: "", codigoReferidor: "",
    deseaSerVoluntario: "",
    emergenciaNombre: "", emergenciaNumero: "", emergenciaWhatsapp: "", emergenciaDireccion: "",
  });

  const [showExtraInfo, setShowExtraInfo] = useState(false);

  const [qrDataUrl, setQrDataUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isVerifyingReferidor, setIsVerifyingReferidor] = useState(false);
  const [referidorNombre, setReferidorNombre] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadingCert, setIsDownloadingCert] = useState(null); // null, 'educativa', or 'integral'
  const [fotoPreview, setFotoPreview] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [tipoCertificadoActual, setTipoCertificadoActual] = useState(null); // 'educativa' o 'integral'
  const [currentCertData, setCurrentCertData] = useState(null); // Para compatibilidad con templates del dashboard

  // Generar QR en tiempo real cuando cambia el código
  useEffect(() => {
    const generateQR = async () => {
      try {
        const link = getVerificacionBaseUrl() + formData.codigo;
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
      let finalValue = value;
      if (field === "cedula") {
        const numbersOnly = value.replace(/\D/g, "");
        finalValue = numbersOnly.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      }
      const newData = { ...prev, [field]: finalValue };

      if (field === "fechaNacimiento") {
        if (value) {
          const birthDate = new Date(value);
          const today = new Date();
          let age = today.getFullYear() - birthDate.getFullYear();
          const m = today.getMonth() - birthDate.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
          newData.edad = age >= 0 ? age.toString() : "";
        } else {
          newData.edad = "";
        }
      }

      if (field === "oficina") {
        newData.dependencia = "";
      }
      return newData;
    });

    if (field === "comoEntero" && value !== "Referido") {
      setReferidorNombre(null);
      setFormData(prev => ({ ...prev, codigoReferidor: "" }));
    }
    if (field === "codigoReferidor") {
      setReferidorNombre(null);
    }
  };

  const verificarReferidor = async () => {
    if (!formData.codigoReferidor.trim()) {
      return toast.error("Por favor, ingresa un código primero.");
    }
    setIsVerifyingReferidor(true);
    setReferidorNombre(null);
    try {
      const refQ = query(collection(db, "afiliados"), where("codigoInstitucional", "==", formData.codigoReferidor.trim().toUpperCase()));
      const refSnap = await getDocs(refQ);
      if (!refSnap.empty) {
        setReferidorNombre(refSnap.docs[0].data().nombre);
        toast.success("¡Código válido!");
      } else {
        toast.error("Código no encontrado. Verifica si está bien escrito.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Error al verificar el código.");
    } finally {
      setIsVerifyingReferidor(false);
    }
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
    let finalValue = value;
    if (field === "nuip") {
      const numbersOnly = value.replace(/\D/g, "");
      finalValue = numbersOnly.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }
    newBeneficiarios[index][field] = finalValue;
    setFormData(prev => ({ ...prev, beneficiarios: newBeneficiarios }));
  };

  const handleRemoveBeneficiario = (index) => {
    setFormData(prev => ({
      ...prev,
      beneficiarios: prev.beneficiarios.filter((_, i) => i !== index)
    }));
  };

  const handleAddMascota = () => {
    if (formData.mascotas?.length >= 2) {
      toast.error("Máximo 2 mascotas permitidas");
      return;
    }
    setFormData(prev => ({
      ...prev,
      mascotas: [...(prev.mascotas || []), { nombre: "", tipo: "", raza: "" }]
    }));
  };

  const handleMascotaChange = (index, field, value) => {
    const newMascotas = [...(formData.mascotas || [])];
    newMascotas[index][field] = value;
    setFormData(prev => ({ ...prev, mascotas: newMascotas }));
  };

  const handleRemoveMascota = (index) => {
    setFormData(prev => ({
      ...prev,
      mascotas: (prev.mascotas || []).filter((_, i) => i !== index)
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
    // Validar Básicos
    const camposBasicos = ["nombre", "cedula", "fechaNacimiento", "lugarNacimiento", "rh", "telefono", "correo", "direccion", "ciudad"];
    for (const campo of camposBasicos) {
      if (!formData[campo]) {
        toast.error("Por favor completa los campos básicos obligatorios");
        return;
      }
    }

    // Validar Encuesta Extendida Obligatoria
    const camposEncuesta = ["sexo", "orientacionSexual", "estrato", "etnia", "sisben", "victimaConflicto", "discriminacion", "educacionNivel", "eps", "arl", "enfermedad", "alergia", "discapacidad", "trastorno"];
    for (const campo of camposEncuesta) {
      if (!formData[campo]) {
        setShowExtraInfo(true);
        return toast.error("La información demográfica (Perfil, Salud, Educación) es obligatoria.");
      }
    }

    // Validar Condicionales de la Encuesta
    if (formData.orientacionSexual === "Otro" && !formData.orientacionOtro) return toast.error("Especifique su orientación sexual");
    if (formData.sisben === "Sí" && !formData.sisbenPuntaje) return toast.error("Complete su puntaje de Sisbén");
    if (formData.sisben === "No" && !formData.asesoriaSisben) return toast.error("Indique si desea asesoría para el Sisbén");
    if (formData.victimaConflicto === "Sí" && (!formData.victimaTipo || !formData.victimaInscrito)) return toast.error("Complete los datos de víctima del conflicto");
    if (formData.discriminacion === "Sí" && !formData.discriminacionTipo) return toast.error("Especifique el tipo de discriminación");
    if (formData.enfermedad === "Sí" && !formData.enfermedadCual) return toast.error("Especifique la enfermedad");
    if (formData.alergia === "Sí" && !formData.alergiaCual) return toast.error("Especifique la alergia");
    if (formData.discapacidad === "Sí" && !formData.discapacidadTipo) return toast.error("Especifique la discapacidad");
    if (formData.trastorno === "Sí" && !formData.trastornoTipo) return toast.error("Especifique el trastorno");
    if (formData.trastornoTipo === "Otro" && !formData.trastornoOtro) return toast.error("Especifique el otro trastorno");
    if (formData.condicionEspecial === "Sí" && !formData.condicionEspecialCual) return toast.error("Especifique la condición especial");

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
        const meses = 12; // Ahora predeterminado a 1 año
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
      const q = query(collection(db, "afiliados"), where("cedula", "==", formData.cedula), limit(1));
      const snap = await getDocs(q);

      let finalId = formData.codigo;
      let dataToSave = {
        nombre: formData.nombre.trim(), cedula: formData.cedula.trim(), telefono: formData.telefono,
        correo: formData.correo, direccion: formData.direccion, rh: formData.rh,
        fechaNacimiento: formData.fechaNacimiento, lugarNacimiento: formData.lugarNacimiento, edad: formData.edad,
        foto: formData.foto,
        pais: formData.pais === "Otro" ? formData.otroPais : formData.pais,
        departamento: formData.pais === "Colombia" ? formData.departamento : "",
        ciudad: formData.ciudad,
        oficina: formData.oficina,
        dependencia: formData.dependencia,
        cargo: formData.cargo,
        beneficiarios: formData.seleccionMembresias.integral ? formData.beneficiarios.filter(b => b.nombre.trim() !== "") : [],
        mascotas: formData.seleccionMembresias.integral ? (formData.mascotas || []).filter(m => m.nombre.trim() !== "") : [],
        estado: "activo",
        membresias: nuevasMembresias,
        fechaUltimaActualizacion: new Date().toISOString(),

        // Datos de Perfilado
        sexo: formData.sexo,
        orientacionSexual: formData.orientacionSexual === "Otro" ? formData.orientacionOtro : formData.orientacionSexual,
        estrato: formData.estrato,
        etnia: formData.etnia,
        sisben: formData.sisben,
        sisbenPuntaje: formData.sisben === "Sí" ? formData.sisbenPuntaje : "N/A",
        asesoriaSisben: formData.sisben === "No" ? formData.asesoriaSisben : "N/A",
        victimaConflicto: formData.victimaConflicto,
        victimaTipo: formData.victimaConflicto === "Sí" ? formData.victimaTipo : "N/A",
        victimaInscrito: formData.victimaConflicto === "Sí" ? formData.victimaInscrito : "N/A",
        discriminacion: formData.discriminacion,
        discriminacionTipo: formData.discriminacion === "Sí" ? formData.discriminacionTipo : "N/A",
        educacionNivel: formData.educacionNivel,
        educacionEstudio: formData.educacionNivel === "Ninguno" ? "N/A" : (formData.educacionEstudio || "N/A"),
        educacionSemestre: formData.educacionNivel === "Ninguno" ? "N/A" : (formData.educacionSemestre || "N/A"),
        educacionPlantel: formData.educacionNivel === "Ninguno" ? "N/A" : (formData.educacionPlantel || "N/A"),
        eps: formData.eps,
        arl: formData.arl,
        enfermedad: formData.enfermedad,
        enfermedadCual: formData.enfermedad === "Sí" ? formData.enfermedadCual : "N/A",
        alergia: formData.alergia,
        alergiaCual: formData.alergia === "Sí" ? formData.alergiaCual : "N/A",
        discapacidad: formData.discapacidad,
        discapacidadTipo: formData.discapacidad === "Sí" ? (formData.discapacidadTipo === "Otro" ? formData.discapacidadOtro : formData.discapacidadTipo) : "N/A",
        trastorno: formData.trastorno,
        trastornoTipo: formData.trastorno === "Sí" ? (formData.trastornoTipo === "Otro" ? formData.trastornoOtro : formData.trastornoTipo) : "N/A",
        condicionEspecial: formData.condicionEspecial,
        condicionEspecialCual: formData.condicionEspecial === "Sí" ? formData.condicionEspecialCual : "N/A",
        comoEntero: formData.comoEntero,
        referido: formData.comoEntero === "Referido" ? formData.referido : "N/A",
        codigoReferidor: formData.comoEntero === "Referido" ? formData.codigoReferidor : "N/A",
        deseaSerVoluntario: formData.deseaSerVoluntario,
        emergenciaNombre: formData.deseaSerVoluntario === "Sí" ? formData.emergenciaNombre : "N/A",
        emergenciaNumero: formData.deseaSerVoluntario === "Sí" ? formData.emergenciaNumero : "N/A",
        emergenciaWhatsapp: formData.deseaSerVoluntario === "Sí" ? formData.emergenciaWhatsapp : "N/A",
        emergenciaDireccion: formData.deseaSerVoluntario === "Sí" ? formData.emergenciaDireccion : "N/A",
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

      // Lógica de Plan Referidos: Incrementar el contador del referidor si existe
      if (formData.comoEntero === "Referido" && formData.codigoReferidor.trim() !== "") {
        try {
          const refQ = query(collection(db, "afiliados"), where("codigoInstitucional", "==", formData.codigoReferidor.trim().toUpperCase()));
          const refSnap = await getDocs(refQ);
          if (!refSnap.empty) {
            const referrerDoc = refSnap.docs[0];
            await updateDoc(doc(db, "afiliados", referrerDoc.id), {
              referidosExitosos: increment(1),
              listaReferidos: arrayUnion({
                nombre: formData.nombre,
                cedula: formData.cedula,
                fecha: new Date().toISOString()
              })
            });
          }
        } catch (error) {
          console.error("Error actualizando referido:", error);
        }
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
      otroPais: "",
      departamento: "",
      ciudad: "",
      beneficiarios: [],
      mascotas: [],
      comoEntero: "",
      codigoReferidor: "",
      seleccionMembresias: {
        educativa: true,
        integral: false,
      }
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

  const descargarCertificado = async (tipoMembresia = null) => {
    const membresia = formData.membresias.find(m => m.tipo === tipoMembresia);
    if (!membresia) {
      toast.error("No se encontró la membresía correspondiente");
      return;
    }

    setCurrentCertData({ persona: formData, membresia, fechaImpresion: new Date().toLocaleDateString("es-CO") });
    setTipoCertificadoActual(tipoMembresia);
    setIsDownloadingCert(tipoMembresia);

    try {
      // Esperar un momento para que el DOM se actualice
      await new Promise(resolve => setTimeout(resolve, 800));

      const templateId = tipoMembresia === 'educativa' ? 'hidden-cert-edu-confirm' : 'hidden-cert-integral-confirm';
      const element = document.getElementById(templateId);
      if (!element) throw new Error("Template no encontrado");

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff"
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

      pdf.save(`Certificado_${tipoMembresia === 'educativa' ? 'Educativa' : 'Integral'}_${formData.nombre.trim().replace(/\s+/g, "_")}.pdf`);

      toast.success(`Certificado ${tipoMembresia === 'educativa' ? 'Educativo' : 'Integral'} generado correctamente`);
    } catch (err) {
      console.error("Error certificado:", err);
      toast.error("Error al generar el certificado");
    } finally {
      setIsDownloadingCert(null);
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
                  <FieldLabel>Nombres y Apellidos Completos <span className="text-red-500">*</span></FieldLabel>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Escriba el nombre completo"
                      className="pl-10 uppercase"
                      value={formData.nombre}
                      onChange={(e) => handleInputChange("nombre", e.target.value.toUpperCase())}
                      disabled={isSaving}
                    />
                  </div>
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel>No. Identificación (NUIP) <span className="text-red-500">*</span></FieldLabel>
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
                    <FieldLabel>Fecha de Nacimiento <span className="text-red-500">*</span></FieldLabel>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="date"
                        className="pl-10"
                        value={formData.fechaNacimiento}
                        onChange={(e) => handleInputChange("fechaNacimiento", e.target.value)}
                        disabled={isSaving}
                      />
                    </div>
                  </Field>
                  <Field>
                    <FieldLabel>Lugar de Nacimiento <span className="text-red-500">*</span></FieldLabel>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Ej. Cali, Valle del Cauca"
                        className="pl-10"
                        value={formData.lugarNacimiento}
                        onChange={(e) => handleInputChange("lugarNacimiento", e.target.value)}
                        disabled={isSaving}
                      />
                    </div>
                  </Field>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel>Edad Calculada</FieldLabel>
                    <Input value={formData.edad} className="bg-slate-100 text-slate-500 font-bold" readOnly placeholder="Automático" disabled={isSaving} />
                  </Field>
                  <Field>
                    <FieldLabel>Grupo Sanguíneo RH <span className="text-red-500">*</span></FieldLabel>
                    <div className="relative">
                      <Droplets className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive z-10" />
                      <Select value={formData.rh} onValueChange={(v) => handleInputChange("rh", v)} disabled={isSaving}>
                        <SelectTrigger className="pl-10">
                          <SelectValue placeholder="Seleccione RH" />
                        </SelectTrigger>
                        <SelectContent>
                          {["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"].map(rh => (
                            <SelectItem key={rh} value={rh}>{rh}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                    <div className="space-y-2">
                      <Select value={formData.pais} onValueChange={(v) => handleInputChange("pais", v)} disabled={isSaving}>
                        <SelectTrigger className="pl-10 relative">
                          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <SelectValue placeholder="Seleccione país" />
                        </SelectTrigger>
                        <SelectContent>
                          {PAISES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {formData.pais === "Otro" && (
                        <Input
                          placeholder="Escriba el nombre del país"
                          value={formData.otroPais}
                          onChange={(e) => handleInputChange("otroPais", e.target.value)}
                          disabled={isSaving}
                        />
                      )}
                    </div>
                  </Field>

                  {formData.pais === "Colombia" && (
                    <Field>
                      <FieldLabel>Departamento</FieldLabel>
                      <Select value={formData.departamento} onValueChange={(v) => handleInputChange("departamento", v)} disabled={isSaving}>
                        <SelectTrigger className="pl-10 relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <SelectValue placeholder="Seleccione departamento" />
                        </SelectTrigger>
                        <SelectContent>
                          {DEPARTAMENTOS_COLOMBIA.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}

                  <Field>
                    <FieldLabel>Ciudad / Municipio</FieldLabel>
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
                        onCheckedChange={(v) => {
                          const isIntegral = !!v;
                          setFormData(p => ({
                            ...p,
                            seleccionMembresias: { ...p.seleccionMembresias, integral: isIntegral },
                            beneficiarios: isIntegral && p.beneficiarios.length === 0
                              ? Array.from({ length: 5 }, () => ({ nombre: "", nuip: "" }))
                              : p.beneficiarios,
                            mascotas: isIntegral && (!p.mascotas || p.mascotas.length === 0)
                              ? Array.from({ length: 2 }, () => ({ nombre: "", tipo: "", raza: "" }))
                              : p.mascotas,
                          }));
                        }}
                      />
                      <label htmlFor="int" className="text-sm font-medium leading-none cursor-pointer">Afiliación Integral</label>
                    </div>
                  </div>
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
                      {formData.oficina ? (
                        <SelectItem value="Coordinación Comercial">Coordinación Comercial</SelectItem>
                      ) : null}
                    </SelectContent>
                  </Select>
                </Field>

                {formData.seleccionMembresias.integral && (
                  <Field>
                    <FieldLabel className="flex justify-between items-center">
                      Beneficiarios (Membresía Integral - Máx 5)
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
                )}

                {formData.seleccionMembresias.integral && (
                  <Field>
                    <FieldLabel className="flex justify-between items-center">
                      Mascotas (Membresía Integral - Máx 2)
                      <Button type="button" variant="outline" size="xs" onClick={handleAddMascota} className="h-7 text-[10px]" disabled={isSaving}>
                        <Plus className="h-3 w-3 mr-1" /> Agregar
                      </Button>
                    </FieldLabel>
                    <div className="space-y-3">
                      {(!formData.mascotas || formData.mascotas.length === 0) && (
                        <p className="text-xs text-muted-foreground italic bg-muted/50 p-2 rounded-lg text-center">No hay mascotas agregadas</p>
                      )}
                      {formData.mascotas?.map((mascota, idx) => (
                        <div key={idx} className="bg-muted/30 p-3 rounded-lg border space-y-2 relative">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 absolute top-1 right-1 text-destructive hover:bg-destructive/10"
                            onClick={() => handleRemoveMascota(idx)}
                            disabled={isSaving}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase text-muted-foreground">Nombre</label>
                              <Input
                                value={mascota.nombre}
                                onChange={(e) => handleMascotaChange(idx, "nombre", e.target.value)}
                                className="h-8 text-xs"
                                placeholder="Nombre mascota"
                                disabled={isSaving}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase text-muted-foreground">Tipo de Animal</label>
                              <Input
                                value={mascota.tipo}
                                onChange={(e) => handleMascotaChange(idx, "tipo", e.target.value)}
                                className="h-8 text-xs"
                                placeholder="Ej: Perro, Gato"
                                disabled={isSaving}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase text-muted-foreground">Raza (Opcional)</label>
                              <Input
                                value={mascota.raza}
                                onChange={(e) => handleMascotaChange(idx, "raza", e.target.value)}
                                className="h-8 text-xs"
                                placeholder="Raza"
                                disabled={isSaving}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Field>
                )}
                {/* SECCIÓN EXTRA DEMOGRÁFICA (EXPANSIBLE) */}
                <div className="w-full mt-8 pt-6 border-t border-slate-200">
                  <div className="flex flex-col items-center gap-2 mb-6">
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-wider text-center">Información Requerida para el Perfilamiento Social</p>
                    <Button
                      type="button"
                      variant="outline"
                      className={`w-full max-w-md font-bold shadow-sm transition-all ${showExtraInfo ? 'bg-slate-100 border-slate-300 text-slate-700' : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:border-blue-300'}`}
                      onClick={() => setShowExtraInfo(!showExtraInfo)}
                    >
                      {showExtraInfo ? "Ocultar Información Demográfica" : "Llenar Información Demográfica (Obligatorio)"}
                    </Button>
                  </div>

                  {showExtraInfo && (
                    <div className="space-y-8 animate-in slide-in-from-top-4 fade-in duration-500">
                      {/* SECCIÓN 2: PERFIL DEMOGRÁFICO Y DIVERSIDAD */}
                      <Card className="shadow-md border-0 overflow-hidden border-t-4" style={{ borderTopColor: COLORS.verde }}>
                        <div className="bg-green-50/50 p-3 border-b border-green-100 flex items-center gap-3">
                          <Users className="h-5 w-5" style={{ color: COLORS.verde }} />
                          <h2 className="text-lg font-bold" style={{ color: COLORS.verde }}>Perfil Demográfico e Identidad</h2>
                        </div>
                        <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          <Field>
                            <FieldLabel>Sexo biológico <span className="text-red-500">*</span></FieldLabel>
                            <Select value={formData.sexo} onValueChange={(v) => handleInputChange("sexo", v)}>
                              <SelectTrigger className="border-green-200"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                              <SelectContent><SelectItem value="Masculino">Masculino</SelectItem><SelectItem value="Femenino">Femenino</SelectItem></SelectContent>
                            </Select>
                          </Field>
                          <Field>
                            <FieldLabel>Orientación Sexual <span className="text-red-500">*</span></FieldLabel>
                            <div className="space-y-2">
                              <Select value={formData.orientacionSexual} onValueChange={(v) => handleInputChange("orientacionSexual", v)}>
                                <SelectTrigger className="border-green-200"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Heterosexual">Heterosexual</SelectItem>
                                  <SelectItem value="Homosexual">Homosexual</SelectItem>
                                  <SelectItem value="Bisexual">Bisexual</SelectItem>
                                  <SelectItem value="Otro">Otro</SelectItem>
                                </SelectContent>
                              </Select>
                              {formData.orientacionSexual === "Otro" && <Input placeholder="¿Cuál?" value={formData.orientacionOtro} onChange={(e) => handleInputChange("orientacionOtro", e.target.value)} />}
                            </div>
                          </Field>
                          <Field>
                            <FieldLabel>Estrato Socioeconómico <span className="text-red-500">*</span></FieldLabel>
                            <Select value={formData.estrato} onValueChange={(v) => handleInputChange("estrato", v)}>
                              <SelectTrigger className="border-green-200"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                              <SelectContent>{["1", "2", "3", "4", "5", "6"].map(e => <SelectItem key={e} value={e}>Estrato {e}</SelectItem>)}</SelectContent>
                            </Select>
                          </Field>
                          <Field>
                            <FieldLabel>Grupo Étnico <span className="text-red-500">*</span></FieldLabel>
                            <Select value={formData.etnia} onValueChange={(v) => handleInputChange("etnia", v)}>
                              <SelectTrigger className="border-green-200"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                              <SelectContent>{ETNIAS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                            </Select>
                          </Field>
                        </CardContent>
                      </Card>

                      {/* SECCIÓN 3: VULNERABILIDAD */}
                      <Card className="shadow-md border-0 overflow-hidden border-t-4" style={{ borderTopColor: COLORS.amarillo }}>
                        <div className="bg-yellow-50/50 p-3 border-b border-yellow-100 flex items-center gap-3">
                          <ShieldAlert className="h-5 w-5" style={{ color: "#ca8a04" }} />
                          <h2 className="text-lg font-bold" style={{ color: "#ca8a04" }}>Contexto Social y Vulnerabilidad</h2>
                        </div>
                        <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-3">
                            <Field>
                              <FieldLabel>¿Tiene Sisbén? <span className="text-red-500">*</span></FieldLabel>
                              <Select value={formData.sisben} onValueChange={(v) => { 
                                handleInputChange("sisben", v); 
                                if(v==="No") handleInputChange("sisbenPuntaje", ""); 
                                if(v==="Sí") handleInputChange("asesoriaSisben", "");
                              }}>
                                <SelectTrigger className="border-yellow-200"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                <SelectContent><SelectItem value="Sí">Sí</SelectItem><SelectItem value="No">No</SelectItem></SelectContent>
                              </Select>
                            </Field>
                            {formData.sisben === "Sí" && (
                              <Field>
                                <FieldLabel>Puntaje / Categoría <span className="text-red-500">*</span></FieldLabel>
                                <Input placeholder="Ej. A1, B2" value={formData.sisbenPuntaje} onChange={(e) => handleInputChange("sisbenPuntaje", e.target.value)} className="border-yellow-200" />
                              </Field>
                            )}
                            {formData.sisben === "No" && (
                              <Field>
                                <FieldLabel>¿Desea recibir asesoría para encuesta e inscripción al SISBEN? <span className="text-red-500">*</span></FieldLabel>
                                <Select value={formData.asesoriaSisben} onValueChange={(v) => handleInputChange("asesoriaSisben", v)}>
                                  <SelectTrigger className="border-yellow-200"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                  <SelectContent><SelectItem value="Sí">Sí</SelectItem><SelectItem value="No">No</SelectItem></SelectContent>
                                </Select>
                              </Field>
                            )}
                          </div>

                          <Field className="md:col-span-2 border-t pt-3 border-yellow-100">
                            <FieldLabel>¿Es víctima del conflicto armado? <span className="text-red-500">*</span></FieldLabel>
                            <Select value={formData.victimaConflicto} onValueChange={(v) => { handleInputChange("victimaConflicto", v); if (v === "No") { handleInputChange("victimaTipo", ""); handleInputChange("victimaInscrito", ""); } }}>
                              <SelectTrigger className="border-yellow-200"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                              <SelectContent><SelectItem value="Sí">Sí</SelectItem><SelectItem value="No">No</SelectItem></SelectContent>
                            </Select>
                          </Field>
                          {formData.victimaConflicto === "Sí" && (
                            <>
                              <Field>
                                <FieldLabel>¿Qué tipo de víctima es? <span className="text-red-500">*</span></FieldLabel>
                                <Select value={formData.victimaTipo} onValueChange={(v) => handleInputChange("victimaTipo", v)}>
                                  <SelectTrigger className="border-yellow-200"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Ninguna">Ninguna</SelectItem>
                                    {TIPOS_VICTIMA.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </Field>
                              <Field>
                                <FieldLabel>¿Está inscrito en la Unidad de Víctimas? <span className="text-red-500">*</span></FieldLabel>
                                <Select value={formData.victimaInscrito} onValueChange={(v) => handleInputChange("victimaInscrito", v)}>
                                  <SelectTrigger className="border-yellow-200"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                  <SelectContent><SelectItem value="Sí">Sí</SelectItem><SelectItem value="No">No</SelectItem></SelectContent>
                                </Select>
                              </Field>
                            </>
                          )}

                          <Field className="md:col-span-2 border-t pt-3 border-yellow-100">
                            <FieldLabel>¿Es víctima de discriminación? <span className="text-red-500">*</span></FieldLabel>
                            <Select value={formData.discriminacion} onValueChange={(v) => { handleInputChange("discriminacion", v); if (v === "No") handleInputChange("discriminacionTipo", ""); }}>
                              <SelectTrigger className="border-yellow-200"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                              <SelectContent><SelectItem value="Sí">Sí</SelectItem><SelectItem value="No">No</SelectItem></SelectContent>
                            </Select>
                          </Field>
                          {formData.discriminacion === "Sí" && (
                            <Field>
                              <FieldLabel>¿Qué tipo de discriminación sufre? <span className="text-red-500">*</span></FieldLabel>
                              <Select value={formData.discriminacionTipo} onValueChange={(v) => handleInputChange("discriminacionTipo", v)}>
                                <SelectTrigger className="border-yellow-200"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Ninguna">Ninguna</SelectItem>
                                  {TIPOS_DISCRIMINACION.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </Field>
                          )}
                        </CardContent>
                      </Card>

                      {/* SECCIÓN 4: EDUCACIÓN */}
                      <Card className="shadow-md border-0 overflow-hidden border-t-4 border-blue-500">
                        <div className="bg-blue-50/50 p-3 border-b border-blue-100 flex items-center gap-3">
                          <GraduationCap className="h-5 w-5 text-blue-600" />
                          <h2 className="text-lg font-bold text-blue-800">Formación Académica</h2>
                        </div>
                        <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Field>
                            <FieldLabel>Nivel Educativo <span className="text-red-500">*</span></FieldLabel>
                            <Select value={formData.educacionNivel} onValueChange={(v) => {
                              handleInputChange("educacionNivel", v);
                              if (v === "Ninguno") {
                                handleInputChange("educacionEstudio", "");
                                handleInputChange("educacionSemestre", "");
                                handleInputChange("educacionPlantel", "");
                              }
                            }}>
                              <SelectTrigger className="border-blue-200"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                              <SelectContent>{NIVELES_EDUCATIVOS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                            </Select>
                          </Field>
                          {formData.educacionNivel !== "Ninguno" && (
                            <>
                              <Field>
                                <FieldLabel>¿Qué estudia/estudió?</FieldLabel>
                                <Input placeholder="Ej. Ingeniería" value={formData.educacionEstudio} onChange={(e) => handleInputChange("educacionEstudio", e.target.value)} className="border-blue-200" />
                              </Field>
                              <Field>
                                <FieldLabel>Semestre</FieldLabel>
                                <Select value={formData.educacionSemestre} onValueChange={(v) => handleInputChange("educacionSemestre", v)}>
                                  <SelectTrigger className="border-blue-200"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                  <SelectContent>
                                    {["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"].map(s => <SelectItem key={s} value={`Semestre ${s}`}>Semestre {s}</SelectItem>)}
                                    <SelectItem value="Egresado/Graduado">Egresado / Graduado</SelectItem>
                                  </SelectContent>
                                </Select>
                              </Field>
                              <Field>
                                <FieldLabel>Plantel Educativo</FieldLabel>
                                <Input placeholder="Colegio/Universidad" value={formData.educacionPlantel} onChange={(e) => handleInputChange("educacionPlantel", e.target.value)} className="border-blue-200" />
                              </Field>
                            </>
                          )}
                        </CardContent>
                      </Card>

                      {/* SECCIÓN 5: SALUD */}
                      <Card className="shadow-md border-0 overflow-hidden border-t-4 border-red-500">
                        <div className="bg-red-50/50 p-3 border-b border-red-100 flex items-center gap-3">
                          <HeartPulse className="h-5 w-5 text-red-600" />
                          <h2 className="text-lg font-bold text-red-800">Perfil de Salud</h2>
                        </div>
                        <CardContent className="pt-4 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Field>
                              <FieldLabel>¿EPS? <span className="text-red-500">*</span></FieldLabel>
                              <Input placeholder="Nombre EPS o 'Ninguna'" value={formData.eps} onChange={(e) => handleInputChange("eps", e.target.value)} className="border-red-200" />
                            </Field>
                            <Field>
                              <FieldLabel>¿ARL? <span className="text-red-500">*</span></FieldLabel>
                              <Input placeholder="Nombre ARL o 'Ninguna'" value={formData.arl} onChange={(e) => handleInputChange("arl", e.target.value)} className="border-red-200" />
                            </Field>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4 border-red-100">
                            <div className="space-y-3">
                              <Field>
                                <FieldLabel>¿Presenta alguna enfermedad? <span className="text-red-500">*</span></FieldLabel>
                                <Select value={formData.enfermedad} onValueChange={(v) => { handleInputChange("enfermedad", v); if (v === "No") handleInputChange("enfermedadCual", ""); }}>
                                  <SelectTrigger className="border-red-200"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                  <SelectContent><SelectItem value="Sí">Sí</SelectItem><SelectItem value="No">No</SelectItem></SelectContent>
                                </Select>
                              </Field>
                              {formData.enfermedad === "Sí" && (
                                <Field>
                                  <FieldLabel>¿Cuál? <span className="text-red-500">*</span></FieldLabel>
                                  <Input placeholder="Especifique" value={formData.enfermedadCual} onChange={(e) => handleInputChange("enfermedadCual", e.target.value)} className="border-red-200" />
                                </Field>
                              )}
                            </div>
                            <div className="space-y-3">
                              <Field>
                                <FieldLabel>¿Presenta algún tipo de alergia? <span className="text-red-500">*</span></FieldLabel>
                                <Select value={formData.alergia} onValueChange={(v) => { handleInputChange("alergia", v); if (v === "No") handleInputChange("alergiaCual", ""); }}>
                                  <SelectTrigger className="border-red-200"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                  <SelectContent><SelectItem value="Sí">Sí</SelectItem><SelectItem value="No">No</SelectItem></SelectContent>
                                </Select>
                              </Field>
                              {formData.alergia === "Sí" && (
                                <Field>
                                  <FieldLabel>¿Cuál? <span className="text-red-500">*</span></FieldLabel>
                                  <Input placeholder="Especifique" value={formData.alergiaCual} onChange={(e) => handleInputChange("alergiaCual", e.target.value)} className="border-red-200" />
                                </Field>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4 border-red-100">
                            <div className="space-y-3">
                              <Field>
                                <FieldLabel>¿Discapacidad? <span className="text-red-500">*</span></FieldLabel>
                                <Select value={formData.discapacidad} onValueChange={(v) => { handleInputChange("discapacidad", v); if (v === "No") handleInputChange("discapacidadTipo", ""); }}>
                                  <SelectTrigger className="border-red-200"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                  <SelectContent><SelectItem value="Sí">Sí</SelectItem><SelectItem value="No">No</SelectItem></SelectContent>
                                </Select>
                              </Field>
                              {formData.discapacidad === "Sí" && (
                                <Field>
                                  <FieldLabel>¿Tipo? <span className="text-red-500">*</span></FieldLabel>
                                  <div className="space-y-2">
                                    <Select value={formData.discapacidadTipo} onValueChange={(v) => handleInputChange("discapacidadTipo", v)}>
                                      <SelectTrigger className="border-red-200"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="Ninguna">Ninguna</SelectItem>
                                        {TIPOS_DISCAPACIDAD.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                      </SelectContent>
                                    </Select>
                                    {formData.discapacidadTipo === "Otro" && (
                                      <Input placeholder="¿Cuál discapacidad?" value={formData.discapacidadOtro} onChange={(e) => handleInputChange("discapacidadOtro", e.target.value)} className="border-red-200" />
                                    )}
                                  </div>
                                </Field>
                              )}
                            </div>
                            <div className="space-y-3">
                              <Field>
                                <FieldLabel>¿Trastorno? <span className="text-red-500">*</span></FieldLabel>
                                <Select value={formData.trastorno} onValueChange={(v) => { handleInputChange("trastorno", v); if (v === "No") { handleInputChange("trastornoTipo", ""); handleInputChange("trastornoOtro", ""); } }}>
                                  <SelectTrigger className="border-red-200"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                  <SelectContent><SelectItem value="Sí">Sí</SelectItem><SelectItem value="No">No</SelectItem></SelectContent>
                                </Select>
                              </Field>
                              {formData.trastorno === "Sí" && (
                                <Field>
                                  <FieldLabel>¿Tipo? <span className="text-red-500">*</span></FieldLabel>
                                  <div className="space-y-2">
                                    <Select value={formData.trastornoTipo} onValueChange={(v) => handleInputChange("trastornoTipo", v)}>
                                      <SelectTrigger className="border-red-200"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                      <SelectContent>
                                        {TIPOS_TRASTORNO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                      </SelectContent>
                                    </Select>
                                    {formData.trastornoTipo === "Otro" && (
                                      <Input placeholder="¿Cuál trastorno?" value={formData.trastornoOtro} onChange={(e) => handleInputChange("trastornoOtro", e.target.value)} className="border-red-200" />
                                    )}
                                  </div>
                                </Field>
                              )}
                            </div>
                          </div>
                          <div className="space-y-3 mt-4">
                            <Field>
                              <FieldLabel>¿Presenta alguna condición especial? <span className="text-red-500">*</span></FieldLabel>
                              <Select value={formData.condicionEspecial} onValueChange={(v) => { handleInputChange("condicionEspecial", v); if(v==="No") handleInputChange("condicionEspecialCual", ""); }}>
                                <SelectTrigger className="border-red-200"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                <SelectContent><SelectItem value="Sí">Sí</SelectItem><SelectItem value="No">No</SelectItem></SelectContent>
                              </Select>
                            </Field>
                            {formData.condicionEspecial === "Sí" && (
                              <Field>
                                <FieldLabel>¿Cuál es su condición especial? <span className="text-red-500">*</span></FieldLabel>
                                <Input placeholder="Descríbala brevemente..." value={formData.condicionEspecialCual} onChange={(e) => handleInputChange("condicionEspecialCual", e.target.value)} className="border-red-200" />
                              </Field>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      {/* SECCIÓN EXTRA: VOLUNTARIADO Y EMERGENCIA */}
                      <Card className="shadow-md border-0 overflow-hidden border-t-4" style={{ borderTopColor: COLORS.verde }}>
                        <div className="bg-green-50/50 p-3 border-b flex items-center gap-3">
                          <HeartHandshake className="h-5 w-5 text-green-600" />
                          <h2 className="text-lg font-bold text-green-800">Compromiso y Voluntariado</h2>
                        </div>
                        <CardContent className="pt-4 space-y-4">
                          <Field>
                            <FieldLabel>¿Desea ser voluntario en futuras campañas de la fundación? <span className="text-red-500">*</span></FieldLabel>
                            <Select value={formData.deseaSerVoluntario} onValueChange={(v) => {
                              handleInputChange("deseaSerVoluntario", v);
                              if (v === "No") {
                                handleInputChange("emergenciaNombre", "");
                                handleInputChange("emergenciaNumero", "");
                                handleInputChange("emergenciaWhatsapp", "");
                                handleInputChange("emergenciaDireccion", "");
                              }
                            }}>
                              <SelectTrigger className="border-green-200"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                              <SelectContent><SelectItem value="Sí">Sí</SelectItem><SelectItem value="No">No</SelectItem></SelectContent>
                            </Select>
                          </Field>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="flex-1 min-w-[200px]">
                                <FieldLabel>¿Cómo se enteró? <span className="text-red-500">*</span></FieldLabel>
                                <Select value={formData.comoEntero} onValueChange={(v) => handleInputChange("comoEntero", v)}>
                                  <SelectTrigger className="bg-white"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                                  <SelectContent>
                                    {ENTERADO_MEDIOS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              {formData.comoEntero === "Referido" && (
                                <div className="flex-1 min-w-[200px]">
                                  <FieldLabel>Código Institucional del Referidor <span className="text-red-500">*</span></FieldLabel>
                                  <div className="flex gap-2">
                                    <Input placeholder="Ej. Zram050302" value={formData.codigoReferidor} onChange={(e) => handleInputChange("codigoReferidor", e.target.value)} />
                                    <Button type="button" variant="outline" onClick={verificarReferidor} disabled={isVerifyingReferidor}>
                                      {isVerifyingReferidor ? "Buscando..." : "Verificar"}
                                    </Button>
                                  </div>
                                  {referidorNombre ? (
                                    <p className="text-sm text-green-600 font-semibold mt-1">✓ Referido por: {referidorNombre}</p>
                                  ) : (
                                    <p className="text-xs text-slate-500 mt-1">Escribe el código y presiona Verificar.</p>
                                  )}
                                </div>
                              )}
                            </div>

                          {formData.deseaSerVoluntario === "Sí" && (
                            <div className="border border-green-200 rounded-xl p-4 bg-white shadow-sm space-y-3">
                              <h3 className="font-bold text-slate-800 border-b pb-1 text-sm">Contacto de Emergencia</h3>
                              
                              <div className="flex flex-col md:flex-row gap-4 mb-4">
                                <div className="flex-1 min-w-[200px]">
                                  <FieldLabel>Nombre Completo <span className="text-red-500">*</span></FieldLabel>
                                  <Input placeholder="Nombre" value={formData.emergenciaNombre} onChange={(e) => handleInputChange("emergenciaNombre", e.target.value)} />
                                </div>
                                <div className="flex-1 min-w-[200px]">
                                  <FieldLabel>Número Teléfono <span className="text-red-500">*</span></FieldLabel>
                                  <Input placeholder="Celular" value={formData.emergenciaNumero} onChange={(e) => handleInputChange("emergenciaNumero", e.target.value)} />
                                </div>
                              </div>
                              <div className="flex flex-col md:flex-row gap-4">
                                <div className="flex-1 min-w-[200px]">
                                  <FieldLabel>Número de WhatsApp <span className="text-red-500">*</span></FieldLabel>
                                  <Input placeholder="WhatsApp" value={formData.emergenciaWhatsapp} onChange={(e) => handleInputChange("emergenciaWhatsapp", e.target.value)} />
                                </div>
                                <div className="flex-1 min-w-[200px]">
                                  <FieldLabel>Dirección de Emergencia <span className="text-red-500">*</span></FieldLabel>
                                  <Input placeholder="Dirección completa" value={formData.emergenciaDireccion} onChange={(e) => handleInputChange("emergenciaDireccion", e.target.value)} />
                                </div>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
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
                className="relative w-[380px] h-[580px] bg-white overflow-hidden mx-auto flex flex-col rounded-3xl"
                style={{
                  fontFamily: 'sans-serif',
                  border: 'none',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                }}
              >
                {/* Franja Superior */}
                <div className="w-full h-5 flex shrink-0">
                  <div style={{ flex: 1, backgroundColor: COLORS.rojo }} />
                  <div style={{ flex: 1, backgroundColor: COLORS.amarillo }} />
                  <div style={{ flex: 1, backgroundColor: COLORS.verde }} />
                  <div style={{ flex: 1, backgroundColor: COLORS.azul }} />
                </div>

                <div className="flex-1 flex flex-col items-center pt-2 px-6 pb-2 relative">
                  {/* Logo */}
                  <img src="/logo.png" alt="Logo" style={{ width: "115px", height: "115px", borderRadius: "50%", objectFit: "contain", backgroundColor: "white" }} />

                  {/* Títulos Principales */}
                  <h2 className="font-black text-3xl tracking-tight mt-1" style={{ color: COLORS.verde }}>ISLA CASCAJAL</h2>
                  <p className="text-sm font-bold tracking-widest uppercase mt-[-2px]" style={{ color: '#ea580c' }}>Fundación</p>

                  {/* Foto de Perfil */}
                  <div className="relative mt-2 flex flex-col items-center">
                    <div
                      className="w-28 h-28 overflow-hidden"
                      style={{ backgroundColor: "#f1f5f9" }}
                    >
                      {fotoPreview ? (
                        <img src={fotoPreview} alt="Foto" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <User color="#94a3b8" size={40} />
                        </div>
                      )}
                    </div>

                    {/* Badge AFILIADO */}
                    <div
                      className="absolute -bottom-3 px-4 py-1 rounded-md z-10"
                      style={{ backgroundColor: '#65a30d', border: '1px solid white' }}
                    >
                      <span className="text-white font-bold text-sm tracking-widest">AFILIADO</span>
                    </div>
                  </div>

                  {/* Nombre y NUIP */}
                  <div className="mt-5 w-full text-center">
                    <h3 className="text-xl font-black uppercase leading-tight" style={{ color: COLORS.verde }}>
                      {formData.nombre || "NOMBRE COMPLETO"}
                    </h3>
                    <p className="font-bold text-sm mt-0.5" style={{ color: '#ea580c' }}>
                      NUIP. {formData.cedula || "XXXXXXXXX"}
                    </p>
                  </div>

                  {/* Grilla de Datos y QR */}
                  <div className="mt-2 w-full flex justify-between items-end px-2">
                    <div className="flex flex-col gap-3">
                      <div className="flex gap-6">
                        <div>
                          <p className="text-[11px] font-black" style={{ color: COLORS.verde }}>CÓD. INSTITUCIONAL</p>
                          <p className="text-sm font-bold" style={{ color: '#ea580c' }}>{formData.codigo}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-black" style={{ color: COLORS.verde }}>RH</p>
                          <p className="text-sm font-bold" style={{ color: '#ea580c' }}>{formData.rh || "A+"}</p>
                        </div>
                      </div>

                      <div>
                        <p className="text-[11px] font-black uppercase" style={{ color: COLORS.verde }}>País</p>
                        <p className="text-sm font-bold uppercase" style={{ color: '#ea580c' }}>{formData.pais === "Otro" ? formData.otroPais : formData.pais}</p>
                      </div>

                      <div className="mt-1">
                        <p className="text-[10px] font-bold uppercase text-slate-500 mb-1">Membresías Activas</p>
                        <div className="flex gap-2">
                          {formData.seleccionMembresias?.educativa && (
                            <span className="px-2 py-1 border border-blue-300 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-md">EDUCATIVA</span>
                          )}
                          {formData.seleccionMembresias?.integral && (
                            <span className="px-2 py-1 border border-green-300 bg-green-100 text-green-700 text-[10px] font-bold rounded-md">INTEGRAL</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-center">
                      <div className="p-1 rounded-xl" style={{ border: '3px solid #854d0e', backgroundColor: 'white' }}>
                        {qrDataUrl ? (
                          <img src={qrDataUrl} alt="QR" style={{ width: "85px", height: "85px" }} />
                        ) : (
                          <div style={{ width: '85px', height: '85px', backgroundColor: '#f1f5f9' }} />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Footer Username */}
                  <div className="absolute bottom-2 right-4">
                    <p className="text-xs font-bold" style={{ color: COLORS.azul }}>@fundacionislacascajal</p>
                  </div>
                </div>

                {/* Franja Inferior */}
                <div className="w-full h-5 flex mt-auto shrink-0">
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
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Documento / NIUP</p>
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
              {formData.seleccionMembresias.educativa && (
                <Button
                  variant="outline"
                  size="lg"
                  className="h-14 border-2 font-bold gap-3 hover:bg-primary hover:text-primary-foreground transition-all"
                  onClick={() => descargarCertificado('educativa')}
                  disabled={!!isDownloadingCert}
                >
                  {isDownloadingCert === 'educativa' ? <Spinner /> : <FileTextIcon className="h-5 w-5" />}
                  CERTIFICADO EDUCATIVO
                </Button>
              )}
              {formData.seleccionMembresias.integral && (
                <Button
                  variant="outline"
                  size="lg"
                  className="h-14 border-2 font-bold gap-3 hover:bg-success hover:text-success-foreground transition-all"
                  onClick={() => descargarCertificado('integral')}
                  disabled={!!isDownloadingCert}
                >
                  {isDownloadingCert === 'integral' ? <Spinner /> : <FileTextIcon className="h-5 w-5" />}
                  CERTIFICADO INTEGRAL
                </Button>
              )}
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
          <div
            id="carnet-a-imprimir"
            ref={carnetRef}
            className="relative w-[380px] h-[580px] bg-white mx-auto flex flex-col rounded-[32px]"
            style={{ overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}
          >
            {/* Decoración Superior */}
            <div style={{ width: '100%', height: '20px', display: 'flex', flexShrink: 0 }}>
              <div style={{ flex: 1, backgroundColor: '#ce181b' }} />
              <div style={{ flex: 1, backgroundColor: '#f3de4d' }} />
              <div style={{ flex: 1, backgroundColor: '#0e6235' }} />
              <div style={{ flex: 1, backgroundColor: '#05318a' }} />
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '8px', paddingLeft: '24px', paddingRight: '24px', paddingBottom: '8px', position: 'relative' }}>
              <img src="/logo.png" alt="Logo" crossOrigin="anonymous" style={{ width: '115px', height: '115px', borderRadius: '50%', objectFit: 'contain', backgroundColor: 'white' }} />

              <h2 style={{ color: '#0e6235', fontWeight: 900, fontSize: '26px', margin: 0, marginTop: '4px', lineHeight: 1.2 }}>ISLA CASCAJAL</h2>
              <p style={{ color: '#ea580c', fontSize: '13px', fontWeight: 900, textTransform: 'uppercase', margin: 0, marginTop: '-2px', letterSpacing: '1px' }}>Fundación</p>

              <div style={{ marginTop: '12px', width: '100px', height: '110px', borderRadius: '12px', backgroundColor: '#f1f5f9', border: '2px solid #e2e8f0', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {formData.foto ? (
                  <img src={formData.foto} alt="Foto Perfil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                  </svg>
                )}
              </div>

              <div style={{ marginTop: '12px', width: '100%', textAlign: 'center' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 900, textTransform: 'uppercase', lineHeight: 1.2, color: '#0e6235', margin: 0 }}>
                  {formData?.nombre || "NOMBRE COMPLETO"}
                </h3>
                <p style={{ fontWeight: 900, fontSize: '14px', color: '#ea580c', margin: 0, marginTop: '2px' }}>
                  NUIP. {formData?.cedula || "XXXXXXXX"}
                </p>
              </div>

              <div style={{ marginTop: '8px', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '0 8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', gap: '24px' }}>
                    <div>
                      <p style={{ fontSize: '11px', fontWeight: 900, color: '#0e6235', margin: 0 }}>CÓD. INSTITUCIONAL</p>
                      <p style={{ fontSize: '14px', fontWeight: 900, color: '#ea580c', margin: 0 }}>{formData?.codigo || "---"}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '11px', fontWeight: 900, color: '#0e6235', margin: 0 }}>RH</p>
                      <p style={{ fontSize: '14px', fontWeight: 900, color: '#ea580c', margin: 0 }}>{formData?.rh || "A+"}</p>
                    </div>
                  </div>
                  <div>
                    <p style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', color: '#0e6235', margin: 0 }}>PAÍS</p>
                    <p style={{ fontSize: '14px', fontWeight: 900, textTransform: 'uppercase', color: '#ea580c', margin: 0 }}>{formData?.pais || "COLOMBIA"}</p>
                  </div>
                  <div style={{ marginTop: '4px' }}>
                    <p style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', color: '#64748b', margin: 0, marginBottom: '4px' }}>MEMBRESÍAS ACTIVAS</p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {formData.seleccionMembresias?.educativa && (
                        <span style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', color: '#1d4ed8', backgroundColor: '#dbeafe', padding: '4px 12px', borderRadius: '12px', border: `1px solid #93c5fd` }}>
                          EDUCATIVA
                        </span>
                      )}
                      {formData.seleccionMembresias?.integral && (
                        <span style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', color: '#15803d', backgroundColor: '#dcfce3', padding: '4px 12px', borderRadius: '12px', border: `1px solid #86efac` }}>
                          INTEGRAL
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ padding: '4px', borderRadius: '12px', border: '3px solid #854d0e', backgroundColor: 'white' }}>
                    {qrDataUrl ? (
                      <img src={qrDataUrl} crossOrigin="anonymous" alt="QR" style={{ width: "85px", height: "85px" }} />
                    ) : (
                      <div style={{ width: '85px', height: '85px', backgroundColor: '#f1f5f9' }} />
                    )}
                  </div>
                </div>
              </div>

              <div style={{ position: 'absolute', bottom: '8px', right: '16px' }}>
                <p style={{ fontSize: '12px', fontWeight: 900, color: '#05318a', margin: 0 }}>@fundacionislacascajal</p>
              </div>
            </div>

            <div style={{ width: '100%', height: '20px', display: 'flex', marginTop: 'auto', flexShrink: 0 }}>
              <div style={{ flex: 1, backgroundColor: '#05318a' }} />
              <div style={{ flex: 1, backgroundColor: '#0e6235' }} />
              <div style={{ flex: 1, backgroundColor: '#f3de4d' }} />
              <div style={{ flex: 1, backgroundColor: '#ce181b' }} />
            </div>
          </div>
        </div>

        {/* TEMPLATE OCULTO PARA CERTIFICADOS (Sincronizado con Dashboard) */}
        <div style={{ position: "fixed", left: "-9999px", top: 0, zIndex: -1 }}>
          {currentCertData && (
            <>
              {/* Template de Aval Educativo */}
              <div
                id="hidden-cert-edu-confirm"
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

                <div style={{ textAlign: "center", marginBottom: "40px" }}>
                  <h2 style={{ fontSize: "22px", fontWeight: "bold", textDecoration: "underline", margin: 0 }}>CERTIFICADO DE AVAL EDUCATIVO</h2>
                </div>

                <div style={{ fontSize: "16px", textAlign: "justify" }}>
                  <p>
                    La presente organización de base <strong>Fundación Isla Cascajal “FICong”</strong>, identificada con NIT 900.248.351-0, con principal domicilio en el Distrito Especial de Santiago de Cali, República de Colombia, se permite presentar a:
                  </p>

                  <p style={{ fontSize: "20px", fontWeight: "900", textAlign: "center", margin: "25px 0", textTransform: "uppercase" }}>
                    {currentCertData.persona.nombre}
                  </p>

                  <p>
                    con NIUP <strong>{currentCertData.persona.cedula}</strong>, quien cuenta con registro oficial en nuestra base de datos institucional y con afiliación activa para acceder a nuestros convenios educativos.
                  </p>

                  <p>
                    Esta afiliación fue realizada en día <strong>{new Date(currentCertData.persona.fechaIngreso).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" })}</strong>, bajo el código institucional <strong>{currentCertData.persona.codigo}</strong> y tiene validez y cobertura para los convenios Nacionales e Internacionales y le permite acceder a los programas, actividades y procesos académicos establecidos por la Fundación Isla Cascajal.
                  </p>

                  <p>
                    Después de corroborar que se asumirán los compromisos académicos, sociales y morales por parte del afiliado, se procede a conceder el <strong>AVAL</strong> para que se le realicen los correspondientes descuentos para programas educativos para el período académico <strong>{(() => {
                      if (!currentCertData.membresia.fechaExpiracion) return "";
                      const date = new Date(currentCertData.membresia.fechaExpiracion);
                      const year = date.getFullYear();
                      const month = date.getMonth();
                      const letra = month <= 5 ? "A" : "B";
                      return `${year}${letra}`;
                    })()}</strong>.
                  </p>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "60px" }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: "bold", fontSize: "14px" }}>Fundación Isla Cascajal</p>
                    <p style={{ margin: 0, fontSize: "12px" }}>Fecha de expedición: {currentCertData.fechaImpresion || new Date().toLocaleDateString("es-CO")}</p>
                    <div style={{ marginTop: "30px", width: "180px", borderBottom: "1px solid #000" }}></div>
                    <p style={{ margin: 0, fontSize: "12px" }}>Firma electrónica</p>
                    <p style={{ margin: 0, fontSize: "12px" }}>Verificable con el código QR</p>
                  </div>
                </div>
              </div>

              {/* Template de Afiliación Integral */}
              <div
                id="hidden-cert-integral-confirm"
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

                <div style={{ textAlign: "center", marginBottom: "40px" }}>
                  <h2 style={{ fontSize: "22px", fontWeight: "bold", textDecoration: "underline", margin: 0 }}>CERTIFICADO DE AFILIACIÓN INTEGRAL</h2>
                </div>

                <div style={{ fontSize: "16px", textAlign: "justify" }}>
                  <p>
                    La presente organización de base <strong>Fundación Isla Cascajal “FICong”</strong>, identificada con NIT 900.248.351-0, con principal domicilio en el Distrito Especial de Santiago de Cali, República de Colombia, se permite presentar a:
                  </p>

                  <p style={{ fontSize: "20px", fontWeight: "900", textAlign: "center", margin: "25px 0", textTransform: "uppercase" }}>
                    {currentCertData.persona.nombre}
                  </p>

                  <p>
                    con NIUP <strong>{currentCertData.persona.cedula}</strong>, quien cuenta con registro oficial en nuestra base de datos institucional y con afiliación activa desde el día <strong>{new Date(currentCertData.persona.fechaIngreso).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" })}</strong>, bajo el código institucional <strong>{currentCertData.persona.codigo}</strong> y le permite acceder a los descuentos especiales que otorgan nuestros convenios interinstitucionales.
                  </p>

                  <p>
                    Esta afiliación tiene validez y cobertura para los convenios Nacionales e Internacionales y le permite acceder a los programas, actividades y procesos establecidos por la Fundación Isla Cascajal, así pues; después de corroborar que se asumirán los compromisos sociales y morales por parte del afiliado, se procede a reconocer su <strong>AFILIACIÓN ACTIVA</strong> para que se le realicen los correspondientes descuentos con fecha de vencimiento <strong>{new Date(currentCertData.membresia.fechaExpiracion).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" })}</strong>.
                  </p>
                </div>

                {currentCertData.persona.beneficiarios?.length > 0 && (
                  <div style={{ marginTop: "30px", padding: "15px", border: "1px solid #eee", borderRadius: "8px" }}>
                    <p style={{ fontSize: "12px", fontWeight: "bold", marginBottom: "8px", color: COLORS.azul }}>BENEFICIARIOS:</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      {currentCertData.persona.beneficiarios.map((b, i) => (
                        <p key={i} style={{ fontSize: "11px", margin: 0 }}>• {b.nombre} {b.nuip ? `(NIUP: ${b.nuip})` : ''}</p>
                      ))}
                    </div>
                  </div>
                )}

                {currentCertData.persona.mascotas?.length > 0 && (
                  <div style={{ marginTop: "15px", padding: "15px", border: "1px solid #eee", borderRadius: "8px" }}>
                    <p style={{ fontSize: "12px", fontWeight: "bold", marginBottom: "8px", color: COLORS.azul }}>MASCOTAS (PLAN INTEGRA):</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      {currentCertData.persona.mascotas.map((m, i) => (
                        <p key={i} style={{ fontSize: "11px", margin: 0 }}>
                          • {m.nombre} ({m.tipo}{m.raza ? ` - ${m.raza}` : ''})
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "60px" }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: "bold", fontSize: "14px" }}>Fundación Isla Cascajal</p>
                    <p style={{ margin: 0, fontSize: "12px" }}>Fecha de expedición: {currentCertData.fechaImpresion || new Date().toLocaleDateString("es-CO")}</p>
                    <div style={{ marginTop: "30px", width: "180px", borderBottom: "1px solid #000" }}></div>
                    <p style={{ margin: 0, fontSize: "12px" }}>Firma electrónica</p>
                    <p style={{ margin: 0, fontSize: "12px" }}>Verificable con el código QR</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

      </main>
    </div>
  );
}

