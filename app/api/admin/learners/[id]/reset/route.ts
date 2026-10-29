import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { resetPassword } from "@/lib/admin-actions";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  const { id } = await context.params;
  try {
    const temporaryPassword = await resetPassword(Number(id));
    return NextResponse.json({ temporaryPassword });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không đặt lại được mật khẩu." }, { status: 403 });
  }
}
