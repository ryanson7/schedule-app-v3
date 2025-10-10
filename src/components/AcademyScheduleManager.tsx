"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "../utils/supabaseClient";
import { ProfessorAutocomplete } from '../ProfessorAutocomplete';
import { sendAdminResponseNotification } from "../utils/notifications";
import BaseScheduleGrid from "./core/BaseScheduleGrid";
import AcademyScheduleModal from "./modals/AcademyScheduleModal";
import { useWeek } from "../contexts/WeekContext";
import { UnifiedScheduleCard } from "./cards/UnifiedScheduleCard";
import { ScheduleCardErrorBoundary } from "./ErrorBoundary";

// 🔥 기존 학원별 색상 정의 완전 유지
const academyColors = {
  1: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
  2: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
  3: { bg: '#dcfce7', border: '#22c55e', text: '#166534' },
  4: { bg: '#fce7f3', border: '#ec4899', text: '#be185d' },
  5: { bg: '#f3e8ff', border: '#8b5cf6', text: '#6b21a8' },
  6: { bg: '#fed7d7', border: '#ef4444', text: '#b91c1c' },
  7: { bg: '#e0f2fe', border: '#06b6d4', text: '#0e7490' },
  default: { bg: '#f8fafc', border: '#e2e8f0', text: '#1f2937' }
};

// 🔥 기존 로딩 컴포넌트 완전 유지
const LoadingState = () => (
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
        borderTop: '4px solid #2563eb',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        margin: '0 auto 16px'
      }} />
      <div style={{ 
        color: '#6b7280',
        fontSize: '14px',
        fontWeight: '500'
      }}>
        학원 스케줄을 불러오는 중...
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

// 🔥 기존 에러 상태 컴포넌트 완전 유지
const ErrorState = ({ error, onRetry }: { error: string; onRetry: () => void }) => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '400px',
    backgroundColor: '#fef2f2'
  }}>
    <div style={{ textAlign: 'center', maxWidth: '400px' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
      <div style={{
        fontSize: '18px',
        fontWeight: 'bold',
        color: '#dc2626',
        marginBottom: '8px'
      }}>
        학원 스케줄 로딩 오류
      </div>
      <div style={{
        fontSize: '14px',
        color: '#6b7280',
        marginBottom: '20px'
      }}>
        {error}
      </div>
      <button 
        onClick={onRetry}
        style={{
          padding: '10px 20px',
          backgroundColor: '#2563eb',
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

export default function AcademyScheduleManager() {
  // 🔥 기존 상태들 완전 유지
  const [schedules, setSchedules] = useState<any[]>([]);
  const [academyLocations, setAcademyLocations] = useState<any[]>([]);
  const [mainLocations, setMainLocations] = useState<any[]>([]);
  const [shooters, setShooters] = useState<any[]>([]);
  const [selectedSchedules, setSelectedSchedules] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<any>(null);

  // 지난 주 복사 관련 상태
  const [isCopying, setIsCopying] = useState(false);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [lastWeekSchedules, setLastWeekSchedules] = useState<any[]>([]);
  const [selectedCopySchedules, setSelectedCopySchedules] = useState<number[]>([]);

  const [filters, setFilters] = useState({
    mainLocationId: 'all',
    shootingType: 'all',
    status: 'all'
  });

  const isProcessingRef = useRef(false);
  const { currentWeek, navigateWeek } = useWeek();

  // 🔥 역할 정규화 - localStorage에서 안전하게 읽어오기
  const [userRole, setUserRole] = useState<'admin' | 'manager' | 'user'>('user');

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
      console.log('🔍 역할 설정:', { role, name, normalizedRole });
    }
  }, []);

  // 🔥 localStorage 변경 감지 리스너 추가
  useEffect(() => {
    const handleStorageChange = () => {
      const role = localStorage.getItem('userRole') || '';
      const name = localStorage.getItem('userName') || '';
      
      let normalizedRole: 'admin' | 'manager' | 'user' = 'user';
      if (role === 'system_admin' || role === 'schedule_admin' || name === 'manager1') {
        normalizedRole = 'admin';
      } else if (role === 'academy_manager' || role === 'manager' || role === 'studio_manager') {
        normalizedRole = 'manager';
      }
      
      setUserRole(normalizedRole);
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    console.log('🔧 selectedSchedules 상태 변경됨:', selectedSchedules);
  }, [selectedSchedules]);

  useEffect(() => {
    fetchData();
  }, [currentWeek]);

  // 🔥 사용자 권한 확인 함수
  const getUserPermissions = () => {
    const userRole = localStorage.getItem('userRole') || '';
    const userName = localStorage.getItem('userName') || '';
    
    if (userName === 'manager1' || userRole === 'manager1' || userRole === 'system_admin' || userRole === 'schedule_admin') {
      return {
        canApprove: true,
        canDirectSave: true,
        canEdit: true,
        canDelete: true,
        canCancel: true,
        canRequest: true,
        roleType: 'admin' as const
      };
    }
    
    if (userRole === 'academy_manager') {
      return {
        canApprove: false,
        canDirectSave: false,
        canEdit: true,
        canDelete: false,
        canCancel: false,
        canRequest: true,
        roleType: 'manager' as const
      };
    }
    
    return {
      canApprove: false,
      canDirectSave: false,
      canEdit: false,
      canDelete: false,
      canCancel: false,
      canRequest: false,
      roleType: 'basic' as const
    };
  };

  // 🔥 현재 사용자명 가져오기 함수 (메시지 발송용)
  const getCurrentUserName = () => {
    const userName = localStorage.getItem('userName') || localStorage.getItem('displayName');
    const userRole = localStorage.getItem('userRole');
    
    if (userRole === 'system_admin') {
      return userName || '시스템 관리자';
    } else if (userRole === 'academy_manager') {
      return userName || '학원 매니저';
    }
    return userName || '관리자';
  };

  // 기존 함수들 완전 유지
  const getUserAccessibleAcademies = () => {
    const userName = localStorage.getItem('userName') || '';
    const userRole = localStorage.getItem('userRole') || '';
    
    if (process.env.NODE_ENV === 'development' && userRole !== 'academy_manager') {
      return mainLocations;
    }
    
    if (userName === 'manager1' || userRole === 'manager1' || userRole === 'system_admin' || userRole === 'schedule_admin') {
      return mainLocations;
    } else if (userRole === 'academy_manager') {
      const assignedAcademyIds = JSON.parse(localStorage.getItem('assignedAcademyIds') || '[]');
      const accessibleAcademies = mainLocations.filter(academy => assignedAcademyIds.includes(academy.id));
      return accessibleAcademies;
    }
    
    return [];
  };

  const isManagerMode = () => {
    const userRole = localStorage.getItem('userRole') || '';
    return userRole === 'academy_manager';
  };

  const fetchData = async () => {
    try {
      setError(null);
      setIsLoading(true);
      
      await fetchMainLocations();
      await fetchAcademyLocations();
      await fetchSchedules();
      await fetchShooters();
      
    } catch (error) {
      console.error('데이터 로딩 오류:', error);
      setError('데이터를 불러오는데 실패했습니다. 네트워크 연결을 확인해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  // 🔥 날짜 생성 함수 (중첩 배열 방지)
  const generateWeekDates = () => {
    try {
      console.log('🔧 generateWeekDates 시작 - currentWeek:', currentWeek);
      
      const startOfWeek = new Date(currentWeek);
      
      if (isNaN(startOfWeek.getTime())) {
        console.error('❌ 유효하지 않은 currentWeek:', currentWeek);
        return [];
      }
      
      const dayOfWeek = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      startOfWeek.setDate(diff);
      
      const dates = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        
        const dateObj = {
          id: dateStr,
          date: dateStr,
          day: date.getDate()
        };
        
        dates.push(dateObj);
      }
      
      console.log('✅ 최종 생성된 주간 날짜:', dates);
      console.log('✅ 배열 길이:', dates.length);
      console.log('✅ 첫 번째:', dates[0]);
      console.log('✅ 마지막:', dates[dates.length - 1]);
      
      return dates;
      
    } catch (error) {
      console.error('❌ generateWeekDates 오류:', error);
      return [];
    }
  };

  // 🔥 fetchSchedules 함수 - 중첩 배열 문제 해결 + async 추가 (유효성 보강)
  const fetchSchedules = async () => {
    try {
      let weekDates = generateWeekDates();

      // 기본 유효성
      if (!Array.isArray(weekDates) || weekDates.length === 0) {
        console.error('❌ weekDates 유효성 검증 실패:', weekDates);
        setSchedules([]);
        return;
      }

      // ⚠️ 혹시라도 중첩 배열로 올 경우 1차원으로 정규화
      if (Array.isArray(weekDates[0])) {
        console.log('🔧 중첩 배열 감지 → 1차원으로 정규화');
        weekDates = weekDates[0] as any[];
      }

      if (weekDates.length < 7) {
        console.error('❌ 최종 길이 부족:', weekDates.length);
        setSchedules([]);
        return;
      }

      // ✅ 정확한 첫/마지막 날짜 객체
      const firstDateObj = weekDates[0];
      const lastDateObj = weekDates[weekDates.length - 1];

      // ✅ 객체 유효성 검증
      if (!firstDateObj?.date || !lastDateObj?.date) {
        console.error('❌ 날짜 객체 유효성 검증 실패:', { firstDateObj, lastDateObj });
        setSchedules([]);
        return;
      }

      const startDate = firstDateObj.date;
      const endDate = lastDateObj.date;

      console.log('✅ 유효한 날짜 범위:', { startDate, endDate });

      const accessibleAcademies = getUserAccessibleAcademies();
      const accessibleAcademyIds = accessibleAcademies.map(academy => Number(academy.id));
      
      const accessibleLocationIds = academyLocations
        .filter(location => accessibleAcademyIds.includes(Number(location.main_location_id)))
        .map(location => location.id);

      if (accessibleLocationIds.length === 0) {
        console.log('⚠️ 접근 가능한 강의실 없음');
        setSchedules([]);
        return;
      }

      // ✅ 안전한 쿼리 실행
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
          'pending', 
          'approval_requested', 
          'approved', 
          'confirmed', 
          'modification_requested',
          'modification_approved',
          'cancellation_requested', 
          'deletion_requested',
          'cancelled'
        ])
        .in('sub_location_id', accessibleLocationIds)
        .gte('shoot_date', startDate)
        .lte('shoot_date', endDate)
        .order('shoot_date')
        .order('start_time');

      if (error) {
        console.error('🔥 스케줄 조회 오류:', error);
        throw error;
      }
      
      console.log('🔧 조회된 전체 스케줄:', data?.length, '개');
      console.log('🔧 취소된 스케줄:', data?.filter(s => s.approval_status === 'cancelled').length, '개');
      
      // 🔥 취소된 스케줄도 포함하여 필터링 (강의실 정보 필수 확인)
      const validSchedules = (data || []).filter(schedule => 
        schedule && 
        schedule.start_time && 
        schedule.end_time && 
        schedule.professor_name &&
        schedule.sub_locations  // 강의실 정보 필수
      );

      console.log('✅ 유효한 스케줄 개수 (취소 포함):', validSchedules.length);

      // ✅ 사용자 정보 매핑 (async 함수 내부에서 안전)
      if (validSchedules.length > 0) {
        const userIds = validSchedules
          .map(s => s.requested_by)
          .filter(id => id)
          .filter((id, index, self) => self.indexOf(id) === index);

        if (userIds.length > 0) {
          const { data: users } = await supabase
            .from('user_profiles')
            .select('id, name, email')
            .in('id', userIds);

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

      console.log('🔧 최종 스케줄 설정:', validSchedules.map(s => ({ 
        id: s.id, 
        status: s.approval_status, 
        isActive: s.is_active,
        professor: s.professor_name 
      })));

      setSchedules(validSchedules);
    } catch (error) {
      console.error('학원 스케줄 조회 오류:', error);
      throw error;
    }
  };

  // 기존 fetch 함수들 완전 유지
  const fetchAcademyLocations = async () => {
    try {
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
      
      const userRole = localStorage.getItem('userRole') || '';
      if (userRole === 'academy_manager') {
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
    } catch (error) {
      console.error('학원 위치 조회 오류:', error);
      throw error;
    }
  };

  const fetchMainLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('main_locations')
        .select('*')
        .eq('is_active', true)
        .eq('location_type', 'academy')
        .order('name');

      if (error) throw error;
      setMainLocations(data || []);
    } catch (error) {
      console.error('메인 위치 조회 오류:', error);
      throw error;
    }
  };

  const fetchShooters = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .in('shooter_type', ['photographer', 'videographer', 'both'])
        .order('name');
      
      if (error) throw error;
      setShooters(data || []);
    } catch (error) {
      console.error('촬영자 조회 오류:', error);
      setShooters([]);
    }
  };

  // 🔥 메시지 발송 함수 (최종 완료 액션에서만)
  // 🔥 메시지 발송 함수 (최종 완료 액션에서만) - 줄바꿈 수정
const sendScheduleNotification = async (
  action: string,
  scheduleData: any,
  originalSchedule?: any
) => {
  try {
    const adminName = getCurrentUserName();
    
    const locationName = academyLocations.find(loc => 
      loc.id === parseInt(scheduleData.sub_location_id)
    )?.displayName || '알 수 없는 강의실';

    let messageText = '';
    let messageType = '';

    // 🔥 ID 확인 및 URL 생성
    const scheduleId = scheduleData.id || originalSchedule?.id;
    console.log('🔍 스케줄 ID 확인:', { 
      'scheduleData.id': scheduleData.id, 
      'originalSchedule.id': originalSchedule?.id,
      'final': scheduleId 
    });
    
    const scheduleUrl = scheduleId 
      ? `https://yourapp.com/academy-schedules?schedule_id=${scheduleId}&modal=true`
      : `https://yourapp.com/academy-schedules`;

    switch (action) {
      // 🔥 승인 요청
      case 'request':
        messageType = 'academy_schedule_request';
        messageText = [
          '[학원 스케줄 승인 요청]',
          '',
          `교수명: ${scheduleData.professor_name}`,
          `촬영일: ${scheduleData.shoot_date}`,
          `시간: ${scheduleData.start_time} - ${scheduleData.end_time}`,
          `강의실: ${locationName}`,
          `강의명: ${scheduleData.course_name || '미지정'}`,
          `촬영형식: ${scheduleData.shooting_type}`,
          `요청자: ${adminName}`,
          '',
          '새로운 학원 스케줄 승인 요청이 있습니다.',
          '',
          `📋 스케줄 바로가기: ${scheduleUrl}`
        ].join('\\n');
        break;

      // 🔥 승인 완료
      case 'approve':
        if (originalSchedule?.approval_status !== 'approved') {
          messageType = 'academy_schedule_approved';
          messageText = [
            '[학원 스케줄 승인 완료]',
            '',
            `교수명: ${scheduleData.professor_name}`,
            `촬영일: ${scheduleData.shoot_date}`,
            `시간: ${scheduleData.start_time} - ${scheduleData.end_time}`,
            `강의실: ${locationName}`,
            `강의명: ${scheduleData.course_name || '미지정'}`,
            `촬영형식: ${scheduleData.shooting_type}`,
            `승인자: ${adminName}`,
            '',
            '학원 스케줄이 승인되었습니다.',
            '',
            `📋 승인된 스케줄 보기: ${scheduleUrl}`
          ].join('\\n');
        }
        break;

      // 🔥 취소 승인
      case 'cancel_approve':
        messageType = 'academy_schedule_cancelled';
        messageText = [
          '[학원 스케줄 취소 승인]',
          '',
          `교수명: ${scheduleData.professor_name}`,
          `촬영일: ${scheduleData.shoot_date}`,
          `시간: ${scheduleData.start_time} - ${scheduleData.end_time}`,
          `강의실: ${locationName}`,
          `강의명: ${scheduleData.course_name || '미지정'}`,
          `촬영형식: ${scheduleData.shooting_type}`,
          `처리자: ${adminName}`,
          '',
          '학원 스케줄이 취소 처리되었습니다.',
          '',
          `📋 취소된 스케줄 보기: ${scheduleUrl}`
        ].join('\\n');
        break;

      // 🔥 수정 승인
      case 'modify_approve':
        messageType = 'academy_schedule_modified';
        messageText = [
          '[학원 스케줄 수정 승인 완료]',
          '',
          `교수명: ${scheduleData.professor_name}`,
          `촬영일: ${scheduleData.shoot_date}`,
          `시간: ${scheduleData.start_time} - ${scheduleData.end_time}`,
          `강의실: ${locationName}`,
          `강의명: ${scheduleData.course_name || '미지정'}`,
          `촬영형식: ${scheduleData.shooting_type}`,
          `처리자: ${adminName}`,
          '',
          '학원 스케줄 수정이 승인되었습니다.',
          '',
          `📋 수정된 스케줄 보기: ${scheduleUrl}`
        ].join('\\n');
        break;

      // 🔥 삭제 승인
      case 'delete_approve':
        messageType = 'academy_schedule_deleted';
        messageText = [
          '[학원 스케줄 삭제 승인]',
          '',
          `교수명: ${scheduleData.professor_name}`,
          `촬영일: ${scheduleData.shoot_date}`,
          `시간: ${scheduleData.start_time} - ${scheduleData.end_time}`,
          `강의실: ${locationName}`,
          `강의명: ${scheduleData.course_name || '미지정'}`,
          `촬영형식: ${scheduleData.shooting_type}`,
          `처리자: ${adminName}`,
          '',
          '학원 스케줄이 삭제 처리되었습니다.',
          '',
          `📋 스케줄 목록 보기: https://yourapp.com/academy-schedules`
        ].join('\\n');
        break;

      // 🔥 수정 요청
      case 'modify_request':
        messageType = 'academy_schedule_modify_request';
        messageText = [
          '[학원 스케줄 수정 요청]',
          '',
          `교수명: ${scheduleData.professor_name}`,
          `촬영일: ${scheduleData.shoot_date}`,
          `시간: ${scheduleData.start_time} - ${scheduleData.end_time}`,
          `강의실: ${locationName}`,
          `강의명: ${scheduleData.course_name || '미지정'}`,
          `촬영형식: ${scheduleData.shooting_type}`,
          `요청자: ${adminName}`,
          '',
          '학원 스케줄 수정 권한 요청이 있습니다.',
          '',
          `📋 해당 스케줄 보기: ${scheduleUrl}`
        ].join('\\n');
        break;

      // 🔥 취소 요청
      case 'cancel_request':
        messageType = 'academy_schedule_cancel_request';
        messageText = [
          '[학원 스케줄 취소 요청]',
          '',
          `교수명: ${scheduleData.professor_name}`,
          `촬영일: ${scheduleData.shoot_date}`,
          `시간: ${scheduleData.start_time} - ${scheduleData.end_time}`,
          `강의실: ${locationName}`,
          `강의명: ${scheduleData.course_name || '미지정'}`,
          `촬영형식: ${scheduleData.shooting_type}`,
          `요청자: ${adminName}`,
          '',
          '학원 스케줄 취소 요청이 있습니다.',
          '',
          `📋 해당 스케줄 보기: ${scheduleUrl}`
        ].join('\\n');
        break;

      // 🔥 삭제 요청
      case 'delete_request':
        messageType = 'academy_schedule_delete_request';
        messageText = [
          '[학원 스케줄 삭제 요청]',
          '',
          `교수명: ${scheduleData.professor_name}`,
          `촬영일: ${scheduleData.shoot_date}`,
          `시간: ${scheduleData.start_time} - ${scheduleData.end_time}`,
          `강의실: ${locationName}`,
          `강의명: ${scheduleData.course_name || '미지정'}`,
          `촬영형식: ${scheduleData.shooting_type}`,
          `요청자: ${adminName}`,
          '',
          '학원 스케줄 삭제 요청이 있습니다.',
          '',
          `📋 해당 스케줄 보기: ${scheduleUrl}`
        ].join('\\n');
        break;

      // 🔥 임시저장
      case 'temp':
        messageType = 'academy_schedule_temp_saved';
        messageText = [
          '[학원 스케줄 임시저장]',
          '',
          `교수명: ${scheduleData.professor_name}`,
          `촬영일: ${scheduleData.shoot_date}`,
          `시간: ${scheduleData.start_time} - ${scheduleData.end_time}`,
          `강의실: ${locationName}`,
          `강의명: ${scheduleData.course_name || '미지정'}`,
          `촬영형식: ${scheduleData.shooting_type}`,
          `저장자: ${adminName}`,
          '',
          '학원 스케줄이 임시저장되었습니다.',
          '',
          `📋 임시저장된 스케줄 보기: ${scheduleUrl}`
        ].join('\\n');
        break;

      // 🔥 수정권한 승인
      case 'approve_modification':
        messageType = 'academy_schedule_modify_approved';
        messageText = [
          '[학원 스케줄 수정 권한 승인]',
          '',
          `교수명: ${scheduleData.professor_name}`,
          `촬영일: ${scheduleData.shoot_date}`,
          `시간: ${scheduleData.start_time} - ${scheduleData.end_time}`,
          `강의실: ${locationName}`,
          `강의명: ${scheduleData.course_name || '미지정'}`,
          `촬영형식: ${scheduleData.shooting_type}`,
          `승인자: ${adminName}`,
          '',
          '학원 스케줄 수정 권한이 승인되었습니다.',
          '매니저가 이제 수정할 수 있습니다.',
          '',
          `📋 수정 가능한 스케줄 보기: ${scheduleUrl}`
        ].join('\\n');
        break;

      // 🔥 요청 철회
      case 'cancel_cancel':
        messageType = 'academy_schedule_request_withdrawn';
        messageText = [
          '[학원 스케줄 요청 철회]',
          '',
          `교수명: ${scheduleData.professor_name}`,
          `촬영일: ${scheduleData.shoot_date}`,
          `시간: ${scheduleData.start_time} - ${scheduleData.end_time}`,
          `강의실: ${locationName}`,
          `강의명: ${scheduleData.course_name || '미지정'}`,
          `촬영형식: ${scheduleData.shooting_type}`,
          `철회자: ${adminName}`,
          '',
          '학원 스케줄 요청이 철회되었습니다.',
          '',
          `📋 철회된 스케줄 보기: ${scheduleUrl}`
        ].join('\\n');
        break;

      // 🔥 삭제요청 철회
      case 'cancel_delete':
        messageType = 'academy_schedule_delete_withdrawn';
        messageText = [
          '[학원 스케줄 삭제요청 철회]',
          '',
          `교수명: ${scheduleData.professor_name}`,
          `촬영일: ${scheduleData.shoot_date}`,
          `시간: ${scheduleData.start_time} - ${scheduleData.end_time}`,
          `강의실: ${locationName}`,
          `강의명: ${scheduleData.course_name || '미지정'}`,
          `촬영형식: ${scheduleData.shooting_type}`,
          `철회자: ${adminName}`,
          '',
          '학원 스케줄 삭제요청이 철회되었습니다.',
          '',
          `📋 철회된 스케줄 보기: ${scheduleUrl}`
        ].join('\\n');
        break;

      default:
        // 메시지 발송이 필요하지 않은 액션들
        return;
    }

    if (messageText && messageType) {
      // 📤 디버깅용 로그
      console.log('📤 메시지 발송 시도:', {
        messageType,
        messageLength: messageText.length,
        action,
        scheduleId
      });

      const response = await fetch('/api/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: messageType,
          message: messageText
        })
      });

      // 📥 응답 상세 로그
      console.log('📥 응답 상태:', response.status);
      
      if (response.ok) {
        console.log(`✅ 학원 스케줄 ${action} 알림 발송 완료`);
      } else {
        const errorText = await response.text();
        console.error(`❌ 학원 스케줄 ${action} 알림 발송 실패:`, {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
      }
    }

  } catch (messageError) {
    console.error('❌ 학원 스케줄 메시지 발송 오류:', {
      error: messageError,
      action,
      scheduleData: scheduleData?.id
    });
  }
};


  // 🔥 안전한 사용자 필드 처리 함수 (BigInt 제거)
  const applySafeUserFields = (action: string, userId: number, reason?: string) => {
    const fields: any = {};
    
    try {
      // 🔥 1단계: 모든 변경에 필수 - updated_by (일반 number 타입)
      fields.updated_by = userId;  // BigInt 제거
      
      // 🔥 2단계: 액션별 안전한 필드 설정
      switch (action) {
        case 'temp':
          // 임시저장 - 요청자 정보
          fields.requested_by = userId;
          fields.requested_at = new Date().toISOString();
          break;
          
        case 'request':
          // 승인요청 - 요청자 + 승인요청시간
          fields.requested_by = userId;
          fields.approval_requested_at = new Date().toISOString();
          fields.requested_at = new Date().toISOString();
          break;
          
        case 'modify_request':
          // 수정요청 - 별도 필드 사용 (충돌 없음)
          fields.modification_requested_by = userId;
          fields.modification_requested_at = new Date().toISOString();
          if (reason) fields.modification_reason = reason;
          break;
          
        case 'approve':
        case 'modify_approve':
        case 'approve_modification':
        case 'cancel_approve':
        case 'delete_approve':
          // 승인 관련 - 승인자 정보
          fields.approved_by = userId;
          fields.approved_at = new Date().toISOString();
          fields.processed_by = userId;
          fields.processed_at = new Date().toISOString();
          break;
          
        // 🔥 기타 액션들은 updated_by만 설정 (안전)
      }
      
      console.log('✅ 안전한 사용자 필드 설정 완료:', fields);
      return fields;
      
    } catch (error) {
      console.error('❌ 사용자 필드 설정 오류:', error);
      // 🔥 오류 발생 시 최소한의 안전한 필드만 반환
      return { updated_by: userId };
    }
  };

  // 🔥 히스토리 기록 함수 개선 - 모든 액션에서 기록
// 🔥 히스토리 기록 함수 개선 - 변경 내용 상세 기록
// 🔥 히스토리 기록 함수 개선 - 변경 내용 정확한 기록
const recordScheduleHistory = async (
  scheduleId: number, 
  action: string,
  description: string, 
  userId: number,
  newData: any, 
  oldData?: any
) => {
  try {
    console.log('📝 히스토리 기록 시작:', {
      scheduleId,
      action,
      description,
      userId,
      hasNewData: !!newData,
      hasOldData: !!oldData
    });

    // 🔥 실제 변경된 필드만 추출 (정확한 비교)
    const changes: { [key: string]: { old: any, new: any } } = {};
    
    if (oldData && newData) {
      const fieldsToTrack = [
        'shoot_date', 'start_time', 'end_time', 'professor_name', 
        'course_name', 'course_code', 'shooting_type', 'notes', 'sub_location_id'
        // approval_status는 시스템 변경이므로 제외
      ];
      
      // 🔥 정규화 함수
      const normalizeForComparison = (value: any, field: string) => {
        if (value === null || value === undefined) return '';
        
        if (field === 'start_time' || field === 'end_time') {
          return String(value).substring(0, 5); // HH:MM 형식
        }
        
        return String(value).trim();
      };
      
      fieldsToTrack.forEach(field => {
        const oldNormalized = normalizeForComparison(oldData[field], field);
        const newNormalized = normalizeForComparison(newData[field], field);
        
        if (oldNormalized !== newNormalized) {
          changes[field] = {
            old: oldData[field],
            new: newData[field]
          };
        }
      });

      // 🔥 실제 변경사항이 있는 경우만 설명 보완
      if (Object.keys(changes).length > 0) {
        const changeDescriptions = [];
        
        if (changes.shoot_date) {
          const oldDate = new Date(changes.shoot_date.old).toLocaleDateString('ko-KR');
          const newDate = new Date(changes.shoot_date.new).toLocaleDateString('ko-KR');
          changeDescriptions.push(`촬영일 변경(${oldDate} → ${newDate})`);
        }
        
        if (changes.start_time || changes.end_time) {
          const oldTime = `${(changes.start_time?.old || oldData.start_time).substring(0, 5)} - ${(changes.end_time?.old || oldData.end_time).substring(0, 5)}`;
          const newTime = `${(changes.start_time?.new || newData.start_time).substring(0, 5)} - ${(changes.end_time?.new || newData.end_time).substring(0, 5)}`;
          changeDescriptions.push(`시간 변경(${oldTime} → ${newTime})`);
        }
        
        if (changes.sub_location_id) {
          changeDescriptions.push(`강의실 변경(${changes.sub_location_id.old} → ${changes.sub_location_id.new})`);
        }
        
        if (changes.professor_name) {
          changeDescriptions.push(`교수명 변경(${changes.professor_name.old} → ${changes.professor_name.new})`);
        }
        
        if (changes.shooting_type) {
          changeDescriptions.push(`촬영형식 변경(${changes.shooting_type.old} → ${changes.shooting_type.new})`);
        }
        
        if (changes.course_name) {
          changeDescriptions.push(`강의명 변경(${changes.course_name.old} → ${changes.course_name.new})`);
        }
        
        if (changes.course_code) {
          changeDescriptions.push(`강의코드 변경(${changes.course_code.old} → ${changes.course_code.new})`);
        }
        
        if (changes.notes) {
          changeDescriptions.push(`비고 변경`);
        }
        
        if (changeDescriptions.length > 0) {
          description = `${description} - ${changeDescriptions.join(', ')}`;
        }
      }
    }

    const historyRecord = {
      schedule_id: scheduleId,
      change_type: action,
      old_value: oldData ? JSON.stringify(oldData) : null,
      new_value: JSON.stringify(newData),
      description: description,
      changed_by: userId,
      changed_at: new Date().toISOString(),
      change_details: Object.keys(changes).length > 0 ? JSON.stringify(changes) : null
    };

    const { error } = await supabase
      .from('schedule_history')
      .insert([historyRecord]);

    if (error) {
      console.error('❌ 히스토리 기록 오류:', error);
      throw error;
    }

    console.log('✅ 히스토리 기록 완료:', {
      scheduleId,
      action,
      description,
      realChangesCount: Object.keys(changes).length
    });

  } catch (error) {
    console.error('❌ 히스토리 기록 예외:', error);
  }
};



  // 🔥 handleSave 함수 - 메시지는 최종완료만, 히스토리는 모든 액션
  const handleSave = async (data: any, action: string) => {
  console.log('🔧 handleSave 호출:', { action, data });

  try {
    setIsLoading(true);

    const { currentUserId, reason, ...scheduleData } = data;
    console.log('🔧 추출된 데이터:', { currentUserId, reason, scheduleData });

    const permissions = getUserPermissions();
    const isAdmin = permissions.roleType === 'admin';
    const isManager = permissions.roleType === 'manager';

    const currentSchedule = modalData?.scheduleData;
    const isEditMode = modalData?.mode === 'edit' || !!currentSchedule?.id;

    let approvalStatus = 'pending';
    let description = '';
    let isActive = true;

    // 액션별 상태 설정
    if (isAdmin) {
      switch (action) {
        case 'temp':
          approvalStatus = 'pending';
          description = '관리자 임시 저장';
          break;
        case 'request':
          approvalStatus = 'approval_requested';
          description = '관리자 승인 요청';
          break;
        case 'approve':
          approvalStatus = 'approved';
          // 🔥 간단한 승인/수정승인 구분
          description = (currentSchedule?.approval_status === 'modification_approved') 
            ? '관리자 수정 승인' 
            : '관리자 승인';
          break;
        case 'modify_approve':
          approvalStatus = 'approved';
          description = '관리자 수정 후 승인';
          break;
        case 'approve_modification':
          approvalStatus = 'modification_approved';
          description = '관리자 수정요청 승인 - 수정 권한 부여';
          break;
        case 'cancel_approve':
          approvalStatus = 'cancelled';
          description = '관리자 취소 승인';
          isActive = false;
          break;
        case 'delete_approve':
          approvalStatus = 'deleted';
          description = '관리자 삭제 승인';
          isActive = false;
          break;
        case 'cancel':
          approvalStatus = 'cancelled';
          description = '관리자 직접 취소';
          isActive = false;
          break;
        case 'delete':
          approvalStatus = 'deleted';
          description = '관리자 직접 삭제';
          isActive = false;
          break;
        case 'cancel_cancel':
          approvalStatus = currentSchedule?.approval_status === 'cancellation_requested' ? 'approved' : 'pending';
          description = '관리자 취소요청 거부';
          break;
        case 'cancel_delete':
          approvalStatus = currentSchedule?.approval_status === 'deletion_requested' ? 'approved' : 'pending';
          description = '관리자 삭제요청 거부';
          break;
        default:
          approvalStatus = 'pending';
          description = '관리자 기본 저장';
      }
    } else if (isManager) {
      switch (action) {
        case 'temp':
          approvalStatus = 'pending';
          description = '매니저 임시 저장';
          break;
        case 'request':
          approvalStatus = 'approval_requested';
          // 🔥 간단한 승인요청/수정완료 후 승인요청 구분
          description = (currentSchedule?.approval_status === 'modification_approved')
            ? '매니저 수정완료 후 승인 요청'
            : '매니저 승인 요청';
          break;
        case 'approve':
          approvalStatus = 'approval_requested';
          description = '매니저 승인 요청';
          break;
        case 'modify_request':
          approvalStatus = 'modification_requested';
          description = '매니저 수정 권한 요청';
          break;
        case 'cancel_request':
          approvalStatus = 'cancellation_requested';
          description = '매니저 취소 요청';
          break;
        case 'delete_request':
          approvalStatus = 'deletion_requested';
          description = '매니저 삭제 요청';
          break;
        case 'cancel_cancel':
          if (currentSchedule?.approval_status === 'modification_requested') {
            approvalStatus = 'approved';
            description = '매니저 수정요청 철회';
          } else if (currentSchedule?.approval_status === 'cancellation_requested') {
            approvalStatus = 'approved';
            description = '매니저 취소요청 철회';
          } else {
            approvalStatus = 'approved';
            description = '매니저 요청 철회';
          }
          break;
        case 'cancel_delete':
          approvalStatus = 'approved';
          description = '매니저 삭제요청 철회';
          break;
        case 'cancel':
          approvalStatus = 'cancelled';
          description = '매니저 취소';
          isActive = false;
          break;
        case 'delete':
          approvalStatus = 'deleted';
          description = '매니저 삭제';
          isActive = false;
          break;
        default:
          approvalStatus = 'pending';
          description = '매니저 기본 저장';
      }
    }

    console.log('🔧 결정된 상태:', { approvalStatus, description, isActive, action, currentStatus: currentSchedule?.approval_status });

    const updateData = {
      ...scheduleData,
      approval_status: approvalStatus,
      is_active: isActive,
      updated_at: new Date().toISOString()
    };

    if (currentUserId) {
      const userFields = applySafeUserFields(action, currentUserId, reason);
      Object.assign(updateData, userFields);
    }

    if (isEditMode && currentSchedule?.id) {
      // 기존 스케줄 업데이트
      const { error: updateError } = await supabase
        .from('schedules')
        .update(updateData)
        .eq('id', currentSchedule.id);

      if (updateError) {
        console.error('🔥 업데이트 오류:', updateError);
        throw updateError;
      }

      // 히스토리 기록 (항상)
      if (currentUserId) {
        await recordScheduleHistory(
          currentSchedule.id, 
          action, 
          description, 
          currentUserId, 
          updateData,
          currentSchedule
        );
      }

      // 메시지 발송: 관리자 직권 수정/삭제 이외 모든 액션에서 발송
      const shouldSendNotification = !['cancel', 'delete'].includes(action);

      if (shouldSendNotification) {
        await sendScheduleNotification(action, updateData, currentSchedule);
      }

    } else {
      // 신규 스케줄 생성
      const newScheduleData: any = {
        ...updateData,
        schedule_type: 'academy'
      };

      if (currentUserId) {
        newScheduleData.requested_by = currentUserId;
        newScheduleData.requested_at = new Date().toISOString();
        newScheduleData.updated_by = currentUserId;
      }

      const { data: newSchedule, error: insertError } = await supabase
        .from('schedules')
        .insert([newScheduleData])
        .select()
        .single();

      if (insertError) {
        console.error('🔥 삽입 오류:', insertError);
        throw insertError;
      }

      // 히스토리 기록 (항상)
      if (currentUserId && newSchedule) {
        await recordScheduleHistory(
          newSchedule.id, 
          action,
          description, 
          currentUserId, 
          newScheduleData
        );
      }

      // 메시지 발송: 신규 생성은 언제나 발송
      await sendScheduleNotification(action, newScheduleData, null);
    }

    const successMessages: { [key: string]: string } = {
      temp: '임시 저장되었습니다.',
      request: modalData?.scheduleData?.approval_status === 'modification_approved'
        ? '수정 완료 후 승인요청이 전송되었습니다.'
        : '승인 요청이 전송되었습니다.',
      approve: '승인되었습니다.',
      modify_request: '수정 권한 요청이 전송되었습니다.',
      cancel_request: '취소 요청이 전송되었습니다.',
      delete_request: '삭제 요청이 전송되었습니다.',
      modify_approve: '수정 후 승인되었습니다.',
      approve_modification: '수정 권한이 부여되었습니다. 이제 수정하실 수 있습니다.',
      cancel_approve: '취소 승인되었습니다.',
      delete_approve: '삭제 승인되었습니다.',
      cancel: '취소되었습니다.',
      delete: '삭제되었습니다.',
      cancel_cancel: '요청이 철회되었습니다.',
      cancel_delete: '삭제요청이 철회되었습니다.'
    };

    await fetchSchedules();

    return {
      success: true,
      message: successMessages[action] || '저장되었습니다.'
    };

  } catch (error) {
    console.error('학원 스케줄 저장 오류:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '저장에 실패했습니다.'
    };
  } finally {
    setIsLoading(false);
  }
};


  // 🔥 상태별 테두리 색상 결정 함수 (modification_approved 추가)
  const getCardBorderColor = (approvalStatus: string, isActive: boolean, locationColor: any) => {
    if (!isActive) {
      return '#dc2626'; // 비활성화: 빨간색 (취소된 스케줄)
    }

    switch (approvalStatus) {
      case 'pending':
        return '#6b7280'; // 임시저장: 회색
      case 'approval_requested':
        return '#2563eb'; // 승인요청: 파란색
      case 'approved':
      case 'confirmed':
        return '#059669'; // 승인완료: 초록색
      case 'modification_requested':
        return '#8b5cf6'; // 수정요청: 보라색
      case 'modification_approved':
        return '#f59e0b'; // 수정중: 주황색
      case 'cancellation_requested':
        return '#f59e0b'; // 취소요청: 주황색
      case 'deletion_requested':
        return '#dc2626'; // 삭제요청: 빨간색
      default:
        return locationColor?.border || '#6b7280'; // 기본: 위치 색상
    }
  };

  const getLocationColor = (locationId: number) => {
    const location = academyLocations.find(loc => loc.id === locationId);
    const academyId = location?.main_location_id;
    return (academyColors as any)[academyId] || academyColors.default;
  };

  const getScheduleForCell = (date: string, location: any) => {
    try {
      const cellSchedules = schedules.filter(s => {
        const matchesDate = s.shoot_date === date;
        const matchesLocation = s.sub_location_id === location.id;
        return matchesDate && matchesLocation;
      });
      
      console.log('🔧 셀 스케줄 조회:', {
        date,
        locationId: location.id,
        totalSchedules: schedules.length,
        cellSchedules: cellSchedules.length,
        cancelledCount: cellSchedules.filter(s => s.approval_status === 'cancelled').length
      });
      
      return cellSchedules;
    } catch (error) {
      console.error('셀 스케줄 조회 오류:', error);
      return [];
    }
  };

  // 🔥 handleCellClick 함수 - 빈 셀 클릭 시만 새 등록
  const handleCellClick = (date: string, location: any) => {
    console.log('🔧 handleCellClick 호출됨 (빈 셀 클릭):', {
      date,
      locationId: location.id,
      locationName: location.name
    });

    const fallbackLocations = academyLocations.length > 0
      ? academyLocations
      : [];

    const modalDataObj = {
      mode: 'create',
      date,
      locationId: location.id,
      scheduleData: null,
      mainLocations,
      academyLocations: fallbackLocations,
      shooters
    };
    
    console.log('🔧 새 등록 모달 데이터:', modalDataObj);
    setModalData(modalDataObj);
    setModalOpen(true);
  };

  // 🔥 handleScheduleCardClick 함수 - 취소된 스케줄 포함 처리
  const handleScheduleCardClick = (schedule: any) => {
    console.log('🔧 handleScheduleCardClick 호출됨:', {
      scheduleId: schedule?.id,
      professorName: schedule?.professor_name,
      approvalStatus: schedule?.approval_status,
      isActive: schedule?.is_active,
      isCancelled: schedule?.approval_status === 'cancelled' && schedule?.is_active === false
    });

    try {
      if (!schedule || !schedule.id) {
        console.log('❌ 스케줄 데이터 없음 - 등록 모달 열기');
        return;
      }

      const modalDataObj = {
        mode: 'edit' as const,
        scheduleData: schedule,
        date: schedule.shoot_date,
        locationId: schedule.sub_location_id,
        mainLocations,
        academyLocations,
        shooters
      };
      
      console.log('🔧 모달 데이터 설정 (취소 포함):', {
        mode: modalDataObj.mode,
        scheduleId: schedule.id,
        approvalStatus: schedule.approval_status,
        isActive: schedule.is_active
      });
      
      setModalData(modalDataObj);
      setModalOpen(true);
      console.log('✅ 기존 정보 확인 모달 열기 완료 (취소 포함)');
    } catch (error) {
      console.error('❌ 모달 열기 오류:', error);
    }
  };

  // 🔥 기존 지난 주 복사 기능들 모두 유지 + 날짜 문자열화 버그 수정
  const handleCopyPreviousWeek = async () => {
    if (isCopying) return;
    
    try {
      setIsCopying(true);
      
      const currentWeekDates = generateWeekDates();
      if (!currentWeekDates.length) throw new Error('현재 주 날짜 생성 실패');

      const lastWeekStart = new Date(currentWeekDates[0].date);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);
      
      const lastWeekEnd = new Date(currentWeekDates[6].date);
      lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);
      
      const lastWeekStartStr = lastWeekStart.toISOString().split('T')[0];
      const lastWeekEndStr = lastWeekEnd.toISOString().split('T')[0]; // ← ✅ 로 수정
      
      const accessibleAcademies = getUserAccessibleAcademies();
      const accessibleAcademyIds = accessibleAcademies.map(academy => academy.id);
      
      const accessibleLocationIds = academyLocations
        .filter((location: any) => accessibleAcademyIds.includes(location.main_location_id))
        .map((location: any) => location.id);
      
      if (accessibleLocationIds.length === 0) {
        alert('접근 가능한 학원이 없습니다.');
        return;
      }
      
      const { data: schedules, error: fetchError } = await supabase
        .from('schedules')
        .select(`*, sub_locations(*, main_locations(*))`)
        .eq('schedule_type', 'academy')
        .eq('is_active', true)
        .in('approval_status', ['approved', 'confirmed'])
        .in('sub_location_id', accessibleLocationIds)
        .gte('shoot_date', lastWeekStartStr)
        .lte('shoot_date', lastWeekEndStr)
        .order('shoot_date')
        .order('start_time');
      
      if (fetchError) throw new Error('지난 주 스케줄을 불러올 수 없습니다.');
      
      if (!schedules || schedules.length === 0) {
        alert('복사할 지난 주 스케줄이 없습니다.');
        return;
      }
      
      setLastWeekSchedules(schedules as any[]);
      setSelectedCopySchedules([]);
      setCopyModalOpen(true);
      
    } catch (error) {
      console.error('지난 주 조회 오류:', error);
      alert('조회 실패');
    } finally {
      setIsCopying(false);
    }
  };

  const executeCopySchedules = async () => {
    if (selectedCopySchedules.length === 0) {
      alert('복사할 스케줄을 선택해주세요.');
      return;
    }
    
    try {
      setIsCopying(true);
      
      const schedulesToCopy = lastWeekSchedules.filter(schedule => 
        selectedCopySchedules.includes(schedule.id)
      );
      
      const newSchedules: any[] = [];
      
      for (const schedule of schedulesToCopy) {
        const originalDate = new Date(schedule.shoot_date);
        const newDate = new Date(originalDate);
        newDate.setDate(originalDate.getDate() + 7);
        const newDateStr = newDate.toISOString().split('T')[0];
        
        const newSchedule = {
          shoot_date: newDateStr,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          professor_name: schedule.professor_name,
          course_name: schedule.course_name,
          course_code: schedule.course_code,
          shooting_type: schedule.shooting_type,
          notes: schedule.notes ? `${schedule.notes} (지난주 복사)` : '지난주 복사',
          sub_location_id: schedule.sub_location_id,
          schedule_type: 'academy',
          approval_status: 'pending',
          team_id: schedule.team_id || 1,
          is_active: true,
          requested_by: parseInt(localStorage.getItem('userId') || '16'),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        newSchedules.push(newSchedule);
      }
      
      const { error: insertError } = await supabase
        .from('schedules')
        .insert(newSchedules);
      
      if (insertError) throw new Error('스케줄 복사 중 오류가 발생했습니다.');
      
      alert(`✅ ${newSchedules.length}개의 스케줄이 성공적으로 복사되었습니다!`);
      setCopyModalOpen(false);
      await fetchSchedules();
      
    } catch (error) {
      console.error('복사 실행 오류:', error);
      alert('복사 실패');
    } finally {
      setIsCopying(false);
    }
  };

  const toggleAcademySchedules = (academyId: number, schedules: any[]) => {
    const academyScheduleIds = schedules.map(s => s.id);
    const allSelected = academyScheduleIds.every(id => selectedCopySchedules.includes(id));
    
    if (allSelected) {
      setSelectedCopySchedules(prev => prev.filter(id => !academyScheduleIds.includes(id)));
    } else {
      setSelectedCopySchedules(prev => [...new Set([...prev, ...academyScheduleIds])]);
    }
  };

  const toggleScheduleSelection = (scheduleId: number) => {
    setSelectedCopySchedules(prev => 
      prev.includes(scheduleId) 
        ? prev.filter(id => id !== scheduleId)
        : [...prev, scheduleId]
    );
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalData(null);
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
      // ✅ tracking_status → approval_status 로 통일
      filtered = filtered.filter((s: any) => s.approval_status === filters.status);
    }
    return filtered;
  };

  // renderAcademyScheduleCard 함수 수정
  const renderAcademyScheduleCard = (schedule: any) => {
    const isSelected = selectedSchedules.includes(schedule.id);
    const isCancelled = schedule.approval_status === 'cancelled' && schedule.is_active === false;
    
    const locationColor = getLocationColor(schedule.sub_location_id);
    
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
            scheduleType="academy"
            locationColor={locationColor}
            onClick={() => {}}
            onContextMenu={() => {}}
            showCheckbox={!isCancelled}
            isSelected={isSelected}
            onCheckboxChange={(checked) => {
              if (checked) {
                const newSelected = [...selectedSchedules, schedule.id];
                setSelectedSchedules(newSelected);
              } else {
                const newSelected = selectedSchedules.filter(id => id !== schedule.id);
                setSelectedSchedules(newSelected);
              }
            }}
            style={{
              pointerEvents: 'none'
            }}
          />
        </div>
      </ScheduleCardErrorBoundary>
    );
  };

  // 선택, 일괄 승인
  const handleBulkApproval = async (type: 'selected' | 'all') => {
    try {
      const permissions = getUserPermissions();
      if (!permissions.canApprove) {
        alert('승인 권한이 없습니다.');
        return;
      }

      const pendingSchedules = schedules.filter((s: any) => 
        s.approval_status === 'approval_requested' && s.is_active === true
      );
      
      const selectedPendingSchedules = schedules.filter((s: any) => 
        selectedSchedules.includes(s.id) && 
        s.approval_status === 'approval_requested' && 
        s.is_active === true
      );

      const targetSchedules = type === 'selected' ? selectedPendingSchedules : pendingSchedules;
      
      if (targetSchedules.length === 0) {
        alert(type === 'selected' ? '승인할 선택된 스케줄이 없습니다.' : '승인할 스케줄이 없습니다.');
        return;
      }

      const confirmMessage = `${targetSchedules.length}개의 스케줄을 승인하시겠습니까?`;
      if (!confirm(confirmMessage)) return;

      setIsLoading(true);
      const currentUserId = parseInt(localStorage.getItem('userId') || '16');
      
      // 병렬 승인 처리
      const updatePromises = targetSchedules.map((schedule: any) => 
        supabase
          .from('schedules')
          .update({
            approval_status: 'approved',
            approved_by: currentUserId,
            approved_at: new Date().toISOString(),
            updated_by: currentUserId,
            updated_at: new Date().toISOString()
          })
          .eq('id', schedule.id)
      );

      const results = await Promise.all(updatePromises);
      const failedCount = results.filter((r: any) => r.error).length;
      
      if (failedCount > 0) {
        alert(`${targetSchedules.length - failedCount}개 승인 완료, ${failedCount}개 실패`);
      } else {
        alert(`✅ ${targetSchedules.length}개 스케줄이 승인되었습니다.`);
      }

      // 선택 해제 및 새로고침
      if (type === 'selected') {
        setSelectedSchedules([]);
      }

      await fetchSchedules();
      
    } catch (error) {
      console.error('일괄 승인 오류:', error);
      alert('승인 처리 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 🔥 기존 복사 선택 모달 UI 완전 유지
  const CopyScheduleModal = () => {
    if (!copyModalOpen) return null;
    
    const schedulesByAcademy = lastWeekSchedules.reduce((acc: any, schedule: any) => {
      const academyId = schedule.sub_locations?.main_location_id;
      const academyName = schedule.sub_locations?.main_locations?.name || '알 수 없는 학원';
      
      if (!acc[academyId]) {
        acc[academyId] = {
          academyName,
          schedules: []
        };
      }
      
      acc[academyId].schedules.push(schedule);
      return acc;
    }, {});
    
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: 12,
          padding: 24,
          maxWidth: '80vw',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
            paddingBottom: 16,
            borderBottom: '2px solid #e5e7eb'
          }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
              지난 주 스케줄 복사 ({lastWeekSchedules.length}개)
            </h2>
            <button
              onClick={() => setCopyModalOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 24,
                cursor: 'pointer',
                color: '#6b7280'
              }}
            >
              ×
            </button>
          </div>
          
          <div style={{ marginBottom: 20 }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16
            }}>
              <span style={{ fontSize: 14, color: '#6b7280' }}>
                선택된 스케줄: {selectedCopySchedules.length}개
              </span>
              <button
                onClick={() => setSelectedCopySchedules(
                  selectedCopySchedules.length === lastWeekSchedules.length 
                    ? [] 
                    : lastWeekSchedules.map(s => s.id)
                )}
                style={{
                  padding: '6px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  background: 'white',
                  cursor: 'pointer',
                  fontSize: 12
                }}
              >
                {selectedCopySchedules.length === lastWeekSchedules.length ? '전체 해제' : '전체 선택'}
              </button>
            </div>
            
            {Object.entries(schedulesByAcademy).map(([academyId, academyData]: [string, any]) => {
              const academyScheduleIds = academyData.schedules.map((s: any) => s.id);
              const selectedCount = academyScheduleIds.filter((id: number) => selectedCopySchedules.includes(id)).length;
              const allSelected = selectedCount === academyScheduleIds.length;
              
              return (
                <div key={academyId} style={{ marginBottom: 24 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: 12,
                    padding: '8px 12px',
                    backgroundColor: '#f8fafc',
                    borderRadius: 8,
                    cursor: 'pointer'
                  }}
                  onClick={() => toggleAcademySchedules(parseInt(academyId), academyData.schedules)}
                  >
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => {}}
                      style={{ marginRight: 8 }}
                    />
                    <span style={{ fontWeight: 'bold', fontSize: 16 }}>
                      {academyData.academyName} ({selectedCount}/{academyScheduleIds.length})
                    </span>
                  </div>
                  
                  <div style={{ marginLeft: 24 }}>
                    {academyData.schedules.map((schedule: any) => (
                      <div key={schedule.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '8px',
                        marginBottom: 4,
                        backgroundColor: selectedCopySchedules.includes(schedule.id) ? '#f0f9ff' : 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: 6,
                        cursor: 'pointer'
                      }}
                      onClick={() => toggleScheduleSelection(schedule.id)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedCopySchedules.includes(schedule.id)}
                          onChange={() => {}}
                          style={{ marginRight: 8 }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 'bold', fontSize: 14 }}>
                            {schedule.start_time?.substring(0, 5)} - {schedule.end_time?.substring(0, 5)} 
                            / {schedule.professor_name}
                          </div>
                          <div style={{ fontSize: 12, color: '#6b7280' }}>
                            {schedule.course_name} ({schedule.shooting_type})
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            paddingTop: 16,
            borderTop: '1px solid #e5e7eb'
          }}>
            <button
              onClick={() => setCopyModalOpen(false)}
              style={{
                padding: '10px 20px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                background: 'white',
                cursor: 'pointer'
              }}
            >
              취소
            </button>
            <button
              onClick={executeCopySchedules}
              disabled={selectedCopySchedules.length === 0 || isCopying}
              style={{
                padding: '10px 20px',
                backgroundColor: selectedCopySchedules.length > 0 && !isCopying ? '#2563eb' : '#d1d5db',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: selectedCopySchedules.length > 0 && !isCopying ? 'pointer' : 'not-allowed'
              }}
            >
              {isCopying ? '복사 중...' : `${selectedCopySchedules.length}개 스케줄 복사`}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 🔥 기존 필터 렌더링 함수 완전 유지
  const renderFilters = () => {
    if (isManagerMode()) return null;
    
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 12,
        flexDirection: 'row'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ 
            fontSize: 13, 
            fontWeight: 600,
            color: 'var(--text-primary)',
            minWidth: '40px'
          }}>
            학원:
          </label>
          <select
            value={filters.mainLocationId}
            onChange={(e) => setFilters({...filters, mainLocationId: e.target.value})}
            style={{
              padding: '4px 8px',
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: 13,
              outline: 'none'
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
          <label style={{ 
            fontSize: 13, 
            fontWeight: 600,
            color: 'var(--text-primary)',
            minWidth: '50px'
          }}>
            촬영형식:
          </label>
          <select
            value={filters.shootingType}
            onChange={(e) => setFilters({...filters, shootingType: e.target.value})}
            style={{
              padding: '4px 8px',
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: 13,
              outline: 'none'
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

  // // 🔥 개발용 디버깅 패널 복원 (오타 수정 포함)
  // const DebugPanel = () => {
  //   if (process.env.NODE_ENV !== 'development') return null;
    
  //   const [selectedAcademies, setSelectedAcademies] = useState<number[]>([1, 3]);
  //   const [showAcademySelector, setShowAcademySelector] = useState(false);
    
  //   const currentUserRole = localStorage.getItem('userRole') || '';
  //   const currentUserName = localStorage.getItem('userName') || '';
    
  //   const getCurrentModeInfo = () => {
  //     if (currentUserRole === 'academy_manager') {
  //       return {
  //         mode: '매니저 모드',
  //         color: '#dc2626',
  //         bgColor: '#fef2f2',
  //         borderColor: '#fecaca'
  //       };
  //     } else if (currentUserRole === 'system_admin' || currentUserRole === 'schedule_admin') {
  //       return {
  //         mode: '관리자 모드',
  //         color: '#059669',
  //         bgColor: '#f0fdf4',
  //         borderColor: '#bbf7d0'
  //       };
  //     } else {
  //       return {
  //         mode: '기본 모드',
  //         color: '#6b7280',
  //         bgColor: '#f9fafb',
  //         borderColor: '#e5e7eb'
  //       };
  //     }
  //   };
    
  //   const modeInfo = getCurrentModeInfo();
    
  //   const sortedMainLocations = [...mainLocations].sort((a: any, b: any) => {
  //     const aMatch = a.name.match(/(\d+)/);
  //     const bMatch = b.name.match(/(\d+)/);
      
  //     if (aMatch && bMatch) {
  //       return parseInt(aMatch[0]) - parseInt(bMatch[0]); // ← ✅ bMatch로 수정
  //     }
      
  //     return a.name.localeCompare(b.name);
  //   });
    
  //   const setTestManagerWithAcademies = () => {
  //     localStorage.setItem('userRole', 'academy_manager');
  //     localStorage.setItem('userName', '테스트매니저');
  //     localStorage.setItem('assignedAcademyIds', JSON.stringify(selectedAcademies));
      
  //     fetchData();
  //     setShowAcademySelector(false);
  //   };

  //   const setTestAdminData = () => {
  //     localStorage.setItem('userRole', 'system_admin');
  //     localStorage.setItem('userName', '테스트관리자');
  //     localStorage.removeItem('assignedAcademyIds');
      
  //     fetchData();
  //   };

  //   const toggleAcademySelection = (academyId: number) => {
  //     setSelectedAcademies(prev => 
  //       prev.includes(academyId)
  //         ? prev.filter(id => id !== academyId)
  //         : [...prev, academyId]
  //     );
  //   };

  //   return (
  //     <div style={{
  //       position: 'fixed',
  //       top: 10,
  //       right: 10,
  //       background: '#1f2937',
  //       color: 'white',
  //       padding: 12,
  //       borderRadius: 8,
  //       zIndex: 9999,
  //       fontSize: 12,
  //       maxWidth: '340px',
  //       boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
  //     }}>
  //       <div style={{ marginBottom: 8, fontWeight: 'bold', fontSize: 14 }}>🚧 개발 모드</div>
        
  //       <div style={{
  //         background: modeInfo.bgColor,
  //         color: modeInfo.color,
  //         padding: '8px 12px',
  //         borderRadius: 6,
  //         border: `2px solid ${modeInfo.borderColor}`,
  //         marginBottom: 12,
  //         fontWeight: 'bold',
  //         textAlign: 'center'
  //       }}>
  //         <div style={{ fontSize: 13, marginBottom: 2 }}>
  //           {modeInfo.mode}
  //         </div>
  //         <div style={{ fontSize: 11 }}>
  //           {currentUserName}
  //         </div>
  //       </div>
        
  //       <div style={{ marginBottom: 12 }}>
  //         <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
  //           <button 
  //             onClick={() => setShowAcademySelector(!showAcademySelector)}
  //             style={{ 
  //               padding: '8px 12px', 
  //               fontSize: 11, 
  //               borderRadius: 6,
  //               background: showAcademySelector ? '#dc2626' : (currentUserRole === 'academy_manager' ? '#dc2626' : '#6b7280'),
  //               color: 'white',
  //               border: 'none',
  //               cursor: 'pointer',
  //               fontWeight: 'bold',
  //               flex: 1
  //             }}
  //           >
  //             {showAcademySelector ? '📝 선택 취소' : '👨‍💼 매니저 모드'}
  //           </button>
  //           <button 
  //             onClick={setTestAdminData}
  //             style={{ 
  //               padding: '8px 12px', 
  //               fontSize: 11, 
  //               borderRadius: 6,
  //               background: currentUserRole === 'system_admin' ? '#059669' : '#6b7280',
  //               color: 'white',
  //               border: 'none',
  //               cursor: 'pointer',
  //               fontWeight: 'bold',
  //               flex: 1
  //             }}
  //           >
  //             👑 관리자 모드
  //           </button>
  //         </div>
          
  //         {showAcademySelector && (
  //           <div style={{
  //             background: '#374151',
  //             padding: 10,
  //             borderRadius: 8,
  //             marginTop: 8,
  //             border: '2px solid #dc2626'
  //           }}>
  //             <div style={{ 
  //               marginBottom: 10, 
  //               fontSize: 12, 
  //               fontWeight: 'bold',
  //               color: '#fca5a5',
  //               textAlign: 'center'
  //             }}>
  //               📚 담당 학원 선택 (강의실 순서)
  //             </div>
              
  //             <div style={{ 
  //               display: 'grid', 
  //               gridTemplateColumns: 'repeat(2, 1fr)',
  //               gap: 6,
  //               maxHeight: '200px',
  //               overflowY: 'auto'
  //             }}>
  //               {sortedMainLocations.map((academy: any) => (
  //                 <label 
  //                   key={academy.id}
  //                   style={{ 
  //                     display: 'flex', 
  //                     alignItems: 'center', 
  //                     gap: 6,
  //                     cursor: 'pointer',
  //                     fontSize: 10,
  //                     padding: '6px 8px',
  //                     borderRadius: 4,
  //                     background: selectedAcademies.includes(academy.id) ? '#dc2626' : '#4b5563'
  //                   }}
  //                 >
  //                   <input
  //                     type="checkbox"
  //                     checked={selectedAcademies.includes(academy.id)}
  //                     onChange={() => toggleAcademySelection(academy.id)}
  //                     style={{ transform: 'scale(0.9)' }}
  //                   />
  //                   <span style={{
  //                     color: selectedAcademies.includes(academy.id) ? 'white' : '#d1d5db',
  //                     fontWeight: selectedAcademies.includes(academy.id) ? 'bold' : 'normal'
  //                   }}>
  //                     {academy.name}
  //                   </span>
  //                 </label>
  //               ))}
  //             </div>
              
  //             <div style={{ marginTop: 10, display: 'flex', gap: 4 }}>
  //               <button
  //                 onClick={() => setSelectedAcademies(sortedMainLocations.map((a: any) => a.id))}
  //                 style={{
  //                   padding: '6px 8px',
  //                   fontSize: 9,
  //                   borderRadius: 4,
  //                   background: '#6b7280',
  //                   color: 'white',
  //                   border: 'none',
  //                   cursor: 'pointer',
  //                   flex: 1
  //                 }}
  //               >
  //                 전체 선택
  //               </button>
  //               <button
  //                 onClick={() => setSelectedAcademies([])}
  //                 style={{
  //                   padding: '6px 8px',
  //                   fontSize: 9,
  //                   borderRadius: 4,
  //                   background: '#6b7280',
  //                   color: 'white',
  //                   border: 'none',
  //                   cursor: 'pointer',
  //                   flex: 1
  //                 }}
  //               >
  //                 전체 해제
  //               </button>
  //             </div>
              
  //             <button
  //               onClick={setTestManagerWithAcademies}
  //               disabled={selectedAcademies.length === 0}
  //               style={{
  //                 width: '100%',
  //                 padding: '10px',
  //                 fontSize: 11,
  //                 borderRadius: 6,
  //                 background: selectedAcademies.length > 0 ? '#dc2626' : '#6b7280',
  //                 color: 'white',
  //                 border: 'none',
  //                 marginTop: 10,
  //                 cursor: selectedAcademies.length > 0 ? 'pointer' : 'not-allowed',
  //                 fontWeight: 'bold'
  //               }}
  //             >
  //               {selectedAcademies.length > 0 
  //                 ? `👨‍💼 ${selectedAcademies.length}개 학원 매니저로 전환`
  //                 : '학원을 선택하세요'
  //               }
  //             </button>
  //           </div>
  //         )}
  //       </div>
        
  //       {currentUserRole === 'academy_manager' && (
  //         <div style={{
  //           background: '#7f1d1d',
  //           padding: 8,
  //           borderRadius: 6,
  //           fontSize: 10,
  //           border: '1px solid #dc2626'
  //         }}>
  //           <div style={{ fontWeight: 'bold', marginBottom: 6, color: '#fca5a5' }}>
  //             📋 현재 담당 학원:
  //           </div>
  //           <div style={{ color: '#fecaca', lineHeight: 1.4 }}>
  //             {JSON.parse(localStorage.getItem('assignedAcademyIds') || '[]')
  //               .map((id: number) => {
  //                 const academy = sortedMainLocations.find((a: any) => a.id === id);
  //                 return academy?.name;
  //               })
  //               .filter(Boolean)
  //               .join(', ') || '없음'}
  //           </div>
  //         </div>
  //       )}
        
  //       {(currentUserRole === 'system_admin' || currentUserRole === 'schedule_admin') && (
  //         <div style={{
  //           background: '#064e3b',
  //           padding: 8,
  //           borderRadius: 6,
  //           fontSize: 10,
  //           border: '1px solid #059669'
  //         }}>
  //           <div style={{ fontWeight: 'bold', color: '#a7f3d0', textAlign: 'center' }}>
  //             👑 모든 학원 관리 권한
  //           </div>
  //         </div>
  //       )}
  //     </div>
  //   );
  // };

  // 🔥 기존 로딩/에러 상태 처리 유지
  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={fetchData} />;

  // 🔥 기존 메인 렌더링 구조 완전 유지 (BaseScheduleGrid 사용) + DebugPanel 복원
  return (
    <>
      {/* 🔥 개발모드 디버깅 패널 복원
      <DebugPanel /> */}
      
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
        onCopyPreviousWeek={handleCopyPreviousWeek}
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
          userRole={userRole}
          onSave={handleSave}
        />
      )}
      
      <CopyScheduleModal />
    </>
  );
}
