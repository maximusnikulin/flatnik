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
npm run dev                                   # back :3000 + front :5173 (см. оговорку ниже)
npm run build                                 # shared → back → front, порядок обязателен
```

Отдельные пакеты:

```bash
npm run build --workspace=@flatnik/shared     # tsc -p, обязателен перед back/front
npm run dev   --workspace=@flatnik/shared     # tsc --watch, если правишь контракт
npm run dev   --workspace=@flatnik/back       # nest start --watch
npm run build --workspace=@flatnik/back       # nest build → back/dist
npm run dev   --workspace=@flatnik/front      # vite dev server
npm run build --workspace=@flatnik/front      # tsc -b (тайпчек) && vite build → front/dist
```

Корневой `npm run dev` запускает два процесса через `&` в одном шелле: Ctrl-C гасит не
всегда оба, освободившийся порт стоит проверить перед перезапуском. Для отладки одной
половины удобнее два терминала с `--workspace`.

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

```bash
npm run up       # docker compose up -d --build
npm run logs     # docker compose logs -f
npm run tunnel   # выдрать публичный HTTPS-URL из логов cloudflared
npm run down     # docker compose down
```

Локально SPA открывается на http://localhost:8080, health — `curl http://localhost:8080/api/health`.

Три сервиса:

| Сервис | Порт | Роль |
|---|---|---|
| `front` | `8080` → 80 | nginx: статика SPA + reverse-proxy `/api/` на `back:3000` |
| `back` | внутренний 3000 | NestJS, наружу **не** публикуется |
| `cloudflared` | — | quick-туннель к `front`, публичный HTTPS без DNS и открытых портов |

У `back` намеренно нет секции `ports`: снаружи он недостижим, весь трафик идёт через
nginx. Не добавляй ему проброс порта «для удобства отладки» — это меняет модель доступа.
`front` стартует только после `back` (`condition: service_healthy`).

Адрес туннеля меняется при каждом перезапуске контейнера — ограничение бесплатных
quick-туннелей, не баг.

Healthcheck'и обращаются на `127.0.0.1`, а не `localhost`: в alpine `localhost`
резолвится и в `::1`, а Nest слушает только IPv4 (`app.listen(port, '0.0.0.0')`), и
busybox wget получал бы Connection refused. Не «упрощай» это до `localhost`.

## Маршрутизация /api

Префикс `api` задаётся один раз в `back/src/main.ts` через `app.setGlobalPrefix('api')`.
Контроллеры объявляют путь без него: `@Controller('health')` даёт `/api/health`.

Прокси на `/api` настроен в трёх независимых местах, и при изменении схемы роутов
синхронизировать нужно все:

1. `front/vite.config.ts` — dev-прокси на `http://localhost:3000` (переопределяется
   переменной `VITE_API_TARGET`);
2. `front/nginx.conf` — `location /api/` → `proxy_pass http://back:3000` в Docker;
3. `back/src/main.ts` — глобальный префикс.

Благодаря прокси фронт всегда ходит на относительный `/api/...` — и в dev, и в prod
это same-origin, поэтому CORS не участвует. `enableCors({ origin: true })` в `main.ts`
оставлен на будущее (сторонние клиенты), а не потому что он нужен фронту.

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
