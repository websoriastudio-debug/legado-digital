// Panel del fundador. Cada acción la vuelve a comprobar el servidor; aquí solo se presenta y se pide confirmación.
import { api, applyPrices, esc, fmtDate, fmtDateTime, money, navigate, state, toast } from './core.js';
import { ACCOUNT, badge, bindForm, empty, reviewCard, shell, wireReviews } from './panel.js';
import { field } from './home.js';

const SECTIONS = [
  ['/admin', 'Resumen', 'inicio'], ['/admin/pagos', 'Pagos por revisar', 'pagos'], ['/admin/pedidos', 'Pedidos y ventas', 'pedidos'],
  ['/admin/usuarios', 'Usuarios y permisos', 'clientes'], ['/admin/red', 'Red de referidos', 'red'], ['/admin/planes', 'Planes y cursos', 'cursos'],
  ['/admin/cobros', 'Cobros y reglas', 'comisiones'], ['/admin/liquidaciones', 'Liquidaciones', 'ventas'], ['/admin/avisos', 'Avisos y comunidad', 'avisos'],
  ['/admin/configuracion', 'Configuración', 'ajustes'], ['/admin/registro', 'Registro y exportaciones', 'registro'], ['/admin/seguridad', 'Seguridad', 'seguridad'],
  ['/mi-cuenta', 'Ver mi oficina', 'web'],
];
const METHODS = { yape: 'Yape', plin: 'Plin', deposito: 'Depósito bancario', transferencia: 'Transferencia bancaria' };

async function frame(main, path, title, render) {
  const { pending } = await api('/api/me/reviews').then((r) => ({ pending: r.reviews.length })).catch(() => ({ pending: 0 }));
  const body = await render();
  const sections = SECTIONS.map(([href, label, icon]) => ({ href, label, icon, badge: href === '/admin/pagos' ? pending : 0 }));
  const root = shell(main, { area: 'fundador', sections, current: path, title: esc(title), body: typeof body === 'string' ? body : body.html, sideNote: 'Fundador · Legado Digital' });
  if (typeof body === 'object' && body.wire) body.wire(root);
  return root;
}
const reasonField = (id) => `<label class="sr-only" for="${id}">Motivo</label><input id="${id}" name="reason" placeholder="Motivo (obligatorio)">`;
const go = (path) => () => navigate(path, { replace: true });

/* ---------- Resumen ---------- */
export function renderFounderHome(main) {
  return frame(main, '/admin', 'Resumen', async () => {
    const o = await api('/api/admin/overview');
    const usd = (c) => money(c);
    return `
      ${o.readiness.open ? '<div class="callout"><p>Todo lo indispensable está configurado: las ventas reales pueden abrirse.</p></div>'
        : `<div class="callout callout--warn"><div><p><strong>Las ventas reales están bloqueadas.</strong> Falta:</p><ul class="plain">${o.readiness.missing.map((m) => `<li>${esc(m)}</li>`).join('')}</ul></div><a class="btn btn--gold btn--small" href="/admin/configuracion"><span class="btn__in">Completar configuración</span></a></div>`}
      <div class="stat-cards">${[['last7', 'Últimos 7 días'], ['last30', 'Últimos 30 días'], ['total', 'Acumulado']].map(([k, l]) => `<article class="stat-card"><span>Ventas brutas · ${l}</span><strong>${usd(o.gross[k])}</strong></article>`).join('')}</div>
      <p class="note">Importes en ${o.currency}, netos de devoluciones. Actualizado: ${fmtDateTime(o.updatedAt)}.</p>
      <div class="kpis">
        <div><span>Cuentas activas</span><strong>${o.users.activo}</strong></div>
        <div><span>Cuentas pendientes</span><strong>${o.users.pendiente}</strong></div>
        <div><span>Suspendidas</span><strong>${o.users.suspendido}</strong></div>
        <div><span>Pagos que puedes revisar</span><strong>${o.reviewsForMe}</strong></div>
        <div><span>Pedidos en revisión</span><strong>${o.orders.en_revision}</strong></div>
        <div><span>Pendientes de pago</span><strong>${o.orders.pendiente_pago}</strong></div>
      </div>
      <h2 class="subhead">Tu red por generación</h2>
      ${o.network.length ? `<ul class="gens">${o.network.map((g) => `<li><span>Generación ${g.depth}</span><strong>${g.n}</strong></li>`).join('')}</ul>` : empty('Aún no hay personas en la red.')}
      <h2 class="subhead">Actividad reciente</h2>
      ${o.activity.length ? `<ul class="plain activity">${o.activity.map((a) => `<li><strong>${esc(a.action)}</strong> ${esc(a.target || '')} <small>${esc(a.actor || 'Sistema')} · ${fmtDateTime(a.created_at)}</small></li>`).join('')}</ul>` : empty('Sin actividad todavía.')}`;
  });
}

/* ---------- Pagos ---------- */
export function renderFounderReviews(main) {
  const again = () => frame(main, '/admin/pagos', 'Pagos por revisar', async () => {
    const { reviews } = await api('/api/me/reviews');
    return { html: `<p class="note">Aquí ves los cobros de la plataforma y los de vendedores. En un cobro directo de un vendedor, intervenir exige un motivo y queda registrado.</p>${reviews.length ? reviews.map((o) => reviewCard(o, { canAct: true })).join('') : empty('No hay pagos por revisar.')}`, wire: (root) => wireReviews(root, again) };
  });
  return again();
}

/* ---------- Pedidos ---------- */
export function renderFounderOrders(main) {
  const again = () => frame(main, '/admin/pedidos', 'Pedidos y ventas', async () => {
    const q = new URLSearchParams(location.search);
    const { orders } = await api(`/api/admin/orders?${q}`);
    const sel = (name, opts) => `<select id="o-${name}" name="${name}"><option value="">Todos</option>${opts.map(([v, l]) => `<option value="${v}" ${q.get(name) === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    return {
      html: `<form class="filters" id="of">${field('o-estado', 'Estado', sel('estado', [['pendiente_pago', 'Pendiente de pago'], ['en_revision', 'En revisión'], ['aprobado', 'Pago confirmado'], ['rechazado', 'Rechazado'], ['cancelado', 'Cancelado']]), false)}
        ${field('o-metodo', 'Método', sel('metodo', [['tarjeta', 'Tarjeta'], ...Object.entries(METHODS)]), false)}
        ${field('o-plan', 'Plan', sel('plan', state.programs.map((p) => [p.slug, p.name])), false)}
        <button class="btn btn--line btn--small" type="submit"><span class="btn__in">Filtrar</span></button>
        <a class="link" href="/api/admin/export/pedidos">Exportar CSV</a></form>
      ${orders.length ? orders.map((o) => `<article class="order" aria-labelledby="fo-${o.id}">
        <header><h2 id="fo-${o.id}">${esc(o.code)} · ${esc(o.buyer)} · ${esc(o.planName)}</h2>${badge(o.status)}${o.settlement ? badge('rechazado', o.settlement === 'devuelto' ? 'Devuelto' : 'Contracargo') : ''}</header>
        <p class="muted">Vendedor: ${esc(o.seller)} · ${money(o.baseCents)} · Cobro: ${money(o.chargeCents, o.chargeCurrency)} · ${esc(o.methodName || 'Sin medio')}${o.isDemo ? ' · ficticio' : ''}</p>
        <details><summary>Historial</summary><ol class="order__events">${o.events.map((e) => `<li>${esc(e.note || e.toStatus)}<small>${fmtDateTime(e.createdAt)}</small></li>`).join('')}</ol></details>
        <div class="review__actions">
          ${o.method === 'tarjeta' && o.status !== 'aprobado' ? `<button class="btn btn--line btn--small" type="button" data-reconcile="${o.id}"><span class="btn__in">Consultar al proveedor</span></button>` : ''}
          ${o.status === 'aprobado' && !o.settlement ? `<form class="inline-form" data-refund="${o.id}">${reasonField(`rf-${o.id}`)}<button class="btn btn--text btn--small" type="submit"><span class="btn__in">Registrar devolución</span></button></form>` : ''}
        </div></article>`).join('') : empty('No hay pedidos con estos filtros.')}`,
      wire: (root) => {
        root.querySelector('#of').addEventListener('submit', (e) => { e.preventDefault(); navigate(`/admin/pedidos?${new URLSearchParams([...new FormData(e.currentTarget)].filter(([, v]) => v))}`); });
        root.querySelectorAll('[data-reconcile]').forEach((b) => b.addEventListener('click', async () => {
          try { const r = await api(`/api/admin/orders/${b.dataset.reconcile}/reconcile`, { method: 'POST' }); toast(r.found ? `Estado del proveedor aplicado: ${r.result.applied ? 'con cambios' : r.result.reason}.` : 'El proveedor no informa ningún pago para este pedido.'); again(); }
          catch (err) { toast(err.message, 'error'); }
        }));
        root.querySelectorAll('[data-refund]').forEach((f) => bindForm(f, async (d) => { await api(`/api/admin/orders/${f.dataset.refund}/refund`, { method: 'POST', body: d }); toast('Devolución registrada con sus ajustes.'); again(); }));
      },
    };
  });
  return again();
}

/* ---------- Usuarios ---------- */
export function renderFounderUsers(main) {
  const again = () => frame(main, '/admin/usuarios', 'Usuarios y permisos', async () => {
    const q = new URLSearchParams(location.search);
    const { users } = await api(`/api/admin/users?${q}`);
    return {
      html: `<form class="filters" id="uf">${field('u-q', 'Buscar', `<input id="u-q" name="q" value="${esc(q.get('q') || '')}">`, false)}
        ${field('u-e', 'Estado', `<select id="u-e" name="estado"><option value="">Todos</option>${Object.entries(ACCOUNT).map(([k, l]) => `<option value="${k}" ${q.get('estado') === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`, false)}
        <button class="btn btn--line btn--small" type="submit"><span class="btn__in">Buscar</span></button><a class="link" href="/api/admin/export/usuarios">Exportar CSV</a></form>
      ${users.filter((u) => !u.founder).map((u) => `<article class="order user-card" aria-labelledby="us-${u.id}">
        <header><h2 id="us-${u.id}">${esc(u.name)}</h2>${badge(u.accountStatus === 'activo' ? 'aprobado' : u.accountStatus === 'suspendido' ? 'rechazado' : 'pendiente_pago', ACCOUNT[u.accountStatus])}</header>
        <p class="muted">${esc(u.email)} · ${esc(u.country)} · Nivel ${u.level || '—'} · Patrocinador: ${esc(u.sponsor || 'Ninguno')} · ${u.emailVerified ? 'Correo confirmado' : 'Correo sin confirmar'}${u.canVerify ? ' · Verificador delegado' : ''}${u.isDemo ? ' · ficticio' : ''}</p>
        <details><summary>Acciones</summary><div class="actions-grid">
          ${u.accountStatus !== 'pendiente' ? `<form class="inline-form" data-status="${u.id}"><input type="hidden" name="status" value="${u.accountStatus === 'activo' ? 'suspendido' : 'activo'}">${reasonField(`st-${u.id}`)}<button class="btn btn--line btn--small" type="submit"><span class="btn__in">${u.accountStatus === 'activo' ? 'Suspender' : 'Reactivar'}</span></button></form>` : ''}
          <form class="inline-form" data-grant="${u.id}"><label class="sr-only" for="gp-${u.id}">Plan</label><select id="gp-${u.id}" name="plan">${state.programs.map((p) => `<option value="${p.slug}">${esc(p.name)}</option>`).join('')}</select>${reasonField(`gr-${u.id}`)}<button class="btn btn--line btn--small" type="submit"><span class="btn__in">Conceder plan</span></button></form>
          ${u.accountStatus === 'activo' ? `<form class="inline-form" data-verifier="${u.id}"><input type="hidden" name="enabled" value="${u.canVerify ? '' : '1'}">${reasonField(`vf-${u.id}`)}<button class="btn btn--line btn--small" type="submit"><span class="btn__in">${u.canVerify ? 'Retirar verificador' : 'Delegar verificación'}</span></button></form>` : ''}
          <form class="inline-form" data-sponsor="${u.id}"><label class="sr-only" for="sp-${u.id}">Código del nuevo patrocinador</label><input id="sp-${u.id}" name="code" placeholder="Código del patrocinador">${reasonField(`sr-${u.id}`)}
            <label class="check"><input type="checkbox" name="reassignOpen"><span>Reasignar pedidos abiertos</span></label><button class="btn btn--line btn--small" type="submit"><span class="btn__in">Cambiar patrocinador</span></button></form>
        </div></details></article>`).join('') || empty('Sin resultados.')}`,
      wire: (root) => {
        root.querySelector('#uf').addEventListener('submit', (e) => { e.preventDefault(); navigate(`/admin/usuarios?${new URLSearchParams([...new FormData(e.currentTarget)].filter(([, v]) => v))}`); });
        const act = (sel, path, map, msg) => root.querySelectorAll(sel).forEach((f) => bindForm(f, async (d) => { await api(path(f), { method: 'POST', body: map(d) }); toast(msg); again(); }));
        act('[data-status]', (f) => `/api/admin/users/${f.dataset.status}/status`, (d) => d, 'Estado actualizado y registrado.');
        act('[data-grant]', (f) => `/api/admin/users/${f.dataset.grant}/grant`, (d) => d, 'Plan concedido y registrado.');
        act('[data-verifier]', (f) => `/api/admin/users/${f.dataset.verifier}/verifier`, (d) => ({ enabled: d.enabled === '1', reason: d.reason }), 'Permiso de verificación actualizado.');
        act('[data-sponsor]', (f) => `/api/admin/users/${f.dataset.sponsor}/sponsor`, (d) => ({ code: d.code, reason: d.reason, reassignOpen: d.reassignOpen === 'on' }), 'Patrocinador cambiado y registrado.');
      },
    };
  });
  return again();
}

/* ---------- Red ---------- */
export function renderFounderNetwork(main) {
  return frame(main, '/admin/red', 'Red de referidos', async () => {
    const parent = new URLSearchParams(location.search).get('parent');
    const page = Number(new URLSearchParams(location.search).get('page') || 1);
    const { nodes, hasMore } = await api(`/api/admin/network?${parent ? `parent=${parent}&` : ''}page=${page}`);
    return `<p class="note">Mostrar la red no implica pagar por sus generaciones: la remuneración configurada es solo por ventas directas verificadas.</p>
      ${parent ? '<p><a class="link" href="/admin/red">Volver al inicio de la red</a></p>' : ''}
      ${nodes.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>Persona</th><th>Estado</th><th>Nivel</th><th>Directos</th><th>Total en su red</th><th></th></tr></thead><tbody>
        ${nodes.map((n) => `<tr><td>${esc(`${n.first_name} ${n.last_name}`)}<br><small>${esc(n.email)}</small></td><td>${esc(ACCOUNT[n.account_status])}</td><td>${n.level || '—'}</td><td>${n.direct}</td><td>${n.total}</td><td>${n.direct ? `<a class="link" href="/admin/red?parent=${n.id}">Ver su red</a>` : ''}</td></tr>`).join('')}
      </tbody></table></div>` : empty('No hay personas en este nivel.')}
      <nav class="pager" aria-label="Páginas">${page > 1 ? `<a class="link" href="?${parent ? `parent=${parent}&` : ''}page=${page - 1}">Anterior</a>` : ''}${hasMore ? `<a class="link" href="?${parent ? `parent=${parent}&` : ''}page=${page + 1}">Siguiente</a>` : ''}</nav>`;
  });
}

/* ---------- Planes y cursos ---------- */
export function renderFounderPlans(main) {
  const again = () => frame(main, '/admin/planes', 'Planes y cursos', async () => {
    const { courses } = await api('/api/admin/catalog');
    return {
      html: `<p class="note">Editar un plan no cambia los pedidos ya creados: cada pedido guarda su nombre y su importe.</p>
      ${state.programs.map((p) => `<details class="lesson-edit"><summary>${esc(p.name)} · ${money(p.priceCents)}</summary>
        <form class="form" data-plan="${p.slug}" novalidate>
          ${field(`pn-${p.slug}`, 'Nombre', `<input id="pn-${p.slug}" name="name" value="${esc(p.name)}">`)}
          ${field(`pp-${p.slug}`, 'Precio en USD', `<input id="pp-${p.slug}" name="price" inputmode="decimal" value="${p.priceCents / 100}">`)}
          ${field(`pt-${p.slug}`, 'Descripción', `<input id="pt-${p.slug}" name="tagline" value="${esc(p.tagline)}">`)}
          ${field(`pf-${p.slug}`, 'Contenido incluido <small>(una línea por punto)</small>', `<textarea id="pf-${p.slug}" name="features" rows="6">${esc(p.features.join('\n'))}</textarea>`)}
          <p class="form-status" role="alert"></p><button class="btn btn--line btn--small" type="submit"><span class="btn__in">Guardar plan</span></button>
        </form></details>`).join('')}
      <h2 class="subhead">Cursos, módulos y lecciones</h2>
      ${courses.map((c) => `<section class="course"><header><h2>${esc(c.title)}</h2><span class="muted">${esc(c.plan_name)}</span></header>
        ${c.modules.map((m) => `<h3 class="module-title">${esc(m.title)}</h3>${m.lessons.map((l) => `<details class="lesson-edit"><summary>${esc(l.title)} ${badge(l.status === 'publicada' ? 'aprobado' : 'pendiente_pago', l.status === 'publicada' ? 'Publicada' : 'Pendiente de publicación')}</summary>
          <form class="form" data-lesson="${l.id}" novalidate>
            ${field(`lt-${l.id}`, 'Título', `<input id="lt-${l.id}" name="title" value="${esc(l.title)}">`)}
            ${field(`ls-${l.id}`, 'Resumen', `<input id="ls-${l.id}" name="summary" value="${esc(l.summary)}">`)}
            ${field(`lb-${l.id}`, 'Contenido', `<textarea id="lb-${l.id}" name="body" rows="6">${esc(l.body)}</textarea>`)}
            ${field(`le-${l.id}`, 'Estado', `<select id="le-${l.id}" name="status"><option value="preparacion" ${l.status === 'preparacion' ? 'selected' : ''}>Pendiente de publicación</option><option value="publicada" ${l.status === 'publicada' ? 'selected' : ''}>Publicada</option></select>`)}
            <p class="form-status" role="alert"></p><button class="btn btn--line btn--small" type="submit"><span class="btn__in">Guardar lección</span></button>
          </form>
          <ul class="resources">${l.resources.map((r) => `<li>${esc(r.title)} <small>${Math.ceil(r.size / 1024)} KB</small> <button class="btn btn--text btn--small" type="button" data-remove="${r.id}"><span class="btn__in">Retirar</span></button></li>`).join('')}</ul>
          <form class="inline-form" data-resource="${l.id}"><label class="sr-only" for="rt-${l.id}">Nombre del recurso</label><input id="rt-${l.id}" name="title" placeholder="Nombre del recurso"><label class="sr-only" for="rfile-${l.id}">Archivo</label><input id="rfile-${l.id}" name="file" type="file" accept="application/pdf,image/png,image/jpeg,image/webp"><button class="btn btn--line btn--small" type="submit"><span class="btn__in">Subir recurso</span></button></form>
        </details>`).join('')}
          <form class="inline-form" data-newlesson="${m.id}"><label class="sr-only" for="nl-${m.id}">Título</label><input id="nl-${m.id}" name="title" placeholder="Título de la nueva lección"><label class="sr-only" for="ns-${m.id}">Resumen</label><input id="ns-${m.id}" name="summary" placeholder="Resumen"><button class="btn btn--line btn--small" type="submit"><span class="btn__in">Añadir lección</span></button></form>`).join('')}
        <form class="inline-form" data-newmodule="${c.id}"><label class="sr-only" for="nm-${c.id}">Módulo</label><input id="nm-${c.id}" name="title" placeholder="Título del nuevo módulo"><button class="btn btn--line btn--small" type="submit"><span class="btn__in">Añadir módulo</span></button></form>
      </section>`).join('')}`,
      wire: (root) => {
        root.querySelectorAll('[data-plan]').forEach((f) => bindForm(f, async (d) => {
          const cents = Math.round(Number(String(d.price).replace(',', '.')) * 100);
          const r = await api(`/api/admin/plans/${f.dataset.plan}`, { method: 'PATCH', body: { name: d.name, priceCents: cents, tagline: d.tagline, features: d.features.split('\n') } });
          applyPrices(r.programs); toast('Plan guardado.'); again();
        }));
        root.querySelectorAll('[data-lesson]').forEach((f) => bindForm(f, async (d) => { await api(`/api/admin/lessons/${f.dataset.lesson}`, { method: 'PATCH', body: d }); toast('Lección guardada.'); again(); }));
        root.querySelectorAll('[data-newlesson]').forEach((f) => bindForm(f, async (d) => { await api('/api/admin/lessons', { method: 'POST', body: { moduleId: f.dataset.newlesson, ...d } }); toast('Lección añadida.'); again(); }));
        root.querySelectorAll('[data-newmodule]').forEach((f) => bindForm(f, async (d) => { await api('/api/admin/modules', { method: 'POST', body: { courseId: f.dataset.newmodule, ...d } }); toast('Módulo añadido.'); again(); }));
        root.querySelectorAll('[data-resource]').forEach((f) => bindForm(f, async (d) => {
          const file = f.elements.file.files[0];
          if (!file) throw new Error('Elige un archivo.');
          await api(`/api/admin/lessons/${f.dataset.resource}/resources?titulo=${encodeURIComponent(d.title)}`, { method: 'POST', raw: file }); toast('Recurso subido.'); again();
        }));
        root.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', async () => { try { await api(`/api/admin/resources/${b.dataset.remove}`, { method: 'DELETE' }); toast('Recurso retirado.'); again(); } catch (err) { toast(err.message, 'error'); } }));
      },
    };
  });
  return again();
}

/* ---------- Cobros y reglas ---------- */
export function renderFounderPayments(main) {
  const again = () => frame(main, '/admin/cobros', 'Cobros y reglas', async () => {
    const [{ settings }, { rules }] = await Promise.all([api('/api/admin/settings'), api('/api/admin/rules')]);
    const pay = settings.payments; const fx = settings.fx; const pol = settings.policies;
    const active = rules.find((r) => r.enabled);
    return {
      html: `<p class="note">Guardar cuentas, tipo de cambio o políticas pide confirmar tu contraseña. Los cambios se aplican a pedidos nuevos; los anteriores conservan su copia.</p>
      <form class="form" id="modes" novalidate><h2 class="subhead">Modalidades de cobro</h2>
        <label class="check"><input type="checkbox" name="centralizado" ${pay.modes.centralizado ? 'checked' : ''}><span>Cobro centralizado: la plataforma recibe el pago</span></label>
        <label class="check"><input type="checkbox" name="directo" ${pay.modes.directo ? 'checked' : ''}><span>Cobro directo al vendedor: el comprador paga al medio que el vendedor configuró</span></label>
        ${Object.entries(METHODS).map(([k, l]) => { const m = pay.platform[k]; return `<fieldset class="method-set"><legend>${l} de la plataforma</legend>
          <label class="check"><input type="checkbox" name="${k}.enabled" ${m.enabled ? 'checked' : ''}><span>Habilitado</span></label>
          ${field(`${k}-h`, 'Titular', `<input id="${k}-h" name="${k}.holder" value="${esc(m.holder || '')}">`, false)}
          ${field(`${k}-a`, 'Número o cuenta', `<input id="${k}-a" name="${k}.account" value="${esc(m.account || '')}">`, false)}
          ${['deposito', 'transferencia'].includes(k) ? `${field(`${k}-b`, 'Banco', `<input id="${k}-b" name="${k}.bank" value="${esc(m.bank || '')}">`, false)}
            ${field(`${k}-c`, 'Moneda', `<select id="${k}-c" name="${k}.currency"><option value="">Elegir</option><option value="PEN" ${m.currency === 'PEN' ? 'selected' : ''}>Soles</option><option value="USD" ${m.currency === 'USD' ? 'selected' : ''}>Dólares</option></select>`, false)}` : ''}
          ${field(`${k}-i`, 'Instrucciones para el comprador', `<input id="${k}-i" name="${k}.instructions" value="${esc(m.instructions || '')}">`, false)}
        </fieldset>`; }).join('')}
        <fieldset class="method-set"><legend>Tarjeta</legend>
          <p class="note">Las credenciales de la pasarela van en variables del servidor, nunca aquí.</p>
          <label class="check"><input type="checkbox" name="card.enabled" ${pay.card.enabled ? 'checked' : ''}><span>Habilitada (requiere pasarela integrada)</span></label>
          ${field('cp', 'Proveedor', `<input id="cp" name="card.provider" value="${esc(pay.card.provider || '')}">`, false)}
          ${field('ca', 'Quién asume el coste de procesamiento', `<select id="ca" name="card.absorbedBy"><option value="">Sin definir</option><option value="legado" ${pay.card.absorbedBy === 'legado' ? 'selected' : ''}>Legado Digital</option><option value="comprador" ${pay.card.absorbedBy === 'comprador' ? 'selected' : ''}>El comprador (recargo autorizado)</option></select>`, false)}
          ${field('cb', 'Recargo al comprador: porcentaje', `<input id="cb" name="card.percent" inputmode="decimal" value="${pay.card.buyerFee ? pay.card.buyerFee.percentBps / 100 : ''}">`, false)}
          ${field('cf', 'Recargo al comprador: parte fija en USD', `<input id="cf" name="card.fixed" inputmode="decimal" value="${pay.card.buyerFee ? pay.card.buyerFee.fixedCents / 100 : ''}">`, false)}
        </fieldset>
        ${field('wl', 'Límite de Yape y Plin en soles (opcional)', `<input id="wl" name="walletLimit" inputmode="decimal" value="${pay.walletLimitPenCents ? pay.walletLimitPenCents / 100 : ''}">`, false)}
        <p class="form-status" role="alert"></p><button class="btn btn--gold" type="submit"><span class="btn__in">Guardar cobros</span></button>
      </form>
      <form class="form form--narrow" id="fx" novalidate><h2 class="subhead">Tipo de cambio para cobrar en soles</h2>
        <p class="note">${fx ? `Vigente: S/ ${fx.rate / 10000} por dólar hasta ${fmtDateTime(fx.validUntil)} (${esc(fx.source)}).` : 'Sin tipo de cambio: no se puede cobrar en soles.'}</p>
        ${field('fx-r', 'Soles por dólar', '<input id="fx-r" name="rate" inputmode="decimal" placeholder="3.7500">')}
        ${field('fx-v', 'Vigente hasta', '<input id="fx-v" name="validUntil" type="datetime-local">')}
        <p class="form-status" role="alert"></p><button class="btn btn--line" type="submit"><span class="btn__in">Guardar tipo de cambio</span></button>
      </form>
      <h2 class="subhead">Reglas de comisión</h2>
      <p class="note">${active ? `Vigente: versión ${active.version}, ${active.direct_bps / 100} % sobre ventas directas cobradas por la plataforma.` : 'No hay ninguna regla habilitada: no se generan comisiones y las liquidaciones están bloqueadas.'} Bonos y regalías: no definidos.</p>
      ${rules.length ? `<ul class="plain">${rules.map((r) => `<li>Versión ${r.version}: ${r.direct_bps === null ? 'sin porcentaje' : `${r.direct_bps / 100} %`} · ${r.enabled ? 'habilitada' : 'no habilitada'} · ${fmtDate(r.created_at)}${r.notes ? ` · ${esc(r.notes)}` : ''}</li>`).join('')}</ul>` : ''}
      <form class="form form--narrow" id="rule" novalidate>
        ${field('r-p', 'Comisión por venta directa (%)', '<input id="r-p" name="directPercent" inputmode="decimal">', false)}
        ${field('r-n', 'Nota', '<input id="r-n" name="notes">', false)}
        <label class="check"><input type="checkbox" name="enabled"><span>Habilitar esta versión (las ventas ya confirmadas no se recalculan)</span></label>
        <p class="form-status" role="alert"></p>
        <div class="review__actions"><button class="btn btn--line" type="submit"><span class="btn__in">Guardar nueva versión</span></button>${active ? '<button class="btn btn--text" type="button" data-disable><span class="btn__in">Desactivar comisiones</span></button>' : ''}</div>
      </form>
      <form class="form form--narrow" id="policies" novalidate><h2 class="subhead">Políticas</h2>
        ${field('po-r', 'Reventa', `<select id="po-r" name="resale"><option value="plan_e_inferiores" selected>Su plan y los inferiores (regla inicial)</option></select>`)}
        ${field('po-s', 'Cuenta suspendida', `<select id="po-s" name="suspension"><option value="restringir_todo" ${pol.suspension === 'restringir_todo' ? 'selected' : ''}>Restringir formación y ventas</option><option value="mantener_formacion" ${pol.suspension === 'mantener_formacion' ? 'selected' : ''}>Mantener la formación, bloquear ventas</option></select>`)}
        ${field('po-d', 'Acceso tras una devolución', `<select id="po-d" name="refundAccess"><option value="pendiente" ${pol.refundAccess === 'pendiente' ? 'selected' : ''}>Sin definir: no cambiar el acceso</option><option value="revocar" ${pol.refundAccess === 'revocar' ? 'selected' : ''}>Retirar el acceso del pedido devuelto</option></select>`)}
        <p class="form-status" role="alert"></p><button class="btn btn--line" type="submit"><span class="btn__in">Guardar políticas</span></button>
      </form>`,
      wire: (root) => {
        bindForm(root.querySelector('#modes'), async (d) => {
          const on = (k) => d[k] === 'on';
          const num = (v) => (String(v ?? '').trim() === '' ? null : Math.round(Number(String(v).replace(',', '.')) * 100));
          const platform = Object.fromEntries(Object.keys(METHODS).map((k) => [k, { enabled: on(`${k}.enabled`), holder: d[`${k}.holder`] || null, account: d[`${k}.account`] || null, bank: d[`${k}.bank`] || null,
            currency: ['yape', 'plin'].includes(k) ? 'PEN' : d[`${k}.currency`] || null, instructions: d[`${k}.instructions`] || null }]));
          const percent = num(d['card.percent']); const fixed = num(d['card.fixed']);
          await api('/api/admin/settings/payments', { method: 'PUT', body: {
            modes: { centralizado: on('centralizado'), directo: on('directo') }, platform,
            card: { enabled: on('card.enabled'), provider: d['card.provider'] || null, absorbedBy: d['card.absorbedBy'] || null, buyerFee: d['card.absorbedBy'] === 'comprador' && (percent !== null || fixed !== null) ? { percentBps: percent ?? 0, fixedCents: fixed ?? 0, mode: 'sobre_base' } : null },
            walletLimitPenCents: num(d.walletLimit),
          } });
          toast('Cobros guardados.'); again();
        });
        bindForm(root.querySelector('#fx'), async (d) => { await api('/api/admin/settings/fx', { method: 'PUT', body: { rate: d.rate, validUntil: d.validUntil ? new Date(d.validUntil).toISOString() : '' } }); toast('Tipo de cambio guardado.'); again(); });
        bindForm(root.querySelector('#rule'), async (d) => { const r = await api('/api/admin/rules', { method: 'POST', body: { directPercent: d.directPercent, notes: d.notes, enabled: d.enabled === 'on' } }); toast(`Versión ${r.version} guardada.`); again(); });
        root.querySelector('[data-disable]')?.addEventListener('click', async () => { try { await api('/api/admin/rules/disable', { method: 'POST' }); toast('Comisiones desactivadas.'); again(); } catch (err) { toast(err.message, 'error'); } });
        bindForm(root.querySelector('#policies'), async (d) => { await api('/api/admin/settings/policies', { method: 'PUT', body: d }); toast('Políticas guardadas.'); again(); });
      },
    };
  });
  return again();
}

/* ---------- Liquidaciones ---------- */
export function renderFounderPayouts(main) {
  const again = () => frame(main, '/admin/liquidaciones', 'Liquidaciones', async () => {
    const { enabled, users, payouts } = await api('/api/admin/payouts');
    return {
      html: `${enabled ? '' : '<div class="callout"><p>Las liquidaciones están bloqueadas hasta habilitar una regla de comisión. Los desembolsos automáticos están desactivados.</p></div>'}
      <p class="note">Solo se liquida lo que custodia la plataforma. Registrar una liquidación anota un pago que ya hiciste por fuera; no mueve dinero.</p>
      ${users.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>Vendedor</th><th>Disponible</th><th>Registrar pago realizado</th></tr></thead><tbody>
        ${users.map((u) => `<tr><td>${esc(u.name)}</td><td>${money(u.availableCents)}</td><td><form class="inline-form" data-payout="${u.id}"><label class="sr-only" for="pa-${u.id}">Importe</label><input id="pa-${u.id}" name="amount" inputmode="decimal" placeholder="Importe USD"><label class="sr-only" for="pr-${u.id}">Referencia</label><input id="pr-${u.id}" name="reference" placeholder="Referencia del pago"><button class="btn btn--line btn--small" type="submit" ${enabled ? '' : 'disabled'}><span class="btn__in">Registrar</span></button></form></td></tr>`).join('')}
      </tbody></table></div>` : empty('No hay saldos custodiados por liquidar.')}
      <h2 class="subhead">Historial</h2>
      ${payouts.length ? `<ul class="plain">${payouts.map((p) => `<li>${esc(`${p.first_name} ${p.last_name}`)} · ${money(p.amount_cents)} · ${esc(p.reference)} · ${fmtDate(p.created_at)}</li>`).join('')}</ul>` : empty('Sin liquidaciones registradas.')}`,
      wire: (root) => root.querySelectorAll('[data-payout]').forEach((f) => bindForm(f, async (d) => {
        await api('/api/admin/payouts', { method: 'POST', body: { userId: Number(f.dataset.payout), amountCents: Math.round(Number(String(d.amount).replace(',', '.')) * 100), reference: d.reference } });
        toast('Liquidación registrada.'); again();
      })),
    };
  });
  return again();
}

/* ---------- Avisos y comunidad ---------- */
export function renderFounderNotices(main) {
  const again = () => frame(main, '/admin/avisos', 'Avisos y comunidad', async () => {
    const [{ settings }, { notifications }, { contacts }] = await Promise.all([api('/api/admin/settings'), api('/api/me/notifications'), api('/api/admin/contacts')]);
    return {
      html: `<form class="form form--narrow" id="broadcast" novalidate><h2 class="subhead">Aviso general</h2>
        ${field('b-t', 'Título', '<input id="b-t" name="title" required>')}
        ${field('b-b', 'Mensaje', '<textarea id="b-b" name="body" rows="3" required></textarea>')}
        <p class="form-status" role="alert"></p><button class="btn btn--gold" type="submit"><span class="btn__in">Enviar a todas las cuentas</span></button></form>
      <form class="form form--narrow" id="community" novalidate><h2 class="subhead">Enlaces de comunidad</h2>
        ${field('cm-t', 'Canal de Telegram', `<input id="cm-t" name="telegram" type="url" placeholder="https://t.me/…" value="${esc(settings.community.telegram || '')}">`, false)}
        ${field('cm-f', 'Grupo de Facebook', `<input id="cm-f" name="facebook" type="url" placeholder="https://facebook.com/groups/…" value="${esc(settings.community.facebook || '')}">`, false)}
        <p class="form-status" role="alert"></p><button class="btn btn--line" type="submit"><span class="btn__in">Guardar enlaces</span></button></form>
      <h2 class="subhead">Tus notificaciones</h2>
      ${notifications.length ? `<ul class="notes-list">${notifications.map((n) => `<li class="${n.readAt ? '' : 'is-new'}"><strong>${esc(n.title)}</strong><p>${esc(n.body)}</p><small>${fmtDateTime(n.createdAt)}</small></li>`).join('')}</ul>` : empty('Sin notificaciones.')}
      <h2 class="subhead">Consultas y soporte recibidos</h2>
      ${contacts.length ? contacts.map((c) => `<article class="order"><header><h2>${esc(c.name)}</h2><small>${fmtDateTime(c.created_at)}</small></header><p class="muted">${esc(c.email)}${c.phone ? ` · ${esc(c.phone)}` : ''}</p><p>${esc(c.message)}</p></article>`).join('') : empty('Aún no hay consultas.')}`,
      wire: (root) => {
        api('/api/me/notifications/read', { method: 'POST' }).catch(() => {});
        bindForm(root.querySelector('#broadcast'), async (d) => { const r = await api('/api/admin/notifications', { method: 'POST', body: d }); toast(`Aviso enviado a ${r.sent} cuentas.`); again(); });
        bindForm(root.querySelector('#community'), async (d) => {
          for (const v of [d.telegram, d.facebook]) if (v && !/^https:\/\//.test(v)) throw new Error('Los enlaces deben empezar por https://');
          await api('/api/admin/settings/community', { method: 'PUT', body: { telegram: d.telegram || null, facebook: d.facebook || null } }); toast('Enlaces guardados.'); again();
        });
      },
    };
  });
  return again();
}

/* ---------- Configuración (asistente) ---------- */
export function renderFounderSettings(main) {
  const again = () => frame(main, '/admin/configuracion', 'Configuración', async () => {
    const { settings, readiness } = await api('/api/admin/settings');
    const b = settings.business; const l = settings.legal;
    const input = (id, name, label, value, opt = true, type = 'text') => field(id, label, `<input id="${id}" name="${name}" type="${type}" value="${esc(value || '')}">`, !opt);
    return {
      html: `<p class="note">No se inventa ningún dato. Lo que falte bloquea la apertura de ventas reales y aparece en el resumen.</p>
      ${readiness.missing.length ? `<div class="callout callout--warn"><div><p><strong>Falta para abrir ventas:</strong></p><ul class="plain">${readiness.missing.map((m) => `<li>${esc(m)}</li>`).join('')}</ul></div></div>` : '<div class="callout"><p>Configuración indispensable completa.</p></div>'}
      <ol class="wizard">
        <li><form class="form" id="business" novalidate><h2 class="subhead">1. Negocio y titular</h2>
          ${input('bz-n', 'tradeName', 'Nombre comercial', b.tradeName)}
          ${input('bz-h', 'holder', 'Titular o empresa', b.holder)}
          ${input('bz-c', 'country', 'País de operación', b.country)}
          ${input('bz-t', 'taxId', 'Identificación fiscal (si corresponde)', b.taxId)}
          ${input('bz-a', 'address', 'Dirección', b.address)}
          ${input('bz-e', 'supportEmail', 'Correo de soporte', b.supportEmail, true, 'email')}
          ${input('bz-w', 'whatsapp', 'WhatsApp de soporte', b.whatsapp)}
          <p class="form-status" role="alert"></p><button class="btn btn--line" type="submit"><span class="btn__in">Guardar</span></button></form></li>
        <li><h2 class="subhead">2. Cobros, beneficiarios y reglas</h2><p>Se configuran en <a class="link" href="/admin/cobros">Cobros y reglas</a>.</p></li>
        <li><form class="form" id="legal" novalidate><h2 class="subhead">3. Condiciones y privacidad</h2>
          <p class="note">Los textos legales son borradores hasta que un abogado los revise para tu jurisdicción. Cada usuario acepta la versión indicada aquí.</p>
          ${input('lg-v', 'version', 'Versión de las condiciones', l.version)}
          ${input('lg-a', 'accessTerm', 'Duración del acceso', l.accessTerm)}
          ${input('lg-rw', 'refundWindow', 'Plazo de devolución', l.refundWindow)}
          ${input('lg-rc', 'refundCases', 'Casos de devolución', l.refundCases)}
          ${input('lg-lt', 'licenseTerm', 'Condiciones de la licencia de reventa', l.licenseTerm)}
          ${input('lg-re', 'retention', 'Plazo de conservación de datos', l.retention)}
          ${input('lg-p', 'providers', 'Proveedores (alojamiento, pagos, correo)', l.providers)}
          <label class="check"><input type="checkbox" name="reviewed" ${l.reviewed ? 'checked' : ''}><span>Un abogado revisó los textos legales</span></label>
          <p class="form-status" role="alert"></p><button class="btn btn--line" type="submit"><span class="btn__in">Guardar</span></button></form></li>
        <li><form class="form" id="mail" novalidate><h2 class="subhead">4. Correo transaccional y facturación</h2>
          <p class="note">Las credenciales del proveedor de correo van en variables del servidor. Aquí solo se indica cuál se usa.</p>
          ${input('ml-p', 'provider', 'Proveedor de correo', settings.mail.provider)}
          <label class="check"><input type="checkbox" name="billing" ${settings.billing.enabled ? 'checked' : ''}><span>Facturación electrónica configurada</span></label>
          <p class="form-status" role="alert"></p><button class="btn btn--line" type="submit"><span class="btn__in">Guardar</span></button></form></li>
      </ol>`,
      wire: (root) => {
        const clean = (d) => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, String(v).trim() || null]));
        bindForm(root.querySelector('#business'), async (d) => { await api('/api/admin/settings/business', { method: 'PUT', body: clean(d) }); toast('Datos del negocio guardados.'); again(); });
        bindForm(root.querySelector('#legal'), async (d) => { await api('/api/admin/settings/legal', { method: 'PUT', body: { ...clean(d), reviewed: d.reviewed === 'on' } }); toast('Condiciones guardadas.'); again(); });
        bindForm(root.querySelector('#mail'), async (d) => {
          await api('/api/admin/settings/mail', { method: 'PUT', body: { provider: String(d.provider || '').trim() || null } });
          await api('/api/admin/settings/billing', { method: 'PUT', body: { enabled: d.billing === 'on' } });
          toast('Guardado.'); again();
        });
      },
    };
  });
  return again();
}

/* ---------- Registro ---------- */
export function renderFounderAudit(main) {
  return frame(main, '/admin/registro', 'Registro y exportaciones', async () => {
    const [{ log }, { mails }] = await Promise.all([api('/api/admin/audit'), api('/api/admin/outbox')]);
    return `<p><a class="btn btn--line btn--small" href="/api/admin/export/pedidos"><span class="btn__in">Exportar pedidos (CSV)</span></a> <a class="btn btn--line btn--small" href="/api/admin/export/usuarios"><span class="btn__in">Exportar usuarios (CSV)</span></a></p>
      <p class="note">Cada exportación queda registrada.</p>
      <div class="table-wrap"><table class="data"><thead><tr><th>Fecha</th><th>Responsable</th><th>Acción</th><th>Objeto</th><th>Detalle</th></tr></thead><tbody>
        ${log.map((l) => `<tr><td>${fmtDateTime(l.created_at)}</td><td>${esc(l.actor || 'Sistema')}</td><td>${esc(l.action)}</td><td>${esc(l.target || '')}</td><td>${esc(l.detail || '')}</td></tr>`).join('')}
      </tbody></table></div>
      <h2 class="subhead">Correos en cola</h2>
      <p class="note">Sin proveedor de correo configurado, estos mensajes no salen de la plataforma.</p>
      ${mails.length ? `<ul class="plain">${mails.map((m) => `<li>${esc(m.subject)} → ${esc(m.to_email)} <small>${m.sent_at ? 'enviado' : 'en cola'} · ${fmtDateTime(m.created_at)}</small></li>`).join('')}</ul>` : empty('No hay correos en cola.')}`;
  });
}

/* ---------- Seguridad ---------- */
export function renderFounderSecurity(main) {
  const again = () => frame(main, '/admin/seguridad', 'Seguridad', async () => ({
    html: `<h2 class="subhead">Doble factor</h2>
      ${state.user.totpEnabled ? '<p>El doble factor está activo en tu cuenta. Al iniciar sesión se te pedirá el código de tu aplicación.</p>'
        : `<p>Protege tu cuenta con una aplicación de autenticación (por ejemplo, la de tu móvil). Se te pedirá confirmar tu contraseña.</p>
        <button class="btn btn--gold" type="button" id="totp-start"><span class="btn__in">Configurar doble factor</span></button>
        <div id="totp-step" hidden>
          <p>Añade esta clave en tu aplicación de autenticación:</p><p class="secret" id="totp-secret"></p>
          <form class="form form--narrow" id="totp-form" novalidate>${field('tc', 'Código de 6 dígitos', '<input id="tc" name="code" inputmode="numeric" autocomplete="one-time-code">')}<p class="form-status" role="alert"></p><button class="btn btn--line" type="submit"><span class="btn__in">Activar</span></button></form>
        </div>`}
      <h2 class="subhead">Copias de seguridad</h2>
      <p>Se hacen desde el servidor con <code>node scripts/backup.mjs</code> y se restauran con <code>node scripts/restore.mjs</code>. La guía de instalación explica el procedimiento.</p>`,
    wire: (root) => {
      root.querySelector('#totp-start')?.addEventListener('click', async () => {
        try { const r = await api('/api/me/totp/start', { method: 'POST' }); root.querySelector('#totp-secret').textContent = r.secret; root.querySelector('#totp-step').hidden = false; root.querySelector('#tc').focus(); }
        catch (err) { toast(err.message, 'error'); }
      });
      const f = root.querySelector('#totp-form');
      if (f) bindForm(f, async (d) => { await api('/api/me/totp/enable', { method: 'POST', body: d }); toast('Doble factor activado.'); again(); });
    },
  }));
  return again();
}
