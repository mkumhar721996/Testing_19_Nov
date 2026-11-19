# UI guidelines — Records

## Navigation and information architecture
- **Top bar only, no sidebar.** The product has four destinations, so a sidebar would waste width that record tables need.
- **Order: Records, Reports, Settings, Account** (`data-nav-key`: `records`, `reports`, `settings`, `account`). Records comes first because it is the landing screen and the main daily task.
- **Account sits last in the bar** and holds sign-out; keeping it apart from the work sections stops it competing with them.
- **Below the tablet breakpoint the links collapse behind a menu button**, so the bar never overflows a phone screen.
- **Detail and edit screens belong to Records**, not new top-level items, so the nav stays at four entries.

## Layout and density
- **Moderately dense, data-first.** Users scan and compare many records, so favour `.table` and compact `.stack` spacing over decorative whitespace.
- **Page content sits inside `.container`** (capped by `content-max-width`) so long rows stay readable on wide screens.
- **Breakpoints that matter: phone (375px) and tablet-up (about 768px).** Below tablet, tables scroll inside `.table-wrap` and multi-column `.grid` layouts fall to one column, because records are checked on phones too.
- **Page title is an `h1` at `font-size-xl`; sections use `h2`.** One title per screen keeps orientation clear.

## Component usage
- **Table (`.table` in `.table-wrap`) for lists of records**, because users compare fields across rows; **card (`.card`) for a single record's summary or a dashboard metric**; plain `.stack` list for short, one-line items such as activity.
- **One `.btn-primary` per screen region**; other actions use `.btn-secondary` or `.btn-ghost`, so the main action is never ambiguous.
- **`.btn-danger` only for irreversible actions, and always behind a `.modal` confirmation**, to prevent accidental data loss.
- **Forms: every control inside a `.field`** with `.field-hint` for format help and `.field-error` plus `.is-invalid` for errors, so messages sit next to the control they describe.
- **`.drawer` for viewing or quick-editing a record without leaving the list**; `.modal` only for short confirmations or decisions, because they block the page.
- **`.alert` for persistent, page-level problems; `.toast` for brief confirmation of a completed action**, so success never needs dismissing.
- **`.badge` for record status (success / warning / danger / neutral)**; `.chip` for filters the user can toggle.
- **Loading: `.skeleton` for lists and cards, `.spinner` only for in-button or short waits**; **`.empty-state` with one primary action when a list has no records**, so users know what to do next.
- **`.tabs` to switch views of the same record or report; `.accordion` for optional detail**, so related content stays on one page.

## Theme stance
- **Light theme only.** Records are read in bright office settings and one theme halves the contrast work; colours come from the `color-*` tokens so a dark theme can be added later by remapping them.

## Voice and tone
- **Plain, calm and direct**, because users are doing routine administrative work and want no friction.
- **Buttons are verb + object** ("Save record", "Delete record"), so the outcome is clear before the click.
- **Errors say what happened and how to fix it**, without blame ("Enter a date in the format DD/MM/YYYY").
- **Sentence case everywhere; no exclamation marks**, to keep the tone professional.
