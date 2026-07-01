const state = {
  user: null
};

const elements = {
  championships: document.querySelector("#championships"),
  featuredMatch: document.querySelector("#featured-match"),
  loginForm: document.querySelector("#login-form"),
  logoutButton: document.querySelector("#logout-button"),
  sessionStatus: document.querySelector("#session-status"),
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

function renderSession() {
  if (state.user) {
    elements.sessionStatus.textContent = `Conectado como ${state.user.name} (${state.user.role}).`;
    elements.formMessage.textContent = "Sessao ativa para desenvolvimento.";
    return;
  }

  elements.sessionStatus.textContent = "Nenhum usuario conectado.";
  elements.formMessage.textContent = "";
}

async function loadBootstrap() {
  const data = await api("/api/bootstrap");
  state.user = data.user;
  renderChampionships(data.championships);
  renderFeaturedMatch(data.featuredMatches[0]);
  renderSession();
}

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
  } catch (error) {
    elements.formMessage.textContent = error.message;
  }
});

elements.logoutButton.addEventListener("click", async () => {
  await api("/api/logout", { method: "POST" });
  state.user = null;
  renderSession();
});

loadBootstrap().catch((error) => {
  elements.formMessage.textContent = error.message;
});
