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
} from "lucide-react";
import Image from "next/image";

function VerificarContent() {
  const searchParams = useSearchParams();
  const codigo = searchParams.get("doc")?.trim().toUpperCase();

  const [estado, setEstado] = useState("loading");
  const [documento, setDocumento] = useState(null);

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
          const data = { codigo: docSnap.id, ...docSnap.data() };

          // ✅ VALIDACIÓN REAL
          if (data.estado === "inactivo") {
            setDocumento(data);
            setEstado("revoked"); // nuevo estado
          } else {
            setDocumento(data);
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
    <div className="min-h-screen flex items-center justify-center bg-primary p-4">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.03)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.03)_50%,rgba(255,255,255,0.03)_75%,transparent_75%,transparent)] bg-[length:60px_60px] pointer-events-none" />

      <Card className="w-full max-w-md relative z-10 shadow-2xl border-0">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            <Image
              src="/logo.png"
              alt="Logo Fundación Isla Cascajal"
              width={100}
              height={100}
              className="rounded-full"
              priority
            />
          </div>
          <CardTitle className="text-2xl font-bold text-primary">
            Verificación Oficial
          </CardTitle>
          <CardDescription>
            Sistema de autenticidad documental
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-2">

          {estado === "loading" && (
            <div className="text-center py-8">
              <Spinner className="h-8 w-8 mx-auto mb-4" />
              <p>Verificando documento...</p>
            </div>
          )}

          {estado === "no-code" && (
            <div className="text-center py-8">
              <AlertCircle className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
              <p>Código no proporcionado</p>
            </div>
          )}

          {estado === "invalid" && (
            <div className="text-center py-8">
              <XCircle className="h-10 w-10 mx-auto mb-4 text-destructive" />
              <h3 className="text-lg font-semibold text-destructive">
                Documento No Válido
              </h3>
              <p className="text-sm text-muted-foreground">
                No existe en el sistema
              </p>
            </div>
          )}

          {/* ✅ NUEVO ESTADO */}
          {estado === "revoked" && documento && (
            <div className="text-center py-8">
              <XCircle className="h-10 w-10 mx-auto mb-4 text-destructive" />
              <h3 className="text-lg font-semibold text-destructive">
                Documento Inactivo
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Este documento fue revocado o desactivado.
              </p>

              <Badge variant="outline" className="font-mono">
                {documento.codigo}
              </Badge>
            </div>
          )}

          {estado === "valid" && documento && (
            <div className="space-y-6">

              <div className="text-center">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-4 text-success" />
                <Badge className="bg-success text-white">
                  Documento Válido
                </Badge>
              </div>

              <div className="space-y-3">
                <p><strong>Nombre:</strong> {documento.nombre}</p>
                <p><strong>Código:</strong> {documento.codigo}</p>
                <p><strong>Tipo:</strong> {documento.tipo}</p>

                {documento.evento && (
                  <p><strong>Evento:</strong> {documento.evento}</p>
                )}

                {documento.estado && (
                  <p><strong>Estado:</strong> {documento.estado}</p>
                )}
              </div>

              <div className="p-3 bg-green-100 rounded text-center">
                <p className="text-sm text-green-700">
                  Validado correctamente
                </p>
              </div>
            </div>
          )}

        </CardContent>

        <div className="p-4 text-center text-xs text-muted-foreground border-t">
          Fundación Isla Cascajal
        </div>
      </Card>
    </div>
  );
}

export default function VerificarPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <VerificarContent />
    </Suspense>
  );
}