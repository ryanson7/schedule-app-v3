import type { NextApiRequest, NextApiResponse } from "next";
import { adminSupabase } from "../_utils/adminSupabase";
import { getUserFromRequest } from "../_utils/authUser";
import { ensureAttendanceIpAllowed } from "../_utils/attendanceIpGuard";

function todayKST(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method Not Allowed" });

  const result = await getUserFromRequest(req);
  if (!result.user) return res.status(401).json({ message: result.error, debug: (result as any).debug });

  const guard = await ensureAttendanceIpAllowed(req);
  if (!guard.ok) return res.status(403).json({ message: guard.reason, ip: guard.ip });

  const work_date = todayKST();
  const nowIso = new Date().toISOString();

  const { data: row, error } = await adminSupabase
    .from("attendance_logs")
    .select("id, check_in_time, check_out_time")
    .eq("user_id", result.user.id)
    .eq("work_date", work_date)
    .maybeSingle();

  if (error) return res.status(500).json({ message: error.message });
  if (!row?.check_in_time) return res.status(400).json({ message: "NOT_CHECKED_IN" });
  if (row.check_out_time) return res.status(200).json({ ok: true, message: "ALREADY_CHECKED_OUT" });

  const { error: updErr } = await adminSupabase
    .from("attendance_logs")
    .update({
      check_out_time: nowIso,
      check_out_ip: guard.ip,
      last_modified_by: result.user.id,
      updated_at: nowIso,
    })
    .eq("id", row.id);

  if (updErr) return res.status(500).json({ message: updErr.message });

  return res.status(200).json({ ok: true });
}
