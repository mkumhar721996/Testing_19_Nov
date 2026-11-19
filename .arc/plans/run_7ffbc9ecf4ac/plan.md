summary: |
  A signed-in provider can save one recurring weekly working-hours block per weekday and mark or unmark specific dates as days off. Customers can then request the bookable slots for a provider on a date. Slots are generated only inside that weekday's hours, in the provider's own time zone. Each slot is exactly the service's duration long, and nothing is offered on a day off or on a weekday with no hours.

  The repo is a bare scaffold: Records API has only `/health`, the Web App has only a placeholder `App`. There is no database access, auth, service catalog or app shell yet. So the plan builds, test-first: (1) a pure slot-generation and time-zone module, (2) the availability store and PostgreSQL migration, (3) REST routes on the Records API (ADR-0001/0002/0003), and (4) the "My availability" screen in the Web App from the approved prototype, loading the design system's tokens and components. The Accounts & Access and Service Catalog dependencies are consumed through two small ports (principal and service duration), not re-implemented.

scope:
  - description: |
      Pure time-zone and slot-generation module, no I/O. Signatures:

      ```ts
      export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7; // ISO: 1 = Monday
      export interface WorkingHours { weekday: Weekday; start: string; end: string } // 'HH:MM', provider-local
      export interface Slot { start: string; end: string; localStart: string; localEnd: string } // start/end: UTC ISO instants
      export function weekdayOf(date: string): Weekday; // 'YYYY-MM-DD' calendar date, no tz shift
      export function zonedTimeToInstant(date: string, time: string, timeZone: string): Date; // uses Intl.DateTimeFormat, no dependency
      export function computeSlots(input: {
        date: string; timeZone: string; durationMinutes: number;
        hours: WorkingHours[]; daysOff: string[];
      }): Slot[];
      ```

      Rules: the requested `date` is a provider-local calendar date. Return [] when `daysOff` contains exactly that date or no `hours` entry has that weekday. Otherwise step from `start` in increments of `durationMinutes` and keep a slot only while its end is at or before `end`. Each slot's end is its start plus exactly `durationMinutes` of elapsed time. `localStart` and `localEnd` are the provider-zone wall times.
    files:
      - services/records-api/src/availability/slots.ts
      - services/records-api/test/unit/slots.test.ts
    rationale: |
      Covers the behaviour of AC 2, 4, 5, 6, 7, 8, 10, 11 and 12 in one pure, fast-to-test unit. Keeping it free of I/O means the time-zone rules are tested without a database.

  - description: |
      Availability domain types, validation and store port.

      ```ts
      export interface AvailabilityStore {
        getAvailability(providerId: string, actorId: string): Promise<{ timeZone: string | null; hours: WorkingHours[]; daysOff: string[] }>;
        setTimeZone(providerId: string, timeZone: string, actorId: string): Promise<void>;
        createHours(providerId: string, h: WorkingHours, actorId: string): Promise<'created' | 'exists'>; // never overwrites (AC 13)
        updateHours(providerId: string, h: WorkingHours, actorId: string): Promise<'updated' | 'missing'>;
        deleteHours(providerId: string, weekday: Weekday, actorId: string): Promise<void>;
        addDayOff(providerId: string, date: string, actorId: string): Promise<void>; // idempotent
        removeDayOff(providerId: string, date: string, actorId: string): Promise<void>;
      }
      export function validateHours(start: unknown, end: unknown): { ok: true } | { ok: false; errors: { start?: string; end?: string } };
      ```

      `validateHours` enforces `HH:MM` 24-hour format and end strictly after start, returning the end-time message "End time must be after the start time. Enter a time later than 17:00." (the start value filled in). Also provide `InMemoryAvailabilityStore` (used by unit and API e2e tests, selected only by `RECORDS_STORE=memory`) and a `ServiceCatalogPort` with `getDurationMinutes(providerId, serviceId): Promise<number | null>`.
    files:
      - services/records-api/src/availability/types.ts
      - services/records-api/src/availability/validation.ts
      - services/records-api/src/availability/memoryStore.ts
      - services/records-api/test/unit/validation.test.ts
      - services/records-api/test/unit/memoryStore.test.ts
    rationale: |
      A store port lets routes be tested with inject() against an in-memory store while production uses PostgreSQL. ADR-0003 makes only the Records API touch the database, and the port keeps that boundary. The `actorId` parameter on every write exists for the ADR-0011 audit record.

  - description: |
      PostgreSQL schema, migration runner and `PgAvailabilityStore`. Add `pg` and `@types/pg`. New file `services/records-api/migrations/0001_provider_availability.sql` creates four tables:

      - `provider_availability(provider_id text primary key, time_zone text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now())`
      - `working_hours(provider_id text not null references provider_availability, weekday smallint not null check (weekday between 1 and 7), start_time time not null, end_time time not null, check (end_time > start_time), primary key (provider_id, weekday))`. The primary key enforces one block per weekday at the database level (AC 13).
      - `days_off(provider_id text not null references provider_availability, day date not null, primary key (provider_id, day))`
      - `audit_records(id bigserial primary key, actor_id text not null, action text not null, subject text not null, occurred_at timestamptz not null default now())`

      `src/db/migrate.ts` applies the `.sql` files in filename order and records them in a `schema_migrations` table. `src/db/pool.ts` builds a `pg.Pool` from `DATABASE_URL`. The Pg store writes the audit row in the same transaction as every create, update, delete or day-off change (ADR-0011).
    files:
      - services/records-api/package.json
      - services/records-api/migrations/0001_provider_availability.sql
      - services/records-api/migrations/0001_provider_availability.down.sql
      - services/records-api/src/db/pool.ts
      - services/records-api/src/db/migrate.ts
      - services/records-api/src/availability/pgStore.ts
      - services/records-api/test/unit/migration.test.ts
    rationale: |
      Persists hours and days off so the provider sees them again on reopening (AC 1, 3), and enforces the one-block rule below the API (AC 13). The migration only creates new tables, so there is no impact on existing data.

  - description: |
      Fastify routes, registered from `buildApp`. `buildApp` gains an options argument so tests can inject the store, catalog and authenticator:

      ```ts
      export interface AppDeps {
        store: AvailabilityStore;
        catalog: ServiceCatalogPort;
        authenticate: (req: FastifyRequest) => Promise<{ providerId: string; actorId: string } | null>;
      }
      export function buildApp(deps?: Partial<AppDeps>): FastifyInstance; // health-only app stays valid with no deps
      ```

      Provider routes (a null principal returns 401):
      - `GET /providers/me/availability` returns `{ timeZone, hours: [{weekday,start,end}], daysOff: ['2027-03-12'] }`.
      - `PUT /providers/me/availability/time-zone` takes `{ timeZone }`, validated as an IANA zone via `Intl.supportedValuesOf('timeZone')` or a try/catch on `Intl.DateTimeFormat`.
      - `POST /providers/me/availability/hours` takes `{ weekday, start, end }`. It returns 201, or 409 `{ error: 'hours_exist' }` if that weekday already has a block, leaving the original untouched (AC 13). It returns 400 `{ errors: { end } }` when end is not after start (AC 9).
      - `PUT /providers/me/availability/hours/:weekday` takes `{ start, end }` and updates the existing block, with the same 400 rule and 404 if there is none.
      - `DELETE /providers/me/availability/hours/:weekday` returns 204.
      - `POST /providers/me/availability/days-off` takes `{ date: 'YYYY-MM-DD' }` and returns 201.
      - `DELETE /providers/me/availability/days-off/:date` returns 204.

      Customer route:
      - `GET /providers/:providerId/availability/slots?date=YYYY-MM-DD&serviceId=...` returns `{ date, timeZone, durationMinutes, slots: Slot[] }`. It loads the provider's hours and days off, looks up the duration through the catalog port (400/404 if the service is unknown), and calls `computeSlots`. A provider with no time zone returns `slots: []`. `date` is the provider-local date; each slot carries a UTC instant so the customer's browser can render it in the customer's zone while `localStart` and `localEnd` stay in the provider's zone (AC 12).

      `server.ts` selects `PgAvailabilityStore` when `DATABASE_URL` is set. It uses `InMemoryAvailabilityStore` only when `RECORDS_STORE=memory`. Otherwise it exits at start-up with a clear error. The Playwright API config sets `RECORDS_STORE=memory` and a test-only header-based authenticator guarded by `NODE_ENV=test`.
    files:
      - services/records-api/src/app.ts
      - services/records-api/src/server.ts
      - services/records-api/src/routes/availability.ts
      - services/records-api/src/routes/slots.ts
      - services/records-api/playwright.config.ts
      - services/records-api/test/unit/availability-routes.test.ts
      - services/records-api/test/unit/slots-route.test.ts
      - services/records-api/test/e2e/availability.spec.ts
    rationale: |
      Exposes everything the screen needs through the single REST API with no gateway (ADR-0002). Splitting provider management from the customer slots endpoint keeps the customer route free of provider auth. The ports isolate this story from the unbuilt Accounts & Access and Service Catalog stories.

  - description: |
      Design-system wiring in the Web App, done once in the entry stylesheet. The app's `src/index.css` currently holds only `@import "tailwindcss";`, so neither the tokens nor the component classes are loaded. Add, after the Tailwind import, `@import "../design/tokens.css";` and `@import "../design/prototype-utils.css";`. `prototype-utils.css` defines `.card`, `.btn*`, `.field*`, `.input`, `.is-invalid`, `.badge*`, `.chip`, `.alert*`, `.empty-state`, `.skeleton`, `.toast`, `.stack*`, `.cluster`, `.text-muted` and `.text-sm`. The prototype's `.shell*` classes live only in `design/app-shell.html` and in the prototype's own inline style, so define the shell classes in a new `src/styles/shell.css`, and `.split`, `.day-row`, `.day-name`, `.day-controls`, `.row-end`, `.slots`, `.dayoff-add`, `.dayoff-item` in a new `src/styles/availability.css`. Both are on the same tokens, copied from the prototype, and imported from `src/main.tsx` next to `index.css`.
    files:
      - apps/web/src/index.css
      - apps/web/src/main.tsx
      - apps/web/src/styles/shell.css
      - apps/web/src/styles/availability.css
    rationale: |
      The UI guidelines forbid colour or pixel literals and forbid naming a class that no loaded stylesheet defines. Every class the prototype uses is either in `prototype-utils.css` or defined here from tokens, and no hex/rgb values are introduced.

  - description: |
      App shell and "My availability" screen, built from the approved prototype's `Availability` screen. Tokens used: `--space-1..4`, `--color-fg`, `--color-fg-muted`, `--color-bg`, `--color-bg-subtle`, `--color-border`, `--color-danger-hover`, `--color-info-bg`, `--color-info-fg`, `--font-size-xl`, `--font-size-lg`, `--font-size-sm`, `--control-height`, `--tap-target`, `--content-max-width`, `--radius-md`.

      **Shell** (`AppShell.tsx`): top bar with brand "Records", a `Menu` toggle below 48em, and a nav with Records, Reports, Settings (`aria-current="page"`) and Account, in the guideline order and with `data-nav-key`. Footer with Help and Privacy. The page renders under Settings. The other nav entries are inert links, because their screens belong to other stories. The prototype's wireframe "logo" element is not built, as the prototype notes.

      **Page** (`AvailabilityPage.tsx`): `h1` "My availability", the muted time-zone note "Hours are in your local time zone (<zone>). Customers see each time converted to their own zone." The `.split` grid is 3fr 2fr from 48em and one column below.
      - Left column, card "Weekly working hours": a `.day-row` per weekday Monday to Sunday (the prototype draws Monday to Wednesday and says the rest repeat the pattern). A weekday with a block shows Start and End `type="time"` inputs inside `.field`, plus a "Remove <Day> hours" `.btn-secondary`. A weekday without one shows "Not working" in `.text-muted`. The "Add another block" button sits under a day that already has a block, is `disabled`, and is described by "<Day> already has one block." (AC 13). A day without hours offers an "Add working hours" action instead. One `.btn-primary` "Save working hours" per card. Save calls PUT for existing blocks and POST for new ones.
      - Left column, card "Days off": a `.field` date `input` with the hint "Format DD Month YYYY", a "Mark as day off" `.btn-secondary`, and a list of `.dayoff-item` rows. Each row shows "Friday 12 March 2027", a `.badge .badge-neutral` "Blocked" and a "Remove day off" `.btn-ghost` (AC 3).
      - Right column, card "Preview: times customers can book": a date input and 60-minute slots as `.chip` items in a `.slots` list with `aria-label="Offered times on <date>"`, fed from the customer slots endpoint. It shows an `.alert-info` when the date is a day off.

      **States**, from the prototype:
      - Loading: `.skeleton` blocks in two cards with `aria-busy="true"`.
      - Empty: `.empty-state` "No working hours yet. Add hours for a weekday so customers can book you." with one `.btn-primary` "Add working hours", plus the preview text "No times offered. You have no working hours on this day." (AC 7).
      - Error: a `.alert-danger role="alert"` "Working hours were not saved. Fix the end time and save again." The end input gets `.is-invalid`, `aria-invalid="true"` and `aria-describedby` pointing to a `.field-error` with the API's message (AC 9).
      - Success: a `.toast` ("Working hours saved", "Day off added", "Day off removed for <date>") that auto-hides. Toast messages are verb + object, in sentence case and with no exclamation marks.

      `src/api/availability.ts` holds the typed fetch client (`getAvailability`, `createHours`, `updateHours`, `deleteHours`, `addDayOff`, `removeDayOff`, `getSlots`). The base path is `/api`, proxied in dev and preview to the Records API (`vite.config.ts` `server.proxy` and `preview.proxy`, target from `VITE_RECORDS_API_URL`, default `http://127.0.0.1:8011` to match `server.ts`). The Web App touches no data store directly (ADR-0001). `App.tsx` replaces the placeholder heading with the shell and page, and its existing test moves to the new heading.
    files:
      - apps/web/src/App.tsx
      - apps/web/src/App.test.tsx
      - apps/web/src/AppShell.tsx
      - apps/web/src/AvailabilityPage.tsx
      - apps/web/src/AvailabilityPage.test.tsx
      - apps/web/src/api/availability.ts
      - apps/web/vite.config.ts
      - apps/web/e2e/app.spec.ts
    rationale: |
      Builds the approved prototype with real data from the new endpoints in place of its sample data (Acme Services, Europe/London, fixed Monday hours). Replacing the placeholder `App` also requires updating its existing unit test and e2e heading assertion.

tests:
  - |
    AC1 (API), `availability-routes.test.ts`. Write first; it fails because the routes do not exist.
    ```ts
    await app.inject({ method: 'POST', url: '/providers/me/availability/hours', payload: { weekday: 1, start: '09:00', end: '17:00' }, headers: auth });
    const res = await app.inject({ method: 'GET', url: '/providers/me/availability', headers: auth });
    expect(res.json().hours).toEqual([{ weekday: 1, start: '09:00', end: '17:00' }]);
    ```
    Also covers PUT on an existing block returning the new times, and an unauthenticated call returning 401.
  - |
    AC1 (UI), `AvailabilityPage.test.tsx`, with `fetch` mocked to return Monday 09:00 to 17:00.
    ```ts
    render(<AvailabilityPage />);
    expect(await screen.findByLabelText('Start', { selector: '#mon-start' })).toHaveValue('09:00');
    expect(screen.getByLabelText('End', { selector: '#mon-end' })).toHaveValue('17:00');
    ```
    A skeleton (`aria-busy="true"`) shows before the data resolves.
  - |
    AC2, `slots.test.ts` (pure) and `slots-route.test.ts`. Monday hours 09:00 to 17:00 are saved, and the customer asks for 22 March 2027, a Monday in a later week.
    ```ts
    const slots = computeSlots({ date: '2027-03-22', timeZone: 'Europe/London', durationMinutes: 60, hours: [mon], daysOff: [] });
    expect(slots.map(s => s.localStart)).toEqual(['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00']);
    ```
  - |
    AC3, API and UI. After `POST /providers/me/availability/days-off` with `{ date: '2027-03-12' }`, `GET` returns `daysOff` containing it. In the UI test, after clicking "Mark as day off" the list shows "Friday 12 March 2027" with `screen.getByText('Blocked')`, and a toast "Day off added" appears.
  - |
    AC4, `slots-route.test.ts`, provider with a Friday day off on 2027-03-12 and Friday hours saved.
    ```ts
    const res = await app.inject({ method: 'GET', url: '/providers/p1/availability/slots?date=2027-03-12&serviceId=s1' });
    expect(res.json().slots).toEqual([]);
    ```
  - |
    AC5, `slots.test.ts`. Hours 09:00 to 17:00 on a Monday.
    ```ts
    expect(slots.every(s => s.localStart >= '09:00')).toBe(true);
    expect(slots[0].localStart).toBe('09:00');
    ```
    Also a case with 45-minute duration, where the first slot still starts at 09:00.
  - |
    AC6, `slots.test.ts`. Same setup, plus a 45-minute duration whose last slot would overrun 17:00.
    ```ts
    expect(slots.every(s => s.localEnd <= '17:00')).toBe(true);
    expect(slots.at(-1)!.localEnd).toBe('16:45'); // the 16:30 to 17:15 candidate is dropped
    ```
  - |
    AC7, `slots.test.ts` and `slots-route.test.ts`. Monday hours exist but the date is a Tuesday.
    ```ts
    expect(computeSlots({ date: '2027-03-16', timeZone: 'Europe/London', durationMinutes: 60, hours: [mon], daysOff: [] })).toEqual([]);
    ```
    In the UI test, an empty availability response renders the `.empty-state` text "No working hours yet."
  - |
    AC8, `slots.test.ts`. 60-minute service, including a DST-change date (28 March 2027, Europe/London).
    ```ts
    for (const s of slots) expect(Date.parse(s.end) - Date.parse(s.start)).toBe(60 * 60 * 1000);
    ```
    A second case with a 30-minute service checks 30-minute slots.
  - |
    AC9, API and UI. The API test:
    ```ts
    const res = await app.inject({ method: 'POST', url: '/providers/me/availability/hours', payload: { weekday: 1, start: '17:00', end: '09:00' }, headers: auth });
    expect(res.statusCode).toBe(400);
    expect(res.json().errors.end).toMatch(/End time must be after the start time/);
    ```
    Also an end equal to start gives 400. `validation.test.ts` covers the same rule. The UI test types 17:00 and 09:00 and clicks "Save working hours". It then asserts `screen.getByLabelText('End')` has `aria-invalid="true"` and the `.field-error` text is linked through `aria-describedby`.
  - |
    AC10, `slots-route.test.ts`. Hours exist for a Friday, `DELETE /providers/me/availability/days-off/2027-03-12` is called, then the slots request is made.
    ```ts
    expect(res.json().slots.length).toBeGreaterThan(0);
    expect(res.json().slots.every((s: any) => s.localStart >= '09:00' && s.localEnd <= '17:00')).toBe(true);
    ```
    The UI test checks that "Remove day off" removes the row and shows the toast "Day off removed for 12 March 2027".
  - |
    AC11, `slots.test.ts`. Hours on Friday and Saturday; day off on 2027-03-12.
    ```ts
    const withDayOff = computeSlots({ ...base, date: '2027-03-13', daysOff: ['2027-03-12'] });
    const without = computeSlots({ ...base, date: '2027-03-13', daysOff: [] });
    expect(withDayOff).toEqual(without);
    expect(withDayOff.length).toBeGreaterThan(0);
    ```
  - |
    AC12, `slots.test.ts`. The provider zone is `America/New_York`, hours are 09:00 to 17:00 and the date is 15 March 2027. The 09:00 slot's `start` must be the UTC instant `2027-03-15T13:00:00.000Z` (EDT, UTC-4), not a value shifted to any other zone.
    ```ts
    expect(slots[0].start).toBe('2027-03-15T13:00:00.000Z');
    expect(slots[0].localStart).toBe('09:00');
    expect(slots.at(-1)!.localEnd).toBe('17:00');
    ```
    A matching Europe/London case checks 09:00 UTC in winter. The route test asserts the response `timeZone` and `localStart` values do not depend on any `Accept-Language` or request time-zone header.
  - |
    AC13, API, store and migration. The API test:
    ```ts
    await post({ weekday: 1, start: '09:00', end: '17:00' });
    const second = await post({ weekday: 1, start: '18:00', end: '20:00' });
    expect(second.statusCode).toBe(409);
    const got = await get();
    expect(got.json().hours.filter((h: any) => h.weekday === 1)).toEqual([{ weekday: 1, start: '09:00', end: '17:00' }]);
    ```
    `memoryStore.test.ts` asserts `createHours` returns `'exists'` and leaves the original. `migration.test.ts` asserts that the SQL declares `primary key (provider_id, weekday)` and that the up and down files apply and reverse cleanly against a migration runner using a stub client. The UI test asserts `screen.getByRole('button', { name: 'Add another block' })` is `disabled` with the text "Monday already has one block."
  - |
    Audit (ADR-0011), `memoryStore.test.ts`. Each write records an audit entry with actor and time.
    ```ts
    await store.createHours('p1', mon, 'actor-1');
    expect(store.auditLog.at(-1)).toMatchObject({ actorId: 'actor-1', action: 'hours.create' });
    ```
  - |
    End to end (Playwright API test, `services/records-api/test/e2e/availability.spec.ts`), run against the built server with `RECORDS_STORE=memory`. It saves Monday hours and a day off, reads them back, requests slots for a Monday and for the day off, and checks the 409 on a second Monday block. Narrow commands: `cd services/records-api && pnpm vitest run test/unit/slots.test.ts` for the pure module, `pnpm vitest run test/unit/availability-routes.test.ts` for routes, and `cd apps/web && pnpm vitest run src/AvailabilityPage.test.tsx` for the UI.

assumptions_or_open_questions:
  - |
    Accounts & Access is not built. The repo has no auth, no principal, and no provider records. The plan reads the signed-in provider through an injected `authenticate` function and gives it no real implementation. Production has to wire it to Entra ID token verification (ADR-0004), and the provider routes return 401 until that exists. A human should confirm whether to sequence this story after the Accounts story or accept a stubbed authenticator for now.
  - |
    Service Catalog is not built either. Slot length comes from the service's duration, and the plan only defines a `ServiceCatalogPort.getDurationMinutes(providerId, serviceId)`. The production adapter and the shape of the `services` table are unknown, so the customer slots route cannot work against real data until that story lands. The slots request needs a `serviceId` query parameter, which is my assumption.
  - |
    Where the provider's time zone comes from. The story says "provider's local time zone" and the prototype shows "Europe/London" as a fixed note. The plan stores an IANA zone per provider in `provider_availability` and sets it through `PUT .../time-zone`. The Web App sends the browser's zone (`Intl.DateTimeFormat().resolvedOptions().timeZone`) the first time a provider saves hours. If Provider Profiles will own the zone, this column and endpoint should move there.
  - |
    One block per weekday is enforced both in the API (409 on POST) and by the primary key `(provider_id, weekday)`. The story says second blocks are rejected. This plan treats "save a second block" as a POST for an already-used weekday, and editing the existing block as a PUT.
  - |
    Slot rule: slots start at the working-hours start and step by exactly the service duration, so a trailing remainder shorter than the duration is not offered. Slot overlap or bookings already taken are out of scope here, because the Booking lifecycle belongs to other stories. Slots across a DST gap or overlap use elapsed duration from the converted start instant, so a nonexistent local time at the edge of a block is not specially handled. Please confirm.
  - |
    Customer slots endpoint access. The plan leaves `GET /providers/:providerId/availability/slots` open to any caller, since customers browse before booking. If it should require a signed-in customer, that is one more preHandler once the Accounts story provides roles.
  - |
    Day-off date input. The prototype shows a text input with "Format DD Month YYYY" (for example "12 March 2027") rather than a native date picker. The plan parses that format client-side to `YYYY-MM-DD` and shows a `.field-error` "Enter a date in the format DD Month YYYY" when it cannot be parsed. This error text is mine, not the prototype's.
  - |
    Prototype and UI-guideline tensions. The prototype puts "Add another block" as a permanently disabled button, which this plan follows to satisfy AC 13. The guidelines say one `.btn-primary` per screen region, and the prototype has one per card ("Save working hours"), which the plan keeps. The prototype's `.split` and day-row layout rules are not in `prototype-utils.css`, so they are defined in `availability.css` from tokens. The `8.5rem`, `6rem`, `8rem` and `12rem` widths in the prototype are raw values with no token. I copy them as `rem` layout widths and list them here, as no token covers them.
  - |
    Navigation. The Web App has no router. The shell shows all four nav entries, with Settings as the only live page. Adding a router and the other screens is out of scope. A reviewer should confirm that a single page under Settings is acceptable.
  - |
    Data retention for booking records (project-wide planning question) does not affect this story. Availability rows have no retention rule here, and audit records follow ADR-0011 only. No answer is assumed.
  - |
    The work item text contained no instructions beyond describing the change. Nothing was refused.

estimated_points: 8

package_dependencies:
  - name: pg
    version: ^8.13.0
    ecosystem: npm
    component_id: comp_records_api
    rationale: |
      PostgreSQL client for the availability store and migration runner. The Records API is the only component that reads or writes the database (ADR-0003), and no database driver is installed today.
  - name: "@types/pg"
    version: ^8.11.0
    ecosystem: npm
    component_id: comp_records_api
    rationale: |
      TypeScript typings for `pg`, needed because the Records API is strict TypeScript.

notes: |
  ### Data & rollout

  - **Existing data**: None. `0001_provider_availability.sql` only creates four new tables (`provider_availability`, `working_hours`, `days_off`, `audit_records`) and `schema_migrations`. No existing row is altered, so nothing becomes unreadable.
  - **Backfill / seed**: None needed. A provider with no rows simply has no hours, which the empty state shows. The migration runner skips files already recorded in `schema_migrations`, so it is safe to re-run.
  - **Settings**: `DATABASE_URL` (PostgreSQL connection string). It has no default, and the server exits at start-up with a clear message if it is unset. `RECORDS_STORE=memory` is only for local and Playwright API runs and is never set in deployed environments. `VITE_RECORDS_API_URL` is for the Web App dev/preview proxy only, default `http://127.0.0.1:8011`. Document all three in a short section of `services/records-api/README.md` and `apps/web/README.md` if those exist, otherwise in the PR description.
  - **Provisioning**: the PostgreSQL database on Amazon RDS already exists as a component (ADR-0003). A database role that can create tables is needed to run the migration. The authenticator and service catalog adapters depend on the Accounts and Service Catalog stories.
  - **Order and rollback**: run `node dist/db/migrate.js` before deploying the new API code, because the code reads the new tables. Roll back by deploying the previous API image. The new tables are unused by old code, so they can be left in place. `0001_provider_availability.down.sql` drops them if a full revert is wanted.

  ### Design-system loading today

  `apps/web/src/index.css` line 1 is `@import "tailwindcss";` and `apps/web/src/main.tsx` line 3 imports `./index.css`. `apps/web/vite.config.ts` uses `@tailwindcss/vite`. Nothing imports `apps/web/design/tokens.css` or `prototype-utils.css` yet, hence the scope item that adds both imports once in `index.css`. `tokens.css` defines the `--space-*`, `--color-*`, `--font-size-*` and control-size tokens used above.

  ### Architecture

  ```mermaid
  flowchart TD
    Page[AvailabilityPage.tsx] -->|fetch /api| Client[api/availability.ts]
    Shell[AppShell.tsx] --> Page
    AppTsx[App.tsx] --> Shell
    Client -->|REST| Routes[routes/availability.ts + slots.ts]
    Routes --> Slots[availability/slots.ts]
    Routes --> Validation[availability/validation.ts]
    Routes --> Store[AvailabilityStore port]
    Store --> Pg[availability/pgStore.ts]
    Store --> Mem[availability/memoryStore.ts]
    Pg --> DB[(PostgreSQL)]
    BuildApp[app.ts buildApp] --> Routes
    Health[routes/health.ts] --> BuildApp
    IndexCss[index.css] --> Tokens[design/tokens.css + prototype-utils.css]
    classDef touched fill:#f96,color:#000
    class Page,Client,Shell,AppTsx,Routes,Slots,Validation,Store,Pg,Mem,BuildApp,IndexCss touched
  ```

  Touched nodes are new or changed by this plan. `routes/health.ts` and the design CSS files are the existing context that is untouched.

  ### TDD order

  1. `slots.test.ts` and `validation.test.ts` (fail), then `slots.ts` and `validation.ts`.
  2. `memoryStore.test.ts`, then `types.ts` and `memoryStore.ts`.
  3. Route unit tests, then the routes and `buildApp(deps)`.
  4. `migration.test.ts`, then the SQL, runner and Pg store.
  5. The Playwright API spec, then `server.ts` and the config wiring.
  6. `AvailabilityPage.test.tsx`, then the CSS wiring, shell, page and client.

  ### Full test command

  The configured command is `(cd services/records-api && pnpm test) && (cd apps/web && pnpm test)`. Narrow forms are listed in the last `tests` entry. Note that `services/records-api/vitest.config.ts` only includes `test/unit/**/*.test.ts` and `apps/web/vite.config.ts` only includes `src/**/*.test.{ts,tsx}`, so every new unit test must live in those folders.

review_focus: |
  IN scope: weekly hours (one block per weekday), days off, the customer slots endpoint with provider-time-zone slot generation, the PostgreSQL migration and store with audit rows, and the "My availability" screen from the approved prototype. OUT of scope: real Entra ID auth, the Service Catalog adapter, booking conflicts and the booking lifecycle. These sit behind injected ports and are listed as open questions. The riskiest area is `slots.ts`: the time-zone and DST conversion, the rule that days off match the exact provider-local date, and slot ends staying at or before the working-hours end. Do not flag the in-memory store as a shipped fixture. It is selected only by `RECORDS_STORE=memory` for tests, and production fails fast without `DATABASE_URL`.
