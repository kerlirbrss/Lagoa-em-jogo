const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { setupTestEnv, startServer, createClient } = require("./helpers.js");

setupTestEnv();
let server;

before(async () => {
  server = await startServer();
});

after(async () => {
  await server.close();
});

async function loginAs(client, email, password) {
  return client.req("POST", "/api/login", { email, password });
}

describe("Testes de permissoes", () => {
  test("rota de dashboard exige login (401 sem sessao)", async () => {
    const client = createClient(server.baseUrl);
    const res = await client.req("GET", "/api/admin/dashboard");
    assert.equal(res.status, 401);
  });

  test("rota admin com usuario comum retorna 403", async () => {
    const client = createClient(server.baseUrl);
    await loginAs(client, "pedro@lagoaemjogo.local", "pedro123");
    const res = await client.req("GET", "/api/admin/dashboard");
    assert.equal(res.status, 403);
  });

  test("admin acessa dashboard", async () => {
    const client = createClient(server.baseUrl);
    await loginAs(client, "admin@lagoaemjogo.local", "admin123");
    const res = await client.req("GET", "/api/admin/dashboard");
    assert.equal(res.status, 200);
    assert.ok(res.body.totals);
  });

  test("orgador publica noticia", async () => {
    const client = createClient(server.baseUrl);
    await loginAs(client, "maria@lagoaemjogo.local", "maria123");
    const res = await client.req("POST", "/api/admin/news", {
      title: "Noticia de teste do organizador",
      category: "Testes",
      summary: "Resumo da noticia de teste",
      content: "Conteudo maior para validar a publicacao de noticia pelo organizador.",
      status: "rascunho"
    });
    assert.equal(res.status, 201);
  });

  test("usuario nao publica noticia (403)", async () => {
    const client = createClient(server.baseUrl);
    await loginAs(client, "pedro@lagoaemjogo.local", "pedro123");
    const res = await client.req("POST", "/api/admin/news", {
      title: "Noticia bloqueada para usuario",
      category: "Testes",
      summary: "Resumo que nao deve passar",
      content: "Conteudo que nao deve ser criado pelo usuario de perfil comum.",
      status: "rascunho"
    });
    assert.equal(res.status, 403);
  });

  test("fotografo nao publica noticia (403)", async () => {
    const client = createClient(server.baseUrl);
    await loginAs(client, "joao.foto@lagoaemjogo.local", "joao123");
    const res = await client.req("POST", "/api/admin/news", {
      title: "Noticia bloqueada para fotografo",
      category: "Testes",
      summary: "Resumo que nao deve passar",
      content: "Conteudo que nao deve ser criado por fotografo.",
      status: "rascunho"
    });
    assert.equal(res.status, 403);
  });

  test("fotografo publica galeria", async () => {
    const client = createClient(server.baseUrl);
    await loginAs(client, "joao.foto@lagoaemjogo.local", "joao123");
    const res = await client.req("POST", "/api/admin/galleries", {
      title: "Galeria de teste do fotografo",
      type: "evento",
      eventName: "Campeonato Teste",
      description: "Registros do evento.",
      images: ["https://imagens.exemplo.com/foto.jpg"],
      status: "rascunho"
    });
    assert.equal(res.status, 201);
  });

  test("organizador nao publica galeria (403)", async () => {
    const client = createClient(server.baseUrl);
    await loginAs(client, "maria@lagoaemjogo.local", "maria123");
    const res = await client.req("POST", "/api/admin/galleries", {
      title: "Galeria bloqueada para organizador",
      type: "evento",
      eventName: "Campeonato Teste",
      images: ["https://imagens.exemplo.com/foto.jpg"]
    });
    assert.equal(res.status, 403);
  });

  test("favoritos exigem autenticacao (401)", async () => {
    const client = createClient(server.baseUrl);
    const res = await client.req("POST", "/api/favorites", { type: "time", itemId: 1 });
    assert.equal(res.status, 401);
  });

  test("usuario autenticado pode favoritar", async () => {
    const client = createClient(server.baseUrl);
    await loginAs(client, "pedro@lagoaemjogo.local", "pedro123");
    const res = await client.req("POST", "/api/favorites", { type: "time", itemId: 2 });
    assert.ok([201, 409].includes(res.status));
  });

  test("palpites exigem autenticacao (401)", async () => {
    const client = createClient(server.baseUrl);
    const res = await client.req("POST", "/api/predictions", { matchId: 7, homeScore: 1, awayScore: 0 });
    assert.equal(res.status, 401);
  });

  test("usuario autenticado registra palpite em jogo agendado", async () => {
    const client = createClient(server.baseUrl);
    await loginAs(client, "pedro@lagoaemjogo.local", "pedro123");
    const res = await client.req("POST", "/api/predictions", { matchId: 7, homeScore: 2, awayScore: 1 });
    assert.ok([200, 201].includes(res.status));
  });

  test("moderacao de comentarios exige admin", async () => {
    const userClient = createClient(server.baseUrl);
    await loginAs(userClient, "pedro@lagoaemjogo.local", "pedro123");
    const denied = await userClient.req("GET", "/api/admin/comments");
    assert.equal(denied.status, 403);

    const adminClient = createClient(server.baseUrl);
    await loginAs(adminClient, "admin@lagoaemjogo.local", "admin123");
    const allowed = await adminClient.req("GET", "/api/admin/comments");
    assert.equal(allowed.status, 200);
  });

  test("admin gerencia usuarios", async () => {
    const client = createClient(server.baseUrl);
    await loginAs(client, "admin@lagoaemjogo.local", "admin123");
    const res = await client.req("GET", "/api/admin/users");
    assert.equal(res.status, 200);
    assert.ok(res.body.users.length >= 1);
  });
});