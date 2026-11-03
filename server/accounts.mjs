// Cuentas, sesiones, doble factor, perfil y avisos. Rol y estado nunca se aceptan desde la petición.
import { createHmac, randomBytes } from 'node:crypto';
import { audit, fail, hashPassword, hashToken, now, passwordMatches, token, tx } from './core.mjs';
import { getSetting } from './settings.mjs';

const SESSION_MS = 1000 * 60 * 60 * 24 * 14;
const REAUTH_MS = 1000 * 60 * 10;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+[1-9][\d\s-]{6,20}$/;

export const fullName = (u) => `${u.first_name} ${u.last_name}`.trim();
export const shortName = (u) => `${u.first_name} ${u.last_name.charAt(0)}.`;

export function publicUser(u, extra = {}) {
  if (!u) return null;
  return {
    id: u.id, firstName: u.first_name, lastName: u.last_name, name: fullName(u), email: u.email, phone: u.phone, country: u.country,
    role: u.role, founder: u.role === 'admin', canVerify: !!u.can_verify, accountStatus: u.account_status,
    emailVerified: !!u.email_verified_at, referralCode: u.account_status === 'activo' ? u.referral_code : null,
    hasAvatar: !!u.avatar_name, totpEnabled: !!u.totp_enabled, prefs: JSON.parse(u.prefs || '{}'), isDemo: !!u.is_demo, ...extra,
  };
}

export const founderOf = (db) => db.prepare("SELECT * FROM users WHERE role = 'admin' ORDER BY id LIMIT 1").get() || null;
export const userById = (db, id) => db.prepare('SELECT * FROM users WHERE id = ?').get(Number(id)) || null;

/* ---------- Avisos y correo ---------- */
export function notify(db, userId, { title, body, link = null }) {
  db.prepare('INSERT INTO notifications (user_id, title, body, link, created_at) VALUES (?,?,?,?,?)').run(userId, title, body, link, now());
}
// El correo queda en cola. Sin proveedor configurado no sale de la plataforma; nunca incluye contraseñas.
export function queueEmail(db, to, subject, body) {
  db.prepare('INSERT INTO outbox (to_email, subject, body, created_at) VALUES (?,?,?,?)').run(to, subject, body, now());
}

/* ---------- Registro ---------- */
function validateNames({ firstName, lastName, country }) {
  if (!firstName?.trim()) fail(422, 'invalid', 'Escribe tu nombre.', 'firstName');
  if (!lastName?.trim()) fail(422, 'invalid', 'Escribe tu apellido.', 'lastName');
  if (!country?.trim()) fail(422, 'invalid', 'Indica tu país.', 'country');
}
function validatePassword(password, field = 'password') {
  if (!password || String(password).length < 8) fail(422, 'invalid', 'Usa al menos 8 caracteres.', field);
}

// El patrocinador sale del enlace de un vendedor activo. Sin enlace válido, la venta es directa de la plataforma.
export function sponsorFor(db, code) {
  if (code) {
    const s = db.prepare("SELECT * FROM users WHERE referral_code = ? AND account_status = 'activo'").get(String(code));
    if (s) return { sponsor: s, source: 'enlace' };
  }
  return { sponsor: founderOf(db), source: 'directo' };
}

export function register(db, body, { isDemo = false } = {}) {
  const { firstName, lastName, country, email, phone, password, confirm, ref, acceptLegal } = body;
  validateNames({ firstName, lastName, country });
  if (!EMAIL.test(email || '')) fail(422, 'invalid', 'Escribe un correo válido, como nombre@correo.com.', 'email');
  if (phone && !PHONE.test(phone)) fail(422, 'invalid', 'Escribe el teléfono con prefijo internacional, como +51 999 999 999.', 'phone');
  validatePassword(password);
  if (password !== confirm) fail(422, 'invalid', 'Las contraseñas no coinciden.', 'confirm');
  if (acceptLegal !== true && acceptLegal !== 'on') fail(422, 'invalid', 'Acepta los términos y la política de privacidad para crear tu cuenta.', 'acceptLegal');
  const mail = email.trim().toLowerCase();
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(mail)) fail(409, 'email_taken', 'Ya existe una cuenta con este correo. Inicia sesión o recupera tu acceso.', 'email');
  const { sponsor, source } = sponsorFor(db, ref);
  const { salt, hash } = hashPassword(password);
  const version = getSetting(db, 'legal').version;
  return tx(db, () => {
    const id = db.prepare(`INSERT INTO users (first_name, last_name, email, phone, country, pw_salt, pw_hash, sponsor_id, sponsor_source, is_demo, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(firstName.trim(), lastName.trim(), mail, phone?.trim() || null, country.trim(), salt, hash, sponsor?.id ?? null, source, isDemo ? 1 : 0, now()).lastInsertRowid;
    for (const doc of ['terminos', 'privacidad']) db.prepare('INSERT INTO consents (user_id, document, version, accepted_at) VALUES (?,?,?,?)').run(id, doc, version, now());
    const verifyToken = issueToken(db, id, 'verify', 1000 * 60 * 60 * 48);
    queueEmail(db, mail, 'Confirma tu correo en Legado Digital', `Abre este enlace para confirmar tu correo: /verificar-correo?token=${verifyToken}`);
    return { user: userById(db, id), verifyToken };
  });
}

function issueToken(db, userId, purpose, ms) {
  const t = token();
  db.prepare('INSERT INTO one_time_tokens (token_hash, user_id, purpose, expires_at) VALUES (?,?,?,?)').run(hashToken(t), userId, purpose, Date.now() + ms);
  return t;
}
function useToken(db, t, purpose) {
  const row = db.prepare('SELECT * FROM one_time_tokens WHERE token_hash = ? AND purpose = ? AND used = 0 AND expires_at > ?').get(hashToken(t || ''), purpose, Date.now());
  if (!row) fail(400, 'bad_token', 'Este enlace ya no es válido. Solicita uno nuevo.');
  db.prepare('UPDATE one_time_tokens SET used = 1 WHERE token_hash = ?').run(row.token_hash);
  return row;
}

export function verifyEmail(db, t) {
  return tx(db, () => {
    const row = useToken(db, t, 'verify');
    db.prepare('UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?').run(now(), row.user_id);
    return userById(db, row.user_id);
  });
}
export function resendVerification(db, user) {
  if (user.email_verified_at) fail(409, 'already', 'Tu correo ya está confirmado.');
  const t = issueToken(db, user.id, 'verify', 1000 * 60 * 60 * 48);
  queueEmail(db, user.email, 'Confirma tu correo en Legado Digital', `Abre este enlace para confirmar tu correo: /verificar-correo?token=${t}`);
  return t;
}

/* ---------- Sesión, doble factor y reautenticación ---------- */
export function login(db, { email, password }) {
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').trim().toLowerCase());
  if (!user || !passwordMatches(password, user.pw_salt, user.pw_hash)) fail(401, 'bad_credentials', 'El correo o la contraseña no coinciden.');
  return user;
}
export function createSession(db, user) {
  const t = token();
  // Con doble factor activo, la sesión no vale hasta introducir el código.
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, mfa_ok, reauth_at) VALUES (?,?,?,?,?)')
    .run(hashToken(t), user.id, Date.now() + SESSION_MS, user.totp_enabled ? 0 : 1, user.totp_enabled ? 0 : Date.now());
  return t;
}
export function sessionOf(db, t) {
  if (!t) return null;
  return db.prepare('SELECT * FROM sessions WHERE token_hash = ? AND expires_at > ?').get(hashToken(t), Date.now()) || null;
}
export function userFromSession(db, t) {
  const s = sessionOf(db, t);
  return s?.mfa_ok ? userById(db, s.user_id) : null;
}
export const destroySession = (db, t) => db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(t || ''));

export function completeMfa(db, t, code) {
  const s = sessionOf(db, t) || fail(401, 'auth', 'Inicia sesión de nuevo.');
  const user = userById(db, s.user_id);
  if (!verifyTotp(user.totp_secret, code)) fail(401, 'bad_code', 'El código no es correcto.', 'code');
  db.prepare('UPDATE sessions SET mfa_ok = 1, reauth_at = ? WHERE token_hash = ?').run(Date.now(), s.token_hash);
  return user;
}

// Acciones sensibles piden confirmar contraseña (y código, si hay doble factor) en los últimos minutos.
export function reauth(db, t, user, { password, code }) {
  if (!passwordMatches(password, user.pw_salt, user.pw_hash)) fail(401, 'bad_credentials', 'La contraseña no es correcta.', 'password');
  if (user.totp_enabled && !verifyTotp(user.totp_secret, code)) fail(401, 'bad_code', 'El código no es correcto.', 'code');
  db.prepare('UPDATE sessions SET reauth_at = ? WHERE token_hash = ?').run(Date.now(), hashToken(t));
}
export function requireRecentAuth(db, t) {
  const s = sessionOf(db, t);
  if (!s || Date.now() - s.reauth_at > REAUTH_MS) fail(428, 'reauth', 'Por seguridad, confirma tu contraseña para continuar.');
}

/* TOTP (RFC 6238) sin dependencias. */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const b32encode = (buf) => { let bits = '', out = ''; for (const b of buf) bits += b.toString(2).padStart(8, '0'); for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)]; return out; };
const b32decode = (s) => { let bits = ''; for (const c of s.replace(/=+$/, '')) bits += B32.indexOf(c).toString(2).padStart(5, '0'); const out = []; for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(out); };
export function totpAt(secret, step) {
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(step));
  const h = createHmac('sha1', b32decode(secret)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0');
}
export function verifyTotp(secret, code) {
  if (!secret || !/^\d{6}$/.test(String(code || ''))) return false;
  const step = Math.floor(Date.now() / 30000);
  return [-1, 0, 1].some((d) => totpAt(secret, step + d) === String(code));
}
export function startTotp(db, user) {
  const secret = b32encode(randomBytes(20));
  db.prepare('UPDATE users SET totp_secret = ?, totp_enabled = 0 WHERE id = ?').run(secret, user.id);
  return { secret, uri: `otpauth://totp/Legado%20Digital:${encodeURIComponent(user.email)}?secret=${secret}&issuer=Legado%20Digital` };
}
export function enableTotp(db, user, code) {
  const fresh = userById(db, user.id);
  if (!verifyTotp(fresh.totp_secret, code)) fail(422, 'bad_code', 'El código no es correcto.', 'code');
  db.prepare('UPDATE users SET totp_enabled = 1 WHERE id = ?').run(user.id);
  audit(db, user.id, 'seguridad.doble_factor', `usuario:${user.id}`, 'Activado');
}

/* ---------- Perfil ---------- */
export function updateProfile(db, user, { firstName, lastName, country, phone, prefs }) {
  validateNames({ firstName, lastName, country });
  if (phone && !PHONE.test(phone)) fail(422, 'invalid', 'Escribe el teléfono con prefijo internacional.', 'phone');
  const allowed = { emailNotices: !!prefs?.emailNotices };
  db.prepare('UPDATE users SET first_name = ?, last_name = ?, country = ?, phone = ?, prefs = ? WHERE id = ?')
    .run(firstName.trim(), lastName.trim(), country.trim(), phone?.trim() || null, JSON.stringify(allowed), user.id);
  return userById(db, user.id);
}
export function changePassword(db, user, { current, password, confirm }) {
  if (!passwordMatches(current, user.pw_salt, user.pw_hash)) fail(401, 'bad_credentials', 'La contraseña actual no es correcta.', 'current');
  validatePassword(password);
  if (password !== confirm) fail(422, 'invalid', 'Las contraseñas no coinciden.', 'confirm');
  const { salt, hash } = hashPassword(password);
  db.prepare('UPDATE users SET pw_salt = ?, pw_hash = ? WHERE id = ?').run(salt, hash, user.id);
  audit(db, user.id, 'seguridad.contraseña', `usuario:${user.id}`, 'Cambio de contraseña');
}
export function setAvatar(db, user, { storedName, mime }) {
  db.prepare('UPDATE users SET avatar_name = ?, avatar_mime = ? WHERE id = ?').run(storedName, mime, user.id);
}

/* ---------- Recuperación ---------- */
export function requestPasswordReset(db, email) {
  const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(String(email || '').trim().toLowerCase());
  if (!user) return null;
  const t = issueToken(db, user.id, 'reset', 1000 * 60 * 30);
  queueEmail(db, user.email, 'Recupera tu acceso a Legado Digital', `Abre este enlace para crear una contraseña nueva: /recuperar-acceso?token=${t}`);
  return t;
}
export function resetPassword(db, { token: t, password, confirm }) {
  validatePassword(password);
  if (password !== confirm) fail(422, 'invalid', 'Las contraseñas no coinciden.', 'confirm');
  const { salt, hash } = hashPassword(password);
  tx(db, () => {
    const row = useToken(db, t, 'reset');
    db.prepare('UPDATE users SET pw_salt = ?, pw_hash = ? WHERE id = ?').run(salt, hash, row.user_id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.user_id);
  });
}

/* ---------- Fundador ---------- */
// El único fundador se define en el servidor. Si alguien registró antes ese correo, pierde la contraseña y las sesiones.
export function ensureFounder(db, { email, password, firstName = 'Fundador', lastName = 'Legado Digital' }) {
  const mail = String(email).trim().toLowerCase();
  if (String(password).length < 12) throw new Error('La contraseña del fundador debe tener al menos 12 caracteres.');
  const { salt, hash } = hashPassword(password);
  tx(db, () => {
    const found = db.prepare('SELECT id FROM users WHERE email = ?').get(mail);
    if (found) {
      db.prepare("UPDATE users SET role = 'admin', account_status = 'activo', pw_salt = ?, pw_hash = ?, email_verified_at = COALESCE(email_verified_at, ?), sponsor_id = NULL WHERE id = ?").run(salt, hash, now(), found.id);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(found.id);
    } else {
      db.prepare(`INSERT INTO users (first_name, last_name, email, country, pw_salt, pw_hash, role, account_status, email_verified_at, created_at)
        VALUES (?,?,?,'Por confirmar',?,?,'admin','activo',?,?)`).run(firstName, lastName, mail, salt, hash, now(), now());
    }
    db.prepare("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE role = 'admin' AND email <> ?)").run(mail);
    db.prepare("UPDATE users SET role = 'user' WHERE role = 'admin' AND email <> ?").run(mail);
    const founder = db.prepare('SELECT id, referral_code FROM users WHERE email = ?').get(mail);
    if (!founder.referral_code) db.prepare('UPDATE users SET referral_code = ? WHERE id = ?').run(randomBytes(4).toString('hex').toUpperCase(), founder.id);
    audit(db, founder.id, 'fundador.configurado', `usuario:${founder.id}`, 'Alta o restablecimiento desde el servidor');
  });
}
