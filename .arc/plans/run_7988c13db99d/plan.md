summary: |
  Add role sign-in end to end. The Records API gets `POST /auth/sign-in` and `GET /me`: it verifies the user's credentials through an `IdentityProvider` port (Microsoft Entra ID adapter in production, per ADR-0004; a fake in tests), then looks the user up in PostgreSQL, where roles and organization membership live. It signs the user in only when the account holds exactly one of the four roles (WFC Admin, Fundraising Consultant, Org Admin, Org Staff). On success it issues a short-lived session token signed by the Records API. A seeded dataset covers all four roles plus the edge accounts (no role, two roles, org user with no organization). The Web App gets a sign-in page, an auth context that keeps the session token, and a signed-in header that shows the role name. Org Admin and Org Staff accounts with no organization sign in and see no organization data. Organization scoping of other screens and endpoints is the parent epic's scoping story, not this one.

scope:
  - description: |
      Records API data layer: migration creating `organizations` (id, name), `users` (id, email unique, display_name, identity_subject unique nullable, organization_id nullable FK to organizations) and `user_roles` (user_id FK, role, primary key on both; role CHECK in the four role codes `wfc_admin`, `fundraising_consultant`, `org_admin`, `org_staff`). A separate `user_roles` table is what lets "holds none" and "holds more than one" role be represented and rejected. Plus a migrate/seed runner with `pnpm db:migrate` and `pnpm db:seed` scripts, and an idempotent seed (`INSERT ... ON CONFLICT DO NOTHING`) with two organizations and these accounts: one WFC Admin, one Fundraising Consultant, one Org Admin and one Org Staff each tied to an organization, one Org Admin with no organization, one account with no role, one account with two roles.
    files:
      - services/records-api/db/migrations/001_users_roles_organizations.sql
      - services/records-api/db/seed/001_seed_accounts.sql
      - services/records-api/src/db/migrate.ts
      - services/records-api/src/db/pool.ts
      - services/records-api/package.json
    rationale: |
      ADR-0003 makes the Records API the only reader/writer of PostgreSQL. Roles and organization live in the Records database (not Entra claims) because ADR-0011 requires role changes to be audited by the Records API.

  - description: |
      Domain types and the user store port. `Role` union, `ROLE_LABELS` (display names), `resolveRole(roles: Role[])` returning a discriminated result, and `UserRepository` with a pg implementation.

      ```ts
      export type Role = 'wfc_admin' | 'fundraising_consultant' | 'org_admin' | 'org_staff';
      export const ROLE_LABELS: Record<Role, string> = {
        wfc_admin: 'WFC Admin',
        fundraising_consultant: 'Fundraising Consultant',
        org_admin: 'Org Admin',
        org_staff: 'Org Staff',
      };
      export type RoleResolution =
        | { ok: true; role: Role }
        | { ok: false; reason: 'no_role' | 'multiple_roles' };
      export function resolveRole(roles: readonly string[]): RoleResolution;

      export interface UserRecord {
        id: string; email: string; displayName: string;
        roles: string[]; organization: { id: string; name: string } | null;
      }
      export interface UserRepository {
        findByEmail(email: string): Promise<UserRecord | null>;
        findById(id: string): Promise<UserRecord | null>;
      }
      ```
    files:
      - services/records-api/src/auth/roles.ts
      - services/records-api/src/auth/user-repository.ts
      - services/records-api/src/auth/pg-user-repository.ts
    rationale: |
      Keeps the role rule (exactly one of four) in one pure function that every acceptance criterion about roles tests, and keeps the database behind a port so unit tests run without PostgreSQL.

  - description: |
      Identity provider port and session tokens. `IdentityProvider.verifyCredentials(email, password)` resolves to `{ subject, email }` or `null` (null for any invalid credential, never a reason). The Entra ID adapter calls the tenant token endpoint with an injected `fetch` and verifies the returned id_token against the tenant JWKS with `jose`. Session tokens are issued and verified with `jose` (HS256) using `SESSION_SECRET`, with lifetime `SESSION_TTL_SECONDS`. `issueSession(userId)` and `verifySession(token)` return or accept only tokens this API issued (ADR-0004).

      ```ts
      export interface IdentityProvider {
        verifyCredentials(email: string, password: string): Promise<{ subject: string; email: string } | null>;
      }
      export function createSessionService(cfg: { secret: string; ttlSeconds: number }): {
        issue(userId: string): Promise<string>;
        verify(token: string): Promise<{ userId: string } | null>;
      };
      ```
    files:
      - services/records-api/src/auth/identity-provider.ts
      - services/records-api/src/auth/entra-identity-provider.ts
      - services/records-api/src/auth/session.ts
      - services/records-api/src/config.ts
    rationale: |
      Sign-in method is still to be confirmed by the identity owner (see open questions), so the provider sits behind a port; swapping Entra flow details does not touch routes or the Web App.

  - description: |
      Auth routes and request guard. `POST /auth/sign-in` with body `{ email, password }`:
      1. `identity.verifyCredentials`; null gives `401 { code: 'invalid_credentials', message: 'Incorrect email or password.' }` (the same body whether the email is unknown or the password is wrong).
      2. `users.findByEmail`; an unknown user is treated the same as invalid credentials.
      3. `resolveRole`; `no_role` gives `403 { code: 'no_role', message: 'Your account has no role assigned. Contact your administrator.' }`; `multiple_roles` gives `403 { code: 'multiple_roles', message: 'Your account has more than one role assigned. Contact your administrator.' }`. No token is issued in either case.
      4. Success gives `200 { token, user: { id, displayName, email, role, roleLabel, organization } }` where `organization` is `null` for an org-role account with none.
      `GET /me` is guarded by `requireSession`, a Fastify preHandler that verifies the bearer token, reloads the user from the database on every request (so a role change takes effect immediately), re-runs `resolveRole`, and returns the same `user` shape, or `401` when the token is missing, invalid or the account no longer has exactly one role. `buildApp(deps?)` takes optional `{ identity, users, sessions }` so `buildApp()` with no argument (health tests) still works; `server.ts` wires the real implementations. The `openapi.yaml` stub gets both paths and the schemas.
    files:
      - services/records-api/src/routes/auth.ts
      - services/records-api/src/auth/require-session.ts
      - services/records-api/src/app.ts
      - services/records-api/src/server.ts
      - openapi.yaml
    rationale: |
      Server-side enforcement of role recognition on each request, answering the deferred question about how roles are established and checked. A generic 401 body avoids revealing whether an account exists.

  - description: |
      Web App: load the design system once. Import `../design/tokens.css` and `../design/prototype-utils.css` in the global stylesheet right after `@import "tailwindcss"`. Define the shell classes the app-shell prototype keeps inline (`.shell`, `.shell-header`, `.shell-brand`, `.shell-main`) in a new `src/shell.css` imported from `main.tsx`, built only on tokens.
    files:
      - apps/web/src/index.css
      - apps/web/src/shell.css
      - apps/web/src/main.tsx
    rationale: |
      `apps/web/src/index.css` currently only has `@import "tailwindcss"` (line 1) and `main.tsx` imports it (line 3), so tokens are not loaded today. `.field`, `.input`, `.btn-primary`, `.alert-danger`, `.badge` and `.stack` are defined in prototype-utils.css; the `.shell-*` classes exist only in app-shell.html's inline style, so they are redefined in the app on the same tokens.

  - description: |
      Web App auth client and state. `signIn(email, password)` posts to `${VITE_API_BASE_URL}/auth/sign-in`, `fetchMe(token)` calls `/me`; both return typed results (`{ ok: true, token, user }` or `{ ok: false, code, message }`). `AuthProvider` keeps `{ status: 'signed-out' | 'checking' | 'signed-in', user }`, stores the token in `sessionStorage`, restores it through `/me` on load and drops it on a 401. `useAuth()` exposes `signIn`, `signOut`, `user`, `error`.
    files:
      - apps/web/src/auth/api.ts
      - apps/web/src/auth/AuthContext.tsx
      - apps/web/src/auth/types.ts
      - apps/web/vite.config.ts
    rationale: |
      ADR-0001/0002: the Web App calls the Records API directly with no BFF. `vite.config.ts` gets a dev server proxy for `/auth` and `/me` so local development avoids cross-origin setup. `sessionStorage` (not `localStorage`) so the session ends when the tab closes.

  - description: |
      Web App screens. `SignInPage`: h1 "Sign in", a form with `.field` email and password inputs (`.input`, `.field-label`), one `.btn-primary` "Sign in" button, and an `.alert .alert-danger` with `role="alert"` showing the server's message (generic for bad credentials, the role message for no-role or multi-role accounts). It stays on the page after any failure and clears the password. `AppHeader`: `.shell-header` with the brand and the user's display name, plus a `.badge .badge-neutral` with the role label (for example "Org Admin") and a "Sign out" `.btn-secondary`. `App` renders `SignInPage` when signed out and header plus main when signed in. Organization name is shown in the header only when `user.organization` is non-null, so an org account with no organization shows no organization data. The prototype's Records/Reports/Settings/Account nav is not added because those destinations belong to other stories.

      Tokens used: `--space-2`, `--space-3`, `--space-4`, `--color-bg`, `--color-border`, `--border-width`, `--font-size-lg`, `--font-weight-bold`, `--content-max-width`, plus the token-backed `.field`, `.input`, `.btn-primary`, `.btn-secondary`, `.alert-danger`, `.badge-neutral`, `.stack`, `.container` classes. No colour or pixel literals. The existing tailwind utility classes in `App.tsx` (`bg-slate-50`, `text-slate-900`) are removed.
    files:
      - apps/web/src/App.tsx
      - apps/web/src/pages/SignInPage.tsx
      - apps/web/src/components/AppHeader.tsx
    rationale: |
      Covers the visible acceptance criteria (message shown, stay on sign-in page, role name in header, no organization data). Error text follows the UI guidelines voice (says what happened and how to fix it, no blame, sentence case).

tests:
  - |
    AC 1 (signs in). First write `services/records-api/test/unit/sign-in.test.ts` using `buildApp({ identity: fakeIdentity, users: inMemoryUsers, sessions })` and make it fail (route does not exist yet).
    ```ts
    const res = await app.inject({ method: 'POST', url: '/auth/sign-in', payload: { email: 'admin@wfc.test', password: 'correct' } });
    expect(res.statusCode).toBe(200);
    expect(typeof res.json().token).toBe('string');
    const me = await app.inject({ method: 'GET', url: '/me', headers: { authorization: `Bearer ${res.json().token}` } });
    expect(me.statusCode).toBe(200);
    ```
  - |
    AC 2 (recognised as each role). Parameterised with `it.each` over the four roles in the same file, plus a pure test in `test/unit/roles.test.ts`.
    ```ts
    it.each([
      ['wfc_admin', 'WFC Admin'], ['fundraising_consultant', 'Fundraising Consultant'],
      ['org_admin', 'Org Admin'], ['org_staff', 'Org Staff'],
    ])('recognises %s', async (role, label) => {
      const res = await signIn(`${role}@test`, 'correct');
      expect(res.json().user.role).toBe(role);
      expect(res.json().user.roleLabel).toBe(label);
    });
    expect(resolveRole(['org_staff'])).toEqual({ ok: true, role: 'org_staff' });
    ```
  - |
    AC 3 (org user tied to exactly one organization). `test/unit/seed.test.ts` reads `db/seed/001_seed_accounts.sql` and `db/migrations/001_*.sql` as text and asserts the schema ties an account to at most one organization and the seed ties each seeded org-role account (except the deliberate no-org one) to an organization. `test/unit/sign-in.test.ts` asserts the returned user has a single organization object.
    ```ts
    expect(migrationSql).toMatch(/organization_id\s+\S+\s+REFERENCES\s+organizations/i);
    expect(res.json().user.organization).toEqual({ id: 'org-1', name: 'Org One' });
    ```
  - |
    AC 4 (no role, not signed in). In `sign-in.test.ts`, the no-role account with valid credentials gets no session.
    ```ts
    const res = await signIn('norole@test', 'correct');
    expect(res.statusCode).toBe(403);
    expect(res.json().token).toBeUndefined();
    expect(res.json().code).toBe('no_role');
    ```
  - |
    AC 5 (message for no role). Same file, plus a web test in `apps/web/src/pages/SignInPage.test.tsx` with a mocked `fetch` returning that 403.
    ```ts
    expect(res.json().message).toBe('Your account has no role assigned. Contact your administrator.');
    // web
    expect(await screen.findByRole('alert')).toHaveTextContent('Your account has no role assigned. Contact your administrator.');
    ```
  - |
    AC 6 (org account with no organization still signs in). In `sign-in.test.ts` for both `org_admin` and `org_staff` with `organization: null`.
    ```ts
    expect(res.statusCode).toBe(200);
    expect(res.json().user.organization).toBeNull();
    ```
  - |
    AC 7 (no organization data shown). Web test `apps/web/src/components/AppHeader.test.tsx` renders the header for an org account with `organization: null` and, with an organization, asserts it is shown.
    ```ts
    render(<AppHeader user={{ ...orgUser, organization: null }} onSignOut={vi.fn()} />)
    expect(screen.queryByText('Org One')).not.toBeInTheDocument()
    ```
  - |
    AC 8 (role name in the header). Web test, parameterised over the four roles, in `AppHeader.test.tsx`, and an `App.test.tsx` case that signs in through a mocked `fetch` and then sees the label.
    ```ts
    it.each(['WFC Admin', 'Fundraising Consultant', 'Org Admin', 'Org Staff'])('shows %s', (label) => {
      render(<AppHeader user={userWithLabel(label)} onSignOut={vi.fn()} />)
      expect(screen.getByText(label)).toBeInTheDocument()
    })
    ```
  - |
    AC 9 (generic error for invalid credentials). API: the same body for a wrong password and for an unknown email (no account enumeration). Web: the alert shows it.
    ```ts
    const wrong = await signIn('org_admin@test', 'wrong');
    const unknown = await signIn('nobody@test', 'wrong');
    expect(wrong.statusCode).toBe(401);
    expect(wrong.json()).toEqual({ code: 'invalid_credentials', message: 'Incorrect email or password.' });
    expect(unknown.json()).toEqual(wrong.json());
    ```
  - |
    AC 10 (remains on the sign-in page). Web test in `SignInPage.test.tsx` and `App.test.tsx`: after a 401 the sign-in heading is still there and no header appears, and the password field is cleared.
    ```ts
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.')
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
    ```
  - |
    AC 11 (more than one role, not signed in). In `sign-in.test.ts` and `roles.test.ts`.
    ```ts
    const res = await signIn('multirole@test', 'correct');
    expect(res.statusCode).toBe(403);
    expect(res.json().token).toBeUndefined();
    expect(resolveRole(['org_admin', 'org_staff'])).toEqual({ ok: false, reason: 'multiple_roles' });
    ```
  - |
    Supporting API tests (session and adapters, no new AC). `test/unit/session.test.ts` covers an expired token and a token signed with another secret being rejected. `test/unit/require-session.test.ts` covers a user whose roles changed to none or two after sign-in getting 401 on `/me`. `test/unit/entra-identity-provider.test.ts` with an injected `fetch` covers a 400 `invalid_grant` response mapping to `null`. The existing `health.test.ts` must keep passing with `buildApp()` called with no arguments.
    ```ts
    expect((await app.inject({ method: 'GET', url: '/me' })).statusCode).toBe(401);
    expect(await sessions.verify(tokenSignedWithOtherSecret)).toBeNull();
    ```
  - |
    Playwright. Records API e2e `services/records-api/test/e2e/sign-in.spec.ts` runs against the built server with a seeded test database and the fake identity provider selected by `IDENTITY_PROVIDER=fake` (test only). It checks the four roles, no-role, multi-role and invalid credentials end to end. Web e2e `apps/web/e2e/app.spec.ts` is updated: the old "Web App" heading assertion becomes the sign-in page, and a `page.route` mock of `/auth/sign-in` checks that the role label appears after sign-in.
    ```ts
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    await expect(page.getByText('Org Staff')).toBeVisible()
    ```

assumptions_or_open_questions:
  - |
    Who confirms that Entra ID is the sign-in method, and which flow is used? ADR-0004 says all sign-in goes through Entra ID, but the item says the method is still to be confirmed by the identity owner. The ACs describe a credential form on our own sign-in page, so the plan uses a credential exchange with Entra from the Records API (resource owner password flow). Microsoft discourages that flow, and it does not work for accounts with MFA. If the owner confirms a redirect flow (authorization code with PKCE through MSAL), only `EntraIdentityProvider` and the Web App sign-in form change; the role lookup, session and header work stay as planned. This needs a decision before implementation of the Entra adapter.
  - |
    Session length and expiry. Not decided. The plan uses a Records API session token with `SESSION_TTL_SECONDS` defaulting to 3600 (1 hour), no refresh and no sliding expiry. After expiry the user must sign in again. Please confirm or give the number.
  - |
    Seed scope (which environments and how much sample data). Assumed: seed runs in local, test and staging only, never automatically in prod. The seed holds 2 organizations and 8 accounts, enough to cover every acceptance criterion. Seeded accounts need matching users in the Entra tenant for staging; creating those tenant users is outside this repository and is not planned here.
  - |
    Roles and organization membership are stored in the Records database, not read from Entra app-role or group claims. This is assumed from ADR-0011 (role changes audited by the Records API). Please confirm the identity owner does not expect Entra to be the source of roles.
  - |
    An Org Admin or Org Staff account holds at most one organization (single nullable `organization_id` column). Whether a missing organization is a data-entry gap to be fixed later or an intended state is not stated; the story only requires that sign-in succeeds and no organization data is shown.
  - |
    Out of scope per the item and parent epic: organization scoping of Fundraising Consultant section data, the "access denied" screen for another organization's details (project decision, handled in the scoping story), user and role management screens, and audit records (ADR-0011 covers create, update and role change; sign-in is none of these, so no audit write is planned here). The `requireSession` guard is built so the scoping story can reuse it.
  - |
    Browser-to-API origin in deployed environments. ADR-0002 says the Web App calls the REST API directly, so a deployed setup needs either the same origin behind a load balancer path rule or CORS on the API. The plan adds only a Vite dev proxy and a `VITE_API_BASE_URL` setting; deployment routing or CORS configuration is not planned here.
  - |
    Postgres for tests. Unit tests use an in-memory `UserRepository` and need no database. The Records API Playwright e2e needs a reachable PostgreSQL with the migration and seed applied (`DATABASE_URL`); how CI provisions it is not defined in the repository yet, so the e2e spec is skipped when `DATABASE_URL` is unset.

estimated_points: 8

package_dependencies:
  - name: jose
    version: ^6.0.0
    ecosystem: npm
    rationale: Sign and verify the Records API session token (HS256) and verify the Entra ID id_token against the tenant JWKS, without hand-rolling JWT handling.
    component_id: comp_records_api
  - name: pg
    version: ^8.13.0
    ecosystem: npm
    rationale: PostgreSQL client for the user repository and the migrate/seed runner (ADR-0003, Records API is the only database client).
    component_id: comp_records_api
  - name: "@types/pg"
    version: ^8.11.0
    ecosystem: npm
    rationale: Type definitions for pg under strict TypeScript.
    component_id: comp_records_api

notes: |
  ### Data & rollout

  - **Existing data**: the migration only creates new tables (`organizations`, `users`, `user_roles`); no existing table or row is altered. The repository has no database code today (checked `services/records-api/src`), so nothing already stored can be locked out. Because the new `users.organization_id` is nullable, an org account without an organization stays valid and signs in.
  - **Backfill / seed**: no backfill. `db/seed/001_seed_accounts.sql` uses `ON CONFLICT DO NOTHING`, so `pnpm db:seed` is safe to re-run. It runs only in local, test and staging. Real users in prod must be inserted by an operator (user management is a later story); until then no prod user can sign in.
  - **Settings** (documented in a new `services/records-api/.env.example`, no secret values): `DATABASE_URL` (no default; the API refuses to start without it outside tests), `SESSION_SECRET` (no default; startup fails when unset, so a missing secret never means an unsigned token), `SESSION_TTL_SECONDS` (default 3600), `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID` (no defaults; needed only when `IDENTITY_PROVIDER=entra`, the default), `IDENTITY_PROVIDER` (`entra` default; `fake` allowed only when `NODE_ENV` is `test`). Web App: `VITE_API_BASE_URL` (default empty string, same origin).
  - **Provisioning**: an Entra ID app registration for the Records API and matching Entra users for the seeded accounts (staging); the PostgreSQL database on RDS; the `SESSION_SECRET` value in the deployment's secret store. None of these are created by this change.
  - **Order and rollback**: deploy order is migrate, then seed (non-prod), then Records API, then Web App (the Web App calls `/auth/sign-in`, which must exist first). Rollback: the new tables are unused by any other code, so they can stay in place; redeploying the previous API and Web App versions removes the feature. A `down` is not provided because the migration is purely additive.

  The task list expects a test that existing rows stay readable after a migration; none applies here because no existing rows are changed.

  ### Design notes

  Design system loading: `apps/web/design/tokens.css` and `prototype-utils.css` are not loaded by the app today (`apps/web/src/index.css` holds only `@import "tailwindcss"`; `apps/web/src/main.tsx` line 3 imports it; `apps/web/vite.config.ts` uses `@tailwindcss/vite`, with no theme mapping). The scope item for `index.css` adds the two imports once. `tokens.json` was not opened because `tokens.css` carries the names. No approved prototype for the sign-in page was given; the layout follows `apps/web/design/app-shell.html` and `UI-GUIDELINES.md` (form controls in `.field`, one `.btn-primary`, `.alert` for page-level problems, buttons are verb plus object).

  ```mermaid
  flowchart TD
    Server[server.ts] --> App[app.ts buildApp]
    App --> Health[routes/health.ts]
    App --> AuthRoutes[routes/auth.ts]
    AuthRoutes --> IdP[auth/identity-provider.ts]
    IdP --> Entra[auth/entra-identity-provider.ts]
    AuthRoutes --> Roles[auth/roles.ts]
    AuthRoutes --> Sess[auth/session.ts]
    AuthRoutes --> Guard[auth/require-session.ts]
    Guard --> Repo[auth/user-repository.ts]
    AuthRoutes --> Repo
    Repo --> PgRepo[auth/pg-user-repository.ts]
    PgRepo --> DB[(PostgreSQL migration and seed)]
    WebMain[web main.tsx] --> WebApp[web App.tsx]
    WebApp --> SignIn[pages/SignInPage.tsx]
    WebApp --> Header[components/AppHeader.tsx]
    WebApp --> AuthCtx[auth/AuthContext.tsx]
    AuthCtx --> WebApi[auth/api.ts]
    WebApi -->|POST /auth/sign-in, GET /me| AuthRoutes
    classDef touched fill:#f96,color:#000
    class App,AuthRoutes,IdP,Entra,Roles,Sess,Guard,Repo,PgRepo,Server,WebApp,SignIn,Header,AuthCtx,WebApi,WebMain,DB touched
  ```

  Touched nodes: `app.ts` and `server.ts` for wiring; the `auth/` modules and `routes/auth.ts` are new; `health.ts` is untouched context. In the Web App, `App.tsx` and `main.tsx` change and the rest are new.

review_focus: |
  IN scope: credential sign-in, exactly-one-of-four role recognition, the role label in the header, the no-organization case, and the seeded data to test them. OUT: organization scoping of other endpoints and screens, access-denied pages, user and role management, audit writes. Riskiest areas: the role rule (none or more than one gives no session, checked after credentials so the response never leaks account state) and `requireSession` reloading roles from the database on every request. Deliberate choices: roles and organization live in the Records database, the Entra adapter sits behind a port because the sign-in flow is unconfirmed, and bad-credential and unknown-account responses are identical.
