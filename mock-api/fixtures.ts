/**
 * mock-api/fixtures.ts
 *
 * Seed data for the mock API. Typed against the same contracts the real app
 * consumes (types/), so a fixture that drifts from the contract is a compile
 * error rather than a runtime surprise.
 *
 * Everything here is in the SERIALIZED shape — ISO strings, not Date objects —
 * because that is what an HTTP response actually contains.
 */

import type { ApiAlbum, ApiPhoto, ApiUser } from '../types';
import { AlbumType, PhotoStatus, UserRole, VisibilityType } from '../types';

export const PHOTOGRAPHER_ID = '11111111-1111-4111-8111-111111111111';
export const CLIENT_ID = '22222222-2222-4222-8222-222222222222';

export const users: Record<string, ApiUser> = {
  photographer: {
    id: PHOTOGRAPHER_ID,
    email: 'maya@mayarosephoto.com',
    name: 'Maya Rose',
    role: UserRole.photographer,
    providerId: 'auth0|mock-photographer',
    joinedAt: '2024-03-02T10:00:00.000Z',
  },
  client: {
    id: CLIENT_ID,
    email: 'dani.and.sam@example.com',
    name: 'Dani Okafor',
    role: UserRole.client,
    providerId: 'auth0|mock-client',
    joinedAt: '2026-05-18T14:30:00.000Z',
  },
};

export const photographerProfile = {
  userId: PHOTOGRAPHER_ID,
  bio: 'Documentary wedding and portrait work. Bay Area, travels gladly.',
  profilePhotoUrl: 'photographers/11111111/profile',
  instagramHandle: 'mayarosephoto',
  visibility: VisibilityType.private,
};

/**
 * Two albums, deliberately different:
 *  - a shoot album with a client and an expiry date (the common case)
 *  - a portfolio album with clientId null and accessExpiresAt null, which is
 *    what backend migration 020 made possible and what the expiry sweep must
 *    never touch. Having one here means the UI gets exercised against both.
 */
export const albums: ApiAlbum[] = [
  {
    id: 'a1111111-1111-4111-8111-111111111111',
    photographerId: PHOTOGRAPHER_ID,
    clientId: CLIENT_ID,
    thumbnailPhotoId: 'p0000000-0000-4000-8000-000000000003',
    type: AlbumType.shoot,
    shootDate: '2026-06-14T00:00:00.000Z',
    accessExpiresAt: '2029-06-14T00:00:00.000Z',
    warned90At: null,
    warned30At: null,
    warned7At: null,
    createdAt: '2026-06-20T09:15:00.000Z',
  },
  {
    id: 'a2222222-2222-4222-8222-222222222222',
    photographerId: PHOTOGRAPHER_ID,
    clientId: null,
    thumbnailPhotoId: null,
    type: AlbumType.portfolio,
    shootDate: '2026-01-10T00:00:00.000Z',
    accessExpiresAt: null,
    warned90At: null,
    warned30At: null,
    warned7At: null,
    createdAt: '2026-01-12T11:00:00.000Z',
  },
];

/**
 * Photo dimensions vary on purpose. A grid built against uniformly square
 * fixtures looks fine and then shifts the moment real portrait and landscape
 * frames arrive — so the fixtures are mixed from the start.
 *
 * Two photos are left at `processing` with null dimensions, which is the state
 * a freshly uploaded photo sits in before the worker reads its size back from
 * Cloudinary. The UI has to render something sensible for those.
 */
const DIMENSIONS: Array<[number, number]> = [
  [1600, 1067], [1067, 1600], [1600, 1067], [1600, 900], [1200, 1200],
  [1067, 1600], [1600, 1067], [900, 1600], [1600, 1067], [1400, 1050],
];

function makePhotos(count: number): ApiPhoto[] {
  return Array.from({ length: count }, (_, i) => {
    const n = String(i + 1).padStart(3, '0');
    const processing = i === count - 1 || i === count - 2;
    const [width, height] = DIMENSIONS[i % DIMENSIONS.length];
    return {
      id: `p0000000-0000-4000-8000-000000000${n}`,
      basePath: `albums/okafor-wedding/photo-${n}`,
      status: processing ? PhotoStatus.processing : PhotoStatus.ready,
      width: processing ? null : width,
      height: processing ? null : height,
      uploadedAt: new Date(Date.UTC(2026, 5, 20, 9, 20, i)).toISOString(),
    };
  });
}

export const photosByAlbum: Record<string, ApiPhoto[]> = {
  'a1111111-1111-4111-8111-111111111111': makePhotos(63),
  'a2222222-2222-4222-8222-222222222222': makePhotos(18),
};
