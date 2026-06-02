"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  CheckCircle2,
  XCircle,
  User,
  IdCard,
  Calendar,
  Award,
  ShieldCheck,
  AlertCircle,
  ArrowLeft,
  QrCode,
  Globe,
  Users,
  PawPrint,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

function VerificarContent() {
  const searchParams = useSearchParams();
  const codigoRaw = searchParams.get("doc")?.trim();
  const codigo = codigoRaw?.toUpperCase();
  const source = searchParams.get("source");

  const [estado, setEstado] = useState("loading");
  const [documento, setDocumento] = useState(null);

  useEffect(() => {
    if (!codigo) {
      setEstado("no-code");
      return;
    }

    const verificar = async () => {
      try {
        let docData = null;

        // 1. Buscar en 'afiliados' por campo 'codigo' (no por ID del documento)
        const afiliadosQuery = query(collection(db, "afiliados"), where("codigo", "==", codigo));
        const afiliadosSnap = await getDocs(afiliadosQuery);

        if (!afiliadosSnap.empty) {
          const afiliadoDoc = afiliadosSnap.docs[0];
          docData = { codigo: afiliadoDoc.data().codigo, tipo: "afiliado", ...afiliadoDoc.data() };
        } else {
          // 2. Buscar en 'empleados' por codigoInstitucional (exacto tal como fue guardado)
          // Intentar con el valor tal como viene, y también en mayúsculas
          let empSnap = null;
          const empQueryUpper = query(collection(db, "empleados"), where("codigoInstitucional", "==", codigo));
          empSnap = await getDocs(empQueryUpper);

          if (empSnap.empty && codigoRaw) {
            // Intentar con el valor original sin transformar
            const empQueryRaw = query(collection(db, "empleados"), where("codigoInstitucional", "==", codigoRaw));
            empSnap = await getDocs(empQueryRaw);
          }

          if (!empSnap.empty) {
            const empDoc = empSnap.docs[0];
            docData = {
              codigo: empDoc.data().codigoInstitucional,
              tipo: "afiliado",
              esPersonalInstitucional: true,
              cedula: empDoc.data().documento,
              estado: empDoc.data().estado || "activo",
              ...empDoc.data()
            };
          } else {
            // 3. Buscar en 'documentos' (Certificados, etc)
            const docRef = doc(db, "documentos", codigo);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              docData = { codigo: docSnap.id, ...docSnap.data(), tipo: "certificado" };
            }
          }
        }

        if (docData) {
          const now = new Date();
          let isExpired = false;

          if (docData.tipo === "afiliado") {
            if (docData.esPersonalInstitucional) {
              // Personal: activo si estado === 'activo'
              isExpired = docData.estado !== "activo";
            } else {
              // Afiliado: activo si tiene membresía vigente o membresía 'indefinida'
              const hasActiveMembership = docData.membresias?.some(m =>
                m.fechaExpiracion === "indefinida" || now <= new Date(m.fechaExpiracion)
              );
              isExpired = !hasActiveMembership;
            }
          } else {
            isExpired = docData.fechaExpiracion && now > new Date(docData.fechaExpiracion);
          }

          setDocumento({ ...docData, isExpired });

          if (docData.estado === "inactivo" || isExpired) {
            setEstado("inactive");
          } else {
            setEstado("valid");
          }
        } else {
          setEstado("invalid");
        }
      } catch (error) {
        console.error(error);
        setEstado("invalid");
      }
    };

    verificar();
  }, [codigo]);

  const formatearFecha = (f) => {
    if (!f) return "-";
    return new Date(f).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary p-4 relative">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.03)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.03)_50%,rgba(255,255,255,0.03)_75%,transparent_75%,transparent)] bg-[length:60px_60px] pointer-events-none" />

      {(source === "generar" || source === "dashboard") && (
        <div className="absolute top-4 left-4 z-20">
          <Button variant="secondary" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver al Dashboard
            </Link>
          </Button>
        </div>
      )}

      <Card className="w-full max-w-md relative z-10 shadow-2xl border-0 overflow-hidden">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            <Image
              src="/logo.png"
              alt="Logo"
              width={90}
              height={90}
              className="rounded-full border-4 border-primary/10"
              priority
            />
          </div>
          <CardTitle className="text-2xl font-black text-primary tracking-tight">VERIFICACIÓN OFICIAL</CardTitle>
          <CardDescription className="text-muted-foreground font-medium">
            Fundación Isla Cascajal
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-2">
          {estado === "loading" && (
            <div className="text-center py-12">
              <Spinner className="h-10 w-10 mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground animate-pulse">Consultando base de datos institucional...</p>
            </div>
          )}

          {estado === "no-code" && (
            <div className="text-center py-10">
              <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-20" />
              <h3 className="text-lg font-bold mb-2 text-foreground">CÓDIGO NO DETECTADO</h3>
              <p className="text-sm text-muted-foreground">No se ha proporcionado un identificador válido para verificar.</p>
            </div>
          )}

          {estado === "invalid" && (
            <div className="text-center py-10">
              <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-bold text-destructive mb-2 uppercase">Registro No Encontrado</h3>
              <p className="text-sm text-muted-foreground mb-6">El código ingresado no existe en nuestros registros oficiales.</p>
              {codigo && <Badge variant="outline" className="font-mono text-lg py-1 px-4">{codigo}</Badge>}
            </div>
          )}

          {(estado === "valid" || estado === "inactive") && documento && (
            <div className="space-y-6">
              <div className="text-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${estado === 'valid' ? 'bg-success/10' : 'bg-amber-500/10'}`}>
                  {estado === 'valid' ? <CheckCircle2 className="h-10 w-10 text-success" /> : <AlertCircle className="h-10 w-10 text-amber-500" />}
                </div>
                <Badge
                  className={`text-base px-6 py-1.5 uppercase font-black ${estado === 'valid'
                    ? (documento.esPersonalInstitucional ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : (documento.tipo === 'afiliado' ? 'bg-info hover:bg-info' : 'bg-success hover:bg-success'))
                    : 'bg-destructive hover:bg-destructive text-white'
                    }`}
                >
                  {estado === 'valid'
                    ? (documento.esPersonalInstitucional ? 'Personal Institucional' : (documento.tipo === 'afiliado' ? 'Afiliado Verificado' : 'Documento Válido'))
                    : (documento.esPersonalInstitucional && documento.estado === 'inactivo' ? 'PERSONAL INACTIVO' : (documento.isExpired ? 'Vigencia Expirada' : 'Registro Inactivo'))}
                </Badge>
              </div>

              <div className="space-y-3">
                {/* Info Principal */}
                <div className="bg-muted/30 p-4 rounded-xl border border-muted-foreground/10 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Nombre del Titular</p>
                      <p className="font-bold text-foreground text-lg leading-tight">{documento.nombre}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-muted-foreground/10">
                    <div>
                      <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Documento (NUIP)</p>
                      <p className="font-mono font-bold text-sm">{documento.cedula || "-"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Código Único</p>
                      <p className="font-mono font-bold text-sm text-primary">{documento.codigo}</p>
                    </div>
                  </div>
                </div>

                {/* Detalles de Personal Institucional */}
                {documento.esPersonalInstitucional && (
                  <div className="bg-indigo-50 dark:bg-indigo-950/30 p-4 rounded-xl border border-indigo-200 dark:border-indigo-800 space-y-3">
                    <p className="text-[10px] uppercase font-black text-indigo-600 dark:text-indigo-400 tracking-widest flex items-center gap-2">
                      <ShieldCheck className="h-3 w-3" /> Vinculación Institucional
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {documento.cargo && (
                        <div>
                          <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Cargo</p>
                          <p className="text-sm font-bold">{documento.cargo}</p>
                        </div>
                      )}
                      {documento.tipoPersonal && (
                        <div>
                          <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Tipo</p>
                          <p className="text-sm font-bold">{documento.tipoPersonal}</p>
                        </div>
                      )}
                      {documento.modalidadLaboral && (
                        <div>
                          <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Modalidad</p>
                          <p className="text-sm font-bold">{documento.modalidadLaboral}</p>
                        </div>
                      )}
                      {documento.fechaIngreso && (
                        <div>
                          <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Fecha de Ingreso</p>
                          <p className="text-sm font-bold">{formatearFecha(documento.fechaIngreso)}</p>
                        </div>
                      )}
                    </div>
                    <div className="pt-2 border-t border-indigo-200 dark:border-indigo-800 flex items-center justify-between">
                      <span className="text-[10px] uppercase font-black text-muted-foreground">Estado Laboral</span>
                      <Badge className="bg-green-500 text-white text-[10px]">ACTIVO</Badge>
                    </div>
                  </div>
                )}

                {/* Detalles de Membresía (Solo Afiliados NO institucionales) */}
                {documento.tipo === "afiliado" && !documento.esPersonalInstitucional && (
                  <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 space-y-3">
                    <p className="text-[10px] uppercase font-black text-primary tracking-widest flex items-center gap-2">
                      <ShieldCheck className="h-3 w-3" /> Membresías Institucionales
                    </p>
                    <div className="space-y-2">
                      {documento.membresias?.map((m, idx) => {
                        const expired = m.fechaExpiracion !== "indefinida" && new Date() > new Date(m.fechaExpiracion);
                        return (
                          <div key={idx} className="flex justify-between items-center p-2 bg-white rounded-lg border shadow-sm">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold uppercase">{m.tipo}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {m.fechaExpiracion === "indefinida" ? "Vigencia: Indefinida" : `Vence: ${formatearFecha(m.fechaExpiracion)}`}
                              </span>
                            </div>
                            <Badge variant={expired ? "destructive" : "default"} className="text-[9px] h-5">
                              {expired ? "VENCIDA" : "VIGENTE"}
                            </Badge>
                          </div>
                        );
                      })}
                      {(!documento.membresias || documento.membresias.length === 0) && (
                        <p className="text-xs text-muted-foreground italic text-center py-2">Sin membresías activas registradas.</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Beneficiarios */}
                {documento.tipo === "afiliado" && documento.beneficiarios?.length > 0 && (
                  <div className="bg-muted/30 p-4 rounded-xl border border-muted-foreground/10 space-y-2">
                    <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest flex items-center gap-2">
                      <Users className="h-3 w-3" /> Beneficiarios Autorizados
                    </p>
                    <div className="grid grid-cols-1 gap-1">
                      {documento.beneficiarios.map((ben, idx) => (
                        <p key={idx} className="text-xs font-medium pl-5 relative before:content-['•'] before:absolute before:left-0 before:text-primary">
                          {ben.nombre}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mascotas */}
                {documento.tipo === "afiliado" && documento.mascotas?.length > 0 && (
                  <div className="bg-muted/30 p-4 rounded-xl border border-muted-foreground/10 space-y-2">
                    <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest flex items-center gap-2">
                      <PawPrint className="h-3 w-3" /> Mascotas (Plan Integra)
                    </p>
                    <div className="grid grid-cols-1 gap-1">
                      {documento.mascotas.map((mascota, idx) => (
                        <p key={idx} className="text-xs font-medium pl-5 relative before:content-['•'] before:absolute before:left-0 before:text-primary">
                          {mascota.nombre} <span className="text-[10px] text-muted-foreground font-normal">({mascota.tipo}{mascota.raza ? ` - ${mascota.raza}` : ''})</span>
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* PAÍS Y FECHA DE EMISIÓN PARA TODOS */}
                <div className="bg-muted/30 p-4 rounded-xl border border-muted-foreground/10 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">País</p>
                    <p className="text-sm font-bold">{documento.pais || "Colombia"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Fecha de Emisión</p>
                    <p className="text-sm font-bold">
                      {formatearFecha(documento.tipo === 'afiliado' ? (documento.fechaCreacion || documento.fechaIngreso) : (documento.fecha || documento.fechaIngreso))}
                    </p>
                  </div>
                </div>

                {/* Info Certificado */}
                {documento.tipo === "certificado" && (
                  <div className="bg-muted/30 p-4 rounded-xl border border-muted-foreground/10 space-y-3">
                    {documento.evento && (
                      <div>
                        <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Evento / Actividad</p>
                        <p className="text-sm font-bold">{documento.evento}</p>
                      </div>
                    )}
                    {documento.descripcion && (
                      <div>
                        <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Descripción</p>
                        <p className="text-sm font-medium italic">"{documento.descripcion}"</p>
                      </div>
                    )}
                    <div className="pt-2 border-t border-muted-foreground/10">
                      <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Emitido por</p>
                      <p className="text-xs font-bold text-primary uppercase">{documento.oficina || "Sede Principal"}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className={`p-4 rounded-xl border text-center ${estado === 'valid' ? 'bg-success/5 border-success/20' : 'bg-destructive/5 border-destructive/20'}`}>
                <p className={`text-xs font-bold ${estado === 'valid' ? 'text-success' : 'text-destructive'}`}>
                  {estado === 'valid'
                    ? "CERTIFICACIÓN DE AUTENTICIDAD EMITIDA POR EL SISTEMA"
                    : "ESTE REGISTRO NO ES VÁLIDO PARA TRÁMITES OFICIALES"}
                </p>
              </div>
            </div>
          )}
        </CardContent>

        <div className="px-6 py-4 bg-muted/20 text-center border-t">
          <p className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">
            Documento validado digitalmente • {new Date().getFullYear()}
          </p>
        </div>
      </Card>
    </div>
  );
}

export default function VerificarPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-primary flex items-center justify-center">
          <Spinner className="h-10 w-10 text-primary-foreground" />
        </div>
      }
    >
      <VerificarContent />
    </Suspense>
  );
}