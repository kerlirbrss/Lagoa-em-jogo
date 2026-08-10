# Lagoa em Jogo — Instruções do Agente

## Contexto do projeto

- **Stack:** backend em Node.js + frontend em `HTML/CSS/JS` puro (sem framework front-end).
- **Backend:** `backend/server.js` — API JSON com dados em `backend/database/db.json`.
- **Frontend:** `frontend/index.html`, `frontend/styles/app.css`, `frontend/scripts/app.js`.
- **Documentação:** `docs/PRD.md`, `docs/implementation-plan.md`, `docs/MVP.md`.
- **Identidade visual:** **azul / verde / branco** (ver PRD). Layout mobile-first com tema claro/escuro e preparação para PWA.
- **Para rodar:** `npm start` (Node.js ≥ 18) e acessar `http://localhost:3000`.

---

## Frontend / UI — regra obrigatória

Para **qualquer trabalho que envolva aparência, layout, interação ou experiência** do frontend (novas páginas, componentes, cores, tipografia, responsividade, animação, acessibilidade ou revisão de UI), **use a skill `ui-ux-pro-max`** instalada em `.claude/skills/ui-ux-pro-max/`. Faça o seguinte:

1. **Leia** `.claude/skills/ui-ux-pro-max/SKILL.md` para entender o fluxo e as categorias por prioridade.
2. **Gere o design system** da skill para orientar as decisões:
   ```
   python .claude/skills/ui-ux-pro-max/scripts/search.py "<palavras-chave do produto>" --design-system --project-name "Lagoa em Jogo" --format markdown
   ```
3. **Consulte as referências** conforme o caso: `references/quick-reference.md` (regras por categoria: acessibilidade, toque, performance, layout, tipografia/cor, animação, formulários, navegação, dados) e `references/pro-rules.md` (checklist pré-entrega).
4. **Respeite SEMPRE a identidade da marca (azul/verde/branco).** Use as recomendações da skill para *qualidade* — contraste text/background ≥ 4.5:1, alvos de toque ≥ 44×44px, estados de foco visíveis, transições de 150–300ms, ritmo de espaçamento de 8px, tipografia adequada, ícones vetoriais (SVG), consistência nos modos claro e escuro — **sem** trocar as cores oficiais da plataforma.
5. **Checklist obrigatório ao entregar frontend:**
   - [ ] Foco visível em elementos interativos
   - [ ] `cursor: pointer` em itens clicáveis e `touch-action: manipulation`
   - [ ] Sem emoji como ícone (usar SVG/ícones vetoriais de uma mesma família)
   - [ ] `prefers-reduced-motion` respeitado
   - [ ] Responsivo: testar 375px, 768px, 1024px e 1440px
   - [ ] Contraste adequado no tema claro **e** no escuro

---

## Notas gerais

- Não sobrescrever regras de CSS com hex "solto" nos componentes — usar os tokens de tema definidos em `frontend/styles/app.css`.
- Manter a acessibilidade de navegação (menus com `aria-label`, foco de teclado, títulos em hierarquia correta).
