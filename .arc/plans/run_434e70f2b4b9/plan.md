summary: |
  Providers get a profile that customers can read (display name, approved photo, approved short bio), a provider-only edit screen, and an admin review screen. The display name is live at once. A new photo or bio is stored as a single pending submission beside the approved version; customers keep seeing the approved one until an admin approves (swap in) or rejects (discard). A newer submission replaces an unreviewed one. Licence and insurance documents are uploaded by the provider, kept one-per-type (newest wins), and returned only to admins, who see each one marked "Awaiting review" (AC 3). The work is a Records API slice (Fastify routes, a profile store, audit records) and three React screens in the Web App that follow the approved design (Provider profile, Edit my profile, Review profile changes), all built test-first.
scope:
  - description: |
      Profile domain types and store (TDD: written against the store unit tests first). In-memory implementation behind an interface (see open questions on PostgreSQL).
      ```ts
      export type DocType = 'licence' | 'insurance';
      export interface Submission { bio?: string; photo?: StoredFile; submittedAt: string }
      export interface ProviderProfile {
        id: string; displayName: string;
        approvedBio?: string; approvedPhoto?: StoredFile; pending?: Submission;
        documents: Partial<Record<DocType, StoredFile & { uploadedAt: string }>>;
      }
      export interface ProfileStore {
        getProfile(id: string): ProviderProfile | undefined;
        setDisplayName(id: string, name: string, actor: Actor): void;
        submitChange(id: string, s: { bio?: string; photo?: StoredFile }, actor: Actor): void; // replaces any pending
        resolvePending(id: string, decision: 'approve' | 'reject', actor: Actor): void;
        putDocument(id: string, type: DocType, file: StoredFile, actor: Actor): void; // replaces same type
        audit(): AuditRecord[]; // ADR-0011: { actorId, action, providerId, at }
      }
      ```
      Every mutating method appends an audit record with actor and time (ADR-0011).
    files:
      - services/records-api/src/profiles/types.ts
      - services/records-api/src/profiles/store.ts
      - services/records-api/test/unit/profile-store.test.ts
    rationale: |
      Holds the review rules (approved vs pending, replace-on-resubmit, one document per type) in one place so every AC is covered by fast unit tests. Only the Records API touches data (ADR-0001, ADR-0003).
  - description: |
      Actor seam and routes. `buildApp(deps?: { store?: ProfileStore })` registers `profileRoutes`. Actor is read from headers `x-actor-id` and `x-actor-role` (`provider` or `admin`); missing means 401, wrong role means 403. Stand-in until the Entra ID sign-in story (ADR-0004); routes depend only on `request.actor`.
      Routes:
      - `GET /providers/:id` public, returns `{ id, displayName, photoUrl?, bio? }` built only from approved fields, never from documents or pending data. Unknown id gives 404.
      - `GET /providers/:id/photo` public, approved photo bytes (404 when none).
      - `GET /me/profile` provider, live, pending and document metadata for the signed-in provider.
      - `PUT /me/profile/display-name` provider, body `{ displayName }`, 1-80 chars.
      - `POST /me/profile/submissions` provider, multipart (`bio` max 300 chars, optional `photo` JPG/PNG up to 5 MB). At least one of the two. Returns 202.
      - `POST /me/documents` provider, multipart (`type`, `file` PDF/JPG/PNG up to 10 MB). Returns 201, or 400 with a message naming the file and allowed types.
      - `GET /admin/providers/:id/review` admin, returns `documents` (latest per type, each `{ type, fileName, uploadedAt, status: 'awaiting-review' }`), the live version and the one pending submission. `status` is `'awaiting-review'` for every document, because no document approval step exists in this story (AC 3).
      - `GET /admin/providers/:id/documents/:type` admin, file bytes. `GET /admin/providers/:id/submission/photo` admin, pending photo bytes.
      - `POST /admin/providers/:id/submission/approve` and `.../reject` admin; 409 when nothing is pending.
    files:
      - services/records-api/src/app.ts
      - services/records-api/src/auth/actor.ts
      - services/records-api/src/routes/profiles.ts
      - services/records-api/test/unit/profile-routes.test.ts
      - services/records-api/package.json
    rationale: |
      Customer, provider and admin surfaces are separate routes so the document-visibility rule is structural: the public route has no code path that reads documents. `app.ts` follows the existing `buildApp()` plus `app.register(...)` pattern. `package.json` gains `@fastify/multipart`.
  - description: |
      Playwright API e2e covering the full journey over HTTP (provider uploads and submits, customer sees the previous version, admin sees the document marked awaiting review, admin approves or rejects). Follows test/e2e/health.spec.ts using the `request` fixture. Check services/records-api/playwright.config.ts for how the server starts; if a seed provider is needed, add a helper in `store.ts` called from `server.ts` that is a no-op unless an env var such as `SEED_PROVIDER` is set.
    files:
      - services/records-api/test/e2e/profiles.spec.ts
      - services/records-api/src/server.ts
    rationale: |
      Confirms cross-role behaviour against the real running process.
  - description: |
      Web App: load the design system once. In `apps/web/src/index.css` (imported by `main.tsx`, currently only `@import "tailwindcss";`) add, after the Tailwind import, `@import "../design/tokens.css";` and `@import "../design/prototype-utils.css";`. The second file defines the design system's own component classes (`.card`, `.btn`, `.btn-primary`, `.btn-secondary`, `.badge-*`, `.alert-*`, `.skeleton`, `.empty-state`, `.table`, `.table-wrap`, `.field`, `.field-hint`, `.field-error`, `.is-invalid`, `.toast`, stack helpers), built only from the tokens. Pages use those classes plus Tailwind utilities over token variables (for example `p-[var(--space-3)]`). The design's own page-level pieces (`.photo`, `.compare`, `.profile`, `.profile-body`, `.page-head`, `.form-actions`, `.section-gap`, `.doc-name`) are defined only in the prototype's inline style, so define them in `index.css` on the same tokens. No hex, rgb or raw px value a token covers.
    files:
      - apps/web/src/index.css
    rationale: |
      The app loads neither file today (index.css holds only the Tailwind import and vite.config.ts has no token mapping). Verified that prototype-utils.css defines the classes the design uses (37 matches for card, badge, btn, alert, skeleton, empty-state, table, field rules). Builder should check on first run that its global element rules (body, h1-h3 sizes) do not clash with Tailwind preflight.
  - description: |
      Web App API client and routing. `src/api/profiles.ts` wraps `fetch` for the routes above (base URL from `import.meta.env.VITE_RECORDS_API_URL`, default `http://localhost:8011`, matching `server.ts`), sending `x-actor-id` and `x-actor-role` from a small `src/session.ts` stand-in. `App.tsx` switches on `location.hash` (`#/providers/:id`, `#/account/profile`, `#/admin/providers/:id/review`) with no new router dependency. Shell per the guidelines: top bar Records, Reports, Settings, Account; the edit screen sits under Account and the review screen under Settings (the design's `data-nav`), collapsing behind a Menu button below the tablet breakpoint (md).
    files:
      - apps/web/src/api/profiles.ts
      - apps/web/src/session.ts
      - apps/web/src/App.tsx
      - apps/web/src/App.test.tsx
    rationale: |
      Keeps the Web App talking only to the Records API (ADR-0001, ADR-0002). The existing App test expects the heading "Web App"; update it to the new shell.
  - description: |
      Screen 1, Provider profile (customer): `ProviderProfilePage`. `h1` "Provider profile", a `.card` with the photo (only when `photoUrl` exists), the display name as `h2` and the bio (only when it exists). Nothing about documents or review. States: loading (`.skeleton` photo and two blocks, `aria-busy`), error (`.alert` "This profile did not load. Check your connection and try again." with a "Try again" `.btn-secondary`), name-only (no photo element, no empty bio). Tokens: `--color-bg`, `--color-border`, `--radius-lg`, `--space-3`, `--space-4`, `--font-size-xl`, `--font-size-lg`, `--color-fg`, `--color-fg-muted`, `--color-bg-subtle`, `--color-danger-bg`, `--color-danger-hover`, `--avatar-size`. The design's "Book this provider" button is out of scope and not built.
    files:
      - apps/web/src/pages/ProviderProfilePage.tsx
      - apps/web/src/pages/ProviderProfilePage.test.tsx
    rationale: |
      Delivers AC 1, 2, 5, 8, 9, 10 on the customer side.
  - description: |
      Screen 2, Edit my profile (provider): `EditProfilePage`. Sections in design order: display name form ("Save display name", `.btn-secondary`, success `.toast` "Display name saved. Customers see it now."); when a submission is pending an info `.alert` plus a two-card compare "Live for customers" (`.badge-success` "Approved") and "Submitted <date>" (`.badge-warning` "Awaiting review"); photo and bio form (file input accept `image/png,image/jpeg`, textarea max 300, one `.btn-primary` "Submit for review", on resubmission a success banner "Your newer bio was submitted. It replaces the earlier submission, so admins review only this one."); documents section with a `.table` (Type, File, Uploaded; newest per type only), a form (Document type select Licence/Insurance, file input accept `.pdf,image/png,image/jpeg`, primary "Upload document"), success banner, inline `.field-error` with `.is-invalid` for an unsupported file, and an `.empty-state` "No documents uploaded" with a primary "Upload document". Loading uses `.skeleton`. Every control sits in a `.field` with label and `.field-hint`. Extra tokens: `--color-success-bg`, `--color-success-fg`, `--color-warning-bg`, `--color-warning-fg`, `--color-info-bg`, `--color-info-fg`, `--color-border-strong`, `--color-primary`, `--color-on-primary`, `--control-height`, `--radius-md`, `--space-1`, `--space-2`.
    files:
      - apps/web/src/pages/EditProfilePage.tsx
      - apps/web/src/pages/EditProfilePage.test.tsx
    rationale: |
      Delivers AC 4, 5, 8, 11, 12 on the provider side.
  - description: |
      Screen 3, Review profile changes (admin): `ReviewProfilePage`. `h1` is the provider display name, with "Review profile changes" beneath. Documents `.table` (Type, File, Uploaded, Status, Action). The design's table has no status column, but AC 3 says the document is "shown marked as awaiting review", so add a Status column holding a `.badge-warning` "Awaiting review" on every row (same badge as the compare cards; tokens `--color-warning-bg`, `--color-warning-fg`). This is a deliberate addition to the design; see open questions. The Action cell holds a `.btn-secondary` "View" with `aria-label` "View Licence file" and so on, opening the admin-only file route. Then the note "Only the newest document of each type is shown.", then "Photo and bio awaiting review" with the live-versus-submitted compare and "Reject change" (secondary) and "Approve change" (primary). After approve an `.alert-success` "Change approved. Customers now see the new photo and bio in place of the previous ones."; after reject an `.alert-warning` "Change rejected. Customers keep seeing the previous photo and bio."; with nothing pending an `.empty-state` "Nothing to review". Loading uses `.skeleton`.
    files:
      - apps/web/src/pages/ReviewProfilePage.tsx
      - apps/web/src/pages/ReviewProfilePage.test.tsx
    rationale: |
      Delivers AC 3, 6, 7, 11, 12 on the admin side. The wider Admin Console belongs to its own epic.
  - description: |
      Shared presentational pieces used by the pages: `ProfileCompare` (live card and submitted card with badges), `DocumentsTable` (with an optional `showStatus` prop, true on the admin screen), `Banner`. Create them while building the screens, not ahead of them.
    files:
      - apps/web/src/components/ProfileCompare.tsx
      - apps/web/src/components/DocumentsTable.tsx
      - apps/web/src/components/Banner.tsx
    rationale: |
      The compare and documents table appear on both the edit and review screens in the design, so they are shared.
tests:
  - |
    AC1 (profile-routes.test.ts), write first, fails until the route exists:
    ```ts
    const res = await app.inject({ method: 'GET', url: '/providers/p1' });
    expect(res.json()).toMatchObject({ displayName: 'Whitfield Plumbing and Heating', bio: 'Approved bio', photoUrl: '/providers/p1/photo' });
    ```
    Web: `render(<ProviderProfilePage />)` with a mocked fetch, then `expect(screen.getByRole('heading', { name: 'Whitfield Plumbing and Heating' })).toBeInTheDocument()`, `expect(screen.getByRole('img')).toBeInTheDocument()`, `expect(screen.getByText('Approved bio')).toBeInTheDocument()`.
  - |
    AC2 provider has a licence and an insurance document, customer fetches the profile:
    ```ts
    const body = JSON.stringify((await app.inject({ method: 'GET', url: '/providers/p1' })).json());
    expect(body).not.toMatch(/licence|insurance|gas-safe/i);
    expect(Object.keys(res.json()).sort()).toEqual(['bio', 'displayName', 'id', 'photoUrl']);
    ```
    Also `GET /admin/providers/p1/documents/licence` with no actor returns 401 and with `x-actor-role: provider` returns 403.
  - |
    AC3 admin sees the document marked awaiting review. Route and screen:
    ```ts
    const res = await app.inject({ method: 'GET', url: '/admin/providers/p1/review', headers: admin });
    expect(res.json().documents).toEqual([expect.objectContaining({ type: 'licence', fileName: 'licence.pdf', status: 'awaiting-review' })]);
    ```
    Web (`ReviewProfilePage.test.tsx`):
    ```ts
    expect(await screen.findByText('licence.pdf')).toBeInTheDocument();
    const row = screen.getByText('licence.pdf').closest('tr')!;
    expect(within(row).getByText('Awaiting review')).toBeInTheDocument();
    ```
  - |
    AC4 provider upload accepted (routes, using a multipart body helper in the test) plus the web form:
    ```ts
    const res = await app.inject({ method: 'POST', url: '/me/documents', headers: { ...provider, ...form.getHeaders() }, payload: form });
    expect(res.statusCode).toBe(201);
    ```
    Also a 400 for `.tiff` with a message containing "is not a supported file". Web: `userEvent.upload(screen.getByLabelText('File'), file)`, click "Upload document", expect the success banner; the error case shows the `.field-error` text.
  - |
    AC5 (store and route): after `store.submitChange('p1', { bio: 'New bio' }, provider)`:
    ```ts
    expect((await app.inject({ method: 'GET', url: '/providers/p1' })).json().bio).toBe('Approved bio');
    ```
    Web edit page: pending banner and both compare cards render ("Live for customers", "Awaiting review").
  - |
    AC6 approve swaps the live version:
    ```ts
    await app.inject({ method: 'POST', url: '/admin/providers/p1/submission/approve', headers: admin });
    expect((await app.inject({ method: 'GET', url: '/providers/p1' })).json().bio).toBe('New bio');
    expect(store.getProfile('p1')!.pending).toBeUndefined();
    ```
    Web: clicking "Approve change" calls the approve endpoint and shows "Change approved." Approve with nothing pending returns 409.
  - |
    AC7 reject keeps the previous version:
    ```ts
    await app.inject({ method: 'POST', url: '/admin/providers/p1/submission/reject', headers: admin });
    expect((await app.inject({ method: 'GET', url: '/providers/p1' })).json().bio).toBe('Approved bio');
    expect(store.getProfile('p1')!.pending).toBeUndefined();
    ```
    Web: "Change rejected." banner.
  - |
    AC8 display name is live and unreviewed:
    ```ts
    await app.inject({ method: 'PUT', url: '/me/profile/display-name', headers: provider, payload: { displayName: 'New Name' } });
    expect((await app.inject({ method: 'GET', url: '/providers/p1' })).json().displayName).toBe('New Name');
    ```
    An empty name returns 400.
  - |
    AC9 and AC10 provider with only a display name:
    ```ts
    const body = (await app.inject({ method: 'GET', url: '/providers/p2' })).json();
    expect(body.displayName).toBe('Okafor Electrical');
    expect(body).not.toHaveProperty('photoUrl');
    expect(body).not.toHaveProperty('bio');
    ```
    Web: `expect(screen.queryByRole('img')).not.toBeInTheDocument()` and no bio paragraph; `GET /providers/p2/photo` returns 404.
  - |
    AC11 newer document of the same type replaces the older (store test, then route and web):
    ```ts
    store.putDocument('p1', 'licence', file('old.pdf'), provider);
    store.putDocument('p1', 'licence', file('new.pdf'), provider);
    expect(Object.values(store.getProfile('p1')!.documents).map((d) => d.fileName)).toEqual(['new.pdf']);
    ```
    The admin review route returns exactly one licence entry, `new.pdf`, still with `status: 'awaiting-review'`; an insurance document uploaded earlier is untouched.
  - |
    AC12 second submission replaces the first:
    ```ts
    store.submitChange('p1', { bio: 'first' }, provider);
    store.submitChange('p1', { bio: 'second' }, provider);
    expect(store.getProfile('p1')!.pending?.bio).toBe('second');
    expect((await app.inject({ method: 'GET', url: '/admin/providers/p1/review', headers: admin })).json().pending.bio).toBe('second');
    ```
    Web edit page shows the "Your newer bio was submitted" banner after resubmitting.
  - |
    ADR-0011 audit, every mutation writes a record:
    ```ts
    store.setDisplayName('p1', 'X', provider);
    expect(store.audit().at(-1)).toMatchObject({ actorId: provider.id, action: 'display-name.updated', providerId: 'p1' });
    ```
    Also for submit, approve, reject and document upload.
  - |
    End to end (test/e2e/profiles.spec.ts, `pnpm e2e`): provider uploads a licence, submits a bio, customer GET shows the old bio, admin review shows the licence with status awaiting-review, admin approves, customer GET shows the new bio and still no document fields. Builder's first verification step: run `(cd services/records-api && pnpm test)` and `(cd apps/web && pnpm test)` on the untouched branch to confirm a green baseline, and note whether the e2e config can start the server.
assumptions_or_open_questions:
  - |
    Design gap on AC 3 (needs the reviewer). The approved design's admin Documents table (Type, File, Uploaded, Action) shows no "awaiting review" mark, but AC 3 requires the document to be "shown marked as awaiting review". The plan adds a Status column with a warning badge "Awaiting review" on every document row, reusing the badge from the design's compare cards. Confirm this, or have the design updated.
  - |
    Because no document approval step exists in this story, every uploaded document stays "awaiting review"; there is no approve or reject action for documents and no other document status. Admins can only view documents; documents do not block a provider from being shown. Mandatory documents and the admin vetting process are still undecided (carried from the earlier agreed decision).
  - |
    Styling (changed from the earlier agreement). Earlier the reviewer agreed to rebuild the prototype component classes as Tailwind utilities. This run's rule is to import a design-folder stylesheet that defines the classes, and apps/web/design/prototype-utils.css does, so the plan imports it next to tokens.css in index.css and uses the classes; Tailwind utilities over tokens are used for the rest. Confirm this is acceptable. The "WP" initials are a prototype stand-in; production shows the uploaded image or no photo (agreed).
  - |
    Persistence (agreed earlier). The Records API has no database layer (only the health route; no pg dependency, migrations or schema under services/records-api). Persistence goes through the `ProfileStore` interface with an in-memory implementation. PostgreSQL and object storage are out of scope; including them would likely raise the estimate to 13 points. ADR-0003 is met by a follow-up story.
  - |
    Sign-in (agreed earlier). Entra ID (ADR-0004) is not available. Roles are read from `x-actor-id` and `x-actor-role` headers in `src/auth/actor.ts` as a temporary stand-in. This is not secure and must not be used in production; the sign-in story replaces it before release.
  - |
    Uploaded files (photo, documents) are held in memory with name, content type and size. Real object storage (single AWS region, encrypted, ADR-0010) belongs to the out-of-scope persistence follow-up.
  - |
    Retention (agreed earlier). How long licence and insurance documents are kept, including after a provider is removed or suspended, is undefined. No retention or deletion logic is built; only the latest document per type is stored. Project-wide payment, booking and dispute retention is outside this story. The retention requirement is to be tracked as a follow-up item.
  - |
    Submission handling (agreed earlier). A submission holds a bio and/or a photo; submitting again replaces the whole pending submission (AC 12). The edit form pre-populates the bio with the pending text, or the live text when nothing is pending, so resubmitting a photo does not drop a pending bio.
  - |
    Limits (agreed earlier). Display name up to 80 characters, bio up to 300, photo JPG/PNG up to 5 MB, documents PDF/JPG/PNG up to 10 MB.
  - |
    Design items excluded (agreed earlier). "Book this provider" (booking is a separate story) and a list of providers with pending changes (Admin Console epic). Also not built: the other nav destinations (Records and Reports stay inert links) and the design's `proto-note` blocks, which are prototype annotations.
  - |
    Admin screen reachability (agreed earlier). The review screen is addressed by provider id in the hash route; there is no review list. The design's "Back to the review list" button goes to the same page's empty state until the Admin Console epic builds the list.
estimated_points: 8
package_dependencies:
  - name: "@fastify/multipart"
    version: "^9.0.0"
    ecosystem: npm
    component_id: comp_records_api
    rationale: Parses multipart uploads for photo, bio and document submissions with size and type limits. Not currently a dependency of services/records-api (package.json lists only fastify).
notes: |
  ### Data & rollout
  - **Existing data**: None — no database or stored profile data exists today; the store is in-memory and starts empty (or with an optional dev seed).
  - **Backfill / seed**: None required. A dev-only seed provider may be added in `server.ts`, guarded by an env var, idempotent.
  - **Settings**: `VITE_RECORDS_API_URL` for the Web App (default `http://localhost:8011`, matching the `PORT` default in server.ts). Document it in a comment in `apps/web/src/api/profiles.ts`. Optional `SEED_PROVIDER` for the API, off when unset.
  - **Provisioning**: none for this slice; object storage and a PostgreSQL schema are needed once persistence is settled.
  - **Order and rollback**: additive routes and screens only; roll back by reverting. No migration.

  Design: `/opt/bnts-arc/home/sdlc/bounteous/proj_1cb98ef2/items/TETSING-19-NOV-STORY-018/runs/run_434e70f2b4b9/designs/TETSING-19-NOV-STORY-018/TETSING-19-NOV-STORY-018-design.html`, three screens: Provider profile, Edit my profile, Review profile changes. Tokens are in `apps/web/design/tokens.css`; component classes in `apps/web/design/prototype-utils.css`. Neither is imported by the app today (index.css has only the Tailwind import), hence the scope item that adds both imports.

  Existing test setup: records-api vitest includes `test/unit/**/*.test.ts` only; Playwright API tests live in `test/e2e`. Web vitest includes `src/**/*.test.{ts,tsx}` with jsdom and globals, so page tests sit next to the pages.

  ```mermaid
  flowchart TD
    server[server.ts] --> app[app.ts buildApp]
    app --> health[routes/health.ts]
    app --> profiles[routes/profiles.ts]
    profiles --> actor[auth/actor.ts]
    profiles --> store[profiles/store.ts]
    main[main.tsx] --> css[index.css design imports]
    main --> appTsx[App.tsx hash routes]
    appTsx --> pages[pages: Provider, Edit, Review]
    pages --> client[api/profiles.ts]
    client -->|HTTP| profiles
    classDef touched fill:#f96,color:#000
    class app,profiles,actor,store,css,appTsx,pages,client touched
  ```
review_focus: |
  IN: the three design screens, the Records API routes, and the pending-versus-approved rules for the 12 ACs, including the "Awaiting review" mark on admin-visible documents (AC 3, a deliberate addition to the design). OUT: PostgreSQL, object storage, real Entra ID sign-in, document retention and vetting, booking, and the wider Admin Console. Riskiest part is the customer route leaking documents or pending data, so check that `GET /providers/:id` builds its response only from approved fields. The header-based actor and in-memory store are deliberate stand-ins listed as open questions.
