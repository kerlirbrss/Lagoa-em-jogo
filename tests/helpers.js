const fs = require("fs");
const path = require("path");

/* ============================================================
   Helpers para os testes da Fase 16
   Cada arquivo de teste roda em um processo separado no
   `node --test`, entao definimos LEJ_DB_PATH para apontar o
   backend para uma copia temporaria do banco, evitando que os
   testes corrompam o db.json real.
   ============================================================ */

const ROOT = path.join(__dirname, "..");
const REAL_DB = path.join(ROOT, "backend", "database", "db.json");
const TMP_DB = path.join(__dirname, ".tmp-db.json");
const SERVER_PATH = path.join(ROOT, "backend", "server.js");

/**
 * Copia o banco real para um arquivo temporario e define LEJ_DB_PATH.
 * Deve ser chamado ANTES de `require` do servidor em cada arquivo de teste.
 */
function setupTestEnv() {
  fs.copyFileSync(REAL_DB, TMP_DB);
  process.env.LEJ_DB_PATH = TMP_DB;
  return TMP_DB;
}

/** Le o banco temporario corrente. */
function loadDatabase() {
  return JSON.parse(fs.readFileSync(process.env.LEJ_DB_PATH || TMP_DB, "utf8"));
}

/** Remove o banco temporario criado pelos testes. */
function cleanupTestDb() {
  if (fs.existsSync(TMP_DB)) {
    fs.unlinkSync(TMP_DB);
  }
}

/**
 * Sobe o servidor numa porta efemera (0). O require do servidor e feito
 * de forma lazy para respeitar o LEJ_DB_PATH configurado no setup.
 */
async function startServer() {
  const { server } = require(SERVER_PATH);

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, () => {
      const port = server.address().port;
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        server,
        close: () => new Promise((res) => server.close(res))
      });
    });
  });
}

/**
 * Executa uma requisicao HTTP nativa (fetch) e normaliza a resposta.
 * Captura o cookie Set-Cookie (lej_session) para fluxos autenticados.
 */
async function request(baseUrl, method, urlPath, { body, cookie } = {}) {
  const headers = {};
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (cookie) {
    headers["Cookie"] = cookie;
  }

  const response = await fetch(baseUrl + urlPath, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (error) {
    data = text;
  }

  const rawSet = response.headers.get("set-cookie");
  const setCookie = Array.isArray(rawSet) ? rawSet[0] : rawSet || "";
  const nextCookie = (String(setCookie).split(";")[0] || "").trim();

  return {
    status: response.status,
    body: data,
    cookie: nextCookie,
    headers: response.headers
  };
}

/** Cliente HTTP com cookie jar simples (autenticacao por sessao). */
function createClient(baseUrl) {
  let cookie = "";

  return {
    get cookie() {
      return cookie;
    },
    async req(method, urlPath, body) {
      const result = await request(baseUrl, method, urlPath, { body, cookie });
      if (result.cookie) {
        cookie = result.cookie;
      }
      return result;
    }
  };
}

module.exports = {
  REAL_DB,
  TMP_DB,
  setupTestEnv,
  loadDatabase,
  cleanupTestDb,
  startServer,
  request,
  createClient
};