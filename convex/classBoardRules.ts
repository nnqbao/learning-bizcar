/**
 * Who may write which slot of a shared class board, and who may read it. Pure: used by
 * convex/classBoard.ts (atomic check inside the mutation) and by lib/class-board.check.ts.
 *
 * Slots (kind / key):
 *   setup   / "groups"   group names, leader, pitcher             staff only
 *   member  / <userId>   { groupId } the learner's group           the learner (self-pick) or staff
 *   group   / <groupId>  { v1, v2 } group work, V1/V2 can lock     members of that group or staff
 *   lens    / <id>       one added view on a group                 anyone in the class; edit/delete: author or staff
 *   extract / <userId>   personal lesson learned                   the learner or staff; read: owner + staff
 *   resolve / <userId>   personal 90-day commitment                the learner or staff; read: owner + staff
 *   vote    / <userId>   { choice } the learner's Activate vote   the learner or staff; read: owner + staff
 */
export const BOARD_KINDS = ["setup", "member", "group", "lens", "extract", "resolve", "vote"] as const;
export type BoardKind = (typeof BOARD_KINDS)[number];
export const BOARD_DATA_MAX = 30000;
export const BOARD_GROUPS_MAX = 12;

export type BoardActor = { userId: number; staff: boolean };
export type BoardSlot = { userId: number; dataJson: string; deleted: number };

type Doc = Record<string, unknown>;
const rec = (value: unknown): Doc => (value && typeof value === "object" && !Array.isArray(value) ? value as Doc : {});

export function isBoardKind(kind: string): kind is BoardKind {
  return (BOARD_KINDS as readonly string[]).includes(kind);
}

export function parseBoardData(json: string): Doc | null {
  try {
    const value = JSON.parse(json) as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? value as Doc : null;
  } catch {
    return null;
  }
}

function keyError(kind: BoardKind, key: string) {
  if (kind === "setup") return key === "groups" ? null : "BAD_KEY";
  if (kind === "group") return /^\d{1,2}$/.test(key) && Number(key) >= 1 && Number(key) <= BOARD_GROUPS_MAX ? null : "BAD_KEY";
  if (kind === "lens") return /^[a-z0-9-]{6,40}$/.test(key) ? null : "BAD_KEY";
  return /^\d{1,9}$/.test(key) ? null : "BAD_KEY";
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * null when the write is allowed, else an error code.
 * `dataJson === null` deletes the slot. `memberGroupId` is the actor's own group (from its member slot).
 */
export function boardWriteError(input: {
  actor: BoardActor;
  kind: string;
  key: string;
  dataJson: string | null;
  existing: BoardSlot | null;
  memberGroupId: number | null;
}): string | null {
  const { actor, kind, key, dataJson, existing } = input;
  if (!isBoardKind(kind)) return "BAD_KIND";
  const badKey = keyError(kind, key);
  if (badKey) return badKey;
  const live = existing && existing.deleted !== 1 ? existing : null;
  let next: Doc | null = null;
  if (dataJson !== null) {
    if (dataJson.length > BOARD_DATA_MAX) return "TOO_LARGE";
    next = parseBoardData(dataJson);
    if (!next) return "BAD_DATA";
  }
  if (actor.staff) return null;

  switch (kind) {
    case "setup":
      return "FORBIDDEN";
    case "member": {
      if (key !== String(actor.userId)) return "FORBIDDEN";
      if (next === null) return "FORBIDDEN";
      const groupId = Number(next.groupId);
      return Number.isInteger(groupId) && groupId >= 1 && groupId <= BOARD_GROUPS_MAX ? null : "BAD_DATA";
    }
    case "group": {
      if (next === null) return "FORBIDDEN";
      if (input.memberGroupId !== Number(key)) return "NOT_IN_GROUP";
      const before = live ? parseBoardData(live.dataJson) ?? {} : {};
      for (const part of ["v1", "v2"]) {
        // A locked version stays exactly as pitched / chosen; only staff can unlock it.
        if (rec(before[part]).locked === true && !same(before[part], next[part])) return "LOCKED";
      }
      return null;
    }
    case "lens":
      if (live && live.userId !== actor.userId) return "FORBIDDEN";
      return null;
    case "extract":
    case "resolve":
    case "vote":
      if (key !== String(actor.userId)) return "FORBIDDEN";
      return next === null ? "FORBIDDEN" : null;
  }
}

/** Personal slots are private to their owner and staff; everything else is shared with the class. */
export function boardVisible(row: { kind: string; key: string }, actor: BoardActor) {
  if (actor.staff) return true;
  if (row.kind === "extract" || row.kind === "resolve" || row.kind === "vote") return row.key === String(actor.userId);
  return true;
}

/** Owner recorded on a new slot. */
export function boardOwner(kind: string, key: string, actorId: number) {
  if (kind === "member" || kind === "extract" || kind === "resolve" || kind === "vote") return Number(key);
  return actorId;
}
