// Instructor view: which class an instructor without a learner seat opens lessons for. Run: npx tsx lib/instructor-view.check.ts
import fs from "node:fs";
import * as reads from "../convex/reads.ts";

function assert(cond: unknown, label: string) {
  if (!cond) throw new Error(label);
}
type Doc = Record<string, unknown>;
const tables: Record<string, Doc[]> = {
  courses: [{ legacyId: 1, slug: "bmdo-k03" }, { legacyId: 4, slug: "vabix-quan-ly-cap-trung" }],
  cohorts: [
    { legacyId: 1, courseId: 1, name: "BMDO K03", instructorId: 44, instructorIds: [44, 2, 1] },
    { legacyId: 7, courseId: 1, name: "BMDO K04", instructorId: 9 },
    { legacyId: 5, courseId: 4, name: "Bê tông Ly tâm Thủ Đức 1 · Lớp 01", instructorId: null },
  ],
};
const ctx = {
  db: {
    query: (name: string) => {
      const filters: [string, unknown][] = [];
      const list = () => tables[name].filter((doc) => filters.every(([k, v]) => doc[k] === v));
      const api = {
        withIndex: (_: string, fn: (q: unknown) => unknown) => { const q = { eq: (k: string, v: unknown) => { filters.push([k, v]); return q; } }; fn(q); return api; },
        unique: async () => list()[0] ?? null,
        collect: async () => list(),
      };
      return api;
    },
  },
};
type Row = { id: number; name: string; mine: boolean } | null;
const run = (args: Record<string, unknown>) => (reads.instructorClass as unknown as { _handler: (c: unknown, a: unknown) => Promise<Row> })._handler(ctx, { secret: "check", ...args });

process.env.APP_SECRET = "check";
(async () => {
  const mine = await run({ userId: 44, courseSlug: "bmdo-k03", staff: false });
  assert(mine?.id === 1 && mine.mine, "instructor listed in instructorIds gets their class");
  assert((await run({ userId: 9, courseSlug: "bmdo-k03", staff: false }))?.id === 7, "legacy single instructorId still counts");
  assert(await run({ userId: 44, courseSlug: "vabix-quan-ly-cap-trung", staff: false }) === null, "not an instructor of that course: no view");
  assert(await run({ userId: 50, courseSlug: "bmdo-k03", staff: false }) === null, "ordinary user: no view");
  const staff = await run({ userId: 1, courseSlug: "vabix-quan-ly-cap-trung", staff: true });
  assert(staff?.id === 5 && !staff.mine, "admin/mod falls back to the course's first class");
  assert(await run({ userId: 1, courseSlug: "nope", staff: true }) === null, "unknown course");

  // Wiring: lesson page and save API honour the instructor view; it never writes a learner record.
  const page = fs.readFileSync("app/learn/(studio)/course/[slug]/lesson/[num]/page.tsx", "utf8");
  assert(page.includes("instructorClassFor(user, slug)") && page.includes("if (!learnerSeat && !teaching) redirect(\"/learn/dashboard\")"), "lesson page opens for instructors only");
  assert(page.includes("record: instructorView ? null"), "board lessons do not mirror an instructor into a learner record");
  const api = fs.readFileSync("app/api/learn/answers/route.ts", "utf8");
  assert(api.indexOf("instructorClassFor(") < api.indexOf("saveAnswers({"), "save API short-circuits instructor view before saving");
  console.log("instructor-view ok");
})().catch((error) => { console.error(error); process.exit(1); });
