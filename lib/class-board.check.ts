// Shared class board (QLCT). Run: npx tsx lib/class-board.check.ts
import fs from "node:fs";
import { boardWriteError, boardVisible } from "../convex/classBoardRules.ts";
import * as board from "../convex/classBoard.ts";
import { QLCT_COURSE as CONVEX_COURSE, QLCT_LESSONS as CONVEX_LESSONS } from "../convex/qlctCourse.ts";
import { QLCT_COURSE, QLCT_LESSONS, isQlctCourse, isQlctStorageKey, qlctFields } from "./qlct-course.ts";
import { boardToken, readBoardToken } from "./class-board.ts";
import { isVabixStorageKey } from "./vabix-applier.ts";
import { readPath } from "./course.ts";

function assert(cond: unknown, label: string) {
  if (!cond) throw new Error(label);
}

// --- Course data: lib and convex copies agree; keys do not collide with other courses ---
for (const key of ["slug", "code", "title", "tagline", "cohortName"] as const) assert(QLCT_COURSE[key] === CONVEX_COURSE[key], `course ${key} in sync`);
assert(QLCT_LESSONS.length === CONVEX_LESSONS.length, "lesson count in sync");
for (const [i, lesson] of QLCT_LESSONS.entries()) {
  const other = CONVEX_LESSONS[i];
  for (const key of ["number", "title", "framework", "summary", "group", "storageKey", "schemaVersion", "contentVersion"] as const) {
    assert(String(lesson[key]) === String(other[key]), `lesson ${lesson.number} ${key} in sync`);
  }
  assert(fs.existsSync(lesson.source), `lesson ${lesson.number} source exists`);
  assert(isQlctStorageKey(lesson.storageKey) && !isVabixStorageKey(lesson.storageKey), "storage key prefix is QLCT only");
}
assert(isQlctCourse(QLCT_COURSE.slug) && !isQlctCourse("vabix-applier") && !isQlctCourse("bmdo-k03"), "course detection");
assert(fs.existsSync(`public${QLCT_COURSE.partnerLogo}`), "partner logo shipped");

// --- Lesson files: one script run with (board, root), no browser storage, required header/footer, VABIX brand ---
for (const lesson of QLCT_LESSONS) {
  const html = fs.readFileSync(lesson.source, "utf8");
  const script = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/)?.[1] ?? "";
  new Function("board", "root", script);
  const tag = `Buổi ${lesson.code}`;
  assert(!/localStorage|location\.hash/.test(script), `${tag}: no browser storage or hash routing`);
  assert(!/onclick="/.test(html), `${tag}: no inline handlers (script runs in a closure)`);
  assert(html.includes(lesson.titleUpper.replace("&", "&amp;")) && html.includes(lesson.titleUpperEn.replace("&", "&amp;")), `${tag}: required header`);
  assert(html.includes(`BUỔI ${lesson.code}`), `${tag}: session number`);
  assert(html.includes("LÃNH ĐẠO TỈNH THỨC &amp; KIẾN TẠO"), `${tag}: required footer`);
  assert(html.includes("Công ty Cổ phần Bê tông Ly tâm Thủ Đức 1") && !/TDC1/.test(html), `${tag}: partner named in full, no TDC1`);
  assert(/--forest:#1a3d2c/.test(html) && /--gold:#d89830/.test(html), `${tag}: VABIX brand tokens`);
  assert(qlctFields(lesson.number).length > 0, `${tag}: workbook fields`);
}
const b02 = fs.readFileSync(QLCT_LESSONS[1].source, "utf8");
assert(b02.includes("/vendor/pptxgen-4.0.0.bundle.js") && fs.existsSync("public/vendor/pptxgen-4.0.0.bundle.js"), "Buổi 02: PPTX library served locally, loaded on demand");
assert(b02.includes("board.summarize(") && /MAPY/.test(b02) && /CRISS/.test(b02), "Buổi 02: People Wheel content and own summary");

// --- Personal record fields read back from what ClassBoardLesson saves ---
const saved = { group: "NHÓM 2", extract: { p1: "Bài học", sentence: "Câu" }, resolve: { action: "Làm", commitment: "Cam kết" } };
const fields = qlctFields(1);
assert(fields.some((f) => f.path === "extract.p1") && readPath(saved, "resolve.commitment") === "Cam kết", "workbook fields");

// --- Rules ---
const learner = { userId: 7, staff: false };
const staff = { userId: 1, staff: true };
const j = (value: unknown) => JSON.stringify(value);
const w = (input: Partial<Parameters<typeof boardWriteError>[0]>) => boardWriteError({ actor: learner, kind: "group", key: "1", dataJson: j({}), existing: null, memberGroupId: 1, ...input });
assert(w({}) === null, "member writes own group");
assert(w({ memberGroupId: 2 }) === "NOT_IN_GROUP" && w({ memberGroupId: null }) === "NOT_IN_GROUP", "non-member refused");
const lockedV1 = { userId: 7, deleted: 0, dataJson: j({ v1: { decision: "A", locked: true } }) };
assert(w({ existing: lockedV1, dataJson: j({ v1: { decision: "B", locked: true } }) }) === "LOCKED", "locked V1 cannot change");
assert(w({ existing: lockedV1, dataJson: j({ v1: { decision: "A", locked: false } }) }) === "LOCKED", "learner cannot unlock");
assert(w({ existing: lockedV1, dataJson: j({ v1: { decision: "A", locked: true }, v2: { final: "x" } }) }) === null, "V2 editable while V1 locked");
assert(w({ actor: staff, existing: lockedV1, dataJson: j({ v1: { decision: "A", locked: false } }) }) === null, "staff unlocks");
assert(w({ dataJson: null }) === "FORBIDDEN", "learner cannot delete group");
assert(w({ kind: "setup", key: "groups" }) === "FORBIDDEN" && w({ actor: staff, kind: "setup", key: "groups" }) === null, "setup is staff only");
assert(w({ kind: "member", key: "7", dataJson: j({ groupId: 3 }) }) === null, "learner picks own group");
assert(w({ kind: "member", key: "8", dataJson: j({ groupId: 3 }) }) === "FORBIDDEN", "learner cannot move others");
assert(w({ kind: "member", key: "7", dataJson: j({ groupId: 99 }) }) === "BAD_DATA", "group id range");
assert(w({ kind: "extract", key: "7" }) === null && w({ kind: "extract", key: "8" }) === "FORBIDDEN", "extract is personal");
assert(w({ kind: "resolve", key: "7", dataJson: null }) === "FORBIDDEN", "learner cannot delete commitment");
assert(w({ kind: "vote", key: "7", dataJson: j({ choice: 1 }) }) === null && w({ kind: "vote", key: "8", dataJson: j({ choice: 1 }) }) === "FORBIDDEN", "vote is personal");
assert(boardVisible({ kind: "vote", key: "8" }, learner) === false && boardVisible({ kind: "vote", key: "8" }, staff), "votes visible to owner and staff");
assert(w({ kind: "lens", key: "labc123" }) === null, "learner adds lens");
assert(w({ kind: "lens", key: "labc123", existing: { userId: 8, deleted: 0, dataJson: "{}" } }) === "FORBIDDEN", "only author edits lens");
assert(w({ kind: "lens", key: "labc123", dataJson: null, existing: { userId: 7, deleted: 0, dataJson: "{}" } }) === null, "author deletes own lens");
assert(w({ kind: "nope" }) === "BAD_KIND" && w({ kind: "group", key: "../1" }) === "BAD_KEY" && w({ kind: "lens", key: "X" }) === "BAD_KEY", "kind/key checked");
assert(w({ dataJson: "[1]" }) === "BAD_DATA" && w({ dataJson: j({ t: "x".repeat(40000) }) }) === "TOO_LARGE", "data shape and size");
assert(boardVisible({ kind: "extract", key: "8" }, learner) === false && boardVisible({ kind: "extract", key: "7" }, learner) && boardVisible({ kind: "extract", key: "8" }, staff), "personal rows private");
assert(boardVisible({ kind: "group", key: "1" }, learner) && boardVisible({ kind: "lens", key: "labc123" }, learner), "group work shared");

// --- Token ---
const secret = "check-secret";
const token = boardToken({ userId: 7, cohortId: 5, lessonNumber: 1, staff: false }, secret, 1000);
assert(readBoardToken(token, secret, 2000)?.cohortId === 5, "token reads back");
assert(readBoardToken(token, "other", 2000) === null, "wrong secret refused");
assert(readBoardToken(token, secret, 1000 + 13 * 3600 * 1000) === null, "expired token refused");
const [body, mac] = token.split(".");
const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), staff: true })).toString("base64url");
assert(readBoardToken(`${forged}.${mac}`, secret, 2000) === null, "edited token refused");

// --- Convex functions against an in-memory db ---
type Doc = Record<string, unknown> & { _id: string };
function fakeCtx() {
  const tables = new Map<string, Doc[]>();
  let n = 0;
  const rows = (name: string) => { if (!tables.has(name)) tables.set(name, []); return tables.get(name)!; };
  const find = (id: string) => [...tables.values()].flat().find((doc) => doc._id === id);
  function builder(name: string, filters: ((doc: Doc) => boolean)[] = []) {
    const list = () => rows(name).filter((doc) => filters.every((f) => f(doc))).sort((a, b) => Number(a.seq ?? 0) - Number(b.seq ?? 0));
    return {
      withIndex(_index: string, fn?: (q: unknown) => unknown) {
        const next = [...filters];
        const q = {
          eq(key: string, value: unknown) { next.push((doc) => doc[key] === value); return q; },
          gt(key: string, value: number) { next.push((doc) => Number(doc[key]) > value); return q; },
        };
        fn?.(q);
        return builder(name, next);
      },
      collect: async () => list(),
      take: async (count: number) => list().slice(0, count),
      first: async () => list()[0] ?? null,
      unique: async () => { const found = list(); if (found.length > 1) throw new Error(`unique() on ${name}`); return found[0] ?? null; },
    };
  }
  const db = {
    query: (name: string) => builder(name),
    insert: async (name: string, value: Record<string, unknown>) => { const _id = `${name}:${++n}`; rows(name).push({ ...value, _id }); return _id; },
    patch: async (id: string, value: Record<string, unknown>) => { Object.assign(find(id)!, value); },
  };
  return { ctx: { db }, rows };
}
type Handler = (ctx: unknown, args: Record<string, unknown>) => Promise<unknown>;
const call = <T>(fn: unknown, ctx: unknown, args: Record<string, unknown>) => (fn as { _handler: Handler })._handler(ctx, { secret: "check", cohortId: 5, lessonNumber: 1, ...args }) as Promise<T>;
type WriteResult = { ok: boolean; error?: string; seq?: number };
type Changes = { seq: number; more: boolean; rows: { kind: string; key: string; userId: number; data: string | null }[] };

async function convexPaths() {
  process.env.APP_SECRET = "check";
  const { ctx, rows } = fakeCtx();
  const write = (actorId: number, isStaff: boolean, kind: string, key: string, data: unknown) =>
    call<WriteResult>(board.write, ctx, { actorId, staff: isStaff, kind, key, dataJson: data === null ? null : JSON.stringify(data) });
  const changes = (since: number, userId: number, isStaff: boolean) => call<Changes>(board.changes, ctx, { since, userId, staff: isStaff });

  assert((await write(7, false, "group", "1", { v1: { decision: "A" } })).error === "NOT_IN_GROUP", "no group before joining");
  assert((await write(7, false, "member", "7", { groupId: 1 })).ok, "join group 1");
  assert((await write(7, false, "group", "1", { v1: { decision: "A", locked: true } })).ok, "write and lock V1");
  assert((await write(8, false, "member", "8", { groupId: 1 })).ok, "second member joins");
  assert((await write(8, false, "group", "1", { v1: { decision: "B", locked: true } })).error === "LOCKED", "teammate cannot change locked V1");
  assert((await write(9, false, "group", "1", { v1: { decision: "C" } })).error === "NOT_IN_GROUP", "other learner refused");
  assert((await write(1, true, "group", "1", { v1: { decision: "A", locked: false } })).ok, "staff unlocks");
  assert((await write(7, false, "extract", "7", { p1: "riêng" })).ok && (await write(8, false, "extract", "8", { p1: "riêng 8" })).ok, "personal extracts");
  assert((await write(8, false, "lens", "lens-abc1", { target: 2, text: "góp ý" })).ok, "lens");
  assert((await write(7, false, "lens", "lens-abc1", null)).error === "FORBIDDEN", "not author's lens");
  assert((await write(8, false, "lens", "lens-abc1", null)).ok, "author deletes lens");
  assert(rows("classBoardRows").filter((row) => row.kind === "group").length === 1, "one row per slot");

  const all = await changes(0, 7, false);
  assert(all.rows.some((row) => row.kind === "extract" && row.key === "7") && !all.rows.some((row) => row.kind === "extract" && row.key === "8"), "learner sees only own extract");
  assert(all.rows.find((row) => row.kind === "lens")?.data === null, "deleted lens arrives as tombstone");
  assert(JSON.parse(all.rows.find((row) => row.kind === "group")!.data!).v1.locked === false, "latest group state");
  const staffView = await changes(0, 1, true);
  assert(staffView.rows.filter((row) => row.kind === "extract").length === 2 && staffView.seq === all.seq, "staff sees every extract; same seq");
  const idle = await changes(all.seq, 7, false);
  assert(idle.rows.length === 0 && idle.seq === all.seq, "idle poll returns nothing");
  await write(8, false, "resolve", "8", { action: "x" });
  const after = await changes(all.seq, 7, false);
  assert(after.rows.length === 0 && after.seq > all.seq, "private change advances seq without leaking");
  await write(7, false, "group", "1", { v1: { decision: "A2" } });
  const next = await changes(after.seq, 8, false);
  assert(next.rows.length === 1 && next.rows[0].kind === "group", "only the changed row");
}

convexPaths().then(() => console.log("class-board checks passed")).catch((error) => { console.error(error); process.exit(1); });
