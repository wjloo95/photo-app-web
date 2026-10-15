# Decisions log

Architecture decisions made while building, with the reasoning behind them.
Continues the numbering of `FRONTEND_DECISIONS_WIP.md` in the claude.ai "Photo
App" project (D-27–D-48), so mirror new entries there to keep one sequence.

Each entry records what was **rejected** and what is **held against** the choice,
not just the choice: the rejected option is usually what an interviewer asks
about.

Status: **Decided** · **Leaning** (direction agreed, details open) · **Open**

---

## D-49 — One shared root layout, kept lean

**Decided** · 2026-10-14 · Phase 0

A single `app/layout.tsx`. Each product's shell lives in its nested layout,
`app/portal/layout.tsx` and `app/studio/layout.tsx`.

**The rule.** The root holds **only** `<html>`, `<body>`, fonts, default
metadata, and `globals.css`, and `globals.css` holds only resets and shared
design tokens. **Never in the root:** providers (including TanStack Query's),
product-specific CSS, data fetches (including `/users/me`), or any `'use client'`
import. Those go in the product layout that needs them. Every page in both
products pays for whatever is in the root, including `/login` and `/invite`.

**Why.** The two products don't need a different `<html>` or `<head>`, because
styling and fonts are meant to be consistent across them. A single root keeps one
404 page, keeps `/login` → `/portal` a client-side navigation, and needs no
route groups.

**Rejected: one root layout per product** (`app/(client)/`, `app/(photographer)/`).
Its real advantage was structural: with no shared root, the portal could not
inherit studio code through it. The one thing only a root layout controls is
`<html>`/`<head>`, and neither product needs those to differ.

**Held against it.** D-40 is now protected by a rule rather than by file
structure, which is the opposite of what D-39 prefers. The escape hatch is that
moving to route groups later leaves every URL unchanged, but that move stays
cheap only while the root stays lean.

---

## D-50 — Shared components expose slots; products plug their features in

**Decided** · 2026-10-14 · Phase 0

One shared `PhotoGrid` that knows nothing about either product. It exposes
**slots**, props where the caller supplies the behaviour, such as `onTileClick`
and `renderTileOverlay`. It has no **role flags** such as `isStudio`,
`showBulkActions` or `canSetThumbnail`. The studio adds selection through a
studio-only wrapper (`StudioGrid`), which renders the toolbar next to the grid
and passes in a click handler and a checkmark overlay. The portal renders
`<PhotoGrid />` alone.

**The test for a prop:** can the grid support it without knowing which product
it is in, or importing that product's code? If so, it is a slot. If not, it is a
role check in disguise (the pattern D-39 split the route trees to avoid).
`selectable` looks like a generic grid feature, but if the grid implements it
internally it imports the selection store, which then ships to the portal. So
it is built from slots instead.

**Why.** The bundler follows `import`s at build time and cannot see runtime
props. A shared component that imports a feature ships that feature to every
product that uses the component, even when a prop like `selectable={false}`
stops it from rendering. Tree-shaking removes unimported exports, not branches
skipped at runtime. The file that writes the `import` decides who pays for it.

**Consequence.** Once the toolbar sits outside the grid, it and the tiles need
shared selection state. That state goes in an external store with per-item
subscriptions (D-48), not in page-level `useState`. Page state would re-render
the page, the grid and all 400 tiles on every click.

**Rejected: lazy-loading inside the shared component** (`next/dynamic`). It works,
but the studio then pays a network fetch the first time someone enters select
mode, and the shared component still knows about studio features.

**Rejected: a grid with role or feature flags** (`selectable`, `mode="studio"`).
Every studio feature becomes an `if` inside the shared component, and every
import it needs ships to the portal.

**Held against it:** slot props are less obvious to read than a flag. To see
what a tile does on click, you have to look in the caller, not in `PhotoGrid`.

**If clients get favourites** (plausible: "pick 40 for the printed album"), the
shared part is the selection *mechanism*, not the grid. `selectionStore` moves
from the studio folder to a shared one. That is a file move, not a rewrite.

---

## D-51 — Code is organized by product, colocated with its route tree

**Decided** · 2026-10-14 · Phase 0

```
app/portal/_components/   portal-only
app/studio/_components/    studio-only
components/                shared by both products (e.g. PhotoGrid)
lib/                       shared non-UI code (lib/api/ for the API client)
```

The `_` prefix marks a private folder that Next never treats as a route.

**Why.** Work happens one product at a time, because the products share almost
no requirements (D-39). The file path also shows which product owns a file, so
a portal file importing from `app/studio/` is visible in the import line, and
a lint rule can turn that into a build error.

**Enforced** by `import/no-restricted-paths` in `eslint.config.mjs`. Portal and
studio cannot import each other, and `components/` and `lib/` cannot import
either product. It checks resolved paths, so both `@/` and relative imports
are caught.

**Promotion rule: move to `components/` on the second real use, not on a
guess.** A component stays in its product folder until the other product
actually needs it. A guess that it might be shared tends to grow options for a
caller that never arrives, which is how a shared grid acquires role flags
(D-50).

**Rejected: a top-level `features/` grouped by topic** (`features/albums/…`).
It keeps all album code in one place, but it hides which product a file belongs
to, so the portal can import a studio-sized component without anything looking
wrong.

**Held against it.** Code about one topic is split across three places
(`portal/`, `studio/`, `components/`), and moving a component into
`components/` when it becomes shared is a manual step.

---

## D-52 — The client product lives at `/portal`

**Decided** · 2026-10-14 · Phase 0 · amends D-39's naming

`/gallery/*` → `/portal/*`. `/studio/*` is unchanged.

**Why.** Clients use their side for far more than viewing photos. The hope is
that they spend a lot of time in messages while planning a shoot with their
photographer, and they also fill in forms there. `/gallery/messages` reads as
messages inside a photo gallery. "Client portal" is the established industry
term for exactly this space, and messages, forms and albums all sit naturally
inside it.

**Rejected:**
- `/gallery`: names one feature, not the whole space.
- `/client` + `/photographer`: clear, but the URL literally names a role, which
  is the thing D-39's "held against it" already worries about, and
  `/client/albums/…` reads clinically in a wedding email.
- `/my`: `/my/albums` reads naturally but is informal.

**Held against it.** The email deep-link target, `/portal/albums/:albumId`, is
less evocative than `/gallery/albums/:albumId` was.

---

## D-53 — `apiFetch` applies `Serialized<T>` itself

**Decided** · 2026-10-14 · Phase 0

```ts
apiFetch<T>(path): Promise<Serialized<T>>
```

The caller names any type, entity or wire shape, and always gets back the wire
shape, with dates as strings. `apiFetch<User>(…)` and `apiFetch<ApiUser>(…)`
both return `ApiUser`, because `Serialized` of an already-serialized type
changes nothing.

**Why.** The date bug (dates arrive as ISO strings while TypeScript believes
they are `Date`) needs only one careless `<User>` to come back. With
`Serialized` applied inside `apiFetch`, that call gets the correct label, so
`user.joinedAt.getFullYear()` is a compile error instead of a runtime crash.
The mistake cannot compile, and nobody has to remember a rule.

**Rejected: return exactly the caller's `T`** (`Promise<T>`). Safe only if
every caller remembers `ApiUser` over `User`, and one slip reintroduces the
bug with no warning.

**Held against it.** It is still only a label. `apiFetch` does not check at
runtime that the response matches `T`, so if the API renames a field both
versions compile and break at runtime. See D-54.

---

## D-54 — No runtime validation of API responses, until the real API

**Decided** · 2026-10-14 · Phase 0 · **revisit when `API_URL` first points at
the real backend**

`apiFetch` trusts the response shape and does not check it against a schema.

**Why.** Today drift is impossible. The mock's fixtures are typed against
`types/`, so a fixture that doesn't match is a compile error, and every
response is built from the same types `apiFetch` labels it with. Validation
would only confirm what TypeScript already guarantees. The cost is one schema
per response shape, and that time is better spent on the gallery, lightbox and
upload work.

**Rejected (for now): schema validation (Zod/Valibot) on every response.**
It gives loud, specific errors at the exact fetch that broke, but it has no
benefit while the only API is the typed mock.

**Held against it.** Once the real API is wired in, a field renamed in the
backend without a matching `types/` update shows up as quiet broken UI (a
blank name, `undefined`), not an error.

**When revisiting:** the cheapest useful version is validation on the server
only (no browser bundle cost), for the endpoints actually in use, added inside
`apiFetch` so no call site changes.

---

## D-55 — `apiFetch` always throws; the caller decides what is "expected"

**Decided** · 2026-10-14 · Phase 0

`apiFetch` checks `res.ok`. On any failure it throws an `ApiError` carrying the
HTTP status (and the error body). A network failure, where the server is
unreachable, propagates as thrown.

The principle is Next's: **expected failures are handled and shown, broken
things crash to an error page.** The line is drawn at the **call site**, not
inside `apiFetch`:

- A page that expects a particular failure catches it and converts it. The
  album page turns a 404 into `notFound()` (an old email link to a deleted
  album). A Server Action catches a 409 and **returns** `{ error }` to its form
  ("invite already accepted").
- Anything not caught falls through to the shared `error.tsx`. **The default is
  "broken".**

**Why at the call site.** The same status means different things in different
places. A 404 on `/albums/:id` is normal use, while a 404 on `/users/me` means
something is broken. `apiFetch` sees only the status code. The caller knows the
meaning. TanStack Query also expects its fetch function to throw.

**Rejected: `apiFetch` returns error results for 4xx and throws only for
network/5xx.** Every caller would receive 4xx results it never expected (a 404
from `/users/me`) and would have to remember to treat them as crashes itself.
The safe default would be inverted.

**Held against it.** TypeScript does not force anyone to handle an expected
failure. A page that forgets to catch its 404 shows the generic error page
instead of "not found". That is wrong, but loudly wrong. Which statuses each
endpoint can return is documented in `docs/API.md`.

---

## D-56 — `apiFetch` is server-only for now

**Decided** · 2026-10-14 · Phase 0 · **revisit at the first browser-side fetch
(Phase 1 infinite scroll)**

`apiFetch` runs only on the Next server and reads `API_URL`. Its module imports
`server-only`, so importing it from a client component is a build error, not a
silent bug.

**Why.** Today nothing in the browser fetches from the API, and there is no
real login. The hard part of browser fetching can't come up yet. That hard part
is that the session cookie is hidden from JavaScript and Express accepts only an
`Authorization` header, so the browser can't prove who it is directly. The
answer depends on things Phase 1 and the auth work will settle.

**Rejected (for now): one module that works in both places.** It would mean
choosing between "browser goes through Next" and "API accepts cookies" before
either a browser fetch or real auth exists.

**Held against it.** Phase 1 will need a browser path, and `apiFetch`'s shape
may have to change then. The `ApiError` and `Serialized` behaviour should carry
over unchanged, and only how the request is sent differs.

**When revisiting:** the two options are (a) browser requests go through Next,
which attaches the login (a route handler or Server Action), or (b) the
backend accepts the session cookie (backend gap #7).

---

## D-57 — Next does not cache API responses; the API's cache is the owner

**Decided** · 2026-10-14 · Phase 0

Server-side reads through `apiFetch` do **not** use `'use cache'`. Each request
asks the API, and the API answers from its own server-side cache (album 15 min,
photos 5 min, profile 1 h) or the database. Uncached reads sit inside
`<Suspense>`, so the page shell still ships instantly and the data streams in.

**Why.** One owner per piece of data. The API already caches, and it already
clears that cache when data changes (a photo added clears the album's photo
list). A second cache in Next would not hear those clears, so after every
write the client could see stale data unless every write path also told Next to
forget. Personal data ("who is logged in") must never sit in a shared cache at
all. Identical fetches within a single render are still deduplicated by React,
for free.

**Rejected: `'use cache'` on API reads.** It would put data into the instant
shell and save the Next→API hop. The cost is a second cache to invalidate on
every write, and a risk of serving one user's data to another.

**Held against it.** Every page view costs one Next→API round trip, and if the
API is slow, every view waits (behind a loading fallback).

**Revisit if:** measurement shows the Next→API hop hurting time-to-first-photo,
or for data that is genuinely public and identical for everyone (the
post-MVP public portfolio page is the likely first candidate).

---

## Conventions

- **URL segments are whole words, never abbreviations.** `/portal`, not `/g`.
  `/photos/:photoId`, not `/p/:photoId`. `/portfolio/:handle`, not `/p/:handle`.
  URLs are shared and emailed, so once a link is out it is effectively
  permanent, and one letter (`p`) had come to mean both "photo" and
  "portfolio". Rename while no links exist.
- **Collections are plural, matching the API.** A segment before an id names
  the collection: `/albums/:albumId/photos/:photoId` mirrors the API's
  `/albums/:id/photos/:photoId`.
- **Booleans read as questions, collections are plural nouns.** Use
  `isSelected`, `hasPhotos` and `canEdit` for booleans, and `selectedIds` and
  `photos` for collections. A store field named `selected` was misread as a
  boolean, which hid why subscribing to it re-renders every tile.
- **Store selectors return the smallest thing the component displays.** A tile
  selects `s.selectedIds.has(photo.id)`, a boolean, not `s.selectedIds`. A new
  Set is never `===` the old one, so subscribing to the whole Set re-renders
  every subscriber. (Mechanism behind D-48.)

---

## Open

- **API client shape, remaining questions.** Where `Serialized<T>` is applied
  is settled (D-53), and so are runtime validation (D-54), errors (D-55) and
  server-only (D-56), and no Next-side cache (D-57). Nothing open; next step is
  writing it.
- **Is D-30's "messaging is email, not chat" still true?** D-30 chose polling
  because "four messages a week is email, not chat". D-52 expects clients to
  message a lot while planning a shoot. If that means bursts of back-and-forth,
  revisit polling interval vs. push before Phase 4. CLAUDE.md also still
  describes the client product as "read-only", which messages and forms
  already contradict.
- **What the photographer sees first: the `/studio` dashboard.** The route
  exists in D-39 but has no defined content. Decide what a photographer needs on
  login, then whether the existing endpoints can feed it: several parallel
  reads from the server component, or a new aggregate endpoint in
  `../photoApp`. Related: what `/` does after login (redirect by role?).
- **Who stops a photographer opening `/portal`, or a client opening `/studio`?**
  Nothing does today: `/users/me` has no role check and the pages render
  whoever comes back. Decide where the guard lives (product layout? proxy?)
  and what it does (redirect to your own product vs. an error). Belongs with
  auth.
- **Styling, testing.** See CLAUDE.md, "Open decisions".
