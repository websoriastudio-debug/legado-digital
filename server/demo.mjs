// Datos de demostración. Solo existen en la base de la demo y todos llevan is_demo = 1.
import { ensureFounder, register, verifyEmail } from './accounts.mjs';
import { setSetting } from './settings.mjs';
import { chooseMethod, createOrder, reviewOrder, setPayoutMethod } from './sales.mjs';
import { now } from './core.mjs';

export const DEMO_PASSWORD = 'demo-legado-2026';
export const DEMO_ACCOUNTS = [
  { label: 'Fundador', email: 'fundador@demo.legado.test' },
  { label: 'Vendedora START', email: 'elena@demo.legado.test' },
  { label: 'Cuenta pendiente', email: 'visitante@demo.legado.test' },
];

const make = (db, firstName, lastName, email, ref) => {
  const { user, verifyToken } = register(db, { firstName, lastName, country: 'Perú', email, password: DEMO_PASSWORD, confirm: DEMO_PASSWORD, acceptLegal: true, ref }, { isDemo: true });
  verifyEmail(db, verifyToken);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
};
const fakeFile = { storedName: 'demo-sin-archivo.png', mime: 'image/png', size: 0 };

export function seedDemo(db) {
  if (db.prepare("SELECT 1 FROM users WHERE email = 'fundador@demo.legado.test'").get()) return;
  ensureFounder(db, { email: 'fundador@demo.legado.test', password: DEMO_PASSWORD, firstName: 'Fundador', lastName: 'Demo' });
  db.prepare("UPDATE users SET is_demo = 1, country = 'Perú' WHERE email = 'fundador@demo.legado.test'").run();
  const founder = db.prepare("SELECT * FROM users WHERE role = 'admin'").get();

  // Configuración ficticia y marcada como tal, para poder recorrer los flujos.
  setSetting(db, founder, 'payments', {
    modes: { centralizado: true, directo: true },
    platform: {
      yape: { enabled: true, holder: 'Cuenta ficticia de demostración', account: '900 000 000', currency: 'PEN', instructions: 'Demostración: no pagues a este número.' },
      transferencia: { enabled: true, holder: 'Cuenta ficticia de demostración', account: '000-0000000000', bank: 'Banco de ejemplo', currency: 'USD', instructions: 'Demostración: no transfieras a esta cuenta.' },
    },
    card: { enabled: false, provider: null, absorbedBy: 'legado', buyerFee: null },
  });
  setSetting(db, founder, 'fx', { rate: 37500, validUntil: '2099-12-31T23:59:59.000Z', source: 'demo' });

  // El fundador activa a cuatro compradores; cada uno queda con su enlace.
  const sellers = [['Elena', 'Ríos', 'elena', 'start'], ['Marcos', 'Vega', 'marcos', 'pro'], ['Rosa', 'Lima', 'rosa', 'start'], ['Iván', 'Soto', 'ivan', 'elite']].map(([f, l, e, plan]) => {
    const u = make(db, f, l, `${e}@demo.legado.test`, founder.referral_code);
    const o = createOrder(db, u, { plan }, { demo: true });
    chooseMethod(db, u, o.id, { method: 'yape' }, { sandbox: true });
    db.prepare("INSERT INTO payment_submissions (order_id, user_id, method, operation_number, paid_on, stored_name, mime, size, status, created_at) VALUES (?,?,?,?,?,?,?,?,'en_revision',?)")
      .run(o.id, u.id, 'yape', 'DEMO-0001', now().slice(0, 10), fakeFile.storedName, fakeFile.mime, fakeFile.size, now());
    db.prepare("UPDATE orders SET status = 'en_revision' WHERE id = ?").run(o.id);
    reviewOrder(db, founder, o.id, { decision: 'aprobar', confirm: true, note: 'Dato ficticio de demostración.' });
    return db.prepare('SELECT * FROM users WHERE id = ?').get(u.id);
  });

  // Elena cobra directo por Yape y tiene un pago esperando su revisión.
  const elena = sellers[0];
  setPayoutMethod(db, elena, { method: 'yape', holder: 'Elena Ríos (ficticio)', account: '911 111 111' });
  const lucia = make(db, 'Lucía', 'Paz', 'lucia@demo.legado.test', elena.referral_code);
  const lo = createOrder(db, lucia, { plan: 'start' }, { demo: true });
  chooseMethod(db, lucia, lo.id, { method: 'yape' }, { sandbox: true });
  db.prepare("INSERT INTO payment_submissions (order_id, user_id, method, operation_number, paid_on, stored_name, mime, size, status, created_at) VALUES (?,?,?,?,?,?,?,?,'en_revision',?)")
    .run(lo.id, lucia.id, 'yape', 'DEMO-0002', now().slice(0, 10), fakeFile.storedName, fakeFile.mime, fakeFile.size, now());
  db.prepare("UPDATE orders SET status = 'en_revision' WHERE id = ?").run(lo.id);

  make(db, 'Visitante', 'Demo', 'visitante@demo.legado.test', elena.referral_code);
  db.prepare('UPDATE users SET is_demo = 1').run();
  db.prepare('UPDATE orders SET is_demo = 1').run();
  db.prepare('UPDATE movements SET is_demo = 1').run();
}
