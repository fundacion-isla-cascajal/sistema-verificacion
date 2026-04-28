"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Spinner } from "@/components/ui/spinner";
import Image from "next/image";

export default function HomePage() {
  const router = useRouter();
  const { user, userData, loading } = useAuth(false); // No forzar redirect en el hook

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push("/login");
      return;
    }

    if (userData) {
      if (userData.rol === "empleado") {
        router.push("/asistencia");
      } else if (userData.rol === "admin" || userData.rol === "superadmin") {
        router.push("/dashboard");
      } else {
        router.push("/unauthorized");
      }
    } else {
      // Caso en el que hay sesión auth pero no documento de usuario
      router.push("/unauthorized?reason=no_profile");
    }
  }, [user, userData, loading, router]);

  return (
    <div className="min-h-screen bg-primary flex flex-col items-center justify-center">
      <div className="text-center">
        <Image
          src="/logo.png"
          alt="Logo Fundación Isla Cascajal"
          width={120}
          height={120}
          className="mx-auto mb-6 rounded-full"
          loading="eager"
          priority
        />
        <h1 className="text-2xl font-bold text-primary-foreground mb-2">
          Fundación Isla Cascajal
        </h1>
        <p className="text-primary-foreground/70 mb-8">
          Sistema Institucional
        </p>
        <Spinner className="mx-auto text-primary-foreground" />
      </div>
    </div>
  );
}
