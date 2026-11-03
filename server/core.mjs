// Utilidades compartidas por las reglas de negocio. No conocen HTTP.
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';

export class DomainError extends Error {
  constructor(status, code, message, field) {
    super(message);
    Object.assign(this, { status, code, field });
  }
}
export const fail = (status, code, message, field) => { throw new DomainError(status, code, message, field); };
export const now = () => new Date().toISOString();
export const hashToken = (t) => createHash('sha256').update(String(t)).digest('hex');
export const randomCode = (bytes = 4) => randomBytes(bytes).toString('hex').toUpperCase();
export const token = () => randomBytes(32).toString('hex');

export const hashPassword = (password, salt = randomBytes(16).toString('hex')) => ({
  salt,
  hash: scryptSync(password, salt, 64).toString('hex'),
});
export function passwordMatches(password, salt, hash) {
  const a = Buffer.from(hashPassword(String(password ?? ''), salt).hash, 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

// Transacción con puntos de guardado: una operación puede llamar a otra sin romper la atomicidad.
const depth = new WeakMap();
export function tx(db, fn) {
  const level = depth.get(db) || 0;
  const name = `sp${level}`;
  db.exec(level ? `SAVEPOINT ${name}` : 'BEGIN IMMEDIATE');
  depth.set(db, level + 1);
  try {
    const result = fn();
    db.exec(level ? `RELEASE ${name}` : 'COMMIT');
    return result;
  } catch (err) {
    db.exec(level ? `ROLLBACK TO ${name}; RELEASE ${name}` : 'ROLLBACK');
    throw err;
  } finally {
    depth.set(db, level);
  }
}

export const audit = (db, actorId, action, target, detail) =>
  db.prepare('INSERT INTO audit_log (actor_id, action, target, detail, created_at) VALUES (?,?,?,?,?)').run(actorId ?? null, action, target ?? null, detail ?? null, now());

export const getJson = (text, fallback) => { try { return text ? JSON.parse(text) : fallback; } catch { return fallback; } };

export const MIN_NOTE = (note, field = 'note', message = 'Indica el motivo.') => { if (!String(note ?? '').trim()) fail(422, 'invalid', message, field); return String(note).trim(); };

// Archivos: se comprueba el contenido real, no el tipo que declara el navegador.
const SIGNATURES = [
  { mime: 'image/png', ext: 'png', test: (b) => b.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' },
  { mime: 'image/jpeg', ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/webp', ext: 'webp', test: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' },
  { mime: 'application/pdf', ext: 'pdf', test: (b) => b.subarray(0, 5).toString() === '%PDF-' },
];
export function sniffFile(buffer, { maxBytes, allow }) {
  if (!buffer?.length) fail(422, 'invalid', 'Adjunta un archivo.');
  if (buffer.length > maxBytes) fail(413, 'too_large', `El archivo supera los ${Math.round(maxBytes / 1048576)} MB. Sube uno más ligero.`);
  const kind = SIGNATURES.find((s) => allow.includes(s.mime) && s.test(buffer));
  return kind || fail(415, 'bad_type', allow.includes('application/pdf') ? 'Sube una imagen PNG, JPG o WEBP, o un PDF.' : 'Sube una imagen PNG, JPG o WEBP.');
}
