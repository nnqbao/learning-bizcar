import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { gate, nextId, now } from "./helpers";
import { boardOwner, boardVisible, boardWriteError } from "./classBoardRules";

/**
 * Shared class board. The Next server authenticates the viewer and passes who they are; these functions
 * only trust the app secret. Polls read rows with seq > since through the by_seq index, so an idle
 * poll reads nothing.
 */
const board = { secret: v.string(), cohortId: v.number(), lessonNumber: v.number() };
const CHANGES_MAX = 400;

export const changes = query({
  args: { ...board, since: v.number(), userId: v.number(), staff: v.boolean() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const rows = await ctx.db
      .query("classBoardRows")
      .withIndex("by_seq", (q) => q.eq("cohortId", args.cohortId).eq("lessonNumber", args.lessonNumber).gt("seq", args.since))
      .take(CHANGES_MAX);
    const actor = { userId: args.userId, staff: args.staff };
    const seq = rows.reduce((max, row) => Math.max(max, row.seq), args.since);
    return {
      seq,
      more: rows.length === CHANGES_MAX,
      rows: rows.filter((row) => boardVisible(row, actor)).map((row) => ({
        kind: row.kind,
        key: row.key,
        userId: row.userId,
        data: row.deleted === 1 ? null : row.dataJson,
        seq: row.seq,
        updatedAt: row.updatedAt,
      })),
    };
  },
});

export const write = mutation({
  args: { ...board, actorId: v.number(), staff: v.boolean(), kind: v.string(), key: v.string(), dataJson: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    gate(args.secret);
    const slot = (kind: string, key: string) => ctx.db
      .query("classBoardRows")
      .withIndex("by_slot", (q) => q.eq("cohortId", args.cohortId).eq("lessonNumber", args.lessonNumber).eq("kind", kind).eq("key", key))
      .unique();
    const existing = await slot(args.kind, args.key);
    let memberGroupId: number | null = null;
    if (args.kind === "group" && !args.staff) {
      const member = await slot("member", String(args.actorId));
      const groupId = member && member.deleted !== 1 ? Number((JSON.parse(member.dataJson) as { groupId?: unknown }).groupId) : NaN;
      memberGroupId = Number.isInteger(groupId) ? groupId : null;
    }
    const error = boardWriteError({
      actor: { userId: args.actorId, staff: args.staff },
      kind: args.kind,
      key: args.key,
      dataJson: args.dataJson,
      existing,
      memberGroupId,
    });
    if (error) return { ok: false as const, error };
    const seq = await nextId(ctx, "classBoardRows");
    const stamp = now();
    const fields = { dataJson: args.dataJson ?? "", deleted: args.dataJson === null ? 1 : 0, seq, updatedAt: stamp, updatedBy: args.actorId };
    if (existing) {
      await ctx.db.patch(existing._id, fields);
    } else {
      if (args.dataJson === null) return { ok: true as const, seq: 0 };
      await ctx.db.insert("classBoardRows", {
        cohortId: args.cohortId,
        lessonNumber: args.lessonNumber,
        kind: args.kind,
        key: args.key,
        userId: boardOwner(args.kind, args.key, args.actorId),
        ...fields,
      });
    }
    return { ok: true as const, seq };
  },
});

/** Learners of a class, for group lists and the instructor tables. Read once when a board page opens. */
export const roster = query({
  args: { secret: v.string(), cohortId: v.number() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const seats = (await ctx.db.query("enrollments").withIndex("by_cohort", (q) => q.eq("cohortId", args.cohortId)).collect())
      .filter((row) => row.memberRole === "learner");
    const people = await Promise.all(seats.map(async (seat) => {
      const user = await ctx.db.query("users").withIndex("by_legacy", (q) => q.eq("legacyId", seat.userId)).unique();
      return user && user.active === 1 ? { id: user.legacyId, name: user.displayName } : null;
    }));
    return people.filter((row): row is { id: number; name: string } => row !== null).sort((a, b) => a.name.localeCompare(b.name, "vi"));
  },
});
