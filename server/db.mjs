// Esquema con migraciones numeradas. La base de datos es la fuente de verdad de pagos y permisos.
import { DatabaseSync } from 'node:sqlite';
import { programs } from '../shared/site.config.mjs';
import { now } from './core.mjs';
export { tx } from './core.mjs';

// Cada migración se aplica una sola vez y en orden. Para cambiar el esquema, añade una nueva al final.
export const MIGRATIONS = [
  `CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    country TEXT NOT NULL,
    pw_salt TEXT NOT NULL,
    pw_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
    can_verify INTEGER NOT NULL DEFAULT 0,
    account_status TEXT NOT NULL DEFAULT 'pendiente' CHECK (account_status IN ('pendiente','activo','suspendido')),
    email_verified_at TEXT,
    sponsor_id INTEGER REFERENCES users(id),
    sponsor_source TEXT NOT NULL DEFAULT 'directo' CHECK (sponsor_source IN ('enlace','directo','correccion')),
    referral_code TEXT UNIQUE,
    avatar_name TEXT,
    avatar_mime TEXT,
    totp_secret TEXT,
    totp_enabled INTEGER NOT NULL DEFAULT 0,
    prefs TEXT NOT NULL DEFAULT '{}',
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE INDEX users_sponsor ON users(sponsor_id);
  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    mfa_ok INTEGER NOT NULL DEFAULT 1,
    reauth_at INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE one_time_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL CHECK (purpose IN ('reset','verify')),
    expires_at INTEGER NOT NULL,
    used INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE plans (
    slug TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    rank INTEGER NOT NULL UNIQUE,
    price_cents INTEGER NOT NULL CHECK (price_cents > 0),
    currency TEXT NOT NULL DEFAULT 'USD',
    tagline TEXT NOT NULL DEFAULT '',
    features TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL
  );
  CREATE TABLE courses (
    id INTEGER PRIMARY KEY,
    plan_slug TEXT NOT NULL REFERENCES plans(slug),
    title TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL
  );
  CREATE TABLE modules (
    id INTEGER PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id),
    title TEXT NOT NULL,
    position INTEGER NOT NULL
  );
  CREATE TABLE lessons (
    id INTEGER PRIMARY KEY,
    module_id INTEGER NOT NULL REFERENCES modules(id),
    position INTEGER NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    body TEXT,
    status TEXT NOT NULL DEFAULT 'preparacion' CHECK (status IN ('preparacion','publicada'))
  );
  CREATE TABLE resources (
    id INTEGER PRIMARY KEY,
    lesson_id INTEGER NOT NULL REFERENCES lessons(id),
    title TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    removed_at TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE progress (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    completed_at TEXT NOT NULL,
    PRIMARY KEY (user_id, lesson_id)
  );
  CREATE TABLE commission_rules (
    id INTEGER PRIMARY KEY,
    version INTEGER NOT NULL UNIQUE,
    enabled INTEGER NOT NULL DEFAULT 0,
    direct_bps INTEGER,
    bonus_enabled INTEGER NOT NULL DEFAULT 0,
    royalty_enabled INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL
  );
  CREATE TABLE orders (
    id INTEGER PRIMARY KEY,
    buyer_id INTEGER NOT NULL REFERENCES users(id),
    seller_id INTEGER REFERENCES users(id),
    sale_type TEXT NOT NULL CHECK (sale_type IN ('vendedor','plataforma')),
    kind TEXT NOT NULL CHECK (kind IN ('compra','actualizacion')),
    plan_slug TEXT NOT NULL REFERENCES plans(slug),
    plan_name TEXT NOT NULL,
    from_rank INTEGER NOT NULL,
    to_rank INTEGER NOT NULL,
    base_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL CHECK (status IN ('pendiente_pago','en_revision','aprobado','rechazado','cancelado')),
    method TEXT,
    beneficiary_type TEXT CHECK (beneficiary_type IN ('plataforma','vendedor')),
    beneficiary_snapshot TEXT,
    instructions_snapshot TEXT,
    charge_cents INTEGER,
    charge_currency TEXT,
    fx_rate INTEGER,
    fx_valid_until TEXT,
    buyer_fee_cents INTEGER,
    rule_version_id INTEGER REFERENCES commission_rules(id),
    settlement TEXT CHECK (settlement IN ('devuelto','contracargo')),
    provider_ref TEXT,
    review_note TEXT,
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TEXT,
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX one_open_order_per_user ON orders(buyer_id) WHERE status IN ('pendiente_pago','en_revision');
  CREATE INDEX orders_seller ON orders(seller_id, created_at);
  CREATE TABLE order_events (
    id INTEGER PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    from_status TEXT,
    to_status TEXT NOT NULL,
    actor_id INTEGER REFERENCES users(id),
    note TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE payment_submissions (
    id INTEGER PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    method TEXT NOT NULL,
    operation_number TEXT NOT NULL,
    paid_on TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('en_revision','aprobado','rechazado')),
    review_note TEXT,
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE payment_events (
    event_id TEXT PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    type TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE entitlements (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    plan_slug TEXT NOT NULL REFERENCES plans(slug),
    order_id INTEGER REFERENCES orders(id),
    source TEXT NOT NULL CHECK (source IN ('pedido','concesion')),
    granted_by INTEGER REFERENCES users(id),
    granted_at TEXT NOT NULL,
    revoked_at TEXT,
    revoked_reason TEXT
  );
  CREATE UNIQUE INDEX one_live_entitlement ON entitlements(user_id, plan_slug) WHERE revoked_at IS NULL;
  CREATE TABLE payout_methods (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    method TEXT NOT NULL,
    holder TEXT NOT NULL,
    account TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'PEN',
    created_at TEXT NOT NULL,
    replaced_at TEXT
  );
  CREATE TABLE movements (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    order_id INTEGER REFERENCES orders(id),
    type TEXT NOT NULL CHECK (type IN ('venta','comision','bono','regalia','ajuste','liquidacion')),
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL,
    custody TEXT NOT NULL CHECK (custody IN ('plataforma','externo')),
    status TEXT NOT NULL CHECK (status IN ('pendiente','confirmado','pagado','anulado')),
    rule_version_id INTEGER REFERENCES commission_rules(id),
    relates_to TEXT CHECK (relates_to IN ('venta','comision')),
    note TEXT,
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX one_movement_per_order ON movements(order_id, user_id, type) WHERE type IN ('venta','comision');
  CREATE INDEX movements_user ON movements(user_id, created_at);
  CREATE TABLE payouts (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL,
    reference TEXT NOT NULL,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL
  );
  CREATE TABLE notifications (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    link TEXT,
    read_at TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX notifications_user ON notifications(user_id, read_at);
  CREATE TABLE outbox (
    id INTEGER PRIMARY KEY,
    to_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    sent_at TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE consents (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document TEXT NOT NULL,
    version TEXT NOT NULL,
    accepted_at TEXT NOT NULL
  );
  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_by INTEGER REFERENCES users(id),
    updated_at TEXT NOT NULL
  );
  CREATE TABLE contacts (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY,
    actor_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    target TEXT,
    detail TEXT,
    created_at TEXT NOT NULL
  );`,
];

// Contenido base: un curso por plan, un módulo por curso y las lecciones del temario aprobado.
const LESSONS = {
  start: ['Introducción al marketing digital', 'Cómo vender por internet', 'Cómo utilizar WhatsApp Business', 'Cómo crear contenido para redes sociales', 'Fundamentos de publicidad digital'],
  pro: ['Marketing de contenidos', 'Estrategias de ventas por Instagram y TikTok', 'Embudos de venta', 'Copywriting y persuasión ética', 'Creación de páginas de venta'],
  elite: ['Publicidad digital avanzada', 'Automatización de ventas', 'Creación de productos digitales', 'Marca personal y posicionamiento', 'Analítica y optimización de campañas'],
};

function seed(db) {
  if (db.prepare('SELECT COUNT(*) AS n FROM plans').get().n) return;
  const addPlan = db.prepare('INSERT INTO plans (slug, name, rank, price_cents, tagline, features, updated_at) VALUES (?,?,?,?,?,?,?)');
  const addCourse = db.prepare('INSERT INTO courses (plan_slug, title, summary, position) VALUES (?,?,?,?)');
  const addModule = db.prepare('INSERT INTO modules (course_id, title, position) VALUES (?,?,?)');
  const addLesson = db.prepare('INSERT INTO lessons (module_id, position, title, summary) VALUES (?,?,?,?)');
  for (const p of programs) {
    addPlan.run(p.slug, p.name, p.rank, p.priceCents, p.tagline, JSON.stringify(p.features), now());
    const course = addCourse.run(p.slug, `Formación ${p.name}`, p.tagline, p.rank).lastInsertRowid;
    const mod = addModule.run(course, 'Módulo 1', 1).lastInsertRowid;
    LESSONS[p.slug].forEach((t, i) => addLesson.run(mod, i + 1, t, 'Lección pendiente de publicación.'));
  }
}

export function migrate(db) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
  const done = new Set(db.prepare('SELECT version FROM schema_migrations').all().map((r) => r.version));
  MIGRATIONS.forEach((sql, i) => {
    const version = i + 1;
    if (done.has(version)) return;
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?,?)').run(version, now());
      db.exec('COMMIT');
    } catch (err) { db.exec('ROLLBACK'); throw err; }
  });
}

export function openDb(path = ':memory:') {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON;');
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  migrate(db);
  seed(db);
  return db;
}
