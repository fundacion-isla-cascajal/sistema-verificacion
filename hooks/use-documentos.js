"use client";

import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import useSWR from "swr";

async function fetchDocumentos() {
  const snap = await getDocs(collection(db, "documentos"));
  const documentos = [];
  
  snap.forEach((doc) => {
    documentos.push({
      codigo: doc.id,
      ...doc.data(),
    });
  });

  return documentos.sort((a, b) => 
    new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  );
}

export function useDocumentos() {
  const { data, error, isLoading, mutate } = useSWR(
    "documentos",
    fetchDocumentos,
    {
      revalidateOnFocus: false,
    }
  );

  const eliminarDocumento = async (codigo) => {
    await deleteDoc(doc(db, "documentos", codigo));
    mutate();
  };

  return {
    documentos: data || [],
    isLoading,
    error,
    mutate,
    eliminarDocumento,
  };
}
