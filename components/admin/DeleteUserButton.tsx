"use client";

import { useState } from "react";

/** Admin: permanently delete a non-admin account. The admin retypes the username to confirm. */
export function DeleteUserButton({ id, username, name }: { id: number; username: string; name: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <span className="row-actions">
      <button className="btn" type="button" disabled={pending} style={{ color: "var(--red)", borderColor: "#e4c3bf" }} onClick={async () => {
        const typed = window.prompt(
          `Xóa vĩnh viễn tài khoản «${name}»?\n\nSẽ xóa: tài khoản, ghi danh, bài làm, bài nộp và nhận xét, nhiệm vụ, thông báo, phiên đăng nhập, bài cá nhân trên bảng lớp; gỡ khỏi vị trí giảng viên các lớp. Không hoàn tác được.\n\nGõ đúng tên đăng nhập để xác nhận:\n${username}`,
        );
        if (typed === null) return;
        if (typed.trim().toLowerCase() !== username.toLowerCase()) { setMessage("Tên đăng nhập không khớp, chưa xóa."); return; }
        setPending(true);
        setMessage("");
        const response = await fetch(`/api/admin/learners/${id}`, { method: "DELETE" });
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        setPending(false);
        if (!response.ok) { setMessage(payload?.error || "Không xóa được."); return; }
        window.location.reload();
      }}>{pending ? "Đang xóa…" : "Xóa"}</button>
      {message && <span role="status" className="muted">{message}</span>}
    </span>
  );
}
