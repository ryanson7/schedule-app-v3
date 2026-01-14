"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../utils/supabaseClient";

type AttendanceRow = {
  id: number;
  work_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  check_in_ip: string | null;
  check_out_ip: string | null;
  location_label: string | null;
  last_modified_by: number | null;
  last_modified_at: string | null;
  user?: { name: string | null } | null;
  modifier?: { name: string | null } | null;
};

function todayKST(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function toInputLocal(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

function fromInputLocal(v: string) {
  if (!v) return null;
  return new Date(v).toISOString();
}

function formatKSTShort(iso: string | null) {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function useIsMobile(breakpointPx = 860) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const calc = () => setIsMobile(window.innerWidth < breakpointPx);
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, [breakpointPx]);
  return isMobile;
}

export default function AdminAttendancePage() {
  const isMobile = useIsMobile(860);

  const [date, setDate] = useState<string>(todayKST());
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [editIn, setEditIn] = useState<Record<number, string>>({});
  const [editOut, setEditOut] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);

  const total = rows.length;
  const checkedInCount = useMemo(() => rows.filter((r) => !!r.check_in_time).length, [rows]);
  const checkedOutCount = useMemo(() => rows.filter((r) => !!r.check_out_time).length, [rows]);

  const fetchList = async () => {
    setError(null);
    setLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        setError("로그인이 필요합니다.");
        setRows([]);
        return;
      }

      const res = await fetch(`/api/admin/attendance/list?date=${encodeURIComponent(date)}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = (await res.json()) as { message?: string; rows?: AttendanceRow[] };
      if (!res.ok) {
        setError(json?.message ?? "조회 실패");
        setRows([]);
        return;
      }

      const nextRows = json.rows ?? [];
      setRows(nextRows);

      const nextIn: Record<number, string> = {};
      const nextOut: Record<number, string> = {};
      for (const r of nextRows) {
        nextIn[r.id] = toInputLocal(r.check_in_time);
        nextOut[r.id] = toInputLocal(r.check_out_time);
      }
      setEditIn(nextIn);
      setEditOut(nextOut);
    } catch (e: any) {
      setError(e?.message ?? "오류가 발생했습니다.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveRow = async (r: AttendanceRow) => {
    setError(null);
    setSavingId(r.id);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("로그인이 필요합니다.");

      const patch: any = {};
      const nextInIso = fromInputLocal(editIn[r.id] ?? "");
      const nextOutIso = fromInputLocal(editOut[r.id] ?? "");

      if ((nextInIso ?? null) !== (r.check_in_time ?? null)) patch.check_in_time = nextInIso;
      if ((nextOutIso ?? null) !== (r.check_out_time ?? null)) patch.check_out_time = nextOutIso;

      if (Object.keys(patch).length === 0) return;

      const res = await fetch("/api/admin/attendance/edit", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          attendance_id: r.id,
          patch,
          reason: null,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "저장 실패");

      await fetchList();
    } catch (e: any) {
      setError(e?.message ?? "오류가 발생했습니다.");
    } finally {
      setSavingId(null);
    }
  };

  const rowChanged = (r: AttendanceRow) =>
    fromInputLocal(editIn[r.id] ?? "") !== (r.check_in_time ?? null) ||
    fromInputLocal(editOut[r.id] ?? "") !== (r.check_out_time ?? null);

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 20 }}>
      <h1 style={{ fontSize: 20, fontWeight: 900, lineHeight: 1.2 }}>근태 관리 (조회/수정)</h1>

      {/* 상단 컨트롤 (모바일 대응) */}
      <div
        style={{
          marginTop: 10,
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <label style={{ fontSize: 12, opacity: 0.75 }}>조회 날짜</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              fontWeight: 700,
            }}
          />
        </div>

        <button
          onClick={fetchList}
          disabled={loading}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            background: "#111827",
            color: "white",
            fontWeight: 900,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          조회
        </button>

        <div
          style={{
            marginLeft: isMobile ? 0 : "auto",
            width: isMobile ? "100%" : "auto",
            display: "flex",
            gap: 10,
            fontSize: 12,
            opacity: 0.85,
            justifyContent: isMobile ? "space-between" : "flex-end",
          }}
        >
          <div>
            전체 <b>{total}</b>
          </div>
          <div>
            출근 <b>{checkedInCount}</b>
          </div>
          <div>
            퇴근 <b>{checkedOutCount}</b>
          </div>
        </div>
      </div>

      {error && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: "1px solid #fecaca",
            background: "#fff1f2",
            borderRadius: 12,
            color: "#991b1b",
            whiteSpace: "pre-wrap",
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      {/* 모바일: 카드 UI */}
      {isMobile ? (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          {loading ? (
            <div style={{ padding: 12, opacity: 0.7 }}>불러오는 중...</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 12, opacity: 0.7 }}>데이터가 없습니다.</div>
          ) : (
            rows.map((r) => {
              const changed = rowChanged(r);
              return (
                <div
                  key={r.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 14,
                    padding: 12,
                    background: "white",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontWeight: 900 }}>{r.user?.name ?? "-"}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{r.location_label ?? "-"}</div>
                  </div>

                  <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>출근</div>
                      <input
                        type="datetime-local"
                        value={editIn[r.id] ?? ""}
                        onChange={(e) => setEditIn((p) => ({ ...p, [r.id]: e.target.value }))}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: 12,
                          border: "1px solid #e5e7eb",
                          fontWeight: 700,
                        }}
                      />
                    </div>

                    <div>
                      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>퇴근</div>
                      <input
                        type="datetime-local"
                        value={editOut[r.id] ?? ""}
                        onChange={(e) => setEditOut((p) => ({ ...p, [r.id]: e.target.value }))}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: 12,
                          border: "1px solid #e5e7eb",
                          fontWeight: 700,
                        }}
                      />
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontSize: 12, opacity: 0.75 }}>
                        마지막 수정: <b>{r.modifier?.name ?? "-"}</b> {formatKSTShort(r.last_modified_at)}
                      </div>

                      <button
                        onClick={() => saveRow(r)}
                        disabled={!changed || savingId === r.id}
                        style={{
                          padding: "10px 14px",
                          borderRadius: 12,
                          border: "1px solid #e5e7eb",
                          background: changed ? "#111827" : "#f3f4f6",
                          color: changed ? "white" : "#6b7280",
                          fontWeight: 900,
                          cursor: !changed || savingId === r.id ? "not-allowed" : "pointer",
                          opacity: !changed || savingId === r.id ? 0.85 : 1,
                          minWidth: 84,
                        }}
                      >
                        수정
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* 데스크탑: 테이블 UI */
        <div style={{ marginTop: 14, border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 920, textAlign: "center" }}>
              <thead>
                <tr style={{ background: "#f9fafb", textAlign: "center" }}>
                  <th style={{ width: 160, padding: 12, borderBottom: "1px solid #e5e7eb" }}>이름</th>
                  <th style={{ width: 160, padding: 12, borderBottom: "1px solid #e5e7eb" }}>근무지</th>
                  <th style={{ width: 160, padding: 12, borderBottom: "1px solid #e5e7eb" }}>출근</th>
                  <th style={{ width: 160, padding: 12, borderBottom: "1px solid #e5e7eb" }}>퇴근</th>
                  <th style={{ width: 160, padding: 12, borderBottom: "1px solid #e5e7eb" }}>관리</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 14, opacity: 0.7 }}>
                      불러오는 중...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 14, opacity: 0.7 }}>
                      데이터가 없습니다.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const changed = rowChanged(r);
                    return (
                      <tr key={r.id}>
                        <td style={{ padding: 12, borderBottom: "1px solid #f3f4f6", fontWeight: 900 }}>
                          {r.user?.name ?? "-"}
                        </td>
                        <td style={{ padding: 12, borderBottom: "1px solid #f3f4f6" }}>{r.location_label ?? "-"}</td>

                        <td style={{ padding: 12, borderBottom: "1px solid #f3f4f6" }}>
                          <input
                            type="datetime-local"
                            value={editIn[r.id] ?? ""}
                            onChange={(e) => setEditIn((p) => ({ ...p, [r.id]: e.target.value }))}
                            style={{
                              padding: "8px 10px",
                              borderRadius: 10,
                              border: "1px solid #e5e7eb",
                              fontWeight: 700,
                              minWidth: 190,
                            }}
                          />
                        </td>

                        <td style={{ padding: 12, borderBottom: "1px solid #f3f4f6" }}>
                          <input
                            type="datetime-local"
                            value={editOut[r.id] ?? ""}
                            onChange={(e) => setEditOut((p) => ({ ...p, [r.id]: e.target.value }))}
                            style={{
                              padding: "8px 10px",
                              borderRadius: 10,
                              border: "1px solid #e5e7eb",
                              fontWeight: 700,
                              minWidth: 190,
                            }}
                          />
                        </td>

                        <td style={{ padding: 12, borderBottom: "1px solid #f3f4f6" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                            <button
                              onClick={() => saveRow(r)}
                              disabled={!changed || savingId === r.id}
                              style={{
                                padding: "8px 12px",
                                borderRadius: 10,
                                border: "1px solid #e5e7eb",
                                background: changed ? "#111827" : "#f3f4f6",
                                color: changed ? "white" : "#6b7280",
                                fontWeight: 900,
                                cursor: !changed || savingId === r.id ? "not-allowed" : "pointer",
                                opacity: !changed || savingId === r.id ? 0.85 : 1,
                                minWidth: 64,
                              }}
                            >
                              수정
                            </button>

                            <span style={{ fontSize: 12, opacity: 0.75 }}>
                              마지막 수정: <b>{r.modifier?.name ?? "-"}</b> {formatKSTShort(r.last_modified_at)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.65, lineHeight: 1.5 }}>
        • 모바일에서는 카드 형태로 표시됩니다.<br />
        • 출/퇴근 시간을 변경하면 “수정” 버튼이 활성화됩니다.
      </div>
    </div>
  );
}
