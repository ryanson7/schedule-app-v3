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
  if (req.method !== "GET") return res.status(405).json({ message: "Method Not Allowed" });

  const result = await getUserFromRequest(req);
  if (!result.user) return res.status(401).json({ message: result.error, debug: (result as any).debug });

  const work_date = todayKST();

  const { data: row, error } = await adminSupabase
    .from("attendance_logs")
    .select("id, work_date, check_in_time, check_out_time")
    .eq("user_id", result.user.id)
    .eq("work_date", work_date)
    .maybeSingle();

  if (error) return res.status(500).json({ message: error.message });

  const status = !row?.check_in_time
    ? "NOT_CHECKED_IN"
    : !row?.check_out_time
    ? "CHECKED_IN"
    : "CHECKED_OUT";

  return res.status(200).json({
    work_date,
    status,
    check_in_time: row?.check_in_time ?? null,
    check_out_time: row?.check_out_time ?? null,
  });
}
