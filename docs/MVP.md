# Avaliação de MVP — Lagoa em Jogo

> Data da análise: 05/08/2026
> Última atualização: 26/08/2026 — Fase 13 (Palpites) concluída, com votação por placar e comentários após o envio do palpite.
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
| Favoritos (Fase 11) | `POST /api/favorites`, `GET /api/favorites`, `DELETE /api/favorites/:type/:id`, `GET /api/personalized-home` | ✅ |
| Notificações (Fase 12) | `GET /api/notifications`, `POST /api/notifications/read`, `DELETE /api/notifications/:id`, `GET/PUT /api/notification-preferences` | ✅ |
| Palpites (Fase 13) | `GET/POST /api/predictions`, `POST /api/predictions/:id/comments` | ✅ |

Controle de acesso por papel (visitante, usuário, organizador, fotógrafo, administrador) presente via `requireAdmin`, `requireNewsPublisher`, `requireGalleryPublisher` e sessão por cookie (`lej_session`).

**Notificações (Fase 12)** — além das rotas de listagem/leitura/exclusão/preferências, o servidor **gera automaticamente** as notificações:
- **Resultado de jogo** (`jogo_resultado`) para usuários que favoritam os times participantes (pref. "times favoritos") ou o campeonato (pref. "campeonatos favoritos") quando uma partida é encerrada com placar;
- **Próximo jogo** (`proximo_jogo`) para usuários que favoritam os times/campeonato quando uma partida é agendada (pref. "próximos jogos");
- **Nova notícia** (`noticia_nova`) para usuários ativos com a pref. "notícias" ativada quando uma notícia é publicada (autor e bloqueados são excluídos).

**Palpites (Fase 13)** — usuários autenticados podem registrar ou atualizar um único placar por partida agendada. A API agrega os votos em vitória da casa, empate e vitória visitante, retornando totais e percentuais. Após enviar seu palpite, o torcedor pode publicar comentários de até 500 caracteres na conversa daquela partida.

### 3.2 Frontend
- Página única com seções: Hero, Campeonatos, Times, Atletas, Jogos (agenda + jogo em destaque), Estatísticas (filtro por campeonato, classificação, rankings), Notícias (com comentários), Galeria, Perfis (papéis), Conta (login/cadastro/perfil/recuperação) e Painel Admin.
- **Favoritos (Fase 11)**: botões para favoritar times e campeonatos e uma área personalizada na página inicial. Ela reúne os favoritos do usuário, os próximos jogos e os últimos resultados relacionados a eles.
- **Notificações (Fase 12)**: sino no cabeçalho com contador de não lidas, seção dedicada (listar, marcar como lida/remover, "marcar todas como lidas"), painel de preferências com 4 tipos de aviso e navegação direta para o jogo, campeonato ou notícia relacionada. Ao abrir um aviso não lido, ele é marcado como lido.
- **Palpites (Fase 13)**: seção com cartões para partidas agendadas, formulário de placar com teclado numérico no celular, resultado da votação em percentuais e conversa liberada somente depois de o usuário enviar o próprio palpite.
- **Responsividade mobile-first**, **tema claro/escuro** e **preparação para PWA** (manifest + service worker + ícone) — adicionados recentemente (ver §5), com refinamentos da skill `ui-ux-pro-max` (tipografia Barlow, foco visível, transições 150–300ms, `inputmode="numeric"` em campos numéricos).
- Barra de navegação inferior no celular (Início, Campeonatos, Times, Notícias, Mais) e navegação completa no desktop, com link "Notificações" no menu principal e no menu "Mais".

### 3.3 Dados de demonstração
- `db.json` com: 1 admin (`admin@lagoaemjogo.local` / `admin123`), 4 campeonatos (Rural, Copa Lagoa, Trabalhador e Cabeceiras), 8 times, 12 atletas, 9 jogos (6 encerrados com placar), 1 jogo em destaque, 4 notícias, 3 galerias, 5 comentários, favoritos de demonstração, **6 notificações** e **8 preferências de notificação** e a definição de 5 papéis/permissões.

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
| Favoritos | Fase 11 | ✅ Concluído — favoritar/desfavoritar times e campeonatos e exibir uma página inicial personalizada com agenda e resultados relevantes; exige sessão |
| Notificações | Fase 12 | ✅ Concluído — sino com contador, preferências, leitura/exclusão, navegação direta e geração automática ao agendar/encerrar jogos e publicar notícias |
| Palpites | Fase 13 | ✅ Concluído — palpite autenticado por placar, atualização do próprio voto, totais/percentuais por resultado e comentários pós-palpite |
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
- **Notificações (Fase 12)**: sino SVG no cabeçalho com badge de não lidas (≥44px, foco visível, `aria-label` dinâmico), seção `#notificacoes` com cards de notificação (pill de tipo, contexto, data, ações "Ler"/"Excluir" e "marcar todas como lidas") e painel de preferências com checkboxes grandes (`accent-color` verde) e estados de foco/hover, respeitando o tema claro/escuro.
- **Palpites (Fase 13)**: cartões responsivos com campos de placar de no mínimo 44px, barras de votação que também exibem o percentual em texto, estados de envio desabilitados e área de comentários. A implementação utiliza os tokens de tema azul/verde/branco, foco visível e `prefers-reduced-motion` já definidos na folha de estilos.

---

## 6. Recomendações técnicas antes da apresentação

1. **Rodar o sistema** 💚: Node já instalado (v24.19.0 em `C:\Program Files\nodejs\node.exe`). Subir com `& 'C:\Program Files\nodejs\node.exe' backend/server.js` (ou adicionar ao PATH e usar `npm start`); abrir `http://localhost:3000`. (Já validado: `/api/health`, `/api/bootstrap`, manifest PWA, CSS e service worker respondendo.)
2. **Hash de senha** e remover qualquer vazamento de senha nas respostas (`getPublicUser` já omite, mas o banco guarda em texto plano).
3. **Enriquecer dados demo**: incluir pelo menos 6–8 times, 4–6 jogos (alguns encerrados com placar), 2–3 notícias e 1–2 galerias para que classificação, artilharia, "próximos jogos" e "últimos resultados" fiquem preenchidos na tela.
4. **Teste rápido de punho**: logar como admin → cadastrar time/jogo → encerrar jogo com placar → conferir classificação e rankings.
5. **Validar notificações (Fase 12)**: logar como `pedro@lagoaemjogo.local` / `pedro123` (tem favoritos de demonstração) → sino mostra contador → abrir a seção, marcar/ler/excluir e salvar preferências; como admin, encerrar um jogo e publicar notícia para ver os avisos automáticos chegarem.
6. **Validar palpites (Fase 13)**: logar como `pedro@lagoaemjogo.local` / `pedro123` → abrir "Palpites" → enviar ou atualizar o placar de um jogo agendado → conferir os percentuais e publicar um comentário.
7. **Um formulário de contato** simples e **páginas 403/404** para polir a apresentação.

---

## 7. Conclusão — grau de prontidão para MVP

O núcleo do produto (o **ciclo "ver o futebol local"** + **gestão administrativa**) está **implementado em backend e frontend**. Do ponto de vista de código, o sistema já é **apresentável** como MVP nas áreas principais (campeonatos, times, atletas, jogos, classificação, notícias, galeria, autenticação e admin).

O que separa o "pronto para uso" do "pronto para apresentar com segurança":
1. 💚 **Node/execução**: já resolvido — servidor validado em `http://localhost:3000`.
2. **Enriquecer os dados de demonstração**.
3. Tratar **segurança (hash de senha)**, **páginas de erro** e idealmente **contato** e **upload básico de imagem**.

Itens de evolução (auditoria, deploy e PWA completo) **não são impeditivos** para o MVP. As Fases 10 (Pesquisa), 11 (Favoritos), 12 (Notificações) e 13 (Palpites) já estão implementadas como diferenciais acima do núcleo obrigatório.

---

## 8. Sugestão de plano de curto prazo (antes da apresentação)

- [x] Instalar Node.js e validar a execução (`http://localhost:3000` respondendo).
- [x] Rodar `npm run check` — estrutura das fases 10, 11, 12 e 13 validada, incluindo as rotas de palpites.
- [x] Enriquecer `db.json` com cenário demo (times, jogos encerrados, notícias, galeria, favoritos e notificações).
- [x] Implementar Fase 12 — Notificações (backend + frontend): preferências, geração automática, leitura/exclusão e navegação para o conteúdo relacionado.
- [x] Implementar Fase 13 — Palpites (backend + frontend): placar por usuário, votação agregada e comentários após o palpite.
- [ ] Aplicar hash de senha em `register`/`login` e proteger o banco.
- [ ] Criar páginas de erro 403/404/500 e uma página de contato.
- [ ] (Opcional) Adicionar upload básico de imagem.
- [ ] Realizar teste manual fim-a-fim e gravar roteiro de apresentação.
