// Restauración: comprueba la copia y la coloca como carpeta de datos. Detén el servidor antes.
// Uso: node scripts/restore.mjs <carpeta-de-copia> <carpeta-de-datos>
import { cpSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export function restore(backupDir, dataDir) {
  const file = join(backupDir, 'legado.sqlite');
  if (!existsSync(file)) throw new Error('La copia no contiene legado.sqlite.');
  const check = new DatabaseSync(file);
  const ok = check.prepare('PRAGMA integrity_check').get();
  check.close();
  if (Object.values(ok)[0] !== 'ok') throw new Error('La copia está dañada: no se restaura.');
  // La carpeta actual se conserva con otro nombre: nada se borra.
  if (existsSync(dataDir)) renameSync(dataDir, `${dataDir}-antes-${Date.now()}`);
  mkdirSync(dataDir, { recursive: true });
  cpSync(backupDir, dataDir, { recursive: true });
  return dataDir;
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/restore.mjs')) {
  const [backupDir, dataDir = 'data/prod'] = process.argv.slice(2);
  if (!backupDir) { console.error('Indica la carpeta de la copia.'); process.exit(1); }
  console.log(`Restaurado en ${restore(resolve(backupDir), resolve(dataDir))}`);
}
