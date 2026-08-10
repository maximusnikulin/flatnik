# Контекст сборки — корень монорепо (см. docker-compose.yml)
FROM node:20-alpine AS builder
WORKDIR /app

# npm 10.8.2 из образа падает с "Exit handler never called!" на workspaces,
# при этом возвращает код 0 — сборка молча продолжается без зависимостей.
RUN npm install -g npm@10.9.2

# package.json всех workspaces нужны целиком: npm ci сверяется с lockfile
# и падает, если какой-то из них отсутствует.
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY back/package.json ./back/
COPY front/package.json ./front/
RUN npm ci && test -x node_modules/.bin/tsc

COPY shared ./shared
COPY back ./back
RUN npm run build --workspace=@flatnik/shared \
 && npm run build --workspace=@flatnik/back

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN npm install -g npm@10.9.2

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY back/package.json ./back/
COPY front/package.json ./front/
RUN npm ci --omit=dev \
 && test -d node_modules/@nestjs/core \
 && npm cache clean --force

COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/back/dist ./back/dist

EXPOSE 3000
CMD ["node", "back/dist/main.js"]
