"use client";
import React, { useState, useEffect } from "react";
import { supabase } from "../../utils/supabaseClient";
import { ProfessorAutocomplete } from "../ProfessorAutocomplete";
import { normalizeChangeType } from "../../utils/scheduleHistory";

interface AcademyScheduleModalProps {
  open: boolean;
  onClose: () => void;
  initialData?: any;
  locations: any[];
  mainLocations?: any[];
  userRole: string;
  currentUserId?: number | null; // ✅ 페이지에서 내려주는 내부 users.id
  onSave: (
    data: any,
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
 ) => Promise<{ success: boolean; message: string; noChange?: boolean }>;
}

/* ======================
   🔥 사유 입력 모달
   ====================== */
const ReasonModal = ({
  open,
  type,
  onClose,
  onSubmit,
}: {
  open: boolean;
  type: "modify" | "cancel" | "delete";
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) => {
  const [reason, setReason] = useState("");

  const titles = {
    modify: "수정 요청 사유",
    cancel: "취소 요청 사유",
    delete: "삭제 요청 사유",
  };
  const placeholders = {
    modify: "수정이 필요한 이유를 입력해주세요...",
    cancel: "취소가 필요한 이유를 입력해주세요...",
    delete: "삭제가 필요한 이유를 입력해주세요...",
  };

  useEffect(() => {
    if (!open) setReason("");
  }, [open]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: 12,
          width: 420,
          maxWidth: "90vw",
          padding: 24,
          boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
        }}
      >
        <h3 style={{ margin: "0 0 16px 0", fontSize: 18, fontWeight: "bold" }}>
          {titles[type]}
        </h3>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={placeholders[type]}
          rows={4}
          style={{
            width: "100%",
            padding: 12,
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: 14,
            outline: "none",
            resize: "vertical",
            marginBottom: 16,
          }}
        />
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button
            onClick={() => {
              setReason("");
              onClose();
            }}
            style={{
              padding: "8px 16px",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              backgroundColor: "white",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            취소
          </button>
          <button
            onClick={() => {
              if (!reason.trim()) {
                alert("사유를 입력해주세요.");
                return;
              }
              onSubmit(reason.trim());
              setReason("");
            }}
            style={{
              padding: "8px 16px",
              border: "none",
              borderRadius: 6,
              backgroundColor: "#2563eb",
              color: "white",
              cursor: "pointer",
              fontWeight: 800,
              fontSize: 13,
            }}
          >
            요청 전송
          </button>
        </div>
      </div>
    </div>
  );
};

/* ==============================
   🔥 메인: AcademyScheduleModal
   ============================== */

type WeekDayOption = { label: string; value: string };

export default function AcademyScheduleModal({
  open,
  onClose,
  initialData,
  locations,
  mainLocations,
  userRole,
  currentUserId: propCurrentUserId,
  onSave,
}: AcademyScheduleModalProps) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // ✅ 모달에서 사용할 내부 users.id (페이지에서 받은 값 우선)
  const [modalUserId, setModalUserId] = useState<number | null>(null);
  const [userIdLoading, setUserIdLoading] = useState(true);

  const [reasonModalOpen, setReasonModalOpen] = useState(false);
  const [requestType, setRequestType] = useState<"modify" | "cancel" | "delete">(
    "modify"
  );

  // 🔥 히스토리
  const [scheduleHistory, setScheduleHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // 🔥 차주 입력 잠금
  const [weekDays, setWeekDays] = useState<WeekDayOption[]>([]);
  const [isScheduleLocked, setIsScheduleLocked] = useState(false);

  // 🔥 시간 포맷 (히스토리용)
  const formatDateTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleString("ko-KR", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // 🔥 차주 월~일 계산
  const getNextWeekRange = () => {
    const now = new Date();
    const day = now.getDay(); // 0:일, 1:월 ...
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const thisMonday = new Date(now);
    thisMonday.setHours(0, 0, 0, 0);
    thisMonday.setDate(now.getDate() + diffToMonday);

    const nextMonday = new Date(thisMonday);
    nextMonday.setDate(thisMonday.getDate() + 7);

    const nextSunday = new Date(nextMonday);
    nextSunday.setDate(nextMonday.getDate() + 6);

    return { start: nextMonday, end: nextSunday };
  };

  // ✅ 모달 사용자 ID 세팅 (user_profiles 조회 제거)
  useEffect(() => {
    if (!open) return;

    setUserIdLoading(true);

    // 1) 페이지에서 내려온 internal users.id 우선
    if (typeof propCurrentUserId === "number" && propCurrentUserId > 0) {
      setModalUserId(propCurrentUserId);
      setUserIdLoading(false);
      return;
    }

    // 2) fallback: localStorage userId
    const storedUserId = localStorage.getItem("userId");
    if (
      storedUserId &&
      storedUserId !== "null" &&
      storedUserId !== "undefined"
    ) {
      const parsed = parseInt(storedUserId);
      if (!isNaN(parsed) && parsed > 0) {
        setModalUserId(parsed);
        setUserIdLoading(false);
        return;
      }
    }

    // 3) 마지막 fallback
    setModalUserId(1);
    setUserIdLoading(false);
  }, [open, propCurrentUserId]);

  const formatKoreanDate = (dateStr?: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const yoil = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${mm}/${dd}(${yoil})`;
  };

  // 🔥 차주 주간 정보 + LOCK 계산
  useEffect(() => {
    if (!open) return;

    const { start } = getNextWeekRange();
    const days: WeekDayOption[] = [];
    const labels = ["월", "화", "수", "목", "금", "토", "일"];

    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const label = `${mm}/${dd}(${labels[i]})`;

      days.push({ label, value: `${yyyy}-${mm}-${dd}` });
    }
    setWeekDays(days);

    // 🔒 학원 매니저: 이번 주 화요일 17:00 이후 차주 입력 잠금
    const now = new Date();
    const day = now.getDay(); // 0~6
    const diffToThisTuesday = (2 - day + 7) % 7;
    const thisTuesday = new Date(now);
    thisTuesday.setHours(17, 0, 0, 0);
    thisTuesday.setDate(now.getDate() + diffToThisTuesday);

    const role = localStorage.getItem("userRole") || "";
    if (role === "academy_manager" && now > thisTuesday) setIsScheduleLocked(true);
    else setIsScheduleLocked(false);
  }, [open]);

  // 🔥 초기 폼 데이터
  const getInitValue = (v: any): string =>
    v === null || v === undefined ? "" : String(v).trim();

  const formatTimeForInput = (t: any): string => {
    if (!t) return "";
    const s = String(t).trim();
    if (s.includes(":")) {
      const [h, m] = s.split(":");
      return `${h.padStart(2, "0")}:${(m ?? "00").padStart(2, "0")}`;
    }
    return s;
  };

  const getInitialFormData = () => {
    const scheduleData = initialData?.scheduleData;
    const isEditModeLocal = !!(scheduleData && scheduleData.id);

    if (isEditModeLocal) {
      return {
        shoot_date: getInitValue(scheduleData.shoot_date || initialData.date),
        start_time: formatTimeForInput(scheduleData.start_time),
        end_time: formatTimeForInput(scheduleData.end_time),
        professor_name: getInitValue(scheduleData.professor_name),
        course_name: getInitValue(scheduleData.course_name),
        course_code: getInitValue(scheduleData.course_code),
        shooting_type: getInitValue(scheduleData.shooting_type || "촬영"),
        notes: getInitValue(scheduleData.notes),
        sub_location_id: getInitValue(
          scheduleData.sub_location_id || initialData.locationId
        ),
        professor_category_name: getInitValue(scheduleData.professor_category_name),
        professor_category_id: scheduleData.professor_category_id ?? null,
      };
    }

    return {
      shoot_date: getInitValue(initialData?.date),
      start_time: "",
      end_time: "",
      professor_name: "",
      course_name: "",
      course_code: "",
      shooting_type: "촬영",
      notes: "",
      sub_location_id: getInitValue(initialData?.locationId),
      professor_category_name: "",
      professor_category_id: null,
    };
  };

  const [formData, setFormData] = useState(getInitialFormData);
  const [selectedProfessorInfo, setSelectedProfessorInfo] = useState<any>(null);

  const isEditMode = !!(initialData?.scheduleData && initialData.scheduleData.id);
  const scheduleData = initialData?.scheduleData || null;
  const currentStatus = String(scheduleData?.approval_status || "pending");
  const tracking = String(scheduleData?.tracking_status || "");
  const isInactive = scheduleData?.is_active === false;

  // academy_manager 신규/임시저장 단계: pending + temp 동일 취급
  const isTempStage = currentStatus === "pending" || currentStatus === "temp";

  const isAfterApproval = ["approved", "confirmed"].includes(currentStatus);
  const isAfterApprovalRequest = ["approval_requested", "approved", "confirmed"].includes(
    currentStatus
  );
  const isModificationInProgress = currentStatus === "modification_approved"; // 수정 권한 부여됨
  const isModificationRequested = currentStatus === "modification_requested";
  const isCancellationInProgress = currentStatus === "cancellation_requested";
  const isDeletionInProgress = currentStatus === "deletion_requested";

  // 🔥 교수 자동완성 변경 핸들러
  const handleProfessorChange = (value: string, professor?: any) => {
    setFormData((prev) => ({
      ...prev,
      professor_name: value,
      professor_category_name:
        professor?.category_name ?? prev.professor_category_name ?? "",
      professor_category_id:
        professor?.category_id ??
        professor?.categoryId ??
        professor?.id ??
        prev.professor_category_id ??
        null,
    }));

    if (professor) {
      setSelectedProfessorInfo({
        id: professor?.id ?? professor?.category_id ?? professor?.categoryId ?? null,
        category_name: professor?.category_name ?? "",
      });
    } else {
      setSelectedProfessorInfo(null);
    }
  };

  // 🔥 모달 열릴 때 저장된 매칭 배지 복원
  useEffect(() => {
    if (!open) return;
    const sd = initialData?.scheduleData;
    if (sd?.professor_category_name) {
      setSelectedProfessorInfo({
        id: sd.professor_category_id ?? null,
        category_name: sd.professor_category_name,
      });
    } else if (!formData.professor_category_name) {
      setSelectedProfessorInfo(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialData?.scheduleData?.id]);

  useEffect(() => {
    if (!open) {
      setSaving(false);
      setMessage("");
      setUserIdLoading(true);
      setSelectedProfessorInfo(null);
      setScheduleHistory([]);
    }
  }, [open]);

  useEffect(() => {
    const newFormData = getInitialFormData();
    setFormData(newFormData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData?.scheduleData?.approval_status, initialData?.scheduleData?.tracking_status]);

  // 🔥 권한 (기존 로직 유지 + 안정화)
  const getUserPermissions = () => {
    const currentUserRole = localStorage.getItem("userRole") || "";
    const userName = localStorage.getItem("userName") || "";
    if (
      userName === "manager1" ||
      currentUserRole === "system_admin" ||
      currentUserRole === "schedule_admin"
    ) {
      return { roleType: "admin" as const };
    }
    if (currentUserRole === "academy_manager") {
      return { roleType: "manager" as const };
    }
    return { roleType: "basic" as const };
  };
  const permissions = getUserPermissions();

  const validateFieldsForAction = (action: string) => {
    // 사유/철회/취소/삭제/크로스체크 계열은 필수입력 스킵
    const skip = [
      "modify_request",
      "cancel_request",
      "delete_request",
      "cancel_approve",
      "delete_approve",
      "cancel",
      "delete",
      "request_withdraw",
      "crosscheck_req",
      "crosscheck_ok",
    ];
    if (skip.includes(action)) return [];

    const required = [
      { field: "shoot_date", label: "촬영 날짜" },
      { field: "start_time", label: "시작 시간" },
      { field: "end_time", label: "종료 시간" },
      { field: "professor_name", label: "교수명" },
      { field: "shooting_type", label: "촬영형식" },
      { field: "sub_location_id", label: "강의실" },
    ];

    return required.filter(
      (f) =>
        !formData[f.field as keyof typeof formData] ||
        String(formData[f.field as keyof typeof formData]).trim() === "" ||
        String(formData[f.field as keyof typeof formData]) === "0"
    );
  };

  // ✅ 강의실 표시 텍스트 (현재 폼용)
  const getLocationLabel = () => {
    const idStr = String(formData.sub_location_id || "");
    if (!idStr) return "강의실 정보 없음";
    const found =
      (locations || []).find((l: any) => String(l.id) === idStr) ||
      (initialData?.academyLocations || []).find((l: any) => String(l.id) === idStr);

    return (
      found?.displayName ||
      found?.name ||
      found?.fullName ||
      initialData?.locationName ||
      `강의실 ID: ${idStr}`
    );
  };

  // ✅ 히스토리용 강의실 라벨 변환(숫자 → 텍스트)
  const getLocationLabelById = (id: any) => {
    const idStr = String(id ?? "").trim();
    if (!idStr) return "-";
    const found =
      (locations || []).find((l: any) => String(l.id) === idStr) ||
      (initialData?.academyLocations || []).find((l: any) => String(l.id) === idStr);

    return found?.displayName || found?.name || found?.fullName || `강의실(${idStr})`;
  };

  // 🔥 히스토리 조회 (users 테이블로 매핑)
  const fetchScheduleHistory = async (scheduleId: number) => {
    if (!scheduleId) return;

    setLoadingHistory(true);
    try {
      const { data: historyData, error: historyError } = await supabase
        .from("schedule_history")
        .select("*")
        .eq("schedule_id", scheduleId)
        .order("created_at", { ascending: false });

      if (historyError) {
        console.error("히스토리 조회 오류:", historyError);
      }

      const { data: scheduleRow, error: scheduleError } = await supabase
        .from("schedules")
        .select("*")
        .eq("id", scheduleId)
        .single();

      if (scheduleError) {
        console.error("스케줄 데이터 조회 오류:", scheduleError);
      }

      // 1) changed_by 수집
      const allUserIds = new Set<number>();
      (historyData || []).forEach((h: any) => {
        if (typeof h.changed_by === "number") allUserIds.add(h.changed_by);
        if (typeof h.changed_by === "string" && !isNaN(Number(h.changed_by))) {
          allUserIds.add(Number(h.changed_by));
        }
      });

      // 2) users 테이블 조회
      let userMap = new Map<number, string>();
      if (allUserIds.size > 0) {
        const { data: users } = await supabase
          .from("users")
          .select("id, name")
          .in("id", Array.from(allUserIds));
        userMap = new Map((users || []).map((u: any) => [u.id, u.name]));
      }

      const getUserDisplayName = (changedBy: any): string => {
        if (!changedBy) return "담당자 정보 없음";
        if (typeof changedBy === "number") return userMap.get(changedBy) || `ID:${changedBy}`;
        if (typeof changedBy === "string" && !isNaN(Number(changedBy))) {
          const n = Number(changedBy);
          return userMap.get(n) || `ID:${changedBy}`;
        }
        return String(changedBy);
      };

      // ✅ 세부 숨김 대상(상태 이벤트)
      const HIDE_DETAILS = new Set([
        "created",
        "temp",
        "request",
        "request_withdraw",
        "approve",
        "approved",
        "approve_modification",
        "modification_approved",
        "cancel_request",
        "cancellation_requested",
        "cancel_approve",
        "cancelled",
        "delete_request",
        "deletion_requested",
        "delete_approve",
        "deleted",
        "crosscheck_req",
        "cross_check_request",
        "crosscheck_ok",
        "cross_check_confirm",
      ]);

      // ✅ 사유를 보여줄 타입(요청류만)
      const SHOW_REASON = new Set([
        "modify_request",
        "modification_requested",
        "cancel_request",
        "cancellation_requested",
        "delete_request",
        "deletion_requested",
      ]);

      // ✅ 세부(diff) 생성: “실제 변경”만 / 중요 필드만
      const buildDiffDetails = (item: any, normType: string) => {
        if (HIDE_DETAILS.has(normType)) return "";

        let oldV: any = null;
        let newV: any = null;
        try {
          oldV = item?.old_value ? JSON.parse(item.old_value) : null;
          newV = item?.new_value ? JSON.parse(item.new_value) : null;
        } catch {
          return "";
        }
        if (!oldV || !newV) return "";

        // 중요 필드만
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
        ];

        const label: Record<string, string> = {
          shoot_date: "날짜",
          start_time: "시작",
          end_time: "종료",
          professor_name: "교수",
          course_name: "강의명",
          course_code: "강의코드",
          shooting_type: "유형",
          sub_location_id: "강의실",
          notes: "비고",
        };

        const lines: string[] = [];

        // 시간은 한 줄로 합쳐서 보여주면 가독성 좋음
        const oldTime = oldV.start_time && oldV.end_time ? `${oldV.start_time}~${oldV.end_time}` : "";
        const newTime = newV.start_time && newV.end_time ? `${newV.start_time}~${newV.end_time}` : "";
        if (oldTime && newTime && oldTime !== newTime) {
          lines.push(`시간: ${oldTime} → ${newTime}`);
        }

        for (const k of keys) {
          if (k === "start_time" || k === "end_time") continue; // 위에서 합침
          const a = oldV?.[k];
          const b = newV?.[k];
          if (JSON.stringify(a) === JSON.stringify(b)) continue;

          if (k === "sub_location_id") {
            lines.push(`${label[k]}: ${getLocationLabelById(a)} → ${getLocationLabelById(b)}`);
            continue;
          }
          if (k === "notes") {
            const aa = (a ?? "").toString().trim() || "(없음)";
            const bb = (b ?? "").toString().trim() || "(없음)";
            lines.push(`${label[k]}: ${aa} → ${bb}`);
            continue;
          }

          lines.push(`${label[k] || k}: ${a ?? "(없음)"} → ${b ?? "(없음)"}`);
        }

        return lines.join("\n");
      };

      const sanitizeReason = (normType: string, desc: string | null | undefined) => {
        const d = (desc ?? "").trim();
        if (!d) return "";

        // “자동 컬럼 변경 나열” 같은 문구는 숨김
        const looksLikeColumnDiff =
          /\b(id|shoot_date|start_time|end_time|professor_name|course_name|course_code|shooting_type|sub_location_id|approval_status|tracking_status|notes|schedule_group_id|break_time_enabled|break_start_time|break_end_time|break_duration_minutes|is_active)\b\s*변경/.test(
            d
          );
        if (looksLikeColumnDiff) return "";

        // 요청류가 아니면 사유는 숨김(깔끔)
        if (!SHOW_REASON.has(normType)) return "";

        return d;
      };

      const actionLabelFromType = (t: string) => {
        // 핵심 라벨만 정리
        if (t === "created") return "등록됨";
        if (t === "temp") return "임시저장";
        if (t === "request") return "승인요청";
        if (t === "request_withdraw") return "승인요청 철회";
        if (t === "approve" || t === "approved") return "승인완료";

        if (t === "modify_request" || t === "modification_requested") return "수정요청";
        if (t === "approve_modification" || t === "modification_approved") return "수정권한 승인";
        if (t === "modify_approve") return "수정반영";

        if (t === "cancel_request" || t === "cancellation_requested") return "취소요청";
        if (t === "cancel_approve" || t === "cancelled") return "취소완료";

        if (t === "delete_request" || t === "deletion_requested") return "삭제요청";
        if (t === "delete_approve" || t === "deleted") return "삭제완료";

        if (t === "crosscheck_req" || t === "cross_check_request") return "크로스체크 요청";
        if (t === "crosscheck_ok" || t === "cross_check_confirm") return "크로스체크 완료";

        return "처리됨";
      };

      const historyMap = new Map<string, any>();

      // ✅ “옛 데이터”만 created 보정(중복 방지)
      if (scheduleRow && (historyData || []).length === 0) {
        historyMap.set(`created_${scheduleRow.id}`, {
          id: `created_${scheduleRow.id}`,
          action: "등록됨",
          reason: "",
          changed_by: "담당자 정보 없음",
          created_at: scheduleRow.created_at,
          details: "",
          source: "system",
        });
      }

      (historyData || []).forEach((item: any) => {
        const normType = normalizeChangeType(item.change_type);
        const userName = getUserDisplayName(item.changed_by);
        const actionLabel = actionLabelFromType(normType);

        historyMap.set(String(item.id), {
          id: String(item.id),
          action: actionLabel,
          changed_by: userName,
          created_at: item.created_at,
          // ✅ 사유/세부는 정책대로
          reason: sanitizeReason(normType, item.description),
          details: buildDiffDetails(item, normType),
          source: "history",
        });
      });

      const list = Array.from(historyMap.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setScheduleHistory(list);
    } catch (e) {
      console.error("히스토리 조회 오류:", e);
      setScheduleHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // 히스토리 로딩 트리거
  useEffect(() => {
    if (isEditMode && initialData?.scheduleData?.id && open) {
      fetchScheduleHistory(initialData.scheduleData.id);
    } else {
      setScheduleHistory([]);
    }
  }, [isEditMode, initialData?.scheduleData?.id, open]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // 🔥 필드 비활성화
  const getFieldDisabled = () => {
    if (saving || userIdLoading || isInactive) return true;
    if (permissions.roleType === "admin") return false;

    // academy_manager
    if (permissions.roleType === "manager") {
      // 수정권한 승인 상태(modification_approved)면 편집 가능
      if (isModificationInProgress) return false;
      // 요청 대기/승인완료는 직접 편집 불가
      if (isModificationRequested) return true;
      if (isAfterApproval) return true;
      if (isAfterApprovalRequest && currentStatus !== "pending") return true;
      return false;
    }
    return true;
  };
  const fieldDisabled = getFieldDisabled();

  const normalizeForCompare = (v: any) => {
  if (v === null || v === undefined) return "";
  return String(v).trim();
};

const normalizeTime = (t: any) => {
  const s = normalizeForCompare(t);
  if (!s) return "";
  // 07:10 or 07:10:00 → 07:10
  const [hh, mm] = s.split(":");
  return `${(hh ?? "").padStart(2, "0")}:${(mm ?? "00").padStart(2, "0")}`;
};

const hasMeaningfulChanges = () => {
  const sd = initialData?.scheduleData;
  if (!sd) return true; // 신규는 저장 의미 있음

  const before = {
    shoot_date: normalizeForCompare(sd.shoot_date),
    start_time: normalizeTime(sd.start_time),
    end_time: normalizeTime(sd.end_time),
    professor_name: normalizeForCompare(sd.professor_name),
    course_name: normalizeForCompare(sd.course_name),
    course_code: normalizeForCompare(sd.course_code),
    shooting_type: normalizeForCompare(sd.shooting_type),
    sub_location_id: normalizeForCompare(sd.sub_location_id),
    notes: normalizeForCompare(sd.notes),
    professor_category_id: normalizeForCompare(sd.professor_category_id),
    professor_category_name: normalizeForCompare(sd.professor_category_name),
  };

  const after = {
    shoot_date: normalizeForCompare(formData.shoot_date),
    start_time: normalizeTime(formData.start_time),
    end_time: normalizeTime(formData.end_time),
    professor_name: normalizeForCompare(formData.professor_name),
    course_name: normalizeForCompare(formData.course_name),
    course_code: normalizeForCompare(formData.course_code),
    shooting_type: normalizeForCompare(formData.shooting_type),
    sub_location_id: normalizeForCompare(formData.sub_location_id),
    notes: normalizeForCompare(formData.notes),
    professor_category_id: normalizeForCompare(
      selectedProfessorInfo?.id ?? formData.professor_category_id
    ),
    professor_category_name: normalizeForCompare(
      selectedProfessorInfo?.category_name ?? formData.professor_category_name
    ),
  };

  return Object.keys(before).some((k) => before[k as keyof typeof before] !== after[k as keyof typeof after]);
};


  // 🔥 저장
const handleSave = async (action: any, reason?: string) => {
  // ✅ 관리자 "저장"(modify_approve)인데 변경 없으면 그냥 닫기
  if (isEditMode && action === "modify_approve" && !hasMeaningfulChanges()) {
    onClose();
    return;
  }

  // 🔒 학원 매니저 신규 등록 잠금
  if (
    !isEditMode &&
    permissions.roleType === "manager" &&
    isScheduleLocked &&
    ["temp", "request"].includes(action)
  ) {
    const msg = "차주 스케줄 입력 가능 시간이 지났습니다. 관리자에게 문의해주세요.";
    setMessage(msg);
    alert(msg);
    return;
  }

  if (userIdLoading) {
    setMessage("사용자 정보를 확인하는 중입니다. 잠시만 기다려주세요.");
    return;
  }
  if (!modalUserId) {
    setMessage("사용자 정보를 확인할 수 없습니다. 새로고침 후 다시 시도해주세요.");
    return;
  }

  setSaving(true);
  setMessage("");

  try {
    const emptyFields = validateFieldsForAction(action);
    if (emptyFields.length > 0) {
      const names = emptyFields.map((f) => f.label).join(", ");
      throw new Error(`다음 필수 필드를 입력해주세요: ${names}`);
    }

    const currentUserName =
      localStorage.getItem("userName") ||
      localStorage.getItem("displayName") ||
      "";

    // schedules 테이블 담당자 메타
    const userMeta: any = {};

    if (!isEditMode && ["temp", "request", "approve"].includes(action)) {
      userMeta.created_by_id = modalUserId;
      userMeta.created_by_name = currentUserName;
    }

    // ✅ 승인자 메타는 "승인" 계열에서만
    if (["approve", "approve_modification"].includes(action)) {
      userMeta.approved_by_id = modalUserId;
      userMeta.approved_by_name = currentUserName;
    }

    // ✅ modify_approve(저장/수정반영)는 승인자 메타를 찍지 않음
    if (["cancel", "cancel_approve"].includes(action)) {
      userMeta.cancelled_by_id = modalUserId;
      userMeta.cancelled_by_name = currentUserName;
    }
    if (["delete", "delete_approve"].includes(action)) {
      userMeta.deleted_by_id = modalUserId;
      userMeta.deleted_by_name = currentUserName;
    }

    const formDataWithUser = {
      ...formData,
      changed_by: modalUserId,
      changed_by_name: currentUserName,
      ...userMeta,

      currentUserId: modalUserId,
      reason: reason || "",
      schedule_id: initialData?.scheduleData?.id || null,
      professor_category_name: selectedProfessorInfo?.category_name || null,
      professor_category_id: selectedProfessorInfo?.id || null,
      tracking_status: scheduleData?.tracking_status ?? null,
    };

    const result = await onSave(formDataWithUser, action);
    setMessage(result.message);

    if (result.success) {
      // ✅ modify_approve에서 메시지 굳이 alert 싫으면 여기서 분기 가능
      alert(result.message);
      onClose();
      setMessage("");
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "처리 중 오류가 발생했습니다.";
    setMessage(msg);
    alert(msg);
    console.error("저장 오류:", e);
  } finally {
    setSaving(false);
  }
};


  const handleRequestWithReason = (reason: string) => {
    setReasonModalOpen(false);
    const map = {
      modify: "modify_request",
      cancel: "cancel_request",
      delete: "delete_request",
    } as const;
    handleSave(map[requestType], reason);
  };

  const generateTimeOptions = () => {
    const options: string[] = [];
    for (let h = 7; h <= 22; h++) {
      for (let m = 0; m < 60; m += 5) {
        options.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      }
    }
    return options;
  };
  const timeOptions = generateTimeOptions();

  const academyShootingTypes = [
    "촬영",
    "중계",
    "(본사)촬영",
    "라이브촬영",
    "라이브중계",
    "(NAS)촬영",
  ];

  // ✅ 버튼 렌더링 (요구사항 표 기반)
  const renderActionButtons = () => {
    const id = scheduleData?.id ?? null;

    const roleFromStorage =
      typeof window !== "undefined" ? localStorage.getItem("userRole") || "" : "";
    const isAdmin = permissions.roleType === "admin";
    const isAcademyManager =
      roleFromStorage === "academy_manager" || permissions.roleType === "manager";

    const status = String(currentStatus || "").trim();
    const track = String(tracking || "").trim();

    const leftButtons: JSX.Element[] = [];
    const rightButtons: JSX.Element[] = [];

    const btnBase: React.CSSProperties = {
      padding: "8px 14px",
      borderRadius: 6,
      border: "1px solid #d1d5db",
      background: "white",
      cursor: "pointer",
      fontSize: 13,
      fontWeight: 800,
    };
    const btnPrimary: React.CSSProperties = {
      ...btnBase,
      border: "none",
      background: "#2563eb",
      color: "white",
    };
    const btnDanger: React.CSSProperties = {
      ...btnBase,
      border: "none",
      background: "#dc2626",
      color: "white",
    };
    const btnSecondary: React.CSSProperties = {
      ...btnBase,
      background: "#f3f4f6",
    };

    // -----------------------------
    // 신규(id 없음)
    // -----------------------------
    if (!id) {
      if (isAdmin) {
        rightButtons.push(
          <button
            key="temp_new_admin"
            onClick={() => handleSave("temp")}
            style={btnSecondary}
            disabled={saving || userIdLoading}
          >
            임시저장
          </button>
        );
        rightButtons.push(
          <button
            key="approve_new_admin"
            onClick={() => handleSave("approve")}
            style={btnPrimary}
            disabled={saving || userIdLoading}
          >
            저장(즉시승인)
          </button>
        );
      } else {
        // academy_manager
        rightButtons.push(
          <button
            key="temp_new"
            onClick={() => handleSave("temp")}
            style={btnSecondary}
            disabled={saving || userIdLoading}
          >
            임시저장
          </button>
        );
        rightButtons.push(
          <button
            key="request_new"
            onClick={() => handleSave("request")}
            style={btnPrimary}
            disabled={saving || userIdLoading}
          >
            승인요청
          </button>
        );
      }
      return { leftButtons, rightButtons };
    }

    // -----------------------------
    // academy_manager: 임시저장 단계(id 있음) → 삭제 + 승인요청
    // -----------------------------
    
    const isTempStageLocal = status === "pending" || status === "temp";
    if (isAcademyManager && isTempStageLocal && !isInactive) {
      leftButtons.push(
        <button
          key="delete_temp"
          onClick={() => {
            if (!confirm("임시저장 스케줄을 삭제할까요?")) return;
            handleSave("delete");
          }}
          style={btnDanger}
          disabled={saving || userIdLoading}
        >
          삭제
        </button>
      );
      rightButtons.push(
        <button
          key="request_temp"
          onClick={() => handleSave("request")}
          style={btnPrimary}
          disabled={saving || userIdLoading}
        >
          승인요청
        </button>
      );
    }

    // -----------------------------
// ✅ admin: 임시저장 단계(id 있음: pending/temp) → 저장(즉시승인) + 승인요청(선택) + 삭제(선택)
// -----------------------------
if (isAdmin && isTempStageLocal && !isInactive) {
  // 관리자: 바로 승인 저장
  rightButtons.push(
    <button
      key="admin_approve_from_temp"
      onClick={() => handleSave("approve")}
      style={btnPrimary}
      disabled={saving || userIdLoading}
    >
      저장(즉시승인)
    </button>
  );

  // 관리자: 그냥 pending 상태로 저장만(유지)하고 싶으면 temp도 허용
  rightButtons.push(
    <button
      key="admin_temp_save"
      onClick={() => handleSave("temp")}
      style={btnSecondary}
      disabled={saving || userIdLoading}
    >
      임시저장
    </button>
  );

  // 관리자: 임시저장 단계 삭제는 “카드 삭제”가 자연스러움
  leftButtons.push(
    <button
      key="admin_delete_temp"
      onClick={() => {
        if (!confirm("임시저장 스케줄을 삭제할까요?")) return;
        handleSave("delete");
      }}
      style={btnDanger}
      disabled={saving || userIdLoading}
    >
      삭제
    </button>
  );
}


    // -----------------------------
    // academy_manager: 승인요청 상태 → 철회만(대기)
    // -----------------------------
    if (isAcademyManager && status === "approval_requested" && !isInactive) {
      rightButtons.push(
        <button
          key="request_withdraw"
          onClick={() => {
            if (!confirm("승인요청을 철회할까요?")) return;
            handleSave("request_withdraw");
          }}
          style={btnSecondary}
          disabled={saving || userIdLoading}
        >
          승인요청 철회
        </button>
      );
    }

    // -----------------------------
    // admin: 승인요청 상태 → 승인
    // -----------------------------
    if (isAdmin && status === "approval_requested" && !isInactive) {
      rightButtons.push(
        <button
          key="approve"
          onClick={() => handleSave("approve")}
          style={btnPrimary}
          disabled={saving || userIdLoading}
        >
          승인
        </button>
      );
    }

    // -----------------------------
    // admin: 수정요청 상태 → 수정권한 승인
    // -----------------------------
    if (isAdmin && status === "modification_requested" && !isInactive) {
      rightButtons.push(
        <button
          key="approve_modification"
          onClick={() => handleSave("approve_modification")}
          style={btnPrimary}
          disabled={saving || userIdLoading}
        >
          수정승인
        </button>
      );
    }

    // -----------------------------
    // manager: 수정권한 승인(modification_approved) → 수정 후 "수정반영"
    // -----------------------------
    if (isAcademyManager && status === "modification_approved" && !isInactive) {
      rightButtons.push(
        <button
          key="modify_apply"
          onClick={() => handleSave("modify_approve")}
          style={btnPrimary}
          disabled={saving || userIdLoading}
        >
          수정반영
        </button>
      );
    }

    // -----------------------------
    // admin: 취소요청/삭제요청 → 승인(완료 처리)
    // -----------------------------
    if (isAdmin && status === "cancellation_requested" && !isInactive) {
      rightButtons.push(
        <button
          key="cancel_approve"
          onClick={() => handleSave("cancel_approve")}
          style={btnDanger}
          disabled={saving || userIdLoading}
        >
          취소승인
        </button>
      );
    }
    if (isAdmin && status === "deletion_requested" && !isInactive) {
      rightButtons.push(
        <button
          key="delete_approve"
          onClick={() => handleSave("delete_approve")}
          style={btnDanger}
          disabled={saving || userIdLoading}
        >
          삭제승인
        </button>
      );
    }

    // -----------------------------
    // ✅ admin: 승인완료/확정이면 tracking과 무관하게 "항상" 저장/취소/삭제 + (옵션)크로스체크요청
    // -----------------------------
    if (isAdmin && ["approved", "confirmed"].includes(status) && !isInactive) {
      rightButtons.push(
      <button
        key="admin_save"
        onClick={() => handleSave("approve")}
        style={btnPrimary}
        disabled={saving || userIdLoading}
      >
        저장
      </button>

      );

      leftButtons.push(
        <button
          key="admin_cancel"
          onClick={() => {
            if (!confirm("스케줄을 취소할까요?")) return;
            handleSave("cancel");
          }}
          style={btnDanger}
          disabled={saving || userIdLoading}
        >
          취소
        </button>
      );

      leftButtons.push(
        <button
          key="admin_delete"
          onClick={() => {
            if (!confirm("스케줄을 삭제할까요?")) return;
            handleSave("delete");
          }}
          style={btnDanger}
          disabled={saving || userIdLoading}
        >
          삭제
        </button>
      );

      const canAskCrosscheck =
        !track || track === "scheduled" || track === "null";

      if (canAskCrosscheck) {
        rightButtons.push(
          <button
            key="crosscheck_req"
            onClick={() => handleSave("crosscheck_req")}
            style={btnSecondary}
            disabled={saving || userIdLoading}
          >
            크로스체크요청
          </button>
        );
      }
    }

    // -----------------------------
    // ✅ manager: 크로스체크 요청 상태 → 확인 버튼만
    // -----------------------------
    if (isAcademyManager && track === "crosscheck_req" && !isInactive) {
      rightButtons.push(
        <button
          key="crosscheck_ok"
          onClick={() => handleSave("crosscheck_ok")}
          style={btnPrimary}
          disabled={saving || userIdLoading}
        >
          크로스체크 확인
        </button>
      );
    }

    // -----------------------------
    // ✅ manager: 승인완료 or 크로스체크완료 이후 요청 버튼 유지
    // (단, crosscheck_req 대기 중이면 요청 버튼 대신 확인만 노출되게 위에서 처리)
    // -----------------------------
    if (
      isAcademyManager &&
      id &&
      ["approved", "confirmed"].includes(status) &&
      !isInactive &&
      track !== "crosscheck_req"
    ) {
      rightButtons.push(
        <button
          key="modify_request"
          onClick={() => {
            setRequestType("modify");
            setReasonModalOpen(true);
          }}
          style={btnSecondary}
          disabled={saving || userIdLoading}
        >
          수정요청
        </button>
      );
      rightButtons.push(
        <button
          key="cancel_request"
          onClick={() => {
            setRequestType("cancel");
            setReasonModalOpen(true);
          }}
          style={btnSecondary}
          disabled={saving || userIdLoading}
        >
          취소요청
        </button>
      );
      rightButtons.push(
        <button
          key="delete_request"
          onClick={() => {
            setRequestType("delete");
            setReasonModalOpen(true);
          }}
          style={btnDanger}
          disabled={saving || userIdLoading}
        >
          삭제요청
        </button>
      );
    }

    return { leftButtons, rightButtons };
  };

  // ✅ ESC로 닫기 + 배경 클릭 닫기용 (open일 때만)
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const { leftButtons, rightButtons } = renderActionButtons();

  return (
    <>
      <div
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}
      >
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            backgroundColor: "white",
            borderRadius: 12,
            width: 1200,
            maxWidth: "95vw",
            height: 800,
            maxHeight: "90vh",
            overflow: "hidden",
            boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* 헤더 */}
          <div
            style={{
              padding: "20px 24px",
              borderBottom: "1px solid #E5E7EB",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: "bold", color: "#111827" }}>
              {isEditMode ? "학원 스케줄 수정" : "학원 스케줄 등록"}
            </h2>
            <button
              onClick={onClose}
              disabled={saving}
              style={{
                background: "none",
                border: "none",
                fontSize: 24,
                cursor: saving ? "not-allowed" : "pointer",
                padding: 0,
                color: "#6b7280",
                opacity: saving ? 0.5 : 1,
              }}
            >
              ×
            </button>
          </div>

          {/* 본문 */}
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            {/* 좌측 폼 */}
            <div
              style={{
                flex: "0 0 50%",
                padding: 24,
                overflowY: "auto",
                borderRight: "1px solid #E5E7EB",
              }}
            >
              {/* 안내/상태 배너 */}
              {permissions.roleType === "manager" && isModificationInProgress && (
                <div
                  style={{
                    marginBottom: 16,
                    padding: 12,
                    backgroundColor: "#fffbeb",
                    color: "#92400e",
                    fontSize: 14,
                    borderRadius: 6,
                    border: "1px solid #f59e0b",
                  }}
                >
                  🔄 <strong>수정 권한 부여됨</strong> - 내용을 수정한 후{" "}
                  <strong>수정반영</strong>을 클릭하세요.
                </div>
              )}

              {permissions.roleType === "manager" &&
                fieldDisabled &&
                isAfterApproval &&
                !isModificationInProgress &&
                !isInactive && (
                  <div
                    style={{
                      marginBottom: 16,
                      padding: 12,
                      backgroundColor: "#fef3c7",
                      color: "#92400e",
                      fontSize: 14,
                      borderRadius: 6,
                      border: "1px solid #fbbf24",
                    }}
                  >
                    ⚠️ 승인된 스케줄은 직접 수정할 수 없습니다.{" "}
                    <strong>수정요청</strong>을 사용해주세요.
                  </div>
                )}

              {permissions.roleType === "manager" && isModificationRequested && (
                <div
                  style={{
                    marginBottom: 16,
                    padding: 12,
                    backgroundColor: "#f3e8ff",
                    color: "#6b21a8",
                    fontSize: 14,
                    borderRadius: 6,
                    border: "1px solid #8b5cf6",
                  }}
                >
                  ⏳ 수정요청 대기 중 - 관리자 승인을 기다리고 있습니다.
                </div>
              )}

              {permissions.roleType === "admin" &&
                currentStatus === "modification_requested" && (
                  <div
                    style={{
                      marginBottom: 16,
                      padding: 12,
                      backgroundColor: "#f3e8ff",
                      color: "#6b21a8",
                      fontSize: 14,
                      borderRadius: 6,
                      border: "1px solid #8b5cf6",
                    }}
                  >
                    📋 <strong>수정 요청됨</strong> - 매니저가 수정요청을 보냈습니다.
                  </div>
                )}

              {isInactive && (
                <div
                  style={{
                    marginBottom: 16,
                    padding: 12,
                    backgroundColor: "#fef2f2",
                    color: "#dc2626",
                    fontSize: 14,
                    borderRadius: 6,
                    border: "1px solid #fecaca",
                  }}
                >
                  이 스케줄은 {currentStatus === "cancelled" ? "취소완료" : "삭제완료"} 되었습니다.
                  수정할 수 없습니다.
                </div>
              )}

              {userIdLoading && (
                <div
                  style={{
                    marginBottom: 16,
                    padding: 12,
                    backgroundColor: "#eff6ff",
                    color: "#1e40af",
                    fontSize: 14,
                    borderRadius: 6,
                    border: "1px solid #bfdbfe",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      border: "2px solid #bfdbfe",
                      borderTop: "2px solid #1e40af",
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite",
                    }}
                  />
                  사용자 매핑 중...
                </div>
              )}

              {/* 요청 사유 표시(요청 상태에서만) */}
              {isEditMode && scheduleData && (
                <div>
                  {scheduleData.modification_reason && isModificationRequested && (
                    <div
                      style={{
                        padding: 12,
                        backgroundColor: "#faf5ff",
                        border: "1px solid #8b5cf6",
                        borderRadius: 6,
                        marginBottom: 12,
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: "bold", color: "#8b5cf6", marginBottom: 4 }}>
                        📝 수정 요청 사유
                      </div>
                      <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.4 }}>
                        {scheduleData.modification_reason}
                      </div>
                    </div>
                  )}
                  {scheduleData.cancellation_reason && isCancellationInProgress && (
                    <div
                      style={{
                        padding: 12,
                        backgroundColor: "#fffbeb",
                        border: "1px solid #f59e0b",
                        borderRadius: 6,
                        marginBottom: 12,
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: "bold", color: "#f59e0b", marginBottom: 4 }}>
                        ❌ 취소 요청 사유
                      </div>
                      <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.4 }}>
                        {scheduleData.cancellation_reason}
                      </div>
                    </div>
                  )}
                  {scheduleData.deletion_reason && isDeletionInProgress && (
                    <div
                      style={{
                        padding: 12,
                        backgroundColor: "#fef2f2",
                        border: "1px solid #dc2626",
                        borderRadius: 6,
                        marginBottom: 12,
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: "bold", color: "#dc2626", marginBottom: 4 }}>
                        🗑️ 삭제 요청 사유
                      </div>
                      <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.4 }}>
                        {scheduleData.deletion_reason}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 폼 */}
              <div>
                {/* 날짜 */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 800, color: "#374151" }}>
                    촬영 날짜 <span style={{ color: "#ef4444" }}>*</span>
                  </label>

                  {permissions.roleType === "manager" && !isEditMode && isScheduleLocked && (
                    <div
                      style={{
                        marginBottom: 8,
                        padding: 10,
                        borderRadius: 6,
                        backgroundColor: "#fef3c7",
                        border: "1px solid #fbbf24",
                        fontSize: 12,
                        color: "#92400e",
                      }}
                    >
                      이번 주 화요일 17시 이후로 차주 스케줄 입력이 마감되었습니다.
                      <br />
                      변경이 필요하면 관리자에게 요청해주세요.
                    </div>
                  )}

                  <div
                    style={{
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid #e5e7eb",
                      backgroundColor: "#f9fafb",
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    {formatKoreanDate(formData.shoot_date)}
                  </div>
                </div>

                {/* 시간 */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                    marginBottom: 20,
                  }}
                >
                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 800, color: "#374151" }}>
                      시작 시간 <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <select
                      value={formData.start_time}
                      onChange={(e) => handleChange("start_time", e.target.value)}
                      disabled={fieldDisabled}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        border: "1px solid #d1d5db",
                        borderRadius: 6,
                        fontSize: 14,
                        outline: "none",
                        backgroundColor: fieldDisabled ? "#f9fafb" : "white",
                      }}
                    >
                      <option value="">시작 시간 선택</option>
                      {timeOptions.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 800, color: "#374151" }}>
                      종료 시간 <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <select
                      value={formData.end_time}
                      onChange={(e) => handleChange("end_time", e.target.value)}
                      disabled={fieldDisabled}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        border: "1px solid #d1d5db",
                        borderRadius: 6,
                        fontSize: 14,
                        outline: "none",
                        backgroundColor: fieldDisabled ? "#f9fafb" : "white",
                      }}
                    >
                      <option value="">종료 시간 선택</option>
                      {timeOptions.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 교수 / 강의명 */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                    marginBottom: 20,
                  }}
                >
                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 800, color: "#374151" }}>
                      교수명 <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <ProfessorAutocomplete
                      value={formData.professor_name}
                      onChange={handleProfessorChange}
                      placeholder="교수명을 입력하면 자동완성됩니다"
                      disabled={fieldDisabled}
                      required
                      style={{
                        backgroundColor: fieldDisabled ? "#f9fafb" : "white",
                      }}
                    />
                    {(selectedProfessorInfo?.category_name || formData.professor_category_name) && (
                      <p style={{ color: "#059669", fontSize: 12, margin: "6px 0 0 0", fontWeight: 700 }}>
                        ✓ 매칭됨: {selectedProfessorInfo?.category_name || formData.professor_category_name}
                      </p>
                    )}
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 800, color: "#374151" }}>
                      강의명
                    </label>
                    <input
                      type="text"
                      value={formData.course_name}
                      onChange={(e) => handleChange("course_name", e.target.value)}
                      disabled={fieldDisabled}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        border: "1px solid #d1d5db",
                        borderRadius: 6,
                        fontSize: 14,
                        outline: "none",
                        backgroundColor: fieldDisabled ? "#f9fafb" : "white",
                      }}
                    />
                  </div>
                </div>

                {/* 강의코드 / 촬영형식 */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                    marginBottom: 20,
                  }}
                >
                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 800, color: "#374151" }}>
                      강의코드
                    </label>
                    <input
                      type="text"
                      value={formData.course_code}
                      onChange={(e) => handleChange("course_code", e.target.value)}
                      disabled={fieldDisabled}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        border: "1px solid #d1d5db",
                        borderRadius: 6,
                        fontSize: 14,
                        outline: "none",
                        backgroundColor: fieldDisabled ? "#f9fafb" : "white",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 800, color: "#374151" }}>
                      촬영형식 <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <select
                      value={formData.shooting_type}
                      onChange={(e) => handleChange("shooting_type", e.target.value)}
                      disabled={fieldDisabled}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        border: "1px solid #d1d5db",
                        borderRadius: 6,
                        fontSize: 14,
                        outline: "none",
                        backgroundColor: fieldDisabled ? "#f9fafb" : "white",
                      }}
                    >
                      {academyShootingTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 강의실(텍스트 표시) */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 800, color: "#374151" }}>
                    강의실 <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <div
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "1px solid #e5e7eb",
                      borderRadius: 6,
                      backgroundColor: "#f9fafb",
                      fontSize: 13,
                      fontWeight: 800,
                      color: "#111827",
                    }}
                    title={String(formData.sub_location_id || "")}
                  >
                    {getLocationLabel()}
                  </div>
                  <input type="hidden" value={formData.sub_location_id} readOnly />
                </div>

                {/* 비고 */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 800, color: "#374151" }}>
                    비고
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => handleChange("notes", e.target.value)}
                    disabled={fieldDisabled}
                    rows={3}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #d1d5db",
                      borderRadius: 6,
                      fontSize: 14,
                      outline: "none",
                      backgroundColor: fieldDisabled ? "#f9fafb" : "white",
                      resize: "vertical",
                      minHeight: 60,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* 우측 이력 */}
            <div
              style={{
                flex: "0 0 50%",
                display: "flex",
                flexDirection: "column",
                backgroundColor: "#f8fafc",
              }}
            >
              <div
                style={{
                  padding: "20px 24px 16px",
                  borderBottom: "1px solid #e5e7eb",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "#374151" }}>
                  처리 이력
                </h3>
                {scheduleHistory.length > 0 && (
                  <span
                    style={{
                      fontSize: 10,
                      backgroundColor: "#e5e7eb",
                      color: "#6b7280",
                      padding: "2px 6px",
                      borderRadius: 999,
                      fontWeight: 900,
                    }}
                  >
                    {scheduleHistory.length}
                  </span>
                )}
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
                {isEditMode && initialData?.scheduleData?.id ? (
                  loadingHistory ? (
                    <div style={{ padding: 16, textAlign: "center", color: "#6b7280", fontSize: 12 }}>
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          border: "2px solid #e5e7eb",
                          borderTop: "2px solid #3b82f6",
                          borderRadius: "50%",
                          animation: "spin 1s linear infinite",
                          margin: "0 auto 6px",
                        }}
                      />
                      히스토리를 불러오는 중...
                    </div>
                  ) : scheduleHistory.length === 0 ? (
                    <div
                      style={{
                        padding: 16,
                        textAlign: "center",
                        color: "#9ca3af",
                        fontSize: 12,
                        backgroundColor: "#f9fafb",
                        borderRadius: 6,
                        border: "1px dashed #d1d5db",
                      }}
                    >
                      변경 기록이 없습니다
                    </div>
                  ) : (
                    <div style={{ flex: 1, paddingRight: 6 }}>
                      {scheduleHistory.map((historyItem: any, index: number) => {
                        const isRequest = String(historyItem.action || "").includes("요청");
                        const hasReason =
                          historyItem.reason && String(historyItem.reason).trim() !== "";
                        const hasDetails =
                          historyItem.details && String(historyItem.details).trim() !== "";

                        return (
                          <div
                            key={historyItem.id || index}
                            style={{
                              padding: 12,
                              borderBottom:
                                index < scheduleHistory.length - 1 ? "1px solid #e5e7eb" : "none",
                              backgroundColor: index % 2 === 0 ? "white" : "#f9fafb",
                              borderRadius: 8,
                              marginBottom: 10,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "flex-start",
                                marginBottom: 8,
                              }}
                            >
                              <span style={{ fontSize: 12, fontWeight: 900, color: "#111827" }}>
                                {historyItem.action}
                              </span>
                              <span style={{ fontSize: 10, color: "#6b7280", fontWeight: 800 }}>
                                {formatDateTime(historyItem.created_at)}
                              </span>
                            </div>

                            <div style={{ fontSize: 11, lineHeight: 1.35 }}>
                              <div style={{ marginBottom: 6 }}>
                                <span style={{ fontWeight: 900, color: "#374151" }}>
                                  {isRequest ? "요청자:" : "처리자:"}
                                </span>
                                <span style={{ marginLeft: 8, color: "#6b7280", fontWeight: 800 }}>
                                  {historyItem.changed_by}
                                </span>
                              </div>

                              {hasReason && (
                                <div style={{ marginBottom: 6 }}>
                                  <span style={{ fontWeight: 900, color: "#374151" }}>사유:</span>
                                  <span style={{ marginLeft: 8, color: "#6b7280", fontWeight: 800 }}>
                                    {historyItem.reason}
                                  </span>
                                </div>
                              )}

                              {hasDetails && (
                                <div>
                                  <span style={{ fontWeight: 900, color: "#374151" }}>변경:</span>
                                  <div
                                    style={{
                                      marginTop: 6,
                                      padding: 10,
                                      borderRadius: 8,
                                      background: "#f8fafc",
                                      border: "1px solid #e5e7eb",
                                      color: "#374151",
                                      whiteSpace: "pre-line",
                                      fontWeight: 800,
                                    }}
                                  >
                                    {historyItem.details}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  <div style={{ textAlign: "center", color: "#6b7280", fontSize: 14, padding: "40px 20px" }}>
                    스케줄 저장 후 처리 이력이 표시됩니다.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 메시지 */}
          {message && (
            <div
              style={{
                margin: "0 24px 16px",
                padding: 12,
                borderRadius: 6,
                backgroundColor:
                  message.includes("오류") || message.includes("실패") ? "#fef2f2" : "#f0fdf4",
                color:
                  message.includes("오류") || message.includes("실패") ? "#dc2626" : "#166534",
                fontSize: 14,
                border: `1px solid ${
                  message.includes("오류") || message.includes("실패") ? "#fecaca" : "#bbf7d0"
                }`,
                flexShrink: 0,
                fontWeight: 800,
              }}
            >
              {message}
            </div>
          )}

          {/* 푸터 버튼 */}
          <div
            style={{
              padding: 16,
              borderTop: "1px solid #E5E7EB",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexShrink: 0,
              backgroundColor: "white",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {(saving || userIdLoading) && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 8 }}>
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      border: "2px solid #d1d5db",
                      borderTop: "2px solid #059669",
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite",
                    }}
                  />
                  <span style={{ fontSize: 14, color: "#6b7280", fontWeight: 800 }}>
                    {userIdLoading ? "사용자 매핑 중..." : "처리 중..."}
                  </span>
                </div>
              )}
              {leftButtons}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {rightButtons}
            </div>
          </div>
        </div>

        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>

      <ReasonModal
        open={reasonModalOpen}
        type={requestType}
        onClose={() => setReasonModalOpen(false)}
        onSubmit={handleRequestWithReason}
      />
    </>
  );
}
