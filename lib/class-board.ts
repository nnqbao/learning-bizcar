import { createHmac, timingSafeEqual } from "crypto";

/**
 * Signed pass for one viewer of one class board, minted when the lesson page renders. Polls and writes
 * check the signature instead of reloading the session, so an idle poll costs no database reads.
 */
export type BoardPass = { userId: number; cohortId: number; lessonNumber: number; staff: boolean; exp: number };

const TTL_MS = 12 * 60 * 60 * 1000;

function sign(body: string, secret: string) {
  return createHmac("sha256", `class-board:${secret}`).update(body).digest("base64url");
}

export function boardToken(pass: Omit<BoardPass, "exp">, secret: string, at = Date.now()) {
  const body = Buffer.from(JSON.stringify({ ...pass, exp: at + TTL_MS })).toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

export function readBoardToken(token: string | null | undefined, secret: string, at = Date.now()): BoardPass | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = Buffer.from(sign(body, secret));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const pass = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as BoardPass;
    if (typeof pass.exp !== "number" || pass.exp < at) return null;
    if (![pass.userId, pass.cohortId, pass.lessonNumber].every(Number.isInteger) || typeof pass.staff !== "boolean") return null;
    return pass;
  } catch {
    return null;
  }
}

/** Class roster handed to the board (names for groups, extract and resolve tables). */
export type BoardPerson = { id: number; name: string };
