// Copia de seguridad: base de datos coherente (VACUUM INTO) y archivos privados.
// Uso: node scripts/backup.mjs [carpeta-de-datos] [carpeta-destino]
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export function backup(dataDir, destRoot) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = resolve(destRoot, `legado-${stamp}`);
  mkdirSync(dest, { recursive: true });
  const db = new DatabaseSync(join(dataDir, 'legado.sqlite'));
  db.exec(`VACUUM INTO '${join(dest, 'legado.sqlite').replace(/'/g, "''")}'`);
  db.close();
  for (const dir of ['comprobantes', 'avatares', 'recursos']) {
    if (existsSync(join(dataDir, dir))) cpSync(join(dataDir, dir), join(dest, dir), { recursive: true });
  }
  return dest;
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/backup.mjs')) {
  const [dataDir = 'data/prod', destRoot = 'backups'] = process.argv.slice(2);
  console.log(`Copia creada en ${backup(resolve(dataDir), destRoot)}`);
}
