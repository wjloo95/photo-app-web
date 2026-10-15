# photo-app-web

Next.js frontend for the Photography Client Platform. The Express/Postgres API
lives in a **separate repo** at `../photoApp` and is **not deployed yet** — this
app develops against a mock server in `mock-api/`.

## Why this project exists

It is two things at once, and when they conflict the first one wins:

1. **Interview preparation.** Frontend system design fluency and modern React
   coding. Design reasoning is well ahead of hands-on fluency, so the priority
   is building, not more architecture discussion.
2. A portfolio piece and full-stack deep-dive subject.

## Working agreement

The point is learning, so the split matters:

**Will writes himself** — component logic, state decisions, data fetching
wiring, anything where the design choice *is* the work.

**Fine to delegate** — scaffolding, config, repetitive markup after the first
one is hand-written, debugging ("here's my error"), type definitions, review.

**Per feature:** write it, run it, break it, fix it — *then* ask for review.
Ask "why" on every suggestion. Warning signs: copying code not fully
understood, never hitting errors, unable to explain why something works.

Prefers Socratic questions over handed answers, and understanding tradeoffs
over generated code.

## Stack

- **Next.js 16.4** App Router, React 19.3, TypeScript
- **CSS Modules** — styling library deliberately undecided, see Open below
- **Server Actions** for writes, forwarding to the Express API
- **React Server Components** for read-mostly data
- **TanStack Query** (not yet installed) for exactly four resources — see D-42/43
- **Mock API** — Express on `localhost:4000`, `mock-api/`

```bash
npm run dev:all     # Next (3000) + mock API (4000) together
npm run dev         # Next only
npm run mock        # mock API only
npm run typecheck
```

`MOCK_ROLE=photographer npm run mock` switches the logged-in identity.
`MOCK_DELAY_MS` controls artificial latency (default 250ms — do not set it to 0,
see below).

## Read these too

- **`docs/API.md`** — all 40 endpoints, response shapes, limits, server-side
  cache TTLs, and the seven known gaps. **Read it before writing any fetch.**
  If a shape is not described there, read the real handler in
  `../photoApp/src/routes/` rather than guessing.
- **`docs/BUILD_ORDER.md`** — phases, what to hand-write vs. delegate per phase,
  and which drill precedes each one.
- **`docs/DECISIONS.md`** — decisions made while building (D-49 onward), each
  with what was rejected and what is held against it. **Add an entry whenever a
  design decision is settled in a session.**
- **`docs/PRINCIPLES.md`** — the reusable questions behind those decisions, for
  interview prep. **When a decision is settled, check whether it adds a new
  principle or a new "Seen here" example, and update this file too.**

## Architecture decisions

Full log with rationale and tradeoffs lives in the "Photo App" project on
claude.ai (`FRONTEND_DECISIONS_WIP.md`, decisions D-27–D-48). Backend decisions
D-01–D-26 are in `../photoApp/photography_app_architecture.md`. The ones that
constrain day-to-day work:

### Routing and products

**D-39 (revised) — Two products, two route trees.** `/portal/*` is the client
product (responsive, read-only, arrives cold from an email link). `/studio/*` is
the photographer product (desktop, write-heavy, a work tool). They share almost
no requirements.

**Why separate trees:** `/albums/:id` would otherwise mean two completely
different pages depending on who is asking — the photographer's view has bulk
select, upload, thumbnail setting and client assignment; the client's is a
read-only gallery with download. One shared route tree branching on role is how
you end up with `{isPhotographer && <BulkActions />}` scattered through
components, a layout conditional in six places, and both products in one bundle
because the role check is a runtime branch rather than a build-time boundary.
Separate trees make them simply different files that happen to fetch the same
resource.

**A reason that no longer applies:** this originally also solved the startup
round trip from the backend's D-26 (the frontend resolves its own identity via
`GET /users/me`, so it does not know the role until that returns) — the URL would
tell the app which shell to render first. D-35 chose server rendering, which
resolves identity during the HTML response, so there is no longer a waterfall to
work around. The collision argument above is what carries this decision now.

**Naming:** was `/g` and `/app`. Renamed because `/g` is opaque on the thing
clients see most — a link in an email about their wedding photos — and `/app`
only ever meant "the logged-in part". `/studio` is what photographers call their
own business. The client side was then `/gallery`, renamed to `/portal` (D-52)
because clients use it for far more than galleries: messages, forms, planning.

**Held against it:** this bakes role into the URL structure. The justification is
that `users.role` is a single enum so a user cannot be both — but that is a
schema constraint, not a product truth. Photographers hire photographers. If
that becomes real, the URL structure needs rework rather than a permission change.

```
/invite/:token                        the only unauthenticated flow
/login  /signup
/portfolio/:handle                    RESERVED — public portfolio, post-MVP (D-27)

/portal                              client: album list
/portal/albums/:albumId              client: gallery  ← email deep-link target
/portal/albums/:albumId/photos/:photoId lightbox (a ROUTE, see D-41)
/portal/messages
/portal/forms/:responseId

/studio                               photographer: dashboard
/studio/albums
/studio/albums/:id
/studio/albums/:id/upload
/studio/clients
/studio/clients/:id
/studio/invites
/studio/messages
/studio/messages/:conversationId
/studio/templates
/studio/templates/:id
/studio/settings
```

**D-40 — Separate bundles per product.** Client budget is under half the
photographer budget, so a shared bundle is arithmetically impossible.

**D-49 — One shared root layout, kept lean.** The root holds **only**
`<html>`, `<body>`, fonts, default metadata, and `globals.css` (resets and
shared tokens only). **Never in the root:** providers, product CSS, data
fetches, or any `'use client'` import. Those go in `portal/layout.tsx` or
`studio/layout.tsx`. Full reasoning in `docs/DECISIONS.md`.

**D-50 — Shared components expose slots, never role flags.** `PhotoGrid` takes
`onTileClick` / `renderTileOverlay`, not `isStudio` or `selectable`. Products
plug their features in from their own folder.

**D-51 — Organized by product.** `app/portal/_components/`,
`app/studio/_components/`, shared UI in `components/`, shared non-UI in `lib/`.

**D-41 — The lightbox is a route, not component state.** Shareable URL, working
back button, state the browser owns instead of React. Closing it must not
refetch the grid behind it.

### Data and caching

**D-42 — One resource, one cache owner. Never two.** This is the load-bearing
rule. Overlap is what creates multi-cache invalidation bugs.

| Resource | Owner |
|---|---|
| Photographer profile, album metadata, list endpoints | **RSC** |
| Form **questions** (frozen snapshot — cannot change) | **RSC** |
| Photo list | **client cache, server-seeded** |
| Messages, conversation list + unread counts | **client cache** |
| Form **answers** | **client cache** |
| Upload queue | **IndexedDB** (D-29) |
| Photo multi-select | **external store** (D-48) |
| Current album / photo / tab / filter | **URL** |

**D-43 — TanStack Query is scoped to those four client-cache rows only.** Not a
default. If it starts holding album metadata because that was convenient, D-42
has quietly stopped holding.

**D-44 — The photo grid is server-rendered and client-owned.** RSC fetches page
1 and dehydrates the query cache into the payload; the client hydrates it as
already-fresh and infinite-scrolls pages 2+. Without the handoff the client
refetches page 1 and the server render was wasted.

**D-45 — Dates cross the boundary as ISO strings; rehydration is explicit.**
Enforced by `Serialized<T>` in `types/serialized.ts` — use `Serialized<Album>`,
never `Album`. The API repo already hit this bug one layer down, where
`JSON.parse(raw) as T` returned a string while TypeScript claimed `Date`.

**D-46 — Optimistic:** send message, remove photo from album, set album
thumbnail, mark conversation read (the API made it `SET = 0`, idempotent by
construction). **Not optimistic:** invites, album delete.

**D-47 — Never predict the unread counter.** The API maintains two
denormalised per-participant counters. Re-implementing that invariant on the
client duplicates the exact logic that was already subtly wrong once
server-side. Append the message optimistically; read the counter from the server.

**D-48 — Multi-select lives in an external store with per-item
subscriptions.** A `Set` in grid-level state re-renders all 400 photos per
toggle, which is the most likely INP violation in the photographer product.

### Performance

**D-31 — Budgets, committed up front.** p75 target is a recent phone on a
*congested venue network* (~150 ms RTT) — device and network separated on
purpose, because a faster phone reduces JS parse time and does nothing for
round-trip latency.

| | Client | Photographer |
|---|---|---|
| LCP | < 2.5 s | < 3.0 s |
| CLS | < 0.1 | < 0.1 |
| INP | < 200 ms | < 200 ms |
| Initial JS (gz) | **< 150 KB** | < 350 KB |
| Grid scroll | 60 fps @ 400 photos | 60 fps @ 400 photos |

The framing that produced these: not "how big is my bundle" but **"how many
serial round trips stand between a cold click and a visible photo?"** Trimming
50 KB of JS buys ~250 ms; collapsing one round trip buys the same and costs
nothing at runtime.

**D-32 — LCP is measured on the first real thumbnail, not the skeleton.**
Skeletons are still built (they are what makes CLS ≈ 0) but measuring them
would make the budget pass while the page stayed just as slow. Chrome ignores
images under 0.05 bits/pixel for LCP candidacy anyway.

**D-33 — Aspect-ratio placeholders from `photo.width`/`height`.** No blurred
LQIP — it needs a fourth Cloudinary variant and the API derives exactly three
from `basePath` by convention.

**D-34 — Deep-linked entry + preconnect.** Emails link to the resource, never a
landing page. Worth ~650 ms and it cost two `<link>` tags.

### Async

**D-29 — The upload queue persists to IndexedDB and survives reload.** Note a
`File` handle is dead after reload, so the queue stores *metadata* and prompts
for re-selection, matching on (name, size, lastModified) and skipping completed.

**D-30 — Messaging transport behind a port.** `PollingTransport` ships;
`SSETransport` exists behind a flag. Polling is correct here — four messages a
week is email, not chat — and the API caches conversation lists for 2 minutes,
which live push would invalidate for no user-visible gain.

## Mock API

`mock-api/` is a stand-in for the real Express API. A real HTTP server rather
than MSW because RSC fetches happen on the *server*, where a browser service
worker does not exist — MSW would need a second Node-side setup through
`instrumentation.ts`. A real server behaves identically for both. MSW still
belongs here eventually, in tests.

It reproduces the real API's quirks rather than an idealised version:

- **Offset pagination** on photos (`?page=&limit=`), page-shift behaviour
  included, because that is what the API does today
- **Identity-scoped reads** — client-scoped routes check the id against the
  caller and return 403, same as the real `assertCanReadClient`
- **`status: 'processing'`** photos with `null` dimensions exist in the fixtures

Fixtures are typed against `types/`, so a fixture that drifts from the contract
is a compile error.

Deliberately awkward fixture data: 63 photos with mixed portrait/landscape
dimensions (a grid built against square fixtures looks fine until real frames
arrive), two photos stuck at `processing`, and one portfolio album with
`clientId: null` / `accessExpiresAt: null` so both album types get exercised.

**`MOCK_DELAY_MS` defaults to 250.** On localhost every response is instant,
which means loading and skeleton states never render and therefore never get
built. Leave it on.

Add handlers as the slice that needs them gets built. The 404 fallback says so.

## Types

`types/` is a **hand-maintained copy** of the API's entity types. The API is a
separate repo, so nothing enforces that these stay in sync — a server-side
shape change compiles fine here and breaks at runtime. That is the accepted
cost of separate repos; a monorepo with a shared package was tried and judged
not worth the setup cost before any frontend existed. **When the API changes,
update `types/` in the same change.**

- `entities.ts` — server-shaped, timestamps are `Date`
- `enums.ts` — PG enum mirrors
- `serialized.ts` — `Serialized<T>`, the wire shape. **Use this in app code.**
- `api.ts` — response envelopes. Written by reading the API handlers, grows one
  slice at a time rather than guessed at all 40 endpoints up front.

## Backend gaps this frontend will hit

Tracked, not yet fixed in `../photoApp`:

1. No bulk-download endpoint — the core client promise (D-28 plans Cloudinary
   archive, signed server-side; its asset/size limits are **unverified** and a
   400-photo wedding is exactly where that matters)
2. No read-path expiry filter — expired albums are still fully readable
3. List endpoints unpaginated (clients, albums, invites, templates)
4. Offset pagination where keyset belongs (photos, messages)
5. No signed direct-to-Cloudinary upload — the fix is frontend-shaped
6. Email templates link to generic pages, not resources (breaks D-34)
7. Express accepts only `Authorization: Bearer`, no cookie

## State of the repo

**Built:** project scaffold, `types/`, `mock-api/` (users/me, photographer
profile, client albums, photographer albums, album detail, album photos
paginated).

**Not built:** everything in `app/` is still create-next-app default. No API
client, no route skeleton, no auth, no TanStack Query.

**Next:** API client reading `API_URL` → `/portal` and `/studio` route skeleton →
server-rendered gallery pulling real data from the mock. Then the client
gallery slice proper: the D-44 hydration handoff, infinite scroll, aspect-ratio
skeletons.

## Open decisions

- **Styling** — CSS Modules is the scaffold default, not a decision. Tailwind
  vs. CSS Modules vs. vanilla-extract is an open design session.
- **Testing** — undecided. Recommendation: Vitest + React Testing Library, MSW
  for API mocks, Playwright for 2–3 critical flows. The API repo's tests were
  largely AI-generated; frontend tests should be hand-written.
- **Auth** — mocked via `MOCK_ROLE` until the API is deployed. The real design
  (D-36/D-37: httpOnly cookie session, Next forwarding the JWT to Express as a
  Bearer token, both behind one nginx origin) assumed a co-deployed API and is
  on hold rather than being designed around a server that does not exist.
