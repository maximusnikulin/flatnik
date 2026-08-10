# flatnik

Монорепозиторий на npm workspaces: NestJS-бэкенд и React-фронтенд.

## Стек

| Часть | Технологии |
|---|---|
| `back/` | NestJS 10, TypeScript |
| `front/` | React 18, Vite, Zustand, TanStack Query |
| `shared/` | Общие типы и DTO для обеих частей |
| Инфраструктура | Docker Compose, nginx, Cloudflare Tunnel |

## Структура

```
flatnik/
├── back/          # NestJS API
├── front/         # React SPA
├── shared/        # общие типы (@flatnik/shared)
├── docker-compose.yml
└── .github/workflows/deploy.yml
```

`shared` подключён к обоим пакетам как зависимость, поэтому изменение контракта API ломает сборку на этапе компиляции, а не в рантайме.

## Локальная разработка

```bash
npm install          # ставит зависимости всех workspaces сразу
npm run dev          # back :3000 + front :5173
```

Открыть http://localhost:5173 — на главной выводится состояние бэкенда.

Vite проксирует `/api` на `localhost:3000`, поэтому CORS в разработке не нужен.

## Docker

```bash
npm run up           # сборка и запуск всех сервисов
npm run logs         # логи
npm run tunnel       # публичный HTTPS-адрес
npm run down         # остановить
```

| Сервис | Порт | Назначение |
|---|---|---|
| `front` | `8080` → 80 | nginx: статика SPA + прокси `/api` на back |
| `back` | внутренний 3000 | NestJS, наружу не публикуется |
| `cloudflared` | — | HTTPS-туннель к `front` |

Локально: http://localhost:8080

Бэкенд намеренно не имеет `ports` — он доступен только внутри сети compose, снаружи трафик идёт через nginx.

## Проверочный роут

```bash
curl http://localhost:8080/api/health
```

```json
{ "status": "ok", "service": "back", "uptime": 42, "timestamp": "..." }
```

У обоих сервисов настроен healthcheck, а `front` стартует только после того, как `back` станет healthy.

## Публичный URL

`cloudflared` поднимает HTTPS-туннель и выдаёт адрес вида `https://<случайные-слова>.trycloudflare.com`. Порты 80/443 на сервере открывать не нужно, DNS не настраивается, сертификат выдаётся автоматически.

```bash
npm run tunnel
```

Адрес меняется при каждом перезапуске контейнера — это ограничение бесплатных quick-туннелей. Для постоянного адреса понадобится named tunnel с токеном Cloudflare.

## Деплой

Пуш в `main` запускает `.github/workflows/deploy.yml`: по SSH на сервере выполняется `git reset --hard origin/main` и пересборка compose. В конце в лог workflow выводится актуальный URL туннеля.

Требуемые секреты репозитория (`Settings → Secrets and variables → Actions`):

| Секрет | Значение |
|---|---|
| `SSH_HOST` | IP сервера |
| `SSH_USER` | пользователь SSH |
| `SSH_PRIVATE_KEY` | приватный ключ деплоя целиком |

Окружение `production` даёт изоляцию секретов и возможность включить ручное подтверждение выкатки.

### Подготовка сервера

Отдельных действий не требуется: workflow сам создаёт каталог `/srv/flatnik`, клонирует репозиторий и генерирует SSH-ключ, если его нет. Образы собираются на сервере, перед сборкой чистятся кеш builder'а и висячие образы — на VPS с ~2 ГБ RAM место иначе кончается.

Единственный ручной шаг возникает при пересоздании сервера: шаг `Ensure deploy key on server` напечатает в лог новый публичный ключ, его надо добавить в `Settings → Deploy keys` с доступом только на чтение — репозиторий приватный.

### Реестр npm

В корне лежит `.npmrc` с `registry=https://registry.npmjs.org/`. Без него `package-lock.json`, сгенерированный за корпоративным VPN, содержит ссылки на внутренний Artifactory, и `npm ci` вне VPN зависает, а затем падает с `Exit handler never called!` — и на сервере, и на раннерах GitHub. Если lockfile обновляется из-под VPN, стоит проверить, что в нём нет внутренних хостов:

```bash
grep -c 'registry.npmjs.org' package-lock.json
```

## Что дальше

- Postgres + TypeORM (инфраструктура под это уже заложена)
- Авторизация JWT
- Постоянный домен вместо quick-туннеля
