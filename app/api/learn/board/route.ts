import { NextResponse } from "next/server";
import { api, appSecret, q } from "@/lib/convex";
import { readBoardToken } from "@/lib/class-board";

function pass(request: Request) {
  return readBoardToken(request.headers.get("x-board-token"), appSecret());
}

export async function GET(request: Request) {
  const viewer = pass(request);
  if (!viewer) return NextResponse.json({ error: "EXPIRED" }, { status: 401 });
  const since = Number(new URL(request.url).searchParams.get("since") ?? 0);
  const result = await q((convex, secret) => convex.query(api.classBoard.changes, {
    secret,
    cohortId: viewer.cohortId,
    lessonNumber: viewer.lessonNumber,
    since: Number.isFinite(since) && since > 0 ? since : 0,
    userId: viewer.userId,
    staff: viewer.staff,
  }));
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const viewer = pass(request);
  if (!viewer) return NextResponse.json({ error: "EXPIRED" }, { status: 401 });
  const body = await request.json().catch(() => null) as { kind?: unknown; key?: unknown; data?: unknown } | null;
  if (!body || typeof body.kind !== "string" || typeof body.key !== "string") return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  const dataJson = body.data === null ? null : JSON.stringify(body.data ?? {});
  const result = await q((convex, secret) => convex.mutation(api.classBoard.write, {
    secret,
    cohortId: viewer.cohortId,
    lessonNumber: viewer.lessonNumber,
    actorId: viewer.userId,
    staff: viewer.staff,
    kind: body.kind as string,
    key: body.key as string,
    dataJson,
  }));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error === "FORBIDDEN" || result.error === "NOT_IN_GROUP" || result.error === "LOCKED" ? 403 : 400 });
  return NextResponse.json(result);
}
