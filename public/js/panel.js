// Estructura común de la oficina y del panel del fundador: barra superior, barra lateral y piezas compartidas.
import { brand, orderStatus } from '/shared/site.config.mjs';
import { api, esc, fieldError, fmtDateTime, navigate, onReauth, state, toast } from './core.js';

/* ---------- Iconos de línea ---------- */
const P = {
  inicio: 'M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z',
  formacion: 'M3 8l9-4 9 4-9 4-9-4zm4 2v5c0 1.5 2.5 3 5 3s5-1.5 5-3v-5',
  enlace: 'M10 14a4 4 0 0 0 5.6 0l3-3a4 4 0 0 0-5.6-5.6l-1 1M14 10a4 4 0 0 0-5.6 0l-3 3a4 4 0 0 0 5.6 5.6l1-1',
  clientes: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 10v-1a6 6 0 0 1 12 0v1M17 11a3 3 0 1 0 0-6M22 21v-1a5 5 0 0 0-3.5-4.8',
  pagos: 'M4 6h16v12H4zM4 10h16M8 15h3',
  ventas: 'M4 19V5M4 19h16M8 15l3-4 3 2 5-6',
  comisiones: 'M12 3v18M17 7H9.5a2.5 2.5 0 0 0 0 5h5a2.5 2.5 0 0 1 0 5H6',
  perfil: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0',
  avisos: 'M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0',
  tutoriales: 'M4 5h11v14H4zM15 9l5-3v12l-5-3',
  soporte: 'M12 21a9 9 0 1 0-8-5l-1 5 5-1a9 9 0 0 0 4 1zM9 10a3 3 0 1 1 4 2.8V14M12 17h.01',
  salir: 'M15 4h4v16h-4M10 17l5-5-5-5M15 12H3',
  pedidos: 'M6 4h12l1 4H5zM5 8h14v12H5zM9 12h6',
  red: 'M12 5a2 2 0 1 0 0-.01M5 19a2 2 0 1 0 0-.01M19 19a2 2 0 1 0 0-.01M12 7v4M12 11l-6 6M12 11l6 6',
  cursos: 'M4 4h7v16H4zM13 4h7v16h-7',
  ajustes: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z',
  registro: 'M6 3h9l4 4v14H6zM9 12h7M9 16h7M9 8h4',
  seguridad: 'M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6z',
  buscar: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zm10 3-5-5',
  menu: 'M4 7h16M4 12h16M4 17h16',
  web: 'M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
};
export const icon = (name, size = 22) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path d="${P[name] || P.inicio}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/* ---------- Piezas ---------- */
export const STATUS = { ...orderStatus, aprobado: 'Pago confirmado' };
export const badge = (s, label) => `<span class="status status--${esc(s)}">${esc(label ?? STATUS[s] ?? s)}</span>`;
export const ACCOUNT = { pendiente: 'Cuenta pendiente', activo: 'Cuenta activa', suspendido: 'Cuenta suspendida' };
export const empty = (text, action = '') => `<div class="empty"><p>${esc(text)}</p>${action}</div>`;
export const avatar = (u, cls = '') => (u.hasAvatar
  ? `<img class="avatar ${cls}" src="/api/users/${u.id}/avatar" width="96" height="96" alt="">`
  : `<span class="avatar avatar--initials ${cls}" aria-hidden="true">${esc((u.firstName?.[0] || '') + (u.lastName?.[0] || ''))}</span>`);

export function bindForm(form, handler) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    fieldError(form, {});
    const b = e.submitter || form.querySelector('button[type=submit]');
    if (b) b.disabled = true;
    try { await handler(Object.fromEntries(new FormData(form)), e.submitter); }
    catch (err) { fieldError(form, err); }
    if (b?.isConnected) b.disabled = false;
  });
}

export async function logout() {
  await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
  state.user = null;
  window.dispatchEvent(new Event('ld:session'));
  toast('Sesión cerrada.');
  navigate('/');
}

/* ---------- Diálogo de reautenticación ---------- */
function reauthDialog() {
  return new Promise((done) => {
    const prev = document.activeElement;
    const shade = document.createElement('div');
    shade.className = 'notice';
    shade.innerHTML = `<form class="notice__box reauth" role="dialog" aria-modal="true" aria-labelledby="ra-t" novalidate>
      <h2 id="ra-t">Confirma tu identidad</h2>
      <p>Esta acción cambia datos sensibles. Escribe tu contraseña para continuar.</p>
      <div class="field"><label for="ra-p">Contraseña</label><input id="ra-p" name="password" type="password" autocomplete="current-password" required><p class="field__error" id="ra-p-error"></p></div>
      ${state.user?.totpEnabled ? '<div class="field"><label for="ra-c">Código de tu aplicación</label><input id="ra-c" name="code" inputmode="numeric" autocomplete="one-time-code"><p class="field__error" id="ra-c-error"></p></div>' : ''}
      <p class="form-status" role="alert"></p>
      <button class="btn btn--gold btn--block" type="submit"><span class="btn__in">Confirmar</span></button>
      <button class="btn btn--line btn--block" type="button" data-cancel><span class="btn__in">Cancelar</span></button>
    </form>`;
    document.body.append(shade);
    const form = shade.firstElementChild;
    const close = (ok) => { shade.remove(); document.removeEventListener('keydown', onKey); prev?.focus?.(); done(ok); };
    const onKey = (e) => { if (e.key === 'Escape') close(false); };
    document.addEventListener('keydown', onKey);
    form.querySelector('[data-cancel]').addEventListener('click', () => close(false));
    bindForm(form, async (d) => {
      const r = await fetch('/api/auth/reauth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw Object.assign(new Error(body.message || 'No se pudo confirmar.'), { field: body.field === 'code' ? 'code' : 'password' });
      close(true);
    });
    form.querySelector('#ra-p').focus();
  });
}
onReauth(reauthDialog);

/* ---------- Estructura ---------- */
// sections: [{ href, label, icon, badge? }]. La búsqueda filtra apartados y lleva al primero que coincide.
export function shell(main, { area, sections, current, title, body, sideNote = '' }) {
  const u = state.user;
  const nav = sections.map((s) => `<a href="${s.href}" ${s.href === current ? 'aria-current="page"' : ''} data-label="${esc(s.label.toLowerCase())}">
      <span class="side-icon">${icon(s.icon)}</span><span class="side-label">${esc(s.label)}</span>${s.badge ? `<span class="side-count" aria-label="${s.badge} pendientes">${s.badge}</span>` : ''}</a>`).join('');
  main.innerHTML = `
  <div class="office" data-area="${area}">
    <header class="office__top">
      <button class="office__burger" type="button" aria-expanded="false" aria-controls="office-side" aria-label="Abrir menú de la oficina">${icon('menu', 24)}</button>
      <a class="office__brand" href="/" aria-label="Legado Digital, ir a la web"><img src="${brand.logo.mark}" width="144" height="141" alt="Legado Digital"><span>${area === 'fundador' ? 'Panel del fundador' : 'Oficina'}</span></a>
      <form class="office__search" role="search"><label class="sr-only" for="office-q">Buscar en la oficina</label>${icon('buscar', 18)}<input id="office-q" type="search" placeholder="Buscar sección" autocomplete="off" list="office-sections">
        <datalist id="office-sections">${sections.map((s) => `<option value="${esc(s.label)}">`).join('')}</datalist></form>
      <div class="office__tools">
        <button class="office__bell" type="button" aria-expanded="false" aria-controls="office-bell" aria-label="Notificaciones${u.unread ? `, ${u.unread} sin leer` : ''}">${icon('avisos')}${u.unread ? `<span class="office__dot">${u.unread > 9 ? '9+' : u.unread}</span>` : ''}</button>
        <div class="office__bellpanel" id="office-bell" hidden><p class="muted">Cargando…</p></div>
        <a class="office__me" href="${area === 'fundador' ? '/admin/seguridad' : '/mi-cuenta/perfil'}" aria-label="Mi perfil">${avatar(u, 'avatar--sm')}</a>
      </div>
    </header>
    <aside class="office__side" id="office-side">
      <div class="office__who">${avatar(u)}<strong>${esc(u.name)}</strong><span>${esc(sideNote)}</span></div>
      <nav aria-label="${area === 'fundador' ? 'Panel del fundador' : 'Mi oficina'}" class="office__nav">${nav}
        <button type="button" class="office__out" data-logout><span class="side-icon">${icon('salir')}</span><span class="side-label">Cerrar sesión</span></button></nav>
    </aside>
    <div class="office__main" id="office-main" tabindex="-1">
      ${state.demo ? '<p class="demo-note">Demostración: todos los datos son ficticios y ningún pago es real.</p>' : ''}
      <h1 class="panel__title">${title}</h1>
      ${body}
    </div>
  </div>`;
  wire(main, sections);
  return main.querySelector('#office-main');
}

function wire(main, sections) {
  const side = main.querySelector('.office__side');
  const burger = main.querySelector('.office__burger');
  const setOpen = (open) => { burger.setAttribute('aria-expanded', open); side.classList.toggle('is-open', open); if (open) side.querySelector('a, button')?.focus(); };
  burger.addEventListener('click', () => setOpen(burger.getAttribute('aria-expanded') !== 'true'));
  side.addEventListener('keydown', (e) => { if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') { setOpen(false); burger.focus(); } });
  main.querySelector('[data-logout]').addEventListener('click', logout);
  main.querySelector('.office__search').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = main.querySelector('#office-q').value.trim().toLowerCase();
    const hit = sections.find((s) => s.label.toLowerCase().includes(q));
    if (hit) navigate(hit.href); else toast('No hay ninguna sección con ese nombre.', 'error');
  });
  const bell = main.querySelector('.office__bell');
  const panel = main.querySelector('#office-bell');
  bell.addEventListener('click', async () => {
    const open = panel.hidden;
    panel.hidden = !open; bell.setAttribute('aria-expanded', open);
    if (!open) return;
    try {
      const { notifications } = await api('/api/me/notifications');
      panel.innerHTML = notifications.length ? `<ul>${notifications.slice(0, 6).map((n) => `<li class="${n.readAt ? '' : 'is-new'}"><strong>${esc(n.title)}</strong><span>${esc(n.body)}</span><small>${fmtDateTime(n.createdAt)}</small></li>`).join('')}</ul>
        <a class="link" href="${state.user.founder ? '/admin/avisos' : '/mi-cuenta/notificaciones'}">Ver todas</a>` : '<p class="muted">No tienes notificaciones.</p>';
    } catch (err) { panel.innerHTML = `<p class="muted">${esc(err.message)}</p>`; }
  });
  document.addEventListener('keydown', function esc2(e) { if (e.key === 'Escape' && !panel.hidden) { panel.hidden = true; bell.setAttribute('aria-expanded', 'false'); bell.focus(); } if (!main.contains(bell)) document.removeEventListener('keydown', esc2); });
}

/* ---------- Tarjetas de estadísticas ---------- */
export function statCards(stats) {
  const w = [['last7', 'Últimos 7 días'], ['last30', 'Últimos 30 días'], ['total', 'Acumulado']];
  const usd = (c) => `US$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `
  <div class="stat-cards">${w.map(([k, l]) => `<article class="stat-card"><span>Ventas brutas · ${l}</span><strong>${usd(stats[k].grossSales)}</strong></article>`).join('')}</div>
  <div class="table-wrap"><table class="data data--stats"><caption class="sr-only">Detalle por periodo</caption>
    <thead><tr><th scope="col">Concepto</th>${w.map(([, l]) => `<th scope="col">${l}</th>`).join('')}</tr></thead>
    <tbody>${[['commissions', 'Comisiones generadas'], ['refundAdjustments', 'Ajustes por devolución'], ['pending', 'Pendiente de liquidar'], ['paidOut', 'Pagado efectivamente']]
      .map(([k, l]) => `<tr><th scope="row">${l}</th>${w.map(([p]) => `<td>${usd(stats[p][k])}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>
  <p class="note">Importes en ${stats.currency}. Actualizado: ${fmtDateTime(stats.updatedAt)}. Las ventas brutas son lo vendido, no tu ganancia.</p>`;
}

/* ---------- Revisión de pagos ---------- */
export function reviewCard(o, { canAct }) {
  const b = o.beneficiary || {};
  const sub = o.submissions.at(-1);
  return `<article class="order review-card" aria-labelledby="rv-${o.id}">
    <header><h2 id="rv-${o.id}">${esc(o.code)} · ${esc(o.planName)}</h2>${badge(o.status)}</header>
    <dl class="kv">
      <div><dt>Comprador</dt><dd>${esc(o.buyer)}${o.buyerEmail ? ` <small>${esc(o.buyerEmail)}</small>` : ''}</dd></div>
      <div><dt>Vendedor</dt><dd>${esc(o.seller)}</dd></div>
      <div><dt>Importe</dt><dd>${o.chargeCents === null ? 'Por confirmar' : `${o.chargeCurrency === 'PEN' ? 'S/' : 'US$'} ${(o.chargeCents / 100).toFixed(2)}`}${o.fxRate ? ` <small>(US$${(o.baseCents / 100).toFixed(2)} a ${o.fxRate / 10000})</small>` : ''}</dd></div>
      <div><dt>Moneda</dt><dd>${esc(o.chargeCurrency || '')}</dd></div>
      <div><dt>Beneficiario</dt><dd>${esc(b.holder || '')}${b.account ? ` · ${esc(b.account)}` : ''} <small>(${o.beneficiaryType === 'vendedor' ? 'cobro directo del vendedor' : 'cuenta de la plataforma'})</small></dd></div>
      <div><dt>Método</dt><dd>${esc(o.methodName || '')}</dd></div>
      ${sub ? `<div><dt>Fecha del pago</dt><dd>${esc(sub.paidOn)}</dd></div><div><dt>Nº de operación</dt><dd>${esc(sub.operationNumber)}</dd></div>
      <div><dt>Comprobante</dt><dd><a class="link" href="/api/receipts/${sub.id}" target="_blank" rel="noopener">Ver comprobante</a></dd></div>` : ''}
    </dl>
    ${o.submissions.length > 1 ? `<details><summary>Historial de comprobantes (${o.submissions.length})</summary><ul class="history">${o.submissions.map((s) => `<li>${badge(s.status)} ${esc(s.operationNumber)} · ${esc(s.paidOn)}${s.reviewNote ? ` — ${esc(s.reviewNote)}` : ''}</li>`).join('')}</ul></details>` : ''}
    ${canAct ? `<p class="note">Un comprobante demuestra que se envió una solicitud, no que el dinero llegó. Comprueba el ingreso en la cuenta receptora antes de aprobar.</p>
    <form class="review" data-review="${o.id}" novalidate>
      <label class="check"><input type="checkbox" name="confirm"><span>Comprobé que el dinero llegó a la cuenta receptora.</span></label>
      <div class="field"><label for="rn-${o.id}">Motivo <small>(obligatorio al rechazar${o.beneficiaryType === 'vendedor' && state.user.founder ? ' y al intervenir como fundador' : ''})</small></label><input id="rn-${o.id}" name="note"><p class="field__error" id="rn-${o.id}-error"></p></div>
      <p class="form-status" role="alert"></p>
      <div class="review__actions">
        <button class="btn btn--gold btn--small" type="submit" value="aprobar"><span class="btn__in">Aprobar</span></button>
        <button class="btn btn--line btn--small" type="submit" value="rechazar"><span class="btn__in">Rechazar</span></button>
      </div>
    </form>` : '<p class="note">Este cobro lo recibe la plataforma: puedes ver su estado, pero no confirmarlo.</p>'}
  </article>`;
}
export function wireReviews(root, reload) {
  root.querySelectorAll('[data-review]').forEach((f) => bindForm(f, async (d, submitter) => {
    const decision = submitter?.value;
    if (decision === 'aprobar' && !f.elements.confirm.checked) throw Object.assign(new Error('Marca la casilla para confirmar que comprobaste el ingreso.'), {});
    await api(`/api/orders/${f.dataset.review}/review`, { method: 'POST', body: { decision, note: d.note, confirm: f.elements.confirm.checked } });
    toast(decision === 'aprobar' ? 'Pago aprobado. El acceso quedó activado.' : 'Pago rechazado. El comprador puede enviar uno corregido.');
    reload();
  }));
}
