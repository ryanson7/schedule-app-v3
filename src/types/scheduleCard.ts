// 📁 types/scheduleCard.ts
export interface BaseSchedule {
  id: number;
  start_time: string;
  end_time: string;
  professor_name: string;
  course_name: string;
  shooting_type: string;
  user_profiles?: {
    name: string;
    employment_type: string;
  };
}

export interface StudioSchedule extends BaseSchedule {
  approval_status: 'approved' | 'pending' | 'cancelled';
  sub_location_id: number;
}

export interface AcademySchedule extends BaseSchedule {
  tracking_status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  sub_location_id: number;
}
