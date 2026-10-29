/**
 * Super admin: an admin with users.superAdmin = 1, granted only from the server (seed:setSuperAdmin).
 * Only a super admin creates, deletes, locks, re-roles or resets the password of an admin account.
 * Super admin accounts cannot be changed from the web at all, not even by another super admin.
 */
export type Account = { legacyId: number; role: "admin" | "mod" | "user"; active: number; superAdmin?: number };
export type AccountAction = "delete" | "lock" | "password" | "role";

export function isSuperAdmin(user: Account | null | undefined) {
  return Boolean(user && user.role === "admin" && user.active === 1 && user.superAdmin === 1);
}

/** null when `actor` may do `action` to `target`, else the reason shown to the admin. */
export function accountActionError(actor: Account | null | undefined, target: Account, action: AccountAction): string | null {
  if (!actor || actor.role !== "admin" || actor.active !== 1) return "Không có quyền.";
  if (target.legacyId === actor.legacyId) return action === "password" ? null : "Không thao tác trên chính tài khoản của mình.";
  if (target.superAdmin === 1) return "Tài khoản super admin chỉ quản lý từ máy chủ.";
  if (target.role === "admin" && !isSuperAdmin(actor)) return "Chỉ super admin thao tác được trên tài khoản admin.";
  return null;
}

/** Creating an admin account is a super admin job; admins create mod and user accounts. */
export function createRoleError(actor: Account | null | undefined, role: "admin" | "mod" | "user"): string | null {
  if (!actor || actor.role !== "admin" || actor.active !== 1) return "Không có quyền.";
  if (role === "admin" && !isSuperAdmin(actor)) return "Chỉ super admin tạo được tài khoản admin.";
  return null;
}
