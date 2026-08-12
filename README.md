# flatnik

Монорепозиторий на npm workspaces: NestJS-бэкенд и React-фронтенд.

## Стек

| Часть | Технологии |
|---|---|
| `back/` | NestJS 10, TypeScript |
| `front/` | React 18, Vite, Zustand, TanStack Query |
| `shared/` | Общие типы и DTO для обеих частей |
| Инфраструктура | Docker Compose, nginx-гейтвей, Cloudflare Tunnel |

## Структура

```
flatnik/
├── back/          # NestJS API (Dockerfile + Dockerfile.dev)
├── front/         # React SPA (Dockerfile + Dockerfile.dev)
├── shared/        # общие типы (@flatnik/shared)
├── nginx/         # конфиги гейтвея: dev.conf.template и prod.conf.template
├── docker-compose.yml       # разработка: watch и HMR (файл по умолчанию)
├── docker-compose.prod.yml  # production: собранные образы
└── .github/workflows/deploy.yml
```

`shared` подключён к обоим пакетам как зависимость, поэтому изменение контракта API ломает сборку на этапе компиляции, а не в рантайме.

## Локальная разработка

Разработка идёт в Docker: `docker-compose.yml` поднимает стек в watch-режиме,
исходники монтируются с хоста, работают HMR фронта и перезапуск бэкенда.

```bash
npm install        # нужен для типов в IDE; в контейнерах зависимости свои
npm run up:dev     # postgres + shared + back + front + gateway + туннель
npm run logs:dev   # логи всех сервисов
npm run down:dev   # остановить
```

Открыть http://localhost:8080 — карта отзывов: поиск адреса, список квартир дома,
отзывы и форма добавления.

Правки в `front/src` приезжают в браузер без перезагрузки, в `back/src` —
перезапускают Nest, в `shared/src` — пересобирают контракт (за это отвечает
отдельный сервис `shared` с `tsc --watch`; без него back и front видели бы
старый `shared/dist`).

Всё идёт через гейтвей на одном origin: `/api/...` — в NestJS, остальное — в
Vite вместе с его WebSocket'ом. Поэтому CORS не участвует ни в dev, ни в prod,
а в коде фронта нет абсолютных адресов бэкенда.

| Сервис dev-стека | Роль |
|---|---|
| `gateway` | nginx, `${GATEWAY_PORT}` → 80; единственный публикуемый порт |
| `front` | vite dev server с HMR, внутренний `${FRONT_PORT}` |
| `back` | `nest start --watch`, внутренний `${BACK_PORT}` |
| `shared` | `tsc --watch` по контракту |
| `postgres` | БД, `127.0.0.1:${POSTGRES_PORT}` для psql с хоста |
| `cloudflared` | HTTPS-туннель к гейтвею (`npm run tunnel:dev`) |

Имя dev-проекта — `flatnik-dev`, поэтому его контейнеры и том с данными не
пересекаются с production-стеком из `docker-compose.prod.yml`.

Зависимости живут в named volume, а не берутся с хоста: в lockfile есть
платформенные `@esbuild/*` и `@rollup/*`, и macOS-бинарники в linux-контейнере не
запустятся. Следствие: после правки `package.json` тома с зависимостями нужно
пересоздать — `npm run rebuild:dev` (данные Postgres при этом не трогаются,
в отличие от `down -v`).

Без ключей Яндекса приложение остаётся рабочим: вместо карты — заглушка со списком
домов, по которым есть отзывы, а проверка капчи на бэкенде пропускается с
предупреждением в логе.

### Переменные окружения

Один файл `.env` в корне (образец — [.env.example](.env.example)) читают трое:
docker compose (лежит рядом, оба файла — prod и dev), back
(`envFilePath: ['.env', '../.env']`) и Vite (`envDir: '..'`). Всё имеет
dev-дефолты, поэтому без `.env` тоже заведётся.

| Переменная | Назначение |
|---|---|
| `GATEWAY_PORT` | порт гейтвея на хосте — единственный публикуемый (по умолчанию 8080) |
| `BACK_PORT`, `FRONT_PORT` | внутренние порты back и vite; наружу не пробрасываются |
| `POSTGRES_HOST/PORT/USER/PASSWORD/DB` | подключение к БД; этими же значениями инициализируется контейнер postgres |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | подпись и срок жизни токенов; на сервере секрет обязательно заменить |
| `SMARTCAPTCHA_SERVER_KEY` | серверный ключ SmartCaptcha; пусто — проверка выключена |
| `VITE_SMARTCAPTCHA_CLIENT_KEY` | клиентский ключ SmartCaptcha (инлайнится в бандл при сборке) |
| `VITE_YANDEX_MAPS_API_KEY` | ключ Яндекс Карт JS API; пусто — вместо карты заглушка |
| `VITE_YANDEX_SEARCH_API_KEY` | ключ Geocoder API (поиск адреса); пусто — берётся ключ карты |
| `VITE_YANDEX_SUGGEST_API_KEY` | ключ Suggest API (подсказки адреса); пусто — берётся ключ карты |

### Ключи Яндекса

- **Карты**: бесплатный ключ «JavaScript API и HTTP Геокодер» выдаётся в
  [кабинете разработчика](https://developer.tech.yandex.ru/services/). Положить в
  `VITE_YANDEX_MAPS_API_KEY`.
- **Поиск адреса и подсказки**: `ymaps3.search` и `ymaps3.suggest` — это Geocoder API
  и Suggest API, отдельные HTTP-сервисы со своими ключами и тарифами. Ключ JS API их
  не авторизует: запрос с ним сервис отклоняет, и поиск в строке адреса не работает.
  Ключи передаются рантайму через `setApikeys` (`front/src/features/map/lib/ymaps.ts`);
  если `VITE_YANDEX_SEARCH_API_KEY` и `VITE_YANDEX_SUGGEST_API_KEY` пусты, берётся
  ключ карты — этого достаточно, когда в кабинете все три сервиса подключены к
  одному ключу.
- **SmartCaptcha**: капча создаётся в [Яндекс Облаке](https://console.yandex.cloud/)
  (сервис Yandex SmartCaptcha), выдаёт пару «ключ клиента» / «ключ сервера» —
  `VITE_SMARTCAPTCHA_CLIENT_KEY` и `SMARTCAPTCHA_SERVER_KEY`.

Пока адрес сервиса — плавающий trycloudflare, ограничение по доменам у обоих
ключей должно быть выключено, иначе прод сломается при первом же рестарте туннеля.

### Авторизация-заглушка

SMS не отправляются: `POST /api/auth/request-code` печатает шестизначный код в лог
бэкенда, `verify-code` обменивает его на JWT.

```bash
curl -i -X POST localhost:8080/api/auth/request-code \
  -H 'Content-Type: application/json' -d '{"phone":"+79991234567"}'
# код смотреть: npm run logs:dev | grep 'Код'
curl -s -X POST localhost:8080/api/auth/verify-code \
  -H 'Content-Type: application/json' -d '{"phone":"+79991234567","code":"XXXXXX"}'
```

Swagger UI со всем контрактом — http://localhost:8080/api/docs.

## Docker

Два независимых стека, каждый со своими Dockerfile'ами:

| Файл | Dockerfile'ы | Команды | Что внутри |
|---|---|---|---|
| `docker-compose.yml` | `*/Dockerfile.dev` | `up:dev`, `logs:dev`, `down:dev`, `tunnel:dev` | watch + HMR, исходники с хоста; файл по умолчанию |
| `docker-compose.prod.yml` | `*/Dockerfile` | `up`, `logs`, `down`, `tunnel` | собранные образы; этот же файл выкатывает деплой |

```bash
npm run up           # сборка и запуск production-стека
npm run logs         # логи
npm run tunnel       # публичный HTTPS-адрес
npm run down         # остановить
```

Production-стек:

| Сервис | Порт | Назначение |
|---|---|---|
| `gateway` | `${GATEWAY_PORT}` → 80 | nginx: статика SPA + прокси `/api` на back |
| `back` | внутренний `${BACK_PORT}` | NestJS, наружу не публикуется |
| `front` | — | одноразовый: выкладывает бандл в volume `front-dist` и завершается |
| `postgres` | `127.0.0.1:${POSTGRES_PORT}` | БД; порт только на loopback |
| `cloudflared` | — | HTTPS-туннель к `gateway` |

Локально: http://localhost:8080

Ни back, ни front не имеют `ports` — снаружи доступен только гейтвей, он же
держит статику и API на одном origin. Файл по умолчанию (`docker-compose.yml`) —
это dev-стек, поэтому production всегда подключается явным
`-f docker-compose.prod.yml`; этот флаг стоит во всех prod-командах `package.json`
и `deploy.yml`. `docker-compose.override.yml` в проекте намеренно нет: он
подхватывался бы автоматически и незаметно смешал бы конфиги.

Данные Postgres живут в named volume `postgres-data`: `npm run down` их не
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

Healthcheck'и есть у `postgres`, `back` и `gateway`; порядок старта задан через
`depends_on`: `back` ждёт готовности базы, а `gateway` — и healthy-состояния
`back`, и успешного завершения `front`, то есть появления бандла в volume.

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
или `docker compose -f docker-compose.prod.yml up -d --build` на сервере):
`VITE_*`-ключи инлайнятся в бандл при сборке образа front.

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
