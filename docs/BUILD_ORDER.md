# Build Order

Phases ordered by dependency and interview value, not by how the product reads.
Each phase names the design decision it exercises, what to write by hand, and
what is fine to delegate.

**The split is the point.** This project exists to build hands-on fluency, which
is already behind the design reasoning. Code handed over is code not learned.

Per phase: write it → run it → break it → fix it → *then* ask for review. Ask
"why" on every suggestion.

---

## Phase 0 — Foundations ← current

**Write by hand:** nothing yet. This is plumbing.

- [ ] API client reading `API_URL` (server) / `NEXT_PUBLIC_API_URL` (browser).
      One typed `apiFetch<T>` with error handling. Where `Serialized<T>` gets
      applied, and where the session header or cookie will eventually attach.
- [ ] Route skeleton per D-39 — `/gallery/*` and `/studio/*` with layouts, placeholder
      pages, and a shared root layout kept lean (D-49, `docs/DECISIONS.md`).
- [ ] Prove the chain: one server component fetching `GET /users/me` from the
      mock and rendering the name.

**Delegate freely.** No decisions live here.

**Done when** `npm run dev:all` shows real mock data on screen.

---

## Phase 1 — Client gallery

The highest-value phase. Three decisions land here and all three get asked about.

**Write by hand:** the hydration handoff, the grid, the skeleton sizing.

- [ ] **D-44 — the handoff.** RSC fetches photos page 1, dehydrates the query
      cache into the payload, client hydrates it as already-fresh. Get this
      wrong and the client refetches page 1 and the server render was wasted.
      *Verify by watching the network tab: there must be no page-1 request
      after hydration.*
- [ ] **D-33 — aspect-ratio skeletons** from `photo.width`/`height`. Handle the
      two fixture photos with `null` dimensions.
- [ ] **D-45** — `Serialized<T>` everywhere. No `Date` on the client.
- [ ] Infinite scroll, pages 2+ client-side. Offset pagination means the page
      shifts if rows change mid-scroll — know that and decide what to do.
- [ ] **D-32** — measure LCP on the first real thumbnail, not the skeleton.

**Delegate:** CSS Module boilerplate, the intersection-observer hook after
you've written one yourself.

**Drill first (no AI, timed 45–60 min):** infinite scroll in plain React, then a
virtualized list.

**Done when** 63 photos render, scroll at 60 fps, CLS ≈ 0, and LCP is under
2.5 s with `MOCK_DELAY_MS=250`.

---

## Phase 2 — Lightbox as a route

- [ ] **D-41** — `/gallery/albums/:albumId/p/:photoId`. Shareable URL, working back
      button.
- [ ] **Closing it must not refetch the grid behind it.** This is the part that
      goes wrong.
- [ ] Keyboard: arrows, Escape, focus trap, focus restored to the originating
      thumbnail on close.

**Write by hand:** all of it. Focus management is the thing AI is worst at and
interviewers probe hardest.

**Drill first:** accessible modal, then a carousel.

---

## Phase 3 — Photographer grid multi-select

- [ ] **D-48** — external store with per-item subscriptions.
- [ ] **Measure first.** Build it in grid-level React state, count the
      re-renders with the Profiler, then move it and count again. Record both
      numbers. "I measured 400 re-renders per toggle and got it to 2" is worth
      more than having started correct.
- [ ] Shift-click ranges, select-all, bulk remove.

**Write by hand:** the store and the subscription wiring.

**Drill first:** selectable data table.

---

## Phase 4 — Messaging

- [ ] **D-30** — `MessageTransport` port; `PollingTransport` ships, `SSETransport`
      behind a flag. Mirrors the backend's `EmailSender` port.
- [ ] **D-46** — optimistic send with rollback. Expect this to fight Server
      Actions; a documented exception is likely and is a better artifact than a
      rule quietly bent.
- [ ] **D-47** — **never predict the unread counter.** Append the message
      optimistically, read the counter from the server.
- [ ] Needs mock handlers: all five conversation/message routes.

**Write by hand:** the transport interface, the optimistic update and its
rollback.

**Drill first:** chat UI, or debounced autocomplete.

---

## Phase 5 — Forms with autosave

- [ ] Render from the response's **frozen question snapshot**, never the
      template.
- [ ] Per-answer upsert, debounced. The write carries
      `AND submitted_at IS NULL` server-side, so **handle losing that race** —
      null comes back, not an error.
- [ ] Three answer types: text, date, boolean. A missing key means unanswered.
- [ ] Needs mock handlers: `/responses/:id`, `/responses/:id/answers`,
      `/responses/:id/submit`, `/clients/:id/responses`.

**Write by hand:** schema-driven rendering, the autosave state machine
(idle / dirty / saving / saved / failed).

**Drill first:** form with validation and debounced save.

---

## Phase 6 — Invites and the unauthenticated flow

- [ ] `/invite/:token` — the only public route. Validate before paint, no flash
      of an invalid-invite screen.
- [ ] Accept → the four-record transaction server-side.
- [ ] Invite list, create, resend (409 if accepted), cancel. **Not optimistic**
      (D-46).

---

## Phase 7 — Upload queue

The strongest interview story and the most complex build. **Design Session 4 was
opened and never closed** — four questions outstanding:

1. Direct-to-Cloudinary signed upload, or keep staging on the API's disk?
2. Dual completion reporting (client reports + Cloudinary webhook backstop), or
   client-only and accept stranded rows?
3. IndexedDB: store file **bytes**, or metadata + re-select on resume? (A `File`
   handle is dead after reload — that is the whole problem.)
4. Concurrency limit fixed at 4, or adaptive?

**Settle those as a spoken design rep before building.**

- [ ] **D-29** — queue persists to IndexedDB, survives reload.
- [ ] Concurrency-limited queue, per-file progress and retry.
- [ ] Partial failure: 500 files, 12 fail. Failures stay in the queue panel as
      retryable; the album shows what succeeded. **Never a silent partial.**
- [ ] `processing → ready` reconciliation.

**Write by hand:** all of it.

**Drill first:** file uploader with progress.

**If time runs short, cover the design in depth even with a partial build** —
the reasoning is what gets asked about.

---

## Deferred until the API is deployed

- **Real auth.** D-36/D-37 — httpOnly cookie session, Next forwarding the JWT as
  a Bearer token, same-origin behind one nginx. Until then `MOCK_ROLE` is the
  whole session model.
- **Bulk download** (D-28) — needs an endpoint that does not exist, and
  Cloudinary's archive limits verified.
- **Expiry UI** — countdown banners and the bulk-download prompt. Depends on
  backend gap #2.

---

## Still undecided

| | |
|---|---|
| **Styling** | CSS Modules is the scaffold default, not a decision. Settle before Phase 1 gets far — retrofitting is annoying |
| **Testing** | Recommendation: Vitest + React Testing Library, MSW for API mocks, Playwright for 2–3 flows. The backend's tests were largely AI-generated; **write these by hand** |

---

## What good looks like

Per the grading axes:

- **Architecture** — state lives in the right place, component boundaries are
  clear, and you can explain the tradeoff without notes.
- **Feel** — loading, empty and error states exist. No layout shift. Instant
  response where it should be. Keyboard and focus work.
- **PR quality** — small diffs, clear names, typed edges, tests for behaviour
  that matters, and a description that explains *why*.

Each phase should end as a PR you would be comfortable showing a hiring manager,
and you should be able to defend every decision in it against its D-number.
