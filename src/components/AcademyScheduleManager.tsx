"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../utils/supabaseClient";
import BaseScheduleGrid from "./core/BaseScheduleGrid";
import AcademyScheduleModal from "./modals/AcademyScheduleModal";
import { useWeek } from "../contexts/WeekContext";
import { UnifiedScheduleCard } from "./cards/UnifiedScheduleCard";
import { ScheduleCardErrorBoundary } from "./ErrorBoundary";

// 🔥 기존 학원별 색상 정의 완전 유지
const academyColors: Record<number, { bg: string; border: string; text: string }> = {
  1: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
  2: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
  3: { bg: '#dcfce7', border: '#22c55e', text: '#166534' },
  4: { bg: '#fce7f3', border: '#ec4899', text: '#be185d' },
  5: { bg: '#f3e8ff', border: '#8b5cf6', text: '#6b21a8' },
  6: { bg: '#fed7d7', border: '#ef4444', text: '#b91c1c' },
  7: { bg: '#e0f2fe', border: '#06b6d4', text: '#0e7490' },
  9: { bg: '#ccfbf1', border: '#14b8a6', text: '#115e59' },
};

export default function AcademyScheduleManager() {
  const { currentWeek, navigateWeek } = useWeek();
  
  const [schedules, setSchedules] = useState<any[]>([]);
  const [academyLocations, setAcademyLocations] = useState<any[]>([]);
  const [mainLocations, setMainLocations] = useState<any[]>([]);
  const [shooters, setShooters] = useState<any[]>([]);
  const [selectedSchedules, setSelectedSchedules] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<any>(null);

  const [filters, setFilters] = useState({
    mainLocationId: 'all',
    shootingType: 'all',
    status: 'all'
  });

  const isProcessingRef = useRef(false);
  const [userRole, setUserRole] = useState<'admin' | 'manager' | 'user'>('user');

  // 🔥 역할 초기화
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const role = localStorage.getItem('userRole') || '';
      const name = localStorage.getItem('userName') || '';
      let normalizedRole: 'admin' | 'manager' | 'user' = 'user';
      if (name === 'manager1' || role === 'system_admin' || role === 'schedule_admin') {
        normalizedRole = 'admin';
      } else if (role === 'academy_manager' || role === 'manager' || role === 'studio_manager') {
        normalizedRole = 'manager';
      }
      setUserRole(normalizedRole);
    }
  }, []);

  // 🔥 날짜 생성 함수
  const generateWeekDates = useCallback(() => {
    try {
      const startOfWeek = new Date(currentWeek);
      if (isNaN(startOfWeek.getTime())) return [];
      const dayOfWeek = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      startOfWeek.setDate(diff);
      return Array.from({ length: 7 }, (_, i) => {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        return { id: dateStr, date: dateStr, day: date.getDate() };
      });
    } catch {
      return [];
    }
  }, [currentWeek]);

  const getUserAccessibleAcademies = useCallback(() => {
    const userName = localStorage.getItem('userName') || '';
    const role = localStorage.getItem('userRole') || '';
    if (process.env.NODE_ENV === 'development' && role !== 'academy_manager') {
      return mainLocations;
    }
    if (userName === 'manager1' || role === 'manager1' || role === 'system_admin' || role === 'schedule_admin') {
      return mainLocations;
    } else if (role === 'academy_manager') {
      const assignedAcademyIds = JSON.parse(localStorage.getItem('assignedAcademyIds') || '[]');
      return mainLocations.filter(academy => assignedAcademyIds.includes(academy.id));
    }
    return [];
  }, [mainLocations]);

  const isManagerMode = () => (localStorage.getItem('userRole') || '') === 'academy_manager';

// ✅ AcademyScheduleManager.tsx 내부: fetchSchedules 전체 교체
const fetchSchedules = useCallback(async (
  locationsOverride?: any[], 
  mainLocationsOverride?: any[]
) => {
  try {
    // 1) 주간 날짜 생성/검증
    let weekDates = generateWeekDates();

    if (!Array.isArray(weekDates) || weekDates.length === 0) {
      console.error('❌ weekDates 유효성 검증 실패:', weekDates);
      setSchedules([]);
      return;
    }
    if (Array.isArray(weekDates[0])) {
      weekDates = weekDates[0] as any[];
    }
    if (weekDates.length < 7) {
      console.error('❌ 최종 길이 부족:', weekDates.length);
      setSchedules([]);
      return;
    }

    const firstDateObj = weekDates[0];
    const lastDateObj = weekDates[weekDates.length - 1];

    if (!firstDateObj?.date || !lastDateObj?.date) {
      console.error('❌ 날짜 객체 유효성 검증 실패:', { firstDateObj, lastDateObj });
      setSchedules([]);
      return;
    }

    const startDate = firstDateObj.date;
    const endDate = lastDateObj.date;

    console.log('✅ [학원] 유효한 날짜 범위:', { startDate, endDate });

    // 2) 접근 가능한 학원/강의실 계산
    const locationsToUse = locationsOverride || academyLocations;
    const mainLocationsToUse = mainLocationsOverride || mainLocations;

    console.log('🔍 [학원] 사용할 locations:', {
      locationsCount: locationsToUse.length,
      mainLocationsCount: mainLocationsToUse.length
    });

    const userRole = (typeof window !== 'undefined' && localStorage.getItem('userRole')) || '';
    let accessibleAcademies = mainLocationsToUse;

    if (userRole === 'academy_manager') {
      const assignedAcademyIds = JSON.parse((typeof window !== 'undefined' && localStorage.getItem('assignedAcademyIds')) || '[]');
      accessibleAcademies = mainLocationsToUse.filter(academy => assignedAcademyIds.includes(academy.id));
    }

    const accessibleAcademyIds = accessibleAcademies.map(academy => Number(academy.id));
    const accessibleLocationIds = locationsToUse
      .filter(location => accessibleAcademyIds.includes(Number(location.main_location_id)))
      .map(location => location.id);

    console.log('🔍 [학원] 접근 가능한 강의실:', {
      accessibleAcademyIds,
      accessibleLocationIds: accessibleLocationIds.length
    });

    if (accessibleLocationIds.length === 0) {
      console.log('⚠️ 접근 가능한 강의실 없음');
      setSchedules([]);
      return;
    }

    // 3) 학원 스케줄 조회 (sub_locations 조인)
    const { data, error } = await supabase
      .from('schedules')
      .select(`
        *, 
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
      .eq('schedule_type', 'academy')
      .in('approval_status', [
        'pending', 'approval_requested', 'approved', 'confirmed', 
        'modification_requested', 'modification_approved',
        'cancellation_requested', 'deletion_requested', 'cancelled'
      ])
      .in('sub_location_id', accessibleLocationIds)
      .gte('shoot_date', startDate)
      .lte('shoot_date', endDate)
      .order('shoot_date')
      .order('start_time');

    if (error) {
      console.error('🔥 [학원] 스케줄 조회 오류:', error);
      throw error;
    }

    // 4) 필수 필드 검증
    const validSchedules = (data || []).filter(schedule => 
      schedule &&
      schedule.start_time &&
      schedule.end_time &&
      schedule.professor_name &&
      schedule.sub_locations
    );

    console.log('✅ [학원] 유효 스케줄 개수:', validSchedules.length);

    // 5) 요청자/승인자 프로필(선택) - 기존 로직 유지
    if (validSchedules.length > 0) {
      const userIds = [
        ...new Set(
          validSchedules
            .flatMap(s => [s.requested_by, s.approved_by])
            .filter(Boolean)
        )
      ];

      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('user_profiles')
          .select('id, name, email')
          .in('id', userIds as number[]);

        validSchedules.forEach(schedule => {
          if (schedule.requested_by) {
            schedule.requested_user = users?.find(u => u.id === schedule.requested_by) || null;
          }
          if (schedule.approved_by) {
            schedule.approved_user = users?.find(u => u.id === schedule.approved_by) || null;
          }
        });
      }
    }

    // 🔧🔧🔧 PATCH: 여기서부터가 핵심입니다.
    // 6) assigned_shooter_id 기반으로 users에서 촬영자 프로필을 모아와 붙인다.
    const shooterIds = [
      ...new Set(
        validSchedules
          .map(s => s.assigned_shooter_id)
          .filter((v): v is number => !!v)
      )
    ];

    console.log('🔎 [학원] 배정된 촬영자 ID 수:', shooterIds.length);

    if (shooterIds.length > 0) {
      const { data: shooterUsers, error: shooterUsersErr } = await supabase
        .from('users')
        .select('id, name, phone, role')
        .in('id', shooterIds);

      if (shooterUsersErr) {
        console.error('🔥 [학원] 촬영자 users 조회 오류:', shooterUsersErr);
      } else {
        // 각 스케줄에 user_profiles / assigned_shooters 세팅
        validSchedules.forEach(s => {
          if (s.assigned_shooter_id) {
            const u = shooterUsers?.find(x => x.id === s.assigned_shooter_id);
            if (u) {
              // UnifiedScheduleCard 폴백에 맞춰 둘 다 채우면 가장 안전
              s.user_profiles = { id: u.id, name: u.name, phone: u.phone, role: u.role };
              s.assigned_shooters = [u.name];
            }
          }
        });
      }
    } else {
      console.log('ℹ️ [학원] 이번 주 배정된 촬영자 없음 (assigned_shooter_id 미설정)');
    }

    // 7) 상태 저장
    setSchedules(validSchedules);
    console.log('✅ [학원] 스케줄 세팅 완료 (배정자 매핑 반영)');

  } catch (error) {
    console.error('❌ [학원] 스케줄 조회 오류:', error);
    throw error;
  }
}, [academyLocations, mainLocations, generateWeekDates]);


  const fetchAcademyLocations = async () => {
    const { data, error } = await supabase
      .from('sub_locations')
      .select(`*, main_locations!inner(*)`)
      .eq('is_active', true)
      .eq('main_locations.location_type', 'academy')
      .order('main_location_id')
      .order('id');
    if (error) throw error;
    const accessibleAcademies = getUserAccessibleAcademies();
    const accessibleAcademyIds = accessibleAcademies.map(academy => academy.id);
    let filteredLocations = (data || []);
    const role = localStorage.getItem('userRole') || '';
    if (role === 'academy_manager') {
      filteredLocations = filteredLocations.filter((loc: any) =>
        accessibleAcademyIds.includes(loc.main_location_id)
      );
    }
    const formattedLocations = filteredLocations.map((loc: any) => ({
      ...loc,
      name: `${loc.main_locations.name} - ${loc.name}`,
      displayName: `${loc.main_locations.name} - ${loc.name}`
    }));
    setAcademyLocations(formattedLocations);
  };

  const fetchMainLocations = async () => {
    const { data, error } = await supabase
      .from('main_locations')
      .select('*')
      .eq('is_active', true)
      .eq('location_type', 'academy')
      .order('name');
    if (error) throw error;
    setMainLocations(data || []);
  };

  // 🔎 모달에서 사용될 수 있는 촬영자 목록(옵션)
  const fetchShooters = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, phone, role, status')
        .eq('status', 'active')
        .in('role', ['shooter', 'schedule_admin', 'manager']);
      if (error) throw error;
      setShooters(data || []);
    } catch (e) {
      console.warn('촬영자 조회 오류(무시 가능):', e);
      setShooters([]);
    }
  };

  const fetchData = async () => {
    try {
      setError(null);
      setIsLoading(true);

      const { data: mainLocsData } = await supabase
        .from('main_locations')
        .select('*')
        .eq('is_active', true)
        .eq('location_type', 'academy')
        .order('name');
      const loadedMainLocations = mainLocsData || [];
      setMainLocations(loadedMainLocations);

      const role = localStorage.getItem('userRole') || '';
      let accessibleAcademies = loadedMainLocations;
      if (role === 'academy_manager') {
        const assignedAcademyIds = JSON.parse(localStorage.getItem('assignedAcademyIds') || '[]');
        accessibleAcademies = loadedMainLocations.filter(academy => assignedAcademyIds.includes(academy.id));
      }

      const { data: locsData } = await supabase
        .from('sub_locations')
        .select(`*, main_locations!inner(*)`)
        .eq('is_active', true)
        .eq('main_locations.location_type', 'academy')
        .order('main_location_id')
        .order('id');

      let loadedLocations = (locsData || []);
      const accessibleAcademyIds = accessibleAcademies.map(academy => academy.id);
      if (role === 'academy_manager') {
        loadedLocations = loadedLocations.filter((loc: any) =>
          accessibleAcademyIds.includes(loc.main_location_id)
        );
      }

      const formattedLocations = loadedLocations.map((loc: any) => ({
        ...loc,
        name: `${loc.main_locations.name} - ${loc.name}`,
        displayName: `${loc.main_locations.name} - ${loc.name}`
      }));
      setAcademyLocations(formattedLocations);

      await fetchShooters(); // 옵션
      await fetchSchedules(formattedLocations, loadedMainLocations);
    } catch (e) {
      console.error('데이터 로딩 오류:', e);
      setError('데이터를 불러오는데 실패했습니다. 네트워크 연결을 확인해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  // 🔥 localStorage 변경 감지 → 재조회
  useEffect(() => {
    const handleStorageChange = () => {
      const updatedFlag = localStorage.getItem('schedules_updated');
      if (updatedFlag) {
        const timestamp = parseInt(updatedFlag);
        if (Date.now() - timestamp < 3000) {
          fetchSchedules();
          localStorage.removeItem('schedules_updated');
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    const interval = setInterval(handleStorageChange, 1000);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [fetchSchedules]);

  useEffect(() => {
    if (currentWeek) fetchData();
  }, [currentWeek]);

  const handleCellClick = (date: string, location: any) => {
    const fallbackLocations = academyLocations.length > 0 ? academyLocations : [];
    const modalDataObj = {
      mode: 'create' as const,
      date,
      locationId: location.id,
      scheduleData: null,
      mainLocations,
      academyLocations: fallbackLocations,
      shooters
    };
    setModalData(modalDataObj);
    setModalOpen(true);
  };

  const handleScheduleCardClick = (schedule: any) => {
    try {
      if (!schedule || !schedule.id) return;
      const modalDataObj = {
        mode: 'edit' as const,
        scheduleData: schedule,
        date: schedule.shoot_date,
        locationId: schedule.sub_location_id,
        mainLocations,
        academyLocations,
        shooters
      };
      setModalData(modalDataObj);
      setModalOpen(true);
    } catch (error) {
      console.error('모달 열기 오류:', error);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalData(null);
  };

// 파일: src/components/AcademyScheduleManager.tsx
// 기존 handleSave 전부 교체
const handleSave = async (
  payload: any,
  action:
    | 'temp'
    | 'request'
    | 'approve'
    | 'modify_request'
    | 'cancel_request'
    | 'delete_request'
    | 'modify_approve'
    | 'cancel_approve'
    | 'delete_approve'
    | 'cancel'
    | 'delete'
    | 'cancel_cancel'
    | 'cancel_delete'
    | 'approve_modification'
) => {
  try {
    // 1) 상태 매핑
    const toHHMMSS = (t: string) =>
      t && t.length === 5 ? `${t}:00` : (t || '');

    const statusMap: Record<string, { approval_status?: string; is_active?: boolean }> = {
      temp: { approval_status: 'pending', is_active: true },
      request: { approval_status: 'approval_requested', is_active: true },
      approve: { approval_status: 'approved', is_active: true },
      modify_request: { approval_status: 'modification_requested', is_active: true },
      approve_modification: { approval_status: 'modification_approved', is_active: true },
      modify_approve: { approval_status: 'approved', is_active: true },
      cancel_request: { approval_status: 'cancellation_requested', is_active: true },
      delete_request: { approval_status: 'deletion_requested', is_active: true },
      cancel_approve: { approval_status: 'cancelled', is_active: false },
      delete_approve: { approval_status: 'deleted', is_active: false },
      cancel: { approval_status: 'cancelled', is_active: false },
      delete: { approval_status: 'deleted', is_active: false },
      cancel_cancel: {}, // 요청 철회는 상태 유지(사유만 히스토리에 남김)
      cancel_delete: {},
    };

    const status = statusMap[action] || {};

    // 2) 저장 대상 레코드 구성
    const scheduleId = payload.schedule_id || payload.id || payload?.scheduleData?.id || null;

    const record: any = {
      // 필수/공통
      schedule_type: 'academy',
      shoot_date: payload.shoot_date,
      start_time: toHHMMSS(payload.start_time),
      end_time: toHHMMSS(payload.end_time),
      professor_name: payload.professor_name || '',
      course_name: payload.course_name || '',
      course_code: payload.course_code || '',
      shooting_type: payload.shooting_type || '촬영',
      sub_location_id: Number(payload.sub_location_id),
      notes: payload.notes || '',
      // 상태
      ...(status.approval_status ? { approval_status: status.approval_status } : {}),
      ...(typeof status.is_active === 'boolean' ? { is_active: status.is_active } : {}),
    };

    // 3) (선택) 교수 카테고리 저장 — 이미 컬럼 만들어두셨다면 함께 기록
    //    payload.professor_category_name / professor_category_id 가 오면 같이 저장
    if (payload.professor_category_name) record.professor_category_name = payload.professor_category_name;
    if (payload.professor_category_id) record.professor_category_id = payload.professor_category_id;

    // 4) 승인/요청/취소/삭제 사유 필드 (있을 때만)
    if (action === 'modify_request' && payload.reason) record.modification_reason = payload.reason;
    if (action === 'cancel_request' && payload.reason) record.cancellation_reason = payload.reason;
    if (action === 'delete_request' && payload.reason) record.deletion_reason = payload.reason;

    // 5) DB 쓰기 (insert or update)
    let dbRes;
    if (scheduleId) {
      // update
      dbRes = await supabase
        .from('schedules')
        .update(record)
        .eq('id', scheduleId)
        .select()
        .single();
    } else {
      // insert
      dbRes = await supabase
        .from('schedules')
        .insert({ ...record })
        .select()
        .single();
    }

    if (dbRes.error) {
      console.error('❌ 스케줄 저장 실패:', dbRes.error);
      return { success: false, message: '스케줄 저장 실패' };
    }

    const saved = dbRes.data;
    const finalId = saved?.id;

    // 6) 히스토리 기록
    //    old/new 값을 넣고 싶으면 저장 전 select로 old를 가져와 diff 작성도 가능.
    const historyPayload: any = {
      schedule_id: finalId,
      change_type: action,
      description: payload.reason || '',
      changed_by: payload.currentUserId || null,
      old_value: null, // 필요시 채우기
      new_value: JSON.stringify(saved || {}),
    };

    const histRes = await supabase
      .from('schedule_history')
      .insert(historyPayload);

    if (histRes.error) {
      console.warn('⚠️ 히스토리 기록 실패(스케줄은 저장됨):', histRes.error);
    }

    // 7) 화면 갱신
    await fetchSchedules();

    return { success: true, message: '저장되었습니다.' };
  } catch (err) {
    console.error('❌ handleSave 오류:', err);
    return { success: false, message: '저장 중 오류가 발생했습니다.' };
  }
};


  const handleDelete = async (id: number) => {
    await fetchSchedules();
  };

  const getScheduleForCell = (date: string, location: any) => {
    try {
      return schedules.filter(s => s.shoot_date === date && s.sub_location_id === location.id);
    } catch {
      return [];
    }
  };

  const renderAcademyScheduleCard = (schedule: any) => {
    const isSelected = selectedSchedules.includes(schedule.id);
    const isCancelled = schedule.approval_status === 'cancelled' && schedule.is_active === false;
    const locationColor = getLocationColor(schedule.sub_location_id);

    // 🔥 촬영자 이름 문자열 (다중배정 → 단일배정 폴백 → user_profiles 이름 폴백)
    const shooterText =
      (Array.isArray(schedule.assigned_shooters) && schedule.assigned_shooters.length
        ? schedule.assigned_shooters.join(', ')
        : '') ||
      (schedule.user_profiles?.name ?? undefined);

    return (
      <ScheduleCardErrorBoundary key={schedule.id}>
        <div
          style={{
            position: 'relative',
            transition: 'all 0.2s ease',
            opacity: isCancelled ? 0.5 : 1,
            filter: isCancelled ? 'grayscale(50%)' : 'none',
            cursor: 'pointer'
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleScheduleCardClick(schedule);
          }}
        >
          {isCancelled && (
            <div style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 20, borderRadius: '8px', color: 'white',
              fontWeight: 'bold', fontSize: '14px', pointerEvents: 'none'
            }}>
              취소완료
            </div>
          )}

          <UnifiedScheduleCard
            schedule={schedule}
            scheduleType="academy"
            locationColor={locationColor}
            onClick={() => {}}
            onContextMenu={() => {}}
            showCheckbox={!isCancelled}
            isSelected={isSelected}
            onCheckboxChange={(checked) => {
              if (checked) setSelectedSchedules([...selectedSchedules, schedule.id]);
              else setSelectedSchedules(selectedSchedules.filter(id => id !== schedule.id));
            }}
            shooterText={shooterText} // ← 표시 폴백
            style={{ pointerEvents: 'none' }}
          />
        </div>
      </ScheduleCardErrorBoundary>
    );
  };

  const getLocationColor = (locationId: number) => {
    const location = academyLocations.find(loc => loc.id === locationId);
    const academyId = location?.main_location_id;
    return (academyColors as any)[academyId] || { bg: '#f8fafc', border: '#e2e8f0', text: '#1f2937' };
  };

  const getFilteredLocations = () => {
    let filtered = academyLocations;
    if (filters.mainLocationId !== 'all') {
      filtered = filtered.filter((loc: any) => loc.main_location_id === parseInt(filters.mainLocationId));
    }
    return filtered;
  };

  const getFilteredSchedules = () => {
    let filtered = schedules;
    if (filters.shootingType !== 'all') {
      filtered = filtered.filter((s: any) => s.shooting_type === filters.shootingType);
    }
    if (filters.status !== 'all') {
      filtered = filtered.filter((s: any) => s.approval_status === filters.status);
    }
    return filtered;
  };

  const renderFilters = () => {
    if (isManagerMode()) return null;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexDirection: 'row' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', minWidth: '40px' }}>
            학원:
          </label>
          <select
            value={filters.mainLocationId}
            onChange={(e) => setFilters({ ...filters, mainLocationId: e.target.value })}
            style={{
              padding: '4px 8px', border: '1px solid var(--border-color)', borderRadius: 4,
              background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13, outline: 'none'
            }}
          >
            <option value="all">전체 학원</option>
            {mainLocations.map((loc: any) => (
              <option key={loc.id} value={loc.id.toString()}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', minWidth: '50px' }}>
            촬영형식:
          </label>
          <select
            value={filters.shootingType}
            onChange={(e) => setFilters({ ...filters, shootingType: e.target.value })}
            style={{
              padding: '4px 8px', border: '1px solid var(--border-color)', borderRadius: 4,
              background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13, outline: 'none'
            }}
          >
            <option value="all">전체</option>
            <option value="촬영">촬영</option>
            <option value="중계">중계</option>
            <option value="(본사)촬영">(본사)촬영</option>
            <option value="라이브촬영">라이브촬영</option>
            <option value="라이브중계">라이브중계</option>
            <option value="(NAS)촬영">(NAS)촬영</option>
          </select>
        </div>
      </div>
    );
  };

  const handleBulkApproval = async (type: 'selected' | 'all') => {
    console.log('일괄 승인:', type);
  };

  if (isLoading) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        height: '400px', backgroundColor: '#f8fafc'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px', height: '40px', border: '4px solid #e5e7eb',
            borderTop: '4px solid #2563eb', borderRadius: '50%',
            animation: 'spin 1s linear infinite', margin: '0 auto 16px'
          }} />
          <div style={{ color: '#6b7280', fontSize: '14px', fontWeight: '500' }}>
            학원 스케줄을 불러오는 중...
          </div>
          <style jsx>{`
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          `}</style>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        height: '400px', backgroundColor: '#fef2f2'
      }}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#dc2626', marginBottom: '8px' }}>
            학원 스케줄 로딩 오류
          </div>
          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '20px' }}>
            {error}
          </div>
          <button
            onClick={fetchData}
            style={{
              padding: '10px 20px', backgroundColor: '#2563eb', color: 'white',
              border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px'
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
        title="학원 스케줄 관리"
        leftColumnTitle="강의실"
        locations={getFilteredLocations()}
        schedules={getFilteredSchedules()}
        currentWeek={currentWeek}
        onWeekChange={navigateWeek}
        onCellClick={handleCellClick}
        getScheduleForCell={getScheduleForCell}
        renderScheduleCard={renderAcademyScheduleCard}
        showAddButton={true}
        onCopyPreviousWeek={undefined}
        userRole={userRole}
        pageType="academy"
        getLocationColor={getLocationColor}
        customFilters={renderFilters()}
        onBulkApproval={userRole === 'admin' ? handleBulkApproval : undefined}
        selectedSchedules={selectedSchedules}
      />

      {modalOpen && (
        <AcademyScheduleModal
          open={modalOpen}
          onClose={closeModal}
          initialData={modalData}
          locations={modalData?.academyLocations || []}
          mainLocations={modalData?.mainLocations || []}
          userRole={userRole}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </>
  );
}
