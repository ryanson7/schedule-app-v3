// src/pages/api/shooter/register-weekly-schedule.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../utils/supabaseClient';

interface WeeklyScheduleEntry {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
  notes?: string;
}

interface WeeklyScheduleRequest {
  shooter_id: number;
  week_start_date: string;
  schedule_entries: WeeklyScheduleEntry[];
  preferred_locations: number[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Use POST.'
    });
  }

  try {
    const {
      shooter_id,
      week_start_date,
      schedule_entries,
      preferred_locations
    }: WeeklyScheduleRequest = req.body;

    // 권한 확인 (본인 또는 관리자만)
    const currentUserId = req.headers.user_id;
    const currentUserRole = req.headers.user_role;
    
    if (currentUserId != shooter_id && currentUserRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '권한이 없습니다.'
      });
    }

    // 기존 주간 스케줄 삭제
    await supabase
      .from('shooter_weekly_availability')
      .delete()
      .eq('shooter_id', shooter_id)
      .eq('week_start_date', week_start_date);

    // 새 주간 스케줄 등록
    const availabilityData = schedule_entries.map(entry => ({
      shooter_id,
      week_start_date,
      day_of_week: entry.day_of_week,
      start_time: entry.start_time,
      end_time: entry.end_time,
      is_available: entry.is_available,
      notes: entry.notes
    }));

    const { error: availabilityError } = await supabase
      .from('shooter_weekly_availability')
      .insert(availabilityData);

    if (availabilityError) {
      throw availabilityError;
    }

    // 장소 선호도 업데이트
    if (preferred_locations.length > 0) {
      // 기존 선호도 삭제
      await supabase
        .from('shooter_location_preferences')
        .delete()
        .eq('shooter_id', shooter_id);

      // 새 선호도 등록
      const locationData = preferred_locations.map(location_id => ({
        shooter_id,
        main_location_id: location_id,
        is_preferred: true
      }));

      await supabase
        .from('shooter_location_preferences')
        .insert(locationData);
    }

    return res.status(200).json({
      success: true,
      message: '주간 스케줄이 성공적으로 등록되었습니다.',
      data: {
        week_start_date,
        entries_count: schedule_entries.length,
        preferred_locations_count: preferred_locations.length
      }
    });

  } catch (error) {
    console.error('주간 스케줄 등록 오류:', error);
    return res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
}
