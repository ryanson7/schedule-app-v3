// pages/admin/index.tsx - 최종 완성 버전 (렌더링 수정)
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

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!loading) {
      loadDashboardData();
    }
  }, [selectedDate]);

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

const getAttendanceData = useCallback(async (dateString: string) => {
  try {
    logger.info('근태 현황 조회 시작', { date: dateString });
    
    // 1. 스케줄 조회 (sub_locations와 조인하여 main_location_id 가져오기)
    const { data: schedules, error: scheduleError } = await supabase
      .from('schedules')
      .select(`
        id, 
        assigned_shooter_id, 
        schedule_type, 
        start_time,
        sub_location_id,
        sub_locations!inner (
          main_location_id
        )
      `)
      .eq('shoot_date', dateString)
      .not('assigned_shooter_id', 'is', null);

    if (scheduleError) {
      console.error('❌ 스케줄 조회 에러:', scheduleError);
      throw scheduleError;
    }

    console.log('✅ 조회된 스케줄:', schedules);

    // 2. 유저 정보 조회
    const shooterIds = schedules?.map(s => s.assigned_shooter_id).filter(Boolean) || [];
    let employeeMap = new Map();
    let freelancerSet = new Set();
    
    if (shooterIds.length > 0) {
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('id, name, role')
        .in('id', shooterIds);
      
      if (userError) {
        console.error('❌ 유저 조회 에러:', userError);
      }
      
      users?.forEach(u => {
        if (u.role === 'freelancer' || u.role === 'shooter') {
          freelancerSet.add(u.id);
          console.log('🔵 프리랜서 발견:', u.name, u.role);
        } else {
          employeeMap.set(u.id, u.name);
        }
      });
      
      console.log('✅ 직원:', employeeMap);
      console.log('🔵 프리랜서:', freelancerSet);
    }

    // 3. 내부업무 조회
    const { data: internalTasks, error: internalError } = await supabase
      .from('internal_schedules')
      .select('*')
      .eq('schedule_date', dateString)
      .eq('is_active', true)
      .in('schedule_type', ['개인휴무', '당직']);

    if (internalError) throw internalError;

    const attendanceMap = new Map<string, AttendanceInfo[]>();
    const freelancerLocationMap = new Map<string, boolean>();
    
    const defaultLocations = [
      '제작센터',
      '노량진(1관) 학원',
      '노량진(3관) 학원',
      '수원학원',
      '노원학원',
      '부평학원',
      '신촌학원',
      '강남학원',
      '서면학원'
    ];

    defaultLocations.forEach(loc => {
      attendanceMap.set(loc, []);
      freelancerLocationMap.set(loc, false);
    });

    // 4. 스케줄 처리 - main_location_id로 직접 매칭
    schedules?.forEach((schedule: any) => {
      const isFreelancer = freelancerSet.has(schedule.assigned_shooter_id);
      const userName = employeeMap.get(schedule.assigned_shooter_id);
      let locationName = '';
      
      if (schedule.schedule_type === 'studio') {
        locationName = '제작센터';
      } else if (schedule.schedule_type === 'academy' && schedule.sub_locations?.main_location_id) {
        const mainLocationId = schedule.sub_locations.main_location_id;
        
        // main_location_id로 직접 매칭
        switch (mainLocationId) {
          case 1:
            locationName = '노량진(1관) 학원';
            break;
          case 2:
            locationName = '노량진(3관) 학원';
            break;
          case 3:
            locationName = '수원학원';
            break;
          case 4:
            locationName = '노원학원';
            break;
          case 5:
            locationName = '부평학원';
            break;
          case 6:
            locationName = '신촌학원';
            break;
          case 7:
            locationName = '강남학원';
            break;
          case 9:
            locationName = '서면학원';
            break;
        }
        
        console.log(`🔍 main_location_id: ${mainLocationId} → ${locationName}`);
      }

      if (locationName) {
        if (isFreelancer) {
          freelancerLocationMap.set(locationName, true);
          console.log(`🔵 ${locationName}에 프리랜서 배치됨`);
        } else if (userName) {
          const currentPeople = attendanceMap.get(locationName) || [];
          if (!currentPeople.find(p => p.name === userName)) {
            const notes: string[] = [];
            
            if (schedule.start_time) {
              const [hour, minute] = schedule.start_time.split(':').map(Number);
              if (hour === 9 && minute === 0) {
                notes.push('9출');
              } else if (hour === 8 && minute === 30) {
                notes.push('8:30출');
              }
            }

            currentPeople.push({
              name: userName,
              notes: notes.length > 0 ? notes.join(', ') : undefined
            });
            attendanceMap.set(locationName, currentPeople);
            console.log(`✅ ${locationName}에 ${userName} 추가 (직원)`);
          }
        }
      }
    });

    // 5. 내부업무 처리
    const dayOffList: string[] = [];

    internalTasks?.forEach((task: any) => {
      if (task.schedule_type === '개인휴무') {
        dayOffList.push(task.content || '이름 없음');
      } else if (task.schedule_type === '당직') {
        const centerPeople = attendanceMap.get('제작센터') || [];
        if (!centerPeople.find(p => p.name === task.content)) {
          centerPeople.push({
            name: task.content || '이름 없음',
            notes: '당직'
          });
          attendanceMap.set('제작센터', centerPeople);
        }
      }
    });

    // 6. 최종 결과 생성 (하드코딩 완전 제거)
    const result: LocationAttendance[] = defaultLocations.map((location, index) => {
      const people = attendanceMap.get(location) || [];
      const hasFreelancer = freelancerLocationMap.get(location) || false;
      
      // 직원이 없고 프리랜서만 있는 경우 "위탁직" 표시
      if (people.length === 0 && hasFreelancer) {
        return {
          locationName: location,
          displayOrder: index + 1,
          people: [{ name: '위탁직' }]
        };
      }
      
      // 직원이 있으면 직원만 표시, 없으면 빈 배열
      return {
        locationName: location,
        displayOrder: index + 1,
        people: people
      };
    });

    console.log('✅ 최종 결과:', result);

    logger.info('근태 현황 조회 완료', { 
      locations: result.length,
      dayOff: dayOffList.length
    });

    return { attendance: result, dayOff: dayOffList };

  } catch (error) {
    console.error('❌ 근태 현황 조회 에러:', error);
    handleError(error, '근태 현황 조회');
    
    const defaultLocations = [
      '제작센터', '노량진(1관) 학원', '노량진(3관) 학원',
      '수원학원', '노원학원', '부평학원', '신촌학원', '강남학원', '서면학원'
    ];
    
    const emptyResult: LocationAttendance[] = defaultLocations.map((location, index) => ({
      locationName: location,
      displayOrder: index + 1,
      people: []
    }));
    
    return { attendance: emptyResult, dayOff: [] };
  }
}, [handleError]);


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

  const getPendingApprovalList = useCallback(async (): Promise<PendingItem[]> => {
    try {
      const [academyResult, studioResult] = await Promise.all([
        supabase
          .from('schedules')
          .select('id, professor_name, shoot_date, sub_location_id')
          .eq('approval_status', 'pending')
          .eq('schedule_type', 'academy')
          .limit(5),
        
        supabase
          .from('schedules')
          .select('id, professor_name, course_name, shoot_date')
          .eq('approval_status', 'pending')
          .eq('schedule_type', 'studio')
          .limit(5)
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
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh',
        backgroundColor: '#f8fafc'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #e5e7eb',
          borderTop: '4px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      padding: isMobile ? '16px' : '20px'
    }}>
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
            </div>
            <button 
              className="today-schedule-btn"
              onClick={handleTodayScheduleClick}
            >
              {isMobile ? '📅 오늘' : '📅 오늘 스케줄 보기'}
            </button>
          </div>
        </div>

        <div className="stats-row">
          <div 
            className="stat-card academy clickable"
            onClick={() => handleStatCardClick('academy')}
          >
            <div className="stat-content">
              <div className="stat-number">{stats.academySchedules}</div>
              <div className="stat-label">{isMobile ? '학원' : '학원 촬영'}</div>
              {isMobile ? (
                <div className="stat-hours">{stats.academyHours}h</div>
              ) : (
                <div className="stat-details">
                  <div className="stat-time">{stats.academyHours}시간</div>
                  <div className="stat-link">학원 스케줄로 이동 →</div>
                </div>
              )}
            </div>
          </div>

          <div 
            className="stat-card studio clickable"
            onClick={() => handleStatCardClick('studio')}
          >
            <div className="stat-content">
              <div className="stat-number">{stats.studioSchedules}</div>
              <div className="stat-label">{isMobile ? '스튜디오' : '스튜디오 촬영'}</div>
              {isMobile ? (
                <div className="stat-hours">{stats.studioHours}h</div>
              ) : (
                <div className="stat-details">
                  <div className="stat-time">{stats.studioHours}시간</div>
                  <div className="stat-link">스튜디오 스케줄로 이동 →</div>
                </div>
              )}
            </div>
          </div>

          <div className="stat-card usage">
            <div className="stat-content">
              <div className="stat-number">{stats.studioUsage}%</div>
              <div className="stat-label">{isMobile ? '스튜디오 사용률' : '스튜디오 사용률'}</div>
              {isMobile ? (
                <div className="stat-hours">{stats.totalUsedHours}/{stats.totalAvailableHours}h</div>
              ) : (
                <div className="stat-details">
                  <div className="usage-detail">
                    {stats.totalUsedHours}시간 / {stats.totalAvailableHours}시간
                  </div>
                  <div className="stat-description">15개 스튜디오 기준</div>
                </div>
              )}
            </div>
          </div>

          <div className="stat-card people">
            <div className="stat-content">
              <div className="stat-number">{stats.shootingPeople}명</div>
              <div className="stat-label">{isMobile ? '촬영인원' : '촬영 인원'}</div>
              {isMobile ? (
                <div className="stat-hours">학원{stats.academyPeople} · 스튜디오{stats.studioPeople}</div>
              ) : (
                <div className="stat-details">
                  <div className="people-detail">
                    학원 {stats.academyPeople}명 · 스튜디오 {stats.studioPeople}명
                  </div>
                  <div className="stat-description">오늘 배치된 전체 인원</div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="main-content-grid">
          <div className="panel">
            <h3>승인 대기 목록</h3>
            {pendingList.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">✅</div>
                <p>승인 대기 건이 없습니다.</p>
              </div>
            ) : (
              <div className="approval-list">
                {pendingList.map(item => (
                  <div key={item.id} className={`approval-item ${item.type}`}>
                    <div className="approval-type">
                      {item.type === 'academy' ? (isMobile ? '학원' : '🎓 학원') : (isMobile ? '스튜디오' : '🏢 스튜디오')}
                    </div>
                    <div className="approval-content">
                      <div className="approval-title">{item.title}</div>
                      <div className="approval-date">{item.date}</div>
                    </div>
                    <button 
                      className="approve-btn"
                      onClick={() => {
                        if (item.type === 'academy') {
                          router.push('/academy-schedules');
                        } else {
                          router.push('/studio-admin');
                        }
                      }}
                    >
                      {isMobile ? '관리' : (item.type === 'academy' ? '학원 관리' : '스튜디오 관리')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="panel">
            <div className="panel-header">
              <h3>📅 내부업무 ({stats.internal}건)</h3>
              <button 
                className="link-btn"
                onClick={() => router.push('/internal-schedules')}
              >
                {isMobile ? '전체' : '전체보기'} →
              </button>
            </div>
            {todayTasks.length === 0 ? (
              <div className="empty-state small">
                <p>{isMobile ? '내부업무가 없습니다.' : '오늘 예정된 내부업무가 없습니다.'}</p>
              </div>
            ) : (
              <div className="task-list compact">
                {todayTasks.slice(0, 4).map(task => (
                  <div key={task.id} className="task-item">
                    <div 
                      className="task-dot"
                      style={{ backgroundColor: task.shadow_color || '#666' }}
                    />
                    <div className="task-info">
                      <span className="task-type">{task.schedule_type}</span>
                      <span className="task-content">{task.content || '내용 없음'}</span>
                    </div>
                  </div>
                ))}
                {todayTasks.length > 4 && (
                  <div className="more-tasks">+{todayTasks.length - 4}개 더</div>
                )}
              </div>
            )}
          </div>

          {/* 🔥 수정된 근태 현황 렌더링 */}
          <div className="panel attendance-panel">
            <div className="panel-header">
              <h3>📍 {formattedDate} 직원 촬영 및 근태 현황</h3>
              <div className="date-navigation">
                <button className="date-nav-btn" onClick={() => handleDateChange('prev')}>
                  ◀
                </button>
                <button className="date-nav-btn today" onClick={() => handleDateChange('today')}>
                  오늘
                </button>
                <button className="date-nav-btn" onClick={() => handleDateChange('next')}>
                  ▶
                </button>
              </div>
            </div>
            
            <div className="attendance-content">
              <div className="attendance-list">
                {/* 01~09번 위치 - 하드코딩된 배열 사용 */}
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
                  const locationData = attendanceData.find(loc => loc.locationName === locationName);
                  const people = locationData?.people || [];
                  const outsourcedAcademies = ['부평학원', '강남학원'];
                  
                  return (
                    <div key={index} className="attendance-row">
                      <span className="location-number">{String(index + 1).padStart(2, '0')})</span>
                      <span className="location-name">{locationName}</span>
                      <span className="location-staff">
                        {people.length === 0 ? (
                          outsourcedAcademies.includes(locationName) ? (
                            <span className="outsourced-tag">위탁직</span>
                          ) : (
                            <span className="no-staff">없음</span>
                          )
                        ) : (
                          people.map((person, idx) => (
                            <React.Fragment key={idx}>
                              {person.name === '위탁직' ? (
                                <span className="outsourced-tag">{person.name}</span>
                              ) : (
                                <>
                                  {person.name}
                                  {person.notes && (
                                    <span className="staff-note">({person.notes})</span>
                                  )}
                                </>
                              )}
                              {idx < people.length - 1 && ', '}
                            </React.Fragment>
                          ))
                        )}
                      </span>
                    </div>
                  );
                })}
                
                {/* 10) 휴무자 */}
                <div className="attendance-row">
                  <span className="location-number">10)</span>
                  <span className="location-name">휴무자</span>
                  <span className="location-staff">
                    {dayOffPeople.length === 0 ? (
                      <span className="no-staff">없음</span>
                    ) : (
                      dayOffPeople.join(', ')
                    )}
                  </span>
                </div>
              </div>

              {/* 조기퇴근 */}
              <div className="early-leave-section">
                <div className="section-title">* 조기퇴근</div>
                <div className="section-placeholder">데이터 준비 중</div>
              </div>
            </div>
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
          ${isMobile ? 'flex-direction: column; align-items: center; gap: 8px; text-align: center;' : 'align-items: center; gap: 16px;'}
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

        .today-schedule-btn {
          background: #007bff;
          color: white;
          border: none;
          padding: ${isMobile ? '8px 16px' : '12px 20px'};
          border-radius: ${isMobile ? '6px' : '8px'};
          cursor: pointer;
          font-size: ${isMobile ? '13px' : '14px'};
          font-weight: 600;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(0, 123, 255, 0.3);
        }

        .today-schedule-btn:hover {
          background: #0056b3;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 123, 255, 0.4);
        }

        .stats-row {
          display: grid;
          grid-template-columns: ${isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)'};
          gap: ${isMobile ? '12px' : '20px'};
          margin-bottom: ${isMobile ? '24px' : '32px'};
        }

        .stat-card {
          background: white;
          border-radius: 12px;
          padding: ${isMobile ? '20px' : '24px'};
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          border-left: 4px solid var(--color);
          transition: all 0.2s ease;
          cursor: pointer;
          text-align: center;
          ${isMobile ? 'min-height: 110px; display: flex; align-items: center; justify-content: center;' : ''}
        }

        .stat-card:hover {
          transform: ${isMobile ? 'scale(0.98)' : 'translateY(-4px)'};
          box-shadow: 0 8px 25px rgba(0,0,0,0.15);
        }

        .stat-card.academy { --color: #007bff; --color-rgb: 0, 123, 255; }
        .stat-card.studio { --color: #28a745; --color-rgb: 40, 167, 69; }
        .stat-card.usage { --color: #17a2b8; --color-rgb: 23, 162, 184; }
        .stat-card.people { --color: #ffc107; --color-rgb: 255, 193, 7; }

        .stat-content {
          width: 100%;
        }

        .stat-number {
          font-size: ${isMobile ? '32px' : '28px'};
          font-weight: 700;
          color: #2c3e50;
          margin-bottom: ${isMobile ? '8px' : '6px'};
          line-height: 1;
        }

        .stat-label {
          color: #6c757d;
          font-size: ${isMobile ? '14px' : '15px'};
          font-weight: 600;
          margin-bottom: 8px;
        }

        .stat-hours {
          font-size: 12px;
          color: var(--color);
          font-weight: 600;
          background: rgba(var(--color-rgb), 0.1);
          padding: 4px 8px;
          border-radius: 12px;
          display: inline-block;
        }

        .stat-details {
          ${isMobile ? 'display: none;' : 'margin-top: 8px;'}
        }

        .stat-time, .usage-detail, .people-detail {
          font-size: 11px;
          color: #9ca3af;
          margin-bottom: 2px;
        }

        .stat-link {
          font-size: 11px;
          color: var(--color);
          font-weight: 600;
        }

        .stat-description {
          font-size: 11px;
          color: #9ca3af;
          font-weight: 500;
        }

        .main-content-grid {
          display: grid;
          grid-template-columns: ${isMobile ? '1fr' : '1fr 1fr'};
          gap: ${isMobile ? '16px' : '24px'};
        }

        .panel {
          background: white;
          border-radius: ${isMobile ? '8px' : '12px'};
          padding: ${isMobile ? '16px' : '24px'};
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .attendance-panel {
          grid-column: ${isMobile ? '1' : '1 / -1'};
        }

        .panel h3 {
          margin: 0 0 ${isMobile ? '16px' : '20px'} 0;
          font-size: ${isMobile ? '16px' : '18px'};
          font-weight: 600;
          color: #2c3e50;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: ${isMobile ? '16px' : '20px'};
          ${isMobile ? 'flex-wrap: wrap; gap: 8px;' : ''}
        }

        .panel-header h3 {
          margin: 0;
          ${isMobile ? 'flex: 1 1 100%;' : ''}
        }

        .date-navigation {
          display: flex;
          gap: ${isMobile ? '4px' : '8px'};
          align-items: center;
        }

        .date-nav-btn {
          background: white;
          border: 1px solid #dee2e6;
          padding: ${isMobile ? '4px 8px' : '6px 12px'};
          border-radius: 6px;
          cursor: pointer;
          font-size: ${isMobile ? '12px' : '14px'};
          font-weight: 500;
          color: #495057;
          transition: all 0.2s ease;
        }

        .date-nav-btn:hover {
          background: #f8f9fa;
          border-color: #adb5bd;
        }

        .date-nav-btn.today {
          background: #007bff;
          color: white;
          border-color: #007bff;
        }

        .date-nav-btn.today:hover {
          background: #0056b3;
          border-color: #0056b3;
        }

        .link-btn {
          background: none;
          border: none;
          color: #007bff;
          cursor: pointer;
          font-size: ${isMobile ? '13px' : '14px'};
          font-weight: 500;
          padding: 0;
        }

        .link-btn:hover {
          color: #0056b3;
        }

        .approval-list {
          display: flex;
          flex-direction: column;
          gap: ${isMobile ? '8px' : '12px'};
        }

        .approval-item {
          display: flex;
          align-items: center;
          gap: ${isMobile ? '8px' : '16px'};
          padding: ${isMobile ? '12px' : '16px'};
          background: #f8f9fa;
          border-radius: ${isMobile ? '6px' : '8px'};
          border-left: 4px solid var(--type-color);
        }

        .approval-item.academy { --type-color: #007bff; }
        .approval-item.studio { --type-color: #28a745; }

        .approval-type {
          font-size: ${isMobile ? '12px' : '13px'};
          font-weight: 600;
          color: var(--type-color);
          min-width: ${isMobile ? '50px' : '70px'};
          flex-shrink: 0;
        }

        .approval-content {
          flex: 1;
        }

        .approval-title {
          font-weight: 500;
          color: #2c3e50;
          font-size: ${isMobile ? '13px' : '14px'};
        }

        .approval-date {
          font-size: ${isMobile ? '11px' : '12px'};
          color: #6c757d;
        }

        .approve-btn {
          background: var(--type-color);
          color: white;
          border: none;
          padding: ${isMobile ? '6px 12px' : '8px 16px'};
          border-radius: ${isMobile ? '4px' : '6px'};
          cursor: pointer;
          font-size: ${isMobile ? '11px' : '12px'};
          font-weight: 500;
          white-space: nowrap;
        }

        .task-list.compact {
          display: flex;
          flex-direction: column;
          gap: ${isMobile ? '8px' : '12px'};
        }

        .task-item {
          display: flex;
          align-items: center;
          gap: ${isMobile ? '8px' : '12px'};
          padding: ${isMobile ? '8px 0' : '12px 0'};
          border-bottom: 1px solid #f3f4f6;
        }

        .task-item:last-child {
          border-bottom: none;
        }

        .task-dot {
          width: ${isMobile ? '8px' : '10px'};
          height: ${isMobile ? '8px' : '10px'};
          border-radius: 50%;
          flex-shrink: 0;
        }

        .task-info {
          flex: 1;
          display: flex;
          align-items: center;
          gap: ${isMobile ? '6px' : '8px'};
        }

        .task-type {
          font-size: ${isMobile ? '10px' : '12px'};
          font-weight: 600;
          color: #495057;
          background: #e9ecef;
          padding: ${isMobile ? '1px 6px' : '2px 8px'};
          border-radius: 12px;
        }

        .task-content {
          font-size: ${isMobile ? '12px' : '14px'};
          color: #6c757d;
        }

        .attendance-content {
          font-size: ${isMobile ? '13px' : '14px'};
          line-height: 1.8;
        }

        .attendance-list {
          display: flex;
          flex-direction: column;
          gap: ${isMobile ? '8px' : '10px'};
          margin-bottom: ${isMobile ? '16px' : '20px'};
        }

        .attendance-row {
          display: flex;
          align-items: flex-start;
          gap: ${isMobile ? '8px' : '12px'};
          padding: ${isMobile ? '8px' : '10px'};
          background: #f8f9fa;
          border-radius: 6px;
        }

        .location-number {
          font-weight: 700;
          color: #495057;
          min-width: 28px;
          flex-shrink: 0;
        }

        .location-name {
          font-weight: 600;
          color: #2c3e50;
          min-width: ${isMobile ? '80px' : '130px'};
          flex-shrink: 0;
        }

        .location-staff {
          flex: 1;
          color: #495057;
        }

        .staff-note {
          color: #6c757d;
          font-size: ${isMobile ? '12px' : '13px'};
          margin-left: 2px;
        }

        .outsourced-tag {
          color: #6c757d;
          font-style: italic;
        }

        .no-staff {
          color: #adb5bd;
        }

        .early-leave-section {
          margin-top: ${isMobile ? '16px' : '20px'};
          padding-top: ${isMobile ? '16px' : '20px'};
          border-top: 1px solid #e9ecef;
        }

        .section-title {
          font-weight: 700;
          color: #495057;
          margin-bottom: ${isMobile ? '8px' : '12px'};
        }

        .section-placeholder {
          color: #adb5bd;
          font-size: ${isMobile ? '12px' : '13px'};
          font-style: italic;
        }

        .empty-state {
          text-align: center;
          padding: ${isMobile ? '32px 16px' : '48px 20px'};
          color: #6c757d;
        }

        .empty-state.small {
          padding: ${isMobile ? '20px' : '24px'};
        }

        .empty-icon {
          font-size: ${isMobile ? '32px' : '48px'};
          margin-bottom: ${isMobile ? '12px' : '16px'};
        }

        .more-tasks {
          text-align: center;
          color: #6c757d;
          font-size: ${isMobile ? '12px' : '13px'};
          padding: ${isMobile ? '8px' : '12px'};
        }

        @media (max-width: 480px) {
          .stats-row {
            gap: 10px;
          }
          
          .stat-card {
            padding: 16px;
            min-height: 100px;
          }
          
          .stat-number {
            font-size: 28px;
          }
        }
      `}</style>
    </div>
  );
}
