// Rutas HTTP. Toda autorización se decide aquí o en las reglas de negocio, nunca en el navegador.
import { createServer } from 'node:http';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DomainError, fail, getJson, sniffFile } from './core.mjs';
import * as acc from './accounts.mjs';
import * as cat from './catalog.mjs';
import * as sales from './sales.mjs';
import { DEFAULTS, getSetting, parseRate, publicSettings, readiness, setSetting } from './settings.mjs';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from './demo.mjs';
import { sandboxPage, sandboxProvider } from './sandbox.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PUBLIC = join(ROOT, 'public');
const SHARED = join(ROOT, 'shared');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8',
};
const JSON_LIMIT = 64 * 1024;
const RECEIPT_MAX = 5 * 1024 * 1024;
const AVATAR_MAX = 2 * 1024 * 1024;
const RESOURCE_MAX = 20 * 1024 * 1024;
const COOKIE = 'ld_session';

const cookieOf = (req, name) => (req.headers.cookie || '').split(/;\s*/).map((c) => c.split('=')).find(([k]) => k === name)?.[1];

function readBody(req, limit) {
  return new Promise((ok, ko) => {
    const chunks = []; let size = 0; let over = false;
    req.on('data', (c) => { size += c.length; if (size > limit) { over = true; chunks.length = 0; return; } chunks.push(c); });
    req.on('end', () => (over ? ko(new DomainError(413, 'too_large', 'El archivo es demasiado grande.')) : ok(Buffer.concat(chunks))));
    req.on('error', ko);
  });
}

function makeLimiter(max, windowMs) {
  const hits = new Map();
  return (key) => {
    const t = Date.now();
    const rec = hits.get(key);
    if (!rec || rec.until < t) { hits.set(key, { n: 1, until: t + windowMs }); return; }
    if (++rec.n > max) throw new DomainError(429, 'too_many', 'Demasiados intentos. Espera unos minutos y vuelve a probar.');
  };
}

const csv = (rows) => rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');

export function createApp({ db, demo = false, dataDir, secureCookies = false, limiter = makeLimiter(20, 10 * 60 * 1000), cardProvider = null, webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET, sandbox = demo }) {
  const dirs = Object.fromEntries(['comprobantes', 'avatares', 'recursos'].map((d) => { const p = join(dataDir, d); mkdirSync(p, { recursive: true }); return [d, p]; }));
  const provider = cardProvider || (sandbox ? sandboxProvider() : null);
  const isSandbox = !cardProvider && sandbox;

  const routes = [];
  const route = (method, pattern, handler, opts = {}) => {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
    routes.push({ method, re, keys, handler, ...opts });
  };
  const needUser = (c) => c.user || fail(401, 'auth', 'Inicia sesión para continuar.');
  const needFounder = (c) => { needUser(c); if (c.user.role !== 'admin') fail(403, 'forbidden', 'Esta zona es solo para el fundador.'); return c.user; };
  // Cursos y ventas exigen una cuenta activa; la cuenta pendiente solo ve su estado y sus pagos.
  const needActive = (c) => { needUser(c); if (c.user.role !== 'admin' && c.user.account_status !== 'activo') fail(403, 'not_active', c.user.account_status === 'suspendido' ? 'Tu cuenta está suspendida. Escríbenos por soporte.' : 'Tu cuenta se activa cuando se confirma tu pago.'); return c.user; };
  const sensitive = (c) => acc.requireRecentAuth(db, c.token);
  const setSession = (res, t, maxAge) => res.setHeader('Set-Cookie', `${COOKIE}=${t}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secureCookies ? '; Secure' : ''}`);
  const store = (dir, buffer, ext) => { const name = `${randomBytes(16).toString('hex')}.${ext}`; writeFileSync(join(dir, name), buffer); return name; };
  const sendFile = (c, dir, name, mime, download) => {
    const file = join(dir, name);
    if (!existsSync(file)) fail(404, 'missing', 'El archivo no está disponible.');
    c.res.writeHead(200, { 'Content-Type': mime, 'Content-Disposition': download ? 'attachment' : 'inline', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
    createReadStream(file).pipe(c.res);
    return DomainError;
  };
  const me = (u) => {
    const unread = db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL').get(u.id).n;
    return acc.publicUser(u, { level: cat.levelOf(db, u.id), unread });
  };

  /* ---------- Público ---------- */
  route('GET', '/api/bootstrap', (c) => ({
    demo, sandbox: isSandbox, programs: cat.listPlans(db), user: c.user ? me(c.user) : null,
    public: publicSettings(db), salesOpen: demo || readiness(db).open,
    demoAccounts: demo ? DEMO_ACCOUNTS.map((a) => ({ ...a, password: DEMO_PASSWORD })) : [],
  }));
  route('GET', '/api/referral/:code', (c) => ({ referral: sales.referralPreview(db, c.params.code) }));
  route('GET', '/api/pricing/:slug', (c) => sales.pricing(db, c.user, c.params.slug, c.query.get('ref'), { sandbox: isSandbox }));
  route('POST', '/api/contact', (c) => {
    c.limit();
    const { name, email, phone, message } = c.body;
    if (!name?.trim()) fail(422, 'invalid', 'Escribe tu nombre.', 'name');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email || '')) fail(422, 'invalid', 'Escribe un correo válido.', 'email');
    if (!message?.trim() || message.length > 2000) fail(422, 'invalid', 'Escribe tu mensaje, con un máximo de 2000 caracteres.', 'message');
    db.prepare('INSERT INTO contacts (name, email, phone, message, created_at) VALUES (?,?,?,?,?)').run(name.trim(), email.trim(), phone?.trim() || null, message.trim(), new Date().toISOString());
    return { ok: true };
  });

  /* ---------- Acceso ---------- */
  route('POST', '/api/auth/register', (c) => {
    c.limit();
    const { user, verifyToken } = acc.register(db, c.body, { isDemo: demo });
    setSession(c.res, acc.createSession(db, user), 1209600);
    // Sin correo conectado, el enlace de verificación solo se muestra en la demostración.
    return { user: me(user), verifyLink: demo ? `/verificar-correo?token=${verifyToken}` : undefined };
  });
  route('POST', '/api/auth/verify', (c) => { acc.verifyEmail(db, c.body.token); return { ok: true }; });
  route('POST', '/api/auth/verify/resend', (c) => { c.limit(); const t = acc.resendVerification(db, needUser(c)); return { ok: true, verifyLink: demo ? `/verificar-correo?token=${t}` : undefined }; });
  route('POST', '/api/auth/login', (c) => {
    c.limit();
    const user = acc.login(db, c.body);
    setSession(c.res, acc.createSession(db, user), 1209600);
    return user.totp_enabled ? { mfaRequired: true } : { user: me(user) };
  });
  route('POST', '/api/auth/mfa', (c) => { c.limit(); return { user: me(acc.completeMfa(db, c.token, c.body.code)) }; });
  route('POST', '/api/auth/logout', (c) => { acc.destroySession(db, c.token); setSession(c.res, '', 0); return { ok: true }; });
  route('POST', '/api/auth/recover', (c) => {
    c.limit();
    const t = acc.requestPasswordReset(db, c.body.email);
    return { ok: true, demoLink: demo && t ? `/recuperar-acceso?token=${t}` : undefined, mailConnected: !!getSetting(db, 'mail').provider };
  });
  route('POST', '/api/auth/reset', (c) => { c.limit(); acc.resetPassword(db, c.body); return { ok: true }; });
  route('POST', '/api/auth/reauth', (c) => { c.limit(); acc.reauth(db, c.token, needUser(c), c.body); return { ok: true }; });

  /* ---------- Mi cuenta ---------- */
  route('GET', '/api/me', (c) => {
    const u = needUser(c);
    const active = u.account_status === 'activo';
    return {
      user: me(u),
      entitlements: cat.liveEntitlements(db, u.id).map((e) => ({ plan: e.plan_slug, source: e.source, grantedAt: e.granted_at })),
      sponsor: u.sponsor_id ? (u.sponsor_source === 'directo' ? 'Legado Digital (venta directa)' : acc.shortName(acc.userById(db, u.sponsor_id))) : null,
      resale: active ? cat.listPlans(db).map((p) => ({ plan: p.slug, allowed: sales.canSell(db, u, p.rank) })) : [],
      stats: active ? sales.statsFor(db, u.id, { demo }) : null,
      community: getSetting(db, 'community'),
    };
  });
  route('PATCH', '/api/me', (c) => ({ user: me(acc.updateProfile(db, needUser(c), c.body)) }));
  route('POST', '/api/me/password', (c) => { acc.changePassword(db, needUser(c), c.body); return { ok: true }; });
  route('POST', '/api/me/avatar', (c) => {
    const u = needUser(c);
    const kind = sniffFile(c.raw, { maxBytes: AVATAR_MAX, allow: ['image/png', 'image/jpeg', 'image/webp'] });
    acc.setAvatar(db, u, { storedName: store(dirs.avatares, c.raw, kind.ext), mime: kind.mime });
    return { ok: true };
  }, { rawBody: true, limit: AVATAR_MAX });
  route('GET', '/api/users/:id/avatar', (c) => {
    const u = needUser(c);
    const target = acc.userById(db, c.params.id);
    if (!target?.avatar_name || (target.id !== u.id && u.role !== 'admin')) fail(404, 'missing', 'Sin foto.');
    return sendFile(c, dirs.avatares, target.avatar_name, target.avatar_mime);
  });
  route('POST', '/api/me/totp/start', (c) => { sensitive(c); return acc.startTotp(db, needFounder(c)); });
  route('POST', '/api/me/totp/enable', (c) => { acc.enableTotp(db, needFounder(c), c.body.code); return { ok: true }; });
  route('GET', '/api/me/notifications', (c) => ({ notifications: db.prepare('SELECT id, title, body, link, read_at AS readAt, created_at AS createdAt FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 50').all(needUser(c).id) }));
  route('POST', '/api/me/notifications/read', (c) => { db.prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL').run(new Date().toISOString(), needUser(c).id); return { ok: true }; });

  /* ---------- Campus ---------- */
  route('GET', '/api/me/campus', (c) => ({ courses: cat.campus(db, needActive(c)) }));
  route('GET', '/api/lessons/:id', (c) => ({ lesson: cat.readLesson(db, needUser(c), c.params.id) }));
  route('POST', '/api/lessons/:id/complete', (c) => { cat.completeLesson(db, needUser(c), c.params.id); return { ok: true }; });
  route('GET', '/api/resources/:id', (c) => { const r = cat.resourceFor(db, needUser(c), c.params.id); return sendFile(c, dirs.recursos, r.stored_name, r.mime, true); });

  /* ---------- Pedidos del comprador ---------- */
  route('GET', '/api/me/orders', (c) => {
    const u = needUser(c);
    return { orders: db.prepare('SELECT * FROM orders WHERE buyer_id = ? ORDER BY id DESC').all(u.id).map((o) => sales.serializeOrder(db, o, u)) };
  });
  route('POST', '/api/orders', (c) => { const u = needUser(c); return { order: sales.serializeOrder(db, sales.createOrder(db, u, c.body, { demo }), u) }; });
  route('POST', '/api/orders/:id/method', (c) => { const u = needUser(c); return { order: sales.serializeOrder(db, sales.chooseMethod(db, u, c.params.id, c.body, { sandbox: isSandbox }), u) }; });
  route('POST', '/api/orders/:id/cancel', (c) => { const u = needUser(c); return { order: sales.serializeOrder(db, sales.cancelOrder(db, u, c.params.id), u) }; });
  route('POST', '/api/orders/:id/submission', (c) => {
    const u = needUser(c);
    sales.ownOrder(db, u, c.params.id);
    const kind = sniffFile(c.raw, { maxBytes: RECEIPT_MAX, allow: ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'] });
    const meta = { operationNumber: c.query.get('op'), paidOn: c.query.get('fecha') };
    if (!String(meta.operationNumber ?? '').trim()) fail(422, 'invalid', 'Escribe el número de operación.', 'operationNumber');
    const file = { storedName: store(dirs.comprobantes, c.raw, kind.ext), mime: kind.mime, size: c.raw.length };
    return { order: sales.serializeOrder(db, sales.submitPayment(db, u, c.params.id, meta, file), u) };
  }, { rawBody: true, limit: RECEIPT_MAX });
  route('GET', '/api/receipts/:id', (c) => { const s = sales.submissionFor(db, needUser(c), c.params.id); return sendFile(c, dirs.comprobantes, s.stored_name, s.mime); });
  route('POST', '/api/orders/:id/checkout', async (c) => {
    const u = needUser(c);
    const o = sales.ownOrder(db, u, c.params.id);
    if (o.status !== 'pendiente_pago' || o.method !== 'tarjeta') fail(409, 'bad_state', 'Elige el pago con tarjeta para este pedido.');
    if (!provider) fail(409, 'card_unavailable', 'El pago con tarjeta aún no está conectado.');
    const { url, ref } = await provider.createCheckout({ order: o, user: u });
    db.prepare('UPDATE orders SET provider_ref = ? WHERE id = ?').run(ref ?? null, o.id);
    return { url };
  });

  /* ---------- Oficina del vendedor ---------- */
  route('GET', '/api/me/clients', (c) => sales.directClients(db, needActive(c), { page: c.query.get('page') || 1 }));
  route('GET', '/api/me/reviews', (c) => {
    const u = needActive(c);
    // Además de lo que puede revisar, ve el estado de los cobros de la plataforma a sus clientes, sin poder confirmarlos.
    const visible = db.prepare(`SELECT * FROM orders WHERE seller_id = ? AND beneficiary_type = 'plataforma' AND status IN ('pendiente_pago','en_revision') AND buyer_id <> ? ORDER BY id DESC`).all(u.id, u.id);
    return { reviews: sales.reviewQueue(db, u).map((o) => sales.serializeOrder(db, o, u)), platform: u.role === 'admin' ? [] : visible.map((o) => sales.serializeOrder(db, o, u)) };
  });
  route('POST', '/api/orders/:id/review', (c) => { const u = needUser(c); return { order: sales.serializeOrder(db, sales.reviewOrder(db, u, c.params.id, c.body), u) }; });
  route('GET', '/api/me/sales', (c) => ({ sales: sales.salesFor(db, needActive(c), Object.fromEntries(c.query)) }));
  route('GET', '/api/me/movements', (c) => {
    const u = needActive(c);
    const rule = sales.activeRule(db);
    return { stats: sales.statsFor(db, u.id, { demo }), movements: sales.movementsFor(db, u.id, { demo }), available: sales.availableFor(db, u.id), rule: rule ? { version: rule.version, directPercent: rule.direct_bps / 100 } : null };
  });
  route('GET', '/api/me/payout-methods', (c) => ({ methods: sales.payoutMethodsOf(db, needActive(c).id), directEnabled: getSetting(db, 'payments').modes.directo }));
  route('POST', '/api/me/payout-methods', (c) => { const u = needActive(c); sensitive(c); sales.setPayoutMethod(db, u, c.body); return { methods: sales.payoutMethodsOf(db, u.id) }; });
  route('POST', '/api/me/referral-link', (c) => {
    const u = needActive(c);
    const p = cat.planBySlug(db, c.body.plan);
    if (!sales.canSell(db, u, p.rank)) fail(403, 'resale_not_allowed', 'Tu nivel actual no permite vender este programa. Solicita una actualización.');
    return { path: `/comprar/${p.slug}?ref=${u.referral_code}` };
  });

  /* ---------- Fundador ---------- */
  route('GET', '/api/admin/overview', (c) => {
    const f = needFounder(c);
    const count = (sql, ...a) => db.prepare(sql).get(...a).n;
    const demoFilter = demo ? '' : 'AND is_demo = 0';
    return {
      readiness: readiness(db),
      users: Object.fromEntries(['pendiente', 'activo', 'suspendido'].map((s) => [s, count(`SELECT COUNT(*) AS n FROM users WHERE role <> 'admin' AND account_status = ? ${demoFilter}`, s)])),
      orders: Object.fromEntries(['pendiente_pago', 'en_revision', 'aprobado', 'rechazado', 'cancelado'].map((s) => [s, count(`SELECT COUNT(*) AS n FROM orders WHERE status = ? ${demoFilter}`, s)])),
      reviewsForMe: sales.reviewQueue(db, f).length,
      gross: Object.fromEntries([['last7', 7], ['last30', 30], ['total', null]].map(([k, d]) => [k, db.prepare(`SELECT COALESCE(SUM(amount_cents),0) AS s FROM movements WHERE type IN ('venta','ajuste') AND relates_to = 'venta' ${demoFilter} ${d ? `AND created_at >= strftime('%Y-%m-%dT%H:%M:%fZ','now','-${d} days')` : ''}`).get().s])),
      network: sales.networkSummary(db, f.id),
      activity: db.prepare('SELECT a.action, a.target, a.created_at, u.first_name AS actor FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.id DESC LIMIT 12').all(),
      currency: 'USD', updatedAt: new Date().toISOString(),
    };
  });
  route('GET', '/api/admin/users', (c) => {
    needFounder(c);
    const q = `%${c.query.get('q') || ''}%`; const status = c.query.get('estado');
    const rows = db.prepare(`SELECT u.*, s.first_name AS s_first, s.last_name AS s_last FROM users u LEFT JOIN users s ON s.id = u.sponsor_id
      WHERE (u.first_name || ' ' || u.last_name || ' ' || u.email) LIKE ? ${status ? 'AND u.account_status = ?' : ''} ORDER BY u.id DESC LIMIT 200`).all(...(status ? [q, status] : [q]));
    return { users: rows.map((u) => ({ ...acc.publicUser(u), level: cat.levelOf(db, u.id), sponsor: u.s_first ? `${u.s_first} ${u.s_last}` : null, createdAt: u.created_at })) };
  });
  route('POST', '/api/admin/users/:id/status', (c) => { sales.setAccountStatus(db, needFounder(c), c.params.id, c.body); return { ok: true }; });
  route('POST', '/api/admin/users/:id/verifier', (c) => { const f = needFounder(c); sensitive(c); sales.setVerifier(db, f, c.params.id, c.body); return { ok: true }; });
  route('POST', '/api/admin/users/:id/grant', (c) => { const f = needFounder(c); sensitive(c); sales.grantByAdmin(db, f, c.params.id, c.body); return { ok: true }; });
  route('POST', '/api/admin/users/:id/sponsor', (c) => { sales.changeSponsor(db, needFounder(c), c.params.id, c.body); return { ok: true }; });
  route('GET', '/api/admin/orders', (c) => {
    const f = needFounder(c);
    const where = []; const args = [];
    for (const [k, col] of [['estado', 'status'], ['metodo', 'method'], ['plan', 'plan_slug']]) if (c.query.get(k)) { where.push(`${col} = ?`); args.push(c.query.get(k)); }
    return { orders: db.prepare(`SELECT * FROM orders ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY id DESC LIMIT 200`).all(...args).map((o) => sales.serializeOrder(db, o, f)) };
  });
  route('POST', '/api/admin/orders/:id/refund', (c) => { const f = needFounder(c); sensitive(c); sales.refundOrder(db, f, c.params.id, c.body); return { ok: true }; });
  route('POST', '/api/admin/orders/:id/reconcile', (c) => {
    needFounder(c);
    const o = sales.getOrder(db, c.params.id) || fail(404, 'no_order', 'No encontramos ese pedido.');
    const event = provider?.getStatus ? provider.getStatus(o) : null;
    if (!event) return { found: false };
    return { found: true, result: sales.applyPaymentEvent(db, event) };
  });
  route('GET', '/api/admin/network', (c) => { const f = needFounder(c); const parent = c.query.get('parent'); return sales.networkChildren(db, parent ? Number(parent) : f.id, { page: c.query.get('page') || 1 }); });
  route('PATCH', '/api/admin/plans/:slug', (c) => ({ programs: cat.updatePlan(db, needFounder(c), c.params.slug, c.body) }));
  route('GET', '/api/admin/catalog', (c) => { needFounder(c); return { courses: cat.adminTree(db) }; });
  route('POST', '/api/admin/modules', (c) => ({ id: cat.addModule(db, needFounder(c), c.body) }));
  route('POST', '/api/admin/lessons', (c) => ({ id: cat.addLesson(db, needFounder(c), c.body) }));
  route('PATCH', '/api/admin/lessons/:id', (c) => { cat.editLesson(db, needFounder(c), c.params.id, c.body); return { ok: true }; });
  route('POST', '/api/admin/lessons/:id/resources', (c) => {
    const f = needFounder(c);
    const kind = sniffFile(c.raw, { maxBytes: RESOURCE_MAX, allow: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'] });
    cat.addResource(db, f, c.params.id, { title: c.query.get('titulo'), storedName: store(dirs.recursos, c.raw, kind.ext), mime: kind.mime, size: c.raw.length });
    return { ok: true };
  }, { rawBody: true, limit: RESOURCE_MAX });
  route('DELETE', '/api/admin/resources/:id', (c) => { cat.removeResource(db, needFounder(c), c.params.id); return { ok: true }; });
  route('GET', '/api/admin/settings', (c) => { needFounder(c); return { settings: Object.fromEntries(Object.keys(DEFAULTS).map((k) => [k, getSetting(db, k)])), readiness: readiness(db) }; });
  route('PUT', '/api/admin/settings/:key', (c) => {
    const f = needFounder(c);
    // Cuentas receptoras, cambio y políticas económicas exigen confirmar la identidad.
    if (['payments', 'fx', 'policies'].includes(c.params.key)) sensitive(c);
    let value = c.body;
    if (c.params.key === 'fx') {
      const rate = parseRate(c.body.rate);
      const until = new Date(c.body.validUntil);
      if (!rate) fail(422, 'invalid', 'Escribe un tipo de cambio válido, por ejemplo 3.7500.', 'rate');
      if (Number.isNaN(until.getTime()) || until.getTime() <= Date.now()) fail(422, 'invalid', 'La vigencia debe ser una fecha futura.', 'validUntil');
      value = { rate, validUntil: until.toISOString(), source: 'fundador' };
    }
    setSetting(db, f, c.params.key, value);
    return { ok: true, readiness: readiness(db) };
  });
  route('GET', '/api/admin/rules', (c) => { needFounder(c); return { rules: sales.listRules(db) }; });
  route('POST', '/api/admin/rules', (c) => { const f = needFounder(c); sensitive(c); return { version: sales.createRule(db, f, c.body) }; });
  route('POST', '/api/admin/rules/disable', (c) => { const f = needFounder(c); sensitive(c); sales.disableRules(db, f); return { ok: true }; });
  route('GET', '/api/admin/payouts', (c) => {
    needFounder(c);
    const users = db.prepare("SELECT id, first_name, last_name FROM users WHERE account_status = 'activo' AND role <> 'admin'").all()
      .map((u) => ({ id: u.id, name: `${u.first_name} ${u.last_name}`, availableCents: sales.availableFor(db, u.id) })).filter((u) => u.availableCents !== 0);
    return { enabled: !!sales.activeRule(db), users, payouts: db.prepare('SELECT p.*, u.first_name, u.last_name FROM payouts p JOIN users u ON u.id = p.user_id ORDER BY p.id DESC LIMIT 100').all() };
  });
  route('POST', '/api/admin/payouts', (c) => { const f = needFounder(c); sensitive(c); sales.createPayout(db, f, c.body.userId, c.body); return { ok: true }; });
  route('POST', '/api/admin/notifications', (c) => {
    const f = needFounder(c);
    const title = String(c.body.title ?? '').trim(); const body = String(c.body.body ?? '').trim();
    if (!title || !body) fail(422, 'invalid', 'Escribe el título y el mensaje.', 'title');
    const ids = db.prepare("SELECT id FROM users WHERE role <> 'admin'").all();
    for (const { id } of ids) acc.notify(db, id, { title, body });
    db.prepare('INSERT INTO audit_log (actor_id, action, target, detail, created_at) VALUES (?,?,?,?,?)').run(f.id, 'aviso.general', null, title, new Date().toISOString());
    return { sent: ids.length };
  });
  route('GET', '/api/admin/contacts', (c) => { needFounder(c); return { contacts: db.prepare('SELECT * FROM contacts ORDER BY id DESC LIMIT 200').all() }; });
  route('GET', '/api/admin/audit', (c) => { needFounder(c); return { log: db.prepare("SELECT a.*, u.first_name || ' ' || u.last_name AS actor FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.id DESC LIMIT 200").all() }; });
  route('GET', '/api/admin/outbox', (c) => { needFounder(c); return { mails: db.prepare('SELECT id, to_email, subject, sent_at, created_at FROM outbox ORDER BY id DESC LIMIT 50').all() }; });
  route('GET', '/api/admin/export/:what', (c) => {
    const f = needFounder(c);
    let rows;
    if (c.params.what === 'pedidos') rows = [['Pedido', 'Comprador', 'Vendedor', 'Plan', 'Importe USD', 'Cobro', 'Moneda', 'Medio', 'Estado', 'Fecha'],
      ...db.prepare('SELECT * FROM orders ORDER BY id').all().map((o) => { const s = sales.serializeOrder(db, o, f); return [s.code, s.buyer, s.seller, s.planName, o.base_cents / 100, o.charge_cents === null ? '' : o.charge_cents / 100, o.charge_currency, o.method, o.status, o.created_at]; })];
    else if (c.params.what === 'usuarios') rows = [['Nombre', 'Correo', 'País', 'Estado', 'Nivel', 'Alta'],
      ...db.prepare("SELECT * FROM users WHERE role <> 'admin' ORDER BY id").all().map((u) => [acc.fullName(u), u.email, u.country, u.account_status, cat.levelOf(db, u.id), u.created_at])];
    else fail(404, 'not_found', 'Exportación no disponible.');
    db.prepare('INSERT INTO audit_log (actor_id, action, target, detail, created_at) VALUES (?,?,?,?,?)').run(f.id, 'exportacion', c.params.what, `${rows.length - 1} filas`, new Date().toISOString());
    c.res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="legado-${c.params.what}.csv"`, 'Cache-Control': 'no-store' });
    c.res.end(`﻿${csv(rows)}`);
    return DomainError;
  });

  /* ---------- Pagos con tarjeta ---------- */
  // Única vía para que una tarjeta active un curso: confirmación firmada por la pasarela.
  route('POST', '/api/payments/webhook', (c) => {
    if (!webhookSecret) fail(503, 'not_connected', 'La pasarela no está conectada.');
    const expected = createHmac('sha256', webhookSecret).update(c.raw).digest();
    const given = Buffer.from(String(c.req.headers['x-ld-signature'] || ''), 'hex');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) fail(401, 'bad_signature', 'Firma no válida.');
    const event = getJson(c.raw.toString('utf8'), null) || fail(400, 'bad_json', 'Petición no válida.');
    return sales.applyPaymentEvent(db, event);
  }, { rawBody: true, limit: JSON_LIMIT });

  /* ---------- Sandbox ---------- */
  if (isSandbox) {
    route('GET', '/sandbox/checkout/:id', (c) => {
      const o = sales.ownOrder(db, needUser(c), c.params.id);
      c.res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      c.res.end(sandboxPage(o));
      return DomainError;
    }, { page: true });
    route('POST', '/sandbox/checkout/:id', (c) => {
      const o = sales.ownOrder(db, needUser(c), c.params.id);
      const result = new URLSearchParams(c.raw.toString()).get('result') === 'paid' ? 'paid' : 'failed';
      sales.applyPaymentEvent(db, provider.record(o, result));
      c.res.writeHead(303, { Location: '/mi-cuenta/pedidos' });
      c.res.end();
      return DomainError;
    }, { page: true, rawBody: true, limit: 1024 });
  }

  /* ---------- Estáticos ---------- */
  function serveStatic(req, res, pathname) {
    const base = pathname.startsWith('/shared/') ? SHARED : PUBLIC;
    const rel = pathname.startsWith('/shared/') ? pathname.slice('/shared/'.length) : pathname.slice(1);
    const file = normalize(join(base, decodeURIComponent(rel)));
    if (!file.startsWith(base + sep)) return false;
    if (!existsSync(file) || !statSync(file).isFile()) return false;
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    if (req.method === 'HEAD') res.end(); else createReadStream(file).pipe(res);
    return true;
  }

  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    const sendJson = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
    const hit = routes.find((r) => r.method === req.method && r.re.test(url.pathname));
    const isApi = url.pathname.startsWith('/api/');
    try {
      if (isApi || hit?.page) {
        if (!hit) return sendJson(404, { error: 'not_found', message: 'Ruta no encontrada.' });
        if (req.method !== 'GET') {
          // Junto a SameSite=Lax, impide escrituras desde otros orígenes.
          const origin = req.headers.origin;
          if (origin && new URL(origin).host !== req.headers.host && url.pathname !== '/api/payments/webhook') fail(403, 'origin', 'Origen no permitido.');
        }
        const m = hit.re.exec(url.pathname);
        const params = Object.fromEntries(hit.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
        const t = cookieOf(req, COOKIE);
        const c = { req, res, params, query: url.searchParams, token: t, user: acc.userFromSession(db, t), limit: () => limiter(`${req.socket.remoteAddress}:${url.pathname}`) };
        if (req.method !== 'GET') {
          const raw = await readBody(req, hit.rawBody ? hit.limit || RECEIPT_MAX : JSON_LIMIT);
          if (hit.rawBody) c.raw = raw;
          else if (raw.length) { c.body = getJson(raw.toString('utf8'), undefined); if (c.body === undefined) fail(400, 'bad_json', 'Petición no válida.'); }
          c.body ??= {};
        }
        const out = await hit.handler(c);
        if (out !== DomainError) sendJson(200, out);
        return;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(405, { error: 'method' });
      if (serveStatic(req, res, url.pathname)) return;
      if (extname(url.pathname)) { res.writeHead(404); return res.end(); }
      serveStatic(req, res, '/index.html');
    } catch (err) {
      if (err instanceof DomainError) {
        if (hit?.page && err.status === 401) { res.writeHead(303, { Location: '/iniciar-sesion' }); return res.end(); }
        return sendJson(err.status, { error: err.code, message: err.message, field: err.field });
      }
      console.error(err);
      if (!res.headersSent) sendJson(500, { error: 'server', message: 'No se pudo completar la acción. Vuelve a intentarlo.' });
    }
  });
}
