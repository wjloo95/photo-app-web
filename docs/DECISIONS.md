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

- **API client shape.** Where `Serialized<T>` is applied, throw vs. result union,
  a single module vs. a server/browser split, and `'use cache'` on top of the
  API's own TTLs. Deliberately deferred until after a plain `/users/me` fetch is
  working.
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
