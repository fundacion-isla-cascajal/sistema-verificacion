import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(request) {
  try {
    const { codigoReferidor } = await request.json();
    if (!codigoReferidor) {
      return NextResponse.json({ error: 'Falta el código referidor' }, { status: 400 });
    }

    const snapshot = await adminDb.collection("afiliados")
      .where("codigoInstitucional", "==", codigoReferidor.trim().toUpperCase())
      .limit(1)
      .get();

    if (!snapshot.empty) {
      const data = snapshot.docs[0].data();
      return NextResponse.json({ success: true, nombre: data.nombre });
    } else {
      return NextResponse.json({ success: false, error: 'El código no existe' });
    }
  } catch (error) {
    console.error("Error al verificar referidor:", error);
    return NextResponse.json({ error: 'Error interno del servidor al verificar' }, { status: 500 });
  }
}
