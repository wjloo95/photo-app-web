/**
 * types/enums.ts
 *
 * PostgreSQL ENUM mirrors, copied from the backend repo
 * (photoApp/src/types/index.ts).
 *
 * ⚠️ HAND-MAINTAINED COPY. The backend is a separate repository, so nothing
 * enforces that this stays in sync with the API. If a response shape changes
 * server-side, this file compiles happily and breaks at runtime. That is the
 * accepted cost of separate repos at this stage — the alternative was a
 * monorepo with a shared package, which was tried and judged not worth the
 * setup cost before any frontend existed.
 *
 * When the API changes: update this file in the same change.
 */

export enum UserRole {
  photographer = 'photographer',
  client = 'client',
}

export enum AlbumType {
  shoot = 'shoot',
  portfolio = 'portfolio',
}

export enum PhotoStatus {
  processing = 'processing',
  ready = 'ready',
}

export enum InviteStatus {
  pending = 'pending',
  accepted = 'accepted',
  expired = 'expired',
}

// multiple_choice was removed in backend migration 018 — form_questions has
// nowhere to store the choices, so an answer of that type can't be validated.
export enum AnswerType {
  text = 'text',
  date = 'date',
  boolean = 'boolean',
}

export enum VisibilityType {
  public = 'public',
  private = 'private',
}
