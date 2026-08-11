# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## О проекте

flatnik — сервис сбора отзывов на долгосрочную аренду квартир в Москве и Санкт-Петербурге.
Пользователи оставляют отзывы об арендованных квартирах, домах, наймодателях и агентствах,
остальные ищут по ним перед сделкой.

Кодовая база на данный момент — рабочий скелет: развёрнутый пайплайн (монорепо, Docker,
автодеплой) и один сквозной роут `/api/health`, проверяющий, что контракт `shared` →
`back` → `front` собирается и работает end-to-end. Предметная модель (отзывы, объекты,
поиск, авторизация) ещё не реализована.

Комментарии в коде, README и сообщения коммитов — на русском; придерживайся этого.

## Структура

npm workspaces, три пакета:

| Пакет | Имя | Что это |
|---|---|---|
| `back/` | `@flatnik/back` | NestJS 10 API, TypeScript, CommonJS |
| `front/` | `@flatnik/front` | React 18 + Vite 5, Zustand, TanStack Query, ESM |
| `shared/` | `@flatnik/shared` | общие типы и DTO, потребляются обоими |

### Конвенции пакетов

У `back` и `front` есть собственные своды правил, дополняющие этот файл:

- **`back/agents.md`** — NestJS: структура модулей, требования к DTO, пайплайн генерации
  OpenAPI, правила обратной совместимости контракта.
- **`front/agents.md`** — React: структура по фичам, TanStack Query как единственный слой
  загрузки данных, конвенции Zustand и граница между ними.

**Прочитай соответствующий файл прежде, чем править код в этой папке.** Автозагрузки у них
нет — только явное чтение. Правила в них конкретнее, чем в этом файле, и при расхождении
приоритет у них.

Те же своды используются сабагентами `backend` и `frontend` (`.claude/agents/`): их
определения намеренно тонкие и первым делом читают эти файлы, поэтому правила правим в
`*/agents.md`, а не в определениях агентов. Там же лежит агент `committer` — он стоит за
скиллом `/commit` и выполняет коммит и пуш на дешёвой модели, чтобы диффы не попадали в
контекст основной.

`shared` — не путь-алиас, а настоящая зависимость, подключённая через `"@flatnik/shared": "*"`.
Она резолвится в `shared/dist` (`main`/`types` в её `package.json`), а **не** в `shared/src`.
Практические следствия:

- **`shared` надо собрать до сборки или тайпчека `back` и `front`.** На чистом клоне
  `npm run build --workspace=@flatnik/back` упадёт на неразрешённом импорте, пока
  `shared/dist` не существует.
- Правка типа в `shared/src` не видна в `back`/`front`, пока `shared` не пересобран.
  При работе над контрактом держи `npm run dev --workspace=@flatnik/shared` (tsc --watch)
  запущенным — корневой `npm run dev` его **не** поднимает, только back и front.
- Ломающее изменение контракта API проявляется как ошибка компиляции, а не как баг
  в рантайме. Это осознанный выбор архитектуры — не обходи его дублированием типов
  на стороне клиента.

## Команды

```bash
npm install                                   # ставит зависимости всех workspaces
npm run up:dev                                # запуск разработки — только в Docker
npm run build                                 # shared → back → front, порядок обязателен
```

**Корневого `npm run dev` больше нет: разработка идёт в dev-стеке Docker.** Причина —
единый origin через гейтвей; вне Docker фронт остался бы без маршрута `/api`,
потому что прокси из `vite.config.ts` убран. `npm install` в корне нужен ради типов
в IDE, зависимости контейнеров живут в отдельном volume.

Отдельные пакеты (сборка и тайпчек — их запускают на хосте, watch крутится в Docker):

```bash
npm run build --workspace=@flatnik/shared     # tsc -p, обязателен перед back/front
npm run build --workspace=@flatnik/back       # nest build → back/dist
npm run build --workspace=@flatnik/front      # tsc -b (тайпчек) && vite build → front/dist
```

Тайпчек фронта без сборки бандла: `npm run build --workspace=@flatnik/front` (у `front`
в tsconfig `noEmit`, так что `tsc -b` — это именно проверка типов).

### Тестов и линтеров нет

В репозитории нет ни Jest/Vitest, ни ESLint, ни Prettier — ни конфигов, ни скриптов, ни
зависимостей. Не предлагай `npm test` или `npm run lint`: они не существуют и завершатся
ошибкой. Единственная автоматическая проверка на сегодня — компиляция TypeScript в
`strict` (включён во всех трёх пакетах) плюс healthcheck'и контейнеров.

Если задача требует тестов, инфраструктуру придётся заводить с нуля — это отдельное
решение, согласуй его, а не вводи молча.

## Docker

Два независимых стека, и соответствие между ними строгое: **режим → compose-файл →
Dockerfile**. Файл по умолчанию (`docker-compose.yml`) — это **dev-стек**: голый
`docker compose ...` в корне работает с разработкой. Production подключается только
явным `-f docker-compose.prod.yml` — этот флаг обязан стоять во всех prod-командах
(`package.json` и `deploy.yml`), иначе на сервере поднялся бы dev-стек.
`docker-compose.override.yml` в проекте намеренно нет — он подхватывался бы
автоматически и незаметно смешал бы конфиги.

| Файл | Dockerfile'ы | Команды |
|---|---|---|
| `docker-compose.yml` | `back/Dockerfile.dev`, `front/Dockerfile.dev` | `up:dev`, `logs:dev`, `down:dev`, `tunnel:dev` |
| `docker-compose.prod.yml` | `back/Dockerfile`, `front/Dockerfile` | `up`, `logs`, `down`, `tunnel` |

```bash
npm run up:dev   # разработка: watch + HMR
npm run up       # production-сборка (её же выкатывает deploy.yml)
```

В обоих режимах приложение открывается на http://localhost:8080, health —
`curl http://localhost:8080/api/health`.

Общее для обоих стеков: **единственная точка входа — сервис `gateway`** (nginx,
`${GATEWAY_PORT}` → 80). Ни `back`, ни `front` секции `ports` не имеют и снаружи
недостижимы. Не добавляй им проброс порта «для удобства отладки» — это меняет
модель доступа; отлаживать нужно через гейтвей, он же обеспечивает единый origin.

Конфиг гейтвея не лежит в образе, а монтируется шаблоном из `nginx/`
(`dev.conf.template` и `prod.conf.template`); порты в него подставляет envsubst
nginx-образа из `environment`, поэтому переменные вроде `BACK_PORT` обязаны там быть.

Dev-стек (`name: flatnik-dev`, контейнеры и том с данными не пересекаются с prod):

| Сервис | Роль |
|---|---|
| `gateway` | nginx: `/api/` → back, всё остальное → vite вместе с HMR-сокетом |
| `front` | `vite` на `${FRONT_PORT}`, исходники bind-mount'ом |
| `back` | `nest start --watch` на `${BACK_PORT}` |
| `shared` | `tsc --watch` по контракту — без него back и front видят старый `shared/dist` |
| `postgres` | БД, `127.0.0.1:${POSTGRES_PORT}` |
| `cloudflared` | quick-туннель к `gateway` |

Prod-стек: те же `postgres`/`back`/`gateway`/`cloudflared`, но `front` —
**одноразовый контейнер**: выкладывает собранный бандл в volume `front-dist` и
завершается, а раздаёт его `gateway` (`condition: service_completed_successfully`).

Три вещи в dev-стеке, которые ломаются, если их «упростить»:

- **`node_modules` — named volume поверх bind-mount'а, а не с хоста.** В lockfile
  есть платформенные `@esbuild/*` и `@rollup/*`; macOS-бинарники в linux-контейнере
  не запускаются. Сам по себе том никогда не обновляется (копирование из образа —
  только в пустой том), поэтому после правки `package.json` тома пересоздают:
  `npm run rebuild:dev` — он удаляет только тома зависимостей, не трогая dev-базу.
- **Watch держится на polling.** Инотифай-события не проходят через bind-mount с
  macOS, поэтому `TSC_WATCHFILE`/`TSC_WATCHDIRECTORY` в compose и `usePolling` в
  `vite.config.ts`. Своих флагов для этого у Nest CLI нет.
- **`server.hmr` в `vite.config.ts` не задан намеренно.** Клиент vite берёт хост и
  порт сокета из адреса страницы, то есть из гейтвея, и через HTTPS-туннель сам
  уходит на `wss`. Любое переопределение этот адрес сломает. По той же причине там
  `allowedHosts: true`: домен quick-туннеля меняется при каждом рестарте, а vite
  отвечает 403 на незнакомый `Host`.

Адрес туннеля меняется при каждом перезапуске контейнера — ограничение бесплатных
quick-туннелей, не баг.

Healthcheck'и обращаются на `127.0.0.1`, а не `localhost`: в alpine `localhost`
резолвится и в `::1`, а Nest слушает только IPv4 (`app.listen(port, '0.0.0.0')`), и
busybox wget получал бы Connection refused. Не «упрощай» это до `localhost`.

`deploy.yml` завязан на имена: контейнер `flatnik-back-1` в `docker inspect`,
сервисы `back` и `cloudflared` в командах логов, порт `8080` в health-проверке.
Поэтому в `docker-compose.prod.yml` не появляется ключ `name:` (префикс контейнеров
должен остаться `flatnik-`), а у `GATEWAY_PORT` дефолт — `8080`.

## Маршрутизация /api

Префикс `api` задаётся один раз в `back/src/main.ts` через `app.setGlobalPrefix('api')`.
Контроллеры объявляют путь без него: `@Controller('health')` даёт `/api/health`.

Маршрутизацию `/api` задают два места, и при изменении схемы роутов синхронизировать
нужно оба:

1. `nginx/dev.conf.template` и `nginx/prod.conf.template` — `location /api/` →
   `proxy_pass http://back:${BACK_PORT}`. Этот блок объявлен **до** `location /`,
   иначе SPA-фоллбэк перехватил бы запросы к API;
2. `back/src/app.config.ts` — `API_PREFIX`, применяемый через `setGlobalPrefix`.

Фронт всегда ходит на относительный `/api/...`: гейтвей держит статику и API на
одном origin, поэтому CORS не участвует нигде. В `main.ts` `enableCors` намеренно
**нет** — появится сторонний клиент, он вернётся со списком доменов, а не с
`origin: true`. Прокси в `vite.config.ts` тоже убран: в dev-стеке `/api` до vite не
доходит, его забирает гейтвей.

## Состояние на фронте

Заявленное разделение ответственности: **TanStack Query — серверное состояние**
(запросы к API, кеш, инвалидация), **Zustand — клиентское UI-состояние** (фильтры,
черновики форм, модалки). `QueryClientProvider` уже поднят в `front/src/main.tsx`.

Zustand на текущий момент объявлен в зависимостях, но ни один store ещё не создан —
первый стор задаст конвенцию для остальных. Не заводи в Zustand то, что уже кешируется
Query: дублирование серверных данных в сторе — типовой источник расхождений.

## Деплой

Пуш в `main` (или `workflow_dispatch`) запускает `.github/workflows/deploy.yml`.
Ветка `main` — деплойная: любой коммит в неё уезжает в production, поэтому `git push`
делает пользователь сам, осознанно.


## Планы (из README)

Postgres + TypeORM, JWT-авторизация, постоянный домен вместо quick-туннеля. Ничего из
этого пока не начато — под это лишь заложена структура.
