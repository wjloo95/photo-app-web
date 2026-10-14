/**
 * mock-api/server.ts
 *
 * A stand-in for the real Express API, which is not deployed yet.
 *
 * Why a real HTTP server rather than MSW: this app uses React Server
 * Components, which fetch on the server, where a browser service worker does
 * not exist. MSW would need a second Node-side setup wired through
 * instrumentation.ts to cover those. A real server on localhost behaves
 * identically for RSC fetches and browser fetches, with no special-casing —
 * and swapping in the real API later is one environment variable.
 *
 * MSW still belongs in this project, in tests. This is for development.
 *
 * It intentionally reproduces the real API's quirks rather than an idealised
 * version of them:
 *   - offset pagination on photos (?page=&limit=), including its page-shift
 *     behaviour, because that is what the backend does today
 *   - identity-scoped reads: GET /users/me returns whoever MOCK_ROLE says,
 *     and client-scoped routes check that id against the caller
 *   - 202-shaped async: photos can sit at status 'processing' with null
 *     dimensions
 *
 * MOCK_DELAY_MS adds artificial latency. On localhost every response is
 * instant, which means loading and skeleton states never render and therefore
 * never get built. Default is deliberately non-zero.
 */

import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import {
  albums,
  photosByAlbum,
  photographerProfile,
  users,
  CLIENT_ID,
  PHOTOGRAPHER_ID,
} from './fixtures';
import { UserRole } from '../types';

const PORT = Number(process.env.MOCK_PORT ?? 4000);
const DELAY_MS = Number(process.env.MOCK_DELAY_MS ?? 250);

/** Which user the mock is "logged in" as. Real auth arrives with Auth0 once
 *  the API is deployed; until then this switch is the whole session model. */
const ROLE = (process.env.MOCK_ROLE ?? 'client') as 'client' | 'photographer';

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

/** Artificial latency on every response, so loading states are visible. */
app.use((_req, _res, next: NextFunction) => {
  if (DELAY_MS > 0) setTimeout(next, DELAY_MS);
  else next();
});

app.use((req, _res, next) => {
  // eslint-disable-next-line no-console
  console.log(`[mock] ${req.method} ${req.originalUrl}`);
  next();
});

const currentUser = () => users[ROLE];

// ───────────────────────────── Users ─────────────────────────────

/** The identity bootstrap. The real one resolves the Auth0 `sub` to a users
 *  row; this one just answers with whoever MOCK_ROLE names. */
app.get('/users/me', (_req: Request, res: Response) => {
  res.json(currentUser());
});

// ───────────────────────── Photographers ─────────────────────────

app.get('/photographers/:id', (req: Request, res: Response) => {
  if (req.params.id !== PHOTOGRAPHER_ID) return res.status(404).json({ error: 'Not found' });
  return res.json(photographerProfile);
});

// ───────────────────────────── Clients ─────────────────────────────

/**
 * Readable by the client themselves or by their photographer — the real API
 * runs this through a shared assertCanReadClient check, because a client id in
 * a URL is never trusted on its own. Mocked here as the same rule.
 */
app.get('/clients/:id/albums', (req: Request, res: Response) => {
  const me = currentUser();
  const isOwner = me.role === UserRole.client && me.id === req.params.id;
  const isTheirPhotographer = me.role === UserRole.photographer && req.params.id === CLIENT_ID;
  if (!isOwner && !isTheirPhotographer) return res.status(403).json({ error: 'Forbidden' });

  return res.json(albums.filter((a) => a.clientId === req.params.id));
});

// ───────────────────────── Albums & Photos ─────────────────────────

app.get('/photographers/:id/albums', (req: Request, res: Response) => {
  const me = currentUser();
  if (me.role !== UserRole.photographer || me.id !== req.params.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  return res.json(albums);
});

app.get('/albums/:id', (req: Request, res: Response) => {
  const album = albums.find((a) => a.id === req.params.id);
  if (!album) return res.status(404).json({ error: 'Not found' });

  const me = currentUser();
  const allowed =
    (me.role === UserRole.photographer && album.photographerId === me.id) ||
    (me.role === UserRole.client && album.clientId === me.id);
  if (!allowed) return res.status(403).json({ error: 'Forbidden' });

  return res.json(album);
});

/**
 * Offset pagination, matching the real endpoint: ?page= &limit=, limit capped,
 * invalid params falling back to defaults rather than erroring.
 */
app.get('/albums/:id/photos', (req: Request, res: Response) => {
  const all = photosByAlbum[req.params.id];
  if (!all) return res.status(404).json({ error: 'Not found' });

  const rawPage = Number(req.query.page);
  const rawLimit = Number(req.query.limit);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 100) : 20;

  const start = (page - 1) * limit;
  return res.json({
    data: all.slice(start, start + limit),
    page,
    limit,
    total: all.length,
  });
});

// ───────────────────────────── Fallback ─────────────────────────────

app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: `No mock handler for ${req.method} ${req.path}`,
    hint: 'Add one in mock-api/server.ts as the slice that needs it gets built.',
  });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(
    `[mock] API on http://localhost:${PORT}  role=${ROLE}  delay=${DELAY_MS}ms\n` +
      `[mock] switch role:  MOCK_ROLE=photographer npm run mock`,
  );
});
