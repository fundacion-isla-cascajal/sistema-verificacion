import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(request) {
  try {
    const { cedula } = await request.json();
    if (!cedula) {
      return NextResponse.json({ error: 'Falta la cédula' }, { status: 400 });
    }

    const snapshot = await adminDb.collection("afiliados")
      .where("cedula", "==", cedula.trim())
      .limit(1)
      .get();

    if (!snapshot.empty) {
      return NextResponse.json({ exists: true });
    } else {
      return NextResponse.json({ exists: false });
    }
  } catch (error) {
    console.error("Error al verificar cédula:", error);
    return NextResponse.json({ error: 'Error interno del servidor al verificar' }, { status: 500 });
  }
}
