import type { NextApiRequest, NextApiResponse } from "next";
import { adminSupabase } from "../../_utils/adminSupabase";
import { getUserFromRequest } from "../../_utils/authUser";

const VIEW_ROLES = new Set(["system_admin", "schedule_admin", "manager"]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ message: "Method Not Allowed" });

    const result = await getUserFromRequest(req);
    if (!result.user) return res.status(401).json({ message: result.error, debug: (result as any).debug });
    const user = result.user;

  if (!VIEW_ROLES.has(user.role)) return res.status(403).json({ message: "NO_VIEW_PERMISSION" });

  const date = (req.query.date as string) || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ message: "INVALID_DATE" });

const { data, error: qErr } = await adminSupabase
  .from("attendance_logs")
  .select(`
    id,
    work_date,
    check_in_time,
    check_out_time,
    check_in_ip,
    check_out_ip,
    location_label,
    last_modified_by,
    last_modified_at,
    user:users!attendance_logs_user_id_fkey ( name ),
    modifier:users!attendance_logs_last_modified_by_fkey ( name )
  `)
  .eq("work_date", date)
  .order("check_in_time", { ascending: true, nullsFirst: false });



  if (qErr) return res.status(500).json({ message: qErr.message });

  return res.status(200).json({ date, rows: data ?? [] });
}
