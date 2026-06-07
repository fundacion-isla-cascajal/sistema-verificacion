export const helpCategories = [
  {
    id: "personal",
    title: "Gestión de Personal",
    description: "Todo lo relacionado con empleados y recursos humanos.",
    items: [
      {
        question: "¿Cómo genero el Carnet o el Certificado Laboral?",
        answer: "Ve a 'Directorio de Personal'. En la tabla, al final de la fila del empleado:\n\n➤ Para el Carnet: Haz clic en el botón verde claro con el ícono de 'Código QR'.\n➤ Para el Certificado: Haz clic en el botón verde con el ícono de 'Archivo de Texto'.\n\nEl sistema descargará automáticamente la imagen generada lista para imprimir o enviar."
      },
      {
        question: "¿Cómo modifico el Salario o la Información de un empleado?",
        answer: "En la tabla de personal, haz clic en el botón amarillo con el ícono de 'Lápiz' (Editar). Modifica los campos que necesites. En el campo de 'Salario', solo escribe los números, el sistema añadirá automáticamente el símbolo de peso ($) y los puntos de miles."
      },
      {
        question: "¿Puedo cambiar el Número de Documento (NIUP) si me equivoqué?",
        answer: "Sí. Al hacer clic en 'Editar' (ícono de Lápiz), verás el campo de Documento bloqueado por seguridad. Justo arriba dice 'Modificar NIUP' en color naranja. Haz clic ahí, confirma la advertencia, y el sistema te permitirá corregir el número."
      },
      {
        question: "¿Cómo funciona la gestión de Horarios?",
        answer: "Haz clic en el botón con ícono de 'Calendario' en la fila del empleado. Se abrirá una ventana donde podrás asignar sus días laborales y el horario de entrada/salida de forma semanal."
      },
      {
        question: "¿Cómo registro una amonestación o memorando?",
        answer: "Haz clic en 'Editar' (ícono de Lápiz) sobre el empleado. Baja hasta la sección 'Anotaciones de Memorando'. Tienes tres (3) espacios disponibles. Escribe allí el motivo o la fecha de la sanción. Esta etiqueta roja aparecerá bajo su nombre en la tabla principal."
      },
      {
        question: "¿Cuál es la diferencia entre el botón de Inhabilitar y el de Eliminar?",
        answer: "➤ Botón de Encendido (Inhabilitar): Bloquea el acceso del usuario al sistema y lo marca como 'Bloqueado', pero conserva todo su historial intacto.\n\n➤ Botón de Basura Roja (Eliminar): Borra permanentemente toda la información de esa persona de la base de datos. Úsalo solo si creaste el registro por error."
      }
    ]
  },
  {
    id: "afiliados",
    title: "Afiliados y Voluntarios",
    description: "Gestión de usuarios externos a la fundación.",
    items: [
      {
        question: "¿Cómo funciona la tabla de Afiliados?",
        answer: "En el menú Dashboard, verás la tabla de Afiliados. Allí puedes registrar nuevos participantes. Al igual que el personal, tienen su propio botón para descargar su Carnet de Afiliado (ícono de QR)."
      },
      {
        question: "¿Qué pasa si elimino un afiliado?",
        answer: "Al hacer clic en el ícono de basura y confirmar, el registro se borra permanentemente de la nube. Ten cuidado de no confundirlo con el botón de Desactivar (que solo le quita la membresía activa)."
      }
    ]
  },
  {
    id: "documentos",
    title: "Gestión de Documentos",
    description: "Administración de archivos y vencimientos.",
    items: [
      {
        question: "¿Qué significa que un documento tenga fecha 'Indefinida'?",
        answer: "Al crear o editar un documento, puedes marcar la casilla 'Vigencia Indefinida'. Esto le dice al escáner de QR que este documento nunca caduca (como un NIT o un Acta de Constitución). Si desmarcas la casilla, el sistema te pedirá una fecha de expiración."
      },
      {
        question: "¿Por qué al escanear el QR sale 'Documento Vencido'?",
        answer: "La pantalla de verificación del sistema calcula automáticamente la fecha actual contra la 'Fecha de Expiración' que le pusiste al documento. Si la fecha ya pasó, el código QR arrojará una alerta roja de vencimiento."
      }
    ]
  },
  {
    id: "general",
    title: "Dudas Generales",
    description: "Configuración y seguridad global.",
    items: [
      {
        question: "¿Qué pasa si veo datos antiguos en la tabla?",
        answer: "Si eliminaste o cambiaste a alguien y aún ves el dato anterior, haz clic en el botón superior de 'Recargar' (ícono de flechas circulares) o usa el atajo de teclado Ctrl + Shift + R. Esto limpia la memoria caché y trae la información fresca de la base de datos."
      },
      {
        question: "¿Por qué no me deja ver la sección de Personal?",
        answer: "El sistema bloquea el acceso si tu Rol es de 'Empleado' básico. Solo los usuarios con rol de 'Súper Administrador' o 'Recursos Humanos' pueden ver y modificar la nómina y los accesos."
      }
    ]
  }
];
