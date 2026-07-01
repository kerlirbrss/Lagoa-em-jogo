const state = {
  user: null,
  admin: {
    users: [],
    roles: [],
    comments: [],
    dashboard: null
  }
};

const elements = {
  championships: document.querySelector("#championships"),
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
          <span>${championship.season}</span>
          <h3>${championship.name}</h3>
          <p>${championship.status}</p>
        </article>
      `;
    })
    .join("");
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
      <span>Pendentes</span>
      <strong>${totals.pendingComments}</strong>
    </article>
  `;
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
    const [dashboard, usersData, commentsData] = await Promise.all([
      api("/api/admin/dashboard"),
      api("/api/admin/users"),
      api("/api/admin/comments")
    ]);

    state.admin.dashboard = dashboard;
    state.admin.users = usersData.users;
    state.admin.roles = usersData.roles;
    state.admin.comments = commentsData.comments;

    elements.adminPanel.hidden = false;
    elements.adminStatus.textContent = "Painel carregado para administradores.";
    renderAdminStats();
    renderAdminUsers();
    renderAdminComments();
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
