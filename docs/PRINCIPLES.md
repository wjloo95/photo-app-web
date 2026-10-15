# Principles for decision-making

A guide for architecting frontend systems, drawn from real decisions in this
project. `docs/DECISIONS.md` records **what** was chosen. This file records the
**questions that got us there**, so they can be reused on a whiteboard.

Each principle has:
- **Ask:** the question to put to any design
- **Why:** what goes wrong if you skip it
- **Seen here:** where it decided something in this project
- **In an interview:** one way to say it out loud

There is a checklist at the bottom for running through a design quickly.

---

## 1. Start from who uses it and how, then pick mechanisms

**Ask:** Who uses this, on what device and network, how often, and what do they
need to see first?

**Why:** Mechanism-first designs optimize the wrong thing. The same feature can
have opposite requirements for two kinds of user.

**Seen here:**
- Clients arrive cold from an email link, on a phone, maybe on bad venue Wi-Fi.
  Photographers sit at a desk using a work tool. That one fact split the app into
  two products with different performance budgets.
- `/gallery` became `/portal` once we said out loud that clients will spend a
  lot of time *messaging* while planning a shoot, not just viewing photos.
- The photographer dashboard question: decide what they need in the first five
  seconds *before* asking which endpoints or backend changes it needs.

**In an interview:** "Before picking anything, who's the user and what's their
context? A client on venue Wi-Fi and a photographer at a desk want different
things from the same data."

---

## 2. Make the mistake impossible, not just unlikely

**Ask:** If someone is tired or careless, what's the easiest wrong thing to
write? Does it still compile?

**Why:** Rules that rely on people remembering get broken. A check enforced by
the type system, the build, or the folder structure can't be forgotten.

**Seen here:**
- `apiFetch` converts any type it's given into the dates-as-strings version.
  Writing `User` instead of `ApiUser` can't reintroduce the date crash, because
  `.getFullYear()` on a string is a compile error.
- A lint rule makes "portal imports studio code" fail the build, rather than
  relying on someone noticing in review.

**Watch out for:** when you *do* accept a rule instead of a wall (the shared
root layout must stay lean), write the rule down where people will see it, and
note what would make you switch to a wall.

**In an interview:** "I'd rather a mistake not compile than rely on a
convention. Where I accept a convention, I write it down and name the escape
hatch."

---

## 3. Ask who pays for it

**Ask:** Who downloads, runs, or waits for this, and do all of them benefit?

**Why:** Shared things are paid for by everyone who shares them. Costs that
look tiny per feature add up on the users with the tightest budget.

**Seen here:**
- Anything in the root layout is paid for by every page in both products,
  including login and invites. So the root stays lean.
- The bundler follows `import`s at build time. A shared grid that imports a
  selection toolbar ships it to clients even when a prop hides it. **The file
  that writes the `import` decides who pays.**

**In an interview:** "Follow the imports. A runtime flag hides a feature, but
the code still ships. If only one product needs it, that product should import
it."

---

## 4. Shared components expose slots, not role flags

**Ask:** Can I describe this prop without naming a product, page, or role?

**Why:** Props like `isStudio` or `showBulkActions` put knowledge of every caller
inside the shared component. Each new feature becomes another `if`, and its
code ships to everyone.

**Seen here:** `PhotoGrid` takes `onTileClick` and `renderTileOverlay`, where
the caller supplies the behavior. The studio plugs selection in from its own
folder. The grid never knows selection exists.

**In an interview:** "The shared component provides the hooks and each caller
supplies the behavior. That's inversion of control, and it keeps both the
component and the bundles honest."

---

## 5. When something changes, what re-renders?

**Ask:** When this value changes, what re-renders? What's the minimum that
*needs* to?

**Why:** State placed too high, or subscribed to too broadly, re-renders far
more than it should. On a 400-photo grid that's the difference between a
responsive click and a sluggish one.

**Seen here:**
- Selection in page-level state re-renders the page, the grid and all 400
  tiles on every click.
- An external store fixes it only if each tile subscribes to *its own* boolean
  (`selectedIds.has(id)`), not the whole Set. A new Set is never `===` the old
  one, so subscribing to the Set re-renders everything anyway.

**In an interview:** "Each subscriber should select the smallest value it
displays. One click should re-render one tile, and I'd measure that with the
Profiler."

---

## 6. One owner per piece of data

**Ask:** For each piece of data, who owns the copy everyone else trusts?

**Why:** Two caches holding the same data means two places to invalidate, and
the bugs live in the gap between them.

**Seen here:** the original architecture assigns every resource exactly one
owner: server-rendered (album metadata), client cache (photos, messages, form
answers), the URL (current album, photo, tab), IndexedDB (the upload queue), or
an external store (multi-select). TanStack Query holds only its four rows,
"because it was convenient" is not a reason to add more. The same question came
up one layer down: should Next cache API responses with `'use cache'` when the
API already caches them? No. The API clears its cache when data changes, and a
second cache in Next wouldn't hear about it.

**In an interview:** "I'd draw a table: resource, owner. If anything has two
owners, that's where the stale-data bugs will be."

---

## 7. Count round trips, not just kilobytes

**Ask:** How many sequential network round trips stand between the user's
click and something useful on screen?

**Why:** On a high-latency network, each round trip costs more than most
bundle trimming saves. Removing one sequential request is often the biggest win
available.

**Seen here:** emails deep-link straight to the album, not a landing page.
Server rendering resolves identity in the same response. `<Suspense>` sends the
page shell instantly and streams data in, instead of waiting for it.

**In an interview:** "Trimming 50 KB saves roughly what one round trip costs on
a 150 ms network. I'd look for waterfalls first."

---

## 8. Decide where the meaning is known

**Ask:** Who has enough context to make this call correctly?

**Why:** Low-level code sees mechanics (a status code), and the caller knows
meaning (is this expected?). Deciding at the wrong level forces guesses.

**Seen here:** a 404 on `/albums/:id` is normal (an old email link), while a 404
on `/users/me` means something is broken. `apiFetch` can't tell them apart, so
it always throws, and each page catches the failures *it* expects.

**In an interview:** "Same status code, different meaning. So the client
library reports, and the call site decides."

---

## 9. Choose the safe default for when someone forgets

**Ask:** If someone forgets to handle this, what happens? Is that outcome
loud or quiet?

**Why:** Something will always be forgotten. Make forgetting fail loudly
(an error page, a build error), never quietly (a blank name, wrong data).

**Seen here:**
- Uncaught API errors fall through to a shared error page, so the default is
  "broken" and not silently ignored.
- `fetch` doesn't throw on 404, so without a check a missing user renders as a
  blank name. That's quiet, which is why `apiFetch` checks `res.ok`.

**In an interview:** "I design the unhandled path first. Forgetting should
produce an error someone notices, not data that looks fine and isn't."

---

## 10. Don't pay for a risk that can't happen yet; write down when it can

**Ask:** Can this go wrong *today*? If not, what event makes it possible?

**Why:** Building protection early costs effort now for zero benefit, but
forgetting to build it later is how the risk bites. A written trigger solves
both.

**Seen here:**
- No runtime validation of API responses while the only API is the typed
  mock, because drift is impossible. The trigger is written down: revisit when
  `API_URL` first points at the real backend.
- Components move to the shared folder on their *second real use*, not on a
  guess that they might be shared someday.
- `apiFetch` is server-only until the first browser fetch (infinite scroll).
  How the browser proves who it is depends on login work that doesn't exist
  yet, so deciding now would be guessing. A `server-only` import makes
  accidental browser use a build error in the meantime (principle 2).

**In an interview:** "I'd defer that, and here's the specific event that makes
me revisit it."

---

## 11. Know which decisions are hard to undo

**Ask:** Once this is in users' hands, can I still change it cheaply?

**Why:** Most code decisions are reversible. Some aren't: anything users store,
share or bookmark. Spend your care there.

**Seen here:**
- URLs go into emails and become effectively permanent, so `/g`, `/p` and
  `/gallery` were renamed *before* any links went out.
- Folder structure, by contrast, can be reorganized any time, so it got less
  agonizing.

**In an interview:** "Is this a one-way door? URLs, public APIs and stored data
formats are. Component structure usually isn't."

---

## 12. Names are part of the design

**Ask:** Could someone misread this name, or could it mean two things?

**Why:** People reason from names. A misleading name produces wrong reasoning
that looks correct.

**Seen here:**
- A store field called `selected` was read as a boolean, which hid why
  subscribing to it re-rendered every tile. `selectedIds` would have prevented
  that.
- `p` meant "photo" in one URL and "portfolio" in another.

**In an interview:** "Booleans read as questions (`isSelected`), collections
are plural (`selectedIds`), and URLs use whole words."

---

## 13. Check your measurement before trusting it

**Ask:** Am I measuring the system, or my measuring tool?

**Why:** A wrong measurement is worse than none, because it sends you after a
bug that doesn't exist.

**Seen here:** a timing script read the response line by line. Next sends HTML
as one long line, so the script made streaming look broken when it wasn't.
Timing raw bytes showed the loading fallback arriving at 25 ms and the data at
290 ms, exactly as designed.

**In an interview:** "I'd measure before and after with a tool I trust: the
Profiler for re-renders, the network tab for requests. I'd sanity-check the
tool first."

---

## 14. Record what you rejected and what's held against your choice

**Ask:** What did I *not* pick, and what's the strongest argument against
what I did pick?

**Why:** A decision without its alternatives can't be defended or revisited.
In interviews, the trade-off is the answer; the choice alone isn't.

**Seen here:** every entry in `docs/DECISIONS.md` has a "Rejected" and a "Held
against it" section.

**In an interview:** "I went with X over Y because of Z. The cost is W, and
I'd revisit if V happens."

---

## Quick checklist for a design question

1. **Users:** who, on what device and network, doing what, how often?
2. **What's shared and what's separate?** Who pays for anything shared?
3. **Data:** what is each piece of data, and who is its one owner?
4. **Round trips:** how many sequential requests before something useful
   shows?
5. **Re-renders:** when this changes, what re-renders, and what's the minimum?
6. **Failure:** what if the server is down, says not found, says not allowed?
   Who decides which of those is expected?
7. **Forgetting:** if someone forgets a step, is the result loud or quiet?
8. **Mistakes:** can the easiest mistake be made not to compile?
9. **Reversibility:** which parts are one-way doors (URLs, stored data, public
   APIs)?
10. **Timing:** does this risk exist yet? If not, what's the trigger?
11. **Trade-offs:** what did I reject, what's held against my choice, and how
    would I measure whether it worked?
