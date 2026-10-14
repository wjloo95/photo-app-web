/**
 * types/serialized.ts
 *
 * The server/client serialization boundary, expressed as a type.
 *
 * The entity types in ./entities describe what the *API server* holds: `pg`
 * returns real `Date` objects, so `Album.shootDate` is a `Date`. This app
 * never sees a `Date` from the API — JSON has no date type, so what actually
 * arrives over the wire (and across React Server Component serialization) is
 * an ISO-8601 string.
 *
 * Declaring that twice — one interface with `Date`, a parallel one with
 * `string` — is how two type families drift apart. So there is one
 * declaration and this transform derives the wire view from it:
 *
 *     Album              → shootDate: Date      (what the server holds)
 *     Serialized<Album>  → shootDate: string    (what this app receives)
 *
 * Use `Serialized<T>` everywhere in this app. Add a field to `Album` and the
 * client view updates with no second edit.
 *
 * Why this exists: the backend already hit this bug one layer down, where
 * `JSON.parse(raw) as T` returned an ISO string while TypeScript still
 * claimed `Date`. It hid for a long time because ISO-8601 sorts
 * lexicographically the same as chronologically, so comparisons kept working
 * and only `.getTime()` misbehaved. A type system stops being load-bearing at
 * a serialization boundary unless the boundary is itself typed.
 *
 * Conditional types distribute over unions when the checked type is a bare
 * type parameter, so `Date | null` becomes `string | null` rather than
 * collapsing — which is what keeps nullable timestamp columns intact.
 */
export type Serialized<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Serialized<U>[]
    : T extends object
      ? { [K in keyof T]: Serialized<T[K]> }
      : T;
