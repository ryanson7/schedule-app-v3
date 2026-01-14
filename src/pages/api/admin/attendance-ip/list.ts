import type { NextApiRequest, NextApiResponse } from "next";
import { adminSupabase } from "../../_utils/adminSupabase";
import { getUserFromRequest } from "../../_utils/authUser";

const ALLOWED = new Set(["system_admin", "schedule_admin"]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ message: "Method Not Allowed" });

  const result = await getUserFromRequest(req);
  if (!result.user) return res.status(401).json({ message: result.error, debug: (result as any).debug });
  if (!ALLOWED.has(result.user.role)) return res.status(403).json({ message: "NO_PERMISSION" });

  const { data, error } = await adminSupabase
    .from("attendance_ip_rules")
    .select("id, rule_type, value, is_active, note, created_at, updated_at, updated_by")
    .order("rule_type", { ascending: true })
    .order("id", { ascending: true });

  if (error) return res.status(500).json({ message: error.message });

  return res.status(200).json({ rows: data ?? [] });
}
