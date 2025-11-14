//src/components/StudioAdminPanel.tsx
"use client";
import { canApprove, canRequestOnly, AppRole } from '../core/permissions';
import React, { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "../utils/supabaseClient";
import { useAuth } from '../contexts/AuthContext';
import { useWeek } from "../contexts/WeekContext";
import { UserRoleType } from "../types/users";
import { safeUserRole } from "../utils/permissions";
import BaseScheduleGrid from "./core/BaseScheduleGrid";
import StudioScheduleModal from "./modals/StudioScheduleModal";
import { UnifiedScheduleCard } from "../components/cards/UnifiedScheduleCard";
import { ScheduleCardErrorBoundary } from "./ErrorBoundary";

interface StudioAdminPanelProps {
  currentUser?: {
    id?: number | null;            // numericId
    authUserId?: string | null;    // supabase auth UUID
    name?: string;
    role?: string;
    permissions?: string[] | Record<string, boolean>;
  };
}

export default function StudioAdminPanel({ currentUser }: StudioAdminPanelProps) {
  const [hasAccess, setHasAccess] = useState(false);
  const [accessLoading, setAccessLoading] = useState(true);
  
  const [schedules, setSchedules] = useState<any[]>([]);
  const [studioLocations, setStudioLocations] = useState<any[]>([]);
  const [shootingTypeMapping, setShootingTypeMapping] = useState<any[]>([]);
  const [draggedSchedule, setDraggedSchedule] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<any | null>(null);

  const { currentWeek, navigateWeek } = useWeek();
  const { user } = useAuth(); // fallback 용

  // --- shooter 표시 유틸 ---
  const getShooterText = (s: any) => {
    // 1) 배열 케이스: assigned_shooters, shooters
    const arr =
      (Array.isArray(s.assigned_shooters) && s.assigned_shooters.length ? s.assigned_shooters :
       Array.isArray(s.shooters) && s.shooters.length ? s.shooters : null);

    if (arr) {
      // 객체 배열이면 name/label 추출
      const names = arr.map((x:any) =>
        typeof x === 'string' ? x :
        x?.name || x?.display_name || x?.label || ''
      ).filter(Boolean);
      if (names.length) return names.join(', ');
    }

    // 2) 단일 필드 폴백
    const single =
      s.shooter_name ||
      s.shooter ||
      s.assigned_shooter ||
      s.user_profiles?.name ||
      '';

    return single || '미배치';
  };

  // 🔥 WeekContext 디버깅
  useEffect(() => {
    console.log('🔍 WeekContext currentWeek 값:', currentWeek);
    console.log('🔍 currentWeek 타입:', typeof currentWeek);
    console.log('🔍 currentWeek 유효성:', currentWeek instanceof Date, !isNaN(currentWeek?.getTime()));
  }, [currentWeek]);

  // ✅ 접근 권한 판단 (currentUser + AuthContext fallback)
  useEffect(() => {
    const roleFromProp = currentUser?.role;
    const roleFromAuth = user?.role;

    const effectiveRole = (roleFromProp || roleFromAuth || '') as UserRoleType | '';

    const allowedRoles: UserRoleType[] = [
      'system_admin',
      'schedule_admin',
      'admin',
      'manager',
      'studio_manager'
    ];

    const accessGranted = !!effectiveRole && allowedRoles.includes(effectiveRole as UserRoleType);

    console.log('🔐 [StudioAdminPanel] role / access:', {
      roleFromProp,
      roleFromAuth,
      effectiveRole,
      accessGranted,
    });

    setHasAccess(accessGranted);
    setAccessLoading(false);
    if (accessGranted) setIsClient(true);
  }, [currentUser, user]);

  // 🔥 최초 및 주차 변경 시 데이터 로딩
  const fetchData = async () => {
    if (!hasAccess) return;
    
    try {
      setError(null);
      setIsLoading(true);
      console.log('🎬 스튜디오 데이터 로딩 시작');
      
      await Promise.all([
        fetchSchedules(), 
        fetchStudioLocations(),
        fetchShootingTypeMapping()
      ]);
      
      console.log('✅ 스튜디오 데이터 로딩 완료');
    } catch (error) {
      console.error('❌ 스튜디오 데이터 로딩 오류:', error);
      setError('데이터를 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (hasAccess && isClient) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAccess, isClient, currentWeek]);

  const fetchShootingTypeMapping = async () => {
    try {
      const { data, error } = await supabase
        .from('sub_location_shooting_types')
        .select(`
          id,
          sub_location_id,
          is_primary,
          shooting_types!inner(
            id,
            name,
            is_active
          ),
          sub_locations!inner(
            id,
            name,
            main_location_id
          )
        `)
        .eq('shooting_types.is_active', true)
        .eq('sub_locations.main_location_id', 8);
      
      if (error) throw error;
      
      console.log('✅ 촬영형식 매핑 조회 성공:', data?.length || 0, '개');
      setShootingTypeMapping(data || []);
    } catch (error) {
      console.error('촬영형식 매핑 조회 오류:', error);
      setShootingTypeMapping([]);
    }
  };

  const fetchSchedules = async () => {
    if (!hasAccess) return;

    try {
      const weekDates = generateWeekDates();
      if (weekDates.length === 0) {
        throw new Error('생성된 날짜가 없습니다');
      }

      const startDate = weekDates[0].date;
      const endDate = weekDates[weekDates.length - 1].date;

      if (!startDate || !endDate || startDate.includes('NaN') || endDate.includes('NaN')) {
        throw new Error(`유효하지 않은 날짜 범위: ${startDate} ~ ${endDate}`);
      }

      console.log('🔍 스케줄 조회 날짜 범위:', startDate, '~', endDate);

      const { data, error } = await supabase
        .from('schedules')
        .select(`
          *, 
          professor_category_name,
          professor_category_id,
          sub_locations!inner(
            id,
            name,
            main_location_id,
            main_locations!inner(
              id,
              name,
              location_type
            )
          )
        `)
        .eq('schedule_type', 'studio')
        .eq('is_active', true)
        .in('approval_status', [
          'approved', 'confirmed', 'pending', 'approval_requested',
          'modification_requested', 'modification_approved',
          'cancellation_requested', 'deletion_requested',
          'cancelled'
        ])
        .gte('shoot_date', startDate)
        .lte('shoot_date', endDate)
        .order('shoot_date')
        .order('start_time');

      if (error) throw error;

      // ✅ 관리자 화면: 분할 원본 숨김, 자식만 표시
      const filteredSchedules = (data || []).filter(schedule => {
        if (schedule.is_split === true && !schedule.parent_schedule_id) {
          return false;
        }
        return true;
      });

      console.log('📊 관리자 화면 필터링:', {
        전체: data?.length || 0,
        표시: filteredSchedules.length,
        분할원본숨김: (data?.length || 0) - filteredSchedules.length
      });

      const activeSchedules = filteredSchedules.filter(s => s.approval_status !== 'cancelled') || [];
      const userCancelledSchedules = filteredSchedules.filter(s => 
        s.approval_status === 'cancelled' && 
        (s.deletion_reason === 'user_cancelled' || s.deletion_reason === null || s.deletion_reason === undefined)
      ) || [];

      console.log('📊 스케줄 분류 결과:', {
        활성: activeSchedules.length,
        사용자취소: userCancelledSchedules.length
      });

      const displaySchedules = [
        ...activeSchedules,
        ...userCancelledSchedules
      ];

      // 🔥 촬영자 정보 조회 (학원 코드 방식)
      const shooterIds = [
        ...new Set(
          displaySchedules
            .map(s => s.assigned_shooter_id)
            .filter((v): v is number => !!v)
        )
      ];

      console.log('🔎 [스튜디오] 배정된 촬영자 ID 수:', shooterIds.length);

      if (shooterIds.length > 0) {
        const { data: shooterUsers, error: shooterUsersErr } = await supabase
          .from('users')
          .select('id, name, phone, role')
          .in('id', shooterIds);

        if (shooterUsersErr) {
          console.error('🔥 [스튜디오] 촬영자 users 조회 오류:', shooterUsersErr);
        } else {
          displaySchedules.forEach(s => {
            if (s.assigned_shooter_id) {
              const u = shooterUsers?.find(x => x.id === s.assigned_shooter_id);
              if (u) {
                s.user_profiles = { id: u.id, name: u.name, phone: u.phone, role: u.role };
                s.assigned_shooters = [u.name];
              }
            }
          });
        }
      } else {
        console.log('ℹ️ [스튜디오] 이번 주 배정된 촬영자 없음');
      }

      console.log('✅ 스튜디오 스케줄 표시:', displaySchedules.length, '개');

      setSchedules(displaySchedules);
    } catch (error) {
      console.error('스케줄 데이터 로딩 오류:', error);
      throw error;
    }
  };

  const fetchStudioLocations = async () => {
    if (!hasAccess) return;
    
    try {
      const { data: allLocations, error: locationError } = await supabase
        .from('sub_locations')
        .select('*, main_locations(name)')
        .eq('is_active', true);
      
      if (locationError) throw locationError;
      
      const studioLocations = allLocations?.filter(loc => {
        const isNumeric = /^\d+$/.test(loc.name || '');
        const studioNumber = parseInt(loc.name || '0');
        const isStudioLocation = loc.main_location_id === 8;
        
        return isNumeric && studioNumber >= 1 && studioNumber <= 15 && isStudioLocation;
      }) || [];

      studioLocations.sort((a, b) => {
        const numA = parseInt(a.name || '0');
        const numB = parseInt(b.name || '0');
        return numA - numB;
      });

      const studioWithShootingTypes = await Promise.all(
        studioLocations.map(async (studio) => {
          try {
            const { data: shootingTypeData, error: shootingTypeError } = await supabase
              .from('sub_location_shooting_types')
              .select(`
                id,
                is_primary,
                shooting_types!inner(
                  id,
                  name,
                  is_active
                )
              `)
              .eq('sub_location_id', studio.id)
              .eq('shooting_types.is_active', true)
              .order('is_primary', { ascending: false });
            
            if (shootingTypeError) {
              return {
                ...studio,
                shooting_types: [],
                primary_shooting_type: null,
                shootingTypes: []
              };
            }
            
            const primaryType = shootingTypeData?.find(st => st.is_primary)?.shooting_types.name || null;
            const allTypes = shootingTypeData?.map(st => st.shooting_types.name) || [];
            
            return {
              ...studio,
              shooting_types: allTypes,
              primary_shooting_type: primaryType,
              shootingTypes: allTypes
            };
            
          } catch (error) {
            return {
              ...studio,
              shooting_types: [],
              primary_shooting_type: null,
              shootingTypes: []
            };
          }
        })
      );
      
      console.log('✅ 스튜디오 위치 조회 성공:', studioWithShootingTypes.length, '개');
      setStudioLocations(studioWithShootingTypes);
      
    } catch (error) {
      console.error('스튜디오 데이터 로딩 오류:', error);
      throw error;
    }
  };

  // 🔥 개선된 날짜 생성 함수
  const generateWeekDates = () => {
    let startOfWeek;
    
    try {
      startOfWeek = new Date(currentWeek);
      
      if (isNaN(startOfWeek.getTime())) {
        throw new Error('Invalid date from WeekContext');
      }
    } catch (error) {
      console.warn('⚠️ WeekContext currentWeek 문제 감지, 현재 날짜로 대체:', error);
      startOfWeek = new Date();
    }
    
    const dayOfWeek = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    
    const dates: { id: string; date: string; day: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      
      if (isNaN(date.getTime())) {
        console.error('❌ 날짜 생성 실패 at index:', i);
        continue;
      }
      
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      
      dates.push({
        id: dateStr,
        date: dateStr,
        day: date.getDate()
      });
    }
    
    console.log('✅ 생성된 주간 날짜:', dates.map(d => d.date));
    return dates;
  };

  const isStudioCompatible = useCallback((studioId: number, shootingType: string) => {
    if (!shootingType || !shootingTypeMapping.length) return true;
    
    const compatibleStudioIds = shootingTypeMapping
      .filter(mapping => mapping.shooting_types?.name === shootingType)
      .map(mapping => mapping.sub_location_id);
    
    return compatibleStudioIds.includes(studioId);
  }, [shootingTypeMapping]);

  const handleDragStart = useCallback((e: React.DragEvent, schedule: any) => {
    console.log('🎯 메인 핸들러 - 드래그 시작:', schedule.professor_name);
    setDraggedSchedule(schedule);
  }, []);

  const handleDragEnd = useCallback(() => {
    console.log('🎯 메인 핸들러 - 드래그 종료');
    setTimeout(() => {
      setDraggedSchedule(null);
    }, 100);
  }, []);

  const handleCellClick = (date: string, location: any) => {
    if (!hasAccess) return;
    
    const studioData = studioLocations.find(s => s.id === location.id);
    console.log('🔍 스튜디오 데이터:', studioData);
    console.log('🔍 촬영형식들:', studioData?.shooting_types);
    console.log('🔍 기본 촬영형식:', studioData?.primary_shooting_type);
    
    const defaultShootingType = studioData?.primary_shooting_type || studioData?.shooting_types?.[0] || null;
    
    const modalData = {
      mode: 'create',
      date,
      locationId: location.id,
      scheduleData: {
        sub_location_id: location.id,
        shooting_type: defaultShootingType,
        shoot_date: date,
        start_time: '09:00',
        end_time: '16:00',
        professor_name: '',
        course_name: '',
        course_code: '',
        memo: ''
      },
      shootingTypeMapping
    };
    
    console.log('📋 모달 전달 데이터:', modalData);
    
    setModalData(modalData);
    setModalOpen(true);
  };

  const getScheduleForCell = (date: string, location: any) => {
    const cellSchedules = schedules.filter(s => s.shoot_date === date && s.sub_location_id === location.id);
    return cellSchedules;
  };

  const handleScheduleCardClick = (schedule: any) => {
    if (!hasAccess) return;
    
    console.log('🎯 카드 클릭 - 모달 열기:', schedule);
    
    const modalData = {
      mode: 'edit',
      date: schedule.shoot_date,
      locationId: schedule.sub_location_id,
      scheduleData: schedule,
      shootingTypeMapping
    };
    
    setModalData(modalData);
    setModalOpen(true);
  };

  const handleCellDrop = useCallback((date: string, location: any, draggedData: any) => {
    console.log('🎯 드롭 처리 시작:', { date, location: location.name, draggedData });
    
    setDraggedSchedule(null);
    
    if (!draggedData) {
      console.warn('⚠️ 드래그 데이터가 없음');
      return;
    }
    
    if (draggedData.sub_location_id === location.id && draggedData.shoot_date === date) {
      console.log('🎯 같은 위치로 드롭 - 무시');
      return;
    }
    
    if (draggedData.shooting_type && !isStudioCompatible(location.id, draggedData.shooting_type)) {
      const compatibleStudios = studioLocations.filter(studio => 
        isStudioCompatible(studio.id, draggedData.shooting_type)
      );
      const compatibleNames = compatibleStudios.map(s => `${s.name}번`).join(', ');
      
      alert(`⚠️ 호환성 오류\n\n"${draggedData.shooting_type}" 촬영형식은 ${location.name}번 스튜디오에서 지원되지 않습니다.\n\n지원 가능한 스튜디오: ${compatibleNames}`);
      return;
    }
    
    if (draggedData.shoot_date !== date) {
      const confirmed = window.confirm(
        `스케줄을 다른 날짜로 이동하시겠습니까?\n\n` +
        `${draggedData.shoot_date} → ${date}\n` +
        `${draggedData.professor_name} / ${draggedData.course_name}`
      );
      
      if (confirmed) {
        handleDateAndStudioChange(draggedData.id, date, location.id);
      }
    } else {
      handleStudioReassign(draggedData.id, location.id);
    }
  }, [isStudioCompatible, studioLocations]);

  const renderStudioScheduleCard = (schedule: any) => {
    const isDragging = draggedSchedule?.id === schedule.id;
    const isCancelled = schedule.approval_status === 'cancelled' && schedule.is_active === false;

    const shooterText = getShooterText(schedule);

    return (
      <ScheduleCardErrorBoundary key={schedule.id}>
        <div 
          data-schedule-id={schedule.id}
          style={{
            position: 'relative',
            transition: 'all 0.2s ease',
            opacity: isCancelled ? 0.5 : 1,
            filter: isCancelled ? 'grayscale(50%)' : 'none',
          }}
        >
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
              취소완료
            </div>
          )}

          <UnifiedScheduleCard
            schedule={schedule}
            scheduleType="studio"
            isDragging={isDragging}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onClick={(clickedSchedule) => {
              handleScheduleCardClick(clickedSchedule);
            }}
            onContextMenu={handleScheduleCardClick}
            isAdmin={true}
            onDelete={handleDeleteSchedule}
            onSoftDelete={handleDeleteSchedule}
            shooterText={shooterText}
          />
        </div>
      </ScheduleCardErrorBoundary>
    );
  };

  const handleDateAndStudioChange = async (scheduleId: number, newDate: string, newStudioId: number) => {
    if (!hasAccess) return;
    
    try {
      const { error } = await supabase
        .from('schedules')
        .update({ 
          shoot_date: newDate,
          sub_location_id: newStudioId,
          updated_at: new Date().toISOString()
        })
        .eq('id', scheduleId);
      
      if (error) {
        console.error('일정 이동 오류:', error);
        alert('일정 이동 오류: ' + error.message);
      } else {
        alert('스케줄이 성공적으로 이동되었습니다.');
        fetchSchedules();
      }
    } catch (error) {
      console.error('일정 이동 처리 오류:', error);
      alert('일정 이동 중 오류가 발생했습니다.');
    }
  };

  const handleStudioReassign = async (scheduleId: number, newStudioId: number) => {
    if (!hasAccess) return;
    
    try {
      const currentSchedule = schedules.find(s => s.id === scheduleId);
      if (!currentSchedule) return;

      const sourceStudio = studioLocations.find(s => s.id === currentSchedule.sub_location_id);
      const targetStudio = studioLocations.find(s => s.id === newStudioId);
      
      const confirmed = window.confirm(
        `스케줄을 이동하시겠습니까?\n\n` +
        `${sourceStudio?.name}번 → ${targetStudio?.name}번\n` +
        `${currentSchedule.professor_name} / ${currentSchedule.course_name}`
      );
      
      if (!confirmed) return;

      const { error } = await supabase
        .from('schedules')
        .update({ 
          sub_location_id: newStudioId,
          updated_at: new Date().toISOString()
        })
        .eq('id', scheduleId);
      
      if (error) {
        console.error('스튜디오 재배정 오류:', error);
        alert('스튜디오 재배정 오류: ' + error.message);
      } else {
        alert(`스케줄이 ${targetStudio?.name}번 스튜디오로 이동되었습니다.`);
        fetchSchedules();
      }
    } catch (error) {
      console.error('재배정 처리 오류:', error);
      alert('스케줄 이동 중 오류가 발생했습니다.');
    }
  };

  const getLocationColor = (locationId: number) => {
    return { bg: '#fafafa', border: '#e5e7eb', text: '#1f2937' };
  };

  // 🔥 사용자 정보 가져오기 함수 (localStorage → currentUser)
  const getCurrentUserInfo = () => {
    const name = currentUser?.name || '관리자';
    if (currentUser?.role === 'system_admin') {
      return name || '시스템 관리자';
    }
    return name;
  };

  // 🔥 승인 상태 결정 함수
  const getApprovalStatus = (action: string) => {
    switch (action) {
      case 'approve': return 'approved';
      case 'request': return 'approval_requested';
      default: return 'pending';
    }
  };

  // 🔥 취소 승인 처리 함수
  const handleCancelApproval = async (adminName: string) => {
    if (!modalData?.scheduleData?.id) {
      throw new Error('취소할 스케줄 ID가 없습니다.');
    }

    const scheduleId = modalData.scheduleData.id;

    // 취소 승인 처리
    const { error } = await supabase
      .from('schedules')
      .update({
        approval_status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', scheduleId);

    if (error) {
      throw new Error(`취소 승인 실패: ${error.message}`);
    }

    // 🔥 히스토리 기록 (changed_by = numericId)
    await supabase
      .from('schedule_history')
      .insert({
        schedule_id: scheduleId,
        change_type: 'cancelled',
        changed_by: currentUser?.id ?? null,  // ✅ numericId
        description: `관리자 취소 승인 (승인자: ${adminName})`,
        old_value: JSON.stringify({ approval_status: modalData.scheduleData.approval_status }),
        new_value: JSON.stringify({ approval_status: 'cancelled' }),
        created_at: new Date().toISOString(),
        changed_at: new Date().toISOString()
      });

    console.log('✅ 취소 승인 완료');
    await fetchSchedules();
    return { success: true, message: '취소 승인이 완료되었습니다.' };
  };

  // 🔥 스케줄 수정 함수
  const updateSchedule = async (updateData: any, adminName: string) => {
    const scheduleId = modalData.scheduleData.id;

    const { error } = await supabase
      .from('schedules')
      .update(updateData)
      .eq('id', scheduleId);
      
    if (error) {
      throw new Error(`수정 실패: ${error.message}`);
    }

    // 🔥 히스토리 기록 (수정 시)
    await supabase
      .from('schedule_history')
      .insert({
        schedule_id: scheduleId,
        change_type: updateData.approval_status,
        changed_by: currentUser?.id ?? null, // ✅ numericId
        description: `스케줄 수정 (수정자: ${adminName})`,
        old_value: JSON.stringify(modalData.scheduleData),
        new_value: JSON.stringify(updateData),
        created_at: new Date().toISOString(),
        changed_at: new Date().toISOString()
      });
    
    console.log('✅ 스튜디오 스케줄 수정 완료');
  };

  // 🔥 스케줄 생성 함수
  const createSchedule = async (scheduleData: any, adminName: string) => {
    const newScheduleData = {
      ...scheduleData,
      schedule_type: 'studio',
      team_id: 1,
      is_active: true,
      created_at: new Date().toISOString()
    };

    const { data: insertResult, error } = await supabase
      .from('schedules')
      .insert([newScheduleData])
      .select();
      
    if (error) {
      throw new Error(`등록 실패: ${error.message}`);
    }

    const created = insertResult?.[0];

    // 🔥 히스토리 기록 (신규 등록 시)
    await supabase
      .from('schedule_history')
      .insert({
        schedule_id: created.id,
        change_type: 'created',
        changed_by: currentUser?.id ?? null,  // ✅ numericId
        description: `스케줄 신규 등록 (등록자: ${getCurrentUserInfo()})`,
        new_value: JSON.stringify(newScheduleData),
        created_at: new Date().toISOString(),
        changed_at: new Date().toISOString()
      });
        
    console.log('✅ 스튜디오 신규 등록 완료:', insertResult);
  };

  // 🔥 일반 스케줄 작업 처리 함수
  const handleScheduleOperation = async (data: any, action: string, adminName: string) => {
    // ✅ 필수 필드 검증
    const requiredFields = {
      shoot_date: '촬영 날짜',
      start_time: '시작 시간',
      end_time: '종료 시간',
      professor_name: '교수명',
      sub_location_id: '스튜디오'
    };
    
    for (const [field, label] of Object.entries(requiredFields)) {
      const value = (data as any)[field];
      
      if (value === null || value === undefined || value === '') {
        throw new Error(`${label}은 필수입니다.`);
      }
      
      if (typeof value === 'string' && value.trim() === '') {
        throw new Error(`${label}을 입력해주세요.`);
      }
    }
    
    if (data.start_time >= data.end_time) {
      throw new Error('종료 시간은 시작 시간보다 늦어야 합니다.');
    }

    // ✅ 호환성 검사
    if (data.shooting_type && data.sub_location_id) {
      if (!isStudioCompatible(parseInt(data.sub_location_id), data.shooting_type)) {
        const studioName = studioLocations.find(s => s.id === parseInt(data.sub_location_id))?.name;
        const compatibleStudios = studioLocations.filter(studio => 
          isStudioCompatible(studio.id, data.shooting_type)
        );
        const compatibleNames = compatibleStudios.map(s => `${s.name}번`).join(', ');
        
        throw new Error(
          `호환성 오류: "${data.shooting_type}" 촬영형식은 ${studioName}번 스튜디오에서 지원되지 않습니다.\n\n지원 가능한 스튜디오: ${compatibleNames}`
        );
      }
    }

    // ✅ 공통 데이터 구성
    const commonData = {
      shoot_date: data.shoot_date,
      start_time: data.start_time,
      end_time: data.end_time,
      professor_name: data.professor_name,
      course_name: data.course_name || '',
      course_code: data.course_code || '',
      shooting_type: data.shooting_type || 'PPT',
      notes: data.notes || '',
      sub_location_id: parseInt(data.sub_location_id),
      approval_status: getApprovalStatus(action),
      approved_at: action === 'approve' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    };

    // ✅ 수정 vs 신규 등록
    if (modalData?.mode === 'edit' && modalData?.scheduleData) {
      await updateSchedule(commonData, adminName);
      const message = action === 'approve' ? '수정 및 승인 완료되었습니다.' : '수정 완료되었습니다.';
      await fetchSchedules();
      return { success: true, message };
    } else {
      await createSchedule(commonData, adminName);
      const message = action === 'approve' ? '등록 및 승인 완료되었습니다.' : '등록 완료되었습니다.';
      await fetchSchedules();
      return { success: true, message };
    }
  };

  // 🔥 통합된 handleSave 함수
  const handleSave = async (data: any, action: 'temp' | 'request' | 'approve' | 'cancel_approve') => {
    try {
      console.log('💾 스튜디오 스케줄 저장 시작:', { data, action, modalData });
      
      const adminName = getCurrentUserInfo();

      switch (action) {
        case 'cancel_approve':
          return await handleCancelApproval(adminName);
        
        case 'approve':
        case 'request':
        case 'temp':
        default:
          return await handleScheduleOperation(data, action, adminName);
      }

    } catch (error) {
      console.error('저장 오류:', error);
      const message = error instanceof Error ? error.message : '저장 중 오류가 발생했습니다.';
      return { success: false, message };
    }
  };

  const handleSplitSchedule = async (scheduleId: number, splitPoints: string[], reason: string) => {
    console.log('🔧 스케줄 분할 요청:', { scheduleId, splitPoints, reason });

    try {
      const timeToMinutes = (timeString: string): number => {
        const [hours, minutes] = timeString.split(':').map(Number);
        return hours * 60 + minutes;
      };

      const minutesToTime = (minutes: number): string => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:00`;
      };

      const { data: originalSchedule, error: fetchError } = await supabase
        .from('schedules')
        .select('*')
        .eq('id', scheduleId)
        .single();

      if (fetchError || !originalSchedule) {
        throw new Error('원본 스케줄을 찾을 수 없습니다.');
      }

      const startMinutes = timeToMinutes(originalSchedule.start_time);
      const endMinutes = timeToMinutes(originalSchedule.end_time);
      const splitMinutes = splitPoints.map(timeToMinutes).sort((a, b) => a - b);
      
      const segments: { start_time: string; end_time: string }[] = [];
      let currentStart = startMinutes;

      splitMinutes.forEach((splitPoint) => {
        if (currentStart < splitPoint) {
          segments.push({
            start_time: minutesToTime(currentStart),
            end_time: minutesToTime(splitPoint)
          });
          currentStart = splitPoint;
        }
      });

      if (currentStart < endMinutes) {
        segments.push({
          start_time: minutesToTime(currentStart),
          end_time: minutesToTime(endMinutes)
        });
      }

      if (segments.length < 2) {
        throw new Error('유효한 분할 구간이 생성되지 않았습니다.');
      }

      console.log('🔧 생성된 세그먼트:', segments);

      const scheduleGroupId = `split_${scheduleId}_${Date.now()}`;

      const newSchedules = segments.map((segment) => ({
        ...originalSchedule,
        id: undefined,
        parent_schedule_id: scheduleId,
        schedule_group_id: scheduleGroupId,
        is_split_schedule: true,
        start_time: segment.start_time,
        end_time: segment.end_time,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { data: insertedSchedules, error: insertError } = await supabase
        .from('schedules')
        .insert(newSchedules)
        .select();

      if (insertError) {
        throw new Error(`분할 스케줄 생성 실패: ${insertError.message}`);
      }

      const { error: updateError } = await supabase
        .from('schedules')
        .update({
          is_split: true,
          schedule_group_id: scheduleGroupId,
          split_at: new Date().toISOString(),
          split_reason: reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', scheduleId);

      if (updateError) {
        throw new Error(`원본 스케줄 업데이트 실패: ${updateError.message}`);
      }

      await supabase
        .from('schedule_history')
        .insert({
          schedule_id: scheduleId,
          change_type: 'split',
          changed_by: currentUser?.id ?? null, // ✅ numericId
          description: `스케줄 ${segments.length}개로 분할 (사유: ${reason})`,
          old_value: JSON.stringify({ 
            start_time: originalSchedule.start_time, 
            end_time: originalSchedule.end_time 
          }),
          new_value: JSON.stringify({ 
            segments, 
            schedule_group_id: scheduleGroupId,
            child_ids: insertedSchedules?.map(s => s.id) 
          }),
          created_at: new Date().toISOString(),
          changed_at: new Date().toISOString()
        });

      console.log('✅ 분할 완료:', insertedSchedules?.length, '개 생성');

      await fetchSchedules();

      alert(`스케줄이 성공적으로 ${segments.length}개로 분할되었습니다!`);

    } catch (error) {
      console.error('❌ 분할 오류:', error);
      alert(error instanceof Error ? error.message : '분할 처리 중 오류가 발생했습니다.');
      throw error;
    }
  };

  const handleDeleteSchedule = async (id: number) => {
    console.log('[ADMIN] 삭제 완료 ID:', id);
    await fetchSchedules();
  };

  const handleModalClose = () => {
    console.log('🎯 모달 닫기');
    setModalOpen(false);
    setModalData(null);
  };

  // --- 렌더링 영역 ---

  if (accessLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #059669',
          borderTop: '4px solid transparent',
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

  if (!hasAccess) {
    return (
      <div style={{ 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '40px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ color: '#dc2626', marginBottom: '16px' }}>
            접근 권한이 없습니다
          </h3>
          <p>스튜디오 관리는 시스템 관리자, 스케줄 관리자, 스튜디오 매니저, 매니저만 접근할 수 있습니다.</p>
        </div>
      </div>
    );
  }

  if (!isClient || isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '400px',
        backgroundColor: '#f8fafc'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #059669',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <div style={{ 
            color: '#6b7280',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            스튜디오 데이터를 불러오는 중...
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
        height: '400px',
        backgroundColor: '#fef2f2'
      }}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '16px'
          }}>
            ⚠️
          </div>
          <div style={{
            fontSize: '18px',
            fontWeight: 'bold',
            color: '#dc2626',
            marginBottom: '8px'
          }}>
            스튜디오 데이터 로딩 오류
          </div>
          <div style={{
            fontSize: '14px',
            color: '#6b7280',
            marginBottom: '20px'
          }}>
            {error}
          </div>
          <button 
            onClick={fetchData}
            style={{
              padding: '10px 20px',
              backgroundColor: '#059669',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px'
            }}
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <BaseScheduleGrid
        title="스튜디오 관리 패널"
        leftColumnTitle="스튜디오"
        locations={studioLocations.map(loc => ({
          id: loc.id,
          name: `${loc.name}번`,
          shootingTypes: loc.shooting_types || [],
          primaryShootingType: loc.primary_shooting_type || null,
          type: 'studio',
          studioId: loc.id
        }))}
        schedules={schedules}
        currentWeek={new Date(currentWeek)}
        onWeekChange={(direction) => {
          console.log('🔄 주차 변경 요청:', direction);
          navigateWeek(direction > 0 ? 'next' : 'prev');
        }}
        onCellClick={handleCellClick}
        getScheduleForCell={getScheduleForCell}
        renderScheduleCard={renderStudioScheduleCard}
        showAddButton={true}
        onCopyPreviousWeek={undefined}
        userRole="admin"
        pageType="studio"
        getLocationColor={getLocationColor}
        onCellDrop={handleCellDrop}
        draggedSchedule={draggedSchedule}
        isStudioCompatible={isStudioCompatible}
      />

      {modalOpen && (
        <StudioScheduleModal
          open={modalOpen}
          onClose={handleModalClose}
          initialData={modalData || {}}
          locations={studioLocations}
          userRole="admin"
          onSave={handleSave}
          onDelete={handleDeleteSchedule}
          onSplitSchedule={handleSplitSchedule}
          currentUser={currentUser}   // ✅ 모달에도 현재 유저 전달
        />
      )}

      <style jsx global>{`
        .highlight-schedule {
          background-color: #fff3cd !important;
          border: 2px solid #ffc107 !important;
          box-shadow: 0 0 15px rgba(255, 193, 7, 0.5) !important;
          animation: highlight-pulse 1s ease-in-out !important;
          z-index: 10 !important;
        }

        @keyframes highlight-pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.03); }
          100% { transform: scale(1); }
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
