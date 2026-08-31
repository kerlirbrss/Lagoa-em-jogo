const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");

const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = path.join(__dirname, "..");
const FRONTEND_DIR = path.join(ROOT_DIR, "frontend");
const DB_PATH = process.env.LEJ_DB_PATH ? path.resolve(process.env.LEJ_DB_PATH) : path.join(__dirname, "database", "db.json");

/* ============================================================
   Configuracoes de producao (Fase 17 - Deploy)
   Controladas por variaveis de ambiente (ver .env.example).
   - NODE_ENV: environment do processo (development | production)
   - LEJ_TRUST_PROXY: confiar nos cabecalhos do proxy reverso
   - LEJ_FORCE_HTTPS: redirecionar todo trafego HTTP para HTTPS
   - LEJ_SECURE_COOKIES: marcar cookies de sessao como Secure
   - LEJ_LOG_REQUESTS: registrar cada requisicao em log JSON
   ============================================================ */
const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PRODUCTION = NODE_ENV === "production";
const APP_VERSION = require(path.join(ROOT_DIR, "package.json")).version || "0.0.0";
const APP_STARTED_AT = Date.now();
const TRUST_PROXY = toBoolean(process.env.LEJ_TRUST_PROXY);
const FORCE_HTTPS = toBoolean(process.env.LEJ_FORCE_HTTPS);
const SECURE_COOKIES = toBoolean(process.env.LEJ_SECURE_COOKIES);
const LOG_REQUESTS = IS_PRODUCTION || toBoolean(process.env.LEJ_LOG_REQUESTS);

const sessions = new Map();
const USER_ROLES = ["usuario", "organizador", "fotografo", "administrador"];
const COMMENT_STATUSES = ["pendente", "aprovado", "rejeitado"];
const CHAMPIONSHIP_STATUSES = ["rascunho", "inscricoes", "em_andamento", "encerrado"];
const MATCH_STATUSES = ["agendado", "em_andamento", "encerrado"];
const NEWS_STATUSES = ["rascunho", "publicado"];
const GALLERY_STATUSES = ["rascunho", "publicado"];
const GALLERY_TYPES = ["campeonato", "jogo", "evento"];

const NOTIFICATION_TYPES = ["jogo_resultado", "proximo_jogo", "noticia_nova"];
const NOTIFICATION_PREFERENCES = [
  {
    id: "times_favoritos",
    name: "Times favoritos",
    description: "Avise quando um jogo de um time que eu favorito for encerrado."
  },
  {
    id: "campeonatos_favoritos",
    name: "Campeonatos favoritos",
    description: "Avise sobre resultados e novidades dos campeonatos que eu favorito."
  },
  {
    id: "noticias",
    name: "Noticias",
    description: "Avise quando uma nova noticia for publicada na plataforma."
  },
  {
    id: "proximos_jogos",
    name: "Proximos jogos",
    description: "Avise sobre os proximos jogos dos meus times e campeonatos favoritos."
  }
];

function ensureDatabaseFile() {
  if (fs.existsSync(DB_PATH)) {
    return;
  }

  const directory = path.dirname(DB_PATH);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  const baseDatabase = {
    settings: {
      appName: "Lagoa em Jogo",
      slogan: "Feito por quem joga. Acompanhado por quem torce.",
      city: "Lagoa de Sao Francisco - PI",
      theme: { blue: "#1155cc", green: "#1f9d55", white: "#ffffff" }
    },
    roles: [
      { id: "visitante", name: "Visitante", description: "Visualiza conteudos e pesquisa informacoes sem conta.", permissions: ["visualizar_conteudos", "pesquisar"] },
      { id: "usuario", name: "Usuario", description: "Comenta, participa de palpites e acompanha favoritos.", permissions: ["comentar", "palpitar", "favoritar"] },
      { id: "organizador", name: "Organizador", description: "Gerencia campeonatos, jogos, resultados e noticias autorizadas.", permissions: ["gerenciar_campeonatos", "cadastrar_jogos", "atualizar_resultados", "publicar_noticias"] },
      { id: "fotografo", name: "Fotografo", description: "Publica galerias de fotos das partidas e eventos.", permissions: ["publicar_galerias"] },
      { id: "administrador", name: "Administrador", description: "Controla a plataforma, usuarios, permissoes e modera conteudos.", permissions: ["gerenciar_tudo"] }
    ],
    users: [],
    championships: [],
    teams: [],
    athletes: [],
    matches: [],
    news: [],
    galleries: [],
    images: [],
    auditLogs: [],
    comments: [],
    contacts: [],
    favorites: [],
    notifications: [],
    notificationPreferences: [],
    predictions: [],
    predictionComments: [],
    featuredMatches: []
  };

  console.log(`[${NODE_ENV}] Banco de dados nao encontrado em ${DB_PATH}. Criando arquivo inicial.`);
  fs.writeFileSync(DB_PATH, `${JSON.stringify(baseDatabase, null, 2)}\n`);
}

function readDatabase() {
  ensureDatabaseFile();
  const raw = fs.readFileSync(DB_PATH, "utf8");
  const database = JSON.parse(raw);
  database.athletes = database.athletes || [];
  database.matches = database.matches || [];
  database.news = database.news || [];
  database.galleries = database.galleries || [];
  database.images = database.images || [];
  database.auditLogs = database.auditLogs || [];
  database.contacts = database.contacts || [];
  database.favorites = database.favorites || [];
  database.notifications = database.notifications || [];
  database.notificationPreferences = database.notificationPreferences || [];
  database.predictions = database.predictions || [];
  database.predictionComments = database.predictionComments || [];
  return database;
}

function writeDatabase(database) {
  const directory = path.dirname(DB_PATH);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
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

function toBoolean(value) {
  if (value === undefined || value === null) {
    return false;
  }
  return value === true || value === "1" || value === "true" || value === "yes";
}

function isSecureRequest(request) {
  if (request.socket && request.socket.encrypted) {
    return true;
  }

  if (TRUST_PROXY) {
    const forwardedProto = String(request.headers["x-forwarded-proto"] || "")
      .split(",")[0]
      .trim()
      .toLowerCase();
    return forwardedProto === "https";
  }

  return false;
}

function buildRedirectUrl(request) {
  const host = request.headers.host || `localhost:${PORT}`;
  return `https://${host}${request.url || "/"}`;
}

function buildSessionCookie(token, { maxAge } = {}) {
  let cookie = `lej_session=${token}; HttpOnly; Path=/; SameSite=Lax`;
  if (maxAge !== undefined) {
    cookie += `; Max-Age=${maxAge}`;
  }
  if (SECURE_COOKIES) {
    cookie += "; Secure";
  }
  return cookie;
}

function getHealthDetails(database) {
  return {
    status: "ok",
    app: database.settings.appName,
    version: APP_VERSION,
    environment: NODE_ENV,
    uptimeSeconds: Math.floor((Date.now() - APP_STARTED_AT) / 1000),
    timestamp: new Date().toISOString()
  };
}

function logRequest(request, response) {
  const startedAt = Date.now();

  response.on("finish", () => {
    console.log(JSON.stringify({
      time: new Date().toISOString(),
      level: "request",
      method: request.method,
      path: request.url,
      status: response.statusCode,
      durationMs: Date.now() - startedAt,
      userAgent: String(request.headers["user-agent"] || "").slice(0, 160)
    }));
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
    photoUrl: user.photoUrl || "",
    createdAt: user.createdAt || null
  };
}

function getAdminUser(user) {
  return {
    ...getPublicUser(user),
    resetRequestedAt: user.resetRequestedAt || null
  };
}

function getPublicFavorite(favorite, database) {
  let item = null;

  if (favorite.type === "time") {
    const team = findTeamById(database, Number(favorite.itemId));
    item = team ? getPublicTeam(team, database) : null;
  } else if (favorite.type === "campeonato") {
    const championship = findChampionshipById(database, Number(favorite.itemId));
    item = championship ? getPublicChampionship(championship) : null;
  }

  if (!item) {
    return null;
  }

  return {
    id: favorite.id,
    type: favorite.type,
    itemId: Number(favorite.itemId),
    item,
    createdAt: favorite.createdAt || null
  };
}

function getPublicFavorites(database, user) {
  if (!user) {
    return [];
  }

  return database.favorites
    .filter((favorite) => Number(favorite.userId) === Number(user.id))
    .map((favorite) => getPublicFavorite(favorite, database))
    .filter(Boolean)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

/* ============================================================
   Palpites (Fase 13)
   ============================================================ */

function getPredictionOutcome(homeScore, awayScore) {
  if (homeScore > awayScore) return "casa";
  if (awayScore > homeScore) return "fora";
  return "empate";
}

function getPredictionSummary(database, matchId, user) {
  const predictions = database.predictions.filter((prediction) => Number(prediction.matchId) === Number(matchId));
  const votes = { casa: 0, empate: 0, fora: 0 };

  predictions.forEach((prediction) => {
    votes[getPredictionOutcome(Number(prediction.homeScore), Number(prediction.awayScore))] += 1;
  });

  const total = predictions.length;
  const percentages = Object.fromEntries(Object.entries(votes).map(([outcome, count]) => [
    outcome,
    total ? Math.round((count / total) * 100) : 0
  ]));
  const ownPrediction = user
    ? predictions.find((prediction) => Number(prediction.userId) === Number(user.id)) || null
    : null;

  return { total, votes, percentages, ownPrediction };
}

function getPublicPredictionComment(comment, database) {
  const author = database.users.find((user) => Number(user.id) === Number(comment.userId));
  return {
    id: comment.id,
    predictionId: Number(comment.predictionId),
    userId: Number(comment.userId),
    authorName: author ? author.name : "Torcedor",
    content: comment.content,
    createdAt: comment.createdAt || null,
    updatedAt: comment.updatedAt || null
  };
}

function getPublicPredictionCard(database, match, user) {
  const summary = getPredictionSummary(database, match.id, user);
  const comments = database.predictionComments
    .filter((comment) => Number(comment.matchId) === Number(match.id))
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
    .map((comment) => getPublicPredictionComment(comment, database));

  return {
    match: getPublicMatch(match, database),
    summary: {
      total: summary.total,
      votes: summary.votes,
      percentages: summary.percentages
    },
    ownPrediction: summary.ownPrediction
      ? {
        id: summary.ownPrediction.id,
        homeScore: Number(summary.ownPrediction.homeScore),
        awayScore: Number(summary.ownPrediction.awayScore),
        createdAt: summary.ownPrediction.createdAt || null,
        updatedAt: summary.ownPrediction.updatedAt || null
      }
      : null,
    comments
  };
}

function getPredictionCards(database, user) {
  return database.matches
    .filter((match) => match.status === "agendado")
    .sort((a, b) => `${a.date}T${a.time || "00:00"}`.localeCompare(`${b.date}T${b.time || "00:00"}`))
    .map((match) => getPublicPredictionCard(database, match, user));
}

function buildPersonalizedHome(database, user) {
  const favorites = getPublicFavorites(database, user);
  const favoriteTeamIds = new Set(
    favorites.filter((favorite) => favorite.type === "time").map((favorite) => Number(favorite.itemId))
  );
  const favoriteChampionshipIds = new Set(
    favorites.filter((favorite) => favorite.type === "campeonato").map((favorite) => Number(favorite.itemId))
  );
  const isRelevantMatch = (match) => {
    return favoriteChampionshipIds.has(Number(match.championshipId))
      || favoriteTeamIds.has(Number(match.homeTeamId))
      || favoriteTeamIds.has(Number(match.awayTeamId));
  };
  const byMatchDateAscending = (a, b) => `${a.date}T${a.time || "00:00"}`.localeCompare(`${b.date}T${b.time || "00:00"}`);
  const byMatchDateDescending = (a, b) => byMatchDateAscending(b, a);
  const relevantMatches = database.matches.filter(isRelevantMatch);

  return {
    favorites,
    upcomingMatches: relevantMatches
      .filter((match) => match.status !== "encerrado")
      .sort(byMatchDateAscending)
      .slice(0, 3)
      .map((match) => getPublicMatch(match, database)),
    recentResults: relevantMatches
      .filter(hasFinishedScore)
      .sort(byMatchDateDescending)
      .slice(0, 3)
      .map((match) => getPublicMatch(match, database))
  };
}

/* ============================================================
   Notificacoes (Fase 12)
   ============================================================ */

function getPublicNotification(notification) {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message || "",
    contextType: notification.contextType || "",
    contextId: Number(notification.contextId) || 0,
    contextLabel: notification.contextLabel || "",
    isRead: Boolean(notification.isRead),
    createdAt: notification.createdAt || null
  };
}

function nextNotificationId(database) {
  return database.notifications.reduce((highest, item) => Math.max(highest, item.id), 0) + 1;
}

function pushNotification(database, notification) {
  const record = {
    ...notification,
    id: nextNotificationId(database),
    isRead: Boolean(notification.isRead),
    createdAt: notification.createdAt || new Date().toISOString()
  };
  database.notifications.push(record);
  return record;
}

function isNotificationPreferenceEnabled(database, userId, key) {
  const row = database.notificationPreferences.find((item) => {
    return Number(item.userId) === Number(userId) && item.key === key;
  });

  return Boolean(!row || row.enabled !== false);
}

function getNotificationPreferencesForUser(database, user) {
  return NOTIFICATION_PREFERENCES.map((preference) => {
    const row = database.notificationPreferences.find((item) => {
      return Number(item.userId) === Number(user.id) && item.key === preference.id;
    });

    return {
      ...preference,
      enabled: row ? row.enabled !== false : true
    };
  });
}

function getUsersWhoFavorited(database, type, itemId) {
  return database.favorites
    .filter((favorite) => favorite.type === type && Number(favorite.itemId) === Number(itemId))
    .map((favorite) => Number(favorite.userId));
}

function notifyMatchResult(database, match) {
  const championship = findChampionshipById(database, Number(match.championshipId));
  const homeTeam = findTeamById(database, Number(match.homeTeamId));
  const awayTeam = findTeamById(database, Number(match.awayTeamId));
  const score = getDefaultMatchScore(match.score);
  const resultLine = `${homeTeam ? homeTeam.name : "Time mandante"} ${score.home} x ${score.away} ${awayTeam ? awayTeam.name : "Time visitante"}`;
  const message = `${resultLine} (${match.stage} - ${match.round}).`;
  const notifiedUsers = new Set();

  [match.homeTeamId, match.awayTeamId].forEach((teamId) => {
    const team = findTeamById(database, Number(teamId));

    if (!team) {
      return;
    }

    getUsersWhoFavorited(database, "time", Number(team.id)).forEach((userId) => {
      if (notifiedUsers.has(userId) || !isNotificationPreferenceEnabled(database, userId, "times_favoritos")) {
        return;
      }

      notifiedUsers.add(userId);
      pushNotification(database, {
        userId,
        type: "jogo_resultado",
        title: `${team.name}: resultado atualizado`,
        message,
        contextType: "time",
        contextId: team.id,
        contextLabel: team.name
      });
    });
  });

  if (championship) {
    getUsersWhoFavorited(database, "campeonato", championship.id).forEach((userId) => {
      if (notifiedUsers.has(userId) || !isNotificationPreferenceEnabled(database, userId, "campeonatos_favoritos")) {
        return;
      }

      notifiedUsers.add(userId);
      pushNotification(database, {
        userId,
        type: "jogo_resultado",
        title: `Resultado no ${championship.name}`,
        message,
        contextType: "campeonato",
        contextId: championship.id,
        contextLabel: championship.name
      });
    });
  }
}

function notifyUpcomingMatch(database, match) {
  const championship = findChampionshipById(database, Number(match.championshipId));
  const homeTeam = findTeamById(database, Number(match.homeTeamId));
  const awayTeam = findTeamById(database, Number(match.awayTeamId));
  const matchup = `${homeTeam ? homeTeam.name : "Time mandante"} x ${awayTeam ? awayTeam.name : "Time visitante"}`;
  const message = `${matchup} (${match.stage} - ${match.round}) em ${match.date} as ${match.time} no ${match.field}.`;
  const notifiedUsers = new Set();

  [match.homeTeamId, match.awayTeamId].forEach((teamId) => {
    const team = findTeamById(database, Number(teamId));

    if (!team) {
      return;
    }

    getUsersWhoFavorited(database, "time", Number(team.id)).forEach((userId) => {
      if (notifiedUsers.has(userId) || !isNotificationPreferenceEnabled(database, userId, "proximos_jogos")) {
        return;
      }

      notifiedUsers.add(userId);
      pushNotification(database, {
        userId,
        type: "proximo_jogo",
        title: `Proximo jogo: ${matchup}`,
        message,
        contextType: "jogo",
        contextId: match.id,
        contextLabel: matchup
      });
    });
  });

  if (championship) {
    getUsersWhoFavorited(database, "campeonato", championship.id).forEach((userId) => {
      if (notifiedUsers.has(userId) || !isNotificationPreferenceEnabled(database, userId, "proximos_jogos")) {
        return;
      }

      notifiedUsers.add(userId);
      pushNotification(database, {
        userId,
        type: "proximo_jogo",
        title: `Proximo jogo no ${championship.name}`,
        message,
        contextType: "campeonato",
        contextId: championship.id,
        contextLabel: championship.name
      });
    });
  }
}

function notifyMatchEvents(database, match, previousStatus) {
  if (match.status === "encerrado" && previousStatus !== "encerrado") {
    notifyMatchResult(database, match);
  } else if (match.status === "agendado" && previousStatus !== "agendado") {
    notifyUpcomingMatch(database, match);
  }
}

function notifyNewsPublished(database, article) {
  database.users.forEach((user) => {
    if (user.status === "bloqueado" || Number(user.id) === Number(article.authorId)) {
      return;
    }

    if (!isNotificationPreferenceEnabled(database, user.id, "noticias")) {
      return;
    }

    pushNotification(database, {
      userId: user.id,
      type: "noticia_nova",
      title: "Nova noticia publicada",
      message: `${article.title}${article.category ? ` (${article.category})` : ""}`,
      contextType: "noticia",
      contextId: article.id,
      contextLabel: article.title
    });
  });
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

function buildHomePage(database) {
  const byMatchDateAscending = (a, b) => `${a.date}T${a.time || "00:00"}`.localeCompare(`${b.date}T${b.time || "00:00"}`);
  const byMatchDateDescending = (a, b) => byMatchDateAscending(b, a);
  const activeChampionship = database.championships.find((championship) => championship.status === "em_andamento") || database.championships[0];
  const statistics = activeChampionship ? getChampionshipStatistics(database, Number(activeChampionship.id)) : null;
  const athleteOfWeek = statistics?.topScorers[0] || statistics?.mostMatches[0] || null;

  return {
    upcomingMatches: database.matches
      .filter((match) => match.status !== "encerrado")
      .sort(byMatchDateAscending)
      .slice(0, 3)
      .map((match) => getPublicMatch(match, database)),
    recentResults: database.matches
      .filter(hasFinishedScore)
      .sort(byMatchDateDescending)
      .slice(0, 3)
      .map((match) => getPublicMatch(match, database)),
    standings: statistics ? {
      championshipName: statistics.championship.name,
      teams: statistics.standings.slice(0, 4)
    } : null,
    topScorers: statistics?.topScorers.slice(0, 3) || [],
    athleteOfWeek,
    featuredNews: database.news
      .filter((article) => article.status === "publicado")
      .sort((a, b) => String(b.publishedAt || b.createdAt || "").localeCompare(String(a.publishedAt || a.createdAt || "")))
      .slice(0, 2)
      .map((article) => getPublicNewsArticle(article, database)),
    galleryPreview: database.galleries
      .filter((gallery) => gallery.status === "publicado")
      .sort((a, b) => String(b.publishedAt || b.createdAt || "").localeCompare(String(a.publishedAt || a.createdAt || "")))
      .slice(0, 3)
      .map((gallery) => getPublicGallery(gallery, database))
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

function getGalleryContext(gallery, database) {
  if (gallery.type === "campeonato") {
    const championship = findChampionshipById(database, Number(gallery.championshipId));
    return championship ? championship.name : "Campeonato nao encontrado";
  }

  if (gallery.type === "jogo") {
    const match = findMatchById(database, Number(gallery.matchId));
    return match ? `${getPublicMatch(match, database).homeTeamName} x ${getPublicMatch(match, database).awayTeamName}` : "Jogo nao encontrado";
  }

  return gallery.eventName || "Evento";
}

function getPublicGallery(gallery, database) {
  return {
    id: gallery.id,
    title: gallery.title,
    type: gallery.type,
    context: getGalleryContext(gallery, database),
    championshipId: gallery.championshipId || "",
    matchId: gallery.matchId || "",
    eventName: gallery.eventName || "",
    description: gallery.description || "",
    images: gallery.images || [],
    saleUrl: gallery.saleUrl || "",
    status: gallery.status,
    authorName: gallery.authorName || "Equipe Lagoa em Jogo",
    publishedAt: gallery.publishedAt || null,
    createdAt: gallery.createdAt || null,
    updatedAt: gallery.updatedAt || null
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

function normalizeSearchText(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function matchesSearchQuery(value, query) {
  return normalizeSearchText(value).includes(query);
}

function buildSearchResults(database, rawQuery, requestedLimit) {
  const query = normalizeSearchText(rawQuery);
  const limit = Math.min(Math.max(Number(requestedLimit) || 5, 1), 20);

  const matchChampionship = (championship) => {
    return [championship.name, championship.season, championship.description, championship.regulation, championship.awards]
      .filter(Boolean)
      .some((value) => matchesSearchQuery(value, query));
  };

  const matchTeam = (team) => {
    return [team.name, team.community, team.coach, team.colors, team.foundedYear, team.squad]
      .filter(Boolean)
      .some((value) => matchesSearchQuery(value, query));
  };

  const matchAthlete = (athlete) => {
    const team = findTeamById(database, Number(athlete.teamId));
    return [athlete.fullName, athlete.position, team ? team.name : ""]
      .filter(Boolean)
      .some((value) => matchesSearchQuery(value, query));
  };

  const matchNews = (article) => {
    return [article.title, article.category, article.summary, article.content]
      .filter(Boolean)
      .some((value) => matchesSearchQuery(value, query));
  };

  const allChampionships = database.championships.filter(matchChampionship);
  const allTeams = database.teams.filter(matchTeam);
  const allAthletes = database.athletes.filter(matchAthlete);
  const allNews = database.news.filter((article) => article.status === "publicado").filter(matchNews);

  return {
    query: normalizeText(rawQuery),
    normalizedQuery: query,
    total: allChampionships.length + allTeams.length + allAthletes.length + allNews.length,
    counts: {
      championships: allChampionships.length,
      teams: allTeams.length,
      athletes: allAthletes.length,
      news: allNews.length
    },
    results: {
      championships: allChampionships.slice(0, limit).map(getPublicChampionship),
      teams: allTeams.slice(0, limit).map((team) => getPublicTeam(team, database)),
      athletes: allAthletes.slice(0, limit).map((athlete) => getPublicAthlete(athlete, database)),
      news: allNews.slice(0, limit).map((article) => getPublicNewsArticle(article, database))
    }
  };
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

function recordAuditLog(database, action, entityType, details = {}, actor = null) {
  const logEntry = {
    id: database.auditLogs.reduce((highest, item) => Math.max(highest, item.id), 0) + 1,
    action,
    entityType,
    entityId: details.entityId ?? null,
    userId: actor ? actor.id : null,
    userName: actor ? actor.name : null,
    details: {
      ...(details || {})
    },
    createdAt: new Date().toISOString()
  };

  database.auditLogs.push(logEntry);
  writeDatabase(database);
  return logEntry;
}

function getPublicAuditLog(entry) {
  if (!entry) {
    return null;
  }

  return {
    id: entry.id,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    userId: entry.userId,
    userName: entry.userName,
    details: entry.details || {},
    createdAt: entry.createdAt
  };
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

function canPublishGallery(user) {
  return user && ["administrador", "fotografo"].includes(user.role);
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

function requireGalleryPublisher(request, response) {
  const user = getSessionUser(request);

  if (!user) {
    sendJson(response, 401, { message: "Entre para gerenciar galerias." });
    return null;
  }

  if (!canPublishGallery(user)) {
    sendJson(response, 403, { message: "Publicacao restrita a administradores e fotografos parceiros." });
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
      galleries: database.galleries.length,
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

function findGalleryById(database, galleryId) {
  return database.galleries.find((gallery) => gallery.id === galleryId) || null;
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

function isValidImageUrl(value) {
  if (!value) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch (error) {
    return false;
  }
}

function getPublicImage(image) {
  if (!image) {
    return null;
  }

  return {
    id: image.id,
    title: image.title,
    category: image.category,
    url: image.url,
    altText: image.altText || "",
    isPublic: Boolean(image.isPublic),
    createdAt: image.createdAt || null,
    updatedAt: image.updatedAt || null
  };
}

function validateImagePayload(body, currentImage = {}) {
  const image = {
    title: normalizeText(body.title ?? currentImage.title),
    category: normalizeText(body.category ?? currentImage.category),
    url: normalizeText(body.url ?? currentImage.url),
    altText: normalizeText(body.altText ?? currentImage.altText),
    isPublic: body.isPublic !== undefined ? Boolean(body.isPublic) : Boolean(currentImage.isPublic)
  };

  if (image.title.length < 3) {
    return { error: "Informe um titulo para a imagem com pelo menos 3 caracteres." };
  }

  if (!image.category) {
    return { error: "Informe a categoria da imagem." };
  }

  if (!isValidImageUrl(image.url)) {
    return { error: "Informe uma URL valida para a imagem." };
  }

  return { image };
}

function validateGalleryPayload(database, body, currentGallery = {}) {
  const type = normalizeText(body.type ?? currentGallery.type ?? "evento");
  const status = normalizeText(body.status ?? currentGallery.status ?? "rascunho");
  const gallery = {
    title: normalizeText(body.title ?? currentGallery.title),
    type,
    championshipId: Number(body.championshipId ?? currentGallery.championshipId) || "",
    matchId: Number(body.matchId ?? currentGallery.matchId) || "",
    eventName: normalizeText(body.eventName ?? currentGallery.eventName),
    description: normalizeText(body.description ?? currentGallery.description),
    images: normalizeList(body.images ?? currentGallery.images),
    saleUrl: normalizeText(body.saleUrl ?? currentGallery.saleUrl),
    status
  };

  if (gallery.title.length < 5) {
    return { error: "Informe um titulo de galeria com pelo menos 5 caracteres." };
  }

  if (!GALLERY_TYPES.includes(gallery.type)) {
    return { error: "Tipo de galeria invalido." };
  }

  if (!GALLERY_STATUSES.includes(gallery.status)) {
    return { error: "Status de galeria invalido." };
  }

  if (gallery.type === "campeonato" && !findChampionshipById(database, gallery.championshipId)) {
    return { error: "Selecione um campeonato valido para a galeria." };
  }

  if (gallery.type === "jogo" && !findMatchById(database, gallery.matchId)) {
    return { error: "Selecione um jogo valido para a galeria." };
  }

  if (gallery.type === "evento" && gallery.eventName.length < 3) {
    return { error: "Informe o nome do evento da galeria." };
  }

  if (gallery.images.length === 0) {
    return { error: "Informe pelo menos uma imagem para a galeria." };
  }

  if (gallery.type !== "campeonato") {
    gallery.championshipId = "";
  }

  if (gallery.type !== "jogo") {
    gallery.matchId = "";
  }

  if (gallery.type !== "evento") {
    gallery.eventName = "";
  }

  return { gallery };
}

async function handleApi(request, response) {
  const database = readDatabase();
  const url = new URL(request.url, "http://localhost");

  if (request.method === "GET" && request.url === "/api/health") {
    sendJson(response, 200, getHealthDetails(database));
    return;
  }

  if (request.method === "POST" && request.url === "/api/contact") {
    try {
      const body = await parseBody(request);
      const name = normalizeText(body.name);
      const email = normalizeEmail(body.email);
      const subject = normalizeText(body.subject);
      const message = normalizeText(body.message);

      if (name.length < 2) {
        sendJson(response, 400, { message: "Informe seu nome para continuar." });
        return;
      }

      if (!email || !email.includes("@") || !email.includes(".")) {
        sendJson(response, 400, { message: "Informe um e-mail valido." });
        return;
      }

      if (subject.length < 3) {
        sendJson(response, 400, { message: "Informe o assunto da mensagem." });
        return;
      }

      if (message.length < 10) {
        sendJson(response, 400, { message: "Escreva uma mensagem com pelo menos 10 caracteres." });
        return;
      }

      const contact = {
        id: database.contacts.reduce((highest, item) => Math.max(highest, Number(item.id) || 0), 0) + 1,
        name,
        email,
        subject,
        message,
        createdAt: new Date().toISOString(),
        status: "recebido"
      };

      database.contacts.push(contact);
      writeDatabase(database);

      sendJson(response, 201, {
        message: "recebemos sua mensagem. Nossa equipe entrará em contato em breve.",
        contact
      });
    } catch (error) {
      sendJson(response, 400, { message: "Nao foi possivel enviar a mensagem de contato." });
    }
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
      galleries: database.galleries
        .filter((gallery) => gallery.status === "publicado")
        .sort((a, b) => String(b.publishedAt || b.createdAt || "").localeCompare(String(a.publishedAt || a.createdAt || "")))
        .map((gallery) => getPublicGallery(gallery, database)),
      featuredMatches: database.featuredMatches,
      user: getPublicUser(getSessionUser(request)),
      favorites: getPublicFavorites(database, getSessionUser(request)),
      predictions: getPredictionCards(database, getSessionUser(request))
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

  if (request.method === "GET" && request.url === "/api/home") {
    sendJson(response, 200, { home: buildHomePage(database) });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/predictions") {
    sendJson(response, 200, { predictions: getPredictionCards(database, getSessionUser(request)) });
    return;
  }

  if (request.method === "POST" && request.url === "/api/predictions") {
    const sessionUser = getSessionUser(request);
    if (!sessionUser) {
      sendJson(response, 401, { message: "Entre na sua conta para registrar um palpite." });
      return;
    }
    if (sessionUser.status === "bloqueado") {
      sendJson(response, 403, { message: "Sua conta esta bloqueada para participar de palpites." });
      return;
    }

    try {
      const body = await parseBody(request);
      const matchId = Number(body.matchId);
      const homeScore = Number(body.homeScore);
      const awayScore = Number(body.awayScore);
      const match = findMatchById(database, matchId);
      if (!match || match.status !== "agendado") {
        sendJson(response, 400, { message: "Palpites sao permitidos apenas para partidas agendadas." });
        return;
      }
      if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore < 0 || awayScore < 0) {
        sendJson(response, 400, { message: "Informe um placar valido, com numeros inteiros a partir de zero." });
        return;
      }

      let prediction = database.predictions.find((item) => Number(item.matchId) === matchId && Number(item.userId) === Number(sessionUser.id));
      const now = new Date().toISOString();
      const isNew = !prediction;
      if (prediction) {
        prediction.homeScore = homeScore;
        prediction.awayScore = awayScore;
        prediction.updatedAt = now;
      } else {
        prediction = { id: database.predictions.reduce((highest, item) => Math.max(highest, Number(item.id) || 0), 0) + 1, userId: sessionUser.id, matchId, homeScore, awayScore, createdAt: now, updatedAt: now };
        database.predictions.push(prediction);
      }
      writeDatabase(database);
      sendJson(response, 200, { message: isNew ? "Palpite registrado. Agora voce pode participar da conversa." : "Palpite atualizado.", prediction: getPublicPredictionCard(database, match, sessionUser) });
    } catch (error) {
      sendJson(response, 400, { message: "Nao foi possivel registrar o palpite." });
    }
    return;
  }

  if (request.method === "POST" && url.pathname.startsWith("/api/predictions/") && url.pathname.endsWith("/comments")) {
    const sessionUser = getSessionUser(request);
    if (!sessionUser) {
      sendJson(response, 401, { message: "Entre na sua conta para comentar um palpite." });
      return;
    }
    try {
      const predictionId = Number(url.pathname.split("/")[3]);
      const prediction = database.predictions.find((item) => Number(item.id) === predictionId);
      const body = await parseBody(request);
      const content = normalizeText(body.content);
      if (!prediction || Number(prediction.userId) !== Number(sessionUser.id)) {
        sendJson(response, 403, { message: "Registre seu palpite antes de comentar nesta partida." });
        return;
      }
      if (!content || content.length > 500) {
        sendJson(response, 400, { message: "Escreva um comentario de ate 500 caracteres." });
        return;
      }
      const comment = { id: database.predictionComments.reduce((highest, item) => Math.max(highest, Number(item.id) || 0), 0) + 1, predictionId, matchId: prediction.matchId, userId: sessionUser.id, content, createdAt: new Date().toISOString() };
      database.predictionComments.push(comment);
      writeDatabase(database);
      sendJson(response, 201, { message: "Comentario publicado.", comment: getPublicPredictionComment(comment, database) });
    } catch (error) {
      sendJson(response, 400, { message: "Nao foi possivel publicar o comentario." });
    }
    return;
  }

  if (request.method === "PATCH" && url.pathname.startsWith("/api/predictions/") && url.pathname.includes("/comments/")) {
    const sessionUser = getSessionUser(request);
    if (!sessionUser) {
      sendJson(response, 401, { message: "Entre na sua conta para editar o comentario." });
      return;
    }

    try {
      const segments = url.pathname.split("/").filter(Boolean);
      const predictionId = Number(segments[2]);
      const commentId = Number(segments[4]);
      const prediction = database.predictions.find((item) => Number(item.id) === predictionId);
      const comment = database.predictionComments.find((item) => Number(item.id) === commentId && Number(item.predictionId) === predictionId);
      const body = await parseBody(request);
      const content = normalizeText(body.content);

      if (!prediction || !comment) {
        sendJson(response, 404, { message: "Comentario nao encontrado." });
        return;
      }

      if (Number(comment.userId) !== Number(sessionUser.id)) {
        sendJson(response, 403, { message: "Voce so pode editar seu proprio comentario." });
        return;
      }

      if (!content || content.length > 500) {
        sendJson(response, 400, { message: "Escreva um comentario de ate 500 caracteres." });
        return;
      }

      comment.content = content;
      comment.updatedAt = new Date().toISOString();
      writeDatabase(database);

      sendJson(response, 200, {
        message: "Comentario atualizado.",
        comment: getPublicPredictionComment(comment, database)
      });
    } catch (error) {
      sendJson(response, 400, { message: "Nao foi possivel atualizar o comentario." });
    }

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

  if (request.method === "GET" && url.pathname === "/api/search") {
    const query = normalizeText(url.searchParams.get("q") || "");
    const requestedLimit = url.searchParams.get("limit");

    if (!query) {
      sendJson(response, 400, { message: "Informe um termo para buscar." });
      return;
    }

    if (query.length < 2) {
      sendJson(response, 400, { message: "Informe pelo menos 2 caracteres para buscar." });
      return;
    }

    sendJson(response, 200, buildSearchResults(database, query, Number(requestedLimit)));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/galleries") {
    const type = normalizeText(url.searchParams.get("type"));
    const galleries = database.galleries
      .filter((gallery) => gallery.status === "publicado")
      .filter((gallery) => !type || gallery.type === type)
      .sort((a, b) => String(b.publishedAt || b.createdAt || "").localeCompare(String(a.publishedAt || a.createdAt || "")))
      .map((gallery) => getPublicGallery(gallery, database));

    sendJson(response, 200, { galleries });
    return;
  }

  if (request.method === "GET" && request.url === "/api/images") {
    const images = database.images
      .filter((image) => image.isPublic)
      .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")))
      .map(getPublicImage);

    sendJson(response, 200, { images });
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
      user: getPublicUser(getSessionUser(request)),
      favorites: getPublicFavorites(database, getSessionUser(request))
    });
    return;
  }

  if (request.method === "POST" && request.url === "/api/favorites") {
    const sessionUser = getSessionUser(request);

    if (!sessionUser) {
      sendJson(response, 401, { message: "Entre na conta para favoritar conteudos." });
      return;
    }

    try {
      const body = await parseBody(request);
      const type = normalizeText(body.type);
      const itemId = Number(body.itemId);

      if (!["time", "campeonato"].includes(type)) {
        sendJson(response, 400, { message: "Tipo de favorito invalido. Use 'time' ou 'campeonato'." });
        return;
      }

      const itemExists = type === "time"
        ? Boolean(findTeamById(database, itemId))
        : Boolean(findChampionshipById(database, itemId));

      if (!itemExists) {
        sendJson(response, 404, { message: type === "time" ? "Time nao encontrado." : "Campeonato nao encontrado." });
        return;
      }

      const existing = database.favorites.find((favorite) => {
        return Number(favorite.userId) === Number(sessionUser.id) && favorite.type === type && Number(favorite.itemId) === itemId;
      });

      if (existing) {
        sendJson(response, 409, { message: "Este item ja esta nos seus favoritos." });
        return;
      }

      const favorite = {
        id: database.favorites.reduce((highest, item) => Math.max(highest, item.id), 0) + 1,
        userId: sessionUser.id,
        type,
        itemId,
        createdAt: new Date().toISOString()
      };

      database.favorites.push(favorite);
      writeDatabase(database);

      sendJson(response, 201, {
        message: "Item adicionado aos favoritos.",
        favorite: getPublicFavorite(favorite, database)
      });
    } catch (error) {
      sendJson(response, 400, { message: "Nao foi possivel adicionar o favorito." });
    }

    return;
  }

  if (request.method === "GET" && request.url === "/api/favorites") {
    const sessionUser = getSessionUser(request);

    if (!sessionUser) {
      sendJson(response, 401, { message: "Entre na conta para ver seus favoritos." });
      return;
    }

    sendJson(response, 200, {
      favorites: getPublicFavorites(database, sessionUser)
    });
    return;
  }

  if (request.method === "GET" && request.url === "/api/personalized-home") {
    const sessionUser = getSessionUser(request);

    if (!sessionUser) {
      sendJson(response, 401, { message: "Entre na conta para ver seus conteudos personalizados." });
      return;
    }

    sendJson(response, 200, buildPersonalizedHome(database, sessionUser));
    return;
  }

  if (request.method === "DELETE" && url.pathname.startsWith("/api/favorites/")) {
    const sessionUser = getSessionUser(request);

    if (!sessionUser) {
      sendJson(response, 401, { message: "Entre na conta para gerenciar favoritos." });
      return;
    }

    const segments = url.pathname.replace("/api/favorites/", "").split("/").filter(Boolean);
    const type = normalizeText(segments[0]);
    const itemId = Number(segments[1]);

    if (!["time", "campeonato"].includes(type) || !itemId) {
      sendJson(response, 400, { message: "Favorito invalido." });
      return;
    }

    const favorite = database.favorites.find((item) => {
      return Number(item.userId) === Number(sessionUser.id) && item.type === type && Number(item.itemId) === itemId;
    });

    if (!favorite) {
      sendJson(response, 404, { message: "Favorito nao encontrado." });
      return;
    }

    database.favorites = database.favorites.filter((item) => item.id !== favorite.id);
    writeDatabase(database);

    sendJson(response, 200, { message: "Item removido dos favoritos." });
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
        photoUrl: normalizeText(body.photoUrl),
        createdAt: new Date().toISOString()
      };

      database.users.push(user);
      writeDatabase(database);

      const token = crypto.randomBytes(24).toString("hex");
      sessions.set(token, user);

      response.writeHead(201, {
        "Content-Type": "application/json; charset=utf-8",
        "Set-Cookie": buildSessionCookie(token)
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
        "Set-Cookie": buildSessionCookie(token)
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
      const photoUrl = normalizeText(body.photoUrl);

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
      user.photoUrl = photoUrl;

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

  if (request.method === "GET" && request.url === "/api/admin/logs") {
    const admin = requireAdmin(request, response);

    if (!admin) {
      return;
    }

    const logs = database.auditLogs
      .slice()
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .map(getPublicAuditLog);

    sendJson(response, 200, { logs });
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
      recordAuditLog(database, "championship_created", "championship", {
        entityId: championship.id,
        championshipName: championship.name,
        status: championship.status
      }, getSessionUser(request));

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
      const removedName = championship.name;
      database.championships = database.championships.filter((item) => item.id !== championshipId);
      writeDatabase(database);
      recordAuditLog(database, "championship_deleted", "championship", {
        entityId: championshipId,
        championshipName: removedName
      }, getSessionUser(request));
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
      recordAuditLog(database, "championship_updated", "championship", {
        entityId: championship.id,
        championshipName: championship.name,
        status: championship.status
      }, getSessionUser(request));
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
      notifyMatchEvents(database, match, null);
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

      const previousMatchStatus = match.status;

      Object.assign(match, validation.match, {
        closedAt: validation.match.status === "encerrado" ? match.closedAt || new Date().toISOString() : null,
        updatedAt: new Date().toISOString()
      });

      notifyMatchEvents(database, match, previousMatchStatus);
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
      if (validation.article.status === "publicado") {
        notifyNewsPublished(database, article);
      }
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
        notifyNewsPublished(database, article);
      }

      writeDatabase(database);
      sendJson(response, 200, { article: getPublicNewsArticle(article, database, { includeContent: true }) });
    } catch (error) {
      sendJson(response, 400, { message: "Nao foi possivel atualizar a noticia." });
    }

    return;
  }

  if (request.method === "GET" && request.url === "/api/admin/images") {
    if (!requireAdmin(request, response)) {
      return;
    }

    sendJson(response, 200, {
      images: database.images
        .slice()
        .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")))
        .map(getPublicImage)
    });
    return;
  }

  if (request.method === "POST" && request.url === "/api/admin/images") {
    if (!requireAdmin(request, response)) {
      return;
    }

    try {
      const body = await parseBody(request);
      const validation = validateImagePayload(body);

      if (validation.error) {
        sendJson(response, 400, { message: validation.error });
        return;
      }

      const now = new Date().toISOString();
      const image = {
        id: database.images.reduce((highest, item) => Math.max(highest, item.id), 0) + 1,
        ...validation.image,
        createdAt: now,
        updatedAt: now
      };

      database.images.push(image);
      writeDatabase(database);

      sendJson(response, 201, { image: getPublicImage(image) });
    } catch (error) {
      sendJson(response, 400, { message: "Nao foi possivel criar a imagem." });
    }

    return;
  }

  if (request.method === "DELETE" && url.pathname.startsWith("/api/admin/images/")) {
    if (!requireAdmin(request, response)) {
      return;
    }

    try {
      const imageId = Number(url.pathname.split("/").pop());
      const imageIndex = database.images.findIndex((item) => Number(item.id) === imageId);

      if (imageIndex === -1) {
        sendJson(response, 404, { message: "Imagem nao encontrada." });
        return;
      }

      database.images.splice(imageIndex, 1);
      writeDatabase(database);
      sendJson(response, 200, { deleted: true, imageId });
    } catch (error) {
      sendJson(response, 400, { message: "Nao foi possivel excluir a imagem." });
    }

    return;
  }

  if (request.method === "GET" && request.url === "/api/admin/galleries") {
    if (!requireGalleryPublisher(request, response)) {
      return;
    }

    sendJson(response, 200, {
      galleries: database.galleries
        .slice()
        .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")))
        .map((gallery) => getPublicGallery(gallery, database)),
      championships: database.championships.map(getPublicChampionship),
      matches: database.matches.map((match) => getPublicMatch(match, database)),
      statuses: GALLERY_STATUSES,
      types: GALLERY_TYPES
    });
    return;
  }

  if (request.method === "POST" && request.url === "/api/admin/galleries") {
    const publisher = requireGalleryPublisher(request, response);

    if (!publisher) {
      return;
    }

    try {
      const body = await parseBody(request);
      const validation = validateGalleryPayload(database, body);

      if (validation.error) {
        sendJson(response, 400, { message: validation.error });
        return;
      }

      const now = new Date().toISOString();
      const gallery = {
        id: database.galleries.reduce((highest, item) => Math.max(highest, item.id), 0) + 1,
        ...validation.gallery,
        authorId: publisher.id,
        authorName: publisher.name,
        publishedAt: validation.gallery.status === "publicado" ? now : null,
        createdAt: now,
        updatedAt: now
      };

      database.galleries.push(gallery);
      writeDatabase(database);

      sendJson(response, 201, { gallery: getPublicGallery(gallery, database) });
    } catch (error) {
      sendJson(response, 400, { message: "Nao foi possivel criar a galeria." });
    }

    return;
  }

  if (["PUT", "DELETE"].includes(request.method) && url.pathname.startsWith("/api/admin/galleries/")) {
    if (!requireGalleryPublisher(request, response)) {
      return;
    }

    const galleryId = Number(url.pathname.split("/").pop());
    const gallery = findGalleryById(database, galleryId);

    if (!gallery) {
      sendJson(response, 404, { message: "Galeria nao encontrada." });
      return;
    }

    if (request.method === "DELETE") {
      database.galleries = database.galleries.filter((item) => item.id !== galleryId);
      writeDatabase(database);
      sendJson(response, 200, { message: "Galeria excluida." });
      return;
    }

    try {
      const body = await parseBody(request);
      const validation = validateGalleryPayload(database, body, gallery);

      if (validation.error) {
        sendJson(response, 400, { message: validation.error });
        return;
      }

      const wasPublished = gallery.status === "publicado";
      const willPublish = validation.gallery.status === "publicado";

      Object.assign(gallery, validation.gallery, {
        publishedAt: willPublish ? gallery.publishedAt || new Date().toISOString() : null,
        updatedAt: new Date().toISOString()
      });

      if (!wasPublished && willPublish) {
        gallery.publishedAt = new Date().toISOString();
      }

      writeDatabase(database);
      sendJson(response, 200, { gallery: getPublicGallery(gallery, database) });
    } catch (error) {
      sendJson(response, 400, { message: "Nao foi possivel atualizar a galeria." });
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
      recordAuditLog(database, "comment_status_changed", "comment", {
        entityId: comment.id,
        status,
        context: comment.context,
        authorName: comment.authorName
      }, getSessionUser(request));

      sendJson(response, 200, { comment });
    } catch (error) {
      sendJson(response, 400, { message: "Nao foi possivel moderar o comentario." });
    }

    return;
  }

  if (request.method === "DELETE" && url.pathname.startsWith("/api/admin/comments/")) {
    if (!requireAdmin(request, response)) {
      return;
    }

    try {
      const commentId = Number(url.pathname.split("/").pop());
      const newsIndex = database.comments.findIndex((item) => Number(item.id) === commentId);
      const predictionIndex = database.predictionComments.findIndex((item) => Number(item.id) === commentId);

      if (newsIndex === -1 && predictionIndex === -1) {
        sendJson(response, 404, { message: "Comentario nao encontrado." });
        return;
      }

      const removedComment = newsIndex !== -1 ? database.comments[newsIndex] : database.predictionComments[predictionIndex];

      if (newsIndex !== -1) {
        database.comments.splice(newsIndex, 1);
      }

      if (predictionIndex !== -1) {
        database.predictionComments.splice(predictionIndex, 1);
      }

      writeDatabase(database);
      recordAuditLog(database, "comment_deleted", "comment", {
        entityId: commentId,
        context: removedComment ? removedComment.context : "comentario",
        authorName: removedComment ? removedComment.authorName : "desconhecido"
      }, getSessionUser(request));
      sendJson(response, 200, { deleted: true, commentId });
    } catch (error) {
      sendJson(response, 400, { message: "Nao foi possivel excluir o comentario." });
    }

    return;
  }

  if (request.method === "GET" && request.url === "/api/notifications") {
    const sessionUser = getSessionUser(request);

    if (!sessionUser) {
      sendJson(response, 401, { message: "Entre na conta para ver suas notificacoes." });
      return;
    }

    const notifications = database.notifications
      .filter((notification) => Number(notification.userId) === Number(sessionUser.id))
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .map(getPublicNotification);

    sendJson(response, 200, {
      notifications,
      unreadCount: notifications.filter((notification) => !notification.isRead).length
    });
    return;
  }

  if (request.method === "POST" && request.url === "/api/notifications/read") {
    const sessionUser = getSessionUser(request);

    if (!sessionUser) {
      sendJson(response, 401, { message: "Entre na sua conta para gerenciar notificacoes." });
      return;
    }

    try {
      const body = await parseBody(request);
      const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter(Boolean) : [];
      let updated = 0;

      database.notifications.forEach((notification) => {
        if (Number(notification.userId) !== Number(sessionUser.id) || notification.isRead) {
          return;
        }

        if (ids.length === 0 || ids.includes(notification.id)) {
          notification.isRead = true;
          updated += 1;
        }
      });

      writeDatabase(database);
      sendJson(response, 200, {
        message: updated ? "Notificacoes marcadas como lidas." : "Nenhuma notificacao para marcar como lida.",
        updated
      });
    } catch (error) {
      sendJson(response, 400, { message: "Nao foi possivel atualizar as notificacoes." });
    }

    return;
  }

  if (request.method === "DELETE" && url.pathname.startsWith("/api/notifications/")) {
    const sessionUser = getSessionUser(request);

    if (!sessionUser) {
      sendJson(response, 401, { message: "Entre na sua conta para gerenciar notificacoes." });
      return;
    }

    const notificationId = Number(url.pathname.split("/").pop());
    const notification = database.notifications.find((item) => item.id === notificationId);

    if (!notification || Number(notification.userId) !== Number(sessionUser.id)) {
      sendJson(response, 404, { message: "Notificacao nao encontrada." });
      return;
    }

    database.notifications = database.notifications.filter((item) => item.id !== notificationId);
    writeDatabase(database);
    sendJson(response, 200, { message: "Notificacao excluida." });
    return;
  }

  if (request.method === "GET" && request.url === "/api/notification-preferences") {
    const sessionUser = getSessionUser(request);

    if (!sessionUser) {
      sendJson(response, 401, { message: "Entre na sua conta para configurar notificacoes." });
      return;
    }

    sendJson(response, 200, {
      preferences: getNotificationPreferencesForUser(database, sessionUser)
    });
    return;
  }

  if (request.method === "PUT" && request.url === "/api/notification-preferences") {
    const sessionUser = getSessionUser(request);

    if (!sessionUser) {
      sendJson(response, 401, { message: "Entre na sua conta para configurar notificacoes." });
      return;
    }

    try {
      const body = await parseBody(request);
      const requested = Array.isArray(body.preferences) ? body.preferences : [];

      NOTIFICATION_PREFERENCES.forEach((definition) => {
        const requestedValue = requested.find((item) => item.id === definition.id);
        let row = database.notificationPreferences.find((item) => {
          return Number(item.userId) === Number(sessionUser.id) && item.key === definition.id;
        });

        if (!row) {
          row = {
            id: database.notificationPreferences.reduce((highest, item) => Math.max(highest, item.id), 0) + 1,
            userId: sessionUser.id,
            key: definition.id,
            enabled: true
          };
          database.notificationPreferences.push(row);
        }

        if (requestedValue && typeof requestedValue.enabled === "boolean") {
          row.enabled = requestedValue.enabled;
        }
      });

      writeDatabase(database);
      sendJson(response, 200, {
        message: "Preferencias de notificacoes atualizadas.",
        preferences: getNotificationPreferencesForUser(database, sessionUser)
      });
    } catch (error) {
      sendJson(response, 400, { message: "Nao foi possivel atualizar as preferencias." });
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
      "Set-Cookie": buildSessionCookie("", { maxAge: 0 })
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
    ".webmanifest": "application/manifest+json; charset=utf-8",
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
  /* Redireciona trafego HTTP para HTTPS quando habilitado. */
  if (FORCE_HTTPS && !isSecureRequest(request)) {
    response.writeHead(301, { "Location": buildRedirectUrl(request) });
    response.end();
    return;
  }

  /* Log estruturado de requisicoes (JSON) em producao. */
  if (LOG_REQUESTS) {
    logRequest(request, response);
  }

  if (request.url.startsWith("/api/")) {
    handleApi(request, response);
    return;
  }

  serveStatic(request, response);
});

if (require.main === module) {
  server.listen(PORT, () => {
    const protocol = FORCE_HTTPS ? "https" : "http";
    console.log(`[${NODE_ENV}] Lagoa em Jogo ${APP_VERSION} rodando em ${protocol}://localhost:${PORT}`);
  });
}

module.exports = server;

/* ============================================================
   Exportacoes auxiliares para testes (Fase 16 - Testes)
   Nao alteram o contrato de uso: o modulo continua exportando
   o servidor HTTP por padrao. `__testing` expoe funcoes puras
   e constantes para os testes unitarios.
   ============================================================ */
module.exports.__testing = {
  getDefaultMatchScore,
  getDefaultTeamStats,
  getDefaultAthleteStats,
  hasFinishedScore,
  getPredictionOutcome,
  getPredictionSummary,
  getAutomaticTeamStats,
  getChampionshipStatistics,
  getPublicChampionship,
  getPublicTeam,
  getPublicMatch,
  getPublicAthlete,
  getPublicNewsArticle,
  getPublicGallery,
  getGalleryContext,
  buildHomePage,
  buildSearchResults,
  normalizeEmail,
  normalizeText,
  normalizeDate,
  normalizeList,
  normalizeOptionalYear,
  normalizeSearchText,
  matchesSearchQuery,
  isValidRole,
  isAdmin,
  canPublishNews,
  canPublishGallery,
  validateChampionshipPayload,
  validateTeamPayload,
  validateAthletePayload,
  validateMatchPayload,
  validateNewsPayload,
  validateGalleryPayload,
  USER_ROLES,
  COMMENT_STATUSES,
  CHAMPIONSHIP_STATUSES,
  MATCH_STATUSES,
  NEWS_STATUSES,
  GALLERY_STATUSES,
  GALLERY_TYPES,
  NOTIFICATION_TYPES,
  toBoolean,
  isSecureRequest,
  buildRedirectUrl,
  buildSessionCookie,
  getHealthDetails,
  NODE_ENV,
  IS_PRODUCTION,
  APP_VERSION,
  TRUST_PROXY,
  FORCE_HTTPS,
  SECURE_COOKIES,
  LOG_REQUESTS
};
