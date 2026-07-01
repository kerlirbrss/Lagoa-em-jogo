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

## Credenciais de desenvolvimento

- Email: `admin@lagoaemjogo.local`
- Senha: `admin123`

## Scripts

- `npm start`: inicia o servidor de desenvolvimento.
- `npm run dev`: inicia o servidor com a porta padrao.
- `npm run check`: valida se os arquivos principais carregam sem erro.
