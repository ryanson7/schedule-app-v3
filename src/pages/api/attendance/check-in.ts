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

  const { data: existing, error: e1 } = await adminSupabase
    .from("attendance_logs")
    .select("id, check_in_time")
    .eq("user_id", result.user.id)
    .eq("work_date", work_date)
    .maybeSingle();

  if (e1) return res.status(500).json({ message: e1.message });

  if (existing?.check_in_time) return res.status(200).json({ ok: true, message: "ALREADY_CHECKED_IN" });

  if (!existing) {
    const { error: insErr } = await adminSupabase.from("attendance_logs").insert({
      user_id: result.user.id,
      work_date,
      check_in_time: nowIso,
      check_in_ip: guard.ip,
      last_modified_by: result.user.id,
      updated_at: nowIso,
    });
    if (insErr) return res.status(500).json({ message: insErr.message });
  } else {
    const { error: updErr } = await adminSupabase
      .from("attendance_logs")
      .update({
        check_in_time: nowIso,
        check_in_ip: guard.ip,
        last_modified_by: result.user.id,
        updated_at: nowIso,
      })
      .eq("id", existing.id);

    if (updErr) return res.status(500).json({ message: updErr.message });
  }

  return res.status(200).json({ ok: true });
}
