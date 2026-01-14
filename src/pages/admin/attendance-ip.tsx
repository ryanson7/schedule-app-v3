"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../utils/supabaseClient";

type RuleRow = {
  id: number;
  rule_type: "ip" | "cidr" | "toggle";
  value: string;
  is_active: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
  updated_by: number | null;
};

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function useIsMobile(bp = 860) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const f = () => setM(window.innerWidth < bp);
    f();
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, [bp]);
  return m;
}

export default function AttendanceIpAdminPage() {
  const isMobile = useIsMobile(860);

  const [rows, setRows] = useState<RuleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [newType, setNewType] = useState<"ip" | "cidr">("ip");
  const [newValue, setNewValue] = useState("");
  const [newNote, setNewNote] = useState("");

  const allowAll = useMemo(() => {
    const t = rows.find((r) => r.rule_type === "toggle" && r.value === "allow_all");
    return !!t?.is_active;
  }, [rows]);

  const ipRules = useMemo(() => rows.filter((r) => r.rule_type === "ip"), [rows]);
  const cidrRules = useMemo(() => rows.filter((r) => r.rule_type === "cidr"), [rows]);

  const fetchList = async () => {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("로그인이 필요합니다.");

      const res = await fetch("/api/admin/attendance-ip/list", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "조회 실패");

      setRows(json.rows ?? []);
    } catch (e: any) {
      setError(e?.message ?? "오류가 발생했습니다.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const toggleAllowAll = async (next: boolean) => {
    setError(null);
    setInfo(null);
    setBusyId(-1);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("로그인이 필요합니다.");

      const res = await fetch("/api/admin/attendance-ip/toggle-allow-all", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ allow_all: next }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "토글 실패");

      setInfo(next ? "✅ 테스트 모드: 전체 IP 허용" : "✅ 운영 모드: Allowlist만 허용");
      await fetchList();
    } catch (e: any) {
      setError(e?.message ?? "오류가 발생했습니다.");
    } finally {
      setBusyId(null);
    }
  };

  const createRule = async () => {
    setError(null);
    setInfo(null);
    setBusyId(-2);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("로그인이 필요합니다.");

      const res = await fetch("/api/admin/attendance-ip/create", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          rule_type: newType,
          value: newValue.trim(),
          note: newNote.trim() || null,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "추가 실패");

      setNewValue("");
      setNewNote("");
      setInfo("✅ 규칙이 추가되었습니다.");
      await fetchList();
    } catch (e: any) {
      setError(e?.message ?? "오류가 발생했습니다.");
    } finally {
      setBusyId(null);
    }
  };

  const setActive = async (id: number, is_active: boolean) => {
    setError(null);
    setInfo(null);
    setBusyId(id);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("로그인이 필요합니다.");

      const res = await fetch("/api/admin/attendance-ip/set-active", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ id, is_active }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "변경 실패");

      await fetchList();
    } catch (e: any) {
      setError(e?.message ?? "오류가 발생했습니다.");
    } finally {
      setBusyId(null);
    }
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, background: "white", overflow: "hidden" }}>
      <div style={{ padding: 12, borderBottom: "1px solid #f3f4f6", fontWeight: 900 }}>{title}</div>
      <div style={{ padding: 12 }}>{children}</div>
    </div>
  );

  const RuleList = ({ data }: { data: RuleRow[] }) => {
    if (data.length === 0) return <div style={{ fontSize: 12, opacity: 0.7 }}>등록된 규칙이 없습니다.</div>;

    if (isMobile) {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {data.map((r) => (
            <div key={r.id} style={{ border: "1px solid #f3f4f6", borderRadius: 12, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontWeight: 900 }}>{r.value}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>{r.is_active ? "활성" : "비활성"}</div>
              </div>
              {r.note && <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>{r.note}</div>}
              <div style={{ marginTop: 10, display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  onClick={() => setActive(r.id, !r.is_active)}
                  disabled={busyId === r.id}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                    background: "white",
                    fontWeight: 900,
                    cursor: busyId === r.id ? "not-allowed" : "pointer",
                  }}
                >
                  {r.is_active ? "비활성" : "활성"}
                </button>
              </div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f9fafb", textAlign: "left" }}>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>값</th>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>메모</th>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>상태</th>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.id}>
                <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6", fontWeight: 900 }}>{r.value}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>{r.note ?? "-"}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>{r.is_active ? "활성" : "비활성"}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>
                  <button
                    onClick={() => setActive(r.id, !r.is_active)}
                    disabled={busyId === r.id}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid #e5e7eb",
                      background: "white",
                      fontWeight: 900,
                      cursor: busyId === r.id ? "not-allowed" : "pointer",
                    }}
                  >
                    {r.is_active ? "비활성" : "활성"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>근태</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 950, letterSpacing: -0.3 }}>IP 허용 관리</h1>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>
            • 테스트 기간엔 <b>전체 허용</b>을 켜두고, 운영 전환 시 끄면 Allowlist만 허용됩니다.
          </div>
        </div>

        <button
          onClick={fetchList}
          disabled={loading}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            background: "white",
            fontWeight: 900,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          새로고침
        </button>
      </div>

      {info && (
        <div style={{ marginTop: 12, padding: 12, border: "1px solid #d1fae5", background: "#ecfdf5", borderRadius: 14, fontSize: 12, color: "#065f46" }}>
          {info}
        </div>
      )}
      {error && (
        <div style={{ marginTop: 12, padding: 12, border: "1px solid #fecaca", background: "#fff1f2", borderRadius: 14, fontSize: 12, color: "#991b1b" }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
        <Section title="모드">
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontSize: 13, opacity: 0.8 }}>
              현재: <b>{allowAll ? "테스트(전체 허용)" : "운영(Allowlist만)"}</b>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
              <button
                onClick={() => toggleAllowAll(true)}
                disabled={busyId === -1}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  background: allowAll ? "#111827" : "white",
                  color: allowAll ? "white" : "#111827",
                  fontWeight: 950,
                  cursor: busyId === -1 ? "not-allowed" : "pointer",
                }}
              >
                전체 허용 ON
              </button>
              <button
                onClick={() => toggleAllowAll(false)}
                disabled={busyId === -1}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  background: !allowAll ? "#111827" : "white",
                  color: !allowAll ? "white" : "#111827",
                  fontWeight: 950,
                  cursor: busyId === -1 ? "not-allowed" : "pointer",
                }}
              >
                전체 허용 OFF
              </button>
            </div>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7, lineHeight: 1.5 }}>
            • <b>ON</b>: 모든 IP에서 출근/퇴근 가능<br />
            • <b>OFF</b>: 아래 등록된 IP/CIDR만 가능
          </div>
        </Section>

        <Section title="규칙 추가">
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as any)}
                style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb", fontWeight: 900 }}
              >
                <option value="ip">IP</option>
                <option value="cidr">CIDR</option>
              </select>

              <input
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder={newType === "ip" ? "예) 192.168.0.10" : "예) 192.168.0.0/24"}
                style={{ flex: 1, minWidth: 220, padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb", fontWeight: 800 }}
              />

              <button
                onClick={createRule}
                disabled={busyId === -2 || !newValue.trim()}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  background: "#111827",
                  color: "white",
                  fontWeight: 950,
                  cursor: busyId === -2 || !newValue.trim() ? "not-allowed" : "pointer",
                }}
              >
                추가
              </button>
            </div>

            <input
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="메모(선택) 예) 스튜디오PC, 회의실, 운영팀"
              style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb", fontWeight: 700 }}
            />

            <div style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.5 }}>
              • CIDR은 대역 허용(예: 192.168.0.0/24)입니다.<br />
              • 운영 전환 시 전체 허용 OFF로 바꾸고 필요한 규칙만 활성화하세요.
            </div>
          </div>
        </Section>

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}>
          <Section title={`IP 규칙 (${ipRules.length})`}>
            <RuleList data={ipRules} />
          </Section>

          <Section title={`CIDR 규칙 (${cidrRules.length})`}>
            <RuleList data={cidrRules} />
          </Section>
        </div>
      </div>
    </div>
  );
}
