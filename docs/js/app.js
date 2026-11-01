import { localPath, sitePath, rebaseLinks } from './pages-routing.js';
// Arranque, enrutado, cabecera y menú.
import { brand, nav, whatsappLink, whatsappMessages } from '../shared/site.config.mjs';
import { api, applyPrices, captureRef, choosePlan, currentRef, esc, state } from './core.js';
import { initPointer } from './effects.js';
import { renderFooter, renderHome, renderProgram, renderProgramsPage } from './home.js';
import * as acc from './account.js';

const main = document.getElementById('contenido');
const foot = document.getElementById('pie');
const header = document.getElementById('cabecera');
let stopView = null;
let currentRenderedPath = null;

/* ---------- Rutas ---------- */
const needsUser = (fn) => (m, ...a) => {
  if (!state.user) { navigate('/iniciar-sesion'); return; }
  return fn(m, ...a);
};
const needsAdmin = (fn) => needsUser((m, ...a) => {
  if (state.user.role !== 'admin') {
    m.innerHTML = '<section class="auth"><div class="auth__card"><h1 class="auth__title">Sin permiso</h1><p>Esta zona es solo para administración.</p><p><a class="link" href="/mi-cuenta">Volver a Mi cuenta</a></p></div></section>';
    return;
  }
  return fn(m, ...a);
});

const ROUTES = [
  [/^\/$/, renderHome, brand.name],
  [/^\/programas$/, renderProgramsPage, 'Programas'],
  [/^\/programas\/([a-z]+)$/, renderProgram, 'Programa'],
  [/^\/iniciar-sesion$/, acc.renderLogin, 'Iniciar sesión'],
  [/^\/registro$/, acc.renderRegister, 'Crear cuenta'],
  [/^\/recuperar-acceso$/, acc.renderRecover, 'Recuperar contraseña'],
  [/^\/mi-cuenta$/, needsUser(acc.renderOverview), 'Mi cuenta'],
  [/^\/mi-cuenta\/cursos$/, needsUser(acc.renderCourses), 'Cursos'],
  [/^\/mi-cuenta\/cursos\/(\d+)$/, needsUser(acc.renderLesson), 'Lección'],
  [/^\/mi-cuenta\/operaciones$/, needsUser(acc.renderOrders), 'Operaciones'],
  [/^\/mi-cuenta\/referidos$/, needsUser(acc.renderReferrals), 'Referidos'],
  [/^\/mi-cuenta\/perfil$/, needsUser(acc.renderProfile), 'Perfil'],
  [/^\/admin$/, needsAdmin(acc.renderAdmin), 'Administración'],
];

function renderNotFound(m) {
  m.innerHTML = '<section class="auth"><div class="auth__card"><h1 class="auth__title">Esta página no existe</h1><p><a class="link" href="/">Ir al inicio</a></p></div></section>';
}

function scrollToHash(hash, smooth) {
  const target = hash && document.querySelector(hash);
  if (!target) return false;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ behavior: smooth && !still ? 'smooth' : 'auto' });
  return true;
}

async function render({ focus = true } = {}) {
  const path = localPath(location.pathname);
  const samePage = path === currentRenderedPath && path === '/';
  if (samePage) { scrollToHash(location.hash, true); return; }
  stopView?.(); stopView = null;
  sectionObserver?.disconnect();
  currentRenderedPath = path;

  const isPublicHome = path === '/';
  document.body.dataset.view = path.startsWith('/mi-cuenta') || path === '/admin' ? 'panel' : isPublicHome ? 'home' : 'page';
  const route = ROUTES.find(([re]) => re.test(path));
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
    main.innerHTML = `<section class="auth"><div class="auth__card"><h1 class="auth__title">No se pudo cargar</h1><p>${esc(err.message)}</p><p><a class="link" href="${esc(location.pathname)}">Reintentar</a></p></div></section>`;
  }
  renderFooter(foot);
  rebaseLinks(document);
  foot.hidden = document.body.dataset.view === 'panel';
  observeSections();
  if (!scrollToHash(location.hash, false)) scrollTo(0, 0);
  if (focus) main.focus({ preventScroll: true });
}

function navigate(path, { replace = false } = {}) {
  history[replace ? 'replaceState' : 'pushState']({}, '', sitePath(path));
  render();
}
window.addEventListener('ld:navigate', (e) => navigate(e.detail.path, e.detail));
window.addEventListener('popstate', () => render());

document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const chooser = e.target.closest('[data-choose]');
  if (chooser && state.user) { e.preventDefault(); choosePlan(chooser.dataset.choose); return; }
  const a = e.target.closest('a[href]');
  if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
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

function buildMenu() {
  const access = state.user ? { href: '/mi-cuenta', label: 'Mi cuenta' } : { href: '/iniciar-sesion', label: 'Iniciar sesión' };
  menuList.innerHTML = nav.map((n) => `<li><a href="/#${n.id}" data-section="${n.id}">${esc(n.label)}</a></li>`).join('')
    + `<li class="drawer__access"><a href="${access.href}">${access.label}</a></li>`;
  rebaseLinks(document);
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
  a.textContent = state.user ? 'Mi cuenta' : 'Iniciar sesión';
  a.setAttribute('href', state.user ? '/mi-cuenta' : '/iniciar-sesion');
  a.innerHTML = `<span class="btn__in">${state.user ? 'Mi cuenta' : 'Iniciar sesión'}</span>`;
  buildMenu();
  rebaseLinks(document);
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
    state.user = boot.user; state.demo = boot.demo; state.demoAccounts = boot.demoAccounts;
    applyPrices(boot.programs);
  } catch { /* Sin servidor, la parte pública sigue usable con la configuración local. */ }
  syncSession();
  initPointer();
  render({ focus: false });
}
start();
