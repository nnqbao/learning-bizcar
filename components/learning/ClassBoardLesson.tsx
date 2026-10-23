"use client";

import { useEffect, useRef } from "react";
import type { BoardPerson } from "@/lib/class-board";

/**
 * Runs a class-workshop lesson (e.g. source/vabix-qlct/buoi01/index.html) on the shared class board.
 * The lesson script gets `board` (rows + put/del + change events) and `root` (its element).
 * Polls /api/learn/board for rows with seq > last seen; a learner's own part is mirrored into their
 * lesson record so workbook, portfolio and admin pages show it like any other lesson.
 */
type Row = { kind: string; key: string; userId: number; data: Record<string, unknown>; updatedAt: string };
type Wire = { kind: string; key: string; userId: number; data: string | null; seq: number; updatedAt: string };
type Result = { ok: boolean; error?: string };

export type ClassBoardProps = {
  token: string;
  me: BoardPerson;
  staff: boolean;
  roster: BoardPerson[];
  source: { css: string; html: string; script: string };
  scopeClass: string;
  /** Learner view: mirror the personal part into the lesson record (lib/qlct-course.ts fields). */
  record?: { courseSlug: string; lessonNumber: number; initialAnswers: Record<string, unknown> } | null;
  onProgress?: (percent: number) => void;
};

const POLL_MS = 6000;
const HIDDEN_POLL_MS = 30000;

function parse(json: string | null) {
  if (json === null) return null;
  try {
    const value = JSON.parse(json) as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

const text = (value: unknown) => (typeof value === "string" ? value : "");

/** The learner's own record: group, own extract and resolve, and how far the class work has gone. */
function personal(rows: Map<string, Row>, me: BoardPerson) {
  const get = (kind: string, key: string) => rows.get(`${kind}/${key}`)?.data;
  const groupId = Number(get("member", String(me.id))?.groupId) || null;
  const setup = get("setup", "groups") ?? {};
  const groupMeta = groupId ? (setup.groups as Record<string, { name?: string }> | undefined)?.[groupId] : undefined;
  const group = groupId ? get("group", String(groupId)) ?? {} : {};
  const locked = (part: string) => Boolean((group[part] as { locked?: boolean } | undefined)?.locked);
  const myLens = [...rows.values()].some((row) => row.kind === "lens" && row.userId === me.id);
  const extract = get("extract", String(me.id)) ?? null;
  const resolve = get("resolve", String(me.id)) ?? null;
  const steps = [Boolean(groupId), locked("v1"), myLens, locked("v2"), Boolean(extract), Boolean(resolve)];
  return {
    answers: {
      group: groupId ? (groupMeta?.name || `NHÓM ${groupId}`) : "",
      v1Locked: locked("v1"),
      v2Locked: locked("v2"),
      lens: myLens,
      extract,
      resolve,
    },
    progress: Math.round((steps.filter(Boolean).length / steps.length) * 100),
  };
}

export function ClassBoardLesson(props: ClassBoardProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const { token, me, staff, roster, source, record } = propsRef.current;
    const rows = new Map<string, Row>();
    const listeners = new Set<() => void>();
    let seq = 0;
    let status: "live" | "offline" = "live";
    let stopped = false;
    let timer: number | undefined;
    let syncTimer: number | undefined;
    let lastSynced = record ? JSON.stringify(record.initialAnswers ?? {}) : "";

    const apply = (wire: Wire) => {
      const id = `${wire.kind}/${wire.key}`;
      const data = parse(wire.data);
      if (data === null) rows.delete(id);
      else rows.set(id, { kind: wire.kind, key: wire.key, userId: wire.userId, data, updatedAt: wire.updatedAt });
    };

    const syncRecord = () => {
      if (!record) return;
      const mine = personal(rows, me);
      propsRef.current.onProgress?.(mine.progress);
      const body = JSON.stringify(mine.answers);
      if (body === lastSynced) return;
      window.clearTimeout(syncTimer);
      syncTimer = window.setTimeout(() => {
        void fetch("/api/learn/answers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonNumber: record.lessonNumber, courseSlug: record.courseSlug, answers: mine.answers, phase: "overview", phasesDone: [], progressPercent: mine.progress }),
        }).then((response) => { if (response.ok) lastSynced = body; }).catch(() => undefined);
      }, 1200);
    };

    const notify = () => {
      syncRecord();
      for (const listener of listeners) {
        try { listener(); } catch { /* the lesson re-renders on its next change */ }
      }
    };

    async function poll() {
      window.clearTimeout(timer);
      if (stopped) return;
      let changed = false;
      try {
        for (let round = 0; round < 20; round += 1) {
          const response = await fetch(`/api/learn/board?since=${seq}`, { headers: { "x-board-token": token }, cache: "no-store" });
          if (!response.ok) throw new Error(String(response.status));
          const body = await response.json() as { seq: number; more: boolean; rows: Wire[] };
          for (const wire of body.rows) apply(wire);
          if (body.rows.length) changed = true;
          seq = Math.max(seq, body.seq);
          if (!body.more) break;
        }
        const was = status;
        status = "live";
        if (changed || was !== "live") notify();
      } catch {
        const was = status;
        status = "offline";
        if (was !== "offline") notify();
      }
      if (!stopped) timer = window.setTimeout(poll, document.hidden ? HIDDEN_POLL_MS : POLL_MS);
    }

    async function write(kind: string, key: string, data: Record<string, unknown> | null): Promise<Result> {
      try {
        const response = await fetch("/api/learn/board", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-board-token": token },
          body: JSON.stringify({ kind, key, data }),
        });
        const body = await response.json().catch(() => ({})) as { ok?: boolean; error?: string; seq?: number };
        if (!response.ok || !body.ok) return { ok: false, error: response.status === 401 ? "EXPIRED" : body.error || "ERROR" };
        // Shown at once; `seq` is not moved, so the next poll still picks up everyone else's writes.
        const owner = rows.get(`${kind}/${key}`)?.userId ?? (kind === "member" || kind === "extract" || kind === "resolve" ? Number(key) : me.id);
        apply({ kind, key, userId: owner, data: data === null ? null : JSON.stringify(data), seq: body.seq ?? 0, updatedAt: new Date().toISOString() });
        syncRecord();
        return { ok: true };
      } catch {
        return { ok: false, error: "OFFLINE" };
      }
    }

    const board = {
      me,
      staff,
      roster,
      rows: () => [...rows.values()],
      status: () => status,
      put: (kind: string, key: string, data: Record<string, unknown>) => write(kind, key, data),
      del: (kind: string, key: string) => write(kind, key, null),
      onChange: (listener: () => void) => { listeners.add(listener); },
    };

    root.innerHTML = source.html;
    const style = document.createElement("style");
    style.textContent = source.css;
    root.prepend(style);

    const onVisible = () => { if (!document.hidden) void poll(); };
    document.addEventListener("visibilitychange", onVisible);
    void (async () => {
      await poll();
      if (stopped) return;
      try {
        new Function("board", "root", source.script)(board, root);
      } catch (error) {
        root.insertAdjacentHTML("afterbegin", `<p class="notice">Bài học gặp lỗi khi mở: ${String(error instanceof Error ? error.message : error).replace(/[<>&]/g, "")}</p>`);
      }
      syncRecord();
    })();

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      window.clearTimeout(syncTimer);
      document.removeEventListener("visibilitychange", onVisible);
      listeners.clear();
      root.innerHTML = "";
    };
  }, []);

  return <div ref={rootRef} className={props.scopeClass} />;
}
