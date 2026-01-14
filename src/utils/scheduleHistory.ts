// src/utils/scheduleHistory.ts
import { supabase } from "./supabaseClient";

type AnyObj = Record<string, any>;

export const normalizeChangeType = (t: string) => {
  const v = String(t || "").trim();

  // ✅ 과거/혼재된 키들까지 흡수
  if (v === "cross_check_request") return "crosscheck_req";
  if (v === "cross_check_confirm") return "crosscheck_ok";
  if (v === "crosscheck_confirm") return "crosscheck_ok";

  return v;
};

export const buildSnapshotFromSchedule = (s: AnyObj | null | undefined) => {
  if (!s) return null;

  // 너무 큰 객체(조인 포함) 들어오면 히스토리 저장이 지저분해지고 무거워짐 → 핵심만 스냅샷
  return {
    id: s.id ?? null,
    schedule_type: s.schedule_type ?? null,
    shoot_date: s.shoot_date ?? null,
    start_time: s.start_time ?? null,
    end_time: s.end_time ?? null,
    professor_name: s.professor_name ?? null,
    course_name: s.course_name ?? null,
    course_code: s.course_code ?? null,
    shooting_type: s.shooting_type ?? null,
    sub_location_id: s.sub_location_id ?? null,
    approval_status: s.approval_status ?? null,
    tracking_status: s.tracking_status ?? null,
    notes: s.notes ?? null,
    is_active: s.is_active ?? null,

    requested_by: s.requested_by ?? null,
    approved_by: s.approved_by ?? null,

    break_time_enabled: s.break_time_enabled ?? null,
    break_start_time: s.break_start_time ?? null,
    break_end_time: s.break_end_time ?? null,
    break_duration_minutes: s.break_duration_minutes ?? null,

    schedule_group_id: s.schedule_group_id ?? null,
    is_split_schedule: s.is_split_schedule ?? null,
  };
};

const recentKeys = new Map<string, number>();

const cleanupKeys = () => {
  const now = Date.now();
  for (const [k, t] of recentKeys.entries()) {
    if (now - t > 10_000) recentKeys.delete(k);
  }
};

const buildDedupeKey = (p: AnyObj, bucketSec: number) => {
  // schedule_id + change_type + bucket 으로만 dedupe (description/old/new까지 포함하면 너무 민감해져서 중복 방지 실패)
  return `${p.scheduleId}|${normalizeChangeType(String(p.changeType))}|${bucketSec}`;
};

export const logScheduleHistory = async (params: {
  scheduleId: number;
  changeType: string;
  changedBy?: number | null; // ✅ changed_by (name 아님)
  description?: string | null;
  oldValue?: any;
  newValue?: any;
  dedupeWindowSec?: number;
}) => {
  const {
    scheduleId,
    changeType,
    changedBy = null,
    description = null,
    oldValue = null,
    newValue = null,
    dedupeWindowSec = 2,
  } = params;

  if (!scheduleId) return;

  const nowMs = Date.now();
  const bucketSec = Math.floor(nowMs / 1000 / dedupeWindowSec) * dedupeWindowSec;
  const dedupeKey = buildDedupeKey(
    { scheduleId, changeType: normalizeChangeType(String(changeType)) },
    bucketSec
  );

  const last = recentKeys.get(dedupeKey);
  if (last && nowMs - last < dedupeWindowSec * 1000) return;

  recentKeys.set(dedupeKey, nowMs);
  cleanupKeys();

  const payload: AnyObj = {
    schedule_id: scheduleId,
    change_type: normalizeChangeType(String(changeType)),
    description: description ?? "",
    changed_by: changedBy,
    old_value: oldValue == null ? null : JSON.stringify(oldValue),
    new_value: newValue == null ? null : JSON.stringify(newValue),
  };

  const { error } = await supabase.from("schedule_history").insert(payload);
  if (error) console.error("[schedule_history] insert error:", error, payload);
};
