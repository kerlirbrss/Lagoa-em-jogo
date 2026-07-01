const fs = require("fs");
const path = require("path");

const requiredFiles = [
  "backend/server.js",
  "backend/database/db.json",
  "frontend/index.html",
  "frontend/styles/app.css",
  "frontend/scripts/app.js"
];

const missing = requiredFiles.filter((file) => {
  return !fs.existsSync(path.join(__dirname, "..", file));
});

if (missing.length > 0) {
  console.error("Arquivos ausentes:");
  missing.forEach((file) => console.error(`- ${file}`));
  process.exit(1);
}

require("./server");

console.log("Estrutura da fase 0 validada.");
