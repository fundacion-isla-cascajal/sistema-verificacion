"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Spinner } from "@/components/ui/spinner";
import Image from "next/image";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.push("/dashboard");
      } else {
        router.push("/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

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
          Sistema de Verificación Documental
        </p>
        <Spinner className="mx-auto text-primary-foreground" />
      </div>
    </div>
  );
}
