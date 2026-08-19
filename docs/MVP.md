# Avaliação de MVP — Lagoa em Jogo

> Data da análise: 05/08/2026
> Última atualização: 05/08/2026 — Node confirmado instalado, execução validada e skill de design aplicada à interface.
> Base: `backend/server.js`, `frontend/` (index.html, app.js, app.css), `backend/database/db.json`, `docs/implementation-plan.md` e `docs/PRD.md`.

## 1. Objetivo desta análise

Levantar o que **já foi implementado**, o que **falta** e o que é **recomendado** para que o sistema possa ser **apresentado como MVP** (Minimum Viable Product). O MVP deve demonstrar o ciclo completo mais importante do produto: acompanhamento do futebol comunitário (campeonatos, times, atletas, jogos, classificação, notícias e galeria) + gestão administrativa básica.

---

## 2. Definição de MVP adotada

Para esta análise, o MVP foi definido como a entrega que permite usar e demonstrar:

- **Público (visitante/torcedor):** navegar por campeonatos, times, atletas, jogos, classificação/estatísticas, notícias e galeria, em qualquer dispositivo (responsivo).
- **Usuário cadastrado:** criar conta, entrar, comentar notícias e editar o próprio perfil.
- **Organizador/Administrador:** publicar e gerenciar campeonatos, times, atletas, jogos, notícias e galerias; moderar comentários; gerenciar usuários.
- **Infra mínima:** iniciar com um comando, dados de demonstração e apresentação estável.

Itens fora desse núcleo (pesquisa global, favoritos, notificações, palpites, auditoria, upload de imagens avançado, PWA completo) são **evolução pós-MVP**, exceto quando destacados como importantes para a apresentação.

---

## 3. O que já está implementado (status atual)

### 3.1 Backend — API (Node.js)
| Área | Rotas existentes | Status |
|---|---|---|
| Health / bootstrap | `GET /api/health`, `GET /api/bootstrap` | ✅ |
| Autenticação | `POST /api/register`, `POST /api/login`, `POST /api/logout`, `GET /api/me`, `PUT /api/me`, `POST /api/password-reset` | ✅ |
| Campeonatos | `GET /api/championships` (público) + CRUD `/api/admin/championships` | ✅ |
| Times | `GET /api/teams` (público) + CRUD `/api/admin/teams` | ✅ |
| Atletas | `GET /api/athletes` (público) + CRUD `/api/admin/athletes` | ✅ |
| Jogos | `GET /api/matches` (público) + CRUD `/api/admin/matches` | ✅ |
| Estatísticas | `GET /api/statistics?championshipId=` (classificação, artilharia, cartões) | ✅ |
| Notícias | `GET /api/news` (público) + CRUD `/api/admin/news` (publisher = admin/organizador) | ✅ |
| Galeria | `GET /api/galleries` (público) + CRUD `/api/admin/galleries` (publisher = admin/fotógrafo) | ✅ |
| Comentários | `POST /api/news/:id/comments` + `GET/PATCH /api/admin/comments` (moderação) | ✅ |
| Admin — usuários | `GET /api/admin/users`, `PATCH /api/admin/users/:id` (role/status) | ✅ |
| Admin — dashboard | `GET /api/admin/dashboard` | ✅ |

Controle de acesso por papel (visitante, usuário, organizador, fotógrafo, administrador) presente via `requireAdmin`, `requireNewsPublisher`, `requireGalleryPublisher` e sessão por cookie (`lej_session`).

### 3.2 Frontend
- Página única com seções: Hero, Campeonatos, Times, Atletas, Jogos (agenda + jogo em destaque), Estatísticas (filtro por campeonato, classificação, rankings), Notícias (com comentários), Galeria, Perfis (papéis), Conta (login/cadastro/perfil/recuperação) e Painel Admin.
- **Responsividade mobile-first**, **tema claro/escuro** e **preparação para PWA** (manifest + service worker + ícone) — adicionados recentemente (ver §5), com refinamentos da skill `ui-ux-pro-max` (tipografia Barlow, foco visível, transições 150–300ms, `inputmode="numeric"` em campos numéricos).
- Barra de navegação inferior no celular (Início, Campeonatos, Times, Notícias, Mais) e navegação completa no desktop.

### 3.3 Dados de demonstração
- `db.json` com: 1 admin (`admin@lagoaemjogo.local` / `admin123`), 4 campeonatos (Rural, Copa Lagoa, Trabalhador, Trabalhador das Cabeceiras), 2 times, 2 atletas, 1 jogo, 1 jogo em destaque, 1 notícia, 1 galeria, 2 comentários e a definição de 5 papéis/permissões.

---

## 4. O que ainda falta para o MVP

Priorização:
- 🔴 **Bloqueante** (sem isso a apresentação fica comprometida ou o sistema não roda bem)
- 🟡 **Importante** (melhora muito a demonstração e a robustez)
- 🟢 **Opcional / pós-MVP** (evolução)

### 4.1 Bloqueantes (🔴)
| Item | Situação | Ação necessária |
|---|---|---|
| Instalação/execução do ambiente | 💚 **Resolvido** — Node.js v24.19.0 instalado em `C:\Program Files\nodejs\node.exe` (não está no PATH) | Subir com `& 'C:\Program Files\nodejs\node.exe' backend/server.js` (ou adicionar `C:\Program Files\nodejs` ao PATH e usar `npm start`); acesso em `http://localhost:3000` |
| Validação de execução | 🟡 **Parcial** — servidor validado: `/api/health`, `/api/bootstrap`, `/api/championships`, manifest PWA, CSS e service worker respondendo corretamente; página raiz carrega o manifesto e a barra inferior | Rodar `npm run check` e um teste manual completo (login admin → cadastrar times/jogos → encerrar jogo com placar → conferir classificação e rankings) |
| Dados/rotina para apresentação | Dados demo mínimos | Popular cenário demo mais rico (mais times, jogos encerrados com placar, mais notícias/galeria) para a classificação e rankings aparecerem preenchidos |

### 4.2 Importantes (🟡)
| Item | Módulo no plano | Ação necessária |
|---|---|---|
| **Segurança de senha** | Fase 1/2 | `db.json` guarda senha em **texto plano** (`admin123`). Gerar hash (ex.: `crypto.scrypt`) ao cadastrar/login e nunca expor a senha na API |
| **Upload real de imagens** | Fase 21 (parcial) | Hoje imagens são apenas URLs. Para o MVP, ao menos permitir upload de escudo/foto/notícia/galeria; ou manter URLs e descrever a limitação |
| **Central de Contato** | Fase 20 | Página/sessão de contato (formulário básico + e-mail institucional). Simples e agrega à apresentação |
| **Páginas de erro** | Fase 23 | Páginas 403/404/500 amigáveis (hoje o servidor devolve mensagem padrão) |
| **Perfil completo do usuário** | Fase 18 | Edição de foto/nome/senha existem parcialmente; falta foto de perfil e visualização clara dos dados |
| **Pesquisa global** | Fase 10 | Campo de busca por campeonatos/times/atletas/notícias (rápido de incluir consumindo os GETs já existentes) |
| **Testes reais** | Fase 16 | Ao menos um teste de integração das rotas principais (login, CRUD, estatística) para dar confiança na apresentação |

### 4.3 Opcionais / pós-MVP (🟢)
| Item | Módulo | Observação |
|---|---|---|
| Favoritos | Fase 11 | ✅ Implementado — favoritar times/campeonatos com seção personalizada na página inicial; exige sessão |
| Notificações | Fase 12 | Não implementado — evolução |
| Palpites | Fase 13 | Não implementado — evolução |
| Auditoria/logs administrativos | Fase 22 | Não implementado — evolução |
| PWA completo (instalação, offline robusto, ícones PNG) | Fase 15/17 | Preparação feita; falta icon 192/512 PNG, prompt de instalação e testes offline |
| Deploy em produção (HTTPS, backup, monitoramento) | Fase 17 | Não feito — pós-MVP |
| Roadmap (app nativo, ranking histórico, Hall da Fama etc.) | Roadmap | Futuro |

## 5. Observações sobre as mudanças de interface recentes

Foram adicionados, já alinhados ao MVP:
- **CSS mobile-first** (`frontend/styles/app.css`): base pensada para celular, amplia em telas maiores; barra inferior + menu "Mais" no mobile e navegação completa no desktop.
- **Tema claro/escuro** com persistência em `localStorage` e respeito a `prefers-color-scheme`.
- **Preparação para PWA**: `manifest.webmanifest`, `sw.js` (service worker com cache do shell) e `frontend/icons/icon.svg`, com content-type `.webmanifest` adicionado no servidor.
- **Skill `ui-ux-pro-max`**: instalada em `.claude/skills/ui-ux-pro-max/` e registrada em `AGENTS.md` (regra obrigatória para futuras implementações de frontend). Aplicada à interface: tipografia Barlow/Barlow Condensed (Google Fonts) com tokens `--font-heading`/`--font-body`, estados de foco visíveis (WCAG), `cursor`/`touch-action: manipulation`, transições 150–300ms, `scroll-margin-top` para o header fixo, hover sutil em cards e `inputmode="numeric"` nos campos numéricos (teclado correto no mobile).

---

## 6. Recomendações técnicas antes da apresentação

1. **Rodar o sistema** 💚: Node já instalado (v24.19.0 em `C:\Program Files\nodejs\node.exe`). Subir com `& 'C:\Program Files\nodejs\node.exe' backend/server.js` (ou adicionar ao PATH e usar `npm start`); abrir `http://localhost:3000`. (Já validado: `/api/health`, `/api/bootstrap`, manifest PWA, CSS e service worker respondendo.)
2. **Hash de senha** e remover qualquer vazamento de senha nas respostas (`getPublicUser` já omite, mas o banco guarda em texto plano).
3. **Enriquecer dados demo**: incluir pelo menos 6–8 times, 4–6 jogos (alguns encerrados com placar), 2–3 notícias e 1–2 galerias para que classificação, artilharia, "próximos jogos" e "últimos resultados" fiquem preenchidos na tela.
4. **Teste rápido de punho**: logar como admin → cadastrar time/jogo → encerrar jogo com placar → conferir classificação e rankings.
5. **Um formulário de contato** simples e **páginas 403/404** para polir a apresentação.
6. (Opcional) **campo de pesquisa** consumindo as listagens públicas já existentes.

---

## 7. Conclusão — grau de prontidão para MVP

O núcleo do produto (o **ciclo "ver o futebol local"** + **gestão administrativa**) está **implementado em backend e frontend**. Do ponto de vista de código, o sistema já é **apresentável** como MVP nas áreas principais (campeonatos, times, atletas, jogos, classificação, notícias, galeria, autenticação e admin).

O que separa o "pronto para uso" do "pronto para apresentar com segurança":
1. 💚 **Node/execução**: já resolvido — servidor validado em `http://localhost:3000`.
2. **Enriquecer os dados de demonstração**.
3. Tratar **segurança (hash de senha)**, **páginas de erro** e idealmente **contato** e **upload básico de imagem**.

Itens de evolução (favoritos, notificações, palpites, auditoria, deploy, PWA completo) **não são impeditivos** para o MVP.

---

## 8. Sugestão de plano de curto prazo (antes da apresentação)

- [x] Instalar Node.js e validar a execução (`http://localhost:3000` respondendo).
- [ ] Rodar `npm run check` e o teste manual fim-a-fim (login admin → CRUD → classificação).
- [ ] Enriquecer `db.json` com cenário demo (times, jogos encerrados, notícias, galeria).
- [ ] Aplicar hash de senha em `register`/`login` e proteger o banco.
- [ ] Criar páginas de erro 403/404/500 e uma página de contato.
- [ ] (Opcional) Adicionar upload básico de imagem e campo de pesquisa.
- [ ] Realizar teste manual fim-a-fim e gravar roteiro de apresentação.


