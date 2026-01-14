import type { NextApiRequest } from "next";
import { adminSupabase } from "./adminSupabase";

function getClientIp(req: NextApiRequest): string | null {
  const xff = req.headers["x-forwarded-for"];
  const raw = Array.isArray(xff) ? xff[0] : xff;
  if (raw) return raw.split(",")[0].trim();

  const ra = (req.socket as any)?.remoteAddress as string | undefined;
  if (!ra) return null;

  // ::ffff:127.0.0.1 / ::1 같은 케이스 정리
  const ip = ra.replace(/^::ffff:/, "");
  if (ip === "::1") return "127.0.0.1";
  return ip;
}

function ipToInt(ip: string): number | null {
  const p = ip.split(".");
  if (p.length !== 4) return null;
  const n = p.map((x) => Number(x));
  if (n.some((v) => !Number.isInteger(v) || v < 0 || v > 255)) return null;
  return ((n[0] << 24) >>> 0) + (n[1] << 16) + (n[2] << 8) + n[3];
}

function cidrContains(ip: string, cidr: string): boolean {
  const [base, maskStr] = cidr.split("/");
  const mask = Number(maskStr);
  if (!base || !Number.isInteger(mask) || mask < 0 || mask > 32) return false;

  const ipInt = ipToInt(ip);
  const baseInt = ipToInt(base);
  if (ipInt === null || baseInt === null) return false;

  const maskInt = mask === 0 ? 0 : (~((1 << (32 - mask)) - 1) >>> 0) >>> 0;
  return (ipInt & maskInt) === (baseInt & maskInt);
}

export async function ensureAttendanceIpAllowed(req: NextApiRequest) {
  const ip = getClientIp(req);

  // 1) toggle allow_all 확인 (활성 = 전체 허용)
  const { data: toggleRow, error: tErr } = await adminSupabase
    .from("attendance_ip_rules")
    .select("is_active")
    .eq("rule_type", "toggle")
    .eq("value", "allow_all")
    .maybeSingle();

  if (tErr) return { ok: false as const, ip, reason: "IP_RULES_ERROR" as const };

  // ✅ 테스트 모드: 전체 허용
  if (toggleRow?.is_active) return { ok: true as const, ip };

  // 운영 모드: IP 없으면 차단
  if (!ip) return { ok: false as const, ip: null, reason: "NO_IP" as const };

  // 2) 활성 규칙 조회
  const { data: rules, error: rErr } = await adminSupabase
    .from("attendance_ip_rules")
    .select("rule_type,value")
    .eq("is_active", true)
    .in("rule_type", ["ip", "cidr"]);

  if (rErr) return { ok: false as const, ip, reason: "IP_RULES_ERROR" as const };

  const list = rules ?? [];
  const ips = list.filter((r) => r.rule_type === "ip").map((r) => r.value);
  if (ips.includes(ip)) return { ok: true as const, ip };

  const cidrs = list.filter((r) => r.rule_type === "cidr").map((r) => r.value);
  if (cidrs.some((c) => cidrContains(ip, c))) return { ok: true as const, ip };

  return { ok: false as const, ip, reason: "IP_NOT_ALLOWED" as const };
}
