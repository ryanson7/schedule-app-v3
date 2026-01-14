// src/pages/api/message.ts
import type { NextApiRequest, NextApiResponse } from "next";

const API_URL =
  process.env.CLOSEAPI_URL ??
  "https://closeapi.eduwill.net/bot/10608844/channel/81063172-71bb-7066-51ef-dd7cca1b7000/message";

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "https://schedule-app-v3-kappa.vercel.app",
];

// CORS: 허용 origin만 echo (origin 없으면 세팅 안 함)
function setCors(req: NextApiRequest, res: NextApiResponse) {
  const origin = (req.headers?.origin as string | undefined) ?? "";
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
}

// 문자열 body 안전 파싱
function safeJsonParse(input: any) {
  if (typeof input !== "string") return input;
  try {
    return JSON.parse(input);
  } catch {
    return input;
  }
}

// ✅ 핵심: 어떤 형태로 와도 closeapi가 먹는 { text }로 정규화
function normalizeToTextBody(body: any): { text: string } {
  if (!body) return { text: "" };

  // 이미 정답 형태
  if (typeof body?.text === "string") return { text: body.text };

  // 흔한 변형들
  const c1 = body?.content;
  if (typeof c1 === "string") return { text: c1 };
  if (typeof c1?.text === "string") return { text: c1.text };

  const m1 = body?.message;
  if (typeof m1 === "string") return { text: m1 };
  if (typeof m1?.text === "string") return { text: m1.text };

  // fallback: content 키를 content로 보내는 경우도 있어서, 마지막으로 string化
  if (typeof body === "string") return { text: body };

  // 여기까지 오면 뭘 보낼지 애매 → 디버그를 위해 stringify
  return { text: JSON.stringify(body) };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setCors(req, res);

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      status: "API is running",
      upstream: API_URL,
      allowedOrigins: ALLOWED_ORIGINS,
      hint: "POST로 보내면 closeapi로 프록시합니다.",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const rawBody = req.body;
  const parsed = safeJsonParse(rawBody);
  const normalized = normalizeToTextBody(parsed);

  // 디버그 로그 (터미널)
  console.log("📨 /api/message origin:", req.headers?.origin);
  console.log("📨 /api/message content-type:", req.headers["content-type"]);
  console.log("📨 /api/message rawBody:", rawBody);
  console.log("📨 /api/message parsedBody:", parsed);
  console.log("🧼 /api/message normalizedBody:", normalized);

  // 타임아웃 10초
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  try {
    const upstream = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(normalized),
      signal: controller.signal,
    });

    const text = await upstream.text();
    let upstreamBody: any = text;
    try {
      upstreamBody = JSON.parse(text);
    } catch {}

    console.log("📮 closeapi status:", upstream.status);
    console.log("📮 closeapi body:", upstreamBody);

    return res.status(upstream.status).json({
      ok: upstream.ok,
      closeapi: { status: upstream.status, body: upstreamBody },
      sent: normalized, // ✅ 내가 실제로 보낸 payload 확인용
    });
  } catch (e: any) {
    const isTimeout = e?.name === "AbortError";
    console.error("❌ /api/message error:", e);

    return res.status(isTimeout ? 504 : 500).json({
      ok: false,
      error: isTimeout ? "Upstream timeout (10s)" : e?.message || String(e),
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
