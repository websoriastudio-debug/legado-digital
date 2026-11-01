// Estado compartido y utilidades de la interfaz.
import { programs as basePrograms } from '../shared/site.config.mjs';

export const state = { user: null, demo: true, staticPreview: true, programs: basePrograms, demoAccounts: [] };

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const programOf = (slug) => state.programs.find((p) => p.slug === slug);
export const programOfRank = (rank) => state.programs.find((p) => p.rank === rank);

export function applyPrices(apiPrograms) {
  state.programs = basePrograms.map((p) => ({ ...p, priceCents: apiPrograms.find((a) => a.slug === p.slug)?.priceCents ?? p.priceCents }));
}

export class ApiError extends Error {
  constructor(status, body) { super(body.message || 'No se pudo completar la acción.'); Object.assign(this, { status, code: body.error, field: body.field }); }
}

export async function api(path) {
  if (path === '/api/bootstrap') return { user: null, demo: true, programs: basePrograms, demoAccounts: [] };
  throw new ApiError(503, { message: 'Esta vista previa no procesa cuentas ni pagos. Consulta por WhatsApp.' });
}

export function toast(message, tone = 'ok') {
  const region = document.getElementById('avisos');
  const el = document.createElement('p');
  el.className = `toast toast--${tone}`;
  el.textContent = message;
  region.append(el);
  setTimeout(() => el.remove(), 5000);
}

// Referido: se guarda de forma explícita hasta la compra y se muestra en el registro.
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

// Crea la operación del plan elegido. Conserva la elección tras registrarse o entrar.
export async function choosePlan(slug) {
  navigate('/registro?plan=' + encodeURIComponent(slug));
}

export const fieldError = (form, err) => {
  form.querySelectorAll('.field__error').forEach((e) => { e.textContent = ''; });
  form.querySelectorAll('[aria-invalid]').forEach((e) => e.removeAttribute('aria-invalid'));
  const status = form.querySelector('.form-status');
  if (status) status.textContent = '';
  const input = err.field && form.elements[err.field];
  if (input) {
    input.setAttribute('aria-invalid', 'true');
    form.querySelector(`#${input.id}-error`).textContent = err.message;
    input.focus();
  } else if (status) {
    status.textContent = err.message;
  } else {
    toast(err.message, 'error');
  }
};

export const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
