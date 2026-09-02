const state = {
  user: null,
  favorites: [],
  personalizedHome: null,
  championships: [],
  teams: [],
  predictions: [],
  notifications: [],
  unreadCount: 0,
  notificationPreferences: []
};

const elements = {
  championships: document.querySelector("#championships"),
  teams: document.querySelector("#teams"),
  athletes: document.querySelector("#athletes"),
  matches: document.querySelector("#matches"),
  predictionsList: document.querySelector("#predictions-list"),
  predictionsStatus: document.querySelector("#predictions-status"),
  homeHubStatus: document.querySelector("#home-hub-status"),
  homeUpcomingMatches: document.querySelector("#home-upcoming-matches"),
  homeRecentResults: document.querySelector("#home-recent-results"),
  homeStandingsContext: document.querySelector("#home-standings-context"),
  homeStandings: document.querySelector("#home-standings"),
  homeTopScorers: document.querySelector("#home-top-scorers"),
  homeAthleteWeek: document.querySelector("#home-athlete-week"),
  homeFeaturedNews: document.querySelector("#home-featured-news"),
  homeGalleryPreview: document.querySelector("#home-gallery-preview"),
  newsList: document.querySelector("#news-list"),
  featuredMatch: document.querySelector("#featured-match"),
  statisticsChampionship: document.querySelector("#statistics-championship"),
  statisticsStatus: document.querySelector("#statistics-status"),
  standings: document.querySelector("#standings"),
  statisticsRankings: document.querySelector("#statistics-rankings"),
  roles: document.querySelector("#roles"),
  loginForm: document.querySelector("#login-form"),
  registerForm: document.querySelector("#register-form"),
  profileForm: document.querySelector("#profile-form"),
  resetForm: document.querySelector("#reset-form"),
  logoutButton: document.querySelector("#logout-button"),
  sessionStatus: document.querySelector("#session-status"),
  formMessage: document.querySelector("#form-message"),
  tabButtons: document.querySelectorAll(".tab-button"),
  accountForms: document.querySelectorAll(".account-form"),
  galleryList: document.querySelector("#gallery-list"),
  searchForm: document.querySelector("#search-form"),
  searchInput: document.querySelector("#search-input"),
  searchResultsSection: document.querySelector("#resultados"),
  searchStatus: document.querySelector("#search-status"),
  searchResults: document.querySelector("#search-results"),
  favoritesSection: document.querySelector("#favoritos"),
  favoritesList: document.querySelector("#favorites-list"),
  personalizedContent: document.querySelector("#personalized-content"),
  notificationBell: document.querySelector("#notification-bell"),
  notificationBadge: document.querySelector("#notification-badge"),
  notificationsSection: document.querySelector("#notificacoes"),
  notificationsList: document.querySelector("#notifications-list"),
  notificationsStatus: document.querySelector("#notifications-status"),
  markAllNotifications: document.querySelector("#mark-all-notifications"),
  preferencesForm: document.querySelector("#preferences-form"),
  preferencesGrid: document.querySelector("#preferences-grid"),
  contactForm: document.querySelector("#contact-form"),
  contactStatus: document.querySelector("#contact-status")
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

function renderChampionships(championships) {
  elements.championships.innerHTML = championships
    .map((championship) => {
      return `
        <article class="championship-card">
          <div class="card-topbar">
            <span>${championship.season} - ${formatChampionshipStatus(championship.status)}</span>
            ${getFavoriteButtonHtml("campeonato", championship.id)}
          </div>
          <h3>${championship.name}</h3>
          <p>${championship.description || "Campeonato em preparacao."}</p>
          <small>${formatChampionshipDates(championship)}</small>
        </article>
      `;
    })
    .join("");
}

function renderTeams(teams) {
  elements.teams.innerHTML = teams
    .map((team) => {
      const stats = team.stats || {};
      const crest = team.crestUrl
        ? `<img src="${team.crestUrl}" alt="Escudo do ${team.name}" loading="lazy" decoding="async">`
        : `<span>${getTeamInitials(team.name)}</span>`;

      return `
        <article class="team-card">
          <div class="team-card-header">
            <div class="team-crest">${crest}</div>
            <div>
              <span>${team.championshipName}</span>
              <h3>${team.name}</h3>
            </div>
            ${getFavoriteButtonHtml("time", team.id)}
          </div>
          <p>${team.community}</p>
          <dl class="team-meta">
            <div>
              <dt>Tecnico</dt>
              <dd>${team.coach || "A definir"}</dd>
            </div>
            <div>
              <dt>Cores</dt>
              <dd>${team.colors || "A definir"}</dd>
            </div>
          </dl>
          <div class="team-stats">
            <span>${stats.matches || 0} jogos</span>
            <span>${stats.wins || 0} vitorias</span>
            <span>${stats.points || 0} pts</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderAthletes(athletes) {
  elements.athletes.innerHTML = athletes
    .map((athlete) => {
      const stats = athlete.stats || {};
      const photo = athlete.photoUrl
        ? `<img src="${athlete.photoUrl}" alt="Foto de ${athlete.fullName}" loading="lazy" decoding="async">`
        : `<span>${getTeamInitials(athlete.fullName)}</span>`;

      return `
        <article class="athlete-card">
          <div class="athlete-photo">${photo}</div>
          <div>
            <span>${athlete.teamName}</span>
            <h3>${athlete.fullName}</h3>
            <p>${athlete.position}${athlete.age ? ` - ${athlete.age} anos` : ""}</p>
          </div>
          <div class="team-stats">
            <span>${stats.matches || 0} jogos</span>
            <span>${stats.goals || 0} gols</span>
            <span>${stats.yellowCards || 0} CA</span>
            <span>${stats.redCards || 0} CV</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function isFavorite(type, itemId) {
  return state.favorites.some((favorite) => {
    return favorite.type === type && Number(favorite.itemId) === Number(itemId);
  });
}

function getFavoriteButtonHtml(type, itemId) {
  if (!state.user) {
    return "";
  }

  const active = isFavorite(type, itemId);
  const label = active ? "Remover dos favoritos" : "Adicionar aos favoritos";

  return `
    <button
      class="favorite-button${active ? " active" : ""}"
      type="button"
      data-favorite-type="${type}"
      data-favorite-id="${itemId}"
      aria-pressed="${active}"
      aria-label="${label}"
      title="${label}"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${active ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 2l2.9 6.26L21 9.27l-4.5 4.6L17.8 21 12 17.77 6.2 21l1.3-7.13L3 9.27l6.1-1.01z"/>
      </svg>
    </button>
  `;
}

function renderFavorites() {
  if (!elements.favoritesSection || !elements.favoritesList || !elements.personalizedContent) {
    return;
  }

  const favorites = state.favorites;
  elements.favoritesSection.hidden = favorites.length === 0;

  elements.favoritesList.innerHTML = favorites.length
    ? favorites.map((favorite) => {
      const item = favorite.item;
      if (!item) {
        return "";
      }

      const crest = favorite.type === "time" && item.crestUrl
        ? `<img src="${item.crestUrl}" alt="Escudo do ${item.name}" loading="lazy" decoding="async">`
        : `<span>${getTeamInitials(item.name)}</span>`;

      const detail = favorite.type === "time"
        ? `${item.championshipName} - ${item.community || ""}`
        : `${item.season} - ${formatChampionshipStatus(item.status)}`;

      return `
        <article class="favorite-card">
          <div class="favorite-crest">${crest}</div>
          <div class="favorite-info">
            <span>${favorite.type === "time" ? "Time" : "Campeonato"}</span>
            <h3>${item.name}</h3>
            <small>${detail}</small>
          </div>
          ${getFavoriteButtonHtml(favorite.type, favorite.itemId)}
        </article>
      `;
    }).join("")
    : "";

  const personalizedHome = state.personalizedHome || {};
  const renderMatch = (match, isResult) => `
    <a class="personalized-match" href="#jogos">
      <span>${match.championshipName} - ${match.round}</span>
      <strong>${match.homeTeamName} ${isResult ? formatMatchScore(match) : "x"} ${match.awayTeamName}</strong>
      <small>${isResult ? "Resultado" : formatMatchDateTime(match)}</small>
    </a>
  `;
  const renderMatchGroup = (title, matches, isResult) => `
    <section class="personalized-group">
      <h3>${title}</h3>
      ${matches.length
        ? `<div class="personalized-match-list">${matches.map((match) => renderMatch(match, isResult)).join("")}</div>`
        : `<p class="personalized-empty">${isResult ? "Ainda nao ha resultados para seus favoritos." : "Nao ha proximos jogos para seus favoritos."}</p>`}
    </section>
  `;

  elements.personalizedContent.innerHTML = `
    ${renderMatchGroup("Proximos jogos", personalizedHome.upcomingMatches || [], false)}
    ${renderMatchGroup("Ultimos resultados", personalizedHome.recentResults || [], true)}
  `;
}

async function toggleFavorite(type, itemId) {
  if (!state.user) {
    setMessage("Entre na conta para favoritar conteudos.");
    openTab("login", { clearMessage: false });
    return;
  }

  try {
    if (isFavorite(type, itemId)) {
      await api(`/api/favorites/${type}/${itemId}`, { method: "DELETE" });
      state.favorites = state.favorites.filter((favorite) => {
        return !(favorite.type === type && Number(favorite.itemId) === Number(itemId));
      });
      setMessage("Item removido dos favoritos.");
    } else {
      const data = await api("/api/favorites", {
        method: "POST",
        body: JSON.stringify({ type, itemId })
      });
      state.favorites.unshift(data.favorite);
      setMessage("Item adicionado aos favoritos.");
    }

    await loadFavorites();
  } catch (error) {
    setMessage(error.message);
  }
}

/* Delegacao: botoes de favoritar em cards e na lista de favoritos */
document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-favorite-type]");

  if (!button) {
    return;
  }

  const type = button.dataset.favoriteType;
  const itemId = Number(button.dataset.favoriteId);
  toggleFavorite(type, itemId);
});

async function loadFavorites() {
  if (!state.user) {
    state.favorites = [];
    state.personalizedHome = null;
  } else {
    const data = await api("/api/personalized-home");
    state.favorites = data.favorites || [];
    state.personalizedHome = data;
  }

  renderFavorites();
  renderChampionships(state.championships);
  renderTeams(state.teams);
}

/* ============================================================
   Notificacoes
   ============================================================ */

function getNotificationTypeLabel(type) {
  const labels = {
    jogo_resultado: "Resultado",
    proximo_jogo: "Proximo jogo",
    noticia_nova: "Noticia"
  };

  return labels[type] || "Aviso";
}

function getNotificationTarget(notification) {
  const targets = {
    jogo: "#jogos",
    campeonato: "#campeonatos",
    noticia: "#noticias"
  };

  return targets[notification.contextType] || "#inicio";
}

function formatNotificationDate(value) {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderNotificationBadge() {
  if (!elements.notificationBell || !elements.notificationBadge) {
    return;
  }

  const hasSession = Boolean(state.user);
  elements.notificationBell.hidden = !hasSession;

  if (!hasSession) {
    return;
  }

  const count = state.unreadCount;
  elements.notificationBadge.hidden = count === 0;
  elements.notificationBadge.textContent = count > 99 ? "99+" : String(count);
  elements.notificationBell.setAttribute("aria-label", count
    ? `${count} notificacao${count === 1 ? "" : "oes"} nao lida${count === 1 ? "" : "s"}`
    : "Nenhuma notificacao nao lida");
}

function renderNotificationPreferences() {
  if (!elements.preferencesGrid) {
    return;
  }

  const preferences = state.notificationPreferences;

  if (!preferences.length) {
    elements.preferencesGrid.innerHTML = "<p class=\"search-empty\">Entre na sua conta para configurar as notificacoes.</p>";
    return;
  }

  elements.preferencesGrid.innerHTML = preferences.map((preference) => {
    const checked = preference.enabled ? " checked" : "";
    return `
      <label class="preference-item">
        <input type="checkbox" name="preference" value="${preference.id}"${checked}>
        <span>
          <strong>${preference.name}</strong>
          <small>${preference.description}</small>
        </span>
      </label>
    `;
  }).join("");
}

function renderNotifications() {
  if (!elements.notificationsSection || !elements.notificationsList) {
    return;
  }

  const loggedIn = Boolean(state.user);
  elements.notificationsSection.hidden = !loggedIn;

  if (!loggedIn) {
    return;
  }

  const notifications = state.notifications;
  const unread = state.unreadCount;

  elements.notificationsStatus.textContent = notifications.length
    ? `${notifications.length} notificacao${notifications.length === 1 ? "" : "s"}${unread ? `, ${unread} nao lida${unread === 1 ? "" : "s"}` : " - tudo lido"}.`
    : "Voce ainda nao tem notificacoes. Favorite times e campeonatos para comecar a receber avisos.";

  elements.notificationsList.innerHTML = notifications.length
    ? notifications.map((notification) => {
      const typeLabel = getNotificationTypeLabel(notification.type);
      const readClass = notification.isRead ? "" : " unread";
      const date = notification.createdAt ? formatNotificationDate(notification.createdAt) : "";
      const contextBadge = notification.contextLabel
        ? `<span class="notification-context">${notification.contextLabel}</span>`
        : "";
      const actions = notification.isRead
        ? `<button class="notification-action" type="button" data-notification-delete="${notification.id}" aria-label="Excluir notificacao">Excluir</button>`
        : `
          <button class="notification-action" type="button" data-notification-read="${notification.id}" aria-label="Marcar como lida">Ler</button>
          <button class="notification-action" type="button" data-notification-delete="${notification.id}" aria-label="Excluir notificacao">Excluir</button>
        `;
      const target = getNotificationTarget(notification);
      const openLabel = notification.contextLabel ? `Abrir: ${notification.contextLabel}` : "Abrir conteudo relacionado";

      return `
        <article class="notification-card${readClass}">
          <div class="notification-header">
            <span class="notification-type">${typeLabel}</span>
            <time datetime="${notification.createdAt || ""}">${date}</time>
          </div>
          <div class="notification-body">
            <h3>${notification.title}</h3>
            <p>${notification.message}</p>
          </div>
          <div class="notification-footer">
            ${contextBadge}
            <span class="notification-actions">
              <a class="notification-action" href="${target}" data-notification-open="${notification.id}" aria-label="${openLabel}">Abrir</a>
              ${actions}
            </span>
          </div>
        </article>
      `;
    }).join("")
    : '<p class="search-empty">Nenhuma notificacao por aqui ainda.</p>';
}
async function loadNotifications() {
  if (!state.user) {
    state.notifications = [];
    state.unreadCount = 0;
    renderNotificationBadge();
    renderNotifications();
    return;
  }

  try {
    const data = await api("/api/notifications");
    state.notifications = data.notifications || [];
    state.unreadCount = data.unreadCount || 0;
    renderNotificationBadge();
    renderNotifications();
  } catch (error) {
    state.notifications = [];
    state.unreadCount = 0;
    renderNotificationBadge();
    renderNotifications();
  }
}

async function loadNotificationPreferences() {
  if (!state.user) {
    state.notificationPreferences = [];
    renderNotificationPreferences();
    return;
  }

  try {
    const data = await api("/api/notification-preferences");
    state.notificationPreferences = data.preferences || [];
    renderNotificationPreferences();
  } catch (error) {
    state.notificationPreferences = [];
    renderNotificationPreferences();
  }
}

async function markNotificationRead(notificationId) {
  try {
    await api("/api/notifications/read", {
      method: "POST",
      body: JSON.stringify({ ids: [notificationId] })
    });

    const notification = state.notifications.find((item) => item.id === notificationId);

    if (notification) {
      notification.isRead = true;
      state.unreadCount = Math.max(0, state.unreadCount - 1);
    }

    renderNotificationBadge();
    renderNotifications();
  } catch (error) {
    if (elements.notificationsStatus) {
      elements.notificationsStatus.textContent = error.message;
    }
  }
}

async function deleteNotification(notificationId) {
  try {
    const notification = state.notifications.find((item) => item.id === notificationId);
    await api(`/api/notifications/${notificationId}`, { method: "DELETE" });

    if (notification && !notification.isRead) {
      state.unreadCount = Math.max(0, state.unreadCount - 1);
    }

    state.notifications = state.notifications.filter((item) => item.id !== notificationId);
    renderNotificationBadge();
    renderNotifications();
  } catch (error) {
    if (elements.notificationsStatus) {
      elements.notificationsStatus.textContent = error.message;
    }
  }
}

async function markAllNotificationsRead() {
  try {
    await api("/api/notifications/read", { method: "POST", body: JSON.stringify({}) });
    state.notifications.forEach((notification) => {
      notification.isRead = true;
    });
    state.unreadCount = 0;
    renderNotificationBadge();
    renderNotifications();
  } catch (error) {
    if (elements.notificationsStatus) {
      elements.notificationsStatus.textContent = error.message;
    }
  }
}

/* Delegacao: acoes dentro da lista de notificacoes */
if (elements.notificationsList) {
  elements.notificationsList.addEventListener("click", (event) => {
    const readButton = event.target.closest("[data-notification-read]");
    const deleteButton = event.target.closest("[data-notification-delete]");
    const openLink = event.target.closest("[data-notification-open]");

    if (readButton) {
      markNotificationRead(Number(readButton.dataset.notificationRead));
    }

    if (deleteButton) {
      deleteNotification(Number(deleteButton.dataset.notificationDelete));
    }

    if (openLink) {
      const notificationId = Number(openLink.dataset.notificationOpen);
      const notification = state.notifications.find((item) => item.id === notificationId);

      if (notification && !notification.isRead) {
        markNotificationRead(notificationId);
      }
    }
  });
}

if (elements.markAllNotifications) {
  elements.markAllNotifications.addEventListener("click", () => {
    markAllNotificationsRead();
  });
}

if (elements.preferencesForm && elements.preferencesGrid) {
  elements.preferencesForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!state.user) {
      return;
    }

    const selected = Array.from(elements.preferencesGrid.querySelectorAll('input[name="preference"]:checked')).map((checkbox) => checkbox.value);

    const payload = state.notificationPreferences.map((preference) => ({
      id: preference.id,
      enabled: selected.includes(preference.id)
    }));

    try {
      const data = await api("/api/notification-preferences", {
        method: "PUT",
        body: JSON.stringify({ preferences: payload })
      });

      state.notificationPreferences = data.preferences || [];
      if (elements.notificationsStatus) {
        elements.notificationsStatus.textContent = data.message || "Preferencias atualizadas.";
      }
    } catch (error) {
      if (elements.notificationsStatus) {
        elements.notificationsStatus.textContent = error.message;
      }
    }
  });
}

/* Sino de notificacoes: abre a secao e rola ate ela */
if (elements.notificationBell && elements.notificationsSection) {
  elements.notificationBell.addEventListener("click", (event) => {
    event.preventDefault();

    if (!state.user) {
      openTab("login");
      setMessage("Entre na sua conta para ver notificacoes.");
      return;
    }

    elements.notificationsSection.hidden = false;
    elements.notificationBell.setAttribute("aria-expanded", "true");
    elements.notificationsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function renderMatches(matches) {
  elements.matches.innerHTML = matches
    .map((match) => {
      return `
        <article class="match-card">
          <span>${match.championshipName} - ${formatMatchStatus(match.status)}</span>
          <div class="match-scoreline">
            <strong>${match.homeTeamName}</strong>
            <b>${formatMatchScore(match)}</b>
            <strong>${match.awayTeamName}</strong>
          </div>
          <p>${match.stage} - ${match.round}</p>
          <small>${formatMatchDateTime(match)} | ${match.field}</small>
          <small>${match.location}</small>
        </article>
      `;
    })
    .join("");
}

function renderHomeMatchList(element, matches, isResult = false) {
  element.innerHTML = matches.length
    ? matches.map((match) => `
      <a class="home-match-item" href="#jogos" aria-label="Ver ${match.homeTeamName} contra ${match.awayTeamName}">
        <span>${match.homeTeamName}</span>
        <strong>${isResult ? formatMatchScore(match) : "x"}</strong>
        <span>${match.awayTeamName}</span>
        <small>${isResult ? `${match.stage} · ${match.round}` : formatMatchDateTime(match)}</small>
      </a>`).join("")
    : "<p class=\"home-empty\">Nenhuma partida disponível.</p>";
}

function renderHome(home) {
  if (!home || !elements.homeUpcomingMatches) {
    return;
  }

  renderHomeMatchList(elements.homeUpcomingMatches, home.upcomingMatches || []);
  renderHomeMatchList(elements.homeRecentResults, home.recentResults || [], true);

  const standings = home.standings;
  elements.homeStandingsContext.textContent = standings?.championshipName || "Classificação indisponível";
  elements.homeStandings.innerHTML = standings?.teams?.length
    ? standings.teams.map((team) => `<li><span><b>${team.position}</b>${team.teamName}</span><strong>${team.points} pts</strong></li>`).join("")
    : "<li class=\"home-empty\">Ainda não há classificação.</li>";

  elements.homeTopScorers.innerHTML = home.topScorers?.length
    ? home.topScorers.map((athlete) => `<li><span><b>${athlete.position}</b>${athlete.athleteName}<small>${athlete.teamName}</small></span><strong>${athlete.goals} gol${athlete.goals === 1 ? "" : "s"}</strong></li>`).join("")
    : "<li class=\"home-empty\">Ainda não há artilharia.</li>";

  const athlete = home.athleteOfWeek;
  elements.homeAthleteWeek.innerHTML = athlete
    ? `<p class="eyebrow">Atleta da semana</p><h3>${athlete.athleteName}</h3><p>${athlete.teamName}</p><strong>${athlete.goals || athlete.matches} ${athlete.goals ? "gols na temporada" : "jogos disputados"}</strong><a class="button secondary compact" href="#atletas">Conhecer atleta</a>`
    : "<p class=\"eyebrow\">Atleta da semana</p><h3>Em breve</h3><p>Os destaques aparecerão após os primeiros jogos.</p>";

  elements.homeFeaturedNews.innerHTML = home.featuredNews?.length
    ? home.featuredNews.map((article) => `<a class="home-news-item" href="#noticias">${article.coverImageUrl ? `<img src="${article.coverImageUrl}" alt="" loading="lazy">` : ""}<span>${article.category}</span><h4>${article.title}</h4><p>${article.summary}</p></a>`).join("")
    : "<p class=\"home-empty\">Nenhuma notícia publicada.</p>";

  elements.homeGalleryPreview.innerHTML = home.galleryPreview?.length
    ? home.galleryPreview.map((gallery) => `<a href="#galeria" class="home-gallery-item" aria-label="Ver galeria ${gallery.title}">${gallery.images[0] ? `<img src="${gallery.images[0]}" alt="" loading="lazy">` : ""}<span>${gallery.title}</span></a>`).join("")
    : "<p class=\"home-empty\">Nenhuma galeria publicada.</p>";

  elements.homeHubStatus.textContent = "Destaques atualizados a partir dos dados da plataforma.";
}

async function loadHome() {
  try {
    const data = await api("/api/home");
    renderHome(data.home);
  } catch (error) {
    elements.homeHubStatus.textContent = "Não foi possível carregar os destaques. Tente novamente mais tarde.";
  }
}

function renderPredictions(predictions) {
  if (!elements.predictionsList) {
    return;
  }

  elements.predictionsList.innerHTML = predictions.length
    ? predictions.map((item) => {
      const { match, summary, ownPrediction, comments } = item;
      const homePercent = summary.percentages.casa;
      const drawPercent = summary.percentages.empate;
      const awayPercent = summary.percentages.fora;
      const commentsHtml = comments.length
        ? comments.map((comment) => `<li><strong>${comment.authorName}:</strong> ${comment.content}</li>`).join("")
        : "<li>Nenhum comentario ainda. Seja o primeiro a participar.</li>";
      const predictionForm = state.user
        ? `<form class="prediction-form" data-prediction-match="${match.id}">
            <fieldset>
              <legend>Seu palpite</legend>
              <label>${match.homeTeamName}<input name="homeScore" type="number" inputmode="numeric" min="0" max="99" required value="${ownPrediction ? ownPrediction.homeScore : ""}"></label>
              <span aria-hidden="true">x</span>
              <label>${match.awayTeamName}<input name="awayScore" type="number" inputmode="numeric" min="0" max="99" required value="${ownPrediction ? ownPrediction.awayScore : ""}"></label>
            </fieldset>
            <button class="button primary compact" type="submit">${ownPrediction ? "Atualizar palpite" : "Enviar palpite"}</button>
          </form>`
        : `<p class="prediction-login-hint">Entre na sua conta para dar seu palpite.</p>`;
      const commentForm = ownPrediction
        ? `<form class="prediction-comment-form" data-prediction-comment="${ownPrediction.id}">
            <label class="visually-hidden" for="prediction-comment-${ownPrediction.id}">Comentar sobre ${match.homeTeamName} x ${match.awayTeamName}</label>
            <textarea id="prediction-comment-${ownPrediction.id}" name="content" rows="2" maxlength="500" placeholder="Comente seu palpite"></textarea>
            <button class="button secondary compact" type="submit">Comentar</button>
          </form>`
        : "";

      return `<article class="prediction-card">
        <div class="prediction-match-heading">
          <span>${match.championshipName}</span>
          <small>${formatMatchDateTime(match)}</small>
        </div>
        <h3>${match.homeTeamName} <span aria-hidden="true">x</span> ${match.awayTeamName}</h3>
        <p>${match.stage} · ${match.round} · ${match.field}</p>
        ${predictionForm}
        <div class="prediction-result" aria-label="Resultado da votação com ${summary.total} palpites">
          <div class="prediction-result-heading"><h4>Votação da torcida</h4><span>${summary.total} ${summary.total === 1 ? "palpite" : "palpites"}</span></div>
          <div class="vote-row"><span>${match.homeTeamName}</span><div class="vote-track"><i style="--vote-width: ${homePercent}%"></i></div><strong>${homePercent}%</strong></div>
          <div class="vote-row"><span>Empate</span><div class="vote-track"><i style="--vote-width: ${drawPercent}%"></i></div><strong>${drawPercent}%</strong></div>
          <div class="vote-row"><span>${match.awayTeamName}</span><div class="vote-track"><i style="--vote-width: ${awayPercent}%"></i></div><strong>${awayPercent}%</strong></div>
        </div>
        <div class="prediction-comments"><h4>Conversa da torcida</h4><ul>${commentsHtml}</ul>${commentForm}</div>
      </article>`;
    }).join("")
    : "<p class=\"predictions-empty\">Não há partidas agendadas para receber palpites.</p>";
}

async function loadPredictions() {
  try {
    const data = await api("/api/predictions");
    state.predictions = data.predictions || [];
    renderPredictions(state.predictions);
    if (elements.predictionsStatus) {
      elements.predictionsStatus.textContent = "";
    }
  } catch (error) {
    if (elements.predictionsStatus) {
      elements.predictionsStatus.textContent = error.message;
    }
  }
}

function renderNews(news) {
  elements.newsList.innerHTML = news.length
    ? news.map((article) => {
      const cover = article.coverImageUrl ? `<img class="news-cover" src="${article.coverImageUrl}" alt="Imagem da noticia ${article.title}" loading="lazy" decoding="async">` : "";
      const gallery = article.galleryImages.length
        ? `<div class="news-gallery">${article.galleryImages.slice(0, 3).map((imageUrl) => `<img src="${imageUrl}" alt="Imagem complementar de ${article.title}" loading="lazy" decoding="async">`).join("")}</div>`
        : "";
      const comments = article.comments.length
        ? article.comments.map((comment) => `<li><strong>${comment.authorName}:</strong> ${comment.content}</li>`).join("")
        : "<li>Nenhum comentario aprovado ainda.</li>";

      return `
        <article class="news-card">
          ${cover}
          <span>${article.category}</span>
          <h3>${article.title}</h3>
          <p>${article.summary}</p>
          <p>${article.content}</p>
          ${gallery}
          <div class="news-comments">
            <h4>Comentarios</h4>
            <ul>${comments}</ul>
            <form class="news-comment-form" data-news-comment="${article.id}">
              <input name="authorName" type="text" placeholder="Seu nome" required>
              <textarea name="content" rows="3" placeholder="Escreva um comentario" required></textarea>
              <button class="button secondary" type="submit">Enviar para moderacao</button>
            </form>
          </div>
        </article>
      `;
    }).join("")
    : "<p>Nenhuma noticia publicada ainda.</p>";
}

function renderGalleries(galleries) {
  elements.galleryList.innerHTML = galleries.length
    ? galleries.map((gallery) => {
      const firstImage = gallery.images[0] || "";
      const thumbImages = gallery.images.slice(1, 4);
      const cover = firstImage ? `<img class="gallery-cover" src="${firstImage}" alt="Imagem de capa da galeria ${gallery.title}" loading="lazy" decoding="async">` : "";
      const thumbs = thumbImages.length
        ? `<div class="gallery-thumbs">${thumbImages.map((imageUrl) => `<img src="${imageUrl}" alt="Imagem da galeria ${gallery.title}" loading="lazy" decoding="async">`).join("")}</div>`
        : "";
      const saleLink = gallery.saleUrl
        ? `<a class="button secondary" href="${gallery.saleUrl}" target="_blank" rel="noopener">Adquirir fotos</a>`
        : "";

      return `
        <article class="gallery-card">
          <span>${gallery.type} - ${gallery.context}</span>
          <h3>${gallery.title}</h3>
          <p>${gallery.description || ""}</p>
          ${cover}
          ${thumbs}
          <div class="gallery-actions">
            ${saleLink}
            <small>Publicado por ${gallery.authorName}${gallery.publishedAt ? ` em ${new Date(gallery.publishedAt).toLocaleDateString("pt-BR")}` : ""}</small>
          </div>
        </article>
      `;
    }).join("")
    : "<p>Nenhuma galeria publicada ainda.</p>";
}

function renderSearchResults(payload) {
  const query = payload.query || "";
  const results = payload.results || {};
  const total = payload.total || 0;

  if (!elements.searchResultsSection) {
    return;
  }

  elements.searchResultsSection.hidden = false;
  elements.searchStatus.textContent = query
    ? `Foram encontrados ${total} resultado${total === 1 ? "" : "s"} para "${query}".`
    : "Digite um termo para encontrar conteudos.";

  if (total === 0) {
    elements.searchResults.innerHTML = `
      <p class="search-empty">
        Nenhum resultado encontrado para "${query}". Tente outro time, atleta, campeonato ou noticia.
      </p>
    `;
    return;
  }

  const groups = [
    {
      title: "Campeonatos",
      icon: "M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3",
      anchor: "#campeonatos",
      items: (results.championships || []).map((championship) => ({
        label: championship.name,
        detail: `${championship.season || "Temporada a definir"} - ${formatChampionshipStatus(championship.status)}`
      }))
    },
    {
      title: "Times",
      icon: "M12 3 4 6v5c0 4.5 3.5 8.4 8 9 4.5-.6 8-4.5 8-9V6z",
      anchor: "#times",
      items: (results.teams || []).map((team) => ({
        label: team.name,
        detail: team.community
      }))
    },
    {
      title: "Atletas",
      icon: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
      anchor: "#atletas",
      items: (results.athletes || []).map((athlete) => ({
        label: athlete.fullName,
        detail: `${athlete.position}${athlete.teamName ? ` - ${athlete.teamName}` : ""}`
      }))
    },
    {
      title: "Noticias",
      icon: "M4 5h13v14H4zM17 8h3v11a2 2 0 0 1-2 2H4",
      anchor: "#noticias",
      items: (results.news || []).map((article) => ({
        label: article.title,
        detail: `${article.category} - ${article.summary || ""}`
      }))
    }
  ];

  elements.searchResults.innerHTML = groups
    .filter((group) => group.items.length)
    .map((group) => `
      <article class="search-group">
        <h3>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${group.icon}"/></svg>
          ${group.title}
          <small>${group.items.length} resultado${group.items.length === 1 ? "" : "s"}</small>
        </h3>
        <ul>
          ${group.items.map((item) => `
            <li>
              <a href="${group.anchor}">
                <strong>${item.label}</strong>
                <small>${item.detail}</small>
              </a>
            </li>
          `).join("")}
        </ul>
      </article>
    `)
    .join("");
}

function renderStatisticsChampionshipOptions(championships, selectedId) {
  elements.statisticsChampionship.innerHTML = championships
    .map((championship) => `<option value="${championship.id}" ${Number(championship.id) === Number(selectedId) ? "selected" : ""}>${championship.name} - ${championship.season}</option>`)
    .join("");
}

function renderStatistics(statistics) {
  const { championship, standings, finishedMatches } = statistics;
  elements.statisticsStatus.textContent = `${championship.name}: ${finishedMatches} partida${finishedMatches === 1 ? "" : "s"} encerrada${finishedMatches === 1 ? "" : "s"}.`;
  elements.standings.innerHTML = standings.length
    ? standings.map((team) => `
      <tr>
        <td>${team.position}</td><td><strong>${team.teamName}</strong><small>${team.community}</small></td>
        <td>${team.matches}</td><td>${team.wins}</td><td>${team.draws}</td><td>${team.losses}</td>
        <td>${team.goalsFor}</td><td>${team.goalsAgainst}</td><td>${team.goalDifference}</td><td><strong>${team.points}</strong></td><td>${team.performance}%</td>
      </tr>`).join("")
    : '<tr><td colspan="11">Nenhum time cadastrado neste campeonato.</td></tr>';

  const rankings = [
    ["Artilharia", "Gols", "topScorers", "goals"],
    ["Mais jogos", "Partidas", "mostMatches", "matches"],
    ["Cartoes amarelos", "CA", "yellowCards", "yellowCards"],
    ["Cartoes vermelhos", "CV", "redCards", "redCards"]
  ];
  elements.statisticsRankings.innerHTML = rankings.map(([title, label, key, field]) => {
    const athletes = statistics[key].slice(0, 5);
    const content = athletes.length
      ? athletes.map((athlete) => `<li><span>${athlete.position}. ${athlete.athleteName}<small>${athlete.teamName}</small></span><strong>${athlete[field]} ${label}</strong></li>`).join("")
      : "<li>Nenhum registro disponivel.</li>";
    return `<article class="statistics-card"><h3>${title}</h3><ol>${content}</ol></article>`;
  }).join("");
}

async function loadStatistics(championshipId) {
  try {
    const data = await api(`/api/statistics?championshipId=${championshipId}`);
    renderStatistics(data.statistics);
  } catch (error) {
    elements.statisticsStatus.textContent = error.message;
    elements.standings.innerHTML = "";
    elements.statisticsRankings.innerHTML = "";
  }
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

function renderFeaturedMatch(match) {
  elements.featuredMatch.innerHTML = `
    <strong>${match.homeTeamName || match.homeTeam} x ${match.awayTeamName || match.awayTeam}</strong>
    <p>Data: ${match.date || "A definir"} ${match.time || ""}</p>
    <p>Campo: ${match.field}</p>
  `;
}

function renderRoles(roles) {
  elements.roles.innerHTML = roles
    .map((role) => {
      return `
        <article class="role-card">
          <span>${role.name}</span>
          <p>${role.description}</p>
        </article>
      `;
    })
    .join("");
}

function fillProfileForm() {
  if (!state.user) {
    elements.profileForm.reset();
    return;
  }

  elements.profileForm.elements.name.value = state.user.name || "";
  elements.profileForm.elements.email.value = state.user.email || "";
  elements.profileForm.elements.community.value = state.user.community || "";
  elements.profileForm.elements.phone.value = state.user.phone || "";
  elements.profileForm.elements.photoUrl.value = state.user.photoUrl || "";
  elements.profileForm.elements.password.value = "";
}

function renderSession() {
  if (state.user) {
    const avatar = state.user.photoUrl
      ? `<img class="session-avatar" src="${state.user.photoUrl}" alt="Foto de perfil de ${state.user.name}" loading="lazy" decoding="async">`
      : `<span class="session-avatar initials">${getTeamInitials(state.user.name)}</span>`;

    elements.sessionStatus.innerHTML = `${avatar}<span>Conectado como ${state.user.name} (${state.user.role}).</span>`;
    fillProfileForm();
    return;
  }

  elements.sessionStatus.textContent = "Nenhum usuario conectado.";
  fillProfileForm();
}

function setMessage(message) {
  elements.formMessage.textContent = message;
}

function openTab(tabName, options = {}) {
  elements.tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });

  elements.accountForms.forEach((form) => {
    form.classList.toggle("active", form.dataset.panel === tabName);
  });

  if (options.clearMessage !== false) {
    setMessage("");
  }
}

async function loadBootstrap() {
  const data = await api("/api/bootstrap");
  state.user = data.user;
  state.favorites = data.favorites || [];
  state.personalizedHome = null;
  state.championships = data.championships;
  state.teams = data.teams;
  state.predictions = data.predictions || [];
  renderFavorites();
  renderChampionships(data.championships);
  renderStatisticsChampionshipOptions(data.championships, data.championships[0]?.id);
  if (data.championships.length) {
    await loadStatistics(data.championships[0].id);
  }
  renderTeams(data.teams);
  renderAthletes(data.athletes);
  renderMatches(data.matches);
  renderPredictions(state.predictions);
  renderNews(data.news || []);
  renderGalleries(data.galleries || []);
  renderFeaturedMatch(data.matches[0] || data.featuredMatches[0]);
  renderRoles(data.roles);
  renderSession();
  await loadHome();
  await loadFavorites();
  await loadNotifications();
  await loadNotificationPreferences();
}

elements.statisticsChampionship.addEventListener("change", () => {
  loadStatistics(elements.statisticsChampionship.value);
});

elements.tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    openTab(button.dataset.tab);
  });
});

elements.newsList.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-news-comment]");

  if (!form) {
    return;
  }

  event.preventDefault();

  const formData = new FormData(form);

  try {
    const data = await api(`/api/news/${form.dataset.newsComment}/comments`, {
      method: "POST",
      body: JSON.stringify({
        authorName: formData.get("authorName"),
        content: formData.get("content")
      })
    });
    form.reset();
    setMessage(data.message);
  } catch (error) {
    setMessage(error.message);
  }
});

elements.predictionsList.addEventListener("submit", async (event) => {
  const predictionForm = event.target.closest("[data-prediction-match]");
  const commentForm = event.target.closest("[data-prediction-comment]");

  if (!predictionForm && !commentForm) {
    return;
  }

  event.preventDefault();
  const form = predictionForm || commentForm;
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  try {
    const formData = new FormData(form);
    let data;
    if (predictionForm) {
      data = await api("/api/predictions", {
        method: "POST",
        body: JSON.stringify({
          matchId: Number(predictionForm.dataset.predictionMatch),
          homeScore: Number(formData.get("homeScore")),
          awayScore: Number(formData.get("awayScore"))
        })
      });
    } else {
      data = await api(`/api/predictions/${commentForm.dataset.predictionComment}/comments`, {
        method: "POST",
        body: JSON.stringify({ content: formData.get("content") })
      });
    }
    await loadPredictions();
    elements.predictionsStatus.textContent = data.message;
  } catch (error) {
    elements.predictionsStatus.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});

elements.searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const query = elements.searchInput.value.trim();

  if (!query) {
    elements.searchStatus.textContent = "Digite um termo para buscar.";
    return;
  }

  try {
    const payload = await api(`/api/search?q=${encodeURIComponent(query)}`);
    renderSearchResults(payload);

    if (elements.searchResultsSection) {
      elements.searchResultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  } catch (error) {
    elements.searchStatus.textContent = error.message;
  }
});

if (elements.contactForm) {
  elements.contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(elements.contactForm);
    const payload = {
      name: String(formData.get("name") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      subject: String(formData.get("subject") || "").trim(),
      message: String(formData.get("message") || "").trim()
    };

    try {
      const data = await api("/api/contact", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      elements.contactForm.reset();
      elements.contactStatus.textContent = data.message;
      elements.contactStatus.dataset.state = "success";
    } catch (error) {
      elements.contactStatus.textContent = error.message;
      elements.contactStatus.dataset.state = "error";
    }
  });
}

/* Link "Busca" do menu: leva o foco ao campo de pesquisa no hero */
document.querySelectorAll('a[href="#resultados"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();

    if (elements.searchInput) {
      elements.searchInput.scrollIntoView({ behavior: "smooth", block: "center" });
      elements.searchInput.focus({ preventScroll: true });
    }
  });
});

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
    await loadFavorites();
    await loadNotifications();
    await loadNotificationPreferences();
    await loadPredictions();
    renderSession();
    openTab("profile", { clearMessage: false });
    setMessage("Login realizado com sucesso.");
  } catch (error) {
    setMessage(error.message);
  }
});

elements.registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(elements.registerForm);

  try {
    const data = await api("/api/register", {
      method: "POST",
      body: JSON.stringify({
        name: formData.get("name"),
        email: formData.get("email"),
        password: formData.get("password"),
        role: formData.get("role"),
        community: formData.get("community"),
        phone: formData.get("phone"),
        photoUrl: formData.get("photoUrl")
      })
    });

    state.user = data.user;
    elements.registerForm.reset();
    await loadFavorites();
    await loadNotifications();
    await loadNotificationPreferences();
    await loadPredictions();
    renderSession();
    openTab("profile", { clearMessage: false });
    setMessage("Conta criada e login realizado.");
  } catch (error) {
    setMessage(error.message);
  }
});

elements.profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(elements.profileForm);

  try {
    const data = await api("/api/me", {
      method: "PUT",
      body: JSON.stringify({
        name: formData.get("name"),
        email: formData.get("email"),
        password: formData.get("password"),
        community: formData.get("community"),
        phone: formData.get("phone"),
        photoUrl: formData.get("photoUrl")
      })
    });

    state.user = data.user;
    renderSession();
    setMessage("Perfil atualizado com sucesso.");
  } catch (error) {
    setMessage(error.message);
  }
});

elements.resetForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(elements.resetForm);

  try {
    const data = await api("/api/password-reset", {
      method: "POST",
      body: JSON.stringify({
        email: formData.get("email")
      })
    });

    setMessage(data.message || "Instrucao de recuperacao registrada.");
  } catch (error) {
    setMessage(error.message);
  }
});


elements.logoutButton.addEventListener("click", async () => {
  await api("/api/logout", { method: "POST" });
  state.user = null;
  await loadFavorites();
  await loadNotifications();
  await loadNotificationPreferences();
  await loadPredictions();
  renderSession();
  openTab("login", { clearMessage: false });
  setMessage("Sessao encerrada.");
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

/* Navegacao mobile (hamburguer + menu "Mais") */
const navToggle = document.querySelector("#nav-toggle");
const mainNav = document.querySelector("#main-nav");
const moreButton = document.querySelector("#more-button");
const navDrawer = document.querySelector("#nav-drawer");
const navBackdrop = document.querySelector("#nav-backdrop");

function closeMenuPanels() {
  if (mainNav) {
    mainNav.classList.remove("open");
  }
  if (navToggle) {
    navToggle.setAttribute("aria-expanded", "false");
  }
  if (navDrawer) {
    navDrawer.classList.remove("open");
  }
  if (moreButton) {
    moreButton.setAttribute("aria-expanded", "false");
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

if (moreButton && navDrawer) {
  moreButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const open = navDrawer.classList.toggle("open");
    moreButton.setAttribute("aria-expanded", String(open));
    if (mainNav) {
      mainNav.classList.remove("open");
      navToggle.setAttribute("aria-expanded", "false");
    }
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

/* Destaque da secao ativa na navegacao (scrollspy) */
function setupScrollSpy() {
  const navGroups = [document.querySelectorAll(".bottom-nav a"), document.querySelectorAll(".main-nav a"), document.querySelectorAll(".nav-drawer a")];
  const links = [];
  navGroups.forEach((group) => group.forEach((a) => links.push(a)));

  const sectionRefs = new Map();
  links.forEach((link) => {
    const href = link.getAttribute("href");
    if (href && href.startsWith("#") && !sectionRefs.has(href)) {
      sectionRefs.set(href, link);
    }
  });

  const ids = Array.from(sectionRefs.keys());
  const sections = ids.map((id) => document.querySelector(id)).filter(Boolean);

  function onScroll() {
    const position = window.scrollY + 120;
    let current = ids[0] || "#inicio";

    sections.forEach((section) => {
      if (section.offsetTop <= position) {
        current = `#${section.id}`;
      }
    });

    ids.forEach((id) => {
      const link = sectionRefs.get(id);
      if (!link) {
        return;
      }
      if (id === current) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

setupScrollSpy();

/* Registro do service worker (PWA) */
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      // Falha silenciosa: a app continua funcionando sem SW.
    });
  });
}

loadBootstrap().catch((error) => {
  setMessage(error.message);
});
