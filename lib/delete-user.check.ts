// Admin deletes an account: everything personal goes, class data of others stays. Run: npx tsx lib/delete-user.check.ts
import * as writes from "../convex/writes.ts";

function assert(cond: unknown, label: string) {
  if (!cond) throw new Error(label);
}
type Doc = Record<string, unknown> & { _id: string };
const tables = new Map<string, Doc[]>();
let n = 0;
const rows = (name: string) => { if (!tables.has(name)) tables.set(name, []); return tables.get(name)!; };
const add = (name: string, doc: Record<string, unknown>) => rows(name).push({ ...doc, _id: `${name}:${++n}` });
const find = (id: string) => [...tables.values()].flat().find((doc) => doc._id === id);
function builder(name: string, filters: [string, unknown][] = []) {
  const list = () => rows(name).filter((doc) => filters.every(([k, v]) => doc[k] === v));
  const api = {
    withIndex: (_: string, fn?: (q: unknown) => unknown) => { const next: [string, unknown][] = [...filters]; const q = { eq: (k: string, v: unknown) => { next.push([k, v]); return q; } }; fn?.(q); return builder(name, next); },
    collect: async () => list(),
    first: async () => list()[0] ?? null,
    unique: async () => list()[0] ?? null,
  };
  return api;
}
const ctx = { db: {
  query: (name: string) => builder(name),
  get: async (id: string) => find(id) ?? null,
  insert: async (name: string, value: Record<string, unknown>) => { add(name, value); return `${name}:${n}`; },
  patch: async (id: string, value: Record<string, unknown>) => { Object.assign(find(id)!, value); },
  delete: async (id: string) => { for (const list of tables.values()) { const at = list.findIndex((d) => d._id === id); if (at >= 0) list.splice(at, 1); } },
} };
const call = (args: Record<string, unknown>) => (writes.deleteUserAccount as unknown as { _handler: (c: unknown, a: unknown) => Promise<{ ok?: boolean; error?: string }> })._handler(ctx, { secret: "check", ...args });

process.env.APP_SECRET = "check";
add("users", { legacyId: 1, role: "admin", active: 1, username: "admin@x", usernameLower: "admin@x" });
add("users", { legacyId: 2, role: "admin", active: 1, username: "admin2@x", usernameLower: "admin2@x" });
add("users", { legacyId: 44, role: "user", active: 1, username: "Tu@x", usernameLower: "tu@x" });
add("users", { legacyId: 45, role: "user", active: 1, username: "an@x", usernameLower: "an@x" });
add("cohorts", { legacyId: 1, instructorId: 44, instructorIds: [44, 2, 1] });
add("cohorts", { legacyId: 9, instructorId: 44 });
add("cohorts", { legacyId: 5, instructorId: null });
add("counters", { name: "classBoardRows", value: 10 });
add("enrollments", { userId: 44, cohortId: 5 }); add("enrollments", { userId: 45, cohortId: 5 });
add("lessonAnswers", { userId: 44 }); add("lessonAnswers", { userId: 45 });
add("sessions", { userId: 44, token: "t" });
const slot = (kind: string, key: string, userId: number) => add("classBoardRows", { cohortId: 5, lessonNumber: 1, kind, key, userId, dataJson: "{}", deleted: 0, seq: 1, updatedAt: "", updatedBy: userId });
slot("member", "44", 44); slot("extract", "44", 44); slot("resolve", "44", 44); slot("vote", "44", 44);
slot("extract", "45", 45); slot("group", "1", 44); slot("lens", "labc123", 44);

(async () => {
  assert((await call({ actorId: 45, userId: 44 })).error, "only an admin deletes");
  assert((await call({ actorId: 1, userId: 2 })).error, "admin accounts are protected");
  assert((await call({ actorId: 1, userId: 1 })).error, "cannot delete yourself");
  assert((await call({ actorId: 1, userId: 999 })).error, "unknown account");
  const result = await call({ actorId: 1, userId: 44 });
  assert(result.ok, `delete ok: ${result.error}`);
  assert(!rows("users").some((u) => u.legacyId === 44) && rows("users").some((u) => u.legacyId === 45), "only that account is gone");
  assert(!rows("enrollments").some((r) => r.userId === 44) && rows("enrollments").some((r) => r.userId === 45), "enrollments");
  assert(!rows("lessonAnswers").some((r) => r.userId === 44) && rows("lessonAnswers").length === 1, "answers");
  assert(rows("sessions").length === 0, "sessions");
  const board = rows("classBoardRows");
  const live = (kind: string, key: string) => board.find((r) => r.kind === kind && r.key === key && r.deleted !== 1);
  assert(["member", "extract", "resolve", "vote"].every((k) => !live(k, "44")), "personal board slots tombstoned");
  assert(board.filter((r) => r.key === "44").every((r) => Number(r.seq) > 1), "tombstones get a new seq for open boards");
  assert(live("extract", "45") && live("group", "1") && live("lens", "labc123"), "classmates' and group work stay");
  const c1 = rows("cohorts").find((c) => c.legacyId === 1)!, c9 = rows("cohorts").find((c) => c.legacyId === 9)!;
  assert(JSON.stringify(c1.instructorIds) === "[2,1]" && c1.instructorId === 2, "removed from multi-instructor class");
  assert(JSON.stringify(c9.instructorIds) === "[]" && c9.instructorId === null, "removed from legacy single-instructor class");
  assert(rows("activityLogs").some((r) => r.action === "user_delete"), "delete is logged");
  console.log("delete-user ok");
})().catch((error) => { console.error(error); process.exit(1); });
