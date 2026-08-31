const { describe, test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const http = require("http");

const { setupTestEnv, loadDatabase, startServer, createClient, cleanupTestDb } = require("./helpers.js");

setupTestEnv();

describe("Testes de integracao - Fase 16", () => {
  let baseUrl;
  let client;
  let serverHandle;

  before(async () => {
    const env = await startServer();
    baseUrl = env.baseUrl;
    client = createClient(baseUrl);
    serverHandle = env;
  });

  after(async () => {
    if (serverHandle && typeof serverHandle.close === "function") {
      await serverHandle.close();
    }
    cleanupTestDb();
  });

  test("health check retorna status ok", async () => {
    const res = await client.req("GET", "/api/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "ok");
  });

  test("bootstrap retorna dados publicos e usuario anonimo", async () => {
    const res = await client.req("GET", "/api/bootstrap");
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.championships));
    assert.ok(Array.isArray(res.body.teams));
    assert.equal(res.body.user, null);
  });

  describe("Autenticacao", () => {
    test("login retorna cookie e dados do usuario", async () => {
      const res = await client.req("POST", "/api/login", {
        email: "admin@lagoaemjogo.local",
        password: "admin123"
      });
      assert.equal(res.status, 200);
      assert.ok(res.cookie.includes("lej_session="));
      assert.equal(res.body.user.email, "admin@lagoaemjogo.local");
    });

    test("login com credenciais invalidas retorna 401", async () => {
      const res = await client.req("POST", "/api/login", {
        email: "admin@lagoaemjogo.local",
        password: "errada"
      });
      assert.equal(res.status, 401);
      assert.ok(res.body.message.length > 0);
    });

    test("registro cria usuario e faz login automatico", async () => {
      const res = await client.req("POST", "/api/register", {
        name: "Teste Integracao",
        email: "teste.integracao@lagoaemjogo.local",
        password: "teste123",
        role: "usuario"
      });
      assert.equal(res.status, 201);
      assert.ok(res.cookie.includes("lej_session="));
      assert.equal(res.body.user.email, "teste.integracao@lagoaemjogo.local");
    });

    test("registro aceita foto de perfil e a retorna no perfil publico", async () => {
      const res = await client.req("POST", "/api/register", {
        name: "Usuario Foto",
        email: "usuario.foto@lagoaemjogo.local",
        password: "foto123",
        role: "usuario",
        photoUrl: "https://cdn.example.com/avatar.png"
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.user.photoUrl, "https://cdn.example.com/avatar.png");
    });

    test("perfil pode atualizar nome, comunidade e foto do usuario", async () => {
      const loginRes = await client.req("POST", "/api/login", {
        email: "admin@lagoaemjogo.local",
        password: "admin123"
      });
      const profileRes = await client.req("PUT", "/api/me", {
        name: "Admin Atualizado",
        email: "admin@lagoaemjogo.local",
        community: "Centro",
        phone: "88999990000",
        photoUrl: "https://cdn.example.com/admin-avatar.png"
      }, loginRes.cookie);
      assert.equal(profileRes.status, 200);
      assert.equal(profileRes.body.user.name, "Admin Atualizado");
      assert.equal(profileRes.body.user.photoUrl, "https://cdn.example.com/admin-avatar.png");
      assert.equal(profileRes.body.user.community, "Centro");
    });

    test("logout remove sessao", async () => {
      const loginRes = await client.req("POST", "/api/login", {
        email: "admin@lagoaemjogo.local",
        password: "admin123"
      });
      const logoutRes = await client.req("POST", "/api/logout", undefined, loginRes.cookie);
      assert.equal(logoutRes.status, 200);
      assert.ok(logoutRes.body.message.length > 0);
    });

    test("usuario bloqueado nao consegue logar", async () => {
      const blockedClient = createClient(baseUrl);
      const res = await blockedClient.req("POST", "/api/login", {
        email: "ana@lagoaemjogo.local",
        password: "ana123"
      });
      assert.equal(res.status, 403);
      assert.ok(res.body.message.includes("bloqueado"));
    });
  });

  describe("Permissoes", () => {
    let adminClient;
    let userClient;

    before(async () => {
      adminClient = createClient(baseUrl);
      const adminLogin = await adminClient.req("POST", "/api/login", {
        email: "admin@lagoaemjogo.local",
        password: "admin123"
      });
      adminClient.cookie = adminLogin.cookie;

      userClient = createClient(baseUrl);
      const userLogin = await userClient.req("POST", "/api/login", {
        email: "maria@lagoaemjogo.local",
        password: "maria123"
      });
      userClient.cookie = userLogin.cookie;
    });

    test("admin acessa dashboard", async () => {
      const res = await adminClient.req("GET", "/api/admin/dashboard");
      assert.equal(res.status, 200);
      assert.ok("totals" in res.body);
    });

    test("usuario nao admin recebe 403 no dashboard", async () => {
      const res = await userClient.req("GET", "/api/admin/dashboard");
      assert.equal(res.status, 403);
    });

    test("anonimo recebe 401 no dashboard", async () => {
      const anonClient = createClient(baseUrl);
      const res = await anonClient.req("GET", "/api/admin/dashboard");
      assert.equal(res.status, 401);
    });
  });

  describe("CRUD de campeonatos", () => {
    let adminClient;

    before(async () => {
      adminClient = createClient(baseUrl);
      const login = await adminClient.req("POST", "/api/login", {
        email: "admin@lagoaemjogo.local",
        password: "admin123"
      });
      adminClient.cookie = login.cookie;
    });

    test("cria campeonato valido", async () => {
      const res = await adminClient.req("POST", "/api/admin/championships", {
        name: "Copa Integracao",
        season: "2026",
        status: "inscricoes"
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.championship.name, "Copa Integracao");
    });

    test("lista campeonatos publicos", async () => {
      const res = await adminClient.req("GET", "/api/championships");
      assert.equal(res.status, 200);
      assert.ok(res.body.championships.some((c) => c.name === "Copa Integracao"));
    });
  });

  describe("CRUD de times", () => {
    let adminClient;
    let championshipId;

    before(async () => {
      adminClient = createClient(baseUrl);
      const login = await adminClient.req("POST", "/api/login", {
        email: "admin@lagoaemjogo.local",
        password: "admin123"
      });
      adminClient.cookie = login.cookie;
      const champs = await adminClient.req("GET", "/api/admin/championships");
      championshipId = champs.body.championships[0].id;
    });

    test("cria time valido", async () => {
      const res = await adminClient.req("POST", "/api/admin/teams", {
        name: "Time Teste",
        championshipId,
        community: "Centro"
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.team.name, "Time Teste");
    });
  });

  describe("CRUD de partidas", () => {
    let adminClient;
    let teamId;
    let teamId2;

    before(async () => {
      adminClient = createClient(baseUrl);
      const login = await adminClient.req("POST", "/api/login", {
        email: "admin@lagoaemjogo.local",
        password: "admin123"
      });
      adminClient.cookie = login.cookie;
      const teams = await adminClient.req("GET", "/api/admin/teams");
      teamId = teams.body.teams[0].id;
      teamId2 = teams.body.teams[1].id;
    });

    test("cria partida valida", async () => {
      const res = await adminClient.req("POST", "/api/admin/matches", {
        championshipId: 1,
        homeTeamId: teamId,
        awayTeamId: teamId2,
        stage: "Final",
        round: "Rodada unica",
        date: "2026-09-20",
        time: "16:00",
        field: "Campo central",
        location: "Centro",
        status: "agendado"
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.match.stage, "Final");
    });
  });

  describe("Comentarios e moderacao", () => {
    let adminClient;
    let authorClient;

    before(async () => {
      adminClient = createClient(baseUrl);
      const adminLogin = await adminClient.req("POST", "/api/login", {
        email: "admin@lagoaemjogo.local",
        password: "admin123"
      });
      adminClient.cookie = adminLogin.cookie;

      authorClient = createClient(baseUrl);
      const authorLogin = await authorClient.req("POST", "/api/login", {
        email: "pedro@lagoaemjogo.local",
        password: "pedro123"
      });
      authorClient.cookie = authorLogin.cookie;
    });

    test("comentario em noticia fica pendente", async () => {
      const newsRes = await adminClient.req("GET", "/api/news");
      const newsId = newsRes.body.news[0].id;
      const res = await authorClient.req("POST", `/api/news/${newsId}/comments`, {
        authorName: "Pedro",
        content: "Comentario de teste para integracao."
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.comment.status, "pendente");
    });

    test("admin modera comentario para aprovado", async () => {
      const commentsRes = await adminClient.req("GET", "/api/admin/comments");
      const commentId = commentsRes.body.comments[commentsRes.body.comments.length - 1].id;
      const res = await adminClient.req("PATCH", `/api/admin/comments/${commentId}`, {
        status: "aprovado"
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.comment.status, "aprovado");
    });
  });

  describe("Favoritos", () => {
    let userClient;

    before(async () => {
      userClient = createClient(baseUrl);
      const login = await userClient.req("POST", "/api/login", {
        email: "pedro@lagoaemjogo.local",
        password: "pedro123"
      });
      userClient.cookie = login.cookie;
    });

    test("adiciona e remove time dos favoritos", async () => {
      const teams = await userClient.req("GET", "/api/teams");
      const teamId = teams.body.teams[0].id;

      const add = await userClient.req("POST", "/api/favorites", {
        type: "time",
        itemId: teamId
      });
      assert.equal(add.status, 201);

      const list = await userClient.req("GET", "/api/favorites");
      assert.ok(list.body.favorites.some((f) => f.type === "time" && f.itemId === teamId));

      const favId = list.body.favorites.find((f) => f.type === "time" && f.itemId === teamId).id;
      const remove = await userClient.req("DELETE", `/api/favorites/time/${teamId}`);
      assert.equal(remove.status, 200);
    });
  });

  describe("Palpites", () => {
    let userClient;

    before(async () => {
      userClient = createClient(baseUrl);
      const login = await userClient.req("POST", "/api/login", {
        email: "pedro@lagoaemjogo.local",
        password: "pedro123"
      });
      userClient.cookie = login.cookie;
    });

    test("registra palpite para partida agendada", async () => {
      const matches = await userClient.req("GET", "/api/matches");
      const scheduled = matches.body.matches.find((m) => m.status === "agendado");
      assert.ok(scheduled, "deve existir partida agendada");

      const res = await userClient.req("POST", "/api/predictions", {
        matchId: scheduled.id,
        homeScore: 2,
        awayScore: 1
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.prediction.ownPrediction.homeScore, 2);
    });
  });

  describe("Pesquisa", () => {
    test("pesquisa retorna resultados por termo", async () => {
      const anon = createClient(baseUrl);
      const res = await anon.req("GET", "/api/search?q=rural&limit=5");
      assert.equal(res.status, 200);
      assert.ok(res.body.total >= 1);
    });

    test("pesquisa vazia retorna 400", async () => {
      const anon = createClient(baseUrl);
      const res = await anon.req("GET", "/api/search?q=");
      assert.equal(res.status, 400);
    });
  });
});
