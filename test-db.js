import { adminDb } from "./lib/firebase-admin.js";

async function run() {
  const users = await adminDb.collection("usuarios").get();
  console.log("Usuarios:");
  users.forEach(doc => {
    const data = doc.data();
    console.log(`- ${data.correo} | rol: ${data.rol} | empleadoId: ${data.empleadoId}`);
  });

  const emp = await adminDb.collection("empleados").get();
  console.log("\nEmpleados:");
  emp.forEach(doc => {
    const data = doc.data();
    console.log(`- ${data.correoLogin} | id: ${doc.id} | uidAuth: ${data.uidAuth}`);
  });
}

run();
