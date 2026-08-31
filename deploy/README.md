# Guia de Deploy — Lagoa em Jogo (Fase 17)

Este guia descreve como publicar o **Lagoa em Jogo** em produção, cobrindo as entregas da Fase 17:

- ✅ Banco de dados em produção
- ✅ Backend publicado
- ✅ Frontend publicado
- ✅ Configuração de HTTPS
- ✅ Backup automático
- ✅ Monitoramento da aplicação
- ✅ Registro de logs
- ✅ Validação final do ambiente de produção

---

## 1. Visão geral da arquitetura

A aplicação é um único processo Node.js que serve a API (`/api/*`) e os arquivos estáticos do frontend
(`frontend/`). O "banco de dados" é o arquivo JSON persistente apontado pela variável `LEJ_DB_PATH`.

```
Navegador (HTTPS)
   │
   ▼
Proxy reverso (Nginx / Caddy / Render)  ← TLS/HTTPS
   │  X-Forwarded-Proto
   ▼
Node.js (backend/server.js, porta 3000)
   │
   ├── frontend/  (HTML/CSS/JS estáticos)
   └── backend/database/db.json  (dados persistentes)
```

> Em produção **sempre** coloque um proxy reverso ou plataforma gerenciada na frente do Node.js.
> O próprio Node.js não deve terminar TLS diretamente para esse modelo (ele delega ao proxy).
> Com `LEJ_TRUST_PROXY=1` o servidor confia nos cabeçalhos `X-Forwarded-Proto`.

---

## 2. Variáveis de ambiente

Copie `.env.example` para `.env` (ou configure as variáveis na plataforma escolhida):

| Variável | Descrição |
|---|---|
| `NODE_ENV` | `production` em produção |
| `PORT` | Porta do servidor (padrão 3000) |
| `SESSION_SECRET` | Segredo forte, único, 32+ caracteres |
| `LEJ_TRUST_PROXY` | `1` para confiar no proxy reverso (HTTPS detectado corretamente) |
| `LEJ_FORCE_HTTPS` | `1` para redirecionar qualquer HTTP para HTTPS |
| `LEJ_SECURE_COOKIES` | `1` para marcar cookies de sessão como `Secure` |
| `LEJ_DB_PATH` | Caminho do banco de dados persistente |
| `LEJ_LOG_REQUESTS` | `1` para registrar cada requisição em log JSON |
| `LEJ_BACKUP_DIR` | Pasta dos backups (padrão `./backups`) |
| `LEJ_BACKUP_KEEP` | Quantos backups manter (padrão 14) |
| `LEJ_MONITOR_URL` | URL usada pelo monitoramento |
| `LEJ_MONITOR_TIMEOUT_MS` | Timeout do health check (padrão 5000) |

> O banco é criado automaticamente no primeiro acesso (volumes vazios funcionam sem seed manual).

---

## 3. Opções de publicação

### 3.1 VPS + Nginx + Let's Encrypt (recomendado para controle total)

1. Instale o Node.js 18+ na VPS.
2. Copie os arquivos para `/opt/lagoa-em-jogo` e instale o serviço:

```bash
sudo mkdir -p /opt/lagoa-em-jogo /etc/lagoa-em-jogo /var/log/lagoa-em-jogo
sudo cp -r backend frontend scripts package.json package-lock.json /opt/lagoa-em-jogo/
sudo cp deploy/lagoa-em-jogo.service /etc/systemd/system/
sudo cp deploy/lagoa-em-jogo-backup.service deploy/lagoa-em-jogo-backup.timer /etc/systemd/system/
sudo cp deploy/lagoa-em-jogo-monitor.service deploy/lagoa-em-jogo-monitor.timer /etc/systemd/system/
sudo cp deploy/logrotate.conf /etc/logrotate.d/lagoa-em-jogo
```

3. Configure o ambiente de produção:

```bash
sudo cp .env /etc/lagoa-em-jogo/sistema.env
# Edite /etc/lagoa-em-jogo/sistema.env com NODE_ENV=production, SESSION_SECRET forte,
# LEJ_DB_PATH=/opt/lagoa-em-jogo/backend/database/db.json,
# LEJ_BACKUP_DIR=/opt/lagoa-em-jogo/backups
```

4. Suba os serviços:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now lagoa-em-jogo
sudo systemctl enable --now lagoa-em-jogo-backup.timer
sudo systemctl enable --now lagoa-em-jogo-monitor.timer
```

5. Configure o Nginx com HTTPS:

```bash
sudo apt install nginx certbot python3-certbot-nginx
sudo cp deploy/nginx.conf /etc/nginx/sites-available/lagoa-em-jogo
sudo ln -s /etc/nginx/sites-available/lagoa-em-jogo /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d lagoaemjogo.com.br -d www.lagoaemjogo.com.br
```

6. Valide o ambiente:

```bash
NODE_ENV=production SESSION_SECRET="<seu-segredo>" \
  LEJ_FORCE_HTTPS=1 LEJ_TRUST_PROXY=1 \
  node scripts/check-production.js --url https://lagoaemjogo.com.br
```

### 3.2 Docker / Docker Compose

```bash
cp .env.example .env     # ajuste SESSION_SECRET
docker compose up -d --build
docker compose ps        # conferir healthcheck
docker logs -f lagoa-em-jogo
```

O banco fica em um volume (`lej-data`) e os backups em (`lej-backups`).
Atrás de um proxy reverso, use as mesmas variáveis `LEJ_TRUST_PROXY`, `LEJ_FORCE_HTTPS`
e `LEJ_SECURE_COOKIES` já configuradas na imagem.

### 3.3 Plataformas gerenciadas (Render / Railway / Fly.io)

- Build: `npm install`
- Start: `node backend/server.js`
- Porta: a plataforma injeta `PORT`
- Persistência: monte/use disco persistente e aponte `LEJ_DB_PATH` para o caminho persistente
- HTTPS: ative no painel da plataforma e mantenha `LEJ_TRUST_PROXY=1`, `LEJ_FORCE_HTTPS=1`,
  `LEJ_SECURE_COOKIES=1`
- Agendamentos: use cron/workers para `npm run backup` (diário) e `npm run monitor` (5 em 5 min)

---

## 4. Backup automático

- Local: `npm run backup` (gera `backups/db-AAAAmmDD-HHMMSS.gz`, mantém os 14 mais recentes).
- Simulação: `npm run backup -- --dry-run`
- Automatizado no systemd: timer `lagoa-em-jogo-backup.timer` (todos os dias às 03:00).
- Para enviar cópias para outro servidor, use `rclone sync /opt/lagoa-em-jogo/backups` em um cron.

## 5. Monitoramento

- Local: `npm run monitor` ou `node scripts/monitor.js https://lagoaemjogo.com.br`
  (exit 0 = saudável, exit 1 = problema).
- Automatizado no systemd: timer `lagoa-em-jogo-monitor.timer` (a cada 5 min).
- O Docker já inclui `HEALTHCHECK` usando o mesmo script.
- Para alertas externos (UptimeRobot, StatusCake), aponte para `https://lagoaemjogo.com.br/api/health`.

## 6. Logs

- Em produção (`NODE_ENV=production` ou `LEJ_LOG_REQUESTS=1`) cada requisição é registrada
  em uma linha JSON com `time`, `method`, `path`, `status`, `durationMs`.
- No systemd os logs vão para `/var/log/lagoa-em-jogo/app.log` e são rotacionados
  diariamente pelo `logrotate` (config em `deploy/logrotate.conf`).
- O endpoint `/api/health` e o `scripts/monitor.js` expressam o estado da aplicação para dashboards.

## 7. Validação final (checklist de produção)

- [ ] `NODE_ENV=production`, `SESSION_SECRET` forte definido
- [ ] `LEJ_FORCE_HTTPS=1`, `LEJ_TRUST_PROXY=1`, `LEJ_SECURE_COOKIES=1`
- [ ] Certificado HTTPS emitido e renovando automaticamente (certbot/systemd)
- [ ] `npm run check` passando
- [ ] `npm test` passando
- [ ] `npm run backup -- --dry-run` ok
- [ ] `npm run monitor https://<dominio>` responde ok
- [ ] `npm run check:production -- --url https://<dominio>` — todas as checagens `[OK]`
- [ ] Teste manual: abrir o site, logar, navegar, publicar conteúdo no admin