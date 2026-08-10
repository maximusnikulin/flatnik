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
npm install                      # ставит зависимости всех workspaces сразу
docker compose up -d postgres    # база данных (порт 5432 только на 127.0.0.1)
npm run dev                      # back :3000 + front :5173
```

Открыть http://localhost:5173 — карта отзывов: поиск адреса, список квартир дома,
отзывы и форма добавления.

Vite проксирует `/api` на `localhost:3000`, поэтому CORS в разработке не нужен.

Без ключей Яндекса приложение остаётся рабочим: вместо карты — заглушка со списком
домов, по которым есть отзывы, а проверка капчи на бэкенде пропускается с
предупреждением в логе.

### Переменные окружения

Один файл `.env` в корне (образец — [.env.example](.env.example)) читают трое:
docker compose (лежит рядом), back в dev-режиме (`envFilePath: ['.env', '../.env']`)
и Vite (`envDir: '..'`). Всё имеет dev-дефолты, поэтому без `.env` тоже заведётся.

| Переменная | Назначение |
|---|---|
| `POSTGRES_HOST/PORT/USER/PASSWORD/DB` | подключение к БД; этими же значениями инициализируется контейнер postgres |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | подпись и срок жизни токенов; на сервере секрет обязательно заменить |
| `SMARTCAPTCHA_SERVER_KEY` | серверный ключ SmartCaptcha; пусто — проверка выключена |
| `VITE_SMARTCAPTCHA_CLIENT_KEY` | клиентский ключ SmartCaptcha (инлайнится в бандл при сборке) |
| `VITE_YANDEX_MAPS_API_KEY` | ключ Яндекс Карт JS API; пусто — вместо карты заглушка |

### Ключи Яндекса

- **Карты**: бесплатный ключ «JavaScript API и HTTP Геокодер» выдаётся в
  [кабинете разработчика](https://developer.tech.yandex.ru/services/). Положить в
  `VITE_YANDEX_MAPS_API_KEY`.
- **SmartCaptcha**: капча создаётся в [Яндекс Облаке](https://console.yandex.cloud/)
  (сервис Yandex SmartCaptcha), выдаёт пару «ключ клиента» / «ключ сервера» —
  `VITE_SMARTCAPTCHA_CLIENT_KEY` и `SMARTCAPTCHA_SERVER_KEY`.

Пока адрес сервиса — плавающий trycloudflare, ограничение по доменам у обоих
ключей должно быть выключено, иначе прод сломается при первом же рестарте туннеля.

### Авторизация-заглушка

SMS не отправляются: `POST /api/auth/request-code` печатает шестизначный код в лог
бэкенда, `verify-code` обменивает его на JWT.

```bash
curl -i -X POST localhost:3000/api/auth/request-code \
  -H 'Content-Type: application/json' -d '{"phone":"+79991234567"}'
# код смотреть: docker compose logs back | grep 'Код' (или терминал npm run dev)
curl -s -X POST localhost:3000/api/auth/verify-code \
  -H 'Content-Type: application/json' -d '{"phone":"+79991234567","code":"XXXXXX"}'
```

Swagger UI со всем контрактом — http://localhost:3000/api/docs.

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
| `postgres` | `127.0.0.1:5432` | БД; порт только на loopback — для `npm run dev` вне Docker |
| `cloudflared` | — | HTTPS-туннель к `front` |

Локально: http://localhost:8080

Бэкенд намеренно не имеет `ports` — он доступен только внутри сети compose, снаружи трафик идёт через nginx.

Данные Postgres живут в named volume `postgres-data`: `docker compose down` их не
трогает, а вот `down -v` удалит безвозвратно — на сервере не запускать. Схему БД на
этапе скелета ведёт TypeORM `synchronize`; до появления реальных пользовательских
данных его нужно заменить миграциями.

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

Один обязательный ручной шаг — создать `/srv/flatnik/.env` по образцу
`.env.example` с боевыми значениями: `JWT_SECRET`, `POSTGRES_PASSWORD`, ключи
Яндекса. Файл не под git, поэтому `git reset --hard` при деплое его не трогает;
без него стек поднимется на dev-дефолтах — с дефолтным секретом и без капчи.
Если `.env` появился после выката, нужен повторный деплой (`workflow_dispatch`
или `docker compose up -d --build` на сервере): `VITE_*`-ключи инлайнятся в бандл
при сборке образа front.

В остальном действий не требуется: workflow сам создаёт каталог `/srv/flatnik`, клонирует репозиторий и генерирует SSH-ключ, если его нет. Образы собираются на сервере, перед сборкой чистятся кеш builder'а и висячие образы — на VPS с ~2 ГБ RAM место иначе кончается.

Единственный ручной шаг возникает при пересоздании сервера: шаг `Ensure deploy key on server` напечатает в лог новый публичный ключ, его надо добавить в `Settings → Deploy keys` с доступом только на чтение — репозиторий приватный.

### Реестр npm

В корне лежит `.npmrc` с `registry=https://registry.npmjs.org/`. Без него `package-lock.json`, сгенерированный за корпоративным VPN, содержит ссылки на внутренний Artifactory, и `npm ci` вне VPN зависает, а затем падает с `Exit handler never called!` — и на сервере, и на раннерах GitHub. Если lockfile обновляется из-под VPN, стоит проверить, что в нём нет внутренних хостов:

```bash
grep -c 'registry.npmjs.org' package-lock.json
```

## Что дальше

- Миграции TypeORM вместо `synchronize` (обязательно до реальных данных)
- Настоящая отправка SMS вместо кода в логах; коды — во внешнее хранилище
- Механизм подтверждения отзывов (сейчас статус меняется руками в БД)
- Rate limiting на `request-code` и точный клиентский IP за прокси
- Постоянный домен вместо quick-туннеля (заодно включить ограничение доменов у ключей Яндекса)
