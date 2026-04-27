"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import Image from "next/image";
import {
    LogIn,
    LogOut,
    Coffee,
    RotateCcw,
    Monitor,
    CheckCircle2,
    Clock,
    User,
    Wifi,
    WifiOff,
    MapPin,
    MapPinOff,
    Activity,
    Send,
    Sun,
    Briefcase,
    AlertCircle,
    Home,
} from "lucide-react";

// ─── helpers ────────────────────────────────────────────────────────────────

function horaActual() {
    return new Date().toLocaleTimeString("es-CO", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    });
}

function fechaHoy() {
    return new Date().toISOString().split("T")[0]; // "2026-04-27"
}

function formatearHora(hora) {
    if (!hora) return "—";
    return hora;
}

// ─── config de botones ───────────────────────────────────────────────────────

const ACCIONES = [
    {
        id: "entrada",
        label: "Registrar Entrada",
        icon: LogIn,
        campo: "horaEntrada",
        estadoResultante: "trabajando",
        color: "bg-success hover:bg-success/90 text-success-foreground",
        visible: (r) => !r?.horaEntrada,
        descripcion: "Marca el inicio de tu jornada laboral",
    },
    {
        id: "salidaAlmuerzo",
        label: "Salida Almuerzo",
        icon: Coffee,
        campo: "horaSalidaAlmuerzo",
        estadoResultante: "almuerzo",
        color: "bg-amber-500 hover:bg-amber-500/90 text-white",
        visible: (r) => r?.horaEntrada && !r?.horaSalidaAlmuerzo,
        descripcion: "Marca tu salida para almorzar",
    },
    {
        id: "entradaAlmuerzo",
        label: "Regreso de Almuerzo",
        icon: RotateCcw,
        campo: "horaEntradaAlmuerzo",
        estadoResultante: "trabajando",
        color: "bg-info hover:bg-info/90 text-info-foreground",
        visible: (r) => r?.horaSalidaAlmuerzo && !r?.horaEntradaAlmuerzo,
        descripcion: "Marca tu regreso al trabajo",
    },
    {
        id: "salida",
        label: "Registrar Salida",
        icon: LogOut,
        campo: "horaSalida",
        estadoResultante: "finalizado",
        color: "bg-destructive hover:bg-destructive/90 text-destructive-foreground",
        visible: (r) => r?.horaEntrada && !r?.horaSalida && (r?.horaEntradaAlmuerzo || !r?.horaSalidaAlmuerzo),
        descripcion: "Marca el fin de tu jornada laboral",
    },
    {
        id: "teletrabajo",
        label: "Activar Teletrabajo",
        icon: Monitor,
        campo: "horaEntrada",
        estadoResultante: "teletrabajo_activo",
        color: "bg-primary hover:bg-primary/90 text-primary-foreground",
        visible: (r) => !r?.horaEntrada,
        esTeletrabajo: true,
        descripcion: "Registra tu jornada en modalidad remota",
    },
];

const ESTADO_CONFIG = {
    trabajando: {
        label: "En jornada",
        color: "bg-success/15 text-success border-success/30",
        icon: Briefcase,
        dot: "bg-success",
    },
    almuerzo: {
        label: "En almuerzo",
        color: "bg-amber-500/15 text-amber-600 border-amber-500/30",
        icon: Coffee,
        dot: "bg-amber-500",
    },
    teletrabajo_activo: {
        label: "Teletrabajo",
        color: "bg-primary/15 text-primary border-primary/30",
        icon: Monitor,
        dot: "bg-primary",
    },
    finalizado: {
        label: "Jornada finalizada",
        color: "bg-muted text-muted-foreground border-border",
        icon: CheckCircle2,
        dot: "bg-muted-foreground",
    },
    fuera_de_jornada: {
        label: "Sin registro hoy",
        color: "bg-muted text-muted-foreground border-border",
        icon: Clock,
        dot: "bg-muted-foreground",
    },
};

// ─── componente reloj ────────────────────────────────────────────────────────

function RelojVivo() {
    const [hora, setHora] = useState("");
    const [fecha, setFecha] = useState("");

    useEffect(() => {
        const actualizar = () => {
            const ahora = new Date();
            setHora(
                ahora.toLocaleTimeString("es-CO", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: true,
                })
            );
            setFecha(
                ahora.toLocaleDateString("es-CO", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                })
            );
        };
        actualizar();
        const interval = setInterval(actualizar, 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="text-center select-none">
            <p className="text-4xl font-bold tabular-nums tracking-tight text-primary">
                {hora || "—"}
            </p>
            <p className="text-sm text-muted-foreground mt-1 capitalize">{fecha}</p>
        </div>
    );
}

// ─── componente indicador WiFi/GPS ────────────────────────────────────────────

function IndicadorConexion({ wifiValido, gpsValido }) {
    return (
        <div className="flex items-center justify-center gap-4 text-xs">
            <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${wifiValido
                    ? "bg-success/10 text-success border-success/30"
                    : "bg-muted text-muted-foreground border-border"
                    }`}
            >
                {wifiValido ? (
                    <Wifi className="h-3 w-3" />
                ) : (
                    <WifiOff className="h-3 w-3" />
                )}
                <span>{wifiValido ? "WiFi OK" : "WiFi no detectado"}</span>
            </div>
            <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${gpsValido
                    ? "bg-success/10 text-success border-success/30"
                    : "bg-amber-500/10 text-amber-600 border-amber-500/30"
                    }`}
            >
                {gpsValido ? (
                    <MapPin className="h-3 w-3" />
                ) : (
                    <MapPinOff className="h-3 w-3" />
                )}
                <span>{gpsValido ? "Ubicación OK" : "Sin GPS"}</span>
            </div>
        </div>
    );
}

// ─── línea de tiempo ──────────────────────────────────────────────────────────

function LineaTiempo({ registro }) {
    const pasos = [
        { label: "Entrada", hora: registro?.horaEntrada, icon: LogIn, ok: !!registro?.horaEntrada },
        { label: "Sal. almuerzo", hora: registro?.horaSalidaAlmuerzo, icon: Coffee, ok: !!registro?.horaSalidaAlmuerzo },
        { label: "Reg. almuerzo", hora: registro?.horaEntradaAlmuerzo, icon: RotateCcw, ok: !!registro?.horaEntradaAlmuerzo },
        { label: "Salida", hora: registro?.horaSalida, icon: LogOut, ok: !!registro?.horaSalida },
    ];

    return (
        <div className="flex items-start justify-between relative">
            {/* línea conectora */}
            <div className="absolute top-4 left-4 right-4 h-0.5 bg-border z-0" />
            {pasos.map((paso, idx) => {
                const Icon = paso.icon;
                return (
                    <div key={idx} className="flex flex-col items-center gap-1.5 relative z-10 flex-1">
                        <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${paso.ok
                                ? "bg-success border-success text-success-foreground"
                                : "bg-card border-border text-muted-foreground"
                                }`}
                        >
                            <Icon className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-xs text-muted-foreground text-center leading-tight">{paso.label}</span>
                        <span className={`text-xs font-medium tabular-nums ${paso.ok ? "text-foreground" : "text-muted-foreground"}`}>
                            {formatearHora(paso.hora)}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

// ─── página principal ─────────────────────────────────────────────────────────

export default function AsistenciaPage() {
    const { user, userData, empleadoData, empleadoId, loading } = useAuth();

    const [registroHoy, setRegistroHoy] = useState(null);
    const [cargandoRegistro, setCargandoRegistro] = useState(true);
    const [accionEnCurso, setAccionEnCurso] = useState(null);
    const [actividadActual, setActividadActual] = useState("");
    const [enviandoActividad, setEnviandoActividad] = useState(false);
    const [wifiValido, setWifiValido] = useState(false);
    const [gpsValido, setGpsValido] = useState(false);
    const [modoTrabajo, setModoTrabajo] = useState("presencial");

    const hoy = fechaHoy();

    // ── verificar GPS ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            () => setGpsValido(true),
            () => setGpsValido(false),
            { timeout: 5000 }
        );
    }, []);

    // ── verificar conectividad (proxy simple) ────────────────────────────────
    useEffect(() => {
        setWifiValido(navigator.onLine);
        const on = () => setWifiValido(true);
        const off = () => setWifiValido(false);
        window.addEventListener("online", on);
        window.addEventListener("offline", off);
        return () => {
            window.removeEventListener("online", on);
            window.removeEventListener("offline", off);
        };
    }, []);

    // ── cargar registro de hoy ────────────────────────────────────────────────
    const cargarRegistro = useCallback(async () => {
        if (!empleadoId) return;
        setCargandoRegistro(true);
        try {
            const docId = `${hoy}_${empleadoId}`;
            const ref = doc(db, "asistencias", docId);
            const snap = await getDoc(ref);
            if (snap.exists()) {
                setRegistroHoy(snap.data());
                setActividadActual(snap.data().ultimaActividad || "");
            } else {
                setRegistroHoy(null);
            }
        } catch (err) {
            console.error(err);
            toast.error("Error al cargar el registro del día");
        } finally {
            setCargandoRegistro(false);
        }
    }, [empleadoId, hoy]);

    useEffect(() => {
        if (!loading && empleadoId) cargarRegistro();
    }, [loading, empleadoId, cargarRegistro]);

    // ── acción de registro ────────────────────────────────────────────────────
    const handleAccion = async (accion) => {
        if (!empleadoId) {
            toast.error("No se encontró tu perfil de empleado");
            return;
        }

        setAccionEnCurso(accion.id);
        const hora = horaActual();
        const docId = `${hoy}_${empleadoId}`;
        const ref = doc(db, "asistencias", docId);
        const modo = accion.esTeletrabajo ? "teletrabajo" : "presencial";

        try {
            const snap = await getDoc(ref);

            if (!snap.exists()) {
                // crear registro nuevo
                await setDoc(ref, {
                    fecha: hoy,
                    empleadoId,
                    nombre: empleadoData?.nombre || userData?.nombre || user?.email,
                    cargo: empleadoData?.cargo || "",
                    [accion.campo]: hora,
                    estadoActual: accion.estadoResultante,
                    modoTrabajo: modo,
                    wifiValidado: wifiValido,
                    gpsValidado: gpsValido,
                    ultimaActividad: "",
                    creadoEn: serverTimestamp(),
                    actualizadoEn: serverTimestamp(),
                });
            } else {
                // actualizar registro existente
                await updateDoc(ref, {
                    [accion.campo]: hora,
                    estadoActual: accion.estadoResultante,
                    modoTrabajo: modo,
                    wifiValidado: wifiValido,
                    gpsValidado: gpsValido,
                    actualizadoEn: serverTimestamp(),
                });
            }

            await cargarRegistro();
            toast.success(`✅ ${accion.label} registrada a las ${hora}`);
        } catch (err) {
            console.error(err);
            toast.error("Error al registrar. Intenta de nuevo.");
        } finally {
            setAccionEnCurso(null);
        }
    };

    // ── guardar actividad ─────────────────────────────────────────────────────
    const handleGuardarActividad = async () => {
        if (!actividadActual.trim()) {
            toast.error("Escribe una actividad primero");
            return;
        }
        if (!registroHoy) {
            toast.error("Primero registra tu entrada");
            return;
        }
        setEnviandoActividad(true);
        try {
            const docId = `${hoy}_${empleadoId}`;
            const ref = doc(db, "asistencias", docId);
            await updateDoc(ref, {
                ultimaActividad: actividadActual.trim(),
                actualizadoEn: serverTimestamp(),
            });
            toast.success("Actividad actualizada ✔");
            await cargarRegistro();
        } catch (err) {
            console.error(err);
            toast.error("Error al guardar la actividad");
        } finally {
            setEnviandoActividad(false);
        }
    };

    // ── pantallas de carga / sin perfil ──────────────────────────────────────
    if (loading || cargandoRegistro) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
                <Spinner className="h-10 w-10 text-primary" />
                <p className="text-muted-foreground text-sm">Cargando tu perfil laboral…</p>
            </div>
        );
    }

    if (!user) return null;

    if (!empleadoId) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
                <Card className="max-w-sm w-full text-center">
                    <CardContent className="pt-8 pb-8 space-y-4">
                        <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto">
                            <AlertCircle className="h-8 w-8 text-amber-500" />
                        </div>
                        <h2 className="text-lg font-semibold">Sin perfil de empleado</h2>
                        <p className="text-sm text-muted-foreground">
                            Tu cuenta no está vinculada a un empleado. Contacta al administrador.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const estadoActual = registroHoy?.estadoActual || "fuera_de_jornada";
    const estadoCfg = ESTADO_CONFIG[estadoActual] || ESTADO_CONFIG.fuera_de_jornada;
    const EstadoIcon = estadoCfg.icon;

    const accionesVisibles = ACCIONES.filter((a) => a.visible(registroHoy));
    const jornadaFinalizada = estadoActual === "finalizado";

    return (
        <div className="min-h-screen bg-background">
            {/* ── header ─────────────────────────────────────────────────────────── */}
            <header className="border-b bg-card sticky top-0 z-50">
                <div className="container mx-auto px-4 py-3 flex items-center justify-between max-w-2xl">
                    <div className="flex items-center gap-3">
                        <Image
                            src="/logo.png"
                            alt="Logo"
                            width={36}
                            height={36}
                            className="rounded-full"
                        />
                        <div>
                            <h1 className="font-semibold text-foreground text-sm">
                                Control de Asistencia
                            </h1>
                            <p className="text-xs text-muted-foreground">
                                Fundación Isla Cascajal
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="text-right hidden sm:block">
                            <p className="text-xs font-medium text-foreground">
                                {empleadoData?.nombre || userData?.nombre || user?.email}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {empleadoData?.cargo || "Empleado"}
                            </p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-4 w-4 text-primary" />
                        </div>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-6 max-w-2xl space-y-4">

                {/* ── reloj + estado ──────────────────────────────────────────────── */}
                <Card className="overflow-hidden">
                    <div className="bg-gradient-to-br from-primary/5 to-primary/10 px-6 pt-6 pb-4 space-y-4">
                        <RelojVivo />
                        <IndicadorConexion wifiValido={wifiValido} gpsValido={gpsValido} />
                    </div>
                    <CardContent className="pt-4 pb-4">
                        <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border ${estadoCfg.color}`}>
                            <span className={`w-2 h-2 rounded-full ${estadoCfg.dot} animate-pulse`} />
                            <EstadoIcon className="h-4 w-4" />
                            <span className="font-medium text-sm">{estadoCfg.label}</span>
                            {registroHoy?.modoTrabajo === "teletrabajo" && (
                                <Badge variant="outline" className="ml-auto text-xs gap-1">
                                    <Home className="h-3 w-3" />
                                    Remoto
                                </Badge>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* ── línea de tiempo ─────────────────────────────────────────────── */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Sun className="h-4 w-4" />
                            Registro de hoy
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <LineaTiempo registro={registroHoy} />
                    </CardContent>
                </Card>

                {/* ── botones de acción ────────────────────────────────────────────── */}
                {jornadaFinalizada ? (
                    <Card>
                        <CardContent className="pt-6 pb-6 text-center space-y-3">
                            <div className="w-14 h-14 bg-success/10 rounded-full flex items-center justify-center mx-auto">
                                <CheckCircle2 className="h-7 w-7 text-success" />
                            </div>
                            <p className="font-semibold text-foreground">Jornada completada</p>
                            <p className="text-sm text-muted-foreground">
                                Hasta mañana, {empleadoData?.nombre?.split(" ")[0] || "compañero/a"} 👋
                            </p>
                            <div className="text-xs text-muted-foreground space-y-1">
                                {registroHoy?.horaEntrada && (
                                    <p>Entrada: <span className="font-medium text-foreground">{registroHoy.horaEntrada}</span></p>
                                )}
                                {registroHoy?.horaSalida && (
                                    <p>Salida: <span className="font-medium text-foreground">{registroHoy.horaSalida}</span></p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <Activity className="h-4 w-4" />
                                Acciones disponibles
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {accionesVisibles.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                    No hay acciones disponibles en este momento.
                                </p>
                            ) : (
                                accionesVisibles.map((accion) => {
                                    const Icon = accion.icon;
                                    const enCurso = accionEnCurso === accion.id;
                                    return (
                                        <button
                                            key={accion.id}
                                            onClick={() => handleAccion(accion)}
                                            disabled={!!accionEnCurso}
                                            className={`
                        w-full flex items-center gap-4 px-5 py-4 rounded-xl font-medium
                        transition-all duration-200 active:scale-[0.98]
                        disabled:opacity-60 disabled:cursor-not-allowed
                        ${accion.color}
                        shadow-sm hover:shadow-md
                      `}
                                        >
                                            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                                                {enCurso ? (
                                                    <Spinner className="h-5 w-5" />
                                                ) : (
                                                    <Icon className="h-5 w-5" />
                                                )}
                                            </div>
                                            <div className="text-left flex-1">
                                                <p className="font-semibold text-sm">{accion.label}</p>
                                                <p className="text-xs opacity-80">{accion.descripcion}</p>
                                            </div>
                                            <Clock className="h-4 w-4 opacity-60" />
                                        </button>
                                    );
                                })
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* ── actualizar actividad ─────────────────────────────────────────── */}
                {registroHoy && !jornadaFinalizada && (
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <Activity className="h-4 w-4" />
                                ¿Qué estás haciendo ahora?
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Textarea
                                placeholder="Ej: Estoy diseñando piezas para la campaña de mayo…"
                                value={actividadActual}
                                onChange={(e) => setActividadActual(e.target.value)}
                                className="resize-none min-h-[90px] text-sm"
                                maxLength={300}
                            />
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">
                                    {actividadActual.length}/300 caracteres
                                </span>
                                <Button
                                    size="sm"
                                    onClick={handleGuardarActividad}
                                    disabled={enviandoActividad || !actividadActual.trim()}
                                >
                                    {enviandoActividad ? (
                                        <Spinner className="mr-2 h-3 w-3" />
                                    ) : (
                                        <Send className="mr-2 h-3 w-3" />
                                    )}
                                    Actualizar actividad
                                </Button>
                            </div>
                            {registroHoy?.ultimaActividad && (
                                <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 border">
                                    <span className="font-medium text-foreground">Última registrada: </span>
                                    {registroHoy.ultimaActividad}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* ── datos del registro guardado ──────────────────────────────────── */}
                {registroHoy && (
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4" />
                                Resumen del registro
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                {[
                                    { label: "Empleado", val: registroHoy.nombre },
                                    { label: "Cargo", val: registroHoy.cargo || "—" },
                                    { label: "Modo", val: registroHoy.modoTrabajo === "teletrabajo" ? "🏠 Remoto" : "🏢 Presencial" },
                                    { label: "Entrada", val: formatearHora(registroHoy.horaEntrada) },
                                    { label: "Sal. almuerzo", val: formatearHora(registroHoy.horaSalidaAlmuerzo) },
                                    { label: "Reg. almuerzo", val: formatearHora(registroHoy.horaEntradaAlmuerzo) },
                                    { label: "Salida", val: formatearHora(registroHoy.horaSalida) },
                                    {
                                        label: "WiFi validado",
                                        val: registroHoy.wifiValidado ? "✅ Sí" : "❌ No",
                                    },
                                ].map((item) => (
                                    <div key={item.label} className="bg-muted/40 rounded-lg px-3 py-2">
                                        <p className="text-xs text-muted-foreground">{item.label}</p>
                                        <p className="font-medium text-foreground truncate">{item.val}</p>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                <p className="text-center text-xs text-muted-foreground pb-4">
                    Fundación Isla Cascajal · Sistema de Asistencia
                </p>
            </main>
        </div>
    );
}
