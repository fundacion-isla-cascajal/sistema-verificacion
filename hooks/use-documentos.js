"use client";

import { useState, useEffect } from "react";
import { collection, onSnapshot, deleteDoc, doc, updateDoc, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";

export function useDocumentos() {
  const [documentos, setDocumentos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "documentos"), orderBy("fecha", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          codigo: doc.id,
          ...doc.data(),
        }));
        setDocumentos(docs);
        setIsLoading(false);
      },
      (error) => {
        console.error("Error fetching documentos:", error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const eliminarDocumento = async (codigo) => {
    await deleteDoc(doc(db, "documentos", codigo));
  };

  // nuevoEstado: "activo" | "inactivo"
  const actualizarEstado = async (codigo, nuevoEstado) => {
    await updateDoc(doc(db, "documentos", codigo), {
      estado: nuevoEstado,
    });
  };

  return {
    documentos,
    isLoading,
    eliminarDocumento,
    actualizarEstado,
  };
}