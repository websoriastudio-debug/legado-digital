// Estado compartido y utilidades de la interfaz.
import { PEN, programs as basePrograms, USD } from '/shared/site.config.mjs';

export const state = { user: null, demo: false, sandbox: false, programs: basePrograms, demoAccounts: [], public: null, salesOpen: true };

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const money = (cents, currency = 'USD') => (cents === null || cents === undefined ? 'Por confirmar' : currency === 'PEN' ? PEN(cents) : USD(cents));

export const programOf = (slug) => state.programs.find((p) => p.slug === slug);
export const programOfRank = (rank) => state.programs.find((p) => p.rank === rank);

// Nombre, precio, descripción y temario vienen de la base de datos: el fundador los edita desde su panel.
export function applyPrices(apiPrograms) {
  state.programs = basePrograms.map((p) => {
    const a = apiPrograms.find((x) => x.slug === p.slug);
    return a ? { ...p, name: a.name, priceCents: a.priceCents, tagline: a.tagline || p.tagline, features: a.features?.length ? a.features : p.features } : p;
  });
}

export class ApiError extends Error {
  constructor(status, body) { super(body.message || 'No se pudo completar la acción.'); Object.assign(this, { status, code: body.error, field: body.field }); }
}

// Las acciones sensibles piden confirmar la identidad. Quien abre el diálogo se registra aquí.
let askReauth = null;
export const onReauth = (fn) => { askReauth = fn; };

export async function api(path, { method = 'GET', body, raw, retried = false } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: raw ? { 'Content-Type': 'application/octet-stream' } : body ? { 'Content-Type': 'application/json' } : undefined,
      body: raw ?? (body ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new ApiError(0, { message: 'No hay conexión con el servidor. Revisa tu conexión y vuelve a intentarlo.' });
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 428 && askReauth && !retried && (await askReauth())) return api(path, { method, body, raw, retried: true });
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

export function toast(message, tone = 'ok') {
  const region = document.getElementById('avisos');
  const el = document.createElement('p');
  el.className = `toast toast--${tone}`;
  el.textContent = message;
  region.append(el);
  setTimeout(() => el.remove(), 5000);
}

// Referido: se guarda de forma explícita hasta el registro, donde queda fijado en el servidor.
const REF_KEY = 'ld_ref';
export function currentRef() {
  try { return localStorage.getItem(REF_KEY); } catch { return null; }
}
export function captureRef() {
  const ref = new URLSearchParams(location.search).get('ref');
  if (ref && /^[A-Za-z0-9]{4,16}$/.test(ref)) {
    try { localStorage.setItem(REF_KEY, ref); } catch { /* sin almacenamiento, el código solo vale en esta visita */ }
  }
}

export function navigate(path, opts) {
  window.dispatchEvent(new CustomEvent('ld:navigate', { detail: { path, ...opts } }));
}

// Crea (o recupera) el pedido del plan elegido y lleva a la pantalla de pago.
export async function choosePlan(slug) {
  try {
    await api('/api/orders', { method: 'POST', body: { plan: slug } });
    toast(`Pedido de ${programOf(slug)?.name ?? 'tu plan'} listo. Elige cómo pagar.`);
  } catch (err) {
    toast(err.message, 'error');
  }
  navigate('/mi-cuenta/pedidos');
}

export const fieldError = (form, err) => {
  form.querySelectorAll('.field__error').forEach((e) => { e.textContent = ''; });
  form.querySelectorAll('[aria-invalid]').forEach((e) => e.removeAttribute('aria-invalid'));
  const status = form.querySelector('.form-status');
  if (status) status.textContent = '';
  const input = err.field && form.elements[err.field];
  if (input && form.querySelector(`#${input.id}-error`)) {
    input.setAttribute('aria-invalid', 'true');
    form.querySelector(`#${input.id}-error`).textContent = err.message;
    input.focus();
  } else if (status) {
    status.textContent = err.message;
  } else {
    toast(err.message, 'error');
  }
};

export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
export const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' }) : '');
