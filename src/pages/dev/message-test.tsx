// src/pages/dev/message-test.tsx
"use client";

import React, { useMemo, useState } from "react";

type SendResult = any;

export default function MessageTestPage() {
  const [loading, setLoading] = useState(false);
  const [last, setLast] = useState<SendResult | null>(null);

  const presets = useMemo(
    () => [
      {
        name: "✅ Preset A (정답: text)",
        body: { text: "🧪 메시지 테스트 A - " + new Date().toLocaleString() },
      },
      {
        name: "Preset B (content.text → 서버에서 text로 정규화)",
        body: { content: { text: "🧪 메시지 테스트 B - " + new Date().toLocaleString() } },
      },
      {
        name: "Preset C (message.text → 서버에서 text로 정규화)",
        body: { message: { text: "🧪 메시지 테스트 C - " + new Date().toLocaleString() } },
      },
    ],
    []
  );

  const [selected, setSelected] = useState(0);
  const [raw, setRaw] = useState(() => JSON.stringify(presets[0].body, null, 2));

  const onChangePreset = (idx: number) => {
    setSelected(idx);
    setRaw(JSON.stringify(presets[idx].body, null, 2));
  };

  const send = async () => {
    setLoading(true);
    setLast(null);

    let body: any;
    try {
      body = JSON.parse(raw);
    } catch (e: any) {
      setLast({ ok: false, error: "JSON 파싱 실패", details: e?.message || String(e) });
      setLoading(false);
      return;
    }

    try {
      const r = await fetch("/api/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await r.json().catch(() => ({}));
      setLast({ httpStatus: r.status, data });
    } catch (e: any) {
      setLast({ ok: false, error: "fetch 실패", details: e?.message || String(e) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: "0 auto", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>네이버웍스 메시지 테스트</h1>
      <p style={{ opacity: 0.8 }}>
        이 페이지는 <code>/api/message</code>만 호출합니다. 스케줄 DB에는 아무 것도 저장하지 않습니다.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {presets.map((p, idx) => (
          <button
            key={p.name}
            onClick={() => onChangePreset(idx)}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: idx === selected ? "#eee" : "white",
              cursor: "pointer",
            }}
          >
            {p.name}
          </button>
        ))}
      </div>

      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        rows={10}
        style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #ddd" }}
      />

      <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}>
        <button
          onClick={send}
          disabled={loading}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #111",
            background: loading ? "#999" : "#111",
            color: "white",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "전송 중..." : "전송 테스트"}
        </button>
        <span style={{ opacity: 0.7 }}>
          터미널 로그는 <code>src/pages/api/message.ts</code>에서 확인
        </span>
      </div>

      {last && (
        <div style={{ marginTop: 18, padding: 12, border: "1px solid #ddd", borderRadius: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>결과</div>
          <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{JSON.stringify(last, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
