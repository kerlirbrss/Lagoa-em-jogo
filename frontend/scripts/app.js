const state = {
  user: null
};

const elements = {
  championships: document.querySelector("#championships"),
  teams: document.querySelector("#teams"),
  athletes: document.querySelector("#athletes"),
  matches: document.querySelector("#matches"),
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
  searchResults: document.querySelector("#search-results")
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
          <span>${championship.season} - ${formatChampionshipStatus(championship.status)}</span>
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
        ? `<img src="${team.crestUrl}" alt="Escudo do ${team.name}">`
        : `<span>${getTeamInitials(team.name)}</span>`;

      return `
        <article class="team-card">
          <div class="team-card-header">
            <div class="team-crest">${crest}</div>
            <div>
              <span>${team.championshipName}</span>
              <h3>${team.name}</h3>
            </div>
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
        ? `<img src="${athlete.photoUrl}" alt="Foto de ${athlete.fullName}">`
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

function renderNews(news) {
  elements.newsList.innerHTML = news.length
    ? news.map((article) => {
      const cover = article.coverImageUrl ? `<img class="news-cover" src="${article.coverImageUrl}" alt="Imagem da noticia ${article.title}">` : "";
      const gallery = article.galleryImages.length
        ? `<div class="news-gallery">${article.galleryImages.slice(0, 3).map((imageUrl) => `<img src="${imageUrl}" alt="Imagem complementar de ${article.title}">`).join("")}</div>`
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
      const cover = firstImage ? `<img class="gallery-cover" src="${firstImage}" alt="Imagem de capa da galeria ${gallery.title}">` : "";
      const thumbs = thumbImages.length
        ? `<div class="gallery-thumbs">${thumbImages.map((imageUrl) => `<img src="${imageUrl}" alt="Imagem da galeria ${gallery.title}">`).join("")}</div>`
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
  elements.profileForm.elements.password.value = "";
}

function renderSession() {
  if (state.user) {
    elements.sessionStatus.textContent = `Conectado como ${state.user.name} (${state.user.role}).`;
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
  renderChampionships(data.championships);
  renderStatisticsChampionshipOptions(data.championships, data.championships[0]?.id);
  if (data.championships.length) {
    await loadStatistics(data.championships[0].id);
  }
  renderTeams(data.teams);
  renderAthletes(data.athletes);
  renderMatches(data.matches);
  renderNews(data.news || []);
  renderGalleries(data.galleries || []);
  renderFeaturedMatch(data.matches[0] || data.featuredMatches[0]);
  renderRoles(data.roles);
  renderSession();
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
        phone: formData.get("phone")
      })
    });

    state.user = data.user;
    elements.registerForm.reset();
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
        phone: formData.get("phone")
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

    const tokenMessage = data.resetToken ? ` Token de desenvolvimento: ${data.resetToken}` : "";
    setMessage(`${data.message}${tokenMessage}`);
  } catch (error) {
    setMessage(error.message);
  }
});


elements.logoutButton.addEventListener("click", async () => {
  await api("/api/logout", { method: "POST" });
  state.user = null;
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

/* Fecha os paineis ao clicar em qualquer link do menu */
document.querySelectorAll(".main-nav a, .nav-drawer a").forEach((link) => {
  link.addEventListener("click", closeMenuPanels);
});

if (navBackdrop) {
  navBackdrop.addEventListener("click", closeMenuPanels);
}

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
