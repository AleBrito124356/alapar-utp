/* =====================================================================
   datos.js — Datos de la plataforma A la Par
   En el Proyecto N.º 2 esta información vendrá de la base de datos.
   Por ahora vive aquí para que el sitio funcione sin servidor.
   ===================================================================== */
"use strict";

const DATOS = {
  /* Áreas académicas por las que se agrupan las materias */
  areas: [
    { id: "basicas", nombre: "Ciencias Básicas", corto: "Básicas" },
    { id: "fisc", nombre: "Sistemas Computacionales", corto: "FISC" },
    { id: "industrial", nombre: "Ingeniería Industrial", corto: "Industrial" },
    { id: "electrica", nombre: "Ingeniería Eléctrica", corto: "Eléctrica" },
    { id: "civil", nombre: "Ingeniería Civil", corto: "Civil" },
    { id: "mecanica", nombre: "Ingeniería Mecánica", corto: "Mecánica" }
  ],

  /* Materias: demanda va de 1 (baja) a 5 (máxima) */
  materias: [
    { codigo: "CAL-1", nombre: "Cálculo I", area: "basicas", semestre: 1, tutores: 14, demanda: 5, temas: ["Límites", "Derivadas", "Optimización"] },
    { codigo: "CAL-2", nombre: "Cálculo II", area: "basicas", semestre: 2, tutores: 11, demanda: 5, temas: ["Integrales", "Series", "Coordenadas polares"] },
    { codigo: "CAL-3", nombre: "Cálculo III", area: "basicas", semestre: 3, tutores: 6, demanda: 4, temas: ["Varias variables", "Integrales múltiples", "Gradiente"] },
    { codigo: "FIS-1", nombre: "Física I", area: "basicas", semestre: 2, tutores: 9, demanda: 5, temas: ["Cinemática", "Dinámica", "Energía"] },
    { codigo: "FIS-2", nombre: "Física II", area: "basicas", semestre: 3, tutores: 7, demanda: 4, temas: ["Electrostática", "Circuitos", "Magnetismo"] },
    { codigo: "QUI-1", nombre: "Química General", area: "basicas", semestre: 1, tutores: 5, demanda: 3, temas: ["Estequiometría", "Enlace químico", "Gases"] },
    { codigo: "ALG-1", nombre: "Álgebra Lineal", area: "basicas", semestre: 2, tutores: 6, demanda: 3, temas: ["Matrices", "Determinantes", "Espacios vectoriales"] },
    { codigo: "ECU-1", nombre: "Ecuaciones Diferenciales", area: "basicas", semestre: 4, tutores: 5, demanda: 4, temas: ["EDO de primer orden", "Laplace", "Sistemas lineales"] },
    { codigo: "EST-1", nombre: "Probabilidad y Estadística", area: "basicas", semestre: 4, tutores: 8, demanda: 3, temas: ["Distribuciones", "Inferencia", "Regresión"] },

    { codigo: "PRO-1", nombre: "Programación I", area: "fisc", semestre: 1, tutores: 12, demanda: 5, temas: ["Algoritmos", "Estructuras de control", "Funciones"] },
    { codigo: "PRO-2", nombre: "Programación II", area: "fisc", semestre: 2, tutores: 9, demanda: 4, temas: ["POO", "Herencia", "Colecciones"] },
    { codigo: "EDD-1", nombre: "Estructuras de Datos", area: "fisc", semestre: 3, tutores: 7, demanda: 5, temas: ["Listas", "Árboles", "Grafos"] },
    { codigo: "BDD-1", nombre: "Bases de Datos I", area: "fisc", semestre: 4, tutores: 6, demanda: 4, temas: ["Modelo relacional", "SQL", "Normalización"] },
    { codigo: "ARQ-1", nombre: "Arquitectura de Computadoras", area: "fisc", semestre: 4, tutores: 3, demanda: 2, temas: ["Ensamblador", "Memoria caché", "Pipeline"] },
    { codigo: "RED-1", nombre: "Redes I", area: "fisc", semestre: 5, tutores: 4, demanda: 3, temas: ["Modelo OSI", "Subnetting", "Enrutamiento"] },
    { codigo: "SOP-1", nombre: "Sistemas Operativos", area: "fisc", semestre: 5, tutores: 3, demanda: 3, temas: ["Procesos", "Memoria", "Planificación"] },
    { codigo: "LFA-1", nombre: "Lenguajes Formales y Autómatas", area: "fisc", semestre: 5, tutores: 3, demanda: 4, temas: ["Autómatas", "Gramáticas", "Expresiones regulares"] },
    { codigo: "ISW-1", nombre: "Ingeniería de Software", area: "fisc", semestre: 6, tutores: 4, demanda: 2, temas: ["Requisitos", "UML", "Metodologías ágiles"] },
    { codigo: "WEB-1", nombre: "Ingeniería Web", area: "fisc", semestre: 6, tutores: 5, demanda: 4, temas: ["HTML5 y CSS3", "JavaScript", "PHP y MySQL"] },

    { codigo: "CON-1", nombre: "Contabilidad General", area: "industrial", semestre: 2, tutores: 3, demanda: 2, temas: ["Asientos", "Estados financieros"] },
    { codigo: "IOP-1", nombre: "Investigación de Operaciones", area: "industrial", semestre: 5, tutores: 4, demanda: 4, temas: ["Programación lineal", "Método simplex", "Transporte"] },
    { codigo: "IEC-1", nombre: "Ingeniería Económica", area: "industrial", semestre: 5, tutores: 4, demanda: 3, temas: ["Valor del dinero en el tiempo", "TIR y VAN", "Depreciación"] },
    { codigo: "CCA-1", nombre: "Control de Calidad", area: "industrial", semestre: 6, tutores: 2, demanda: 2, temas: ["Gráficos de control", "Muestreo", "Six Sigma"] },

    { codigo: "CIR-1", nombre: "Circuitos I", area: "electrica", semestre: 3, tutores: 5, demanda: 4, temas: ["Leyes de Kirchhoff", "Thévenin y Norton", "Nodos y mallas"] },
    { codigo: "CIR-2", nombre: "Circuitos II", area: "electrica", semestre: 4, tutores: 3, demanda: 3, temas: ["Corriente alterna", "Fasores", "Potencia"] },
    { codigo: "ELE-1", nombre: "Electrónica I", area: "electrica", semestre: 5, tutores: 3, demanda: 3, temas: ["Diodos", "Transistores BJT", "Amplificadores"] },
    { codigo: "SYS-1", nombre: "Señales y Sistemas", area: "electrica", semestre: 5, tutores: 2, demanda: 3, temas: ["Convolución", "Fourier", "Laplace"] },

    { codigo: "ESTA-1", nombre: "Estática", area: "civil", semestre: 3, tutores: 4, demanda: 4, temas: ["Equilibrio", "Armaduras", "Centroides"] },
    { codigo: "RMA-1", nombre: "Resistencia de Materiales", area: "civil", semestre: 4, tutores: 3, demanda: 4, temas: ["Esfuerzo y deformación", "Flexión", "Torsión"] },
    { codigo: "TOP-1", nombre: "Topografía", area: "civil", semestre: 3, tutores: 2, demanda: 2, temas: ["Nivelación", "Poligonales", "Curvas de nivel"] },
    { codigo: "HID-1", nombre: "Hidráulica", area: "civil", semestre: 6, tutores: 2, demanda: 3, temas: ["Flujo en tuberías", "Canales abiertos", "Bombas"] },

    { codigo: "DIB-1", nombre: "Dibujo Técnico", area: "mecanica", semestre: 1, tutores: 5, demanda: 2, temas: ["Vistas", "Acotado", "AutoCAD"] },
    { codigo: "TER-1", nombre: "Termodinámica", area: "mecanica", semestre: 4, tutores: 4, demanda: 4, temas: ["Primera ley", "Ciclos", "Entropía"] },
    { codigo: "FLU-1", nombre: "Mecánica de Fluidos", area: "mecanica", semestre: 5, tutores: 3, demanda: 3, temas: ["Bernoulli", "Pérdidas de carga", "Flujo viscoso"] }
  ],

  /* Tutores. precio 0 = intercambio de materias (sin dinero) */
  tutores: [
    {
      id: "maria-castillo", nombre: "María Fernanda Castillo", carrera: "Ing. de Sistemas y Computación", area: "fisc", semestre: 7,
      materias: ["CAL-2", "PRO-2", "EDD-1"], calificacion: 4.9, sesiones: 86, precio: 6,
      modalidades: ["presencial", "virtual"], disponibleHoy: true, horario: "Lun a Jue, 2:00 a 6:00 p. m.",
      foto: "assets/img/tutores/maria-castillo.webp",
      frase: "Explico como me hubiera gustado que me explicaran en segundo semestre.",
      bio: "Monitora de Programación II durante dos semestres. Le gusta empezar por el problema del parcial y devolverse a la teoría solo cuando hace falta."
    },
    {
      id: "jose-pimentel", nombre: "José Luis Pimentel", carrera: "Ing. Industrial", area: "industrial", semestre: 8,
      materias: ["EST-1", "IOP-1", "IEC-1"], calificacion: 4.8, sesiones: 64, precio: 5,
      modalidades: ["presencial", "virtual"], disponibleHoy: false, horario: "Mar y Jue, 5:00 a 8:00 p. m.",
      foto: "assets/img/tutores/jose-pimentel.webp",
      frase: "Estadística deja de asustar cuando la conectas con un problema real.",
      bio: "Hizo práctica profesional en logística portuaria. Arma guías de ejercicios propias para cada parcial."
    },
    {
      id: "ana-rios", nombre: "Ana Gabriela Ríos", carrera: "Ing. Eléctrica y Electrónica", area: "electrica", semestre: 6,
      materias: ["FIS-2", "CIR-1", "CIR-2"], calificacion: 5.0, sesiones: 52, precio: 0,
      modalidades: ["presencial"], disponibleHoy: true, horario: "Lun, Mié y Vie por la mañana",
      foto: "assets/img/tutores/ana-rios.webp",
      frase: "Yo doy Circuitos y recibo Programación. Así funciona el intercambio.",
      bio: "Miembro de la rama estudiantil de IEEE. Prefiere las sesiones con protoboard en mano."
    },
    {
      id: "kevin-rodriguez", nombre: "Kevin Rodríguez", carrera: "Lic. en Redes Informáticas", area: "fisc", semestre: 6,
      materias: ["RED-1", "SOP-1", "ARQ-1"], calificacion: 4.7, sesiones: 41, precio: 5,
      modalidades: ["virtual"], disponibleHoy: false, horario: "Fines de semana",
      foto: "assets/img/tutores/kevin-rodriguez.webp",
      frase: "Subnetting se aprende haciendo veinte ejercicios, no leyendo veinte páginas.",
      bio: "Certificación CCNA en curso. Comparte laboratorios de Packet Tracer listos para practicar."
    },
    {
      id: "daniela-chen", nombre: "Daniela Chen", carrera: "Ing. Civil", area: "civil", semestre: 7,
      materias: ["ESTA-1", "RMA-1", "CAL-3"], calificacion: 4.9, sesiones: 73, precio: 8,
      modalidades: ["presencial", "virtual"], disponibleHoy: true, horario: "Lun a Vie, 4:00 a 7:00 p. m.",
      foto: "assets/img/tutores/daniela-chen.webp",
      frase: "Un diagrama de cuerpo libre bien hecho resuelve la mitad del problema.",
      bio: "Índice académico entre los más altos de su promoción. Paciente con quienes vienen de arrastre."
    },
    {
      id: "luis-batista", nombre: "Luis Ángel Batista", carrera: "Ing. Mecánica", area: "mecanica", semestre: 5,
      materias: ["TER-1", "FIS-1", "DIB-1"], calificacion: 4.8, sesiones: 38, precio: 6,
      modalidades: ["presencial", "virtual"], disponibleHoy: true, horario: "Mar a Sáb, tardes",
      foto: "assets/img/tutores/luis-batista.webp",
      frase: "Termodinámica es contabilidad de energía; una vez lo ves así, fluye.",
      bio: "Participa en el equipo de vehículo Baja SAE. Explica con ejemplos de motores reales."
    },
    {
      id: "gabriel-samaniego", nombre: "Gabriel Samaniego", carrera: "Ing. de Sistemas y Computación", area: "fisc", semestre: 8,
      materias: ["PRO-1", "BDD-1", "WEB-1"], calificacion: 4.6, sesiones: 29, precio: 5,
      modalidades: ["virtual"], disponibleHoy: true, horario: "Noches, después de 7:00 p. m.",
      foto: null,
      frase: "Con SQL, primero dibuja las tablas en papel. Después escribe la consulta.",
      bio: "Desarrollador junior a medio tiempo. Revisa código en vivo compartiendo pantalla."
    },
    {
      id: "valeria-quintero", nombre: "Valeria Quintero", carrera: "Ing. Industrial", area: "basicas", semestre: 4,
      materias: ["CAL-1", "QUI-1", "ALG-1"], calificacion: 4.7, sesiones: 33, precio: 0,
      modalidades: ["presencial"], disponibleHoy: false, horario: "Mié y Vie, 10:00 a. m. a 1:00 p. m.",
      foto: null,
      frase: "Cálculo I se gana en las primeras cuatro semanas. Ahí hay que estar.",
      bio: "Fue asistente del programa de nivelación de primer ingreso. Intercambia por Ingeniería Económica."
    },
    {
      id: "andres-tejada", nombre: "Andrés Tejada", carrera: "Ing. Eléctrica y Electrónica", area: "electrica", semestre: 7,
      materias: ["ELE-1", "SYS-1", "ECU-1"], calificacion: 4.8, sesiones: 47, precio: 7,
      modalidades: ["presencial", "virtual"], disponibleHoy: false, horario: "Lun a Jue, 6:00 a 9:00 p. m.",
      foto: null,
      frase: "Fourier deja de ser magia cuando graficas las señales tú mismo.",
      bio: "Usa simulaciones en Python para que cada concepto se vea antes de calcularse."
    }
  ],

  /* Testimonios de estudiantes (nombres ficticios) */
  testimonios: [
    { nombre: "Carlos M.", detalle: "Ing. de Sistemas, 3.er semestre", materia: "Cálculo II", color: "#fff9d6", rotacion: -1.4,
      texto: "Pasé Cálculo II después de dos intentos. La diferencia fue que me explicaron con ejercicios del mismo estilo del parcial de mi profesora." },
    { nombre: "Fernando R.", detalle: "Ing. Eléctrica, 5.º semestre", materia: "Programación II", color: "#e8f0ff", rotacion: 1.1,
      texto: "Yo doy tutorías de Circuitos y a cambio recibo de Programación. Sin pagar nada: puro intercambio entre panas." },
    { nombre: "Stephanie P.", detalle: "Ing. Industrial, 4.º semestre", materia: "Estadística", color: "#ffe6ec", rotacion: -0.7,
      texto: "Agendé un domingo por la noche y el lunes ya tenía sesión virtual. El parcial era el martes y lo saqué." },
    { nombre: "Diego S.", detalle: "Tutor de Física I", materia: "Física I", color: "#e6f6ec", rotacion: 1.6,
      texto: "Como tutor gané soltura explicando y algo para el pasaje. Se aprende el doble cuando enseñas." },
    { nombre: "Yaritza C.", detalle: "Ing. Civil, 4.º semestre", materia: "Estática", color: "#fff9d6", rotacion: -1.1,
      texto: "Lo mejor es que son estudiantes que llevaron la materia con el mismo profesor hace un semestre. Saben exactamente qué se evalúa." }
  ],

  /* Preguntas frecuentes */
  preguntas: [
    { pregunta: "¿Cuánto cuesta una tutoría?", respuesta: "Cada tutor fija su tarifa, normalmente entre $5 y $8 por hora, y desde 4 horas pagadas en una misma reserva se aplica un 10 % de descuento. También existe la modalidad de intercambio: tú das una materia que dominas y recibes otra, sin dinero de por medio. El pago se hace al tutor al terminar cada sesión, nunca por adelantado." },
    { pregunta: "¿Quién puede ser tutor?", respuesta: "Cualquier estudiante activo de la UTP que haya aprobado la materia con buena calificación. Antes de publicar su perfil hacemos una entrevista corta y verificamos que sigue matriculado." },
    { pregunta: "¿Las sesiones son presenciales o virtuales?", respuesta: "Las dos. Presenciales en el campus (biblioteca, cafetería, aulas libres) o virtuales por videollamada. Cada tutor indica qué modalidades ofrece." },
    { pregunta: "¿Cómo agendo una sesión?", respuesta: "Eliges al tutor, añades al carrito la materia, la modalidad y las horas, y confirmas la reserva con tu disponibilidad. El tutor te escribe por correo o WhatsApp en menos de 24 horas para fijar el día. Si antes quieres preguntar algo, usa el formulario de contacto." },
    { pregunta: "¿Y si la tutoría no me sirvió?", respuesta: "Puedes calificar la sesión al terminar. Si fue tu primera sesión con ese tutor y no quedaste conforme, te asignamos otro tutor sin costo adicional." },
    { pregunta: "¿Esto es un servicio oficial de la UTP?", respuesta: "No. A la Par es una iniciativa estudiantil desarrollada como proyecto de la asignatura Ingeniería Web. No tiene vínculo oficial con la universidad." }
  ],

  /* Cifras de la plataforma que se animan al entrar en pantalla */
  estadisticas: [
    { valor: 128, sufijo: "", texto: "tutores verificados en seis facultades" },
    { valor: 2340, sufijo: "+", texto: "sesiones realizadas desde el primer semestre" },
    { valor: 34, sufijo: "", texto: "materias cubiertas, de Cálculo I a Ingeniería Web" },
    { valor: 4.8, sufijo: "", decimales: 1, texto: "calificación promedio de las sesiones" }
  ]
};
