// src/utils/scheduleHistory.ts
import { supabase } from "./supabaseClient";

export type ScheduleChangeType =
  | "created"
  | "updated"
  | "approved"
  | "rejected"
  | "cancelled"
  | "status_changed";

export interface HistoryActor {
  userId?: number | null;
  userUuid?: string | null;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  source?: "professor-page" | "admin-panel" | "studio-modal" | "system" | string;
}

export interface ScheduleSnapshot {
  id?: number;
  shoot_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  professor_name?: string | null;
  course_name?: string | null;
  course_code?: string | null;
  shooting_type?: string | null;
  sub_location_id?: number | null;
  approval_status?: string | null;
  notes?: string | null;
  schedule_group_id?: string | null;
  is_split_schedule?: boolean | null;
  break_time_enabled?: boolean | null;
  break_start_time?: string | null;
  break_end_time?: string | null;
  break_duration_minutes?: number | null;
  is_active?: boolean | null;
}

export interface LogScheduleHistoryParams {
  scheduleId: number;
  changeType: ScheduleChangeType;
  oldValues?: ScheduleSnapshot | null;
  newValues?: ScheduleSnapshot | null;
  reason?: string | null;
  actor?: HistoryActor;
}

export const buildSnapshotFromSchedule = (row: any): ScheduleSnapshot => ({
  id: row.id,
  shoot_date: row.shoot_date,
  start_time: row.start_time,
  end_time: row.end_time,
  professor_name: row.professor_name,
  course_name: row.course_name,
  course_code: row.course_code,
  shooting_type: row.shooting_type,
  sub_location_id: row.sub_location_id,
  approval_status: row.approval_status,
  notes: row.notes,
  schedule_group_id: row.schedule_group_id,
  is_split_schedule: row.is_split_schedule,
  break_time_enabled: row.break_time_enabled,
  break_start_time: row.break_start_time,
  break_end_time: row.break_end_time,
  break_duration_minutes: row.break_duration_minutes,
  is_active: row.is_active,
});

export const logScheduleHistory = async ({
  scheduleId,
  changeType,
  oldValues = null,
  newValues = null,
  reason = null,
  actor,
}: LogScheduleHistoryParams) => {
  try {
    const payload: any = {
      schedule_id: scheduleId,
      change_type: changeType,
      old_values: oldValues,
      new_values: newValues,
      reason: reason,
      changed_by_user_id: actor?.userId ?? null,
      changed_by_user_uuid: actor?.userUuid ?? null,
      changed_by_name: actor?.name ?? null,
      changed_by_email: actor?.email ?? null,
      changed_by_role: actor?.role ?? null,
      source: actor?.source ?? null,
    };

    const { error } = await supabase.from("schedule_history").insert(payload);
    if (error) {
      console.error("[schedule_history] insert error:", error);
    }
  } catch (err) {
    console.error("[schedule_history] logScheduleHistory exception:", err);
  }
};

/** 최초 생성용 헬퍼 */
export const logScheduleCreated = async (row: any, actor?: HistoryActor) => {
  if (!row?.id) return;
  const snapshot = buildSnapshotFromSchedule(row);
  return logScheduleHistory({
    scheduleId: row.id,
    changeType: "created",
    oldValues: null,
    newValues: snapshot,
    actor,
  });
};

/** 일반 수정/직접수정용 헬퍼 */
export const logScheduleUpdated = async (
  oldRow: any,
  newRow: any,
  actor?: HistoryActor,
  reason?: string
) => {
  if (!oldRow?.id) return;
  return logScheduleHistory({
    scheduleId: oldRow.id,
    changeType: "updated",
    oldValues: buildSnapshotFromSchedule(oldRow),
    newValues: buildSnapshotFromSchedule(newRow),
    actor,
    reason,
  });
};

/** 상태 변경 전용 (승인/취소/요청 등) */
export const logScheduleStatusChanged = async (
  schedule: any,
  fromStatus: string,
  toStatus: string,
  actor?: HistoryActor,
  reason?: string
) => {
  if (!schedule?.id) return;
  const snapshot = buildSnapshotFromSchedule({
    ...schedule,
    approval_status: toStatus,
  });

  return logScheduleHistory({
    scheduleId: schedule.id,
    changeType:
      toStatus === "cancelled"
        ? "cancelled"
        : fromStatus === "pending" && toStatus === "approved"
        ? "approved"
        : "status_changed",
    oldValues: { ...snapshot, approval_status: fromStatus },
    newValues: snapshot,
    actor,
    reason,
  });
};
