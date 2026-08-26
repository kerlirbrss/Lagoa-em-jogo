const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { setupTestEnv, loadDatabase } = require("./helpers.js");

setupTestEnv();
const { __testing: t } = require("../backend/server.js");
const db = loadDatabase();

describe("Testes unitarios - normalizacao", () => {
  test("normalizeEmail normaliza espacos e minusculas", () => {
    assert.equal(t.normalizeEmail("  Joao@Lagoa.Local "), "joao@lagoa.local");
    assert.equal(t.normalizeEmail(undefined), "");
  });

  test("normalizeText remove espacos", () => {
    assert.equal(t.normalizeText("  time  "), "time");
    assert.equal(t.normalizeText(null), "");
  });

  test("normalizeList aceita array e transforma texto", () => {
    assert.deepEqual(t.normalizeList([" a ", "", "b"]), ["a", "b"]);
    assert.deepEqual(t.normalizeList("a,b\n c"), ["a", "b", "c"]);
  });

  test("normalizeSearchText remove acentos", () => {
    assert.equal(t.normalizeSearchText("Café"), "cafe");
    assert.equal(t.matchesSearchQuery("Campeonato Rural", "rural"), true);
    assert.equal(t.matchesSearchQuery("Lagoa", "lag"), true);
  });
});

describe("Testes unitarios - placares e vencedores", () => {
  test("getDefaultMatchScore padroniza valores vazios e numeros", () => {
    assert.deepEqual(t.getDefaultMatchScore({}), { home: "", away: "" });
    assert.deepEqual(t.getDefaultMatchScore({ home: "2", away: 1 }), { home: 2, away: 1 });
  });

  test("hasFinishedScore so considera jogo encerrado com placar", () => {
    assert.equal(t.hasFinishedScore({ status: "encerrado", score: { home: 2, away: 1 } }), true);
    assert.equal(t.hasFinishedScore({ status: "agendado", score: { home: 2, away: 1 } }), false);
    assert.equal(t.hasFinishedScore({ status: "encerrado", score: { home: "", away: 1 } }), false);
  });

  test("getPredictionOutcome classifica resultados", () => {
    assert.equal(t.getPredictionOutcome(2, 1), "casa");
    assert.equal(t.getPredictionOutcome(0, 1), "fora");
    assert.equal(t.getPredictionOutcome(1, 1), "empate");
  });
});

describe("Testes unitarios - estatisticas automaticas", () => {
  test("getAutomaticTeamStats soma pontos do campeonato", () => {
    const stats = t.getAutomaticTeamStats(db, 3);
    assert.equal(stats.matches, 2);
    assert.equal(stats.wins, 2);
    assert.equal(stats.points, 6);
    assert.ok(stats.goalsFor >= 6);
  });

  test("getChampionshipStatistics ordena classificacao e artilharia", () => {
    const stats = t.getChampionshipStatistics(db, 1);
    assert.ok(stats, "Estatistica deve existir");
    assert.ok(stats.standings.length >= 4);
    assert.equal(stats.standings[0].position, 1);
    assert.ok(stats.topScorers.length >= 1);
    assert.equal(stats.championship.name, "Campeonato Rural");
  });
});

describe("Testes unitarios - permissoes e validacao de papel", () => {
  test("isValidRole valida perfis", () => {
    assert.equal(t.isValidRole("administrador"), true);
    assert.equal(t.isValidRole("usuario"), true);
    assert.equal(t.isValidRole("visitante"), false);
    assert.equal(t.isValidRole("desconhecido"), false);
  });

  test("isAdmin / canPublishNews / canPublishGallery", () => {
    const admin = { role: "administrador" };
    const organizer = { role: "organizador" };
    const photographer = { role: "fotografo" };
    const user = { role: "usuario" };

    assert.equal(t.isAdmin(admin), true);
    assert.equal(t.isAdmin(user), false);
    assert.equal(t.canPublishNews(admin), true);
    assert.equal(t.canPublishNews(organizer), true);
    assert.equal(t.canPublishNews(user), false);
    assert.equal(t.canPublishGallery(photographer), true);
    assert.equal(t.canPublishGallery(organizer), false);
  });
});

describe("Testes unitarios - validacao de payloads", () => {
  test("validateChampionshipPayload aceita payload valido", () => {
    const result = t.validateChampionshipPayload({ name: "Copa Teste", season: "2026", status: "inscricoes" });
    assert.equal(result.error, undefined);
    assert.equal(result.championship.name, "Copa Teste");
  });

  test("validateChampionshipPayload rejeita nome curto", () => {
    const result = t.validateChampionshipPayload({ name: "Ab", season: "2026" });
    assert.ok(result.error);
  });

  test("validateChampionshipPayload rejeita status invalido", () => {
    const result = t.validateChampionshipPayload({ name: "Copa Teste", season: "2026", status: "errado" });
    assert.ok(result.error);
  });

  test("validateNewsPayload rejeita titulo curto e aceita valido", () => {
    const bad = t.validateNewsPayload({ title: "Tit", category: "Noticias", summary: "Resumo com mais texto", content: "Conteudo bem maior do que vinte caracteres" });
    assert.ok(bad.error);
    const good = t.validateNewsPayload({ title: "Titulo completo da noticia", category: "Noticias", summary: "Resumo com mais texto", content: "Conteudo bem maior do que vinte caracteres aqui" });
    assert.equal(good.error, undefined);
  });

  test("validateTeamPayload rejeita time de campeonato inexistente", () => {
    const result = t.validateTeamPayload(db, { name: "Time X", championshipId: 9999, community: "Centro" });
    assert.ok(result.error);
  });

  test("validateMatchPayload rejeita jogo encerrado sem placar", () => {
    const result = t.validateMatchPayload(db, {
      championshipId: 1,
      homeTeamId: 1,
      awayTeamId: 2,
      stage: "Primeira fase",
      round: "Rodada 1",
      date: "2026-08-01",
      time: "16:00",
      field: "Campo",
      location: "Centro",
      status: "encerrado",
      score: { home: "", away: "" }
    });
    assert.ok(result.error);
  });
});

describe("Testes unitarios - agregacoes publicas", () => {
  test("buildHomePage retorna bloco completo", () => {
    const home = t.buildHomePage(db);
    assert.ok(Array.isArray(home.upcomingMatches));
    assert.ok(Array.isArray(home.recentResults));
    assert.ok(home.standings && Array.isArray(home.standings.teams));
    assert.ok(Array.isArray(home.topScorers));
    assert.ok(Array.isArray(home.featuredNews));
    assert.ok(Array.isArray(home.galleryPreview));
  });

  test("buildSearchResults encontra 'rural' em campeonatos", () => {
    const results = t.buildSearchResults(db, "rural", 5);
    assert.ok(results.total >= 1);
    assert.ok(results.results.championships.some((c) => c.name.includes("rural") || c.name.includes("Rural")));
  });

  test("getPublicChampionship retorna campos publicos", () => {
    const c = t.getPublicChampionship(db.championships[0]);
    assert.equal("id" in c, true);
    assert.equal("name" in c, true);
    assert.equal("createdAt" in c, true);
  });
});