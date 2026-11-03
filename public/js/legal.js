// Páginas legales y libro de reclamaciones. Lo que falta por confirmar se muestra como tal:
// se completa en `legal` de la configuración, sin tocar estos textos.
import { whatsapp } from '/shared/site.config.mjs';
import { api, esc, fieldError, state, toast } from './core.js';
import { initReveals } from './effects.js';
import { field } from './home.js';

// Los datos salen del asistente de configuración del fundador; lo vacío se muestra como pendiente.
const legal = new Proxy({}, { get: (_, key) => {
  const b = state.public?.business || {}; const l = state.public?.legal || {};
  return { owner: b.holder, taxId: b.taxId, address: b.address, email: b.supportEmail, updated: l.version, ...l }[key] ?? null;
} });
const data = (key, label) => (legal[key] ? esc(legal[key]) : `<mark class="pend">Por confirmar: ${esc(label)}</mark>`);
const owner = () => data('owner', 'titular o razón social');
const contactMail = () => data('email', 'correo de atención');
const list = (items) => `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;

const accentLast = (title) => { const w = title.split(' '); const last = w.pop(); return `${esc(w.join(' '))} <span class="hl">${esc(last)}</span>`; };

const DOCS = {
  privacidad: {
    title: 'Política de privacidad',
    lead: 'Qué datos recogemos, para qué los usamos y cómo puedes ejercer tus derechos.',
    sections: () => [
      ['Responsable de tus datos', `El responsable es ${owner()}, identificado con ${data('taxId', 'RUC')} y domicilio en ${data('address', 'domicilio')}. Puedes escribirnos a ${contactMail()} o por WhatsApp al ${esc(whatsapp.display)}.`],
      ['Qué datos recogemos', list([
        '<strong>Al crear una cuenta:</strong> nombre completo, correo electrónico, teléfono, país si lo indicas y tu contraseña, que se guarda cifrada.',
        '<strong>Al comprar:</strong> el curso elegido, el canal de pago, los importes, el estado del pedido y el comprobante que decidas subir. Los datos de tarjeta los recibe directamente el proveedor de pagos.',
        '<strong>Al usar los referidos:</strong> tu código y las operaciones vinculadas a él.',
        '<strong>Al escribirnos:</strong> los datos y el mensaje del formulario de contacto o del libro de reclamaciones.',
      ]) + '<p>No pedimos los datos completos de tu tarjeta en esta web. No subas comprobantes en los que se vean números completos de tarjeta o contraseñas.</p>'],
      ['Para qué los usamos', list([
        'Crear y mantener tu cuenta, y darte acceso a los cursos que has comprado.',
        'Revisar pagos, gestionar actualizaciones de nivel y registrar referidos.',
        'Responder tus consultas y reclamaciones.',
        'Cumplir nuestras obligaciones legales y mantener la seguridad de la plataforma.',
      ]) + '<p>No usamos tus datos para enviarte publicidad sin una autorización separada y opcional.</p>'],
      ['Con quién se comparten', `No vendemos tus datos. Solo acceden a ellos las personas autorizadas para administrar la plataforma y los proveedores necesarios para operarla: ${data('providers', 'proveedor de alojamiento y, en su caso, de pagos y correo')}. Si escribes por WhatsApp, esa conversación también se rige por las condiciones de WhatsApp. La web carga sus tipografías desde Google Fonts, que recibe tu dirección IP.`],
      ['Cuánto tiempo los conservamos', `Mientras tu cuenta esté activa y después durante ${data('retention', 'plazo de conservación')}, o el tiempo que exija la ley para operaciones y reclamaciones.`],
      ['Tus derechos', `Puedes solicitar el acceso, la rectificación, la cancelación de tus datos o oponerte a su tratamiento, y revocar tu consentimiento. Escribe a ${contactMail()} indicando qué necesitas. También puedes editar tus datos desde Mi cuenta. Si consideras que no se han atendido tus derechos, puedes acudir a la Autoridad Nacional de Protección de Datos Personales del Perú.`],
      ['Seguridad', 'Las contraseñas se guardan cifradas, los comprobantes se almacenan en una zona privada y solo pueden verlos su propietario y los administradores autorizados. Ningún sistema es infalible: si detectas un problema, avísanos.'],
      ['Marco legal', 'Esta política se redacta conforme a la Ley N.º 29733, Ley de Protección de Datos Personales del Perú, y su reglamento, el Decreto Supremo N.º 016-2024-JUS.'],
    ],
  },
  terminos: {
    title: 'Términos y condiciones',
    lead: 'Las reglas de uso de la web y de la compra de los cursos.',
    sections: () => [
      ['Quiénes somos', `Legado Digital es una plataforma de cursos de marketing digital operada por ${owner()}, con ${data('taxId', 'RUC')} y domicilio en ${data('address', 'domicilio')}.`],
      ['Los cursos', 'Ofrecemos tres niveles de pago único: START por US$50, PRO por US$100, que incluye START, y ELITE por US$200, que incluye START y PRO. Una lección que aún no esté cargada se indica en tu cuenta como en preparación.'],
      ['Tu cuenta', 'Debes dar datos veraces y cuidar tu contraseña. Crear una cuenta no da acceso a los cursos. Puedes cerrar sesión y editar tus datos cuando quieras.'],
      ['Compra y activación', 'Al elegir un curso se crea un pedido pendiente. El pago con tarjeta se confirma cuando lo verifica el proveedor. Un pago manual lo confirma quien recibe el dinero (tu vendedor o Legado Digital) tras comprobar que llegó. Una captura, un mensaje o volver desde el checkout no prueban el pago. Al confirmarse, se habilitan el plan pagado y, en su caso, la licencia de reventa.'],
      ['Precios y medios de pago', 'Los precios se expresan en dólares estadounidenses. Puedes pagar con tarjeta en el checkout seguro del proveedor, que puede incluir un cargo de procesamiento informado antes de pagar, o por WhatsApp con Yape o Plin, en soles según la cotización indicada. Esta web no guarda los datos de tu tarjeta.'],
      ['Actualizaciones de nivel', 'Puedes subir de nivel pagando la diferencia: US$50 de START a PRO, US$100 de PRO a ELITE y US$150 de START a ELITE. Conservas tu acceso actual y el nuevo se activa cuando se comprueba el pago.'],
      ['Duración del acceso', `El acceso a los cursos dura ${data('accessTerm', 'duración del acceso')}.`],
      ['Sin garantía de resultados', 'Los cursos tienen fines educativos. No garantizamos ingresos, ventas ni la recuperación de lo pagado: los resultados dependen de cada persona, su oferta y su mercado.'],
      ['Propiedad intelectual', 'Los cursos y materiales son propios o autorizados. No puedes copiarlos, distribuirlos ni revenderlos fuera de lo que permita la licencia de tu nivel. La cuenta es personal.'],
      ['Devoluciones y reventa', 'Se rigen por la <a class="link" href="/legal/devoluciones">política de devoluciones</a> y las <a class="link" href="/legal/licencia-reventa">condiciones de la licencia de reventa</a>.'],
      ['Ley aplicable', `Estos términos se rigen por las leyes del Perú, incluido el Código de Protección y Defensa del Consumidor (Ley N.º 29571). Puedes presentar un reclamo en nuestro <a class="link" href="/libro-de-reclamaciones">libro de reclamaciones</a>.`],
    ],
  },
  devoluciones: {
    title: 'Política de devoluciones',
    lead: 'Cómo solicitar una devolución y qué ocurre con tu acceso.',
    sections: () => [
      ['Condiciones', `Plazo para solicitarla: ${data('refundWindow', 'plazo de devolución')}. Casos en los que procede: ${data('refundCases', 'casos admitidos')}. Consúltalas antes de comprar.`],
      ['Cómo solicitarla', `Escríbenos por WhatsApp al ${esc(whatsapp.display)} o a ${contactMail()} con el correo de tu cuenta y la operación a la que te refieres.`],
      ['Qué ocurre con tu acceso', 'Si se aprueba una devolución, el acceso y los permisos de reventa de ese nivel se retiran. Un pago rechazado o cancelado no cambia tu nivel actual.'],
      ['Tus derechos como consumidor', 'Esta política no limita los derechos que te reconoce el Código de Protección y Defensa del Consumidor. Si no estás conforme, puedes usar el <a class="link" href="/libro-de-reclamaciones">libro de reclamaciones</a>.'],
    ],
  },
  'licencia-reventa': {
    title: 'Licencia de reventa',
    lead: 'Qué paquetes puede ofrecer cada nivel y qué no incluye la licencia.',
    sections: () => [
      ['Qué puede revender cada nivel', list(['<strong>START:</strong> el paquete START.', '<strong>PRO:</strong> los paquetes START y PRO.', '<strong>ELITE:</strong> los paquetes START, PRO y ELITE.']) + '<p>La licencia se habilita cuando se confirma tu pago y tu cuenta queda activa. Cualquier persona puede consultar y comprar niveles superiores.</p>'],
      ['Qué no incluye', list(['No garantiza ventas, ingresos ni la recuperación de lo pagado.', 'No permite vender niveles superiores al tuyo.', 'No permite modificar los cursos, presentarlos como propios ni prometer resultados en nuestro nombre.', 'No incluye ningún pago por captar a otras personas ni comisiones por varios niveles.']) ],
      ['Referidos', 'Tu enlace personal vincula una operación a tu cuenta. Registrar una venta no equivale a un pago. No se permite la autorreferencia y cada venta se atribuye a una sola cuenta.'],
      ['Condiciones pendientes', `Comisiones y receptor del pago: ${data('commissions', 'reglas de comisión')}. Duración y fin de la licencia: ${data('licenseTerm', 'duración de la licencia')}. Consúltalas antes de comprar.`],
    ],
  },
  cookies: {
    title: 'Política de cookies',
    lead: 'Qué guarda esta web en tu navegador.',
    sections: () => [
      ['Cookie de sesión', 'Usamos una única cookie técnica para mantener tu sesión iniciada. Es imprescindible para usar tu cuenta, no sirve para publicidad y no puede leerse desde el código de la página.'],
      ['Almacenamiento local', 'Si llegas con un enlace de referido, guardamos ese código en tu navegador para mantener la atribución hasta la compra.'],
      ['Qué no usamos', 'No usamos cookies de publicidad ni de analítica. Por eso no mostramos un aviso para aceptarlas. Si eso cambia, pediremos tu consentimiento antes.'],
      ['Servicios externos', 'Google Fonts sirve las tipografías y recibe tu dirección IP. WhatsApp solo interviene cuando abres uno de sus enlaces.'],
      ['Cómo eliminarlos', 'Puedes borrar las cookies y los datos del sitio desde tu navegador. Si lo haces, tendrás que iniciar sesión de nuevo.'],
    ],
  },
  'aviso-legal': {
    title: 'Aviso legal',
    lead: 'Quién está detrás de esta web.',
    sections: () => [
      ['Titular', list([`Titular: ${owner()}`, `RUC: ${data('taxId', 'RUC')}`, `Domicilio: ${data('address', 'domicilio')}`, `Correo: ${contactMail()}`, `WhatsApp: ${esc(whatsapp.display)}`])],
      ['Contenido', 'La información de esta web tiene fines informativos y educativos. Los ejemplos y demostraciones usan datos inventados y no son una previsión de resultados.'],
      ['Marcas', 'El logotipo y el nombre Legado Digital pertenecen a su titular. Las marcas de redes sociales y tarjetas pertenecen a sus propietarios y solo se usan para identificarlas.'],
      ['Enlaces externos', 'Esta web enlaza a servicios de terceros como WhatsApp, que tienen sus propias condiciones.'],
    ],
  },
};

export const legalLinks = [
  ['/legal/privacidad', 'Política de privacidad'], ['/legal/terminos', 'Términos y condiciones'],
  ['/legal/devoluciones', 'Política de devoluciones'], ['/legal/licencia-reventa', 'Licencia de reventa'],
  ['/legal/cookies', 'Política de cookies'], ['/legal/aviso-legal', 'Aviso legal'],
];

const draftNote = () => (legal.reviewed ? '' : '<p class="legal__draft" role="note">Borrador pendiente de revisión legal y de completar los datos marcados.</p>');

export function renderLegal(main, slug) {
  const doc = DOCS[slug];
  if (!doc) return null;
  document.title = `${doc.title} | Legado Digital`;
  const sections = doc.sections();
  main.innerHTML = `
  <div class="page-top"></div>
  <article class="legal">
    <div class="wrap legal__grid">
      <nav class="legal__nav" aria-label="Documentos legales">
        <ul>${legalLinks.map(([href, label]) => `<li><a href="${href}" ${href === location.pathname ? 'aria-current="page"' : ''}>${esc(label)}</a></li>`).join('')}
        <li><a href="/libro-de-reclamaciones">Libro de reclamaciones</a></li></ul>
      </nav>
      <div class="legal__body">
        <h1 class="display rv-lines"><span class="line"><span>${accentLast(doc.title)}</span></span></h1>
        <p class="lede rv">${esc(doc.lead)}</p>
        <p class="note rv">Última actualización: ${esc(legal.updated)}.</p>
        ${draftNote()}
        ${sections.map(([h, body], i) => `<section class="legal__sec rv"><h2><span aria-hidden="true">${i + 1}</span>${esc(h)}</h2>${body.startsWith('<') ? body : `<p>${body}</p>`}</section>`).join('')}
      </div>
    </div>
  </article>`;
  return initReveals(main);
}

export function renderComplaints(main) {
  main.innerHTML = `
  <div class="page-top"></div>
  <article class="legal">
    <div class="wrap legal__grid">
      <div class="legal__nav">
        <p class="note">Este formulario envía tus datos a nuestro servidor para atender tu caso. Solo los usamos para eso, como explica la <a class="link" href="/legal/privacidad">política de privacidad</a>.</p>
      </div>
      <div class="legal__body">
        <h1 class="display rv-lines"><span class="line"><span>${accentLast('Libro de reclamaciones')}</span></span></h1>
        <p class="lede rv">Un reclamo es una disconformidad con un curso. Una queja es una disconformidad con la atención recibida.</p>
        <p class="note rv">Proveedor: ${owner()}. RUC: ${data('taxId', 'RUC')}. Domicilio: ${data('address', 'domicilio')}.</p>
        ${draftNote()}
        <form class="form" id="form-reclamo" novalidate>
          ${field('l-name', 'Nombre completo', '<input id="l-name" name="name" autocomplete="name" required>')}
          ${field('l-doc', 'Documento de identidad', '<input id="l-doc" name="doc" autocomplete="off" required>')}
          ${field('l-address', 'Domicilio', '<input id="l-address" name="address" autocomplete="street-address" required>')}
          ${field('l-email', 'Correo electrónico', '<input id="l-email" name="email" type="email" autocomplete="email" required>')}
          ${field('l-phone', 'Teléfono', '<input id="l-phone" name="phone" type="tel" autocomplete="tel">', false)}
          ${field('l-type', 'Tipo', '<select id="l-type" name="type"><option>Reclamo</option><option>Queja</option></select>')}
          ${field('l-course', 'Curso', `<select id="l-course" name="course">${state.programs.map((p) => `<option>${esc(p.name)}</option>`).join('')}<option>Ninguno</option></select>`)}
          ${field('l-message', 'Qué ocurrió y qué solicitas', '<textarea id="l-message" name="message" rows="6" maxlength="1500" required></textarea>')}
          <p class="form-status" role="alert"></p>
          <button class="btn btn--gold" type="submit"><span class="btn__in">Enviar reclamación</span></button>
        </form>
      </div>
    </div>
  </article>`;
  const form = main.querySelector('form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    fieldError(form, {});
    for (const [key, text] of [['doc', 'Escribe tu documento de identidad.'], ['address', 'Escribe tu domicilio.']]) {
      if (!d[key].trim()) { fieldError(form, { field: key, message: text }); return; }
    }
    const b = form.querySelector('button[type=submit]'); b.disabled = true;
    try {
      const message = d.message.trim() && `[Libro de reclamaciones] ${d.type}. Curso: ${d.course}. Documento: ${d.doc.trim()}. Domicilio: ${d.address.trim()}.\n\n${d.message.trim()}`;
      await api('/api/contact', { method: 'POST', body: { name: d.name, email: d.email, phone: d.phone, message } });
      form.reset();
      toast('Reclamación enviada. Guarda una copia y te responderemos a tu correo.');
    } catch (err) { fieldError(form, err); }
    b.disabled = false;
  });
  return initReveals(main);
}
