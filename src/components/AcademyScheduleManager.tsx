// src/pages/AcademyScheduleManager.tsx
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import { supabase } from "../utils/supabaseClient";
import { logScheduleHistory, buildSnapshotFromSchedule } from "../utils/scheduleHistory";
import BaseScheduleGrid from "./core/BaseScheduleGrid";
import AcademyScheduleModal from "./modals/AcademyScheduleModal";
import { useWeek } from "../contexts/WeekContext";
import { UnifiedScheduleCard } from "./cards/UnifiedScheduleCard";
import { ScheduleCardErrorBoundary } from "./ErrorBoundary";

/** ✅ 네이버웍스 알림 텍스트(최소 핵심) */
const buildWorksMessage = (action: string, s: any) => {
  const titleMap: Record<string, string> = {
    request: "승인요청",
    request_withdraw: "승인요청 철회",
    approve: "승인완료",

    modify_request: "수정요청",
    approve_modification: "수정승인",
    modify_approve: "수정반영",

    cancel_request: "취소요청",
    cancel_approve: "취소승인",
    cancel: "관리자 취소",

    delete_request: "삭제요청",
    delete_approve: "삭제승인",
    delete: "삭제",

    crosscheck_req: "크로스체크 요청",
    crosscheck_ok: "크로스체크 완료",
  };

  const title = titleMap[action] || action;
  const date = s?.shoot_date || "-";
  const st = s?.start_time || "-";
  const et = s?.end_time || "-";
  const prof = s?.professor_name || "-";
  const course = s?.course_name || "-";
  const type = s?.shooting_type || "-";

  const lines: string[] = [
    `[학원 스케줄] ${title}`,
    `- 날짜: ${date}`,
    `- 시간: ${st}~${et}`,
    `- 교수: ${prof}`,
    `- 과정: ${course}`,
    `- 유형: ${type}`,
  ];
  if (s?.notes) lines.push(`- 메모: ${s.notes}`);

  return lines.join("\n");
};

/** 🔥 학원별 색상 */
const academyColors: Record<number, { bg: string; border: string; text: string }> = {
  1: { bg: "#fef3c7", border: "#f59e0b", text: "#92400e" },
  2: { bg: "#dbeafe", border: "#3b82f6", text: "#1e40af" },
  3: { bg: "#dcfce7", border: "#22c55e", text: "#166534" },
  4: { bg: "#fce7f3", border: "#ec4899", text: "#be185d" },
  5: { bg: "#f3e8ff", border: "#8b5cf6", text: "#6b21a8" },
  6: { bg: "#fed7d7", border: "#ef4444", text: "#b91c1c" },
  7: { bg: "#e0f2fe", border: "#06b6d4", text: "#0e7490" },
  9: { bg: "#ccfbf1", border: "#14b8a6", text: "#115e59" },
};

type AcademyScheduleManagerProps = {
  currentUserRole?: string;
  currentUserId?: number | null; // managers.user_id 와 매칭되는 값
};

/** =========================
 * ✅ 날짜 유틸 (Date|string 모두 안전 처리)
 * ========================= */
const fmtYMD = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const toDateSafe = (value: any): Date => {
  if (value instanceof Date) return new Date(value);
  if (typeof value === "string") {
    const dt = new Date(value);
    return isNaN(dt.getTime()) ? new Date() : dt;
  }
  const dt = new Date(value);
  return isNaN(dt.getTime()) ? new Date() : dt;
};

const getMonday = (d: Date) => {
  const base = new Date(d);
  const day = base.getDay();
  const diff = base.getDate() - day + (day === 0 ? -6 : 1);
  base.setDate(diff);
  base.setHours(0, 0, 0, 0);
  return base;
};

/** ✅ 주차 차이 계산(월요일 기준) */
const weekDiffByMonday = (fromWeek: Date, toWeek: Date) => {
  const a = getMonday(fromWeek).getTime();
  const b = getMonday(toWeek).getTime();
  return Math.round((b - a) / (7 * 24 * 60 * 60 * 1000));
};

/**
 * ✅ “승인요청(및 각종 요청)”만 락
 * - 대상 주의 월요일 기준
 * - 마감: (월요일 - 6일 = 전주 화요일) 17:00
 * - 예) 12/8(월) 주의 마감은 12/2(화) 17:00
 */
const isAcademyApprovalLocked = (weekDate: Date) => {
  const targetMonday = getMonday(weekDate);
  const deadline = new Date(targetMonday);
  deadline.setDate(deadline.getDate() - 6);
  deadline.setHours(17, 0, 0, 0);
  const now = new Date();
  return now > deadline;
};

/* =========================
   ✅ 지난주 선택복사 모달 (복사는 항상 허용)
   ========================= */
function CopyPreviousWeekModal({
  open,
  onClose,
  currentWeek,
  academyLocations,
  onCopied,
}: {
  open: boolean;
  onClose: () => void;
  currentWeek: Date | string;
  academyLocations: any[];
  onCopied: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [prevSchedules, setPrevSchedules] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectAll, setSelectAll] = useState(false);

  const getWeekMondays = useCallback(() => {
    const base = getMonday(toDateSafe(currentWeek));
    const thisMonday = new Date(base);
    const prevMonday = new Date(thisMonday);
    prevMonday.setDate(prevMonday.getDate() - 7);
    return { thisMonday, prevMonday };
  }, [currentWeek]);

  const getLocationLabelById = useCallback(
    (id: any) => {
      const idStr = String(id ?? "").trim();
      if (!idStr) return "-";
      const found =
        (academyLocations || []).find((l: any) => String(l.id) === idStr) ||
        (academyLocations || []).find((l: any) => Number(l.id) === Number(idStr));
      return found?.displayName || found?.name || found?.fullName || `강의실(${idStr})`;
    },
    [academyLocations]
  );

  const statusKo = (s: any) => {
    const ap = s?.approval_status;
    const active = s?.is_active !== false;
    if (!active) {
      if (ap === "cancelled") return "취소완료";
      if (ap === "deleted") return "삭제완료";
    }
    switch (ap) {
      case "pending":
        return "임시저장";
      case "approval_requested":
        return "승인요청";
      case "approved":
        return "승인완료";
      case "confirmed":
        return "확정완료";
      case "modification_requested":
        return "수정요청";
      case "modification_approved":
        return "수정중";
      case "cancellation_requested":
        return "취소요청";
      case "deletion_requested":
        return "삭제요청";
      case "cancelled":
        return "취소완료";
      default:
        return "상태 미정";
    }
  };

  const loadPrevWeek = useCallback(async () => {
    if (!open) return;

    setLoading(true);
    setPrevSchedules([]);
    setSelectedIds([]);
    setSelectAll(false);

    try {
      const { prevMonday } = getWeekMondays();
      const prevWeekDates: string[] = [];
      for (let i = 0; i < 7; i++) {
        const dPrev = new Date(prevMonday);
        dPrev.setDate(prevMonday.getDate() + i);
        prevWeekDates.push(fmtYMD(dPrev));
      }

      const locationIds = (academyLocations || []).map((l: any) => l.id);
      if (locationIds.length === 0) {
        setPrevSchedules([]);
        return;
      }

      const { data, error } = await supabase
        .from("schedules")
        .select("*")
        .eq("schedule_type", "academy")
        .in("sub_location_id", locationIds)
        .in("shoot_date", prevWeekDates)
        .in("approval_status", [
          "pending",
          "approval_requested",
          "approved",
          "confirmed",
          "modification_requested",
          "modification_approved",
          "cancellation_requested",
          "deletion_requested",
          "cancelled",
        ])
        .order("shoot_date")
        .order("start_time");

      if (error) throw error;

      const valid = (data || []).filter(
        (s: any) => s?.shoot_date && s?.start_time && s?.end_time && s?.sub_location_id
      );
      setPrevSchedules(valid);

      // 기본: 전부 선택
      const ids = valid.map((s: any) => s.id);
      setSelectedIds(ids);
      setSelectAll(ids.length > 0);
    } catch (e) {
      console.error("❌ 지난주 스케줄 로딩 오류:", e);
      setPrevSchedules([]);
      setSelectedIds([]);
      setSelectAll(false);
    } finally {
      setLoading(false);
    }
  }, [open, academyLocations, getWeekMondays]);

  useEffect(() => {
    loadPrevWeek();
  }, [loadPrevWeek]);

  useEffect(() => {
    if (!open) return;
    const all = prevSchedules.length > 0 && selectedIds.length === prevSchedules.length;
    setSelectAll(all);
  }, [open, prevSchedules, selectedIds]);

  const toggleOne = (id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  };

  const toggleAll = (checked: boolean) => {
    setSelectAll(checked);
    setSelectedIds(checked ? prevSchedules.map((s: any) => s.id) : []);
  };

  const handleCopySelected = async () => {
    if (loading) return;

    if (!selectedIds.length) {
      alert("복사할 스케줄을 선택해주세요.");
      return;
    }

    try {
      setLoading(true);

      const { thisMonday, prevMonday } = getWeekMondays();
      const selected = prevSchedules.filter((s: any) => selectedIds.includes(s.id));
      if (selected.length === 0) {
        alert("선택된 스케줄이 없습니다.");
        return;
      }

      // 현재 주 날짜들
      const thisWeekDates: string[] = [];
      for (let i = 0; i < 7; i++) {
        const dThis = new Date(thisMonday);
        dThis.setDate(thisMonday.getDate() + i);
        thisWeekDates.push(fmtYMD(dThis));
      }

      // 현재 주에 이미 스케줄이 있으면 안내
      const { data: existingThisWeek, error: existErr } = await supabase
        .from("schedules")
        .select("id")
        .eq("schedule_type", "academy")
        .in("shoot_date", thisWeekDates);

      if (existErr) throw existErr;

      if ((existingThisWeek || []).length > 0) {
        const proceed = confirm(
          "현재 주에 이미 스케줄이 있습니다.\n선택한 지난주 스케줄을 추가로 복사하시겠습니까?"
        );
        if (!proceed) return;
      }

      const newRecords: any[] = [];

      for (const s of selected) {
        const src = new Date(s.shoot_date);
        if (isNaN(src.getTime())) continue;

        const offset = Math.round((src.getTime() - prevMonday.getTime()) / (1000 * 60 * 60 * 24));
        const target = new Date(thisMonday);
        target.setDate(thisMonday.getDate() + offset);
        const targetStr = fmtYMD(target);

        newRecords.push({
          schedule_type: "academy",
          shoot_date: targetStr,
          start_time: s.start_time,
          end_time: s.end_time,
          professor_name: s.professor_name || "",
          course_name: s.course_name || "",
          course_code: s.course_code || "",
          shooting_type: s.shooting_type || "촬영",
          sub_location_id: s.sub_location_id,
          notes: s.notes || "",
          approval_status: "pending",
          is_active: true,

          // 선택복사 신규
          tracking_status: null,

          // ✅ “처리자 없음” 방지: 생성자(요청자 아님)로라도 기록(관리자/매니저 모두)
          requested_by: Number(localStorage.getItem("userId") || 0) || null,
        });
      }

      if (!newRecords.length) {
        alert("복사할 유효한 스케줄이 없습니다.");
        return;
      }

      const { data: inserted, error: insertErr } = await supabase.from("schedules").insert(newRecords).select();
      if (insertErr) throw insertErr;

      // ✅ 히스토리: created 기록(선택)
      for (const row of inserted || []) {
        const snap = buildSnapshotFromSchedule(row);
        await logScheduleHistory({
          scheduleId: row.id,
          changeType: "created",
          description: "지난주 복사로 생성",
          changedBy: Number(localStorage.getItem("userId") || 0) || null,
          oldValue: null,
          newValue: snap,
        });
      }

      alert(`선택한 ${newRecords.length}건을 현재 주로 복사했습니다.\n(승인요청은 별도로 진행해주세요)`);
      await onCopied();
      onClose();
    } catch (e) {
      console.error("❌ 선택복사 오류:", e);
      alert("선택복사 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 3000,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 980,
          maxWidth: "96vw",
          height: 760,
          maxHeight: "90vh",
          background: "white",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "18px 20px",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#111827" }}>지난주 스케줄 선택 복사</div>
            <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280", fontWeight: 700 }}>
              지난주 스케줄 목록에서 복사할 항목을 선택하세요. (복사 후 승인요청은 별도)
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 24,
              cursor: "pointer",
              padding: 0,
              color: "#6b7280",
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: 14, borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 900, color: "#374151" }}>
            <input
              type="checkbox"
              checked={selectAll}
              onChange={(e) => toggleAll(e.target.checked)}
              disabled={loading || prevSchedules.length === 0}
            />
            전체 선택
          </label>

          <div style={{ marginLeft: "auto", fontSize: 12, color: "#6b7280", fontWeight: 800 }}>
            선택: {selectedIds.length} / {prevSchedules.length}
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto", background: "#f8fafc" }}>
          {loading ? (
            <div style={{ padding: 24, textAlign: "center", color: "#6b7280", fontWeight: 800 }}>불러오는 중...</div>
          ) : prevSchedules.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "#9ca3af", fontWeight: 800 }}>
              지난주에 복사할 스케줄이 없습니다.
            </div>
          ) : (
            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              {prevSchedules.map((s: any) => (
                <div
                  key={s.id}
                  style={{
                    background: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    padding: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <input type="checkbox" checked={selectedIds.includes(s.id)} onChange={(e) => toggleOne(s.id, e.target.checked)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 900, color: "#111827" }}>
                        {s.shoot_date} · {s.start_time}~{s.end_time}
                      </span>
                      <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 800 }}>
                        {getLocationLabelById(s.sub_location_id)}
                      </span>
                    </div>

                    <div
                      style={{
                        marginTop: 4,
                        display: "flex",
                        gap: 10,
                        flexWrap: "wrap",
                        fontSize: 12,
                        color: "#374151",
                        fontWeight: 800,
                      }}
                    >
                      <span>교수: {s.professor_name || "-"}</span>
                      <span>유형: {s.shooting_type || "-"}</span>
                      <span>강의: {s.course_name || "-"}</span>
                      {s.course_code ? <span>코드: {s.course_code}</span> : null}
                    </div>

                    {s.notes ? (
                      <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280", fontWeight: 800, whiteSpace: "pre-line" }}>
                        메모: {s.notes}
                      </div>
                    ) : null}
                  </div>

                  <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 900, whiteSpace: "nowrap" }}>
                    상태: {statusKo(s)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            padding: 14,
            borderTop: "1px solid #e5e7eb",
            display: "flex",
            alignItems: "center",
            gap: 10,
            justifyContent: "flex-end",
            background: "white",
          }}
        >
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              background: "white",
              cursor: "pointer",
              fontWeight: 900,
              fontSize: 13,
            }}
          >
            닫기
          </button>

          <button
            onClick={handleCopySelected}
            disabled={loading || selectedIds.length === 0}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "none",
              background: "#2563eb",
              color: "white",
              cursor: "pointer",
              fontWeight: 900,
              fontSize: 13,
              opacity: loading || selectedIds.length === 0 ? 0.6 : 1,
            }}
          >
            선택 복사 실행
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AcademyScheduleManager({ currentUserId }: AcademyScheduleManagerProps) {
  const router = useRouter();
  const { currentWeek, navigateWeek } = useWeek();

  const [schedules, setSchedules] = useState<any[]>([]);
  const [academyLocations, setAcademyLocations] = useState<any[]>([]);
  const [mainLocations, setMainLocations] = useState<any[]>([]);
  const [shooters, setShooters] = useState<any[]>([]);

  /** ✅ 관리자 선택승인용 체크 */
  const [selectedSchedules, setSelectedSchedules] = useState<number[]>([]);

  /** ✅ 관리자 전용: 임시저장(pending) 전체 표시 ON/OFF */
  const [showTempSchedules, setShowTempSchedules] = useState(true);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<any>(null);

  const [filters, setFilters] = useState({
    mainLocationId: "all",
    shootingType: "all",
    status: "all",
  });

  const isProcessingRef = useRef(false);

  /** ✅ 화면 표기 role */
  const [userRole, setUserRole] = useState<"admin" | "manager" | "user">("user");

  /** ✅ 지난주 선택복사 모달 */
  const [copyModalOpen, setCopyModalOpen] = useState(false);

  /** ✅ 딥링크(=index 승인대기 클릭) 처리용 */
  const deepLinkHandledRef = useRef(false);
  const pendingOpenScheduleIdRef = useRef<number | null>(null);

  /** ✅ 주 변경 시 선택승인 체크 초기화 */
  useEffect(() => {
    setSelectedSchedules([]);
  }, [currentWeek]);

  /** 🔥 역할 초기화 (localStorage → 내부 표시용만 사용) */
  useEffect(() => {
    if (typeof window === "undefined") return;

    const role = localStorage.getItem("userRole") || "";
    const name = localStorage.getItem("userName") || "";
    let normalizedRole: "admin" | "manager" | "user" = "user";

    if (name === "manager1" || role === "system_admin" || role === "schedule_admin" || role === "shooting_manager") {
      normalizedRole = "admin";
    } else if (role === "academy_manager" || role === "manager" || role === "studio_manager") {
      normalizedRole = "manager";
    }

    setUserRole(normalizedRole);
  }, []);

  /** 🔥 날짜 생성 */
  const generateWeekDates = useCallback(() => {
    try {
      const startOfWeek = getMonday(toDateSafe(currentWeek));
      return Array.from({ length: 7 }, (_, i) => {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        const dateStr = fmtYMD(date);
        return { id: dateStr, date: dateStr, day: date.getDate() };
      });
    } catch {
      return [];
    }
  }, [currentWeek]);

  /** 🔥 매니저 모드 여부 (필터 숨김) */
  const isManagerMode = () => (localStorage.getItem("userRole") || "") === "academy_manager";

  /** ✅ 학원 스케줄 조회 */
  const fetchSchedules = useCallback(
    async (locationsOverride?: any[], mainLocationsOverride?: any[]) => {
      let weekDates = generateWeekDates();
      if (!Array.isArray(weekDates) || weekDates.length < 7) {
        setSchedules([]);
        return;
      }

      const startDate = weekDates[0]?.date;
      const endDate = weekDates[weekDates.length - 1]?.date;
      if (!startDate || !endDate) {
        setSchedules([]);
        return;
      }

      const locationsToUse = locationsOverride || academyLocations;
      const mainLocationsToUse = mainLocationsOverride || mainLocations;

      const accessibleAcademyIds = (mainLocationsToUse || []).map((a: any) => Number(a.id));
      const accessibleLocationIds = (locationsToUse || [])
        .filter((location: any) => accessibleAcademyIds.includes(Number(location.main_location_id)))
        .map((location: any) => location.id);

      if (accessibleLocationIds.length === 0) {
        setSchedules([]);
        return;
      }

      const { data, error } = await supabase
        .from("schedules")
        .select(
          `
          *, 
          sub_locations!inner(
            id,
            name,
            main_location_id, 
            main_locations!inner(
              id,
              name,
              location_type
            )
          )
        `
        )
        .eq("schedule_type", "academy")
        .in("approval_status", [
          "pending",
          "approval_requested",
          "approved",
          "confirmed",
          "modification_requested",
          "modification_approved",
          "cancellation_requested",
          "deletion_requested",
          "cancelled",
        ])
        .in("sub_location_id", accessibleLocationIds)
        .gte("shoot_date", startDate)
        .lte("shoot_date", endDate)
        .order("shoot_date")
        .order("start_time");

      if (error) throw error;

      const validSchedules = (data || []).filter(
        (schedule: any) =>
          schedule && schedule.start_time && schedule.end_time && schedule.professor_name && schedule.sub_locations
      );

      // 요청자/승인자 프로필(있으면)
      if (validSchedules.length > 0) {
        const userIds = [
          ...new Set(validSchedules.flatMap((s: any) => [s.requested_by, s.approved_by]).filter(Boolean)),
        ];

        if (userIds.length > 0) {
          const { data: users } = await supabase
            .from("user_profiles")
            .select("id, name, email")
            .in("id", userIds as number[]);

          validSchedules.forEach((schedule: any) => {
            if (schedule.requested_by)
              schedule.requested_user = users?.find((u: any) => u.id === schedule.requested_by) || null;
            if (schedule.approved_by)
              schedule.approved_user = users?.find((u: any) => u.id === schedule.approved_by) || null;
          });
        }
      }

      // assigned_shooter_id 기반 촬영자 표시
      const shooterIds = [...new Set(validSchedules.map((s: any) => s.assigned_shooter_id).filter((v: any) => !!v))];
      if (shooterIds.length > 0) {
        const { data: shooterUsers } = await supabase.from("users").select("id, name, phone, role").in("id", shooterIds);
        validSchedules.forEach((s: any) => {
          if (!s.assigned_shooter_id) return;
          const u = shooterUsers?.find((x: any) => x.id === s.assigned_shooter_id);
          if (!u) return;
          s.user_profiles = { id: u.id, name: u.name, phone: u.phone, role: u.role };
          s.assigned_shooters = [u.name];
        });
      }

      setSchedules(validSchedules);
    },
    [academyLocations, mainLocations, generateWeekDates]
  );

  /** ✅ 촬영자 목록 */
  const fetchShooters = async () => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("id, name, phone, role, status")
        .eq("status", "active")
        .in("role", ["shooter", "schedule_admin", "manager"]);
      if (error) throw error;
      setShooters(data || []);
    } catch (e) {
      console.warn("촬영자 조회 오류(무시 가능):", e);
      setShooters([]);
    }
  };

  /** ✅ 학원/강의실/스케줄 로딩 */
  const fetchData = async () => {
    try {
      setError(null);
      setIsLoading(true);

      const roleFromStorage = localStorage.getItem("userRole") || "";
      const isAcademyManager = roleFromStorage === "academy_manager";

      let allowedMainLocationIds: number[] = [];

      if (isAcademyManager && currentUserId) {
        const { data: managerRows, error: managerErr } = await supabase
          .from("managers")
          .select("main_location_id")
          .eq("user_id", currentUserId)
          .eq("manager_type", "academy_manager")
          .eq("is_active", true);

        if (managerErr) {
          console.warn("⚠️ managers 조회 오류 (학원 매니저 담당 학원):", managerErr);
        } else {
          allowedMainLocationIds = (managerRows || [])
            .map((m: any) => m.main_location_id)
            .filter((v: any) => v !== null)
            .map((v: any) => Number(v));
        }
      }

      let mainLocsQuery = supabase
        .from("main_locations")
        .select("*")
        .eq("is_active", true)
        .eq("location_type", "academy")
        .order("name");

      if (isAcademyManager && allowedMainLocationIds.length > 0) {
        mainLocsQuery = mainLocsQuery.in("id", allowedMainLocationIds);
      }

      const { data: mainLocsData, error: mainErr } = await mainLocsQuery;
      if (mainErr) throw mainErr;

      const loadedMainLocations = mainLocsData || [];
      setMainLocations(loadedMainLocations);

      let locsQuery = supabase
        .from("sub_locations")
        .select(`*, main_locations!inner(*)`)
        .eq("is_active", true)
        .eq("main_locations.location_type", "academy")
        .order("main_location_id")
        .order("id");

      if (isAcademyManager && allowedMainLocationIds.length > 0) {
        locsQuery = locsQuery.in("main_location_id", allowedMainLocationIds);
      }

      const { data: locsData, error: locsErr } = await locsQuery;
      if (locsErr) throw locsErr;

      const loadedLocations = locsData || [];
      const formattedLocations = loadedLocations.map((loc: any) => ({
        ...loc,
        name: `${loc.main_locations.name} - ${loc.name}`,
        displayName: `${loc.main_locations.name} - ${loc.name}`,
      }));

      setAcademyLocations(formattedLocations);

      await fetchShooters();
      await fetchSchedules(formattedLocations, loadedMainLocations);
    } catch (e) {
      console.error("데이터 로딩 오류:", e);
      setError("데이터를 불러오는데 실패했습니다. 네트워크 연결을 확인해주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  /** ✅ localStorage 플래그로 재조회 */
  useEffect(() => {
    const handleStorageChange = () => {
      const updatedFlag = localStorage.getItem("schedules_updated");
      if (updatedFlag) {
        const timestamp = parseInt(updatedFlag);
        if (Date.now() - timestamp < 3000) {
          fetchSchedules();
          localStorage.removeItem("schedules_updated");
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);
    const interval = setInterval(handleStorageChange, 1000);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, [fetchSchedules]);

  useEffect(() => {
    if (!currentWeek) return;

    const roleFromStorage = typeof window !== "undefined" ? localStorage.getItem("userRole") || "" : "";
    const isAcademyManager = roleFromStorage === "academy_manager";

    if (isAcademyManager && !currentUserId) return;

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWeek, currentUserId]);

  /** ✅ 셀 클릭: 생성 모달 (입력은 오픈) */
  const handleCellClick = (date: string, location: any) => {
    const fallbackLocations = academyLocations.length > 0 ? academyLocations : [];

    setModalData({
      mode: "create" as const,
      date,
      locationId: location.id,
      scheduleData: null,
      mainLocations,
      academyLocations: fallbackLocations,
      shooters,
    });
    setModalOpen(true);
  };

  /** ✅ 카드 클릭: 수정 모달 */
  const handleScheduleCardClick = (schedule: any) => {
    if (!schedule || !schedule.id) return;

    setModalData({
      mode: "edit" as const,
      scheduleData: schedule,
      date: schedule.shoot_date,
      locationId: schedule.sub_location_id,
      mainLocations,
      academyLocations,
      shooters,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalData(null);
  };

  /** ✅ 의미 있는 변경 비교 */
  const hasMeaningfulChanges = (oldSnap: any, newSnap: any) => {
    if (!oldSnap && !newSnap) return false;
    if (!oldSnap || !newSnap) return true;

    const keys = [
      "shoot_date",
      "start_time",
      "end_time",
      "professor_name",
      "course_name",
      "course_code",
      "shooting_type",
      "sub_location_id",
      "notes",
      "professor_category_name",
      "professor_category_id",
    ];

    for (const k of keys) {
      const a = oldSnap?.[k];
      const b = newSnap?.[k];
      if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) return true;
    }
    return false;
  };

  /** ✅ 저장(모달 onSave) */
  const handleSave = async (
    payload: any,
    action:
      | "temp"
      | "request"
      | "request_withdraw"
      | "approve"
      | "modify_request"
      | "cancel_request"
      | "delete_request"
      | "approve_modification"
      | "modify_approve"
      | "cancel_approve"
      | "delete_approve"
      | "cancel"
      | "delete"
      | "crosscheck_req"
      | "crosscheck_ok"
  ) => {
    try {
      const toHHMMSS = (t: string) => (t && t.length === 5 ? `${t}:00` : t || "");

      // ✅ “승인요청류만 락”: academy_manager만 적용
      const roleFromStorage = localStorage.getItem("userRole") || "";
      const isAcademyManager = roleFromStorage === "academy_manager";
      const weekDate = toDateSafe(currentWeek);

      const approvalRequestActions = new Set<string>(["request", "modify_request", "cancel_request", "delete_request"]);

      if (isAcademyManager && approvalRequestActions.has(action) && isAcademyApprovalLocked(weekDate)) {
        alert("차주 스케줄 승인요청 가능 시간이 지났습니다. 관리자에게 문의해주세요.\n(임시저장/입력/복사는 가능합니다)");
        return { success: false, message: "승인요청 락" };
      }

      /** ✅ 상태 매핑 */
      const statusMap: Record<string, { approval_status?: string; is_active?: boolean }> = {
        temp: { approval_status: "pending", is_active: true },
        request: { approval_status: "approval_requested", is_active: true },
        request_withdraw: { approval_status: "pending", is_active: true },
        approve: { approval_status: "approved", is_active: true },

        modify_request: { approval_status: "modification_requested", is_active: true },
        approve_modification: { approval_status: "modification_approved", is_active: true },

        // modify_approve는 아래에서 변경 판단 후 approval_requested 강제
        modify_approve: {},

        cancel_request: { approval_status: "cancellation_requested", is_active: true },
        delete_request: { approval_status: "deletion_requested", is_active: true },

        cancel_approve: { approval_status: "cancelled", is_active: false },
        delete_approve: { approval_status: "deleted", is_active: false },

        cancel: { approval_status: "cancelled", is_active: false },
        delete: { approval_status: "deleted", is_active: false },
      };

      const { changed_by, professor_category_name, professor_category_id, reason, schedule_id, id, ...rest } = payload;

      const scheduleId = schedule_id || id || payload?.scheduleData?.id || null;

      const existing = scheduleId ? schedules.find((s: any) => s.id === scheduleId) : null;
      const oldSnapshot = existing ? buildSnapshotFromSchedule(existing) : null;

      const status = statusMap[action] || {};
      const record: any = {
        schedule_type: "academy",
        shoot_date: rest.shoot_date,
        start_time: toHHMMSS(rest.start_time),
        end_time: toHHMMSS(rest.end_time),
        professor_name: rest.professor_name || "",
        course_name: rest.course_name || "",
        course_code: rest.course_code || "",
        shooting_type: rest.shooting_type || "촬영",
        sub_location_id: Number(rest.sub_location_id),
        notes: rest.notes || "",
        ...(status.approval_status ? { approval_status: status.approval_status } : {}),
        ...(typeof status.is_active === "boolean" ? { is_active: status.is_active } : {}),
      };

      if (professor_category_name) record.professor_category_name = professor_category_name;
      if (professor_category_id) record.professor_category_id = professor_category_id;

      // 요청 사유 저장
      if (action === "modify_request" && reason) record.modification_reason = reason;
      if (action === "cancel_request" && reason) record.cancellation_reason = reason;
      if (action === "delete_request" && reason) record.deletion_reason = reason;

      // 크로스체크 상태
      if (action === "crosscheck_req") record.tracking_status = "crosscheck_req";
      if (action === "crosscheck_ok") record.tracking_status = "crosscheck_ok";

      // 수정요청 → 크로스체크 리셋
      if (action === "modify_request") record.tracking_status = null;

      // 철회 시 메타 정리(선택)
      if (action === "request_withdraw") {
        record.requested_by = null;
        record.approval_requested_at = null;
      }

      // requested_by / approved_by
      if (currentUserId) {
        if (action === "request") record.requested_by = currentUserId;

        // ✅ approved_by는 진짜 승인/완료만
        if (["approve", "approve_modification", "cancel_approve", "delete_approve", "cancel", "delete"].includes(action)) {
          record.approved_by = currentUserId;
        }
      }

      let dbRes: any;

      if (scheduleId) {
        // ✅ modify_approve: 변경 없으면 스킵, 변경 있으면 approval_requested로 재진입
        if (action === "modify_approve") {
          const pseudoNew = buildSnapshotFromSchedule({ ...(existing || {}), ...record });
          const changed = hasMeaningfulChanges(oldSnapshot, pseudoNew);

          if (!changed) return { success: true, message: "변경 내용이 없습니다.", noChange: true };

          record.approval_status = "approval_requested";
          record.tracking_status = null;
        }

        dbRes = await supabase.from("schedules").update(record).eq("id", scheduleId).select().single();
      } else {
        dbRes = await supabase.from("schedules").insert(record).select().single();
      }

      if (dbRes.error) {
        console.error("❌ 스케줄 저장 실패:", dbRes.error);
        return { success: false, message: "스케줄 저장 실패" };
      }

      const saved = dbRes.data;
      const finalId = saved?.id;

      const newSnapshot = buildSnapshotFromSchedule(saved || {});
      const isNewSchedule = !scheduleId;

      // ✅ schedule_history 기록
      if (isNewSchedule && (action === "temp" || action === "request")) {
        await logScheduleHistory({
          scheduleId: finalId,
          changeType: "created",
          description: reason || "",
          changedBy: changed_by || currentUserId || null,
          oldValue: null,
          newValue: newSnapshot,
        });

        if (action === "request") {
          await logScheduleHistory({
            scheduleId: finalId,
            changeType: "request",
            description: reason || "",
            changedBy: changed_by || currentUserId || null,
            oldValue: newSnapshot,
            newValue: newSnapshot,
          });
        }
      } else {
        await logScheduleHistory({
          scheduleId: finalId,
          changeType: action,
          description: reason || "",
          changedBy: changed_by || currentUserId || null,
          oldValue: oldSnapshot,
          newValue: newSnapshot,
        });
      }

      // ✅ 네이버웍스 알림(요청류만)
      if (
        ["request", "request_withdraw", "modify_request", "cancel_request", "delete_request", "crosscheck_req", "crosscheck_ok"].includes(action)
      ) {
        try {
          const content = buildWorksMessage(action, saved || {});
          await fetch("/api/message", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content }),
          });
        } catch (e) {
          console.warn("[naverworks] message send failed:", e);
        }
      }

      await fetchSchedules();
      return { success: true, message: "저장되었습니다." };
    } catch (err) {
      console.error("❌ handleSave 오류:", err);
      return { success: false, message: "저장 중 오류가 발생했습니다." };
    }
  };

  /** ✅ 색상 */
  const getLocationColor = (locationId: number) => {
    const location = academyLocations.find((loc) => loc.id === locationId);
    const academyId = location?.main_location_id;
    return (academyColors as any)[academyId] || { bg: "#f8fafc", border: "#e2e8f0", text: "#1f2937" };
  };

  /** ✅ 최종 렌더 스케줄(필터/임시ONOFF 포함) */
  const filteredSchedules = useMemo(() => {
    let filtered = schedules;

    // ✅ 관리자 전용: 임시저장(pending) 전체 노출 ON/OFF
    if (userRole === "admin" && !showTempSchedules) {
      filtered = filtered.filter((s: any) => s.approval_status !== "pending");
    }

    if (filters.shootingType !== "all") {
      filtered = filtered.filter((s: any) => s.shooting_type === filters.shootingType);
    }

    if (filters.status !== "all") {
      filtered = filtered.filter((s: any) => s.approval_status === filters.status);
    }

    return filtered;
  }, [schedules, userRole, showTempSchedules, filters]);

  /** ✅ 셀별 스케줄: 반드시 filteredSchedules를 기준으로 */
  const getScheduleForCell = useCallback(
    (date: string, location: any) => {
      try {
        return filteredSchedules.filter((s: any) => s.shoot_date === date && s.sub_location_id === location.id);
      } catch {
        return [];
      }
    },
    [filteredSchedules]
  );

  /** ✅ 카드 렌더 */
  const renderAcademyScheduleCard = (schedule: any) => {
    const isCancelled = schedule.approval_status === "cancelled" && schedule.is_active === false;

    // ✅ 관리자만 선택승인용 체크박스
    const canSelectForBulkApprove = userRole === "admin";
    const isSelected = canSelectForBulkApprove ? selectedSchedules.includes(schedule.id) : false;

    const locationColor = getLocationColor(schedule.sub_location_id);

    const shooterText =
      (Array.isArray(schedule.assigned_shooters) && schedule.assigned_shooters.length
        ? schedule.assigned_shooters.join(", ")
        : "") ||
      (schedule.user_profiles?.name ?? undefined);

    return (
      <ScheduleCardErrorBoundary key={schedule.id}>
        <div
          style={{
            position: "relative",
            transition: "all 0.2s ease",
            opacity: isCancelled ? 0.5 : 1,
            filter: isCancelled ? "grayscale(50%)" : "none",
          }}
        >
          {isCancelled && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "rgba(0, 0, 0, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 20,
                borderRadius: "8px",
                color: "white",
                fontWeight: "bold",
                fontSize: "14px",
                pointerEvents: "none",
              }}
            >
              취소완료
            </div>
          )}

          <UnifiedScheduleCard
            schedule={schedule}
            scheduleType="academy"
            locationColor={locationColor}
            onClick={() => handleScheduleCardClick(schedule)}
            onContextMenu={() => {}}
            showCheckbox={canSelectForBulkApprove && !isCancelled}
            isSelected={isSelected}
            onCheckboxChange={
              canSelectForBulkApprove
                ? (checked) => {
                    setSelectedSchedules((prev) => {
                      if (checked) return prev.includes(schedule.id) ? prev : [...prev, schedule.id];
                      return prev.filter((id) => id !== schedule.id);
                    });
                  }
                : undefined
            }
            shooterText={shooterText}
          />
        </div>
      </ScheduleCardErrorBoundary>
    );
  };

  /** ✅ 필터 */
  const getFilteredLocations = () => {
    let filtered = academyLocations;
    if (filters.mainLocationId !== "all") {
      filtered = filtered.filter((loc: any) => loc.main_location_id === parseInt(filters.mainLocationId));
    }
    return filtered;
  };

  const renderFilters = () => {
    if (isManagerMode()) return null;

    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexDirection: "row" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", minWidth: "40px" }}>학원:</label>
          <select
            value={filters.mainLocationId}
            onChange={(e) => setFilters({ ...filters, mainLocationId: e.target.value })}
            style={{
              padding: "4px 8px",
              border: "1px solid var(--border-color)",
              borderRadius: 4,
              background: "var(--bg-primary)",
              color: "var(--text-primary)",
              fontSize: 13,
              outline: "none",
            }}
          >
            <option value="all">전체 학원</option>
            {mainLocations.map((loc: any) => (
              <option key={loc.id} value={String(loc.id)}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", minWidth: "50px" }}>촬영형식:</label>
          <select
            value={filters.shootingType}
            onChange={(e) => setFilters({ ...filters, shootingType: e.target.value })}
            style={{
              padding: "4px 8px",
              border: "1px solid var(--border-color)",
              borderRadius: 4,
              background: "var(--bg-primary)",
              color: "var(--text-primary)",
              fontSize: 13,
              outline: "none",
            }}
          >
            <option value="all">전체</option>
            <option value="촬영">촬영</option>
            <option value="중계">중계</option>
            <option value="(본사)촬영">(본사)촬영</option>
            <option value="라이브촬영">라이브촬영</option>
            <option value="라이브중계">라이브중계</option>
            <option value="(NAS)촬영">(NAS)촬영</option>
          </select>
        </div>

        {/* ✅ 관리자 전용: 임시저장 전체 표시 ON/OFF (개별 카드 X, 전체 제어 1개 버튼) */}
        {userRole === "admin" && (
          <button
            type="button"
            onClick={() => {
              setShowTempSchedules((v) => {
                const next = !v;

                // ✅ 임시 숨김으로 바뀌는 순간, pending 선택은 제거(선택승인 UX 깨짐 방지)
                if (next === false) {
                  setSelectedSchedules((prev) => {
                    const pendingIds = new Set(
                      schedules.filter((s: any) => s.approval_status === "pending").map((s: any) => s.id)
                    );
                    return prev.filter((id) => !pendingIds.has(id));
                  });
                }
                return next;
              });
            }}
            style={{
              marginLeft: 8,
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid var(--border-color)",
              background: showTempSchedules ? "#111827" : "white",
              color: showTempSchedules ? "white" : "var(--text-primary)",
              cursor: "pointer",
              fontWeight: 900,
              fontSize: 12,
              whiteSpace: "nowrap",
            }}
            title="임시저장(pending) 스케줄을 화면에서만 숨기거나 표시합니다."
          >
            임시 {showTempSchedules ? "ON" : "OFF"}
          </button>
        )}
      </div>
    );
  };

  /** ✅ 선택승인(admin 전용, 체크박스 기반) */
  const handleBulkApproval = async (type: "selected" | "all") => {
    try {
      const roleFromStorage = localStorage.getItem("userRole") || "";
      const isAdminLike =
        roleFromStorage === "system_admin" || roleFromStorage === "schedule_admin" || roleFromStorage === "shooting_manager";
      if (!isAdminLike) return;

      const ids = type === "all" ? schedules.map((s: any) => s.id) : selectedSchedules.slice();
      if (!ids.length) {
        alert("선택된 스케줄이 없습니다.");
        return;
      }

      const proceed = confirm(`${type === "all" ? "전체" : "선택"} 스케줄을 승인할까요? (${ids.length}건)`);
      if (!proceed) return;

      if (isProcessingRef.current) return;
      isProcessingRef.current = true;

      const me = Number(localStorage.getItem("userId") || currentUserId || 0) || null;

      const { data: updatedRows, error: updErr } = await supabase
        .from("schedules")
        .update({
          approval_status: "approved",
          is_active: true,
          ...(me ? { approved_by: me } : {}),
        })
        .in("id", ids)
        .select();

      if (updErr) throw updErr;

      for (const row of updatedRows || []) {
        const old = schedules.find((s: any) => s.id === row.id) || null;
        const oldSnap = old ? buildSnapshotFromSchedule(old) : null;
        const newSnap = buildSnapshotFromSchedule(row);

        await logScheduleHistory({
          scheduleId: row.id,
          changeType: "approve",
          description: "",
          changedBy: me,
          oldValue: oldSnap,
          newValue: newSnap,
        });
      }

      alert("승인 처리 완료");
      setSelectedSchedules([]);
      await fetchSchedules();
    } catch (e) {
      console.error("❌ 선택승인 오류:", e);
      alert("선택승인 중 오류가 발생했습니다.");
    } finally {
      isProcessingRef.current = false;
    }
  };

  /** ✅ 지난주 복사 버튼 → 선택복사 모달 오픈 (복사는 항상 오픈) */
  const handleCopyPreviousWeek = async () => {
    if (!currentWeek) {
      alert("기준 주간 정보가 없습니다.");
      return;
    }
    setCopyModalOpen(true);
  };

  /**
   * ✅ [딥링크 핵심]
   * /academy-schedules?scheduleId=123&date=2026-01-14
   * 1) date가 속한 주로 이동
   * 2) 해당 scheduleId 모달 오픈
   */
  const tryHandleDeepLink = useCallback(async () => {
    if (!router.isReady) return;
    if (deepLinkHandledRef.current) return;

    const qScheduleId = router.query?.scheduleId;
    const qDate = router.query?.date;

    const scheduleId = qScheduleId ? Number(Array.isArray(qScheduleId) ? qScheduleId[0] : qScheduleId) : NaN;
    const dateStr = qDate ? String(Array.isArray(qDate) ? qDate[0] : qDate) : "";

    if (!scheduleId || Number.isNaN(scheduleId)) return;

    // 처리 플래그는 "완료"가 아니라 "진입" 기준으로 잠궈서 중복 점프 방지
    deepLinkHandledRef.current = true;
    pendingOpenScheduleIdRef.current = scheduleId;

    // 1) date가 있으면 해당 주로 이동
    if (dateStr) {
      const target = toDateSafe(dateStr);
      if (!isNaN(target.getTime())) {
        const diff = weekDiffByMonday(toDateSafe(currentWeek), target);
        if (diff !== 0) {
          // navigateWeek가 +1/-1 뿐만 아니라 N도 받는 구조로 쓰는 경우가 많아서 그대로 diff 전달
          navigateWeek(diff);
          return; // ✅ 주 이동 후 fetchData → schedules 갱신되면 아래 useEffect에서 모달 오픈됨
        }
      }
    }

    // 2) date가 없거나 같은 주라면: 현재 schedules에 없으면 DB에서 날짜만 보강해서 주 이동
    const found = schedules.find((s: any) => s.id === scheduleId);
    if (!found) {
      const { data, error } = await supabase
        .from("schedules")
        .select("id, shoot_date")
        .eq("id", scheduleId)
        .single();

      if (!error && data?.shoot_date) {
        const target = toDateSafe(data.shoot_date);
        const diff = weekDiffByMonday(toDateSafe(currentWeek), target);
        if (diff !== 0) {
          navigateWeek(diff);
          return;
        }
      }
    }

    // 같은 주면 아래 open-effect에서 열린다
  }, [router.isReady, router.query, currentWeek, navigateWeek, schedules]);

  useEffect(() => {
    tryHandleDeepLink();
  }, [tryHandleDeepLink]);

  /**
   * ✅ schedules/locations 로딩이 끝났을 때
   * pendingOpenScheduleIdRef가 있으면 해당 스케줄 모달 오픈
   */
  useEffect(() => {
    const targetId = pendingOpenScheduleIdRef.current;
    if (!targetId) return;

    // 모달/데이터 준비 조건: locations/mainLocations는 최소 필요
    if (academyLocations.length === 0 || mainLocations.length === 0) return;

    const found = schedules.find((s: any) => s.id === targetId);
    if (!found) return;

    // ✅ 오픈
    handleScheduleCardClick(found);

    // ✅ 한번 열었으면 초기화
    pendingOpenScheduleIdRef.current = null;

    // ✅ URL 깔끔하게 정리(원하면)
    // - 뒤로가기 스택이 지저분해지는 게 싫으면 replace
    // - 유지하고 싶으면 이 블럭 주석 처리
    router.replace("/academy-schedules", undefined, { shallow: true });
  }, [schedules, academyLocations, mainLocations, router]);

  /** ✅ 로딩/에러 UI */
  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "400px", backgroundColor: "#f8fafc" }}>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              border: "4px solid #e5e7eb",
              borderTop: "4px solid #2563eb",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 16px",
            }}
          />
          <div style={{ color: "#6b7280", fontSize: "14px", fontWeight: "500" }}>학원 스케줄을 불러오는 중...</div>
          <style jsx>{`
            @keyframes spin {
              0% {
                transform: rotate(0deg);
              }
              100% {
                transform: rotate(360deg);
              }
            }
          `}</style>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "400px", backgroundColor: "#fef2f2" }}>
        <div style={{ textAlign: "center", maxWidth: "400px" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚠️</div>
          <div style={{ fontSize: "18px", fontWeight: "bold", color: "#dc2626", marginBottom: "8px" }}>학원 스케줄 로딩 오류</div>
          <div style={{ fontSize: "14px", color: "#6b7280", marginBottom: "20px" }}>{error}</div>
          <button
            onClick={fetchData}
            style={{
              padding: "10px 20px",
              backgroundColor: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "14px",
            }}
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <BaseScheduleGrid
        title="학원 스케줄 관리"
        leftColumnTitle="강의실"
        locations={getFilteredLocations()}
        schedules={filteredSchedules} // ✅ 중요: 최종 렌더 기준 스케줄
        currentWeek={toDateSafe(currentWeek)}
        onWeekChange={navigateWeek}
        onCellClick={handleCellClick}
        getScheduleForCell={getScheduleForCell} // ✅ 중요: 셀도 필터 기준으로
        renderScheduleCard={renderAcademyScheduleCard}
        showAddButton={true}
        onCopyPreviousWeek={handleCopyPreviousWeek}
        userRole={userRole}
        pageType="academy"
        getLocationColor={getLocationColor}
        customFilters={renderFilters()}
        onBulkApproval={userRole === "admin" ? handleBulkApproval : undefined}
        selectedSchedules={selectedSchedules}
        onClearSelection={() => setSelectedSchedules([])}
      />

      {modalOpen && (
        <AcademyScheduleModal
          open={modalOpen}
          onClose={closeModal}
          initialData={modalData}
          locations={modalData?.academyLocations || []}
          mainLocations={modalData?.mainLocations || []}
          userRole={userRole}
          onSave={handleSave}
          currentUserId={currentUserId}
        />
      )}

      {copyModalOpen && currentWeek && (
        <CopyPreviousWeekModal
          open={copyModalOpen}
          onClose={() => setCopyModalOpen(false)}
          currentWeek={toDateSafe(currentWeek)}
          academyLocations={academyLocations}
          onCopied={async () => {
            await fetchSchedules();
          }}
        />
      )}
    </>
  );
}
