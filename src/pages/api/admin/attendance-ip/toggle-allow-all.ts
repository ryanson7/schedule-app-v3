import type { NextApiRequest, NextApiResponse } from "next";
import { adminSupabase } from "../../_utils/adminSupabase";
import { getUserFromRequest } from "../../_utils/authUser";

const ALLOWED = new Set(["system_admin", "schedule_admin"]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method Not Allowed" });

  const result = await getUserFromRequest(req);
  if (!result.user) return res.status(401).json({ message: result.error, debug: (result as any).debug });
  if (!ALLOWED.has(result.user.role)) return res.status(403).json({ message: "NO_PERMISSION" });

  const { allow_all } = req.body ?? {};
  if (typeof allow_all !== "boolean") return res.status(400).json({ message: "INVALID_BODY" });

  // toggle row가 없으면 생성 + 업데이트
  const { data: existing, error: e1 } = await adminSupabase
    .from("attendance_ip_rules")
    .select("id")
    .eq("rule_type", "toggle")
    .eq("value", "allow_all")
    .maybeSingle();

  if (e1) return res.status(500).json({ message: e1.message });

  if (!existing) {
    const { error: iErr } = await adminSupabase.from("attendance_ip_rules").insert({
      rule_type: "toggle",
      value: "allow_all",
      is_active: allow_all,
      note: "전체 허용 토글",
      updated_by: result.user.id,
    });
    if (iErr) return res.status(500).json({ message: iErr.message });
  } else {
    const { error: uErr } = await adminSupabase
      .from("attendance_ip_rules")
      .update({
        is_active: allow_all,
        updated_at: new Date().toISOString(),
        updated_by: result.user.id,
      })
      .eq("id", existing.id);
    if (uErr) return res.status(500).json({ message: uErr.message });
  }

  return res.status(200).json({ ok: true });
}
