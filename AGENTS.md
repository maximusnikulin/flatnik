# AGENTS.md — монорепозиторий flatnik

flatnik — сервис отзывов на долгосрочную аренду квартир в РФ
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
npm install                    # зависимости всех workspaces; нужен для типов в IDE
docker compose up -d --build   # разработка — только в Docker (единый origin через гейтвей)
npm run build                  # shared → back → front, порядок обязателен
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
явным `-f docker-compose.prod.yml`; флаг обязан стоять в каждой prod-команде
(в том числе в `deploy.yml`), иначе на сервере поднялся бы dev-стек.
`docker-compose.override.yml` намеренно отсутствует.

| Файл | Dockerfile'ы | Как вызывать |
|---|---|---|
| `docker-compose.yml` (dev) | `*/Dockerfile.dev` | `docker compose ...` без флагов; плюс `npm run rebuild:dev` |
| `docker-compose.prod.yml` | `*/Dockerfile` | `docker compose -f docker-compose.prod.yml ...` |

Приложение в dev — http://localhost:8080, health — `curl http://localhost:8080/api/health`.

Единственная точка входа — `gateway` (nginx; шаблоны в `nginx/*.conf.template`,
порты подставляет envsubst из `environment`). У `back` и `front` нет `ports` —
не добавляй проброс «для отладки», это ломает модель единого origin.

**Prod-стек не публикует на хост ничего**, включая `gateway`. Снаружи 80 и 443
держит edge-прокси (`/srv/edge` на сервере, вне этого репозитория): он терминирует
TLS и по SNI разводит запросы между flatnik и VPN-панелью babylon, которые делят
один сервер. Связь — внешняя сеть `app-network`, в неё входит только `gateway`
под алиасом `flatnik-gateway`. Отсюда три правила:

- не добавляй `ports` в `docker-compose.prod.yml` — 443 занят, а 8080 наружу
  открывает стек в обход edge;
- не тащи `back`/`db` в `app-network`: там соседи, включая чужой Postgres;
- TLS в `nginx/prod.conf.template` не нужен, он приходит уже расшифрованным.
  Настоящий IP клиента берётся из `X-Forwarded-For` через `set_real_ip_from`.

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
и завершается; раздаёт его `gateway`. `deploy.yml` завязан на имя контейнера
`flatnik-back-1` — поэтому в prod-файле намеренно нет ключа `name:`, иначе
префикс проекта сменится и `docker inspect` в диагностике падения перестанет
находить контейнер.

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
