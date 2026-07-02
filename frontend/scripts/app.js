const state = {
  user: null,
  admin: {
    users: [],
    roles: [],
    comments: [],
    championships: [],
    teams: [],
    dashboard: null
  }
};

const elements = {
  championships: document.querySelector("#championships"),
  teams: document.querySelector("#teams"),
  featuredMatch: document.querySelector("#featured-match"),
  roles: document.querySelector("#roles"),
  loginForm: document.querySelector("#login-form"),
  registerForm: document.querySelector("#register-form"),
  profileForm: document.querySelector("#profile-form"),
  resetForm: document.querySelector("#reset-form"),
  logoutButton: document.querySelector("#logout-button"),
  sessionStatus: document.querySelector("#session-status"),
  formMessage: document.querySelector("#form-message"),
  tabButtons: document.querySelectorAll(".tab-button"),
  accountForms: document.querySelectorAll(".account-form")
};

elements.adminPanel = document.querySelector("#admin-panel");
elements.adminStatus = document.querySelector("#admin-status");
elements.adminStats = document.querySelector("#admin-stats");
elements.adminUsers = document.querySelector("#admin-users");
elements.adminComments = document.querySelector("#admin-comments");
elements.reloadAdmin = document.querySelector("#reload-admin");
elements.championshipForm = document.querySelector("#championship-form");
elements.adminChampionships = document.querySelector("#admin-championships");
elements.clearChampionshipForm = document.querySelector("#clear-championship-form");
elements.teamForm = document.querySelector("#team-form");
elements.teamChampionship = document.querySelector("#team-championship");
elements.adminTeams = document.querySelector("#admin-teams");
elements.clearTeamForm = document.querySelector("#clear-team-form");

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

function renderFeaturedMatch(match) {
  elements.featuredMatch.innerHTML = `
    <strong>${match.homeTeam} x ${match.awayTeam}</strong>
    <p>Data: ${match.date}</p>
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

function isCurrentUserAdmin() {
  return state.user && state.user.role === "administrador";
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
    refreshAdminPanel();
    return;
  }

  elements.sessionStatus.textContent = "Nenhum usuario conectado.";
  fillProfileForm();
  renderAdminLocked();
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
  renderTeams(data.teams);
  renderFeaturedMatch(data.featuredMatches[0]);
  renderRoles(data.roles);
  renderSession();
}

function renderAdminLocked() {
  elements.adminPanel.hidden = true;
  elements.adminStatus.textContent = "Entre com uma conta administradora para carregar o painel.";
}

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
      <span>Pendentes</span>
      <strong>${totals.pendingComments}</strong>
    </article>
  `;
}

function getChampionshipOptions(selectedChampionshipId) {
  return state.admin.championships
    .map((championship) => {
      const selected = championship.id === Number(selectedChampionshipId) ? "selected" : "";
      return `<option value="${championship.id}" ${selected}>${championship.name} - ${championship.season}</option>`;
    })
    .join("");
}

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

async function refreshPublicTeams() {
  const teamsData = await api("/api/teams");
  renderTeams(teamsData.teams);
}

function getRoleOptions(selectedRole) {
  return state.admin.roles
    .map((role) => {
      const selected = role.id === selectedRole ? "selected" : "";
      return `<option value="${role.id}" ${selected}>${role.name}</option>`;
    })
    .join("");
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
          </div>
        </article>
      `;
    })
    .join("");
}

async function refreshAdminPanel() {
  if (!isCurrentUserAdmin()) {
    renderAdminLocked();
    return;
  }

  try {
    const [dashboard, usersData, commentsData, championshipsData, teamsData] = await Promise.all([
      api("/api/admin/dashboard"),
      api("/api/admin/users"),
      api("/api/admin/comments"),
      api("/api/admin/championships"),
      api("/api/admin/teams")
    ]);

    state.admin.dashboard = dashboard;
    state.admin.users = usersData.users;
    state.admin.roles = usersData.roles;
    state.admin.comments = commentsData.comments;
    state.admin.championships = championshipsData.championships;
    state.admin.teams = teamsData.teams;

    elements.adminPanel.hidden = false;
    elements.adminStatus.textContent = "Painel carregado para administradores.";
    renderAdminStats();
    renderAdminUsers();
    renderAdminComments();
    renderAdminChampionships();
    fillTeamForm(null);
    renderAdminTeams();
  } catch (error) {
    elements.adminStatus.textContent = error.message;
    elements.adminPanel.hidden = true;
  }
}

elements.tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    openTab(button.dataset.tab);
  });
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
    const championshipsData = await api("/api/championships");
    renderChampionships(championshipsData.championships);
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
    const championshipsData = await api("/api/championships");
    renderChampionships(championshipsData.championships);
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
    await refreshPublicTeams();
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
    await refreshPublicTeams();
    await refreshAdminPanel();
  } catch (error) {
    elements.adminStatus.textContent = error.message;
  }
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

elements.reloadAdmin.addEventListener("click", () => {
  refreshAdminPanel();
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
  const button = event.target.closest("[data-comment-id]");

  if (!button) {
    return;
  }

  try {
    await api(`/api/admin/comments/${button.dataset.commentId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: button.dataset.commentStatus })
    });
    await refreshAdminPanel();
  } catch (error) {
    elements.adminStatus.textContent = error.message;
  }
});

elements.logoutButton.addEventListener("click", async () => {
  await api("/api/logout", { method: "POST" });
  state.user = null;
  renderSession();
  openTab("login", { clearMessage: false });
  setMessage("Sessao encerrada.");
});

loadBootstrap().catch((error) => {
  setMessage(error.message);
});
