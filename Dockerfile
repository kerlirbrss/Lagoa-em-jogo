# ============================================================
# Lagoa em Jogo - Dockerfile (Fase 17 - Deploy)
# Imagem de producao: Node.js + backend + frontend + scripts
# ============================================================
FROM node:20-alpine

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

# O projeto nao possui dependencias externas de runtime,
# apenas o package.json/package-lock.json para documentacao.
COPY package.json package-lock.json ./
RUN npm install --omit=dev || true

COPY backend ./backend
COPY frontend ./frontend
COPY scripts ./scripts

# Banco e backups em volumes persistentes
ENV LEJ_DB_PATH=/app/data/db.json
ENV LEJ_BACKUP_DIR=/app/backups
ENV LEJ_BACKUP_KEEP=14
ENV LEJ_LOG_REQUESTS=1
ENV LEJ_TRUST_PROXY=1
ENV LEJ_FORCE_HTTPS=1
ENV LEJ_SECURE_COOKIES=1

RUN mkdir -p /app/data /app/backups && chown -R node:node /app

USER node

EXPOSE 3000

VOLUME ["/app/data", "/app/backups"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node /app/scripts/monitor.js "http://127.0.0.1:3000"

CMD ["node", "backend/server.js"]