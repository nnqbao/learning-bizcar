import Link from "next/link";
import { notFound } from "next/navigation";
import { classPickerLabel } from "@/convex/codes";
import { api, q } from "@/lib/convex";
import { enrollLearner, unenrollLearner } from "@/lib/admin-actions";
import { CreateLearnerForm } from "@/components/admin/CreateLearnerForm";
import { getSession } from "@/lib/auth";
import { learningState } from "@/lib/access";
import { getLocale } from "@/lib/locale";
import { messages } from "@/lib/i18n";
import { SelfEnroll } from "@/components/admin/SelfEnroll";
import { CohortForm } from "@/components/admin/CohortForm";
import { isQlctCourse, QLCT_LESSONS } from "@/lib/qlct-course";
import { inCohort, staffScope } from "@/lib/staff-scope";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CohortDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; enroll?: string }>;
}) {
  const { id } = await params;
  const cohortId = Number(id);
  if (!Number.isInteger(cohortId) || cohortId <= 0) notFound();
  const query = await searchParams;
  const t = messages(await getLocale());
  const user = await getSession();
  if (!user) redirect("/learn/login");
  // Instructors open only the classes they teach. Editing the class and its roster is admin work.
  if (!inCohort(await staffScope(user), cohortId)) notFound();
  const isAdmin = user.role === "admin";
  const data = await q((convex, secret) => convex.query(api.reads.cohortsView, { secret }));
  const cohort = data.cohorts.find((item) => item.id === cohortId);
  if (!cohort) notFound();
  const course = data.courses.find((item) => item.id === cohort.course_id);
  const members = data.enrollments.filter((row) => row.cohort_id === cohort.id);
  const openUsers = data.users.filter((item) => !members.some((member) => member.user_id === item.id));
  const lessonCount = new Set(cohort.sessions.flatMap((session) => session.lesson_ids)).size;
  const state = isAdmin ? await learningState(user.id) : null;
  const enrolled = (state?.enrollments ?? []).some((seat) => seat.cohort_id === cohort.id);
  const enrollNote = query.enroll === "enrolled" ? t.enrolledOk : query.enroll === "already" ? t.alreadyInCohort : query.enroll === "error" ? t.enrollFailed : query.enroll === "invalid" ? t.enrollInvalid : null;
  const label = classPickerLabel({ name: cohort.name, code: cohort.code, courseCode: course?.code });
  return (
    <main>
      <p className="row-actions"><Link className="btn" href="/admin/learning/cohorts">Danh sách lớp</Link></p>
      <div className="eyebrow">{cohort.instructors.length ? cohort.instructors.map((person) => person.display_name).join(" · ") : "Chưa gán giảng viên"}</div>
      <h1 className="serif">{label}</h1>
      <p className="muted">Buổi học là lịch của lớp: mỗi buổi có ngày và gồm nhiều bài học của khoá. Sửa lớp không đổi danh mục bài.</p>
      {query.error && <p className="notice"><strong>{query.error}</strong></p>}
      {enrollNote && <p className="notice"><strong>{enrollNote}</strong></p>}
      {isAdmin && <CohortForm
        courses={data.courses}
        lessons={data.lessons}
        instructors={withCurrentInstructors(data.instructors, cohort.instructors)}
        defaults={{
          id: cohort.id,
          name: cohort.name,
          course_id: cohort.course_id,
          code: cohort.code,
          unlock_mode: cohort.unlock_mode,
          instructor_ids: cohort.instructors.map((person) => person.id),
          sessions: cohort.sessions.map((session) => ({
            title: session.title,
            date: session.session_date,
            lesson_ids: session.lesson_ids,
          })),
        }}
      />}
      {!isAdmin && (
        <div className="card" style={{ marginTop: 12 }}>
          <h3>Buổi học</h3>
          {cohort.sessions.length === 0 && <p className="muted">Chưa xếp buổi.</p>}
          {cohort.sessions.map((session, index) => (
            <p key={`${index}:${session.title}`}><strong>{session.title}</strong>{session.session_date ? ` · ${session.session_date}` : ""} · {session.lesson_ids.length} bài</p>
          ))}
        </div>
      )}
      {course && isQlctCourse(course.slug) && (
        <div className="card" style={{ marginTop: 12 }}>
          <h3>Bảng lớp · thao trường nhóm</h3>
          <p className="muted">Mở trên máy giảng viên để xếp nhóm, theo dõi V1/V2, Lens, Extract/Resolve và xuất dữ liệu cả lớp.</p>
          <p className="row-actions">
            {QLCT_LESSONS.map((lesson) => (
              <Link key={lesson.number} className="btn dark" href={`/admin/learning/board/${cohort.id}/${lesson.number}`}>Buổi {lesson.code} · {lesson.title}</Link>
            ))}
          </p>
        </div>
      )}
      <div className="card" style={{ marginTop: 12 }}>
        <h3>{isAdmin ? "Quản lý học viên" : "Học viên trong lớp"}</h3>
        <p className="muted">{cohort.org} · Review {cohort.review_enabled ? "bật" : "tắt"} · {cohort.sessions.length} buổi · {lessonCount} bài trong buổi.{isAdmin ? " Thêm học viên vào đúng lớp này." : ""}</p>
        {isAdmin && <CreateLearnerForm
          embedded
          cohortId={cohort.id}
          cohorts={[{ id: cohort.id, name: cohort.name, code: cohort.code, course_code: course?.code ?? "" }]}
        />}
        <p style={{ marginTop: 16 }}><strong>Đang trong lớp</strong></p>
        {members.length === 0 && <p className="muted">Chưa có học viên.</p>}
        {!isAdmin && members.map((member) => (
          <p key={member.user_id} className="user-line" style={{ marginTop: 8 }}>
            <Link href={`/admin/learning/learners/${member.user_id}`}>{member.display_name}</Link> · @{member.username} · {member.management_code || "chưa có mã"}
          </p>
        ))}
        {isAdmin && members.map((member) => (
          <form key={member.user_id} action={unenrollLearner} className="user-line" style={{ marginTop: 8 }}>
            <span>{member.display_name} · @{member.username} · {member.management_code || "chưa có mã"}</span>
            <input type="hidden" name="cohortId" value={cohort.id} />
            <input type="hidden" name="userId" value={member.user_id} />
            <button className="btn" type="submit">Gỡ khỏi lớp</button>
          </form>
        ))}
        {isAdmin && openUsers.length > 0 && (
          <form action={enrollLearner} className="row-actions" style={{ marginTop: 12 }}>
            <input type="hidden" name="cohortId" value={cohort.id} />
            <label className="muted" htmlFor={`enroll-${cohort.id}`}>Tài khoản đã có</label>
            <select id={`enroll-${cohort.id}`} name="userId" aria-label="Tài khoản đã có" defaultValue={openUsers[0]?.id}>
              {openUsers.map((item) => <option key={item.id} value={item.id}>{item.display_name} · @{item.username}</option>)}
            </select>
            <button className="btn dark" type="submit">Ghi danh vào lớp</button>
          </form>
        )}
        {isAdmin && (
          <SelfEnroll
            cohortId={cohort.id}
            cohortName={label}
            enrolled={enrolled}
            nextPath={`/admin/learning/cohorts/${cohort.id}`}
            variant="inline"
          />
        )}
      </div>
    </main>
  );
}

function withCurrentInstructors<T extends { id: number }>(instructors: T[], current: T[]) {
  return [...current.filter((person) => !instructors.some((item) => item.id === person.id)), ...instructors];
}
