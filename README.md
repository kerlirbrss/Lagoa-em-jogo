# Lagoa em Jogo

Plataforma para acompanhamento do futebol amador e comunitario de Lagoa de Sao Francisco - PI.

## Estrutura

- `backend/`: API HTTP em Node.js, autenticacao, usuarios e acesso ao banco JSON.
- `backend/database/`: arquivo de dados local para desenvolvimento.
- `frontend/`: interface web estatica com layout base e tema visual.
- `docs/`: documentos do produto e plano de implementacao.

## Requisitos

- Node.js 18 ou superior.

## Como iniciar

```bash
npm start
```

Depois acesse:

```text
http://localhost:3000
```

## Gestao de usuarios

A fase 1 inclui cadastro, login, logout, recuperacao de senha em modo desenvolvimento, perfil do usuario e edicao de perfil.

Perfis disponiveis:

- Visitante
- Usuario
- Organizador
- Fotografo
- Administrador

## Administracao

A fase 2 inclui painel administrativo com dashboard, gerenciamento de usuarios, controle de perfis/permissoes e moderacao de comentarios.

Rotas administrativas disponiveis para usuarios com perfil `administrador`:

- `GET /api/admin/dashboard`
- `GET /api/admin/users`
- `PATCH /api/admin/users/:id`
- `GET /api/admin/comments`
- `PATCH /api/admin/comments/:id`

## Campeonatos

A fase 3 inclui gerenciamento de campeonatos com criacao, edicao, exclusao, temporada, status, datas, descricao, regulamento e premiacoes.

Rotas de campeonatos:

- `GET /api/championships`
- `GET /api/admin/championships`
- `POST /api/admin/championships`
- `PUT /api/admin/championships/:id`
- `DELETE /api/admin/championships/:id`

## Credenciais de desenvolvimento

- Email: `admin@lagoaemjogo.local`
- Senha: `admin123`

## Scripts

- `npm start`: inicia o servidor de desenvolvimento.
- `npm run dev`: inicia o servidor com a porta padrao.
- `npm run check`: valida se os arquivos principais carregam sem erro.
