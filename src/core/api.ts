import { supabase } from '../utils/supabaseClient';
import { BaseSchedule, Location, UserInfo, ScheduleType } from './types';

export class CommonAPI {
  // 현재 사용자 ID 조회
  static async getCurrentUserId(): Promise<number | null> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        console.error('❌ 인증 정보 없음:', authError);
        return null;
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, role, email')
        .eq('email', user.email)
        .single();

      if (userError || !userData) {
        console.error('❌ 사용자 정보 조회 실패:', userError);
        return null;
      }

      return userData.id;
    } catch (error) {
      console.error('❌ 사용자 ID 조회 예외:', error);
      return null;
    }
  }

  // 사용자 정보 조회
  static async getUserInfo(): Promise<UserInfo> {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user?.email) {
        throw new Error('사용자 정보 없음');
      }

      const { data: userData, error: userDataError } = await supabase
        .from('users')
        .select(`
          id, name, email, role,
          user_academy_access(academy_id)
        `)
        .eq('email', user.email)
        .single();

      if (userDataError) {
        throw new Error('사용자 정보 조회 실패');
      }

      return {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        academies: userData.user_academy_access?.map((access: any) => access.academy_id) || []
      };
    } catch (error) {
      console.error('❌ getUserInfo 오류:', error);
      throw error;
    }
  }

  // 위치 조회 (타입별 필터링)
  static async fetchLocations(
    scheduleType: ScheduleType, 
    selectedAcademies: number[] = []
  ): Promise<Location[]> {
    try {
      const { data, error } = await supabase
        .from('sub_locations')
        .select(`
          id, name,
          main_locations!inner(id, name, location_type)
        `)
        .eq('is_active', true)
        .eq('main_locations.location_type', scheduleType)
        .order('main_location_id', { ascending: true })
        .order('id', { ascending: true });

      if (error) throw error;

      let filteredData = data || [];
      if (selectedAcademies.length > 0) {
        filteredData = data?.filter(location => 
          selectedAcademies.includes(location.main_locations?.id)
        ) || [];
      }

      return filteredData;
    } catch (error) {
      console.error('❌ fetchLocations 오류:', error);
      throw error;
    }
  }

  // 스케줄 조회
  static async fetchSchedules(
    scheduleType: ScheduleType,
    startDate: string, 
    endDate: string, 
    selectedAcademies: number[] = []
  ): Promise<BaseSchedule[]> {
    try {
      let query = supabase
        .from('schedules')
        .select(`
          *,
          sub_locations!inner(
            id, name,
            main_locations!inner(id, name, location_type)
          )
        `)
        .eq('schedule_type', scheduleType)
        .eq('sub_locations.main_locations.location_type', scheduleType)
        .gte('shoot_date', startDate)
        .lte('shoot_date', endDate)
        .eq('is_active', true);

      if (selectedAcademies.length > 0) {
        const { data: subLocations } = await supabase
          .from('sub_locations')
          .select('id')
          .in('main_location_id', selectedAcademies);
        
        if (subLocations && subLocations.length > 0) {
          const subLocationIds = subLocations.map(loc => loc.id);
          query = query.in('sub_location_id', subLocationIds);
        }
      }

      const { data, error } = await query.order('shoot_date').order('start_time');
      
      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('❌ fetchSchedules 오류:', error);
      throw error;
    }
  }

  // 스케줄 저장
  static async saveSchedule(
    data: BaseSchedule, 
    action: 'temp' | 'request' | 'approve'
  ): Promise<void> {
    try {
      const currentUserId = await this.getCurrentUserId();
      
      if (!currentUserId) {
        throw new Error('사용자 인증에 실패했습니다.');
      }

      // 시간 충돌 체크
      const hasConflict = await this.checkTimeConflict(
        data.sub_location_id,
        data.shoot_date,
        data.start_time,
        data.end_time,
        data.schedule_type,
        data.id
      );

      if (hasConflict) {
        throw new Error('선택한 시간대에 이미 다른 스케줄이 있습니다.');
      }

      const scheduleData = {
        ...data,
        team_id: 1,
        is_active: true,
        created_by: currentUserId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...(action === 'approve' ? {
          approval_status: 'approved',
          approved_by: currentUserId,
          approved_at: new Date().toISOString()
        } : action === 'request' ? {
          approval_status: 'pending',
          requested_by: currentUserId,
          requested_at: new Date().toISOString()
        } : {
          approval_status: 'temp'
        })
      };

      if (data.id) {
        const { error } = await supabase
          .from('schedules')
          .update(scheduleData)
          .eq('id', data.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase.from('schedules').insert([scheduleData]);
        if (error) throw error;
      }
    } catch (error) {
      console.error('❌ saveSchedule 오류:', error);
      throw error;
    }
  }

  // 시간 충돌 체크
  static async checkTimeConflict(
    locationId: number,
    date: string,
    startTime: string,
    endTime: string,
    scheduleType: ScheduleType,
    excludeId?: number
  ): Promise<boolean> {
    const { data } = await supabase
      .from('schedules')
      .select('id')
      .eq('sub_location_id', locationId)
      .eq('shoot_date', date)
      .eq('schedule_type', scheduleType)
      .eq('is_active', true)
      .neq('id', excludeId || 0)
      .or(`and(start_time.lt.${endTime},end_time.gt.${startTime})`);
    
    return data && data.length > 0;
  }
}
