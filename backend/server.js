const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");

const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = path.join(__dirname, "..");
const FRONTEND_DIR = path.join(ROOT_DIR, "frontend");
const DB_PATH = path.join(__dirname, "database", "db.json");

const sessions = new Map();

function readDatabase() {
  const raw = fs.readFileSync(DB_PATH, "utf8");
  return JSON.parse(raw);
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
}

function parseBody(request) {
  return new Promise((resolve, reject) => {
    let data = "";

    request.on("data", (chunk) => {
      data += chunk;

      if (data.length > 1_000_000) {
        reject(new Error("Payload muito grande."));
        request.destroy();
      }
    });

    request.on("end", () => {
      if (!data) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function getSessionUser(request) {
  const cookie = request.headers.cookie || "";
  const sessionCookie = cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("lej_session="));

  if (!sessionCookie) {
    return null;
  }

  const token = sessionCookie.split("=")[1];
  return sessions.get(token) || null;
}

function getPublicUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
}

async function handleApi(request, response) {
  const database = readDatabase();

  if (request.method === "GET" && request.url === "/api/health") {
    sendJson(response, 200, {
      status: "ok",
      app: database.settings.appName,
      environment: "development"
    });
    return;
  }

  if (request.method === "GET" && request.url === "/api/bootstrap") {
    sendJson(response, 200, {
      settings: database.settings,
      championships: database.championships,
      featuredMatches: database.featuredMatches,
      user: getPublicUser(getSessionUser(request))
    });
    return;
  }

  if (request.method === "GET" && request.url === "/api/me") {
    sendJson(response, 200, {
      user: getPublicUser(getSessionUser(request))
    });
    return;
  }

  if (request.method === "POST" && request.url === "/api/login") {
    try {
      const body = await parseBody(request);
      const user = database.users.find((item) => {
        return item.email === body.email && item.password === body.password;
      });

      if (!user) {
        sendJson(response, 401, { message: "Email ou senha invalidos." });
        return;
      }

      const token = crypto.randomBytes(24).toString("hex");
      sessions.set(token, user);

      response.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Set-Cookie": `lej_session=${token}; HttpOnly; Path=/; SameSite=Lax`
      });
      response.end(JSON.stringify({ user: getPublicUser(user) }));
    } catch (error) {
      sendJson(response, 400, { message: "Requisicao invalida." });
    }

    return;
  }

  if (request.method === "POST" && request.url === "/api/logout") {
    const cookie = request.headers.cookie || "";
    const sessionCookie = cookie
      .split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith("lej_session="));

    if (sessionCookie) {
      sessions.delete(sessionCookie.split("=")[1]);
    }

    response.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Set-Cookie": "lej_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax"
    });
    response.end(JSON.stringify({ message: "Sessao encerrada." }));
    return;
  }

  sendJson(response, 404, { message: "Rota nao encontrada." });
}

function getContentType(filePath) {
  const extension = path.extname(filePath);

  const types = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml"
  };

  return types[extension] || "application/octet-stream";
}

function serveStatic(request, response) {
  const requestPath = decodeURIComponent(request.url.split("?")[0]);
  const safePath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.normalize(path.join(FRONTEND_DIR, safePath));

  if (!filePath.startsWith(FRONTEND_DIR)) {
    response.writeHead(403);
    response.end("Acesso negado.");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      fs.readFile(path.join(FRONTEND_DIR, "index.html"), (fallbackError, fallbackContent) => {
        if (fallbackError) {
          response.writeHead(404);
          response.end("Arquivo nao encontrado.");
          return;
        }

        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        response.end(fallbackContent);
      });
      return;
    }

    response.writeHead(200, { "Content-Type": getContentType(filePath) });
    response.end(content);
  });
}

const server = http.createServer((request, response) => {
  if (request.url.startsWith("/api/")) {
    handleApi(request, response);
    return;
  }

  serveStatic(request, response);
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Lagoa em Jogo rodando em http://localhost:${PORT}`);
  });
}

module.exports = server;
