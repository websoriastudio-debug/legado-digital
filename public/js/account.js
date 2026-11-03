// Acceso: inicio de sesión, registro, verificación del correo y recuperación. La autorización la decide el servidor.
import { api, choosePlan, currentRef, esc, money, navigate, programOf, state, toast } from './core.js';
import { field } from './home.js';
import { bindForm } from './panel.js';

const q = () => new URLSearchParams(location.search);
const PLAN_KEY = 'ld_plan';
// El plan elegido se conserva durante el registro y la verificación del correo.
export const keptPlan = () => { try { return localStorage.getItem(PLAN_KEY); } catch { return null; } };
const keepPlan = (slug) => { try { if (slug) localStorage.setItem(PLAN_KEY, slug); else localStorage.removeItem(PLAN_KEY); } catch { /* sin almacenamiento */ } };
const validPlan = () => { const p = q().get('plan') || keptPlan(); return programOf(p) ? p : null; };
const submitBtn = (label) => `<button class="btn btn--gold btn--block" type="submit"><span class="btn__in">${esc(label)}</span></button>`;

const passwordField = (id, name, label, autocomplete) => field(id, label, `
  <div class="pw"><input id="${id}" name="${name}" type="password" autocomplete="${autocomplete}" required>
  <button type="button" class="pw__toggle" data-pw="${id}" aria-pressed="false" aria-label="Mostrar ${esc(label.toLowerCase())}">Mostrar</button></div>`);
function wirePw(root) {
  root.querySelectorAll('[data-pw]').forEach((b) => b.addEventListener('click', () => {
    const input = root.querySelector(`#${b.dataset.pw}`);
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    b.textContent = show ? 'Ocultar' : 'Mostrar';
    b.setAttribute('aria-pressed', show);
  }));
}

const authShell = (title, body, foot = '') => `
<section class="auth">
  <div class="auth__card">
    <h1 class="auth__title">${esc(title)}</h1>
    ${body}
    <div class="auth__foot">${foot}</div>
  </div>
</section>`;

const chosenPlan = (slug) => {
  if (!slug) return '';
  const p = programOf(slug);
  return `<p class="auth__plan">Plan elegido: <strong>${esc(p.name)}, ${money(p.priceCents)}</strong>, pago único. Lo verás en tu cuenta para completar el pago.</p>`;
};

async function afterAuth(user, plan) {
  state.user = user;
  window.dispatchEvent(new Event('ld:session'));
  if (user.founder) { navigate('/admin'); return; }
  if (plan && user.emailVerified && user.accountStatus !== 'suspendido') { keepPlan(null); return choosePlan(plan); }
  navigate('/mi-cuenta');
}

export function renderLogin(main) {
  if (state.user) { navigate(state.user.founder ? '/admin' : '/mi-cuenta'); return; }
  const plan = validPlan();
  main.innerHTML = authShell('Iniciar sesión', `
    ${chosenPlan(plan)}
    <form class="form" id="login" novalidate>
      ${field('l-email', 'Correo electrónico', '<input id="l-email" name="email" type="email" autocomplete="email" required>')}
      ${passwordField('l-password', 'password', 'Contraseña', 'current-password')}
      <p class="form-status" role="alert"></p>
      ${submitBtn('Iniciar sesión')}
    </form>
    <form class="form" id="mfa" novalidate hidden>
      <p>Escribe el código de 6 dígitos de tu aplicación de autenticación.</p>
      ${field('l-code', 'Código', '<input id="l-code" name="code" inputmode="numeric" autocomplete="one-time-code" required>')}
      <p class="form-status" role="alert"></p>
      ${submitBtn('Verificar')}
    </form>
    ${state.demoAccounts.length ? `
      <div class="demo-accounts">
        <p>Cuentas ficticias de la demostración</p>
        ${state.demoAccounts.map((a, i) => `<button type="button" class="btn btn--line btn--small" data-demo="${i}"><span class="btn__in">${esc(a.label)}</span></button>`).join('')}
      </div>` : ''}`,
  `<a class="link" href="/recuperar-acceso">Recuperar contraseña</a><a class="link" href="/registro${plan ? `?plan=${plan}` : ''}">Crear cuenta</a>`);
  const form = main.querySelector('#login');
  const mfa = main.querySelector('#mfa');
  wirePw(main);
  bindForm(form, async (data) => {
    const r = await api('/api/auth/login', { method: 'POST', body: data });
    if (r.mfaRequired) { form.hidden = true; mfa.hidden = false; mfa.querySelector('input').focus(); return; }
    await afterAuth(r.user, plan);
  });
  bindForm(mfa, async (data) => afterAuth((await api('/api/auth/mfa', { method: 'POST', body: data })).user, plan));
  main.querySelectorAll('[data-demo]').forEach((b) => b.addEventListener('click', () => {
    const a = state.demoAccounts[b.dataset.demo];
    form.elements.email.value = a.email; form.elements.password.value = a.password;
    form.requestSubmit();
  }));
}

export async function renderRegister(main) {
  if (state.user) { navigate('/mi-cuenta'); return; }
  const plan = validPlan();
  keepPlan(plan);
  const ref = currentRef();
  const referral = ref ? (await api(`/api/referral/${encodeURIComponent(ref)}`).catch(() => ({}))).referral : null;
  main.innerHTML = authShell('Crear cuenta', `
    ${chosenPlan(plan)}
    <p class="auth__plan">${referral ? `Te refiere <strong>${esc(referral.name)}</strong>.` : 'Te registras sin enlace de referido: te atiende Legado Digital como venta directa.'}</p>
    <form class="form" novalidate>
      ${field('r-first', 'Nombre', '<input id="r-first" name="firstName" autocomplete="given-name" required>')}
      ${field('r-last', 'Apellido', '<input id="r-last" name="lastName" autocomplete="family-name" required>')}
      ${field('r-country', 'País', '<input id="r-country" name="country" autocomplete="country-name" required>')}
      ${field('r-email', 'Correo electrónico', '<input id="r-email" name="email" type="email" autocomplete="email" required>')}
      ${passwordField('r-password', 'password', 'Contraseña', 'new-password')}
      ${passwordField('r-confirm', 'confirm', 'Confirmar contraseña', 'new-password')}
      ${field('r-photo', 'Foto de perfil <small>(opcional) PNG, JPG o WEBP, hasta 2 MB</small>', '<input id="r-photo" name="photo" type="file" accept="image/png,image/jpeg,image/webp">', false)}
      <div class="field">
        <label class="check check--legal" for="r-legal"><input id="r-legal" name="acceptLegal" type="checkbox" required><span>Acepto los <a class="link" href="/legal/terminos" target="_blank" rel="noopener">términos y condiciones</a> y la <a class="link" href="/legal/privacidad" target="_blank" rel="noopener">política de privacidad</a>.</span></label>
        <p class="field__error" id="r-legal-error"></p>
      </div>
      <p class="form-status" role="alert"></p>
      ${submitBtn('Crear cuenta')}
    </form>
    <p class="note">Crear una cuenta no da acceso a los cursos. Después confirmas tu correo, pagas y, cuando se comprueba el pago, se activa tu acceso.</p>`,
  `<a class="link" href="/iniciar-sesion${plan ? `?plan=${plan}` : ''}">Ya tengo cuenta</a>`);
  wirePw(main);
  const form = main.querySelector('form');
  bindForm(form, async (data) => {
    const photo = form.elements.photo.files[0];
    delete data.photo;
    const r = await api('/api/auth/register', { method: 'POST', body: { ...data, ref } });
    if (photo) await api('/api/me/avatar', { method: 'POST', raw: photo }).catch((err) => toast(`Tu cuenta se creó, pero la foto no: ${err.message}`, 'error'));
    if (r.verifyLink) toast('Demostración: el correo no está conectado. Usa el enlace de tu oficina para confirmarlo.');
    state.user = r.user;
    window.dispatchEvent(new Event('ld:session'));
    navigate(r.verifyLink ? `/mi-cuenta?verificar=${encodeURIComponent(r.verifyLink)}` : '/mi-cuenta');
  });
}

export async function renderVerify(main) {
  const t = q().get('token');
  main.innerHTML = authShell('Confirmar correo', '<p role="status">Comprobando el enlace…</p>');
  try {
    await api('/api/auth/verify', { method: 'POST', body: { token: t } });
    const plan = keptPlan();
    main.innerHTML = authShell('Correo confirmado', `<p>Tu correo quedó confirmado.${plan ? ' Ya puedes continuar con tu plan.' : ''}</p>
      ${state.user && plan ? `<button class="btn btn--gold btn--block" type="button" id="seguir"><span class="btn__in">Continuar con ${esc(programOf(plan)?.name ?? 'mi plan')}</span></button>` : `<a class="btn btn--gold btn--block" href="${state.user ? '/mi-cuenta' : '/iniciar-sesion'}"><span class="btn__in">${state.user ? 'Ir a mi oficina' : 'Iniciar sesión'}</span></a>`}`);
    main.querySelector('#seguir')?.addEventListener('click', () => { keepPlan(null); choosePlan(plan); });
  } catch (err) {
    main.innerHTML = authShell('Enlace no válido', `<p>${esc(err.message)}</p><a class="btn btn--line btn--block" href="/mi-cuenta"><span class="btn__in">Ir a mi cuenta</span></a>`);
  }
}

export function renderRecover(main) {
  const token = q().get('token');
  if (token) {
    main.innerHTML = authShell('Nueva contraseña', `
      <form class="form" novalidate>
        ${passwordField('n-password', 'password', 'Contraseña nueva', 'new-password')}
        ${passwordField('n-confirm', 'confirm', 'Confirmar contraseña', 'new-password')}
        <p class="form-status" role="alert"></p>
        ${submitBtn('Guardar contraseña')}
      </form>`);
    wirePw(main);
    bindForm(main.querySelector('form'), async (data) => {
      await api('/api/auth/reset', { method: 'POST', body: { ...data, token } });
      toast('Contraseña guardada. Inicia sesión.');
      navigate('/iniciar-sesion');
    });
    return;
  }
  main.innerHTML = authShell('Recuperar contraseña', `
    <p class="note">Escribe el correo de tu cuenta para solicitar un enlace de recuperación.</p>
    <form class="form" novalidate>
      ${field('p-email', 'Correo electrónico', '<input id="p-email" name="email" type="email" autocomplete="email" required>')}
      <p class="form-status" role="alert"></p>
      ${submitBtn('Solicitar enlace')}
    </form>
    <div id="recover-result" role="status"></div>`,
  '<a class="link" href="/iniciar-sesion">Volver a iniciar sesión</a>');
  bindForm(main.querySelector('form'), async (data) => {
    const res = await api('/api/auth/recover', { method: 'POST', body: data });
    main.querySelector('#recover-result').innerHTML = res.demoLink
      ? `<p class="demo-note">Demostración: el envío de correo no está conectado. <a class="link" href="${esc(res.demoLink)}">Abrir el enlace de recuperación</a></p>`
      : `<p class="note">Si el correo pertenece a una cuenta, recibirás un enlace.${res.mailConnected ? '' : ' El envío de correo aún no está conectado: si lo necesitas ahora, escríbenos por WhatsApp.'}</p>`;
  });
}
