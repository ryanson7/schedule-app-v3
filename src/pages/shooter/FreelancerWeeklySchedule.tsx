// src/pages/shooter/FreelancerWeeklySchedule.tsx
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

// 🔧 시간 범위 기반 인터페이스로 변경
interface DaySchedule {
  available: boolean;
  startTime: string;
  endTime: string;
}

interface WeeklySchedule {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

interface ScheduleData {
  weekStartDate: string;
  schedule: WeeklySchedule;
  isAllUnavailable: boolean;
  unavailableReason: string;
  availableStartDate: string;
  message: string; 
  status: 'draft' | 'submitted';
}

// 공지사항 인터페이스
interface Notification {
  id: string;
  title: string;
  content: string;
  created_at: string;
  is_active: boolean;
  display_locations?: string[];
  show_from?: string;
  show_until?: string;
}

// 🔧 07:00~22:00 시간 옵션
const TIME_OPTIONS = Array.from({ length: 16 }, (_, i) => {
  const hour = 7 + i;
  return `${hour.toString().padStart(2, '0')}:00`;
});

const FreelancerWeeklySchedule: React.FC = () => {
  const { user, userData } = useAuth();
  const [currentWeekStart, setCurrentWeekStart] = useState<string>('');
  const [scheduleData, setScheduleData] = useState<ScheduleData>({
    weekStartDate: '',
    schedule: {
      monday: { available: false, startTime: '09:00', endTime: '19:00' },
      tuesday: { available: false, startTime: '09:00', endTime: '198:00' },
      wednesday: { available: false, startTime: '09:00', endTime: '19:00' },
      thursday: { available: false, startTime: '09:00', endTime: '19:00' },
      friday: { available: false, startTime: '09:00', endTime: '19:00' },
      saturday: { available: false, startTime: '09:00', endTime: '19:00' },
      sunday: { available: false, startTime: '09:00', endTime: '19:00' }
    },
    isAllUnavailable: false,
    unavailableReason: '',
    availableStartDate: '',
    message: '',
    status: 'draft'
  });
  
  const [loading, setLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  // 공지사항 상태
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotification, setShowNotification] = useState(false);
  
  // 긴 공지사항 처리를 위한 상태
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isContentTruncated, setIsContentTruncated] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const days = [
    { key: 'monday', label: '월', fullName: '월요일' },
    { key: 'tuesday', label: '화', fullName: '화요일' },
    { key: 'wednesday', label: '수', fullName: '수요일' },
    { key: 'thursday', label: '목', fullName: '목요일' },
    { key: 'friday', label: '금', fullName: '금요일' },
    { key: 'saturday', label: '토', fullName: '토요일' },
    { key: 'sunday', label: '일', fullName: '일요일' }
  ];

  // 다음주 스케줄 범위 계산
  const getNextWeekRange = () => {
    const now = new Date();
    const nextMonday = new Date(now);
    const daysUntilNextMonday = ((7 - now.getDay()) % 7) + 1;
    nextMonday.setDate(now.getDate() + daysUntilNextMonday);
    return nextMonday.toISOString().split('T')[0];
  };

  const getWeekEnd = (weekStart: string): string => {
    const startDate = new Date(weekStart);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    return endDate.toISOString().split('T')[0];
  };

  // 날짜와 요일 포맷 함수 (모달용)
  const formatDateWithDay = (dateStr: string, dayIndex: number): string => {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + dayIndex);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const dayName = dayNames[date.getDay()];
    return `${month}/${day}(${dayName})`;
  };

  const formatDateRange = (startDate: string, endDate: string): string => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const startFormatted = `${start.getFullYear()}. ${(start.getMonth() + 1).toString().padStart(2, '0')}. ${start.getDate().toString().padStart(2, '0')}.`;
    const endFormatted = `${end.getFullYear()}. ${(end.getMonth() + 1).toString().padStart(2, '0')}. ${end.getDate().toString().padStart(2, '0')}.`;
    
    return `${startFormatted} ~ ${endFormatted}`;
  };

  // 매주 반복되는 폼 접수 기간 계산
  const getFormTimes = () => {
    const now = new Date();
    
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() - now.getDay() + 1);
    thisMonday.setHours(18, 0, 0, 0);
    
    const lastFriday = new Date(thisMonday);
    lastFriday.setDate(thisMonday.getDate() - 3);
    lastFriday.setHours(9, 30, 0, 0);
    
    return { openTime: lastFriday, closeTime: thisMonday };
  };

  // 🔧 폼 접수 상태 메시지 - 임시 해제 버전
const getFormStatusMessage = (): { 
  scheduleMessage: string; 
  statusMessage: string; 
  color: string; 
  canSubmit: boolean 
} => {
  const now = new Date();
  
  // 스케줄 기간은 고정
  const scheduleMessage = currentWeekStart ? 
    `📅 ${formatDateRange(currentWeekStart, getWeekEnd(currentWeekStart))}` : 
    '📅 스케줄 준비 중...';
  
  // 🔥 임시 해제: 항상 접수 가능하도록 설정
  return {
    scheduleMessage,
    statusMessage: '✅ 접수 가능 (제한 해제됨)',
    color: '#10b981',
    canSubmit: true
  };

  // 🔥 기존 시간 제한 로직 (주석 처리)
  /*
  const { openTime, closeTime } = getFormTimes();
  
  if (now < openTime) {
    return {
      scheduleMessage,
      statusMessage: `📅 접수 시작: ${openTime.getMonth()+1}/${openTime.getDate()}(금) 09:30부터`,
      color: '#f59e0b',
      canSubmit: false
    };
  } else if (now > closeTime) {
    return {
      scheduleMessage,
      statusMessage: '⏰ 접수 마감됨',
      color: '#dc2626',
      canSubmit: false
    };
  } else {
    const timeDiff = closeTime.getTime() - now.getTime();
    const hoursLeft = Math.floor(timeDiff / (1000 * 60 * 60));
    const minutesLeft = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hoursLeft >= 6) {
      return {
        scheduleMessage,
        statusMessage: '📝 접수 중',
        color: '#10b981',
        canSubmit: true
      };
    } else {
      return {
        scheduleMessage,
        statusMessage: `⏳ 마감까지 ${hoursLeft}시간 ${minutesLeft}분 남음`,
        color: hoursLeft < 1 ? '#dc2626' : '#f59e0b',
        canSubmit: true
      };
    }
  }
  */
};


  // 내용이 잘렸는지 확인하는 함수
  const checkContentTruncation = () => {
    if (contentRef.current && notifications.length > 0) {
      const element = contentRef.current;
      setIsContentTruncated(element.scrollHeight > element.clientHeight);
    }
  };

  // 공지사항 로드 - 시간 기반 필터링 + 잘림 확인
  const loadNotifications = async () => {
    try {
      console.log('📢 스케줄 등록 공지사항 로드 시작...');
      
      const now = new Date().toISOString();
      
      // 모든 활성 공지사항 조회
      const { data, error } = await supabase
        .from('freelancer_schedule_notifications')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ 공지사항 조회 에러:', error);
        setNotifications([]);
        setShowNotification(false);
        return;
      }

      // 스케줄 등록용 필터링 ('schedule' 또는 'all' 포함)
      const filteredNotifications = (data || []).filter(notification => {
        // 노출 위치 필터링
        const locationMatch = notification.display_locations?.includes('schedule') || 
                             notification.display_locations?.includes('all');
        
        if (!locationMatch) return false;

        // 시간 기반 필터링 (선택사항)
        const showFrom = notification.show_from ? new Date(notification.show_from).toISOString() : null;
        const showUntil = notification.show_until ? new Date(notification.show_until).toISOString() : null;
        
        // 시작일 체크
        if (showFrom && now < showFrom) return false;
        
        // 종료일 체크  
        if (showUntil && now > showUntil) return false;

        return true;
      });

      console.log('📅 스케줄 등록용 공지사항:', filteredNotifications.length + '개');
      console.log('✅ 필터링된 공지사항 데이터:', filteredNotifications);

      // 결과에 따라 상태 설정
      if (filteredNotifications.length > 0) {
        console.log('📅 스케줄 등록용 공지사항 표시:', filteredNotifications[0]);
        setNotifications(filteredNotifications.slice(0, 2)); // 최대 2개
        setShowNotification(true);
      } else {
        console.log('📅 스케줄 등록용 공지사항 없음');
        setNotifications([]);
        setShowNotification(false);
      }

      // DOM이 렌더링된 후 잘림 확인
      setTimeout(() => {
        checkContentTruncation();
      }, 100);
      
    } catch (error) {
      console.error('❌ 공지사항 로드 오류:', error);
      setNotifications([]);
      setShowNotification(false);
    }
  };

  // 데이터 로드
  const loadScheduleData = async () => {
    try {
      setLoading(true);
      
      const userId = user?.id || userData?.id;
      if (!userId) {
        console.log('사용자 ID 없음');
        return;
      }

      console.log('스케줄 로드 시도:', { userId, currentWeekStart });

      const { data, error } = await supabase
        .from('shooter_weekly_schedule')
        .select('*')
        .eq('shooter_id', userId)
        .eq('week_start_date', currentWeekStart)
        .maybeSingle();

      if (error) {
        console.error('Supabase 쿼리 오류:', error);
      }

      if (data) {
        console.log('스케줄 데이터 로드됨:', data);
        setScheduleData({
          weekStartDate: data.week_start_date,
          schedule: data.schedule_data || scheduleData.schedule,
          isAllUnavailable: data.is_all_unavailable || false,
          unavailableReason: data.unavailable_reason || '',
          availableStartDate: data.available_start_date || '',
          message: data.message || '',
          status: data.status || 'draft'
        });
      } else {
        console.log('새 스케줄 초기화');
        setScheduleData(prev => ({
          ...prev,
          weekStartDate: currentWeekStart,
          isAllUnavailable: false,
          unavailableReason: '',
          availableStartDate: '',
          message: '',
          status: 'draft'
        }));
      }
    } catch (error) {
      console.error('스케줄 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 🔧 요일별 가용성 변경
  const handleDayAvailabilityChange = (dayKey: string, available: boolean) => {
    const { canSubmit } = getFormStatusMessage();
    if (scheduleData.status === 'submitted' || !canSubmit) return;
    
    setScheduleData(prev => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [dayKey]: {
          ...prev.schedule[dayKey as keyof WeeklySchedule],
          available
        }
      }
    }));
  };

  // 🔧 시간 변경 (시간 유효성 검증 포함)
  const handleTimeChange = (dayKey: string, timeType: 'startTime' | 'endTime', value: string) => {
    const { canSubmit } = getFormStatusMessage();
    if (scheduleData.status === 'submitted' || !canSubmit) return;

    setScheduleData(prev => {
      const currentDay = prev.schedule[dayKey as keyof WeeklySchedule];
      const newDay = {
        ...currentDay,
        [timeType]: value
      };

      // 시간 유효성 검증
      const validateTimeRange = (start: string, end: string) => {
        const startHour = parseInt(start.split(':')[0]);
        const endHour = parseInt(end.split(':')[0]);
        return startHour < endHour;
      };

      if (timeType === 'startTime' && !validateTimeRange(value, currentDay.endTime)) {
        // 시작시간이 종료시간보다 늦으면 종료시간을 자동 조정
        const startHour = parseInt(value.split(':')[0]);
        const newEndTime = `${Math.min(startHour + 1, 22).toString().padStart(2, '0')}:00`;
        newDay.endTime = newEndTime;
      } else if (timeType === 'endTime' && !validateTimeRange(currentDay.startTime, value)) {
        // 종료시간이 시작시간보다 빠르면 시작시간을 자동 조정
        const endHour = parseInt(value.split(':')[0]);
        const newStartTime = `${Math.max(endHour - 1, 7).toString().padStart(2, '0')}:00`;
        newDay.startTime = newStartTime;
      }

      return {
        ...prev,
        schedule: {
          ...prev.schedule,
          [dayKey]: newDay
        }
      };
    });
  };

  // 전체 근무 불가 토글
  const toggleAllUnavailable = () => {
    const { canSubmit } = getFormStatusMessage();
    if (scheduleData.status === 'submitted' || !canSubmit) return;
    
    setScheduleData(prev => ({
      ...prev,
      isAllUnavailable: !prev.isAllUnavailable,
      unavailableReason: !prev.isAllUnavailable ? prev.unavailableReason : '',
      availableStartDate: !prev.isAllUnavailable ? prev.availableStartDate : ''
    }));
  };

  // 🔧 전체 근무 가능 일수 계산 (시간 범위 기반)
  const getTotalAvailableDays = (): number => {
    return Object.values(scheduleData.schedule).filter(day => day.available).length;
  };

  // 🔧 선택된 시간대 목록 가져오기 (시간 범위 기반)
  const getSelectedScheduleList = (): string[] => {
    const selectedSchedules: string[] = [];
    
    days.forEach((day, index) => {
      const daySchedule = scheduleData.schedule[day.key as keyof WeeklySchedule];
      if (daySchedule.available) {
        const dateStr = formatDateWithDay(currentWeekStart, index);
        selectedSchedules.push(`${dateStr} ${daySchedule.startTime}~${daySchedule.endTime}`);
      }
    });
    
    return selectedSchedules;
  };

  // 제출 전 검증
  const validateSchedule = (): string | null => {
    const { canSubmit } = getFormStatusMessage();
    if (!canSubmit) {
      return '접수 기간이 아닙니다.';
    }
    
    if (scheduleData.isAllUnavailable) {
      if (!scheduleData.unavailableReason.trim()) {
        return '전체 근무 불가 시 사유를 입력해주세요.';
      }
      if (!scheduleData.availableStartDate) {
        return '근무 가능 시작일을 선택해주세요.';
      }
    } else {
      const totalDays = getTotalAvailableDays();
      if (totalDays === 0) {
        return '최소 하나 이상의 요일을 선택해주세요.';
      }
    }
    return null;
  };

  const submitSchedule = async () => {
    const validationError = validateSchedule();
    if (validationError) {
      alert(validationError);
      return;
    }
    setShowConfirmModal(true);
  };

  // 제출 확인
  const confirmSubmit = async () => {
    try {
      setLoading(true);
      
      const userId = user?.id || userData?.id;
      if (!userId) {
        throw new Error('사용자 인증 정보를 찾을 수 없습니다.');
      }

      const { error } = await supabase
        .from('shooter_weekly_schedule')
        .upsert({
          shooter_id: userId,
          week_start_date: currentWeekStart,
          schedule_data: scheduleData.schedule,
          is_all_unavailable: scheduleData.isAllUnavailable,
          unavailable_reason: scheduleData.unavailableReason,
          available_start_date: scheduleData.availableStartDate || null,
          message: scheduleData.message,
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      
      setScheduleData(prev => ({ ...prev, status: 'submitted' }));
      setShowConfirmModal(false);
      alert('스케줄이 성공적으로 제출되었습니다.');
      
    } catch (error) {
      console.error('제출 실패:', error);
      alert('제출 실패: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // useEffect에서 호출
  useEffect(() => {
    loadNotifications();
  }, []);

  useEffect(() => {
    const weekStart = getNextWeekRange();
    setCurrentWeekStart(weekStart);
  }, []);

  useEffect(() => {
    if (currentWeekStart) {
      loadScheduleData();
    }
  }, [currentWeekStart, user, userData]);

  // 사용자 이름 가져오기
  const getUserName = () => {
    const storedUserName = localStorage.getItem('userName');
    if (storedUserName) return storedUserName;
    
    const storedUserData = localStorage.getItem('userData');
    if (storedUserData) {
      try {
        const parsed = JSON.parse(storedUserData);
        if (parsed.userName || parsed.name) {
          return parsed.userName || parsed.name;
        }
      } catch (e) {
        console.error('localStorage 파싱 오류:', e);
      }
    }

    if (userData?.name) return userData.name;
    if (userData?.username) return userData.username;
    
    return user?.email?.split('@')[0] || '사용자';
  };

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'white',
        padding: '20px',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 999
      }}>
        <div style={{ textAlign: 'center', fontSize: '16px', color: '#374151' }}>
          처리 중...
        </div>
      </div>
    );
  }

  const formStatus = getFormStatusMessage();

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#f8fafc',
      padding: '16px 12px',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      display: 'flex',
      justifyContent: 'center'
    }}>
      {/* ✅ 메인 컨테이너 - PC 버전 와이드 제한 */}
      <div style={{
        width: '100%',
        maxWidth: '800px', // PC에서 최대 800px로 제한
        margin: '0 auto',
        position: 'relative'
      }}>

        {/* 📢 공지사항 배너 (상단 고정) - 긴 내용 처리 + 모바일 최적화 */}
        {notifications.length > 0 && showNotification && (
          <div style={{
            position: 'fixed',
            top: '0',
            left: '0',
            right: '0',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            padding: '12px 16px',
            fontSize: '14px',
            fontWeight: '600',
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            zIndex: 1000,
            animation: 'slideDown 0.3s ease-out',
            borderBottom: '2px solid rgba(255,255,255,0.2)'
          }}>
            <div style={{ 
              maxWidth: '800px', 
              margin: '0 auto',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '12px'
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: '4px' }}>
                  📢 <strong>{notifications[0].title}</strong>
                </div>
                
                {/* 3줄 말줄임 처리 */}
                <div 
                  ref={contentRef}
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    lineHeight: '1.4',
                    maxHeight: '60px',
                    fontSize: '13px',
                    opacity: 0.9
                  }}
                >
                  {notifications[0].content}
                </div>
                
                {/* 더보기 버튼 (긴 내용일 때만) */}
                {isContentTruncated && (
                  <button
                    onClick={() => setShowDetailModal(true)}
                    style={{
                      background: 'rgba(255,255,255,0.2)',
                      border: '1px solid rgba(255,255,255,0.3)',
                      borderRadius: '12px',
                      color: 'white',
                      fontSize: '12px',
                      padding: '4px 12px',
                      marginTop: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    전체보기 →
                  </button>
                )}
              </div>
              
              {/* 모바일 반응형 닫힘 버튼 */}
              <button
                onClick={() => setShowNotification(false)}
                style={{
                  background: 'rgba(255,255,255,0.25)',
                  border: '2px solid rgba(255,255,255,0.4)',
                  borderRadius: '50%',
                  color: 'white',
                  fontSize: '20px',
                  cursor: 'pointer',
                  padding: '4px 10px',
                  opacity: 0.9,
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '32px',
                  minHeight: '32px',
                  fontWeight: 'normal',
                  lineHeight: '1',
                  flexShrink: 0
                }}
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* 전체보기 모달 */}
        {showDetailModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
            padding: '20px'
          }}>
            <div style={{
              background: 'white',
              padding: '24px',
              borderRadius: '16px',
              maxWidth: '600px',
              maxHeight: '80vh',
              width: '100%',
              overflow: 'auto',
              boxShadow: '0 10px 25px rgba(0,0,0,0.3)'
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'flex-start',
                marginBottom: '16px'
              }}>
                <h3 style={{ 
                  fontSize: '20px', 
                  fontWeight: 'bold',
                  margin: 0,
                  color: '#1e293b'
                }}>
                  📢 {notifications[0].title}
                </h3>
                
                <button
                  onClick={() => setShowDetailModal(false)}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    borderRadius: '50%',
                    color: '#64748b',
                    fontSize: '20px',
                    cursor: 'pointer',
                    padding: '6px 10px',
                    marginLeft: '16px'
                  }}
                >
                  ×
                </button>
              </div>
              
              <div style={{ 
                fontSize: '16px', 
                color: '#475569',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap' // 줄바꿈 유지
              }}>
                {notifications[0].content}
              </div>
              
              <div style={{ 
                marginTop: '20px',
                textAlign: 'center'
              }}>
                <button
                  onClick={() => setShowDetailModal(false)}
                  style={{
                    padding: '12px 24px',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 메인 컨텐츠 (공지사항이 있을 때 상단 여백 추가) */}
        <div style={{ 
          paddingTop: notifications.length > 0 && showNotification ? '80px' : '0',
          transition: 'padding-top 0.3s ease-out'
        }}>
          {/* 헤더 */}
          <div style={{ marginBottom: '24px', textAlign: 'center' }}>
            <h1 style={{ 
              fontSize: '24px', 
              fontWeight: 'bold', 
              margin: '0 0 8px 0',
              color: '#1e293b'
            }}>
              {getUserName()}PD님
            </h1>
            <p style={{ 
              fontSize: '16px', 
              color: '#3b82f6', 
              margin: '0 0 12px 0',
              fontWeight: '600'
            }}>
              다음 주 근무 가능한 시간대를 선택해주세요
            </p>
            
            {/* 스케줄 기간 (첫 번째 줄) */}
            <div style={{ 
              fontSize: '14px', 
              color: '#64748b',
              background: 'white',
              padding: '8px 16px',
              borderRadius: '20px',
              display: 'inline-block',
              marginBottom: '8px'
            }}>
              {formStatus.scheduleMessage}
              {scheduleData.status === 'submitted' && ' ✅ 제출완료'}
            </div>
            
            {/* 폼 상태 메시지 (두 번째 줄) - 줄바꿈 적용 */}
            <div style={{
              fontSize: '14px',
              color: formStatus.color,
              background: 'white',
              padding: '8px 16px',
              borderRadius: '20px',
              display: 'block',
              maxWidth: '400px',
              margin: '0 auto',
              fontWeight: '600',
              border: `2px solid ${formStatus.color}20`
            }}>
              {formStatus.statusMessage}
            </div>
          </div>

          {/* 🔧 시간 범위 안내 */}
          <div style={{
            background: 'white',
            padding: '16px',
            borderRadius: '12px',
            marginBottom: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#1e293b' }}>
              ⏰ 시간 범위 선택 안내
            </h3>
            <div style={{ fontSize: '14px', color: '#475569', lineHeight: '1.5' }}>
              • 각 요일마다 근무 가능한 <strong>시작 시간</strong>과 <strong>종료 시간</strong>을 선택하세요<br/>
              • 선택 가능 시간: <strong>07:00 ~ 22:00</strong><br/>
              • 시작 시간은 종료 시간보다 빨라야 합니다
            </div>
          </div>

          {/* 전체 근무 불가 옵션 */}
          <div style={{
            background: 'white',
            padding: '16px',
            borderRadius: '12px',
            marginBottom: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: (scheduleData.status === 'submitted' || !formStatus.canSubmit) ? 'not-allowed' : 'pointer',
              marginBottom: '16px',
              opacity: (scheduleData.status === 'submitted' || !formStatus.canSubmit) ? 0.6 : 1
            }}>
              <input
                type="checkbox"
                checked={scheduleData.isAllUnavailable}
                onChange={toggleAllUnavailable}
                disabled={scheduleData.status === 'submitted' || !formStatus.canSubmit}
                style={{ transform: 'scale(1.2)' }}
              />
              <span style={{ fontSize: '16px', fontWeight: '600', color: '#dc2626' }}>
                🚫 해당 주 전체 근무 불가
              </span>
            </label>

            {scheduleData.isAllUnavailable && (
              <div style={{ paddingLeft: '32px' }}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '14px', 
                    fontWeight: '500', 
                    marginBottom: '6px',
                    color: '#374151'
                  }}>
                    사유 *
                  </label>
                  <textarea
                    value={scheduleData.unavailableReason}
                    onChange={(e) => setScheduleData(prev => ({ 
                      ...prev, 
                      unavailableReason: e.target.value 
                    }))}
                    disabled={scheduleData.status === 'submitted' || !formStatus.canSubmit}
                    placeholder="근무 불가 사유를 간단히 적어주세요"
                    style={{
                      width: '100%',
                      minHeight: '80px',
                      padding: '12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      resize: 'none',
                      boxSizing: 'border-box',
                      opacity: (scheduleData.status === 'submitted' || !formStatus.canSubmit) ? 0.6 : 1
                    }}
                  />
                </div>

                <div>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '14px', 
                    fontWeight: '500', 
                    marginBottom: '6px',
                    color: '#374151'
                  }}>
                    근무 가능 시작일 *
                  </label>
                  <input
                    type="date"
                    value={scheduleData.availableStartDate}
                    onChange={(e) => setScheduleData(prev => ({ 
                      ...prev, 
                      availableStartDate: e.target.value 
                    }))}
                    disabled={scheduleData.status === 'submitted' || !formStatus.canSubmit}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                      opacity: (scheduleData.status === 'submitted' || !formStatus.canSubmit) ? 0.6 : 1
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 🔧 주간 스케줄 그리드 (시간 범위 선택) */}
          {!scheduleData.isAllUnavailable && (
            <div style={{
              background: 'white',
              padding: '16px',
              borderRadius: '12px',
              marginBottom: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              opacity: (scheduleData.status === 'submitted' || !formStatus.canSubmit) ? 0.7 : 1
            }}>
              <h3 style={{ 
                fontSize: '16px', 
                fontWeight: '600', 
                marginBottom: '16px',
                color: '#1e293b',
                textAlign: 'center'
              }}>
                📅 주간 근무 가능 시간
              </h3>

              {days.map((day, dayIndex) => {
                const daySchedule = scheduleData.schedule[day.key as keyof WeeklySchedule];
                const dayDate = new Date(currentWeekStart);
                dayDate.setDate(dayDate.getDate() + dayIndex);
                
                return (
                  <div key={day.key} style={{
                    marginBottom: '16px',
                    padding: '16px',
                    background: daySchedule.available ? '#ecfdf5' : '#f8fafc',
                    borderRadius: '12px',
                    border: daySchedule.available ? '2px solid #10b981' : '1px solid #e5e7eb'
                  }}>
                    {/* 요일 헤더 */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '16px'
                    }}>
                      <div>
                        <span style={{ 
                          fontSize: '18px', 
                          fontWeight: '600',
                          color: daySchedule.available ? '#059669' : '#6b7280'
                        }}>
                          {day.fullName}
                        </span>
                        <span style={{ fontSize: '13px', color: '#9ca3af', marginLeft: '8px' }}>
                          {formatDateWithDay(currentWeekStart, dayIndex)}
                        </span>
                      </div>
                      
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: (scheduleData.status === 'submitted' || !formStatus.canSubmit) ? 'not-allowed' : 'pointer'
                      }}>
                        <input
                          type="checkbox"
                          checked={daySchedule.available}
                          onChange={(e) => handleDayAvailabilityChange(day.key, e.target.checked)}
                          disabled={scheduleData.status === 'submitted' || !formStatus.canSubmit}
                          style={{ transform: 'scale(1.1)', accentColor: '#10b981' }}
                        />
                        <span style={{ 
                          fontSize: '16px', 
                          fontWeight: '500',
                          color: daySchedule.available ? '#059669' : '#6b7280'
                        }}>
                          가능
                        </span>
                      </label>
                    </div>

                    {/* 🔧 시간 범위 선택 */}
                    {daySchedule.available && (
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto 1fr',
                        gap: '12px',
                        alignItems: 'center'
                      }}>
                        {/* 시작 시간 */}
                        <div>
                          <label style={{
                            display: 'block',
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#374151',
                            marginBottom: '6px'
                          }}>
                            시작 시간
                          </label>
                          <select
                            value={daySchedule.startTime}
                            onChange={(e) => handleTimeChange(day.key, 'startTime', e.target.value)}
                            disabled={scheduleData.status === 'submitted' || !formStatus.canSubmit}
                            style={{
                              width: '100%',
                              padding: '12px',
                              border: '2px solid #e5e7eb',
                              borderRadius: '8px',
                              fontSize: '15px',
                              backgroundColor: 'white',
                              cursor: (scheduleData.status === 'submitted' || !formStatus.canSubmit) ? 'not-allowed' : 'pointer'
                            }}
                          >
                            {TIME_OPTIONS.slice(0, -1).map(time => (
                              <option key={time} value={time}>{time}</option>
                            ))}
                          </select>
                        </div>

                        <div style={{
                          fontSize: '20px',
                          fontWeight: 'bold',
                          color: '#6b7280',
                          textAlign: 'center',
                          marginTop: '20px'
                        }}>
                          ~
                        </div>

                        {/* 종료 시간 */}
                        <div>
                          <label style={{
                            display: 'block',
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#374151',
                            marginBottom: '6px'
                          }}>
                            종료 시간
                          </label>
                          <select
                            value={daySchedule.endTime}
                            onChange={(e) => handleTimeChange(day.key, 'endTime', e.target.value)}
                            disabled={scheduleData.status === 'submitted' || !formStatus.canSubmit}
                            style={{
                              width: '100%',
                              padding: '12px',
                              border: '2px solid #e5e7eb',
                              borderRadius: '8px',
                              fontSize: '15px',
                              backgroundColor: 'white',
                              cursor: (scheduleData.status === 'submitted' || !formStatus.canSubmit) ? 'not-allowed' : 'pointer'
                            }}
                          >
                            {TIME_OPTIONS.slice(1).map(time => (
                              <option key={time} value={time}>{time}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {/* 선택된 시간 범위 표시 */}
                    {daySchedule.available && (
                      <div style={{
                        marginTop: '12px',
                        padding: '12px',
                        backgroundColor: '#f0f9ff',
                        borderRadius: '8px',
                        fontSize: '15px',
                        fontWeight: '600',
                        textAlign: 'center',
                        color: '#0369a1',
                        border: '1px solid #0ea5e9'
                      }}>
                        📅 {daySchedule.startTime} ~ {daySchedule.endTime}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* 🔧 선택 현황 (일수 기반) */}
              <div style={{
                marginTop: '16px',
                padding: '16px',
                background: '#e0f2fe',
                borderRadius: '12px',
                textAlign: 'center'
              }}>
                <span style={{ fontSize: '16px', color: '#0369a1', fontWeight: '600' }}>
                  💼 총 {getTotalAvailableDays()}일 선택됨
                </span>
              </div>
            </div>
          )}

          {/* 전달사항 섹션 */}
          <div style={{
            background: 'white',
            padding: '16px',
            borderRadius: '12px',
            marginBottom: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            opacity: (scheduleData.status === 'submitted' || !formStatus.canSubmit) ? 0.7 : 1
          }}>
            <h3 style={{ 
              fontSize: '16px', 
              fontWeight: '600', 
              marginBottom: '12px',
              color: '#1e293b'
            }}>
              💬 전달사항
            </h3>
            <textarea
              value={scheduleData.message}
              onChange={(e) => setScheduleData(prev => ({ 
                ...prev, 
                message: e.target.value 
              }))}
              disabled={scheduleData.status === 'submitted' || !formStatus.canSubmit}
              placeholder="추가로 전달하고 싶은 내용이 있으면 여기에 작성해주세요..."
              style={{
                width: '100%',
                minHeight: '100px',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                resize: 'vertical',
                boxSizing: 'border-box',
                fontFamily: 'inherit'
              }}
            />
          </div>

          {/* 제출 버튼 */}
          {scheduleData.status !== 'submitted' && formStatus.canSubmit && (
            <div style={{ 
              position: 'sticky',
              bottom: '16px',
              display: 'flex',
              justifyContent: 'center',
              background: 'white',
              padding: '16px',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }}>
              <button
                onClick={submitSchedule}
                disabled={loading}
                style={{
                  width: '100%',
                  maxWidth: '300px',
                  padding: '16px',
                  background: loading ? '#9ca3af' : '#3b82f6',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '18px',
                  fontWeight: '700',
                  color: 'white',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
                  opacity: loading ? 0.7 : 1
                }}
              >
                {loading ? '제출중...' : '📤 스케줄 제출'}
              </button>
            </div>
          )}

          {/* 🔧 확인 모달 - 시간 범위 기반 */}
          {showConfirmModal && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '20px'
            }}>
              <div style={{
                background: 'white',
                padding: '24px',
                borderRadius: '16px',
                maxWidth: '500px',
                width: '100%',
                boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
                maxHeight: '80vh',
                overflow: 'auto'
              }}>
                <h3 style={{ 
                  fontSize: '20px', 
                  fontWeight: 'bold', 
                  marginBottom: '16px',
                  textAlign: 'center',
                  color: '#1e293b'
                }}>
                  🚀 최종 제출 확인
                </h3>
                
                <div style={{ 
                  background: '#f8fafc', 
                  padding: '16px', 
                  borderRadius: '8px',
                  marginBottom: '20px'
                }}>
                  {scheduleData.isAllUnavailable ? (
                    <>
                      <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#dc2626', fontWeight: '600' }}>
                        ⚠️ 해당 주 전체 근무 불가
                      </p>
                      <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#374151' }}>
                        <strong>사유:</strong> {scheduleData.unavailableReason}
                      </p>
                      <p style={{ margin: 0, fontSize: '14px', color: '#374151' }}>
                        <strong>근무 가능일:</strong> {new Date(scheduleData.availableStartDate).toLocaleDateString('ko-KR')}
                      </p>
                    </>
                  ) : (
                    <>
                      <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#374151', fontWeight: '600' }}>
                        📋 선택한 근무 가능 시간:
                      </p>
                      <div style={{
                        maxHeight: '200px',
                        overflowY: 'auto',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        padding: '8px',
                        background: 'white'
                      }}>
                        {getSelectedScheduleList().map((schedule, index) => (
                          <div key={index} style={{
                            fontSize: '13px',
                            color: '#374151',
                            padding: '4px 8px',
                            margin: '2px 0',
                            background: '#f3f4f6',
                            borderRadius: '4px',
                            borderLeft: '3px solid #3b82f6'
                          }}>
                            ✓ {schedule}
                          </div>
                        ))}
                      </div>
                      <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#6b7280', textAlign: 'center' }}>
                        총 <strong>{getTotalAvailableDays()}일</strong> 선택됨
                      </p>
                    </>
                  )}
                  
                  {scheduleData.message && (
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                      <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#374151', fontWeight: '600' }}>
                        💬 전달사항:
                      </p>
                      <p style={{ 
                        margin: '0', 
                        fontSize: '13px', 
                        color: '#374151',
                        background: 'white',
                        padding: '8px',
                        borderRadius: '4px',
                        border: '1px solid #e5e7eb'
                      }}>
                        {scheduleData.message}
                      </p>
                    </div>
                  )}
                </div>

                <p style={{ 
                  fontSize: '14px', 
                  color: '#64748b', 
                  textAlign: 'center',
                  marginBottom: '20px',
                  lineHeight: '1.5'
                }}>
                  제출 후에는 수정할 수 없습니다.<br />
                  정말로 제출하시겠습니까?
                </p>
                
                <div style={{ 
                  display: 'flex', 
                  gap: '12px',
                  justifyContent: 'center'
                }}>
                  <button
                    onClick={() => setShowConfirmModal(false)}
                    style={{
                      padding: '12px 24px',
                      background: '#f1f5f9',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    취소
                  </button>
                  
                  <button
                    onClick={confirmSubmit}
                    disabled={loading}
                    style={{
                      padding: '12px 24px',
                      background: loading ? '#9ca3af' : '#dc2626',
                      border: '1px solid #b91c1c',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: 'white',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      opacity: loading ? 0.7 : 1
                    }}
                  >
                    {loading ? '제출중...' : '최종 제출'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* CSS 애니메이션 */}
        <style jsx>{`
          @keyframes slideDown {
            from {
              transform: translateY(-100%);
              opacity: 0;
            }
            to {
              transform: translateY(0);
              opacity: 1;
            }
          }
        `}</style>

      </div> {/* ✅ 메인 컨테이너 닫기 */}
    </div>
  );
};

export default FreelancerWeeklySchedule;
