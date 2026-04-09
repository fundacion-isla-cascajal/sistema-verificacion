"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
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
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// Componente que procesa la búsqueda en la Base de Datos usando el código proveído en la URL
function VerificarContent() {
  const searchParams = useSearchParams();
  const codigo = searchParams.get("doc")?.trim().toUpperCase();
  const source = searchParams.get("source");

  const [estado, setEstado] = useState("loading");
  const [documento, setDocumento] = useState(null);

  // Efecto que se dispara automáticamente: Busca el documento y valida si su estado no es inactivo
  useEffect(() => {
    if (!codigo) {
      setEstado("no-code");
      return;
    }

    const verificar = async () => {
      try {
        const docRef = doc(db, "documentos", codigo);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const docData = { codigo: docSnap.id, ...docSnap.data() };
          setDocumento(docData);
          // "activo" → válido, cualquier otra cosa → inactivo
          if (docData.estado === "inactivo") {
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary p-4 relative">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.03)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.03)_50%,rgba(255,255,255,0.03)_75%,transparent_75%,transparent)] bg-[length:60px_60px] pointer-events-none" />

      {source === "generar" && (
        <div className="absolute top-4 left-4 z-20">
          <Button variant="secondary" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver al Dashboard
            </Link>
          </Button>
        </div>
      )}

      <Card className="w-full max-w-md relative z-10 shadow-2xl border-0">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            <Image
              src="/logo.png"
              alt="Logo Fundación Isla Cascajal"
              width={100}
              height={100}
              className="rounded-full"
              loading="eager"
              priority
            />
          </div>
          <CardTitle className="text-2xl font-bold text-primary">Verificación Oficial</CardTitle>
          <CardDescription className="text-muted-foreground">
            Sistema de autenticidad documental
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-2">
          {estado === "loading" && (
            <div className="text-center py-8">
              <Spinner className="h-8 w-8 mx-auto mb-4" />
              <p className="text-muted-foreground">Verificando documento...</p>
            </div>
          )}

          {estado === "no-code" && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Código no proporcionado
              </h3>
              <p className="text-sm text-muted-foreground">
                No se ha proporcionado un código de documento para verificar.
              </p>
            </div>
          )}

          {estado === "invalid" && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="h-8 w-8 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold text-destructive mb-2">
                Documento No Válido
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                El código ingresado no se encuentra registrado en el sistema.
              </p>
              {codigo && (
                <Badge variant="outline" className="font-mono">
                  {codigo}
                </Badge>
              )}
            </div>
          )}

          {estado === "inactive" && documento && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-8 w-8 text-amber-500" />
              </div>
              <h3 className="text-lg font-semibold text-amber-600 mb-2">
                {documento.tipo === "afiliado" ? "Afiliado Inactivo" : "Documento Inactivo"}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Este {documento.tipo === "afiliado" ? "afiliado" : "documento"} está registrado pero se encuentra <strong>inactivo</strong> en el sistema.
              </p>
              <div className="space-y-3 text-left max-w-xs mx-auto">
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Nombre</p>
                    <p className="font-medium">{documento.nombre}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <IdCard className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Código</p>
                    <p className="font-mono font-medium">{documento.codigo}</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                <p className="text-sm text-amber-600">
                  Para más información, contacte a la Fundación Isla Cascajal.
                </p>
              </div>
            </div>
          )}

          {estado === "valid" && documento && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="h-8 w-8 text-success" />
                </div>
                <Badge
                  className={
                    documento.tipo === "certificado"
                      ? "bg-success text-success-foreground text-base px-4 py-1"
                      : documento.tipo === "documento"
                      ? "bg-primary text-primary-foreground text-base px-4 py-1"
                      : "bg-info text-info-foreground text-base px-4 py-1"
                  }
                >
                  {documento.tipo === "certificado" ? "Certificado Válido" : documento.tipo === "documento" ? "Documento Válido" : "Afiliado Verificado"}
                </Badge>
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <User className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Nombre</p>
                    <p className="font-medium">{documento.nombre}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <IdCard className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Código</p>
                    <p className="font-mono font-medium">{documento.codigo}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Award className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Tipo</p>
                    <p className="font-medium capitalize">{documento.tipo}</p>
                  </div>
                </div>
                {documento.tipo === "certificado" && documento.evento && (
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Calendar className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Evento</p>
                      <p className="font-medium">{documento.evento}</p>
                    </div>
                  </div>
                )}
                {(documento.tipo === "certificado" || documento.tipo === "documento") && documento.descripcion && (
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Descripción</p>
                      <p className="font-medium">{documento.descripcion}</p>
                    </div>
                  </div>
                )}
                {documento.tipo === "afiliado" && (
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Estado</p>
                      <p className="font-medium capitalize">{documento.estado}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 bg-success/5 border border-success/20 rounded-lg text-center">
                <p className="text-sm text-success">
                  Este registro ha sido validado correctamente en el sistema institucional.
                </p>
              </div>
            </div>
          )}
        </CardContent>

        <div className="px-6 py-4 bg-muted/30 rounded-b-xl text-center border-t">
          <p className="text-xs text-muted-foreground">
            Documento validado digitalmente por Fundación Isla Cascajal
          </p>
        </div>
      </Card>
    </div>
  );
}

// Contenedor principal de la página. Es necesario englobar todo en "Suspense" cuando se lee de la URL en Next.js
export default function VerificarPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-primary flex items-center justify-center">
          <Spinner className="h-8 w-8 text-primary-foreground" />
        </div>
      }
    >
      <VerificarContent />
    </Suspense>
  );
}