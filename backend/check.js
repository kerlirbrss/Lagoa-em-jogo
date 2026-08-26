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

console.log("Estrutura das fases 10, 11, 12 e 13 validada.");
