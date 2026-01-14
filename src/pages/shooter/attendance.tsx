"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../utils/supabaseClient";

type TodayResp = {
  work_date?: string;
  status?: "NOT_CHECKED_IN" | "CHECKED_IN" | "CHECKED_OUT";
  check_in_time?: string | null;
  check_out_time?: string | null;
  message?: string;
};

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function formatDate(v?: string) {
  if (!v) return "-";
  return v.replaceAll("-", ".");
}

function formatTime(v?: string | null) {
  if (!v) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(v));
}

function nowKST() {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
}

export default function ShooterAttendancePage() {
  const [today, setToday] = useState<TodayResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* 🔒 스크롤바 완전 고정 (핵심) */
  useEffect(() => {
    document.documentElement.style.overflowY = "scroll";
    document.body.style.overflowY = "scroll";
    return () => {
      document.documentElement.style.overflowY = "";
      document.body.style.overflowY = "";
    };
  }, []);

  /* 현재 시간 */
  const [now, setNow] = useState(nowKST());
  useEffect(() => {
    const id = setInterval(() => setNow(nowKST()), 1000);
    return () => clearInterval(id);
  }, []);

  const statusText = useMemo(() => {
    if (!today?.status) return "-";
    if (today.status === "NOT_CHECKED_IN") return "미출근";
    if (today.status === "CHECKED_IN") return "출근 완료";
    if (today.status === "CHECKED_OUT") return "퇴근 완료";
    return "-";
  }, [today?.status]);

  const canCheckIn = today?.status === "NOT_CHECKED_IN";
  const canCheckOut = today?.status === "CHECKED_IN";

  const fetchToday = async () => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("NO_TOKEN");

      const res = await fetch("/api/attendance/today", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message);

      setToday(json);
    } catch (e: any) {
      setError(e?.message ?? "오류");
      setToday(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchToday();
  }, []);

  const post = async (url: string) => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message);
      setInfo("처리 완료");
      fetchToday();
    } catch (e: any) {
      setError(e?.message);
    } finally {
      setLoading(false);
    }
  };

  /* 🧪 리셋 */
  const resetToday = () => {
    if (!confirm("오늘 근태를 초기화할까요? (테스트용)")) return;
    post("/api/attendance/reset-today");
  };

  /* ================== 스타일 (고정) ================== */

  const shell: React.CSSProperties = {
    width: 550,              // 🔥 완전 고정
    maxWidth: "100%",
    margin: "0 auto",
    padding: 18,
    boxSizing: "border-box",
  };

  const card: React.CSSProperties = {
    width: "100%",
    //minWidth: 500,           // 🔥 리셋 시 재계산 방지
    padding: 18,
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    background: "white",
    boxSizing: "border-box",
  };

  const btn = (active: boolean): React.CSSProperties => ({
    padding: 16,
    borderRadius: 16,
    border: "1px solid #e5e7eb",
    fontWeight: 900,
    fontSize: 16,
    background: active ? "#111827" : "#f3f4f6",
    color: active ? "white" : "#6b7280",
    cursor: active && !loading ? "pointer" : "not-allowed",
  });

  /* ================== 렌더 ================== */

  return (
    <div style={shell}>
      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>근태</h1>

        {/* 새로고침 → 리셋 */}
        <button
          onClick={resetToday}
          disabled={loading}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px dashed #fca5a5",
            background: "#fff1f2",
            color: "#991b1b",
            fontWeight: 900,
          }}
        >
          리셋
        </button>
      </div>

      {/* 카드 */}
      <div style={{ marginTop: 14, ...card }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>오늘</div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>
              {formatDate(today?.work_date)}
            </div>
            <div style={{ marginTop: 6, fontSize: 18, fontWeight: 900 }}>{now}</div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>상태</div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>{statusText}</div>
          </div>
        </div>

        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ padding: 16, border: "1px solid #f3f4f6", borderRadius: 16 }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>출근</div>
            <div style={{ fontSize: 30, fontWeight: 900 }}>
              {formatTime(today?.check_in_time)}
            </div>
          </div>

          <div style={{ padding: 16, border: "1px solid #f3f4f6", borderRadius: 16 }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>퇴근</div>
            <div style={{ fontSize: 30, fontWeight: 900 }}>
              {formatTime(today?.check_out_time)}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <button
            onClick={() => post("/api/attendance/check-in")}
            disabled={!canCheckIn || loading}
            style={btn(canCheckIn)}
          >
            출근
          </button>

          <button
            onClick={() => post("/api/attendance/check-out")}
            disabled={!canCheckOut || loading}
            style={btn(canCheckOut)}
          >
            퇴근
          </button>
        </div>
      </div>

      {info && <div style={{ marginTop: 12, color: "#065f46" }}>{info}</div>}
      {error && <div style={{ marginTop: 12, color: "#991b1b" }}>{error}</div>}
    </div>
  );
}
