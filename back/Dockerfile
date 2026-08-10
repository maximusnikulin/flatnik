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

# Повторный npm ci здесь не делаем: с --omit=dev на workspaces он падает
# с "Exit handler never called!" (воспроизводится и на раннере с 16 ГБ,
# то есть причина не в памяти). Переносим node_modules из builder как есть.
# Образ выходит крупнее на размер devDependencies — приемлемо для MVP.
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared/package.json ./shared/
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/back/package.json ./back/
COPY --from=builder /app/back/dist ./back/dist

# Явная проверка: если зависимостей нет, образ не должен собраться
RUN test -d node_modules/@nestjs/core && test -f back/dist/main.js

EXPOSE 3000
CMD ["node", "back/dist/main.js"]
