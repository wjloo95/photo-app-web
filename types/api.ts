/**
 * types/api.ts
 *
 * API request/response contracts — the envelopes and composite shapes the
 * routes actually return, as distinct from the raw table rows in ./entities.
 *
 * These do not exist anywhere in the backend as declarations: they are
 * whatever each route handler happens to return. So this file is written by
 * reading the handlers, and it grows one feature slice at a time rather than
 * being guessed at all 40 endpoints up front.
 */

import { Serialized } from './serialized';
import { Album, Photo, User } from './entities';

/** What this app works with — never the Date-typed server shapes. */
export type ApiUser = Serialized<User>;
export type ApiAlbum = Serialized<Album>;
export type ApiPhoto = Serialized<Photo>;

/** Offset pagination, as GET /albums/:id/photos returns it today.
 *
 *  Known to be the wrong choice for time-ordered data: deep offsets make
 *  Postgres scan and discard, and the page shifts under the reader when new
 *  rows arrive mid-scroll. The backend's composite index already supports
 *  keyset pagination; moving to it is a tracked API change. */
export interface Paginated<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
}

/** GET /albums/:id/photos */
export type AlbumPhotosResponse = Paginated<ApiPhoto>;

/** GET /clients/:id/albums */
export type ClientAlbumsResponse = ApiAlbum[];
