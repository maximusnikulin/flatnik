# flatnik

Монорепозиторий на npm workspaces: NestJS-бэкенд и React-фронтенд.

## Стек

| Часть | Технологии |
|---|---|
| `back/` | NestJS 10, TypeScript |
| `front/` | React 18, Vite, Zustand, TanStack Query |
| `shared/` | Общие типы и DTO для обеих частей |
| Инфраструктура | Docker Compose, nginx-гейтвей, Let's Encrypt на общем edge-прокси |

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
npm install                    # нужен для типов в IDE; в контейнерах зависимости свои
docker compose up -d --build   # postgres + shared + back + front + gateway
docker compose logs -f         # логи всех сервисов
docker compose down            # остановить
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
| `VITE_YANDEX_MAPS_API_KEY` | ключ Яндекс Карт — карта, Geocoder и Suggest; пусто — вместо карты заглушка |

### Ключи Яндекса

- **Карты**: ключ выдаётся в
  [кабинете разработчика](https://developer.tech.yandex.ru/services/). Положить в
  `VITE_YANDEX_MAPS_API_KEY` — он один на все три сервиса.
- **Поиск адреса и подсказки**: `ymaps3.search` (строка поиска и адрес по клику
  в здание) и `ymaps3.suggest` — это Geocoder API и Suggest API, отдельные
  HTTP-сервисы. Ключ авторизует их только если оба подключены к нему в кабинете;
  иначе сервис отклоняет запрос и поиск адреса не работает, хотя карта рисуется.
  Ключ передаётся им явно через `setApikeys`
  (`front/src/features/map/lib/ymaps.ts`) — без этого вызова запрос уходит
  с ключом JS API и тоже получает отказ.
- **SmartCaptcha**: капча создаётся в [Яндекс Облаке](https://console.yandex.cloud/)
  (сервис Yandex SmartCaptcha), выдаёт пару «ключ клиента» / «ключ сервера» —
  `VITE_SMARTCAPTCHA_CLIENT_KEY` и `SMARTCAPTCHA_SERVER_KEY`.

### Авторизация-заглушка

SMS не отправляются: `POST /api/auth/request-code` печатает шестизначный код в лог
бэкенда, `verify-code` обменивает его на JWT.

Аккаунт привязан к телефону, а публично виден только никнейм — им подписаны
отзывы, телефон наружу не отдаётся вообще. При регистрации ник выдаётся
автоматически (`user_7f3a91`) и помечается неподтверждённым: отзыв должен быть
чем-то подписан ещё до того, как человек выберет имя. Пока `nicknameConfirmed`
равен false, фронт показывает модалку выбора ника, которую нельзя закрыть.
Уникальность — без учёта регистра, `PATCH /api/auth/me/nickname` отвечает 409 на
занятый.

```bash
curl -i -X POST localhost:8080/api/auth/request-code \
  -H 'Content-Type: application/json' -d '{"phone":"+79991234567"}'
# код смотреть: docker compose logs back | grep 'Код'
curl -s -X POST localhost:8080/api/auth/verify-code \
  -H 'Content-Type: application/json' -d '{"phone":"+79991234567","code":"XXXXXX"}'
```

Swagger UI со всем контрактом — http://localhost:8080/api/docs.

## Docker

Два независимых стека, каждый со своими Dockerfile'ами:

| Файл | Dockerfile'ы | Как подключается | Что внутри |
|---|---|---|---|
| `docker-compose.yml` | `*/Dockerfile.dev` | по умолчанию, без флагов | watch + HMR, исходники с хоста |
| `docker-compose.prod.yml` | `*/Dockerfile` | явным `-f docker-compose.prod.yml` | собранные образы; этот же файл выкатывает деплой |

```bash
docker compose -f docker-compose.prod.yml up -d --build   # сборка и запуск production-стека
docker compose -f docker-compose.prod.yml logs -f         # логи
docker compose -f docker-compose.prod.yml down            # остановить
```

Production-стек:

| Сервис | Порт | Назначение |
|---|---|---|
| `gateway` | внутренний 80 | nginx: статика SPA + прокси `/api` на back |
| `back` | внутренний `${BACK_PORT}` | NestJS, наружу не публикуется |
| `front` | — | одноразовый: выкладывает бандл в volume `front-dist` и завершается |
| `db` | — | Postgres, наружу не публикуется |

**Prod-стек не публикует на хост ни одного порта.** Достучаться до `gateway`
может только edge-прокси, и то по внешней docker-сети `app-network` — в неё
входит один `gateway` с алиасом `flatnik-gateway`. Поэтому локальный запуск
prod-стека покажет контейнеры, но открыть его в браузере не выйдет: для
разработки есть dev-стек на http://localhost:8080.

Файл по умолчанию (`docker-compose.yml`) — это dev-стек, поэтому production
всегда подключается явным `-f docker-compose.prod.yml`; без этого флага на
сервере поднялся бы dev-стек, и в `deploy.yml` он стоит везде.
`docker-compose.override.yml` в проекте намеренно нет: он подхватывался бы
автоматически и незаметно смешал бы конфиги.

Данные Postgres живут в named volume `db-data`: обычный `down` их не
трогает, а вот `down -v` удалит безвозвратно — на сервере не запускать.

### Схема БД: миграции

`synchronize` выключен и в dev, и в prod — схему ведут миграции TypeORM
(`back/src/database/migrations`). Они применяются автоматически при старте
приложения (`migrationsRun`), поэтому отдельного шага в деплое нет.

Поменял сущность — сгенерируй миграцию (изнутри контейнера, где есть доступ к БД):

```bash
docker compose exec back npm run migration:generate -- src/database/migrations/ИмяИзменения
docker compose exec back npm run migration:show
```

Генератор сравнивает сущности с текущей схемой базы, поэтому база должна быть в
состоянии «все миграции применены». Пустой diff (`No changes in database schema
were found`) — признак, что сущности и миграции сошлись.

Единый источник настроек CLI — `back/src/database/data-source.ts`; сущности там
перечислены явно, глоб не используется намеренно (он по-разному раскрывается из
`src` под ts-node и из `dist` под node, а промах молча даёт пустую схему).

## Проверочный роут

В dev-стеке — напрямую через опубликованный порт гейтвея:

```bash
curl http://localhost:8080/api/health
```

```json
{ "status": "ok", "service": "back", "uptime": 42, "timestamp": "..." }
```

В production портов наружу нет, поэтому либо снаружи через edge
(`curl https://flatnik.ru/api/health`), либо изнутри стека:

```bash
docker compose -f docker-compose.prod.yml exec gateway wget -qO- http://127.0.0.1/api/health
```

Healthcheck'и есть у `postgres`, `back` и `gateway`; порядок старта задан через
`depends_on`: `back` ждёт готовности базы, а `gateway` — и healthy-состояния
`back`, и успешного завершения `front`, то есть появления бандла в volume.

## Домен, HTTPS и edge-прокси

Публичный адрес — https://flatnik.ru. Сертификатов и порта 443 в этом
репозитории нет: их держит **edge-gateway** — отдельный nginx в `/srv/edge` на
сервере. Он один публикует 80 и 443, терминирует TLS для всех доменов хоста и
разводит запросы по SNI:

```
:443 ──► edge-nginx ──┬── flatnik.ru      ──► flatnik-gateway:80  (этот стек)
                      ├── www.flatnik.ru  ──► 301 на flatnik.ru
                      ├── домены babylon  ──► remnawave-nginx:80  (VPN-панель)
                      └── чужой SNI       ──► отбой на рукопожатии
:80  ──► 301 на https
```

Так вышло потому, что на том же сервере живёт babylon (Remnawave VPN) и 443 был
занят им. Общий edge снимает конфликт и заодно даёт единое место для всех
сертификатов.

DNS на reg.ru — две A-записи (`@` и `www`) на IP сервера. AAAA заводить только
если у сервера есть глобальный IPv6: пустая AAAA хуже отсутствующей, IPv6-клиент
пойдёт по ней первой и получит таймаут.

Сертификат выпускается по **DNS-01 через API reg.ru** на `flatnik.ru` и
`*.flatnik.ru`, продлевается скриптом `/srv/edge/renew.sh` по cron. Подробности —
в `README.md` рядом с самим edge.

## Деплой

Пуш в `main` запускает `.github/workflows/deploy.yml`: по SSH на сервере выполняется `git reset --hard origin/main` и пересборка compose. В конце workflow проверяет `/api/health` дважды — изнутри стека и снаружи через https://flatnik.ru, то есть заодно и весь путь через edge.

Требуемые секреты репозитория (`Settings → Secrets and variables → Actions`):

| Секрет | Значение |
|---|---|
| `SSH_HOST` | IP сервера |
| `SSH_USER` | пользователь SSH |
| `SSH_PRIVATE_KEY` | приватный ключ деплоя целиком |

Окружение `production` даёт изоляцию секретов и возможность включить ручное подтверждение выкатки.

### Подготовка сервера

Первый обязательный ручной шаг — создать `/srv/flatnik/.env` по образцу
`.env.example` с боевыми значениями: `JWT_SECRET`, `POSTGRES_PASSWORD`, ключи
Яндекса. Файл не под git, поэтому `git reset --hard` при деплое его не трогает;
без него стек поднимется на dev-дефолтах — с дефолтным секретом и без капчи.
Если `.env` появился после выката, нужен повторный деплой (`workflow_dispatch`
или `docker compose -f docker-compose.prod.yml up -d --build` на сервере):
`VITE_*`-ключи инлайнятся в бандл при сборке образа front.

Второй — поднять edge-прокси в `/srv/edge` (он же выпускает сертификат) и
убедиться, что существует сеть `app-network`: `docker network create app-network`.
Деплой создаёт её сам, если нет, но без работающего edge сайт снаружи не
откроется — стек портов наружу не публикует.

В остальном действий не требуется: workflow сам создаёт каталог `/srv/flatnik`, клонирует репозиторий и генерирует SSH-ключ, если его нет. Образы собираются на сервере, перед сборкой чистятся кеш builder'а и висячие образы — на VPS с ~2 ГБ RAM место иначе кончается.

Единственный ручной шаг возникает при пересоздании сервера: шаг `Ensure deploy key on server` напечатает в лог новый публичный ключ, его надо добавить в `Settings → Deploy keys` с доступом только на чтение — репозиторий приватный.

### Реестр npm

В корне лежит `.npmrc` с `registry=https://registry.npmjs.org/`. Без него `package-lock.json`, сгенерированный за корпоративным VPN, содержит ссылки на внутренний Artifactory, и `npm ci` вне VPN зависает, а затем падает с `Exit handler never called!` — и на сервере, и на раннерах GitHub. Если lockfile обновляется из-под VPN, стоит проверить, что в нём нет внутренних хостов:

```bash
grep -c 'registry.npmjs.org' package-lock.json
```

## Что дальше

- Настоящая отправка SMS вместо кода в логах; коды — во внешнее хранилище
- Механизм подтверждения отзывов (сейчас статус меняется руками в БД)
- Rate limiting на `request-code`
- Включить ограничение по доменам у ключей Яндекса — постоянный домен для этого уже есть
