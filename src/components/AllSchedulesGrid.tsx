"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "../utils/supabaseClient";
import BaseScheduleGrid from "../components/core/BaseScheduleGrid";
import { useWeek } from "../contexts/WeekContext";
import { UnifiedScheduleCard } from "../components/cards/UnifiedScheduleCard";
import React from 'react';
import { APP_CONFIG, USER_TYPE_CONFIG } from "../config/constants";
import { getStudioMainLocationId, determineUserTypeFromShooterType, getPositionName } from '../utils/configUtils';

// Schedule Card Error Boundary
class ScheduleCardErrorBoundary extends React.Component<
  { children: React.ReactNode; key?: string | number },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; key?: string | number }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('스케줄 카드 렌더링 오류:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '8px',
          background: '#fee2e2',
          border: '1px solid #fecaca',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#dc2626',
          textAlign: 'center'
        }}>
          <div>오류 발생</div>
        </div>
      );
    }

    return this.props.children;
  }
}

// 🔧 요일 매핑
const DAY_MAPPING: Record<number, string> = {
  0: 'sunday',
  1: 'monday', 
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday'
};

// 🔧 시간을 분 단위로 변환하는 헬퍼 함수
const timeToMinutes = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

// 🔧 주 시작일 계산 (월요일 기준)
const getWeekStart = (dateStr: string): string => {
  try {
    const date = new Date(`${dateStr}T00:00:00`);
    const dayOfWeek = date.getDay(); // 0=일, 1=월, ...
    
    if (dayOfWeek === 1) {
      return dateStr;
    }
    
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const mondayDate = new Date(date);
    mondayDate.setDate(date.getDate() - daysToMonday);
    
    return mondayDate.toISOString().split('T')[0];
  } catch (error) {
    console.error('주 시작일 계산 오류:', error);
    return dateStr;
  }
};

// 🔧 신 버전 시간 범위 기반 가용성 체크
const checkTimeSlotAvailability = (scheduleStart: string, scheduleEnd: string, daySchedule: any): boolean => {
  // 신 버전 처리 (available, startTime, endTime)
  if (daySchedule && daySchedule.hasOwnProperty('available')) {
    if (!daySchedule.available) {
      return false;
    }

    const freelancerStart = daySchedule.startTime;
    const freelancerEnd = daySchedule.endTime;

    if (!freelancerStart || !freelancerEnd) {
      return false;
    }

    const scheduleStartMinutes = timeToMinutes(scheduleStart);
    const scheduleEndMinutes = timeToMinutes(scheduleEnd);
    const freelancerStartMinutes = timeToMinutes(freelancerStart);
    const freelancerEndMinutes = timeToMinutes(freelancerEnd);

    const isWithinRange = 
      scheduleStartMinutes >= freelancerStartMinutes && 
      scheduleEndMinutes <= freelancerEndMinutes;

    console.log(`시간 범위 체크:`, {
      schedule: `${scheduleStart}-${scheduleEnd}`,
      freelancer: `${freelancerStart}-${freelancerEnd}`,
      isWithinRange
    });

    return isWithinRange;
  }

  console.log('⚠️ 구 버전 스케줄 데이터 감지, 신 버전으로 업데이트 필요');
  return false;
};

// 색상 설정
const academyColors: Record<number, {bg: string, border: string, text: string}> = {
  1: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
  2: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
  3: { bg: '#dcfce7', border: '#22c55e', text: '#166534' },
  4: { bg: '#fce7f3', border: '#ec4899', text: '#be185d' },
  5: { bg: '#f3e8ff', border: '#8b5cf6', text: '#6b21a8' },
  6: { bg: '#fed7d7', border: '#ef4444', text: '#b91c1c' },
  7: { bg: '#e0f2fe', border: '#06b6d4', text: '#0e7490' },
  8: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
  9: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
  default: { bg: '#f8fafc', border: '#e2e8f0', text: '#1f2937' }
};

const internalColors: Record<string, string> = {
  'Helper': '#6B7280',
  '행사': '#2563EB',
  '기타': '#059669',
  '장비/스튜디오대여': '#EA580C',
  '당직': '#DC2626',
  '근무': '#7C3AED',
  '고정휴무': '#DB2777',
  '개인휴무': '#0891B2'
};

const getInternalLocationColor = (locationType: string): string => {
  return internalColors[locationType as keyof typeof internalColors] || '#6B7280';
};

const getContrastColor = (hexColor: string | null): string => {
  if (!hexColor || hexColor === 'transparent' || hexColor === null) return '#1f2937';
  
  const hex = hexColor.replace('#', '');
  if (hex.length !== 6) return '#1f2937';
  
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  
  return yiq >= 140 ? '#1F2937' : '#FFFFFF';
};

interface AllSchedulesGridProps {
  title: string;
  currentUserRole?: 'admin' | 'manager' | 'user';
}

export default function AllSchedulesGrid({ 
  title, 
  currentUserRole = 'user' 
}: AllSchedulesGridProps) {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [allLocations, setAllLocations] = useState<any[]>([]);
  const [mainLocations, setMainLocations] = useState<any[]>([]);
  const [shooters, setShooters] = useState<any[]>([]);
  const [studioShootingTypes, setStudioShootingTypes] = useState<Record<number, {primary: string, secondary: string[]}>>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTimeout, setRefreshTimeout] = useState<NodeJS.Timeout | null>(null);
  
  const [showShooterModal, setShowShooterModal] = useState(false);
  const [selectedScheduleForAssignment, setSelectedScheduleForAssignment] = useState<any | null>(null);
  const [filteredShooters, setFilteredShooters] = useState<any[]>([]);
  const [customMessage, setCustomMessage] = useState('');  // 🔧 전달사항 메시지
  const [isAssigning, setIsAssigning] = useState(false);  // 🔧 배정 중 상태
  const [isTomorrowConfirming, setIsTomorrowConfirming] = useState(false);

  
  const [filters, setFilters] = useState({
    mainLocationId: 'all',
    shooterStatus: 'all',
    scheduleStatus: 'all',
    scheduleType: 'all',
    confirmationStatus: 'all'  // 🔧 추가
  });
  
  const isProcessingRef = useRef(false);
  const { currentWeek, navigateWeek } = useWeek();

  const getCurrentWeekStart = (): string => {
    const weekDates = generateWeekDates();
    return weekDates[0].date;
  };

  const isCurrentWeekAffected = (weekStartDate: string): boolean => {
    if (!weekStartDate) return false;
    return weekStartDate === getCurrentWeekStart();
  };

  const isCurrentWeekSchedule = (scheduleDate: string): boolean => {
    if (!scheduleDate) return false;
    const currentWeekDates = generateWeekDates();
    return currentWeekDates.some(d => d.date === scheduleDate);
  };

  const debouncedRefresh = () => {
    if (refreshTimeout) {
      clearTimeout(refreshTimeout);
    }
    const timeout = setTimeout(() => {
      console.log('fetchAllSchedules 실행');
      fetchAllSchedules();
    }, 500);
    setRefreshTimeout(timeout);
  };

  useEffect(() => {
    fetchData();
  }, [currentWeek]);

  useEffect(() => {
    console.log('실시간 구독 설정 시작...');
    const currentWeekStart = getCurrentWeekStart();

    const freelancerSubscription = supabase
      .channel('freelancer-schedule-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'shooter_weekly_schedule' }, 
        (payload) => {
          console.log('프리랜서 주간 스케줄 변경:', payload);
          const changedWeekStart = payload.new?.week_start_date || payload.old?.week_start_date;
          
          if (isCurrentWeekAffected(changedWeekStart)) {
            console.log('현재 주차 프리랜서 스케줄 변경 - 새로고침');
            debouncedRefresh();
          }
        }
      )
      .subscribe();

    const scheduleSubscription = supabase
      .channel('schedule-assignment-changes')
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'schedules' }, 
        (payload) => {
          console.log('스케줄 배정 변경:', payload);
          if (payload.new && isCurrentWeekSchedule(payload.new.shoot_date)) {
            console.log('현재 주차 스케줄 배정 변경 - 상태 업데이트');
            updateScheduleInState(payload.new.id, payload.new.assigned_shooter_id);
            debouncedRefresh();
          }
        }
      )
      .subscribe();

    const newScheduleSubscription = supabase
      .channel('new-schedule-changes')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'schedules' }, 
        (payload) => {
          console.log('새 스케줄 생성:', payload);
          if (payload.new && isCurrentWeekSchedule(payload.new.shoot_date)) {
            console.log('현재 주차 새 스케줄 - 전체 새로고침');
            debouncedRefresh();
          }
        }
      )
      .subscribe();

    console.log('✅ 실시간 구독 설정 완료');

    return () => {
      console.log('🔄 실시간 구독 해제...');
      freelancerSubscription.unsubscribe();
      scheduleSubscription.unsubscribe();
      newScheduleSubscription.unsubscribe();
      
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
    };
  }, [currentWeek]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await Promise.all([
        fetchMainLocations(),
        fetchStudioShootingTypes(), 
        fetchAllLocations(),
        fetchAllSchedules(),
        fetchShooters()
      ]);
    } catch (error) {
      console.error('데이터 로딩 오류:', error);
      setError('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMainLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('main_locations')
        .select('*')
        .eq('is_active', true)
        .order('name');
        
      if (error) throw error;
      setMainLocations(data || []);
    } catch (error) {
      console.error('메인 위치 조회 오류:', error);
      setMainLocations([]);
    }
  };

const fetchStudioShootingTypes = async () => {
  try {
    // ⚠️ 임시로 기본값 설정 (테이블 관계 오류로 인해)
    console.log('⚠️ 촬영 타입 조회 임시 비활성화 - 테이블 관계 확인 필요');
    setStudioShootingTypes({});
    return;
  } catch (error) {
    console.error('촬영 타입 조회 오류:', error);
    setStudioShootingTypes({});
  }
};


const fetchAllLocations = async () => {
  try {
    const [studioResult, academyResult] = await Promise.all([
      supabase
        .from('sub_locations')  // ✅ 올바른 테이블명
        .select(`
          id,
          name,
          main_location_id,
          main_locations!inner (
            id,
            name,
            location_type
          )
        `)
        .eq('is_active', true)
        .eq('main_locations.location_type', 'studio')
        .order('id'),
      
      supabase
        .from('sub_locations')  // ✅ 올바른 테이블명
        .select(`
          id,
          name,
          main_location_id,
          main_locations!inner (
            id,
            name,
            location_type
          )
        `)
        .eq('is_active', true)
        .eq('main_locations.location_type', 'academy')
        .order('id')
    ]);

    const { data: studioData, error: studioError } = studioResult;
    const { data: academyData, error: academyError } = academyResult;

    if (studioError) console.error('스튜디오 조회 오류:', studioError);
    if (academyError) console.error('학원 조회 오류:', academyError);

    const unifiedLocations = [
      ...(studioData || [])
        .filter(loc => loc.main_locations)
        .sort((a, b) => a.id - b.id)
        .map(loc => ({
          id: `studio-${loc.id}`,
          name: `${loc.main_locations.name} - ${loc.name}`,
          type: 'studio',
          mainLocationId: loc.main_location_id,  // ✅ 수정
          originalId: loc.id,
          mainLocationName: loc.main_locations.name,
          sortOrder: 0,
          studioId: loc.id,
          studioName: loc.name,
          mainLocationDisplayName: loc.main_locations.name
        })),
      
      ...(academyData || [])
        .filter(loc => loc.main_locations)
        .sort((a, b) => {
          if (a.main_location_id !== b.main_location_id) {  // ✅ 수정
            return a.main_location_id - b.main_location_id;  // ✅ 수정
          }
          return a.id - b.id;
        })
        .map(loc => ({
          id: `academy-${loc.id}`,
          name: `${loc.main_locations.name} - ${loc.name}`,
          type: 'academy',
          mainLocationId: loc.main_location_id,  // ✅ 수정
          originalId: loc.id,
          mainLocationName: loc.main_locations.name,
          sortOrder: 1000 + loc.main_location_id * 100 + loc.id  // ✅ 수정
        })),
      
      ...APP_CONFIG.internalWorkTypes.map((type, index) => ({
        id: `internal-${index}`,
        name: type,
        type: 'internal',
        originalName: type,
        sortOrder: 9000 + index
      }))
    ];

    setAllLocations(unifiedLocations);
  } catch (error) {
    console.error('위치 조회 오류:', error);
    setAllLocations([]);
  }
};

const fetchAllSchedules = async () => {
  try {
    console.log('📊 통합스케줄 조회 시작...');
    
    const weekDates = generateWeekDates();
    const startDate = weekDates[0].date;
    const endDate = weekDates[6].date;

    // ✅ 수정된 부분: location 정보를 올바르게 조회
    const { data: studioAcademyData, error: scheduleError } = await supabase
      .from('schedules')
      .select(`
        *,
        sub_locations:sub_location_id (
          id,
          name,
          main_location_id,
          main_locations:main_location_id (
            id,
            name,
            location_type
          )
        )
      `)
      .in('schedule_type', ['studio', 'academy'])
      .eq('is_active', true)
      .eq('approval_status', 'approved')
      .gte('shoot_date', startDate)
      .lte('shoot_date', endDate)
      .order('shoot_date')
      .order('start_time');

    if (scheduleError) {
      console.error('❌ 스케줄 조회 오류:', scheduleError);
      throw scheduleError;
    }

    console.log('✅ 스튜디오/아카데미 스케줄 조회:', studioAcademyData?.length || 0);
    
    if (studioAcademyData && studioAcademyData.length > 0) {
      const shooterIds = studioAcademyData
        .map(s => s.assigned_shooter_id)
        .filter(Boolean);
        
      if (shooterIds.length > 0) {
        const { data: assignedShooters, error: shooterError } = await supabase
          .from('users')
          .select('id, name, phone, role')
          .in('id', shooterIds);
          
        if (!shooterError && assignedShooters) {
          studioAcademyData.forEach(schedule => {
            if (schedule.assigned_shooter_id) {
              const shooter = assignedShooters.find(s => s.id === schedule.assigned_shooter_id);
              if (shooter) {
                schedule.user_profiles = shooter;
              }
            }
          });
        }
      }
    }

    // ✅ 내부 업무 스케줄 조회
    const { data: internalData, error: internalError } = await supabase
      .from('internal_schedules')
      .select('*')
      .eq('is_active', true)
      .gte('schedule_date', startDate)
      .lte('schedule_date', endDate)
      .order('schedule_date')
      .order('created_at');

    if (internalError) {
      console.error('❌ 내부 스케줄 조회 오류:', internalError);
    }

    // ✅ 수정된 부분: main_location_id를 직접 추가
    const unifiedSchedules = [
      ...(studioAcademyData || []).map(s => ({
        ...s,
        unified_type: 'studio-academy',
        unified_location_id: `${s.schedule_type}-${s.sub_location_id}`,
        unified_date: s.shoot_date,
        main_location_id: s.sub_locations?.main_location_id, // ✅ 추가됨
        location_name: s.sub_locations?.name,
        main_location_name: s.sub_locations?.main_locations?.name
      })),
      ...(internalData || []).map(s => {
        const typeIndex = APP_CONFIG.internalWorkTypes.indexOf(s.schedule_type);
        return {
          ...s,
          unified_type: 'internal',
          unified_location_id: `internal-${typeIndex}`,
          unified_date: s.schedule_date,
          main_location_id: null, // 내부 업무는 main_location_id 없음
          location_name: s.schedule_type,
          main_location_name: null
        };
      })
    ];

    console.log('✅ 통합스케줄 조회 완료 (location 정보 포함):', unifiedSchedules.length);
    setSchedules(unifiedSchedules);
    
  } catch (error) {
    console.error('❌ 스케줄 조회 실패:', error);
    setSchedules([]);
    throw error;
  }
};



  const fetchShooters = async () => {
    try {
      console.log('📋 촬영자 로딩 시작...');
      
      const { data: combinedData, error } = await supabase
        .from('users')
        .select(`
          id, name, phone, role, status, auth_id,
          shooters:shooters!shooters_user_id_fkey (
            shooter_type, main_location_ids, team_id, emergency_phone
          )
        `)
        .in('role', APP_CONFIG.userRoles.shootingRoles)
        .eq('status', 'active');

      if (error) {
        console.error('JOIN 방식 실패, 별도 쿼리로 전환:', error);
        return await fetchShootersWithSeparateQueries();
      }

      console.log('✅ JOIN 결과:', combinedData);

      const combinedShooters = (combinedData || []).map(user => {
        if (user.role === 'schedule_admin') {
          return {
            id: user.id,
            name: user.name,
            phone: user.phone,
            authid: user.auth_id,
            emergencycontact: user.phone,
            shootertype: null,
            usertype: 'schedule_admin',
            role: user.role,
            positionname: '스케줄 관리자',
            organizationname: APP_CONFIG.organization.name,
            departmentname: APP_CONFIG.organization.departments.management,
            locationpreferences: [],
            weeklyavailability: {}
          };
        } else {
          const shooterInfo = user.shooters?.[0];
          console.log(`👤 ${user.name}:`, shooterInfo ? {
            shooter_type: shooterInfo.shooter_type,
            main_location_ids: shooterInfo.main_location_ids
          } : '촬영자 정보 없음');

          return {
            id: user.id,
            name: user.name,
            phone: user.phone,
            authid: user.auth_id,
            emergencycontact: shooterInfo?.emergency_phone || user.phone,
            shootertype: shooterInfo?.shooter_type || null,
            mainlocationids: shooterInfo?.main_location_ids || null,
            teamid: shooterInfo?.team_id || null,
            usertype: determineUserTypeFromShooterType(shooterInfo?.shooter_type),
            role: user.role,
            positionname: getPositionName(shooterInfo?.shooter_type),
            organizationname: APP_CONFIG.organization.name,
            departmentname: APP_CONFIG.organization.departments.shooting,
            locationpreferences: [],
            weeklyavailability: {}
          };
        }
      });

      console.log('📊 최종 분포:', {
        schedule_admin: combinedShooters.filter(s => s.role === 'schedule_admin').length,
        dispatch: combinedShooters.filter(s => s.shootertype === 'dispatch').length,
        freelancer: combinedShooters.filter(s => s.shootertype === 'freelancer').length,
        regular: combinedShooters.filter(s => s.role === 'shooter' && !s.shootertype).length
      });

      setShooters(combinedShooters);
    } catch (error) {
      console.error('촬영자 조회 오류:', error);
      setShooters([]);
    }
  };

  const fetchShootersWithSeparateQueries = async () => {
    console.log('📋 별도 쿼리 방식으로 촬영자 조회...');
    
    try {
      const { data: allUsersData, error: userError } = await supabase
        .from('users')
        .select('id, name, phone, role, status, auth_id')
        .in('role', APP_CONFIG.userRoles.shootingRoles)
        .eq('status', 'active');

      if (userError) {
        console.error('사용자 조회 오류:', userError);
        setShooters([]);
        return;
      }

      const { data: shootersData, error: shooterError } = await supabase
        .from('shooters')
        .select('user_id, shooter_type, main_location_ids, team_id, emergency_phone');

      if (shooterError) {
        console.error('shooters 테이블 조회 오류:', shooterError);
      }

      const combinedShooters = (allUsersData || []).map(user => {
        if (user.role === 'schedule_admin') {
          return {
            id: user.id,
            name: user.name,
            phone: user.phone,
            authid: user.auth_id,
            emergencycontact: user.phone,
            shootertype: null,
            usertype: 'schedule_admin',
            role: user.role,
            positionname: '스케줄 관리자',
            organizationname: APP_CONFIG.organization.name,
            departmentname: APP_CONFIG.organization.departments.management,
            locationpreferences: [],
            weeklyavailability: {}
          };
        } else {
          const shooterInfo = (shootersData || []).find(s => s.user_id === user.auth_id);
          
          console.log(`👤 ${user.name} (auth_id: ${user.auth_id}):`, shooterInfo ? {
            shooter_type: shooterInfo.shooter_type,
            main_location_ids: shooterInfo.main_location_ids
          } : '촬영자 정보 없음');

          return {
            id: user.id,
            name: user.name,
            phone: user.phone,
            authid: user.auth_id,
            emergencycontact: shooterInfo?.emergency_phone || user.phone,
            shootertype: shooterInfo?.shooter_type || null,
            mainlocationids: shooterInfo?.main_location_ids || null,
            teamid: shooterInfo?.team_id || null,
            usertype: determineUserTypeFromShooterType(shooterInfo?.shooter_type),
            role: user.role,
            positionname: getPositionName(shooterInfo?.shooter_type),
            organizationname: APP_CONFIG.organization.name,
            departmentname: APP_CONFIG.organization.departments.shooting,
            locationpreferences: [],
            weeklyavailability: {}
          };
        }
      });

      console.log('📊 최종 분포:', {
        schedule_admin: combinedShooters.filter(s => s.role === 'schedule_admin').length,
        dispatch: combinedShooters.filter(s => s.shootertype === 'dispatch').length,
        freelancer: combinedShooters.filter(s => s.shootertype === 'freelancer').length,
        regular: combinedShooters.filter(s => s.role === 'shooter' && !s.shootertype).length
      });

      setShooters(combinedShooters);
    } catch (error) {
      console.error('별도 쿼리 촬영자 조회 오류:', error);
      setShooters([]);
    }
  };

const filterAvailableShooters = async (schedule: any) => {
  if (!schedule) return;

  const scheduleMainLocationId = schedule.sub_locations?.main_location_id;  // ✅ 수정
  
  console.log('🔍 촬영자 필터링:', {
    date: schedule.shoot_date,
    mainLocationId: scheduleMainLocationId,
    startTime: schedule.start_time,
    endTime: schedule.end_time,
    scheduleId: schedule.id,
    totalShooters: shooters.length
  });

  let availableShooters = [...shooters];

  // 1. 위치 기반 필터링
  availableShooters = availableShooters.filter(shooter => {
    const userTypeConfig = USER_TYPE_CONFIG[shooter.usertype];
    
    if (userTypeConfig?.accessLevel === 'all_locations') {
      console.log(`${shooter.name} (${userTypeConfig.displayName}) - 모든 위치 접근 가능`);
      return true;
    }

    if (userTypeConfig?.accessLevel === 'location_preference_only') {
      if (!shooter.mainlocationids || !Array.isArray(shooter.mainlocationids)) {
        console.log(`${shooter.name} - 위치 정보 없음`);
        return false;
      }

      const hasLocationAccess = shooter.mainlocationids.includes(scheduleMainLocationId);
      if (!hasLocationAccess) {
        console.log(`${shooter.name} - 위치 불일치`);
        return false;
      }

      console.log(`${shooter.name} - 위치 일치`);
      return true;
    }

    return true;
  });

  // 2. 시간 충돌 체크
  try {
    const { data: conflictingSchedules, error } = await supabase
      .from('schedules')
      .select('id, assigned_shooter_id, shoot_date, start_time, end_time')
      .eq('shoot_date', schedule.shoot_date)
      .neq('id', schedule.id)
      .not('assigned_shooter_id', 'is', null)
      .eq('is_active', true)
      .eq('approval_status', 'approved');

    if (!error && conflictingSchedules) {
      const overlappingShooterIds = conflictingSchedules
        .filter(conflictSchedule => {
          const conflictStart = conflictSchedule.start_time;
          const conflictEnd = conflictSchedule.end_time;
          const scheduleStart = schedule.start_time;
          const scheduleEnd = schedule.end_time;

          return !(scheduleEnd <= conflictStart || conflictEnd <= scheduleStart);
        })
        .map(conflictSchedule => conflictSchedule.assigned_shooter_id);

      availableShooters = availableShooters.filter(shooter => 
        !overlappingShooterIds.includes(shooter.id)
      );
    }
  } catch (error) {
    console.error('시간 충돌 체크 오류:', error);
  }

  // 3. 프리랜서 주간 스케줄 체크 (신 버전 지원)
  try {
    const weekStart = getWeekStart(schedule.shoot_date);
    
    const { data: freelancerSchedules, error: freelancerError } = await supabase
      .from('shooter_weekly_schedule')
      .select('shooter_id, schedule_data, week_start_date, status')
      .eq('status', 'submitted')
      .eq('week_start_date', weekStart);

    if (!freelancerError && freelancerSchedules) {
      availableShooters = availableShooters.filter(shooter => {
        if (shooter.usertype !== 'freelancer') {
          return true;
        }

        const shooterSchedule = freelancerSchedules.find(fs => fs.shooter_id === shooter.authid);
        
        if (!shooterSchedule) {
          console.log(`${shooter.name} - 해당 주차 스케줄 미등록`);
          return false;
        }

        const dayOfWeek = new Date(`${schedule.shoot_date}T00:00:00`).getDay();
        const dayName = DAY_MAPPING[dayOfWeek];
        const daySchedule = shooterSchedule.schedule_data?.[dayName];

        if (!daySchedule) {
          console.log(`${shooter.name} - ${dayName} 요일 스케줄 없음`);
          return false;
        }

        // 신 버전 시간 범위 체크
        const isAvailable = checkTimeSlotAvailability(
          schedule.start_time,
          schedule.end_time,
          daySchedule
        );
        
        if (!isAvailable) {
          console.log(`${shooter.name} - ${dayName} 시간대 불가`);
          return false;
        }

        console.log(`${shooter.name} - ${dayName} 시간대 가능`);
        return true;
      });
    }
  } catch (error) {
    console.error('프리랜서 스케줄 체크 오류:', error);
  }

  // 4. 정렬
  availableShooters.sort((a, b) => {
    const aConfig = USER_TYPE_CONFIG[a.usertype];
    const bConfig = USER_TYPE_CONFIG[b.usertype];
    const aSortOrder = aConfig?.sortOrder || 999;
    const bSortOrder = bConfig?.sortOrder || 999;
    
    if (aSortOrder !== bSortOrder) {
      return aSortOrder - bSortOrder;
    }
    
    return a.name.localeCompare(b.name);
  });

  return availableShooters;
};

  const updateScheduleInState = (scheduleId: number, shooterId: number | null) => {
    setSchedules(prevSchedules => {
      console.log('상태 업데이트:', scheduleId, shooterId);
      
      return prevSchedules.map(schedule => {
        if (schedule.id === scheduleId) {
          let updatedSchedule = {
            ...schedule,
            assigned_shooter_id: shooterId
          };

          if (shooterId) {
            const shooter = shooters.find(s => s.id === shooterId);
            if (shooter) {
              updatedSchedule.user_profiles = {
                id: shooter.id,
                name: shooter.name,
                phone: shooter.phone,
                role: shooter.role
              };
            }
          } else {
            updatedSchedule.user_profiles = null;
          }

          console.log('업데이트된 스케줄:', updatedSchedule);
          return updatedSchedule;
        }
        return schedule;
      });
    });
  };

const handleShooterChange = async (scheduleId: number, newShooterId: number | null) => {
  try {
    console.log('촬영자 변경:', scheduleId, newShooterId);
    
    if (isProcessingRef.current) return;
    setIsAssigning(true);
    isProcessingRef.current = true;

    // 🔧 해제할 때 assignment_status도 함께 초기화
    const updateData = {
      assigned_shooter_id: newShooterId,
      assignment_status: newShooterId ? 'draft' : null,  // 🔧 해제시 status도 초기화
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('schedules')
      .update(updateData)
      .eq('id', scheduleId)
      .select();

    if (error) throw error;

    console.log('업데이트 성공:', data);
    updateScheduleInState(scheduleId, newShooterId);
    
    // 🔧 선택된 스케줄 정보 업데이트 (assignment_status 포함)
    setSelectedScheduleForAssignment(prev => ({
      ...prev,
      assigned_shooter_id: newShooterId,
      assignment_status: newShooterId ? 'draft' : null,  // 🔧 상태도 업데이트
      user_profiles: newShooterId ? filteredShooters.find(s => s.id === newShooterId) : null
    }));

    // 🔧 모달 유지하고 스크롤을 상단으로
    setTimeout(() => {
      const modalElement = document.querySelector('[data-modal-content]');
      if (modalElement) {
        modalElement.scrollTop = 0;
      }
    }, 100);

    // 백그라운드 새로고침
    setTimeout(async () => {
      try {
        await fetchAllSchedules();
      } catch (error) {
        console.error('새로고침 오류:', error);
      }
    }, 1000);

  } catch (error) {
    console.error('촬영자 변경 오류:', error);
    alert(error.message);
  } finally {
    setIsAssigning(false);
    isProcessingRef.current = false;
  }
};

// 🔧 주간 스케줄 확인 메시지 발송 (다음 주 스케줄 확인)
const sendWeeklyConfirmationMessages = async () => {
  console.log('📅 주간 스케줄 확인 메시지 발송 시작');

  // 현재 주의 모든 스케줄에서 고유한 촬영자 추출
  const uniqueShooters = new Map<string, any>();
  
  schedules.forEach(schedule => {
    if (schedule.user_profiles?.phone && schedule.user_profiles?.name) {
      const phone = schedule.user_profiles.phone;
      if (!uniqueShooters.has(phone)) {
        uniqueShooters.set(phone, {
          name: schedule.user_profiles.name,
          phone: phone
        });
      }
    }
  });

  console.log('📋 발송 대상 촬영자:', uniqueShooters.size, '명');

  let successCount = 0;
  let failCount = 0;

  for (const [phone, shooter] of uniqueShooters) {
    try {
      await sendWeeklyCheckMessage(shooter);
      successCount++;
      console.log(`✅ ${shooter.name} 주간 확인 메시지 발송 성공`);
    } catch (error) {
      failCount++;
      console.error(`❌ ${shooter.name} 주간 확인 메시지 발송 실패:`, error);
    }
    
    // 발송 간격 (0.5초 대기)
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`📊 주간 확인 메시지 발송 결과 - 성공: ${successCount}명, 실패: ${failCount}명`);
};

// 🔧 다음날 스케줄 확정 함수
const handleTomorrowConfirmation = async () => {
  if (!confirm('내일 스케줄이 있는 모든 촬영자에게 확정 알림을 발송하시겠습니까?')) {
    return;
  }

  setIsTomorrowConfirming(true);

  try {
    console.log('📋 다음날 스케줄 확정 시작');

    // 내일 날짜 계산
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    console.log('📅 내일 날짜:', tomorrowStr);

    // 내일 스케줄이 있는 고유한 촬영자 추출
    const tomorrowShooters = new Map<string, any>();
    
    schedules.forEach(schedule => {
      if (schedule.shoot_date === tomorrowStr && 
          schedule.user_profiles?.phone && 
          schedule.user_profiles?.name) {
        const phone = schedule.user_profiles.phone;
        if (!tomorrowShooters.has(phone)) {
          tomorrowShooters.set(phone, {
            name: schedule.user_profiles.name,
            phone: phone
          });
        }
      }
    });

    console.log('📋 내일 스케줄 촬영자:', tomorrowShooters.size, '명');

    if (tomorrowShooters.size === 0) {
      alert('내일 스케줄이 배정된 촬영자가 없습니다.');
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const [phone, shooter] of tomorrowShooters) {
      try {
        await sendTomorrowConfirmMessage(shooter);
        successCount++;
        console.log(`✅ ${shooter.name} 내일 확정 메시지 발송 성공`);
      } catch (error) {
        failCount++;
        console.error(`❌ ${shooter.name} 내일 확정 메시지 발송 실패:`, error);
      }
      
      // 발송 간격 (0.5초 대기)
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    alert(`📋 다음날 스케줄 확정 완료!\n\n✅ 성공: ${successCount}명\n❌ 실패: ${failCount}명`);

  } catch (error: any) {
    console.error('❌ 다음날 스케줄 확정 오류:', error);
    alert(`다음날 스케줄 확정 중 오류가 발생했습니다: ${error.message}`);
  } finally {
    setIsTomorrowConfirming(false);
  }
};

// 🔧 주간 스케줄 확인 메시지 (패턴 1)
const sendWeeklyCheckMessage = async (shooter: any) => {
  const messageBlocks = [
    {
      type: 'header',
      text: '📅 다음 주 스케줄 확인 요청'
    },
    {
      type: 'text',
      text: `안녕하세요. ${shooter.name} PD님\n다음 주 예정 스케줄 확인해주세요.`
    },
    {
      type: 'button',
      text: '📋 스케줄 확인하기',
      style: 'primary',
      action_type: 'open_inapp_browser',
      value: 'https://schedule-app-v3-kappa.vercel.app/shooter/schedule-check'
    }
  ];

  const textMessage = `📅 안녕하세요. ${shooter.name} PD님\n다음 주 예정 스케줄 확인해주세요.\n\n스케줄 확인: https://schedule-app-v3-kappa.vercel.app/shooter/schedule-check`;

  return await sendKakaoWorkMessageByShooter(shooter, textMessage, messageBlocks);
};

// 🔧 다음날 스케줄 확정 메시지 (패턴 2)
const sendTomorrowConfirmMessage = async (shooter: any) => {
  const messageBlocks = [
    {
      type: 'header',
      text: '📋 내일 스케줄 확정 알림'
    },
    {
      type: 'text',
      text: `안녕하세요. ${shooter.name} PD님\n내일 스케줄 확정되었습니다. \n확인 버튼 클릭해주세요.`
    },
    {
      type: 'button',
      text: '✅ 확인하기',
      style: 'primary',
      action_type: 'open_inapp_browser',
      value: 'https://schedule-app-v3-kappa.vercel.app/shooter/ShooterDashboard'
    }
  ];

  const textMessage = `📋 안녕하세요. ${shooter.name} PD님\n내일 스케줄 확정되었습니다. \n확인 버튼 클릭해주세요.\n\n확인하기: https://schedule-app-v3-kappa.vercel.app/shooter/ShooterDashboard`;

  return await sendKakaoWorkMessageByShooter(shooter, textMessage, messageBlocks);
};

// 🔧 촬영자 정보로 카카오워크 메시지 발송
const sendKakaoWorkMessageByShooter = async (shooter: any, text: string, blocks: any[]) => {
  // 카카오워크 이메일 조회
  const { data: kakaoData, error: kakaoError } = await supabase
    .from('user_kakaowork_emails')
    .select('kakaowork_email')
    .eq('phone', shooter.phone)
    .single();

  if (kakaoError || !kakaoData?.kakaowork_email) {
    throw new Error(`${shooter.name}님의 카카오워크 이메일 정보가 없습니다.`);
  }

  // 카카오워크 사용자 조회
  const userResponse = await fetch(`/api/kakaowork/find-user?email=${encodeURIComponent(kakaoData.kakaowork_email)}`);
  
  if (!userResponse.ok) {
    throw new Error(`${shooter.name}님을 카카오워크에서 찾을 수 없습니다.`);
  }

  const kakaoWorkUser = await userResponse.json();

  // 메시지 발송
  const sendResponse = await fetch('/api/kakaowork/send-message', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId: kakaoWorkUser.user?.id || kakaoWorkUser.id,
      userName: shooter.name,
      phone: shooter.phone,
      text: text,
      blocks: blocks,
      scheduleId: 0  // 일괄 발송이므로 특정 스케줄 ID 없음
    })
  });

  if (!sendResponse.ok) {
    const errorData = await sendResponse.json();
    throw new Error(errorData.message || '메시지 발송 실패');
  }

  return await sendResponse.json();
};


const sendKakaoWorkMessage = async (schedule: any, customMessage: string) => {
  try {
    const shooterInfo = schedule.user_profiles;
    
    if (!shooterInfo) {
      console.error('❌ 촬영자 정보가 없습니다.');
      alert('촬영자 정보가 없습니다.');
      return false;
    }

    console.log('🔍 카카오워크 메시지 발송 시작:', {
      name: shooterInfo.name,
      phone: shooterInfo.phone,
      scheduleId: schedule.id
    });

    // 🔧 카카오워크 이메일 조회
    const { data: kakaoData, error: kakaoError } = await supabase
      .from('user_kakaowork_emails')
      .select('kakaowork_email')
      .eq('phone', shooterInfo.phone)
      .single();

    if (kakaoError || !kakaoData?.kakaowork_email) {
      console.error('❌ 카카오워크 이메일을 찾을 수 없습니다:', shooterInfo.phone);
      alert(`${shooterInfo.name}님의 카카오워크 이메일 정보가 없습니다.`);
      return false;
    }

    console.log('✅ 카카오워크 이메일 조회 성공:', kakaoData.kakaowork_email);

    // 🔧 카카오워크 사용자 조회
    const kakaoWorkResponse = await fetch(`/api/kakaowork/find-user?email=${encodeURIComponent(kakaoData.kakaowork_email)}`);

    if (!kakaoWorkResponse.ok) {
      const errorData = await kakaoWorkResponse.json();
      console.error('❌ 카카오워크 사용자 조회 실패:', errorData);
      alert(`${shooterInfo.name}님을 카카오워크에서 찾을 수 없습니다.`);
      return false;
    }

    const kakaoWorkUser = await kakaoWorkResponse.json();
    console.log('✅ 카카오워크 사용자 조회 성공:', kakaoWorkUser.display_name);

    // 🔧 날짜 포맷팅
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const weekday = weekdays[date.getDay()];
      return `${month}월 ${day}일(${weekday})`;
    };

    // 🔧 카카오워크 메시지 블록 (정확한 형식)
    const messageBlocks = [
      {
        type: 'header',
        text: '📹 촬영 스케줄 확정 알림'
      },
      {
        type: 'text',
        text: `안녕하세요! ${shooterInfo.name} PD님\n촬영 스케줄이 확정되었습니다.\n\n📅 촬영일: ${formatDate(schedule.shoot_date)}\n⏰ 시간: ${schedule.start_time?.substring(0, 5)} ~ ${schedule.end_time?.substring(0, 5)}\n📍 장소: ${schedule.sub_locations?.main_locations?.name} - ${schedule.sub_locations?.name}\n👨‍🏫 강사: ${schedule.professor_name} / ${schedule.course_name}`
      }
    ];

    // 전달사항이 있으면 추가
    if (customMessage) {
      messageBlocks.push({
        type: 'text',
        text: `📝 전달사항: ${customMessage}`
      });
    }

    // 버튼 추가
    messageBlocks.push({
      type: 'button',
      text: '📋 전체 스케줄 보기',
      style: 'primary',
      action_type: 'open_inapp_browser',
      value: 'https://schedule-app-v3-kappa.vercel.app/shooter/schedule-check'
    });

    // 텍스트 버전 (fallback)
    const textMessage = `📹 안녕하세요! ${shooterInfo.name} PD님

촬영 스케줄이 확정되었습니다.

📅 촬영일: ${formatDate(schedule.shoot_date)}
⏰ 시간: ${schedule.start_time?.substring(0, 5)} ~ ${schedule.end_time?.substring(0, 5)}
📍 장소: ${schedule.sub_locations?.main_locations?.name} - ${schedule.sub_locations?.name}
👨‍🏫 강사: ${schedule.professor_name} / ${schedule.course_name}

전체 스케줄: https://schedule-app-v3-kappa.vercel.app/shooter/schedule-check${customMessage ? `\n\n📝 전달사항:\n${customMessage}` : ''}`;

    console.log('📧 카카오워크 메시지 블록 생성 완료:', messageBlocks.length, '개 블록');

// 🔧 카카오워크 메시지 발송
const sendResponse = await fetch('/api/kakaowork/send-message', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    userId: kakaoWorkUser.user?.id || kakaoWorkUser.id,
    userName: shooterInfo.name,
    phone: shooterInfo.phone,  // 📍 이 부분 확인
    text: textMessage,
    blocks: messageBlocks,
    scheduleId: schedule.id
  })
});

console.log('📤 전송된 데이터:', {
  userId: kakaoWorkUser.user?.id || kakaoWorkUser.id,
  userName: shooterInfo.name,
  phone: shooterInfo.phone,
  hasText: !!textMessage,
  hasBlocks: !!messageBlocks,
  scheduleId: schedule.id
});

    if (!sendResponse.ok) {
      const errorData = await sendResponse.json();
      throw new Error(errorData.message || '메시지 발송 실패');
    }

    const sendResult = await sendResponse.json();
    console.log('✅ 카카오워크 메시지 발송 완료:', sendResult);

    alert(`✅ 카카오워크 메시지 발송 성공!

👤 받는 사람: ${shooterInfo.name} (${kakaoWorkUser.display_name})
📧 이메일: ${kakaoData.kakaowork_email}
🎨 카드 형태 메시지로 전송되었습니다!`);

    return true;

  } catch (error: any) {
    console.error('❌ 카카오워크 메시지 발송 오류:', error);
    alert(`메시지 발송 중 오류가 발생했습니다: ${error.message}`);
    return false;
  }
};






  // 🔧 스케줄 확정/해제 함수 추가
const handleScheduleConfirmation = async () => {
  try {
    if (!selectedScheduleForAssignment?.assigned_shooter_id) {
      alert('촬영자가 배정되지 않았습니다.');
      return;
    }

    console.log('🔄 스케줄 확정 시작:', selectedScheduleForAssignment.id);

    // 1. 스케줄 확정 상태 업데이트
    const { data, error } = await supabase
      .from('schedules')
      .update({ 
        assignment_status: 'confirmed',
        updated_at: new Date().toISOString()
      })
      .eq('id', selectedScheduleForAssignment.id)
      .select();

    if (error) throw error;

    console.log('✅ 스케줄 확정 완료');

    // 2. 카카오워크 메시지 발송
    const messageSuccess = await sendKakaoWorkMessage(selectedScheduleForAssignment, customMessage);

    // 3. 상태 업데이트 (UI 새로고침)
    setSchedules(prevSchedules => 
      prevSchedules.map(schedule => 
        schedule.id === selectedScheduleForAssignment.id
          ? { ...schedule, assignment_status: 'confirmed' }
          : schedule
      )
    );

    // 4. 결과 알림 및 모달 닫기
    if (messageSuccess) {
      alert('스케줄이 확정되고 카카오워크 알림이 전송되었습니다! ✅');
    } else {
      alert('스케줄은 확정되었으나 카카오워크 알림 전송에 실패했습니다. ⚠️');
    }

    // 모달 닫기
    setShowShooterModal(false);
    setSelectedScheduleForAssignment(null);
    setFilteredShooters([]);
    setCustomMessage('');

  } catch (error: any) {
    console.error('확정 오류:', error);
    alert('확정 처리 중 오류가 발생했습니다: ' + error.message);
  }
};




    // 🔧 기존 함수 수정 (메시지 발송 기능 추가)
    const handleBatchConfirmation = async () => {
      if (!confirm('현재 주에 배치된 모든 촬영자에게 다음 주 스케줄 확인 메시지를 발송하시겠습니까?')) {
        return;
      }

      try {
        console.log('📅 주간 일괄 확정 시작 - 메시지 발송 포함');

        // 🔧 1단계: 기존 DB 확정 로직 (유지)
        const weekDates = generateWeekDates();
        const startDate = weekDates[0].date;
        const endDate = weekDates[6].date;

        const { data, error } = await supabase
          .from('schedules')
          .update({ 
            assignment_status: 'confirmed',
            updated_at: new Date().toISOString()
          })
          .gte('shoot_date', startDate)
          .lte('shoot_date', endDate)
          .not('assigned_shooter_id', 'is', null)
          .eq('is_active', true)
          .eq('approval_status', 'approved');

        if (error) throw error;

        // 🔧 2단계: 메시지 발송 추가
        await sendWeeklyConfirmationMessages();

        alert('주간 일괄 확정 및 메시지 발송이 완료되었습니다.');
        fetchAllSchedules(); // 새로고침

      } catch (error: any) {
        console.error('❌ 주간 일괄 확정 오류:', error);
        alert(`주간 일괄 확정 중 오류가 발생했습니다: ${error.message}`);
      }
    };


  // 디버깅용 헬퍼 함수
const debugKakaoWorkIntegration = async (phone: string) => {
  console.log('🔍 카카오워크 연동 디버깅 시작:', phone);

  // 1단계 체크
  const { data: userData, error } = await supabase
    .from('users')
    .select('id, name, phone, email')
    .eq('phone', phone)
    .single();

  console.log('1단계 - 사용자 조회:', { userData, error });

  if (userData?.email) {
    // 2단계 체크
    const response = await fetch(`/api/kakaowork/find-user?email=${encodeURIComponent(userData.email)}`);
    const kakaoWorkResult = await response.json();
    
    console.log('2단계 - 카카오워크 조회:', { 
      email: userData.email, 
      success: response.ok, 
      result: kakaoWorkResult 
    });
  }
};

// 테스트용 버튼 (개발 시에만 사용)
const TestKakaoWorkButton = () => (
  <button 
    onClick={() => debugKakaoWorkIntegration('010-1234-5678')}
    style={{ background: 'orange', color: 'white', padding: '5px 10px' }}
  >
    카카오워크 연동 테스트
  </button>
);

// 에러 타입별 처리
const handleKakaoWorkError = (error: any, shooterInfo: any) => {
  if (error.message?.includes('이메일을 찾을 수 없습니다')) {
    return `${shooterInfo.name}님의 이메일 정보가 DB에 없습니다. 관리자에게 문의하세요.`;
  }
  
  if (error.message?.includes('카카오워크에서 찾을 수 없습니다')) {
    return `${shooterInfo.name}님이 카카오워크에 등록되어 있지 않거나 이메일이 다릅니다.`;
  }
  
  if (error.message?.includes('메시지 발송 실패')) {
    return `카카오워크 메시지 발송 중 오류가 발생했습니다. 잠시 후 다시 시도하세요.`;
  }
  
  return `알 수 없는 오류가 발생했습니다: ${error.message}`;
};



  const generateWeekDates = () => {
    const startOfWeek = new Date(currentWeek);
    const dayOfWeek = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    startOfWeek.setDate(diff);

    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      dates.push({ id: dateStr, date: dateStr, day: date.getDate() });
    }
    return dates;
  };

  const getLocationColor = (locationId: string | number) => {
    let location;
    if (typeof locationId === 'string') {
      if (locationId.startsWith('academy-')) {
        const numericId = parseInt(locationId.replace('academy-', ''));
        location = allLocations.find(loc => loc.type === 'academy' && loc.originalId === numericId);
      } else {
        return academyColors.default;
      }
    } else {
      location = allLocations.find(loc => loc.originalId === locationId);
    }

    const academyId = location?.mainLocationId;
    return academyColors[academyId as keyof typeof academyColors] || academyColors.default;
  };

  const getStudioShootingTypesDisplay = (studioId: number) => {
    const types = studioShootingTypes?.[studioId];
    if (!types || !types.primary) return null;
    
    const allTypes = [types.primary, ...types.secondary];
    return allTypes.join(', ');
  };

  const getScheduleForCell = (date: string, location: any) => {
    return schedules.filter(s => s.unified_date === date && s.unified_location_id === location.id);
  };

  const handleCellClick = (date: string, location: any) => {
    // 셀 클릭 처리
  };

  const renderScheduleCard = (schedule: any) => {
    if (schedule.unified_type === 'internal') {
      return renderInternalCard(schedule);
    } else {
      return renderStudioAcademyCard(schedule);
    }
  };

  // 🔧 스케줄 카드 렌더링 (확정 기능 포함)
const renderStudioAcademyCard = (schedule: any) => {
  const isCancelled = schedule.approval_status === 'cancelled' || schedule.is_active === false;
  const isConfirmed = schedule.assignment_status === 'confirmed';  // 🔧 확정 상태 확인
  const shooterText = schedule.user_profiles?.name || null;

  return (
    <ScheduleCardErrorBoundary key={schedule.id}>
      <div style={{
        position: 'relative',
        transition: 'all 0.2s ease',
        opacity: isCancelled ? 0.5 : 1,
        filter: isCancelled ? 'grayscale(50%)' : 'none',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        marginBottom: '2px'
      }}>
        {/* 🔧 "배치완료" 워터마크 */}
        {isConfirmed && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(-15deg)',
            color: 'rgba(16, 185, 129, 0.3)',
            fontSize: '14px',
            fontWeight: '900',
            letterSpacing: '1px',
            zIndex: 15,
            pointerEvents: 'none',
            textShadow: '1px 1px 2px rgba(255, 255, 255, 0.8)',
            userSelect: 'none'
          }}>
            배치완료
          </div>
        )}

        {/* 기존 취소됨 오버레이 */}
        {isCancelled && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 20,
            borderRadius: '8px',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '14px',
            pointerEvents: 'none'
          }}>
            <div>취소됨</div>
          </div>
        )}
        
        <UnifiedScheduleCard
          schedule={schedule}
          scheduleType={schedule.schedule_type === 'academy' ? 'academy' : 'studio'}
          locationColor={schedule.schedule_type === 'academy' ? getLocationColor(schedule.sublocation_id) : undefined}
          onClick={(clickedSchedule) => handleScheduleCardClick(clickedSchedule)}
          onContextMenu={handleScheduleCardClick}
          showShooterInfo={true}
          shooterText={shooterText}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: '60px'
          }}
        />
      </div>
    </ScheduleCardErrorBoundary>
  );
};




  const renderInternalCard = (schedule: any) => {
    const backgroundColor = schedule.shadow_color || getInternalLocationColor(schedule.schedule_type);
    const textColor = getContrastColor(schedule.shadow_color);

    return (
      <div key={schedule.id} style={{
        background: backgroundColor,
        color: textColor,
        padding: '8px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: '2px',
        cursor: 'default',
        transition: 'all 0.2s ease',
        border: `1px solid ${backgroundColor}`,
        opacity: 0.9,
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        minHeight: '60px',
        overflow: 'hidden'
      }}>
        <div style={{
          fontSize: '12px',
          lineHeight: 1.3,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical'
        }}>
          {schedule.content}
        </div>
      </div>
    );
  };

  const handleScheduleCardClick = async (schedule: any) => {
    if (currentUserRole !== 'admin') {
      alert(`촬영자 배정 권한이 없습니다. 현재 권한: ${currentUserRole}`);
      return;
    }

    if (schedule.unified_type === 'internal') {
      alert('내부 업무 스케줄은 촬영자 배정이 불가능합니다.');
      return;
    }

    console.log('🔍 촬영자 필터링 시작...', schedule);
    const availableShooters = await filterAvailableShooters(schedule);
    setFilteredShooters(availableShooters || []);
    setSelectedScheduleForAssignment(schedule);
    setShowShooterModal(true);
  };

  const getShooterTypeText = (userType: string): string => {
    const config = USER_TYPE_CONFIG[userType];
    if (config) {
      console.log(`${userType} 타입:`, config.displayName);
      return config.displayName;
    }
    console.log(`알 수 없는 userType: ${userType}`);
    return userType;
  };

  const getShooterTypeColor = (userType: string): string => {
    const config = USER_TYPE_CONFIG[userType];
    if (config) {
      console.log(`${userType} 색상:`, config.color);
      return config.color;
    }
    console.log(`알 수 없는 userType: ${userType}`);
    return '#6b7280';
  };

  const getFilteredLocations = () => {
    let filtered = allLocations;
    
    if (filters.scheduleType !== 'all') {
      filtered = filtered.filter(loc => loc.type === filters.scheduleType);
    }
    
    if (filters.mainLocationId !== 'all') {
      if (filters.mainLocationId === 'studio') {
        filtered = filtered.filter(loc => loc.type === 'studio');
      } else if (filters.mainLocationId === 'internal') {
        filtered = filtered.filter(loc => loc.type === 'internal');
      } else {
        filtered = filtered.filter(loc => loc.mainLocationId === parseInt(filters.mainLocationId));
      }
    }
    
    return filtered;
  };

  // 🔧 확정 상태 필터 추가
  const getFilteredSchedules = () => {
    let filtered = schedules;
    
    if (filters.shooterStatus !== 'all') {
      if (filters.shooterStatus === 'assigned') {
        filtered = filtered.filter(s => s.unified_type === 'internal' || s.user_profiles);
      } else if (filters.shooterStatus === 'unassigned') {
        filtered = filtered.filter(s => s.unified_type === 'studio_academy' && !s.user_profiles);
      }
    }
    
    if (filters.scheduleStatus !== 'all') {
      filtered = filtered.filter(s => s.tracking_status === filters.scheduleStatus);
    }

    // 🔧 확정 상태 필터 추가
    if (filters.confirmationStatus !== 'all') {
      if (filters.confirmationStatus === 'confirmed') {
        filtered = filtered.filter(s => s.assignment_status === 'confirmed');
      } else if (filters.confirmationStatus === 'draft') {
        filtered = filtered.filter(s => s.assignment_status !== 'confirmed');
      }
    }
    
    return filtered;
  };

  // 🔧 확정 기능 포함 필터 렌더링
  const renderFilters = () => (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '12px',
      flexDirection: 'row'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', minWidth: '40px' }}>
          분류
        </label>
        <select
          value={filters.scheduleType}
          onChange={(e) => setFilters({...filters, scheduleType: e.target.value, mainLocationId: 'all'})}
          style={{
            padding: '4px 8px',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontSize: '13px',
            outline: 'none'
          }}
        >
          <option value="all">전체</option>
          <option value="studio">스튜디오</option>
          <option value="academy">학원</option>
          <option value="internal">내부업무</option>
        </select>
      </div>

      {filters.scheduleType === 'academy' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', minWidth: '40px' }}>
            지역
          </label>
          <select
            value={filters.mainLocationId}
            onChange={(e) => setFilters({...filters, mainLocationId: e.target.value})}
            style={{
              padding: '4px 8px',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              outline: 'none'
            }}
          >
            <option value="all">전체 지역</option>
            {mainLocations
              .filter(loc => loc.location_type === 'academy')
              .map(loc => (
                <option key={loc.id} value={loc.id.toString()}>
                  {loc.name}
                </option>
              ))
            }
          </select>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', minWidth: '50px' }}>
          촬영자
        </label>
        <select
          value={filters.shooterStatus}
          onChange={(e) => setFilters({...filters, shooterStatus: e.target.value})}
          style={{
            padding: '4px 8px',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontSize: '13px',
            outline: 'none'
          }}
        >
          <option value="all">전체</option>
          <option value="assigned">배정됨</option>
          <option value="unassigned">미배정</option>
        </select>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', minWidth: '40px' }}>
          상태
        </label>
        <select
          value={filters.scheduleStatus}
          onChange={(e) => setFilters({...filters, scheduleStatus: e.target.value})}
          style={{
            padding: '4px 8px',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontSize: '13px',
            outline: 'none'
          }}
        >
          <option value="all">전체</option>
          <option value="pending">대기중</option>
          <option value="confirmed">확정</option>
          <option value="in_progress">진행중</option>
          <option value="completed">완료</option>
          <option value="cancelled">취소됨</option>
        </select>
      </div>

      {/* 🔧 확정 상태 필터 추가 */}
      {currentUserRole === 'admin' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', minWidth: '40px' }}>
            확정
          </label>
          <select
            value={filters.confirmationStatus}
            onChange={(e) => setFilters({...filters, confirmationStatus: e.target.value})}
            style={{
              padding: '4px 8px',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              outline: 'none'
            }}
          >
            <option value="all">전체</option>
            <option value="confirmed">확정됨</option>
            <option value="draft">임시</option>
          </select>
        </div>
      )}

      {/* 🔧 일괄 확정 버튼 추가 */}
      {currentUserRole === 'admin' && (
        <button
          onClick={handleBatchConfirmation}
          style={{
            padding: '6px 12px',
            background: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 'bold',
            marginLeft: '8px'
          }}
        >
          주간 일괄확정
        </button>
      )}

      {/* 🔧 다음날 스케줄 확정 버튼 추가 */}
      {currentUserRole === 'admin' && (
        <button
          onClick={handleTomorrowConfirmation}
          disabled={isTomorrowConfirming}
          style={{
            padding: '6px 12px',
            background: '#f59e0b',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: isTomorrowConfirming ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            fontWeight: 'bold',
            marginLeft: '8px'
          }}
        >
          {isTomorrowConfirming ? '📤 발송 중...' : '📋 다음날 스케줄 확정'}
        </button>
      )}
    </div>
  );

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'var(--bg-primary)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid var(--accent-color)',
            borderTop: '4px solid transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            데이터 로딩 중...
          </div>
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

  if (error) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'var(--bg-primary)'
      }}>
        <div style={{ textAlign: 'center', color: '#dc2626' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <div style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>
            오류 발생
          </div>
          <div style={{ marginBottom: 20 }}>{error}</div>
          <button 
            onClick={fetchData}
            style={{
              padding: '10px 20px',
              background: 'var(--accent-color)',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100vh', overflow: 'hidden', outline: 'none', display: 'flex', flexDirection: 'column' }}>
      <style jsx global>{`
        .schedule-grid-container .cell-wrapper {
          padding: 6px !important;
          display: flex !important;
          flex-direction: column !important;
          height: 100% !important;
        }
        
        .schedule-grid-container .schedule-list {
          gap: 4px !important;
          flex: 1 !important;
          display: flex !important;
          flex-direction: column !important;
          overflow-y: visible !important;
          overflow: visible !important;
          width: 100% !important;
          min-height: 0 !important;
          height: 100% !important;
        }
        
        .schedule-grid-container .schedule-list::-webkit-scrollbar {
          display: none !important;
        }
      `}</style>

      <div style={{ 
        height: '100%', 
        overflow: 'hidden', 
        background: 'var(--bg-primary)', 
        padding: '20px',
        outline: 'none',
        display: 'flex', 
        flexDirection: 'column' 
      }}>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <BaseScheduleGrid
            title={title}
            leftColumnTitle="촬영장소"
            locations={getFilteredLocations()}
            schedules={getFilteredSchedules()}
            currentWeek={currentWeek}
            onWeekChange={navigateWeek}
            onCellClick={handleCellClick}
            getScheduleForCell={getScheduleForCell}
            renderScheduleCard={renderScheduleCard}
            showAddButton={false}
            userRole={currentUserRole}
            pageType="all"
            hideHeader={false}
            getLocationColor={getLocationColor}
            customFilters={renderFilters()}
            getStudioShootingTypes={getStudioShootingTypesDisplay}
            useDynamicHeight={true}
            minCellHeight={80}
            maxCellHeight={400}
            cardHeight={85}
          />
        </div>
      </div>

    {/* 촬영자 선택 모달 */}
    {showShooterModal && selectedScheduleForAssignment && (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(2px)'
      }}>
        <div 
          data-modal-content
          style={{
            background: 'var(--bg-secondary)',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '850px',
            width: '95%',
            maxHeight: '90vh',
            overflowY: 'auto',
            border: '1px solid var(--border-color)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            outline: 'none'
          }}
        >
          {/* 헤더 */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            paddingBottom: '12px',
            borderBottom: '2px solid var(--border-color)'
          }}>
            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '18px', fontWeight: '700' }}>
              촬영자 배정 및 확정
            </h3>
            <button
              onClick={() => {
                setShowShooterModal(false);
                setSelectedScheduleForAssignment(null);
                setFilteredShooters([]);
                setCustomMessage('');
              }}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              ×
            </button>
          </div>

            {/* 스케줄 정보 */}
            <div style={{
              padding: '16px',
              background: 'var(--bg-primary)',
              borderRadius: '8px',
              marginBottom: '20px',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500' }}>
                    촬영일
                  </span>
                  <div style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '600', marginTop: '2px' }}>
                    {selectedScheduleForAssignment.shoot_date}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500' }}>
                    시간
                  </span>
                  <div style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '600', marginTop: '2px' }}>
                    {selectedScheduleForAssignment.start_time?.substring(0, 5)} ~ {selectedScheduleForAssignment.end_time?.substring(0, 5)}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500' }}>
                    촬영장소
                  </span>
                  <div style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: '500', marginTop: '2px' }}>
                    {selectedScheduleForAssignment.sub_locations?.main_locations?.name} - {selectedScheduleForAssignment.sub_locations?.name}
                  </div>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
                <div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500' }}>
                    강의 정보
                  </span>
                  <div style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '700', marginTop: '2px' }}>
                    {selectedScheduleForAssignment.professor_name} / {selectedScheduleForAssignment.course_name}
                  </div>
                </div>
                {selectedScheduleForAssignment.schedule_type === 'studio' && selectedScheduleForAssignment.shooting_type && (
                  <div>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500' }}>
                      촬영타입
                    </span>
                    <div style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: '600', marginTop: '2px' }}>
                      {selectedScheduleForAssignment.shooting_type}
                    </div>
                  </div>
                )}
              </div>
            </div>

 {/* 🔧 현재 배정된 촬영자 (스크롤 상단에 표시) */}
      {selectedScheduleForAssignment?.assigned_shooter_id && (
        <div style={{
          padding: '16px',
          background: '#d1fae5',
          border: '1px solid #a7f3d0',
          borderRadius: '8px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontWeight: 'bold', color: '#065f46', fontSize: '14px', marginBottom: '4px' }}>
              ✅ 현재 배정된 촬영자
            </div>
            <div style={{ fontSize: '16px', color: '#065f46', fontWeight: '600' }}>
              {selectedScheduleForAssignment.user_profiles?.name}
            </div>
            <div style={{ fontSize: '12px', color: '#065f46', marginTop: '2px' }}>
              📞 {selectedScheduleForAssignment.user_profiles?.phone}
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            {/* 해제 버튼 */}
            <button
              onClick={() => {
                if (confirm('배정을 해제하시겠습니까?')) {
                  handleShooterChange(selectedScheduleForAssignment.id, null);
                }
              }}
              style={{
                background: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 12px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 'bold'
              }}
            >
              해제
            </button>
            
            {/* 🔧 확정 버튼 */}
            <button
              onClick={handleScheduleConfirmation}
              disabled={isAssigning}
              style={{
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 12px',
                cursor: isAssigning ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                fontWeight: 'bold'
              }}
            >
              {isAssigning ? '처리중...' : '확정'}
            </button>
          </div>
        </div>
      )}

      {/* 🔧 전달사항 입력란 (배정된 경우에만 표시) */}
      {selectedScheduleForAssignment?.assigned_shooter_id && (
        <div style={{
          marginBottom: '20px',
          padding: '16px',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px'
        }}>
          <label style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: '600',
            color: 'var(--text-primary)',
            marginBottom: '8px'
          }}>
            📝 전달사항 (선택사항)
          </label>
          <textarea
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            placeholder="촬영자에게 전달할 추가 메시지를 입력하세요..."
            style={{
              width: '100%',
              minHeight: '80px',
              padding: '8px',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              resize: 'vertical',
              fontSize: '13px',
              outline: 'none'
            }}
          />
          <div style={{
            fontSize: '11px',
            color: 'var(--text-secondary)',
            marginTop: '4px'
          }}>
            기본 메시지: "이번주 촬영이 배정되었습니다. 확인해주세요" + 스케줄 정보
          </div>
        </div>
      )}

      {/* 가능한 촬영자 목록 (기존과 동일하지만 선택 시 모달 유지) */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '16px', fontWeight: '700' }}>
            가능한 촬영자
          </h4>
          <div style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '500' }}>
            전체: {shooters.length}명 / <span style={{ color: 'var(--accent-color)', fontWeight: '700' }}>{filteredShooters.length}</span>명
          </div>
        </div>

        <div style={{
  display: 'grid',
  gridTemplateColumns: window.innerWidth > 768 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
  gap: window.innerWidth > 768 ? '10px' : '8px',
  maxHeight: '420px',
  overflowY: 'auto',
  padding: '6px'
}}>
  {filteredShooters.length === 0 ? (
    <div style={{
      gridColumn: '1 / -1',
      textAlign: 'center',
      color: 'var(--text-secondary)',
      padding: '40px',
      fontSize: '13px',
      background: '#f8f9fa',
      borderRadius: '8px',
      border: '1px dashed #dee2e6'
    }}>
      <div style={{ fontSize: '16px', marginBottom: '8px' }}>😔</div>
      <div>가능한 촬영자가 없습니다.</div>
      <div style={{ fontSize: '11px', marginTop: '6px', opacity: 0.7 }}>
        위치, 시간, 프리랜서 주간 스케줄 등을 확인해주세요.
      </div>
    </div>
  ) : (
    filteredShooters.map((shooter) => (
      <button
        key={shooter.id}
        onClick={() => handleShooterChange(selectedScheduleForAssignment.id, shooter.id)}
        disabled={isAssigning}
        style={{
          padding: window.innerWidth > 768 ? '14px' : '12px',
          background: selectedScheduleForAssignment.assigned_shooter_id === shooter.id 
            ? '#10b981' 
            : 'var(--bg-primary)',
          color: selectedScheduleForAssignment.assigned_shooter_id === shooter.id 
            ? 'white' 
            : 'var(--text-primary)',
          border: selectedScheduleForAssignment.assigned_shooter_id === shooter.id 
            ? '2px solid #10b981' 
            : '1.5px solid var(--border-color)',
          borderRadius: '8px',
          cursor: isAssigning ? 'not-allowed' : 'pointer',
          textAlign: 'left',
          transition: 'all 0.2s ease',
          width: '100%',
          minHeight: window.innerWidth > 768 ? '110px' : '100px',
          display: 'flex',
          flexDirection: 'column'
        }}
        onMouseEnter={(e) => {
          if (!isAssigning && selectedScheduleForAssignment.assigned_shooter_id !== shooter.id) {
            e.currentTarget.style.background = 'var(--accent-color)';
            e.currentTarget.style.color = 'white';
            e.currentTarget.style.borderColor = 'var(--accent-color)';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.15)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isAssigning && selectedScheduleForAssignment.assigned_shooter_id !== shooter.id) {
            e.currentTarget.style.background = 'var(--bg-primary)';
            e.currentTarget.style.color = 'var(--text-primary)';
            e.currentTarget.style.borderColor = 'var(--border-color)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', height: '100%' }}>
          {/* 🔧 이름과 타입 배지 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ 
              fontWeight: '700', 
              fontSize: '15px', 
              color: 'inherit', 
              lineHeight: 1.2 
            }}>
              {shooter.name}
            </div>
            <div style={{
              fontSize: '9px',
              fontWeight: '700',
              color: getShooterTypeColor(shooter.usertype),
              backgroundColor: `${getShooterTypeColor(shooter.usertype)}20`,
              padding: '4px 6px',
              borderRadius: '12px',
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              flexShrink: 0,
              border: `1.5px solid ${getShooterTypeColor(shooter.usertype)}`,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              {shooter.role === 'schedule_admin' ? 'ADMIN' : (shooter.shootertype ? shooter.shootertype.toUpperCase() : 'REGULAR')}
            </div>
          </div>

          {/* 🔧 연락처 정보 */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '3px', 
            fontSize: '11.5px', 
            opacity: 0.9 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ minWidth: '14px', fontSize: '12px' }}>📞</span>
              <span>{shooter.phone}</span>
            </div>
            {shooter.emergencycontact && shooter.emergencycontact !== shooter.phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ 
                  minWidth: '14px', 
                  color: selectedScheduleForAssignment.assigned_shooter_id === shooter.id ? '#fef3cd' : '#dc2626', 
                  fontSize: '12px' 
                }}>🚨</span>
                <span style={{ 
                  color: selectedScheduleForAssignment.assigned_shooter_id === shooter.id ? '#fef3cd' : '#dc2626', 
                  fontWeight: '600', 
                  fontSize: '11px' 
                }}>
                  {shooter.emergencycontact}
                </span>
              </div>
            )}
          </div>

          <div style={{ marginTop: 'auto' }} />
        </div>
      </button>
    ))
  )}
</div>

      </div>
    </div>
  </div>
)}
    </div>
  );
}
