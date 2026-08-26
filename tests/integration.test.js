const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { setupTestEnv, startServer, request } = require("./helpers.js");

setupTestEnv();
let server;

before(async () => {
  server = await startServer();
});

after(async () => {
  await server.close();
});

describe("Testes de integracao - rotas publicas", () => {
  test("GET /api/health responde ok", async () => {
    const res = await request(server.baseUrl, "GET", "/api/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "ok");
  });

  test("GET /api/bootstrap retorna os dados base", async () => {
    const res = await request(server.baseUrl, "GET", "/api/bootstrap");
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.championships));
    assert.ok(Array.isArray(res.body.teams));
    assert.ok(Array.isArray(res.body.athletes));
    assert.ok(res.body.settings);
  });

  test("GET /api/championships retorna lista publica", async () => {
    const res = await request(server.baseUrl, "GET", "/api/championships");
    assert.equal(res.status, 200);
    assert.ok(res.body.championships.length >= 2);
    assert.equal("password" in res.body.championships[0], false);
  });

  test("GET /api/teams retorna times com stats", async () => {
    const res = await request(server.baseUrl, "GET", "/api/teams");
    assert.equal(res.status, 200);
    assert.ok(res.body.teams.length >= 4);
    assert.ok(res.body.teams[0].stats);
  });

  test("GET /api/athletes retorna atletas", async () => {
    const res = await request(server.baseUrl, "GET", "/api/athletes");
    assert.equal(res.status, 200);
    assert.ok(res.body.athletes.length >= 1);
    assert.ok(res.body.athletes[0].fullName);
  });

  test("GET /api/matches retorna jogos", async () => {
    const res = await request(server.baseUrl, "GET", "/api/matches");
    assert.equal(res.status, 200);
    assert.ok(res.body.matches.length >= 2);
    assert.ok(res.body.matches[0].homeTeamName);
  });

  test("GET /api/news retorna apenas publicadas", async () => {
    const res = await request(server.baseUrl, "GET", "/api/news");
    assert.equal(res.status, 200);
    res.body.news.forEach((article) => {
      assert.equal(article.status, "publicado");
    });
  });

  test("GET /api/galleries retorna galerias publicadas", async () => {
    const res = await request(server.baseUrl, "GET", "/api/galleries");
    assert.equal(res.status, 200);
    res.body.galleries.forEach((gallery) => {
      assert.equal(gallery.status, "publicado");
    });
  });

  test("GET /api/statistics retorna classificacao", async () => {
    const res = await request(server.baseUrl, "GET", "/api/statistics?championshipId=1");
    assert.equal(res.status, 200);
    assert.ok(res.body.statistics.standings.length >= 4);
    assert.ok(res.body.statistics.topScorers);
  });

  test("GET /api/home retorna destinos da pagina inicial", async () => {
    const res = await request(server.baseUrl, "GET", "/api/home");
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.home.upcomingMatches));
    assert.ok(Array.isArray(res.body.home.recentResults));
    assert.equal(res.body.home.standings.championshipName, "Campeonato Rural");
  });

  test("GET /api/search encontra conteudos por termo", async () => {
    const res = await request(server.baseUrl, "GET", "/api/search?q=rural");
    assert.equal(res.status, 200);
    assert.ok(res.body.total >= 1);
  });

  test("GET /api/search sem termo retorna 400", async () => {
    const res = await request(server.baseUrl, "GET", "/api/search");
    assert.equal(res.status, 400);
  });

  test("GET /api/predictions retorna partidas agendadas", async () => {
    const res = await request(server.baseUrl, "GET", "/api/predictions");
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.predictions));
  });

  test("rota inexistente retorna 404", async () => {
    const res = await request(server.baseUrl, "GET", "/api/nao-existe");
    assert.equal(res.status, 404);
  });
});