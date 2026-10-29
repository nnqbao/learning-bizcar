import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { answerFor, instructorClassFor, isLessonUnlocked, learningState, legacyAnswerFor } from "@/lib/access";
import { BMDO_SLUG } from "@/convex/codes";
import { lessonByNumber, type LessonMeta } from "@/lib/course";
import { loadBoardLesson, loadLessonSource } from "@/lib/lesson-source";
import { babosoraLesson, isBabosoraCourse } from "@/lib/babosora-applier";
import { isVabixCourse, vabixLesson } from "@/lib/vabix-applier";
import { isQlctCourse, qlctLesson } from "@/lib/qlct-course";
import { boardToken } from "@/lib/class-board";
import { api, appSecret, q } from "@/lib/convex";
import { LessonExperience } from "@/components/learning/LessonExperience";
import { canSee } from "@/lib/permissions";
import { studioForLesson } from "@/lib/studios/registry";
import { loadStudioSource } from "@/lib/studios/source";
import { getLocale } from "@/lib/locale";
import { lessonPublished } from "@/lib/cms";

export default async function LessonPage({ params }: { params: Promise<{ slug: string; num: string }> }) {
  const { slug, num } = await params;
  const number = Number(num);
  if (!Number.isInteger(number) || number < 1) notFound();
  const user = await getSession();
  if (!user) redirect("/learn/login");
  if (!(await canSee(user, "map"))) redirect("/learn/profile");
  const state = await learningState(user.id, slug);
  if (!state || slug !== state.course.slug) notFound();
  const learnerSeat = state.enrollment?.member_role === "learner" ? state.enrollment : null;
  // Instructor view: a class instructor (or admin/mod) without a learner seat opens every lesson; nothing is saved.
  const teaching = learnerSeat ? null : await instructorClassFor(user, slug);
  if (!learnerSeat && !teaching) redirect("/learn/dashboard");
  const instructorView = !learnerSeat;
  const cohortId = learnerSeat ? learnerSeat.cohort_id : teaching!.id;
  const unlocked = (lessonNumber: number) => instructorView ? Promise.resolve(true) : isLessonUnlocked(user.id, lessonNumber, slug);
  const rows = state.lessons;
  const row = rows.find((item) => item.number === number);
  if (!row) notFound();
  const vabix = isVabixCourse(slug, row.storage_key);
  const babosora = isBabosoraCourse(slug, row.storage_key);
  const qlct = isQlctCourse(slug, row.storage_key);
  const meta = vabix ? vabixLesson(number) : babosora ? babosoraLesson(number) : qlct ? qlctLesson(number) : lessonByNumber(number);
  if (!meta) notFound();
  const published = state.course.slug === BMDO_SLUG ? await lessonPublished(number) : true;
  if (!published || !(await unlocked(number))) redirect(`/learn/course/${state.course.slug}`);
  const lesson: LessonMeta = vabix || babosora || qlct
    ? { ...meta, title: row.title, framework: row.framework, summary: row.summary, storageKey: row.storage_key }
    : meta;
  const saved = await answerFor(user.id, row.id, slug);
  const nativeStudio = state.course.slug === BMDO_SLUG && number === 4;
  // BMDO-K03 lessons rebuilt from an original studio file; only when the lesson row still carries its old key.
  const studio = state.course.slug === BMDO_SLUG ? studioForLesson(number) : null;
  const studioLesson = studio && studio.oldKey === row.storage_key ? studio : null;
  const studioSource = studioLesson ? loadStudioSource(studioLesson) : null;
  const source = nativeStudio || studioLesson || qlct
    ? { css: "", html: "", script: "", scopeClass: "bizcar-lesson", showSample: false, showPhases: !qlct }
    : loadLessonSource(number, { slug, storageKey: row.storage_key });
  // Buổi 04 native studio: `saved` is the new-version record (its own answer key); the old record is
  // loaded separately, read-only, for «Bài làm phiên bản cũ». Nothing here is written back to it.
  const legacy = nativeStudio || studioLesson ? await legacyAnswerFor(user.id, row.id, slug) : undefined;
  const legacyAnswers = legacy ? JSON.parse(legacy.answers_json) as unknown : null;
  const answers = saved ? JSON.parse(saved.answers_json) as Record<string, unknown> : {};
  const done = saved ? JSON.parse(saved.phases_done_json) as string[] : [];
  // QLCT: the lesson is a class workshop on the shared board of the learner's class.
  const qlctMeta = qlct ? qlctLesson(number) : null;
  const classBoard = qlctMeta ? {
    token: boardToken({ userId: user.id, cohortId, lessonNumber: number, staff: instructorView }, appSecret()),
    me: { id: user.id, name: user.displayName },
    staff: instructorView,
    roster: await q((convex, secret) => convex.query(api.classBoard.roster, { secret, cohortId })),
    source: loadBoardLesson(qlctMeta.source, "qlct-lesson"),
    scopeClass: "qlct-lesson",
    record: instructorView ? null : { courseSlug: state.course.slug, lessonNumber: number, initialAnswers: answers },
  } : null;
  const lessonNav = await Promise.all(rows.map(async (item) => ({
    number: item.number,
    code: String(item.number).padStart(2, "0"),
    title: item.title,
    framework: item.framework,
    status: "not_started" as const,
    unlocked: await unlocked(item.number),
  })));
  return (
    <LessonExperience
      lesson={lesson}
      scopeClass={source.scopeClass}
      showSample={source.showSample}
      showPhases={source.showPhases}
      lessons={lessonNav}
      source={{ css: source.css, html: source.html, script: source.script }}
      initialAnswers={answers}
      initialPhase={saved?.current_phase || "overview"}
      initialDone={done}
      initialProgress={saved?.progress_percent ?? 0}
      userId={user.id}
      serverUpdatedAt={saved?.updated_at ?? null}
      reviewEnabled={!instructorView && Boolean(learnerSeat?.review_enabled)}
      status={saved?.status ?? "not_started"}
      locale={await getLocale()}
      courseSlug={state.course.slug}
      courseCode={state.course.code}
      nativeStudio={nativeStudio}
      legacyAnswers={legacyAnswers}
      studioSource={studioSource}
      standardShell={state.course.slug === BMDO_SLUG && !vabix && !babosora}
      classBoard={classBoard}
      instructorView={instructorView ? (teaching?.name ?? "") : null}
    />
  );
}

export const dynamic = "force-dynamic";
