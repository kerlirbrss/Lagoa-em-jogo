/* ============================================================
   Fase 17 - Deploy: Monitoramento da aplicacao
   ------------------------------------------------------------
   Chama o endpoint /api/health e valida se a aplicacao esta no
   ar. Exit code 0 = saudavel, 1 = falha (usado por cron e
   healthchecks do Docker).

   Configuracao:
   - argumento opcional com a URL (ex.: node scripts/monitor.js https://lagoaemjogo.com.br)
   - LEJ_MONITOR_URL            URL base (padrao http://localhost:3000)
   - LEJ_MONITOR_TIMEOUT_MS     limite de espera em ms (padrao 5000)
   - LEJ_MONITOR_INTERVAL_MS    se maior que 0, executa em loop
   ============================================================ */
const http = require("http");
const https = require("https");

/** Consulta /api/health e resolve com resumo da checagem. */
function checkHealth(url) {
  return new Promise((resolve, reject) => {
    let target;
    try {
      target = new URL(url);
    } catch (error) {
      reject(new Error(`URL invalida: ${url}`));
      return;
    }

    const isHttps = target.protocol === "https:";
    const transport = isHttps ? https : http;
    const startedAt = Date.now();
    const timeoutMs = Number(process.env.LEJ_MONITOR_TIMEOUT_MS || 5000);

    const request = transport.get(
      {
        hostname: target.hostname,
        port: target.port || (isHttps ? 443 : 80),
        path: "/api/health",
        timeout: timeoutMs,
        headers: { "User-Agent": "lagoa-em-jogo-monitor/1.0" }
      },
      (response) => {
        let data = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          data += chunk;
        });
        response.on("end", () => {
          let payload = null;
          try {
            payload = JSON.parse(data);
          } catch (error) {
            payload = null;
          }
          resolve({
            ok: response.statusCode === 200 && !!payload && payload.status === "ok",
            statusCode: response.statusCode,
            durationMs: Date.now() - startedAt,
            payload
          });
        });
      }
    );

    request.on("timeout", () => {
      request.destroy(new Error("Timeout na requisicao de health check."));
    });
    request.on("error", (error) => reject(error));
  });
}

/** Executa uma checagem e imprime um resumo estruturado. */
async function runMonitor(url) {
  const baseUrl = url || process.env.LEJ_MONITOR_URL || "http://localhost:3000";
  const result = await checkHealth(baseUrl);

  const summary = {
    time: new Date().toISOString(),
    url: baseUrl,
    ok: result.ok,
    statusCode: result.statusCode,
    durationMs: result.durationMs,
    app: result.payload ? result.payload.app : null,
    version: result.payload ? result.payload.version : null,
    environment: result.payload ? result.payload.environment : null,
    uptimeSeconds: result.payload ? result.payload.uptimeSeconds : null
  };

  console.log(JSON.stringify(summary));
  return summary;
}

if (require.main === module) {
  const interval = Number(process.env.LEJ_MONITOR_INTERVAL_MS || 0);
  const url = process.argv[2] || process.env.LEJ_MONITOR_URL || "http://localhost:3000";

  const tick = () => {
    runMonitor(url)
      .then((summary) => {
        if (!summary.ok) {
          process.exit(1);
        }
        if (!interval) {
          process.exit(0);
        }
      })
      .catch((error) => {
        console.error(JSON.stringify({
          time: new Date().toISOString(),
          ok: false,
          url,
          error: error.message
        }));
        process.exit(1);
      });
  };

  if (interval > 0) {
    tick();
    setInterval(tick, interval);
  } else {
    tick();
  }
}

module.exports = { checkHealth, runMonitor };