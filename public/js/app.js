// Arranque, enrutado, cabecera y menú.
import { brand, nav, whatsappLink, whatsappMessages } from '/shared/site.config.mjs';
import { api, applyPrices, captureRef, currentRef, esc, state } from './core.js';
import { initPointer, initReadBar } from './effects.js';
import { renderComplaints, renderLegal } from './legal.js';
import { renderFooter, renderHome, renderProgram, renderProgramsPage } from './home.js';
import * as acc from './account.js';
import * as office from './office.js';
import * as founder from './founder.js';
import { renderCheckout } from './checkout.js';
import { initNotice } from './notice.js';

const main = document.getElementById('contenido');
const foot = document.getElementById('pie');
const header = document.getElementById('cabecera');
let stopView = null;
let currentRenderedPath = null;

/* ---------- Rutas ---------- */
// Cada pantalla privada vuelve a consultar el servidor: una activación o suspensión se ve sin cerrar sesión.
const needsUser = (fn) => async (m, ...a) => {
  const boot = await api('/api/bootstrap');
  state.user = boot.user;
  syncSession();
  if (!state.user) { navigate('/iniciar-sesion'); return; }
  return fn(m, ...a);
};
// La interfaz solo evita pantallas vacías: el servidor rechaza igualmente cada petición no autorizada.
const needsActive = (fn) => needsUser((m, ...a) => {
  if (state.user.accountStatus !== 'activo' && !state.user.founder) { navigate('/mi-cuenta', { replace: true }); return; }
  return fn(m, ...a);
});
const needsFounder = (fn) => needsUser((m, ...a) => {
  if (!state.user.founder) {
    m.innerHTML = '<section class="auth"><div class="auth__card"><h1 class="auth__title">Sin permiso</h1><p>Esta zona es solo para el fundador.</p><p><a class="link" href="/mi-cuenta">Volver a mi oficina</a></p></div></section>';
    return;
  }
  return fn(m, ...a);
});

const ROUTES = [
  [/^\/$/, renderHome, brand.name],
  [/^\/programas$/, renderProgramsPage, 'Cursos y planes'],
  [/^\/programas\/([a-z]+)$/, renderProgram, 'Curso'],
  [/^\/legal\/([a-z-]+)$/, renderLegal, 'Información legal'],
  [/^\/libro-de-reclamaciones$/, renderComplaints, 'Libro de reclamaciones'],
  [/^\/comprar\/([a-z]+)$/, renderCheckout, 'Elige cómo pagar'],
  [/^\/iniciar-sesion$/, acc.renderLogin, 'Iniciar sesión'],
  [/^\/registro$/, acc.renderRegister, 'Crear cuenta'],
  [/^\/verificar-correo$/, acc.renderVerify, 'Confirmar correo'],
  [/^\/recuperar-acceso$/, acc.renderRecover, 'Recuperar contraseña'],
  [/^\/mi-cuenta$/, needsUser(office.renderOfficeHome), 'Mi oficina'],
  [/^\/mi-cuenta\/formacion$/, needsActive(office.renderTraining), 'Mi formación'],
  [/^\/mi-cuenta\/formacion\/(\d+)$/, needsActive(office.renderLessonPage), 'Lección'],
  [/^\/mi-cuenta\/enlace$/, needsActive(office.renderLinkPage), 'Mi enlace de referido'],
  [/^\/mi-cuenta\/clientes$/, needsActive(office.renderClients), 'Mis clientes'],
  [/^\/mi-cuenta\/pagos$/, needsActive(office.renderReviews), 'Pagos por revisar'],
  [/^\/mi-cuenta\/ventas$/, needsActive(office.renderSales), 'Mis ventas'],
  [/^\/mi-cuenta\/comisiones$/, needsActive(office.renderCommissions), 'Comisiones'],
  [/^\/mi-cuenta\/pedidos$/, needsUser(office.renderOrdersPage), 'Mis pedidos'],
  [/^\/mi-cuenta\/perfil$/, needsUser(office.renderProfilePage), 'Mi perfil'],
  [/^\/mi-cuenta\/notificaciones$/, needsUser(office.renderNotifications), 'Notificaciones'],
  [/^\/mi-cuenta\/tutoriales$/, needsUser(office.renderTutorials), 'Tutoriales'],
  [/^\/mi-cuenta\/soporte$/, needsUser(office.renderSupport), 'Soporte'],
  [/^\/admin$/, needsFounder(founder.renderFounderHome), 'Panel del fundador'],
  [/^\/admin\/pagos$/, needsFounder(founder.renderFounderReviews), 'Pagos por revisar'],
  [/^\/admin\/pedidos$/, needsFounder(founder.renderFounderOrders), 'Pedidos y ventas'],
  [/^\/admin\/usuarios$/, needsFounder(founder.renderFounderUsers), 'Usuarios y permisos'],
  [/^\/admin\/red$/, needsFounder(founder.renderFounderNetwork), 'Red de referidos'],
  [/^\/admin\/planes$/, needsFounder(founder.renderFounderPlans), 'Planes y cursos'],
  [/^\/admin\/cobros$/, needsFounder(founder.renderFounderPayments), 'Cobros y reglas'],
  [/^\/admin\/liquidaciones$/, needsFounder(founder.renderFounderPayouts), 'Liquidaciones'],
  [/^\/admin\/avisos$/, needsFounder(founder.renderFounderNotices), 'Avisos y comunidad'],
  [/^\/admin\/configuracion$/, needsFounder(founder.renderFounderSettings), 'Configuración'],
  [/^\/admin\/registro$/, needsFounder(founder.renderFounderAudit), 'Registro'],
  [/^\/admin\/seguridad$/, needsFounder(founder.renderFounderSecurity), 'Seguridad'],
];

function renderNotFound(m) {
  m.innerHTML = '<section class="auth"><div class="auth__card"><h1 class="auth__title">Esta página no existe</h1><p><a class="link" href="/">Ir al inicio</a></p></div></section>';
}

function scrollToHash(hash, smooth) {
  let target = null;
  try { target = hash && document.querySelector(hash); } catch { return false; }
  if (!target) return false;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ behavior: smooth && !still ? 'smooth' : 'auto' });
  return true;
}

async function render({ focus = true } = {}) {
  const path = location.pathname.replace(/\/+$/, '') || '/';
  const samePage = path === currentRenderedPath && path === '/';
  if (samePage) { scrollToHash(location.hash, true); return; }
  stopView?.(); stopView = null;
  sectionObserver?.disconnect();
  currentRenderedPath = path;

  const isPublicHome = path === '/';
  document.body.dataset.view = path.startsWith('/mi-cuenta') || path.startsWith('/admin') ? 'panel' : isPublicHome ? 'home' : 'page';
  const route = ROUTES.find(([re]) => re.test(path));
  if (document.body.dataset.view === 'panel') main.innerHTML = '<div class="office-loading" role="status">Cargando tu oficina…</div>';
  try {
    if (route) {
      const args = route[0].exec(path).slice(1);
      document.title = route[2] === brand.name ? brand.name : `${route[2]} | ${brand.name}`;
      const result = await route[1](main, ...args);
      if (typeof result === 'function') stopView = result;
      if (result === null) renderNotFound(main);
    } else {
      document.title = `Página no encontrada | ${brand.name}`;
      renderNotFound(main);
    }
  } catch (err) {
    if (err.status === 401) { state.user = null; syncSession(); navigate('/iniciar-sesion'); return; }
    if (err.status === 403 && path.startsWith('/mi-cuenta/')) { navigate('/mi-cuenta', { replace: true }); return; }
    main.innerHTML = `<section class="auth"><div class="auth__card"><h1 class="auth__title">No se pudo cargar</h1><p>${esc(err.message)}</p><p><a class="link" href="${esc(location.pathname)}">Reintentar</a></p></div></section>`;
  }
  renderFooter(foot);
  foot.hidden = document.body.dataset.view === 'panel';
  observeSections();
  if (!scrollToHash(location.hash, false)) scrollTo(0, 0);
  if (focus) (main.querySelector('#office-main') || main).focus({ preventScroll: true });
}

function navigate(path, { replace = false } = {}) {
  history[replace ? 'replaceState' : 'pushState']({}, '', path);
  render();
}
window.addEventListener('ld:navigate', (e) => navigate(e.detail.path, e.detail));
window.addEventListener('popstate', () => render());

document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest('a[href]');
  if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/sandbox/')) return;
  e.preventDefault();
  closeMenu(false);
  if (url.pathname === location.pathname && url.search === location.search && url.hash) {
    history.pushState({}, '', url.hash);
    scrollToHash(url.hash, true);
    document.querySelector(url.hash)?.setAttribute('tabindex', '-1');
    document.querySelector(url.hash)?.focus({ preventScroll: true });
    return;
  }
  navigate(url.pathname + url.search + url.hash);
});

/* ---------- Menú ---------- */
const drawer = document.getElementById('menu');
const scrim = document.getElementById('menu-velo');
const opener = document.getElementById('menu-abrir');
const closer = document.getElementById('menu-cerrar');
const menuList = document.getElementById('menu-lista');

function sessionLink() {
  if (!state.user) return { href: '/iniciar-sesion', label: 'Iniciar sesión' };
  if (state.user.founder) return { href: '/admin', label: 'Panel del fundador' };
  return { href: '/mi-cuenta', label: state.user.accountStatus === 'activo' ? 'Mi panel' : 'Mi cuenta' };
}

function buildMenu() {
  const access = sessionLink();
  menuList.innerHTML = nav.map((n) => `<li><a href="/#${n.id}" data-section="${n.id}">${esc(n.label)}</a></li>`).join('')
    + `<li class="drawer__access"><a href="${access.href}">${access.label}</a></li>`;
}

function openMenu() {
  drawer.hidden = false; scrim.hidden = false;
  opener.setAttribute('aria-expanded', 'true');
  document.documentElement.classList.add('menu-open');
  [main, foot, header, document.getElementById('wa-flotante')].forEach((el) => { el.inert = true; });
  requestAnimationFrame(() => { drawer.classList.add('is-open'); scrim.classList.add('is-open'); closer.focus(); });
}
function closeMenu(restoreFocus = true) {
  if (drawer.hidden) return;
  drawer.classList.remove('is-open'); scrim.classList.remove('is-open');
  opener.setAttribute('aria-expanded', 'false');
  document.documentElement.classList.remove('menu-open');
  [main, foot, header, document.getElementById('wa-flotante')].forEach((el) => { el.inert = false; });
  const finish = () => { drawer.hidden = true; scrim.hidden = true; };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) finish(); else setTimeout(finish, 420);
  if (restoreFocus) opener.focus();
}
opener.addEventListener('click', openMenu);
closer.addEventListener('click', () => closeMenu());
scrim.addEventListener('click', () => closeMenu());
document.addEventListener('keydown', (e) => {
  if (drawer.hidden) return;
  if (e.key === 'Escape') closeMenu();
  if (e.key === 'Tab') {
    const items = [...drawer.querySelectorAll('a[href], button')];
    const [first, last] = [items[0], items.at(-1)];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

/* ---------- Apartado activo y cabecera ---------- */
let sectionObserver;
function observeSections() {
  const sections = main.querySelectorAll('section[id]');
  sectionObserver = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      menuList.querySelectorAll('[data-section]').forEach((a) => {
        if (a.dataset.section === e.target.id) a.setAttribute('aria-current', 'location');
        else a.removeAttribute('aria-current');
      });
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach((s) => sectionObserver.observe(s));
}
const onScroll = () => header.classList.toggle('is-stuck', scrollY > 24);
addEventListener('scroll', onScroll, { passive: true });
onScroll();

function syncSession() {
  const a = document.getElementById('acceso');
  const link = sessionLink();
  a.setAttribute('href', link.href);
  a.innerHTML = `<span class="btn__in">${link.label}</span>`;
  buildMenu();
}
window.addEventListener('ld:session', syncSession);

/* ---------- Arranque ---------- */
async function start() {
  history.scrollRestoration = 'manual';
  captureRef();
  const waLink = whatsappLink(whatsappMessages.general(), currentRef());
  document.getElementById('wa-flotante').href = waLink;
  const menuWa = document.getElementById('menu-wa');
  menuWa.href = waLink; menuWa.textContent = 'Hablar por WhatsApp';
  try {
    const boot = await api('/api/bootstrap');
    Object.assign(state, { user: boot.user, demo: boot.demo, sandbox: boot.sandbox, demoAccounts: boot.demoAccounts, public: boot.public, salesOpen: boot.salesOpen });
    applyPrices(boot.programs);
  } catch { /* Sin servidor, la parte pública sigue usable con la configuración local. */ }
  syncSession();
  initPointer();
  initReadBar();
  initNotice();
  render({ focus: false });
}
start();
