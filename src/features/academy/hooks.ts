import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { AcademyAPI } from './api';
import { Schedule, Location, UserInfo, ScheduleFormData } from '../../types/academy';
import { supabase, checkSession } from '../../utils/supabaseClient';

export const useAcademySchedules = (currentWeek: Date) => {
  const router = useRouter();
  
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [selectedAcademies, setSelectedAcademies] = useState<number[]>([]);
  const [isManager, setIsManager] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 🔥 로그아웃 및 리다이렉션 헬퍼
  const logoutAndRedirect = useCallback(async () => {
    console.warn('⚠️ 세션 만료 - 로그인 페이지로 이동');
    localStorage.clear();
    await supabase.auth.signOut();
    router.replace('/login');
  }, [router]);

  // 🔥 세션 기반 데이터 초기화
  const initializeData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔍 데이터 초기화 시작');

      // 세션 확인
      const session = await checkSession();
      if (!session) {
        console.warn('⚠️ 세션 없음 - 로그인 필요');
        await logoutAndRedirect();
        return;
      }

      console.log('✅ 세션 확인 완료:', session.user.email);

      // 사용자 정보 조회 시도
      try {
        const userData = await AcademyAPI.getUserInfo();
        setUserInfo(userData);

        const isManagerRole = userData.role === 'academy_manager' || userData.role === 'manager';
        setIsManager(isManagerRole);

        // 학원 접근 권한 설정
        if (isManagerRole) {
          if (userData.academies.length === 0) {
            // 모든 학원 접근 권한
            try {
              const { data: allAcademies } = await supabase
                .from('main_locations')
                .select('id')
                .eq('is_active', true)
                .eq('location_type', 'academy');

              if (allAcademies) {
                setSelectedAcademies(allAcademies.map(academy => academy.id));
              }
            } catch (academyError) {
              console.error('⚠️ 학원 목록 조회 실패:', academyError);
              setSelectedAcademies([]);
            }
          } else {
            setSelectedAcademies(userData.academies);
          }
        } else {
          setSelectedAcademies([]);
        }

        console.log('✅ 사용자 정보 설정 완료:', userData);
      } catch (userError: any) {
        console.error('❌ 사용자 정보 조회 실패:', userError);
        
        // 인증 관련 오류면 로그아웃
        if (userError.message?.includes('세션') || userError.message?.includes('인증')) {
          await logoutAndRedirect();
          return;
        }
        
        // 기타 오류는 기본값으로 진행
        const savedRole = localStorage.getItem('userRole') || 'academy_manager';
        const savedEmail = localStorage.getItem('userEmail') || session.user.email;
        
        setUserInfo({
          id: 0,
          name: '사용자',
          email: savedEmail,
          role: savedRole,
          academies: []
        });
        
        setIsManager(true);
        setSelectedAcademies([]);
        
        console.log('✅ 기본 사용자 정보 설정 완료');
      }

      // 위치 정보 조회
      try {
        const locationsData = await AcademyAPI.fetchLocations([]);
        setLocations(locationsData);
        console.log('✅ 위치 정보 조회 성공:', locationsData.length);
      } catch (locationError: any) {
        console.error('❌ 위치 정보 조회 실패:', locationError);
        
        // 인증 관련 오류면 로그아웃
        if (locationError.message?.includes('인증') || locationError.message?.includes('세션')) {
          await logoutAndRedirect();
          return;
        }
        
        setError('위치 정보를 불러올 수 없습니다');
      }

    } catch (err: any) {
      console.error('❌ 데이터 초기화 전체 오류:', err);
      
      // 인증 관련 오류면 로그아웃
      if (err.message?.includes('인증') || err.message?.includes('세션')) {
        await logoutAndRedirect();
        return;
      }
      
      setError(err instanceof Error ? err.message : '데이터 로딩 실패');
    } finally {
      setLoading(false);
    }
  }, [logoutAndRedirect]);

  // 스케줄 조회
  const fetchSchedules = useCallback(async () => {
    if (!userInfo) return;

    try {
      const startDate = new Date(currentWeek);
      const endDate = new Date(currentWeek);
      endDate.setDate(startDate.getDate() + 6);

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      const schedulesData = await AcademyAPI.fetchSchedules(
        startDateStr,
        endDateStr,
        selectedAcademies
      );

      setSchedules(schedulesData);
      console.log('✅ 스케줄 조회 성공:', schedulesData.length);
    } catch (err: any) {
      console.error('❌ 스케줄 조회 오류:', err);
      
      // 인증 관련 오류면 로그아웃
      if (err.message?.includes('인증') || err.message?.includes('세션')) {
        await logoutAndRedirect();
        return;
      }
      
      setError(err instanceof Error ? err.message : '스케줄 조회 실패');
    }
  }, [currentWeek, selectedAcademies, userInfo, logoutAndRedirect]);

  // 스케줄 저장
  const saveSchedule = useCallback(async (
    data: ScheduleFormData, 
    action: 'temp' | 'request' | 'approve'
  ) => {
    try {
      await AcademyAPI.saveSchedule(data, action);
      await fetchSchedules(); // 저장 후 새로고침
      
      const actionText = action === 'temp' ? '임시저장' : 
                        action === 'request' ? '승인요청' : '승인완료';
      return { success: true, message: `${actionText}되었습니다.` };
    } catch (err: any) {
      // 인증 관련 오류면 로그아웃
      if (err.message?.includes('인증') || err.message?.includes('세션')) {
        await logoutAndRedirect();
        return { success: false, message: '인증이 만료되었습니다' };
      }
      
      const message = err instanceof Error ? err.message : '저장 실패';
      return { success: false, message };
    }
  }, [fetchSchedules, logoutAndRedirect]);

  // 초기 데이터 로딩
  useEffect(() => {
    initializeData();
  }, [initializeData]);

  // 주간 변경 시 스케줄 새로고침
  useEffect(() => {
    if (userInfo) {
      fetchSchedules();
    }
  }, [fetchSchedules, userInfo]);

  return {
    schedules,
    locations,
    userInfo,
    selectedAcademies,
    isManager,
    loading,
    error,
    saveSchedule,
    refreshSchedules: fetchSchedules
  };
};

export const useScheduleModal = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<{
    date: string;
    locationId: number;
    scheduleData?: ScheduleFormData;
  } | null>(null);

  const openModal = useCallback((data: {
    date: string;
    locationId: number;
    scheduleData?: ScheduleFormData;
  }) => {
    console.log('📝 모달 열기:', data);
    setModalData(data);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    console.log('🔒 모달 닫기');
    setModalOpen(false);
    setModalData(null);
  }, []);

  return {
    modalOpen,
    modalData,
    openModal,
    closeModal
  };
};
