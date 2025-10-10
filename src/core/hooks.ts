import { useState, useEffect, useCallback } from 'react';
import { CommonAPI } from './api';
import { BaseSchedule, Location, UserInfo, ScheduleType, ModalData } from './types';

export const useScheduleData = (scheduleType: ScheduleType, currentWeek: Date) => {
  const [schedules, setSchedules] = useState<BaseSchedule[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [selectedAcademies, setSelectedAcademies] = useState<number[]>([]);
  const [isManager, setIsManager] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 데이터 초기화
  const initializeData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 사용자 정보 조회
      const userData = await CommonAPI.getUserInfo();
      setUserInfo(userData);

      const isManagerRole = userData.role.includes('manager');
      setIsManager(isManagerRole);

      // 학원 접근 권한 설정
      if (isManagerRole && scheduleType === 'academy') {
        if (userData.academies && userData.academies.length === 0) {
          setSelectedAcademies([]);
        } else {
          setSelectedAcademies(userData.academies || []);
        }
      } else {
        setSelectedAcademies([]);
      }

      // 위치 정보 조회
      const locationsData = await CommonAPI.fetchLocations(
        scheduleType,
        isManagerRole && scheduleType === 'academy' ? userData.academies : []
      );
      setLocations(locationsData);

    } catch (err) {
      console.error('❌ 데이터 초기화 오류:', err);
      setError(err instanceof Error ? err.message : '데이터 로딩 실패');
    } finally {
      setLoading(false);
    }
  }, [scheduleType]);

  // 스케줄 조회
  const fetchSchedules = useCallback(async () => {
    if (!userInfo) return;

    try {
      const startDate = new Date(currentWeek);
      const endDate = new Date(currentWeek);
      endDate.setDate(startDate.getDate() + 6);

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      const schedulesData = await CommonAPI.fetchSchedules(
        scheduleType,
        startDateStr,
        endDateStr,
        selectedAcademies
      );

      setSchedules(schedulesData);
    } catch (err) {
      console.error('❌ 스케줄 조회 오류:', err);
      setError(err instanceof Error ? err.message : '스케줄 조회 실패');
    }
  }, [scheduleType, currentWeek, selectedAcademies, userInfo]);

  // 스케줄 저장
  const saveSchedule = useCallback(async (
    data: BaseSchedule, 
    action: 'temp' | 'request' | 'approve'
  ) => {
    try {
      await CommonAPI.saveSchedule(data, action);
      await fetchSchedules();
      
      const actionText = action === 'temp' ? '임시저장' : 
                        action === 'request' ? '승인요청' : '승인완료';
      return { success: true, message: `${actionText}되었습니다.` };
    } catch (err) {
      const message = err instanceof Error ? err.message : '저장 실패';
      return { success: false, message };
    }
  }, [fetchSchedules]);

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

export const useModal = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<ModalData | null>(null);

  const openModal = useCallback((data: ModalData) => {
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
