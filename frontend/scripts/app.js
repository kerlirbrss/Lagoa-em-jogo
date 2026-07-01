const state = {
  user: null
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
  renderFeaturedMatch(data.featuredMatches[0]);
  renderRoles(data.roles);
  renderSession();
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
