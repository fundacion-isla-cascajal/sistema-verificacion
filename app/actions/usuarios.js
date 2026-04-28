"use server";

import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function crearUsuarioInstitucional(data) {
  try {
    const { correo, password, nombre, rol, empleadoId, creadoPorUid } = data;

    // 1. Crear usuario en Firebase Auth
    const userRecord = await adminAuth.createUser({
      email: correo,
      password: password,
      displayName: nombre,
    });

    // 2. Crear documento en colección 'usuarios'
    const usuarioRef = adminDb.collection("usuarios").doc(userRecord.uid);
    await usuarioRef.set({
      uid: userRecord.uid,
      correo: correo,
      nombre: nombre,
      rol: rol,
      activo: true,
      empleadoId: empleadoId || null,
      creadoPor: creadoPorUid,
      fechaCreacion: FieldValue.serverTimestamp(),
    });

    // 3. Si hay empleado vinculado, actualizar ese empleado
    if (empleadoId) {
      const empleadoRef = adminDb.collection("empleados").doc(empleadoId);
      await empleadoRef.update({
        uidAuth: userRecord.uid,
        correoLogin: correo,
        rolSistema: rol,
      });
    }

    return { success: true, uid: userRecord.uid };
  } catch (error) {
    console.error("Error en crearUsuarioInstitucional:", error);
    return { success: false, error: error.message };
  }
}
