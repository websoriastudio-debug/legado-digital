// Aviso periódico. Cuenta solo el tiempo visible, sobrevive a recargas y lo comparten las pestañas.
import { notice, whatsappLink, whatsappMessages } from '/shared/site.config.mjs';
import { esc, state } from './core.js';

const KEY = { elapsed: 'ld_notice_elapsed', tick: 'ld_notice_tick', open: 'ld_notice_open' };
const TICK = 5000;
// Nunca durante compras, pagos, acceso ni dentro de la oficina o del panel, que son espacios de trabajo.
const BUSY_ROUTES = /^\/(comprar|registro|iniciar-sesion|verificar-correo|recuperar-acceso|libro-de-reclamaciones|mi-cuenta|admin|sandbox)/;

const read = (k) => { try { return Number(localStorage.getItem(k)) || 0; } catch { return 0; } };
const write = (k, v) => { try { localStorage.setItem(k, String(v)); } catch { /* sin almacenamiento, el contador vale solo en esta visita */ } };

const validUrl = (u) => { try { return new URL(u).protocol === 'https:'; } catch { return false; } };

// El contenido se elige por configuración; sin dirección válida no hay botón de comunidad.
export function noticeContent(demo, cfg = notice) {
  if (cfg.kind === 'payment') {
    return { title: 'Elige cómo pagar tu curso', text: 'Puedes pagar con tarjeta en la web o por WhatsApp con Yape o Plin. Compara el total de cada opción antes de elegir.', action: 'Consultar por WhatsApp', href: whatsappLink(whatsappMessages.general()) };
  }
  const base = { title: 'Únete a la comunidad de Legado Digital', text: 'Recibe novedades, avisos y contenido sobre marketing digital y emprendimiento.' };
  if (validUrl(cfg.communityUrl)) return { ...base, action: 'Unirme a Telegram', href: cfg.communityUrl };
  return demo ? { ...base, demo: true } : null;
}

function isBusy() {
  if (BUSY_ROUTES.test(location.pathname)) return true;
  if (!document.getElementById('menu').hidden || document.querySelector('[role="dialog"][aria-modal="true"]:not([hidden])')) return true;
  const a = document.activeElement;
  if (a?.matches?.('input, textarea, select, [contenteditable]')) return true;
  // Un formulario a medio escribir tampoco se interrumpe.
  return [...document.querySelectorAll('main input:not([type=range]):not([type=checkbox]):not([type=file]), main textarea')].some((i) => i.value !== i.defaultValue);
}

function show(content, onClose) {
  const prev = document.activeElement;
  const shade = document.createElement('div');
  shade.className = 'notice';
  shade.innerHTML = `
    <div class="notice__box" role="dialog" aria-modal="true" aria-labelledby="notice-title" aria-describedby="notice-text">
      <button class="notice__x" type="button" aria-label="Cerrar aviso"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="1.5"/></svg></button>
      <img class="notice__logo" src="/assets/logo/legado-digital-720.webp" width="720" height="720" alt="Legado Digital">
      <h2 id="notice-title">${esc(content.title)}</h2>
      <p id="notice-text">${esc(content.text)}</p>
      ${content.demo ? '<p class="demo-note">Vista de demostración: falta la dirección real de la comunidad, así que no hay botón para unirse.</p>' : ''}
      ${content.href ? `<a class="btn btn--gold btn--block" href="${esc(content.href)}" target="_blank" rel="noopener noreferrer"><span class="btn__in">${esc(content.action)}</span></a>` : ''}
      <button class="btn btn--line btn--block" type="button" data-keep><span class="btn__in">Seguir viendo la página</span></button>
      <small>Puedes cerrar este mensaje cuando quieras.</small>
    </div>`;
  const behind = ['contenido', 'pie', 'cabecera', 'wa-flotante'].map((id) => document.getElementById(id));
  behind.forEach((el) => { el.inert = true; });
  document.body.append(shade);
  document.documentElement.classList.add('menu-open');
  const box = shade.firstElementChild;
  const close = () => {
    behind.forEach((el) => { el.inert = false; });
    document.documentElement.classList.remove('menu-open');
    shade.remove();
    document.removeEventListener('keydown', onKey);
    prev?.focus?.({ preventScroll: true });
    onClose();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') { close(); return; }
    if (e.key !== 'Tab') return;
    const items = [...box.querySelectorAll('a[href], button')];
    if (e.shiftKey && document.activeElement === items[0]) { e.preventDefault(); items.at(-1).focus(); }
    else if (!e.shiftKey && document.activeElement === items.at(-1)) { e.preventDefault(); items[0].focus(); }
  };
  document.addEventListener('keydown', onKey);
  box.querySelector('.notice__x').addEventListener('click', close);
  box.querySelector('[data-keep]').addEventListener('click', close);
  box.querySelector('[data-keep]').focus();
}

export function initNotice() {
  if (!notice.enabled) return;
  const content = noticeContent(state.demo);
  if (!content) return;
  let showing = false;
  const present = () => {
    showing = true;
    write(KEY.open, Date.now());
    show(content, () => {
      showing = false;
      write(KEY.elapsed, 0);
      write(KEY.open, 0);
    });
  };
  setInterval(() => {
    if (document.hidden || showing) return;
    const now = Date.now();
    // Con varias pestañas visibles, solo suma la primera que llega en cada intervalo.
    if (now - read(KEY.tick) >= TICK * 0.8) {
      write(KEY.tick, now);
      write(KEY.elapsed, Math.min(notice.intervalMs, read(KEY.elapsed) + TICK));
    }
    if (read(KEY.elapsed) < notice.intervalMs) return;
    if (now - read(KEY.open) < 60000 * 30 || isBusy()) return; // Otra pestaña lo tiene abierto, o se pospone.
    present();
  }, TICK);
}
