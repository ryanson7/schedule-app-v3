// src/pages/api/attendance/reset-today.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { adminSupabase } from "../_utils/adminSupabase";
import { getUserFromRequest } from "../_utils/authUser";

function todayKST(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { user, error } = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ message: error });

  // ✅ 관리자만 허용
  if (!["system_admin", "schedule_admin"].includes(user.role)) {
    return res.status(403).json({ message: "관리자 전용 기능입니다." });
  }

  const work_date = todayKST();

  const { error: updErr } = await adminSupabase
    .from("attendance_logs")
    .update({
      check_in_time: null,
      check_out_time: null,
      check_in_ip: null,
      check_out_ip: null,
      last_modified_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .eq("work_date", work_date);

  if (updErr) {
    return res.status(500).json({ message: updErr.message });
  }

  return res.status(200).json({ ok: true });
}
