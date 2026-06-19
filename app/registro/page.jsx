"use client";

import { useState } from "react";
import { collection, doc, setDoc, query, where, getDocs, limit, updateDoc, increment, arrayUnion } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
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
  User, IdCard, Phone, Mail, MapPin, Globe, Map, CheckCircle2,
  UploadCloud, FileText, AlertCircle, Users, Plus, Trash2,
  HeartPulse, GraduationCap, ShieldAlert, HeartHandshake, Info, PawPrint,
  CreditCard, BadgeCheck, Upload
} from "lucide-react";
import Link from "next/link";

const PAISES = ["Colombia", "Venezuela", "Ecuador", "Perú", "Chile", "Argentina", "Brasil", "Panamá", "México", "Estados Unidos", "España", "Otro"];
const DEPARTAMENTOS_COLOMBIA = ["Amazonas", "Antioquia", "Arauca", "Atlántico", "Bolívar", "Boyacá", "Caldas", "Caquetá", "Casanare", "Cauca", "Cesar", "Chocó", "Córdoba", "Cundinamarca", "Guainía", "Guaviare", "Huila", "La Guajira", "Magdalena", "Meta", "Nariño", "Norte de Santander", "Putumayo", "Quindío", "Risaralda", "San Andrés y Providencia", "Santander", "Sucre", "Tolima", "Valle del Cauca", "Vaupés", "Vichada"];

const ETNIAS = ["Afrodiaspórico (Negro)", "Afrodiaspórico (Afro)", "Afrodiaspórico (Palenquero)", "Afrodiaspórico (Raizal)", "Originario (Indígena)", "Mestizo", "ROM", "Caucásico (Blanco)"];
const TIPOS_VICTIMA = ["Desplazamiento", "Homicidio", "Amenazas", "Desaparición forzosa", "Pérdida de bienes", "Atentados", "Secuestros", "Delitos contra la libertad sexual", "Daños por explosivos", "Abandono o expulsión de tierras", "Torturas", "Reclutamiento de NNA"];
const TIPOS_DISCRIMINACION = ["Raza", "Por país de origen", "Por lugar de nacimiento", "Lugar de origen/procedencia/destino", "Por género", "Por religión", "Por discapacidad", "Por identidad cultural", "Por identidad ideológica", "Por situación socioeconómica", "Por nivel académico", "Por edad", "Por situación de salud", "Por condición familiar", "Por aspecto físico"];
const NIVELES_EDUCATIVOS = ["Ninguno", "Primaria", "Bachiller", "Técnico", "Tecnólogo", "Pregrado (Universitario)", "Especialización o posgrado", "Maestría", "Doctorado", "Posdoctorado"];
const TIPOS_DISCAPACIDAD = ["Múltiple", "Auditiva", "Visual", "Física", "Intelectual", "Psicosocial", "Del habla", "Otro"];
const TIPOS_TRASTORNO = ["Dislexia", "Autismo", "De la percepción visual", "De la memoria", "Otro"];
const ENTERADO_MEDIOS = ["Voz a voz", "WhatsApp", "Telegram", "Instagram", "Facebook", "TikTok", "YouTube", "Radio", "TV", "Volantes", "Referido"];

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

export default function RegistroPublicoPage() {
  const [formData, setFormData] = useState({
    codigo: generarCodigoAfiliado(),
    nombre: "",
    cedula: "",
    fechaNacimiento: "",
    lugarNacimiento: "",
    edad: "",
    rh: "", fechaIngreso: new Date().toISOString().split("T")[0],
    telefono: "", correo: "", direccion: "", pais: "Colombia", otroPais: "", departamento: "", ciudad: "",
    beneficiarios: [], mascotas: [],
    seleccionMembresias: { educativa: true, integral: false },
    // Nuevos Campos Perfil
    sexo: "", orientacionSexual: "", orientacionOtro: "", estrato: "", etnia: "",
    sisben: "", sisbenPuntaje: "", asesoriaSisben: "", victimaConflicto: "", victimaTipo: "", victimaInscrito: "",
    discriminacion: "", discriminacionTipo: "",
    educacionNivel: "", educacionEstudio: "", educacionSemestre: "", educacionPlantel: "",
    eps: "", arl: "", enfermedad: "", enfermedadCual: "", alergia: "", alergiaCual: "",
    discapacidad: "", discapacidadTipo: "", discapacidadOtro: "", trastorno: "", trastornoTipo: "", trastornoOtro: "", condicionEspecial: "", condicionEspecialCual: "",
    comoEntero: "", referido: "", codigoReferidor: "", aceptaTerminos: false,
    deseaSerVoluntario: "",
    emergenciaNombre: "", emergenciaNumero: "", emergenciaWhatsapp: "", emergenciaDireccion: "",
    foto: "", // Base64 de la foto comprimida
  });

  const [soportes, setSoportes] = useState({ cedula: null, notas: null, vacunas: null });
  const handleSoporteChange = (tipo, e) => {
    setSoportes(prev => ({ ...prev, [tipo]: e.target.files?.[0] || null }));
  };

  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isVerifyingReferidor, setIsVerifyingReferidor] = useState(false);
  const [referidorNombre, setReferidorNombre] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);

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
          newData.edad = age >= 0 ? `${age} Años` : "";
        } else {
          newData.edad = "";
        }
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
      const res = await fetch("/api/public/verificar-referidor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigoReferidor: formData.codigoReferidor })
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        setReferidorNombre(data.nombre);
        toast.success("¡Código válido!");
      } else {
        toast.error(data.error || "Código no encontrado. Verifica si está bien escrito.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Error al verificar el código.");
    } finally {
      setIsVerifyingReferidor(false);
    }
  };

  const handleAddBeneficiario = () => {
    if (formData.beneficiarios.length >= 5) return toast.error("Máximo 5 beneficiarios");
    setFormData(prev => ({ ...prev, beneficiarios: [...prev.beneficiarios, { nombre: "", nuip: "" }] }));
  };

  const handleBeneficiarioChange = (index, field, value) => {
    const newBeneficiarios = [...formData.beneficiarios];
    let finalValue = value;
    if (field === "nuip") {
      finalValue = value.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }
    newBeneficiarios[index][field] = finalValue;
    setFormData(prev => ({ ...prev, beneficiarios: newBeneficiarios }));
  };

  const handleRemoveBeneficiario = (index) => {
    setFormData(prev => ({ ...prev, beneficiarios: prev.beneficiarios.filter((_, i) => i !== index) }));
  };

  const handleAddMascota = () => {
    if (formData.mascotas?.length >= 2) return toast.error("Máximo 2 mascotas");
    setFormData(prev => ({ ...prev, mascotas: [...(prev.mascotas || []), { nombre: "", tipo: "", raza: "" }] }));
  };

  const handleMascotaChange = (index, field, value) => {
    const newMascotas = [...(formData.mascotas || [])];
    newMascotas[index][field] = value;
    setFormData(prev => ({ ...prev, mascotas: newMascotas }));
  };

  const handleRemoveMascota = (index) => {
    setFormData(prev => ({ ...prev, mascotas: (prev.mascotas || []).filter((_, i) => i !== index) }));
  };

  const comprimirImagen = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target.result;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 250;
          let width = img.width;
          let height = img.height;

          if (width > MAX_WIDTH) {
            height = (MAX_WIDTH / width) * height;
            width = MAX_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.6));
        };
      };
    });
  };

  const handleFotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        return toast.error("Por favor sube una imagen válida.");
      }
      try {
        const base64 = await comprimirImagen(file);
        setFormData(prev => ({ ...prev, foto: base64 }));
        toast.success("Foto procesada y optimizada correctamente");
      } catch (error) {
        toast.error("Error al procesar la foto");
      }
    }
  };

  const handleGuardar = async () => {
    const camposBasicos = ["nombre", "cedula", "fechaNacimiento", "lugarNacimiento", "rh", "telefono", "correo", "direccion", "ciudad"];
    const camposEncuesta = ["sexo", "orientacionSexual", "estrato", "etnia", "sisben", "victimaConflicto", "discriminacion", "educacionNivel", "eps", "arl", "enfermedad", "alergia", "discapacidad", "trastorno", "condicionEspecial", "comoEntero"];
    
    // Validar Básicos
    for(const campo of camposBasicos) {
      if(!formData[campo]) return toast.error(`Falta completar un campo básico: ${campo}`);
    }

    // Validar Encuesta
    for(const campo of camposEncuesta) {
      if(!formData[campo]) return toast.error("Por favor completa todas las preguntas del formulario.");
    }

    // Validar Condicionales
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
    if (formData.comoEntero === "Referido" && !formData.codigoReferidor) return toast.error("Especifique el código de quien lo refiere");

    if (!formData.seleccionMembresias.educativa && !formData.seleccionMembresias.integral) {
      return toast.error("Selecciona al menos un tipo de membresía a la cual aplicar.");
    }

    if (!formData.aceptaTerminos) {
      return toast.error("Debes aceptar la política de tratamiento de datos.");
    }

    if (!soportes.cedula) return toast.error("Debe subir su documento de identidad.");
    if (formData.seleccionMembresias.educativa && !soportes.notas) return toast.error("Debe subir su certificado de notas para la membresía educativa.");
    if (formData.seleccionMembresias.integral && formData.mascotas?.length > 0) {
      const activePets = formData.mascotas.filter(m => m.nombre.trim() !== "");
      for (let i = 0; i < activePets.length; i++) {
        if (!soportes[`vacunas_${i}`]) {
          return toast.error(`Debe subir el carnet de vacunación de la mascota ${i + 1} (${activePets[i].nombre}).`);
        }
      }
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
          tipo: "educativa", estado: "pendiente",
          fechaInicio: fIngreso.toISOString(), fechaExpiracion: fExpEdu.toISOString(),
          codigo: `EDU-${Math.random().toString(36).substr(2, 6).toUpperCase()}`
        });
      }

      if (formData.seleccionMembresias.integral) {
        const fExpInt = new Date(fIngreso);
        fExpInt.setMonth(fExpInt.getMonth() + 12);
        nuevasMembresias.push({
          tipo: "integral", estado: "pendiente",
          fechaInicio: fIngreso.toISOString(), fechaExpiracion: fExpInt.toISOString(),
          codigo: `INT-${Math.random().toString(36).substr(2, 6).toUpperCase()}`
        });
      }

      // Validar Cédula única usando API route para evitar error de permisos en Firebase rules
      const resCedula = await fetch("/api/public/verificar-cedula", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cedula: formData.cedula })
      });
      const dataCedula = await resCedula.json();
      if (dataCedula.exists) {
        toast.error("Esta cédula ya se encuentra registrada en nuestro sistema.");
        setIsSaving(false);
        return;
      }

      let finalId = formData.codigo;
      
      toast.info("Guardando solicitud y subiendo documentos, por favor espere...");
      let linksSoportes = { cedula: null, notas: null, vacunas: null };
      for (const tipo of ['cedula', 'notas', 'vacunas']) {
        if (soportes[tipo]) {
          const extension = soportes[tipo].name.split('.').pop();
          const storageRef = ref(storage, `soportes/${finalId}/${tipo}.${extension}`);
          await uploadBytes(storageRef, soportes[tipo]);
          linksSoportes[tipo] = await getDownloadURL(storageRef);
        }
      }

      let dataToSave = {
        nombre: formData.nombre.trim(), cedula: formData.cedula.trim(), telefono: formData.telefono,
        correo: formData.correo, direccion: formData.direccion, rh: formData.rh,
        fechaNacimiento: formData.fechaNacimiento, lugarNacimiento: formData.lugarNacimiento, edad: formData.edad,
        pais: formData.pais === "Otro" ? formData.otroPais : formData.pais,
        departamento: formData.pais === "Colombia" ? formData.departamento : "",
        ciudad: formData.ciudad,
        oficina: "Registro Público Web", dependencia: "Pendiente",
        beneficiarios: formData.seleccionMembresias.integral ? formData.beneficiarios.filter(b => b.nombre.trim() !== "") : [],
        mascotas: formData.seleccionMembresias.integral ? (formData.mascotas || []).filter(m => m.nombre.trim() !== "") : [],
        estado: "pendiente", membresias: nuevasMembresias, codigoInstitucional: finalId,
        fechaCreacion: new Date().toISOString(), creadoPor: "PORTAL_PUBLICO", fechaUltimaActualizacion: new Date().toISOString(),
        
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
        foto: formData.foto || null,
        linksSoportes: linksSoportes,
      };

      await setDoc(doc(db, "afiliados", finalId), dataToSave);
      
      // Si es referido, actualizar al referidor por API route para evitar error de permisos
      if (formData.comoEntero === "Referido" && formData.codigoReferidor.trim() !== "") {
        try {
          await fetch("/api/public/actualizar-referidor", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              codigoReferidor: formData.codigoReferidor,
              afiliadoNuevo: {
                nombre: formData.nombre.trim(),
                cedula: formData.cedula.trim()
              }
            })
          });
        } catch (e) {
          console.error("Error actualizando referidor", e);
        }
      }

      toast.info("Generando pasarela de pago seguro...");

      // ==========================================
      // INTEGRACIÓN PAYU: Redirección al registrar
      // ==========================================
      const referenceCode = `${finalId}_${Date.now()}`;
      
      // Cálculo inteligente del precio final a pagar (Precios Afiliación Nueva)
      let amountStr = "0";
      if (formData.seleccionMembresias.educativa && formData.seleccionMembresias.integral) {
        amountStr = "159999";
      } else if (formData.seleccionMembresias.integral) {
        amountStr = "116999";
      } else if (formData.seleccionMembresias.educativa) {
        amountStr = "79999";
      }
      
      const amount = amountStr; 
      const currency = "COP";

      const resSignature = await fetch('/api/payu/signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referenceCode, amount, currency })
      });
      const { signature, merchantId, accountId } = await resSignature.json();

      const form = document.createElement("form");
      form.method = "post";
      form.action = "https://sandbox.checkout.payulatam.com/ppp-web-gateway-payu/";

      const inputs = {
        merchantId: merchantId,
        accountId: accountId,
        description: "Pago de Afiliación - Fundación Isla Cascajal",
        referenceCode: referenceCode,
        amount: amount,
        tax: "0",
        taxReturnBase: "0",
        currency: currency,
        signature: signature,
        test: "1", // Sandbox
        buyerEmail: formData.correo,
        responseUrl: `${window.location.origin}/`, // Retorno a la página principal tras pagar
        confirmationUrl: `${window.location.origin}/api/payu/webhook`, // Webhook notificador
        extra1: finalId // Pasamos el ID para que el Webhook sepa a quién activar
      };

      for (const key in inputs) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = inputs[key];
        form.appendChild(input);
      }

      document.body.appendChild(form);
      form.submit();

      // No ponemos setIsSaving(false) ni isSuccess para que la pantalla se quede cargando
      // mientras lo lanza a PayU.
    } catch (err) {
      console.error(err);
      toast.error("Ocurrió un error al procesar tu afiliación. Intenta más tarde.");
      setIsSaving(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-2xl border-0 overflow-hidden">
          <div className="h-2 w-full flex">
            <div style={{ flex: 1, backgroundColor: COLORS.azul }} />
            <div style={{ flex: 1, backgroundColor: COLORS.verde }} />
            <div style={{ flex: 1, backgroundColor: COLORS.amarillo }} />
            <div style={{ flex: 1, backgroundColor: COLORS.rojo }} />
          </div>
          <CardContent className="pt-10 pb-8 px-8 text-center flex flex-col items-center">
            <div className="bg-green-100 p-4 rounded-full mb-6">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">¡Solicitud Recibida!</h2>
            <p className="text-slate-600 mb-6">Hemos registrado tus datos correctamente con el código <strong>{formData.codigo}</strong>.</p>
            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-4 text-sm text-left flex gap-3 items-start mb-6">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <p>Tu afiliación se encuentra en estado <strong>Pendiente</strong>. Una vez confirmemos el pago, se activará tu membresía y tu carnet digital.</p>
            </div>
            <Button className="w-full" style={{ backgroundColor: COLORS.verde }} onClick={() => window.location.reload()}>
              Registrar otra persona
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-start justify-center p-4 py-8 md:py-12">
      <div className="max-w-5xl w-full">
        {/* Encabezado */}
        <div className="text-center mb-8">
          <div className="mx-auto bg-white p-2 rounded-full shadow-md w-28 h-28 mb-4 border-4 border-white" style={{ borderColor: COLORS.azul }}>
            <img src="/logo.png" alt="Logo Isla Cascajal" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight" style={{ color: COLORS.azul }}>
            Solicitud de Afiliación
          </h1>
          <p className="text-slate-600 mt-3 max-w-2xl mx-auto text-sm md:text-base">
            Complete el siguiente formulario con su información verídica para iniciar su proceso de vinculación a la Fundación Isla Cascajal.
          </p>
        </div>

        <div className="space-y-6">
          
          {/* SECCIÓN 1: DATOS BÁSICOS */}
          <Card className="shadow-lg border-0 overflow-hidden border-t-4" style={{ borderTopColor: COLORS.azul }}>
            <div className="bg-blue-50/50 p-4 border-b border-blue-100 flex items-center gap-3">
              <User className="h-6 w-6" style={{ color: COLORS.azul }} />
              <h2 className="text-xl font-bold" style={{ color: COLORS.azul }}>1. Datos Personales de Contacto</h2>
            </div>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <Field>
                <FieldLabel>Nombres y Apellidos Completos <span className="text-red-500">*</span></FieldLabel>
                <Input value={formData.nombre} onChange={(e) => handleInputChange("nombre", e.target.value.toUpperCase())} className="uppercase border-blue-200 focus-visible:ring-blue-500" disabled={isSaving} />
              </Field>
              <Field>
                <FieldLabel>No. Identificación (NUIP) <span className="text-red-500">*</span></FieldLabel>
                <Input value={formData.cedula} onChange={(e) => handleInputChange("cedula", e.target.value)} className="border-blue-200 focus-visible:ring-blue-500" disabled={isSaving} />
              </Field>
              <Field>
                <FieldLabel>Fecha de Nacimiento <span className="text-red-500">*</span></FieldLabel>
                <Input type="date" value={formData.fechaNacimiento} onChange={(e) => handleInputChange("fechaNacimiento", e.target.value)} className="border-blue-200 focus-visible:ring-blue-500" disabled={isSaving} />
              </Field>
              <Field>
                <FieldLabel>Lugar de Nacimiento <span className="text-red-500">*</span></FieldLabel>
                <Input placeholder="Ej. Cali, Valle del Cauca" value={formData.lugarNacimiento} onChange={(e) => handleInputChange("lugarNacimiento", e.target.value)} className="border-blue-200 focus-visible:ring-blue-500" disabled={isSaving} />
              </Field>
              <Field>
                <FieldLabel>Edad Calculada</FieldLabel>
                <Input value={formData.edad} className="bg-slate-100 border-blue-200 text-slate-500 font-bold" readOnly placeholder="Se calcula al ingresar fecha" disabled={isSaving} />
              </Field>
              <Field>
                <FieldLabel>Grupo Sanguíneo (RH) <span className="text-red-500">*</span></FieldLabel>
                <Select value={formData.rh} onValueChange={(v) => handleInputChange("rh", v)}>
                  <SelectTrigger className="border-blue-200"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                  <SelectContent>{["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Teléfono / WhatsApp <span className="text-red-500">*</span></FieldLabel>
                <Input value={formData.telefono} onChange={(e) => handleInputChange("telefono", e.target.value)} className="border-blue-200 focus-visible:ring-blue-500" disabled={isSaving} />
              </Field>
              <Field>
                <FieldLabel>Correo Electrónico <span className="text-red-500">*</span></FieldLabel>
                <Input type="email" value={formData.correo} onChange={(e) => handleInputChange("correo", e.target.value)} className="lowercase border-blue-200 focus-visible:ring-blue-500" disabled={isSaving} />
              </Field>
              <Field>
                <FieldLabel>Dirección de Residencia <span className="text-red-500">*</span></FieldLabel>
                <Input value={formData.direccion} onChange={(e) => handleInputChange("direccion", e.target.value)} className="border-blue-200 focus-visible:ring-blue-500" disabled={isSaving} />
              </Field>
              <Field>
                <FieldLabel>País <span className="text-red-500">*</span></FieldLabel>
                <div className="space-y-2">
                  <Select value={formData.pais} onValueChange={(v) => handleInputChange("pais", v)}>
                    <SelectTrigger className="border-blue-200"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                    <SelectContent>{PAISES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                  {formData.pais === "Otro" && <Input placeholder="Escriba su país" value={formData.otroPais} onChange={(e) => handleInputChange("otroPais", e.target.value)} />}
                </div>
              </Field>
              {formData.pais === "Colombia" && (
                <Field>
                  <FieldLabel>Departamento <span className="text-red-500">*</span></FieldLabel>
                  <Select value={formData.departamento} onValueChange={(v) => handleInputChange("departamento", v)}>
                    <SelectTrigger className="border-blue-200"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                    <SelectContent>{DEPARTAMENTOS_COLOMBIA.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              )}
              <Field>
                <FieldLabel>Ciudad / Municipio <span className="text-red-500">*</span></FieldLabel>
                <Input value={formData.ciudad} onChange={(e) => handleInputChange("ciudad", e.target.value)} className="border-blue-200 focus-visible:ring-blue-500" disabled={isSaving} />
              </Field>
            </CardContent>
          </Card>

          {/* SECCIÓN 2: PERFIL DEMOGRÁFICO Y DIVERSIDAD */}
          <Card className="shadow-lg border-0 overflow-hidden border-t-4" style={{ borderTopColor: COLORS.verde }}>
            <div className="bg-green-50/50 p-4 border-b border-green-100 flex items-center gap-3">
              <Users className="h-6 w-6" style={{ color: COLORS.verde }} />
              <h2 className="text-xl font-bold" style={{ color: COLORS.verde }}>2. Perfil Demográfico e Identidad</h2>
            </div>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
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
          <Card className="shadow-lg border-0 overflow-hidden border-t-4" style={{ borderTopColor: COLORS.amarillo }}>
            <div className="bg-yellow-50/50 p-4 border-b border-yellow-100 flex items-center gap-3">
              <ShieldAlert className="h-6 w-6" style={{ color: "#ca8a04" }} />
              <h2 className="text-xl font-bold" style={{ color: "#ca8a04" }}>3. Contexto Social y Vulnerabilidad</h2>
            </div>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-4">
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
                    <Input placeholder="Ej. A1, B2, 45.3" value={formData.sisbenPuntaje} onChange={(e) => handleInputChange("sisbenPuntaje", e.target.value)} className="border-yellow-200" />
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
              
              <Field className="md:col-span-2 border-t pt-4 border-yellow-100">
                <FieldLabel>¿Es víctima del conflicto armado? <span className="text-red-500">*</span></FieldLabel>
                <Select value={formData.victimaConflicto} onValueChange={(v) => { handleInputChange("victimaConflicto", v); if(v==="No") { handleInputChange("victimaTipo",""); handleInputChange("victimaInscrito",""); } }}>
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

              <Field className="md:col-span-2 border-t pt-4 border-yellow-100">
                <FieldLabel>¿Es víctima de discriminación? <span className="text-red-500">*</span></FieldLabel>
                <Select value={formData.discriminacion} onValueChange={(v) => { handleInputChange("discriminacion", v); if(v==="No") handleInputChange("discriminacionTipo", ""); }}>
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
          <Card className="shadow-lg border-0 overflow-hidden border-t-4 border-blue-500">
            <div className="bg-blue-50/50 p-4 border-b border-blue-100 flex items-center gap-3">
              <GraduationCap className="h-6 w-6 text-blue-600" />
              <h2 className="text-xl font-bold text-blue-800">4. Formación Académica</h2>
            </div>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field>
                <FieldLabel>Nivel Educativo Actual o Alcanzado <span className="text-red-500">*</span></FieldLabel>
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
                    <FieldLabel>¿Qué estudia o qué estudió?</FieldLabel>
                    <Input placeholder="Ej. Ingeniería de Sistemas" value={formData.educacionEstudio} onChange={(e) => handleInputChange("educacionEstudio", e.target.value)} className="border-blue-200" />
                  </Field>
                  <Field>
                    <FieldLabel>Año, Nivel o Semestre</FieldLabel>
                    <Select value={formData.educacionSemestre} onValueChange={(v) => handleInputChange("educacionSemestre", v)}>
                      <SelectTrigger className="border-blue-200"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                      <SelectContent>
                        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"].map(s => <SelectItem key={s} value={`Semestre ${s}`}>Semestre {s}</SelectItem>)}
                        <SelectItem value="Egresado/Graduado">Egresado / Graduado</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel>Nombre del Plantel Educativo</FieldLabel>
                    <Input placeholder="Colegio o Universidad" value={formData.educacionPlantel} onChange={(e) => handleInputChange("educacionPlantel", e.target.value)} className="border-blue-200" />
                  </Field>
                </>
              )}
            </CardContent>
          </Card>

          {/* SECCIÓN 5: SALUD Y BIENESTAR */}
          <Card className="shadow-lg border-0 overflow-hidden border-t-4 border-red-500">
            <div className="bg-red-50/50 p-4 border-b border-red-100 flex items-center gap-3">
              <HeartPulse className="h-6 w-6 text-red-600" />
              <h2 className="text-xl font-bold text-red-800">5. Perfil de Salud</h2>
            </div>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Field>
                  <FieldLabel>¿En qué EPS tiene afiliación? <span className="text-red-500">*</span></FieldLabel>
                  <Input placeholder="Nombre de EPS o 'Ninguna'" value={formData.eps} onChange={(e) => handleInputChange("eps", e.target.value)} className="border-red-200" />
                </Field>
                <Field>
                  <FieldLabel>¿En qué ARL tiene afiliación? <span className="text-red-500">*</span></FieldLabel>
                  <Input placeholder="Nombre de ARL o 'Ninguna'" value={formData.arl} onChange={(e) => handleInputChange("arl", e.target.value)} className="border-red-200" />
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t pt-5 border-red-100">
                <div className="space-y-4">
                  <Field>
                    <FieldLabel>¿Presenta alguna enfermedad? <span className="text-red-500">*</span></FieldLabel>
                    <Select value={formData.enfermedad} onValueChange={(v) => { handleInputChange("enfermedad", v); if(v==="No") handleInputChange("enfermedadCual", ""); }}>
                      <SelectTrigger className="border-red-200"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                      <SelectContent><SelectItem value="Sí">Sí</SelectItem><SelectItem value="No">No</SelectItem></SelectContent>
                    </Select>
                  </Field>
                  {formData.enfermedad === "Sí" && (
                    <Field>
                      <FieldLabel>¿Qué tipo de enfermedad presenta? <span className="text-red-500">*</span></FieldLabel>
                      <Input placeholder="Especifique" value={formData.enfermedadCual} onChange={(e) => handleInputChange("enfermedadCual", e.target.value)} className="border-red-200" />
                    </Field>
                  )}
                </div>

                <div className="space-y-4">
                  <Field>
                    <FieldLabel>¿Presenta algún tipo de alergia? <span className="text-red-500">*</span></FieldLabel>
                    <Select value={formData.alergia} onValueChange={(v) => { handleInputChange("alergia", v); if(v==="No") handleInputChange("alergiaCual", ""); }}>
                      <SelectTrigger className="border-red-200"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                      <SelectContent><SelectItem value="Sí">Sí</SelectItem><SelectItem value="No">No</SelectItem></SelectContent>
                    </Select>
                  </Field>
                  {formData.alergia === "Sí" && (
                    <Field>
                      <FieldLabel>¿Qué tipo de alergia presenta? <span className="text-red-500">*</span></FieldLabel>
                      <Input placeholder="Especifique" value={formData.alergiaCual} onChange={(e) => handleInputChange("alergiaCual", e.target.value)} className="border-red-200" />
                    </Field>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t pt-5 border-red-100">
                <div className="space-y-4">
                  <Field>
                    <FieldLabel>¿Presenta algún tipo de discapacidad? <span className="text-red-500">*</span></FieldLabel>
                    <Select value={formData.discapacidad} onValueChange={(v) => { handleInputChange("discapacidad", v); if(v==="No") handleInputChange("discapacidadTipo", ""); }}>
                      <SelectTrigger className="border-red-200"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                      <SelectContent><SelectItem value="Sí">Sí</SelectItem><SelectItem value="No">No</SelectItem></SelectContent>
                    </Select>
                  </Field>
                  {formData.discapacidad === "Sí" && (
                    <Field>
                      <FieldLabel>¿Qué tipo de discapacidad? <span className="text-red-500">*</span></FieldLabel>
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

                <div className="space-y-4">
                  <Field>
                    <FieldLabel>¿Presenta algún tipo de trastorno? <span className="text-red-500">*</span></FieldLabel>
                    <Select value={formData.trastorno} onValueChange={(v) => { handleInputChange("trastorno", v); if(v==="No") { handleInputChange("trastornoTipo", ""); handleInputChange("trastornoOtro", ""); } }}>
                      <SelectTrigger className="border-red-200"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                      <SelectContent><SelectItem value="Sí">Sí</SelectItem><SelectItem value="No">No</SelectItem></SelectContent>
                    </Select>
                  </Field>
                  {formData.trastorno === "Sí" && (
                    <Field>
                      <FieldLabel>¿Qué tipo de trastorno? <span className="text-red-500">*</span></FieldLabel>
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

              <div className="space-y-4 mt-2">
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
          <Card className="shadow-lg border-0 overflow-hidden border-t-4" style={{ borderTopColor: COLORS.verde }}>
            <div className="bg-green-50/50 p-4 border-b flex items-center gap-3">
              <HeartHandshake className="h-6 w-6 text-green-600" />
              <h2 className="text-xl font-bold text-green-800">Compromiso y Voluntariado</h2>
            </div>
            <CardContent className="pt-6 space-y-6">
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

              {formData.deseaSerVoluntario === "Sí" && (
                <div className="border border-green-200 rounded-xl p-5 bg-white shadow-sm space-y-4">
                  <h3 className="font-bold text-slate-800 border-b pb-2">Contacto de Emergencia</h3>
                  <div className="flex flex-col md:flex-row gap-4 mb-4">
                    <div className="flex-1 min-w-[200px]">
                      <FieldLabel>Nombre Completo <span className="text-red-500">*</span></FieldLabel>
                      <Input placeholder="Nombre del contacto" value={formData.emergenciaNombre} onChange={(e) => handleInputChange("emergenciaNombre", e.target.value)} />
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

          {/* SECCIÓN 6: MEMBRESÍA Y FAMILIARES */}
          <Card className="shadow-lg border-0 overflow-hidden border-t-4" style={{ borderTopColor: COLORS.azul }}>
            <div className="bg-slate-50/50 p-4 border-b flex items-center gap-3">
              <HeartHandshake className="h-6 w-6 text-slate-600" />
              <h2 className="text-xl font-bold text-slate-800">6. Tipo de Membresía e Inclusiones</h2>
            </div>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div
                  className={`border-2 rounded-xl p-5 cursor-pointer transition-all ${
                    formData.seleccionMembresias.educativa
                      ? "border-blue-500 bg-blue-50 shadow-md"
                      : "border-slate-200 hover:border-blue-200"
                  }`}
                  onClick={() => {
                    if (isSaving) return;
                    setFormData(prev => ({ ...prev, seleccionMembresias: { ...prev.seleccionMembresias, educativa: !prev.seleccionMembresias.educativa } }));
                  }}
                >
                  <div className="flex items-center space-x-3 mb-2">
                    <Checkbox checked={formData.seleccionMembresias.educativa} id="mem-edu" className="pointer-events-none" />
                    <label className="font-bold text-blue-900 pointer-events-none text-lg">Convenio Educativo</label>
                  </div>
                  <p className="text-sm text-blue-700 ml-7">Acceso exclusivo a nuestros convenios universitarios y técnicos con beneficios especiales.</p>
                </div>

                <div
                  className={`border-2 rounded-xl p-5 cursor-pointer transition-all ${
                    formData.seleccionMembresias.integral
                      ? "border-green-500 bg-green-50 shadow-md"
                      : "border-slate-200 hover:border-green-200"
                  }`}
                  onClick={() => {
                    if (isSaving) return;
                    setFormData(prev => {
                      const isIntegral = !prev.seleccionMembresias.integral;
                      return {
                        ...prev, seleccionMembresias: { ...prev.seleccionMembresias, integral: isIntegral },
                        beneficiarios: isIntegral && prev.beneficiarios.length === 0 ? Array.from({ length: 5 }, () => ({ nombre: "", nuip: "" })) : prev.beneficiarios,
                        mascotas: isIntegral && (!prev.mascotas || prev.mascotas.length === 0) ? Array.from({ length: 2 }, () => ({ nombre: "", tipo: "", raza: "" })) : prev.mascotas,
                      };
                    });
                  }}
                >
                  <div className="flex items-center space-x-3 mb-2">
                    <Checkbox checked={formData.seleccionMembresias.integral} id="mem-int" className="pointer-events-none" />
                    <label className="font-bold text-green-900 pointer-events-none text-lg">Afiliación Integral</label>
                  </div>
                  <p className="text-sm text-green-700 ml-7">Incluye beneficiarios familiares y mascotas en los programas sociales.</p>
                </div>
              </div>

              {formData.seleccionMembresias.integral && (
                <div className="space-y-6">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2"><Users className="h-5 w-5" style={{ color: COLORS.verde }} /> Beneficiarios Familiares (Máx 5)</h3>
                      <Button type="button" variant="outline" size="sm" onClick={handleAddBeneficiario} disabled={isSaving}><Plus className="h-4 w-4 mr-2" /> Agregar</Button>
                    </div>
                    <div className="space-y-3">
                      {formData.beneficiarios?.map((ben, idx) => (
                        <div key={idx} className="bg-white p-3 rounded-lg border relative flex flex-col md:flex-row gap-3 md:items-end">
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 absolute top-2 right-2 md:relative md:top-auto md:right-auto text-red-500" onClick={() => handleRemoveBeneficiario(idx)} disabled={isSaving}><Trash2 className="h-4 w-4" /></Button>
                          <div className="flex-1 space-y-1"><label className="text-xs font-bold uppercase text-slate-500">Nombre</label><Input value={ben.nombre} onChange={(e) => handleBeneficiarioChange(idx, "nombre", e.target.value.toUpperCase())} className="uppercase" placeholder="Nombre completo" /></div>
                          <div className="flex-1 space-y-1"><label className="text-xs font-bold uppercase text-slate-500">Documento</label><Input value={ben.nuip} onChange={(e) => handleBeneficiarioChange(idx, "nuip", e.target.value)} placeholder="NUIP" /></div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2"><User className="h-5 w-5" style={{ color: COLORS.amarillo }} /> Mascotas (Máx 2)</h3>
                      <Button type="button" variant="outline" size="sm" onClick={handleAddMascota} disabled={isSaving}><Plus className="h-4 w-4 mr-2" /> Agregar</Button>
                    </div>
                    <div className="space-y-3">
                      {formData.mascotas?.map((mascota, idx) => (
                        <div key={idx} className="bg-white p-3 rounded-lg border relative flex flex-col md:flex-row gap-3 md:items-end">
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 absolute top-2 right-2 md:relative md:top-auto md:right-auto text-red-500" onClick={() => handleRemoveMascota(idx)} disabled={isSaving}><Trash2 className="h-4 w-4" /></Button>
                          <div className="flex-1 space-y-1"><label className="text-xs font-bold uppercase text-slate-500">Nombre</label><Input value={mascota.nombre} onChange={(e) => handleMascotaChange(idx, "nombre", e.target.value)} placeholder="Nombre" /></div>
                          <div className="flex-1 space-y-1"><label className="text-xs font-bold uppercase text-slate-500">Especie</label><Input value={mascota.tipo} onChange={(e) => handleMascotaChange(idx, "tipo", e.target.value)} placeholder="Perro, Gato" /></div>
                          <div className="flex-1 space-y-1"><label className="text-xs font-bold uppercase text-slate-500">Raza</label><Input value={mascota.raza} onChange={(e) => handleMascotaChange(idx, "raza", e.target.value)} placeholder="Opcional" /></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* SECCIÓN 7: MARKETING Y CARGA DE SOPORTES */}
          <Card className="shadow-lg border-0 overflow-hidden border-t-4" style={{ borderTopColor: COLORS.azul }}>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-5">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="h-5 w-5 text-blue-600" />
                  <h3 className="font-bold text-slate-800">Ayúdanos a mejorar</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex-1 min-w-[200px]">
                  <FieldLabel>¿Cómo se enteró de nosotros? <span className="text-red-500">*</span></FieldLabel>
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
              </div>

              <div className="bg-slate-50 p-5 rounded-xl border border-slate-300">
                <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2"><UploadCloud className="h-5 w-5" /> Fotografía para Carnet</h3>
                <p className="text-xs text-slate-500 mb-4">Sube una foto tipo documento (fondo claro, rostro descubierto) para tu carnet institucional.</p>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-center w-full">
                    <label htmlFor="foto-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-white hover:bg-slate-50 transition-colors">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <UploadCloud className="w-8 h-8 mb-3 text-slate-400" />
                        <p className="mb-2 text-sm text-slate-500 font-semibold">Toca para tomar foto o subir archivo</p>
                        <p className="text-xs text-slate-400">JPG o PNG (Se optimizará automáticamente)</p>
                      </div>
                      <input id="foto-upload" type="file" accept="image/*" capture="user" className="hidden" onChange={handleFotoUpload} disabled={isSaving} />
                    </label>
                  </div>
                  
                  {formData.foto && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-4">
                      <img src={formData.foto} alt="Preview" className="w-16 h-16 rounded-md object-cover border shadow-sm" />
                      <div className="flex-1">
                        <p className="text-sm font-bold text-green-800 flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> Foto lista</p>
                        <p className="text-xs text-green-600">Optimizada para guardar sin saturar el sistema.</p>
                      </div>
                      <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50" onClick={() => setFormData(prev => ({ ...prev, foto: "" }))} disabled={isSaving}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 p-5 rounded-xl border border-slate-300 mt-8 md:mt-0 md:col-span-2">
                <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2"><FileText className="h-5 w-5" /> Soportes Documentales</h3>
                <p className="text-xs text-slate-500 mb-4">Por favor suba los documentos requeridos en formato PDF o Imagen.</p>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 mb-1 flex items-center gap-2"><IdCard className="h-4 w-4 text-slate-400"/> Documento de Identidad (Obligatorio)</label>
                    <Input type="file" accept=".pdf,image/*" onChange={(e) => handleSoporteChange('cedula', e)} className="bg-white cursor-pointer" />
                  </div>
                  {formData.seleccionMembresias.educativa && (
                    <div>
                      <label className="text-xs font-semibold text-slate-700 mb-1 flex items-center gap-2"><FileText className="h-4 w-4 text-slate-400"/> Certificado de Notas (Estudiantes)</label>
                      <Input type="file" accept=".pdf,image/*" onChange={(e) => handleSoporteChange('notas', e)} className="bg-white cursor-pointer" />
                    </div>
                  )}
                  {formData.seleccionMembresias.integral && formData.mascotas?.filter(m => m.nombre.trim() !== "").map((mascota, idx) => (
                    <div className="flex-1 min-w-[300px]" key={`mascota-soporte-${idx}`}>
                      <label className="text-xs font-semibold text-slate-700 mb-1 flex items-center gap-2"><PawPrint className="h-4 w-4 text-slate-400"/> Carnet Vacunación: {mascota.nombre}</label>
                      <div className="relative">
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => handleSoporteChange(`vacunas_${idx}`, e)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                          disabled={isSaving}
                        />
                        <Button type="button" variant="outline" className={`w-full justify-start font-normal ${soportes[`vacunas_${idx}`] ? 'border-green-500 text-green-700 bg-green-50' : 'border-slate-200'}`} disabled={isSaving}>
                          <Upload className="mr-2 h-4 w-4" />
                          {soportes[`vacunas_${idx}`] ? "Carnet adjuntado" : "Subir archivo (PDF/IMG)"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* FINALIZAR */}
          <div className="bg-white p-6 rounded-xl shadow-lg border">
            
            {/* RESUMEN DE PAGO (FACTURA) */}
            {(formData.seleccionMembresias.educativa || formData.seleccionMembresias.integral) && (
              <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-5 mb-6">
                <h3 className="font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-slate-500" /> Resumen de Afiliación (1 Año)
                </h3>
                
                <div className="space-y-3 text-sm text-slate-600">
                  {formData.seleccionMembresias.educativa && (
                    <div className="flex justify-between items-center">
                      <div className="flex flex-col">
                        <span>Membresía Educativa</span>
                        <span className="text-[10px] text-slate-400">Vence: {
                          (() => {
                            const date = new Date();
                            const mes = date.getMonth();
                            const year = date.getFullYear();
                            let exp;
                            if (mes >= 0 && mes <= 4) exp = new Date(year, 4, 30);
                            else if (mes >= 5 && mes <= 10) exp = new Date(year, 10, 30);
                            else exp = new Date(year + 1, 4, 30);
                            return exp.toLocaleDateString('es-CO');
                          })()
                        } (Corte Académico)</span>
                      </div>
                      <span className="font-semibold text-slate-800">$149.990</span>
                    </div>
                  )}
                  {formData.seleccionMembresias.integral && (
                    <div className="flex justify-between items-center">
                      <div className="flex flex-col">
                        <span>Membresía Integral</span>
                        <span className="text-[10px] text-slate-400">Vence: {new Date(Date.now() + 365*24*60*60*1000).toLocaleDateString('es-CO')} (1 Año Calendario)</span>
                      </div>
                      <span className="font-semibold text-slate-800">$149.990</span>
                    </div>
                  )}
                  
                  <div className="border-t pt-3 flex justify-between items-center">
                    <span className="font-bold">Subtotal Base</span>
                    <span className="font-bold text-slate-800">
                      ${(formData.seleccionMembresias.educativa && formData.seleccionMembresias.integral) ? "299.990" : "149.990"}
                    </span>
                  </div>

                  <div className="bg-green-100 text-green-800 p-3 rounded-lg flex justify-between items-center font-bold border border-green-200 shadow-sm my-3">
                    <div className="flex items-center gap-2">
                      <BadgeCheck className="h-5 w-5" />
                      <span>Beca FICong (Aporte 25%)</span>
                    </div>
                    <span>- ${(formData.seleccionMembresias.educativa && formData.seleccionMembresias.integral) ? "53.328" : "27.333"}</span>
                  </div>

                  <div className="border-t border-slate-300 pt-3 flex justify-between items-center text-xl">
                    <span className="font-black text-slate-800">Total a Pagar</span>
                    <span className="font-black text-blue-700">
                      ${(formData.seleccionMembresias.educativa && formData.seleccionMembresias.integral) ? "246.662" : "122.657"} COP
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-start gap-4 mb-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
              <Checkbox 
                id="terminos" 
                className="mt-1 h-5 w-5"
                checked={formData.aceptaTerminos}
                onCheckedChange={(v) => handleInputChange("aceptaTerminos", !!v)}
              />
              <label htmlFor="terminos" className="text-xs text-slate-600 cursor-pointer leading-relaxed">
                <strong>Autorización Tratamiento de Datos:</strong> De conformidad a la Ley 1581 de 2012 y la Ley 1266 de 2008 autorizo a la Fundación Isla Cascajal compartir mis datos con sus aliados estratégicos con el fin de recibir notificaciones a través de medios electrónicos sobre convenios, descuentos y promociones vigentes. De igual manera manifiesto que la presente autorización me fue solicitada y puesta de presente antes de entregar mis datos y que la suscribo de forma libre y voluntaria una vez leída en su totalidad.
              </label>
            </div>

            <Button 
              className="w-full h-16 text-xl font-black shadow-xl uppercase tracking-widest transition-transform active:scale-95" 
              style={{ backgroundColor: COLORS.azul }} 
              onClick={handleGuardar}
              disabled={isSaving}
            >
              {isSaving ? <><Spinner className="mr-3 h-6 w-6" /> Conectando con PayU...</> : "Enviar y Pagar Afiliación"}
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
}
