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

describe("Testes de autenticacao", () => {
  test("login do administrador retorna perfil admin", async () => {
    const client = createClient(server.baseUrl);
    const res = await client.req("POST", "/api/login", { email: "admin@lagoaemjogo.local", password: "admin123" });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.role, "administrador");
    assert.ok(client.cookie.includes("lej_session="));
  });

  test("login com senha invalida retorna 401", async () => {
    const client = createClient(server.baseUrl);
    const res = await client.req("POST", "/api/login", { email: "admin@requeridolocal.local", password: "errada" });
    assert.equal(res.status, 401);
  });

  test("login com email inexistente retorna 401", async () => {
    const client = createClient(server.baseUrl);
    const res = await client.req("POST", "/api/login", { email: "naoexiste@qualquer.local", password: "qualquer" });
    assert.equal(res.status, 401);
  });

  test("usuario bloqueado nao consegue logar", async () => {
    const client = createClient(server.baseUrl);
    const res = await client.req("POST", "/api/login", { email: "ana@lagoaemjogo.local", password: "ana123" });
    assert.equal(res.status, 403);
  });

  test("register cria nova conta", async () => {
    const client = createClient(server.baseUrl);
    const res = await client.req("POST", "/api/register", { name: "Tester Novo", email: "novo@teste.local", password: "senha123", role: "usuario" });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, "usuario");
    assert.ok(client.cookie.includes("lej_session="));
  });

  test("register com email duplicado retorna 409", async () => {
    const client = createClient(server.baseUrl);
    const res = await client.req("POST", "/api/register", { name: "Duplicado", email: "admin@lagoaemjogo.local", password: "senha123" });
    assert.equal(res.status, 409);
  });

  test("register com senha curta retorna 400", async () => {
    const client = createClient(server.baseUrl);
    const res = await client.req("POST", "/api/register", { name: "Curto", email: "curto@teste.local", password: "123" });
    assert.equal(res.status, 400);
  });

  test("register nao pode auto-promover para administrador", async () => {
    const client = createClient(server.baseUrl);
    const res = await client.req("POST", "/api/register", { name: "Fake Admin", email: "fake@teste.local", password: "senha123", role: "administrador" });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, "usuario");
  });

  test("GET /api/me sem sessao retorna user null", async () => {
    const client = createClient(server.baseUrl);
    const res = await client.req("GET", "/api/me");
    assert.equal(res.status, 200);
    assert.equal(res.body.user, null);
  });

  test("GET /api/me com sessao retorna o usuario", async () => {
    const client = createClient(server.baseUrl);
    await client.req("POST", "/api/login", { email: "admin@lagoaemjogo.local", password: "admin123" });
    const res = await client.req("GET", "/api/me");
    assert.equal(res.status, 200);
    assert.equal(res.body.user.role, "administrador");
  });

  test("logout encerra a sessao", async () => {
    const client = createClient(server.baseUrl);
    await client.req("POST", "/api/login", { email: "admin@lagoaemjogo.local", password: "admin123" });
    const logout = await client.req("POST", "/api/logout");
    assert.equal(logout.status, 200);
    const me = await client.req("GET", "/api/me");
    assert.equal(me.body.user, null);
  });

  test("PUT /api/me atualiza o nome do perfil", async () => {
    const client = createClient(server.baseUrl);
    await client.req("POST", "/api/login", { email: "admin@lagoaemjogo.local", password: "admin123" });
    const res = await client.req("PUT", "/api/me", { name: "Administrador Editado", email: "admin@lagoaemjogo.local" });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.name, "Administrador Editado");
  });

  test("password-reset retorna token para email existente", async () => {
    const client = createClient(server.baseUrl);
    const res = await client.req("POST", "/api/password-reset", { email: "admin@lagoaemjogo.local" });
    assert.equal(res.status, 200);
    assert.ok(res.body.resetToken);
  });

  test("password-reset nao expoe token para email inexistente", async () => {
    const client = createClient(server.baseUrl);
    const res = await client.req("POST", "/api/password-reset", { email: "inexistente@qualquer.local" });
    assert.equal(res.status, 200);
    assert.equal(res.body.resetToken, null);
  });
});