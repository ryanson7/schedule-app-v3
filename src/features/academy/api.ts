import { supabase, checkSession, getAuthUser } from '../../utils/supabaseClient';

export class AcademyAPI {
  private static readonly PAGE_TYPE = 'academy';

  // 🔥 강화된 세션 확인 후 사용자 ID 조회
  static async getCurrentUserId(): Promise<number | null> {
    try {
      // 세션 확인
      const session = await checkSession();
      if (!session) {
        console.error('❌ 세션 없음');
        return null;
      }

      const userEmail = session.user?.email || localStorage.getItem('userEmail');
      if (!userEmail) {
        console.error('❌ 사용자 이메일 없음');
        return null;
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, role, email')
        .eq('email', userEmail)
        .single();

      if (userError || !userData) {
        console.error('❌ 사용자 DB 조회 실패:', userError);
        return null;
      }

      return userData.id;
    } catch (error) {
      console.error('❌ 사용자 ID 조회 예외:', error);
      return null;
    }
  }

  // 🔥 다중 fallback 사용자 정보 조회
  static async getUserInfo() {
    try {
      console.log('🔍 사용자 정보 조회 시작');
      
      // 1. 세션 확인 (여러 방법 시도)
      const session = await checkSession();
      if (!session) {
        throw new Error('활성 세션이 없습니다. 다시 로그인해주세요.');
      }

      // 2. 사용자 이메일 확인
      const userEmail = session.user?.email || localStorage.getItem('userEmail');
      if (!userEmail) {
        throw new Error('사용자 이메일 정보를 가져올 수 없습니다.');
      }

      console.log('✅ 인증된 사용자 이메일:', userEmail);

      // 3. users 테이블에서 사용자 정보 조회
      const { data: userData, error: userDataError } = await supabase
        .from('users')
        .select('id, name, email, role, is_active')
        .eq('email', userEmail)
        .eq('is_active', true)
        .single();

      if (userDataError) {
        console.error('❌ 사용자 DB 조회 오류:', userDataError);
        throw new Error(`사용자 정보 조회 실패: ${userDataError.message}`);
      }

      if (!userData) {
        throw new Error('사용자 정보를 찾을 수 없습니다');
      }

      // 4. 학원 접근 권한 조회
      let academies: number[] = [];
      try {
        const { data: accessData, error: accessError } = await supabase
          .from('user_academy_access')
          .select('academy_id')
          .eq('user_id', userData.id);

        if (accessError) {
          console.warn('⚠️ 학원 접근 권한 조회 실패:', accessError);
        } else {
          academies = accessData?.map(access => access.academy_id) || [];
        }
      } catch (accessError) {
        console.warn('⚠️ 학원 접근 권한 조회 예외:', accessError);
      }

      console.log('✅ 사용자 정보 조회 성공:', userData);

      return {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        academies: academies
      };
    } catch (error) {
      console.error('❌ getUserInfo 전체 오류:', error);
      throw error;
    }
  }

  // 세션 확인 후 위치 조회
  static async fetchLocations(selectedAcademies: number[] = []) {
    try {
      const session = await checkSession();
      if (!session) {
        throw new Error('인증이 필요합니다');
      }

      const { data, error } = await supabase
        .from('sub_locations')
        .select(`
          id, name,
          main_locations!inner(id, name, location_type)
        `)
        .eq('is_active', true)
        .eq('main_locations.location_type', 'academy')
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

  // 세션 확인 후 스케줄 조회
  static async fetchSchedules(
    startDate: string, 
    endDate: string, 
    selectedAcademies: number[] = []
  ) {
    try {
      const session = await checkSession();
      if (!session) {
        throw new Error('인증이 필요합니다');
      }

      let query = supabase
        .from('schedules')
        .select(`
          *,
          sub_locations!inner(
            id, name,
            main_locations!inner(id, name, location_type)
          )
        `)
        .eq('schedule_type', this.PAGE_TYPE)
        .eq('sub_locations.main_locations.location_type', 'academy')
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

  // 세션 확인 후 스케줄 저장
  static async saveSchedule(data: any, action: 'temp' | 'request' | 'approve') {
    try {
      const session = await checkSession();
      if (!session) {
        throw new Error('인증이 필요합니다');
      }

      const currentUserId = await this.getCurrentUserId();
      
      if (!currentUserId) {
        throw new Error('사용자 인증에 실패했습니다.');
      }

      const scheduleData = {
        ...data,
        schedule_type: this.PAGE_TYPE,
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
}
