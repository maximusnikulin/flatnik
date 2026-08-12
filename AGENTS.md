# AGENTS.md — монорепозиторий flatnik

flatnik — сервис отзывов на долгосрочную аренду квартир в Москве и Санкт-Петербурге.
Комментарии в коде, README, коммиты и ответы — на русском.

## Структура

npm workspaces:

| Пакет | Имя | Что это |
|---|---|---|
| `back/` | `@flatnik/back` | NestJS 10 API, CommonJS |
| `front/` | `@flatnik/front` | React 18 + Vite 5, Zustand, TanStack Query, ESM |
| `shared/` | `@flatnik/shared` | общие типы и DTO |

У `back` и `front` свои своды правил — **`back/agents.md`** и **`front/agents.md`**.
Прочитай соответствующий файл перед правкой кода в этих папках; при расхождении
приоритет у них. Их же читают сабагенты `backend`/`frontend` (`.claude/agents/`),
поэтому правила правим в `*/agents.md`, а не в определениях агентов.

`shared` — настоящая зависимость, резолвится в `shared/dist`, а **не** в `src`:

- `shared` собирается до сборки или тайпчека `back` и `front`;
- правка типа видна только после пересборки `shared` (в dev-стеке это делает
  сервис `shared` с `tsc --watch`);
- ломающее изменение контракта проявляется как ошибка компиляции — это осознанная
  архитектура, не обходи её дублированием типов на клиенте.

## Команды

```bash
npm install      # зависимости всех workspaces; нужен для типов в IDE
npm run up:dev   # разработка — только в Docker (единый origin через гейтвей)
npm run build    # shared → back → front, порядок обязателен
```

Проверка типов — в каждом пакете своя, запускается из корня:

```bash
npm run lint --workspace=@flatnik/back    # shared → tsc --noEmit по back
npm run lint --workspace=@flatnik/front   # shared → tsc --noEmit по front
```

Правил `.ts`/`.tsx` в пакете — прогони его `lint`; правил оба — оба. Общего скрипта
по монорепозиторию нет намеренно: проверять чужой пакет на каждую правку дорого.
Подробности и обязательность — в `back/agents.md` и `front/agents.md`.

**Тестов и настоящих линтеров нет** — ни Jest/Vitest, ни ESLint/Prettier; не предлагай
`npm test`. `lint` здесь — это `tsc --noEmit`, а не ESLint: компиляция в `strict` и
healthcheck'и контейнеров — единственные проверки. Нужны тесты или ESLint — это
отдельное решение, согласуй.

## Docker

Два стека; файл по умолчанию (`docker-compose.yml`) — **dev**. Production — только
явным `-f docker-compose.prod.yml`; флаг обязан стоять во всех prod-командах
(`package.json`, `deploy.yml`), иначе на сервере поднялся бы dev-стек.
`docker-compose.override.yml` намеренно отсутствует.

| Файл | Dockerfile'ы | Команды |
|---|---|---|
| `docker-compose.yml` (dev) | `*/Dockerfile.dev` | `up:dev`, `logs:dev`, `down:dev`, `rebuild:dev`, `tunnel:dev` |
| `docker-compose.prod.yml` | `*/Dockerfile` | `up`, `logs`, `down`, `tunnel` |

Приложение — http://localhost:8080, health — `curl http://localhost:8080/api/health`.

Единственная точка входа — `gateway` (nginx; шаблоны в `nginx/*.conf.template`,
порты подставляет envsubst из `environment`). У `back` и `front` нет `ports` —
не добавляй проброс «для отладки», это ломает модель единого origin.

Что нельзя «упрощать» в dev-стеке:

- **`node_modules` — named volume, не с хоста**: в lockfile платформенные бинарники
  esbuild/rollup. Том сам не обновляется — после правки `package.json` запускай
  `npm run rebuild:dev` (dev-базу не трогает).
- **Watch на polling** (`TSC_WATCHFILE` в compose, `usePolling` в vite): inotify
  не проходит через bind-mount с macOS.
- **`server.hmr` в `vite.config.ts` не задан, `allowedHosts: true`**: клиент vite
  берёт адрес сокета из origin страницы (гейтвей/туннель), переопределение это ломает.
- **Healthcheck'и на `127.0.0.1`, не `localhost`**: alpine резолвит localhost и в ::1,
  а Nest слушает только IPv4.

Prod-стек: `front` — одноразовый контейнер, выкладывает бандл в volume `front-dist`
и завершается; раздаёт его `gateway`. `deploy.yml` завязан на имена (`flatnik-back-1`,
сервисы `back`/`cloudflared`, порт 8080) — поэтому в prod-файле нет ключа `name:`,
а дефолт `GATEWAY_PORT` — 8080. Адрес quick-туннеля меняется при каждом рестарте — не баг.

## Маршрутизация /api

Префикс `api` задан один раз: `setGlobalPrefix` в `back/src/app.config.ts`
(`API_PREFIX`); контроллеры объявляют путь без него. Второе место — шаблоны
`nginx/*.conf.template`: `location /api/` → back, объявлен **до** `location /`.
Меняешь схему роутов — синхронизируй оба.

Фронт ходит только на относительный `/api/...`; всё на одном origin, поэтому CORS
нигде не участвует — `enableCors` в `main.ts` нет намеренно. Прокси в
`vite.config.ts` тоже нет: `/api` забирает гейтвей.

## Состояние на фронте

TanStack Query — серверное состояние, Zustand — клиентское UI-состояние.
Серверные данные в сторах не дублируются. Подробности — `front/agents.md`.

## Деплой

Пуш в `main` запускает `.github/workflows/deploy.yml` и уезжает в production,
поэтому `git push` делает пользователь сам, осознанно.
