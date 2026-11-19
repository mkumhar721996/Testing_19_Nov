summary: |
  Build the admin-managed service type list end to end. In the Records API (Fastify + PostgreSQL) add a `service_types` table seeded with a starter list, admin-only add / rename / retire endpoints (soft retire via `retired_at`, so offerings keep their type and price), a provider-facing "offered types" list that excludes retired types, a "request a missing type" endpoint that stores a request for an admin, a read of the provider's own offerings, and audit records for every write (ADR-0011). In the Web App (React + Vite + Tailwind) add the two approved screens: the admin "Service types" screen (list, add, rename, retire-confirm modal, empty, loading, error) and the provider "Choose a service type" screen (offered list, request box, request-sent / add-blocked alerts, current-offerings table). The web app also loads the design tokens, which it does not do today. Tests come first at each layer (vitest unit on the API with in-memory repositories, vitest + Testing Library on the web, Playwright API tests against real PostgreSQL).

scope:
  - description: |
      API schema + seed. New migration creating `service_types`, `offerings`, `service_type_requests` and `audit_records`, plus an idempotent starter seed.

      ```sql
      create table service_types (
        id uuid primary key default gen_random_uuid(),
        name text not null check (length(btrim(name)) between 1 and 80),
        retired_at timestamptz,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
      create unique index service_types_name_uq on service_types (lower(btrim(name)));
      create table offerings (          -- minimal read model for AC8; creating offerings belongs to the pricing story
        id uuid primary key default gen_random_uuid(),
        provider_id text not null,
        service_type_id uuid not null references service_types(id),   -- never deleted, only retired
        price_amount numeric(12,2) not null,
        price_unit text not null check (price_unit in ('per hour','fixed'))
      );
      create table service_type_requests (
        id uuid primary key default gen_random_uuid(),
        provider_id text not null,
        requested_name text not null,
        created_at timestamptz not null default now()
      );
      create table audit_records (
        id uuid primary key default gen_random_uuid(),
        actor_id text not null, action text not null, entity text not null, entity_id text not null,
        detail jsonb not null default '{}', at timestamptz not null default now()
      );
      ```
      `src/db/migrate.ts` applies `migrations/*.sql` in filename order, recording each in a `schema_migrations` table (idempotent). `src/service-types/seed-data.ts` exports `STARTER_SERVICE_TYPES` and `src/db/seed.ts` inserts them with `on conflict do nothing`. Pool comes from `DATABASE_URL`.
    files:
      - services/records-api/migrations/001_service_catalog.sql
      - services/records-api/src/db/pool.ts
      - services/records-api/src/db/migrate.ts
      - services/records-api/src/db/seed.ts
      - services/records-api/src/service-types/seed-data.ts
      - services/records-api/package.json
    rationale: |
      ADR-0003 says only the Records API touches PostgreSQL. Retire is a soft flag because AC8 requires an offering to keep showing its type; the unique index on the normalised name makes add/rename reject duplicates.

  - description: |
      Auth seam for the API (ADR-0004). A Fastify `preHandler` turns a bearer token into a `Principal` and `requireRole` rejects the wrong role. The verifier is injected so unit tests use a fake; production uses `jose` against the Entra ID JWKS.

      ```ts
      export type Role = 'admin' | 'provider';
      export interface Principal { id: string; role: Role }
      export interface TokenVerifier { verify(token: string): Promise<Principal> }
      export function authenticate(verifier: TokenVerifier): preHandlerAsyncHookHandler  // 401 when missing/invalid
      export function requireRole(role: Role): preHandlerAsyncHookHandler               // 403 when principal.role !== role
      ```
      `entra-verifier.ts` reads `ENTRA_TENANT_ID`, `ENTRA_AUDIENCE`, and maps the `roles` claim (`ServiceCatalog.Admin` -> admin, otherwise provider) and `oid` -> id.
    files:
      - services/records-api/src/auth/auth.ts
      - services/records-api/src/auth/entra-verifier.ts
    rationale: |
      AC7 needs a server-side refusal for a signed-in provider; the UI refusal alone proves nothing. No auth code exists in the API today (only `src/app.ts`, `src/routes/health.ts`, `src/server.ts`), so this is the smallest seam that respects ADR-0004.

  - description: |
      Service type domain + routes. A `ServiceTypeRepository` interface with an in-memory implementation (unit tests) and a `pg` implementation (production, Playwright). Routes, all behind `authenticate`:

      | Method + path | Role | Behaviour |
      |---|---|---|
      | GET /admin/service-types | admin | all types, each `{ id, name, status: 'offered' | 'retired', providersStillOffering }` |
      | POST /admin/service-types `{ name }` | admin | 201 + created type; 400 blank / over 80; 409 duplicate |
      | PATCH /admin/service-types/:id `{ name }` | admin | 200 renamed; 404; 400; 409 |
      | POST /admin/service-types/:id/retire | admin | 200, sets `retired_at`; idempotent; 404 |
      | GET /service-types | any signed-in | only types where `retired_at is null` (the list providers choose from) |

      ```ts
      export interface ServiceTypeRepository {
        listAll(): Promise<ServiceTypeRow[]>;
        listOffered(): Promise<ServiceTypeRow[]>;
        create(name: string): Promise<ServiceTypeRow>;      // throws DuplicateNameError
        rename(id: string, name: string): Promise<ServiceTypeRow | null>;
        retire(id: string): Promise<ServiceTypeRow | null>;
      }
      ```
      Each create / rename / retire also calls `audit.record({ actorId, action, entity: 'service_type', entityId, detail })` (ADR-0011). `buildApp` becomes `buildApp(deps: AppDeps = defaultDeps())` where `AppDeps = { verifier, serviceTypes, requests, offerings, audit }`, and registers `@fastify/cors` (origin from `CORS_ORIGIN`) because the Web App calls the API directly (ADR-0002).
    files:
      - services/records-api/src/app.ts
      - services/records-api/src/server.ts
      - services/records-api/src/audit/audit.ts
      - services/records-api/src/service-types/repository.ts
      - services/records-api/src/service-types/memory-repository.ts
      - services/records-api/src/service-types/pg-repository.ts
      - services/records-api/src/service-types/routes.ts
    rationale: |
      Covers AC1-4, 6, 7. Rename updates the row in place by id, so offerings that reference it show the new name.

  - description: |
      Provider request + provider offerings routes.

      - `POST /service-type-requests` `{ name }` (provider): validates a non-blank name, stores a `service_type_requests` row, writes an audit record, returns `201 { requested: true }`. This is the "request sent to an admin" confirmation for AC5.
      - `GET /provider/offerings` (provider): the caller's offerings joined to `service_types` regardless of `retired_at`, returning `{ serviceType: name, price: { amount, unit }, typeStatus: 'offered' | 'retired' }`. This is AC8.
    files:
      - services/records-api/src/service-types/requests-routes.ts
      - services/records-api/src/offerings/offerings-routes.ts
      - services/records-api/src/offerings/memory-repository.ts
      - services/records-api/src/offerings/pg-repository.ts
    rationale: |
      AC5 and AC8. Offerings are read-only here because creating and pricing offerings is another story in the Service Catalog epic.

  - description: |
      Web App: load the design system once and add the app-owned classes. Today `apps/web/src/index.css` holds only `@import "tailwindcss";` and nothing imports `apps/web/design/`, so none of the tokens or `.btn`, `.modal`, `.badge`, `.alert`, `.toast`, `.skeleton`, `.empty-state`, `.table`, `.field` classes exist in the app.

      `index.css` becomes:
      ```css
      @import "tailwindcss";
      @import "../design/tokens.css";
      @import "../design/prototype-utils.css";
      @import "./styles/shell.css";
      @import "./styles/service-types.css";
      ```
      `styles/shell.css` copies the `.shell*` rules from `apps/web/design/app-shell.html` (they are defined there, not in `prototype-utils.css`). `styles/service-types.css` holds the prototype's own inline rules (`.subnav`, `.subnav-links`, `.page-head`, `.type-list`, `.type-row`, `.type-name`, `.type-meta`, `.type-actions`, `.form-panel`, `.form-actions`, `.section-gap`, `.skeleton-row`, `.flash`), written only with tokens: `--space-1..4`, `--border-width`, `--color-border`, `--color-bg`, `--color-bg-subtle`, `--color-fg-muted`, `--radius-lg`, `--tap-target`, `--check-size`, `--control-height`, `--font-size-xl`, `--font-size-sm`, `--font-weight-medium`, `--line-height-tight`.
    files:
      - apps/web/src/index.css
      - apps/web/src/styles/shell.css
      - apps/web/src/styles/service-types.css
    rationale: |
      The UI guidelines require tokens by name and no class without a loaded definition. Classes used by the prototype that are defined in `prototype-utils.css`: `.btn*`, `.field*`, `.input`, `.badge-*`, `.alert-*`, `.modal*`, `.backdrop`, `.toast`, `.skeleton`, `.empty-state`, `.table`, `.table-wrap`, `.tab`, `.tabs`, `.text-muted`, `.text-sm`. Defined in `app-shell.html`: `.shell*`. Defined only in the prototype's inline style (so re-created on tokens): the type-row list classes above.

  - description: |
      Web App: app shell, routing and API client. Add `react-router-dom`. `App.tsx` renders `AppShell` (top bar Records, Reports, Settings, Account with `data-nav-key`, the Menu toggle below 48em, `aria-current="page"` on the active link, footer) around routes `/settings/service-types` (admin) and `/account/service-types` (provider). Records and Reports link to a placeholder route (outside this story).

      ```ts
      // src/api/client.ts
      export class ApiError extends Error { constructor(public status: number, message: string) { super(message) } }
      export function createApi(getToken: () => string | null, baseUrl = import.meta.env.VITE_RECORDS_API_URL ?? '/api') {
        return {
          adminTypes: () => get<AdminServiceType[]>('/admin/service-types'),
          offeredTypes: () => get<ServiceType[]>('/service-types'),
          addType: (name: string) => post<AdminServiceType>('/admin/service-types', { name }),
          renameType: (id: string, name: string) => patch<AdminServiceType>(`/admin/service-types/${id}`, { name }),
          retireType: (id: string) => post<AdminServiceType>(`/admin/service-types/${id}/retire`),
          requestType: (name: string) => post<{ requested: true }>('/service-type-requests', { name }),
          myOfferings: () => get<ProviderOffering[]>('/provider/offerings'),
        }
      }
      ```
      Session: `src/auth/session.tsx` exposes `useSession(): { token: string | null; role: 'admin' | 'provider' | null }` through a context provider. Entra sign-in itself is not part of this item; the context is the seam it will fill, and tests supply it. `vite.config.ts` gets a dev `server.proxy` of `/api` to the Records API.
    files:
      - apps/web/package.json
      - apps/web/vite.config.ts
      - apps/web/src/App.tsx
      - apps/web/src/main.tsx
      - apps/web/src/components/AppShell.tsx
      - apps/web/src/api/client.ts
      - apps/web/src/api/types.ts
      - apps/web/src/auth/session.tsx
      - apps/web/.env.example
    rationale: |
      ADR-0001/0002: the Web App only calls the Records API, directly. UI guidelines: top bar only, order Records, Reports, Settings, Account, detail screens under existing sections (admin under Settings, provider under Account, as the prototype's `data-nav` shows).

  - description: |
      Web App: admin "Service types" screen (prototype screen "Service types"). Layout: `.subnav` bar ("Admin console" + `.tabs`), `.page-head` with `h1` "Service types", the muted line "Providers choose from this list when they offer a service." and one `.btn-primary` "Add service type"; then `ul.type-list` of `li.type-row` with the name, `.badge-success` "Offered" and two `.btn-secondary` buttons (`aria-label="Rename Plumbing"`, `aria-label="Retire Plumbing"`). A retired row has `.is-retired`, `.badge-neutral` "Retired", `.type-meta` "Not offered to providers. N providers still list it with their price." and no buttons (no reinstate: not in the story).

      States, each from the prototype:
      - loading: four `.skeleton.skeleton-row` inside `role="status"` with `aria-busy`.
      - error: `.alert.alert-danger role="alert"` "The service types did not load." with a "Try again" `.btn-secondary`.
      - empty: `.empty-state` "No service types yet" with one primary "Add service type".
      - adding: `.form-panel` with a `.field` (label "Service type name", `.input`, `.field-hint`), "Cancel" and "Save service type". Success shows a `.toast` "Service type added. Providers can now choose it."
      - renaming: same form prefilled, "Save name", toast "Service type renamed."
      - retire-confirm: `.backdrop` + `.modal role="dialog" aria-modal="true"` titled "Retire Gardening?" with the body text from the prototype, "Cancel" and "Retire service type" (`.btn-primary`, as in the prototype; retire is a soft flag, so not `.btn-danger`). Toast "Gardening retired. Providers no longer see it in the list."
      - validation: `.field-error` plus `.is-invalid` for a blank name ("Enter a service type name") and a duplicate (409: "A service type with this name already exists. Enter a different name").

      The modal traps focus, closes on Escape and returns focus to the trigger (the prototype kit does this). Only tokens listed in the CSS item are used for styling.
    files:
      - apps/web/src/pages/AdminServiceTypesPage.tsx
      - apps/web/src/components/TypeRow.tsx
      - apps/web/src/components/ConfirmRetireModal.tsx
      - apps/web/src/components/Toast.tsx
    rationale: |
      AC1-4 and AC8 (admin side: a retired type stays visible with the count of providers still listing it, matching the prototype's retired row).

  - description: |
      Web App: provider "Choose a service type" screen (prototype screen "Request a service type"). `.subnav` ("Provider profile"), `.page-head` with `h1` "Choose a service type", and a `role="radiogroup"` `ul.type-list` of radio rows built from `GET /service-types` (only offered types, AC6). Below, the `.form-panel` request box: "Can't find the service you offer?", a `.field` "Service type you need" with the hint "Only admins can add service types. Send a request and an admin will review it.", a `.btn-secondary` "Add service type" and a `.btn-primary` "Ask an admin to add it".

      - "Ask an admin to add it" calls `requestType(name)`; on 201 show `.alert.alert-success role="status"` "Your request was sent to an admin. We'll let you know when it is added." above the list and a "Back to the full list" `.btn-secondary` (AC5). A blank name shows `.field-error` "Enter the service type you need".
      - "Add service type" calls `POST /admin/service-types`; the API answers 403 and the page shows `.alert.alert-danger role="alert"` "Only admins can add service types. Use "Ask an admin to add it" instead." The list is unchanged (AC7). The button is kept because the prototype shows it and AC7 starts from a provider attempting the add.
      - "Your current offerings": `.table-wrap > .table` with columns Service type, Price (formatted `£55.00 per hour`, `£80.00 fixed`), Status (`.badge-success` "Active" or `.badge-neutral` "Type retired"), and the `.text-sm.text-muted` note that a retired type keeps its type and price (AC8).
      - Loading uses `.skeleton` rows; a load failure uses the same `.alert-danger` with "Try again".
    files:
      - apps/web/src/pages/ProviderServiceTypesPage.tsx
      - apps/web/src/components/OfferingsTable.tsx
      - apps/web/src/lib/formatPrice.ts
    rationale: |
      AC5-8 on the provider side.

tests:
  - |
    AC1 (API unit, first). The seed list is what the admin sees. File `services/records-api/test/unit/service-types-admin.test.ts`, using `buildApp({ verifier: fakeVerifier, serviceTypes: new MemoryServiceTypeRepository(STARTER_SERVICE_TYPES), ... })` and `headers: { authorization: 'Bearer admin' }`:
    ```ts
    const res = await app.inject({ method: 'GET', url: '/admin/service-types', headers: admin })
    expect(res.statusCode).toBe(200)
    expect(res.json().map((t: { name: string }) => t.name)).toEqual(STARTER_SERVICE_TYPES)
    ```
    Plus a seed idempotence test: `await seed(repo); await seed(repo); expect((await repo.listAll()).length).toBe(STARTER_SERVICE_TYPES.length)`.
  - |
    AC2 (API unit). Add appears in the list, and bad input is refused. Same file:
    ```ts
    const created = await app.inject({ method: 'POST', url: '/admin/service-types', headers: admin, payload: { name: 'Locksmith' } })
    expect(created.statusCode).toBe(201)
    const list = await app.inject({ method: 'GET', url: '/admin/service-types', headers: admin })
    expect(list.json().map((t: { name: string }) => t.name)).toContain('Locksmith')
    // blank -> 400, duplicate (case-insensitive) -> 409
    expect((await post({ name: '   ' })).statusCode).toBe(400)
    expect((await post({ name: 'plumbing' })).statusCode).toBe(409)
    ```
    And an audit assertion (ADR-0011): `expect(audit.records).toContainEqual(expect.objectContaining({ actorId: 'admin-1', action: 'service_type.created' }))`.
  - |
    AC3 (API unit). Rename shows the new name in place:
    ```ts
    const res = await app.inject({ method: 'PATCH', url: `/admin/service-types/${gardening.id}`, headers: admin, payload: { name: 'Garden care' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().name).toBe('Garden care')
    const names = (await listAdmin()).map((t) => t.name)
    expect(names).toContain('Garden care'); expect(names).not.toContain('Gardening')
    expect((await patch('00000000-0000-0000-0000-000000000000', { name: 'X' })).statusCode).toBe(404)
    ```
  - |
    AC4 (API unit). Retire removes the type from the providers' list but not from the admin list:
    ```ts
    await app.inject({ method: 'POST', url: `/admin/service-types/${gardening.id}/retire`, headers: admin })
    const offered = await app.inject({ method: 'GET', url: '/service-types', headers: provider })
    expect(offered.json().map((t: { name: string }) => t.name)).not.toContain('Gardening')
    const all = (await listAdmin()).find((t) => t.id === gardening.id)
    expect(all?.status).toBe('retired')
    ```
  - |
    AC5 (API unit, `service-type-requests.test.ts`, and web test `ProviderServiceTypesPage.test.tsx`). API:
    ```ts
    const res = await app.inject({ method: 'POST', url: '/service-type-requests', headers: provider, payload: { name: 'Locksmith' } })
    expect(res.statusCode).toBe(201)
    expect(requests.all()).toEqual([expect.objectContaining({ providerId: 'provider-1', requestedName: 'Locksmith' })])
    expect((await postRequest({ name: '' })).statusCode).toBe(400)
    ```
    Web, with `fetch` stubbed by `vi.stubGlobal('fetch', ...)` returning 201:
    ```tsx
    await user.type(screen.getByLabelText('Service type you need'), 'Locksmith')
    await user.click(screen.getByRole('button', { name: 'Ask an admin to add it' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Your request was sent to an admin')
    ```
  - |
    AC6 (API unit + web). API: `GET /service-types` as a provider returns exactly the non-retired names and `expect(offered.json().every((t: { retired?: unknown }) => !('retiredAt' in t))).toBe(true)`. Web: with the offered endpoint stubbed to return Plumbing, Cleaning, Electrical:
    ```tsx
    const group = await screen.findByRole('radiogroup', { name: 'Service type for this offering' })
    expect(within(group).getAllByRole('radio')).toHaveLength(3)
    expect(within(group).queryByLabelText('Pest control')).not.toBeInTheDocument()
    ```
  - |
    AC7 (API unit + web + Playwright). API: a provider is refused and the list is unchanged; no token gives 401:
    ```ts
    const res = await app.inject({ method: 'POST', url: '/admin/service-types', headers: provider, payload: { name: 'Locksmith' } })
    expect(res.statusCode).toBe(403)
    expect((await repo.listAll()).map((t) => t.name)).not.toContain('Locksmith')
    expect((await app.inject({ method: 'POST', url: '/admin/service-types', payload: { name: 'X' } })).statusCode).toBe(401)
    ```
    The same 403 is asserted for PATCH and retire. Web: stub the add call to 403 and
    ```tsx
    await user.click(screen.getByRole('button', { name: 'Add service type' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Only admins can add service types')
    expect(screen.getAllByRole('radio')).toHaveLength(initialCount)
    ```
  - |
    AC8 (API unit + Playwright + web). API: retire a type that a provider offers, then read the provider's offerings:
    ```ts
    await app.inject({ method: 'POST', url: `/admin/service-types/${pest.id}/retire`, headers: admin })
    const res = await app.inject({ method: 'GET', url: '/provider/offerings', headers: provider })
    expect(res.json()).toContainEqual({ serviceType: 'Pest control', price: { amount: '80.00', unit: 'fixed' }, typeStatus: 'retired' })
    ```
    Web: `expect(within(table).getByRole('row', { name: /Pest control.*£80\.00 fixed.*Type retired/ })).toBeInTheDocument()`. Admin page: the retired row shows `Retired` and `3 providers still list it with their price`.
  - |
    Web admin page states (`AdminServiceTypesPage.test.tsx`), one test each: loading shows `getByRole('status', { name: 'Loading service types' })`; a rejected fetch shows `getByRole('alert')` with "The service types did not load." and "Try again" refetches; an empty list shows `getByRole('heading', { name: 'No service types yet' })`; add / rename / retire flows show the toast text from the prototype and refetch; the retire modal is `getByRole('dialog', { name: 'Retire Gardening?' })`, Escape closes it, and Cancel makes no request; a 409 on add shows `.field-error` text next to the input (`aria-invalid="true"`).
  - |
    Real-database check (Playwright API tests, `services/records-api/test/e2e/service-types.spec.ts`), run after `pnpm db:migrate && pnpm db:seed` against a PostgreSQL named by `DATABASE_URL`, with a test verifier enabled only when `NODE_ENV=test`: `GET /admin/service-types` returns the starter list; add, rename, retire round-trip; a retired type still joins into `GET /provider/offerings`; a second `pnpm db:seed` run leaves the row count unchanged; the unique index rejects `Plumbing` and `  plumbing ` with 409.
  - |
    Shell and tokens (`AppShell.test.tsx`): the four nav links render in the order Records, Reports, Settings, Account with `data-nav-key`, the Settings link has `aria-current="page"` on `/settings/service-types`, and `index.css` imports the tokens:
    ```ts
    expect(readFileSync('src/index.css', 'utf8')).toContain('../design/tokens.css')
    ```
    Narrow run form of the project command: `(cd services/records-api && pnpm vitest run test/unit/service-types-admin.test.ts) && (cd apps/web && pnpm vitest run src/pages/AdminServiceTypesPage.test.tsx)`.

assumptions_or_open_questions:
  - |
    The starter list is not given in the item. The prototype's sample data (Plumbing, Cleaning, Electrical, Gardening) is invented, but the story text names plumbing and cleaning. The plan seeds those four in `seed-data.ts`; the team should confirm or replace the list before release.
  - |
    No sign-in, user or role code exists yet (the API has only `/health`, the web app only a heading). The plan adds an injected `TokenVerifier` and a web `useSession()` seam, and a production Entra verifier using `jose`. The real sign-in flow in the web app (Entra ID per ADR-0004) is not built here. Open: which Entra claim carries admin vs provider (the plan assumes an app role named `ServiceCatalog.Admin` in the `roles` claim), and which story delivers web sign-in. Until it lands, the web screens only work with a session supplied by that seam.
  - |
    AC8 needs provider offerings with a price, but no offerings exist and the epic's pricing is not in this item. The plan adds a minimal `offerings` table and a read-only `GET /provider/offerings` (GBP display taken from the prototype, `per hour` or `fixed` units are invented). If a pricing story owns that table, this plan should reuse its schema; confirm the owner and the currency.
  - |
    "Request sent to an admin" is stored as a `service_type_requests` row only. No email is sent (ADR-0009 allows SES, but the item does not ask for it) and no admin screen lists the requests, because no AC covers either. The prototype's "We'll let you know when it is added" implies a later notification; this is flagged as follow-up, not built.
  - |
    Prototype vs guidelines: the prototype uses `.btn-primary` for the retire confirmation, while the guidelines reserve `.btn-danger` for irreversible actions behind a modal. Retire is a soft flag, so the plan follows the prototype. If retirement should be treated as irreversible (no reinstate in this story), change that button to `.btn-danger`.
  - |
    The prototype's provider screen keeps an "Add service type" button that a provider can press, and the story (AC7) wants it refused. The plan keeps the button and shows the prototype's refusal alert from the API's 403, rather than hiding the button.
  - |
    The prototype shows the retired type in the admin list with a count of providers still listing it. The plan computes that count from `offerings` in `GET /admin/service-types`. There is no reinstate action (the story has none).
  - |
    Project-wide deferred question (CHORE-015): retention period for payment, booking and dispute records. It does not affect this item (service types, requests and audit records only); audit and request retention is left unspecified and no purge job is planned.
  - |
    Records and Reports nav links point to placeholder routes because those screens belong to other stories; the prototype marks them "outside this story".
  - |
    Test infrastructure: API unit tests use in-memory repositories (matching the existing `test/unit` vitest setup), so the pg repositories are only exercised by the Playwright API tests. The Playwright config currently starts `node dist/server.js` with no database; it will need `DATABASE_URL` and a migrate and seed step added to its `webServer` command, and CI needs a PostgreSQL service. Confirm that the CI environment can provide one.

estimated_points: 8

package_dependencies:
  - name: pg
    version: ^8.13.0
    ecosystem: npm
    component_id: comp_records_api
    rationale: PostgreSQL client for the Records API repositories, migration runner and seed (ADR-0003).
  - name: "@types/pg"
    version: ^8.11.0
    ecosystem: npm
    component_id: comp_records_api
    rationale: Type definitions for pg (TypeScript strict build).
  - name: "@fastify/cors"
    version: ^11.0.0
    ecosystem: npm
    component_id: comp_records_api
    rationale: The Web App calls the Records API directly from another origin (ADR-0002), so the API must answer CORS preflight.
  - name: jose
    version: ^6.0.0
    ecosystem: npm
    component_id: comp_records_api
    rationale: Verifies Entra ID bearer tokens against the tenant JWKS (ADR-0004).
  - name: react-router-dom
    version: ^7.1.0
    ecosystem: npm
    component_id: comp_web_app
    rationale: The Web App has no router; the admin and provider screens live on separate top-bar sections (Settings and Account).

notes: |
  ### Data & rollout
  - **Existing data**: no table exists today (the API has no database code), so migration `001_service_catalog.sql` creates everything new and alters no existing rows. `offerings.service_type_id` references `service_types(id)` and service types are never deleted (only retired), so the foreign key cannot orphan an offering.
  - **Backfill / seed**: the starter types are inserted by `pnpm db:seed` (`src/db/seed.ts`) with `on conflict do nothing` on the unique normalised name, so it is idempotent and safe to re-run. No backfill is needed. Tables are new and empty, so there is no long lock.
  - **Settings**: `DATABASE_URL` (no default; the API refuses to start without it outside `NODE_ENV=test`), `ENTRA_TENANT_ID` and `ENTRA_AUDIENCE` (no default; startup fails if unset outside tests), `CORS_ORIGIN` (default: no cross-origin allowed). Web: `VITE_RECORDS_API_URL` (default `/api`). All are documented in `services/records-api/.env.example` and `apps/web/.env.example`. The existing `apps/web/.env.local` is not touched.
  - **Provisioning**: a PostgreSQL database (RDS in deployed environments, per the stack), an Entra app registration with an admin app role, and the migrate then seed run, which creates the starter service types.
  - **Order and rollback**: deploy order is migrate, then seed, then the new API, then the Web App. Rollback: the migration is additive, so the old code ignores the new tables and it is safe to leave in place; `migrations/001_service_catalog.down.sql` drops the four tables in reverse dependency order if a full revert is wanted.
  - Test for existing rows: the Playwright spec re-runs `db:migrate` and `db:seed` on a database that already holds an admin-added type and offerings, and asserts those rows are still returned unchanged.

  ### Design system loading
  `apps/web/src/main.tsx:3` imports `./index.css`, whose only line today (`apps/web/src/index.css:1`) is `@import "tailwindcss";`. `apps/web/vite.config.ts:7` registers `@tailwindcss/vite`. The tokens (`apps/web/design/tokens.css`) and component stylesheet (`apps/web/design/prototype-utils.css`) are not imported anywhere, so the plan adds the imports to `index.css` once. Tailwind's preflight loads first, then the design stylesheets, so the design's `.btn` and `.field` classes win over resets. The Tailwind utility classes in the current `App.tsx` placeholder are replaced by the design-system classes.

  ### Flow

  ```mermaid
  flowchart TD
    Web[apps/web pages: Admin and Provider service types] -->|REST, ADR-0002| Routes[service-types routes and requests-routes]
    Web --> Client[web api/client.ts]
    Client -->|fetch with bearer token| App[records-api app.ts buildApp]
    App --> Auth[auth/auth.ts authenticate + requireRole]
    Auth --> Entra[auth/entra-verifier.ts jose]
    App --> Routes
    App --> OffRoutes[offerings-routes]
    Routes --> Repo[ServiceTypeRepository]
    OffRoutes --> OffRepo[offerings repository]
    Routes --> Audit[audit/audit.ts]
    Repo --> PG[(PostgreSQL: service_types, offerings, service_type_requests, audit_records)]
    OffRepo --> PG
    Audit --> PG
    Health[routes/health.ts] -.-> App
    classDef touched fill:#f96,color:#000
    class Web,Routes,Client,App,Auth,Entra,OffRoutes,Repo,OffRepo,Audit,PG touched
  ```
  Health is the only untouched node; every other node is new or modified. `app.ts` changes to take injected dependencies, which is what lets unit tests swap in memory repositories and a fake verifier.

  ### Conventions followed
  Domain nouns used: service type, provider, admin, offering. TypeScript, Fastify, vitest and Playwright match the confirmed stack, and no other database, styling or test tool is introduced. Copy follows the guidelines: sentence case, verb + object buttons, no exclamation marks, errors that say how to fix the problem. Every UI control sits in `.field`; one `.btn-primary` per region; `.table` sits in `.table-wrap` so it scrolls at 375px; the page title is an `h1`; the toast is brief confirmation and the alert is for persistent messages.

review_focus: |
  IN scope: the service type list (seed, add, rename, retire), the provider's offered list, the provider request, and the 403 for provider adds, across API, database and the two approved screens. OUT: creating or pricing offerings, admin handling of requests, email, web sign-in, reinstating a retired type, and provider-added types. Riskiest areas are the authorisation checks (AC7 must hold on the server, not only in the UI), the soft retire that keeps offerings' type and price (AC8), and the new auth seam, which is built on assumptions (Entra role claim, no existing sign-in) listed under open questions. The retire button uses `.btn-primary` on purpose, following the prototype.
