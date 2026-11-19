summary: |
  Charge the customer for a booking once the provider confirms it, at the price shown at booking (fixed price, or hourly rate x service duration), and charge no one when a request is declined or expires. A declined or failed payment keeps the booking confirmed and shows a clear error with "Try payment again" and "Use another payment method"; a confirmed booking still unpaid 24 hours after confirmation is auto-cancelled, the customer is emailed (Amazon SES, per ADR-0009) and the in-app list shows it as cancelled. The payment service is not chosen, so everything is built against a stand-in `PaymentGateway` port; card details never reach the platform (the web app only ever sends an opaque payment token). Work spans the Records API (amount calculation, confirm/decline/expire/pay transitions, 24-hour sweeper, email, audit) and the Web App (My bookings list and Pay booking screens from the approved prototype).
scope:
  - description: |
      Records API money rules. New pure function in `src/payments/money.ts`:

      ```ts
      export type Pricing =
        | { kind: 'fixed'; priceMinor: number }
        | { kind: 'hourly'; rateMinor: number; durationMinutes: number };
      export function computeAmountDueMinor(pricing: Pricing): number;
      ```
      Amounts are integer minor units (cents); hourly = round half up of `rateMinor * durationMinutes / 60`. The server always recomputes the amount from the stored booking pricing and never trusts a client-sent amount.
    files:
      - services/records-api/src/payments/money.ts
      - services/records-api/test/unit/money.test.ts
    rationale: |
      Covers AC2 and AC3 in isolation so they are testable without HTTP.
  - description: |
      Ports and stand-ins, all injected into `buildApp` so tests swap them:
      - `PaymentGateway` (`charge({ amountMinor, currency, paymentToken, idempotencyKey }): Promise<{ status: 'succeeded'; chargeId: string } | { status: 'declined' | 'failed'; reason: string }>`) with a `StubPaymentGateway` (default; a token such as `tok_decline` yields declined, `tok_error` yields failed, anything else succeeds). The real provider adapter is a later change once a service is chosen.
      - `Mailer` (`sendBookingCancelledForUnpaid(to, booking)`) with a `SesMailer` (Amazon SES, ADR-0009) and a recording `FakeMailer` for tests.
      - `BookingRepository` (find by id, list by customer, save with a compare-and-set on status) with an `InMemoryBookingRepository`.
      - `AuditLog` (`record({ actor, action, bookingId, at })`) so each status change and charge attempt is audited with actor and time (ADR-0011).
      - `Clock` (`now(): Date`) so the 24-hour rule is testable.
    files:
      - services/records-api/src/payments/types.ts
      - services/records-api/src/payments/gateway.ts
      - services/records-api/src/payments/mailer.ts
      - services/records-api/src/payments/booking-repository.ts
      - services/records-api/src/payments/audit.ts
      - services/records-api/src/payments/clock.ts
    rationale: |
      The payment service is undecided (settled decision: build against a stand-in charge interface). Booking & Scheduling code does not exist in the repo yet (no "booking" match outside node_modules), so the repository port is the seam where that story's data plugs in.
  - description: |
      Payment service with the booking transitions this story relies on:
      - `confirmBooking(id, providerId)`: moves `requested` to `confirmed_payment_due`, stores `confirmedAt`, `payBy = confirmedAt + 24h` and `amountDueMinor` (from `computeAmountDueMinor`). No gateway call here.
      - `declineBooking(id, providerId)` and `expireRequest(id)`: move `requested` to `declined` / `expired`; never call the gateway (AC4, same rule for both).
      - `payBooking(id, customerId, paymentToken)`: only from `confirmed_payment_due` and before `payBy`; calls `gateway.charge` with `idempotencyKey = booking id`; success moves to `paid`; declined/failed leaves the booking `confirmed_payment_due` and returns a typed error with a customer-facing message (AC5).
      - `cancelUnpaidBookings(now)`: every booking in `confirmed_payment_due` with `now >= payBy` moves to `cancelled` with `cancelReason: 'payment_timeout'`, then the `Mailer` is called once per booking (AC8, AC9).
      Status changes use a compare-and-set on the previous status so a payment racing the sweeper cannot both succeed and cancel.
    files:
      - services/records-api/src/payments/payment-service.ts
      - services/records-api/test/unit/payment-service.test.ts
    rationale: |
      Core of AC1 to AC9. The confirm/decline/expire entry points are thin because Booking & Scheduling owns those transitions; they are the functions that story's routes call.
  - description: |
      HTTP routes, registered from `buildApp`, following the `healthRoutes` plugin pattern in `src/routes/health.ts`:
      - `GET /bookings` returns the signed-in customer's bookings: `{ id, serviceName, providerName, status, pricing, amountDueMinor, currency, payBy, cancelReason, cancelledAt }`.
      - `POST /bookings/:id/confirm` and `POST /bookings/:id/decline` (provider actions; thin wrappers over the service).
      - `POST /bookings/:id/pay` with JSON schema `{ paymentToken: string }` and `additionalProperties: false`, so a body carrying card number, expiry or CVC is rejected with 400 (AC11). Responses: 200 `{ status: 'paid' }`; 402 `{ error: { code: 'payment_declined' | 'payment_failed', message } }`; 409 when not payable; 410 when past the deadline.
      `buildApp` changes from `buildApp(): FastifyInstance` to `buildApp(deps?: Partial<AppDeps>): FastifyInstance`, defaulting to the stub gateway, in-memory repository and SES mailer, so `health.test.ts` keeps passing unchanged.
    files:
      - services/records-api/src/routes/bookings.ts
      - services/records-api/src/app.ts
      - services/records-api/test/unit/bookings-routes.test.ts
    rationale: |
      The Web App talks to data only through the Records API (ADR-0001, ADR-0002), so the list and pay screens need these endpoints.
  - description: |
      24-hour sweeper: `startUnpaidBookingSweeper(service, clock, intervalMs)` runs `cancelUnpaidBookings` on a timer and returns a stop function; `server.ts` starts it after `listen` and stops it on close. `GET /bookings` also runs the same cancellation check for the caller's bookings before listing, so the list never shows an overdue booking as payable even between sweeps.
    files:
      - services/records-api/src/jobs/unpaid-booking-sweeper.ts
      - services/records-api/src/server.ts
      - services/records-api/test/unit/unpaid-booking-sweeper.test.ts
    rationale: |
      AC8 needs something that acts without a user request at the 24-hour mark.
  - description: |
      Web App: load the design system once. In `apps/web/src/index.css`, after `@import "tailwindcss";`, add `@import "../design/tokens.css";` and `@import "../design/prototype-utils.css";`. Today `index.css` holds only the Tailwind import and nothing in `src/`, `vite.config.ts` or `index.html` references the tokens (grep for tokens and prototype-utils found no match), so none of the design tokens or component classes (`.btn-primary`, `.card`, `.badge-warning`, `.alert-danger`, `.empty-state`, `.skeleton`, `.field`, `.input`) are loaded yet.
      The prototype's own inline classes are not in any design file, so define them in a new `payments.css` using the same tokens and import it from the feature: `.booking-list`, `.card-title-row`, `.amount-row`, `.amount-total`, `.field-pair`, `.secure-note`, `.page-head`, `.pay-page`. Tokens used: `--space-1/2/3`, `--font-size-lg`, `--font-size-sm`, `--color-fg-muted`, `--check-size`, `--toast-width`, `--z-overlay`, `--color-fg`, `--color-bg`, `--radius-md`. No colour or pixel literals.
    files:
      - apps/web/src/index.css
      - apps/web/src/features/payments/payments.css
    rationale: |
      UI guidelines require styling only with design tokens, and a class may only be named if a loaded stylesheet defines it.
  - description: |
      Web App shell and money formatting. Replace the placeholder `App.tsx` ("Web App" heading) with the prototype's shell: header with brand "Records", a Menu toggle below the tablet breakpoint (48em), nav links Records, Reports, Settings, Account (`data-nav-key`), `main` inside `.shell-main`, footer with Help and Privacy. Records is the current page; the bookings list lives under Records and Pay booking is a detail view of it (no new top-level nav item). The shell classes (`.shell`, `.shell-header`, `.shell-nav`, `.shell-link`, `.shell-toggle`, `.shell-main`, `.shell-footer`) are inline in the prototype and also in `apps/web/design/app-shell.html`; define them in `apps/web/src/shell.css` on the same tokens (`--tap-target`, `--space-*`, `--color-info-bg`, `--color-info-fg`, `--color-border`, `--content-max-width`). View switching is plain component state (no router dependency).
      Add `formatMoney(amountMinor: number, currency: string): string` using `Intl.NumberFormat` (design sample shows `$120.00`).
    files:
      - apps/web/src/App.tsx
      - apps/web/src/App.test.tsx
      - apps/web/src/shell.css
      - apps/web/src/lib/money.ts
      - apps/web/src/lib/money.test.ts
    rationale: |
      The approved design places both screens inside the top-bar shell. `App.test.tsx` currently asserts the "Web App" heading and must be updated to the new shell.
  - description: |
      My bookings screen (prototype screen "My bookings"): `h1` "My bookings"; `ul.booking-list` of `.card` items, each with `.card-title-row` (service name in `strong`, status `.badge`). Confirmed-payment-due: `.badge-warning` "Confirmed, payment due", text "Confirmed by {provider} · Fixed price $120.00 | $40.00/h · Pay within 24 hours" and a single `.btn-primary` "Pay now". Declined/expired: `.badge-neutral` "Declined" with "Provider declined this request. No charge was made." Auto-cancelled: `.badge-danger` "Cancelled" with "Cancelled because payment was not completed within 24 hours. No charge was made." For a recently auto-cancelled booking, an `.alert.alert-warning` (role status) above the list: "Your {service} booking was cancelled because payment was not completed within 24 hours. We emailed you a cancellation notice." States beyond the prototype's three: loading uses `.skeleton` lines; a load failure uses `.alert-danger` with a "Reload bookings" `.btn-secondary`; empty uses `.empty-state` with text "No bookings yet. Requests you send appear here, and you pay only once a provider confirms." and a `.btn-primary` "Browse services".
      API client `src/api/bookings.ts`: `listBookings()`, `payBooking(id, paymentToken)` calling the Records API only; the base URL comes from `import.meta.env.VITE_RECORDS_API_URL`.
    files:
      - apps/web/src/features/payments/MyBookingsPage.tsx
      - apps/web/src/features/payments/MyBookingsPage.test.tsx
      - apps/web/src/api/bookings.ts
    rationale: |
      Covers AC4, AC8 and AC10 from the customer's side, with the data coming from `GET /bookings` instead of the prototype's inline sample data.
  - description: |
      Pay booking screen (prototype screen "Pay booking"): `.page-head` with `h1` "Pay for {service}" and a `.btn-ghost` "Back to my bookings" with the arrow-left icon; intro text "{provider} confirmed your booking. Pay now to complete it. Unpaid bookings are cancelled 24 hours after confirmation." A summary `.card` of `.amount-row`s: fixed shows "Price shown at booking (fixed)" and the amount; hourly shows "Hourly rate", "Service duration" and "Amount to charge ($40.00 x 2.5 h)". The amount shown is the server's `amountDueMinor`, not recomputed in the browser. Below it, a card with the payment-service entry area and a `.btn-primary` "Pay $120.00", then the `.secure-note` text "Card details are entered in the secure form of our payment service. We do not store them."
      Card entry sits behind a `PaymentMethodCollector` component contract: `onToken(token: string)`. The stand-in renders the prototype's three `.field`/`.input` controls (Card number, Expiry, Security code) as uncontrolled inputs inside the component, never lifts their values into app state, never sends them to the Records API, and emits a stub token (`tok_stub_...`). When the payment service is chosen this component is replaced by its hosted fields; the page and API do not change (AC11).
      Pay failure state: `.alert.alert-danger` (role alert) "Your payment was declined. Check your card details or try another payment method. Your booking is still confirmed, but it is cancelled if unpaid 24 hours after confirmation." plus a card with `.btn-primary` "Try payment again" (retries with the same collector) and `.btn-secondary` "Use another payment method" (resets the collector to a fresh form), and the amount summary card. In-button waiting uses `.spinner`; the Pay button is disabled while a charge is in flight to prevent double submit. On 410 (deadline passed) the page returns to the list.
    files:
      - apps/web/src/features/payments/PayBookingPage.tsx
      - apps/web/src/features/payments/PayBookingPage.test.tsx
      - apps/web/src/features/payments/PaymentMethodCollector.tsx
    rationale: |
      Covers AC1 (customer action that completes the charge), AC2, AC3, AC5, AC6, AC7 and AC11 in the UI.
  - description: |
      API end-to-end test in the existing Playwright API style (mirrors `test/e2e/health.spec.ts`): request, confirm, pay with a declined token then a good token, and the unpaid path, run against the stub gateway.
    files:
      - services/records-api/test/e2e/payments.spec.ts
    rationale: |
      Verifies the wired app, not just units.
tests:
  - |
    AC2 fixed price (services/records-api/test/unit/money.test.ts). Write first, expect it to fail until money.ts exists:
    ```ts
    expect(computeAmountDueMinor({ kind: 'fixed', priceMinor: 12000 })).toBe(12000);
    ```
  - |
    AC3 hourly rate times duration (same file):
    ```ts
    expect(computeAmountDueMinor({ kind: 'hourly', rateMinor: 4000, durationMinutes: 150 })).toBe(10000); // $40.00 x 2.5 h
    expect(computeAmountDueMinor({ kind: 'hourly', rateMinor: 3333, durationMinutes: 45 })).toBe(2500);   // 2499.75 rounds half up
    ```
  - |
    AC1 confirm creates the charge obligation and the customer is charged when they pay (payment-service.test.ts):
    ```ts
    await service.confirmBooking('b1', 'provider-1');
    expect((await repo.find('b1'))?.status).toBe('confirmed_payment_due');
    const res = await service.payBooking('b1', 'cust-1', 'tok_ok');
    expect(gateway.charges).toEqual([{ amountMinor: 12000, currency: 'USD', paymentToken: 'tok_ok', idempotencyKey: 'b1' }]);
    expect((await repo.find('b1'))?.status).toBe('paid');
    ```
  - |
    AC2 and AC3 through the service: the gateway is called with the amount computed from stored pricing, ignoring anything the client sends (bookings-routes.test.ts):
    ```ts
    const res = await app.inject({ method: 'POST', url: '/bookings/hourly-1/pay', payload: { paymentToken: 'tok_ok' } });
    expect(res.statusCode).toBe(200);
    expect(gateway.charges[0].amountMinor).toBe(10000);
    ```
  - |
    AC4 declined and expired requests are never charged (payment-service.test.ts):
    ```ts
    await service.declineBooking('b2', 'provider-1');
    await service.expireRequest('b3');
    expect(gateway.charges).toHaveLength(0);
    expect((await repo.find('b2'))?.status).toBe('declined');
    expect((await repo.find('b3'))?.status).toBe('expired');
    await expect(service.payBooking('b2', 'cust-1', 'tok_ok')).rejects.toMatchObject({ code: 'not_payable' });
    ```
  - |
    AC5 clear error on decline or failure (bookings-routes.test.ts and PayBookingPage.test.tsx):
    ```ts
    const res = await app.inject({ method: 'POST', url: '/bookings/b1/pay', payload: { paymentToken: 'tok_decline' } });
    expect(res.statusCode).toBe(402);
    expect(res.json().error.code).toBe('payment_declined');
    expect(res.json().error.message).toMatch(/declined/i);
    ```
    ```tsx
    expect(await screen.findByRole('alert')).toHaveTextContent('Your payment was declined');
    ```
    Also a `tok_error` case expecting `payment_failed`, and an assertion that the booking is still `confirmed_payment_due` afterwards.
  - |
    AC6 retry control (PayBookingPage.test.tsx):
    ```tsx
    await user.click(screen.getByRole('button', { name: 'Pay $120.00' }));
    expect(await screen.findByRole('button', { name: 'Try payment again' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try payment again' }));
    expect(payBooking).toHaveBeenCalledTimes(2);
    ```
  - |
    AC7 other payment method option (PayBookingPage.test.tsx):
    ```tsx
    expect(await screen.findByRole('button', { name: 'Use another payment method' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Use another payment method' }));
    expect(screen.getByLabelText('Card number')).toHaveValue('');
    ```
  - |
    AC8 auto-cancel at 24 hours, not before (payment-service.test.ts and unpaid-booking-sweeper.test.ts, using a fake Clock):
    ```ts
    clock.set(confirmedAt + 24 * 3600_000 - 1);
    await service.cancelUnpaidBookings(clock.now());
    expect((await repo.find('b1'))?.status).toBe('confirmed_payment_due');
    clock.set(confirmedAt + 24 * 3600_000);
    await service.cancelUnpaidBookings(clock.now());
    expect((await repo.find('b1'))?.status).toBe('cancelled');
    expect((await repo.find('b1'))?.cancelReason).toBe('payment_timeout');
    ```
    Plus: a paid booking is never cancelled by the sweep, and paying after the deadline returns 410 with no gateway call.
  - |
    AC9 cancellation email (payment-service.test.ts):
    ```ts
    await service.cancelUnpaidBookings(clock.now());
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]).toMatchObject({ to: 'sam@example.com', bookingId: 'b1' });
    await service.cancelUnpaidBookings(clock.now());
    expect(mailer.sent).toHaveLength(1); // not re-sent on the next sweep
    ```
  - |
    AC10 in-app list shows cancelled (bookings-routes.test.ts and MyBookingsPage.test.tsx):
    ```ts
    const res = await app.inject({ method: 'GET', url: '/bookings' });
    expect(res.json().find((b: { id: string }) => b.id === 'b1').status).toBe('cancelled');
    ```
    ```tsx
    expect(await screen.findByText('Cancelled')).toBeInTheDocument();
    expect(screen.getByText(/Cancelled because payment was not completed within 24 hours/)).toBeInTheDocument();
    ```
    Also list states: skeleton while loading, `.empty-state` text when no bookings, error alert on load failure.
  - |
    AC11 card details never reach the platform (bookings-routes.test.ts and PayBookingPage.test.tsx):
    ```ts
    const res = await app.inject({ method: 'POST', url: '/bookings/b1/pay', payload: { paymentToken: 'tok_ok', cardNumber: '4242424242424242' } });
    expect(res.statusCode).toBe(400);
    ```
    ```tsx
    await user.type(screen.getByLabelText('Card number'), '4242424242424242');
    await user.click(screen.getByRole('button', { name: 'Pay $120.00' }));
    expect(payBooking).toHaveBeenCalledWith('b1', expect.stringMatching(/^tok_/));
    expect(JSON.stringify(payBooking.mock.calls)).not.toContain('4242');
    ```
  - |
    Shell and tokens (App.test.tsx, replaces the "Web App" heading test): the four nav links render in order Records, Reports, Settings, Account and Records has `aria-current="page"`. The narrow commands that verify each task:
    `(cd services/records-api && pnpm vitest run test/unit/money.test.ts test/unit/payment-service.test.ts test/unit/bookings-routes.test.ts test/unit/unpaid-booking-sweeper.test.ts)` and `(cd apps/web && pnpm vitest run src/features/payments src/lib src/App.test.tsx)`.
assumptions_or_open_questions:
  - |
    Booking & Scheduling is not in this repo yet (grep for "booking" outside node_modules found nothing; records-api has only the `/health` route). This plan defines the minimal booking shape the payment code needs (status, pricing, confirmedAt, payBy) behind a `BookingRepository` port and exposes `confirmBooking`/`declineBooking`/`expireRequest`. Please confirm that story will call these (or replace them) rather than own a different state model.
  - |
    Persistence: records-api has no database client, migration tool or schema today (dependencies are only fastify), though PostgreSQL is the confirmed database. This plan ships an in-memory repository only, so bookings and payment state are lost on restart and a real deployment cannot use it. A PostgreSQL adapter and migration depend on the Booking & Scheduling schema and are not planned here. Decide whether to split that out as its own item or fold it into this one; it is a materially larger piece of work.
  - |
    AC1 says the customer is charged "when the provider confirms", but the approved design has the customer press "Pay now" and enter card details after confirmation (the payment service must collect card data, AC11, so an off-session charge at confirm time is not possible without a saved method). The plan follows the design: confirmation fixes the amount and starts the 24-hour clock, and the charge happens when the customer completes the Pay booking screen. Please confirm this reading.
  - |
    Payment service not chosen (settled): a `StubPaymentGateway` stands in. The stub card-entry component in the Web App is a placeholder for the provider's hosted fields; its token format and the real adapter are out of scope. Provider payouts and bank/identity details are out of scope for this story.
  - |
    Authentication: ADR-0004 says sign-in goes through Entra ID, but no auth code exists in the repo. The routes take the customer and provider identity from a `resolveActor(request)` seam that tests fake; wiring it to Entra tokens is not planned here. Who is allowed to confirm and decline (provider only) rests on that seam.
  - |
    Currency is assumed to be USD (the prototype shows `$`); the booking carries a `currency` field so this can change. Amounts are held in integer minor units. Hourly rounding is half up to the cent; the design shows only a whole case (2.5 h at $40.00).
  - |
    The 24-hour deadline is inclusive: a booking is cancelled when `now >= confirmedAt + 24h`. A payment arriving exactly at that moment loses the race (compare-and-set on status).
  - |
    The cancelled-notice alert on My bookings (prototype state "cancelled") needs a rule for how long it shows. Assumed: for auto-cancelled bookings whose `cancelledAt` is within the last 24 hours, with no dismiss control. Please confirm or give another rule.
  - |
    The prototype's "Browse services" button only shows a toast saying it is not part of this story, and no item names the destination. The plan renders the button but wires no navigation; confirm where it should go.
  - |
    `design/prototype-utils.css` contains global resets (`*`, `body`, `h1` to `h4`, `a`) that may overlap with Tailwind's preflight. Importing it after Tailwind is assumed to be acceptable; check visually during implementation that the existing Tailwind utilities still behave.
  - |
    Retention of financial records (payments, refunds, payouts) is an open project-wide question. This plan stores the charge id, amount, status and timestamps per booking and keeps them indefinitely; no deletion job is planned until the retention period is decided.
  - |
    The cancellation email body and sender are not specified. Assumed a plain text and HTML message from `SES_FROM_ADDRESS` stating the booking name and that no charge was made. The customer's email address must come from the customer record (not present yet); the in-memory fixture carries it.
estimated_points: 8
package_dependencies:
  - name: "@aws-sdk/client-sesv2"
    version: "^3.700.0"
    ecosystem: npm
    component_id: comp_records_api
    rationale: |
      AC9 needs a real cancellation email, and ADR-0009 requires that only the Records API sends email, through Amazon SES. `SesMailer` uses this client; tests use `FakeMailer` and never load it.
notes: |
  ### Data & rollout

  - **Existing data**: no database schema, migration or stored-data shape changes. The repo has no database client and no booking data yet; bookings live in an in-memory repository in this plan, so nothing existing can be locked out. Persistence is an open question (see assumptions).
  - **Backfill / seed**: none. The in-memory repository is seeded only by tests.
  - **Settings** (documented in a new `services/records-api/.env.example` section or README line; all safe when unset): `PAYMENT_GATEWAY` (default `stub`), `SES_FROM_ADDRESS` (when unset, `SesMailer` is not constructed and a logging mailer is used outside production), `AWS_REGION` (default: the single project region, ADR-0010), `UNPAID_SWEEP_INTERVAL_MS` (default 60000). Web App: `VITE_RECORDS_API_URL` (default same origin).
  - **Provisioning**: a verified SES sender identity in the AWS region before email works in staging or production. Nothing else.
  - **Order and rollback**: deploy the Records API first, then the Web App, because the new screens call `GET /bookings` and `POST /bookings/:id/pay`. Rollback is redeploying the previous images; no data migration to reverse. A deploy-time restart clears in-memory state until persistence exists.

  ### Findings from the code

  - `services/records-api/src/app.ts` is `buildApp()` registering `healthRoutes` only; tests use `app.inject` (`test/unit/health.test.ts`); vitest only includes `test/unit/**/*.test.ts`.
  - `apps/web/src/index.css` is only `@import "tailwindcss";` and `apps/web/vite.config.ts` has the react and tailwind plugins with tests in `src/**/*.test.{ts,tsx}` (jsdom, `globals: true`). Nothing loads `apps/web/design/tokens.css` or `prototype-utils.css` yet, hence the import scope item.
  - `App.tsx` is a placeholder heading, so the shell is built here from the approved prototype.
  - Prototype conflicts with ACs: none contradict an AC. The one tension is AC1 versus the "Pay now" step (see assumptions). The prototype's "Browse services" toast and its sample-data JSON are not carried into production code.

  ```mermaid
  flowchart TD
    server[services/records-api/src/server.ts] -->|starts sweeper| sweeper[jobs/unpaid-booking-sweeper.ts NEW]
    server --> app[src/app.ts]
    app --> health[routes/health.ts]
    app -->|registers| bookings[routes/bookings.ts NEW]
    bookings --> svc[payments/payment-service.ts NEW]
    sweeper --> svc
    svc --> gw[payments/gateway.ts NEW stub]
    svc --> mail[payments/mailer.ts NEW SES]
    svc --> repo[payments/booking-repository.ts NEW]
    main[apps/web/src/main.tsx] --> appx[apps/web/src/App.tsx]
    main --> css[apps/web/src/index.css]
    css -->|imports| tokens[apps/web/design/tokens.css]
    css -->|imports| utils[apps/web/design/prototype-utils.css]
    appx --> list[features/payments/MyBookingsPage.tsx NEW]
    appx --> pay[features/payments/PayBookingPage.tsx NEW]
    list -->|GET /bookings| bookings
    pay -->|POST /bookings/:id/pay| bookings
    classDef touched fill:#f96,color:#000
    class server,app,css,appx touched
    classDef added fill:#bbf,color:#000
    class sweeper,bookings,svc,gw,mail,repo,list,pay added
  ```
  Orange nodes are existing files modified (server starts the sweeper, app registers routes and takes injected dependencies, css loads tokens, App becomes the shell); blue nodes are new.

  Money is integer minor units end to end; the browser only formats. Time uses an injected `Clock`. Audit records (ADR-0011) are written for confirm, decline, expire, charge attempt and auto-cancel with actor (`system` for the sweeper) and time.
review_focus: |
  Hold the plan to the 11 ACs: charge amount (fixed vs hourly x duration), no charge on decline/expire, failure UX (error, retry, other method), 24-hour auto-cancel with email and list status, and no card data on the platform. Out of scope: a real payment provider, payouts, refunds, commission, cancellation fees, the Booking & Scheduling screens, Entra sign-in wiring and the PostgreSQL adapter. Riskiest areas are the pay-versus-sweeper race (compare-and-set on status, inclusive 24h boundary) and the server-side amount calculation; the in-memory repository and stub gateway are deliberate stand-ins, not omissions, and the AC1 reading (charge completes when the customer pays after confirmation) follows the approved design.
