"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import ProtectedRoute from "@/components/protected-route";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Users,
  ShieldCheck,
  UserPlus,
  RefreshCcw,
  LogOut,
  ArrowLeft,
  Mail,
  Lock,
  User,
  Briefcase
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { crearUsuarioInstitucional } from "@/app/actions/usuarios";

function UsuariosContent() {
  const { user, userData, logout } = useAuth();
  
  const [usuarios, setUsuarios] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [cargando, setCargando] = useState(true);
  
  // Estado modal crear
  const [openCrear, setOpenCrear] = useState(false);
  const [creando, setCreando] = useState(false);
  const [formData, setFormData] = useState({
    nombre: "",
    correo: "",
    password: "",
    rol: "empleado",
    empleadoId: "ninguno"
  });

  const cargarDatos = async () => {
    setCargando(true);
    try {
      // Cargar usuarios
      const usersSnap = await getDocs(collection(db, "usuarios"));
      const usersList = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setUsuarios(usersList);

      // Cargar empleados para el select
      const empSnap = await getDocs(collection(db, "empleados"));
      const empList = empSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setEmpleados(empList);
    } catch (error) {
      console.error(error);
      toast.error("Error al cargar los datos");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const handleCrearUsuario = async (e) => {
    e.preventDefault();
    if (!formData.correo || !formData.password || !formData.nombre || !formData.rol) {
      toast.error("Por favor completa todos los campos obligatorios");
      return;
    }
    
    if (formData.password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setCreando(true);
    try {
      const payload = {
        ...formData,
        empleadoId: formData.empleadoId === "ninguno" ? null : formData.empleadoId,
        creadoPorUid: user.uid
      };

      const result = await crearUsuarioInstitucional(payload);

      if (result.success) {
        toast.success("Usuario creado exitosamente");
        setOpenCrear(false);
        setFormData({ nombre: "", correo: "", password: "", rol: "empleado", empleadoId: "ninguno" });
        cargarDatos();
      } else {
        toast.error(result.error || "Error al crear el usuario");
      }
    } catch (error) {
      console.error(error);
      toast.error("Error inesperado");
    } finally {
      setCreando(false);
    }
  };

  const handleToggleActivo = async (usuarioId, estadoActual) => {
    try {
      await updateDoc(doc(db, "usuarios", usuarioId), {
        activo: !estadoActual
      });
      toast.success(`Usuario ${!estadoActual ? 'activado' : 'desactivado'}`);
      cargarDatos();
    } catch (error) {
      console.error(error);
      toast.error("Error al cambiar estado");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <Image src="/logo.png" alt="Logo" width={36} height={36} className="rounded-full" />
            <div>
              <h1 className="font-semibold text-foreground text-sm leading-tight">
                Gestión de Usuarios
              </h1>
              <p className="text-xs text-muted-foreground">Panel Superadmin</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={cargarDatos} title="Recargar">
              <RefreshCcw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4 mr-2" />
              Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              Cuentas de Acceso
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Administra quién tiene acceso al sistema y con qué privilegios.
            </p>
          </div>
          <Button onClick={() => setOpenCrear(true)} className="gap-2 shrink-0">
            <UserPlus className="h-4 w-4" />
            Nuevo Usuario
          </Button>
        </div>

        {cargando ? (
          <div className="flex justify-center py-12">
            <Spinner className="h-8 w-8 text-primary" />
          </div>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Empleado Vinculado</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usuarios.map((u) => {
                    const empleado = u.empleadoId ? empleados.find(e => e.id === u.empleadoId) : null;
                    return (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{u.nombre}</span>
                            <span className="text-xs text-muted-foreground">{u.correo}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            u.rol === 'superadmin' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                            u.rol === 'admin' ? 'bg-primary/10 text-primary border-primary/20' :
                            'bg-muted'
                          }>
                            {u.rol}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {empleado ? (
                            <div className="flex items-center gap-2 text-sm">
                              <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="truncate max-w-[150px]" title={empleado.nombre}>
                                {empleado.nombre}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">No vinculado</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={u.activo !== false ? "success" : "secondary"}>
                            {u.activo !== false ? "Activo" : "Inactivo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleToggleActivo(u.id, u.activo !== false)}
                            className={u.activo !== false ? "text-destructive hover:text-destructive" : "text-success hover:text-success"}
                            disabled={u.id === user.uid} // No puede desactivarse a sí mismo
                          >
                            {u.activo !== false ? "Desactivar" : "Activar"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {usuarios.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No hay usuarios registrados
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </main>

      {/* Modal Crear Usuario */}
      <Dialog open={openCrear} onOpenChange={setOpenCrear}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Usuario</DialogTitle>
            <DialogDescription>
              Genera una nueva cuenta de acceso usando Firebase Auth.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCrearUsuario} className="space-y-4 mt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nombre completo</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  required
                  placeholder="Ej. Juan Pérez" 
                  value={formData.nombre}
                  onChange={e => setFormData({...formData, nombre: e.target.value})}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Correo de acceso</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  required
                  type="email"
                  placeholder="correo@ejemplo.com" 
                  value={formData.correo}
                  onChange={e => setFormData({...formData, correo: e.target.value})}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Contraseña temporal</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  required
                  type="password"
                  placeholder="Mínimo 6 caracteres" 
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Rol del Sistema</label>
              <Select 
                value={formData.rol} 
                onValueChange={v => setFormData({...formData, rol: v})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="empleado">Empleado (Solo Asistencia)</SelectItem>
                  <SelectItem value="admin">Administrador (Gestión Documental)</SelectItem>
                  <SelectItem value="superadmin">Superadmin (Acceso Total)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.rol === "empleado" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Vincular a perfil de Empleado</label>
                <Select 
                  value={formData.empleadoId} 
                  onValueChange={v => setFormData({...formData, empleadoId: v})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ninguno">No vincular aún</SelectItem>
                    {empleados.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.nombre} - {emp.cargo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground leading-tight mt-1">
                  Requerido para que el módulo de asistencia funcione. El empleado debe haber sido creado previamente en el sistema antiguo o manual.
                </p>
              </div>
            )}

            <div className="pt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpenCrear(false)} disabled={creando}>
                Cancelar
              </Button>
              <Button type="submit" disabled={creando}>
                {creando && <Spinner className="mr-2 h-4 w-4" />}
                Crear Usuario
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function UsuariosPage() {
  return (
    <ProtectedRoute allowedRoles={["superadmin"]}>
      <UsuariosContent />
    </ProtectedRoute>
  );
}
