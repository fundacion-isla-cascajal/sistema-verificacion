"use client";

import { useState, useEffect, useRef } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { LogOut, Download, AlertCircle, FileText, BadgeCheck, User, Users, MapPin, Calendar, HeartPulse, ShieldAlert, CreditCard } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import QRCode from "qrcode";

const COLORS = {
  azul: "#3f7384",
  verde: "#606f3a",
  amarillo: "#f4b958",
  rojo: "#cd7243"
};

const CARNET_COLORS = {
  azul: "#05318a",
  verde: "#0e6235",
  amarillo: "#f3de4d",
  rojo: "#ce181b"
};

export default function AfiliadoDashboard() {
  const router = useRouter();
  const [afiliado, setAfiliado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const carnetRef = useRef(null);
  
  // Referencias para Avales
  const certEduRef = useRef(null);
  const certIntRef = useRef(null);
  
  // Estados de carga para botones
  const [isDownloadingCarnet, setIsDownloadingCarnet] = useState(false);
  const [isDownloadingEdu, setIsDownloadingEdu] = useState(false);
  const [isDownloadingInt, setIsDownloadingInt] = useState(false);

  // Estados Renovación
  const [modalRenovacion, setModalRenovacion] = useState(false);
  const [datosRenovacion, setDatosRenovacion] = useState({ telefono: "", correo: "", direccion: "" });
  const [isSavingDatos, setIsSavingDatos] = useState(false);

  useEffect(() => {
    const fetchAfiliado = async () => {
      const sesionId = sessionStorage.getItem("afiliado_sesion");
      if (!sesionId) {
        router.push("/afiliado");
        return;
      }

      try {
        const docRef = doc(db, "afiliados", sesionId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setAfiliado({ id: docSnap.id, ...data });
          setDatosRenovacion({
            telefono: data.telefono || "",
            correo: data.correo || "",
            direccion: data.direccion || ""
          });

          // Generar QR
          const link = `${window.location.origin}/verificar?doc=${data.codigoInstitucional}`;
          const url = await QRCode.toDataURL(link, {
            width: 400, margin: 1, color: { dark: COLORS.azul, light: "#ffffff" }
          });
          setQrDataUrl(url);

        } else {
          toast.error("Sesión inválida.");
          sessionStorage.removeItem("afiliado_sesion");
          router.push("/afiliado");
        }
      } catch (error) {
        console.error("Error al cargar datos:", error);
        toast.error("Error al cargar la información.");
      } finally {
        setLoading(false);
      }
    };

    fetchAfiliado();
  }, [router]);

  const handleLogout = () => {
    sessionStorage.removeItem("afiliado_sesion");
    router.push("/afiliado");
  };

  // --- LÓGICA DINÁMICA DE RENOVACIÓN Y PRECIOS ---
  let isVencido = false;
  let precioRenovacion = 0;
  let labelPrecio = "";
  let aporteText = "";
  let usaPlanReferidos = false;
  let cantidadMembresias = 1;
  
  if (afiliado && afiliado.membresias) {
    const hoy = new Date();
    cantidadMembresias = afiliado.membresias.length || 1;
    const referidos = afiliado.referidosExitosos || 0;
    const tieneEdu = afiliado.membresias.some(m => m.tipo === "educativa");
    
    afiliado.membresias.forEach(m => {
      if (m.fechaExpiracion) {
        const expiracion = new Date(m.fechaExpiracion);
        if (m.tipo === "educativa") {
          expiracion.setMonth(expiracion.getMonth() + 6);
        } else {
          expiracion.setFullYear(expiracion.getFullYear() + 1);
        }
        if (hoy > expiracion) isVencido = true;
      }
    });

    if (isVencido) {
      labelPrecio = cantidadMembresias === 2 ? "Afiliación Nueva (Ambas)" : (tieneEdu ? "Afiliación Nueva (Educativa)" : "Afiliación Nueva (Integral)");
      aporteText = "Aporte (Beca) del 55% al 35% aplicado.";
      precioRenovacion = cantidadMembresias === 2 ? 159999 : (tieneEdu ? 79999 : 116999);
    } else if (referidos >= 5) {
      usaPlanReferidos = true;
      labelPrecio = cantidadMembresias === 2 ? "Plan Referidos (Ambas)" : (tieneEdu ? "Plan Referidos (Educativa)" : "Plan Referidos (Integral)");
      aporteText = "Aporte Especial por Referidos aplicado (del 55% al 90%).";
      precioRenovacion = cantidadMembresias === 2 ? 79999 : (tieneEdu ? 19999 : 59999);
    } else {
      labelPrecio = cantidadMembresias === 2 ? "Renovación (Ambas)" : (tieneEdu ? "Renovación Normal (Educativa)" : "Renovación Normal (Integral)");
      aporteText = "Aporte (Beca) de Renovación aplicado (del 55% al 70%).";
      precioRenovacion = cantidadMembresias === 2 ? 119999 : (tieneEdu ? 45999 : 90999);
    }
  }

  const getPeriodoEducativo = (fechaISO) => {
    if (!fechaISO) return "Actual";
    const fecha = new Date(fechaISO);
    const year = fecha.getFullYear();
    const month = fecha.getMonth();
    return `${year}-${month < 6 ? '1' : '2'}`;
  };

  const descargarCarnet = async () => {
    if (!carnetRef.current) return;
    setIsDownloadingCarnet(true);
    toast.info("Generando imagen de alta calidad, por favor espera...", { duration: 3000 });
    
    try {
      const canvas = await html2canvas(carnetRef.current, {
        scale: 4,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null
      });
      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `Carnet_FICONG_${afiliado.cedula}.png`;
      a.click();
      toast.success("¡Carnet descargado correctamente!");
    } catch (err) {
      console.error(err);
      toast.error("Error al descargar el carnet.");
    } finally {
      setIsDownloadingCarnet(false);
    }
  };

  const descargarAval = async (tipo) => {
    const ref = tipo === 'edu' ? certEduRef : certIntRef;
    const setLoader = tipo === 'edu' ? setIsDownloadingEdu : setIsDownloadingInt;
    
    if (!ref.current) return;
    setLoader(true);
    toast.info(`Generando Aval ${tipo === 'edu' ? 'Educativo' : 'Integral'} en PDF...`, { duration: 3000 });

    try {
      const element = ref.current;
      element.style.display = "block";
      
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Aval_${tipo === 'edu' ? 'Educativo' : 'Integral'}_${afiliado.cedula}.pdf`);
      
      element.style.display = "none";
      toast.success("¡Aval descargado!");
    } catch (err) {
      console.error(err);
      toast.error("Error al generar el PDF.");
    } finally {
      setLoader(false);
    }
  };

  const descargarReciboPago = (pago) => {
    try {
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
      
      // Configurar logo y encabezado
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(22);
      pdf.setTextColor(5, 49, 138); // Azul institucional
      pdf.text("FUNDACIÓN ISLA CASCAJAL", 20, 35);
      
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text("NIT: 900.248.351-0", 20, 42);
      
      // Título del recibo
      pdf.setFontSize(16);
      pdf.setTextColor(0, 0, 0);
      pdf.text("COMPROBANTE DE PAGO ELECTRÓNICO", 105, 65, { align: "center" });
      
      // Detalles del cliente
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Fecha de Pago: ${new Date(pago.fecha).toLocaleDateString("es-CO")} ${new Date(pago.fecha).toLocaleTimeString("es-CO")}`, 20, 85);
      pdf.text(`Referencia Transacción: ${pago.referencia}`, 20, 92);
      
      pdf.text(`Afiliado: ${afiliado.nombre}`, 20, 105);
      pdf.text(`Documento (NUIP): ${afiliado.cedula}`, 20, 112);
      pdf.text(`Código Institucional: ${afiliado.codigoInstitucional}`, 20, 119);
      
      // Tabla de concepto
      pdf.setDrawColor(200, 200, 200);
      pdf.setFillColor(240, 240, 240);
      pdf.rect(20, 130, 175, 10, "F");
      pdf.setFont("helvetica", "bold");
      pdf.text("Concepto", 25, 137);
      pdf.text("Valor Pagado", 155, 137);
      
      pdf.setFont("helvetica", "normal");
      pdf.rect(20, 140, 175, 15);
      pdf.text(pago.concepto || "Afiliación / Renovación de Membresía", 25, 149);
      
      // Formatear monto
      const montoNum = parseInt(pago.monto) || 0;
      const montoFormateado = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(montoNum);
      pdf.text(montoFormateado, 155, 149);
      
      pdf.setFont("helvetica", "bold");
      pdf.text("Total:", 130, 165);
      pdf.text(montoFormateado, 155, 165);
      
      // Beca Message
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(0, 128, 0);
      pdf.text("¡Gracias por tu pago! Recuerda que este valor ya incluye", 105, 185, { align: "center" });
      pdf.text("la beca solidaria del 25% otorgada por la Fundación.", 105, 190, { align: "center" });

      // Pie de página
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(9);
      pdf.setTextColor(150, 150, 150);
      pdf.text("Este documento es un comprobante de pago electrónico generado automáticamente.", 105, 250, { align: "center" });
      pdf.text("Fundación Isla Cascajal - Santiago de Cali, Colombia", 105, 255, { align: "center" });
      
      pdf.save(`Recibo_FICONG_${pago.referencia}.pdf`);
      toast.success("Recibo descargado correctamente.");
    } catch (error) {
      console.error(error);
      toast.error("Hubo un error al generar el PDF del recibo.");
    }
  };

  const handleRenovacionPago = async () => {
    if(!datosRenovacion.telefono || !datosRenovacion.correo) {
      return toast.error("Por favor completa teléfono y correo.");
    }
    setIsSavingDatos(true);
    try {
      // 1. Guardar datos actualizados primero
      await setDoc(doc(db, "afiliados", afiliado.id), {
        telefono: datosRenovacion.telefono,
        correo: datosRenovacion.correo,
        direccion: datosRenovacion.direccion
      }, { merge: true });
      
      toast.info("Conectando con la pasarela segura de PayU...");

      // 2. Pedir firma criptográfica al servidor local
      const referenceCode = `${afiliado.codigoInstitucional}_${Date.now()}`;
      
      const amount = precioRenovacion.toString(); 
      
      const currency = "COP";

      const res = await fetch('/api/payu/signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referenceCode, amount, currency })
      });
      const { signature, merchantId, accountId } = await res.json();

      // 3. Construir formulario invisible y enviarlo al Sandbox de PayU
      const form = document.createElement("form");
      form.method = "post";
      form.action = "https://sandbox.checkout.payulatam.com/ppp-web-gateway-payu/";

      const inputs = {
        merchantId: merchantId,
        accountId: accountId,
        description: "Renovación de Membresía Fundación Isla Cascajal",
        referenceCode: referenceCode,
        amount: amount,
        tax: "0",
        taxReturnBase: "0",
        currency: currency,
        signature: signature,
        test: "1", // Modo Sandbox activado
        buyerEmail: datosRenovacion.correo,
        responseUrl: `${window.location.origin}/afiliado/dashboard`, // Retorno del cliente
        confirmationUrl: `${window.location.origin}/api/payu/webhook`, // URL del guardia nocturno (Webhook)
        extra1: afiliado.id, // Pasamos el ID del afiliado escondido para que el webhook sepa a quién activar
        extra2: usaPlanReferidos ? 'referido_aplicado' : 'no'
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
      
      // No hacemos setIsSavingDatos(false) para que el loader siga mientras redirige
    } catch (error) {
      console.error(error);
      toast.error("Error conectando con la pasarela de pagos.");
      setIsSavingDatos(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Spinner className="h-10 w-10 text-blue-600" />
      </div>
    );
  }

  if (!afiliado) return null;

  // Analizar Membresías
  const membresiaEducativa = afiliado.membresias?.find(m => m.tipo === "educativa");
  const membresiaIntegral = afiliado.membresias?.find(m => m.tipo === "integral");

  const formatearFecha = (fechaISO) => {
    if(!fechaISO) return "N/A";
    const date = new Date(fechaISO);
    return date.toLocaleDateString("es-CO", { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const determinarEstado = (membresia) => {
    if(!membresia) return null;
    const expiracion = new Date(membresia.fechaExpiracion);
    const ahora = new Date();
    const diasRestantes = Math.ceil((expiracion - ahora) / (1000 * 60 * 60 * 24));

    if (membresia.estado === "pendiente") return { texto: "Pendiente de Activación", color: "text-amber-600 bg-amber-50 border-amber-200" };
    if (membresia.estado === "vencida" || diasRestantes < 0) return { texto: "Vencida", color: "text-red-600 bg-red-50 border-red-200", vencida: true };
    if (diasRestantes <= 30) return { texto: `Por Vencer (${diasRestantes} días)`, color: "text-orange-600 bg-orange-50 border-orange-200", porVencer: true };
    return { texto: "Activa", color: "text-green-600 bg-green-50 border-green-200", activa: true };
  };

  const estadoEdu = determinarEstado(membresiaEducativa);
  const estadoInt = determinarEstado(membresiaIntegral);

  // Verificar si TODO está vencido o el usuario está inactivo
  const estaInactivoGlobal = afiliado.estado === "inactivo" || afiliado.estado === "rechazado";
  const todoVencido = (!estadoEdu || estadoEdu.vencida) && (!estadoInt || estadoInt.vencida);
  const bloqueadoPorVencimiento = estaInactivoGlobal || todoVencido;

  return (
    <div className="min-h-screen bg-slate-100 pb-12">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Logo" className="h-10 w-10 object-contain" />
            <h1 className="font-bold text-slate-800 hidden sm:block">Fundación Isla Cascajal</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold border border-amber-200" title="Personas que se han afiliado usando tu código">
              <User className="h-3 w-3" />
              {afiliado.referidosExitosos || 0} Referidos
            </div>
            <span className="text-sm font-semibold text-slate-600 uppercase">
              {afiliado.nombre.split(' ')[0]} {afiliado.nombre.split(' ')[1] || ''}
            </span>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-red-600 hover:text-red-700 hover:bg-red-50">
              <LogOut className="h-4 w-4 mr-2" /> Salir
            </Button>
          </div>
        </div>
        {/* Decoración franja */}
        <div className="h-1 w-full flex">
          <div style={{ flex: 1, backgroundColor: COLORS.azul }} />
          <div style={{ flex: 1, backgroundColor: COLORS.verde }} />
          <div style={{ flex: 1, backgroundColor: COLORS.amarillo }} />
          <div style={{ flex: 1, backgroundColor: COLORS.rojo }} />
        </div>
      </header>

      {/* BLOQUEO POR VENCIMIENTO: DISEÑO ELEGANTE */}
      {bloqueadoPorVencimiento && (
        <div className="max-w-6xl mx-auto px-4 mt-8">
          <div className="bg-white border-l-4 border-slate-800 rounded-xl p-8 flex flex-col md:flex-row items-center gap-8 shadow-sm">
            <div className="flex-shrink-0">
              <ShieldAlert className="h-12 w-12 text-slate-400" strokeWidth={1.5} />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">Atención Requerida: Membresía Vencida</h2>
              <p className="text-slate-500 mt-2 text-sm leading-relaxed max-w-2xl">
                Su acceso a la descarga de soportes documentales y beneficios institucionales se encuentra suspendido. 
                Para reactivar sus servicios y actualizar su estado en la base de datos, es necesario gestionar la renovación de su membresía.
              </p>
            </div>
            <div className="w-full md:w-auto">
              <Button 
                size="lg" 
                className="w-full md:w-auto px-8 h-12 shadow-sm rounded-lg font-semibold tracking-wide transition-all"
                style={{ backgroundColor: COLORS.azul, color: 'white' }}
                onClick={() => setModalRenovacion(true)}
              >
                Gestionar Renovación
              </Button>
            </div>
          </div>
        </div>
      )}

      <main className={`max-w-6xl mx-auto px-4 mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 ${bloqueadoPorVencimiento ? 'opacity-40 pointer-events-none' : ''}`}>
        
        {/* COLUMNA IZQUIERDA: CARNET */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <BadgeCheck className="h-6 w-6 text-blue-600" />
            Tu Carnet Digital
          </h2>
          
          <div style={{ transform: 'scale(0.9)', transformOrigin: 'top center' }}>
            <div
              id="carnet-virtual"
              ref={carnetRef}
              className="relative w-[380px] h-[580px] bg-white mx-auto flex flex-col rounded-[32px]"
              style={{ overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}
            >
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
                  {afiliado.foto ? (
                    <img src={afiliado.foto} alt="Foto Perfil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                    </svg>
                  )}
                </div>

                <div style={{ marginTop: '12px', width: '100%', textAlign: 'center' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 900, textTransform: 'uppercase', lineHeight: 1.2, color: '#0e6235', margin: 0 }}>
                    {afiliado.nombre || "NOMBRE COMPLETO"}
                  </h3>
                  <p style={{ fontWeight: 900, fontSize: '14px', color: '#ea580c', margin: 0, marginTop: '2px' }}>
                    NUIP. {afiliado.cedula || "XXXXXXXX"}
                  </p>
                </div>

                <div style={{ marginTop: '8px', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '0 8px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', gap: '24px' }}>
                      <div>
                        <p style={{ fontSize: '11px', fontWeight: 900, color: '#0e6235', margin: 0 }}>CÓD. INSTITUCIONAL</p>
                        <p style={{ fontSize: '14px', fontWeight: 900, color: '#ea580c', margin: 0 }}>{afiliado.codigoInstitucional || "---"}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: '11px', fontWeight: 900, color: '#0e6235', margin: 0 }}>RH</p>
                        <p style={{ fontSize: '14px', fontWeight: 900, color: '#ea580c', margin: 0 }}>{afiliado.rh || "A+"}</p>
                      </div>
                    </div>
                    <div>
                      <p style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', color: '#0e6235', margin: 0 }}>PAÍS</p>
                      <p style={{ fontSize: '14px', fontWeight: 900, textTransform: 'uppercase', color: '#ea580c', margin: 0 }}>{afiliado.pais || "COLOMBIA"}</p>
                    </div>
                    <div style={{ marginTop: '4px' }}>
                      <p style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', color: '#64748b', margin: 0, marginBottom: '4px' }}>MEMBRESÍAS</p>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {membresiaEducativa && !estadoEdu?.vencida && (
                          <span style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', color: '#1d4ed8', backgroundColor: '#dbeafe', padding: '4px 12px', borderRadius: '12px', border: `1px solid #93c5fd` }}>
                            EDUCATIVA
                          </span>
                        )}
                        {membresiaIntegral && !estadoInt?.vencida && (
                          <span style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', color: '#15803d', backgroundColor: '#dcfce3', padding: '4px 12px', borderRadius: '12px', border: `1px solid #86efac` }}>
                            INTEGRAL
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ padding: '4px', borderRadius: '12px', border: '3px solid #854d0e', backgroundColor: 'white' }}>
                      {qrDataUrl && (
                        <img src={qrDataUrl} crossOrigin="anonymous" alt="QR" style={{ width: "85px", height: "85px" }} />
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

          <Button 
            className="mt-2 w-full max-w-[380px] h-12 shadow-lg" 
            style={{ backgroundColor: COLORS.azul }}
            onClick={descargarCarnet}
            disabled={isDownloadingCarnet}
          >
            {isDownloadingCarnet ? <Spinner className="h-5 w-5 mr-2" /> : <Download className="h-5 w-5 mr-2" />}
            Descargar Imagen
          </Button>
        </div>

        {/* COLUMNA DERECHA: ESTADO Y CERTIFICADOS */}
        <div className="lg:col-span-7 space-y-6">
          
          <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <User className="h-6 w-6 text-blue-600" />
            Panel de Autogestión
          </h2>

          {/* Estado de Membresías */}
          <Card className="shadow-md border-t-4" style={{ borderTopColor: COLORS.verde }}>
            <CardContent className="p-6">
              <h3 className="font-bold text-lg text-slate-800 mb-4">Estado de Cuenta</h3>
              
              <div className="space-y-4">
                {membresiaEducativa && (
                  <div className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-xl gap-4 ${estadoEdu?.vencida ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                    <div>
                      <h4 className="font-bold text-blue-800 flex items-center gap-2">Membresía Educativa</h4>
                      <p className="text-sm text-slate-500 mt-1">Vence: {formatearFecha(membresiaEducativa.fechaExpiracion)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-3 py-1 text-xs font-bold uppercase rounded-full border ${estadoEdu?.color}`}>
                        {estadoEdu?.texto}
                      </span>
                      {(estadoEdu?.vencida || estadoEdu?.porVencer) && !bloqueadoPorVencimiento && (
                        <Button size="sm" variant="outline" className="border-blue-300 text-blue-700 w-full sm:w-auto pointer-events-auto" onClick={() => setModalRenovacion(true)}>Renovar Ahora</Button>
                      )}
                    </div>
                  </div>
                )}

                {membresiaIntegral && (
                  <div className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-xl gap-4 ${estadoInt?.vencida ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                    <div>
                      <h4 className="font-bold text-green-800 flex items-center gap-2">Membresía Integral</h4>
                      <p className="text-sm text-slate-500 mt-1">Vence: {formatearFecha(membresiaIntegral.fechaExpiracion)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-3 py-1 text-xs font-bold uppercase rounded-full border ${estadoInt?.color}`}>
                        {estadoInt?.texto}
                      </span>
                      {(estadoInt?.vencida || estadoInt?.porVencer) && !bloqueadoPorVencimiento && (
                        <Button size="sm" variant="outline" className="border-green-300 text-green-700 w-full sm:w-auto pointer-events-auto" onClick={() => setModalRenovacion(true)}>Renovar Ahora</Button>
                      )}
                    </div>
                  </div>
                )}
                
                {!membresiaEducativa && !membresiaIntegral && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-center">
                    <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                    <p className="text-red-700 font-bold">No tienes membresías activas registradas.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Certificados / Avales */}
          <Card className="shadow-md border-t-4" style={{ borderTopColor: COLORS.amarillo }}>
            <CardContent className="p-6">
              <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-amber-500" /> Soportes y Avales
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Aval Educativo */}
                {membresiaEducativa && (
                  <div className={`border rounded-xl p-5 flex flex-col justify-between ${estadoEdu?.vencida ? 'opacity-50 border-slate-200 bg-slate-50' : 'border-slate-200 hover:border-amber-300 transition-colors'}`}>
                    <div>
                      <h4 className="font-bold text-slate-700 mb-1">Aval Educativo</h4>
                      <p className="text-xs text-slate-500 leading-relaxed mb-4">
                        Documento oficial que te permite acceder a los convenios y descuentos académicos en instituciones aliadas.
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full border-amber-300 text-amber-700 hover:bg-amber-50"
                      onClick={() => descargarAval('edu')}
                      disabled={isDownloadingEdu || estadoEdu?.vencida}
                    >
                      {isDownloadingEdu ? <Spinner className="h-4 w-4 mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                      Descargar PDF
                    </Button>
                  </div>
                )}

                {/* Aval Integral */}
                {membresiaIntegral && (
                  <div className={`border rounded-xl p-5 flex flex-col justify-between ${estadoInt?.vencida ? 'opacity-50 border-slate-200 bg-slate-50' : 'border-slate-200 hover:border-green-300 transition-colors'}`}>
                    <div>
                      <h4 className="font-bold text-slate-700 mb-1">Aval Integral</h4>
                      <p className="text-xs text-slate-500 leading-relaxed mb-4">
                        Documento oficial que certifica tu vinculación a todos los beneficios sociales, incluyendo beneficiarios y mascotas.
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full border-green-300 text-green-700 hover:bg-green-50"
                      onClick={() => descargarAval('int')}
                      disabled={isDownloadingInt || estadoInt?.vencida}
                    >
                      {isDownloadingInt ? <Spinner className="h-4 w-4 mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                      Descargar PDF
                    </Button>
                  </div>
                )}
                
                {!membresiaEducativa && !membresiaIntegral && (
                  <p className="col-span-full text-center text-slate-500 py-4 text-sm">No hay avales disponibles para descargar.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Historial de Pagos */}
          <Card className="shadow-md border-t-4" style={{ borderTopColor: COLORS.azul }}>
            <CardContent className="p-6">
              <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-blue-600" /> Historial de Pagos y Facturas
              </h3>
              
              {(!afiliado.historialPagos || afiliado.historialPagos.length === 0) ? (
                <div className="p-6 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed">
                  Aún no tienes facturas o pagos registrados en tu historial.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
                      <tr>
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3">Referencia</th>
                        <th className="px-4 py-3 text-right">Valor</th>
                        <th className="px-4 py-3 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[...afiliado.historialPagos].sort((a,b) => new Date(b.fecha) - new Date(a.fecha)).map((pago, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 text-slate-700 font-medium">{new Date(pago.fecha).toLocaleDateString('es-CO')}</td>
                          <td className="px-4 py-3 text-xs text-slate-500 font-mono">{pago.referencia}</td>
                          <td className="px-4 py-3 text-right font-bold text-green-700">
                            {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(parseInt(pago.monto) || 0)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Button size="sm" variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => descargarReciboPago(pago)}>
                              <Download className="h-4 w-4 mr-1" /> PDF
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Red de Referidos */}
          <Card className="shadow-md border-t-4" style={{ borderTopColor: COLORS.amarillo }}>
            <CardContent className="p-6">
              <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
                <Users className="h-5 w-5 text-amber-500" /> Mi Red de Referidos
              </h3>
              
              {(!afiliado.listaReferidos || afiliado.listaReferidos.length === 0) ? (
                <div className="p-6 text-center text-slate-500 bg-amber-50 rounded-xl border border-dashed border-amber-200">
                  <p className="font-semibold text-amber-700 mb-1">Aún no has invitado a nadie.</p>
                  <p className="text-sm">Comparte tu código <strong>{afiliado.codigoInstitucional}</strong> para obtener el plan especial de renovación.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
                      <tr>
                        <th className="px-4 py-3">Fecha de Afiliación</th>
                        <th className="px-4 py-3">Nombre</th>
                        <th className="px-4 py-3">Documento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[...afiliado.listaReferidos].reverse().map((refItem, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 text-slate-500 font-medium">
                            {new Date(refItem.fecha).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </td>
                          <td className="px-4 py-3 text-slate-800 font-bold">{refItem.nombre}</td>
                          <td className="px-4 py-3 text-xs text-slate-500 font-mono">{refItem.cedula}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="p-3 bg-amber-50 text-xs text-amber-800 text-center font-semibold border-t border-amber-100">
                    Acumulados para tu próximo descuento: {afiliado.referidosExitosos || 0}/5
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </main>

      {/* MODAL DE RENOVACIÓN */}
      <Dialog open={modalRenovacion} onOpenChange={setModalRenovacion}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              Renovación de Membresía
            </DialogTitle>
            <DialogDescription>
              Antes de proceder al pago, por favor verifica que tus datos de contacto estén actualizados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Teléfono Celular</label>
              <Input 
                value={datosRenovacion.telefono} 
                onChange={e => setDatosRenovacion({...datosRenovacion, telefono: e.target.value})} 
                placeholder="Ej. 3001234567"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Correo Electrónico</label>
              <Input 
                type="email"
                value={datosRenovacion.correo} 
                onChange={e => setDatosRenovacion({...datosRenovacion, correo: e.target.value})} 
                placeholder="correo@ejemplo.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Dirección de Residencia</label>
              <Input 
                value={datosRenovacion.direccion} 
                onChange={e => setDatosRenovacion({...datosRenovacion, direccion: e.target.value})} 
                placeholder="Carrera / Calle..."
              />
            </div>
          </div>

          <div className="bg-slate-50 p-4 border rounded-xl flex flex-col mb-4">
            <div className="flex justify-between items-center mb-2">
              <div>
                <p className="font-bold text-slate-800">Costo a Pagar</p>
                <p className="text-xs text-slate-500">
                  {labelPrecio}
                </p>
              </div>
              <div className="text-xl font-black text-green-600 text-right">
                ${new Intl.NumberFormat('es-CO').format(precioRenovacion)} <span className="text-xs font-normal text-slate-500">COP</span>
              </div>
            </div>
            <div className="bg-green-100 text-green-800 text-xs font-bold p-2 rounded text-center border border-green-200 mt-1 shadow-sm">
              ✨ {aporteText}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={handleRenovacionPago}
              disabled={isSavingDatos}
            >
              {isSavingDatos ? <Spinner className="h-5 w-5 mr-2" /> : <CreditCard className="h-5 w-5 mr-2" />}
              Pagar Renovación Segura (PSE / Tarjeta)
            </Button>
            <Button variant="outline" onClick={() => setModalRenovacion(false)}>
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* TEMPLATES OCULTOS PARA AVALES PDF */}
      <div style={{ position: "fixed", left: "-9999px", top: 0, zIndex: -1 }}>
        {/* Template Aval Educativo */}
        {membresiaEducativa && (
          <div
            ref={certEduRef}
            style={{ width: "800px", padding: "80px", background: "white", fontFamily: "'Times New Roman', serif", color: "#1a1a1a", lineHeight: "1.6", boxSizing: "border-box" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px", borderBottom: `2px solid ${CARNET_COLORS.azul}`, paddingBottom: "15px" }}>
              <img src="/logo.png" alt="Logo" style={{ width: "90px", height: "90px", borderRadius: "50%" }} crossOrigin="anonymous" />
              <div style={{ textAlign: "right" }}>
                <h1 style={{ fontSize: "24px", fontWeight: "900", margin: 0, color: CARNET_COLORS.azul }}>FUNDACIÓN ISLA CASCAJAL</h1>
                <p style={{ fontSize: "10px", fontWeight: "bold", margin: 0, color: "#666", textTransform: "uppercase" }}>NIT: 900.248.351-0</p>
              </div>
            </div>

            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "20px", fontWeight: "bold", textDecoration: "underline", margin: 0 }}>CERTIFICADO DE AVAL EDUCATIVO</h2>
            </div>

            <div style={{ fontSize: "14px", textAlign: "justify" }}>
              <p>
                La presente organización de base denominada FUNDACIÓN ISLA CASCAJAL “FICong”, identificada con NIT: 900.248.351-0, con domicilio principal en el Distrito de Santiago de Cali, República de Colombia, se permite presentar a <strong>{afiliado.nombre}</strong> con NUIP. <strong>{afiliado.cedula}</strong>, quien cuenta con registro oficial en nuestra base de datos institucional y con membresía activa para acceder a nuestros convenios educativos.
              </p>

              <p>
                Esta membresía fue realizada el día {formatearFecha(afiliado.fechaActivacion || afiliado.fechaIngreso)}, bajo el código institucional <strong>{afiliado.codigoInstitucional}</strong> y tiene validez y cobertura para los convenios Nacionales e Internacionales y le permite acceder a los programas, actividades y procesos académicos establecidos y ofertados por los aliados estratégicos de la Fundación Isla Cascajal y por ella misma.
              </p>

              <p>
                Después de corroborar que se asumirán los compromisos académicos, sociales y morales por parte del titular de este documento, se procede a conceder AVAL y se le solicita a la institución educativa receptora de este documento, que, de acuerdo al convenio interinstitucional firmado por las partes, se avance en el otorgamiento de los correspondientes descuentos para programas académicos y demás servicios educativos para el período académico {getPeriodoEducativo(membresiaEducativa.fechaExpiracion)}. El presente documento se expide a los {new Date().getDate().toString().padStart(2, '0')} días del mes de {new Date().toLocaleString('es-CO', { month: 'long' })} de {new Date().getFullYear()} en Santiago de Cali por interés del solicitante.
              </p>
            </div>

            <div style={{ marginTop: "20px", paddingBottom: "10px" }}>
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
                <img src="/firma.jpeg" alt="Firma" style={{ height: "60px", marginBottom: "5px" }} crossOrigin="anonymous" onError={(e) => e.target.style.display = 'none'} />
                <p style={{ margin: 0, fontWeight: "bold", fontSize: "14px" }}>Diana C. Rojas V.</p>
                <p style={{ margin: 0, fontWeight: "bold", fontSize: "14px" }}>Directora Administrativa</p>
                <p style={{ margin: 0, fontSize: "12px", fontStyle: "italic" }}>Fundación Isla Cascajal</p>
                <p style={{ margin: 0, fontSize: "10px", fontStyle: "italic" }}>Documento electrónico verificable con el código QR.</p>
              </div>
            </div>
            {qrDataUrl && (
              <div style={{ position: "absolute", top: "75px", left: "350px", opacity: 0.8 }}>
                <img src={qrDataUrl} alt="QR Validación" crossOrigin="anonymous" style={{ width: "90px", height: "90px", border: `2px solid ${COLORS.amarillo}`, padding: "4px", borderRadius: "8px" }} />
              </div>
            )}
          </div>
        )}

        {/* Template Aval Integral */}
        {membresiaIntegral && (
          <div
            ref={certIntRef}
            style={{ width: "800px", padding: "80px", background: "white", fontFamily: "'Times New Roman', serif", color: "#1a1a1a", lineHeight: "1.6", boxSizing: "border-box" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px", borderBottom: `2px solid ${CARNET_COLORS.azul}`, paddingBottom: "15px" }}>
              <img src="/logo.png" alt="Logo" style={{ width: "90px", height: "90px", borderRadius: "50%" }} crossOrigin="anonymous" />
              <div style={{ textAlign: "right" }}>
                <h1 style={{ fontSize: "24px", fontWeight: "900", margin: 0, color: CARNET_COLORS.azul }}>FUNDACIÓN ISLA CASCAJAL</h1>
                <p style={{ fontSize: "10px", fontWeight: "bold", margin: 0, color: "#666", textTransform: "uppercase" }}>NIT: 900.248.351-0</p>
              </div>
            </div>

            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "20px", fontWeight: "bold", textDecoration: "underline", margin: 0 }}>CERTIFICADO DE AFILIACIÓN INTEGRAL</h2>
            </div>

            <div style={{ fontSize: "14px", textAlign: "justify" }}>
              <p>
                La presente organización de base denominada FUNDACIÓN ISLA CASCAJAL “FICong”, identificada con NIT: 900.248.351-0, con domicilio principal en el Distrito de Santiago de Cali, República de Colombia, se permite presentar a <strong>{afiliado.nombre}</strong> con NUIP. <strong>{afiliado.cedula}</strong>, bajo el código institucional <strong>{afiliado.codigoInstitucional}</strong> y le permite acceder a los descuentos que otorgan nuestros convenios interinstitucionales.
              </p>

              <p>
                Esta membresía tiene validez y cobertura para los convenios Nacionales e Internacionales y le permite acceder a los programas, actividades y procesos establecidos por la Fundación Isla Cascajal, así pues; después de corroborar que se asumirán los compromisos sociales y morales por parte del titular de este documento, se procede a reconocer su AFILIACIÓN ACTIVA y se le solicita a la organización receptora de este documento, que, de acuerdo al convenio interinstitucional firmado por las partes, se avance en el otorgamiento de los correspondientes descuentos especiales tanto al titular de la membresía como a sus beneficiarios y mascotas hasta las 11:59 p.m. del día {formatearFecha(membresiaIntegral.fechaExpiracion)}.
              </p>
            </div>

            {afiliado.beneficiarios?.length > 0 && (
              <div style={{ marginTop: "15px", border: "1px solid #000", padding: "8px", paddingBottom: "10px" }}>
                <p style={{ color: "#0070C0", margin: 0, marginBottom: "8px", fontSize: "12px", fontWeight: "bold" }}>BENEFICIARIOS:</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {afiliado.beneficiarios.map((b, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", paddingRight: "20px" }}>
                      <span>{b.nombre}</span>
                      <span>NUIP: {b.nuip || "Sin registro"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {afiliado.mascotas?.length > 0 && (
              <div style={{ marginTop: "10px", border: "1px solid #000", padding: "8px", paddingBottom: "10px" }}>
                <p style={{ color: "#0070C0", margin: 0, marginBottom: "8px", fontSize: "12px", fontWeight: "bold" }}>MASCOTAS (PLAN INTEGRAL):</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                  {afiliado.mascotas.map((m, i) => (
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
                <img src="/firma.jpeg" alt="Firma" style={{ height: "60px", marginBottom: "5px" }} crossOrigin="anonymous" onError={(e) => e.target.style.display = 'none'} />
                <p style={{ margin: 0, fontWeight: "bold", fontSize: "14px" }}>Diana C. Rojas V.</p>
                <p style={{ margin: 0, fontWeight: "bold", fontSize: "14px" }}>Directora Administrativa</p>
                <p style={{ margin: 0, fontSize: "12px", fontStyle: "italic" }}>Fundación Isla Cascajal</p>
                <p style={{ margin: 0, fontSize: "10px", fontStyle: "italic" }}>Documento electrónico verificable con el código QR.</p>
              </div>
            </div>
            {qrDataUrl && (
              <div style={{ position: "absolute", top: "75px", left: "350px", opacity: 0.8 }}>
                <img src={qrDataUrl} alt="QR Validación" crossOrigin="anonymous" style={{ width: "90px", height: "90px", border: `2px solid ${COLORS.amarillo}`, padding: "4px", borderRadius: "8px" }} />
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
