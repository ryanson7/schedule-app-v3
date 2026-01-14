import type { NextApiRequest, NextApiResponse } from "next";
import { adminSupabase } from "../../_utils/adminSupabase";
import { getUserFromRequest } from "../../_utils/authUser";

const ALLOWED = new Set(["system_admin", "schedule_admin"]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method Not Allowed" });

  const result = await getUserFromRequest(req);
  if (!result.user) return res.status(401).json({ message: result.error, debug: (result as any).debug });
  if (!ALLOWED.has(result.user.role)) return res.status(403).json({ message: "NO_PERMISSION" });

  const { id, is_active } = req.body ?? {};
  if (!id || typeof is_active !== "boolean") return res.status(400).json({ message: "INVALID_BODY" });

  // toggle row는 여기서 못 바꾸게(전용 API 사용)
  const { data: row, error: rErr } = await adminSupabase
    .from("attendance_ip_rules")
    .select("id, rule_type")
    .eq("id", id)
    .maybeSingle();

  if (rErr) return res.status(500).json({ message: rErr.message });
  if (!row) return res.status(404).json({ message: "NOT_FOUND" });
  if (row.rule_type === "toggle") return res.status(400).json({ message: "USE_TOGGLE_API" });

  const { error } = await adminSupabase
    .from("attendance_ip_rules")
    .update({
      is_active,
      updated_at: new Date().toISOString(),
      updated_by: result.user.id,
    })
    .eq("id", id);

  if (error) return res.status(500).json({ message: error.message });

  return res.status(200).json({ ok: true });
}
