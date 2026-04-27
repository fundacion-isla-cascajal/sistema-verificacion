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

        if (userSnap.exists()) {
          setUserData(userSnap.data());
        } else {
          setUserData(null);
        }

        // ============================
        // BUSCAR EMPLEADO RELACIONADO
        // ============================
        const q = query(
          collection(db, "empleados"),
          where("uid", "==", firebaseUser.uid)
        );

        const querySnapshot = await getDocs(q);

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