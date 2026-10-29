// Super admin manages admin accounts; super admins are untouchable from the web. Run: npx tsx lib/super-admin.check.ts
import fs from "node:fs";
import * as writes from "../convex/writes.ts";
import { accountActionError, createRoleError, isSuperAdmin } from "../convex/accountRules.ts";

function assert(cond: unknown, label: string) {
  if (!cond) throw new Error(label);
}
// --- Rules ---
const sup = { legacyId: 1, role: "admin" as const, active: 1, superAdmin: 1 };
const sup2 = { legacyId: 2, role: "admin" as const, active: 1, superAdmin: 1 };
const adm = { legacyId: 3, role: "admin" as const, active: 1 };
const adm2 = { legacyId: 4, role: "admin" as const, active: 1 };
const usr = { legacyId: 5, role: "user" as const, active: 1 };
assert(isSuperAdmin(sup) && !isSuperAdmin(adm) && !isSuperAdmin({ ...sup, active: 0 }) && !isSuperAdmin({ ...usr, superAdmin: 1 }), "isSuperAdmin");
for (const action of ["delete", "lock", "password", "role"] as const) {
  assert(accountActionError(sup, adm, action) === null, `super → admin ${action}`);
  assert(accountActionError(adm, adm2, action) !== null, `admin ↛ admin ${action}`);
  assert(accountActionError(adm, usr, action) === null, `admin → user ${action}`);
  assert(accountActionError(sup, sup2, action) !== null && accountActionError(adm, sup, action) !== null, `nobody → super admin ${action}`);
}
assert(accountActionError(usr, { ...usr, legacyId: 6 }, "delete") !== null, "user cannot act");
assert(accountActionError(sup, sup, "password") === null && accountActionError(sup, sup, "delete") !== null, "self: own password only");
assert(createRoleError(adm, "admin") !== null && createRoleError(adm, "mod") === null && createRoleError(sup, "admin") === null, "only super creates admins");

// --- Mutations against an in-memory db ---
type Doc = Record<string, unknown> & { _id: string };
const tables = new Map<string, Doc[]>();
let n = 0;
const rows = (name: string) => { if (!tables.has(name)) tables.set(name, []); return tables.get(name)!; };
const find = (id: string) => [...tables.values()].flat().find((doc) => doc._id === id);
function builder(name: string, filters: [string, unknown][] = []) {
  const list = () => rows(name).filter((doc) => filters.every(([k, v]) => doc[k] === v));
  return {
    withIndex: (_: string, fn?: (q: unknown) => unknown) => { const next: [string, unknown][] = [...filters]; const q = { eq: (k: string, v: unknown) => { next.push([k, v]); return q; } }; fn?.(q); return builder(name, next); },
    collect: async () => list(), first: async () => list()[0] ?? null, unique: async () => list()[0] ?? null,
  };
}
const ctx = { db: {
  query: (name: string) => builder(name),
  insert: async (name: string, value: Record<string, unknown>) => { const _id = `${name}:${++n}`; rows(name).push({ ...value, _id }); return _id; },
  patch: async (id: string, value: Record<string, unknown>) => { Object.assign(find(id)!, value); },
  delete: async (id: string) => { for (const list of tables.values()) { const at = list.findIndex((d) => d._id === id); if (at >= 0) list.splice(at, 1); } },
} };
type R = { ok?: boolean; error?: string; id?: number } | undefined;
const call = (fn: unknown, args: Record<string, unknown>) => (fn as { _handler: (c: unknown, a: unknown) => Promise<R> })._handler(ctx, { secret: "check", ...args });
const user = (id: number) => rows("users").find((u) => u.legacyId === id);
process.env.APP_SECRET = "check";
for (const u of [sup, sup2, adm, adm2, usr]) rows("users").push({ ...u, _id: `users:${++n}`, username: `u${u.legacyId}@x`, usernameLower: `u${u.legacyId}@x`, displayName: `U${u.legacyId}`, passwordHash: "old", mustChangePassword: 0 });
rows("sessions").push({ _id: "sessions:a", userId: 4, token: "t" });
rows("organizations").push({ _id: "organizations:1", legacyId: 1, name: "VABIX" });

(async () => {
  assert((await call(writes.resetPassword, { actorId: 3, userId: 4, passwordHash: "x" }))?.error && user(4)!.passwordHash === "old", "admin cannot reset another admin's password");
  assert((await call(writes.resetPassword, { actorId: 3, userId: 1, passwordHash: "x" }))?.error && user(1)!.passwordHash === "old", "admin cannot reset super admin's password");
  assert((await call(writes.resetPassword, { actorId: 3, userId: 5, passwordHash: "x" }))?.ok && user(5)!.passwordHash === "x", "admin resets a user");
  assert((await call(writes.resetPassword, { actorId: 1, userId: 4, passwordHash: "y" }))?.ok && user(4)!.passwordHash === "y", "super resets an admin");
  assert((await call(writes.resetPassword, { actorId: 2, userId: 1, passwordHash: "z" }))?.error, "super cannot reset the other super");
  assert((await call(writes.setAccountActive, { actorId: 3, userId: 4, active: false }))?.error && user(4)!.active === 1, "admin cannot lock admin");
  assert((await call(writes.setAccountActive, { actorId: 1, userId: 4, active: false }))?.ok && user(4)!.active === 0, "super locks admin");
  assert((await call(writes.setAccountActive, { actorId: 1, userId: 2, active: false }))?.error && user(2)!.active === 1, "super admin cannot be locked");
  await call(writes.setAccountActive, { actorId: 1, userId: 4, active: true });
  assert((await call(writes.setUserRole, { actorId: 3, userId: 5, role: "mod" }))?.error && user(5)!.role === "user", "admin cannot change roles");
  assert((await call(writes.setUserRole, { actorId: 1, userId: 5, role: "mod" }))?.ok && user(5)!.role === "mod", "super changes a role");
  assert((await call(writes.setUserRole, { actorId: 1, userId: 4, role: "user" }))?.ok && user(4)!.role === "user" && !rows("sessions").some((s) => s.userId === 4), "super demotes admin; sessions end");
  assert((await call(writes.setUserRole, { actorId: 1, userId: 2, role: "user" }))?.error && user(2)!.role === "admin", "super admin role is fixed");
  assert((await call(writes.setUserRole, { actorId: 1, userId: 1, role: "user" }))?.error, "not on yourself");
  await call(writes.setUserRole, { actorId: 1, userId: 4, role: "admin" });
  const created = (role: string, actorId: number) => call(writes.createAccount, { actorId, username: `new-${role}-${actorId}@x`, passwordHash: "h", displayName: "New", role, departmentId: null, groupId: null });
  assert((await created("admin", 3))?.error && !rows("users").some((u) => u.username === "new-admin-3@x"), "admin cannot create admin");
  assert(!(await created("mod", 3))?.error, "admin creates mod");
  assert(!(await created("admin", 1))?.error && rows("users").some((u) => u.username === "new-admin-1@x"), "super creates admin");
  assert((await call(writes.deleteUserAccount, { actorId: 3, userId: 4 }))?.error && user(4), "admin cannot delete admin");
  assert((await call(writes.deleteUserAccount, { actorId: 1, userId: 2 }))?.error && user(2), "super admin cannot be deleted");
  assert((await call(writes.deleteUserAccount, { actorId: 1, userId: 4 }))?.ok && !user(4), "super deletes admin");

  const page = fs.readFileSync("app/admin/organization/users/page.tsx", "utf8");
  assert(page.includes("canCreateAdmin={isSuper}") && page.includes("person.super_admin !== 1"), "users page follows the rules");
  const seed = fs.readFileSync("convex/seed.ts", "utf8");
  assert(/export const setSuperAdmin = internalMutation\(/.test(seed), "granting is server-only");
  console.log("super-admin ok");
})().catch((error) => { console.error(error); process.exit(1); });
