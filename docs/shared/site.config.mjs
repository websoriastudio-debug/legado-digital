// Legado Digital: catálogo de cursos aprobado por el propietario.
export const brand = {name:'Legado Digital',logo:{alt:'Legado Digital',full:'/legado-digital/assets/logo/legado-digital-original.webp',full720:'/legado-digital/assets/logo/legado-digital-720.webp',mark:'/legado-digital/assets/logo/monograma-144.webp',markLarge:'/legado-digital/assets/logo/monograma-560.webp'}};
export const whatsapp = {display:'+51 947 328 715',number:'51947328715'};
export const pending = {lifetimeAccess:{preferred:true,announced:false},commissions:{enabled:false,note:'Pendiente de configuración'},paymentMethods:[],socialLinks:[],legalPages:{terms:null,privacy:null},firstReferrerRuleConfirmed:false};
export const USD = cents => `US$${(cents/100).toLocaleString('en-US',{maximumFractionDigits:cents%100?2:0})}`;
export const programs = [
  {slug:'start',name:'START',rank:1,priceCents:5000,tagline:'Aprende a comenzar en el marketing digital.',lead:'Da tus primeros pasos: marketing digital, ventas por internet, WhatsApp Business y contenido para redes sociales.',action:'Elegir START',features:[
    'Introducción al marketing digital.',
    'Cómo vender por internet.',
    'Cómo utilizar WhatsApp Business.',
    'Cómo crear contenido para redes sociales.',
    'Fundamentos de publicidad digital.',
    'Licencia de reventa del paquete START.'
  ]},
  {slug:'pro',name:'PRO',rank:2,priceCents:10000,tagline:'Aprende a vender y desarrollar una estrategia comercial.',lead:'Suma marketing de contenidos, estrategias para Instagram y TikTok, embudos de venta y páginas de venta.',action:'Elegir PRO',features:[
    'Todo el contenido de START.',
    'Marketing de contenidos.',
    'Estrategias de ventas por Instagram y TikTok.',
    'Embudos de venta.',
    'Copywriting y persuasión ética.',
    'Creación de páginas de venta.',
    'Licencias de reventa START y PRO.'
  ]},
  {slug:'elite',name:'ELITE',rank:3,priceCents:20000,tagline:'Formación avanzada para desarrollar un negocio digital.',lead:'Profundiza en publicidad, automatización, productos digitales, posicionamiento y análisis de campañas.',action:'Elegir ELITE',features:[
    'Todo el contenido de START y PRO.',
    'Publicidad digital avanzada.',
    'Automatización de ventas.',
    'Creación de productos digitales.',
    'Marca personal y posicionamiento.',
    'Analítica y optimización de campañas.',
    'Licencias de reventa START, PRO y ELITE.'
  ]}
];
export const comparison = [
  ['Fundamentos de marketing y ventas online','Sí','Sí','Sí'],
  ['WhatsApp Business y contenido para redes','Sí','Sí','Sí'],
  ['Instagram, TikTok y embudos de venta','No','Sí','Sí'],
  ['Copywriting y páginas de venta','No','Sí','Sí'],
  ['Publicidad avanzada y automatización','No','No','Sí'],
  ['Productos digitales, marca y analítica','No','No','Sí'],
  ['Licencias de reventa','START','START y PRO','START, PRO y ELITE']
];
export const whatsappMessages = {
  general:()=> 'Hola, quiero información sobre los cursos de Legado Digital.',
  plan:p=>`Hola, me interesa el curso ${p.name} de ${USD(p.priceCents)} de Legado Digital. Quiero conocer su contenido y cómo adquirirlo.`,
  upgrade:()=> 'Hola, quiero consultar una actualización de mi curso de Legado Digital.'
};
export function whatsappLink(message,referralCode){const text=referralCode?`${message} Código de referido: ${referralCode}.`:message;return `https://wa.me/${whatsapp.number}?text=${encodeURIComponent(text)}`;}
export const nav = [
  {id:'inicio',label:'Inicio'},
  {id:'que-aprenderas',label:'Qué aprenderás'},
  {id:'programas',label:'Cursos y planes'},
  {id:'como-funciona',label:'Cómo empezar'},
  {id:'preguntas-frecuentes',label:'Preguntas frecuentes'},
  {id:'contacto',label:'Contacto'}
];
export const orderStatus={pendiente_pago:'Pendiente de pago',en_revision:'En revisión',aprobado:'Aprobado',rechazado:'Rechazado',cancelado:'Cancelado'};
export const faqs = [
  {q:'¿Qué vende Legado Digital?',a:'Cursos de marketing digital para emprendedores. START cubre los fundamentos; PRO añade ventas y estrategia comercial; ELITE profundiza en el desarrollo de un negocio digital.'},
  {q:'¿Cuánto cuestan los cursos?',a:'START cuesta US$50, PRO US$100 y ELITE US$200. Los tres son de pago único.'},
  {q:'¿Cada nivel incluye el anterior?',a:'Sí. PRO incluye todo START y ELITE incluye todo START y PRO. Puedes comparar los contenidos y las licencias de cada curso en esta página.'},
  {q:'¿Cómo consulto una inscripción?',a:'Elige un curso y prepara tu consulta por WhatsApp. Esta web pública es una vista previa: no crea cuentas reales, no procesa pagos y no activa cursos automáticamente. Confirma la disponibilidad del contenido y las condiciones antes de comprar.'},
  {q:'¿Cómo será el acceso a los cursos?',a:'El acceso privado se habilitará en la plataforma completa cuando se conecte el servidor y se valide una compra. Por ahora puedes explorar una cuenta de muestra sin introducir contraseñas.'},
  {q:'¿Puedo cambiar a un nivel superior?',a:'La propuesta es pagar solo la diferencia: US$50 de START a PRO, US$100 de PRO a ELITE y US$150 de START a ELITE. Consulta las condiciones de la actualización por WhatsApp.'},
  {q:'¿Qué permite la licencia de reventa?',a:'START incluye la reventa de START; PRO la de START y PRO; ELITE la de los tres. Antes de utilizarla deben entregarte las condiciones escritas de uso y reventa. La licencia no garantiza ingresos ni supone un pago automático de comisiones.'},
  {q:'¿Cuánto dura el acceso y cómo funcionan las devoluciones?',a:'Las condiciones de duración del acceso y devoluciones todavía deben confirmarse. Consúltalas por WhatsApp antes de comprar; no se anuncian beneficios sin definir.'},
  {q:'¿Cómo me pongo en contacto?',a:'Por WhatsApp al +51 947 328 715. Los formularios preparan tu consulta para revisarla y enviarla allí; no guardan datos en un servidor.'}
];
