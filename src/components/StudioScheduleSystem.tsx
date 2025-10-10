"use client";
import { useEffect, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { 
  checkBreakTimeConflict, 
  calculateScheduleSplit, 
  calculateEffectiveWorkTime,
  BreakTimeInfo,
  TimeConflictResult,
  ScheduleSplitResult 
} from '../utils/breakTimeUtils';

// 시간 옵션 생성 (30분 단위)
const generateTimeOptions = () => {
  const times = [];
  for (let hour = 9; hour < 22; hour++) {
    for (let min = 0; min < 60; min += 30) {
      const h = hour.toString().padStart(2, "0");
      const m = min.toString().padStart(2, "0");
      times.push(`${h}:${m}`);
    }
  }
  return times;
};

const timeOptions = generateTimeOptions();

interface ShootingType {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
}

interface ShootingRequestData {
  shoot_date: string;
  start_time: string;
  end_time: string;
  professor_name: string;
  course_name: string;
  course_code: string;
  shooting_type: string;
  notes: string;
  preferred_studio_id?: number;
  // 🔥 Break Time 관련 필드 추가
  break_time_enabled: boolean;
  break_start_time?: string;
  break_end_time?: string;
  break_duration_minutes: number;
  schedule_group_id?: string;
  is_split_schedule: boolean;
}

export default function StudioScheduleSystem() {
  const [userInfo, setUserInfo] = useState<any>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [totalRequestCount, setTotalRequestCount] = useState(0);
  const [studioLocations, setStudioLocations] = useState<any[]>([]);
  const [showRequestForm, setShowRequestForm] = useState(true);
  
  // 🔥 실제 촬영 형식 데이터 상태
  const [shootingTypes, setShootingTypes] = useState<ShootingType[]>([]);
  const [compatibleStudios, setCompatibleStudios] = useState<any[]>([]);
  
  // 🔥 검색 필터 상태
  const [searchFilters, setSearchFilters] = useState({
    start_date: '',
    end_date: '',
    limit: 10,
    offset: 0
  });
  const [isSearching, setIsSearching] = useState(false);
  
  // 🔥 Break Time 관련 상태
  const [breakTimeConflict, setBreakTimeConflict] = useState<TimeConflictResult>({
    hasConflict: false,
    conflictType: null
  });
  
  const [breakTimeOption, setBreakTimeOption] = useState<'none' | 'skip' | 'split'>('none');
  
  const [customBreakTime, setCustomBreakTime] = useState<BreakTimeInfo>({
    enabled: false,
    startTime: '12:00',
    endTime: '13:00',
    durationMinutes: 60
  });
  
  const [scheduleSplit, setScheduleSplit] = useState<ScheduleSplitResult>({
    needsSplit: false
  });
  
  const [formData, setFormData] = useState<ShootingRequestData>({
    shoot_date: '',
    start_time: '',
    end_time: '',
    professor_name: '',
    course_name: '',
    course_code: '',
    shooting_type: '',
    notes: '',
    preferred_studio_id: undefined,
    // 🔥 Break Time 기본값
    break_time_enabled: false,
    break_start_time: undefined,
    break_end_time: undefined,
    break_duration_minutes: 0,
    schedule_group_id: undefined,
    is_split_schedule: false
  });

  // 🔥 폼 검증 에러 상태
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchUserInfo();
    fetchStudioLocations();
    fetchShootingTypes();
  }, []);

  useEffect(() => {
    if (userInfo) {
      fetchMyRequests(false);
    }
  }, [userInfo]);

  // 🔥 시간 변경 시 Break Time 충돌 체크
  useEffect(() => {
    if (formData.start_time && formData.end_time) {
      const conflict = checkBreakTimeConflict(formData.start_time, formData.end_time);
      setBreakTimeConflict(conflict);
      
      if (conflict.hasConflict && conflict.suggestedBreakTime) {
        setCustomBreakTime(conflict.suggestedBreakTime);
      }
      
      // 충돌이 없으면 옵션 초기화
      if (!conflict.hasConflict) {
        setBreakTimeOption('none');
      }
    }
  }, [formData.start_time, formData.end_time]);

  // 🔥 Break Time 옵션 변경 시 스케줄 분할 계산
  useEffect(() => {
    if (breakTimeOption === 'split' && formData.start_time && formData.end_time) {
      const splitResult = calculateScheduleSplit(
        formData.start_time,
        formData.end_time,
        customBreakTime
      );
      setScheduleSplit(splitResult);
    } else {
      setScheduleSplit({ needsSplit: false });
    }
  }, [breakTimeOption, customBreakTime, formData.start_time, formData.end_time]);

  // 🔥 실제 촬영 형식 데이터 조회
  const fetchShootingTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('shooting_types')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setShootingTypes(data || []);
    } catch (error) {
      console.error('촬영 형식 로딩 오류:', error);
      // 폴백으로 기본 형식 사용
      const fallbackTypes = ['PPT', '일반칠판', '전자칠판', '크로마키', 'PC와콤', 'PC'].map((name, index) => ({
        id: index + 1,
        name,
        description: name,
        is_active: true
      }));
      setShootingTypes(fallbackTypes);
    }
  };

  // 사용자 정보 조회
  const fetchUserInfo = async () => {
    const userRole = localStorage.getItem('userRole');
    const userEmail = localStorage.getItem('userEmail');
    
    if (userRole && userEmail) {
      setUserRoles([userRole]);
      
      const mockUserInfo = {
        id: 201,
        name: '김교수',
        email: userEmail,
        preferred_shooting_type: 'PPT',
        department: '컴퓨터공학과'
      };
      
      setUserInfo(mockUserInfo);
      setFormData(prev => ({
        ...prev,
        professor_name: mockUserInfo.name,
        shooting_type: ''
      }));
    }
  };

  // 스튜디오 장소 조회
  const fetchStudioLocations = async () => {
    const { data } = await supabase
      .from('sub_locations')
      .select('*, main_locations(name)')
      .eq('is_active', true);
    
    if (data) {
      const studioOnly = data.filter(location => {
        const locationName = location.name?.toLowerCase() || '';
        const mainLocationName = location.main_locations?.name?.toLowerCase() || '';
        return locationName.includes('스튜디오') || mainLocationName.includes('스튜디오');
      });
      
      setStudioLocations(studioOnly);
    }
  };

  // 🔥 수정된 내 촬영 요청 목록 조회
  const fetchMyRequests = async (useFilters = false) => {
    if (!userInfo) return;
    
    setIsSearching(true);
    
    try {
      let query = supabase
        .from('schedules')
        .select(`
          *,
          sub_locations(name, main_locations(name))
        `, { count: 'exact' })
        .eq('schedule_type', 'studio')
        .eq('professor_name', userInfo.name)
        .eq('is_active', true);

      // 날짜 필터 적용
      if (useFilters && searchFilters.start_date) {
        query = query.gte('shoot_date', searchFilters.start_date);
      }
      if (useFilters && searchFilters.end_date) {
        query = query.lte('shoot_date', searchFilters.end_date);
      }

      // 최신순 정렬 및 제한
      query = query
        .order('created_at', { ascending: false })
        .range(searchFilters.offset, searchFilters.offset + searchFilters.limit - 1);

      const { data, error, count } = await query;
      
      if (error) throw error;
      
      setMyRequests(data || []);
      setTotalRequestCount(count || 0);
      
    } catch (error) {
      console.error('요청 목록 조회 오류:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // 🔥 촬영 형식에 따른 호환 스튜디오 조회
  const fetchCompatibleStudios = async (shootingTypeName: string) => {
    try {
      const { data, error } = await supabase
        .from('sub_location_shooting_types')
        .select(`
          sub_location_id,
          is_primary,
          shooting_types!inner(name)
        `)
        .eq('shooting_types.name', shootingTypeName)
        .eq('shooting_types.is_active', true);

      if (error) throw error;

      const compatibleStudioIds = data?.map(item => item.sub_location_id) || [];
      const filteredStudios = studioLocations.filter(studio => 
        compatibleStudioIds.includes(studio.id)
      );

      setCompatibleStudios(filteredStudios);
      
      if (filteredStudios.length > 0) {
        setFormData(prev => ({
          ...prev,
          preferred_studio_id: filteredStudios[0].id
        }));
      }
    } catch (error) {
      console.error('호환 스튜디오 조회 오류:', error);
      setCompatibleStudios([]);
    }
  };

  // 🔥 촬영 형식 변경 핸들러
  const handleShootingTypeChange = (typeName: string) => {
    setFormData(prev => ({
      ...prev,
      shooting_type: typeName,
      preferred_studio_id: undefined
    }));
    
    if (errors.shooting_type) {
      setErrors(prev => ({ ...prev, shooting_type: '' }));
    }
    
    if (typeName) {
      fetchCompatibleStudios(typeName);
    } else {
      setCompatibleStudios([]);
    }
  };

  // 🔥 검색 실행
  const handleSearch = () => {
    setSearchFilters(prev => ({ ...prev, offset: 0 }));
    fetchMyRequests(true);
  };

  // 🔥 검색 초기화
  const handleResetSearch = () => {
    setSearchFilters({
      start_date: '',
      end_date: '',
      limit: 10,
      offset: 0
    });
    fetchMyRequests(false);
  };

  // 🔥 더 보기 기능
  const handleLoadMore = () => {
    const newOffset = searchFilters.offset + searchFilters.limit;
    setSearchFilters(prev => ({ ...prev, offset: newOffset }));
    fetchMoreRequests(newOffset);
  };

  const fetchMoreRequests = async (offset: number) => {
    if (!userInfo) return;
    
    try {
      let query = supabase
        .from('schedules')
        .select(`
          *,
          sub_locations(name, main_locations(name))
        `)
        .eq('schedule_type', 'studio')
        .eq('professor_name', userInfo.name)
        .eq('is_active', true);

      if (searchFilters.start_date) {
        query = query.gte('shoot_date', searchFilters.start_date);
      }
      if (searchFilters.end_date) {
        query = query.lte('shoot_date', searchFilters.end_date);
      }

      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + searchFilters.limit - 1);

      const { data, error } = await query;
      
      if (error) throw error;
      
      setMyRequests(prev => [...prev, ...(data || [])]);
      
    } catch (error) {
      console.error('추가 요청 목록 조회 오류:', error);
    }
  };

  // 🔥 폼 검증 강화
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.shoot_date) {
      newErrors.shoot_date = '촬영 날짜를 선택해주세요.';
    }

    if (!formData.start_time) {
      newErrors.start_time = '시작 시간을 선택해주세요.';
    }

    if (!formData.end_time) {
      newErrors.end_time = '종료 시간을 선택해주세요.';
    }

    if (formData.start_time && formData.end_time && formData.start_time >= formData.end_time) {
      newErrors.end_time = '종료 시간은 시작 시간보다 늦어야 합니다.';
    }

    if (!formData.shooting_type) {
      newErrors.shooting_type = '촬영 형식을 반드시 선택해주세요.';
    }

    // 🔥 Break Time 충돌 체크
    if (breakTimeConflict.hasConflict && breakTimeOption === 'none') {
      newErrors.break_time = '휴식시간 처리 방법을 선택해주세요.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 🔥 스케줄 그룹 생성 및 등록
  const createScheduleGroup = async (formData: ShootingRequestData, breakOption: string, breakTime?: BreakTimeInfo) => {
    try {
      const schedules = [];
      const groupId = `${formData.professor_name}_${formData.shoot_date}_${Date.now()}`;
      
      if (breakOption === 'split' && breakTime && scheduleSplit.needsSplit) {
        // 분할된 2개 스케줄 생성
        const schedule1 = {
          ...formData,
          end_time: breakTime.startTime,
          schedule_group_id: groupId,
          sequence_order: 1,
          is_split_schedule: true,
          break_time_enabled: true,
          break_start_time: breakTime.startTime,
          break_end_time: breakTime.endTime,
          break_duration_minutes: breakTime.durationMinutes,
          schedule_type: 'studio',
          approval_status: 'pending',
          team_id: 1,
          sub_location_id: formData.preferred_studio_id,
          is_active: true,
          notes: `${formData.notes || ''} [1차 촬영]`.trim()
        };
        
        const schedule2 = {
          ...formData,
          start_time: breakTime.endTime,
          schedule_group_id: groupId,
          sequence_order: 2,
          is_split_schedule: true,
          break_time_enabled: true,
          break_start_time: breakTime.startTime,
          break_end_time: breakTime.endTime,
          break_duration_minutes: breakTime.durationMinutes,
          schedule_type: 'studio',
          approval_status: 'pending',
          team_id: 1,
          sub_location_id: formData.preferred_studio_id,
          is_active: true,
          notes: `${formData.notes || ''} [2차 촬영]`.trim()
        };
        
        schedules.push(schedule1, schedule2);
      } else {
        // 단일 스케줄 생성
        const schedule = {
          ...formData,
          schedule_group_id: groupId,
          sequence_order: 1,
          is_split_schedule: false,
          break_time_enabled: breakOption === 'skip',
          break_start_time: breakOption === 'skip' && breakTime ? breakTime.startTime : null,
          break_end_time: breakOption === 'skip' && breakTime ? breakTime.endTime : null,
          break_duration_minutes: breakOption === 'skip' && breakTime ? breakTime.durationMinutes : 0,
          schedule_type: 'studio',
          approval_status: 'pending',
          team_id: 1,
          sub_location_id: formData.preferred_studio_id,
          is_active: true,
          notes: `${formData.notes || ''} ${breakOption === 'skip' ? '[연속 촬영]' : ''}`.trim()
        };
        
        schedules.push(schedule);
      }

      // 스케줄 일괄 삽입
      const { data: scheduleResults, error: scheduleError } = await supabase
        .from('schedules')
        .insert(schedules)
        .select();

      if (scheduleError) throw scheduleError;

      return {
        success: true,
        message: breakOption === 'split' 
          ? '스케줄이 2개로 분할되어 등록되었습니다.' 
          : '스케줄이 등록되었습니다.',
        scheduleCount: schedules.length
      };

    } catch (error) {
      console.error('스케줄 그룹 생성 오류:', error);
      throw error;
    }
  };

  // 🔥 촬영 요청 제출
  const submitShootingRequest = async () => {
    if (!validateForm()) {
      alert('필수 항목을 모두 입력해주세요.');
      return;
    }

    if (breakTimeConflict.hasConflict && breakTimeOption === 'none') {
      alert('휴식시간 처리 방법을 선택해주세요.');
      return;
    }

    try {
      const result = await createScheduleGroup(
        formData, 
        breakTimeOption, 
        breakTimeOption !== 'none' ? customBreakTime : undefined
      );

      alert(result.message);
      resetForm();
      fetchMyRequests(false);

    } catch (error) {
      console.error('등록 오류:', error);
      alert('등록 중 오류가 발생했습니다: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      shoot_date: '',
      start_time: '',
      end_time: '',
      professor_name: userInfo?.name || '',
      course_name: '',
      course_code: '',
      shooting_type: '',
      notes: '',
      preferred_studio_id: undefined,
      break_time_enabled: false,
      break_start_time: undefined,
      break_end_time: undefined,
      break_duration_minutes: 0,
      schedule_group_id: undefined,
      is_split_schedule: false
    });
    setErrors({});
    setCompatibleStudios([]);
    setBreakTimeOption('none');
    setBreakTimeConflict({ hasConflict: false, conflictType: null });
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'approved':
        return { bg: '#e8f5e8', color: '#155724', text: '촬영확정' };
      case 'pending':
        return { bg: '#fff3cd', color: '#856404', text: '검토중' };
      case 'cancelled':
        return { bg: '#f8d7da', color: '#721c24', text: '취소됨' };
      default:
        return { bg: '#f0f0f0', color: '#666', text: '기타' };
    }
  };

  // 🔥 Break Time 옵션 UI 렌더링
  const renderBreakTimeOptions = () => {
    if (!breakTimeConflict.hasConflict) {
      return null;
    }
    
    const conflictName = breakTimeConflict.conflictType === 'lunch' ? '점심시간' : '저녁시간';
    
    return (
      <div style={{
        marginTop: '15px',
        padding: '15px',
        backgroundColor: '#fff3cd',
        border: '1px solid #ffeaa7',
        borderRadius: '8px'
      }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#856404' }}>
          ⚠️ {conflictName} 충돌 감지
        </h4>
        <p style={{ margin: '0 0 15px 0', color: '#856404' }}>
          선택한 시간이 {conflictName}({customBreakTime.startTime}-{customBreakTime.endTime})과 겹칩니다.
        </p>
        
        {/* 휴식시간 처리 옵션 */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            휴식시간 처리 방법을 선택하세요:
          </label>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="radio"
                name="breakTimeOption"
                value="skip"
                checked={breakTimeOption === 'skip'}
                onChange={(e) => setBreakTimeOption(e.target.value as any)}
                style={{ marginRight: '8px' }}
              />
              <span>휴식시간 건너뛰기 (연속 촬영, 1명 촬영자)</span>
            </label>
            
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="radio"
                name="breakTimeOption"
                value="split"
                checked={breakTimeOption === 'split'}
                onChange={(e) => setBreakTimeOption(e.target.value as any)}
                style={{ marginRight: '8px' }}
              />
              <span>휴식시간으로 분할 (2개 스케줄, 촬영자 별도 배정 가능)</span>
            </label>
          </div>
        </div>
        
        {/* 분할 옵션 선택 시 휴식시간 커스터마이징 */}
        {breakTimeOption === 'split' && (
          <div style={{
            padding: '10px',
            backgroundColor: '#e3f2fd',
            borderRadius: '6px',
            border: '1px solid #bbdefb'
          }}>
            <h5 style={{ margin: '0 0 10px 0' }}>휴식시간 설정</h5>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>
                  휴식 시작
                </label>
                <input
                  type="time"
                  value={customBreakTime.startTime}
                  onChange={(e) => setCustomBreakTime(prev => ({
                    ...prev,
                    startTime: e.target.value,
                    durationMinutes: (new Date(`2000-01-01T${prev.endTime}:00`).getTime() - 
                                    new Date(`2000-01-01T${e.target.value}:00`).getTime()) / (1000 * 60)
                  }))}
                  style={{
                    width: '100%',
                    padding: '6px',
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>
                  휴식 종료
                </label>
                <input
                  type="time"
                  value={customBreakTime.endTime}
                  onChange={(e) => setCustomBreakTime(prev => ({
                    ...prev,
                    endTime: e.target.value,
                    durationMinutes: (new Date(`2000-01-01T${e.target.value}:00`).getTime() - 
                                    new Date(`2000-01-01T${prev.startTime}:00`).getTime()) / (1000 * 60)
                  }))}
                  style={{
                    width: '100%',
                    padding: '6px',
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                  }}
                />
              </div>
            </div>
            
            {/* 분할 결과 미리보기 */}
            {scheduleSplit.needsSplit && (
              <div style={{ marginTop: '10px', fontSize: '14px' }}>
                <strong>분할 결과:</strong>
                <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                  <li>1차 촬영: {scheduleSplit.firstSchedule?.startTime} ~ {scheduleSplit.firstSchedule?.endTime}</li>
                  <li>휴식시간: {customBreakTime.startTime} ~ {customBreakTime.endTime}</li>
                  <li>2차 촬영: {scheduleSplit.secondSchedule?.startTime} ~ {scheduleSplit.secondSchedule?.endTime}</li>
                </ul>
              </div>
            )}
          </div>
        )}
        
        {/* 건너뛰기 옵션 선택 시 안내 */}
        {breakTimeOption === 'skip' && (
          <div style={{
            padding: '10px',
            backgroundColor: '#fff2e6',
            borderRadius: '6px',
            border: '1px solid #ffd699'
          }}>
            <p style={{ margin: 0, fontSize: '14px', color: '#cc7a00' }}>
              <strong>연속 촬영:</strong> {formData.start_time} ~ {formData.end_time} 
              ({conflictName} 포함, 1명 촬영자 배정)
            </p>
          </div>
        )}
        
        {errors.break_time && (
          <span style={{ color: '#dc3545', fontSize: '12px', marginTop: '8px', display: 'block' }}>
            {errors.break_time}
          </span>
        )}
      </div>
    );
  };

  const isProfessor = userRoles.includes('professor') || userRoles.includes('professor');

  if (!isProfessor) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h2>스튜디오 촬영 시스템</h2>
        <p>교수님만 접근 가능한 시스템입니다.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 20 }}>
      <div style={{ marginBottom: 30 }}>
        <h1 style={{ color: '#2c3e50', fontSize: 28, marginBottom: 10 }}>
          스튜디오 촬영 요청 시스템
        </h1>
        <p style={{ color: '#666', fontSize: 16 }}>
          안녕하세요, {userInfo?.name} 교수님. 촬영 요청을 등록해주세요.
        </p>
      </div>

      {/* 촬영 요청 등록 폼 */}
      {showRequestForm && (
        <div style={{ 
          background: 'white', 
          borderRadius: 12, 
          padding: 30, 
          marginBottom: 30,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          border: '1px solid #e9ecef'
        }}>
          <h2 style={{ margin: '0 0 25px 0', color: '#495057', fontSize: 22 }}>
            새 촬영 요청 등록
          </h2>
          
          <div style={{ display: 'grid', gap: 20 }}>
            {/* 기본 정보 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 'bold', color: '#495057' }}>
                  촬영 날짜 *
                </label>
                <input 
                  type="date" 
                  value={formData.shoot_date} 
                  onChange={(e) => setFormData({...formData, shoot_date: e.target.value})} 
                  style={{ 
                    width: '100%', 
                    padding: 12, 
                    border: `2px solid ${errors.shoot_date ? '#dc3545' : '#dee2e6'}`, 
                    borderRadius: 8,
                    fontSize: 14
                  }} 
                  required 
                />
                {errors.shoot_date && (
                  <span style={{ color: '#dc3545', fontSize: 12, marginTop: 4, display: 'block' }}>
                    {errors.shoot_date}
                  </span>
                )}
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 'bold', color: '#495057' }}>
                  교수명
                </label>
                <input 
                  type="text" 
                  value={formData.professor_name} 
                  readOnly
                  style={{ 
                    width: '100%', 
                    padding: 12, 
                    border: '2px solid #e9ecef', 
                    borderRadius: 8,
                    background: '#f8f9fa',
                    fontSize: 14
                  }} 
                />
              </div>
            </div>

            {/* 🔥 촬영 형식 선택 */}
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: 10, 
                fontWeight: 'bold', 
                color: '#495057',
                fontSize: 16
              }}>
                촬영 형식 * 
                <span style={{ color: '#dc3545', marginLeft: 4 }}>필수</span>
                {userInfo?.preferred_shooting_type && (
                  <span style={{ 
                    fontSize: 12, 
                    color: '#6c757d', 
                    fontWeight: 'normal',
                    marginLeft: 8
                  }}>
                    (선호 형식: {userInfo.preferred_shooting_type})
                  </span>
                )}
              </label>
              
              <select
                value={formData.shooting_type}
                onChange={(e) => handleShootingTypeChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: 12,
                  border: `2px solid ${errors.shooting_type ? '#dc3545' : '#dee2e6'}`,
                  borderRadius: 8,
                  fontSize: 14,
                  backgroundColor: 'white'
                }}
                required
              >
                <option value="">촬영 형식을 선택해주세요</option>
                {shootingTypes.map(type => (
                  <option key={type.id} value={type.name}>
                    {type.name}
                    {type.name === userInfo?.preferred_shooting_type ? ' (선호 형식)' : ''}
                  </option>
                ))}
              </select>

              {errors.shooting_type && (
                <span style={{ color: '#dc3545', fontSize: 12, marginTop: 8, display: 'block' }}>
                  {errors.shooting_type}
                </span>
              )}

              {/* 호환 스튜디오 정보 표시 */}
              {formData.shooting_type && (
                <div style={{ 
                  marginTop: 10, 
                  padding: 12, 
                  background: '#e3f2fd', 
                  borderRadius: 6, 
                  fontSize: 14,
                  border: '1px solid #bbdefb'
                }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                    선택된 촬영 형식: {formData.shooting_type}
                  </div>
                  {compatibleStudios.length > 0 ? (
                    <div>
                      호환 스튜디오 ({compatibleStudios.length}개): {' '}
                      {compatibleStudios.map(s => s.name).join(', ')}
                      {formData.preferred_studio_id && (
                        <div style={{ marginTop: 4, color: '#1976d2' }}>
                          → 자동 배정: {studioLocations.find(s => s.id === formData.preferred_studio_id)?.name}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ color: '#f57c00' }}>
                      호환되는 스튜디오를 조회 중입니다...
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 시간 설정 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 'bold', color: '#495057' }}>
                  시작 시간 *
                </label>
                <select 
                  value={formData.start_time} 
                  onChange={(e) => setFormData({...formData, start_time: e.target.value})} 
                  style={{ 
                    width: '100%', 
                    padding: 12, 
                    border: `2px solid ${errors.start_time ? '#dc3545' : '#dee2e6'}`, 
                    borderRadius: 8,
                    fontSize: 14
                  }} 
                  required
                >
                  <option value="">시작 시간 선택</option>
                  {timeOptions.map(time => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
                {errors.start_time && (
                  <span style={{ color: '#dc3545', fontSize: 12, marginTop: 4, display: 'block' }}>
                    {errors.start_time}
                  </span>
                )}
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 'bold', color: '#495057' }}>
                  종료 시간 *
                </label>
                <select 
                  value={formData.end_time} 
                  onChange={(e) => setFormData({...formData, end_time: e.target.value})} 
                  style={{ 
                    width: '100%', 
                    padding: 12, 
                    border: `2px solid ${errors.end_time ? '#dc3545' : '#dee2e6'}`, 
                    borderRadius: 8,
                    fontSize: 14
                  }} 
                  required
                >
                  <option value="">종료 시간 선택</option>
                  {timeOptions.map(time => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
                {errors.end_time && (
                  <span style={{ color: '#dc3545', fontSize: 12, marginTop: 4, display: 'block' }}>
                    {errors.end_time}
                  </span>
                )}
              </div>
            </div>

            {/* 🔥 Break Time 옵션 표시 */}
            {renderBreakTimeOptions()}

            {/* 강좌 정보 */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 15 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 'bold', color: '#495057' }}>
                  강좌명
                </label>
                <input 
                  type="text" 
                  value={formData.course_name} 
                  onChange={(e) => setFormData({...formData, course_name: e.target.value})} 
                  placeholder="예: 데이터베이스 설계"
                  style={{ 
                    width: '100%', 
                    padding: 12, 
                    border: '2px solid #dee2e6', 
                    borderRadius: 8,
                    fontSize: 14
                  }} 
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 'bold', color: '#495057' }}>
                  강좌코드
                </label>
                <input 
                  type="text" 
                  value={formData.course_code} 
                  onChange={(e) => setFormData({...formData, course_code: e.target.value})} 
                  placeholder="예: CS101"
                  style={{ 
                    width: '100%', 
                    padding: 12, 
                    border: '2px solid #dee2e6', 
                    borderRadius: 8,
                    fontSize: 14
                  }} 
                />
              </div>
            </div>

            {/* 전달사항 */}
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 'bold', color: '#495057' }}>
                전달사항
              </label>
              <textarea 
                value={formData.notes} 
                onChange={(e) => setFormData({...formData, notes: e.target.value})} 
                placeholder="촬영 시 특별히 요청하실 사항이 있으시면 입력해주세요."
                style={{ 
                  width: '100%', 
                  padding: 12, 
                  border: '2px solid #dee2e6', 
                  borderRadius: 8, 
                  minHeight: 80,
                  fontSize: 14,
                  resize: 'vertical'
                }} 
              />
            </div>

            {/* 제출 버튼 */}
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button 
                onClick={submitShootingRequest}
                disabled={!formData.shooting_type}
                style={{ 
                  flex: 1, 
                  padding: 15, 
                  background: formData.shooting_type 
                    ? 'linear-gradient(135deg, #28a745, #20c997)' 
                    : '#6c757d',
                  color: 'white', 
                  border: 'none', 
                  borderRadius: 8, 
                  cursor: formData.shooting_type ? 'pointer' : 'not-allowed',
                  fontSize: 16,
                  fontWeight: 'bold',
                  boxShadow: formData.shooting_type 
                    ? '0 4px 8px rgba(40, 167, 69, 0.3)' 
                    : 'none',
                  opacity: formData.shooting_type ? 1 : 0.6
                }}
              >
                {formData.shooting_type ? '촬영 요청 제출' : '촬영 형식을 먼저 선택해주세요'}
              </button>
              <button 
                onClick={resetForm}
                style={{ 
                  flex: 0.3, 
                  padding: 15, 
                  background: '#6c757d', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: 8, 
                  cursor: 'pointer', 
                  fontSize: 16
                }}
              >
                초기화
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔥 개선된 내 촬영 요청 목록 */}
      <div style={{ 
        background: 'white', 
        borderRadius: 12, 
        padding: 30,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        border: '1px solid #e9ecef'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: 20 
        }}>
          <h2 style={{ margin: 0, color: '#495057', fontSize: 22 }}>
            내 촬영 요청 목록
          </h2>
          <div style={{ fontSize: 14, color: '#6c757d' }}>
            총 {totalRequestCount}건 중 {myRequests.length}건 표시
          </div>
        </div>

        {/* 🔥 검색 필터 UI */}
        <div style={{
          marginBottom: 20,
          padding: 15,
          backgroundColor: '#f8f9fa',
          borderRadius: 8,
          border: '1px solid #e9ecef'
        }}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr auto auto', 
            gap: 10,
            alignItems: 'end'
          }}>
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: 5, 
                fontSize: 14, 
                fontWeight: '600',
                color: '#495057'
              }}>
                시작날짜
              </label>
              <input
                type="date"
                value={searchFilters.start_date}
                onChange={(e) => setSearchFilters(prev => ({
                  ...prev,
                  start_date: e.target.value
                }))}
                style={{
                  width: '100%',
                  padding: 8,
                  border: '1px solid #ced4da',
                  borderRadius: 4,
                  fontSize: 14
                }}
              />
            </div>
            
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: 5, 
                fontSize: 14, 
                fontWeight: '600',
                color: '#495057'
              }}>
                종료날짜
              </label>
              <input
                type="date"
                value={searchFilters.end_date}
                onChange={(e) => setSearchFilters(prev => ({
                  ...prev,
                  end_date: e.target.value
                }))}
                style={{
                  width: '100%',
                  padding: 8,
                  border: '1px solid #ced4da',
                  borderRadius: 4,
                  fontSize: 14
                }}
              />
            </div>
            
            <button
              onClick={handleSearch}
              disabled={isSearching}
              style={{
                padding: '8px 16px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: isSearching ? 'not-allowed' : 'pointer',
                fontSize: 14,
                fontWeight: '500',
                opacity: isSearching ? 0.6 : 1
              }}
            >
              {isSearching ? '검색중...' : '검색'}
            </button>
            
            <button
              onClick={handleResetSearch}
              style={{
                padding: '8px 16px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: '500'
              }}
            >
              초기화
            </button>
          </div>
          
          {/* 검색 결과 안내 */}
          {(searchFilters.start_date || searchFilters.end_date) && (
            <div style={{ 
              marginTop: 10, 
              fontSize: 12, 
              color: '#6c757d',
              fontStyle: 'italic'
            }}>
              {searchFilters.start_date && `${searchFilters.start_date} 이후`}
              {searchFilters.start_date && searchFilters.end_date && ' ~ '}
              {searchFilters.end_date && `${searchFilters.end_date} 이전`}
              {' '}요청만 표시 중
            </div>
          )}
        </div>
        
        {/* 요청 목록 */}
        {myRequests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#6c757d' }}>
            {isSearching ? (
              '검색 중...'
            ) : (searchFilters.start_date || searchFilters.end_date) ? (
              '검색 조건에 맞는 촬영 요청이 없습니다.'
            ) : (
              '아직 등록된 촬영 요청이 없습니다.'
            )}
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gap: 15 }}>
              {myRequests.map((request, index) => {
                const statusInfo = getStatusInfo(request.approval_status);
                
                return (
                  <div 
                    key={request.id} 
                    style={{ 
                      padding: 20, 
                      border: request.is_split_schedule ? '2px solid #ff9800' : '2px solid #e9ecef',
                      borderRadius: 10,
                      background: '#f8f9fa',
                      transition: 'all 0.2s ease',
                      position: 'relative'
                    }}
                  >
                    {/* 🔥 분할 스케줄 표시 */}
                    {request.is_split_schedule && (
                      <div style={{
                        position: 'absolute',
                        top: 10,
                        left: 10,
                        backgroundColor: request.sequence_order === 1 ? '#4caf50' : '#ff9800',
                        color: 'white',
                        fontSize: '10px',
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontWeight: 'bold'
                      }}>
                        {request.sequence_order === 1 ? '1차 촬영' : '2차 촬영'}
                      </div>
                    )}

                    {/* 🔥 순번 표시 */}
                    <div style={{
                      position: 'absolute',
                      top: 10,
                      right: 10,
                      backgroundColor: '#007bff',
                      color: 'white',
                      borderRadius: '50%',
                      width: 24,
                      height: 24,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 'bold'
                    }}>
                      {searchFilters.offset + index + 1}
                    </div>

                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'flex-start', 
                      marginBottom: 15,
                      marginTop: request.is_split_schedule ? 20 : 0
                    }}>
                      <div>
                        <h3 style={{ margin: '0 0 8px 0', color: '#495057', fontSize: 18 }}>
                          {request.course_name || '강좌명 미입력'}
                          {request.is_split_schedule && (
                            <span style={{ 
                              fontSize: 12, 
                              color: '#ff9800',
                              marginLeft: 8,
                              fontWeight: 'normal'
                            }}>
                              (분할 스케줄)
                            </span>
                          )}
                        </h3>
                        <div style={{ color: '#6c757d', fontSize: 14 }}>
                          {request.shoot_date} | {request.start_time?.substring(0, 5)}~{request.end_time?.substring(0, 5)}
                        </div>
                      </div>
                      <span style={{
                        padding: '6px 12px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 'bold',
                        background: statusInfo.bg,
                        color: statusInfo.color
                      }}>
                        {statusInfo.text}
                      </span>
                    </div>
                    
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '1fr 1fr 1fr', 
                      gap: 15, 
                      fontSize: 14
                    }}>
                      <div>
                        <strong>촬영 형식:</strong> {request.shooting_type}
                      </div>
                      <div>
                        <strong>강좌코드:</strong> {request.course_code || '-'}
                      </div>
                      <div>
                        <strong>배정 스튜디오:</strong> {request.sub_locations?.name || '미배정'}
                      </div>
                    </div>

                    {/* 🔥 Break Time 정보 표시 */}
                    {request.break_time_enabled && (
                      <div style={{
                        marginTop: 12,
                        padding: 10,
                        backgroundColor: '#fff3cd',
                        borderRadius: 6,
                        border: '1px solid #ffeaa7'
                      }}>
                        <div style={{ fontSize: 13, color: '#856404', fontWeight: '600' }}>
                          🍽️ 휴식시간 정보
                        </div>
                        <div style={{ fontSize: 12, color: '#856404', marginTop: 4 }}>
                          {request.is_split_schedule ? '분할 촬영' : '연속 촬영'} | 
                          휴식시간: {request.break_start_time?.substring(0, 5)} ~ {request.break_end_time?.substring(0, 5)} 
                          ({request.break_duration_minutes}분)
                        </div>
                      </div>
                    )}
                    
                    {request.notes && (
                      <div style={{ 
                        marginTop: 12, 
                        padding: 12, 
                        background: 'white', 
                        borderRadius: 6, 
                        fontSize: 14 
                      }}>
                        <strong>전달사항:</strong> {request.notes}
                      </div>
                    )}
                    
                    <div style={{ 
                      marginTop: 12, 
                      fontSize: 12, 
                      color: '#6c757d' 
                    }}>
                      요청일시: {new Date(request.created_at).toLocaleString('ko-KR')}
                      {request.schedule_group_id && (
                        <span style={{ marginLeft: 12 }}>
                          그룹ID: {request.schedule_group_id}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 🔥 더 보기 버튼 */}
            {myRequests.length < totalRequestCount && (
              <div style={{ textAlign: 'center', marginTop: 20 }}>
                <button
                  onClick={handleLoadMore}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: '500'
                  }}
                >
                  더 보기 ({totalRequestCount - myRequests.length}건 더)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
