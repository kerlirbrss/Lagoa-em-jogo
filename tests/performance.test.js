const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { performance } = require("node:perf_hooks");
const { setupTestEnv, startServer, request } = require("./helpers.js");

const MAX_RESPONSE_TIME_MS = 1500;

setupTestEnv();
let server;

before(async () => {
  server = await startServer();
});

after(async () => {
  await server.close();
});

describe("Testes de performance", () => {
  test("rotas principais respondem dentro do limite de tempo", async () => {
    const rotas = [
      "/api/health",
      "/api/bootstrap",
      "/api/home",
      "/api/championships",
      "/api/teams",
      "/api/statistics?championshipId=1",
      "/api/search?q=rural"
    ];

    for (const rota of rotas) {
      const start = performance.now();
      const res = await request(server.baseUrl, "GET", rota);
      const elapsed = performance.now() - start;

      assert.equal(res.status, 200, `Rota ${rota} deveria responder 200`);
      assert.ok(
        elapsed < MAX_RESPONSE_MS,
        `Rota ${rota} levou ${Math.round(elapsed)}ms (limite ${MAX_RESPONSE_MS}ms)`
      );
    }
  });

  test("pagina inicial responde em tempo aceitavel em repeticoes", async () => {
    for (let i = 0; i < 5; i += 1) {
      const start = performance.now();
      const res = await request(server.baseUrl, "GET", "/api/home");
      const elapsed = performance.now() - start;
      assert.equal(res.status, 200);
      assert.ok(elapsed < MAX_RESPONSE_MS, `Iteracao ${i} demorou ${Math.round(elapsed)}ms`);
    }
  });

  test("respostas publicas sao JSON bem-formadas", async () => {
    const res = await request(server.baseUrl, "GET", "/api/home");
    assert.ok(res.body && typeof res.body === "object");
    assert.ok(Array.isArray(res.body.home.upcomingMatches));
  });
});