summary: |
  Build the Watchlist panel end to end: a Records API `GET /watchlist` and `POST /watchlist` (validate, reject duplicates, persist in PostgreSQL through a repository) and a React Watchlist panel in the web app with the loading (skeleton), error (alert + "Try again" that reloads only the watchlist), empty (empty state + primary "Add ticker") and populated (read-only table, no row click behaviour) states, plus an "Add ticker" form in a modal with inline field errors. The web app does not load the design tokens or the design-system stylesheet yet, so the plan also imports them once. Work is test-first at both layers (vitest for the API and for React components with a mocked `fetch`; Playwright API test for the endpoint).
scope:
  - description: |
      Records API: watchlist domain rules. Add `normalizeSymbol(raw: string): string` (trim + uppercase) and `validateSymbol(symbol: string): boolean` (regex `^[A-Z]{1,5}([.-][A-Z]{1,2})?$`) plus a `WatchlistRepository` interface:
      ```ts
      export interface WatchlistRepository {
        list(): Promise<WatchlistTicker[]>;                 // oldest first
        add(symbol: string): Promise<'added' | 'duplicate'>; // atomic; unique on symbol
      }
      export interface WatchlistTicker { symbol: string; createdAt: string }
      ```
      Include an in-memory implementation (used by unit tests and by the dev server when `DATABASE_URL` is unset).
    files:
      - services/records-api/src/watchlist/symbol.ts
      - services/records-api/src/watchlist/repository.ts
      - services/records-api/src/watchlist/memory-repository.ts
    rationale: |
      AC 1, 6, 7, 8 hinge on one shared rule: duplicate and invalid symbols are both rejected and must leave the list unchanged. Keeping the rule in the API (ADR-0001/0002) means the browser never decides what is valid.
  - description: |
      Records API: routes. `GET /watchlist` returns 200 `{ tickers: [{ symbol, createdAt }] }`. `POST /watchlist` with body `{ symbol }` returns 201 `{ symbol, createdAt }`; 400 `{ error: { code: 'invalid_symbol', message } }` for a bad/missing symbol; 409 `{ error: { code: 'duplicate_symbol', message } }` when already present. Messages say what happened and how to fix it ("Enter a ticker symbol of 1 to 5 letters, for example AAPL."; "AAPL is already on your watchlist."). `buildApp` takes an optional dependency:
      ```ts
      // before: export function buildApp(): FastifyInstance
      export function buildApp(deps: { watchlist?: WatchlistRepository } = {}): FastifyInstance
      ```
      Register `watchlistRoutes` next to `healthRoutes`, defaulting to the in-memory repository. `server.ts` builds the Postgres repository when `DATABASE_URL` is set, otherwise logs a warning and uses the in-memory one. A rejected add never calls a write path that changes state.
    files:
      - services/records-api/src/routes/watchlist.ts
      - services/records-api/src/app.ts
      - services/records-api/src/server.ts
    rationale: |
      Mirrors the existing `routes/health.ts` plugin shape and `buildApp()` injection style so route tests can use `app.inject` like `test/unit/health.test.ts`.
  - description: |
      Records API: PostgreSQL persistence (ADR-0003: only the Records API touches the database). Add migration `migrations/001_watchlist.sql` creating `watchlist_tickers (symbol text primary key, created_at timestamptz not null default now())` and `audit_records (id bigserial primary key, action text not null, subject text not null, actor text not null, at timestamptz not null default now())`. `PgWatchlistRepository.add` runs `INSERT ... ON CONFLICT (symbol) DO NOTHING` and the audit insert in one transaction (ADR-0011), returning `'duplicate'` when no row was inserted. A small `src/db/migrate.ts` applies the SQL files in order and is exposed as the `migrate` script.
    files:
      - services/records-api/migrations/001_watchlist.sql
      - services/records-api/src/db/pool.ts
      - services/records-api/src/db/migrate.ts
      - services/records-api/src/watchlist/pg-repository.ts
      - services/records-api/package.json
    rationale: |
      The watchlist must survive restarts (AC 1/4 say the symbol "appears as a row"; a reload should still show it). The `primary key` makes duplicate rejection race-safe rather than check-then-insert.
  - description: |
      Web app: load the design system once. In `apps/web/src/index.css` add, after `@import "tailwindcss";`, `@import "../design/tokens.css";` and `@import "../design/prototype-utils.css";` (the stylesheet that defines `.btn`, `.btn-primary`, `.btn-secondary`, `.card`, `.table`, `.table-wrap`, `.field`, `.field-label`, `.field-hint`, `.field-error`, `.input`, `.is-invalid`, `.modal`, `.modal-header`, `.modal-body`, `.modal-footer`, `.backdrop`, `.alert`, `.empty-state`, `.skeleton`, `.spinner`, `.stack`, `.cluster`, built only from tokens). Then add the few prototype-local rules the design's own inline style defines and the stylesheet does not: `.panel-head` (flex, wrap, `gap: var(--space-2)`, space-between), `.num` (right aligned, no-wrap), `.skel-stack` (`gap: var(--space-2)`); and `.btn { min-height: var(--tap-target) }` as in the prototype. No colour or pixel literals.
    files:
      - apps/web/src/index.css
    rationale: |
      I read `apps/web/src/index.css` (only `@import "tailwindcss";`), `main.tsx` (imports `./index.css`) and `vite.config.ts` (tailwind vite plugin, no token mapping): the app loads no tokens today. `apps/web/design/tokens.css` and `prototype-utils.css` exist and are what the prototype inlines. Tailwind's preflight loads first, so the design-system rules win where they overlap.
  - description: |
      Web app: data layer. `src/watchlist/api.ts` with `fetchWatchlist(): Promise<WatchlistTicker[]>` (GET) and `addTicker(symbol: string): Promise<{ ok: true } | { ok: false; code: 'invalid_symbol' | 'duplicate_symbol'; message: string }>` (POST; network/5xx throws). Base URL from `import.meta.env.VITE_RECORDS_API_URL ?? ''`; `vite.config.ts` gets a dev `server.proxy` for `/watchlist` to the API so the browser calls the REST API directly with no gateway/BFF (ADR-0002). `useWatchlist()` hook owns `status: 'loading' | 'error' | 'ready'`, `tickers`, `reload()` and `add(symbol)`; `reload` and the initial load call ONLY `fetchWatchlist`, so nothing else on the dashboard is re-fetched.
    files:
      - apps/web/src/watchlist/api.ts
      - apps/web/src/watchlist/useWatchlist.ts
      - apps/web/vite.config.ts
    rationale: |
      AC 9-12. Panel-local state is what makes "only the watchlist data is reloaded" true by construction.
  - description: |
      Web app: UI, built from the approved prototype's Watchlist card (`data-wf-id="watchlist"`) and its empty/loading/error states. `WatchlistPanel` renders a `.card` with a `.panel-head` holding `<h2>Watchlist</h2>` and a `.btn .btn-secondary` "Add ticker" (as in the prototype's default state).
      - ready with rows: `.table-wrap > .table`, one `<tr>` per ticker, a `Symbol` column. Rows are plain `<tr>`: no onClick, no link, no `cursor: pointer` (AC 5).
      - ready with none: `.empty-state.card` with `h2` "No tickers on your watchlist", text "Add a ticker to follow it here." and a `.btn .btn-primary` "Add ticker" (prototype copy, minus the price/change/volume wording since that data is not part of this item). The header "Add ticker" button is not rendered in this state, so there is exactly one primary action in the panel region (UI guideline).
      - loading: `role="status"` region with "Loading watchlist…" and `.skeleton` blocks (`--control-height-lg` high) inside the panel (AC 9).
      - error: `.alert.alert-danger` `role="alert"` inside the panel, heading "The watchlist could not be loaded.", text "Check your connection and try again.", `.btn .btn-secondary` "Try again" (AC 10-12). The prototype shows this for the whole dashboard; here it is scoped to the panel as AC 10/11 require.
      `AddTickerDialog` (a `.modal` with `.backdrop`, `role="dialog"`, `aria-modal`, labelled by its `.modal-header` "Add ticker") holds a `.field` with `.field-label` "Symbol", `.field-hint` "For example AAPL", an `.input`, and a `.field-error` linked by `aria-describedby` with `.is-invalid` on the input when the API rejects. Footer: `.btn-primary` "Add ticker" (submit) and `.btn-ghost` "Cancel". Focus moves into the dialog, Tab is trapped, Esc and Cancel close it, focus returns to the trigger. On success the dialog closes and the list is refreshed from the add result; on rejection it stays open with the API message inline and the rows are untouched. Submit shows `.spinner` in the button while pending. Tokens used: `--space-1..5`, `--radius-md/lg`, `--border-width(-strong)`, `--color-bg/-subtle/-border/-border-strong/-fg/-fg-muted/-danger/-danger-bg/-danger-hover/-primary`, `--control-height(-lg)`, `--tap-target`, `--modal-width`, `--z-backdrop/-overlay`, `--font-size-sm/-lg`.
      `App.tsx` renders `<h1>Stock market dashboard</h1>` in `.shell-main`-width container and the `WatchlistPanel` only. The other dashboard panels, sidebar, indices, chart and period select in the prototype are separate stories and are not built here.
    files:
      - apps/web/src/watchlist/WatchlistPanel.tsx
      - apps/web/src/watchlist/AddTickerDialog.tsx
      - apps/web/src/App.tsx
    rationale: |
      AC 1-12. The prototype's own Add ticker action is only a toast ("not part of this release"), so the add form itself is not designed; I used the guideline pattern for a short form (`.modal`, `.field`, `.field-error`, `.is-invalid`). Voice: sentence case, verb + object buttons, no exclamation marks.
tests:
  - |
    AC 6/7/8 (API, write first) `services/records-api/test/unit/watchlist.test.ts`:
    ```ts
    const app = buildApp({ watchlist: new MemoryWatchlistRepository() });
    await app.inject({ method: 'POST', url: '/watchlist', payload: { symbol: 'AAPL' } });
    const dup = await app.inject({ method: 'POST', url: '/watchlist', payload: { symbol: ' aapl ' } });
    expect(dup.statusCode).toBe(409);
    expect(dup.json().error.code).toBe('duplicate_symbol');
    const bad = await app.inject({ method: 'POST', url: '/watchlist', payload: { symbol: 'not a ticker!' } });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error.code).toBe('invalid_symbol');
    const list = await app.inject({ method: 'GET', url: '/watchlist' });
    expect(list.json().tickers.map((t: { symbol: string }) => t.symbol)).toEqual(['AAPL']);
    ```
    Also an empty or missing body returns 400 and leaves the list unchanged.
  - |
    AC 1/2/4 (API) same file: POST `{ symbol: 'msft' }` returns 201 with `symbol: 'MSFT'`; GET then lists AAPL and MSFT in insertion order (`expect(...).toEqual(['AAPL', 'MSFT'])`); GET on a fresh app returns `{ tickers: [] }`. `test/unit/symbol.test.ts` covers `validateSymbol('BRK.B') === true`, `validateSymbol('') === false`, `validateSymbol('TOOLONGX') === false`.
  - |
    AC 1-8 (API e2e, Playwright API test) `services/records-api/test/e2e/watchlist.spec.ts` against the built server (in-memory repository since `DATABASE_URL` is unset): `request.post('/watchlist', { data: { symbol: 'AAPL' } })` gives 201, a repeat gives 409, `'12$'` gives 400, and `GET /watchlist` shows exactly one AAPL row.
  - |
    Persistence (API unit) `test/unit/pg-repository.test.ts` with a stubbed `pg` pool: `add` returns `'duplicate'` when the insert returns `rowCount: 0`, and issues the audit insert in the same transaction as a successful add (`BEGIN`, two `INSERT`s, `COMMIT`). No real database is needed for the configured test command.
  - |
    AC 2 `apps/web/src/watchlist/WatchlistPanel.test.tsx` (fetch mocked with `vi.stubGlobal('fetch', ...)`, returns three tickers): `expect(await screen.findAllByRole('row')).toHaveLength(4)` (header + 3) and each of AAPL, MSFT, NVDA is in the document.
  - |
    AC 3 same file, fetch returns `{ tickers: [] }`: `expect(await screen.findByText('No tickers on your watchlist')).toBeInTheDocument()` and `expect(screen.getByRole('button', { name: 'Add ticker' })).toBeInTheDocument()` (exactly one such button).
  - |
    AC 1 same file, list has AAPL; click "Add ticker", type `MSFT` in the "Symbol" input, click the dialog's "Add ticker" submit with the mocked POST returning 201: `expect(await screen.findByRole('cell', { name: 'MSFT' })).toBeInTheDocument()` and the dialog is gone.
  - |
    AC 4 same file, list empty; click the empty state's "Add ticker", enter `NVDA`, submit: `expect(await screen.findByRole('cell', { name: 'NVDA' })).toBeInTheDocument()` and the empty state heading is no longer present.
  - |
    AC 5 same file, list has AAPL: `await user.click(screen.getByRole('cell', { name: 'AAPL' }))` then `expect(screen.queryByRole('dialog')).not.toBeInTheDocument()` and `expect(screen.getAllByRole('row')).toHaveLength(2)`; no new fetch call after the click (`expect(fetchMock).toHaveBeenCalledTimes(1)`).
  - |
    AC 6 same file, mocked POST returns 409 `duplicate_symbol` with message "AAPL is already on your watchlist.": `expect(await screen.findByText('AAPL is already on your watchlist.')).toBeInTheDocument()`, the text is inside the dialog (`within(screen.getByRole('dialog'))`), and the input has `aria-invalid="true"`.
  - |
    AC 7 same file, mocked POST returns 400 `invalid_symbol`: the message appears inline in the dialog, input `aria-invalid="true"`.
  - |
    AC 8 same file, for BOTH the 409 and the 400 case (`it.each`): rows before and after are identical, `expect(screen.getAllByRole('row')).toHaveLength(2)` and no extra GET was made.
  - |
    AC 9 same file, fetch returns a never-resolving promise: `expect(screen.getByRole('status')).toHaveTextContent('Loading watchlist')` inside the watchlist card.
  - |
    AC 10 same file, fetch rejects: `expect(await screen.findByRole('alert')).toHaveTextContent('The watchlist could not be loaded.')` and `expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()`.
  - |
    AC 11 same file, first fetch rejects, click "Try again": `expect(fetchMock).toHaveBeenCalledTimes(2)` and every call URL is `/watchlist` (`expect(fetchMock.mock.calls.every(([url]) => String(url).endsWith('/watchlist'))).toBe(true)`), i.e. nothing else was requested.
  - |
    AC 12 same file, first fetch rejects, second resolves with AAPL: after "Try again", `expect(await screen.findByRole('cell', { name: 'AAPL' })).toBeInTheDocument()` and the alert is gone.
  - |
    Update `apps/web/src/App.test.tsx`: the existing `getByRole('heading', { name: 'Web App' })` assertion is replaced with `getByRole('heading', { name: 'Stock market dashboard' })` plus the `Watchlist` h2 (fetch mocked); this existing test would otherwise fail once `App.tsx` changes. Narrow command per task, e.g. `cd apps/web && pnpm vitest run src/watchlist/WatchlistPanel.test.tsx` and `cd services/records-api && pnpm vitest run test/unit/watchlist.test.ts`.
assumptions_or_open_questions:
  - |
    Prototype vs data: the prototype's watchlist table has Company, Last price, Change and Volume columns and the empty state mentions price, change and volume. No market-data source exists in this project (ADR-0009: no external integrations besides SES), and the item's ACs only require symbol rows. This plan shows a Symbol column only and drops the price wording; showing the other columns needs a market-data decision (new story or integration ADR). Please confirm.
  - |
    Deferred question "how often should market data refresh and how fresh must prices be?" does not apply here because no prices are shown in this item; the watchlist is loaded on mount and on "Try again" only, with no polling.
  - |
    Symbol validity: there is no symbol master list, so "valid" is defined as a format rule (1 to 5 letters, optional `.` or `-` plus 1 to 2 letters, case-insensitive, stored uppercase). It does not check that the company is listed. Confirm, or name the source of truth for valid symbols.
  - |
    Ownership: sign-in (ADR-0004, Entra ID) is not implemented in either component yet, so there is no user to scope a watchlist to. This plan keeps one watchlist for the whole deployment (no user column) and writes the audit actor as the fixed string `anonymous`. When sign-in lands, `watchlist_tickers` needs a user key and the audit actor needs the real identity. Please confirm that is acceptable for now.
  - |
    Prototype conflicts: (1) the prototype shows loading and error for the whole dashboard, the ACs scope them to the watchlist panel, so the plan follows the ACs and re-words the error heading to "The watchlist could not be loaded."; (2) the prototype's "Add ticker" only shows a toast, so the add form (modal) is not designed and follows the UI guidelines; (3) the prototype adds a sidebar the guidelines forbid and other panels (indices, holdings, chart, movers, SIP, trades): all out of scope here.
  - |
    Persistence needs a PostgreSQL connection and the `pg` package, which the API does not use yet. When `DATABASE_URL` is unset the dev server falls back to an in-memory repository and logs a warning, which keeps the existing `/health` Playwright e2e working. Confirm the fallback is wanted rather than a hard failure at start-up.
  - |
    The browser reaches the API via `VITE_RECORDS_API_URL` (empty means same origin, with a Vite dev proxy). If production serves web and API on different origins, CORS or a reverse-proxy route is a deployment decision not covered here.
estimated_points: 8
package_dependencies:
  - name: pg
    version: ^8.13.0
    ecosystem: npm
    component_id: comp_records_api
    rationale: PostgreSQL client for the watchlist repository (ADR-0003); the API has no database client yet.
  - name: "@types/pg"
    version: ^8.11.0
    ecosystem: npm
    component_id: comp_records_api
    rationale: Type definitions for pg under TypeScript strict mode.
  - name: "@testing-library/user-event"
    version: ^14.5.0
    ecosystem: npm
    component_id: comp_web_app
    rationale: Realistic typing and clicking in the Watchlist panel component tests; only the React Testing Library core is installed today.
notes: |
  ### Data & rollout

  - **Existing data**: new tables only (`watchlist_tickers`, `audit_records`); no existing table or row is altered, so nothing already stored is affected.
  - **Backfill / seed**: none. The watchlist starts empty and shows the empty state. `migrate.ts` applies each `migrations/*.sql` once, and `001_watchlist.sql` uses `create table if not exists`, so re-running is safe.
  - **Settings**: `DATABASE_URL` (Records API; unset means in-memory dev fallback with a logged warning; documented in the API README or `.env.example` if one exists, otherwise in a comment in `src/server.ts`). `VITE_RECORDS_API_URL` (web app; default empty string meaning same origin).
  - **Provisioning**: a PostgreSQL database reachable from the Records API (ADR-0003, Amazon RDS in deployed environments) and a role allowed to create and write the two tables.
  - **Order and rollback**: run `pnpm migrate` in `services/records-api` before deploying the API that reads the tables, then deploy the API, then the web app. Rollback: deploy the previous API/web; the two new tables are unused and can stay in place (or be dropped by hand).
  - Tests: the configured test command (`(cd services/records-api && pnpm test) && (cd apps/web && pnpm test)`) needs no database, because the Postgres repository is tested with a stubbed pool; a migration test for existing rows is not applicable since no existing rows are migrated.

  ### Design system loading
  Today the app does not load tokens: `apps/web/src/index.css` contains only `@import "tailwindcss";` and is imported by `apps/web/src/main.tsx:3`. The plan adds the two design imports there. Every UI step styles with the design-system classes and `var(--token)` names only. Tailwind utility classes are not used for colours or sizes.

  ### Shape of the change
  ```mermaid
  flowchart TD
    main[main.tsx] --> App[App.tsx]
    main --> css[index.css]
    App --> Panel[WatchlistPanel.tsx]
    Panel --> Dialog[AddTickerDialog.tsx]
    Panel --> Hook[useWatchlist.ts]
    Hook --> WebApi[watchlist/api.ts]
    WebApi -->|REST GET/POST /watchlist| Routes[routes/watchlist.ts]
    css --> Tokens[design/tokens.css + prototype-utils.css]
    server[server.ts] --> AppTs[app.ts buildApp]
    AppTs --> Health[routes/health.ts]
    AppTs --> Routes
    Routes --> Repo[WatchlistRepository]
    Repo --> Mem[memory-repository.ts]
    Repo --> Pg[pg-repository.ts]
    Pg --> DB[(PostgreSQL)]
    classDef touched fill:#f96,color:#000
    class App,css,Panel,Dialog,Hook,WebApi,Routes,Repo,Mem,Pg,server,AppTs touched
  ```
  `App.tsx`, `index.css`, `app.ts` and `server.ts` are modified; the other highlighted nodes are new. `main.tsx`, `health.ts` and the design files are unchanged context.
review_focus: |
  IN: Watchlist panel (loading, error with panel-only retry, empty, populated read-only rows) and the Add ticker modal with inline errors, backed by `GET/POST /watchlist` in the Records API with Postgres persistence and a repository abstraction. OUT: market data (company, price, change, volume), per-user watchlists and sign-in, removal of tickers, the rest of the dashboard and its sidebar. Riskiest areas: that a rejected add (duplicate or invalid) changes nothing on server and client, and that "Try again" fetches only `/watchlist`; also the `App.tsx` change breaks the existing `App.test.tsx`, which the plan updates. Deliberate choices: symbol validity is a format rule, the add form is a guideline-based modal because the prototype only toasts, and the in-memory fallback exists only when `DATABASE_URL` is unset.
