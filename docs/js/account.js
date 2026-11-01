// GitHub Pages: experiencia pública y panel de muestra, sin credenciales reales.
import { USD, whatsappLink, whatsappMessages } from '../shared/site.config.mjs';
import { state, esc, programOf, navigate, toast } from './core.js';
import { rebaseLinks } from './pages-routing.js';

const note = '<p class="demo-note">Vista previa de GitHub Pages. No se crean cuentas, no se guardan contraseñas y no se procesan pagos.</p>';
const selected = () => programOf(new URLSearchParams(location.search).get('plan'));
const action = (label, href) => `<a class="btn btn--gold" href="${esc(href)}" target="_blank" rel="noopener noreferrer"><span class="btn__in">${label}</span></a>`;
const shell = (main, title, body) => {
  main.innerHTML = `<section class="auth"><div class="auth__card"><h1 class="auth__title">${title}</h1>${note}${body}<div class="auth__foot"><a class="link" href="/">Volver al inicio</a><a class="link" href="/programas">Ver los programas</a></div></div></section>`;
  rebaseLinks(main);
};
function enterDemo() {
  state.user = {name:'Visitante de muestra',role:'user',level:0};
  window.dispatchEvent(new Event('ld:session'));
  navigate('/mi-cuenta');
}
export function renderLogin(main) {
  if (state.user) return navigate('/mi-cuenta');
  const p = selected();
  shell(main, 'Iniciar sesión', `
    ${p ? `<p class="auth__plan">Programa elegido: <strong>${esc(p.name)} · ${USD(p.priceCents)}</strong>.</p>` : ''}
    <p>Conoce cómo será el área de alumnos. El acceso con una cuenta real estará disponible al conectar el servidor.</p>
    <div class="form"><div class="field"><label for="preview-email">Correo electrónico</label><input id="preview-email" type="email" placeholder="Disponible al conectar el servidor" disabled></div><div class="field"><label for="preview-password">Contraseña</label><input id="preview-password" type="password" placeholder="No introduzcas contraseñas en esta muestra" disabled></div></div>
    <button id="entrar-demo" type="button" class="btn btn--gold btn--block"><span class="btn__in">Explorar cuenta de muestra</span></button>
    <p><a class="link" href="/registro${p ? '?plan='+p.slug : ''}">Consultar inscripción</a></p>`);
  main.querySelector('#entrar-demo').addEventListener('click', enterDemo);
}
export function renderRegister(main) {
  const p = selected();
  shell(main, 'Consultar inscripción', `
    ${p ? `<p class="auth__plan"><strong>${esc(p.name)} · ${USD(p.priceCents)}</strong> · Pago único</p>` : ''}
    <p>Completa tus datos para preparar una consulta por WhatsApp. Este formulario no crea una cuenta ni almacena datos en la web.</p>
    <form class="form" id="consulta-inscripcion">
      <div class="field"><label for="consulta-nombre">Nombre completo</label><input id="consulta-nombre" name="name" autocomplete="name" required></div>
      <div class="field"><label for="consulta-email">Correo electrónico</label><input id="consulta-email" name="email" type="email" autocomplete="email" required></div>
      <div class="field"><label for="consulta-phone">Teléfono con prefijo internacional</label><input id="consulta-phone" name="phone" type="tel" autocomplete="tel"></div>
      <p class="note">Al continuar, estos datos se incorporan al mensaje que podrás revisar y enviar en WhatsApp.</p>
      <button type="submit" class="btn btn--gold btn--block"><span class="btn__in">Continuar en WhatsApp</span></button>
    </form><p><a class="link" href="/iniciar-sesion">Explorar el acceso de alumnos</a></p>`);
  main.querySelector('form').addEventListener('submit', (event) => {
    event.preventDefault();
    const form=event.currentTarget;
    if (!form.reportValidity()) return;
    const data=Object.fromEntries(new FormData(form));
    const message=(p ? whatsappMessages.plan(p) : whatsappMessages.general())+`\nMi nombre es ${data.name}. Correo: ${data.email}.${data.phone ? ' Teléfono: '+data.phone+'.' : ''}`;
    window.open(whatsappLink(message), '_blank', 'noopener,noreferrer');
  });
}
export function renderRecover(main) {
  shell(main, 'Recuperar acceso', `<p>La recuperación de cuentas requiere el servicio de correo del servidor. Para consultas sobre tu acceso, contacta con soporte.</p>${action('Consultar por WhatsApp',whatsappLink('Hola, necesito información sobre el acceso a Legado Digital.'))}`);
}
const tabs=[['/mi-cuenta','Resumen'],['/mi-cuenta/cursos','Cursos'],['/mi-cuenta/operaciones','Operaciones'],['/mi-cuenta/referidos','Referidos'],['/mi-cuenta/perfil','Perfil']];
function panel(main,path,title,body) {
  main.innerHTML=`<div class="panel"><aside class="panel__side"><p class="panel__who"><strong>Visitante de muestra</strong><span>Sin plan activo</span></p><nav aria-label="Mi cuenta">${tabs.map(([href,label])=>`<a href="${href}" ${href===path?'aria-current="page"':''}>${label}</a>`).join('')}</nav><button class="btn btn--text btn--small" id="salir" type="button"><span class="btn__in">Salir de la muestra</span></button></aside><div class="panel__main">${note}<h1 class="panel__title">${title}</h1>${body}</div></div>`;
  rebaseLinks(main);
  main.querySelector('#salir').addEventListener('click',()=>{state.user=null;window.dispatchEvent(new Event('ld:session'));navigate('/');});
}
export function renderOverview(main) {
  panel(main,'/mi-cuenta','Tu espacio en Legado Digital',`<p class="lede">Formación, programas y seguimiento en un mismo lugar.</p><p>Estás explorando una cuenta ficticia. No tienes compras ni operaciones reales.</p><div class="stats"><div class="stat"><span>Nivel activo</span><strong>Sin plan</strong></div><div class="stat"><span>Operaciones reales</span><strong>0</strong></div></div><p><a class="btn btn--gold" href="/programas"><span class="btn__in">Explorar los programas</span></a></p><p><a class="link" href="/mi-cuenta/cursos">Ver una lección de muestra</a></p>`);
}
export function renderCourses(main) {
  panel(main,'/mi-cuenta/cursos','Cursos',`<p>La formación de pago estará disponible cuando se active tu acceso en la plataforma completa.</p><article class="auth__plan"><h2>Presenta tu marca con claridad</h2><p>Lección gratuita de muestra: aprende a explicar a quién ayudas y qué ofreces.</p><a class="link" href="/mi-cuenta/cursos/1">Abrir la muestra</a></article>`);
}
export function renderLesson(main) {
  panel(main,'/mi-cuenta/cursos','Presenta tu marca con claridad',`<p class="tag">Contenido educativo de muestra</p><h2>Empieza por la persona a la que ayudas</h2><p>Una presentación útil explica a quién te diriges, qué necesidad atiendes y cómo lo haces. Escribe primero una frase sencilla, sin prometer resultados que no puedas demostrar.</p><p>Ejemplo: «Ayudo a negocios locales a presentar sus servicios en una web clara y fácil de usar».</p><h2>Ejercicio</h2><p>Completa: Ayudo a [público] con [necesidad] mediante [servicio o habilidad]. Revisa si alguien que no conoce tu negocio lo entendería.</p><p><a class="link" href="/mi-cuenta/cursos">Volver a los cursos</a></p>`);
}
export function renderOrders(main) {panel(main,'/mi-cuenta/operaciones','Operaciones','<p>No hay operaciones reales. En esta vista previa las solicitudes se atienden por WhatsApp y no se suben comprobantes.</p>'+action('Consultar programas',whatsappLink(whatsappMessages.general())));}
export function renderReferrals(main) {panel(main,'/mi-cuenta/referidos','Referidos','<p>El enlace personal y los permisos por nivel se habilitarán con el servidor y una compra validada. Esta cuenta ficticia no tiene un código ni comisiones.</p>');}
export function renderProfile(main) {panel(main,'/mi-cuenta/perfil','Perfil','<p>Nombre: Visitante de muestra.</p><p>Este perfil es ficticio. No se guardan datos personales ni credenciales en esta versión.</p>');}
export function renderAdmin(main) {shell(main,'Administración','<p>La administración real no está disponible en GitHub Pages. Requiere un servidor con autenticación y permisos.</p>');}
