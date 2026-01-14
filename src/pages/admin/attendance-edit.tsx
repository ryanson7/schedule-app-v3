//src/pages/admin/attendance-edit.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../utils/supabaseClient";

type UserMini = {
  id: number;
  name?: string | null;
  full_name?: string | null;
  display_name?: string | null;
  username?: string | null;
  email?: string | null;
};

type AttendanceRow = {
  id: number;
  user_id: number;
  work_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  check_in_ip: string | null;
  check_out_ip: string | null;
  location_label: string | null;
  created_at: string;
  updated_at: string;
  users?: UserMini | null;
};

function userLabelFromRow(row: AttendanceRow) {
  const u = row.users;
  return u?.display_name || u?.name || u?.full_name || u?.username || u?.email || `#${row.user_id}`;
}

type HistoryRow = {
  id: number;
  attendance_id: number;
  change_type: string;
  old_value: any;
  new_value: any;
  reason: string | null;
  changed_by: number | null;
  changed_at: string;
};

function parseQueryAttendanceId(): number | null {
  if (typeof window === "undefined") return null;
  const p = new URLSearchParams(window.location.search);
  const id = p.get("attendance_id");
  if (!id) return null;
  const n = Number(id);
  return Number.isNaN(n) ? null : n;
}

function toInputLocal(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  // input[type=datetime-local]은 로컬 타임 기준 string 필요
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function fromInputLocal(v: string) {
  if (!v) return null;
  // 로컬 입력값을 ISO로 변환
  const d = new Date(v);
  return d.toISOString();
}

function formatKSTFull(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export default function AdminAttendanceEditPage() {
  const [attendanceId, setAttendanceId] = useState<number | null>(null);
  const [row, setRow] = useState<AttendanceRow | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState<string>("");

  // 편집 값
  const [workDate, setWorkDate] = useState<string>("");
  const [checkInLocal, setCheckInLocal] = useState<string>("");
  const [checkOutLocal, setCheckOutLocal] = useState<string>("");
  const [locationLabel, setLocationLabel] = useState<string>("");

  const changed = useMemo(() => {
    if (!row) return false;
    const nextWorkDate = workDate || row.work_date;
    const nextCheckIn = checkInLocal ? fromInputLocal(checkInLocal) : null;
    const nextCheckOut = checkOutLocal ? fromInputLocal(checkOutLocal) : null;

    return (
      nextWorkDate !== row.work_date ||
      (nextCheckIn ?? null) !== (row.check_in_time ?? null) ||
      (nextCheckOut ?? null) !== (row.check_out_time ?? null) ||
      (locationLabel || "") !== (row.location_label || "")
    );
  }, [row, workDate, checkInLocal, checkOutLocal, locationLabel]);

  const load = async (id: number) => {
    setError(null);
    setLoading(true);

    try {
      const token = await getAccessToken();
      if (!token) {
        setError("로그인이 필요합니다.");
        setLoading(false);
        return;
      }

      // (1) 단건은 list API 재사용 없이 직접 가져오자: 안전/단순
      const listRes = await fetch(`/api/admin/attendance/list?date=${encodeURIComponent(new Date().toISOString().slice(0,10))}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      // 위는 오늘 리스트 API라 단건을 찾지 못할 수 있음. 그래서 단건 API를 하나 더 만드는 게 정석인데,
      // 여기서는 바로 단건 조회 API를 추가하는 걸로 아래에서 해결한다(다음 블록 참고).
      // => 지금은 단건 API를 호출하도록 변경함.
    } catch (e: any) {
      setError(e?.message ?? "오류가 발생했습니다.");
      setLoading(false);
    }
  };

  const fetchOne = async (id: number) => {
    const token = await getAccessToken();
    if (!token) throw new Error("로그인이 필요합니다.");

    const res = await fetch(`/api/admin/attendance/one?attendance_id=${id}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.message ?? "단건 조회 실패");
    return json.attendance as AttendanceRow;
  };

  const fetchHistory = async (id: number) => {
    const token = await getAccessToken();
    if (!token) throw new Error("로그인이 필요합니다.");

    const res = await fetch(`/api/admin/attendance/history?attendance_id=${id}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.message ?? "히스토리 조회 실패");
    return (json.rows ?? []) as HistoryRow[];
  };

  const refreshAll = async (id: number) => {
    setError(null);
    setLoading(true);
    try {
      const a = await fetchOne(id);
      const h = await fetchHistory(id);

      setRow(a);
      setHistory(h);

      // 폼 초기화
      setWorkDate(a.work_date);
      setCheckInLocal(toInputLocal(a.check_in_time));
      setCheckOutLocal(toInputLocal(a.check_out_time));
      setLocationLabel(a.location_label ?? "");
    } catch (e: any) {
      setError(e?.message ?? "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!attendanceId || !row) return;

    setSaving(true);
    setError(null);

    try {
      const token = await getAccessToken();
      if (!token) throw new Error("로그인이 필요합니다.");

      const patch: any = {};

      if (workDate && workDate !== row.work_date) patch.work_date = workDate;

      const nextIn = checkInLocal ? fromInputLocal(checkInLocal) : null;
      const nextOut = checkOutLocal ? fromInputLocal(checkOutLocal) : null;

      if ((nextIn ?? null) !== (row.check_in_time ?? null)) patch.check_in_time = nextIn;
      if ((nextOut ?? null) !== (row.check_out_time ?? null)) patch.check_out_time = nextOut;

      const nextLoc = (locationLabel || "").trim();
      if (nextLoc !== (row.location_label || "")) patch.location_label = nextLoc || null;

      if (Object.keys(patch).length === 0) {
        setError("변경된 내용이 없습니다.");
        setSaving(false);
        return;
      }

      const res = await fetch("/api/admin/attendance/edit", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          attendance_id: attendanceId,
          patch,
          reason: reason.trim() || null,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "저장 실패");

      setReason("");
      await refreshAll(attendanceId);
    } catch (e: any) {
      setError(e?.message ?? "오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const id = parseQueryAttendanceId();
    setAttendanceId(id);
    if (!id) {
      setLoading(false);
      setError("attendance_id가 필요합니다.");
      return;
    }
    refreshAll(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>근태 수정</h1>
        <div style={{ opacity: 0.7, fontSize: 13 }}>attendance_id: {attendanceId ?? "-"}</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            onClick={() => (window.location.href = "/admin/attendance")}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              background: "white",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            목록
          </button>
          <button
            onClick={() => attendanceId && refreshAll(attendanceId)}
            disabled={loading}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              background: "white",
              fontWeight: 800,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            새로고침
          </button>
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
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
        {/* 편집 폼 */}
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>수정</h2>

          {loading ? (
            <div style={{ marginTop: 10, opacity: 0.7 }}>불러오는 중...</div>
          ) : !row ? (
            <div style={{ marginTop: 10, opacity: 0.7 }}>데이터 없음</div>
          ) : (
            <>
              <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "140px 1fr", rowGap: 10 }}>
                <div style={{ opacity: 0.7 }}>user_id</div>
                <div style={{ fontWeight: 900 }}>
                    {userLabelFromRow(row)} <span style={{ fontSize: 12, opacity: 0.7 }}>(id: {row.user_id})</span>
                    </div>


                <div style={{ opacity: 0.7 }}>work_date</div>
                <input
                  type="date"
                  value={workDate}
                  onChange={(e) => setWorkDate(e.target.value)}
                  style={{ padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 10, fontWeight: 700 }}
                />

                <div style={{ opacity: 0.7 }}>출근 시간</div>
                <input
                  type="datetime-local"
                  value={checkInLocal}
                  onChange={(e) => setCheckInLocal(e.target.value)}
                  style={{ padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 10, fontWeight: 700 }}
                />

                <div style={{ opacity: 0.7 }}>퇴근 시간</div>
                <input
                  type="datetime-local"
                  value={checkOutLocal}
                  onChange={(e) => setCheckOutLocal(e.target.value)}
                  style={{ padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 10, fontWeight: 700 }}
                />

                <div style={{ opacity: 0.7 }}>근무지</div>
                <input
                  value={locationLabel}
                  onChange={(e) => setLocationLabel(e.target.value)}
                  placeholder="예: 스튜디오A"
                  style={{ padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 10, fontWeight: 700 }}
                />

                <div style={{ opacity: 0.7 }}>사유(선택)</div>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="정정 사유(선택)"
                  style={{ padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 10, fontWeight: 700 }}
                />
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
                <button
                  onClick={save}
                  disabled={saving || !changed}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: "1px solid #e5e7eb",
                    background: changed ? "#111827" : "#f3f4f6",
                    color: changed ? "white" : "#6b7280",
                    fontWeight: 900,
                    cursor: saving || !changed ? "not-allowed" : "pointer",
                  }}
                >
                  저장
                </button>

                <button
                  onClick={() => row && (setWorkDate(row.work_date), setCheckInLocal(toInputLocal(row.check_in_time)), setCheckOutLocal(toInputLocal(row.check_out_time)), setLocationLabel(row.location_label ?? ""), setReason(""))}
                  disabled={saving || !row}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: "1px solid #e5e7eb",
                    background: "white",
                    fontWeight: 900,
                    cursor: saving ? "not-allowed" : "pointer",
                  }}
                >
                  되돌리기
                </button>
              </div>

              <div style={{ marginTop: 12, fontSize: 12, opacity: 0.65, lineHeight: 1.5 }}>
                • 저장 시 <b>attendance_history</b>에 변경 전/후 + 수정자(changed_by)가 기록됩니다.<br />
                • 출근/퇴근 IP는 수정 폼에서 바꾸지 않도록 막았습니다(안전).
              </div>
            </>
          )}
        </div>

        {/* 히스토리 */}
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>변경 이력</h2>

          {loading ? (
            <div style={{ marginTop: 10, opacity: 0.7 }}>불러오는 중...</div>
          ) : history.length === 0 ? (
            <div style={{ marginTop: 10, opacity: 0.7 }}>이력이 없습니다.</div>
          ) : (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
              {history.map((h) => (
                <div
                  key={h.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: 12,
                    background: "#fafafa",
                  }}
                >
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ fontWeight: 900 }}>{h.change_type}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>
                      {formatKSTFull(h.changed_at)}
                    </div>
                    <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.7 }}>
                      changed_by: {h.changed_by ?? "-"}
                    </div>
                  </div>
                  {h.reason && (
                    <div style={{ marginTop: 6, fontSize: 12 }}>
                      사유: <b>{h.reason}</b>
                    </div>
                  )}
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ cursor: "pointer", fontSize: 12, opacity: 0.85 }}>전/후 값 보기</summary>
                    <pre style={{ marginTop: 8, fontSize: 12, whiteSpace: "pre-wrap" }}>
old: {JSON.stringify(h.old_value, null, 2)}
{"\n"}
new: {JSON.stringify(h.new_value, null, 2)}
                    </pre>
                  </details>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
