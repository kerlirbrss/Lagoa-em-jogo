/* ============================================================
   Fase 17 - Testes de Deploy
   Valida os recursos de producao: helpers do server, health com
   metadados, backup compressivo e monitoramento.
   ============================================================ */
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { setupTestEnv, startServer, request, cleanupTestDb } = require("./helpers.js");

setupTestEnv();
const { __testing } = require("../backend/server.js");

describe("Fase 17 - helpers de producao", () => {
  test("toBoolean interpreta valores de ambiente", () => {
    assert.equal(__testing.toBoolean("1"), true);
    assert.equal(__testing.toBoolean("true"), true);
    assert.equal(__testing.toBoolean("yes"), true);
    assert.equal(__testing.toBoolean("0"), false);
    assert.equal(__testing.toBoolean(undefined), false);
    assert.equal(__testing.toBoolean(null), false);
  });

  test("buildSessionCookie mantem atributos base de sessao", () => {
    const cookie = __testing.buildSessionCookie("abc123");
    assert.ok(cookie.startsWith("lej_session=abc123; HttpOnly; Path=/; SameSite=Lax"));
  });

  test("buildSessionCookie com maxAge inclui expiracao", () => {
    const cookie = __testing.buildSessionCookie("", { maxAge: 0 });
    assert.ok(cookie.includes("Max-Age=0"));
  });

  test("buildRedirectUrl redireciona mantendo host e caminho", () => {
    const url = __testing.buildRedirectUrl({ headers: { host: "lagoaemjogo.com.br" }, url: "/admin.html" });
    assert.equal(url, "https://lagoaemjogo.com.br/admin.html");
  });

  test("isSecureRequest respeita socket TLS e proxy configurado", () => {
    assert.equal(__testing.isSecureRequest({ headers: {}, socket: { encrypted: true } }), true);

    const viaProxy = __testing.isSecureRequest({
      headers: { "x-forwarded-proto": "https" },
      socket: {}
    });
    assert.equal(viaProxy, __testing.TRUST_PROXY);
  });

  test("getHealthDetails expoe metadados de producao", () => {
    const db = JSON.parse(fs.readFileSync(process.env.LEJ_DB_PATH, "utf8"));
    const details = __testing.getHealthDetails(db);
    assert.equal(details.status, "ok");
    assert.equal(details.app, db.settings.appName);
    assert.equal(typeof details.version, "string");
    assert.equal(typeof details.uptimeSeconds, "number");
    assert.ok(details.timestamp);
  });
});

describe("Fase 17 - endpooints e scripts de producao", () => {
  let server;

  before(async () => {
    server = await startServer();
  });

  after(async () => {
    await server.close();
    cleanupTestDb();
  });

  test("health check responde com metadados", async () => {
    const res = await request(server.baseUrl, "GET", "/api/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "ok");
    assert.equal(res.body.environment, "development");
    assert.ok(res.body.version);
    assert.ok(res.body.uptimeSeconds >= 0);
    assert.ok(res.body.timestamp);
  });

  test("monitor valida o health check da aplicacao", async () => {
    const { checkHealth } = require("../scripts/monitor.js");
    const result = await checkHealth(server.baseUrl);
    assert.equal(result.ok, true);
    assert.equal(result.statusCode, 200);
    assert.equal(result.payload.status, "ok");
  });

  test("backup gera arquivo gz com prefixo db-", async () => {
    const { createBackup } = require("../scripts/backup.js");
    const tmpOut = path.join(__dirname, ".tmp-backup");

    try {
      const info = await createBackup({ dbPath: process.env.LEJ_DB_PATH, outDir: tmpOut, keep: 5 });
      const name = path.basename(info.file);
      assert.ok(name.startsWith("db-"), `nome inesperado: ${name}`);
      assert.ok(name.endsWith(".gz"), `extensao inesperada: ${name}`);
      assert.ok(fs.existsSync(info.file), "arquivo de backup deve existir");
      assert.ok(info.bytes > 0, "backup deve ter conteudo");
    } finally {
      if (fs.existsSync(tmpOut)) {
        fs.rmSync(tmpOut, { recursive: true, force: true });
      }
    }
  });

  test("check-production identifica ambiente nao preparado", async () => {
    const { runProductionChecks } = require("../scripts/check-production.js");
    const report = await runProductionChecks({
      dbPath: process.env.LEJ_DB_PATH,
      checkUrl: server.baseUrl
    });

    assert.ok(Array.isArray(report.checks));
    const named = (name) => report.checks.find((check) => check.name === name);

    assert.ok(named("banco_existe").ok);
    assert.ok(named("banco_colecoes").ok);
    assert.ok(named("backup_configurado").ok);
    assert.ok(named("http_health").ok, "health HTTP deve estar ok");
    assert.ok(named("http_bootstrap").ok);
    // No ambiente de teste, NODE_ENV nao e production: a checagem de
    // variaveis de ambiente deve sinalizar isso (nunca 'ok').
    assert.equal(named("variaveis_ambiente").ok, false);
  });
});