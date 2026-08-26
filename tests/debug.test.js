const { describe, test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { setupTestEnv, startServer, createClient, cleanupTestDb } = require("./helpers.js");

setupTestEnv();

describe("Debug Palpites", () => {
  let baseUrl;
  let client;

  before(async () => {
    const env = await startServer();
    baseUrl = env.baseUrl;
    client = createClient(baseUrl);
  });

  after(async () => {
    await client.close();
    cleanupTestDb();
  });

  test("debug prediction", async () => {
    const login = await client.req("POST", "/api/login", {
      email: "pedro@lagoaemjogo.local",
      password: "pedro123"
    });
    console.log("login status", login.status);
    console.log("login cookie", login.cookie);

    const matches = await client.req("GET", "/api/matches");
    console.log("matches count", matches.body.matches.length);
    const scheduled = matches.body.matches.find((m) => m.status === "agendado");
    console.log("scheduled match id", scheduled ? scheduled.id : null);

    const res = await client.req("POST", "/api/predictions", {
      matchId: scheduled.id,
      homeScore: 2,
      awayScore: 1
    });
    console.log("prediction status", res.status);
    console.log("prediction body keys", Object.keys(res.body));
    console.log("prediction body", JSON.stringify(res.body, null, 2));

    assert.equal(res.status, 200);
    assert.ok(res.body.prediction);
    assert.equal(res.body.prediction.homeScore, 2);
  });
});
