import type { NextApiRequest, NextApiResponse } from "next";
import { adminSupabase } from "../../_utils/adminSupabase";
import { getUserFromRequest } from "../../_utils/authUser";

const VIEW_ROLES = new Set(["system_admin", "schedule_admin", "manager"]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ message: "Method Not Allowed" });

  const { user, error } = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ message: error });
  if (!VIEW_ROLES.has(user.role)) return res.status(403).json({ message: "NO_VIEW_PERMISSION" });

  const attendance_id = Number(req.query.attendance_id);
  if (!attendance_id || Number.isNaN(attendance_id)) {
    return res.status(400).json({ message: "INVALID_ATTENDANCE_ID" });
  }

  const { data, error: qErr } = await adminSupabase
    .from("attendance_history")
    .select("*")
    .eq("attendance_id", attendance_id)
    .order("changed_at", { ascending: false });

  if (qErr) return res.status(500).json({ message: qErr.message });

  return res.status(200).json({ attendance_id, rows: data ?? [] });
}
