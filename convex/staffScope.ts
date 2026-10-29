import type { MutationCtx, QueryCtx } from "./_generated/server";
import { cohortInstructorIds } from "./catalog";

/**
 * What a person may manage in the admin area. Admin and mod: every class. Anyone else: only the classes that list
 * them as instructor (cohorts.instructorIds) and the learners of those classes. Used by admin pages to filter what
 * they show and by the mutations an instructor may call (feedback, tasks), so the rule is enforced in Convex.
 */
export type StaffScope = { all: boolean; staff: boolean; cohortIds: number[]; learnerIds: number[]; courseSlugs: string[] };

export async function staffScopeFor(ctx: QueryCtx | MutationCtx, userId: number): Promise<StaffScope> {
  const user = await ctx.db.query("users").withIndex("by_legacy", (q) => q.eq("legacyId", userId)).unique();
  const none = { all: false, staff: false, cohortIds: [], learnerIds: [], courseSlugs: [] };
  if (!user || user.active !== 1) return none;
  if (user.role === "admin" || user.role === "mod") return { all: true, staff: true, cohortIds: [], learnerIds: [], courseSlugs: [] };
  const taught = (await ctx.db.query("cohorts").collect())
    .filter((row) => cohortInstructorIds(row).includes(userId))
    .sort((a, b) => a.legacyId - b.legacyId);
  const cohortIds = taught.map((row) => row.legacyId);
  const courseSlugs: string[] = [];
  for (const row of taught) {
    const course = await ctx.db.query("courses").withIndex("by_legacy", (q) => q.eq("legacyId", row.courseId)).unique();
    if (course && !courseSlugs.includes(course.slug)) courseSlugs.push(course.slug);
  }
  const learnerIds = new Set<number>();
  for (const cohortId of cohortIds) {
    const seats = await ctx.db.query("enrollments").withIndex("by_cohort", (q) => q.eq("cohortId", cohortId)).collect();
    for (const seat of seats) if (seat.memberRole === "learner") learnerIds.add(seat.userId);
  }
  return { all: false, staff: false, cohortIds, learnerIds: [...learnerIds], courseSlugs };
}

export function scopeHasCohort(scope: StaffScope, cohortId: number | null | undefined) {
  return scope.all || (cohortId != null && scope.cohortIds.includes(cohortId));
}

export function scopeHasLearner(scope: StaffScope, userId: number | null | undefined) {
  return scope.all || (userId != null && scope.learnerIds.includes(userId));
}
