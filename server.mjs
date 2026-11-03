import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './server/db.mjs';
import { createApp } from './server/app.mjs';
import { ensureFounder } from './server/accounts.mjs';
import { seedDemo } from './server/demo.mjs';

const demo = process.argv.includes('--demo') || process.env.LEGADO_DEMO === '1';
// Demo y producción usan carpetas distintas: los datos de ejemplo nunca se mezclan con los reales.
const dataDir = process.env.LEGADO_DATA_DIR || join(dirname(fileURLToPath(import.meta.url)), 'data', demo ? 'demo' : 'prod');
mkdirSync(dataDir, { recursive: true });

const db = openDb(join(dataDir, 'legado.sqlite'));
if (demo) seedDemo(db);

// El fundador se crea o restablece solo desde el servidor, nunca desde la web.
const { FOUNDER_EMAIL, FOUNDER_PASSWORD } = process.env;
if (FOUNDER_EMAIL && FOUNDER_PASSWORD && !demo) ensureFounder(db, { email: FOUNDER_EMAIL, password: FOUNDER_PASSWORD });

const port = Number(process.env.PORT || 4240);
createApp({ db, demo, dataDir, secureCookies: process.env.NODE_ENV === 'production', sandbox: demo || process.env.PAYMENTS_SANDBOX === '1' })
  .listen(port, () => console.log(`Legado Digital ${demo ? '(demostración)' : ''} en http://localhost:${port}`));
