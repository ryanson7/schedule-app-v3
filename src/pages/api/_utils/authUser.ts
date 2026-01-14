// /src/pages/api/_utils/authUser.ts
import type { NextApiRequest } from "next";
import { adminSupabase } from "./adminSupabase";

/**
 * Authorization: Bearer <access_token>
 * - Next.js/Node 환경에 따라 header가 string | string[] 일 수 있어 robust 하게 처리
 */
function extractBearerToken(req: NextApiRequest): string | null {
  const raw =
    (req.headers["authorization"] as string | string[] | undefined) ??
    (req.headers["Authorization"] as string | string[] | undefined);

  const header = Array.isArray(raw) ? raw[0] : raw;
  if (!header) return null;

  const trimmed = header.trim();
  if (!/^Bearer\s+/i.test(trimmed)) return null;

  return trimmed.replace(/^Bearer\s+/i, "").trim() || null;
}

export async function getUserFromRequest(req: NextApiRequest) {
  const token = extractBearerToken(req);

  if (!token) {
    // ✅ 디버그용: 실제 서버가 받은 헤더 키를 같이 내려줌(원인 파악용)
    return {
      user: null,
      error: "NO_TOKEN" as const,
      debug: {
        hasAuthorization: !!req.headers["authorization"] || !!(req.headers as any)["Authorization"],
        headerKeys: Object.keys(req.headers || {}),
      },
    };
  }

  // ✅ Supabase auth user 확인
  const { data, error } = await adminSupabase.auth.getUser(token);
  if (error || !data?.user) {
    return { user: null, error: "INVALID_TOKEN" as const };
  }

  // ✅ public.users 매핑 (auth_id 컬럼 기준)
  const { data: u, error: uErr } = await adminSupabase
    .from("users")
    .select("id, role, name")
    .eq("auth_id", data.user.id)
    .maybeSingle();

  if (uErr || !u) return { user: null, error: "NO_PUBLIC_USER" as const };

  return { user: u, error: null as const };
}
