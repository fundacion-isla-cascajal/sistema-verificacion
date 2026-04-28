import Link from "next/link";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
      <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mb-6">
        <ShieldAlert className="h-10 w-10 text-destructive" />
      </div>
      <h1 className="text-3xl font-bold text-foreground mb-2">Acceso Denegado</h1>
      <p className="text-muted-foreground mb-8 max-w-md">
        No tienes los permisos necesarios para visualizar esta página. Si crees que se trata de un error, por favor contacta al administrador del sistema.
      </p>
      <div className="flex gap-4">
        <Button asChild variant="default">
          <Link href="/">
            Ir al inicio
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/login">
            Cerrar Sesión
          </Link>
        </Button>
      </div>
    </div>
  );
}
