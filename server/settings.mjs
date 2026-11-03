// Configuración del fundador guardada en la base de datos. Nada se inventa: lo vacío bloquea lo que depende de ello.
import { audit, fail, getJson, now } from './core.mjs';

export const MANUAL_METHODS = {
  yape: { name: 'Yape', currency: 'PEN' },
  plin: { name: 'Plin', currency: 'PEN' },
  deposito: { name: 'Depósito bancario', currency: null },
  transferencia: { name: 'Transferencia bancaria', currency: null },
};

export const DEFAULTS = {
  business: { tradeName: 'Legado Digital', holder: null, country: null, taxId: null, address: null, supportEmail: null, whatsapp: '+51 947 328 715' },
  legal: { version: '2026-11-03', reviewed: false, accessTerm: null, refundWindow: null, refundCases: null, licenseTerm: null, retention: null, providers: null },
  payments: {
    modes: { centralizado: true, directo: false },
    // Cuenta receptora de la plataforma por método. Sin titular y cuenta, el método no se ofrece.
    platform: Object.fromEntries(Object.keys(MANUAL_METHODS).map((k) => [k, { enabled: false, holder: null, account: null, bank: null, currency: MANUAL_METHODS[k].currency, instructions: null }])),
    card: { enabled: false, provider: null, absorbedBy: null, buyerFee: null },
    walletLimitPenCents: null,
  },
  fx: null, // { rate: 37500, validUntil, source }
  policies: { resale: 'plan_e_inferiores', suspension: 'restringir_todo', refundAccess: 'pendiente' },
  community: { telegram: null, facebook: null },
  mail: { provider: null },
  billing: { enabled: false },
};

export function getSetting(db, key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  const base = DEFAULTS[key];
  const stored = getJson(row?.value, null);
  if (stored === null) return structuredClone(base);
  return base && typeof base === 'object' && !Array.isArray(base) ? deepMerge(structuredClone(base), stored) : stored;
}

function deepMerge(a, b) {
  for (const [k, v] of Object.entries(b || {})) a[k] = v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' ? deepMerge(a[k], v) : v;
  return a;
}

export function setSetting(db, actor, key, value) {
  if (!(key in DEFAULTS)) fail(422, 'invalid', 'Ajuste desconocido.');
  db.prepare('INSERT INTO settings (key, value, updated_by, updated_at) VALUES (?,?,?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at')
    .run(key, JSON.stringify(value), actor?.id ?? null, now());
  // El registro guarda qué se cambió, sin copiar cuentas ni secretos.
  audit(db, actor?.id, `ajustes.${key}`, key, Object.keys(value || {}).join(', '));
}

const RATE = /^\d{1,3}(\.\d{1,4})?$/;
export function parseRate(text) {
  const value = String(text ?? '').trim();
  if (!RATE.test(value)) return null;
  const [whole, frac = ''] = value.split('.');
  const rate = Number(whole) * 10000 + Number(frac.padEnd(4, '0'));
  return rate > 0 ? rate : null;
}
export const toPen = (usdCents, rate) => Math.floor((usdCents * rate + 5000) / 10000);
export function currentFx(db, at = Date.now()) {
  const fx = getSetting(db, 'fx');
  return fx && new Date(fx.validUntil).getTime() > at ? fx : null;
}

export const methodReady = (m) => !!(m?.enabled && m.holder && m.account && m.currency);

// Lo indispensable para abrir ventas reales. En la demostración se informa, pero no bloquea.
export function readiness(db) {
  const b = getSetting(db, 'business');
  const pay = getSetting(db, 'payments');
  const missing = [];
  if (!b.holder) missing.push('Titular o empresa');
  if (!b.country) missing.push('País de operación');
  if (!b.supportEmail) missing.push('Correo de soporte');
  if (!b.whatsapp) missing.push('WhatsApp de soporte');
  const manual = Object.values(pay.platform).some(methodReady);
  const card = pay.card.enabled && pay.card.provider && pay.card.absorbedBy;
  if (!manual && !card && !pay.modes.directo) missing.push('Al menos un medio de cobro configurado');
  if (!getSetting(db, 'mail').provider) missing.push('Correo transaccional para verificar cuentas');
  if (!getSetting(db, 'legal').reviewed) missing.push('Revisión de los textos legales');
  return { open: missing.length === 0, missing };
}

// Datos que pueden mostrarse en la web pública.
export function publicSettings(db) {
  const b = getSetting(db, 'business');
  const l = getSetting(db, 'legal');
  return {
    business: { tradeName: b.tradeName, holder: b.holder, country: b.country, taxId: b.taxId, address: b.address, supportEmail: b.supportEmail, whatsapp: b.whatsapp },
    legal: l,
    community: getSetting(db, 'community'),
  };
}
