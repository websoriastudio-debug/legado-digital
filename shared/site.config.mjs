// Configuración central de Legado Digital.
// Todo lo que el propietario debe poder cambiar sin tocar las pantallas vive aquí.

export const brand = {
  name: 'Legado Digital',
  logo: {
    alt: 'Legado Digital',
    full: '/assets/logo/legado-digital-original.webp',
    full720: '/assets/logo/legado-digital-720.webp',
    mark: '/assets/logo/monograma-144.webp',
    markLarge: '/assets/logo/monograma-560.webp',
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
  legalPages: { terms: '/legal/terminos', privacy: '/legal/privacidad' },
  firstReferrerRuleConfirmed: false,
};

// Pon la dirección de cada perfil en `url`: sin dirección, el icono se ve como «Próximamente» y no enlaza.
export const socials = [
  { id: 'instagram', name: 'Instagram', url: null },
  { id: 'tiktok', name: 'TikTok', url: null },
  { id: 'facebook', name: 'Facebook', url: null },
  { id: 'youtube', name: 'YouTube', url: null },
];

// Tarjetas que se muestran como aceptadas: visa, mastercard, amex, diners. Quita las que no se acepten.
export const acceptedCards = ['visa', 'mastercard', 'amex', 'diners'];

// Datos de las páginas legales. Lo que siga en null se muestra como «Por confirmar».
// `reviewed: true` retira el aviso de borrador, una vez revisado por un abogado.
export const legal = {
  version: '2026-11-02',
  updated: '2 de noviembre de 2026',
  reviewed: false,
  owner: null,
  taxId: null,
  address: null,
  email: null,
  providers: null,
  retention: null,
  accessTerm: null,
  refundWindow: null,
  refundCases: null,
  commissions: null,
  licenseTerm: null,
};

// Pagos. Lo que siga en null no se anuncia ni se cobra; las claves secretas van en variables de entorno.
export const payments = {
  card: {
    enabled: false, // true solo con la pasarela integrada en el servidor.
    provider: null,
    absorbedBy: null, // 'legado': el comprador paga el precio informado. 'comprador': se aplica buyerFee.
    // Ejemplo de forma, con los datos reales del contrato: { percentBps: 0, fixedCents: 0, mode: 'sobre_base' | 'sobre_total' }
    buyerFee: null,
  },
  // Se publica una billetera solo con enabled, titular y número o QR confirmados por el propietario.
  wallets: {
    yape: { name: 'Yape', enabled: false, holder: null, number: null, qr: null },
    plin: { name: 'Plin', enabled: false, holder: null, number: null, qr: null },
  },
  walletLimitPenCents: null,
  directNoExtraFeeApproved: false, // true solo si se aprueba anunciar «sin comisión adicional de Legado Digital».
};

// Aviso periódico. kind: 'community' o 'payment'. Solo hay uno activo.
export const notice = {
  enabled: true,
  kind: 'community',
  intervalMs: 900000,
  communityUrl: null, // Sin dirección válida, el aviso de comunidad queda apagado fuera de la demostración.
};

export const PEN = (cents) => `S/ ${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;

export const USD = (cents) => `US$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: cents % 100 ? 2 : 0 })}`;

export const programs = [
  {
    slug: 'start',
    name: 'START',
    level: 'Nivel 1',
    rank: 1,
    priceCents: 5000,
    tagline: 'Aprende a comenzar en el marketing digital.',
    action: 'Elegir START',
    resale: 'START',
    features: [
      'Introducción al marketing digital.',
      'Cómo vender por internet.',
      'Cómo utilizar WhatsApp Business.',
      'Cómo crear contenido para redes sociales.',
      'Fundamentos de publicidad digital.',
      'Licencia de reventa del paquete START.',
    ],
  },
  {
    slug: 'pro',
    name: 'PRO',
    level: 'Nivel 2',
    rank: 2,
    priceCents: 10000,
    tagline: 'Aprende a vender y desarrollar una estrategia comercial.',
    action: 'Elegir PRO',
    resale: 'START y PRO',
    features: [
      'Todo el contenido de START.',
      'Marketing de contenidos.',
      'Estrategias de ventas por Instagram y TikTok.',
      'Embudos de venta.',
      'Copywriting y persuasión ética.',
      'Creación de páginas de venta.',
      'Licencias de reventa START y PRO.',
    ],
  },
  {
    slug: 'elite',
    name: 'ELITE',
    level: 'Nivel 3',
    rank: 3,
    priceCents: 20000,
    tagline: 'Formación avanzada para desarrollar un negocio digital.',
    action: 'Elegir ELITE',
    resale: 'START, PRO y ELITE',
    features: [
      'Todo el contenido de START y PRO.',
      'Publicidad digital avanzada.',
      'Automatización de ventas.',
      'Creación de productos digitales.',
      'Marca personal y posicionamiento.',
      'Analítica y optimización de campañas.',
      'Licencias de reventa START, PRO y ELITE.',
    ],
  },
];

export const comparison = [
  ['Fundamentos de marketing y ventas online', 'Sí', 'Sí', 'Sí'],
  ['WhatsApp Business y contenido para redes', 'Sí', 'Sí', 'Sí'],
  ['Instagram, TikTok y embudos', 'No', 'Sí', 'Sí'],
  ['Copywriting y páginas de venta', 'No', 'Sí', 'Sí'],
  ['Publicidad avanzada y automatización', 'No', 'No', 'Sí'],
  ['Productos digitales, marca y analítica', 'No', 'No', 'Sí'],
  ['Reventa incluida según licencia', 'START', 'START y PRO', 'START, PRO y ELITE'],
];

export const whatsappMessages = {
  general: () => 'Hola, quiero información sobre los cursos de Legado Digital.',
  plan: (p) => `Hola, me interesa el plan ${p.name} de ${USD(p.priceCents)} de Legado Digital. Quiero conocer sus características y cómo adquirirlo.`,
  upgrade: () => 'Hola, quiero consultar una actualización de mi plan de Legado Digital.',
};

export function whatsappLink(message, referralCode) {
  const text = referralCode ? `${message} Código de referido: ${referralCode}.` : message;
  return `https://wa.me/${whatsapp.number}?text=${encodeURIComponent(text)}`;
}

export const nav = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'que-aprenderas', label: 'Qué aprenderás' },
  { id: 'cursos-y-planes', label: 'Cursos y planes' },
  { id: 'como-empezar', label: 'Cómo empezar' },
  { id: 'preguntas-frecuentes', label: 'Preguntas frecuentes' },
  { id: 'contacto', label: 'Contacto' },
];

export const orderStatus = {
  pendiente_pago: 'Pendiente de pago',
  en_revision: 'En revisión',
  aprobado: 'Pago confirmado',
  rechazado: 'Rechazado',
  cancelado: 'Cancelado',
};

export const faqs = [
  { q: '¿Qué contenidos incluye cada curso?', a: 'START cubre los fundamentos de marketing digital, ventas por internet, WhatsApp Business, contenido para redes y publicidad. PRO añade marketing de contenidos, Instagram y TikTok, embudos, copywriting y páginas de venta. ELITE añade publicidad avanzada, automatización, productos digitales, marca personal y analítica.' },
  { q: '¿El pago es único?', a: 'Sí. START cuesta US$50, PRO US$100 y ELITE US$200, en un solo pago y sin cuotas mensuales.' },
  { q: '¿Cada nivel incluye a los anteriores?', a: 'Sí. PRO incluye todo START, y ELITE incluye todo START y PRO.' },
  { q: '¿Cómo accedo después de pagar?', a: 'Creas tu cuenta, confirmas tu correo, eliges tu curso y pagas. Quien recibe el dinero (tu vendedor o Legado Digital) comprueba que llegó y aprueba el pago; en ese momento se activa tu acceso y aparece tu oficina con tus cursos. Crear una cuenta, enviar un comprobante o completar el pago no abren el acceso por sí solos. Si una lección aún no está cargada, la verás indicada como en preparación.' },
  { q: '¿Puedo subir de nivel más adelante?', a: 'Sí, pagando solo la diferencia: US$50 de START a PRO, US$100 de PRO a ELITE y US$150 de START a ELITE. Conservas tu acceso actual y el nuevo se activa cuando se comprueba el pago.' },
  { q: '¿Habrá actualizaciones del contenido?', a: 'Las condiciones de actualización aún no están definidas. Consúltalas por WhatsApp antes de comprar; se publicarán aquí en cuanto estén aprobadas.' },
  { q: '¿Qué permite la licencia de reventa?', a: 'Tu nivel decide qué paquetes puedes revender: START solo START, PRO START y PRO, y ELITE los tres. Las condiciones completas y las comisiones aún no están definidas y deben consultarse antes de comprar. La licencia no garantiza ventas ni ingresos.' },
  { q: '¿Cuánto dura el acceso?', a: 'Las condiciones de duración aún no están definidas. Consúltalas por WhatsApp antes de comprar; se publicarán aquí en cuanto estén aprobadas.' },
  { q: '¿Cómo puedo pagar?', a: 'Hay dos opciones: con tarjeta en la web, en el checkout seguro del proveedor, o por WhatsApp con Yape o Plin, en soles. Antes de elegir ves el total de cada una. Mientras la pasarela no esté conectada, el pago con tarjeta aparece como pendiente.' },
  { q: '¿Por qué pueden variar los totales?', a: 'El pago con tarjeta puede llevar un cargo de procesamiento y el pago por Yape o Plin se muestra en soles según una cotización vigente. Solo mostramos una diferencia cuando está calculada y confirmada.' },
  { q: '¿Necesito experiencia previa?', a: 'No para empezar con START, que parte de los fundamentos. Si ya vendes por internet, compara el temario de cada nivel para ver dónde encaja lo que te falta.' },
  { q: '¿Tengo que registrarme para consultar?', a: 'No. Puedes ver los cursos, probar las demostraciones y escribirnos por WhatsApp sin crear una cuenta.' },
  { q: '¿Qué pasa si mi pago se rechaza?', a: 'La operación queda rechazada con una explicación y tu nivel no cambia. Puedes consultarnos por WhatsApp para resolverlo.' },
  { q: '¿Cómo cuidan mis datos?', a: 'Tu contraseña se guarda cifrada y tus comprobantes son privados. Lo explicamos en la política de privacidad, enlazada al pie de esta página.' },
  { q: '¿Hay devoluciones?', a: 'La política de devoluciones aún no está definida. Consúltala por WhatsApp antes de comprar; se publicará aquí en cuanto esté aprobada.' },
];
