# Контекст сборки — корень монорепо (см. docker-compose.yml)
FROM node:20-alpine AS builder
WORKDIR /app

# package.json всех workspaces нужны целиком: npm ci сверяется с lockfile
# и падает, если какой-то из них отсутствует.
COPY package.json package-lock.json .npmrc ./
COPY shared/package.json ./shared/
COPY back/package.json ./back/
COPY front/package.json ./front/
RUN npm ci

COPY shared ./shared
COPY front ./front

# Vite инлайнит VITE_* в бандл на этапе сборки, поэтому ключи приходят
# build-аргами (см. args в docker-compose.yml), а не переменными рантайма.
ARG VITE_YANDEX_MAPS_API_KEY
ARG VITE_SMARTCAPTCHA_CLIENT_KEY
ENV VITE_YANDEX_MAPS_API_KEY=$VITE_YANDEX_MAPS_API_KEY \
    VITE_SMARTCAPTCHA_CLIENT_KEY=$VITE_SMARTCAPTCHA_CLIENT_KEY

RUN npm run build --workspace=@flatnik/shared \
 && npm run build --workspace=@flatnik/front

FROM nginx:1.27-alpine AS runner
COPY front/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/front/dist /usr/share/nginx/html

EXPOSE 80
