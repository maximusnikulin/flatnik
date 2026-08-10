# Контекст сборки — корень монорепо (см. docker-compose.yml)
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
COPY shared/package.json ./shared/
COPY back/package.json ./back/
RUN npm install --workspace=@flatnik/shared --workspace=@flatnik/back --include-workspace-root

COPY shared ./shared
COPY back ./back
RUN npm run build --workspace=@flatnik/shared \
 && npm run build --workspace=@flatnik/back

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./
COPY shared/package.json ./shared/
COPY back/package.json ./back/
RUN npm install --omit=dev --workspace=@flatnik/shared --workspace=@flatnik/back --include-workspace-root

COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/back/dist ./back/dist

EXPOSE 3000
CMD ["node", "back/dist/main.js"]
