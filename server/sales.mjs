// Pedidos, cobros, revisiones, movimientos económicos y red de referidos.
// Importes en unidades enteras con su moneda. La aprobación, el acceso y el registro económico van en una sola transacción.
import { randomBytes } from 'node:crypto';
import { audit, fail, getJson, MIN_NOTE, now, tx } from './core.mjs';
import { founderOf, fullName, notify, queueEmail, shortName, userById } from './accounts.mjs';
import { grantPlan, levelOf, planByRank, planBySlug, revokeByOrder } from './catalog.mjs';
import { currentFx, getSetting, MANUAL_METHODS, methodReady, readiness, toPen } from './settings.mjs';

const OPEN = "('pendiente_pago','en_revision')";
export const orderCode = (id) => `LD-${String(id).padStart(6, '0')}`;
const logEvent = (db, orderId, from, to, actorId, note) =>
  db.prepare('INSERT INTO order_events (order_id, from_status, to_status, actor_id, note, created_at) VALUES (?,?,?,?,?,?)').run(orderId, from, to, actorId ?? null, note ?? null, now());
export const getOrder = (db, id) => db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(id)) || null;

/* ---------- Quién puede vender qué ---------- */
// Regla inicial documentada: un vendedor activo ofrece su plan y los inferiores.
export function canSell(db, seller, rank) {
  if (!seller) return false;
  if (seller.role === 'admin') return true;
  if (seller.account_status !== 'activo') return false;
  const policy = getSetting(db, 'policies').resale;
  return policy === 'plan_e_inferiores' && rank <= levelOf(db, seller.id);
}

// Quién atiende la venta: el patrocinador si puede vender ese plan; si no, la plataforma.
export function attendedBy(db, sponsor, rank) {
  const founder = founderOf(db);
  if (sponsor && sponsor.role !== 'admin' && canSell(db, sponsor, rank)) return { seller: sponsor, saleType: 'vendedor', fallback: false };
  return { seller: founder, saleType: 'plataforma', fallback: !!sponsor && sponsor.role !== 'admin' };
}
const attendedView = (a) => ({ type: a.saleType, name: a.saleType === 'vendedor' ? shortName(a.seller) : 'Legado Digital (venta directa)', fallback: a.fallback });

export function referralPreview(db, code) {
  const s = db.prepare("SELECT * FROM users WHERE referral_code = ? AND account_status = 'activo'").get(String(code || ''));
  if (!s) return null;
  const plans = db.prepare('SELECT slug, rank FROM plans ORDER BY rank').all();
  return { name: s.role === 'admin' ? 'Legado Digital' : shortName(s), allowed: plans.filter((p) => canSell(db, s, p.rank)).map((p) => p.slug) };
}

export function quoteFor(db, level, slug) {
  const target = planBySlug(db, slug);
  if (target.rank <= level) return null;
  const current = level > 0 ? planByRank(db, level) : null;
  return { target, baseCents: target.price_cents - (current?.price_cents ?? 0), kind: level > 0 ? 'actualizacion' : 'compra' };
}

/* ---------- Importes por medio de pago ---------- */
export function cardCharge(baseCents, card) {
  if (card.absorbedBy === 'legado') return { known: true, feeCents: 0, totalCents: baseCents };
  const fee = card.buyerFee;
  if (card.absorbedBy !== 'comprador' || !fee) return { known: false, feeCents: null, totalCents: null };
  const { percentBps = 0, fixedCents = 0, mode = 'sobre_base' } = fee;
  const totalCents = mode === 'sobre_total'
    ? Math.ceil(((baseCents + fixedCents) * 10000) / (10000 - percentBps))
    : baseCents + fixedCents + Math.ceil((baseCents * percentBps) / 10000);
  return { known: true, feeCents: totalCents - baseCents, totalCents };
}
const activePayout = (db, userId, method) => db.prepare('SELECT * FROM payout_methods WHERE user_id = ? AND method = ? AND replaced_at IS NULL').get(userId, method);

// Resuelve beneficiario, moneda e importe de un medio para una venta. Sin datos completos, el medio no está disponible.
export function resolveMethod(db, { saleType, sellerId, baseCents }, method, { sandbox = false } = {}) {
  const pay = getSetting(db, 'payments');
  if (method === 'tarjeta') {
    const ready = (pay.card.enabled && pay.card.provider) || sandbox;
    const c = cardCharge(baseCents, sandbox && !pay.card.absorbedBy ? { absorbedBy: 'legado' } : pay.card);
    if (!ready || !c.known) return { available: false, reason: 'El pago con tarjeta aún no está configurado.' };
    return { available: true, beneficiaryType: 'plataforma', beneficiary: { name: 'Legado Digital', holder: 'Pasarela de pago' }, instructions: null, currency: 'USD', chargeCents: c.totalCents, feeCents: c.feeCents, fx: null, sandbox: !(pay.card.enabled && pay.card.provider) };
  }
  const def = MANUAL_METHODS[method];
  if (!def) return { available: false, reason: 'Medio de pago no válido.' };
  let target = null;
  if (pay.modes.directo && saleType === 'vendedor') {
    const pm = activePayout(db, sellerId, method);
    if (pm) target = { beneficiaryType: 'vendedor', beneficiary: { name: shortName(userById(db, sellerId)), holder: pm.holder, account: pm.account }, currency: pm.currency, instructions: 'Paga directamente a tu vendedor con los datos indicados.' };
  }
  if (!target && pay.modes.centralizado && methodReady(pay.platform[method])) {
    const p = pay.platform[method];
    target = { beneficiaryType: 'plataforma', beneficiary: { name: 'Legado Digital', holder: p.holder, account: p.account, bank: p.bank }, currency: p.currency, instructions: p.instructions };
  }
  if (!target) return { available: false, reason: 'Este medio aún no tiene una cuenta receptora configurada.' };
  let chargeCents = baseCents; let fx = null;
  if (target.currency === 'PEN') {
    fx = currentFx(db);
    if (!fx) return { available: false, reason: 'Falta un tipo de cambio vigente para cobrar en soles.' };
    chargeCents = toPen(baseCents, fx.rate);
    if (pay.walletLimitPenCents && ['yape', 'plin'].includes(method) && chargeCents > pay.walletLimitPenCents) return { available: false, reason: 'El importe supera el límite de esta billetera.' };
  }
  return { available: true, ...target, chargeCents, feeCents: 0, fx };
}

export function pricing(db, viewer, slug, refCode, { sandbox }) {
  const level = viewer ? levelOf(db, viewer.id) : 0;
  const q = quoteFor(db, level, slug);
  if (!q) return { alreadyIncluded: true };
  const sponsor = viewer ? userById(db, viewer.sponsor_id) : (refCode ? db.prepare("SELECT * FROM users WHERE referral_code = ? AND account_status = 'activo'").get(String(refCode)) : null);
  const who = attendedBy(db, sponsor, q.target.rank);
  const ctx = { saleType: who.saleType, sellerId: who.seller?.id, baseCents: q.baseCents };
  const methods = ['tarjeta', ...Object.keys(MANUAL_METHODS)].map((m) => {
    const r = resolveMethod(db, ctx, m, { sandbox });
    return { method: m, name: m === 'tarjeta' ? 'Tarjeta' : MANUAL_METHODS[m].name, available: r.available, reason: r.reason ?? null, currency: r.currency ?? null, chargeCents: r.chargeCents ?? null, feeCents: r.feeCents ?? null, fx: r.fx ?? null, beneficiaryType: r.beneficiaryType ?? null };
  });
  return { plan: q.target.slug, planName: q.target.name, baseCents: q.baseCents, currency: 'USD', kind: q.kind, attendedBy: attendedView(who), methods };
}

/* ---------- Pedido ---------- */
export function createOrder(db, buyer, { plan }, { demo = false } = {}) {
  if (!buyer.email_verified_at) fail(403, 'verify_email', 'Confirma tu correo antes de comprar. Revisa tu bandeja o solicita un nuevo enlace.');
  if (buyer.account_status === 'suspendido') fail(403, 'suspended', 'Tu cuenta está suspendida. Contacta con soporte.');
  if (buyer.role === 'admin') fail(409, 'founder', 'La cuenta del fundador no compra planes.');
  if (!demo) {
    const r = readiness(db);
    if (!r.open) fail(409, 'sales_closed', `Las ventas aún no están abiertas. Falta: ${r.missing.join(', ')}.`);
  }
  const q = quoteFor(db, levelOf(db, buyer.id), plan);
  if (!q) fail(409, 'already_has_level', 'Tu plan actual ya incluye este contenido.');
  const open = db.prepare(`SELECT * FROM orders WHERE buyer_id = ? AND status IN ${OPEN}`).get(buyer.id);
  if (open) {
    if (open.plan_slug === q.target.slug) return open;
    fail(409, 'open_order', 'Ya tienes un pedido abierto. Complétalo o cancélalo antes de iniciar otro.');
  }
  const who = attendedBy(db, userById(db, buyer.sponsor_id), q.target.rank);
  if (who.seller?.id === buyer.id) fail(409, 'self', 'No puedes comprarte a ti mismo.');
  return tx(db, () => {
    const id = db.prepare(`INSERT INTO orders (buyer_id, seller_id, sale_type, kind, plan_slug, plan_name, from_rank, to_rank, base_cents, currency, status, is_demo, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(buyer.id, who.seller?.id ?? null, who.saleType, q.kind, q.target.slug, q.target.name, levelOf(db, buyer.id), q.target.rank,
      q.baseCents, 'USD', 'pendiente_pago', buyer.is_demo, now()).lastInsertRowid;
    logEvent(db, id, null, 'pendiente_pago', buyer.id, who.fallback ? 'Tu patrocinador no puede ofrecer este plan: lo atiende Legado Digital como venta directa.' : null);
    return getOrder(db, id);
  });
}

export function ownOrder(db, user, id) {
  const o = getOrder(db, id);
  if (!o || o.buyer_id !== user.id) fail(404, 'no_order', 'No encontramos ese pedido.');
  return o;
}

// Elegir el medio guarda una copia del beneficiario y las instrucciones: cambios posteriores no alteran este pedido.
export function chooseMethod(db, buyer, id, { method }, { sandbox }) {
  const o = ownOrder(db, buyer, id);
  if (o.status !== 'pendiente_pago') fail(409, 'bad_state', 'Este pedido ya no admite cambiar el medio de pago.');
  const r = resolveMethod(db, { saleType: o.sale_type, sellerId: o.seller_id, baseCents: o.base_cents }, method, { sandbox });
  if (!r.available) fail(409, 'method_unavailable', r.reason);
  return tx(db, () => {
    db.prepare(`UPDATE orders SET method = ?, beneficiary_type = ?, beneficiary_snapshot = ?, instructions_snapshot = ?, charge_cents = ?, charge_currency = ?,
      fx_rate = ?, fx_valid_until = ?, buyer_fee_cents = ? WHERE id = ?`).run(method, r.beneficiaryType, JSON.stringify(r.beneficiary), r.instructions ?? null,
      r.chargeCents, r.currency, r.fx?.rate ?? null, r.fx?.validUntil ?? null, r.feeCents ?? 0, o.id);
    logEvent(db, o.id, o.status, o.status, buyer.id, `Medio elegido: ${method === 'tarjeta' ? 'tarjeta' : MANUAL_METHODS[method].name}.`);
    return getOrder(db, o.id);
  });
}

export function cancelOrder(db, buyer, id) {
  const o = ownOrder(db, buyer, id);
  return tx(db, () => {
    const { changes } = db.prepare(`UPDATE orders SET status = 'cancelado' WHERE id = ? AND status IN ${OPEN}`).run(o.id);
    if (!changes) fail(409, 'bad_state', 'Este pedido ya no se puede cancelar.');
    logEvent(db, o.id, o.status, 'cancelado', buyer.id);
    return getOrder(db, o.id);
  });
}

/* ---------- Comprobantes y revisión ---------- */
export function submitPayment(db, buyer, id, { operationNumber, paidOn }, file) {
  const o = ownOrder(db, buyer, id);
  if (o.status !== 'pendiente_pago') fail(409, 'bad_state', 'Este pedido no espera un comprobante ahora mismo.');
  if (!o.method || o.method === 'tarjeta') fail(409, 'bad_state', 'Elige primero un medio de pago manual.');
  if (!String(operationNumber ?? '').trim()) fail(422, 'invalid', 'Escribe el número de operación.', 'operationNumber');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(paidOn ?? ''))) fail(422, 'invalid', 'Indica la fecha del pago.', 'paidOn');
  return tx(db, () => {
    db.prepare(`INSERT INTO payment_submissions (order_id, user_id, method, operation_number, paid_on, stored_name, mime, size, status, created_at)
      VALUES (?,?,?,?,?,?,?,?,'en_revision',?)`).run(o.id, buyer.id, o.method, String(operationNumber).trim().slice(0, 80), paidOn, file.storedName, file.mime, file.size, now());
    db.prepare("UPDATE orders SET status = 'en_revision' WHERE id = ?").run(o.id);
    logEvent(db, o.id, 'pendiente_pago', 'en_revision', buyer.id, 'Comprobante enviado.');
    for (const r of reviewersOf(db, getOrder(db, o.id))) notify(db, r.id, { title: 'Pago por revisar', body: `${orderCode(o.id)}: ${fullName(buyer)} envió un comprobante.`, link: r.role === 'admin' ? '/admin/pagos' : '/mi-cuenta/pagos' });
    return getOrder(db, o.id);
  });
}

// Quién puede resolver: el vendedor si cobró él; si cobró la plataforma, el fundador o un verificador delegado. Nunca el propio comprador.
export function reviewerRole(db, reviewer, o) {
  if (!reviewer || reviewer.id === o.buyer_id) return null;
  if (!o.method || o.method === 'tarjeta') return null;
  if (o.beneficiary_type === 'vendedor') {
    if (reviewer.id === o.seller_id && reviewer.account_status === 'activo') return 'vendedor';
    return reviewer.role === 'admin' ? 'fundador' : null;
  }
  if (reviewer.role === 'admin') return 'fundador';
  if (reviewer.can_verify && reviewer.account_status === 'activo' && reviewer.id !== o.seller_id) return 'verificador';
  return null;
}
function reviewersOf(db, o) {
  if (o.beneficiary_type === 'vendedor') return [userById(db, o.seller_id), founderOf(db)].filter(Boolean);
  return [founderOf(db), ...db.prepare("SELECT * FROM users WHERE can_verify = 1 AND account_status = 'activo'").all()].filter((u) => u && u.id !== o.seller_id && u.id !== o.buyer_id);
}

export function reviewOrder(db, reviewer, id, { decision, note, confirm }) {
  const o = getOrder(db, id) || fail(404, 'no_order', 'No encontramos ese pedido.');
  const role = reviewerRole(db, reviewer, o);
  if (!role) fail(403, 'forbidden', 'No puedes revisar este pago.');
  if (!['aprobar', 'rechazar'].includes(decision)) fail(422, 'invalid', 'Elige aprobar o rechazar.');
  // El fundador puede intervenir en un cobro directo de un vendedor, siempre con motivo.
  const intervention = role === 'fundador' && o.beneficiary_type === 'vendedor';
  if (decision === 'rechazar' || intervention) MIN_NOTE(note, 'note', decision === 'rechazar' ? 'Explica el motivo del rechazo.' : 'Indica el motivo de tu intervención.');
  if (decision === 'aprobar' && confirm !== true) fail(422, 'confirm', 'Confirma que comprobaste el ingreso en la cuenta receptora.');
  return tx(db, () => {
    const sub = db.prepare("SELECT * FROM payment_submissions WHERE order_id = ? AND status = 'en_revision' ORDER BY id DESC LIMIT 1").get(o.id);
    if (decision === 'rechazar') {
      const { changes } = db.prepare("UPDATE orders SET status = 'pendiente_pago', review_note = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ? AND status = 'en_revision'").run(note.trim(), reviewer.id, now(), o.id);
      if (!changes) fail(409, 'already_reviewed', 'Este pago ya fue revisado. No se aplicó ningún cambio.');
      if (sub) db.prepare("UPDATE payment_submissions SET status = 'rechazado', review_note = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?").run(note.trim(), reviewer.id, now(), sub.id);
      logEvent(db, o.id, 'en_revision', 'pendiente_pago', reviewer.id, `Comprobante rechazado: ${note.trim()}`);
      notify(db, o.buyer_id, { title: 'Revisa tu comprobante', body: `Tu pago de ${orderCode(o.id)} no se pudo confirmar: ${note.trim()} Puedes enviar uno corregido.`, link: '/mi-cuenta/pedidos' });
      audit(db, reviewer.id, 'pago.rechazado', `orden:${o.id}`, note.trim());
      return getOrder(db, o.id);
    }
    const { changes } = db.prepare("UPDATE orders SET status = 'aprobado', review_note = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ? AND status = 'en_revision' AND settlement IS NULL")
      .run(note?.trim() || null, reviewer.id, now(), o.id);
    if (!changes) fail(409, 'already_reviewed', 'Este pago ya fue revisado. No se aplicó ningún cambio.');
    if (sub) db.prepare("UPDATE payment_submissions SET status = 'aprobado', reviewed_by = ?, reviewed_at = ? WHERE id = ?").run(reviewer.id, now(), sub.id);
    logEvent(db, o.id, 'en_revision', 'aprobado', reviewer.id, intervention ? `Intervención del fundador: ${note.trim()}` : 'Pago verificado.');
    approveEffects(db, getOrder(db, o.id));
    audit(db, reviewer.id, intervention ? 'pago.aprobado_intervencion' : 'pago.aprobado', `orden:${o.id}`, `${role}${note?.trim() ? `. ${note.trim()}` : ''}`);
    return getOrder(db, o.id);
  });
}

export const activeRule = (db) => db.prepare('SELECT * FROM commission_rules WHERE enabled = 1 ORDER BY version DESC LIMIT 1').get() || null;

// Efectos de un pago confirmado. Se llaman dentro de la transacción que cambia el estado, una sola vez por pedido.
function approveEffects(db, o) {
  const rule = activeRule(db);
  grantPlan(db, o.buyer_id, o.to_rank, { orderId: o.id, source: 'pedido' });
  db.prepare("UPDATE users SET account_status = 'activo' WHERE id = ? AND account_status = 'pendiente'").run(o.buyer_id);
  db.prepare('UPDATE users SET referral_code = ? WHERE id = ? AND referral_code IS NULL').run(randomBytes(4).toString('hex').toUpperCase(), o.buyer_id);
  db.prepare('UPDATE orders SET rule_version_id = ? WHERE id = ?').run(rule?.id ?? null, o.id);
  const custody = o.beneficiary_type === 'vendedor' ? 'externo' : 'plataforma';
  // La venta registra lo cobrado; si lo cobró el vendedor, queda como ingreso externo y no como saldo de la plataforma.
  db.prepare(`INSERT INTO movements (user_id, order_id, type, amount_cents, currency, custody, status, rule_version_id, relates_to, note, is_demo, created_at)
    VALUES (?,?,'venta',?,?,?,'confirmado',?,'venta',?,?,?)`).run(o.seller_id, o.id, o.base_cents, o.currency, custody, rule?.id ?? null, `Venta ${orderCode(o.id)}`, o.is_demo, now());
  // Solo hay comisión con una regla habilitada, en ventas de vendedor cobradas por la plataforma.
  if (rule?.direct_bps && o.sale_type === 'vendedor' && custody === 'plataforma') {
    const amount = Math.floor((o.base_cents * rule.direct_bps) / 10000);
    db.prepare(`INSERT INTO movements (user_id, order_id, type, amount_cents, currency, custody, status, rule_version_id, relates_to, note, is_demo, created_at)
      VALUES (?,?,'comision',?,?,'plataforma','confirmado',?,'comision',?,?,?)`).run(o.seller_id, o.id, amount, o.currency, rule.id, `Comisión v${rule.version} de ${orderCode(o.id)}`, o.is_demo, now());
  }
  const buyer = userById(db, o.buyer_id);
  notify(db, o.buyer_id, { title: 'Tu acceso está activo', body: `Tu pago de ${o.plan_name} fue confirmado. Ya puedes entrar a tu formación.`, link: '/mi-cuenta' });
  queueEmail(db, buyer.email, 'Tu acceso a Legado Digital está activo', 'Tu pago fue confirmado. Entra a tu oficina en /iniciar-sesion con el correo de tu cuenta.');
  if (o.seller_id && o.seller_id !== o.buyer_id) notify(db, o.seller_id, { title: 'Venta activada', body: `${orderCode(o.id)}: ${shortName(buyer)} activó ${o.plan_name}.`, link: '/mi-cuenta/ventas' });
}

/* ---------- Tarjeta ---------- */
const CARD_EVENTS = { paid: 'pago completado', failed: 'pago fallido', canceled: 'pago cancelado', pending: 'pago pendiente', refunded: 'devolución', chargeback: 'contracargo' };

// Confirmación del proveedor ya verificada por firma. Repetidos y desordenados no duplican nada.
export function applyPaymentEvent(db, { id, orderId, type, amountCents, currency }) {
  if (!id || !CARD_EVENTS[type]) fail(422, 'invalid', 'Evento de pago no válido.');
  const o = getOrder(db, orderId) || fail(404, 'no_order', 'No encontramos ese pedido.');
  return tx(db, () => {
    const { changes } = db.prepare('INSERT OR IGNORE INTO payment_events (event_id, order_id, type, created_at) VALUES (?,?,?,?)').run(String(id), o.id, type, now());
    if (!changes) return { applied: false, reason: 'duplicado' };
    const note = `Pasarela: ${CARD_EVENTS[type]}.`;
    if (type === 'paid') {
      if (o.method !== 'tarjeta' || o.beneficiary_type !== 'plataforma' || !['pendiente_pago', 'en_revision'].includes(o.status)) { logEvent(db, o.id, o.status, o.status, null, `${note} Sin efecto: revisar.`); return { applied: false, reason: 'estado' }; }
      if (o.settlement) { logEvent(db, o.id, o.status, o.status, null, `${note} Llegó después de una devolución: sin activar.`); return { applied: false, reason: 'devuelto' }; }
      if (amountCents !== o.charge_cents || currency !== o.charge_currency) {
        logEvent(db, o.id, o.status, o.status, null, `${note} El importe o la moneda no coinciden: sin activar.`);
        audit(db, null, 'pago.importe_distinto', `orden:${o.id}`, `${amountCents} ${currency}`);
        return { applied: false, reason: 'importe' };
      }
      const upd = db.prepare(`UPDATE orders SET status = 'aprobado', reviewed_at = ?, review_note = 'Pago confirmado por la pasarela.' WHERE id = ? AND status IN ${OPEN}`).run(now(), o.id);
      if (!upd.changes) return { applied: false, reason: 'estado' };
      logEvent(db, o.id, o.status, 'aprobado', null, note);
      approveEffects(db, getOrder(db, o.id));
      audit(db, null, 'pago.aprobado', `orden:${o.id}`, 'pasarela');
      return { applied: true };
    }
    if (type === 'refunded' || type === 'chargeback') { settle(db, null, o, type === 'refunded' ? 'devuelto' : 'contracargo', note); return { applied: true }; }
    logEvent(db, o.id, o.status, o.status, null, note);
    return { applied: true };
  });
}

/* ---------- Devoluciones y ajustes ---------- */
function settle(db, actorId, o, kind, note) {
  const { changes } = db.prepare('UPDATE orders SET settlement = ? WHERE id = ? AND settlement IS NULL').run(kind, o.id);
  if (!changes) return false;
  logEvent(db, o.id, o.status, o.status, actorId, `${kind === 'devuelto' ? 'Devolución' : 'Contracargo'}: ${note}`);
  // Cada movimiento confirmado del pedido recibe su ajuste: el historial se conserva y las métricas cuadran.
  for (const m of db.prepare("SELECT * FROM movements WHERE order_id = ? AND type IN ('venta','comision')").all(o.id)) {
    db.prepare(`INSERT INTO movements (user_id, order_id, type, amount_cents, currency, custody, status, rule_version_id, relates_to, note, is_demo, created_at)
      VALUES (?,?,'ajuste',?,?,?,'confirmado',?,?,?,?,?)`).run(m.user_id, o.id, -m.amount_cents, m.currency, m.custody, m.rule_version_id, m.type, `${kind === 'devuelto' ? 'Devolución' : 'Contracargo'} de ${orderCode(o.id)}`, o.is_demo, now());
  }
  if (getSetting(db, 'policies').refundAccess === 'revocar') revokeByOrder(db, o.id, kind);
  audit(db, actorId, `pago.${kind}`, `orden:${o.id}`, note);
  return true;
}
export function refundOrder(db, founder, id, { kind = 'devuelto', reason }) {
  const o = getOrder(db, id) || fail(404, 'no_order', 'No encontramos ese pedido.');
  if (o.status !== 'aprobado') fail(409, 'bad_state', 'Solo se registra una devolución sobre un pago confirmado.');
  const note = MIN_NOTE(reason, 'reason', 'Indica el motivo de la devolución.');
  return tx(db, () => { if (!settle(db, founder.id, o, kind === 'contracargo' ? 'contracargo' : 'devuelto', note)) fail(409, 'already', 'Este pedido ya tiene una devolución registrada.'); });
}

/* ---------- Concesiones y estado de cuenta (solo fundador) ---------- */
export function grantByAdmin(db, founder, userId, { plan, reason }) {
  const why = MIN_NOTE(reason, 'reason', 'Indica el motivo de la concesión.');
  const p = planBySlug(db, plan);
  const u = userById(db, userId) || fail(404, 'no_user', 'No encontramos a esa persona.');
  return tx(db, () => {
    grantPlan(db, u.id, p.rank, { source: 'concesion', by: founder.id });
    db.prepare("UPDATE users SET account_status = 'activo' WHERE id = ? AND account_status = 'pendiente'").run(u.id);
    db.prepare('UPDATE users SET referral_code = ? WHERE id = ? AND referral_code IS NULL').run(randomBytes(4).toString('hex').toUpperCase(), u.id);
    audit(db, founder.id, 'acceso.concesion', `usuario:${u.id}`, `${p.name}. ${why}`);
  });
}
export function setAccountStatus(db, founder, userId, { status, reason }) {
  const why = MIN_NOTE(reason, 'reason');
  if (!['activo', 'suspendido'].includes(status)) fail(422, 'invalid', 'Estado no válido.');
  const u = userById(db, userId) || fail(404, 'no_user', 'No encontramos a esa persona.');
  if (u.role === 'admin') fail(409, 'founder', 'La cuenta del fundador no se suspende desde aquí.');
  // Reactivar devuelve a «pendiente» si la persona nunca tuvo un plan.
  const next = status === 'activo' && levelOf(db, u.id) === 0 ? 'pendiente' : status;
  tx(db, () => {
    // Una cuenta suspendida puede entrar para ver su estado y contactar con soporte.
    db.prepare('UPDATE users SET account_status = ? WHERE id = ?').run(next, u.id);
    notify(db, u.id, { title: next === 'suspendido' ? 'Tu cuenta está suspendida' : 'Tu cuenta fue reactivada', body: next === 'suspendido' ? 'Escríbenos por soporte para resolverlo.' : 'Ya puedes volver a usar tu oficina.', link: '/mi-cuenta' });
    audit(db, founder.id, next === 'suspendido' ? 'cuenta.suspendida' : 'cuenta.reactivada', `usuario:${u.id}`, why);
  });
}
export function setVerifier(db, founder, userId, { enabled, reason }) {
  const why = MIN_NOTE(reason, 'reason');
  const u = userById(db, userId) || fail(404, 'no_user', 'No encontramos a esa persona.');
  if (u.account_status !== 'activo') fail(409, 'not_active', 'Solo una cuenta activa puede verificar pagos.');
  db.prepare('UPDATE users SET can_verify = ? WHERE id = ?').run(enabled ? 1 : 0, u.id);
  audit(db, founder.id, enabled ? 'verificador.delegado' : 'verificador.retirado', `usuario:${u.id}`, why);
}

/* ---------- Red ---------- */
const descendantsSql = `WITH RECURSIVE tree(id, depth) AS (SELECT id, 1 FROM users WHERE sponsor_id = ? UNION ALL SELECT u.id, t.depth + 1 FROM users u JOIN tree t ON u.sponsor_id = t.id) `;
export const isDescendant = (db, ancestorId, userId) => !!db.prepare(`${descendantsSql}SELECT 1 FROM tree WHERE id = ?`).get(ancestorId, userId);

export function changeSponsor(db, founder, userId, { code, reason, reassignOpen }) {
  const why = MIN_NOTE(reason, 'reason');
  const u = userById(db, userId) || fail(404, 'no_user', 'No encontramos a esa persona.');
  const s = db.prepare("SELECT * FROM users WHERE referral_code = ? AND account_status = 'activo'").get(String(code || '')) || fail(422, 'invalid', 'Ese código no pertenece a una cuenta activa.', 'code');
  if (s.id === u.id) fail(422, 'invalid', 'Una persona no puede patrocinarse a sí misma.', 'code');
  if (isDescendant(db, u.id, s.id)) fail(422, 'invalid', 'Ese cambio formaría un ciclo en la red.', 'code');
  tx(db, () => {
    db.prepare("UPDATE users SET sponsor_id = ?, sponsor_source = 'correccion' WHERE id = ?").run(s.id, u.id);
    let moved = 0;
    // Los pedidos ya aprobados conservan su vendedor. Los abiertos solo cambian si se indica expresamente.
    if (reassignOpen === true) {
      for (const o of db.prepare(`SELECT * FROM orders WHERE buyer_id = ? AND status IN ${OPEN}`).all(u.id)) {
        const who = attendedBy(db, s, o.to_rank);
        db.prepare("UPDATE orders SET seller_id = ?, sale_type = ?, method = NULL, beneficiary_type = NULL, beneficiary_snapshot = NULL, instructions_snapshot = NULL, charge_cents = NULL, charge_currency = NULL, status = 'pendiente_pago' WHERE id = ? AND status = 'pendiente_pago'").run(who.seller.id, who.saleType, o.id);
        moved++;
      }
    }
    audit(db, founder.id, 'red.cambio_patrocinador', `usuario:${u.id}`, `Nuevo patrocinador ${s.id}. Pedidos abiertos reasignados: ${moved}. ${why}`);
  });
}

// El vendedor ve solo lo mínimo de sus compradores directos.
export function directClients(db, seller, { page = 1 } = {}) {
  const size = 25; const offset = (Math.max(1, Number(page)) - 1) * size;
  const rows = db.prepare(`SELECT u.id, u.first_name, u.last_name, u.country, u.account_status, u.created_at,
      (SELECT p.name FROM entitlements e JOIN plans p ON p.slug = e.plan_slug WHERE e.user_id = u.id AND e.revoked_at IS NULL ORDER BY p.rank DESC LIMIT 1) AS plan
    FROM users u WHERE u.sponsor_id = ? ORDER BY u.id DESC LIMIT ? OFFSET ?`).all(seller.id, size + 1, offset);
  return { page: Number(page), hasMore: rows.length > size, clients: rows.slice(0, size).map((r) => ({ name: `${r.first_name} ${r.last_name.charAt(0)}.`, country: r.country, status: r.account_status, plan: r.plan, since: r.created_at })) };
}

export function networkChildren(db, parentId, { page = 1 } = {}) {
  const size = 25; const offset = (Math.max(1, Number(page)) - 1) * size;
  const rows = db.prepare(`SELECT u.id, u.first_name, u.last_name, u.email, u.account_status, u.created_at,
      (SELECT COUNT(*) FROM users c WHERE c.sponsor_id = u.id) AS direct
    FROM users u WHERE u.sponsor_id IS ? AND u.role <> 'admin' ORDER BY u.id LIMIT ? OFFSET ?`).all(parentId ?? null, size + 1, offset);
  const withTotals = rows.slice(0, size).map((r) => ({ ...r, total: db.prepare(`${descendantsSql}SELECT COUNT(*) AS n FROM tree`).get(r.id).n, level: levelOf(db, r.id) }));
  return { page: Number(page), hasMore: rows.length > size, nodes: withTotals };
}
export function networkSummary(db, rootId) {
  return db.prepare(`${descendantsSql}SELECT depth, COUNT(*) AS n FROM tree GROUP BY depth ORDER BY depth`).all(rootId);
}

/* ---------- Libro de movimientos y estadísticas ---------- */
const windowSql = (days) => (days ? `AND created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-${Number(days)} days')` : '');
export function statsFor(db, userId, { demo }) {
  const demoFilter = demo ? '' : 'AND is_demo = 0';
  const sum = (where, days) => db.prepare(`SELECT COALESCE(SUM(amount_cents), 0) AS s FROM movements WHERE user_id = ? ${demoFilter} ${where} ${windowSql(days)}`).get(userId).s;
  const block = (days) => ({
    grossSales: sum("AND type = 'venta'", days),
    commissions: sum("AND type = 'comision'", days),
    refundAdjustments: sum("AND type = 'ajuste'", days),
    pending: sum("AND type = 'comision' AND status IN ('pendiente','confirmado')", days) + sum("AND type = 'ajuste' AND relates_to = 'comision'", days) + sum("AND type = 'liquidacion'", days),
    paidOut: -sum("AND type = 'liquidacion'", days),
  });
  return { currency: 'USD', updatedAt: now(), last7: block(7), last30: block(30), total: block(null) };
}

export function movementsFor(db, userId, { demo }) {
  return db.prepare(`SELECT m.*, r.version AS rule_version FROM movements m LEFT JOIN commission_rules r ON r.id = m.rule_version_id
    WHERE m.user_id = ? ${demo ? '' : 'AND m.is_demo = 0'} ORDER BY m.id DESC LIMIT 200`).all(userId).map((m) => ({
    id: m.id, type: m.type, amountCents: m.amount_cents, currency: m.currency, custody: m.custody, status: m.status, ruleVersion: m.rule_version, note: m.note, createdAt: m.created_at, relatesTo: m.relates_to,
  }));
}

export function salesFor(db, seller, f = {}) {
  const where = ['o.seller_id = ?']; const args = [seller.id];
  if (f.from) { where.push('o.created_at >= ?'); args.push(f.from); }
  if (f.to) { where.push('o.created_at < ?'); args.push(`${f.to}T23:59:59.999Z`); }
  if (f.plan) { where.push('o.plan_slug = ?'); args.push(f.plan); }
  if (f.method) { where.push('o.method = ?'); args.push(f.method); }
  if (f.status) { where.push('o.status = ?'); args.push(f.status); }
  if (f.buyer) { where.push("(u.first_name || ' ' || u.last_name) LIKE ?"); args.push(`%${f.buyer}%`); }
  return db.prepare(`SELECT o.*, u.first_name, u.last_name FROM orders o JOIN users u ON u.id = o.buyer_id WHERE ${where.join(' AND ')} ORDER BY o.id DESC LIMIT 200`).all(...args)
    .map((o) => ({ id: o.id, code: orderCode(o.id), buyer: `${o.first_name} ${o.last_name.charAt(0)}.`, plan: o.plan_name, method: o.method, status: o.status, amountCents: o.base_cents, currency: o.currency, beneficiaryType: o.beneficiary_type, settlement: o.settlement, createdAt: o.created_at, isDemo: !!o.is_demo }));
}

/* ---------- Reglas económicas versionadas ---------- */
export const listRules = (db) => db.prepare('SELECT * FROM commission_rules ORDER BY version DESC').all();
export function createRule(db, founder, { enabled, directPercent, notes }) {
  const on = enabled === true;
  let bps = null;
  if (directPercent !== undefined && directPercent !== null && directPercent !== '') {
    const m = String(directPercent).trim().match(/^(\d{1,2})(\.\d{1,2})?$/);
    if (!m) fail(422, 'invalid', 'Escribe un porcentaje entre 0 y 99, con hasta dos decimales.', 'directPercent');
    bps = Math.round(Number(directPercent) * 100);
  }
  if (on && !bps) fail(422, 'invalid', 'Para habilitar una regla, indica el porcentaje de comisión directa.', 'directPercent');
  const version = db.prepare('SELECT COALESCE(MAX(version), 0) + 1 AS v FROM commission_rules').get().v;
  return tx(db, () => {
    if (on) db.prepare('UPDATE commission_rules SET enabled = 0').run();
    db.prepare('INSERT INTO commission_rules (version, enabled, direct_bps, notes, created_by, created_at) VALUES (?,?,?,?,?,?)').run(version, on ? 1 : 0, bps, String(notes ?? '').trim() || null, founder.id, now());
    audit(db, founder.id, 'reglas.version', `version:${version}`, on ? `Habilitada: ${bps / 100} %` : 'Guardada sin habilitar');
    return version;
  });
}
export function disableRules(db, founder) {
  db.prepare('UPDATE commission_rules SET enabled = 0').run();
  audit(db, founder.id, 'reglas.deshabilitar', null, 'Comisiones desactivadas');
}

/* ---------- Liquidaciones ---------- */
// Solo se liquida lo que la plataforma custodia: comisiones confirmadas menos ajustes y pagos previos.
export function availableFor(db, userId) {
  return db.prepare(`SELECT COALESCE(SUM(amount_cents), 0) AS s FROM movements WHERE user_id = ? AND custody = 'plataforma'
    AND (type IN ('comision','liquidacion') OR (type = 'ajuste' AND relates_to = 'comision'))`).get(userId).s;
}
export function createPayout(db, founder, userId, { amountCents, reference }) {
  if (!activeRule(db)) fail(409, 'rules_disabled', 'Las liquidaciones están bloqueadas hasta habilitar reglas de comisión.');
  const ref = MIN_NOTE(reference, 'reference', 'Indica la referencia del pago realizado.');
  const amount = Number(amountCents);
  if (!Number.isInteger(amount) || amount <= 0) fail(422, 'invalid', 'Indica un importe válido.', 'amountCents');
  return tx(db, () => {
    if (amount > availableFor(db, Number(userId))) fail(409, 'insufficient', 'El importe supera lo disponible para liquidar.');
    db.prepare('INSERT INTO payouts (user_id, amount_cents, currency, reference, created_by, created_at) VALUES (?,?,?,?,?,?)').run(Number(userId), amount, 'USD', ref, founder.id, now());
    db.prepare(`INSERT INTO movements (user_id, type, amount_cents, currency, custody, status, note, created_at) VALUES (?,'liquidacion',?,'USD','plataforma','pagado',?,?)`).run(Number(userId), -amount, `Liquidación: ${ref}`, now());
    audit(db, founder.id, 'liquidacion.registrada', `usuario:${userId}`, `${amount} USD. ${ref}`);
  });
}

/* ---------- Medios de cobro del vendedor ---------- */
export const payoutMethodsOf = (db, userId) => db.prepare('SELECT id, method, holder, account, currency, created_at FROM payout_methods WHERE user_id = ? AND replaced_at IS NULL').all(userId);
export function setPayoutMethod(db, user, { method, holder, account, currency }) {
  if (!MANUAL_METHODS[method]) fail(422, 'invalid', 'Medio no válido.', 'method');
  if (!String(holder ?? '').trim()) fail(422, 'invalid', 'Escribe el titular.', 'holder');
  if (!String(account ?? '').trim()) fail(422, 'invalid', 'Escribe el número o la cuenta.', 'account');
  const cur = MANUAL_METHODS[method].currency || (['PEN', 'USD'].includes(currency) ? currency : fail(422, 'invalid', 'Elige la moneda de la cuenta.', 'currency'));
  // Se aplica a pedidos nuevos; los ya creados conservan su copia del beneficiario.
  tx(db, () => {
    db.prepare('UPDATE payout_methods SET replaced_at = ? WHERE user_id = ? AND method = ? AND replaced_at IS NULL').run(now(), user.id, method);
    db.prepare('INSERT INTO payout_methods (user_id, method, holder, account, currency, created_at) VALUES (?,?,?,?,?,?)').run(user.id, method, holder.trim(), account.trim(), cur, now());
    audit(db, user.id, 'cobro.beneficiario', `usuario:${user.id}`, `${method} actualizado`);
  });
}

/* ---------- Vista de pedidos ---------- */
export function serializeOrder(db, o, viewer) {
  const subs = db.prepare('SELECT id, method, operation_number, paid_on, status, review_note, created_at, reviewed_at FROM payment_submissions WHERE order_id = ? ORDER BY id').all(o.id);
  const buyer = userById(db, o.buyer_id);
  const seller = o.seller_id ? userById(db, o.seller_id) : null;
  return {
    id: o.id, code: orderCode(o.id), kind: o.kind, plan: o.plan_slug, planName: o.plan_name, baseCents: o.base_cents, currency: o.currency, status: o.status,
    method: o.method, methodName: o.method === 'tarjeta' ? 'Tarjeta' : MANUAL_METHODS[o.method]?.name ?? null,
    beneficiaryType: o.beneficiary_type, beneficiary: getJson(o.beneficiary_snapshot, null), instructions: o.instructions_snapshot,
    chargeCents: o.charge_cents, chargeCurrency: o.charge_currency, fxRate: o.fx_rate, fxValidUntil: o.fx_valid_until, feeCents: o.buyer_fee_cents,
    settlement: o.settlement, reviewNote: o.review_note, reviewedAt: o.reviewed_at, createdAt: o.created_at, isDemo: !!o.is_demo,
    buyer: buyer ? (viewer?.role === 'admin' || viewer?.id === buyer.id ? fullName(buyer) : shortName(buyer)) : null,
    buyerEmail: viewer?.role === 'admin' ? buyer?.email : undefined,
    seller: o.sale_type === 'vendedor' && seller ? shortName(seller) : 'Legado Digital (venta directa)', saleType: o.sale_type,
    submissions: subs.map((s) => ({ id: s.id, method: s.method, operationNumber: s.operation_number, paidOn: s.paid_on, status: s.status, reviewNote: s.review_note, createdAt: s.created_at })),
    events: db.prepare('SELECT from_status AS fromStatus, to_status AS toStatus, note, created_at AS createdAt FROM order_events WHERE order_id = ? ORDER BY id').all(o.id),
    canReview: viewer ? !!reviewerRole(db, viewer, o) && o.status === 'en_revision' : false,
  };
}

export function reviewQueue(db, reviewer) {
  return db.prepare("SELECT * FROM orders WHERE status = 'en_revision' ORDER BY id").all().filter((o) => reviewerRole(db, reviewer, o));
}

// El comprobante lo ve su autor, quien puede revisarlo y el fundador. Nadie más.
export function submissionFor(db, viewer, id) {
  const s = db.prepare('SELECT * FROM payment_submissions WHERE id = ?').get(Number(id));
  if (!s) fail(404, 'no_receipt', 'No encontramos ese comprobante.');
  const o = getOrder(db, s.order_id);
  if (viewer.id !== s.user_id && viewer.role !== 'admin' && !reviewerRole(db, viewer, o)) fail(404, 'no_receipt', 'No encontramos ese comprobante.');
  return s;
}
