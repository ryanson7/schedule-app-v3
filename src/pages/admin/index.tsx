// pages/admin/index.tsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../utils/supabaseClient';
import { logger } from '../../utils/logger';

interface Stats {
  academySchedules: number;
  studioSchedules: number;
  studioUsage: number;
  shootingPeople: number;
  academyPending: number;
  studioPending: number;
  internal: number;
  academyHours: string;
  studioHours: string;
  totalUsedHours: string;
  totalAvailableHours: number;
  academyPeople: number;
  studioPeople: number;
}

interface TodayTask {
  id: number;
  schedule_type: string;
  content: string;
  shadow_color: string;
}

interface PendingItem {
  id: string;
  type: 'academy' | 'studio';
  title: string;
  date: string;
  originalId: number;
}

interface ErrorState {
  context: string;
  message: string;
}

interface AttendanceInfo {
  name: string;
  notes?: string;
}

interface LocationAttendance {
  locationName: string;
  displayOrder: number;
  people: AttendanceInfo[];
}

// ✅ 시간 포맷 함수 (09:00 → 9)
const formatTime = (time: string): string => {
  if (!time) return '';
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const minute = m === '00' ? '' : `:${m}`;
  return `${hour}${minute}`;
};

export default function AdminDashboard(): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [errorState, setErrorState] = useState<ErrorState | null>(null);
  const [stats, setStats] = useState<Stats>({
    academySchedules: 0, studioSchedules: 0, studioUsage: 0, 
    shootingPeople: 0, academyPending: 0, studioPending: 0, internal: 0,
    academyHours: '0.0', studioHours: '0.0', totalUsedHours: '0.0',
    totalAvailableHours: 150, academyPeople: 0, studioPeople: 0
  });
  const [todayTasks, setTodayTasks] = useState<TodayTask[]>([]);
  const [pendingList, setPendingList] = useState<PendingItem[]>([]);
  const [attendanceData, setAttendanceData] = useState<LocationAttendance[]>([]);
  const [dayOffPeople, setDayOffPeople] = useState<string[]>([]);
  const [eventTasks, setEventTasks] = useState<TodayTask[]>([]);
  const [earlyLeavePeople, setEarlyLeavePeople] = useState<string[]>([]); // ✅ 조기퇴근
  
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const router = useRouter();

  const formattedDate = useMemo(() => {
    const date = new Date(selectedDate);
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const weekday = weekdays[date.getDay()];
    return `${month}/${day}(${weekday})`;
  }, [selectedDate]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // ✅ 수정: 인증 후 바로 데이터 로딩
  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!loading) {
      loadDashboardData();
    }
  }, [selectedDate, loading]); // ✅ loading 의존성 추가

  const checkAuth = useCallback(() => {
    try {
      const userRole = localStorage.getItem('userRole');
      if (!['system_admin', 'admin', 'schedule_admin'].includes(userRole || '')) {
        logger.auth.warn('권한 없는 접근 시도', { userRole });
        alert('관리자 권한이 필요합니다.');
        router.push('/');
        return;
      }
      logger.auth.info('관리자 인증 완료', { userRole });
      setLoading(false);
      // ✅ 인증 완료 후 바로 로딩
      loadDashboardData();
    } catch (error) {
      logger.auth.error('인증 확인 오류', error);
      router.push('/');
    }
  }, [router]);

  const handleError = useCallback((error: any, context: string) => {
    logger.error(`${context} 오류`, error);
    
    const userMessage = error.message?.includes('network') 
      ? '네트워크 연결을 확인해주세요.' 
      : '일시적인 오류가 발생했습니다.';
      
    setErrorState({ context, message: userMessage });
    setTimeout(() => setErrorState(null), 5000);
  }, []);

  const safeCalculateDuration = useCallback((startTime: string, endTime: string): number => {
    try {
      if (!startTime || !endTime) return 0;
      
      const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
      if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) return 0;
      
      const [startHour, startMinute] = startTime.split(':').map(Number);
      const [endHour, endMinute] = endTime.split(':').map(Number);
      
      const startTotalMinutes = startHour * 60 + startMinute;
      const endTotalMinutes = endHour * 60 + endMinute;
      const durationMinutes = endTotalMinutes - startTotalMinutes;
      
      return durationMinutes > 0 ? durationMinutes / 60 : 0;
    } catch (error) {
      return 0;
    }
  }, []);

  const validateScheduleData = useCallback((data: any[]): boolean => {
    if (!Array.isArray(data)) return false;
    return data.every(item => 
      item && 
      typeof item.start_time === 'string' && 
      typeof item.end_time === 'string'
    );
  }, []);

  // ✅ 근태 현황 조회 (조기출근 + 조기퇴근 포함)
    const getAttendanceData = useCallback(async (dateString: string) => {
    try {
      logger.info('근태 현황 조회 시작', { date: dateString });
      
      const { data: schedules, error: scheduleError } = await supabase
        .from('schedules')
        .select(`
          id, 
          assigned_shooter_id, 
          schedule_type,
          sub_locations!inner (main_location_id)
        `)
        .eq('shoot_date', dateString)
        .not('assigned_shooter_id', 'is', null);

      if (scheduleError) throw scheduleError;

      const { data: allEmployees } = await supabase
        .from('users')
        .select('id, name, email, role')
        .eq('role', 'schedule_admin')
        .neq('email', 'schedule@eduwill.net')
        .neq('id', 2)
        .eq('is_active', true);

      const shooterIds = schedules?.map(s => s.assigned_shooter_id).filter(Boolean) || [];
      let employeeMap = new Map();
      let freelancerSet = new Set();
      let assignedEmployeeIds = new Set();
      
      if (shooterIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, name, email, role')
          .in('id', shooterIds);
        
        users?.forEach(u => {
          if (u.email === 'schedule@eduwill.net' || u.id === 2) return;
          
          if (u.role === 'freelancer' || u.role === 'shooter') {
            freelancerSet.add(u.id);
          } else if (u.role === 'schedule_admin') {
            employeeMap.set(u.id, u.name);
            assignedEmployeeIds.add(u.id);
          }
        });
      }

      const { data: internalTasks } = await supabase
        .from('internal_schedules')
        .select('*')
        .eq('schedule_date', dateString)
        .eq('is_active', true);

      const dayOffList: string[] = [];
      const eventList: TodayTask[] = [];
      const earlyLeaveList: string[] = []; // ✅ 조기퇴근 (사유 포함)
      const earlyArrivalMap = new Map<number, string>();
      const dayOffEmployeeIds = new Set<number>();
      const halfDayOffEmployeeIds = new Set<number>();

      internalTasks?.forEach((task: any) => {
        if (task.schedule_type === '개인휴무') {
          const leaveType = task.leave_type || '';
          const content = task.content || '';
          dayOffList.push(content);
          
          if (task.user_id) {
            if (leaveType === '반차') {
              halfDayOffEmployeeIds.add(task.user_id);
            } else {
              dayOffEmployeeIds.add(task.user_id);
            }
          }
        } else if (task.schedule_type === 'Helper') {
          if (task.helper_type === 'early_arrival' && task.user_id) {
            const timeStr = task.helper_time ? formatTime(task.helper_time) : '';
            earlyArrivalMap.set(task.user_id, `${timeStr}출`);
          } else if (task.helper_type === 'early_leave') {
            // ✅ 조기퇴근 사유 포함
            const reason = task.helper_reason ? ` (${task.helper_reason})` : '';
            earlyLeaveList.push(`${task.content || ''}${reason}`);
          }
        } else if (task.schedule_type === '기타' || task.schedule_type === '행사') {
          eventList.push({
            id: task.id,
            schedule_type: task.schedule_type,
            content: task.content || '',
            shadow_color: task.shadow_color || '#e0e0e0'
          });
        }
      });

      const attendanceMap = new Map<string, AttendanceInfo[]>();
      const freelancerLocationMap = new Map<string, boolean>();
      
      const locations = [
        '제작센터', '노량진(1관) 학원', '노량진(3관) 학원',
        '수원학원', '노원학원', '부평학원', '신촌학원', '강남학원', '서면학원'
      ];

      locations.forEach(loc => {
        attendanceMap.set(loc, []);
        freelancerLocationMap.set(loc, false);
      });

      schedules?.forEach((schedule: any) => {
        const userId = schedule.assigned_shooter_id;
        const isFreelancer = freelancerSet.has(userId);
        const userName = employeeMap.get(userId);
        
        if (dayOffEmployeeIds.has(userId) && !halfDayOffEmployeeIds.has(userId)) {
          return;
        }
        
        let locationName = '';
        
        if (schedule.schedule_type === 'studio') {
          locationName = '제작센터';
        } else if (schedule.schedule_type === 'academy') {
          const mainLocationId = schedule.sub_locations?.main_location_id;
          const mapping: Record<number, string> = {
            1: '노량진(1관) 학원', 2: '노량진(3관) 학원',
            3: '수원학원', 4: '노원학원', 5: '부평학원',
            6: '신촌학원', 7: '강남학원', 9: '서면학원'
          };
          locationName = mapping[mainLocationId] || '';
        }

        if (locationName) {
          if (isFreelancer) {
            freelancerLocationMap.set(locationName, true);
          } else if (userName) {
            const people = attendanceMap.get(locationName) || [];
            if (!people.find(p => p.name === userName)) {
              const earlyNote = earlyArrivalMap.get(userId);
              people.push({ 
                name: userName, 
                notes: earlyNote 
              });
              attendanceMap.set(locationName, people);
            }
          }
        }
      });

      internalTasks?.forEach((task: any) => {
        if (task.schedule_type === '당직') {
          const people = attendanceMap.get('제작센터') || [];
          if (!people.find(p => p.name === task.content)) {
            people.push({ name: task.content, notes: '당직' });
            attendanceMap.set('제작센터', people);
          }
        }
      });

      // ✅ 주말 판단 (토요일=6, 일요일=0)
      const selectedDay = new Date(dateString).getDay();
      const isWeekend = selectedDay === 0 || selectedDay === 6;

      allEmployees?.forEach(emp => {
        const isAssigned = assignedEmployeeIds.has(emp.id);
        const isDayOff = dayOffEmployeeIds.has(emp.id) && !halfDayOffEmployeeIds.has(emp.id);
        
        if (!isAssigned && !isDayOff) {
          // ✅ 주말이면 휴무자로 처리
          if (isWeekend) {
            if (!dayOffList.includes(emp.name)) {
              dayOffList.push(emp.name);
            }
          } else {
            // 평일이면 제작센터에 배치
            const people = attendanceMap.get('제작센터') || [];
            if (!people.find(p => p.name === emp.name)) {
              const earlyNote = earlyArrivalMap.get(emp.id);
              people.push({ 
                name: emp.name,
                notes: earlyNote
              });
              attendanceMap.set('제작센터', people);
            }
          }
        }
      });

      const result = locations.map((loc, idx) => {
        const people = attendanceMap.get(loc) || [];
        const hasFree = freelancerLocationMap.get(loc) || false;
        
        return {
          locationName: loc,
          displayOrder: idx + 1,
          people: people.length === 0 && hasFree ? [{ name: '위탁직' }] : people
        };
      });

      return { 
        attendance: result, 
        dayOff: dayOffList, 
        events: eventList,
        earlyLeave: earlyLeaveList
      };

    } catch (error) {
      console.error('❌ 근태 조회 에러:', error);
      handleError(error, '근태 현황 조회');
      return { attendance: [], dayOff: [], events: [], earlyLeave: [] };
    }
  }, [handleError]);


  // ✅ 나머지 함수들은 동일...
  const getScheduleCountWithShooters = useCallback(async (dateString: string) => {
    try {
      const [academyResult, studioResult] = await Promise.all([
        supabase
          .from('schedules')
          .select('id, assigned_shooter_id, start_time, end_time, schedule_type')
          .eq('shoot_date', dateString)
          .not('assigned_shooter_id', 'is', null)
          .eq('schedule_type', 'academy'),
        
        supabase
          .from('schedules')
          .select('id, assigned_shooter_id, start_time, end_time, schedule_type')
          .eq('shoot_date', dateString)
          .not('assigned_shooter_id', 'is', null)
          .eq('schedule_type', 'studio')
      ]);

      if (academyResult.error) throw academyResult.error;
      if (studioResult.error) throw studioResult.error;

      const academyData = academyResult.data || [];
      const studioData = studioResult.data || [];

      if (!validateScheduleData(academyData) || !validateScheduleData(studioData)) {
        throw new Error('Invalid schedule data format');
      }
      
      let academyTotalHours = 0;
      academyData.forEach(schedule => {
        academyTotalHours += safeCalculateDuration(schedule.start_time, schedule.end_time);
      });
      
      let studioTotalHours = 0;
      studioData.forEach(schedule => {
        studioTotalHours += safeCalculateDuration(schedule.start_time, schedule.end_time);
      });
      
      return {
        academyCount: academyData.length,
        studioCount: studioData.length,
        academyHours: academyTotalHours.toFixed(1),
        studioHours: studioTotalHours.toFixed(1),
        totalUsedHours: (academyTotalHours + studioTotalHours).toFixed(1),
        academyData,
        studioData
      };
      
    } catch (error) {
      handleError(error, '스케줄 카운팅');
      return {
        academyCount: 0,
        studioCount: 0,
        academyHours: '0.0',
        studioHours: '0.0',
        totalUsedHours: '0.0',
        academyData: [],
        studioData: []
      };
    }
  }, [safeCalculateDuration, validateScheduleData, handleError]);

  const calculateStudioUsageRate = useCallback((totalUsedHours: string) => {
    try {
      const operatingHours = 10;
      const studioCount = 15;
      const totalAvailableHours = operatingHours * studioCount;
      
      const usedHours = parseFloat(totalUsedHours) || 0;
      const usageRate = Math.round((usedHours / totalAvailableHours) * 100);
      const finalRate = Math.min(usageRate, 100);
      
      return {
        rate: finalRate,
        totalAvailable: totalAvailableHours,
        totalUsed: usedHours
      };
    } catch (error) {
      return {
        rate: 0,
        totalAvailable: 150,
        totalUsed: 0
      };
    }
  }, []);

  const getShootingPeopleCount = useCallback((academyData: any[], studioData: any[]) => {
    try {
      const academyPeople = academyData?.length || 0;
      const studioPeople = studioData?.length || 0;
      
      return {
        academyPeople,
        studioPeople,
        totalPeople: academyPeople + studioPeople
      };
    } catch (error) {
      return {
        academyPeople: 0,
        studioPeople: 0,
        totalPeople: 0
      };
    }
  }, []);

  // ✅ 승인대기 목록 (DB 기반, 하드코딩 제거)
  const getPendingApprovalList = useCallback(async (): Promise<PendingItem[]> => {
    try {
      const [academyResult, studioResult] = await Promise.all([
        supabase
          .from('schedules')
          .select('id, professor_name, shoot_date, sub_location_id')
          .eq('approval_status', 'pending')
          .eq('schedule_type', 'academy')
          .order('shoot_date', { ascending: true })
          .limit(10),
        
        supabase
          .from('schedules')
          .select('id, professor_name, course_name, shoot_date')
          .eq('approval_status', 'pending')
          .eq('schedule_type', 'studio')
          .order('shoot_date', { ascending: true })
          .limit(10)
      ]);

      if (academyResult.error) throw academyResult.error;
      if (studioResult.error) throw studioResult.error;

      const combined: PendingItem[] = [];
      
      academyResult.data?.forEach(item => {
        combined.push({
          id: `academy_${item.id}`,
          type: 'academy',
          title: `${item.professor_name} - 스튜디오 ${item.sub_location_id}`,
          date: item.shoot_date,
          originalId: item.id
        });
      });

      studioResult.data?.forEach(item => {
        combined.push({
          id: `studio_${item.id}`,
          type: 'studio', 
          title: `${item.professor_name} - ${item.course_name}`,
          date: item.shoot_date,
          originalId: item.id
        });
      });

      return combined.sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
    } catch (error) {
      handleError(error, '승인 대기 목록 조회');
      return [];
    }
  }, [handleError]);

  const loadDashboardData = useCallback(async () => {
    try {
      logger.info('대시보드 데이터 로딩 시작', { date: selectedDate });
      
      const [
        internalResult,
        scheduleResult,
        pendingResult,
        attendanceResult
      ] = await Promise.all([
        supabase
          .from('internal_schedules')
          .select('*')
          .eq('schedule_date', selectedDate)
          .eq('is_active', true),
        
        getScheduleCountWithShooters(selectedDate),
        getPendingApprovalList(),
        getAttendanceData(selectedDate)
      ]);

      if (internalResult.error) throw internalResult.error;

      const usageData = calculateStudioUsageRate(scheduleResult.totalUsedHours);
      const peopleData = getShootingPeopleCount(scheduleResult.academyData, scheduleResult.studioData);
      
      setTodayTasks(internalResult.data || []);
      setStats({
        academySchedules: scheduleResult.academyCount,
        studioSchedules: scheduleResult.studioCount,
        shootingPeople: peopleData.totalPeople,
        academyHours: scheduleResult.academyHours,
        studioHours: scheduleResult.studioHours,
        totalUsedHours: scheduleResult.totalUsedHours,
        totalAvailableHours: usageData.totalAvailable,
        academyPeople: peopleData.academyPeople,
        studioPeople: peopleData.studioPeople,
        studioUsage: usageData.rate,
        academyPending: 0,
        studioPending: 0,
        internal: internalResult.data?.length || 0
      });
      setPendingList(pendingResult);
      
      setAttendanceData(attendanceResult.attendance);
      setDayOffPeople(attendanceResult.dayOff);
      setEventTasks(attendanceResult.events);
      setEarlyLeavePeople(attendanceResult.earlyLeave); // ✅ 조기퇴근

      logger.info('대시보드 데이터 로딩 완료');

    } catch (error) {
      handleError(error, '대시보드 데이터 로딩');
    }
  }, [selectedDate, getScheduleCountWithShooters, calculateStudioUsageRate, getShootingPeopleCount, getPendingApprovalList, getAttendanceData, handleError]);

  const handleStatCardClick = useCallback((type: string) => {
    switch (type) {
      case 'academy':
        router.push('/academy-schedules');
        break;
      case 'studio':
        router.push('/studio-admin');
        break;
    }
  }, [router]);

  const handleTodayScheduleClick = useCallback(() => {
    router.push('/daily');
  }, [router]);

  // ✅ 승인대기 클릭 시 해당 스케줄로 이동
  const handlePendingClick = useCallback((item: PendingItem) => {
    if (item.type === 'academy') {
      router.push(`/academy-schedules?scheduleId=${item.originalId}`);
    } else {
      router.push(`/studio-admin?scheduleId=${item.originalId}`);
    }
  }, [router]);

  const handleDateChange = useCallback((direction: 'prev' | 'next' | 'today') => {
    const currentDate = new Date(selectedDate);
    
    if (direction === 'prev') {
      currentDate.setDate(currentDate.getDate() - 1);
    } else if (direction === 'next') {
      currentDate.setDate(currentDate.getDate() + 1);
    } else if (direction === 'today') {
      setSelectedDate(new Date().toISOString().split('T')[0]);
      return;
    }
    
    setSelectedDate(currentDate.toISOString().split('T')[0]);
  }, [selectedDate]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid #e5e7eb', borderTop: '4px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}>
          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', padding: isMobile ? '16px' : '20px' }}>
      {errorState && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: '#ef4444',
          color: 'white',
          padding: '12px 16px',
          borderRadius: '8px',
          zIndex: 1000,
          maxWidth: '300px',
          fontSize: '14px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
          <strong>{errorState.context}</strong><br />
          {errorState.message}
        </div>
      )}

      <div className="admin-dashboard">
        {/* ✅ 헤더 (날짜 버튼 개선) */}
        <div className="header">
          <div className="header-content">
            <div className="header-left">
              <h1>관리자 대시보드</h1>
              <span className="date">
                {new Date().toLocaleDateString('ko-KR', { 
                  month: isMobile ? 'short' : 'long', 
                  day: 'numeric', 
                  weekday: 'short' 
                })}
              </span>
              {/* ✅ 날짜 네비게이션 개선 */}
              <div className="date-navigation">
                <button className="date-nav-btn" onClick={() => handleDateChange('prev')}>
                  <span>◀</span>
                </button>
                <div className="selected-date">{formattedDate}</div>
                <button className="date-nav-btn" onClick={() => handleDateChange('next')}>
                  <span>▶</span>
                </button>
                <button className="date-nav-btn today" onClick={() => handleDateChange('today')}>오늘</button>
              </div>
            </div>
            <button className="today-schedule-btn" onClick={handleTodayScheduleClick}>
              {isMobile ? '📅 오늘 스케줄' : '📅 오늘 스케줄 보기'}
            </button>
          </div>
        </div>

        {/* ✅ 상단 4개 카드 (이모티콘 삭제, 사이즈 축소) */}
        <div className="stats-row">
          <div className="stat-card academy clickable" onClick={() => handleStatCardClick('academy')}>
            <div className="stat-content">
              <div className="stat-number">{stats.academySchedules}</div>
              <div className="stat-label">{isMobile ? '학원' : '학원 스케줄'}</div>
              <div className="stat-hours">{stats.academyHours}h</div>
            </div>
          </div>

          <div className="stat-card studio clickable" onClick={() => handleStatCardClick('studio')}>
            <div className="stat-content">
              <div className="stat-number">{stats.studioSchedules}</div>
              <div className="stat-label">{isMobile ? '스튜디오' : '스튜디오 스케줄'}</div>
              <div className="stat-hours">{stats.studioHours}h</div>
            </div>
          </div>

          <div className="stat-card usage">
            <div className="stat-content">
              <div className="stat-number">{stats.studioUsage}%</div>
              <div className="stat-label">{isMobile ? '가동률' : '스튜디오 가동률'}</div>
              <div className="stat-hours">{stats.totalUsedHours}/{stats.totalAvailableHours}h</div>
            </div>
          </div>

          <div className="stat-card people">
            <div className="stat-content">
              <div className="stat-number">{stats.shootingPeople}</div>
              <div className="stat-label">{isMobile ? '촬영인원' : '촬영 인원'}</div>
              <div className="stat-hours">{stats.academyPeople} + {stats.studioPeople}</div>
            </div>
          </div>
        </div>

        {/* 2x2 그리드 */}
        <div className="main-content-grid">
          {/* 왼쪽 상단: 직원 촬영 및 근태 현황 */}
          <div className="panel">
            <h3>👥 직원 촬영 및 근태 현황</h3>
            <div className="attendance-content">
              <div className="attendance-list compact">
                {[
                  '제작센터',
                  '노량진(1관) 학원',
                  '노량진(3관) 학원',
                  '수원학원',
                  '노원학원',
                  '부평학원',
                  '신촌학원',
                  '강남학원',
                  '서면학원'
                ].map((locationName, index) => {
                  const locationData = attendanceData.find((loc) => loc.locationName === locationName);
                  const people = locationData?.people || [];

                  return (
                    <div key={index} className="attendance-row">
                      <span className="location-number">{String(index + 1).padStart(2, '0')}</span>
                      <span className="location-name">{locationName}</span>
                      <span className="location-staff">
                        {people.length === 0 ? (
                          <span className="no-staff">없음</span>
                        ) : (
                          people.map((person, idx) => (
                            <React.Fragment key={idx}>
                              {person.name === '위탁직' ? (
                                <span className="outsourced-tag">{person.name}</span>
                              ) : (
                                person.name
                              )}
                              {person.notes && <span className="staff-note">({person.notes})</span>}
                              {idx < people.length - 1 && ((idx + 1) % 6 === 0 ? <br /> : ', ')}
                            </React.Fragment>
                          ))
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 오른쪽 상단: 오늘의 업무 */}
          <div className="panel">
            <div className="panel-header">
              <h3>📝 오늘의 업무</h3>
              <button className="link-btn" onClick={() => router.push('/internal-schedules')}>
                {isMobile ? '➕' : '업무 관리'}
              </button>
            </div>
            <div className="task-list compact">
              {/* ✅ 휴무자 (한 줄 표기) */}
              {dayOffPeople.length > 0 && (
                <div className="task-section">
                  <div className="task-section-title">🏖️ 휴무자</div>
                  <div className="task-single-line">
                    {dayOffPeople.join(', ')}
                  </div>
                </div>
              )}

              {/* ✅ 조기퇴근 (사유 포함) */}
              {earlyLeavePeople.length > 0 && (
                <div className="task-section">
                  <div className="task-section-title">🚪 조기퇴근</div>
                  {earlyLeavePeople.map((person, idx) => (
                    <div key={`leave-${idx}`} className="task-item small">
                      <div className="task-dot leave"></div>
                      <span className="task-content">{person}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* 기타 업무 */}
              {eventTasks.length > 0 && (
                <div className="task-section">
                  <div className="task-section-title">📋 기타 업무</div>
                  {eventTasks.map((task) => (
                    <div key={task.id} className="task-item">
                      <div className="task-dot" style={{ backgroundColor: task.shadow_color || '#666' }}></div>
                      <div className="task-info">
                        <span className="task-type">{task.schedule_type}</span>
                        <span className="task-content">{task.content}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {eventTasks.length === 0 && dayOffPeople.length === 0 && earlyLeavePeople.length === 0 && (
                <div className="empty-state small">
                  <p>오늘 등록된 업무가 없습니다.</p>
                </div>
              )}
            </div>
          </div>

          {/* 왼쪽 하단: 학원 승인대기 */}
          <div className="panel">
            <h3>🏫 학원 승인대기 ({pendingList.filter(p => p.type === 'academy').length})</h3>
            {pendingList.filter(p => p.type === 'academy').length === 0 ? (
              <div className="empty-state small">
                <p>승인 대기 중인 학원 스케줄이 없습니다.</p>
              </div>
            ) : (
              <div className="approval-list compact">
                {pendingList.filter(p => p.type === 'academy').map((item) => (
                  <div 
                    key={item.id} 
                    className="approval-item compact academy"
                    onClick={() => handlePendingClick(item)}
                  >
                    <div className="approval-content">
                      <div className="approval-title">{item.title}</div>
                      <div className="approval-date">{item.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 오른쪽 하단: 스튜디오 승인대기 */}
          <div className="panel">
            <h3>🎥 스튜디오 승인대기 ({pendingList.filter(p => p.type === 'studio').length})</h3>
            {pendingList.filter(p => p.type === 'studio').length === 0 ? (
              <div className="empty-state small">
                <p>승인 대기 중인 스튜디오 스케줄이 없습니다.</p>
              </div>
            ) : (
              <div className="approval-list compact">
                {pendingList.filter(p => p.type === 'studio').map((item) => (
                  <div 
                    key={item.id} 
                    className="approval-item compact studio"
                    onClick={() => handlePendingClick(item)}
                  >
                    <div className="approval-content">
                      <div className="approval-title">{item.title}</div>
                      <div className="approval-date">{item.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        .admin-dashboard {
          max-width: 1200px;
          margin: 0 auto;
        }

        .header {
          margin-bottom: ${isMobile ? '20px' : '24px'};
          padding-bottom: ${isMobile ? '12px' : '16px'};
          border-bottom: 2px solid #e9ecef;
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          ${isMobile ? 'flex-direction: column; gap: 12px;' : ''}
        }

        .header-left {
          display: flex;
          ${isMobile ? 'flex-direction: column; align-items: center; gap: 8px;' : 'align-items: center; gap: 16px; flex-wrap: wrap;'}
        }

        .header h1 {
          font-size: ${isMobile ? '22px' : '28px'};
          font-weight: 700;
          color: #2c3e50;
          margin: 0;
        }

        .date {
          color: #6c757d;
          font-size: ${isMobile ? '13px' : '14px'};
          font-weight: 500;
        }

        /* ✅ 날짜 네비게이션 (간격 넓게) */
        .date-navigation {
          display: flex;
          gap: 10px;
          align-items: center;
          background: white;
          padding: 6px 12px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.08);
        }

        .date-nav-btn {
          background: white;
          border: 1px solid #dee2e6;
          padding: 6px 14px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          color: #495057;
          transition: all 0.2s ease;
          min-width: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .date-nav-btn:hover {
          background: #f8f9fa;
          border-color: #adb5bd;
          transform: scale(1.05);
        }

        .date-nav-btn.today {
          background: #007bff;
          color: white;
          border-color: #007bff;
        }

        .date-nav-btn.today:hover {
          background: #0056b3;
        }

        .selected-date {
          font-size: 14px;
          font-weight: 700;
          color: #2c3e50;
          min-width: 90px;
          text-align: center;
          padding: 0 8px;
        }

        .today-schedule-btn {
          background: #007bff;
          color: white;
          border: none;
          padding: ${isMobile ? '8px 16px' : '10px 18px'};
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(0, 123, 255, 0.3);
        }

        .today-schedule-btn:hover {
          background: #0056b3;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 123, 255, 0.4);
        }

        /* ✅ 상단 카드 (이모티콘 삭제, 사이즈 축소) */
        .stats-row {
          display: grid;
          grid-template-columns: ${isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)'};
          gap: ${isMobile ? '12px' : '16px'};
          margin-bottom: ${isMobile ? '20px' : '24px'};
        }

        .stat-card {
          background: white;
          border-radius: 10px;
          padding: ${isMobile ? '16px' : '18px'};
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
          border-left: 4px solid var(--color);
          transition: all 0.2s ease;
          cursor: pointer;
          text-align: center;
        }

        .stat-card:hover {
          transform: ${isMobile ? 'scale(0.98)' : 'translateY(-3px)'};
          box-shadow: 0 6px 16px rgba(0,0,0,0.12);
        }

        .stat-card.academy { --color: #007bff; }
        .stat-card.studio { --color: #28a745; }
        .stat-card.usage { --color: #17a2b8; }
        .stat-card.people { --color: #ffc107; }

        .stat-number {
          font-size: ${isMobile ? '28px' : '32px'};
          font-weight: 700;
          color: #2c3e50;
          margin-bottom: 6px;
        }

        .stat-label {
          color: #6c757d;
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 6px;
        }

        .stat-hours {
          font-size: 12px;
          color: var(--color);
          font-weight: 600;
        }

        .main-content-grid {
          display: grid;
          grid-template-columns: ${isMobile ? '1fr' : '1fr 1fr'};
          gap: ${isMobile ? '16px' : '20px'};
        }

        .panel {
          background: white;
          border-radius: 12px;
          padding: ${isMobile ? '16px' : '20px'};
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
        }

        .panel h3 {
          margin: 0 0 16px 0;
          font-size: ${isMobile ? '16px' : '17px'};
          font-weight: 600;
          color: #2c3e50;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .panel-header h3 {
          margin: 0;
        }

        .link-btn {
          background: none;
          border: none;
          color: #007bff;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
        }

        .link-btn:hover {
          color: #0056b3;
          text-decoration: underline;
        }

        /* ✅ 근태 리스트 (7개마다 줄바꿈, 상하 간격 좁게) */
        .attendance-list.compact {
          display: flex;
          flex-direction: column;
          gap: 4px;
          max-height: 400px;
          overflow-y: auto;
        }

        .attendance-row {
          display: flex;
          gap: 10px;
          padding: 5px 8px;
          background: #f8f9fa;
          border-radius: 6px;
          font-size: 14px;
          line-height: 1.6;
        }

        .location-number {
          font-weight: 700;
          color: #495057;
          min-width: 24px;
          flex-shrink: 0;
        }

        .location-name {
          font-weight: 600;
          color: #2c3e50;
          min-width: ${isMobile ? '80px' : '120px'};
          flex-shrink: 0;
        }

        .location-staff {
          flex: 1;
          color: #495057;
          line-height: 1.8;
        }

        .staff-note {
          color: #6c757d;
          font-size: 13px;
          margin-left: 3px;
        }

        .no-staff {
          color: #adb5bd;
        }

        .outsourced-tag {
          color: #6c757d;
          font-style: italic;
        }

        .task-list.compact {
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-height: 400px;
          overflow-y: auto;
        }

        .task-section {
          margin-bottom: 8px;
        }

        .task-section-title {
          font-size: 13px;
          font-weight: 600;
          color: #2c3e50;
          margin-bottom: 8px;
          padding-bottom: 4px;
          border-bottom: 1px solid #e9ecef;
        }

        /* ✅ 휴무자 한 줄 표기 */
        .task-single-line {
          font-size: 14px;
          color: #495057;
          padding: 6px 0;
          line-height: 1.6;
        }

        .task-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 0;
          border-bottom: 1px solid #f3f4f6;
        }

        .task-item.small {
          padding: 4px 0;
        }

        .task-item:last-child {
          border-bottom: none;
        }

        .task-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .task-dot.off {
          background: #dc3545;
        }

        .task-dot.leave {
          background: #ffc107;
        }

        .task-info {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .task-type {
          font-size: 11px;
          font-weight: 600;
          color: #495057;
          background: #e9ecef;
          padding: 2px 8px;
          border-radius: 12px;
        }

        .task-content {
          font-size: 13px;
          color: #6c757d;
        }

        .approval-list.compact {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 350px;
          overflow-y: auto;
        }

        .approval-item.compact {
          padding: 10px 12px;
          background: #f8f9fa;
          border-radius: 8px;
          border-left: 3px solid var(--type-color);
          cursor: pointer;
          transition: all 0.2s;
        }

        .approval-item.compact:hover {
          background: #e9ecef;
          transform: translateX(3px);
        }

        .approval-item.academy { --type-color: #007bff; }
        .approval-item.studio { --type-color: #28a745; }

        .approval-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }

        .approval-title {
          flex: 1;
          font-weight: 500;
          color: #2c3e50;
          font-size: 13px;
        }

        .approval-date {
          font-size: 11px;
          color: #6c757d;
          white-space: nowrap;
        }

        .empty-state.small {
          text-align: center;
          padding: 40px 20px;
          color: #6c757d;
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}