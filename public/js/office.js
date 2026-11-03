// Oficina del cliente. Lo que se muestra depende del estado real que devuelve el servidor.
import { whatsappLink, whatsappMessages } from '/shared/site.config.mjs';
import { api, choosePlan, esc, fieldError, fmtDate, fmtDateTime, money, navigate, programOf, state, toast } from './core.js';
import { ACCOUNT, avatar, badge, bindForm, empty, icon, reviewCard, shell, statCards, wireReviews } from './panel.js';
import { field } from './home.js';
import { keptPlan } from './account.js';

const METHOD_NAMES = { tarjeta: 'Tarjeta', yape: 'Yape', plin: 'Plin', deposito: 'Depósito bancario', transferencia: 'Transferencia bancaria' };

async function context() {
  const data = await api('/api/me');
  state.user = data.user;
  window.dispatchEvent(new Event('ld:session'));
  const active = data.user.accountStatus === 'activo';
  let pendingReviews = 0;
  if (active) pendingReviews = (await api('/api/me/reviews').catch(() => ({ reviews: [] }))).reviews.length;
  return { ...data, active, pendingReviews };
}

function sections(ctx) {
  const s = [['/mi-cuenta', 'Inicio', 'inicio']];
  if (ctx.active) s.push(['/mi-cuenta/formacion', 'Mi formación', 'formacion'], ['/mi-cuenta/enlace', 'Mi enlace de referido', 'enlace'], ['/mi-cuenta/clientes', 'Mis clientes', 'clientes'],
    ['/mi-cuenta/pagos', 'Pagos por revisar', 'pagos', ctx.pendingReviews], ['/mi-cuenta/ventas', 'Mis ventas', 'ventas'], ['/mi-cuenta/comisiones', 'Comisiones, bonos y regalías', 'comisiones']);
  s.push(['/mi-cuenta/pedidos', 'Mis pedidos', 'pedidos'], ['/mi-cuenta/perfil', 'Mi perfil', 'perfil'], ['/mi-cuenta/notificaciones', 'Notificaciones', 'avisos'],
    ['/mi-cuenta/tutoriales', 'Tutoriales', 'tutoriales'], ['/mi-cuenta/soporte', 'Soporte', 'soporte']);
  if (state.user.founder) s.push(['/admin', 'Panel del fundador', 'ajustes']);
  return s.map(([href, label, ic, b]) => ({ href, label, icon: ic, badge: b }));
}
const planLabel = (ctx) => {
  const top = ctx.entitlements.map((e) => programOf(e.plan)).filter(Boolean).sort((a, b) => b.rank - a.rank)[0];
  return `${top ? `Plan ${top.name}` : 'Sin plan'} · ${ACCOUNT[ctx.user.accountStatus]}`;
};
async function frame(main, path, title, render) {
  const ctx = await context();
  const body = await render(ctx);
  const root = shell(main, { area: 'cliente', sections: sections(ctx), current: path, title: esc(title), body: typeof body === 'string' ? body : body.html, sideNote: planLabel(ctx) });
  if (typeof body === 'object' && body.wire) body.wire(root, ctx);
  return root;
}

/* ---------- Inicio ---------- */
const TILES = [
  ['/mi-cuenta/tutoriales#primeros-pasos', 'Mis primeros pasos', 'Qué hacer al entrar y cómo usar tu oficina.', 'inicio'],
  ['/mi-cuenta/tutoriales#estrategia', 'Estrategia inicial', 'Cómo presentar tu formación con honestidad y sin prometer ingresos.', 'ventas'],
  ['/mi-cuenta/formacion', 'Mi formación', 'Tus cursos, lecciones y progreso.', 'formacion'],
  ['/mi-cuenta/enlace', 'Mi enlace', 'Copia y comparte el enlace de los planes que puedes ofrecer.', 'enlace'],
  ['/mi-cuenta/clientes', 'Mi equipo directo', 'Las personas que se registraron con tu enlace.', 'clientes'],
  ['/mi-cuenta/perfil', 'Ajustes', 'Tus datos, foto, contraseña y medios de cobro.', 'ajustes'],
];

export function renderOfficeHome(main) {
  return frame(main, '/mi-cuenta', `Hola, ${state.user?.firstName ?? ''}`.trim(), async (ctx) => {
    if (!ctx.active) {
      const { orders } = await api('/api/me/orders');
      const open = orders.find((o) => ['pendiente_pago', 'en_revision'].includes(o.status));
      const suspended = ctx.user.accountStatus === 'suspendido';
      const demoLink = new URLSearchParams(location.search).get('verificar');
      const wanted = programOf(keptPlan()) ? keptPlan() : null;
      return {
        html: `
        <p class="lede">${suspended ? 'Tu cuenta está suspendida. Puedes ver su estado y escribirnos.' : 'Tu cuenta está pendiente: completa estos pasos para activar tu acceso.'}</p>
        ${suspended ? `<div class="callout"><p>Para resolverlo, contacta con soporte.</p><a class="btn btn--gold btn--small" href="/mi-cuenta/soporte"><span class="btn__in">Ir a soporte</span></a></div>` : `
        <ol class="checklist">
          <li class="${ctx.user.emailVerified ? 'is-done' : ''}"><strong>Confirma tu correo</strong>${ctx.user.emailVerified ? '<span>Hecho.</span>' : `<span>Revisa tu bandeja de entrada.</span>${demoLink ? `<a class="btn btn--gold btn--small" href="${esc(demoLink)}"><span class="btn__in">Demostración: confirmar mi correo</span></a>` : ''}<button class="btn btn--line btn--small" type="button" data-resend><span class="btn__in">Enviar el enlace otra vez</span></button><p class="note" id="resend-out" role="status"></p>`}</li>
          <li class="${open ? 'is-done' : ''}"><strong>Elige tu plan</strong>${open ? `<span>${esc(open.planName)}, pedido ${esc(open.code)}.</span>`
            : wanted && ctx.user.emailVerified ? `<span>Elegiste ${esc(programOf(wanted).name)}.</span><button class="btn btn--gold btn--small" type="button" data-continue="${wanted}"><span class="btn__in">Continuar con ${esc(programOf(wanted).name)}</span></button>`
            : '<span>Elige el curso con el que quieres empezar.</span><a class="btn btn--line btn--small" href="/#cursos-y-planes"><span class="btn__in">Ver los planes</span></a>'}</li>
          <li class="${open?.status === 'en_revision' ? 'is-done' : ''}"><strong>Paga y envía tu comprobante</strong>${open ? `<span>${badge(open.status)}</span><a class="btn btn--gold btn--small" href="/mi-cuenta/pedidos"><span class="btn__in">Ir a mi pedido</span></a>` : '<span>Después de elegir el plan.</span>'}</li>
          <li><strong>Verificación y activación</strong><span>Quien recibe el dinero comprueba el ingreso y activa tu acceso. Te avisaremos aquí.</span></li>
        </ol>
        ${ctx.sponsor ? `<p class="note">Te atiende: ${esc(ctx.sponsor)}</p>` : ''}`}`,
        wire: (root) => {
          root.querySelector('[data-resend]')?.addEventListener('click', async () => {
            try { const r = await api('/api/auth/verify/resend', { method: 'POST' }); root.querySelector('#resend-out').innerHTML = r.verifyLink ? `Demostración: el correo no está conectado. <a class="link" href="${esc(r.verifyLink)}">Confirmar mi correo</a>` : 'Enlace enviado a tu correo.'; }
            catch (err) { toast(err.message, 'error'); }
          });
          root.querySelector('[data-continue]')?.addEventListener('click', (e) => { try { localStorage.removeItem('ld_plan'); } catch { /* sin almacenamiento */ } choosePlan(e.currentTarget.dataset.continue); });
        },
      };
    }
    return `
      ${statCards(ctx.stats)}
      ${ctx.pendingReviews ? `<div class="callout"><p>Tienes ${ctx.pendingReviews} pago${ctx.pendingReviews > 1 ? 's' : ''} por revisar.</p><a class="btn btn--gold btn--small" href="/mi-cuenta/pagos"><span class="btn__in">Revisar ahora</span></a></div>` : ''}
      <div class="tiles">${TILES.map(([href, t, d, ic]) => `<a class="tile" href="${href}"><span class="tile__icon">${icon(ic, 26)}</span><span><strong>${esc(t)}</strong><small>${esc(d)}</small></span></a>`).join('')}
        ${['telegram', 'facebook'].map((k) => `<a class="tile ${ctx.community[k] ? '' : 'is-off'}" ${ctx.community[k] ? `href="${esc(ctx.community[k])}" target="_blank" rel="noopener noreferrer"` : 'aria-disabled="true"'}><span class="tile__icon">${icon('clientes', 26)}</span><span><strong>${k === 'telegram' ? 'Canal de Telegram' : 'Grupo de Facebook'}</strong><small>${ctx.community[k] ? 'Únete a la comunidad.' : 'Pendiente de configurar por el fundador.'}</small></span></a>`).join('')}
      </div>`;
  });
}

/* ---------- Formación ---------- */
export function renderTraining(main) {
  return frame(main, '/mi-cuenta/formacion', 'Mi formación', async () => {
    const { courses } = await api('/api/me/campus');
    return courses.map((c) => {
      const lessons = c.modules.flatMap((m) => m.lessons);
      const published = lessons.filter((l) => l.status === 'publicada');
      const done = published.filter((l) => l.completed).length;
      return `<section class="course ${c.unlocked ? '' : 'is-locked'}" aria-labelledby="c-${c.id}">
        <header><h2 id="c-${c.id}">${esc(c.title)}</h2>${c.unlocked ? `<span class="course__prog"><progress max="${published.length || 1}" value="${done}" aria-label="Progreso de ${esc(c.title)}"></progress>${done} de ${published.length} publicadas</span>` : badge('locked', 'No incluido en tu plan')}</header>
        ${c.modules.map((m) => `<h3 class="module-title">${esc(m.title)}</h3><ul>${m.lessons.map((l) => `<li>${c.unlocked ? `<a href="/mi-cuenta/formacion/${l.id}">${esc(l.title)}</a>` : `<span>${esc(l.title)}</span>`}
          <small>${l.completed ? 'Completada' : l.status === 'publicada' ? esc(l.summary) : 'Pendiente de publicación'}</small></li>`).join('')}</ul>`).join('')}
        ${c.unlocked ? '' : `<p class="muted">Se incluye a partir del plan ${esc(c.planName)}. <a class="link" href="/comprar/${esc(c.plan)}">Ver cómo actualizar</a></p>`}
      </section>`;
    }).join('') || empty('Aún no hay cursos publicados.');
  });
}
export function renderLessonPage(main, id) {
  return frame(main, '/mi-cuenta/formacion', 'Lección', async () => {
    const { lesson } = await api(`/api/lessons/${id}`);
    return {
      html: `<h2 class="subhead">${esc(lesson.title)}</h2><p class="lede">${esc(lesson.summary)}</p>
        ${lesson.status === 'publicada' ? `<div class="lesson">${(lesson.body || '').split('\n\n').map((p) => `<p>${esc(p)}</p>`).join('')}</div>
          ${lesson.resources.length ? `<h3 class="subhead">Recursos</h3><ul class="resources">${lesson.resources.map((r) => `<li><a class="link" href="/api/resources/${r.id}">${esc(r.title)}</a> <small>${Math.ceil(r.size / 1024)} KB</small></li>`).join('')}</ul>` : ''}
          <button class="btn btn--gold" id="completar" type="button"><span class="btn__in">Marcar como completada</span></button>`
        : '<div class="callout"><p>Esta lección está pendiente de publicación. Aparecerá aquí cuando esté lista.</p></div>'}
        <p><a class="link" href="/mi-cuenta/formacion">Volver a mi formación</a></p>`,
      wire: (root) => root.querySelector('#completar')?.addEventListener('click', async () => {
        try { await api(`/api/lessons/${id}/complete`, { method: 'POST' }); toast('Lección completada.'); navigate('/mi-cuenta/formacion'); } catch (err) { toast(err.message, 'error'); }
      }),
    };
  });
}

/* ---------- Enlace ---------- */
export function renderLinkPage(main) {
  return frame(main, '/mi-cuenta/enlace', 'Mi enlace de referido', async (ctx) => ({
    html: `<p class="lede">Tu código es <strong>${esc(ctx.user.referralCode)}</strong>. Quien abre tu enlace ve tu nombre antes de pagar y queda registrado como tu cliente directo.</p>
      <ul class="ref-list">${ctx.resale.map((r) => {
        const p = programOf(r.plan);
        return `<li class="${r.allowed ? '' : 'is-locked'}"><div><strong>${esc(p.name)}</strong><span>${money(p.priceCents)}</span></div>
          ${r.allowed ? `<div class="review__actions"><button class="btn btn--line btn--small" type="button" data-copy="${p.slug}"><span class="btn__in">Copiar enlace</span></button>
            <button class="btn btn--text btn--small" type="button" data-share="${p.slug}"><span class="btn__in">Compartir</span></button></div>`
            : '<div class="ref-list__no"><p>Tu nivel actual no permite vender este programa. Solicita una actualización.</p><a class="link" href="/mi-cuenta/pedidos">Ver mis opciones</a></div>'}</li>`;
      }).join('')}</ul>
      <p class="sr-only" id="copy-out" role="status"></p>
      <h2 class="subhead">Cómo funciona</h2>
      <ul class="plain">
        <li>Puedes ofrecer tu plan y los inferiores. Los superiores se bloquean hasta que el fundador configure otra política.</li>
        <li>Si alguien que llega con tu enlace elige un plan que no puedes ofrecer, la venta la atiende Legado Digital y se le avisa antes de pagar.</li>
        <li>Registrar una venta no equivale a un pago. Las comisiones dependen de reglas que aún pueden estar pendientes de configurar.</li>
      </ul>`,
    wire: (root) => {
      const linkFor = async (plan) => location.origin + (await api('/api/me/referral-link', { method: 'POST', body: { plan } })).path;
      root.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
        try { const url = await linkFor(b.dataset.copy); await navigator.clipboard.writeText(url); root.querySelector('#copy-out').textContent = 'Enlace copiado.'; toast(`Enlace copiado: ${url}`); }
        catch (err) { toast(err.message || 'No se pudo copiar el enlace.', 'error'); }
      }));
      root.querySelectorAll('[data-share]').forEach((b) => b.addEventListener('click', async () => {
        try {
          const url = await linkFor(b.dataset.share);
          if (navigator.share) await navigator.share({ title: 'Legado Digital', url }); else { await navigator.clipboard.writeText(url); toast('Tu navegador no permite compartir: enlace copiado.'); }
        } catch (err) { if (err.name !== 'AbortError') toast(err.message, 'error'); }
      }));
    },
  }));
}

/* ---------- Clientes ---------- */
export function renderClients(main) {
  return frame(main, '/mi-cuenta/clientes', 'Mis clientes', async () => {
    const page = Number(new URLSearchParams(location.search).get('page') || 1);
    const { clients, hasMore } = await api(`/api/me/clients?page=${page}`);
    if (!clients.length && page === 1) return empty('Aún no tienes clientes directos. Comparte tu enlace para empezar.', '<a class="btn btn--line btn--small" href="/mi-cuenta/enlace"><span class="btn__in">Ir a mi enlace</span></a>');
    return `<p class="note">Ves solo a tus compradores directos y los datos mínimos necesarios.</p>
      <div class="table-wrap"><table class="data"><thead><tr><th>Cliente</th><th>País</th><th>Plan</th><th>Activación</th><th>Desde</th></tr></thead><tbody>
      ${clients.map((c) => `<tr><td>${esc(c.name)}</td><td>${esc(c.country)}</td><td>${esc(c.plan || 'Sin plan')}</td><td>${badge(c.status === 'activo' ? 'aprobado' : c.status === 'suspendido' ? 'rechazado' : 'pendiente_pago', ACCOUNT[c.status])}</td><td>${fmtDate(c.since)}</td></tr>`).join('')}
      </tbody></table></div>
      <nav class="pager" aria-label="Páginas">${page > 1 ? `<a class="link" href="?page=${page - 1}">Anterior</a>` : ''}${hasMore ? `<a class="link" href="?page=${page + 1}">Siguiente</a>` : ''}</nav>`;
  });
}

/* ---------- Pagos por revisar ---------- */
export function renderReviews(main) {
  const go = () => frame(main, '/mi-cuenta/pagos', 'Pagos por revisar', async () => {
    const { reviews, platform } = await api('/api/me/reviews');
    return {
      html: `${reviews.length ? reviews.map((o) => reviewCard(o, { canAct: true })).join('') : empty('No tienes pagos por revisar.')}
        ${platform.length ? `<h2 class="subhead">Cobros de la plataforma a tus clientes</h2>${platform.map((o) => reviewCard(o, { canAct: false })).join('')}` : ''}`,
      wire: (root) => wireReviews(root, go),
    };
  });
  return go();
}

/* ---------- Ventas ---------- */
export function renderSales(main) {
  return frame(main, '/mi-cuenta/ventas', 'Mis ventas', async () => {
    const q = new URLSearchParams(location.search);
    const { sales } = await api(`/api/me/sales?${q}`);
    const sel = (name, opts) => `<select id="f-${name}" name="${name}"><option value="">Todos</option>${opts.map(([v, l]) => `<option value="${v}" ${q.get(name) === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    return {
      html: `<form class="filters" id="filtros">
        ${field('f-from', 'Desde', `<input id="f-from" name="from" type="date" value="${esc(q.get('from') || '')}">`, false)}
        ${field('f-to', 'Hasta', `<input id="f-to" name="to" type="date" value="${esc(q.get('to') || '')}">`, false)}
        ${field('f-buyer', 'Comprador', `<input id="f-buyer" name="buyer" value="${esc(q.get('buyer') || '')}">`, false)}
        ${field('f-plan', 'Plan', sel('plan', state.programs.map((p) => [p.slug, p.name])), false)}
        ${field('f-method', 'Método', sel('method', Object.entries(METHOD_NAMES)), false)}
        ${field('f-status', 'Estado', sel('status', [['pendiente_pago', 'Pendiente de pago'], ['en_revision', 'En revisión'], ['aprobado', 'Pago confirmado'], ['rechazado', 'Rechazado'], ['cancelado', 'Cancelado']]), false)}
        <button class="btn btn--line btn--small" type="submit"><span class="btn__in">Filtrar</span></button>
      </form>
      ${sales.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>Pedido</th><th>Fecha</th><th>Comprador</th><th>Plan</th><th>Método</th><th>Importe</th><th>Estado</th></tr></thead><tbody>
        ${sales.map((s) => `<tr><td>${esc(s.code)}${s.isDemo ? ' <small>(ficticio)</small>' : ''}</td><td>${fmtDate(s.createdAt)}</td><td>${esc(s.buyer)}</td><td>${esc(s.plan)}</td><td>${esc(METHOD_NAMES[s.method] || 'Sin elegir')}</td><td>${money(s.amountCents)}</td><td>${badge(s.status)}${s.settlement ? ` ${badge('rechazado', s.settlement === 'devuelto' ? 'Devuelto' : 'Contracargo')}` : ''}</td></tr>`).join('')}
      </tbody></table></div>` : empty('No hay ventas con estos filtros.')}
      <p class="note">Una venta registrada no es dinero cobrado ni tu ganancia.</p>`,
      wire: (root) => root.querySelector('#filtros').addEventListener('submit', (e) => {
        e.preventDefault();
        const p = new URLSearchParams([...new FormData(e.currentTarget)].filter(([, v]) => v));
        navigate(`/mi-cuenta/ventas?${p}`);
      }),
    };
  });
}

/* ---------- Comisiones ---------- */
const MOVE = { venta: 'Venta', comision: 'Comisión', bono: 'Bono', regalia: 'Regalía', ajuste: 'Ajuste', liquidacion: 'Liquidación' };
export function renderCommissions(main) {
  return frame(main, '/mi-cuenta/comisiones', 'Comisiones, bonos y regalías', async () => {
    const { stats, movements, available, rule } = await api('/api/me/movements');
    return `${rule ? `<div class="callout"><p>Regla vigente: versión ${rule.version}, ${rule.directPercent} % sobre ventas directas cobradas por la plataforma. Cada venta conserva la versión que se le aplicó.</p></div>`
      : '<div class="callout"><p>Las reglas de comisión, bonos y regalías están pendientes de configuración. No se calcula ninguna cifra hasta que el fundador las apruebe.</p></div>'}
      ${statCards(stats)}
      <p class="note">Disponible para liquidar: <strong>${money(available)}</strong>. Solo cuenta lo que custodia la plataforma; lo que cobraste directamente ya está en tu poder y no se suma aquí.</p>
      <h2 class="subhead">Movimientos</h2>
      ${movements.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>Fecha</th><th>Tipo</th><th>Detalle</th><th>Importe</th><th>Custodia</th><th>Estado</th><th>Regla</th></tr></thead><tbody>
        ${movements.map((m) => `<tr><td>${fmtDate(m.createdAt)}</td><td>${MOVE[m.type]}</td><td>${esc(m.note || '')}</td><td>${money(m.amountCents < 0 ? -m.amountCents : m.amountCents, m.currency).replace(/^/, m.amountCents < 0 ? '− ' : '')}</td><td>${m.custody === 'externo' ? 'Cobrado por ti' : 'Plataforma'}</td><td>${esc(m.status)}</td><td>${m.ruleVersion ? `v${m.ruleVersion}` : '—'}</td></tr>`).join('')}
      </tbody></table></div>` : empty('Aún no tienes movimientos. Aparecerán cuando se confirme una venta.')}
      <p class="note">Bonos y regalías: no habilitados. Un cálculo no equivale a un pago.</p>`;
  });
}

/* ---------- Pedidos del comprador ---------- */
const payBlock = (o) => {
  const b = o.beneficiary || {};
  if (o.method === 'tarjeta') return `<p>Pagas ${money(o.chargeCents, o.chargeCurrency)} en el checkout seguro del proveedor. Esta web no guarda los datos de tu tarjeta.</p>
    <button class="btn btn--gold" type="button" data-checkout="${o.id}"><span class="btn__in">Ir al pago con tarjeta</span></button>
    <p class="note">Volver desde el checkout no confirma el pago: tu acceso se activa cuando el proveedor lo confirma al servidor.</p>`;
  return `<dl class="kv">
      <div><dt>Importe a pagar</dt><dd><strong>${money(o.chargeCents, o.chargeCurrency)}</strong>${o.fxRate ? ` <small>US$${(o.baseCents / 100).toFixed(2)} a S/ ${o.fxRate / 10000} por dólar, vigente hasta ${fmtDateTime(o.fxValidUntil)}</small>` : ''}</dd></div>
      <div><dt>Beneficiario</dt><dd>${esc(b.holder)}${b.bank ? ` · ${esc(b.bank)}` : ''}<br><strong>${esc(b.account)}</strong> <small>(${o.beneficiaryType === 'vendedor' ? 'pagas directamente a tu vendedor' : 'cuenta de Legado Digital'})</small></dd></div>
      ${o.instructions ? `<div><dt>Instrucciones</dt><dd>${esc(o.instructions)}</dd></div>` : ''}
    </dl>
    ${o.status === 'pendiente_pago' ? `<form class="form submit-proof" data-proof="${o.id}" novalidate>
      ${field(`op-${o.id}`, 'Número de operación', `<input id="op-${o.id}" name="operationNumber" required>`)}
      ${field(`pd-${o.id}`, 'Fecha del pago', `<input id="pd-${o.id}" name="paidOn" type="date" required max="${new Date().toISOString().slice(0, 10)}">`)}
      ${field(`pf-${o.id}`, 'Comprobante <small>PNG, JPG, WEBP o PDF, hasta 5 MB</small>', `<input id="pf-${o.id}" name="file" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" required>`)}
      <p class="form-status" role="alert"></p>
      <button class="btn btn--gold" type="submit"><span class="btn__in">Enviar comprobante</span></button>
      <p class="note">Enviarlo no confirma el pago: quien recibe el dinero comprueba el ingreso antes de activar tu acceso.</p>
    </form>` : ''}`;
};
export function renderOrdersPage(main) {
  const go = () => frame(main, '/mi-cuenta/pedidos', 'Mis pedidos', async () => {
    const { orders } = await api('/api/me/orders');
    const open = orders.find((o) => ['pendiente_pago', 'en_revision'].includes(o.status));
    let methods = null;
    if (open?.status === 'pendiente_pago') methods = (await api(`/api/pricing/${open.plan}`)).methods;
    return {
      html: orders.length ? orders.map((o) => `
        <article class="order" aria-labelledby="o-${o.id}">
          <header><h2 id="o-${o.id}">${esc(o.code)} · ${o.kind === 'actualizacion' ? 'Actualización a' : 'Compra de'} ${esc(o.planName)}</h2>${badge(o.status)}</header>
          <p class="muted">Te atiende: ${esc(o.seller)} · Precio: ${money(o.baseCents)}${o.isDemo ? ' · dato ficticio' : ''}</p>
          ${o.reviewNote && o.status === 'pendiente_pago' ? `<p class="order__note">Último comprobante rechazado: ${esc(o.reviewNote)} Puedes enviar uno corregido.</p>` : ''}
          ${o === open && o.status === 'pendiente_pago' ? `<div class="order__pay">
            <h3 class="subhead">1. Elige cómo pagar</h3>
            <div class="methods">${methods.map((m) => `<button type="button" class="method ${o.method === m.method ? 'is-on' : ''}" data-method="${m.method}" ${m.available ? '' : 'disabled'} aria-pressed="${o.method === m.method}">
              <strong>${esc(m.name)}</strong><span>${m.available ? money(m.chargeCents, m.currency) : esc(m.reason)}</span></button>`).join('')}</div>
            ${o.method ? `<h3 class="subhead">2. Paga y envía el comprobante</h3>${payBlock(o)}` : ''}
            <button class="btn btn--text btn--small" type="button" data-cancel="${o.id}"><span class="btn__in">Cancelar pedido</span></button>
          </div>` : ''}
          ${o.status === 'en_revision' ? `<p class="callout">Tu comprobante está en revisión. Te avisaremos cuando se compruebe el ingreso.</p>` : ''}
          <ol class="order__events">${o.events.map((e) => `<li>${esc(e.note || e.toStatus)}<small>${fmtDateTime(e.createdAt)}</small></li>`).join('')}</ol>
        </article>`).join('') : empty('Todavía no tienes pedidos.', '<a class="btn btn--gold btn--small" href="/#cursos-y-planes"><span class="btn__in">Ver los planes</span></a>'),
      wire: (root) => {
        root.querySelectorAll('[data-method]').forEach((b) => b.addEventListener('click', async () => {
          try { await api(`/api/orders/${open.id}/method`, { method: 'POST', body: { method: b.dataset.method } }); go(); } catch (err) { toast(err.message, 'error'); }
        }));
        root.querySelectorAll('[data-cancel]').forEach((b) => b.addEventListener('click', async () => {
          try { await api(`/api/orders/${b.dataset.cancel}/cancel`, { method: 'POST' }); toast('Pedido cancelado.'); go(); } catch (err) { toast(err.message, 'error'); }
        }));
        root.querySelectorAll('[data-checkout]').forEach((b) => b.addEventListener('click', async () => {
          try { location.assign((await api(`/api/orders/${b.dataset.checkout}/checkout`, { method: 'POST' })).url); } catch (err) { toast(err.message, 'error'); }
        }));
        root.querySelectorAll('[data-proof]').forEach((f) => bindForm(f, async (d) => {
          const file = f.elements.file.files[0];
          if (!file) throw Object.assign(new Error('Adjunta el comprobante.'), { field: 'file' });
          const q = new URLSearchParams({ op: d.operationNumber, fecha: d.paidOn });
          await api(`/api/orders/${f.dataset.proof}/submission?${q}`, { method: 'POST', raw: file });
          toast('Comprobante enviado. Está en revisión.');
          go();
        }));
      },
    };
  });
  return go();
}

/* ---------- Perfil ---------- */
export function renderProfilePage(main) {
  const go = () => frame(main, '/mi-cuenta/perfil', 'Mi perfil', async (ctx) => {
    const u = ctx.user;
    const payout = ctx.active ? await api('/api/me/payout-methods') : null;
    return {
      html: `<div class="profile-head">${avatar(u, 'avatar--lg')}<form id="foto" class="upload"><label for="avatar-in">Foto de perfil <small>opcional · PNG, JPG o WEBP, hasta 2 MB</small></label><input id="avatar-in" type="file" accept="image/png,image/jpeg,image/webp"></form></div>
      <form class="form form--narrow" id="datos" novalidate>
        ${field('e-first', 'Nombre', `<input id="e-first" name="firstName" value="${esc(u.firstName)}" autocomplete="given-name" required>`)}
        ${field('e-last', 'Apellido', `<input id="e-last" name="lastName" value="${esc(u.lastName)}" autocomplete="family-name" required>`)}
        ${field('e-email', 'Correo electrónico', `<input id="e-email" value="${esc(u.email)}" disabled>`)}
        ${field('e-country', 'País', `<input id="e-country" name="country" value="${esc(u.country)}" autocomplete="country-name" required>`)}
        ${field('e-phone', 'Teléfono con prefijo', `<input id="e-phone" name="phone" type="tel" value="${esc(u.phone || '')}" autocomplete="tel">`, false)}
        <label class="check"><input type="checkbox" name="emailNotices" ${u.prefs?.emailNotices ? 'checked' : ''}><span>Recibir avisos de mi cuenta por correo</span></label>
        <p class="form-status" role="alert"></p>
        <button class="btn btn--gold" type="submit"><span class="btn__in">Guardar cambios</span></button>
      </form>
      <h2 class="subhead">Contraseña</h2>
      <form class="form form--narrow" id="clave" novalidate>
        ${field('pw-cur', 'Contraseña actual', '<input id="pw-cur" name="current" type="password" autocomplete="current-password" required>')}
        ${field('pw-new', 'Contraseña nueva', '<input id="pw-new" name="password" type="password" autocomplete="new-password" required>')}
        ${field('pw-rep', 'Repite la contraseña nueva', '<input id="pw-rep" name="confirm" type="password" autocomplete="new-password" required>')}
        <p class="form-status" role="alert"></p>
        <button class="btn btn--line" type="submit"><span class="btn__in">Cambiar contraseña</span></button>
      </form>
      ${payout ? `<h2 class="subhead">Mis medios de cobro</h2>
        ${payout.directEnabled ? `<p class="note">Si los configuras, tus clientes te pagan directamente y tú revisas sus comprobantes. Los cambios piden confirmar tu contraseña y solo se aplican a pedidos nuevos.</p>
        ${payout.methods.length ? `<ul class="plain">${payout.methods.map((m) => `<li><strong>${esc(METHOD_NAMES[m.method])}</strong>: ${esc(m.holder)} · ${esc(m.account)} (${esc(m.currency)})</li>`).join('')}</ul>` : ''}
        <form class="form form--narrow" id="cobro" novalidate>
          ${field('pm-m', 'Medio', `<select id="pm-m" name="method">${Object.entries(METHOD_NAMES).filter(([k]) => k !== 'tarjeta').map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>`)}
          ${field('pm-h', 'Titular', '<input id="pm-h" name="holder" required>')}
          ${field('pm-a', 'Número o cuenta', '<input id="pm-a" name="account" required>')}
          ${field('pm-c', 'Moneda (solo cuentas bancarias)', '<select id="pm-c" name="currency"><option value="PEN">Soles</option><option value="USD">Dólares</option></select>', false)}
          <p class="form-status" role="alert"></p>
          <button class="btn btn--line" type="submit"><span class="btn__in">Guardar medio de cobro</span></button>
        </form>` : '<p class="note">El cobro directo a vendedores no está habilitado. Los pagos los recibe la plataforma.</p>'}` : ''}`,
      wire: (root) => {
        bindForm(root.querySelector('#datos'), async (d) => {
          await api('/api/me', { method: 'PATCH', body: { firstName: d.firstName, lastName: d.lastName, country: d.country, phone: d.phone, prefs: { emailNotices: d.emailNotices === 'on' } } });
          toast('Cambios guardados.'); go();
        });
        bindForm(root.querySelector('#clave'), async (d) => { await api('/api/me/password', { method: 'POST', body: d }); toast('Contraseña cambiada.'); root.querySelector('#clave').reset(); });
        root.querySelector('#avatar-in').addEventListener('change', async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          try { await api('/api/me/avatar', { method: 'POST', raw: file }); toast('Foto actualizada.'); go(); } catch (err) { toast(err.message, 'error'); }
        });
        const cobro = root.querySelector('#cobro');
        if (cobro) bindForm(cobro, async (d) => { await api('/api/me/payout-methods', { method: 'POST', body: d }); toast('Medio de cobro guardado.'); go(); });
      },
    };
  });
  return go();
}

/* ---------- Notificaciones, tutoriales y soporte ---------- */
export function renderNotifications(main) {
  return frame(main, '/mi-cuenta/notificaciones', 'Notificaciones', async () => {
    const { notifications } = await api('/api/me/notifications');
    await api('/api/me/notifications/read', { method: 'POST' });
    return notifications.length ? `<ul class="notes-list">${notifications.map((n) => `<li class="${n.readAt ? '' : 'is-new'}"><strong>${esc(n.title)}</strong><p>${esc(n.body)}</p><small>${fmtDateTime(n.createdAt)}</small>${n.link ? ` <a class="link" href="${esc(n.link)}">Abrir</a>` : ''}</li>`).join('')}</ul>` : empty('No tienes notificaciones.');
  });
}

export const TUTORIALS = [
  ['primeros-pasos', 'Mis primeros pasos', ['Confirma tu correo, elige tu plan y completa el pago desde Mis pedidos.', 'Cuando se comprueba tu pago, tu cuenta se activa y aparecen tu formación y tu enlace.', 'Completa tu perfil y, si quieres, añade una foto.']],
  ['estrategia', 'Estrategia inicial', ['Empieza por tu formación: entiende lo que vas a recomendar.', 'Comparte tu enlace con personas a las que realmente les sirva el contenido.', 'No prometas ingresos ni resultados: explica qué enseña cada plan y su precio.']],
  ['enlace', 'Cómo funciona tu enlace', ['Tu enlace registra a quien se inscribe como tu cliente directo.', 'Puedes ofrecer tu plan y los inferiores. Si eligen uno superior, lo atiende la plataforma.']],
  ['revisar', 'Cómo revisar un pago', ['Si tus clientes te pagan directamente, verás sus comprobantes en Pagos por revisar.', 'Antes de aprobar, comprueba en tu cuenta que el dinero llegó. Un comprobante no lo demuestra por sí solo.', 'Si no llegó, rechaza con un motivo claro: el cliente podrá enviar uno corregido.']],
  ['comisiones', 'Comisiones y movimientos', ['Las ventas brutas no son tu ganancia.', 'Las comisiones solo existen cuando el fundador aprueba una regla, y cada venta conserva la versión aplicada.', 'Lo que cobraste directamente ya está contigo y no se suma al saldo de la plataforma.']],
];
export function renderTutorials(main) {
  return frame(main, '/mi-cuenta/tutoriales', 'Tutoriales', async () => `<div class="tutorials">${TUTORIALS.map(([id, t, items]) => `<section id="${id}" class="tutorial" tabindex="-1"><h2 class="subhead">${esc(t)}</h2><ol>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ol></section>`).join('')}</div>`)
    .then((root) => { if (location.hash) root.querySelector(location.hash)?.scrollIntoView(); return root; });
}
export function renderSupport(main) {
  return frame(main, '/mi-cuenta/soporte', 'Soporte', async (ctx) => ({
    html: `<p class="lede">Escríbenos si tienes una duda con tu cuenta, un pago o tu formación.</p>
      <p><a class="btn btn--gold" href="${esc(whatsappLink(whatsappMessages.general()))}" target="_blank" rel="noopener noreferrer"><span class="btn__in">Escribir por WhatsApp</span></a></p>
      <h2 class="subhead">O envíanos un mensaje</h2>
      <p class="note">Este formulario envía tu mensaje a nuestro servidor; no abre WhatsApp. No incluyas contraseñas ni datos de tarjeta.</p>
      <form class="form form--narrow" id="soporte" novalidate>
        ${field('s-msg', 'Mensaje', '<textarea id="s-msg" name="message" rows="5" required></textarea>')}
        <p class="form-status" role="alert"></p>
        <button class="btn btn--line" type="submit"><span class="btn__in">Enviar mensaje</span></button>
      </form>`,
    wire: (root) => bindForm(root.querySelector('#soporte'), async (d) => {
      await api('/api/contact', { method: 'POST', body: { name: ctx.user.name, email: ctx.user.email, message: `[Soporte de la oficina] ${d.message}` } });
      toast('Mensaje enviado.'); root.querySelector('#soporte').reset();
    }),
  }));
}
export { fieldError };
