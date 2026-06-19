import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import admin from 'firebase-admin';

export async function POST(request) {
  try {
    const { codigoReferidor, afiliadoNuevo } = await request.json();
    if (!codigoReferidor || !afiliadoNuevo) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
    }

    const snapshot = await adminDb.collection("afiliados")
      .where("codigoInstitucional", "==", codigoReferidor.trim().toUpperCase())
      .limit(1)
      .get();

    if (!snapshot.empty) {
      const referrerDoc = snapshot.docs[0];
      await referrerDoc.ref.update({
        referidosExitosos: admin.firestore.FieldValue.increment(1),
        listaReferidos: admin.firestore.FieldValue.arrayUnion({
          nombre: afiliadoNuevo.nombre.trim(),
          cedula: afiliadoNuevo.cedula.trim(),
          fecha: new Date().toISOString()
        })
      });
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: 'Referidor no encontrado' });
    }
  } catch (error) {
    console.error("Error al actualizar referidor:", error);
    return NextResponse.json({ error: 'Error interno del servidor al actualizar' }, { status: 500 });
  }
}
