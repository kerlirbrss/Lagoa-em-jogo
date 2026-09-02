const { describe, test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function createQueryStub() {
  const registry = new Map();

  const add = (selector, instance) => {
    registry.set(selector, instance);
    return instance;
  };

  const ensureElement = (selector, overrides = {}) => {
    const base = {
      hidden: false,
      style: {},
      value: "",
      textContent: "",
      innerHTML: "",
      checked: false,
      children: [],
      closest: () => ({ style: {} }),
      addEventListener: () => {},
      reset: () => {}
    };

    const element = { ...base, ...overrides };
    registry.set(selector, element);
    return element;
  };

  const querySelector = (selector) => {
    if (!registry.has(selector)) {
      return ensureElement(selector);
    }
    return registry.get(selector);
  };

  return { querySelector, add, ensureElement, registry };
}

describe("Formulário de times", () => {
  let document;
  let fetchCalls;
  let teamForm;

  beforeEach(() => {
    const query = createQueryStub();
    teamForm = {
      elements: {
        id: { value: "" },
        name: { value: "Flamengo" },
        championshipId: { value: "1" },
        community: { value: "Centro" },
        crestUrl: { value: "" },
        foundedYear: { value: "" },
        coach: { value: "" },
        colors: { value: "" },
        squad: { value: "" },
        upcomingMatches: { value: "" },
        recentResults: { value: "" },
        gallery: { value: "" }
      },
      addEventListener: () => {},
      reset: () => {},
      hidden: false
    };

    const teamFormHandlers = {};
    teamForm.addEventListener = (eventName, handler) => {
      teamFormHandlers[eventName] = handler;
    };
    teamForm.submitHandler = (event) => teamFormHandlers.submit?.(event);

    query.add("#team-form", teamForm);
    query.add("#team-championship", { innerHTML: "", value: "1", addEventListener: () => {} });
    query.add("#clear-team-form", { addEventListener: () => {} });
    query.add("#admin-teams", { innerHTML: "", addEventListener: () => {} });
    query.add("#admin-panel", { hidden: true, addEventListener: () => {} });
    query.add("#admin-login", { hidden: false, addEventListener: () => {} });
    query.add("#admin-status", { textContent: "", hidden: false });
    query.add("#admin-session", { textContent: "" });
    query.add("#admin-stats", { innerHTML: "", hidden: false });
    query.add("#login-form", { addEventListener: () => {}, reset: () => {} });
    query.add("#logout-button", { hidden: true, addEventListener: () => {} });
    query.add("#logout-nav", { addEventListener: () => {} });
    query.add("#form-message", { textContent: "" });
    query.add(".admin-layout", { hidden: false });
    query.add(".admin-card:not(.news-manager)", { length: 0, forEach: () => {} });
    query.add(".gallery-manager", { hidden: true });

    const selectors = [
      "#championship-form", "#admin-championships", "#clear-championship-form",
      "#athlete-form", "#athlete-team", "#admin-athletes", "#clear-athlete-form",
      "#match-form", "#match-championship", "#match-home-team", "#match-away-team",
      "#admin-matches", "#clear-match-form", "#news-form", "#admin-news",
      "#clear-news-form", "#gallery-form", "#gallery-type", "#gallery-championship",
      "#gallery-match", "#admin-galleries", "#clear-gallery-form", "#reload-admin"
    ];

    selectors.forEach((selector) => query.ensureElement(selector));

    document = { querySelector: query.querySelector, querySelectorAll: () => [] };
    global.document = document;
    global.window = {};
    global.FormData = class {
      constructor(form) {
        this.form = form;
      }

      get(name) {
        return this.form.elements[name]?.value ?? "";
      }
    };

    fetchCalls = [];
    global.fetch = async (url, options = {}) => {
      fetchCalls.push({ url, options });
      return {
        ok: true,
        json: async () => ({ team: { id: 9, name: "Flamengo", championshipId: 1, community: "Centro" } })
      };
    };

    const scriptPath = path.resolve(__dirname, "../frontend/scripts/admin.js");
    const script = fs.readFileSync(scriptPath, "utf8");
    vm.runInNewContext(script, {
      console,
      document,
      window: global.window,
      FormData: global.FormData,
      fetch: global.fetch,
      URL,
      setTimeout,
      clearTimeout
    });
  });

  test("envia os dados do time para a API ao salvar", async () => {
    const event = { preventDefault() {} };
    await teamForm.submitHandler(event);

    assert.equal(fetchCalls.length > 0, true, "o formulário deve enviar a requisição ao backend");
    assert.equal(fetchCalls[0].url, "/api/admin/teams");
    assert.equal(fetchCalls[0].options.method, "POST");
    assert.equal(JSON.parse(fetchCalls[0].options.body).name, "Flamengo");
  });
});
