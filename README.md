# Lagoa em Jogo

Plataforma digital para o acompanhamento e organização do futebol amador e comunitário de Lagoa de São Francisco - PI. O projeto reúne informações sobre campeonatos, times, atletas, jogos, estatísticas, notícias e galerias em uma interface moderna, responsiva e funcional para torcedores, organizadores e administradores.

## Visão geral

O Lagoa em Jogo nasceu para resolver um problema comum no futebol local: a dispersão das informações em grupos de WhatsApp, redes sociais e canais informais. A ideia da plataforma é centralizar a comunicação e a gestão de competições, oferecendo uma base digital sólida para:

- divulgar campeonatos;
- acompanhar resultados e classificações;
- registrar atletas e equipes;
- publicar notícias e galerias;
- dar suporte administrativo para a organização dos eventos esportivos.

A proposta atende tanto ao público torcedor quanto aos gestores da competição, criando uma solução simples, acessível e preparada para crescimento.

---

## Objetivo do projeto

Desenvolver uma plataforma web que permita:

- consultar campeonatos e jogos locais;
- acompanhar times, atletas e estatísticas;
- manter uma comunicação oficial por meio de notícias;
- permitir gestão administrativa com diferentes perfis de usuário;
- funcionar como base para uma evolução futura em direção a um ecossistema completo de futebol local.

---

## Status atual do desenvolvimento

O projeto está em um estado de desenvolvimento funcional, com implementação até a Fase 9 do plano de evolução, conforme documentação do produto e da implementação.

### Fases implementadas

- Fase 0 — Configuração inicial
  - estrutura do backend em Node.js;
  - estrutura do frontend em HTML, CSS e JavaScript;
  - banco de dados local em JSON;
  - layout base da aplicação;
  - identidade visual com tema azul, verde e branco;
  - preparação para PWA.

- Fase 1 — Gestão de usuários
  - cadastro de usuário;
  - login e logout;
  - recuperação de senha em ambiente local;
  - perfil do usuário;
  - edição de perfil;
  - perfis: visitante, usuário, organizador, fotógrafo e administrador.

- Fase 2 — Administração
  - painel administrativo separado;
  - dashboard geral;
  - gerenciamento de usuários;
  - controle de permissões;
  - moderação de comentários.

- Fase 3 — Campeonatos
  - criação, edição e exclusão de campeonatos;
  - temporada, status, descrição e regulamento;
  - gestão de premiações.

- Fase 4 — Times
  - cadastro de equipes;
  - vínculo a campeonatos;
  - dados de comunidade, técnico, cores e fundação.

- Fase 5 — Atletas
  - cadastro de atletas;
  - associação com time atual;
  - posição e estatísticas básicas.

- Fase 6 — Jogos
  - cadastro de partidas;
  - informações de campeonato, fase, rodada, mandante, visitante, data, horário, local e placar;
  - encerramento da partida.

- Fase 7 — Classificações e Estatísticas
  - cálculo automático da tabela;
  - aproveitamento;
  - artilharia;
  - cartões amarelos e vermelhos;
  - estatísticas por campeonato.

- Fase 8 — Notícias
  - publicação de notícias;
  - categorias;
  - imagens;
  - comentários com moderação.

- Fase 9 — Galeria
  - galerias por campeonato, jogo e evento;
  - imagens organizadas;
  - redirecionamento para venda de fotos quando aplicável.

> A partir da Fase 10, os itens estão previstos como evoluções futuras e não fazem parte da implementação atual do projeto.

---

## Funcionalidades já disponíveis

### Frontend público

- página inicial com apresentação do projeto;
- listagem de campeonatos;
- listagem de times e atletas;
- agenda de jogos;
- classificação e estatísticas por campeonato;
- notícias com comentários;
- galeria de imagens;
- área de conta para cadastro, login e edição de perfil;
- layout responsivo para dispositivos móveis e desktop;
- suporte a tema claro/escuro;
- preparação para instalação como PWA.

### Painel administrativo

- dashboard de gestão;
- administração de usuários;
- moderação de comentários;
- CRUD de campeonatos, times, atletas, jogos, notícias e galerias;
- controle por perfil de acesso.

### API backend

- autenticação via sessão;
- rotas públicas e administrativas;
- persistência em banco local JSON;
- gerenciamento de dados do campeonato e do ecossistema esportivo.

---

## Stack tecnológica

- Node.js
- JavaScript puro
- HTML5
- CSS3
- Banco de dados local em JSON para desenvolvimento
- PWA (manifest e service worker)

A solução foi construída com arquitetura simples e leve, ideal para demonstração, validação de conceito e evolução incremental.

---

## Estrutura do projeto

```text
Lagoa-em-jogo/
├── backend/
│   ├── database/
│   │   └── db.json
│   ├── check.js
│   └── server.js
├── docs/
│   ├── MVP.md
│   ├── PRD.md
│   └── implementation-plan.md
├── frontend/
│   ├── admin.html
│   ├── index.html
│   ├── manifest.webmanifest
│   ├── sw.js
│   ├── icons/
│   ├── scripts/
│   │   ├── admin.js
│   │   └── app.js
│   └── styles/
│       └── app.css
├── AGENTS.md
├── package.json
├── README.md
└── .gitignore
```

---

## Requisitos

- Node.js 18 ou superior
- npm
- navegador moderno

---

## Como executar o projeto

1. Acesse a pasta do projeto:

```bash
cd "c:\Users\User\Documents\3º DS\Lagoa-em-jogo"
```

2. Instale as dependências (se necessário):

```bash
npm install
```

3. Inicie a aplicação:

```bash
npm start
```

4. Acesse no navegador:

```text
http://localhost:3000
```

5. Acesse o painel administrativo:

```text
http://localhost:3000/admin.html
```

---

## Credenciais de demonstração

Para ambiente local de desenvolvimento, o projeto já inclui usuário administrativo de exemplo:

- Email: admin@lagoaemjogo.local
- Senha: admin123

> Essas credenciais são exclusivas para ambiente local e devem ser substituídas em produção por práticas seguras de autenticação.

---

## Fluxo de uso principal

### Usuário visitante

- visualiza os campeonatos;
- acompanha times e atletas;
- lê notícias;
- vê classificação e estatísticas;
- acessa galerias.

### Usuário autenticado

- realiza cadastro e login;
- edita perfil;
- participa de comentários e interações disponíveis.

### Administrador / organizador

- cria e gerencia campeonatos;
- cadastra times, atletas e jogos;
- publica notícias e galerias;
- acompanha estatísticas e moderadores de comentários;
- controla acesso e permissões do sistema.

---

## Objetivos de apresentação profissional

Este projeto pode ser apresentado como uma solução funcional para o futebol local, com foco em:

- organização esportiva;
- visibilidade de campeonatos e equipes;
- atualização em tempo real de resultados;
- gestão administrativa leve e acessível;
- modernização da comunicação do futebol comunitário.

A estrutura atual permite demonstrar de forma clara o valor do produto, com uma narrativa que parte do problema do futebol local e segue para a solução digital centralizada.

---

## Implementações futuras

As próximas etapas previstas pela documentação do projeto e pelo roadmap de evolução são:

- Pesquisa global por conteúdos;
- Favoritos e personalização da experiência;
- Notificações para usuários;
- Sistema de palpites;
- Conta do usuário com gestão mais completa;
- Central de contato;
- Melhorias em páginas de erro e SEO;
- Testes automatizados e validação de qualidade;
- Deploy em ambiente de produção;
- Aplicativo mobile Android/iOS;
- Ranking histórico, Hall da Fama e outros módulos de expansão.

Esses itens representam evoluções futuras do ecossistema do Lagoa em Jogo e não fazem parte da implementação atual.

---

## Conclusão

O Lagoa em Jogo já apresenta uma base sólida para demonstrar uma plataforma real de gestão e acompanhamento do futebol local. O projeto está bem posicionado para apresentação em nível de MVP, com arquitetura simples, interface funcional e estrutura preparada para expansão futura.

A implementação atual demonstra a viabilidade da ideia e estabelece uma base técnica sólida para continuar evoluindo com novas fases e novas funcionalidades.
