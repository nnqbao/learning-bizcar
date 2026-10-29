import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { api, q } from "@/lib/convex";
import { assignUserAccess, setAccountActive, setUserRole } from "@/lib/admin-actions";
import { CreateUserForm } from "@/components/admin/CreateUserForm";
import { ResetUserPassword } from "@/components/admin/ResetUserPassword";
import { DeleteUserButton } from "@/components/admin/DeleteUserButton";

export const dynamic = "force-dynamic";

export default async function UsersAdminPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const error = (await searchParams).error;
  const actor = await getSession();
  if (!actor || actor.role !== "admin") redirect("/admin/learning");
  const data = await q((convex, secret) => convex.query(api.reads.usersView, { secret }));
  const users = data.users;
  const groups = data.groups;
  // Super admin (users.superAdmin): manages admin accounts. Every rule is enforced again in convex/accountRules.ts.
  const isSuper = users.some((person) => person.id === actor.id && person.super_admin === 1);
  const canManage = (person: (typeof users)[number]) => person.id !== actor.id && person.super_admin !== 1 && (person.role !== "admin" || isSuper);
  return (
    <main>
      <h1 className="serif">Người dùng</h1>
      <p className="muted">Admin tạo và xóa tài khoản user, mod. Nhóm quyền quyết định menu của user (Học viên, giảng viên). Super admin quản trị thêm các tài khoản admin: tạo, khóa, đổi vai trò, đặt mật khẩu tạm, xóa. Tài khoản super admin chỉ quản lý từ máy chủ. Mod không vào được trang này.</p>
      {error && <p className="notice"><strong>{error}</strong></p>}
      <CreateUserForm groups={groups} canCreateAdmin={isSuper} />
      <div className="table-wrap card" style={{ padding: 0 }}>
        <table>
          <thead><tr><th>Người dùng</th><th>Vai trò</th><th>Nhóm quyền</th><th>Mật khẩu</th><th>Xóa</th></tr></thead>
          <tbody>
            {users.map((person) => (
              <tr key={person.id}>
                <td>{person.display_name}<div className="muted">@{person.username} · {person.active ? "active" : "inactive"}</div></td>
                <td>
                  {person.super_admin === 1 ? <span className="badge-super">Super admin</span> : isSuper && canManage(person) ? (
                    <form action={setUserRole} className="row-actions">
                      <input type="hidden" name="userId" value={person.id} />
                      <select name="role" defaultValue={person.role} aria-label="Vai trò">
                        <option value="user">user</option>
                        <option value="mod">mod</option>
                        <option value="admin">admin</option>
                      </select>
                      <button className="btn" type="submit">Đổi</button>
                    </form>
                  ) : person.role}
                  {isSuper && canManage(person) && person.role === "admin" && (
                    <form action={setAccountActive.bind(null, person.id, !person.active)} style={{ marginTop: 6 }}>
                      <button className="btn" type="submit">{person.active ? "Khóa" : "Mở khóa"}</button>
                    </form>
                  )}
                </td>
                <td>
                  {person.role === "user" ? (
                    <form action={assignUserAccess} className="row-actions">
                      <input type="hidden" name="userId" value={person.id} />
                      
                      <select name="groupId" defaultValue={person.permission_group_id ?? ""} aria-label="Nhóm quyền">
                        <option value="">Chưa có nhóm quyền</option>
                        {groups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                      <button className="btn dark" type="submit">Lưu</button>
                    </form>
                  ) : <span className="muted">{person.super_admin === 1 ? "Toàn quyền · quản trị cả tài khoản admin" : person.role === "admin" ? "Toàn quyền" : "Mọi menu trừ người dùng, phòng ban, nhóm quyền"}</span>}
                </td>
                <td>{person.id === actor.id || canManage(person) ? <ResetUserPassword userId={person.id} /> : <span className="muted">—</span>}</td>
                <td>{canManage(person) ? <DeleteUserButton id={person.id} username={person.username} name={person.display_name} /> : <span className="muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
