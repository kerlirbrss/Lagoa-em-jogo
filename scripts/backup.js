/* ============================================================
   Fase 17 - Deploy: Backup automatico do banco de dados
   ------------------------------------------------------------
   Gera um backup compactado (gzip) do arquivo JSON com registro
   de data/hora e mantem apenas os N backups mais recentes.

   Configuracao por variaveis de ambiente:
   - LEJ_DB_PATH       caminho do banco (padrao backend/database/db.json)
   - LEJ_BACKUP_DIR    pasta de destino (padrao ./backups)
   - LEJ_BACKUP_KEEP   quantidade de backups a manter (padrao 14)

   Uso:
   - node scripts/backup.js
   - node scripts/backup.js --dry-run   (apenas simula)
   ============================================================ */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const ROOT_DIR = path.join(__dirname, "..");
const DEFAULT_DB = path.join(ROOT_DIR, "backend", "database", "db.json");

/** Rótulo de data/hora no formato AAAAmmDD-HHMMSS. */
function timestampLabel(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

/** Remove backups antigos, mantendo apenas os `keep` mais recentes. */
function pruneBackups(directory, keep) {
  if (!fs.existsSync(directory)) {
    return 0;
  }

  const files = fs
    .readdirSync(directory)
    .filter((name) => /^db-.*\.gz$/.test(name))
    .sort();

  const toRemove = Math.max(0, files.length - keep);
  files.slice(0, toRemove).forEach((name) => {
    fs.unlinkSync(path.join(directory, name));
  });

  return toRemove;
}

/**
 * Cria um backup do banco. Retorna um resumo com o arquivo gerado.
 * Com `dryRun` apenas prepara o nome e os caminhos sem escrever.
 */
async function createBackup({ dbPath, outDir, keep, dryRun } = {}) {
  const databasePath = path.resolve(dbPath || process.env.LEJ_DB_PATH || DEFAULT_DB);
  const outputDir = path.resolve(outDir || process.env.LEJ_BACKUP_DIR || path.join(ROOT_DIR, "backups"));
  const keepCount = Number(keep ?? process.env.LEJ_BACKUP_KEEP ?? 14);

  if (!fs.existsSync(databasePath)) {
    throw new Error(`Banco de dados nao encontrado: ${databasePath}`);
  }

  if (!dryRun && !fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const name = `db-${timestampLabel(new Date())}.gz`;
  const outFile = path.join(outputDir, name);
  const content = fs.readFileSync(databasePath);

  if (dryRun) {
    return { file: outFile, bytes: content.length, removed: 0, dryRun: true };
  }

  const gzipped = zlib.gzipSync(content);
  fs.writeFileSync(outFile, gzipped);
  const removed = pruneBackups(outputDir, keepCount);

  return { file: outFile, bytes: gzipped.length, source: databasePath, removed };
}

if (require.main === module) {
  const dryRun = process.argv.includes("--dry-run");
  createBackup({ dryRun })
    .then((info) => {
      console.log(JSON.stringify(info, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error(`[backup] Falha: ${error.message}`);
      process.exit(1);
    });
}

module.exports = { createBackup, pruneBackups, timestampLabel };