import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canWriteLessons, submitLesson } from "@/lib/access";

export async function POST(request: Request) {
  const user = await getSession();
  if (!user || !(await canWriteLessons(user))) return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  const body = await request.json().catch(() => null) as { lessonNumber?: number; courseSlug?: string } | null;
  if (!body?.lessonNumber) return NextResponse.json({ error: "Thiếu bài học." }, { status: 400 });
  try {
    const id = await submitLesson(user.id, body.lessonNumber, body.courseSlug);
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    // Convex errors arrive wrapped in a long message: send the short code only, log the rest.
    const message = error instanceof Error ? error.message : String(error);
    const code = message.match(/\b(EMPTY|REVIEW_OFF|LOCKED|NOT_FOUND|FORBIDDEN)\b/)?.[1] ?? "ERROR";
    if (code === "ERROR") console.error("[learn/submit]", message);
    return NextResponse.json({ error: code }, { status: code === "FORBIDDEN" ? 403 : code === "LOCKED" ? 423 : 400 });
  }
}
