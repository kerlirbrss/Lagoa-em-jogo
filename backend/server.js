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
const MATCH_STATUSES = ["agendado", "em_andamento", "encerrado"];
const NEWS_STATUSES = ["rascunho", "publicado"];

function readDatabase() {
  const raw = fs.readFileSync(DB_PATH, "utf8");
  const database = JSON.parse(raw);
  database.athletes = database.athletes || [];
  database.matches = database.matches || [];
  database.news = database.news || [];
  return database;
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
    stats: getAutomaticTeamStats(database, Number(team.id)),
    squad: team.squad || "",
    upcomingMatches: team.upcomingMatches || "",
    recentResults: team.recentResults || "",
    gallery: team.gallery || "",
    createdAt: team.createdAt || null,
    updatedAt: team.updatedAt || null
  };
}

function getDefaultAthleteStats(stats = {}) {
  return {
    matches: Number(stats.matches || 0),
    goals: Number(stats.goals || 0),
    yellowCards: Number(stats.yellowCards || 0),
    redCards: Number(stats.redCards || 0)
  };
}

function getDefaultMatchScore(score = {}) {
  const currentScore = score || {};

  return {
    home: currentScore.home === "" || currentScore.home === undefined ? "" : Number(currentScore.home),
    away: currentScore.away === "" || currentScore.away === undefined ? "" : Number(currentScore.away)
  };
}

function hasFinishedScore(match) {
  const score = getDefaultMatchScore(match.score);
  return match.status === "encerrado" && score.home !== "" && score.away !== "";
}

function getAutomaticTeamStats(database, teamId) {
  const stats = getDefaultTeamStats();

  database.matches
    .filter((match) => hasFinishedScore(match) && (Number(match.homeTeamId) === teamId || Number(match.awayTeamId) === teamId))
    .forEach((match) => {
      const score = getDefaultMatchScore(match.score);
      const isHomeTeam = Number(match.homeTeamId) === teamId;
      const goalsFor = isHomeTeam ? score.home : score.away;
      const goalsAgainst = isHomeTeam ? score.away : score.home;

      stats.matches += 1;
      stats.goalsFor += goalsFor;
      stats.goalsAgainst += goalsAgainst;

      if (goalsFor > goalsAgainst) {
        stats.wins += 1;
        stats.points += 3;
      } else if (goalsFor === goalsAgainst) {
        stats.draws += 1;
        stats.points += 1;
      } else {
        stats.losses += 1;
      }
    });

  return stats;
}

function getChampionshipStatistics(database, championshipId) {
  const championship = findChampionshipById(database, championshipId);

  if (!championship) {
    return null;
  }

  const teams = database.teams.filter((team) => Number(team.championshipId) === championshipId);
  const teamById = new Map(teams.map((team) => [Number(team.id), team]));
  const standings = teams
    .map((team) => {
      const stats = getAutomaticTeamStats(database, Number(team.id));
      return {
        teamId: team.id,
        teamName: team.name,
        community: team.community,
        ...stats,
        goalDifference: stats.goalsFor - stats.goalsAgainst,
        performance: stats.matches ? Number(((stats.points / (stats.matches * 3)) * 100).toFixed(1)) : 0
      };
    })
    .sort((a, b) => {
      return b.points - a.points || b.wins - a.wins || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.teamName.localeCompare(b.teamName);
    })
    .map((team, index) => ({ position: index + 1, ...team }));
  const athletes = database.athletes
    .filter((athlete) => teamById.has(Number(athlete.teamId)))
    .map((athlete) => {
      const stats = getDefaultAthleteStats(athlete.stats);
      return {
        athleteId: athlete.id,
        athleteName: athlete.fullName,
        teamId: athlete.teamId,
        teamName: teamById.get(Number(athlete.teamId)).name,
        ...stats
      };
    });
  const rankAthletes = (field) => athletes
    .filter((athlete) => athlete[field] > 0)
    .sort((a, b) => b[field] - a[field] || b.matches - a.matches || a.athleteName.localeCompare(b.athleteName))
    .map((athlete, index) => ({ position: index + 1, ...athlete }));

  return {
    championship: getPublicChampionship(championship),
    updatedAt: new Date().toISOString(),
    finishedMatches: database.matches.filter((match) => Number(match.championshipId) === championshipId && hasFinishedScore(match)).length,
    standings,
    topScorers: rankAthletes("goals"),
    mostMatches: rankAthletes("matches"),
    yellowCards: rankAthletes("yellowCards"),
    redCards: rankAthletes("redCards")
  };
}

function getPublicAthlete(athlete, database) {
  const team = findTeamById(database, Number(athlete.teamId));

  return {
    id: athlete.id,
    fullName: athlete.fullName,
    photoUrl: athlete.photoUrl || "",
    teamId: Number(athlete.teamId),
    teamName: team ? team.name : "Time nao encontrado",
    position: athlete.position,
    age: athlete.age || "",
    stats: getDefaultAthleteStats(athlete.stats),
    createdAt: athlete.createdAt || null,
    updatedAt: athlete.updatedAt || null
  };
}

function getPublicMatch(match, database) {
  const championship = findChampionshipById(database, Number(match.championshipId));
  const homeTeam = findTeamById(database, Number(match.homeTeamId));
  const awayTeam = findTeamById(database, Number(match.awayTeamId));

  return {
    id: match.id,
    championshipId: Number(match.championshipId),
    championshipName: championship ? championship.name : "Campeonato nao encontrado",
    stage: match.stage,
    round: match.round,
    homeTeamId: Number(match.homeTeamId),
    homeTeamName: homeTeam ? homeTeam.name : "Time mandante nao encontrado",
    awayTeamId: Number(match.awayTeamId),
    awayTeamName: awayTeam ? awayTeam.name : "Time visitante nao encontrado",
    date: match.date,
    time: match.time,
    field: match.field,
    location: match.location,
    score: getDefaultMatchScore(match.score),
    status: match.status,
    closedAt: match.closedAt || null,
    createdAt: match.createdAt || null,
    updatedAt: match.updatedAt || null
  };
}

function getPublicNewsArticle(article, database, options = {}) {
  const comments = database.comments
    .filter((comment) => Number(comment.newsId) === Number(article.id) && comment.status === "aprovado")
    .map((comment) => {
      return {
        id: comment.id,
        authorName: comment.authorName,
        content: comment.content,
        createdAt: comment.createdAt || null
      };
    });

  return {
    id: article.id,
    title: article.title,
    category: article.category,
    summary: article.summary || "",
    content: options.includeContent ? article.content || "" : "",
    coverImageUrl: article.coverImageUrl || "",
    galleryImages: article.galleryImages || [],
    status: article.status,
    authorName: article.authorName || "Equipe Lagoa em Jogo",
    publishedAt: article.publishedAt || null,
    createdAt: article.createdAt || null,
    updatedAt: article.updatedAt || null,
    comments
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

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeText).filter(Boolean);
  }

  return String(value || "")
    .split(/\r?\n|,/)
    .map(normalizeText)
    .filter(Boolean);
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

function canPublishNews(user) {
  return user && ["administrador", "organizador"].includes(user.role);
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

function requireNewsPublisher(request, response) {
  const user = getSessionUser(request);

  if (!user) {
    sendJson(response, 401, { message: "Entre para gerenciar noticias." });
    return null;
  }

  if (!canPublishNews(user)) {
    sendJson(response, 403, { message: "Publicacao restrita a administradores e organizadores autorizados." });
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
      athletes: database.athletes.length,
      matches: database.matches.length,
      news: database.news.length,
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

function findAthleteById(database, athleteId) {
  return database.athletes.find((athlete) => athlete.id === athleteId) || null;
}

function findMatchById(database, matchId) {
  return database.matches.find((match) => match.id === matchId) || null;
}

function findNewsById(database, newsId) {
  return database.news.find((article) => article.id === newsId) || null;
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

function validateAthletePayload(database, body, currentAthlete = {}) {
  const teamId = Number(body.teamId ?? currentAthlete.teamId);
  const age = normalizeText(body.age ?? currentAthlete.age);
  const athlete = {
    fullName: normalizeText(body.fullName ?? currentAthlete.fullName),
    photoUrl: normalizeText(body.photoUrl ?? currentAthlete.photoUrl),
    teamId,
    position: normalizeText(body.position ?? currentAthlete.position),
    age,
    stats: getDefaultAthleteStats(body.stats ?? currentAthlete.stats)
  };

  if (athlete.fullName.length < 3) {
    return { error: "Informe o nome completo do atleta com pelo menos 3 caracteres." };
  }

  if (!findTeamById(database, athlete.teamId)) {
    return { error: "Time atual do atleta nao encontrado." };
  }

  if (!athlete.position) {
    return { error: "Informe a posicao do atleta." };
  }

  if (age && (!Number.isInteger(Number(age)) || Number(age) < 10 || Number(age) > 80)) {
    return { error: "Informe uma idade valida ou deixe o campo vazio." };
  }

  const invalidStat = Object.values(athlete.stats).some((value) => {
    return !Number.isInteger(value) || value < 0;
  });

  if (invalidStat) {
    return { error: "As estatisticas do atleta devem ser numeros inteiros nao negativos." };
  }

  return { athlete };
}

function validateMatchPayload(database, body, currentMatch = {}) {
  const championshipId = Number(body.championshipId ?? currentMatch.championshipId);
  const homeTeamId = Number(body.homeTeamId ?? currentMatch.homeTeamId);
  const awayTeamId = Number(body.awayTeamId ?? currentMatch.awayTeamId);
  const status = normalizeText(body.status ?? currentMatch.status ?? "agendado");
  const score = getDefaultMatchScore(body.score ?? currentMatch.score);
  const match = {
    championshipId,
    stage: normalizeText(body.stage ?? currentMatch.stage),
    round: normalizeText(body.round ?? currentMatch.round),
    homeTeamId,
    awayTeamId,
    date: normalizeDate(body.date ?? currentMatch.date),
    time: normalizeText(body.time ?? currentMatch.time),
    field: normalizeText(body.field ?? currentMatch.field),
    location: normalizeText(body.location ?? currentMatch.location),
    score,
    status
  };
  const championship = findChampionshipById(database, match.championshipId);
  const homeTeam = findTeamById(database, match.homeTeamId);
  const awayTeam = findTeamById(database, match.awayTeamId);

  if (!championship) {
    return { error: "Campeonato da partida nao encontrado." };
  }

  if (!match.stage) {
    return { error: "Informe a fase da partida." };
  }

  if (!match.round) {
    return { error: "Informe a rodada da partida." };
  }

  if (!homeTeam || !awayTeam) {
    return { error: "Informe times validos para a partida." };
  }

  if (match.homeTeamId === match.awayTeamId) {
    return { error: "O time mandante e visitante devem ser diferentes." };
  }

  if (homeTeam.championshipId !== match.championshipId || awayTeam.championshipId !== match.championshipId) {
    return { error: "Os times devem pertencer ao campeonato selecionado." };
  }

  if (!match.date) {
    return { error: "Informe a data da partida." };
  }

  if (!match.time) {
    return { error: "Informe o horario da partida." };
  }

  if (!match.field) {
    return { error: "Informe o campo da partida." };
  }

  if (!match.location) {
    return { error: "Informe a localizacao da partida." };
  }

  if (!MATCH_STATUSES.includes(match.status)) {
    return { error: "Status de partida invalido." };
  }

  const invalidScore = Object.values(match.score).some((value) => {
    return value !== "" && (!Number.isInteger(value) || value < 0);
  });

  if (invalidScore) {
    return { error: "O placar deve conter numeros inteiros nao negativos ou ficar vazio." };
  }

  if (match.status === "encerrado" && (match.score.home === "" || match.score.away === "")) {
    return { error: "Informe o placar para encerrar a partida." };
  }

  return { match };
}

function validateNewsPayload(body, currentArticle = {}) {
  const status = normalizeText(body.status ?? currentArticle.status ?? "rascunho");
  const article = {
    title: normalizeText(body.title ?? currentArticle.title),
    category: normalizeText(body.category ?? currentArticle.category),
    summary: normalizeText(body.summary ?? currentArticle.summary),
    content: normalizeText(body.content ?? currentArticle.content),
    coverImageUrl: normalizeText(body.coverImageUrl ?? currentArticle.coverImageUrl),
    galleryImages: normalizeList(body.galleryImages ?? currentArticle.galleryImages),
    status
  };

  if (article.title.length < 5) {
    return { error: "Informe um titulo de noticia com pelo menos 5 caracteres." };
  }

  if (!article.category) {
    return { error: "Informe a categoria da noticia." };
  }

  if (article.summary.length < 10) {
    return { error: "Informe um resumo da noticia com pelo menos 10 caracteres." };
  }

  if (article.content.length < 20) {
    return { error: "Informe o conteudo da noticia com pelo menos 20 caracteres." };
  }

  if (!NEWS_STATUSES.includes(article.status)) {
    return { error: "Status de noticia invalido." };
  }

  return { article };
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
      athletes: database.athletes.map((athlete) => getPublicAthlete(athlete, database)),
      matches: database.matches.map((match) => getPublicMatch(match, database)),
      news: database.news
        .filter((article) => article.status === "publicado")
        .sort((a, b) => String(b.publishedAt || b.createdAt || "").localeCompare(String(a.publishedAt || a.createdAt || "")))
        .map((article) => getPublicNewsArticle(article, database, { includeContent: true })),
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

  if (request.method === "GET" && request.url === "/api/athletes") {
    sendJson(response, 200, {
      athletes: database.athletes.map((athlete) => getPublicAthlete(athlete, database))
    });
    return;
  }

  if (request.method === "GET" && request.url === "/api/matches") {
    sendJson(response, 200, {
      matches: database.matches.map((match) => getPublicMatch(match, database))
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/news") {
    const category = normalizeText(url.searchParams.get("category")).toLowerCase();
    const news = database.news
      .filter((article) => article.status === "publicado")
      .filter((article) => !category || article.category.toLowerCase() === category)
      .sort((a, b) => String(b.publishedAt || b.createdAt || "").localeCompare(String(a.publishedAt || a.createdAt || "")))
      .map((article) => getPublicNewsArticle(article, database, { includeContent: true }));

    sendJson(response, 200, { news });
    return;
  }

  if (request.method === "POST" && url.pathname.startsWith("/api/news/") && url.pathname.endsWith("/comments")) {
    try {
      const newsId = Number(url.pathname.split("/")[3]);
      const article = findNewsById(database, newsId);
      const body = await parseBody(request);
      const authorName = normalizeText(body.authorName);
      const content = normalizeText(body.content);

      if (!article || article.status !== "publicado") {
        sendJson(response, 404, { message: "Noticia nao encontrada." });
        return;
      }

      if (authorName.length < 3) {
        sendJson(response, 400, { message: "Informe seu nome para comentar." });
        return;
      }

      if (content.length < 5) {
        sendJson(response, 400, { message: "Escreva um comentario com pelo menos 5 caracteres." });
        return;
      }

      const comment = {
        id: database.comments.reduce((highest, item) => Math.max(highest, item.id), 0) + 1,
        authorName,
        context: `Noticia: ${article.title}`,
        newsId: article.id,
        content,
        status: "pendente",
        createdAt: new Date().toISOString()
      };

      database.comments.push(comment);
      writeDatabase(database);

      sendJson(response, 201, {
        message: "Comentario enviado para moderacao.",
        comment
      });
    } catch (error) {
      sendJson(response, 400, { message: "Nao foi possivel comentar na noticia." });
    }

    return;
  }

  if (request.method === "GET" && url.pathname === "/api/statistics") {
    const requestedChampionshipId = Number(url.searchParams.get("championshipId"));
    const championshipId = requestedChampionshipId || Number(database.championships[0]?.id);
    const statistics = getChampionshipStatistics(database, championshipId);

    if (!statistics) {
      sendJson(response, 404, { message: "Campeonato nao encontrado." });
      return;
    }

    sendJson(response, 200, { statistics });
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
      const hasAthletes = database.athletes.some((athlete) => Number(athlete.teamId) === teamId);

      if (hasAthletes) {
        sendJson(response, 400, { message: "Remova ou transfira os atletas antes de excluir o time." });
        return;
      }

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

  if (request.method === "GET" && request.url === "/api/admin/athletes") {
    if (!requireAdmin(request, response)) {
      return;
    }

    sendJson(response, 200, {
      athletes: database.athletes.map((athlete) => getPublicAthlete(athlete, database)),
      teams: database.teams.map((team) => getPublicTeam(team, database))
    });
    return;
  }

  if (request.method === "POST" && request.url === "/api/admin/athletes") {
    if (!requireAdmin(request, response)) {
      return;
    }

    try {
      const body = await parseBody(request);
      const validation = validateAthletePayload(database, body);

      if (validation.error) {
        sendJson(response, 400, { message: validation.error });
        return;
      }

      const athlete = {
        id: database.athletes.reduce((highest, item) => Math.max(highest, item.id), 0) + 1,
        ...validation.athlete,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      database.athletes.push(athlete);
      writeDatabase(database);

      sendJson(response, 201, { athlete: getPublicAthlete(athlete, database) });
    } catch (error) {
      sendJson(response, 400, { message: "Nao foi possivel criar o atleta." });
    }

    return;
  }

  if (["PUT", "DELETE"].includes(request.method) && url.pathname.startsWith("/api/admin/athletes/")) {
    if (!requireAdmin(request, response)) {
      return;
    }

    const athleteId = Number(url.pathname.split("/").pop());
    const athlete = findAthleteById(database, athleteId);

    if (!athlete) {
      sendJson(response, 404, { message: "Atleta nao encontrado." });
      return;
    }

    if (request.method === "DELETE") {
      database.athletes = database.athletes.filter((item) => item.id !== athleteId);
      writeDatabase(database);
      sendJson(response, 200, { message: "Atleta excluido." });
      return;
    }

    try {
      const body = await parseBody(request);
      const validation = validateAthletePayload(database, body, athlete);

      if (validation.error) {
        sendJson(response, 400, { message: validation.error });
        return;
      }

      Object.assign(athlete, validation.athlete, {
        updatedAt: new Date().toISOString()
      });

      writeDatabase(database);
      sendJson(response, 200, { athlete: getPublicAthlete(athlete, database) });
    } catch (error) {
      sendJson(response, 400, { message: "Nao foi possivel atualizar o atleta." });
    }

    return;
  }

  if (request.method === "GET" && request.url === "/api/admin/matches") {
    if (!requireAdmin(request, response)) {
      return;
    }

    sendJson(response, 200, {
      matches: database.matches.map((match) => getPublicMatch(match, database)),
      championships: database.championships.map(getPublicChampionship),
      teams: database.teams.map((team) => getPublicTeam(team, database)),
      statuses: MATCH_STATUSES
    });
    return;
  }

  if (request.method === "POST" && request.url === "/api/admin/matches") {
    if (!requireAdmin(request, response)) {
      return;
    }

    try {
      const body = await parseBody(request);
      const validation = validateMatchPayload(database, body);

      if (validation.error) {
        sendJson(response, 400, { message: validation.error });
        return;
      }

      const match = {
        id: database.matches.reduce((highest, item) => Math.max(highest, item.id), 0) + 1,
        ...validation.match,
        closedAt: validation.match.status === "encerrado" ? new Date().toISOString() : null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      database.matches.push(match);
      writeDatabase(database);

      sendJson(response, 201, { match: getPublicMatch(match, database) });
    } catch (error) {
      sendJson(response, 400, { message: "Nao foi possivel criar a partida." });
    }

    return;
  }

  if (["PUT", "DELETE"].includes(request.method) && url.pathname.startsWith("/api/admin/matches/")) {
    if (!requireAdmin(request, response)) {
      return;
    }

    const matchId = Number(url.pathname.split("/").pop());
    const match = findMatchById(database, matchId);

    if (!match) {
      sendJson(response, 404, { message: "Partida nao encontrada." });
      return;
    }

    if (request.method === "DELETE") {
      database.matches = database.matches.filter((item) => item.id !== matchId);
      writeDatabase(database);
      sendJson(response, 200, { message: "Partida excluida." });
      return;
    }

    try {
      const body = await parseBody(request);
      const validation = validateMatchPayload(database, body, match);

      if (validation.error) {
        sendJson(response, 400, { message: validation.error });
        return;
      }

      Object.assign(match, validation.match, {
        closedAt: validation.match.status === "encerrado" ? match.closedAt || new Date().toISOString() : null,
        updatedAt: new Date().toISOString()
      });

      writeDatabase(database);
      sendJson(response, 200, { match: getPublicMatch(match, database) });
    } catch (error) {
      sendJson(response, 400, { message: "Nao foi possivel atualizar a partida." });
    }

    return;
  }

  if (request.method === "GET" && request.url === "/api/admin/news") {
    if (!requireNewsPublisher(request, response)) {
      return;
    }

    sendJson(response, 200, {
      news: database.news
        .slice()
        .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")))
        .map((article) => getPublicNewsArticle(article, database, { includeContent: true })),
      statuses: NEWS_STATUSES
    });
    return;
  }

  if (request.method === "POST" && request.url === "/api/admin/news") {
    const publisher = requireNewsPublisher(request, response);

    if (!publisher) {
      return;
    }

    try {
      const body = await parseBody(request);
      const validation = validateNewsPayload(body);

      if (validation.error) {
        sendJson(response, 400, { message: validation.error });
        return;
      }

      const now = new Date().toISOString();
      const article = {
        id: database.news.reduce((highest, item) => Math.max(highest, item.id), 0) + 1,
        ...validation.article,
        authorId: publisher.id,
        authorName: publisher.name,
        publishedAt: validation.article.status === "publicado" ? now : null,
        createdAt: now,
        updatedAt: now
      };

      database.news.push(article);
      writeDatabase(database);

      sendJson(response, 201, { article: getPublicNewsArticle(article, database, { includeContent: true }) });
    } catch (error) {
      sendJson(response, 400, { message: "Nao foi possivel criar a noticia." });
    }

    return;
  }

  if (["PUT", "DELETE"].includes(request.method) && url.pathname.startsWith("/api/admin/news/")) {
    if (!requireNewsPublisher(request, response)) {
      return;
    }

    const newsId = Number(url.pathname.split("/").pop());
    const article = findNewsById(database, newsId);

    if (!article) {
      sendJson(response, 404, { message: "Noticia nao encontrada." });
      return;
    }

    if (request.method === "DELETE") {
      database.news = database.news.filter((item) => item.id !== newsId);
      database.comments = database.comments.filter((comment) => Number(comment.newsId) !== newsId);
      writeDatabase(database);
      sendJson(response, 200, { message: "Noticia excluida." });
      return;
    }

    try {
      const body = await parseBody(request);
      const validation = validateNewsPayload(body, article);

      if (validation.error) {
        sendJson(response, 400, { message: validation.error });
        return;
      }

      const wasPublished = article.status === "publicado";
      const willPublish = validation.article.status === "publicado";

      Object.assign(article, validation.article, {
        publishedAt: willPublish ? article.publishedAt || new Date().toISOString() : null,
        updatedAt: new Date().toISOString()
      });

      if (!wasPublished && willPublish) {
        article.publishedAt = new Date().toISOString();
      }

      writeDatabase(database);
      sendJson(response, 200, { article: getPublicNewsArticle(article, database, { includeContent: true }) });
    } catch (error) {
      sendJson(response, 400, { message: "Nao foi possivel atualizar a noticia." });
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
