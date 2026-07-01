const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");

const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = path.join(__dirname, "..");
const FRONTEND_DIR = path.join(ROOT_DIR, "frontend");
const DB_PATH = path.join(__dirname, "database", "db.json");

const sessions = new Map();
const USER_ROLES = ["usuario", "organizador", "fotografo", "administrador"];

function readDatabase() {
  const raw = fs.readFileSync(DB_PATH, "utf8");
  return JSON.parse(raw);
}

function writeDatabase(database) {
  fs.writeFileSync(DB_PATH, `${JSON.stringify(database, null, 2)}\n`);
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
    role: user.role,
    phone: user.phone || "",
    community: user.community || "",
    createdAt: user.createdAt || null
  };
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeText(value) {
  return String(value || "").trim();
}

function findUserById(database, userId) {
  return database.users.find((user) => user.id === userId) || null;
}

function updateSessionUser(user) {
  for (const [token, sessionUser] of sessions.entries()) {
    if (sessionUser.id === user.id) {
      sessions.set(token, user);
    }
  }
}

function isValidRole(role) {
  return USER_ROLES.includes(role);
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
      roles: database.roles,
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

  if (request.method === "POST" && request.url === "/api/register") {
    try {
      const body = await parseBody(request);
      const name = normalizeText(body.name);
      const email = normalizeEmail(body.email);
      const password = String(body.password || "");
      const requestedRole = normalizeText(body.role || "usuario");
      const role = requestedRole === "administrador" ? "usuario" : requestedRole;

      if (name.length < 3) {
        sendJson(response, 400, { message: "Informe um nome com pelo menos 3 caracteres." });
        return;
      }

      if (!email.includes("@")) {
        sendJson(response, 400, { message: "Informe um email valido." });
        return;
      }

      if (password.length < 6) {
        sendJson(response, 400, { message: "A senha deve ter pelo menos 6 caracteres." });
        return;
      }

      if (!isValidRole(role)) {
        sendJson(response, 400, { message: "Perfil de usuario invalido." });
        return;
      }

      const alreadyExists = database.users.some((user) => user.email === email);

      if (alreadyExists) {
        sendJson(response, 409, { message: "Ja existe uma conta com esse email." });
        return;
      }

      const user = {
        id: database.users.reduce((highest, item) => Math.max(highest, item.id), 0) + 1,
        name,
        email,
        password,
        role,
        phone: normalizeText(body.phone),
        community: normalizeText(body.community),
        createdAt: new Date().toISOString()
      };

      database.users.push(user);
      writeDatabase(database);

      const token = crypto.randomBytes(24).toString("hex");
      sessions.set(token, user);

      response.writeHead(201, {
        "Content-Type": "application/json; charset=utf-8",
        "Set-Cookie": `lej_session=${token}; HttpOnly; Path=/; SameSite=Lax`
      });
      response.end(JSON.stringify({ user: getPublicUser(user) }));
    } catch (error) {
      sendJson(response, 400, { message: "Nao foi possivel criar a conta." });
    }

    return;
  }

  if (request.method === "POST" && request.url === "/api/login") {
    try {
      const body = await parseBody(request);
      const email = normalizeEmail(body.email);
      const user = database.users.find((item) => {
        return item.email === email && item.password === body.password;
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

  if (request.method === "PUT" && request.url === "/api/me") {
    const sessionUser = getSessionUser(request);

    if (!sessionUser) {
      sendJson(response, 401, { message: "Entre na conta para editar o perfil." });
      return;
    }

    try {
      const body = await parseBody(request);
      const user = findUserById(database, sessionUser.id);

      if (!user) {
        sendJson(response, 404, { message: "Usuario nao encontrado." });
        return;
      }

      const name = normalizeText(body.name);
      const email = normalizeEmail(body.email);
      const password = String(body.password || "");

      if (name.length < 3) {
        sendJson(response, 400, { message: "Informe um nome com pelo menos 3 caracteres." });
        return;
      }

      if (!email.includes("@")) {
        sendJson(response, 400, { message: "Informe um email valido." });
        return;
      }

      const emailTaken = database.users.some((item) => item.id !== user.id && item.email === email);

      if (emailTaken) {
        sendJson(response, 409, { message: "Esse email ja esta em uso." });
        return;
      }

      if (password && password.length < 6) {
        sendJson(response, 400, { message: "A nova senha deve ter pelo menos 6 caracteres." });
        return;
      }

      user.name = name;
      user.email = email;
      user.phone = normalizeText(body.phone);
      user.community = normalizeText(body.community);

      if (password) {
        user.password = password;
      }

      writeDatabase(database);
      updateSessionUser(user);

      sendJson(response, 200, { user: getPublicUser(user) });
    } catch (error) {
      sendJson(response, 400, { message: "Nao foi possivel atualizar o perfil." });
    }

    return;
  }

  if (request.method === "POST" && request.url === "/api/password-reset") {
    try {
      const body = await parseBody(request);
      const email = normalizeEmail(body.email);
      const user = database.users.find((item) => item.email === email);

      if (user) {
        user.resetToken = crypto.randomBytes(12).toString("hex");
        user.resetRequestedAt = new Date().toISOString();
        writeDatabase(database);
      }

      sendJson(response, 200, {
        message: "Se o email existir, a instrucao de recuperacao sera registrada.",
        resetToken: user ? user.resetToken : null
      });
    } catch (error) {
      sendJson(response, 400, { message: "Nao foi possivel solicitar recuperacao." });
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
