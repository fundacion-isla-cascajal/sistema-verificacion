"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export function useAuth(requireAuth = true) {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [empleadoData, setEmpleadoData] = useState(null);
  const [empleadoId, setEmpleadoId] = useState(null);
  const [loading, setLoading] = useState(true);

  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setUserData(null);
        setEmpleadoData(null);
        setEmpleadoId(null);
        setLoading(false);

        // La redirección aquí solo aplica para el hook base si se requiere auth
        // Sin embargo, ProtectedRoute también maneja redirecciones más finas.
        if (requireAuth) {
          router.push("/login");
        }
        return;
      }

      try {
        setUser(firebaseUser);

        // ============================
        // BUSCAR DATOS EN COLECCION USUARIOS
        // ============================
        const userRef = doc(db, "usuarios", firebaseUser.uid);
        const userSnap = await getDoc(userRef);

        let empleadoIdVinculado = null;

        if (userSnap.exists()) {
          const ud = userSnap.data();
          setUserData(ud);
          empleadoIdVinculado = ud.empleadoId; // Si el usuario tiene empleadoId directo
        } else {
          setUserData(null);
        }

        // ============================
        // BUSCAR EMPLEADO RELACIONADO
        // ============================
        // Si el empleadoId viene en el userData lo usamos, sino buscamos por uid
        if (empleadoIdVinculado) {
          const empRef = doc(db, "empleados", empleadoIdVinculado);
          const empSnap = await getDoc(empRef);
          if (empSnap.exists()) {
            setEmpleadoId(empSnap.id);
            setEmpleadoData({ id: empSnap.id, ...empSnap.data() });
          } else {
            setEmpleadoId(null);
            setEmpleadoData(null);
          }
        } else {
          // Fallback por uidAuth o uid
          const q = query(
            collection(db, "empleados"),
            where("uidAuth", "==", firebaseUser.uid)
          );
          let querySnapshot = await getDocs(q);

          // Retrocompatibilidad con el campo "uid" anterior
          if (querySnapshot.empty) {
            const qOld = query(
              collection(db, "empleados"),
              where("uid", "==", firebaseUser.uid)
            );
            querySnapshot = await getDocs(qOld);
          }

          if (!querySnapshot.empty) {
            const empleadoDoc = querySnapshot.docs[0];
            setEmpleadoId(empleadoDoc.id);
            setEmpleadoData({
              id: empleadoDoc.id,
              ...empleadoDoc.data(),
            });
          } else {
            setEmpleadoId(null);
            setEmpleadoData(null);
          }
        }

      } catch (error) {
        console.error("Error cargando autenticación:", error);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, [requireAuth, router]);

  const logout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  return {
    user,
    userData,
    empleadoData,
    empleadoId,
    loading,
    logout,
  };
}