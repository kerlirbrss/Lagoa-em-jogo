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
const COMMENT_STATUSES = ["pendente", "aprovado", "rejeitado"];
const CHAMPIONSHIP_STATUSES = ["rascunho", "inscricoes", "em_andamento", "encerrado"];

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
    status: user.status || "ativo",
    phone: user.phone || "",
    community: user.community || "",
    createdAt: user.createdAt || null
  };
}

function getAdminUser(user) {
  return {
    ...getPublicUser(user),
    resetRequestedAt: user.resetRequestedAt || null
  };
}

function getPublicChampionship(championship) {
  return {
    id: championship.id,
    name: championship.name,
    season: championship.season,
    status: championship.status,
    startDate: championship.startDate || "",
    endDate: championship.endDate || "",
    description: championship.description || "",
    regulation: championship.regulation || "",
    awards: championship.awards || "",
    createdAt: championship.createdAt || null,
    updatedAt: championship.updatedAt || null
  };
}

function getDefaultTeamStats(stats = {}) {
  return {
    matches: Number(stats.matches || 0),
    wins: Number(stats.wins || 0),
    draws: Number(stats.draws || 0),
    losses: Number(stats.losses || 0),
    goalsFor: Number(stats.goalsFor || 0),
    goalsAgainst: Number(stats.goalsAgainst || 0),
    points: Number(stats.points || 0)
  };
}

function getPublicTeam(team, database) {
  const championship = findChampionshipById(database, Number(team.championshipId));

  return {
    id: team.id,
    name: team.name,
    championshipId: Number(team.championshipId),
    championshipName: championship ? championship.name : "Campeonato nao encontrado",
    community: team.community,
    crestUrl: team.crestUrl || "",
    foundedYear: team.foundedYear || "",
    coach: team.coach || "",
    colors: team.colors || "",
    stats: getDefaultTeamStats(team.stats),
    squad: team.squad || "",
    upcomingMatches: team.upcomingMatches || "",
    recentResults: team.recentResults || "",
    gallery: team.gallery || "",
    createdAt: team.createdAt || null,
    updatedAt: team.updatedAt || null
  };
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeDate(value) {
  return String(value || "").trim();
}

function normalizeOptionalYear(value) {
  const year = normalizeText(value);

  if (!year) {
    return "";
  }

  return year;
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

function isAdmin(user) {
  return user && user.role === "administrador";
}

function requireAdmin(request, response) {
  const user = getSessionUser(request);

  if (!user) {
    sendJson(response, 401, { message: "Entre como administrador para acessar o painel." });
    return null;
  }

  if (!isAdmin(user)) {
    sendJson(response, 403, { message: "Acesso restrito a administradores." });
    return null;
  }

  return user;
}

function countUsersByRole(users, role) {
  return users.filter((user) => user.role === role).length;
}

function buildDashboard(database) {
  const pendingComments = database.comments.filter((comment) => {
    return comment.status === "pendente";
  }).length;

  return {
    totals: {
      users: database.users.length,
      organizers: countUsersByRole(database.users, "organizador"),
      photographers: countUsersByRole(database.users, "fotografo"),
      championships: database.championships.length,
      teams: database.teams.length,
      pendingComments
    },
    roleSummary: database.roles.map((role) => {
      return {
        id: role.id,
        name: role.name,
        users: role.id === "visitante" ? 0 : countUsersByRole(database.users, role.id)
      };
    }),
    recentUsers: database.users
      .slice()
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .slice(0, 5)
      .map(getAdminUser),
    pendingComments: database.comments
      .filter((comment) => comment.status === "pendente")
      .slice(0, 5)
  };
}

function findChampionshipById(database, championshipId) {
  return database.championships.find((championship) => championship.id === championshipId) || null;
}

function findTeamById(database, teamId) {
  return database.teams.find((team) => team.id === teamId) || null;
}

function validateChampionshipPayload(body, currentChampionship = {}) {
  const championship = {
    name: normalizeText(body.name ?? currentChampionship.name),
    season: normalizeText(body.season ?? currentChampionship.season),
    status: normalizeText(body.status ?? currentChampionship.status ?? "rascunho"),
    startDate: normalizeDate(body.startDate ?? currentChampionship.startDate),
    endDate: normalizeDate(body.endDate ?? currentChampionship.endDate),
    description: normalizeText(body.description ?? currentChampionship.description),
    regulation: normalizeText(body.regulation ?? currentChampionship.regulation),
    awards: normalizeText(body.awards ?? currentChampionship.awards)
  };

  if (championship.name.length < 3) {
    return { error: "Informe o nome do campeonato com pelo menos 3 caracteres." };
  }

  if (!championship.season) {
    return { error: "Informe a temporada do campeonato." };
  }

  if (!CHAMPIONSHIP_STATUSES.includes(championship.status)) {
    return { error: "Status de campeonato invalido." };
  }

  return { championship };
}

function validateTeamPayload(database, body, currentTeam = {}) {
  const championshipId = Number(body.championshipId ?? currentTeam.championshipId);
  const team = {
    name: normalizeText(body.name ?? currentTeam.name),
    championshipId,
    community: normalizeText(body.community ?? currentTeam.community),
    crestUrl: normalizeText(body.crestUrl ?? currentTeam.crestUrl),
    foundedYear: normalizeOptionalYear(body.foundedYear ?? currentTeam.foundedYear),
    coach: normalizeText(body.coach ?? currentTeam.coach),
    colors: normalizeText(body.colors ?? currentTeam.colors),
    stats: getDefaultTeamStats(body.stats ?? currentTeam.stats),
    squad: normalizeText(body.squad ?? currentTeam.squad),
    upcomingMatches: normalizeText(body.upcomingMatches ?? currentTeam.upcomingMatches),
    recentResults: normalizeText(body.recentResults ?? currentTeam.recentResults),
    gallery: normalizeText(body.gallery ?? currentTeam.gallery)
  };

  if (team.name.length < 3) {
    return { error: "Informe o nome do time com pelo menos 3 caracteres." };
  }

  if (!team.community) {
    return { error: "Informe a comunidade do time." };
  }

  if (!findChampionshipById(database, team.championshipId)) {
    return { error: "Campeonato do time nao encontrado." };
  }

  return { team };
}

async function handleApi(request, response) {
  const database = readDatabase();
  const url = new URL(request.url, "http://localhost");

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
      championships: database.championships.map(getPublicChampionship),
      teams: database.teams.map((team) => getPublicTeam(team, database)),
      featuredMatches: database.featuredMatches,
      user: getPublicUser(getSessionUser(request))
    });
    return;
  }

  if (request.method === "GET" && request.url === "/api/championships") {
    sendJson(response, 200, {
      championships: database.championships.map(getPublicChampionship)
    });
    return;
  }

  if (request.method === "GET" && request.url === "/api/teams") {
    sendJson(response, 200, {
      teams: database.teams.map((team) => getPublicTeam(team, database))
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
        status: "ativo",
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

      if (user.status === "bloqueado") {
        sendJson(response, 403, { message: "Usuario bloqueado pelo administrador." });
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

  if (request.method === "GET" && request.url === "/api/admin/dashboard") {
    if (!requireAdmin(request, response)) {
      return;
    }

    sendJson(response, 200, buildDashboard(database));
    return;
  }

  if (request.method === "GET" && request.url === "/api/admin/championships") {
    if (!requireAdmin(request, response)) {
      return;
    }

    sendJson(response, 200, {
      championships: database.championships.map(getPublicChampionship),
      statuses: CHAMPIONSHIP_STATUSES
    });
    return;
  }

  if (request.method === "POST" && request.url === "/api/admin/championships") {
    if (!requireAdmin(request, response)) {
      return;
    }

    try {
      const body = await parseBody(request);
      const validation = validateChampionshipPayload(body);

      if (validation.error) {
        sendJson(response, 400, { message: validation.error });
        return;
      }

      const championship = {
        id: database.championships.reduce((highest, item) => Math.max(highest, item.id), 0) + 1,
        ...validation.championship,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      database.championships.push(championship);
      writeDatabase(database);

      sendJson(response, 201, { championship: getPublicChampionship(championship) });
    } catch (error) {
      sendJson(response, 400, { message: "Nao foi possivel criar o campeonato." });
    }

    return;
  }

  if (["PUT", "DELETE"].includes(request.method) && url.pathname.startsWith("/api/admin/championships/")) {
    if (!requireAdmin(request, response)) {
      return;
    }

    const championshipId = Number(url.pathname.split("/").pop());
    const championship = findChampionshipById(database, championshipId);

    if (!championship) {
      sendJson(response, 404, { message: "Campeonato nao encontrado." });
      return;
    }

    if (request.method === "DELETE") {
      database.championships = database.championships.filter((item) => item.id !== championshipId);
      writeDatabase(database);
      sendJson(response, 200, { message: "Campeonato excluido." });
      return;
    }

    try {
      const body = await parseBody(request);
      const validation = validateChampionshipPayload(body, championship);

      if (validation.error) {
        sendJson(response, 400, { message: validation.error });
        return;
      }

      Object.assign(championship, validation.championship, {
        updatedAt: new Date().toISOString()
      });

      writeDatabase(database);
      sendJson(response, 200, { championship: getPublicChampionship(championship) });
    } catch (error) {
      sendJson(response, 400, { message: "Nao foi possivel atualizar o campeonato." });
    }

    return;
  }

  if (request.method === "GET" && request.url === "/api/admin/teams") {
    if (!requireAdmin(request, response)) {
      return;
    }

    sendJson(response, 200, {
      teams: database.teams.map((team) => getPublicTeam(team, database)),
      championships: database.championships.map(getPublicChampionship)
    });
    return;
  }

  if (request.method === "POST" && request.url === "/api/admin/teams") {
    if (!requireAdmin(request, response)) {
      return;
    }

    try {
      const body = await parseBody(request);
      const validation = validateTeamPayload(database, body);

      if (validation.error) {
        sendJson(response, 400, { message: validation.error });
        return;
      }

      const team = {
        id: database.teams.reduce((highest, item) => Math.max(highest, item.id), 0) + 1,
        ...validation.team,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      database.teams.push(team);
      writeDatabase(database);

      sendJson(response, 201, { team: getPublicTeam(team, database) });
    } catch (error) {
      sendJson(response, 400, { message: "Nao foi possivel criar o time." });
    }

    return;
  }

  if (["PUT", "DELETE"].includes(request.method) && url.pathname.startsWith("/api/admin/teams/")) {
    if (!requireAdmin(request, response)) {
      return;
    }

    const teamId = Number(url.pathname.split("/").pop());
    const team = findTeamById(database, teamId);

    if (!team) {
      sendJson(response, 404, { message: "Time nao encontrado." });
      return;
    }

    if (request.method === "DELETE") {
      database.teams = database.teams.filter((item) => item.id !== teamId);
      writeDatabase(database);
      sendJson(response, 200, { message: "Time excluido." });
      return;
    }

    try {
      const body = await parseBody(request);
      const validation = validateTeamPayload(database, body, team);

      if (validation.error) {
        sendJson(response, 400, { message: validation.error });
        return;
      }

      Object.assign(team, validation.team, {
        updatedAt: new Date().toISOString()
      });

      writeDatabase(database);
      sendJson(response, 200, { team: getPublicTeam(team, database) });
    } catch (error) {
      sendJson(response, 400, { message: "Nao foi possivel atualizar o time." });
    }

    return;
  }

  if (request.method === "GET" && request.url === "/api/admin/users") {
    if (!requireAdmin(request, response)) {
      return;
    }

    sendJson(response, 200, {
      users: database.users.map(getAdminUser),
      roles: database.roles.filter((role) => role.id !== "visitante")
    });
    return;
  }

  if (request.method === "PATCH" && url.pathname.startsWith("/api/admin/users/")) {
    const admin = requireAdmin(request, response);

    if (!admin) {
      return;
    }

    try {
      const userId = Number(url.pathname.split("/").pop());
      const user = findUserById(database, userId);
      const body = await parseBody(request);

      if (!user) {
        sendJson(response, 404, { message: "Usuario nao encontrado." });
        return;
      }

      const role = normalizeText(body.role || user.role);
      const status = normalizeText(body.status || user.status || "ativo");

      if (!isValidRole(role)) {
        sendJson(response, 400, { message: "Perfil de usuario invalido." });
        return;
      }

      if (!["ativo", "bloqueado"].includes(status)) {
        sendJson(response, 400, { message: "Status de usuario invalido." });
        return;
      }

      if (user.id === admin.id && role !== "administrador") {
        sendJson(response, 400, { message: "Voce nao pode remover seu proprio acesso administrativo." });
        return;
      }

      if (user.id === admin.id && status === "bloqueado") {
        sendJson(response, 400, { message: "Voce nao pode bloquear sua propria conta." });
        return;
      }

      user.role = role;
      user.status = status;
      writeDatabase(database);
      updateSessionUser(user);

      sendJson(response, 200, { user: getAdminUser(user) });
    } catch (error) {
      sendJson(response, 400, { message: "Nao foi possivel atualizar o usuario." });
    }

    return;
  }

  if (request.method === "GET" && request.url === "/api/admin/comments") {
    if (!requireAdmin(request, response)) {
      return;
    }

    sendJson(response, 200, { comments: database.comments });
    return;
  }

  if (request.method === "PATCH" && url.pathname.startsWith("/api/admin/comments/")) {
    if (!requireAdmin(request, response)) {
      return;
    }

    try {
      const commentId = Number(url.pathname.split("/").pop());
      const comment = database.comments.find((item) => item.id === commentId);
      const body = await parseBody(request);
      const status = normalizeText(body.status);

      if (!comment) {
        sendJson(response, 404, { message: "Comentario nao encontrado." });
        return;
      }

      if (!COMMENT_STATUSES.includes(status)) {
        sendJson(response, 400, { message: "Status de comentario invalido." });
        return;
      }

      comment.status = status;
      comment.moderatedAt = new Date().toISOString();
      writeDatabase(database);

      sendJson(response, 200, { comment });
    } catch (error) {
      sendJson(response, 400, { message: "Nao foi possivel moderar o comentario." });
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
