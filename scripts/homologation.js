/* ============================================================
   Fase 24 - Homologacao e Publicacao Final
   ------------------------------------------------------------
   Gera um checklist operacional final para a liberacao da
   plataforma em producao. Valida status da aplicacao, backup,
   arquivos essenciais e observacoes de release.
   ============================================================ */
const fs = require("fs");
const path = require("path");
const { createBackup } = require("./backup.js");

const ROOT_DIR = path.join(__dirname, "..");

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return null;
  }
}

async function runReleaseChecklist({ baseUrl, dbPath } = {}) {
  const databasePath = path.resolve(dbPath || process.env.LEJ_DB_PATH || path.join(ROOT_DIR, "backend", "database", "db.json"));
  const targetUrl = baseUrl || process.env.LEJ_MONITOR_URL || "http://localhost:3000";
  const checks = [];

  function record(name, ok, message) {
    checks.push({ name, ok, message });
  }

  const appFiles = [
    "backend/server.js",
    "frontend/index.html",
    "frontend/admin.html",
    "frontend/styles/app.css",
    "frontend/scripts/app.js",
    "frontend/scripts/admin.js"
  ];

  const missingFiles = appFiles.filter((file) => !fs.existsSync(path.join(ROOT_DIR, file)));
  record(
    "arquivos_essenciais",
    missingFiles.length === 0,
    missingFiles.length === 0 ? "Arquivos essenciais presentes" : `Arquivos ausentes: ${missingFiles.join(", ")}`
  );

  const databaseFileExists = fs.existsSync(databasePath);
  record("banco", databaseFileExists, databaseFileExists ? `Banco localizado em ${databasePath}` : `Banco ausente: ${databasePath}`);

  if (databaseFileExists) {
    const db = readJsonIfExists(databasePath);
    record(
      "estrutura_banco",
      !!db && Array.isArray(db.users) && Array.isArray(db.championships) && Array.isArray(db.teams),
      db ? "Estrutura principal do banco validada" : "Banco JSON invalido ou incompleto"
    );
  }

  try {
    const backup = await createBackup({ dbPath: databasePath, dryRun: true });
    record("backup", true, `Backup simulado com sucesso: ${backup.file}`);
  } catch (error) {
    record("backup", false, error.message);
  }

  try {
    const response = await fetch(`${targetUrl}/api/health`);
    const payload = await response.json();
    const healthOk = response.status === 200 && payload && payload.status === "ok";
    record("health_check", healthOk, healthOk ? `Health OK em ${targetUrl}` : `Health falhou com status ${response.status}`);
  } catch (error) {
    record("health_check", false, `Nao foi possivel consultar ${targetUrl}: ${error.message}`);
  }

  try {
    const response = await fetch(`${targetUrl}/api/bootstrap`);
    const payload = await response.json();
    const bootstrapOk = response.status === 200 && payload && Array.isArray(payload.championships);
    record("bootstrap", bootstrapOk, bootstrapOk ? "Bootstrap da aplicacao acessivel" : `Bootstrap falhou com status ${response.status}`);
  } catch (error) {
    record("bootstrap", false, `Nao foi possivel consultar bootstrap em ${targetUrl}: ${error.message}`);
  }

  const isProductionTarget = process.env.NODE_ENV === "production" || targetUrl.startsWith("https://");
  const urlType = targetUrl.includes("https://") ? "HTTPS" : "HTTP";
  const securityChecklist = [
    { name: "https", ok: urlType === "HTTPS", message: "Ambiente de producao deve usar HTTPS" },
    { name: "session_secret", ok: !!process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16, message: "SESSION_SECRET forte configurado" },
    { name: "cookies_seguros", ok: process.env.LEJ_SECURE_COOKIES === "1", message: "Cookies seguros habilitados" },
    { name: "proxy_confiavel", ok: process.env.LEJ_TRUST_PROXY === "1", message: "Proxy reverso confiado" }
  ];

  securityChecklist.forEach((item) => {
    const ok = isProductionTarget ? item.ok : true;
    const message = ok
      ? (isProductionTarget ? item.message : `Checklist de producao: ${item.message} (validar em ambiente real)`)
      : `Revisar: ${item.message}`;

    record(`seguranca_${item.name}`, ok, message);
  });

  const releaseNotes = [
    "Sistema pronto para homologacao final.",
    "Validar login, painel administrativo e fluxo principal em ambiente real.",
    "Confirmar backup, monitoramento e logs antes da publicação definitiva."
  ];

  record("homologacao", true, releaseNotes.join(" "));

  const criticalNames = [
    "arquivos_essenciais",
    "banco",
    "estrutura_banco",
    "backup",
    "health_check",
    "bootstrap",
    "homologacao"
  ];

  const ok = criticalNames.every((name) => {
    const item = checks.find((check) => check.name === name);
    return item ? item.ok !== false : true;
  });

  return { ok, checks };
}

if (require.main === module) {
  runReleaseChecklist()
    .then((report) => {
      console.log(JSON.stringify({ ok: report.ok, checks: report.checks }, null, 2));
      process.exit(report.ok ? 0 : 1);
    })
    .catch((error) => {
      console.error(`[homologation] Erro inesperado: ${error.stack || error.message}`);
      process.exit(1);
    });
}

module.exports = { runReleaseChecklist };
