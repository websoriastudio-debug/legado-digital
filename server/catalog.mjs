// Planes, derechos de acceso y campus. El acceso a cada curso depende de derechos registrados, no del estado de la sesión.
import { audit, fail, getJson, now } from './core.mjs';
import { getSetting } from './settings.mjs';

/* ---------- Planes ---------- */
const planRow = (p) => ({ slug: p.slug, name: p.name, rank: p.rank, priceCents: p.price_cents, currency: p.currency, tagline: p.tagline, features: getJson(p.features, []) });
export const listPlans = (db) => db.prepare('SELECT * FROM plans ORDER BY rank').all().map(planRow);
export const planBySlug = (db, slug) => db.prepare('SELECT * FROM plans WHERE slug = ?').get(String(slug)) || fail(404, 'no_plan', 'Ese plan no existe.');
export const planByRank = (db, rank) => db.prepare('SELECT * FROM plans WHERE rank = ?').get(rank);

// Los pedidos guardan nombre e importe al crearse: editar un plan no cambia el historial.
export function updatePlan(db, admin, slug, { name, priceCents, tagline, features }) {
  const plan = planBySlug(db, slug);
  const cents = Number(priceCents);
  if (!name?.trim()) fail(422, 'invalid', 'Escribe el nombre del plan.', 'name');
  if (!Number.isInteger(cents) || cents <= 0) fail(422, 'invalid', 'Indica un precio válido.', 'priceCents');
  const list = Array.isArray(features) ? features.map((f) => String(f).trim()).filter(Boolean) : getJson(plan.features, []);
  db.prepare('UPDATE plans SET name = ?, price_cents = ?, tagline = ?, features = ?, updated_at = ? WHERE slug = ?')
    .run(name.trim(), cents, String(tagline ?? plan.tagline).trim(), JSON.stringify(list), now(), slug);
  audit(db, admin.id, 'plan.editar', `plan:${slug}`, `${name.trim()} ${cents}`);
  return listPlans(db);
}

/* ---------- Derechos de acceso ---------- */
export const liveEntitlements = (db, userId) => db.prepare(`SELECT e.*, p.rank FROM entitlements e JOIN plans p ON p.slug = e.plan_slug
  WHERE e.user_id = ? AND e.revoked_at IS NULL ORDER BY p.rank`).all(userId);
export const levelOf = (db, userId) => liveEntitlements(db, userId).reduce((m, e) => Math.max(m, e.rank), 0);

// Concede el plan y los inferiores que falten. Repetirlo no duplica nada.
export function grantPlan(db, userId, rank, { orderId = null, source = 'pedido', by = null }) {
  const plans = db.prepare('SELECT slug FROM plans WHERE rank <= ?').all(rank);
  for (const p of plans) {
    db.prepare(`INSERT INTO entitlements (user_id, plan_slug, order_id, source, granted_by, granted_at)
      SELECT ?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM entitlements WHERE user_id = ? AND plan_slug = ? AND revoked_at IS NULL)`)
      .run(userId, p.slug, orderId, source, by, now(), userId, p.slug);
  }
}
export function revokeByOrder(db, orderId, reason) {
  db.prepare('UPDATE entitlements SET revoked_at = ?, revoked_reason = ? WHERE order_id = ? AND revoked_at IS NULL').run(now(), reason, orderId);
}

// Una cuenta suspendida conserva la formación solo si la política lo permite.
export function canUseContent(db, user) {
  if (user.role === 'admin') return true;
  if (user.account_status === 'activo') return true;
  return user.account_status === 'suspendido' && getSetting(db, 'policies').suspension === 'mantener_formacion';
}

/* ---------- Campus ---------- */
export function campus(db, user) {
  const allowed = canUseContent(db, user);
  const owned = new Set(liveEntitlements(db, user.id).map((e) => e.plan_slug));
  const done = new Set(db.prepare('SELECT lesson_id FROM progress WHERE user_id = ?').all(user.id).map((r) => r.lesson_id));
  return db.prepare('SELECT c.*, p.rank, p.name AS plan_name FROM courses c JOIN plans p ON p.slug = c.plan_slug ORDER BY p.rank, c.position').all().map((c) => {
    const unlocked = user.role === 'admin' || (allowed && owned.has(c.plan_slug));
    const modules = db.prepare('SELECT * FROM modules WHERE course_id = ? ORDER BY position').all(c.id).map((m) => ({
      id: m.id, title: m.title,
      lessons: db.prepare('SELECT id, title, summary, status FROM lessons WHERE module_id = ? ORDER BY position').all(m.id).map((l) => ({ ...l, completed: done.has(l.id) })),
    }));
    return { id: c.id, plan: c.plan_slug, planName: c.plan_name, rank: c.rank, title: c.title, summary: c.summary, unlocked, modules };
  });
}

function lessonWithAccess(db, user, id) {
  const l = db.prepare(`SELECT l.*, c.plan_slug FROM lessons l JOIN modules m ON m.id = l.module_id JOIN courses c ON c.id = m.course_id WHERE l.id = ?`).get(Number(id));
  if (!l) fail(404, 'no_lesson', 'No encontramos esa lección.');
  if (user.role === 'admin') return l;
  if (!canUseContent(db, user)) fail(403, 'locked', 'Tu cuenta no tiene acceso a la formación en este momento.');
  const owns = db.prepare('SELECT 1 FROM entitlements WHERE user_id = ? AND plan_slug = ? AND revoked_at IS NULL').get(user.id, l.plan_slug);
  if (!owns) fail(403, 'locked', 'Esta lección pertenece a un plan que no tienes.');
  return l;
}
export function readLesson(db, user, id) {
  const l = lessonWithAccess(db, user, id);
  const resources = db.prepare('SELECT id, title, mime, size FROM resources WHERE lesson_id = ? AND removed_at IS NULL').all(l.id);
  return { id: l.id, title: l.title, summary: l.summary, status: l.status, body: l.status === 'publicada' ? l.body : null, resources: l.status === 'publicada' ? resources : [] };
}
export function completeLesson(db, user, id) {
  const l = lessonWithAccess(db, user, id);
  if (l.status !== 'publicada') fail(409, 'not_ready', 'Esta lección todavía está pendiente de publicación.');
  db.prepare('INSERT OR IGNORE INTO progress (user_id, lesson_id, completed_at) VALUES (?,?,?)').run(user.id, l.id, now());
}
export function resourceFor(db, user, id) {
  const r = db.prepare('SELECT * FROM resources WHERE id = ? AND removed_at IS NULL').get(Number(id)) || fail(404, 'no_resource', 'No encontramos ese recurso.');
  const l = lessonWithAccess(db, user, r.lesson_id);
  if (l.status !== 'publicada' && user.role !== 'admin') fail(403, 'locked', 'Este recurso aún no está publicado.');
  return r;
}

/* ---------- Gestión del fundador ---------- */
export function adminTree(db) {
  return db.prepare('SELECT c.*, p.name AS plan_name FROM courses c JOIN plans p ON p.slug = c.plan_slug ORDER BY p.rank, c.position').all().map((c) => ({
    ...c,
    modules: db.prepare('SELECT * FROM modules WHERE course_id = ? ORDER BY position').all(c.id).map((m) => ({
      ...m,
      lessons: db.prepare('SELECT * FROM lessons WHERE module_id = ? ORDER BY position').all(m.id).map((l) => ({
        ...l, resources: db.prepare('SELECT id, title, mime, size FROM resources WHERE lesson_id = ? AND removed_at IS NULL').all(l.id),
      })),
    })),
  }));
}
export function addModule(db, admin, { courseId, title }) {
  if (!title?.trim()) fail(422, 'invalid', 'Escribe el título del módulo.', 'title');
  const course = db.prepare('SELECT id FROM courses WHERE id = ?').get(Number(courseId)) || fail(404, 'no_course', 'No encontramos ese curso.');
  const pos = db.prepare('SELECT COALESCE(MAX(position),0)+1 AS p FROM modules WHERE course_id = ?').get(course.id).p;
  const id = db.prepare('INSERT INTO modules (course_id, title, position) VALUES (?,?,?)').run(course.id, title.trim(), pos).lastInsertRowid;
  audit(db, admin.id, 'modulo.crear', `modulo:${id}`, title.trim());
  return Number(id);
}
export function addLesson(db, admin, { moduleId, title, summary }) {
  if (!title?.trim() || !summary?.trim()) fail(422, 'invalid', 'Escribe el título y el resumen.', 'title');
  const mod = db.prepare('SELECT id FROM modules WHERE id = ?').get(Number(moduleId)) || fail(404, 'no_module', 'No encontramos ese módulo.');
  const pos = db.prepare('SELECT COALESCE(MAX(position),0)+1 AS p FROM lessons WHERE module_id = ?').get(mod.id).p;
  const id = db.prepare('INSERT INTO lessons (module_id, position, title, summary) VALUES (?,?,?,?)').run(mod.id, pos, title.trim(), summary.trim()).lastInsertRowid;
  audit(db, admin.id, 'leccion.crear', `leccion:${id}`, title.trim());
  return Number(id);
}
export function editLesson(db, admin, id, body) {
  const cur = db.prepare('SELECT * FROM lessons WHERE id = ?').get(Number(id)) || fail(404, 'no_lesson', 'No encontramos esa lección.');
  const next = { ...cur, ...Object.fromEntries(['title', 'summary', 'body', 'status'].filter((k) => k in body).map((k) => [k, body[k]])) };
  if (!['preparacion', 'publicada'].includes(next.status)) fail(422, 'invalid', 'Estado no válido.');
  if (next.status === 'publicada' && !next.body?.trim()) fail(422, 'invalid', 'Añade el contenido antes de publicar.', 'body');
  db.prepare('UPDATE lessons SET title = ?, summary = ?, body = ?, status = ? WHERE id = ?').run(next.title, next.summary, next.body, next.status, cur.id);
  audit(db, admin.id, 'leccion.editar', `leccion:${cur.id}`, next.status);
}
export function addResource(db, admin, lessonId, { title, storedName, mime, size }) {
  if (!title?.trim()) fail(422, 'invalid', 'Escribe el nombre del recurso.', 'title');
  db.prepare('SELECT id FROM lessons WHERE id = ?').get(Number(lessonId)) || fail(404, 'no_lesson', 'No encontramos esa lección.');
  const id = db.prepare('INSERT INTO resources (lesson_id, title, stored_name, mime, size, created_at) VALUES (?,?,?,?,?,?)').run(Number(lessonId), title.trim(), storedName, mime, size, now()).lastInsertRowid;
  audit(db, admin.id, 'recurso.crear', `recurso:${id}`, title.trim());
}
export function removeResource(db, admin, id) {
  const { changes } = db.prepare('UPDATE resources SET removed_at = ? WHERE id = ? AND removed_at IS NULL').run(now(), Number(id));
  if (!changes) fail(404, 'no_resource', 'No encontramos ese recurso.');
  audit(db, admin.id, 'recurso.retirar', `recurso:${id}`, null);
}
