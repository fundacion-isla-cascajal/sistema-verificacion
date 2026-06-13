import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export async function POST(request) {
  try {
    // PayU envía los datos en formato de formulario (urlencoded)
    const formData = await request.formData();
    
    const state_pol = formData.get('state_pol');
    const extra1 = formData.get('extra1'); // Aquí nos llega el ID de Firebase oculto
    const email_buyer = formData.get('email_buyer');

    // state_pol === '4' significa "Aprobada" en el lenguaje de PayU
    if (state_pol === '4' && extra1) {
      // 1. Buscar al afiliado en la base de datos
      const afiliadoRef = doc(db, "afiliados", extra1);
      const afiliadoSnap = await getDoc(afiliadoRef);
      
      if (afiliadoSnap.exists()) {
        const data = afiliadoSnap.data();
        let membresiasActualizadas = data.membresias || [];
        
        // 2. Activar membresías con plazos diferenciados
        membresiasActualizadas = membresiasActualizadas.map(m => {
          const hoy = new Date();
          let nuevaExpiracion = new Date(hoy);
          
          if (m.tipo === 'educativa') {
            const mes = hoy.getMonth();
            const year = hoy.getFullYear();
            if (mes >= 0 && mes <= 4) {
              nuevaExpiracion = new Date(year, 4, 30); // 30 de Mayo
            } else if (mes >= 5 && mes <= 10) {
              nuevaExpiracion = new Date(year, 10, 30); // 30 de Noviembre
            } else {
              nuevaExpiracion = new Date(year + 1, 4, 30); // 30 de Mayo del próximo año
            }
          } else {
            nuevaExpiracion.setFullYear(hoy.getFullYear() + 1); // 1 año para integral
          }
          
          return {
            ...m,
            estado: 'activa',
            fechaInicio: hoy.toISOString(),
            fechaExpiracion: nuevaExpiracion.toISOString()
          };
        });

        // 2.5 Guardar la Memoria Contable (Historial)
        const nuevoPago = {
          fecha: new Date().toISOString(),
          monto: formData.get('value') || "Valor No Reportado",
          referencia: formData.get('reference_sale') || "Referencia Interna",
          concepto: "Afiliación / Renovación de Membresías FICong"
        };
        const historialPagosActualizado = data.historialPagos ? [...data.historialPagos, nuevoPago] : [nuevoPago];

        // 3. Guardar en Firebase
        await setDoc(afiliadoRef, {
          estado: "activo",
          membresias: membresiasActualizadas,
          historialPagos: historialPagosActualizado,
          fechaUltimoPago: new Date().toISOString()
        }, { merge: true });

        // 4. Enviar Correo Automático vía Resend
        const resendApiKey = process.env.RESEND_API_KEY;
        
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h1 style="color: #05318a; margin: 0;">Fundación Isla Cascajal</h1>
              <p style="color: #64748b; margin-top: 5px;">Membresía Activada Exitosamente</p>
            </div>
            
            <p>Hola <strong>${data.nombre}</strong>,</p>
            <p>Hemos recibido tu confirmación de pago correctamente. Tu membresía en la Fundación Isla Cascajal ha sido activada y renovada.</p>
            
            <div style="background-color: #f1f5f9; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #475569;">Tu Código Institucional de Acceso es:</p>
              <h2 style="color: #ea580c; margin: 10px 0 0 0; letter-spacing: 2px;">${data.codigoInstitucional}</h2>
            </div>
            
            <p>Ya puedes ingresar nuevamente a tu panel de afiliado para descargar tus avales y certificados actualizados.</p>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="https://fundacion.islacascajal.org/afiliado" style="background-color: #0e6235; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Ingresar a mi Panel</a>
            </div>
          </div>
        `;

        try {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: "Fundación Isla Cascajal <info@islacascajal.org>",
              to: email_buyer || data.correo,
              subject: "¡Tu membresía ha sido activada! - Fundación Isla Cascajal",
              html: emailHtml
            })
          });
        } catch (emailError) {
          console.error("Error al enviar el correo, pero el usuario sí se activó:", emailError);
        }
      }
    }

    // Siempre hay que responderle 200 OK a PayU o intentará reenviar el mensaje
    return NextResponse.json({ status: "recibido" }, { status: 200 });
  } catch (error) {
    console.error("Error en el webhook de PayU:", error);
    return NextResponse.json({ error: "Error procesando la notificación" }, { status: 500 });
  }
}
