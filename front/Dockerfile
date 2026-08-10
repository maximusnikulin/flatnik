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
RUN npm ci && test -x node_modules/.bin/vite

COPY shared ./shared
COPY front ./front
RUN npm run build --workspace=@flatnik/shared \
 && npm run build --workspace=@flatnik/front

FROM nginx:1.27-alpine AS runner
COPY front/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/front/dist /usr/share/nginx/html

EXPOSE 80
