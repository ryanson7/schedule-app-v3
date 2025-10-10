export type UserRole = 'system_admin' | 'schedule_admin' | 'academy_manager' | 'studio_manager' | 'manager' | 'staff';

export type ScheduleType = 'academy' | 'studio';

export type ApprovalStatus = 'temp' | 'pending' | 'approved' | 'cancelled';

export interface BaseSchedule {
  id?: number;
  shoot_date: string;
  start_time: string;
  end_time: string;
  professor_name: string;
  course_name: string;
  course_code?: string;
  shooting_type: string;
  notes?: string;
  sub_location_id: number;
  schedule_type: ScheduleType;
  approval_status: ApprovalStatus;
  team_id: number;
  is_active: boolean;
  created_by?: number;
  approved_by?: number;
  requested_by?: number;
  created_at?: string;
  updated_at?: string;
  approved_at?: string;
  requested_at?: string;
}

export interface Location {
  id: number;
  name: string;
  main_locations: {
    id: number;
    name: string;
    location_type: string;
  };
}

export interface UserInfo {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  academies?: number[];
}

export interface ModalData {
  date: string;
  locationId: number;
  scheduleData?: BaseSchedule;
}
