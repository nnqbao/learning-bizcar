import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { api, appSecret, q } from "@/lib/convex";
import { boardToken } from "@/lib/class-board";
import { loadBoardLesson } from "@/lib/lesson-source";
import { isQlctCourse, qlctLesson } from "@/lib/qlct-course";
import { ClassBoardLesson } from "@/components/learning/ClassBoardLesson";
import { inCohort, staffScope } from "@/lib/staff-scope";

export const dynamic = "force-dynamic";

/** Instructor view of a class-workshop lesson: group setup, every group's work, the class tables and exports. */
export default async function ClassBoardPage({ params }: { params: Promise<{ cohortId: string; lesson: string }> }) {
  const { cohortId: rawCohort, lesson: rawLesson } = await params;
  const cohortId = Number(rawCohort);
  const number = Number(rawLesson);
  if (!Number.isInteger(cohortId) || !Number.isInteger(number)) notFound();
  const user = await getSession();
  if (!user) redirect("/learn/login");
  // Admin/mod: any class. Instructor: the classes they teach.
  if (!inCohort(await staffScope(user), cohortId)) redirect("/admin/learning");
  const data = await q((convex, secret) => convex.query(api.reads.cohortsView, { secret }));
  const cohort = data.cohorts.find((item) => item.id === cohortId);
  const course = cohort ? data.courses.find((item) => item.id === cohort.course_id) : undefined;
  const meta = course && isQlctCourse(course.slug) ? qlctLesson(number) : undefined;
  if (!cohort || !course || !meta) notFound();
  const roster = await q((convex, secret) => convex.query(api.classBoard.roster, { secret, cohortId }));
  return (
    <main>
      <p className="row-actions"><Link className="btn" href={`/admin/learning/cohorts/${cohortId}`}>Về lớp {cohort.name}</Link></p>
      <div className="eyebrow">{course.code} · Buổi {meta.code} · Bảng lớp</div>
      <h1 className="serif">{meta.title}</h1>
      <p className="muted">Giảng viên xếp nhóm, theo dõi V1/V2 của từng nhóm, ghi Lens, xem Extract/Resolve cả lớp và xuất dữ liệu. Học viên mở bài từ tài khoản của mình; mọi thay đổi đồng bộ vài giây một lần.</p>
      <div style={{ marginTop: 16 }}>
        <ClassBoardLesson
          token={boardToken({ userId: user.id, cohortId, lessonNumber: number, staff: true }, appSecret())}
          me={{ id: user.id, name: user.displayName }}
          staff
          roster={roster}
          source={loadBoardLesson(meta.source, "qlct-lesson")}
          scopeClass="qlct-lesson"
        />
      </div>
    </main>
  );
}
