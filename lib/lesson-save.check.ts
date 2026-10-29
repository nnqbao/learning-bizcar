// Lesson save / submit races. Run: npx tsx lib/lesson-save.check.ts
import fs from "node:fs";
import * as writes from "../convex/writes.ts";
import { keptStatus } from "../convex/writes.ts";

function assert(cond: unknown, label: string) {
  if (!cond) throw new Error(label);
}
const T = "2026-10-29T00:00:00.000Z";
// --- keptStatus: a late save never lowers a finished lesson ---
assert(keptStatus(null, "in_progress", null, T).status === "in_progress", "new row takes the given status");
assert(keptStatus({ status: "in_progress", completedAt: null }, "not_started", null, T).status === "not_started", "unfinished rows follow progress");
for (const done of ["completed", "submitted", "reviewed"]) {
  const kept = keptStatus({ status: done, completedAt: "2026-10-01" }, "in_progress", null, T);
  assert(kept.status === done && kept.completedAt === "2026-10-01", `${done} is not lowered by a late save`);
}
assert(keptStatus({ status: "completed", completedAt: "2026-10-01" }, "submitted", "x", T).status === "submitted", "can still move up");
assert(keptStatus({ status: "submitted", completedAt: null }, "completed", null, T).completedAt === T, "finished rows always get a completion time");

// --- Convex mutations against an in-memory db ---
type Doc = Record<string, unknown> & { _id: string };
const tables = new Map<string, Doc[]>();
let n = 0;
const rows = (name: string) => { if (!tables.has(name)) tables.set(name, []); return tables.get(name)!; };
const find = (id: string) => [...tables.values()].flat().find((doc) => doc._id === id);
function builder(name: string, filters: [string, unknown][] = []) {
  const list = () => rows(name).filter((doc) => filters.every(([k, v]) => doc[k] === v));
  return {
    withIndex: (_: string, fn?: (q: unknown) => unknown) => { const next: [string, unknown][] = [...filters]; const q = { eq: (k: string, v: unknown) => { next.push([k, v]); return q; } }; fn?.(q); return builder(name, next); },
    collect: async () => list(), first: async () => list()[0] ?? null, unique: async () => list()[0] ?? null,
  };
}
const ctx = { db: {
  query: (name: string) => builder(name),
  get: async (id: string) => find(id) ?? null,
  insert: async (name: string, value: Record<string, unknown>) => { const _id = `${name}:${++n}`; rows(name).push({ ...value, _id }); return _id; },
  patch: async (id: string, value: Record<string, unknown>) => { Object.assign(find(id)!, value); },
} };
const call = (fn: unknown, args: Record<string, unknown>) => (fn as { _handler: (c: unknown, a: unknown) => Promise<unknown> })._handler(ctx, { secret: "check", ...args });
process.env.APP_SECRET = "check";
rows("lessons").push({ _id: "lessons:1", legacyId: 5, courseId: 1, number: 5, storageKey: "bmdo-k03-buoi05-lear-v1" });
const save = (answersJson: string, status: string, progressPercent: number) => call(writes.saveAnswers, {
  userId: 7, lessonId: 5, courseId: 1, schemaVersion: "1", answersJson, phase: "practice", phasesDoneJson: "[]",
  progressPercent, status, completedAt: null, logComplete: false,
});
(async () => {
  await save('{"v":1}', "in_progress", 40);
  await save('{"v":2}', "in_progress", 60);
  await call(writes.submitLesson, { userId: 7, lessonId: 5, cohortId: 1, schemaVersion: "1", contentVersion: "x", answersJson: '{"v":"stale"}', phase: "x", progressPercent: 1 });
  const sub = rows("lessonSubmissions")[0];
  assert(sub.answersJson === '{"v":2}' && sub.progressPercent === 60, "submit snapshots the stored row, not the caller's stale copy");
  const row = rows("lessonAnswers")[0];
  assert(row.status === "submitted", "row marked submitted");
  await save('{"v":3}', "in_progress", 60); // autosave that read state before the submit landed
  assert(row.status === "submitted" && row.completedAt && row.answersJson === '{"v":3}', "late autosave keeps work but not a lower status");

  // --- Client wiring ---
  const stage = fs.readFileSync("components/learning/LessonStage.tsx", "utf8");
  assert(stage.includes("const run = tail.then(send);") && stage.includes("if (dirty) return; // newer edits"), "LessonStage saves one at a time, latest text, no stale clean-mark");
  assert(stage.includes('window.addEventListener("online", retry)'), "LessonStage retries when back online");
  const shell = fs.readFileSync("components/learning/LessonExperience.tsx", "utf8");
  assert(shell.includes("await window.__bizcarFlush?.();") && shell.includes("} finally {\n      setBusy(\"\");"), "Complete/Submit flushes first and never stays stuck");
  for (const file of ["StudioLesson.tsx", "VrimLesson.tsx"]) assert(fs.readFileSync(`components/learning/${file}`, "utf8").includes("window.__bizcarFlush ="), `${file} exposes flush`);
  console.log("lesson-save ok");
})().catch((error) => { console.error(error); process.exit(1); });
