# photo-app-web

Next.js frontend for the Photography Client Platform. The Express/Postgres API
is a separate repo (`../photoApp`) and is not deployed yet, so this app runs
against a mock API in `mock-api/`.

```bash
npm install
npm run dev:all     # Next on :3000, mock API on :4000
```

Then `http://localhost:3000`.

| | |
|---|---|
| `npm run dev:all` | both servers, colour-coded output |
| `npm run dev` | Next only |
| `npm run mock` | mock API only |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | eslint |

Switch the logged-in identity: `MOCK_ROLE=photographer npm run mock`

## Layout

```
app/        Next App Router — /portal/* is the client product, /studio/* the photographer's
types/      entity types copied from the API repo, plus Serialized<T>
mock-api/   Express stand-in for the real API, with typed fixtures
```

Architecture decisions, the working agreement, and known API gaps are in
[CLAUDE.md](./CLAUDE.md). Read that first.
