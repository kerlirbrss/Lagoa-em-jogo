/* ============================================================
   Fase 17 - Deploy: Validacao final do ambiente de producao
   ------------------------------------------------------------
   Verifica os requisitos basicos de producao localmente e, se
   informada uma URL (arquivo de config / LEJ_CHECK_URL / si arg),
   testa rotas da API por HTTP.

   Uso:
   - node scripts/check-production.js
   - node scripts/check-production.js --url https://lagoaemjogo.com.br
   - LEJ_CHECK_URL=https://lagoaemjogo.com.br node scripts/check-production.js
   ============================================================ */
const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.join(__dirname, "..");
const { createBackup } = require(path.join(__dirname, "backup.js"));

const REQUIRED_COLLECTIONS = [
  "users",
  "championships",
  "teams",
  "athletes",
  "matches",
  "news",
  "galleries",
  "comments",
  "favorites",
  "notifications",
  "notificationPreferences",
  "predictions",
  "predictionComments",
  "featuredMatches"
];

const REQUIRED_FILES = [
  "backend/server.js",
  "frontend/index.html",
  "frontend/admin.html",
  "frontend/styles/app.css",
  "frontend/scripts/app.js",
  "frontend/scripts/admin.js"
];

function hasStrongSecret(value) {
  return (
    typeof value === "string" &&
    value.trim().length >= 16 &&
    value !== "change-me-in-development" &&
    !/troque|change-me/i.test(value)
  );
}

/** Testa se e possivel escrever no diretorio do banco. */
function isDirectoryWritable(directory) {
  try {
    const probe = path.join(directory, `.write-probe-${process.pid}.tmp`);
    fs.writeFileSync(probe, "probe", "utf8");
    fs.unlinkSync(probe);
    return true;
  } catch (error) {
    return false;
  }
}
/** Executa as checagens e devolve relatorio estruturado. */
async function runProductionChecks({ dbPath, checkUrl } = {}) {
  const databaseFile = path.resolve(
    dbPath || process.env.LEJ_DB_PATH || path.join(ROOT_DIR, "backend", "database", "db.json")
  );
  const results = [];
  const record = (name, ok, message) => results.push({ name, ok, message });

  /* 1. Banco de dados */
  const dbExists = fs.existsSync(databaseFile);
  record("banco_existe", dbExists, dbExists ? databaseFile : `Arquivo ausente: ${databaseFile}`);

  if (dbExists) {
    try {
      const database = JSON.parse(fs.readFileSync(databaseFile, "utf8"));
      const missingArrays = REQUIRED_COLLECTIONS.filter((collection) => !Array.isArray(database[collection]));
      const settingsOk =
        database.settings !== null &&
        typeof database.settings === "object" &&
        typeof database.settings.appName === "string" &&
        database.settings.appName.trim().length > 0;
      const rolesOk = Array.isArray(database.roles) && database.roles.length >= 5;
      const collectionsOk = missingArrays.length === 0 && rolesOk && settingsOk;

      const problems = [];
      if (missingArrays.length > 0) problems.push(missingArrays.join(", "));
      if (!rolesOk) problems.push("roles");
      if (!settingsOk) problems.push("settings");

      record(
        "banco_colecoes",
        collectionsOk,
        collectionsOk ? "Colecoes principais presentes" : `Colecoes ausentes: ${problems.join(", ")}`
      );
    } catch (error) {
      record("banco_colecoes", false, `JSON invalido: ${error.message}`);
    }

    const dbDirectory = path.dirname(databaseFile);
    record("banco_gravavel", isDirectoryWritable(dbDirectory), `Diretorio gravavel: ${dbDirectory}`);
  }

  /* 2. Arquivos publicados (backend + frontend) */
  const missingFiles = REQUIRED_FILES.filter((file) => !fs.existsSync(path.join(ROOT_DIR, file)));
  record(
    "arquivos_publicados",
    missingFiles.length === 0,
    missingFiles.length === 0 ? "Backend e frontend presentes" : `Faltam: ${missingFiles.join(", ")}`
  );

  /* 3. Backup configurado e executavel */
  try {
    const preview = await createBackup({ dryRun: true, dbPath: databaseFile });
    record("backup_configurado", true, `Backup simulada com sucesso: ${preview.file}`);
  } catch (error) {
    record("backup_configurado", false, error.message);
  }

  /* 4. Variaveis de ambiente recomendadas */
  const envNotes = [];
  const envOk =
    process.env.NODE_ENV === "production" &&
    hasStrongSecret(process.env.SESSION_SECRET) &&
    process.env.LEJ_FORCE_HTTPS === "1" &&
    process.env.LEJ_TRUST_PROXY === "1";

  if (process.env.NODE_ENV === "production") {
    envNotes.push("NODE_ENV=production");
  } else {
    envNotes.push("NODE_ENV nao e 'production' (use apenas se for ambiente de desenvolvimento)");
  }

  if (hasStrongSecret(process.env.SESSION_SECRET)) {
    envNotes.push("SESSION_SECRET configurado e forte");
  } else {
    envNotes.push("SESSION_SECRET ausente ou fraco (gere um segredo de 32+ caracteres)");
  }

  if (process.env.LEJ_FORCE_HTTPS === "1" && process.env.LEJ_TRUST_PROXY === "1") {
    envNotes.push("HTTPS forcado + proxy confiavel configurados");
  } else {
    envNotes.push("LEJ_FORCE_HTTPS/LEJ_TRUST_PROXY recomendados em producao");
  }

  record("variaveis_ambiente", envOk, envNotes.join(" | "));

  /* 5. HTTP (opcional): verifica rotas principais publicadas */
  const url = checkUrl || process.env.LEJ_CHECK_URL ||
    (process.argv.includes("--url") ? process.argv[process.argv.indexOf("--url") + 1] : "");

  if (url) {
    const baseUrl = url.replace(/\/$/, "");
    try {
      const healthResponse = await fetch(`${baseUrl}/api/health`);
      const health = await healthResponse.json();
      const healthOk = healthResponse.status === 200 && health.status === "ok";
      record(
        "http_health",
        healthOk,
        healthOk ? `GET /api/health -> ${JSON.stringify(health)}` : `Health respondeu status ${healthResponse.status}`
      );

      const bootstrapResponse = await fetch(`${baseUrl}/api/bootstrap`);
      const bootstrap = await bootstrapResponse.json();
      record(
        "http_bootstrap",
        bootstrapResponse.status === 200,
        bootstrapResponse.status === 200
          ? `GET /api/bootstrap -> ${bootstrap.championships.length} campeonatos, ${bootstrap.teams.length} times`
          : `Bootstrap respondeu status ${bootstrapResponse.status}`
      );
    } catch (error) {
      record("http_health", false, `Nao foi possivel acessar ${url}: ${error.message}`);
      record("http_bootstrap", false, `Nao foi possivel acessar ${url}`);
    }
  }

  const allPassed = results.every((check) => check.ok);
  return { allPassed, checks: results };
}

if (require.main === module) {
  runProductionChecks()
    .then((report) => {
      report.checks.forEach((check) => {
        const icon = check.ok ? "[OK]" : "[FALHA]";
        console.log(`${icon} ${check.name}: ${check.message}`);
      });
      console.log(report.allPassed ? "\nAmbiente de producao validado." : "\nCorrija as falhas acima e rode novamente.");
      process.exit(report.allPassed ? 0 : 1);
    })
    .catch((error) => {
      console.error(`[check-production] Erro inesperado: ${error.stack || error.message}`);
      process.exit(1);
    });
}

module.exports = { runProductionChecks };