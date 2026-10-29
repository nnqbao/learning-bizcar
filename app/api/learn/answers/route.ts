import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canWriteLessons, instructorClassFor, saveAnswers } from "@/lib/access";
import { BMDO_SLUG } from "@/convex/codes";

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Không có quyền lưu bài." }, { status: 403 });
  const body = await request.json().catch(() => null) as {
    lessonNumber?: number; courseSlug?: string; answers?: unknown; phase?: string; phasesDone?: string[]; progressPercent?: number;
  } | null;
  // Instructor view (no learner seat in this course): the lesson runs, nothing is stored.
  if (await instructorClassFor(user, body?.courseSlug || BMDO_SLUG)) return NextResponse.json({ ok: true, updatedAt: null, status: "not_started", preview: true });
  if (!(await canWriteLessons(user))) return NextResponse.json({ error: "Không có quyền lưu bài." }, { status: 403 });
  if (!body?.lessonNumber) return NextResponse.json({ error: "Thiếu bài học." }, { status: 400 });
  try {
    const saved = await saveAnswers({
      userId: user.id,
      courseSlug: body.courseSlug,
      lessonNumber: body.lessonNumber,
      answers: body.answers ?? {},
      phase: body.phase || "overview",
      phasesDone: body.phasesDone ?? [],
      progressPercent: body.progressPercent ?? 0,
    });
    return NextResponse.json({ ok: true, updatedAt: saved.updated_at, status: saved.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ERROR";
    const status = message === "FORBIDDEN" ? 403 : message === "LOCKED" ? 423 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
