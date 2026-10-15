# API Surface

The 40 endpoints this frontend consumes. Transcribed from the backend repo's
`photography_app_architecture.md` so Claude Code does not have to invent
endpoint shapes — **if a response shape is not described here, read the real
handler in `../photoApp/src/routes/` rather than guessing.**

Only a subset is implemented in `mock-api/` today. Everything else needs a mock
handler written before the slice that uses it. `mock-api/server.ts` returns a
404 naming the missing route, which is the signal.

## Rules that apply to every endpoint

- **All list endpoints are identity-scoped.** The server filters by the JWT
  identity, never by a URL parameter. `GET /conversations` takes no id at all.
- **A client id in a URL is never trusted on its own.** Client-scoped routes run
  a shared `assertCanReadClient` check: readable by that client, or by their
  photographer. The mock reproduces this and returns 403.
- **Access splits by column, not by role.** `GET /responses/:id` passes for the
  owning client *or* the template's photographer; the two write endpoints pass
  for the client alone. A photographer may read a response and never answer it.
- **Timestamps arrive as ISO-8601 strings.** Use `Serialized<T>` from
  `types/serialized.ts`, never the raw entity type.

Legend: ✅ mocked · ⬜ needs a mock handler · ⚠️ not built in the real API

## Users

| | Path | Returns / notes | | |
|---|---|---|---|---|
| POST | `/users` | Auth0 webhook, creates user + role profile + conversation in one transaction. Internal — the frontend never calls it | internal | ⬜ |
| GET | `/users/me` | `User`. **The identity bootstrap** — the JWT's `sub` is an Auth0 id, but every URL here is keyed by the app's own UUID, and the shell needs `role` to know which product to render. Auth0 custom claims were rejected (D-26): the users table is the source of truth | both | ✅ |
| PATCH | `/users/:id` | Update email and name | both | ⬜ |
| DELETE | `/users/:id` | — | both | ⚠️ not built. Cascades across nine tables; the right cascade behaviour is an unanswered retention-policy question |

## Photographers

| | Path | Returns / notes | | |
|---|---|---|---|---|
| GET | `/photographers/:id` | `Photographer`. **One shape for every caller** — no role branching (D-18). None of the fields are private; they are storefront content | both | ✅ |
| PATCH | `/photographers/:id` | Update profile fields | photographer | ⬜ |
| POST | `/photographers/:id/photo` | Profile photo, **synchronous 200** not 202 — one small image, no derivative work, and the user is staring at the result. Cloudinary public id is deterministic (`photographers/{id}/profile`) with `overwrite`, so replacing an avatar overwrites the same asset | photographer | ⬜ |
| GET | `/photographers/:id/clients` | `Client[]` — **unpaginated** | photographer | ⬜ |
| GET | `/photographers/:id/albums` | `Album[]` — **unpaginated** | photographer | ✅ |
| GET | `/photographers/:id/invites` | `Invite[]` — **unpaginated** | photographer | ⬜ |
| GET | `/photographers/:id/templates` | `FormTemplate[]` — **unpaginated** | photographer | ⬜ |

## Clients

| | Path | Returns / notes | | |
|---|---|---|---|---|
| GET | `/clients/:id/albums` | `Album[]`. **How a client discovers their galleries at all** — `GET /albums/:id` needs an id they already have, and the photographer-scoped list is closed to them | both | ✅ |
| GET | `/clients/:id/responses` | Response **summaries** — no question snapshots | both | ⬜ |

`GET /clients/:id` and `GET /clients/:id/conversations` do not exist. `Client` is
only `{userId, photographerId}`, and `GET /conversations` is already
identity-scoped.

## Invites

| | Path | Returns / notes | | |
|---|---|---|---|---|
| POST | `/invites` | Body `{email, clientName}` | photographer | ⬜ |
| POST | `/invites/:id/resend` | New token, +30 days, status → pending. **409 if already accepted** | photographer | ⬜ |
| DELETE | `/invites/:id` | Cancel | photographer | ⬜ |
| GET | `/invites/validate?token=` | **The only public endpoint.** Mounted before auth | public | ⬜ |

Acceptance creates user + client + conversation + invite status in **one
transaction**, with `SELECT … FOR UPDATE` on the invite so two concurrent
redemptions of the same token cannot both produce an account. Invite token is
64 hex chars, valid 30 days.

## Albums & Photos

| | Path | Returns / notes | | |
|---|---|---|---|---|
| POST | `/albums` | Create | photographer | ⬜ |
| GET | `/albums/:id` | `Album` | both | ✅ |
| PATCH | `/albums/:id` | Update (e.g. thumbnail) | photographer | ⬜ |
| DELETE | `/albums/:id` | Destructive — **not optimistic** (D-46) | photographer | ⬜ |
| GET | `/albums/:id/photos` | **`Paginated<Photo>`**, `?page=&limit=` — 20 default, 100 max, invalid params fall back to defaults rather than erroring | both | ✅ |
| POST | `/albums/:id/photos/batch` | Bulk upload. **Returns 202** plus rows at `status:'processing'`. 25 MB per file | photographer | ⬜ |
| DELETE | `/albums/:id/photos/batch` | Bulk remove from album | photographer | ⬜ |
| POST | `/albums/:id/photos/:photoId` | Add an existing photo to another album | photographer | ⬜ |
| DELETE | `/albums/:id/photos/:photoId` | Remove from this album only | photographer | ⬜ |
| GET | `/photos/:id` | `Photo` | both | ⬜ |
| DELETE | `/photos/:id` | Permanent, system-wide | photographer | ⬜ |

**Three things about photos that shape the UI:**

- `basePath` is the only stored field; all three variants derive by convention:
  `{basePath}/original.jpg`, `/standard.jpg`, `/thumbnail.jpg`. A fourth variant
  would break that convention — which is why there is no blurred LQIP (D-33).
- `width`/`height` are **null until the worker reads them back from Cloudinary**.
  They exist so the grid can reserve aspect-ratio-correct space before the image
  loads; that is what keeps CLS at zero. Render something sensible for null.
- A photo is many-to-many with albums, so it has **no owner column**. Access is
  derived through every album it belongs to, and deletion only destroys the
  Cloudinary asset when the photo was in exactly one album.

## Conversations & Messages

| | Path | Returns / notes | | |
|---|---|---|---|---|
| GET | `/conversations` | **Takes no id** — identity-scoped, branches on the caller's role. Unpaginated *and* cached 2 min server-side | both | ⬜ |
| GET | `/conversations/:id` | `Conversation` | both | ⬜ |
| GET | `/conversations/:id/messages` | **`Paginated<Message>`** — 50 default, 100 max. Offset-paginated, which is the wrong choice for time-ordered data: the page shifts under the reader when a message arrives mid-scroll | both | ⬜ |
| POST | `/conversations/:id/messages` | Send. 5,000 char max. Inserts the message and updates the conversation's denormalised fields in one transaction | both | ⬜ |
| PATCH | `/conversations/:id/read` | Marks the whole conversation read. **`SET = 0`, so idempotent by construction** — which is what makes the optimistic version safe (D-46) | both | ⬜ |

`Conversation` carries four denormalised fields: `mostRecentMessageId`,
`lastMessageAt`, and **two per-participant unread counters**. A send increments
only the recipient's side. **Never predict these on the client** (D-47) — that
invariant was already subtly wrong once server-side.

Messages and unread counts are **never cached server-side** — zero staleness
tolerance. `messages.readAt` is a dead column; nothing writes it any more.

## Forms & Questionnaires

| | Path | Returns / notes | | |
|---|---|---|---|---|
| POST | `/templates` | Create template **with all its questions**, max 25 | photographer | ⬜ |
| GET | `/templates/:id` | Template with questions embedded, ordered by `order` | photographer | ⬜ |
| PUT | `/templates/:id` | **PUT not PATCH** — the body is the complete new state. Replaces name + the whole question set, so `order` is just the array index | photographer | ⬜ |
| DELETE | `/templates/:id` | **409 while any response exists**, backed by `ON DELETE RESTRICT` | photographer | ⬜ |
| POST | `/templates/:id/responses` | Assign to a client. Snapshots the questions atomically inside the `INSERT … SELECT` | photographer | ⬜ |
| GET | `/responses/:id` | `FormResponse` **with its frozen question snapshot** | both | ⬜ |
| GET | `/clients/:id/responses` | Summaries, no snapshots | both | ⬜ |
| GET | `/photographers/:id/templates` | `FormTemplate[]` | photographer | ⬜ |
| POST | `/responses/:id/answers` | Upsert one answer. Single-statement JSONB merge | **client only** | ⬜ |
| PATCH | `/responses/:id/submit` | Terminal — **no unsubmit** | **client only** | ⬜ |

**The model matters for the UI.** A response carries a frozen copy of the
questions it was assigned, so it renders **without ever reading its template**.
The template is a drafting surface; the response is a record. That is why `PUT`
has no edit lock — editing a template cannot reach a form already in a client's
hands.

Both write endpoints carry `AND submitted_at IS NULL` **in the statement that
writes**, so the loser of a race matches no row and gets null back. The handler
also returns 409 from its own check, but the guard in the `WHERE` clause is what
actually closes the gap. Answers are `Record<questionId, string>` — every type
stored as text, booleans as `'true'`/`'false'`, dates as ISO strings. **A missing
key is what "unanswered" means**; there is no empty-string state and no
`required` concept anywhere, so a form can be submitted with any subset answered.

Questions have no endpoints of their own.

## Limits worth knowing

| | |
|---|---|
| Max upload | 25 MB per file (album batch) · 5 MB (profile photo, image MIME only) |
| Max questions per template | 25, rejected at validation before any transaction opens |
| Max message / answer length | 5,000 characters each |
| Page sizes | photos 20 / 100 max · messages 50 / 100 max |
| Photo retention | `shootDate + 3 years`, **shoot albums only**; portfolio never expires |
| Expiry warnings | 90 / 30 / 7 days before, to the **client** |
| Invite validity | 30 days, resettable by resend |

## Server-side caching (affects how stale a read can be)

| Resource | TTL | Invalidation |
|---|---|---|
| Album photo list | 5 min | event: photo added/deleted |
| Album metadata | 15 min | event: thumbnail updated |
| Photographer profile | 1 hour | TTL only |
| Conversation list | 2 min | event: new message sent |
| **Messages, unread counts, form responses** | **never cached** | — |

Relevant because this frontend adds its own caches on top. **D-42: one resource,
one cache owner.** The 2-minute conversation-list TTL is also why live push was
rejected (D-30) — it would invalidate that cache for no user-visible gain.

## Gaps — the API does not do these yet

1. **No bulk download.** The core client promise. D-28 plans a Cloudinary archive
   signed server-side (it cannot be a browser call — signing needs the API
   secret). Its per-archive asset and size limits are **unverified**, and a
   400-photo / ~2.4 GB wedding is exactly where that matters.
2. **No read-path expiry filter.** "Access expires after 3 years" and "data is
   eventually deleted" are different promises and only the second is
   implemented — an expired album is still fully readable until the sweep runs.
   A fix must cover the single-album read *and* the client's album list together,
   or an album becomes visible directly and invisible in its own list.
3. **List endpoints unpaginated** — clients, albums, invites, templates.
4. **Offset pagination where keyset belongs** — photos and messages. The
   composite index for keyset already exists.
5. **No signed direct-to-Cloudinary upload.** The batch endpoint stages files on
   the API server's local disk and the worker reads them back by path, which
   breaks silently with two API instances. The fix is frontend-shaped.
6. **Email templates link to generic pages**, not resources — breaks D-34 and
   silently spends the 650 ms it saved.
7. **Express accepts only `Authorization: Bearer`**, no cookie — needed for
   same-origin client reads under D-36/D-37.
