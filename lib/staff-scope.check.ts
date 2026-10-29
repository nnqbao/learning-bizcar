// Admin-area scope: admin/mod see every class, an instructor only the classes they teach. Run: npx tsx lib/staff-scope.check.ts
import fs from "node:fs";
import { scopeHasCohort, scopeHasLearner, staffScopeFor } from "../convex/staffScope.ts";
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
  return {
    withIndex: (_: string, fn?: (q: unknown) => unknown) => { const next: [string, unknown][] = [...filters]; const q = { eq: (k: string, v: unknown) => { next.push([k, v]); return q; } }; fn?.(q); return builder(name, next); },
    collect: async () => list(), first: async () => list()[0] ?? null, unique: async () => list()[0] ?? null,
  };
}
const ctx = { db: {
  query: (name: string) => builder(name),
  insert: async (name: string, value: Record<string, unknown>) => { add(name, value); return `${name}:${n}`; },
  patch: async (id: string, value: Record<string, unknown>) => { Object.assign(find(id)!, value); },
} };
process.env.APP_SECRET = "check";
add("users", { legacyId: 1, role: "admin", active: 1 });
add("users", { legacyId: 3, role: "mod", active: 1 });
add("users", { legacyId: 44, role: "user", active: 1 });          // instructor of class 1 (BMDO)
add("users", { legacyId: 50, role: "user", active: 1 });          // learner, class 1
add("users", { legacyId: 51, role: "user", active: 1 });          // learner, class 5 (QLCT)
add("courses", { legacyId: 1, slug: "bmdo-k03" }); add("courses", { legacyId: 4, slug: "vabix-quan-ly-cap-trung" });
add("cohorts", { legacyId: 1, courseId: 1, instructorId: 44, instructorIds: [44, 2] });
add("cohorts", { legacyId: 5, courseId: 4, instructorId: null });
add("enrollments", { userId: 50, cohortId: 1, memberRole: "learner" });
add("enrollments", { userId: 51, cohortId: 5, memberRole: "learner" });
add("lessonSubmissions", { legacyId: 10, userId: 50, cohortId: 1, lessonId: 5, reviewStatus: "submitted" });
add("lessonSubmissions", { legacyId: 11, userId: 51, cohortId: 5, lessonId: 5, reviewStatus: "submitted" });
const call = (fn: unknown, args: Record<string, unknown>) => (fn as { _handler: (c: unknown, a: unknown) => Promise<unknown> })._handler(ctx, { secret: "check", ...args });

(async () => {
  const admin = await staffScopeFor(ctx as never, 1), mod = await staffScopeFor(ctx as never, 3);
  const teacher = await staffScopeFor(ctx as never, 44), learner = await staffScopeFor(ctx as never, 50);
  assert(admin.all && mod.all, "admin and mod see every class");
  assert(!teacher.all && JSON.stringify(teacher.cohortIds) === "[1]" && JSON.stringify(teacher.learnerIds) === "[50]" && teacher.courseSlugs[0] === "bmdo-k03", "instructor: own class, its learners, its course");
  assert(scopeHasCohort(teacher, 1) && !scopeHasCohort(teacher, 5) && scopeHasLearner(teacher, 50) && !scopeHasLearner(teacher, 51), "instructor limited to own class");
  assert(!learner.all && learner.cohortIds.length === 0, "a learner has no admin scope");

  // Feedback: instructor only on own class's submissions; Convex enforces it.
  let refused = false;
  try { await call(writes.addFeedback, { actorId: 44, submissionId: 11, body: "x" }); } catch { refused = true; }
  assert(refused && !rows("coachFeedback").length, "instructor cannot review another class");
  await call(writes.addFeedback, { actorId: 44, submissionId: 10, body: "Tốt" });
  assert(rows("coachFeedback").length === 1, "instructor reviews own class");
  // Tasks: instructor assigns only to own learners.
  const denied = await call(writes.createTask, { actorId: 44, title: "T", body: "", assigneeId: 51, dueAt: null }) as { error?: string } | undefined;
  assert(denied?.error && !rows("tasks").length, "instructor cannot task another class");
  await call(writes.createTask, { actorId: 44, title: "T", body: "", assigneeId: 50, dueAt: null });
  await call(writes.createTask, { actorId: 3, title: "M", body: "", assigneeId: 51, dueAt: null });
  assert(rows("tasks").length === 2, "instructor tasks own learner; mod tasks anyone");

  // Saving a permission group from the Users page keeps the stored department label (no longer edited on the web).
  rows("users").find((u) => u.legacyId === 50)!.departmentId = 1;
  await call(writes.assignUserAccess, { actorId: 1, userId: 50, groupId: 3 });
  const saved = rows("users").find((u) => u.legacyId === 50)!;
  assert(saved.departmentId === 1 && saved.permissionGroupId === 3, "group saved, department kept");
  assert(!fs.readFileSync("app/admin/organization/users/page.tsx", "utf8").includes('name="departmentId"'), "department picker removed");

  // Pages filter by scope and keep admin-only controls for admins.
  const read = (p: string) => fs.readFileSync(p, "utf8");
  for (const p of ["app/admin/learning/page.tsx", "app/admin/learning/learners/page.tsx", "app/admin/learning/progress/page.tsx", "app/admin/learning/submissions/page.tsx", "app/admin/learning/cohorts/page.tsx", "app/admin/learning/courses/page.tsx", "app/admin/tasks/page.tsx"]) {
    assert(read(p).includes("staffScope(") && /\.filter\(/.test(read(p)), `${p} filters by scope`);
  }
  const cohort = read("app/admin/learning/cohorts/[id]/page.tsx");
  assert(cohort.includes("if (!inCohort(await staffScope(user), cohortId)) notFound();") && cohort.includes("{isAdmin && <CohortForm") && cohort.includes("{isAdmin && openUsers.length > 0"), "class detail: own class only; editing for admins");
  assert(read("app/admin/learning/learners/page.tsx").includes("{isAdmin && <CreateLearnerForm"), "learner admin tools for admins only");
  for (const p of ["app/admin/learning/cohorts/new/page.tsx", "app/admin/learning/courses/new/page.tsx"]) assert(read(p).includes('actor.role !== "admin") redirect'), `${p} admin only`);
  assert(read("lib/permissions.ts").includes("allowed.has(item.key) && !item.adminOnly"), "admin-only menus never shown to a role user");
  assert(read("convex/discussion.ts").includes("access.enrolledCohortIds.length + access.instructorCohortIds.length > 0"), "instructors join their class discussion");
  console.log("staff-scope ok");
})().catch((error) => { console.error(error); process.exit(1); });
