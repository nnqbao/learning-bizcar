import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { api, q } from "@/lib/convex";
import { assignUserAccess } from "@/lib/admin-actions";
import { CreateUserForm } from "@/components/admin/CreateUserForm";
import { ResetUserPassword } from "@/components/admin/ResetUserPassword";
import { DeleteUserButton } from "@/components/admin/DeleteUserButton";

export const dynamic = "force-dynamic";

export default async function UsersAdminPage() {
  const actor = await getSession();
  if (!actor || actor.role !== "admin") redirect("/admin/learning");
  const data = await q((convex, secret) => convex.query(api.reads.usersView, { secret }));
  const users = data.users;
  const departments = data.departments;
  const groups = data.groups;
  return (
    <main>
      <h1 className="serif">Người dùng</h1>
      <p className="muted">Admin tạo và xóa tài khoản. User được gắn phòng ban và nhóm quyền. Tài khoản admin và chính mình không xóa được. Mod không vào được trang này.</p>
      <CreateUserForm departments={departments} groups={groups} />
      <div className="table-wrap card" style={{ padding: 0 }}>
        <table>
          <thead><tr><th>Người dùng</th><th>Vai trò</th><th>Phòng ban và nhóm quyền</th><th>Mật khẩu</th><th>Xóa</th></tr></thead>
          <tbody>
            {users.map((person) => (
              <tr key={person.id}>
                <td>{person.display_name}<div className="muted">@{person.username} · {person.active ? "active" : "inactive"}</div></td>
                <td>{person.role}</td>
                <td>
                  {person.role === "user" ? (
                    <form action={assignUserAccess} className="row-actions">
                      <input type="hidden" name="userId" value={person.id} />
                      <select name="departmentId" defaultValue={person.department_id ?? ""} aria-label="Phòng ban">
                        <option value="">Chưa gắn phòng ban</option>
                        {departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                      <select name="groupId" defaultValue={person.permission_group_id ?? ""} aria-label="Nhóm quyền">
                        <option value="">Chưa có nhóm quyền</option>
                        {groups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                      <button className="btn dark" type="submit">Lưu</button>
                    </form>
                  ) : <span className="muted">{person.role === "admin" ? "Toàn quyền" : "Mọi menu trừ người dùng, phòng ban, nhóm quyền"}</span>}
                </td>
                <td><ResetUserPassword userId={person.id} /></td>
                <td>{person.role !== "admin" && person.id !== actor.id ? <DeleteUserButton id={person.id} username={person.username} name={person.display_name} /> : <span className="muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
