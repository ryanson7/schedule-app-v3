import type { NextApiRequest, NextApiResponse } from "next";
import { adminSupabase } from "../../_utils/adminSupabase";
import { getUserFromRequest } from "../../_utils/authUser";

const ALLOWED = new Set(["system_admin", "schedule_admin"]);

function isValidIp(v: string) {
  // 아주 간단한 ipv4 체크 (운영 시 강화 가능)
  const parts = v.split(".");
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    const n = Number(p);
    return Number.isInteger(n) && n >= 0 && n <= 255;
  });
}

function isValidCidr(v: string) {
  const [ip, mask] = v.split("/");
  const m = Number(mask);
  return isValidIp(ip) && Number.isInteger(m) && m >= 0 && m <= 32;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method Not Allowed" });

  const result = await getUserFromRequest(req);
  if (!result.user) return res.status(401).json({ message: result.error, debug: (result as any).debug });
  if (!ALLOWED.has(result.user.role)) return res.status(403).json({ message: "NO_PERMISSION" });

  const { rule_type, value, note } = req.body ?? {};
  if (rule_type !== "ip" && rule_type !== "cidr") return res.status(400).json({ message: "INVALID_RULE_TYPE" });
  if (typeof value !== "string" || !value.trim()) return res.status(400).json({ message: "INVALID_VALUE" });

  const v = value.trim();

  if (rule_type === "ip" && !isValidIp(v)) return res.status(400).json({ message: "INVALID_IP" });
  if (rule_type === "cidr" && !isValidCidr(v)) return res.status(400).json({ message: "INVALID_CIDR" });

  // 동일 rule_type+value 중복 방지(앱 레벨)
  const { data: exists, error: e1 } = await adminSupabase
    .from("attendance_ip_rules")
    .select("id")
    .eq("rule_type", rule_type)
    .eq("value", v)
    .maybeSingle();

  if (e1) return res.status(500).json({ message: e1.message });
  if (exists) return res.status(409).json({ message: "ALREADY_EXISTS" });

  const { error } = await adminSupabase.from("attendance_ip_rules").insert({
    rule_type,
    value: v,
    is_active: true,
    note: typeof note === "string" ? note : null,
    updated_by: result.user.id,
  });

  if (error) return res.status(500).json({ message: error.message });

  return res.status(200).json({ ok: true });
}
