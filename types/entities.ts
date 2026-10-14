/**
 * types/entities.ts
 *
 * One interface per database table in the API, copied from the backend repo
 * (photoApp/src/types/index.ts). camelCase here, snake_case in the database.
 *
 * ⚠️ HAND-MAINTAINED COPY — see the note in ./enums.ts.
 *
 * These describe the shape the SERVER holds, where timestamps are `Date`.
 * In this app, always wrap them: `Serialized<Album>`, not `Album`.
 */

import { UserRole, AlbumType, PhotoStatus, InviteStatus, AnswerType, VisibilityType } from './enums';

// ───────────────────────────── Auth & Users ─────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  providerId: string;   // Auth0 external reference
  joinedAt: Date;
}

/** One-to-one with User where role = 'photographer'. userId is both PK and FK. */
export interface Photographer {
  userId: string;
  bio: string;
  profilePhotoUrl: string;
  instagramHandle: string;
  visibility: VisibilityType;
}

/** One-to-one with User where role = 'client'. Always linked to one photographer. */
export interface Client {
  userId: string;
  photographerId: string;
}

// ───────────────────────────── Photos & Albums ─────────────────────────────

/**
 * accessExpiresAt = shootDate + 3 years for shoot albums; null for portfolio
 * albums, which never expire. warned*At track which expiry warnings were sent.
 */
export interface Album {
  id: string;
  photographerId: string;
  clientId: string | null;          // null for portfolio albums
  thumbnailPhotoId: string | null;
  type: AlbumType;
  shootDate: Date;
  accessExpiresAt: Date | null;     // null = never expires
  warned90At: Date | null;
  warned30At: Date | null;
  warned7At: Date | null;
  createdAt: Date;
}

/**
 * Metadata only — the bytes live in Cloudinary. All three variants derive from
 * basePath by convention:
 *   {basePath}/original.jpg · {basePath}/standard.jpg · {basePath}/thumbnail.jpg
 *
 * width/height are null until the upload processor reads them back from
 * Cloudinary. This app uses them to reserve aspect-ratio-correct space before
 * the image loads, which is what keeps CLS at zero.
 */
export interface Photo {
  id: string;
  basePath: string;
  status: PhotoStatus;      // 'processing' until Cloudinary confirms, then 'ready'
  width: number | null;
  height: number | null;
  uploadedAt: Date;
}

/** Join table — a photo can belong to several albums. */
export interface PhotoAlbum {
  photoId: string;
  albumId: string;
  addedAt: Date;
  isCover: boolean;
}

// ───────────────────────────── Messaging ─────────────────────────────

/**
 * One per photographer–client pair. The unread counters are per participant:
 * a send increments only the recipient's side, and marking read zeroes only
 * the caller's. This app never predicts those counters — it reads them.
 */
export interface Conversation {
  id: string;
  photographerId: string;
  clientId: string;
  mostRecentMessageId: string | null;
  unreadForPhotographer: number;
  unreadForClient: number;
  lastMessageAt: Date | null;
  createdAt: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  sentAt: Date;
  readAt: Date | null;    // null = unread
}

// ───────────────────────── Forms & Questionnaires ─────────────────────────

export interface FormTemplate {
  id: string;
  photographerId: string;
  name: string;
  createdAt: Date;
}

/** order is the index of the submitted array — dense, 0-based, unique per template. */
export interface FormQuestion {
  id: string;
  templateId: string;
  content: string;
  answerType: AnswerType;
  order: number;
}

/**
 * One instance of a template assigned to one client. Self-contained by design
 * (backend migration 019): it carries a frozen copy of the questions it was
 * assigned, so it renders without reading its template and the photographer
 * stays free to edit that template afterwards.
 */
export interface FormResponse {
  id: string;
  templateId: string;
  clientId: string;
  /** Frozen snapshot, taken at assign time. */
  questions: FormQuestion[];
  /** Keyed by question id. A missing key is what "unanswered" means. */
  answers: FormAnswerMap;
  assignedAt: Date;
  submittedAt: Date | null;    // null = in progress
}

export type FormAnswerMap = Record<string, string>;

// ───────────────────────────── Invites ─────────────────────────────

export interface Invite {
  id: string;
  photographerId: string;
  email: string;
  clientName: string;
  token: string;
  status: InviteStatus;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
}
