import type { NextApiRequest, NextApiResponse } from "next";
import { adminSupabase } from "../../_utils/adminSupabase";
import { getUserFromRequest } from "../../_utils/authUser";

const EDIT_ROLES = new Set(["system_admin", "schedule_admin", "manager"]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method Not Allowed" });

  const { user, error } = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ message: error });
  if (!EDIT_ROLES.has(user.role)) return res.status(403).json({ message: "NO_EDIT_PERMISSION" });

  const { attendance_id, patch, reason } = req.body ?? {};
  if (!attendance_id || !patch || typeof patch !== "object") {
    return res.status(400).json({ message: "INVALID_BODY" });
  }

  // 안전: 수정 허용 필드만
  const allowedKeys = new Set(["check_in_time", "check_out_time", "work_date", "location_label"]);
  for (const k of Object.keys(patch)) {
    if (!allowedKeys.has(k)) return res.status(400).json({ message: `INVALID_FIELD:${k}` });
  }

  const { data: before, error: bErr } = await adminSupabase
    .from("attendance_logs")
    .select("*")
    .eq("id", attendance_id)
    .single();

  if (bErr || !before) return res.status(404).json({ message: "NOT_FOUND" });

  const nowIso = new Date().toISOString();

  const { data: after, error: uErr } = await adminSupabase
    .from("attendance_logs")
    .update({
      ...patch,
      last_modified_by: user.id,
      last_modified_at: nowIso,
    })
    .eq("id", attendance_id)
    .select("*")
    .single();

  if (uErr || !after) return res.status(500).json({ message: uErr?.message ?? "UPDATE_FAILED" });

  const { error: hErr } = await adminSupabase.from("attendance_history").insert({
    attendance_id,
    change_type: "ADMIN_EDIT",
    old_value: before,
    new_value: after,
    reason: reason ?? null,
    changed_by: user.id,
  });

  if (hErr) return res.status(500).json({ message: hErr.message });

  return res.status(200).json({ attendance: after });
}
