const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const INDEX = fs.readFileSync(path.join(ROOT, "frontend", "index.html"), "utf8");
const CSS = fs.readFileSync(path.join(ROOT, "frontend", "styles", "app.css"), "utf8");
const APP_JS = fs.readFileSync(path.join(ROOT, "frontend", "scripts", "app.js"), "utf8");

describe("Testes de responsividade", () => {
  test("viewport meta presente para escalar em dispositivos moveis", () => {
    assert.ok(/name="viewport" content="width=device-width/.test(INDEX));
  });

  test("barra inferior tem 5 itens e botao Mais", () => {
    const bottomNav = INDEX.match(/class="bottom-nav"[\s\S]*?<\/nav>/)?.[0] || "";
    assert.ok(bottomNav.includes("Inicio"));
    assert.ok(bottomNav.includes("Campeonatos"));
    assert.ok(bottomNav.includes("Times"));
    assert.ok(bottomNav.includes("Noticias"));
    assert.ok(/id="more-button"/.test(bottomNav));
  });

  test("menu Mais agrupado com Galeria, Contato, Pesquisa e Conta", () => {
    assert.ok(INDEX.includes("nav-group-label"));
    assert.ok(INDEX.includes("href=\"#galeria\""));
    assert.ok(INDEX.includes("href=\"#contato\""));
    assert.ok(INDEX.includes("href=\"#resultados\""));
    assert.ok(INDEX.includes("href=\"#conta\""));
  });

  test("rodape expandido com colunas e contato", () => {
    assert.ok(INDEX.includes("footer-cols"));
    assert.ok(/class="app-footer" id="contato"/.test(INDEX));
    assert.ok(INDEX.includes("mailto:"));
  });

  test("CSS possui breakpoints de telas pequenas, tablet e desktop", () => {
    assert.ok(CSS.includes("@media (max-width: 380px)"));
    assert.ok(CSS.includes("@media (min-width: 640px)"));
    assert.ok(CSS.includes("@media (min-width: 768px)"));
    assert.ok(CSS.includes("@media (min-width: 900px)"));
    assert.ok(CSS.includes("@media (min-width: 1200px)"));
  });

  test("CSS possui estilos de rodape e menu em colunas", () => {
    assert.ok(CSS.includes(".footer-cols"));
    assert.ok(CSS.includes(".nav-group-label"));
    assert.ok(CSS.includes(".nav-drawer-heading"));
  });

  test("scripts usam lazy loading, botao de fechar e tecla Esc", () => {
    assert.ok(APP_JS.includes("loading=\"lazy\""));
    assert.ok(APP_JS.includes("nav-drawer-close"));
    assert.ok(APP_JS.includes("event.key === \"Escape\""));
  });
});