"use client";
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../utils/supabaseClient";
import { ProfessorAutocomplete } from "../ProfessorAutocomplete";

/**
 * StudioScheduleModal (FULL VERSION)
 * -------------------------------------------------------------
 * ✅ 무엇이 바뀌었나
 * 1) 교수 자동완성 선택 시, 카테고리/교수ID를 상태+formData에 동시에 고정 저장
 *    - UI 하단에 항상 "매칭됨: 카테고리명" 배지 고정 노출 (저장 후 재오픈해도 보임)
 *    - onSave 호출 시 professor_id, professor_category_name 함께 전달
 * 2) 기존 구조와 스타일을 유지하면서 누락되던 필드/가드 및 로깅을 보강
 * 3) History(처리 이력)는 schedule_history 테이블을 그대로 사용 (필요시 주석 해제)
 * -------------------------------------------------------------
 */

export type StudioAction =
  | "temp"
  | "request"
  | "approve"
  | "modify_request"
  | "approve_modification"
  | "modify_approve"
  | "cancel_request"
  | "cancel_approve"
  | "delete_request"
  | "delete_approve"
  | "cancel"
  | "delete"
  | "cancel_cancel"
  | "cancel_delete";

interface StudioScheduleModalProps {
  open: boolean;
  onClose: () => void;
  /**
   * initialData 예시
   * {
   *   date: "2025-10-28",
   *   locationId: 12,
   *   scheduleData?: {
   *     id: number,
   *     shoot_date: string,
   *     start_time: string,
   *     end_time: string,
   *     professor_name: string,
   *     course_name: string,
   *     shooting_type: string,
   *     notes?: string,
   *     sub_location_id: number,
   *     approval_status: string,
   *     is_active: boolean,
   *     // ⬇️ 새로 저장/복원할 수 있는 필드 (있으면 사용)
   *     professor_id?: number,
   *     professor_category_name?: string,
   *   }
   * }
   */
  initialData?: any;
  /** 스튜디오 서브로케이션들 */
  locations: Array<{
    id: number;
    name: string;
    main_location_id?: number;
    main_locations?: { id: number; name: string; location_type?: string };
    displayName?: string;
  }>;
  userRole: string;
  /** DB 저장은 상위에서 처리. 본 컴포넌트는 formData 구성/검증만 담당 */
  onSave: (
    data: any,
    action: StudioAction
  ) => Promise<{ success: boolean; message: string }>;
}

// ─────────────────────────────────────────────────────────────
// 유틸: 숫자형 시간 배열 생성 (07:00 ~ 22:55, 5분 단위)
// ─────────────────────────────────────────────────────────────
const buildTimeOptions = () => {
  const arr: string[] = [];
  for (let h = 7; h <= 22; h++) {
    for (let m = 0; m < 60; m += 5) {
      arr.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return arr;
};

// 스튜디오 촬영 형식(예시)
const studioShootingTypes = [
  "PPT",
  "빔판서(PPT)",
  "전자칠판",
  "크로마키",
  "PC와콤",
  "PC",
  "일반칠판",
  "웹캠",
  "라이브",
  "태블릿",
  "녹화",
  "스마트폰",
];

// ─────────────────────────────────────────────────────────────
// 임시 히스토리 뷰 (필요 없으면 삭제/주석)
// ─────────────────────────────────────────────────────────────
const HistoryPanel = ({ scheduleId }: { scheduleId?: number }) => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!scheduleId) return;
      setLoading(true);
      try {
        // 실제로 사용하는 테이블/뷰에 맞춰 수정하세요
        const { data, error } = await supabase
          .from("schedule_history")
          .select("*")
          .eq("schedule_id", scheduleId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        setItems(data || []);
      } catch (e) {
        console.error("❌ 히스토리 조회 오류", e);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [scheduleId]);

  if (!scheduleId) return (
    <div style={{ color: "#6b7280", fontSize: 14 }}>저장 후 이력이 표시됩니다.</div>
  );

  if (loading) return (
    <div style={{ color: "#6b7280", fontSize: 14 }}>히스토리 로딩 중…</div>
  );

  if (!items.length) return (
    <div style={{ color: "#6b7280", fontSize: 14 }}>변경 이력이 없습니다.</div>
  );

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {items.map((it) => (
        <div key={it.id} style={{
          background: "#F9FAFB",
          border: "1px solid #E5E7EB",
          borderRadius: 8,
          padding: 12,
        }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{it.change_type}</div>
          <div style={{ color: "#6b7280", fontSize: 12 }}>{new Date(it.created_at).toLocaleString()}</div>
          {it.description && (
            <div style={{ marginTop: 6, fontSize: 13 }}>{it.description}</div>
          )}
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// 본 컴포넌트
// ─────────────────────────────────────────────────────────────
export default function StudioScheduleModal({
  open,
  onClose,
  initialData,
  locations,
  userRole,
  onSave,
}: StudioScheduleModalProps) {
  // 저장 및 메시지
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // 사용자 ID (상위 AuthContext에서 넣어주지 않는다면 localStorage로 폴백)
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [userIdLoading, setUserIdLoading] = useState(true);

  // 교수 자동완성 선택 결과(고정 표시용)
  const [selectedProfessorInfo, setSelectedProfessorInfo] = useState<
    | { id?: number; category_name?: string }
    | null
  >(null);

  // 폼 데이터
  const [formData, setFormData] = useState<any>(() => {
    const s = initialData?.scheduleData;
    const isEdit = !!s?.id;
    return {
      shoot_date: (isEdit ? s?.shoot_date : initialData?.date) || "",
      start_time: (isEdit ? normalizeTime(s?.start_time) : "") || "",
      end_time: (isEdit ? normalizeTime(s?.end_time) : "") || "",
      professor_name: (isEdit ? (s?.professor_name || "") : "") || "",
      course_name: (isEdit ? (s?.course_name || "") : "") || "",
      shooting_type: (isEdit ? (s?.shooting_type || "PPT") : "PPT") || "PPT",
      notes: (isEdit ? (s?.notes || "") : "") || "",
      sub_location_id: String(
        isEdit ? s?.sub_location_id ?? "" : initialData?.locationId ?? ""
      ),
      // ⬇️ 새 필드: 저장/복원용
      professor_id: isEdit ? s?.professor_id ?? null : null,
      professor_category_name: isEdit ? s?.professor_category_name ?? "" : "",
    };
  });

  const isEditMode = !!initialData?.scheduleData?.id;
  const currentStatus: string = initialData?.scheduleData?.approval_status || "pending";
  const isInactive = initialData?.scheduleData?.is_active === false;

  // time option memo
  const timeOptions = useMemo(buildTimeOptions, []);

  // 사용자 ID 매핑 (간단 폴백)
  useEffect(() => {
    if (!open) return;
    const run = async () => {
      setUserIdLoading(true);
      try {
        const v = localStorage.getItem("userId");
        if (v && v !== "null" && v !== "undefined") {
          const n = Number(v);
          if (!Number.isNaN(n) && n > 0) {
            setCurrentUserId(n);
            return;
          }
        }
        // supabase auth → user_profiles 연결 (있다면)
        const { data: auth } = await supabase.auth.getUser();
        const id = auth?.user?.id;
        if (id) {
          const { data: profile } = await supabase
            .from("user_profiles")
            .select("id")
            .eq("auth_user_id", id)
            .maybeSingle();
          if (profile?.id) {
            localStorage.setItem("userId", String(profile.id));
            setCurrentUserId(profile.id);
            return;
          }
        }
        setCurrentUserId(1); // 최후 폴백
      } catch (e) {
        console.warn("⚠️ 사용자 ID 매핑 실패. 폴백 사용", e);
        setCurrentUserId(1);
      } finally {
        setUserIdLoading(false);
      }
    };
    run();
  }, [open]);

  // 모달 열릴 때 기존 데이터로 교수 배지 복원
  useEffect(() => {
    if (!open) return;
    const s = initialData?.scheduleData;
    if (s?.professor_id || s?.professor_category_name) {
      setSelectedProfessorInfo({
        id: s.professor_id ?? undefined,
        category_name: s.professor_category_name ?? "",
      });
    } else {
      // 기존 스케줄이 아니더라도, 이미 formData에 세팅된 값이 있으면 반영
      if (formData.professor_id || formData.professor_category_name) {
        setSelectedProfessorInfo({
          id: formData.professor_id ?? undefined,
          category_name: formData.professor_category_name ?? "",
        });
      } else {
        setSelectedProfessorInfo(null);
      }
    }
  }, [open, initialData?.scheduleData?.id]);

  // ESC로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open && !saving) onClose();
    };
    if (open) {
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }
  }, [open, saving, onClose]);

  // ────────────────────────────────────────────────────────────
  // 헬퍼들
  // ────────────────────────────────────────────────────────────
  function normalizeTime(v?: string) {
    if (!v) return "";
    const s = String(v);
    if (s.includes(":")) {
      const [hh = "", mm = ""] = s.split(":");
      return `${hh.padStart(2, "0")}:${mm.padStart(2, "0")}`;
    }
    return s;
  }

  const fieldDisabled = useMemo(() => {
    if (saving || userIdLoading || isInactive) return true;
    // 관리자면 항상 수정 가능
    if (["system_admin", "schedule_admin", "studio_manager"].includes(userRole)) return false;
    // 그 외 권한 정책이 있다면 이곳에서 제어
    if (["approved", "confirmed"].includes(currentStatus)) return true; // 일반 사용자는 승인 후 수정 불가
    return false;
  }, [saving, userIdLoading, isInactive, userRole, currentStatus]);

  const setVal = (field: string, value: any) =>
    setFormData((p: any) => ({ ...p, [field]: value }));

  // 교수 자동완성 선택 핸들러
  const handleProfessorChange = (textValue: string, professor?: any) => {
    setVal("professor_name", textValue);
    if (professor) {
      const pid = professor.id ?? null;
      const cat = professor.category_name ?? "";
      setSelectedProfessorInfo({ id: pid ?? undefined, category_name: cat });
      // ⬇️ 폼 데이터에도 즉시 반영 → 저장/통계 활용 가능
      setFormData((prev: any) => ({
        ...prev,
        professor_id: pid,
        professor_category_name: cat,
      }));
    } else {
      setSelectedProfessorInfo(null);
      setFormData((prev: any) => ({
        ...prev,
        professor_id: null,
        professor_category_name: "",
      }));
    }
  };

  // 필수값 체크 (관리자/일반 공통)
  const validateRequired = (action: StudioAction) => {
    const skip: StudioAction[] = [
      "modify_request",
      "cancel_request",
      "delete_request",
      "cancel_approve",
      "delete_approve",
      "cancel",
      "delete",
      "cancel_cancel",
      "cancel_delete",
    ];
    if (skip.includes(action)) return [];

    const req = [
      { key: "shoot_date", label: "촬영 날짜" },
      { key: "start_time", label: "시작 시간" },
      { key: "end_time", label: "종료 시간" },
      { key: "professor_name", label: "교수명" },
      { key: "shooting_type", label: "촬영형식" },
      { key: "sub_location_id", label: "스튜디오" },
    ];

    return req.filter((r) => !String(formData[r.key] ?? "").trim());
  };

  const handleSave = async (action: StudioAction, reason?: string) => {
    if (userIdLoading) {
      setMessage("사용자 정보를 확인 중입니다.");
      return;
    }
    if (!currentUserId) {
      setMessage("사용자 정보를 확인할 수 없습니다.");
      return;
    }

    const missing = validateRequired(action);
    if (missing.length) {
      alert(`다음 필수값을 입력해주세요: ${missing.map((m) => m.label).join(", ")}`);
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      // 상위 onSave로 전달 (DB 컬럼이 없더라도 상위에서 필터 가능)
      const payload = {
        ...formData,
        currentUserId,
        reason: reason || "",
      };
      console.log("💾 [Studio] 저장 시도", { action, payload });
      const res = await onSave(payload, action);
      setMessage(res.message);
      if (res.success) {
        alert(res.message);
        onClose();
      }
    } catch (e: any) {
      console.error("❌ 저장 오류", e);
      const msg = e?.message || "처리 중 오류가 발생했습니다.";
      setMessage(msg);
      alert(msg);
    } finally {
      setSaving(false);
    }
  };

  // ────────────────────────────────────────────────────────────
  // 렌더링
  // ────────────────────────────────────────────────────────────
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          width: 1200,
          maxWidth: "95vw",
          height: 800,
          maxHeight: "90vh",
          background: "#fff",
          borderRadius: 12,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 40px rgba(0,0,0,.2)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid #E5E7EB",
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 800, color: "#111827" }}>
            {isEditMode ? "스튜디오 스케줄 수정" : "스튜디오 스케줄 등록"}
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              background: "none",
              border: 0,
              fontSize: 24,
              cursor: saving ? "not-allowed" : "pointer",
              color: "#6b7280",
              opacity: saving ? 0.5 : 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Body: 좌(폼) / 우(히스토리) */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Left: Form */}
          <div
            style={{
              flex: "0 0 50%",
              padding: 20,
              borderRight: "1px solid #E5E7EB",
              overflowY: "auto",
            }}
          >
            {/* 안내/상태 박스 */}
            {userIdLoading && (
              <div style={hintBox("#eff6ff", "#1e40af", "#bfdbfe")}>
                사용자 매핑 중…
              </div>
            )}
            {isInactive && (
              <div style={hintBox("#fef2f2", "#dc2626", "#fecaca")}>
                이 스케줄은 더 이상 활성 상태가 아닙니다.
              </div>
            )}
            {["system_admin", "schedule_admin", "studio_manager"].includes(
              userRole
            ) && !isInactive && (
              <div style={hintBox("#f0fdf4", "#166534", "#bbf7d0")}>
                관리자 권한으로 승인/취소/삭제를 직접 처리할 수 있습니다.
              </div>
            )}

            {/* 날짜 */}
            <Field label={"촬영 날짜"} required>
              <input
                type="date"
                disabled={fieldDisabled}
                value={formData.shoot_date}
                onChange={(e) => setVal("shoot_date", e.target.value)}
                style={inputBase(fieldDisabled)}
              />
            </Field>

            {/* 시간 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Field label={"시작 시간"} required>
                <select
                  disabled={fieldDisabled}
                  value={formData.start_time}
                  onChange={(e) => setVal("start_time", e.target.value)}
                  style={inputBase(fieldDisabled)}
                >
                  <option value="">시작 시간 선택</option>
                  {timeOptions.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={"종료 시간"} required>
                <select
                  disabled={fieldDisabled}
                  value={formData.end_time}
                  onChange={(e) => setVal("end_time", e.target.value)}
                  style={inputBase(fieldDisabled)}
                >
                  <option value="">종료 시간 선택</option>
                  {timeOptions.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {/* 교수/강의명 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Field label={"교수명"} required>
                <ProfessorAutocomplete
                  value={formData.professor_name}
                  onChange={handleProfessorChange}
                  placeholder="교수명을 입력하면 자동완성됩니다"
                  disabled={fieldDisabled}
                  required
                  style={{ backgroundColor: fieldDisabled ? "#f9fafb" : "#fff" }}
                />
                {/* 항상 고정 노출되는 매칭 배지 */}
                {(selectedProfessorInfo?.category_name || formData.professor_category_name) ? (
                  <div style={{ marginTop: 6, fontSize: 12, color: "#059669" }}>
                    ✓ 매칭됨: {selectedProfessorInfo?.category_name || formData.professor_category_name}
                  </div>
                ) : null}
              </Field>
              <Field label={"강의명"}>
                <input
                  type="text"
                  disabled={fieldDisabled}
                  value={formData.course_name}
                  onChange={(e) => setVal("course_name", e.target.value)}
                  style={inputBase(fieldDisabled)}
                />
              </Field>
            </div>

            {/* 촬영형식 / 스튜디오(서브로케이션) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Field label={"촬영형식"} required>
                <select
                  disabled={fieldDisabled}
                  value={formData.shooting_type}
                  onChange={(e) => setVal("shooting_type", e.target.value)}
                  style={inputBase(fieldDisabled)}
                >
                  {studioShootingTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={"스튜디오"} required>
                <select
                  disabled={fieldDisabled}
                  value={formData.sub_location_id}
                  onChange={(e) => setVal("sub_location_id", e.target.value)}
                  style={inputBase(fieldDisabled)}
                >
                  <option value="">스튜디오 선택</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={String(loc.id)}>
                      {loc.displayName || loc.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {/* 비고 */}
            <Field label={"비고"}>
              <textarea
                rows={3}
                disabled={fieldDisabled}
                value={formData.notes}
                onChange={(e) => setVal("notes", e.target.value)}
                style={{ ...inputBase(fieldDisabled), minHeight: 60, resize: "vertical" }}
              />
            </Field>
          </div>

          {/* Right: History */}
          <div style={{ flex: "0 0 50%", background: "#F8FAFC", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #E5E7EB", fontWeight: 700 }}>처리 이력</div>
            <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
              {isEditMode ? (
                <HistoryPanel scheduleId={initialData?.scheduleData?.id} />
              ) : (
                <div style={{ color: "#6b7280", fontSize: 14 }}>스케줄 저장 후 처리 이력이 표시됩니다.</div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: 16,
            borderTop: "1px solid #E5E7EB",
            display: "flex",
            gap: 10,
            alignItems: "center",
            justifyContent: "flex-end",
            flexWrap: "wrap",
          }}
        >
          {(saving || userIdLoading) && (
            <div style={{ marginRight: "auto", display: "flex", alignItems: "center", gap: 8 }}>
              <Spinner />
              <span style={{ color: "#6b7280" }}>{userIdLoading ? "사용자 매핑 중…" : "처리 중…"}</span>
            </div>
          )}

          {/* 공통 닫기 */}
          <Btn variant="ghost" onClick={onClose} disabled={saving}>
            닫기
          </Btn>

          {/* 권한/상태에 따른 버튼 세트 (간단 버전) */}
          {/* 관리자 */}
          {["system_admin", "schedule_admin", "studio_manager"].includes(userRole) ? (
            <>
              <Btn onClick={() => handleSave("temp")} disabled={saving || userIdLoading}>
                임시저장
              </Btn>
              {isEditMode ? (
                <Btn color="green" onClick={() => handleSave("modify_approve")} disabled={saving || userIdLoading}>
                  승인
                </Btn>
              ) : (
                <Btn color="green" onClick={() => handleSave("approve")} disabled={saving || userIdLoading}>
                  승인
                </Btn>
              )}
              <Btn color="amber" onClick={() => handleSave("cancel")} disabled={saving || userIdLoading}>
                취소
              </Btn>
              <Btn color="red" onClick={() => handleSave("delete")} disabled={saving || userIdLoading}>
                삭제
              </Btn>
            </>
          ) : (
            // 일반 사용자
            <>
              <Btn onClick={() => handleSave("temp")} disabled={saving || userIdLoading}>
                임시저장
              </Btn>
              {!isEditMode ? (
                <Btn color="blue" onClick={() => handleSave("request")} disabled={saving || userIdLoading}>
                  승인요청
                </Btn>
              ) : ["approved", "confirmed"].includes(currentStatus) ? (
                <Btn color="violet" onClick={() => handleSave("modify_request")} disabled={saving || userIdLoading}>
                  수정권한요청
                </Btn>
              ) : (
                <Btn color="blue" onClick={() => handleSave("request")} disabled={saving || userIdLoading}>
                  승인요청
                </Btn>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 작은 UI 빌딩 블록들
// ─────────────────────────────────────────────────────────────
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 600, color: "#374151" }}>
        {label} {required ? <span style={{ color: "#ef4444" }}>*</span> : null}
      </label>
      {children}
    </div>
  );
}

function inputBase(disabled?: boolean): React.CSSProperties {
  return {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 14,
    outline: "none",
    background: disabled ? "#f9fafb" : "#fff",
  };
}

function hintBox(bg: string, color: string, border: string): React.CSSProperties {
  return {
    marginBottom: 12,
    padding: 12,
    background: bg,
    color,
    border: `1px solid ${border}`,
    borderRadius: 8,
    fontSize: 14,
  } as React.CSSProperties;
}

function Btn({
  children,
  onClick,
  disabled,
  color,
  variant = "solid",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  color?: "green" | "blue" | "red" | "amber" | "violet";
  variant?: "solid" | "ghost";
}) {
  const palette: Record<string, { bg: string; hover: string }> = {
    green: { bg: "#059669", hover: "#047857" },
    blue: { bg: "#2563eb", hover: "#1d4ed8" },
    red: { bg: "#dc2626", hover: "#b91c1c" },
    amber: { bg: "#f59e0b", hover: "#d97706" },
    violet: { bg: "#8b5cf6", hover: "#7c3aed" },
  };

  if (variant === "ghost") {
    return (
      <button
        onClick={onClick}
        disabled={!!disabled}
        style={{
          padding: "8px 14px",
          background: "#fff",
          border: "1px solid #d1d5db",
          color: "#374151",
          borderRadius: 8,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        {children}
      </button>
    );
  }

  const c = palette[color || "blue"]; // 기본 파랑
  return (
    <button
      onClick={onClick}
      disabled={!!disabled}
      style={{
        padding: "10px 16px",
        background: c.bg,
        border: 0,
        color: "#fff",
        borderRadius: 8,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        fontSize: 14,
        fontWeight: 600,
      }}
      onMouseOver={(e) => ((e.currentTarget.style.background = c.hover))}
      onMouseOut={(e) => ((e.currentTarget.style.background = c.bg))}
    >
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <div
      style={{
        width: 16,
        height: 16,
        borderRadius: "50%",
        border: "2px solid #d1d5db",
        borderTop: "2px solid #059669",
        animation: "spin 1s linear infinite",
      }}
    />
  );
}

// keyframes (inline)
const style = document.createElement("style");
style.innerHTML = `@keyframes spin {0%{transform:rotate(0)}100%{transform:rotate(360deg)}}`;
document.head.appendChild(style);
