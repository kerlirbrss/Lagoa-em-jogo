const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { setupTestEnv, startServer, cleanupTestDb } = require("./helpers.js");

setupTestEnv();

describe("Fase 24 - homologacao e publicacao final", () => {
  test("script de homologacao expõe relatorio final com checklist principal", async () => {
    const { runReleaseChecklist } = require("../scripts/homologation.js");
    const server = await startServer();

    try {
      const report = await runReleaseChecklist({
        baseUrl: server.baseUrl,
        dbPath: process.env.LEJ_DB_PATH
      });

      assert.equal(report.ok, true);
      assert.ok(Array.isArray(report.checks));
      assert.ok(report.checks.some((check) => check.name === "health_check"));
      assert.ok(report.checks.some((check) => check.name === "backup"));
      assert.ok(report.checks.some((check) => check.name === "homologacao"));
    } finally {
      await server.close();
      cleanupTestDb();
    }
  });
});
