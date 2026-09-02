/* ============================================================
   Lagoa em Jogo - Painel administrativo (pagina dedicada)
   ============================================================ */

const state = {
  user: null,
  admin: {
    users: [],
    roles: [],
    comments: [],
    championships: [],
    teams: [],
    athletes: [],
    matches: [],
    news: [],
    galleries: [],
    dashboard: null
  }
};

const elements = {
  adminPanel: document.querySelector("#admin-panel"),
  adminLogin: document.querySelector("#admin-login"),
  adminStatus: document.querySelector("#admin-status"),
  adminSession: document.querySelector("#admin-session"),
  adminStats: document.querySelector("#admin-stats"),
  adminLayout: document.querySelector(".admin-layout"),
  adminCards: document.querySelectorAll("#admin-panel > .admin-card:not(.news-manager)"),
  adminUsers: document.querySelector("#admin-users"),
  adminComments: document.querySelector("#admin-comments"),
  reloadAdmin: document.querySelector("#reload-admin"),
  championshipForm: document.querySelector("#championship-form"),
  adminChampionships: document.querySelector("#admin-championships"),
  clearChampionshipForm: document.querySelector("#clear-championship-form"),
  teamForm: document.querySelector("#team-form"),
  teamChampionship: document.querySelector("#team-championship"),
  adminTeams: document.querySelector("#admin-teams"),
  clearTeamForm: document.querySelector("#clear-team-form"),
  athleteForm: document.querySelector("#athlete-form"),
  athleteTeam: document.querySelector("#athlete-team"),
  adminAthletes: document.querySelector("#admin-athletes"),
  clearAthleteForm: document.querySelector("#clear-athlete-form"),
  matchForm: document.querySelector("#match-form"),
  matchChampionship: document.querySelector("#match-championship"),
  matchHomeTeam: document.querySelector("#match-home-team"),
  matchAwayTeam: document.querySelector("#match-away-team"),
  adminMatches: document.querySelector("#admin-matches"),
  clearMatchForm: document.querySelector("#clear-match-form"),
  newsForm: document.querySelector("#news-form"),
  adminNews: document.querySelector("#admin-news"),
  clearNewsForm: document.querySelector("#clear-news-form"),
  galleryForm: document.querySelector("#gallery-form"),
  galleryType: document.querySelector("#gallery-type"),
  galleryChampionship: document.querySelector("#gallery-championship"),
  galleryMatch: document.querySelector("#gallery-match"),
  adminGalleries: document.querySelector("#admin-galleries"),
  clearGalleryForm: document.querySelector("#clear-gallery-form"),
  loginForm: document.querySelector("#login-form"),
  logoutButton: document.querySelector("#logout-button"),
  logoutNav: document.querySelector("#logout-nav"),
  formMessage: document.querySelector("#form-message")
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.message || "Erro na requisicao.");
  }

  return payload;
}

function setMessage(message) {
  elements.formMessage.textContent = message;
}

/* ------------------- Helpers de formatacao ------------------ */

function formatChampionshipStatus(status) {
  const labels = {
    rascunho: "Rascunho",
    inscricoes: "Inscricoes",
    em_andamento: "Em andamento",
    encerrado: "Encerrado"
  };

  return labels[status] || status;
}

function formatChampionshipDates(championship) {
  if (!championship.startDate && !championship.endDate) {
    return "Datas a definir";
  }

  return `${championship.startDate || "A definir"} ate ${championship.endDate || "A definir"}`;
}

function formatMatchStatus(status) {
  const labels = {
    agendado: "Agendado",
    em_andamento: "Em andamento",
    encerrado: "Encerrado"
  };

  return labels[status] || status;
}

function formatMatchScore(match) {
  if (match.score.home === "" || match.score.away === "") {
    return "x";
  }

  return `${match.score.home} x ${match.score.away}`;
}

function formatMatchDateTime(match) {
  return `${match.date || "Data a definir"} as ${match.time || "horario a definir"}`;
}

function getTeamInitials(name) {
  return String(name || "T")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

/* ------------------- Controle de acesso --------------------- */

function isCurrentUserAdmin() {
  return state.user && state.user.role === "administrador";
}

function canCurrentUserManageNews() {
  return state.user && ["administrador", "organizador"].includes(state.user.role);
}

function canCurrentUserPublishGallery() {
  return state.user && ["administrador", "fotografo"].includes(state.user.role);
}

function showLogin(message) {
  elements.adminPanel.hidden = true;
  elements.adminLogin.hidden = false;

  if (elements.logoutButton) {
    elements.logoutButton.hidden = !state.user;
  }

  if (message) {
    elements.adminStatus.textContent = message;
  }
}

function showAdminPanel() {
  elements.adminLogin.hidden = true;
  elements.adminPanel.hidden = false;

  if (elements.logoutButton) {
    elements.logoutButton.hidden = false;
  }
}

function setAdminVisibility(showFullAdmin) {
  elements.adminStats.hidden = !showFullAdmin;
  elements.adminLayout.hidden = !showFullAdmin;
  elements.adminCards.forEach((card) => {
    card.hidden = !showFullAdmin;
  });
  const galleryManager = document.querySelector(".gallery-manager");
  if (galleryManager) {
    galleryManager.hidden = !showFullAdmin && !(state.user && state.user.role === "fotografo");
  }
}
/* ------------------- Opcoes de formulario ------------------- */

function getChampionshipOptions(selectedChampionshipId) {
  return state.admin.championships
    .map((championship) => {
      const selected = championship.id === Number(selectedChampionshipId) ? "selected" : "";
      return `<option value="${championship.id}" ${selected}>${championship.name} - ${championship.season}</option>`;
    })
    .join("");
}

function getTeamOptions(selectedTeamId) {
  return state.admin.teams
    .map((team) => {
      const selected = team.id === Number(selectedTeamId) ? "selected" : "";
      return `<option value="${team.id}" ${selected}>${team.name} - ${team.community}</option>`;
    })
    .join("");
}

function getMatchTeamOptions(championshipId, selectedTeamId) {
  return state.admin.teams
    .filter((team) => team.championshipId === Number(championshipId))
    .map((team) => {
      const selected = team.id === Number(selectedTeamId) ? "selected" : "";
      return `<option value="${team.id}" ${selected}>${team.name} - ${team.community}</option>`;
    })
    .join("");
}

function getMatchOptions(selectedMatchId) {
  return state.admin.matches
    .map((match) => {
      const selected = match.id === Number(selectedMatchId) ? "selected" : "";
      return `<option value="${match.id}" ${selected}>${match.homeTeamName} x ${match.awayTeamName} - ${match.date}</option>`;
    })
    .join("");
}

function getRoleOptions(selectedRole) {
  return state.admin.roles
    .map((role) => {
      const selected = role.id === selectedRole ? "selected" : "";
      return `<option value="${role.id}" ${selected}>${role.name}</option>`;
    })
    .join("");
}

/* ------------------- Dashboard e usuarios -------------------- */

function renderAdminStats() {
  const totals = state.admin.dashboard.totals;

  elements.adminStats.innerHTML = `
    <article>
      <span>Usuarios</span>
      <strong>${totals.users}</strong>
    </article>
    <article>
      <span>Organizadores</span>
      <strong>${totals.organizers}</strong>
    </article>
    <article>
      <span>Fotografos</span>
      <strong>${totals.photographers}</strong>
    </article>
    <article>
      <span>Campeonatos</span>
      <strong>${totals.championships}</strong>
    </article>
    <article>
      <span>Times</span>
      <strong>${totals.teams}</strong>
    </article>
    <article>
      <span>Atletas</span>
      <strong>${totals.athletes}</strong>
    </article>
    <article>
      <span>Jogos</span>
      <strong>${totals.matches}</strong>
    </article>
    <article>
      <span>Noticias</span>
      <strong>${totals.news || 0}</strong>
    </article>
    <article>
      <span>Pendentes</span>
      <strong>${totals.pendingComments}</strong>
    </article>
  `;
}

function renderAdminUsers() {
  elements.adminUsers.innerHTML = state.admin.users
    .map((user) => {
      const activeSelected = user.status === "ativo" ? "selected" : "";
      const blockedSelected = user.status === "bloqueado" ? "selected" : "";

      return `
        <tr>
          <td>${user.name}</td>
          <td>${user.email}</td>
          <td>
            <select data-admin-role="${user.id}">
              ${getRoleOptions(user.role)}
            </select>
          </td>
          <td>
            <select data-admin-status="${user.id}">
              <option value="ativo" ${activeSelected}>Ativo</option>
              <option value="bloqueado" ${blockedSelected}>Bloqueado</option>
            </select>
          </td>
          <td>
            <button class="button compact" type="button" data-save-user="${user.id}">Salvar</button>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderAdminComments() {
  elements.adminComments.innerHTML = state.admin.comments
    .map((comment) => {
      return `
        <article class="comment-item">
          <div>
            <span>${comment.context} - ${comment.status}</span>
            <strong>${comment.authorName}</strong>
            <p>${comment.content}</p>
          </div>
          <div class="comment-actions">
            <button class="button compact" type="button" data-comment-status="aprovado" data-comment-id="${comment.id}">Aprovar</button>
            <button class="button compact danger" type="button" data-comment-status="rejeitado" data-comment-id="${comment.id}">Rejeitar</button>
            <button class="button compact danger" type="button" data-delete-comment="${comment.id}">Excluir</button>
          </div>
        </article>
      `;
    })
    .join("");
}
/* ------------------- Campeonatos ---------------------------- */

function renderAdminChampionships() {
  elements.adminChampionships.innerHTML = state.admin.championships
    .map((championship) => {
      return `
        <article class="admin-championship-item">
          <div>
            <span>${championship.season} - ${formatChampionshipStatus(championship.status)}</span>
            <strong>${championship.name}</strong>
            <p>${championship.description || "Sem descricao."}</p>
            <small>${formatChampionshipDates(championship)}</small>
          </div>
          <div class="comment-actions">
            <button class="button compact" type="button" data-edit-championship="${championship.id}">Editar</button>
            <button class="button compact danger" type="button" data-delete-championship="${championship.id}">Excluir</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function fillChampionshipForm(championship) {
  elements.championshipForm.elements.id.value = championship ? championship.id : "";
  elements.championshipForm.elements.name.value = championship ? championship.name : "";
  elements.championshipForm.elements.season.value = championship ? championship.season : "2026";
  elements.championshipForm.elements.status.value = championship ? championship.status : "rascunho";
  elements.championshipForm.elements.startDate.value = championship ? championship.startDate : "";
  elements.championshipForm.elements.endDate.value = championship ? championship.endDate : "";
  elements.championshipForm.elements.description.value = championship ? championship.description : "";
  elements.championshipForm.elements.regulation.value = championship ? championship.regulation : "";
  elements.championshipForm.elements.awards.value = championship ? championship.awards : "";
}

/* ------------------- Times ---------------------------------- */

function renderAdminTeams() {
  elements.adminTeams.innerHTML = state.admin.teams
    .map((team) => {
      const stats = team.stats || {};

      return `
        <article class="admin-team-item">
          <div>
            <span>${team.championshipName}</span>
            <strong>${team.name}</strong>
            <p>${team.community} ${team.coach ? `- Tecnico: ${team.coach}` : ""}</p>
            <small>${stats.matches || 0} jogos - ${stats.points || 0} pontos</small>
          </div>
          <div class="comment-actions">
            <button class="button compact" type="button" data-edit-team="${team.id}">Editar</button>
            <button class="button compact danger" type="button" data-delete-team="${team.id}">Excluir</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function fillTeamForm(team) {
  elements.teamChampionship.innerHTML = getChampionshipOptions(team ? team.championshipId : state.admin.championships[0]?.id);
  elements.teamForm.elements.id.value = team ? team.id : "";
  elements.teamForm.elements.name.value = team ? team.name : "";
  elements.teamForm.elements.championshipId.value = team ? team.championshipId : state.admin.championships[0]?.id || "";
  elements.teamForm.elements.community.value = team ? team.community : "";
  elements.teamForm.elements.crestUrl.value = team ? team.crestUrl : "";
  elements.teamForm.elements.foundedYear.value = team ? team.foundedYear : "";
  elements.teamForm.elements.coach.value = team ? team.coach : "";
  elements.teamForm.elements.colors.value = team ? team.colors : "";
  elements.teamForm.elements.squad.value = team ? team.squad : "";
  elements.teamForm.elements.upcomingMatches.value = team ? team.upcomingMatches : "";
  elements.teamForm.elements.recentResults.value = team ? team.recentResults : "";
  elements.teamForm.elements.gallery.value = team ? team.gallery : "";
}

/* ------------------- Atletas -------------------------------- */

function renderAdminAthletes() {
  elements.adminAthletes.innerHTML = state.admin.athletes
    .map((athlete) => {
      const stats = athlete.stats || {};

      return `
        <article class="admin-athlete-item">
          <div>
            <span>${athlete.teamName}</span>
            <strong>${athlete.fullName}</strong>
            <p>${athlete.position}${athlete.age ? ` - ${athlete.age} anos` : ""}</p>
            <small>${stats.matches || 0} jogos - ${stats.goals || 0} gols</small>
          </div>
          <div class="comment-actions">
            <button class="button compact" type="button" data-edit-athlete="${athlete.id}">Editar</button>
            <button class="button compact danger" type="button" data-delete-athlete="${athlete.id}">Excluir</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function fillAthleteForm(athlete) {
  elements.athleteTeam.innerHTML = getTeamOptions(athlete ? athlete.teamId : state.admin.teams[0]?.id);
  elements.athleteForm.elements.id.value = athlete ? athlete.id : "";
  elements.athleteForm.elements.fullName.value = athlete ? athlete.fullName : "";
  elements.athleteForm.elements.photoUrl.value = athlete ? athlete.photoUrl : "";
  elements.athleteForm.elements.teamId.value = athlete ? athlete.teamId : state.admin.teams[0]?.id || "";
  elements.athleteForm.elements.position.value = athlete ? athlete.position : "";
  elements.athleteForm.elements.age.value = athlete ? athlete.age : "";
  elements.athleteForm.elements.matches.value = athlete ? athlete.stats.matches : 0;
  elements.athleteForm.elements.goals.value = athlete ? athlete.stats.goals : 0;
  elements.athleteForm.elements.yellowCards.value = athlete ? athlete.stats.yellowCards : 0;
  elements.athleteForm.elements.redCards.value = athlete ? athlete.stats.redCards : 0;
}
/* ------------------- Jogos ---------------------------------- */

function renderAdminMatches() {
  elements.adminMatches.innerHTML = state.admin.matches
    .map((match) => {
      return `
        <article class="admin-match-item">
          <div>
            <span>${match.championshipName} - ${formatMatchStatus(match.status)}</span>
            <strong>${match.homeTeamName} ${formatMatchScore(match)} ${match.awayTeamName}</strong>
            <p>${match.stage} - ${match.round}</p>
            <small>${formatMatchDateTime(match)} - ${match.field}</small>
          </div>
          <div class="comment-actions">
            <button class="button compact" type="button" data-edit-match="${match.id}">Editar</button>
            <button class="button compact danger" type="button" data-delete-match="${match.id}">Excluir</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function fillMatchForm(match) {
  const championshipId = match ? match.championshipId : state.admin.championships[0]?.id || "";
  const championshipTeams = state.admin.teams.filter((team) => team.championshipId === Number(championshipId));
  const defaultHomeTeamId = match ? match.homeTeamId : championshipTeams[0]?.id || "";
  const defaultAwayTeamId = match ? match.awayTeamId : championshipTeams[1]?.id || "";
  elements.matchChampionship.innerHTML = getChampionshipOptions(championshipId);
  elements.matchHomeTeam.innerHTML = getMatchTeamOptions(championshipId, defaultHomeTeamId);
  elements.matchAwayTeam.innerHTML = getMatchTeamOptions(championshipId, defaultAwayTeamId);
  elements.matchForm.elements.id.value = match ? match.id : "";
  elements.matchForm.elements.championshipId.value = championshipId;
  elements.matchForm.elements.stage.value = match ? match.stage : "Primeira fase";
  elements.matchForm.elements.round.value = match ? match.round : "";
  elements.matchForm.elements.homeTeamId.value = defaultHomeTeamId;
  elements.matchForm.elements.awayTeamId.value = defaultAwayTeamId;
  elements.matchForm.elements.date.value = match ? match.date : "";
  elements.matchForm.elements.time.value = match ? match.time : "";
  elements.matchForm.elements.field.value = match ? match.field : "";
  elements.matchForm.elements.location.value = match ? match.location : "";
  elements.matchForm.elements.homeScore.value = match ? match.score.home : "";
  elements.matchForm.elements.awayScore.value = match ? match.score.away : "";
  elements.matchForm.elements.status.value = match ? match.status : "agendado";
}

/* ------------------- Noticias ------------------------------- */

function renderAdminNews() {
  elements.adminNews.innerHTML = state.admin.news
    .map((article) => {
      return `
        <article class="admin-news-item">
          <div>
            <span>${article.category} - ${article.status}</span>
            <strong>${article.title}</strong>
            <p>${article.summary}</p>
            <small>${article.authorName} - ${article.publishedAt || "Nao publicado"}</small>
          </div>
          <div class="comment-actions">
            <button class="button compact" type="button" data-edit-news="${article.id}">Editar</button>
            <button class="button compact danger" type="button" data-delete-news="${article.id}">Excluir</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function fillNewsForm(article) {
  elements.newsForm.elements.id.value = article ? article.id : "";
  elements.newsForm.elements.title.value = article ? article.title : "";
  elements.newsForm.elements.category.value = article ? article.category : "";
  elements.newsForm.elements.status.value = article ? article.status : "rascunho";
  elements.newsForm.elements.coverImageUrl.value = article ? article.coverImageUrl : "";
  elements.newsForm.elements.summary.value = article ? article.summary : "";
  elements.newsForm.elements.content.value = article ? article.content : "";
  elements.newsForm.elements.galleryImages.value = article ? article.galleryImages.join("\n") : "";
}
/* ------------------- Galerias ------------------------------- */

function fillGalleryForm(gallery) {
  elements.galleryForm.elements.id.value = gallery ? gallery.id : "";
  elements.galleryForm.elements.title.value = gallery ? gallery.title : "";
  elements.galleryForm.elements.type.value = gallery ? gallery.type : "campeonato";
  elements.galleryForm.elements.status.value = gallery ? gallery.status : "rascunho";
  const championshipId = gallery ? gallery.championshipId : state.admin.championships[0]?.id || "";
  const matchId = gallery ? gallery.matchId : state.admin.matches[0]?.id || "";
  elements.galleryChampionship.innerHTML = getChampionshipOptions(championshipId);
  elements.galleryForm.elements.championshipId.value = championshipId;
  elements.galleryMatch.innerHTML = getMatchOptions(matchId);
  elements.galleryForm.elements.matchId.value = matchId;
  elements.galleryForm.elements.eventName.value = gallery ? gallery.eventName : "";
  elements.galleryForm.elements.description.value = gallery ? gallery.description : "";
  elements.galleryForm.elements.images.value = gallery ? gallery.images.join("\n") : "";
  elements.galleryForm.elements.saleUrl.value = gallery ? gallery.saleUrl : "";
}

function renderAdminGalleries() {
  elements.adminGalleries.innerHTML = state.admin.galleries
    .map((gallery) => {
      return `
        <article class="admin-gallery-item">
          <div>
            <span>${gallery.type} - ${gallery.status}</span>
            <strong>${gallery.title}</strong>
            <p>${gallery.context}</p>
            <small>${gallery.images.length} imagem(ns) - ${gallery.authorName}${gallery.publishedAt ? " - " + new Date(gallery.publishedAt).toLocaleDateString("pt-BR") : ""}</small>
          </div>
          <div class="comment-actions">
            <button class="button compact" type="button" data-edit-gallery="${gallery.id}">Editar</button>
            <button class="button compact danger" type="button" data-delete-gallery="${gallery.id}">Excluir</button>
          </div>
        </article>
      `;
    })
    .join("");
}

/* ------------------- Carregamento do painel ----------------- */

async function refreshAdminPanel() {
  if (!canCurrentUserManageNews() && !canCurrentUserPublishGallery()) {
    showLogin("Entre com uma conta autorizada para carregar o painel.");
    return;
  }

  try {
    if (state.user && state.user.role === "fotografo") {
      const galleriesData = await api("/api/admin/galleries");

      state.admin.galleries = galleriesData.galleries;
      state.admin.championships = galleriesData.championships;
      state.admin.matches = galleriesData.matches;
      showAdminPanel();
      elements.adminStatus.textContent = "Painel de galerias carregado para fotografos.";
      setAdminVisibility(false);
      fillGalleryForm(null);
      renderAdminGalleries();
      return;
    }

    if (!isCurrentUserAdmin()) {
      const newsData = await api("/api/admin/news");

      state.admin.news = newsData.news;
      showAdminPanel();
      elements.adminStatus.textContent = "Painel de noticias carregado para organizadores.";
      setAdminVisibility(false);
      fillNewsForm(null);
      renderAdminNews();
      return;
    }

    const [dashboard, usersData, commentsData, championshipsData, teamsData, athletesData, matchesData, newsData, galleriesData] = await Promise.all([
      api("/api/admin/dashboard"),
      api("/api/admin/users"),
      api("/api/admin/comments"),
      api("/api/admin/championships"),
      api("/api/admin/teams"),
      api("/api/admin/athletes"),
      api("/api/admin/matches"),
      api("/api/admin/news"),
      api("/api/admin/galleries")
    ]);

    state.admin.dashboard = dashboard;
    state.admin.users = usersData.users;
    state.admin.roles = usersData.roles;
    state.admin.comments = commentsData.comments;
    state.admin.championships = championshipsData.championships;
    state.admin.teams = teamsData.teams;
    state.admin.athletes = athletesData.athletes;
    state.admin.matches = matchesData.matches;
    state.admin.news = newsData.news;
    state.admin.galleries = galleriesData.galleries;

    showAdminPanel();
    elements.adminStatus.textContent = "Painel carregado para administradores.";
    setAdminVisibility(true);
    renderAdminStats();
    renderAdminUsers();
    renderAdminComments();
    renderAdminChampionships();
    fillChampionshipForm(null);
    fillTeamForm(null);
    renderAdminTeams();
    fillAthleteForm(null);
    renderAdminAthletes();
    fillMatchForm(null);
    renderAdminMatches();
    fillNewsForm(null);
    renderAdminNews();
    fillGalleryForm(null);
    renderAdminGalleries();
  } catch (error) {
    elements.adminStatus.textContent = error.message;
    elements.adminPanel.hidden = true;
  }
}
async function loadAdminSession() {
  try {
    const data = await api("/api/me");
    state.user = data.user;

    if (state.user) {
      elements.adminSession.textContent = `Conectado como ${state.user.name} (${state.user.role}).`;
      await refreshAdminPanel();
      return;
    }

    elements.adminSession.textContent = "Nenhum usuario conectado.";
    showLogin("Entre como administrador, organizador ou fotografo autorizado para carregar o painel.");
  } catch (error) {
    elements.adminStatus.textContent = error.message;
    showLogin();
  }
}

/* ============================================================
   Eventos do formulario de login / logout
   ============================================================ */

elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(elements.loginForm);

  try {
    const data = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password")
      })
    });

    state.user = data.user;
    elements.adminSession.textContent = `Conectado como ${state.user.name} (${state.user.role}).`;
    setMessage("Login realizado com sucesso.");
    await refreshAdminPanel();
  } catch (error) {
    setMessage(error.message);
  }
});

async function handleLogout() {
  try {
    await api("/api/logout", { method: "POST" });
  } catch (error) {
    // Sessao local encerrada mesmo se a API falhar ao responder.
  }

  state.user = null;
  elements.adminSession.textContent = "Sessao encerrada.";
  elements.loginForm.reset();
  showLogin("Entre como administrador, organizador ou fotografo autorizado para carregar o painel.");
  elements.adminStatus.textContent = "Sessao encerrada. Faca login para acessar o painel.";
  setMessage("");
}

if (elements.logoutButton) {
  elements.logoutButton.addEventListener("click", handleLogout);
}

if (elements.logoutNav) {
  elements.logoutNav.addEventListener("click", handleLogout);
}

/* ============================================================
   Eventos do painel administrativo
   ============================================================ */

if (elements.reloadAdmin) {
  elements.reloadAdmin.addEventListener("click", () => {
    refreshAdminPanel();
  });
}

elements.galleryType.addEventListener("change", () => {
  const type = elements.galleryType.value;
  elements.galleryForm.elements.championshipId.closest("label").style.display = type === "campeonato" ? "" : "none";
  elements.galleryForm.elements.matchId.closest("label").style.display = type === "jogo" ? "" : "none";
  elements.galleryForm.elements.eventName.closest("label").style.display = type === "evento" ? "" : "none";
});
elements.championshipForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(elements.championshipForm);
  const championshipId = formData.get("id");
  const payload = {
    name: formData.get("name"),
    season: formData.get("season"),
    status: formData.get("status"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    description: formData.get("description"),
    regulation: formData.get("regulation"),
    awards: formData.get("awards")
  };

  try {
    await api(championshipId ? `/api/admin/championships/${championshipId}` : "/api/admin/championships", {
      method: championshipId ? "PUT" : "POST",
      body: JSON.stringify(payload)
    });
    fillChampionshipForm(null);
    await refreshAdminPanel();
  } catch (error) {
    elements.adminStatus.textContent = error.message;
  }
});

elements.clearChampionshipForm.addEventListener("click", () => {
  fillChampionshipForm(null);
});

elements.adminChampionships.addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-edit-championship]");
  const deleteButton = event.target.closest("[data-delete-championship]");

  if (editButton) {
    const championship = state.admin.championships.find((item) => {
      return item.id === Number(editButton.dataset.editChampionship);
    });
    fillChampionshipForm(championship);
    return;
  }

  if (!deleteButton) {
    return;
  }

  try {
    await api(`/api/admin/championships/${deleteButton.dataset.deleteChampionship}`, {
      method: "DELETE"
    });
    fillChampionshipForm(null);
    await refreshAdminPanel();
  } catch (error) {
    elements.adminStatus.textContent = error.message;
  }
});

elements.teamForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(elements.teamForm);
  const teamId = formData.get("id");
  const payload = {
    name: formData.get("name"),
    championshipId: formData.get("championshipId"),
    community: formData.get("community"),
    crestUrl: formData.get("crestUrl"),
    foundedYear: formData.get("foundedYear"),
    coach: formData.get("coach"),
    colors: formData.get("colors"),
    squad: formData.get("squad"),
    upcomingMatches: formData.get("upcomingMatches"),
    recentResults: formData.get("recentResults"),
    gallery: formData.get("gallery")
  };

  try {
    await api(teamId ? `/api/admin/teams/${teamId}` : "/api/admin/teams", {
      method: teamId ? "PUT" : "POST",
      body: JSON.stringify(payload)
    });
    fillTeamForm(null);
    await refreshAdminPanel();
  } catch (error) {
    elements.adminStatus.textContent = error.message;
  }
});

elements.clearTeamForm.addEventListener("click", () => {
  fillTeamForm(null);
});

elements.adminTeams.addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-edit-team]");
  const deleteButton = event.target.closest("[data-delete-team]");

  if (editButton) {
    const team = state.admin.teams.find((item) => {
      return item.id === Number(editButton.dataset.editTeam);
    });
    fillTeamForm(team);
    return;
  }

  if (!deleteButton) {
    return;
  }

  try {
    await api(`/api/admin/teams/${deleteButton.dataset.deleteTeam}`, {
      method: "DELETE"
    });
    fillTeamForm(null);
    await refreshAdminPanel();
  } catch (error) {
    elements.adminStatus.textContent = error.message;
  }
});

elements.athleteForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(elements.athleteForm);
  const athleteId = formData.get("id");
  const payload = {
    fullName: formData.get("fullName"),
    photoUrl: formData.get("photoUrl"),
    teamId: formData.get("teamId"),
    position: formData.get("position"),
    age: formData.get("age"),
    stats: {
      matches: formData.get("matches"),
      goals: formData.get("goals"),
      yellowCards: formData.get("yellowCards"),
      redCards: formData.get("redCards")
    }
  };

  try {
    await api(athleteId ? `/api/admin/athletes/${athleteId}` : "/api/admin/athletes", {
      method: athleteId ? "PUT" : "POST",
      body: JSON.stringify(payload)
    });
    fillAthleteForm(null);
    await refreshAdminPanel();
  } catch (error) {
    elements.adminStatus.textContent = error.message;
  }
});

elements.clearAthleteForm.addEventListener("click", () => {
  fillAthleteForm(null);
});

elements.adminAthletes.addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-edit-athlete]");
  const deleteButton = event.target.closest("[data-delete-athlete]");

  if (editButton) {
    const athlete = state.admin.athletes.find((item) => {
      return item.id === Number(editButton.dataset.editAthlete);
    });
    fillAthleteForm(athlete);
    return;
  }

  if (!deleteButton) {
    return;
  }

  try {
    await api(`/api/admin/athletes/${deleteButton.dataset.deleteAthlete}`, {
      method: "DELETE"
    });
    fillAthleteForm(null);
    await refreshAdminPanel();
  } catch (error) {
    elements.adminStatus.textContent = error.message;
  }
});

elements.matchForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(elements.matchForm);
  const matchId = formData.get("id");
  const payload = {
    championshipId: formData.get("championshipId"),
    stage: formData.get("stage"),
    round: formData.get("round"),
    homeTeamId: formData.get("homeTeamId"),
    awayTeamId: formData.get("awayTeamId"),
    date: formData.get("date"),
    time: formData.get("time"),
    field: formData.get("field"),
    location: formData.get("location"),
    score: {
      home: formData.get("homeScore"),
      away: formData.get("awayScore")
    },
    status: formData.get("status")
  };

  try {
    await api(matchId ? `/api/admin/matches/${matchId}` : "/api/admin/matches", {
      method: matchId ? "PUT" : "POST",
      body: JSON.stringify(payload)
    });
    fillMatchForm(null);
    await refreshAdminPanel();
  } catch (error) {
    elements.adminStatus.textContent = error.message;
  }
});

elements.clearMatchForm.addEventListener("click", () => {
  fillMatchForm(null);
});

elements.adminMatches.addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-edit-match]");
  const deleteButton = event.target.closest("[data-delete-match]");

  if (editButton) {
    const match = state.admin.matches.find((item) => {
      return item.id === Number(editButton.dataset.editMatch);
    });
    fillMatchForm(match);
    return;
  }

  if (!deleteButton) {
    return;
  }

  try {
    await api(`/api/admin/matches/${deleteButton.dataset.deleteMatch}`, {
      method: "DELETE"
    });
    fillMatchForm(null);
    await refreshAdminPanel();
  } catch (error) {
    elements.adminStatus.textContent = error.message;
  }
});

elements.newsForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(elements.newsForm);
  const newsId = formData.get("id");
  const payload = {
    title: formData.get("title"),
    category: formData.get("category"),
    status: formData.get("status"),
    coverImageUrl: formData.get("coverImageUrl"),
    summary: formData.get("summary"),
    content: formData.get("content"),
    galleryImages: formData.get("galleryImages")
  };

  try {
    await api(newsId ? `/api/admin/news/${newsId}` : "/api/admin/news", {
      method: newsId ? "PUT" : "POST",
      body: JSON.stringify(payload)
    });
    fillNewsForm(null);
    await refreshAdminPanel();
  } catch (error) {
    elements.adminStatus.textContent = error.message;
  }
});

elements.clearNewsForm.addEventListener("click", () => {
  fillNewsForm(null);
});

elements.adminNews.addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-edit-news]");
  const deleteButton = event.target.closest("[data-delete-news]");

  if (editButton) {
    const article = state.admin.news.find((item) => {
      return item.id === Number(editButton.dataset.editNews);
    });
    fillNewsForm(article);
    return;
  }

  if (!deleteButton) {
    return;
  }

  try {
    await api(`/api/admin/news/${deleteButton.dataset.deleteNews}`, {
      method: "DELETE"
    });
    fillNewsForm(null);
    await refreshAdminPanel();
  } catch (error) {
    elements.adminStatus.textContent = error.message;
  }
});

elements.galleryForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(elements.galleryForm);
  const galleryId = formData.get("id");
  const payload = {
    title: formData.get("title"),
    type: formData.get("type"),
    status: formData.get("status"),
    championshipId: formData.get("championshipId"),
    matchId: formData.get("matchId"),
    eventName: formData.get("eventName"),
    description: formData.get("description"),
    images: formData.get("images"),
    saleUrl: formData.get("saleUrl")
  };

  try {
    await api(galleryId ? `/api/admin/galleries/${galleryId}` : "/api/admin/galleries", {
      method: galleryId ? "PUT" : "POST",
      body: JSON.stringify(payload)
    });
    fillGalleryForm(null);
    await refreshAdminPanel();
  } catch (error) {
    elements.adminStatus.textContent = error.message;
  }
});

elements.clearGalleryForm.addEventListener("click", () => {
  fillGalleryForm(null);
});

elements.adminGalleries.addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-edit-gallery]");
  const deleteButton = event.target.closest("[data-delete-gallery]");

  if (editButton) {
    const gallery = state.admin.galleries.find((item) => {
      return item.id === Number(editButton.dataset.editGallery);
    });
    fillGalleryForm(gallery);
    return;
  }

  if (!deleteButton) {
    return;
  }

  try {
    await api(`/api/admin/galleries/${deleteButton.dataset.deleteGallery}`, {
      method: "DELETE"
    });
    fillGalleryForm(null);
    await refreshAdminPanel();
  } catch (error) {
    elements.adminStatus.textContent = error.message;
  }
});

elements.adminUsers.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-save-user]");

  if (!button) {
    return;
  }

  const userId = button.dataset.saveUser;
  const role = elements.adminUsers.querySelector(`[data-admin-role="${userId}"]`).value;
  const status = elements.adminUsers.querySelector(`[data-admin-status="${userId}"]`).value;

  try {
    await api(`/api/admin/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ role, status })
    });
    setMessage("Usuario atualizado pelo painel administrativo.");
    await refreshAdminPanel();
  } catch (error) {
    elements.adminStatus.textContent = error.message;
  }
});

elements.adminComments.addEventListener("click", async (event) => {
  const statusButton = event.target.closest("[data-comment-id]");
  const deleteButton = event.target.closest("[data-delete-comment]");

  if (statusButton) {
    try {
      await api(`/api/admin/comments/${statusButton.dataset.commentId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: statusButton.dataset.commentStatus })
      });
      await refreshAdminPanel();
    } catch (error) {
      elements.adminStatus.textContent = error.message;
    }
    return;
  }

  if (deleteButton) {
    try {
      await api(`/api/admin/comments/${deleteButton.dataset.deleteComment}`, {
        method: "DELETE"
      });
      await refreshAdminPanel();
    } catch (error) {
      elements.adminStatus.textContent = error.message;
    }
  }
});

/* ============================================================
   Tema claro/escuro + navegacao mobile + PWA
   ============================================================ */

const themeToggle = document.querySelector("#theme-toggle");
const themeMeta = document.querySelector('meta[name="theme-color"]');
const rootEl = document.documentElement;

function applyTheme(theme) {
  rootEl.setAttribute("data-theme", theme);
  try {
    localStorage.setItem("lej-theme", theme);
  } catch (error) {
    // localStorage pode estar indisponivel; ignora.
  }

  if (themeMeta) {
    themeMeta.setAttribute("content", theme === "dark" ? "#0d141d" : "#1155cc");
  }
}

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const next = rootEl.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(next);
  });
}

/* Navegacao mobile (hamburguer) */
const navToggle = document.querySelector("#nav-toggle");
const mainNav = document.querySelector("#main-nav");
const navBackdrop = document.querySelector("#nav-backdrop");

function closeMenuPanels() {
  if (mainNav) {
    mainNav.classList.remove("open");
  }
  if (navToggle) {
    navToggle.setAttribute("aria-expanded", "false");
  }
  if (navBackdrop) {
    navBackdrop.classList.remove("open");
  }
}

if (navToggle && mainNav) {
  navToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    const open = mainNav.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(open));
    if (navBackdrop) {
      navBackdrop.classList.toggle("open", open);
    }
  });
}

/* Botao de fechar dentro do menu \"Mais\" */
const navDrawerClose = document.querySelector("#nav-drawer-close");

if (navDrawerClose) {
  navDrawerClose.addEventListener("click", closeMenuPanels);
}

/* Fecha os paineis ao clicar em qualquer link do menu */
document.querySelectorAll(".main-nav a, .nav-drawer a").forEach((link) => {
  link.addEventListener("click", closeMenuPanels);
});

if (navBackdrop) {
  navBackdrop.addEventListener("click", closeMenuPanels);
}

/* Fecha os menus com a tecla Esc (acessibilidade) */
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMenuPanels();
  }
});

/* Registro do service worker (PWA) */
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      // Falha silenciosa: a app continua funcionando sem SW.
    });
  });
}

loadAdminSession().catch((error) => {
  setMessage(error.message);
});