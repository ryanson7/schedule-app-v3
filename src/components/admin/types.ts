// components/admin/types.ts
export interface AttendanceInfo {
  name: string;
  notes?: string;
}

export interface LocationAttendance {
  locationName: string;
  displayOrder: number;
  people: AttendanceInfo[];
}

export interface TodayTask {
  id: number;
  schedule_type: string;
  content: string;
  shadow_color: string;
}
