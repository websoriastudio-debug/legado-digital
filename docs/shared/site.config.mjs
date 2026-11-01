// Configuración central de Legado Digital.
// Todo lo que el propietario debe poder cambiar sin tocar las pantallas vive aquí.

export const brand = {
  name: 'Legado Digital',
  founderName: '[NOMBRE DEL FUNDADOR]',
  logo: {
    alt: 'Legado Digital',
    full: '/legado-digital/assets/logo/legado-digital-original.webp',
    full720: '/legado-digital/assets/logo/legado-digital-720.webp',
    mark: '/legado-digital/assets/logo/monograma-144.webp',
    markLarge: '/legado-digital/assets/logo/monograma-560.webp',
  },
};

export const whatsapp = {
  display: '+51 947 328 715',
  number: '51947328715',
};

// Estos ajustes siguen pendientes de decisión del propietario.
// Mientras estén en false o vacíos, la web no los anuncia.
export const pending = {
  lifetimeAccess: { preferred: true, announced: false },
  commissions: { enabled: false, note: 'Pendiente de configuración' },
  paymentMethods: [],
  socialLinks: [],
  legalPages: { terms: null, privacy: null },
  firstReferrerRuleConfirmed: false,
};

export const USD = (cents) => `US$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: cents % 100 ? 2 : 0 })}`;

export const programs = [
  {
    slug: 'esencial',
    name: 'Esencial',
    rank: 1,
    priceCents: 5000,
    tagline: 'Formación de nivel inicial.',
    lead: 'Define tu marca, ordena tu WhatsApp comercial y da tus primeros contactos.',
    action: 'Elegir Esencial',
    features: [
      'Fundamentos para definir y presentar una marca personal.',
      'Introducción a la creación de un logo y una identidad coherente.',
      'Organización de la presencia comercial en WhatsApp.',
      'Búsqueda de posibles clientes y primeros contactos.',
      'Bases de conversación comercial y seguimiento por WhatsApp.',
      'Acceso al contenido habilitado del nivel Esencial desde tu cuenta.',
      'Enlace personal de referido cuando tu compra esté validada.',
      'Permiso de reventa del plan Esencial conforme a las condiciones aprobadas.',
    ],
  },
  {
    slug: 'impulso',
    name: 'Impulso',
    rank: 2,
    priceCents: 10000,
    tagline: 'Incluye el contenido Esencial y el nivel intermedio.',
    lead: 'Suma inteligencia artificial a tu marca y a tus ventas, con un seguimiento ordenado.',
    action: 'Elegir Impulso',
    highlight: 'El punto medio entre fundamentos y estrategia',
    features: [
      'Todo el contenido del plan Esencial.',
      'Introducción práctica a la inteligencia artificial aplicada al negocio.',
      'Uso de ChatGPT para preparar ideas, mensajes y contenido comercial.',
      'Técnicas de captación y organización del seguimiento de prospectos.',
      'Aplicación conjunta de marca personal, ventas e inteligencia artificial.',
      'Acceso a los contenidos habilitados de Esencial e Impulso.',
      'Enlace personal de referido y consulta del estado de tus operaciones.',
      'Permiso de reventa de Esencial e Impulso conforme a las condiciones aprobadas.',
    ],
  },
  {
    slug: 'avanzado',
    name: 'Avanzado',
    rank: 3,
    priceCents: 20000,
    tagline: 'Incluye los niveles anteriores y un bloque de formación avanzada.',
    lead: 'Une captación, conversación y seguimiento en un solo proceso, apoyado en IA.',
    action: 'Elegir Avanzado',
    draftNote: 'El temario avanzado es una propuesta pendiente de validar.',
    features: [
      'Todo el contenido habilitado de Esencial e Impulso.',
      'Acceso al bloque de formación avanzada cuando su contenido esté preparado.',
      'Organización de un proceso completo de captación, conversación y seguimiento.',
      'Aplicación avanzada de inteligencia artificial a tareas comerciales.',
      'Preparación de una estrategia integrada de marca y ventas digitales.',
      'Acceso desde la misma cuenta a los tres niveles habilitados.',
      'Enlace personal de referido y consulta de tus operaciones.',
      'Permiso de reventa de los tres planes conforme a las condiciones aprobadas.',
    ],
  },
];

export const comparison = [
  ['Formación inicial', 'Sí', 'Sí', 'Sí'],
  ['Formación intermedia y ChatGPT', 'No', 'Sí', 'Sí'],
  ['Bloque avanzado aprobado', 'No', 'No', 'Sí'],
  ['Reventa habilitable', 'Esencial', 'Esencial e Impulso', 'Los tres planes'],
  ['Cuenta y contenido del nivel adquirido', 'Sí', 'Sí', 'Sí'],
  ['Enlace de referido tras validación', 'Sí', 'Sí', 'Sí'],
];

export const whatsappMessages = {
  general: () => 'Hola, quiero información sobre Legado Digital.',
  plan: (p) => `Hola, me interesa el plan ${p.name} de ${USD(p.priceCents)} de Legado Digital. Quiero conocer sus características y cómo adquirirlo.`,
  upgrade: () => 'Hola, quiero consultar una actualización de mi plan de Legado Digital.',
};

export function whatsappLink(message, referralCode) {
  const text = referralCode ? `${message} Código de referido: ${referralCode}.` : message;
  return `https://wa.me/${whatsapp.number}?text=${encodeURIComponent(text)}`;
}

export const nav = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'nuestra-historia', label: 'Nuestra historia' },
  { id: 'que-aprenderas', label: 'Qué aprenderás' },
  { id: 'programas', label: 'Programas' },
  { id: 'como-funciona', label: 'Cómo funciona' },
  { id: 'experiencias-y-proyectos', label: 'Experiencias y proyectos' },
  { id: 'preguntas-frecuentes', label: 'Preguntas frecuentes' },
  { id: 'contacto', label: 'Contacto' },
];

export const orderStatus = {
  pendiente_pago: 'Pendiente de pago',
  en_revision: 'En revisión',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
  cancelado: 'Cancelado',
};

// Contenido sin confirmar: se muestra marcado como pendiente, nunca como hecho.
export const story = {
  intro: 'Legado Digital nace de la experiencia de una persona real. Este espacio contará sus comienzos, lo que le costó y lo que aprendió, con sus propias palabras.',
  quote: null,
  portrait: null,
  timeline: [
    { title: 'Comienzos', text: null, hint: 'Dónde y cómo empezó todo.' },
    { title: 'Dificultades', text: null, hint: 'Lo que no salió bien y qué hizo al respecto.' },
    { title: 'Aprendizajes', text: null, hint: 'Lo que hoy haría igual y lo que cambiaría.' },
    { title: 'Hoy', text: null, hint: 'En qué trabaja ahora y por qué enseña.' },
  ],
};

// Sustituye `media` por una foto o video real y `confirmed` por true para publicarlo como hecho.
export const projects = [
  { id: 'viajes', scene: 'dusk', size: 'wide', title: 'Viajes', text: 'Lugares y experiencias que han marcado el camino del fundador.', confirmed: false, media: null },
  { id: 'proyectos', scene: 'ridge', size: 'tall', title: 'Proyectos propios', text: 'Lo que ha construido y lo que sigue en marcha.', confirmed: false, media: null },
  { id: 'mercadeo', scene: 'tide', size: 'mid', title: 'Redes de mercadeo', text: 'Un posible proyecto futuro, todavía en estudio.', confirmed: false, media: null },
];

export const faqs = [
  { q: '¿Cuánto cuestan los programas?', a: 'Esencial cuesta US$50, Impulso US$100 y Avanzado US$200.' },
  { q: '¿El pago es único?', a: 'Sí. Los tres programas se pagan una sola vez, sin cuotas mensuales.' },
  { q: '¿Cómo accedo después de pagar?', a: 'Creas tu cuenta, eliges tu programa y consultas el pago. Cuando un administrador lo valida, tu nivel se activa y entras a tus contenidos desde Mi cuenta. Crear una cuenta no da acceso por sí solo.' },
  { q: '¿En qué se diferencian los planes?', a: 'Cada plan incluye al anterior. Esencial cubre marca y WhatsApp, Impulso añade inteligencia artificial y captación, y Avanzado añade un bloque de proceso y estrategia. También cambia qué programas puedes revender.' },
  { q: '¿Puedo subir de nivel más adelante?', a: 'Sí, pagando solo la diferencia: US$50 de Esencial a Impulso, US$100 de Impulso a Avanzado y US$150 de Esencial a Avanzado. Conservas tu acceso actual y el nuevo se activa cuando se valida el pago.' },
  { q: '¿Para qué sirve el comprobante?', a: 'Sube el comprobante a tu operación para que un administrador lo revise. Enviarlo no confirma el pago: tu acceso cambia cuando la operación queda aprobada.' },
  { q: '¿Cómo funcionan los referidos?', a: 'Con tu compra validada recibes un enlace personal. Solo puedes revender los programas que permite tu nivel. Las condiciones de comisión todavía no están definidas y se publicarán aquí.' },
  { q: '¿Cuánto dura el acceso?', a: 'Las condiciones de duración aún no están definidas. Consúltalas por WhatsApp antes de comprar; se publicarán aquí en cuanto estén aprobadas.' },
  { q: '¿Hay devoluciones?', a: 'La política de devoluciones aún no está definida. Consúltala por WhatsApp antes de comprar; se publicará aquí en cuanto esté aprobada.' },
  { q: '¿Cómo me pongo en contacto?', a: 'Por WhatsApp al +51 947 328 715 o con el formulario de contacto de esta página.' },
];
