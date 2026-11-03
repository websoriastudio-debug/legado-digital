// Pruebas de aceptación contra la API real por HTTP. Si una regla se pudiera saltar con una petición manipulada, falla aquí.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../server/db.mjs';
import { createApp } from '../server/app.mjs';
import { ensureFounder, totpAt } from '../server/accounts.mjs';
import { setSetting } from '../server/settings.mjs';
import { backup } from '../scripts/backup.mjs';
import { restore } from '../scripts/restore.mjs';
import { whatsappLink, whatsappMessages, programs } from '../shared/site.config.mjs';

const SECRET = 'secreto-de-prueba';
const PNG = Buffer.from('89504e470d0a1a0a0000', 'hex');
const FOUNDER = { email: 'fundador@test.test', password: 'clave-del-fundador-1' };
let server, base, dataDir, db, founder, founderRow;
const sandboxEvents = new Map();

function client() {
  let cookie = '';
  const call = async (method, path, body, raw) => {
    const res = await fetch(base + path, {
      method, redirect: 'manual',
      headers: { ...(cookie ? { cookie } : {}), 'content-type': raw ? 'application/octet-stream' : 'application/json' },
      body: raw ?? (body ? JSON.stringify(body) : undefined),
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const type = res.headers.get('content-type') || '';
    return { status: res.status, body: type.includes('json') ? await res.json() : await res.text() };
  };
  return { call, get: (p) => call('GET', p), post: (p, b) => call('POST', p, b), put: (p, b) => call('PUT', p, b), patch: (p, b) => call('PATCH', p, b), upload: (p, buf) => call('POST', p, null, buf) };
}

const verifyTokenOf = (email) => db.prepare("SELECT body FROM outbox WHERE to_email = ? AND subject LIKE 'Confirma%' ORDER BY id DESC").get(email).body.split('token=')[1];
let n = 0;
async function newUser({ ref, verify = true } = {}) {
  const c = client();
  const email = `u${++n}@test.test`;
  const r = await c.post('/api/auth/register', { firstName: `Persona${n}`, lastName: 'Prueba', country: 'Perú', email, password: 'clave-segura', confirm: 'clave-segura', acceptLegal: true, ref });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  if (verify) assert.equal((await c.post('/api/auth/verify', { token: verifyTokenOf(email) })).status, 200);
  return Object.assign(c, { email, id: r.body.user.id });
}
const row = (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id);
const levelOf = (id) => db.prepare('SELECT COALESCE(MAX(p.rank),0) AS r FROM entitlements e JOIN plans p ON p.slug = e.plan_slug WHERE e.user_id = ? AND e.revoked_at IS NULL').get(id).r;
const codeOf = (id) => row(id).referral_code;
const reauth = (c, password = 'clave-segura') => c.post('/api/auth/reauth', { password });

// Pedido manual completo hasta quedar en revisión.
async function orderToReview(c, plan, method = 'yape') {
  const o = await c.post('/api/orders', { plan });
  assert.equal(o.status, 200, JSON.stringify(o.body));
  const m = await c.post(`/api/orders/${o.body.order.id}/method`, { method });
  assert.equal(m.status, 200, JSON.stringify(m.body));
  const s = await c.upload(`/api/orders/${o.body.order.id}/submission?op=OP-${o.body.order.id}&fecha=2026-11-03`, PNG);
  assert.equal(s.status, 200, JSON.stringify(s.body));
  return s.body.order;
}
const approve = (reviewer, id, extra = {}) => reviewer.post(`/api/orders/${id}/review`, { decision: 'aprobar', confirm: true, ...extra });
async function buyFromFounder(c, plan) {
  const o = await orderToReview(c, plan);
  const r = await approve(founder, o.id);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return o;
}

before(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'legado-'));
  db = openDb(join(dataDir, 'legado.sqlite'));
  ensureFounder(db, FOUNDER);
  founderRow = db.prepare("SELECT * FROM users WHERE role = 'admin'").get();
  // Configuración completa: sin ella las ventas están cerradas (se prueba aparte).
  setSetting(db, founderRow, 'business', { holder: 'Titular de prueba', country: 'Perú', supportEmail: 'soporte@test.test', whatsapp: '+51 947 328 715' });
  setSetting(db, founderRow, 'mail', { provider: 'prueba' });
  setSetting(db, founderRow, 'legal', { reviewed: true });
  setSetting(db, founderRow, 'payments', {
    modes: { centralizado: true, directo: true },
    platform: { yape: { enabled: true, holder: 'Legado Prueba', account: '900000000', currency: 'PEN' }, transferencia: { enabled: true, holder: 'Legado Prueba', account: '000-111', bank: 'Banco', currency: 'USD' } },
    card: { enabled: true, provider: 'prueba', absorbedBy: 'legado' },
  });
  setSetting(db, founderRow, 'fx', { rate: 37500, validUntil: '2999-01-01T00:00:00.000Z', source: 'prueba' });
  const provider = {
    createCheckout: ({ order }) => ({ url: `https://pasarela.test/${order.id}`, ref: `p${order.id}` }),
    getStatus: (order) => sandboxEvents.get(order.id) || null,
  };
  server = createApp({ db, dataDir, limiter: () => {}, webhookSecret: SECRET, cardProvider: provider });
  await new Promise((ok) => server.listen(0, ok));
  base = `http://localhost:${server.address().port}`;
  founder = client();
  assert.equal((await founder.post('/api/auth/login', FOUNDER)).status, 200);
  assert.equal((await founder.post('/api/auth/reauth', { password: FOUNDER.password })).status, 200);
});
after(() => { server.close(); server.closeAllConnections?.(); db.close(); rmSync(dataDir, { recursive: true, force: true }); });

async function webhook(event, secret = SECRET) {
  const raw = JSON.stringify(event);
  const res = await fetch(base + '/api/payments/webhook', { method: 'POST', headers: { 'x-ld-signature': createHmac('sha256', secret).update(raw).digest('hex') }, body: raw });
  return { status: res.status, body: await res.json() };
}

/* ---------- Escenarios del documento ---------- */

test('el fundador activa a cuatro compradores y cada uno completa una venta directa a un cliente nuevo', async () => {
  for (const plan of ['start', 'pro', 'start', 'elite']) {
    const seller = await newUser();
    await buyFromFounder(seller, plan);
    assert.equal(row(seller.id).account_status, 'activo');
    assert.ok(codeOf(seller.id));
    // Cobro directo: el vendedor registra su Yape (con reautenticación) y revisa el pago de su cliente.
    db.prepare('UPDATE sessions SET reauth_at = 0 WHERE user_id = ?').run(seller.id);
    assert.equal((await seller.post('/api/me/payout-methods', { method: 'yape', holder: 'Vendedor', account: '911' })).status, 428, 'exige reautenticación');
    await reauth(seller);
    assert.equal((await seller.post('/api/me/payout-methods', { method: 'yape', holder: 'Vendedor', account: '911' })).status, 200);
    const buyer = await newUser({ ref: codeOf(seller.id) });
    const o = await orderToReview(buyer, 'start');
    assert.equal(o.beneficiaryType, 'vendedor');
    assert.equal((await approve(seller, o.id)).status, 200);
    assert.equal(levelOf(buyer.id), 1);
    assert.equal(row(buyer.id).sponsor_id, seller.id);
    const sale = db.prepare("SELECT * FROM movements WHERE order_id = ? AND type = 'venta'").get(o.id);
    assert.equal(sale.user_id, seller.id);
    assert.equal(sale.custody, 'externo', 'el dinero cobrado por el vendedor no es saldo de la plataforma');
  }
});

test('una cuenta pendiente no abre cursos ni vende, aunque use la URL o la API', async () => {
  const u = await newUser();
  await u.post('/api/orders', { plan: 'start' });
  const lesson = db.prepare('SELECT id FROM lessons LIMIT 1').get();
  assert.equal((await u.get('/api/me/campus')).status, 403);
  assert.equal((await u.get(`/api/lessons/${lesson.id}`)).status, 403);
  assert.equal((await u.post('/api/me/referral-link', { plan: 'start' })).status, 403);
  assert.equal((await u.get('/api/me/clients')).status, 403);
  assert.equal((await u.get('/api/me/sales')).status, 403);
  assert.equal((await u.get('/api/me/orders')).status, 200, 'sí consulta su estado');
});

test('START no accede a contenido superior ni ofrece planes no autorizados', async () => {
  const s = await newUser(); await buyFromFounder(s, 'start');
  const pro = db.prepare("SELECT l.id FROM lessons l JOIN modules m ON m.id = l.module_id JOIN courses c ON c.id = m.course_id WHERE c.plan_slug = 'pro' LIMIT 1").get();
  assert.equal((await s.get(`/api/lessons/${pro.id}`)).status, 403);
  for (const plan of ['pro', 'elite']) {
    const r = await s.post('/api/me/referral-link', { plan });
    assert.equal(r.status, 403);
    assert.match(r.body.message, /no permite vender este programa/);
  }
  // Un comprador de su enlace que elige ELITE queda como venta directa de la plataforma, avisado antes de pagar.
  const b = await newUser({ ref: codeOf(s.id) });
  assert.equal((await b.get('/api/pricing/elite')).body.attendedBy.type, 'plataforma');
  const o = (await b.post('/api/orders', { plan: 'elite' })).body.order;
  assert.equal(o.saleType, 'plataforma');
});

test('un vendedor revisa su cobro directo, pero no un cobro de la plataforma ni su propia compra', async () => {
  const s = await newUser(); await buyFromFounder(s, 'pro');
  const b1 = await newUser({ ref: codeOf(s.id) });
  // Sin medio de cobro propio, el pago va a la plataforma: el vendedor lo ve pero no lo confirma.
  const platform = await orderToReview(b1, 'start');
  assert.equal(platform.beneficiaryType, 'plataforma');
  assert.equal((await approve(s, platform.id)).status, 403);
  const visible = (await s.get('/api/me/reviews')).body;
  assert.ok(visible.platform.some((o) => o.id === platform.id));
  assert.ok(!visible.reviews.some((o) => o.id === platform.id));
  // Su propia compra de actualización tampoco.
  const own = await orderToReview(s, 'elite');
  assert.equal((await approve(s, own.id)).status, 403);
  assert.equal((await approve(b1, platform.id)).status, 403, 'el comprador no se aprueba a sí mismo');
});

test('ningún vendedor lee perfiles, comprobantes ni datos económicos de otra rama', async () => {
  const a = await newUser(); await buyFromFounder(a, 'start');
  const z = await newUser(); await buyFromFounder(z, 'start');
  await reauth(a); await a.post('/api/me/payout-methods', { method: 'yape', holder: 'A', account: '1' });
  const ca = await newUser({ ref: codeOf(a.id) });
  const o = await orderToReview(ca, 'start');
  const subId = db.prepare('SELECT id FROM payment_submissions WHERE order_id = ?').get(o.id).id;
  assert.equal((await a.get(`/api/receipts/${subId}`)).status, 200, 'el vendedor que cobró sí lo ve');
  assert.equal((await z.get(`/api/receipts/${subId}`)).status, 404);
  assert.equal((await z.get('/api/me/clients')).body.clients.length, 0);
  assert.ok(!JSON.stringify((await a.get('/api/me/clients')).body).includes('@'), 'sin correos de sus clientes');
  for (const p of ['/api/admin/users', '/api/admin/orders', '/api/admin/network', '/api/admin/export/usuarios', '/api/admin/audit']) assert.equal((await z.get(p)).status, 403, p);
  assert.equal((await z.get(`/api/users/${ca.id}/avatar`)).status, 404);
  assert.equal((await z.get('/api/me/sales')).body.sales.length, 0);
});

test('el rechazo conserva el motivo y permite corregir el comprobante', async () => {
  const u = await newUser();
  const o = await orderToReview(u, 'start');
  assert.equal((await founder.post(`/api/orders/${o.id}/review`, { decision: 'rechazar' })).status, 422, 'exige motivo');
  assert.equal((await founder.post(`/api/orders/${o.id}/review`, { decision: 'rechazar', note: 'No vemos el ingreso.' })).status, 200);
  let mine = (await u.get('/api/me/orders')).body.orders[0];
  assert.equal(mine.status, 'pendiente_pago');
  assert.equal(mine.submissions[0].reviewNote, 'No vemos el ingreso.');
  assert.equal((await u.upload(`/api/orders/${o.id}/submission?op=OP-2&fecha=2026-11-03`, PNG)).status, 200);
  mine = (await u.get('/api/me/orders')).body.orders[0];
  assert.deepEqual(mine.submissions.map((s) => s.status), ['rechazado', 'en_revision'], 'se conserva el historial');
  assert.equal((await approve(founder, o.id)).status, 200);
});

test('dos aprobaciones simultáneas o un webhook repetido generan una sola activación y un solo movimiento', async () => {
  const u = await newUser();
  const o = await orderToReview(u, 'pro');
  const results = await Promise.all([approve(founder, o.id), approve(founder, o.id)]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM movements WHERE order_id = ? AND type = 'venta'").get(o.id).n, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM entitlements WHERE order_id = ?').get(o.id).n, 2);

  const c = await newUser();
  const co = (await c.post('/api/orders', { plan: 'start' })).body.order;
  const m = (await c.post(`/api/orders/${co.id}/method`, { method: 'tarjeta' })).body.order;
  const paid = { id: `e${co.id}`, orderId: co.id, type: 'paid', amountCents: m.chargeCents, currency: 'USD' };
  const [w1, w2] = await Promise.all([webhook(paid), webhook(paid)]);
  assert.deepEqual([w1.body.applied, w2.body.applied].sort(), [false, true]);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM movements WHERE order_id = ? AND type = 'venta'").get(co.id).n, 1);
  assert.equal(levelOf(c.id), 1);
});

test('un pago con importe, moneda o pedido incorrectos no activa', async () => {
  const u = await newUser();
  const o = (await u.post('/api/orders', { plan: 'start' })).body.order;
  await u.post(`/api/orders/${o.id}/method`, { method: 'tarjeta' });
  assert.equal((await webhook({ id: 'x1', orderId: o.id, type: 'paid', amountCents: 1, currency: 'USD' })).body.applied, false);
  assert.equal((await webhook({ id: 'x2', orderId: o.id, type: 'paid', amountCents: 5000, currency: 'PEN' })).body.applied, false);
  assert.equal((await webhook({ id: 'x3', orderId: 999999, type: 'paid', amountCents: 5000, currency: 'USD' })).status, 404);
  assert.equal((await webhook({ id: 'x4', orderId: o.id, type: 'paid', amountCents: 5000, currency: 'USD' }, 'otro')).status, 401, 'firma falsa');
  assert.equal(levelOf(u.id), 0);
  // Un pago manual no se activa por webhook.
  const v = await newUser();
  const vo = await orderToReview(v, 'start');
  assert.equal((await webhook({ id: 'x5', orderId: vo.id, type: 'paid', amountCents: vo.chargeCents, currency: vo.chargeCurrency })).body.applied, false);
  assert.equal(levelOf(v.id), 0);
});

test('un evento desordenado (devolución antes del pago) no activa y la conciliación consulta al proveedor', async () => {
  const u = await newUser();
  const o = (await u.post('/api/orders', { plan: 'start' })).body.order;
  await u.post(`/api/orders/${o.id}/method`, { method: 'tarjeta' });
  sandboxEvents.set(o.id, { id: `rec${o.id}`, orderId: o.id, type: 'paid', amountCents: 5000, currency: 'USD' });
  const r = await founder.post(`/api/admin/orders/${o.id}/reconcile`);
  assert.equal(r.body.result.applied, true);
  assert.equal(levelOf(u.id), 1);
  const u2 = await newUser();
  const o2 = (await u2.post('/api/orders', { plan: 'start' })).body.order;
  await u2.post(`/api/orders/${o2.id}/method`, { method: 'tarjeta' });
  await webhook({ id: `ref${o2.id}`, orderId: o2.id, type: 'refunded' });
  assert.equal((await webhook({ id: `pay${o2.id}`, orderId: o2.id, type: 'paid', amountCents: 5000, currency: 'USD' })).body.applied, false);
  assert.equal(levelOf(u2.id), 0);
});

test('las estadísticas salen de movimientos reales y responden a devoluciones y ajustes', async () => {
  const s = await newUser(); await buyFromFounder(s, 'pro');
  // Comisión habilitada en versión nueva, solo para ventas cobradas por la plataforma.
  assert.equal((await founder.post('/api/admin/rules', { enabled: true, directPercent: '10' })).status, 200);
  const b = await newUser({ ref: codeOf(s.id) });
  const o = await orderToReview(b, 'pro');
  await approve(founder, o.id);
  let stats = (await s.get('/api/me/movements')).body;
  assert.equal(stats.stats.total.grossSales, 10000);
  assert.equal(stats.stats.total.commissions, 1000);
  assert.equal(stats.available, 1000);
  // Cambiar la regla no recalcula lo confirmado.
  await founder.post('/api/admin/rules', { enabled: true, directPercent: '50' });
  assert.equal((await s.get('/api/me/movements')).body.stats.total.commissions, 1000);
  assert.equal((await founder.post(`/api/admin/orders/${o.id}/refund`, {})).status, 422, 'exige motivo');
  assert.equal((await founder.post(`/api/admin/orders/${o.id}/refund`, { reason: 'Devolución pedida' })).status, 200);
  stats = (await s.get('/api/me/movements')).body;
  assert.equal(stats.stats.total.refundAdjustments, -11000);
  assert.equal(stats.available, 0, 'tras la devolución no hay nada que liquidar');
  assert.equal((await founder.post(`/api/admin/orders/${o.id}/refund`, { reason: 'Otra vez' })).status, 409);
  assert.equal(levelOf(b.id), 2, 'sin política aprobada, la devolución no retira el acceso automáticamente');
  await founder.post('/api/admin/rules/disable');
});

test('cerrar sesión, recuperar contraseña y editar el perfil funcionan', async () => {
  const u = await newUser();
  assert.equal((await u.call('PATCH', '/api/me', { firstName: 'Ana', lastName: 'Pérez', country: 'Chile', prefs: { emailNotices: true }, role: 'admin', account_status: 'activo' })).status, 200);
  const r = row(u.id);
  assert.deepEqual([r.first_name, r.country, r.role, r.account_status], ['Ana', 'Chile', 'user', 'pendiente']);
  assert.equal((await u.upload('/api/me/avatar', PNG)).status, 200);
  assert.equal((await u.get(`/api/users/${u.id}/avatar`)).status, 200);
  assert.equal((await u.upload('/api/me/avatar', Buffer.from('MZ ejecutable'))).status, 415);
  assert.equal((await u.post('/api/auth/logout')).status, 200);
  assert.equal((await u.get('/api/me')).status, 401);
  await client().post('/api/auth/recover', { email: u.email });
  const t = db.prepare("SELECT body FROM outbox WHERE to_email = ? AND subject LIKE 'Recupera%' ORDER BY id DESC").get(u.email).body.split('token=')[1];
  assert.equal((await client().post('/api/auth/reset', { token: t, password: 'nueva-clave-1', confirm: 'nueva-clave-1' })).status, 200);
  assert.equal((await client().post('/api/auth/reset', { token: t, password: 'nueva-clave-2', confirm: 'nueva-clave-2' })).status, 400, 'el enlace se usa una vez');
  assert.equal((await client().post('/api/auth/login', { email: u.email, password: 'nueva-clave-1' })).status, 200);
  assert.equal((await client().post('/api/auth/recover', { email: 'nadie@test.test' })).status, 200, 'no revela si existe');
});

test('el sistema bloquea pagos sin configurar y muestra qué falta', async () => {
  const u = await newUser();
  const o = (await u.post('/api/orders', { plan: 'start' })).body.order;
  assert.equal((await u.post(`/api/orders/${o.id}/method`, { method: 'plin' })).status, 409, 'Plin sin cuenta receptora');
  setSetting(db, founderRow, 'fx', null);
  assert.equal((await u.post(`/api/orders/${o.id}/method`, { method: 'yape' })).status, 409, 'sin tipo de cambio no se cobra en soles');
  setSetting(db, founderRow, 'fx', { rate: 37500, validUntil: '2999-01-01T00:00:00.000Z', source: 'prueba' });
  setSetting(db, founderRow, 'legal', { reviewed: false });
  const closed = await (await newUser()).post('/api/orders', { plan: 'start' });
  assert.equal(closed.status, 409);
  assert.match(closed.body.message, /Revisión de los textos legales/);
  assert.ok((await founder.get('/api/admin/overview')).body.readiness.missing.length > 0);
  setSetting(db, founderRow, 'legal', { reviewed: true });
  const noMail = await newUser({ verify: false });
  assert.equal((await noMail.post('/api/orders', { plan: 'start' })).status, 403, 'sin correo verificado no compra');
});

test('la información de prueba no aparece como actividad real fuera de la demostración', async () => {
  const s = await newUser(); await buyFromFounder(s, 'start');
  db.prepare("INSERT INTO movements (user_id, type, amount_cents, currency, custody, status, is_demo, created_at) VALUES (?, 'venta', 99999, 'USD', 'plataforma', 'confirmado', 1, ?)").run(s.id, new Date().toISOString());
  assert.equal((await s.get('/api/me/movements')).body.stats.total.grossSales, 0);
  assert.deepEqual((await client().get('/api/bootstrap')).body.demoAccounts, []);
});

/* ---------- Seguridad y reglas complementarias ---------- */

test('el fundador es el único administrador; el registro y el navegador no conceden permisos', async () => {
  const c = client();
  const r = await c.post('/api/auth/register', { firstName: 'X', lastName: 'Y', country: 'Perú', email: FOUNDER.email, password: 'clave-ajena-1', confirm: 'clave-ajena-1', acceptLegal: true });
  assert.equal(r.status, 409);
  const u = await newUser();
  await u.call('PATCH', '/api/me', { firstName: 'A', lastName: 'B', country: 'Perú', role: 'admin', can_verify: 1 });
  assert.equal(row(u.id).role, 'user');
  assert.equal((await u.post(`/api/admin/users/${u.id}/grant`, { plan: 'elite', reason: 'x' })).status, 403);
  assert.equal((await u.call('PATCH', '/api/admin/plans/start', { name: 'Gratis', priceCents: 1 })).status, 403);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get().n, 1);
  assert.throws(() => ensureFounder(openDb(), { email: 'a@b.cc', password: 'corta' }));
});

test('doble factor del fundador y reautenticación en acciones sensibles', async () => {
  const fresh = client();
  await fresh.post('/api/auth/login', FOUNDER);
  db.prepare('UPDATE sessions SET reauth_at = 0').run();
  assert.equal((await fresh.post('/api/admin/rules', { enabled: false })).status, 428, 'pide confirmar identidad');
  await fresh.post('/api/auth/reauth', { password: FOUNDER.password });
  const { secret } = (await fresh.post('/api/me/totp/start')).body;
  const code = totpAt(secret, Math.floor(Date.now() / 30000));
  assert.equal((await fresh.post('/api/me/totp/enable', { code })).status, 200);
  const next = client();
  assert.deepEqual((await next.post('/api/auth/login', FOUNDER)).body, { mfaRequired: true });
  assert.equal((await next.get('/api/admin/overview')).status, 401, 'sin código no hay sesión');
  assert.equal((await next.post('/api/auth/mfa', { code: '000000' })).status, 401);
  assert.equal((await next.post('/api/auth/mfa', { code: totpAt(secret, Math.floor(Date.now() / 30000)) })).status, 200);
  assert.equal((await next.get('/api/admin/overview')).status, 200);
  db.prepare("UPDATE users SET totp_enabled = 0 WHERE role = 'admin'").run();
  await founder.post('/api/auth/reauth', { password: FOUNDER.password });
});

test('el patrocinador se cambia solo con motivo, sin ciclos y con trato explícito de pedidos abiertos', async () => {
  const a = await newUser(); await buyFromFounder(a, 'elite');
  const b = await newUser({ ref: codeOf(a.id) }); await buyFromFounder(b, 'start');
  assert.equal(row(b.id).sponsor_id, a.id);
  assert.equal((await founder.post(`/api/admin/users/${a.id}/sponsor`, { code: codeOf(b.id), reason: 'Prueba' })).status, 422, 'formaría un ciclo');
  assert.equal((await founder.post(`/api/admin/users/${a.id}/sponsor`, { code: codeOf(a.id), reason: 'Prueba' })).status, 422, 'a sí mismo');
  const c = await newUser({ ref: codeOf(a.id) });
  const o = (await c.post('/api/orders', { plan: 'start' })).body.order;
  assert.equal((await founder.post(`/api/admin/users/${c.id}/sponsor`, { code: codeOf(b.id) })).status, 422, 'exige motivo');
  assert.equal((await founder.post(`/api/admin/users/${c.id}/sponsor`, { code: codeOf(b.id), reason: 'Error de enlace', reassignOpen: true })).status, 200);
  assert.equal(db.prepare('SELECT seller_id FROM orders WHERE id = ?').get(o.id).seller_id, b.id);
  assert.ok(db.prepare("SELECT 1 FROM audit_log WHERE action = 'red.cambio_patrocinador'").get());
});

test('la red admite generaciones sucesivas y el vendedor solo gestiona las directas', async () => {
  let parent = await newUser(); await buyFromFounder(parent, 'start');
  const root = parent;
  for (let i = 0; i < 3; i++) {
    const child = await newUser({ ref: codeOf(parent.id) });
    await buyFromFounder(child, 'start');
    parent = child;
  }
  assert.equal((await root.get('/api/me/clients')).body.clients.length, 1);
  const tree = (await founder.get(`/api/admin/network?parent=${root.id}`)).body.nodes;
  assert.equal(tree[0].total, 2, 'el fundador ve la estructura completa');
});

test('las liquidaciones están bloqueadas sin reglas y nunca superan lo custodiado', async () => {
  const s = await newUser(); await buyFromFounder(s, 'start');
  assert.equal((await founder.post('/api/admin/payouts', { userId: s.id, amountCents: 100, reference: 'Banco' })).status, 409);
  await founder.post('/api/admin/rules', { enabled: true, directPercent: '10' });
  const b = await newUser({ ref: codeOf(s.id) });
  await approve(founder, (await orderToReview(b, 'start')).id);
  assert.equal((await founder.post('/api/admin/payouts', { userId: s.id, amountCents: 501, reference: 'Banco' })).status, 409);
  assert.equal((await founder.post('/api/admin/payouts', { userId: s.id, amountCents: 500, reference: 'Banco 123' })).status, 200);
  assert.equal((await s.get('/api/me/movements')).body.stats.total.paidOut, 500);
  await founder.post('/api/admin/rules/disable');
});

test('una suspensión bloquea panel y ventas nuevas, conserva el contacto y se puede reactivar', async () => {
  const s = await newUser(); await buyFromFounder(s, 'start');
  assert.equal((await founder.post(`/api/admin/users/${s.id}/status`, { status: 'suspendido' })).status, 422, 'exige motivo');
  assert.equal((await founder.post(`/api/admin/users/${s.id}/status`, { status: 'suspendido', reason: 'Revisión' })).status, 200);
  assert.equal((await s.get('/api/me/campus')).status, 403);
  assert.equal((await s.get('/api/me')).status, 200, 've el estado de su cuenta');
  const b = await newUser({ ref: codeOf(s.id) });
  assert.notEqual(row(b.id).sponsor_id, s.id, 'su enlace no atribuye ventas nuevas');
  await founder.post(`/api/admin/users/${s.id}/status`, { status: 'activo', reason: 'Resuelto' });
  assert.equal((await s.get('/api/me/campus')).status, 200);
});

test('los planes se editan sin alterar pedidos anteriores', async () => {
  const u = await newUser();
  const o = (await u.post('/api/orders', { plan: 'pro' })).body.order;
  await founder.call('PATCH', '/api/admin/plans/pro', { name: 'Intermedio', priceCents: 12000, tagline: 'x', features: ['a'] });
  const again = (await u.get('/api/me/orders')).body.orders[0];
  assert.deepEqual([again.planName, again.baseCents], [o.planName, 10000]);
  await founder.call('PATCH', '/api/admin/plans/pro', { name: 'PRO', priceCents: 10000, tagline: programs[1].tagline, features: programs[1].features });
});

test('los archivos se validan por su contenido y no se sirven fuera de public', async () => {
  const u = await newUser();
  const o = (await u.post('/api/orders', { plan: 'start' })).body.order;
  await u.post(`/api/orders/${o.id}/method`, { method: 'yape' });
  assert.equal((await u.upload(`/api/orders/${o.id}/submission?op=1&fecha=2026-11-03`, Buffer.from('<script>alert(1)</script>'))).status, 415);
  assert.equal((await u.upload(`/api/orders/${o.id}/submission?op=1&fecha=2026-11-03`, Buffer.alloc(6 * 1024 * 1024, 1))).status, 413);
  for (const p of ['/..%2f..%2fserver.mjs', '/data/prod/legado.sqlite', '/server/sales.mjs']) {
    const text = await (await fetch(base + p)).text();
    assert.ok(!text.includes('reviewerRole'), p);
  }
});

test('la copia de seguridad se puede restaurar y conserva los datos', () => {
  const dest = backup(dataDir, join(dataDir, 'copias'));
  const target = join(dataDir, 'restaurado');
  restore(dest, target);
  const copy = openDb(join(target, 'legado.sqlite'));
  assert.equal(copy.prepare('SELECT COUNT(*) AS n FROM users').get().n, db.prepare('SELECT COUNT(*) AS n FROM users').get().n);
  copy.close();
});

test('los importes son enteros, los precios 50, 100 y 200, y WhatsApp usa el número oficial', async () => {
  const { body } = await client().get('/api/bootstrap');
  assert.deepEqual(body.programs.map((p) => p.priceCents), [5000, 10000, 20000]);
  assert.equal(whatsappLink(whatsappMessages.general()), 'https://wa.me/51947328715?text=' + encodeURIComponent('Hola, quiero información sobre los cursos de Legado Digital.'));
  for (const p of programs) assert.ok(whatsappLink(whatsappMessages.plan(p)).startsWith('https://wa.me/51947328715?text='));
});
