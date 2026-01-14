// src/pages/api/message-test.ts
import type { NextApiRequest, NextApiResponse } from "next";

const API_URL =
  process.env.CLOSEAPI_URL ??
  "https://closeapi.eduwill.net/bot/10608844/channel/81063172-71bb-7066-51ef-dd7cca1b7000/message";

type Json = Record<string, any>;

function safeJsonParse(input: any) {
  if (typeof input !== "string") return input;
  try {
    return JSON.parse(input);
  } catch {
    return input;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS (개발 편의상 localhost 허용 / 필요하면 *로 변경 가능)
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      status: "API is running",
      upstream: API_URL,
      hint: "POST로 body를 보내면 closeapi로 프록시합니다.",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const rawBody = req.body;
  const body = safeJsonParse(rawBody);

  console.log("📨 [/api/message] content-type:", req.headers["content-type"]);
  console.log("📨 [/api/message] rawBody:", rawBody);
  console.log("📨 [/api/message] parsed body:", body);

  // 타임아웃 10초
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  try {
    // ⚠️ closeapi가 Authorization 같은 헤더를 요구한다면 여기서 추가하세요.
    // 예: headers.Authorization = `Bearer ${process.env.CLOSEAPI_TOKEN}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const upstream = await fetch(API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
    });

    const text = await upstream.text();
    let parsed: Json | string = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      // JSON 아니면 text 그대로
    }

    console.log("📮 [closeapi] status:", upstream.status);
    console.log("📮 [closeapi] body:", parsed);

    // ✅ 핵심: 업스트림 status 그대로 내려줌 (403이면 403으로 내려감)
    return res.status(upstream.status).json({
      ok: upstream.ok,
      closeapi: {
        status: upstream.status,
        body: parsed,
      },
    });
  } catch (e: any) {
    const isTimeout = e?.name === "AbortError";
    console.error("❌ [/api/message] error:", e);

    return res.status(isTimeout ? 504 : 500).json({
      ok: false,
      error: isTimeout ? "Upstream timeout (10s)" : e?.message || String(e),
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
