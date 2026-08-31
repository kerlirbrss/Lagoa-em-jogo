const fs = require("fs");
const path = require("path");

const requiredFiles = [
  "backend/server.js",
  "backend/database/db.json",
  "frontend/index.html",
  "frontend/admin.html",
  "frontend/styles/app.css",
  "frontend/scripts/app.js",
  "frontend/scripts/admin.js"
];

const missing = requiredFiles.filter((file) => {
  return !fs.existsSync(path.join(__dirname, "..", file));
});

if (missing.length > 0) {
  console.error("Arquivos ausentes:");
  missing.forEach((file) => console.error(`- ${file}`));
  process.exit(1);
}

const database = JSON.parse(fs.readFileSync(path.join(__dirname, "database", "db.json"), "utf8"));

if (!Array.isArray(database.athletes)) {
  console.error("Colecao de atletas ausente no banco de dados.");
  process.exit(1);
}

if (!Array.isArray(database.matches)) {
  console.error("Colecao de jogos ausente no banco de dados.");
  process.exit(1);
}

if (!Array.isArray(database.teams) || !Array.isArray(database.championships)) {
  console.error("Colecoes necessarias para classificacoes ausentes no banco de dados.");
  process.exit(1);
}

if (!Array.isArray(database.news)) {
  console.error("Colecao de noticias ausente no banco de dados.");
  process.exit(1);
}

if (!Array.isArray(database.galleries)) {
  console.error("Colecao de galerias ausente no banco de dados.");
  process.exit(1);
}

if (!Array.isArray(database.favorites)) {
  console.error("Colecao de favoritos ausente no banco de dados.");
  process.exit(1);
}

if (!Array.isArray(database.notifications)) {
  console.error("Colecao de notificacoes ausente no banco de dados.");
  process.exit(1);
}

if (!Array.isArray(database.notificationPreferences)) {
  console.error("Colecao de preferencias de notificacao ausente no banco de dados.");
  process.exit(1);
}

if (!Array.isArray(database.predictions) || !Array.isArray(database.predictionComments)) {
  console.error("Colecoes de palpites da fase 13 ausentes no banco de dados.");
  process.exit(1);
}

require("./server");

const source = fs.readFileSync(path.join(__dirname, "server.js"), "utf8");

if (!source.includes('"/api/search"')) {
  console.error("Rota de pesquisa da fase 10 ausente no server.js.");
  process.exit(1);
}

if (!source.includes('"/api/favorites"')) {
  console.error("Rotas de favoritos da fase 11 ausentes no server.js.");
  process.exit(1);
}

if (!source.includes('"/api/personalized-home"')) {
  console.error("Conteudos personalizados da fase 11 ausentes no server.js.");
  process.exit(1);
}

if (!source.includes('"/api/notifications"')) {
  console.error("Rotas de notificacoes da fase 12 ausentes no server.js.");
  process.exit(1);
}

if (!source.includes('"/api/notification-preferences"')) {
  console.error("Rotas de preferencias de notificacao da fase 12 ausentes no server.js.");
  process.exit(1);
}

if (!source.includes('"/api/predictions"')) {
  console.error("Rotas de palpites da fase 13 ausentes no server.js.");
  process.exit(1);
}

if (!source.includes('"/api/home"')) {
  console.error("Rota da pagina inicial da fase 14 ausente no server.js.");
  process.exit(1);
}

const indexPath = path.join(__dirname, "..", "frontend", "index.html");
const appCssPath = path.join(__dirname, "..", "frontend", "styles", "app.css");
const appJsPath = path.join(__dirname, "..", "frontend", "scripts", "app.js");
const adminJsPath = path.join(__dirname, "..", "frontend", "scripts", "admin.js");

const indexHtml = fs.readFileSync(indexPath, "utf8");
const appCss = fs.readFileSync(appCssPath, "utf8");
const appJs = fs.readFileSync(appJsPath, "utf8");
const adminJs = fs.readFileSync(adminJsPath, "utf8");

const fase15Checks = [
  {
    condition: !indexHtml.includes('<nav class="nav-drawer" id="nav-drawer"'),
    message: "Menu 'Mais' (nav-drawer) da fase 15 ausente no index.html."
  },
  {
    condition: !indexHtml.includes("nav-group-label"),
    message: "Agrupamento do menu 'Mais' da fase 15 ausente no index.html."
  },
  {
    condition: !indexHtml.includes('href="#contato"') || !indexHtml.includes('class="app-footer" id="contato"'),
    message: "Rodape com secao de contato da fase 15 ausente no index.html."
  },
  {
    condition: !indexHtml.includes("footer-cols"),
    message: "Colunas do rodape da fase 15 ausentes no index.html."
  },
  {
    condition: !appCss.includes("@media (max-width: 380px)") || !appCss.includes("@media (min-width: 768px)") || !appCss.includes("@media (min-width: 1200px)"),
    message: "Breakpoints de responsividade da fase 15 ausentes no app.css."
  },
  {
    condition: !appCss.includes(".footer-cols") || !appCss.includes(".nav-group-label"),
    message: "Estilos de rodape e menu da fase 15 ausentes no app.css."
  },
  {
    condition: !appJs.includes("nav-drawer-close") || !adminJs.includes("nav-drawer-close"),
    message: "Botao de fechar do menu da fase 15 ausente nos scripts."
  },
  {
    condition: !appJs.includes("event.key === \"Escape\"") || !adminJs.includes("event.key === \"Escape\""),
    message: "Fechamento com a tecla Esc da fase 15 ausente nos scripts."
  },
  {
    condition: !appJs.includes("loading=\"lazy\""),
    message: "Carregamento lento de imagens (lazy loading) da fase 15 ausente no app.js."
  }
];

const failed = fase15Checks.filter((check) => check.condition);

if (failed.length > 0) {
  failed.forEach((check) => console.error(check.message));
  process.exit(1);
}

/* ============================================================
   Fase 17 - Deploy
   Valida os artefatos de producao: scripts, configs, Docker,
   variaveis de ambiente e recursos embutidos no server.js.
   ============================================================ */

const deployFiles = [
  "Dockerfile",
  "docker-compose.yml",
  ".dockerignore",
  "scripts/backup.js",
  "scripts/monitor.js",
  "scripts/check-production.js",
  "deploy/nginx.conf",
  "deploy/logrotate.conf",
  "deploy/lagoa-em-jogo.service",
  "deploy/lagoa-em-jogo-backup.service",
  "deploy/lagoa-em-jogo-backup.timer",
  "deploy/lagoa-em-jogo-monitor.service",
  "deploy/lagoa-em-jogo-monitor.timer"
];

const missingDeployFiles = deployFiles.filter((file) => {
  return !fs.existsSync(path.join(__dirname, "..", file));
});

if (missingDeployFiles.length > 0) {
  console.error("Artefatos de deploy da fase 17 ausentes:");
  missingDeployFiles.forEach((file) => console.error(`- ${file}`));
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
const requiredScripts = ["backup", "monitor", "check:production"];
const missingScripts = requiredScripts.filter((script) => {
  return !packageJson.scripts || typeof packageJson.scripts[script] !== "string";
});

if (missingScripts.length > 0) {
  console.error(`Scripts de deploy da fase 17 ausentes no package.json: ${missingScripts.join(", ")}`);
  process.exit(1);
}

const deployServerChecks = [
  { pattern: "LEJ_TRUST_PROXY", message: "Confianca no proxy reverso (LEJ_TRUST_PROXY) ausente no server.js." },
  { pattern: "LEJ_FORCE_HTTPS", message: "Redirecionamento HTTP -> HTTPS (LEJ_FORCE_HTTPS) ausente no server.js." },
  { pattern: "LEJ_SECURE_COOKIES", message: "Cookies de sessao seguros (LEJ_SECURE_COOKIES) ausentes no server.js." },
  { pattern: "LEJ_LOG_REQUESTS", message: "Log estruturado de requisicoes (LEJ_LOG_REQUESTS) ausente no server.js." },
  { pattern: "ensureDatabaseFile", message: "Criacao automatica do banco (ensureDatabaseFile) ausente no server.js." },
  { pattern: "getHealthDetails", message: "Health check com metadados (getHealthDetails) ausente no server.js." }
];

const deployServerFailed = deployServerChecks.filter((check) => !source.includes(check.pattern));

if (deployServerFailed.length > 0) {
  deployServerFailed.forEach((check) => console.error(check.message));
  process.exit(1);
}

const envExamplePath = path.join(__dirname, "..", ".env.example");
const envExample = fs.readFileSync(envExamplePath, "utf8");
const envVars = [
  "LEJ_TRUST_PROXY",
  "LEJ_FORCE_HTTPS",
  "LEJ_SECURE_COOKIES",
  "LEJ_DB_PATH",
  "LEJ_LOG_REQUESTS",
  "LEJ_BACKUP_DIR",
  "LEJ_BACKUP_KEEP",
  "LEJ_MONITOR_URL"
];
const missingEnvVars = envVars.filter((variable) => !envExample.includes(variable));

if (missingEnvVars.length > 0) {
  console.error(`Variaveis de ambiente da fase 17 ausentes no .env.example: ${missingEnvVars.join(", ")}`);
  process.exit(1);
}

console.log("Estrutura das fases 10, 11, 12, 13, 14, 15 e 17 validada.");
