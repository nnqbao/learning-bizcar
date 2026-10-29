import { cache } from "react";
import type { StaffScope } from "@/convex/staffScope";
import { api, q } from "./convex";
import type { SessionUser } from "./auth";

/** Admin-area scope of the signed-in person: admin/mod see every class, an instructor only the classes they teach. */
export const staffScope = cache(async (user: SessionUser): Promise<StaffScope> =>
  q((convex, secret) => convex.query(api.reads.staffScope, { secret, userId: user.id })));

export function inCohort(scope: StaffScope, cohortId: number | null | undefined) {
  return scope.all || (cohortId != null && scope.cohortIds.includes(cohortId));
}

export function hasLearner(scope: StaffScope, userId: number | null | undefined) {
  return scope.all || (userId != null && scope.learnerIds.includes(userId));
}

/** An instructor without admin/mod role who teaches at least one class. */
export function isInstructorOnly(scope: StaffScope) {
  return !scope.all && scope.cohortIds.length > 0;
}
