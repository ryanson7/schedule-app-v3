//src/pages/studio-schedules.tsx
"use client";
import { useEffect, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { SchedulePolicy } from "../utils/schedulePolicy";
import { useAuth } from '../contexts/AuthContext';

// 30분 단위 시간 옵션 생성
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

// 휴식시간 옵션 생성
const generateBreakTimeOptions = () => {
  const times = [];
  for (let hour = 9; hour < 22; hour++) {
    for (let min = 0; min < 60; min += 30) {
      const h = hour.toString().padStart(2, "0");
      const m = min.toString().padStart(2, "0");
      times.push(`${h}:${m}`);
    }
  }
  times.push('22:00');
  return times;
};

const breakTimeOptions = generateBreakTimeOptions();

// 휴식시간 범위 제한 옵션 생성
const generateBreakTimeOptionsInRange = (startTime: string, endTime: string) => {
  if (!startTime || !endTime) return breakTimeOptions;
  
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  
  return breakTimeOptions.filter(time => {
    const timeMinutes = timeToMinutes(time);
    return timeMinutes > startMinutes && timeMinutes < endMinutes;
  });
};

// 날짜 옵션 생성
const generateAvailableDates = (testDate?: string | null, devMode?: boolean) => {
  const baseToday = testDate ? new Date(testDate) : new Date();
  
  if (devMode) {
    const dates = [];
    for (let i = -30; i <= 90; i++) {
      const date = new Date(baseToday);
      date.setDate(baseToday.getDate() + i);
      
      const dateStr = date.toISOString().split('T')[0];
      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
      const dayName = dayNames[date.getDay()];
      const monthDay = `${date.getMonth() + 1}/${date.getDate()}`;
      
      dates.push({
        value: dateStr,
        label: `${monthDay}(${dayName})${i < 0 ? ' [과거]' : i === 0 ? ' [오늘]' : ''}`
      });
    }
    return dates;
  }
  
  const currentDay = baseToday.getDay();
  const daysUntilNextMonday = (8 - currentDay) % 7 || 7;
  const nextMonday = new Date(baseToday);
  nextMonday.setDate(baseToday.getDate() + daysUntilNextMonday);
  
  const availableDates = [];
  
  for (let i = 0; i < 14; i++) {
    const date = new Date(nextMonday);
    date.setDate(nextMonday.getDate() + i);
    
    const dateStr = date.toISOString().split('T')[0];
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const dayName = dayNames[date.getDay()];
    const monthDay = `${date.getMonth() + 1}/${date.getDate()}`;
    
    availableDates.push({
      value: dateStr,
      label: `${monthDay}(${dayName})`
    });
  }
  
  return availableDates;
};

// 모든 날짜 옵션 생성
const generateAllAvailableDates = (existingDate?: string, testDate?: string | null, devMode = false) => {
  const regularDates = generateAvailableDates(testDate, devMode);
  
  if (existingDate && !regularDates.find(d => d.value === existingDate)) {
    const date = new Date(existingDate);
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const dayName = dayNames[date.getDay()];
    const monthDay = `${date.getMonth() + 1}/${date.getDate()}`;
    
    const existingDateOption = {
      value: existingDate,
      label: `${monthDay}(${dayName}) - 기존 날짜`
    };
    
    return [existingDateOption, ...regularDates];
  }
  
  return regularDates;
};

// 개발 테스트 모드 체크
const isDevelopmentMode = () => {
  return process.env.NODE_ENV === 'development' || 
         localStorage.getItem('dev_mode') === 'true';
};

// 시간을 분으로 변환
const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const formatMinutesToTime = (totalMinutes: number): string => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

// 분을 시간으로 변환
const minutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

// 네이버웍스 메시지 보내기 함수
const sendNaverWorksMessage = async (
  messageType: 'register' | 'modify' | 'cancel' | 'contact',
  scheduleInfo?: any
) => {
  try {
    // ✔ 네이버웍스 알림용 정보는 localStorage 기반으로만 사용
    const legacyUserName  = localStorage.getItem('userName')  || '';
    const legacyUserEmail = localStorage.getItem('userEmail') || '';
    const userPhone       = localStorage.getItem('userPhone') || '';

    // 교수 이름: userName 우선, 없으면 이메일 앞부분, 그래도 없으면 '사용자'
    const professorName =
      legacyUserName ||
      (legacyUserEmail
        ? legacyUserEmail.split('@')[0]
        : '사용자');

    let message = '';
    const currentTime = new Date().toLocaleString('ko-KR');

    switch (messageType) {
      case 'register':
        message = `[스튜디오 촬영 등록 알림]\\n\\n교수명: ${professorName} 교수님\\n연락처: ${userPhone}\\n\\n강좌명: ${scheduleInfo?.courseName || '미입력'}\\n촬영일: ${scheduleInfo?.date}\\n촬영시간: ${scheduleInfo?.startTime} ~ ${scheduleInfo?.endTime}\\n촬영형식: ${scheduleInfo?.shootingType}${scheduleInfo?.breakTime ? `\\n휴식시간: ${scheduleInfo.breakTime}` : ''}${scheduleInfo?.notes ? `\\n전달사항: ${scheduleInfo.notes}` : ''}\\n\\n새로운 촬영 요청이 등록되었습니다.\\n\\n등록시간: ${currentTime}\\n---\\n에듀윌 스튜디오 촬영 시스템에서 발송`;
        break;
        
      case 'modify':
        message = `[스튜디오 촬영 수정 알림]\\n\\n교수명: ${professorName} 교수님\\n연락처: ${userPhone}\\n\\n강좌명: ${scheduleInfo?.courseName || '미입력'}\\n촬영일: ${scheduleInfo?.date}\\n촬영시간: ${scheduleInfo?.startTime} ~ ${scheduleInfo?.endTime}\\n촬영형식: ${scheduleInfo?.shootingType}${scheduleInfo?.breakTime ? `\\n휴식시간: ${scheduleInfo.breakTime}` : ''}${scheduleInfo?.notes ? `\\n전달사항: ${scheduleInfo.notes}` : ''}\\n\\n${scheduleInfo?.isDirectEdit ? '스케줄이 직접 수정되었습니다.' : '스케줄 수정 요청이 접수되었습니다.'}\\n\\n수정시간: ${currentTime}\\n---\\n에듀윌 스튜디오 촬영 시스템에서 발송`;
        break;
        
      case 'cancel':
        message = `[스튜디오 촬영 취소 알림]\\n\\n교수명: ${professorName} 교수님\\n연락처: ${userPhone}\\n\\n강좌명: ${scheduleInfo?.courseName || '미입력'}\\n촬영일: ${scheduleInfo?.date}\\n촬영시간: ${scheduleInfo?.startTime} ~ ${scheduleInfo?.endTime}${scheduleInfo?.cancelReason ? `\\n취소 사유: ${scheduleInfo.cancelReason}` : ''}\\n\\n${scheduleInfo?.isRevoke ? '취소 요청이 철회되었습니다.' : '촬영 취소가 요청되었습니다.'}\\n\\n처리시간: ${currentTime}\\n---\\n에듀윌 스튜디오 촬영 시스템에서 발송`;
        break;
        
      case 'contact':
        message = `[스튜디오 촬영 수정요청]\\n\\n교수명: ${professorName} 교수님\\n연락처: ${userPhone}\\n\\n강좌명: ${scheduleInfo?.courseName || '미입력'}\\n촬영일: ${scheduleInfo?.date}${scheduleInfo?.startTime && scheduleInfo?.endTime ? `\\n촬영시간: ${scheduleInfo.startTime} ~ ${scheduleInfo.endTime}` : ''}\\n\\n수정이 필요한 스케줄입니다. 확인 부탁드립니다.\\n\\n요청시간: ${currentTime}\\n---\\n에듀윌 스튜디오 촬영 시스템에서 발송`;
        break;
    }

    console.log('네이버웍스 메시지:', message);

    if (!message) {
      console.error('메시지 생성 실패');
      return;
    }

    try {
      await fetch('/api/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'professor_schedule',
          message: message
        })
      });
      console.log('교수 스케줄 메시지 발송 성공');
    } catch (messageError) {
      console.log('교수 스케줄 메시지 발송 실패:', messageError);
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(message);
        alert('메시지 전송에 실패했습니다.\\n메시지가 클립보드에 복사되었으니 직접 보내주세요.');
      }
    }
    
  } catch (error) {
    console.error('네이버웍스 메시지 전송 오류:', error);
  }
};


// 가장 빠른 30분 단위 슬롯 3개를 찾아줌
const findAvailableTimeSlots = (
  schedules: any[],
  compatibleStudioIds: number[],
  durationMinutes: number
) => {
  const workStart = 9 * 60;   
  const workEnd   = 22 * 60;  
  const suggestions: {start: string; end: string}[] = [];

  for (let t = workStart; t <= workEnd - durationMinutes; t += 30) {
    const slotStart = t;
    const slotEnd   = t + durationMinutes;

    const slotConflict = schedules.some(s => {
      if (!compatibleStudioIds.includes(s.sub_location_id)) return false;
      const sStart = timeToMinutes(s.start_time);
      const sEnd   = timeToMinutes(s.end_time);
      return (slotStart < sEnd) && (sStart < slotEnd);
    });

    if (!slotConflict) {
      suggestions.push({
        start: minutesToTime(slotStart),
        end  : minutesToTime(slotEnd)
      });
      if (suggestions.length === 3) break;
    }
  }
  return suggestions;
};

// 4시간 이상 촬영 시 휴식시간 권장 로직
const checkBreakTimeRecommendation = (
  startTime: string,
  endTime: string
): {
  shouldRecommend: boolean;
  reason: string;
  suggestedBreakTime?: {
    startTime: string;
    endTime: string;
    durationMinutes: number;
  };
} => {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  const durationMinutes = endMinutes - startMinutes;
  
  if (durationMinutes >= 240) { 
    if (startMinutes <= timeToMinutes('13:00') && endMinutes >= timeToMinutes('17:00')) {
      return {
        shouldRecommend: true,
        reason: '4시간 이상 촬영으로 휴식시간을 권장합니다',
        suggestedBreakTime: {
          startTime: '12:00',
          endTime: '13:00',
          durationMinutes: 60
        }
      };
    }
    
    if (startMinutes <= timeToMinutes('19:00') && endMinutes >= timeToMinutes('23:00')) {
      return {
        shouldRecommend: true,
        reason: '4시간 이상 촬영으로 휴식시간을 권장합니다',
        suggestedBreakTime: {
          startTime: '18:00',
          endTime: '19:00',
          durationMinutes: 60
        }
      };
    }
    
    const middleTime = startMinutes + Math.floor(durationMinutes / 2);
    const breakStart = minutesToTime(Math.max(middleTime - 30, startMinutes + 60));
    const breakEnd = minutesToTime(Math.min(middleTime + 30, endMinutes - 60));
    
    return {
      shouldRecommend: true,
      reason: '4시간 이상 촬영으로 휴식시간을 권장합니다',
      suggestedBreakTime: {
        startTime: breakStart,
        endTime: breakEnd,
        durationMinutes: 60
      }
    };
  }
  
  return {
    shouldRecommend: false,
    reason: '4시간 미만 촬영으로 휴식시간이 필수는 아닙니다'
  };
};

// 4시간 이상일 때만 휴식시간 설정 표시
const shouldShowBreakTimeSettings = (startTime: string, endTime: string): boolean => {
  if (!startTime || !endTime) return false;
  const durationMinutes = timeToMinutes(endTime) - timeToMinutes(startTime);
  return durationMinutes > 240;
};



interface StudioScheduleFormData {
  shoot_date: string;
  start_time: string;
  end_time: string;
  course_name: string;
  course_code: string;
  shooting_type: string;
  notes: string;
  break_time_enabled: boolean;
  break_start_time?: string;
  break_end_time?: string;
  break_duration_minutes: number;
  schedule_group_id?: string;
  is_split_schedule: boolean;
}

interface ShootingType {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
}

// 개발 테스트 모드 컴포넌트
const DevTestMode = ({ 
  onClose, 
  onDateSelect, 
  testDate 
}: { 
  onClose: () => void; 
  onDateSelect: (date: string) => void;
  testDate: string | null;
}) => {
  const [userDate, setUserDate] = useState(testDate || '');
  const [currentTime, setCurrentTime] = useState('');
  
  useEffect(() => {
    setUserDate(testDate || '');
  }, [testDate]);
  
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleString('ko-KR'));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div style={{
      position: 'fixed',
      top: 10,
      right: 10,
      backgroundColor: '#1f2937',
      color: 'white',
      borderRadius: '8px',
      padding: '12px',
      fontSize: '12px',
      zIndex: 1000,
      maxWidth: '320px',
      boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '8px'
      }}>
        <strong style={{ color: '#10b981' }}>개발 테스트 모드</strong>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          ×
        </button>
      </div>
      
      <div style={{ marginBottom: '8px', fontSize: '10px', color: '#9ca3af' }}>
        실제 시간: {currentTime}
      </div>
      
      <div style={{ marginBottom: '8px', fontSize: '10px', color: '#9ca3af' }}>
        현재 테스트 날짜: <strong>{testDate || '(미지정)'}</strong>
      </div>
      
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px' }}>
          테스트 날짜 설정:
        </label>
        <input
          type="date"
          value={userDate}
          onChange={(e) => setUserDate(e.target.value)}
          style={{
            width: '100%',
            padding: '4px',
            marginBottom: '6px',
            borderRadius: '4px',
            border: '1px solid #374151',
            backgroundColor: '#374151',
            color: 'white'
          }}
        />
        <button
          onClick={() => {
            if (userDate) {
              onDateSelect(userDate);
              alert(`테스트 날짜 ${userDate}로 설정됨`);
            }
          }}
          disabled={!userDate}
          style={{
            width: '100%',
            padding: '6px',
            backgroundColor: userDate ? '#10b981' : '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: userDate ? 'pointer' : 'not-allowed',
            fontSize: '11px'
          }}
        >
          날짜 적용
        </button>
      </div>
      
      <div style={{ fontSize: '10px', color: '#d1d5db', lineHeight: '1.4' }}>
        • Alt+Shift+D: 모드 토글<br/>
        • 과거/미래 모든 날짜 선택 가능<br/>
        • localStorage.dev_mode = 'true'<br/>
        • 정책 테스트 가능
      </div>
    </div>
  );
};

// ContactModal 컴포넌트
const ContactModal = ({ 
  open, 
  onClose, 
  scheduleInfo 
}: {
  open: boolean;
  onClose: () => void;
  scheduleInfo: {
    date: string;
    daysLeft: number;
    courseName: string;
    startTime?: string;
    endTime?: string;
  };
}) => {
  if (!open) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        width: '90vw',
        maxWidth: '400px',
        padding: 'clamp(16px, 5vw, 24px)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
      }}>
        <div style={{
          textAlign: 'center',
          marginBottom: '16px'
        }}>
          <h3 style={{ 
            margin: '0 0 8px 0', 
            fontSize: 'clamp(16px, 4vw, 18px)', 
            fontWeight: '600',
            color: '#1f2937'
          }}>
            수정요청 안내
          </h3>
        </div>

        <div style={{
          padding: '12px',
          backgroundColor: '#f1f5f9',
          borderRadius: '8px',
          marginBottom: '16px',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{
            fontSize: 'clamp(12px, 3vw, 14px)',
            color: '#475569',
            lineHeight: '1.5'
          }}>
            <strong>스케줄 정보:</strong><br/>
            • 강좌명: {scheduleInfo.courseName || '미입력'}<br/>
            • 촬영일: {scheduleInfo.date}<br/>
            {scheduleInfo.startTime && scheduleInfo.endTime && (
              <>• 촬영시간: {scheduleInfo.startTime} ~ {scheduleInfo.endTime}<br/></>
            )}
            <br/>
            <strong>촬영확정 또는 온라인 수정 기간이 종료되었습니다.</strong><br/>
            수정이 필요한 경우 아래 방법 중 하나를 선택해주세요.
          </div>
        </div>

        <div style={{
          display: 'grid',
          gap: '12px',
          marginBottom: '16px'
        }}>
          <button
            onClick={async () => {
              await sendNaverWorksMessage('contact', scheduleInfo);
              alert('담당자에게 연락 요청하였습니다.\n빠른 시일 내에 연락드리겠습니다.');
            }}
            style={{
              padding: 'clamp(12px, 3vw, 16px)',
              backgroundColor: '#00C851',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: 'clamp(14px, 3.5vw, 16px)',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            메시지로 연락 요청하기
          </button>
          
          <div style={{
            padding: '12px',
            backgroundColor: '#f8fafc',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: 'clamp(12px, 3vw, 14px)',
              color: '#475569',
              fontWeight: '500'
            }}>
              또는 직접 전화연락<br/>
              <strong style={{ fontSize: 'clamp(14px, 3.5vw, 16px)' }}>
                02-2650-3993
              </strong><br/>
              (평일 09:00 ~ 18:00)
            </div>
          </div>
        </div>

        <div style={{ 
          display: 'flex', 
          justifyContent: 'center' 
        }}>
          <button
            onClick={onClose}
            style={{
              padding: 'clamp(10px, 2.5vw, 12px) clamp(20px, 5vw, 24px)',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: '#6b7280',
              color: 'white',
              cursor: 'pointer',
              fontSize: 'clamp(14px, 3.5vw, 16px)',
              fontWeight: '500'
            }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

// 메인 컴포넌트
export default function StudioSchedulePage() {
  // 개발모드 + testDate 관리
  const [isDevModeActive, setIsDevModeActive] = useState(false);
  const [showDevMode, setShowDevMode] = useState(false);
  const [testDate, setTestDate] = useState<string | null>(null);
  
  const [userInfo, setUserInfo] = useState<any>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [showMyRequests, setShowMyRequests] = useState(false);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [totalRequestCount, setTotalRequestCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  
  const [shootingTypes, setShootingTypes] = useState<ShootingType[]>([]);
  const [compatibleStudios, setCompatibleStudios] = useState<any[]>([]);
  const [studioLocations, setStudioLocations] = useState<any[]>([]);
  const [shootingTypeMappings, setShootingTypeMappings] = useState<any[]>([]);
  const [availableDates, setAvailableDates] = useState<any[]>([]);
  const { user, signOut } = useAuth();
  
  const [searchFilters, setSearchFilters] = useState({
    start_date: '',
    end_date: '',
    limit: 10,
    offset: 0
  });
  const [isSearching, setIsSearching] = useState(false);
  
  // 제작센터 연락 모달 상태
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactScheduleInfo, setContactScheduleInfo] = useState({
    date: '',
    daysLeft: 0,
    courseName: '',
    startTime: '',
    endTime: ''
  });
  
  // 인라인 수정 상태
  const [editingSchedule, setEditingSchedule] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<StudioScheduleFormData>({
    shoot_date: '',
    start_time: '',
    end_time: '',
    course_name: '',
    course_code: '',
    shooting_type: '',
    notes: '',
    break_time_enabled: false,
    break_start_time: undefined,
    break_end_time: undefined,
    break_duration_minutes: 0,
    schedule_group_id: undefined,
    is_split_schedule: false
  });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editAvailableDates, setEditAvailableDates] = useState<any[]>([]);

  // 정책 상태 (2주 단위)
  const [registrationInfo, setRegistrationInfo] = useState({
    startDate: '',
    endDate: '',
    weekInfo: '',
    period: ''
  });
  const [editStatus, setEditStatus] = useState({
    canEdit: true,
    message: '',
    urgencyLevel: 'safe' as 'safe' | 'warning' | 'danger'
  });
  
  const [formData, setFormData] = useState<StudioScheduleFormData>({
    shoot_date: '',
    start_time: '',
    end_time: '',
    course_name: '',
    course_code: '',
    shooting_type: '',
    notes: '',
    break_time_enabled: false,
    break_start_time: undefined,
    break_end_time: undefined,
    break_duration_minutes: 0,
    schedule_group_id: undefined,
    is_split_schedule: false
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // 개발 모드 키보드 단축키 및 초기화 (Alt+Shift+D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        if (isDevelopmentMode()) {
          const newDevModeState = !isDevModeActive;
          setShowDevMode(newDevModeState);
          setIsDevModeActive(newDevModeState);
          localStorage.setItem('dev_mode', newDevModeState ? 'true' : 'false');
          
          if (!newDevModeState) {
            setTestDate(null);
          }
        }
      }
    };

    const devModeEnabled = localStorage.getItem('dev_mode') === 'true';
    setIsDevModeActive(devModeEnabled);
    setShowDevMode(devModeEnabled);

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDevModeActive]);

  // 개발모드, testDate 연동 가용일자 옵션
  useEffect(() => {
    setAvailableDates(generateAvailableDates(testDate, isDevModeActive));
  }, [isDevModeActive, testDate]);

  // 개발모드에서 날짜 바꾸면 폼 날짜 강제 반영
  useEffect(() => {
    if (testDate) {
      setFormData(prev => ({ ...prev, shoot_date: testDate }));
    }
  }, [testDate]);

  // testDate를 고려한 정책 정보 설정
  useEffect(() => {
    const baseToday = testDate ? new Date(testDate) : new Date();
    const currentDay = baseToday.getDay();
    
    const daysUntilNextMonday = (8 - currentDay) % 7 || 7;
    const nextMonday = new Date(baseToday);
    nextMonday.setDate(baseToday.getDate() + daysUntilNextMonday);
    
    const startDate = nextMonday.toISOString().split('T')[0];
    const endDate = new Date(nextMonday);
    endDate.setDate(nextMonday.getDate() + 13);
    const endDateStr = endDate.toISOString().split('T')[0];
    
    const startMonth = nextMonday.getMonth() + 1;
    const startDay = nextMonday.getDate();
    const endMonth = endDate.getMonth() + 1;
    const endDay = endDate.getDate();
    
    const regInfo = {
      startDate: startDate,
      endDate: endDateStr,
      weekInfo: `${startMonth}/${startDay} ~ ${endMonth}/${endDay}`,
      period: `${nextMonday.getFullYear()}년 ${startMonth}월 ${Math.ceil(startDay/7)}주차~${Math.ceil(endDay/7)}주차`
    };
    
    setRegistrationInfo(regInfo);

    const status = SchedulePolicy.getStatusMessage ? SchedulePolicy.getStatusMessage(testDate) : {
      canEdit: true,
      message: '수정 가능',
      urgencyLevel: 'safe',
      remainingTime: null
    };
    
    setEditStatus({
      canEdit: status.canEdit,
      message: status.message,
      urgencyLevel: status.urgencyLevel,
      remainingTime: status.remainingTime
    });
  }, [testDate, isDevModeActive]);

  useEffect(() => {
    fetchUserInfo();
    fetchShootingTypes();
    fetchStudioLocations();
    fetchShootingTypeMappings();
  }, []);

    useEffect(() => {
  // Supabase Auth 정보가 나중에 로딩될 수 있으므로,
  // user가 바뀔 때마다 사용자 정보 동기화
  fetchUserInfo();
}, [user]);


  useEffect(() => {
    if (userInfo && showMyRequests) {
      fetchMyRequests(false);
    }
  }, [userInfo, showMyRequests]);

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
      const fallbackTypes = ['PPT', '일반칠판', '전자칠판', '크로마키', 'PC와콤', 'PC'].map((name, index) => ({
        id: index + 1,
        name,
        description: name,
        is_active: true
      }));
      setShootingTypes(fallbackTypes);
    }
  };

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

  const fetchShootingTypeMappings = async () => {
    try {
      const { data, error } = await supabase
        .from('sub_location_shooting_types')
        .select(`
          *,
          shooting_types!inner(id, name, is_active),
          sub_locations(id, name)
        `)
        .eq('shooting_types.is_active', true);

      if (error) throw error;
      setShootingTypeMappings(data || []);
    } catch (error) {
      console.error('촬영형식 매핑 조회 오류:', error);
      setShootingTypeMappings([]);
    }
  };

  const fetchUserInfo = () => {
    console.log('fetchUserInfo 실행 - localStorage + Auth 병합');

    // 1) 예전에 쓰던 localStorage 값
    const storedRole  = localStorage.getItem('userRole')  || '';
    const storedName  = localStorage.getItem('userName')  || '';
    const storedEmail = localStorage.getItem('userEmail') || '';

    // 2) Supabase Auth 기반 값
    const authRole  = (user?.user_metadata?.role as string) || '';
    const authName  = (user?.user_metadata?.name as string) || '';
    const authEmail = user?.email || '';

    // 3) 최종 이름/이메일 결정
    //    👉 교수 스케줄 조회/저장에 쓰이는 이름은
    //       기존 DB에 들어간 값과 맞춰야 하므로
    //       localStorage 값을 최우선으로 사용
    const finalName =
      storedName ||
      authName ||
      (authEmail ? authEmail.split('@')[0] : '') ||
      '사용자';

    const finalEmail =
      storedEmail ||
      authEmail ||
      '';

    // 4) 역할 병합 (중복 제거)
    const extraRoles =
      ((user?.user_metadata?.roles as string[]) ?? []).filter(Boolean);

    const mergedRoles = [storedRole, authRole, ...extraRoles].filter(Boolean);
    const uniqueRoles = Array.from(new Set(mergedRoles));

    // 5) 정보가 정말 아무것도 없으면 초기화
    if (!finalName && !finalEmail) {
      console.log('로그인 정보 부족 - 사용자 정보 초기화');
      setUserInfo(null);
      setUserRoles([]);
      return;
    }

    const info = {
      id: user?.id ?? null,
      name: finalName,
      email: finalEmail,
    };

    setUserInfo(info);
    setUserRoles(uniqueRoles);

    console.log('사용자 정보 설정 완료:', {
      name: finalName,
      email: finalEmail,
      roles: uniqueRoles,
    });
  };


  const groupSplitSchedules = (schedules: any[]) => {
    const grouped = schedules.reduce((acc, schedule) => {
      if (schedule.schedule_group_id && !schedule.is_split_schedule) {
        schedule.schedule_group_id = null;
        schedule.sequence_order = 1;
      }
      
      if (schedule.schedule_group_id && schedule.is_split_schedule) {
        if (!acc[schedule.schedule_group_id]) {
          acc[schedule.schedule_group_id] = [];
        }
        acc[schedule.schedule_group_id].push(schedule);
      } else {
        acc[`single_${schedule.id}`] = [schedule];
      }
      return acc;
    }, {});

    return Object.values(grouped).map((group: any[]) => {
      if (group.length === 1) {
        return group[0];
      } else {
        const sortedGroup = group.sort((a, b) => a.sequence_order - b.sequence_order);
        const representative = { ...sortedGroup[0] };
        representative.start_time = sortedGroup[0].start_time;
        representative.end_time = sortedGroup[sortedGroup.length - 1].end_time;
        representative.grouped_schedules = sortedGroup;
        representative.is_grouped = true;
        
        return representative;
      }
    });
  };

const fetchMyRequests = async () => {
  if (!userInfo?.name) {
    console.log('❌ 사용자 정보 없음 - 조회 중단');
    return;
  }

  console.log('교수 스케줄 조회 시작:', userInfo.name);

  const { data, error } = await supabase
    .from('schedules')
    .select(`
      *,
      sub_locations!inner(id, name)
    `)
    .eq('professor_name', userInfo.name)
    .eq('schedule_type', 'studio')
    .eq('is_active', true)  // ✅ 활성화된 것만
    .is('parent_schedule_id', null)  // ✅ 원본만 조회 (분할 자식 제외)
    .order('shoot_date', { ascending: false })
    .order('start_time', { ascending: false });

  if (error) {
    console.error('스케줄 조회 오류:', error);
    return;
  }

  console.log('✅ 교수 화면 스케줄 조회:', data?.length, '건');
  setMyRequests(data || []);
};

  const handleSearch = () => {
    setSearchFilters(prev => ({ ...prev, offset: 0 }));
    fetchMyRequests(true);
  };

  const handleResetSearch = () => {
    setSearchFilters({
      start_date: '',
      end_date: '',
      limit: 10,
      offset: 0
    });
    fetchMyRequests(false);
  };

  const handleLoadMore = () => {
    const newOffset = searchFilters.offset + searchFilters.limit;
    setSearchFilters(prev => ({ ...prev, offset: newOffset }));
  };

  const checkScheduleConflictAndRecommend = async (
    formData: StudioScheduleFormData, 
    excludeScheduleId?: number,
    excludeGroupId?: string
  ) => {
    try {
      const { data: compatibleData, error: compatibleError } = await supabase
        .from('sub_location_shooting_types')
        .select(`
          sub_location_id,
          is_primary,
          sub_locations(id, name),
          shooting_types!inner(name)
        `)
        .eq('shooting_types.name', formData.shooting_type)
        .eq('shooting_types.is_active', true);

      if (compatibleError) throw compatibleError;

      const compatibleStudioIds = (compatibleData || []).map(item => item.sub_location_id);

      if (compatibleStudioIds.length === 0) {
        return {
          hasConflict: true,
          conflictMessage: `"${formData.shooting_type}" 촬영형식을 지원하는 스튜디오가 없습니다.\n\n다른 촬영형식을 선택해주세요.`,
          availableStudios: [],
          recommendedStudioId: null
        };
      }

      const { data: allSchedules, error } = await supabase
        .from('schedules')
        .select(`
          id, 
          start_time, 
          end_time, 
          sub_location_id, 
          schedule_group_id, 
          professor_name,
          course_name,
          shooting_type,
          sub_locations(name)
        `)
        .eq('shoot_date', formData.shoot_date)
        .eq('schedule_type', 'studio')  
        .eq('is_active', true)
        .in('approval_status', ['approved', 'confirmed', 'pending', 'approval_requested'])
        .in('sub_location_id', compatibleStudioIds);

      if (error) throw error;

      let filteredSchedules = allSchedules || [];
      
      if (excludeScheduleId) {
        filteredSchedules = filteredSchedules.filter(s => s.id !== excludeScheduleId);
      }
      
      if (excludeGroupId) {
        filteredSchedules = filteredSchedules.filter(s => s.schedule_group_id !== excludeGroupId);
      }

      const requestStartMinutes = timeToMinutes(formData.start_time);
      const requestEndMinutes = timeToMinutes(formData.end_time);
      
      const conflictingSchedules = filteredSchedules.filter(schedule => {
        const scheduleStartMinutes = timeToMinutes(schedule.start_time);
        const scheduleEndMinutes = timeToMinutes(schedule.end_time);
        
        const hasTimeOverlap = (requestStartMinutes < scheduleEndMinutes) && 
                               (scheduleStartMinutes < requestEndMinutes);
        
        return hasTimeOverlap;
      });

      const busyStudioIds = [...new Set(conflictingSchedules.map(s => s.sub_location_id))];
      const availableStudioIds = compatibleStudioIds.filter(id => !busyStudioIds.includes(id));

      const availableStudios = compatibleData.filter(item => 
        availableStudioIds.includes(item.sub_location_id)
      );

      if (availableStudios.length === 0) {
        const suggestions = findAvailableTimeSlots(
          filteredSchedules,
          compatibleStudioIds,
          requestEndMinutes - requestStartMinutes
        );

        const suggestionText = suggestions.length
          ? suggestions.map(s => `• ${s.start}~${s.end}`).join('\n')
          : '• (동일 날짜에 가능한 시간이 없습니다)';

        return {
          hasConflict: true,
          conflictMessage:
            '해당 시간대에는 모든 스튜디오가 예약돼 있습니다.\n\n' +
            '가능한 예시 시간:\n' +
            suggestionText + '\n\n' +
            '다른 시간대를 선택해주세요.',
          availableStudios: [],
          conflictingSchedules: [],
          recommendedStudioId: null
        };
      }

      const primaryStudios = availableStudios.filter(s => s.is_primary);
      const recommendedStudio = primaryStudios.length > 0 ? primaryStudios[0] : availableStudios[0];

      return {
        hasConflict: false,
        availableStudios,
        recommendedStudio,
        recommendedStudioId: recommendedStudio.sub_location_id,
        recommendedStudioName: recommendedStudio.sub_locations?.name || `${recommendedStudio.sub_location_id}번`,
        alternativeStudios: availableStudios.slice(1),
        conflictingSchedules: []
      };

    } catch (error) {
      console.error('스케줄 충돌 검사 오류:', error);
      return {
        hasConflict: true,
        conflictMessage: '충돌 검사 중 오류가 발생했습니다. 다시 시도해주세요.',
        availableStudios: [],
        recommendedStudioId: null
      };
    }
  };

  const findAvailableStudio = async (shootingTypeName: string, date: string, startTime: string, endTime: string) => {
    try {
      const { data: compatibleData, error: compatibleError } = await supabase
        .from('sub_location_shooting_types')
        .select(`
          sub_location_id,
          is_primary,
          shooting_types!inner(name)
        `)
        .eq('shooting_types.name', shootingTypeName)
        .eq('shooting_types.is_active', true);

      if (compatibleError) throw compatibleError;

      const compatibleStudioIds = compatibleData?.map(item => item.sub_location_id) || [];
      
      const { data: bookedData, error: bookedError } = await supabase
        .from('schedules')
        .select('sub_location_id')
        .eq('shoot_date', date)
        .eq('is_active', true)
        .or(`and(start_time.lte.${startTime},end_time.gt.${startTime}),and(start_time.lt.${endTime},end_time.gte.${endTime}),and(start_time.gte.${startTime},end_time.lte.${endTime})`);

      if (bookedError) throw bookedError;

      const bookedStudioIds = bookedData?.map(item => item.sub_location_id) || [];
      const availableStudioIds = compatibleStudioIds.filter(id => !bookedStudioIds.includes(id));
      
      if (availableStudioIds.length > 0) {
        const primaryStudio = compatibleData?.find(item => 
          item.is_primary && availableStudioIds.includes(item.sub_location_id)
        );
        
        return primaryStudio ? primaryStudio.sub_location_id : availableStudioIds[0];
      }
      
      return compatibleStudioIds.length > 0 ? compatibleStudioIds[0] : null;
      
    } catch (error) {
      console.error('사용 가능한 스튜디오 조회 오류:', error);
      return null;
    }
  };

  const isPastSchedule = (scheduleDate: string): boolean => {
    const baseToday = testDate ? new Date(testDate) : new Date();
    const schedule = new Date(scheduleDate);
    return schedule < baseToday;
  };

  const isCancelledSchedule = (schedule: any): boolean => {
    return schedule.approval_status === 'cancelled' || 
          (schedule.is_active === false && schedule.deletion_reason !== 'split_converted');
  };

  const submitCancelRequest = async (schedule: any) => {
    console.log('취소 요청 시작:', schedule);

    const cancelReason = prompt(
      `취소 사유를 입력해주세요:\n\n` +
      `강좌명: ${schedule.course_name || '미입력'}\n` +
      `촬영일: ${schedule.shoot_date}\n` +
      `시간: ${schedule.start_time?.substring(0, 5)}~${schedule.end_time?.substring(0, 5)}\n\n` +
      `취소 사유:`,
      ''
    );

    if (cancelReason === null) {
      console.log('사용자가 취소 사유 입력을 취소했습니다.');
      return;
    }

    if (!cancelReason.trim()) {
      alert('취소 사유를 입력해주세요.');
      return;
    }

    const confirmCancel = confirm(
      `정말로 취소를 요청하시겠습니까?\n\n` +
      `강좌명: ${schedule.course_name || '미입력'}\n` +
      `촬영일: ${schedule.shoot_date}\n` +
      `시간: ${schedule.start_time?.substring(0, 5)}~${schedule.end_time?.substring(0, 5)}\n` +
      `취소 사유: ${cancelReason}\n\n` +
      `취소 요청 후에는 관리자 승인이 필요합니다.`
    );

    if (!confirmCancel) {
      console.log('사용자가 취소 확인을 거부했습니다.');
      return;
    }

    try {
      console.log('데이터베이스 업데이트 시작...');

      const { error } = 
        await supabase.from('schedules').update({
          approval_status: 'cancelled',
          cancellation_reason: cancelReason,            // ← 취소사유 명확히!
          cancelled_by: userInfo.id,                    // ← 누가 취소했는지
          updated_at: new Date().toISOString(),
          updated_by: userInfo.id
        }).eq('id', schedule.id);

      if (error) {
        console.error('메인 스케줄 업데이트 오류:', error);
        throw error;
      }

      console.log('메인 스케줄 상태 업데이트 완료');

      if (schedule.grouped_schedules && schedule.grouped_schedules.length > 1) {
        console.log('그룹 스케줄 업데이트 시작...', schedule.grouped_schedules.length, '개');
        
        const groupUpdatePromises = schedule.grouped_schedules.map((subSchedule, index) => {
          console.log(`그룹 스케줄 ${index + 1} 업데이트 중...`, subSchedule.id);
          return supabase
            .from('schedules')
            .update({
              approval_status: 'cancellation_requested',
              notes: subSchedule.notes ? `${subSchedule.notes}\n\n[취소사유: ${cancelReason}]` : `[취소사유: ${cancelReason}]`,
              updated_at: new Date().toISOString()
            })
            .eq('id', subSchedule.id);
        });
        
        const groupResults = await Promise.all(groupUpdatePromises);
        
        groupResults.forEach((result, index) => {
          if (result.error) {
            console.error(`그룹 스케줄 ${index + 1} 업데이트 오류:`, result.error);
          } else {
            console.log(`그룹 스케줄 ${index + 1} 업데이트 완료`);
          }
        });
      }

      console.log('메시지 발송 시작...');

      await sendNaverWorksMessage('cancel', {
        courseName: schedule.course_name,
        date: schedule.shoot_date,
        startTime: schedule.start_time?.substring(0, 5),
        endTime: schedule.end_time?.substring(0, 5),
        cancelReason: cancelReason,
        isRevoke: false
      });

      console.log('메시지 발송 완료');

      alert(`취소 요청이 완료되었습니다.\n\n취소 사유: ${cancelReason}\n\n관리자 검토 후 처리됩니다.`);
      
      console.log('목록 새로고침 시작...');

      await fetchMyRequests(false);
      
      console.log('취소 요청 전체 프로세스 완료!');

    } catch (error) {
      console.error('취소 요청 전체 프로세스 오류:', error);
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다';
      alert(`취소 요청 실패: ${errorMessage}`);
    }
  };

  const submitCancelRevoke = async (schedule: any) => {
    const confirmRevoke = confirm(
      `취소 요청을 철회하시겠습니까?\n\n` +
      `강좌명: ${schedule.course_name || '미입력'}\n` +
      `촬영일: ${schedule.shoot_date}`
    );

    if (!confirmRevoke) return;

    try {
      const originalStatus = schedule.approval_status === 'cancellation_requested' ? 'pending' : schedule.approval_status;
      
      const { error } = await supabase
        .from('schedules')
        .update({
          approval_status: originalStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', schedule.id);

      if (error) throw error;

      if (schedule.grouped_schedules && schedule.grouped_schedules.length > 1) {
        const groupUpdatePromises = schedule.grouped_schedules.map(subSchedule => 
          supabase
            .from('schedules')
            .update({
              approval_status: originalStatus,
              updated_at: new Date().toISOString()
            })
            .eq('id', subSchedule.id)
        );
        
        await Promise.all(groupUpdatePromises);
      }

      alert('취소 요청이 철회되었습니다.');
      
      await sendNaverWorksMessage('cancel', {
        courseName: schedule.course_name,
        date: schedule.shoot_date,
        startTime: schedule.start_time?.substring(0, 5),
        endTime: schedule.end_time?.substring(0, 5),
        isRevoke: true
      });
      
      await fetchMyRequests(false);

    } catch (error) {
      console.error('취소 철회 오류:', error);
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다';
      alert(`취소 철회 실패: ${errorMessage}`);
    }
  };

  const startEditSchedule = (schedule: any) => {
    // ✅ 올바른 메서드 사용
    const policy = SchedulePolicy.checkScheduleEditPolicy
      ? SchedulePolicy.checkScheduleEditPolicy(schedule.shoot_date, testDate)
      : { needsContact: false, canDirectEdit: true };

    // ✅ 분할된 스케줄이면 needsContact = true로 변경 (수정요청 버튼 표시)
    if (schedule.deletion_reason === 'split_converted') {
      policy.needsContact = true;
      policy.canDirectEdit = false;
    }

    // 수정 가능 → 인라인 수정 진입
    setEditingSchedule(schedule.id);
    setEditFormData({
      shoot_date: schedule.shoot_date,
      start_time: schedule.start_time?.substring(0, 5) || '',
      end_time: schedule.end_time?.substring(0, 5) || '',
      course_name: schedule.course_name || '',
      course_code: schedule.course_code || '',
      shooting_type: schedule.shooting_type || '',
      notes: schedule.notes || '',
      break_time_enabled: schedule.break_time_enabled || false,
      break_start_time: schedule.break_start_time?.substring(0, 5),
      break_end_time: schedule.break_end_time?.substring(0, 5),
      break_duration_minutes: schedule.break_duration_minutes || 0,
      schedule_group_id: schedule.schedule_group_id,
      is_split_schedule: schedule.is_split_schedule || false
    });

    setEditAvailableDates(
      generateAllAvailableDates(schedule.shoot_date, testDate, isDevModeActive)
    );
  };




  const handleEditTimeChange = (field: 'start_time' | 'end_time', value: string, newFormData: any) => {
    console.log('수정 폼 시간 변경:', { field, value, newFormData });
    
    if (newFormData.start_time && newFormData.end_time) {
      const startMinutes = timeToMinutes(newFormData.start_time);
      const endMinutes = timeToMinutes(newFormData.end_time);
      const durationMinutes = endMinutes - startMinutes;
      
      console.log('촬영 시간 계산:', { 
        시작: newFormData.start_time, 
        종료: newFormData.end_time, 
        총분: durationMinutes, 
        총시간: Math.floor(durationMinutes / 60) + '시간 ' + (durationMinutes % 60) + '분'
      });
      
      if (durationMinutes > 240 && !editFormData.break_time_enabled) {
        const hours = Math.floor(durationMinutes / 60);
        const minutes = durationMinutes % 60;
        const durationText = minutes > 0 ? `${hours}시간 ${minutes}분` : `${hours}시간`;
        
        const useBreakTime = window.confirm(
          `촬영 시간이 ${durationText}으로 4시간을 초과합니다.\n\n` +
          `장시간 촬영으로 휴식시간 설정을 권장합니다.\n\n` +
          `휴식시간을 설정하시겠습니까?\n\n` +
          `확인: 휴식시간 설정 화면으로\n` +
          `취소: 휴식시간 없이 진행`
        );
        
        if (useBreakTime) {
          console.log('휴식시간 설정 선택됨');
          
          setEditFormData(prev => ({
            ...prev,
            [field]: value,
            break_time_enabled: true,
            break_start_time: '',
            break_end_time: '',
            break_duration_minutes: 0
          }));
          
          alert('휴식시간 설정이 활성화되었습니다.\n아래에서 원하는 시간을 선택해주세요.');
          
        } else {
          console.log('휴식시간 없이 진행 선택됨');
          setEditFormData(prev => ({ ...prev, [field]: value }));
        }
        return;
      }
      
      if (durationMinutes <= 240 && editFormData.break_time_enabled) {
        const removeBreakTime = window.confirm(
          `촬영 시간이 4시간 이하로 줄어들었습니다.\n\n` +
          `휴식시간 설정을 해제하시겠습니까?\n\n` +
          `확인: 휴식시간 해제\n` +
          `취소: 휴식시간 유지`
        );
        
        if (removeBreakTime) {
          console.log('휴식시간 해제 선택됨');
          setEditFormData(prev => ({
            ...prev,
            [field]: value,
            break_time_enabled: false,
            break_start_time: undefined,
            break_end_time: undefined,
            break_duration_minutes: 0
          }));
          
          alert('휴식시간이 해제되었습니다.');
          
        } else {
          console.log('휴식시간 유지 선택됨');
          setEditFormData(prev => ({ ...prev, [field]: value }));
        }
        return;
      }
    }

    setEditFormData(prev => ({ ...prev, [field]: value }));
  };

  const cancelEditSchedule = () => {
    setEditingSchedule(null);
    setEditFormData({
      shoot_date: '',
      start_time: '',
      end_time: '',
      course_name: '',
      course_code: '',
      shooting_type: '',
      notes: '',
      break_time_enabled: false,
      break_start_time: undefined,
      break_end_time: undefined,
      break_duration_minutes: 0,
      schedule_group_id: undefined,
      is_split_schedule: false
    });
    setEditAvailableDates([]);
  };

  const saveEditedSchedule = async (originalSchedule: any) => {
    console.log('수정 저장 시작:', { originalSchedule, editFormData });

    if (!editFormData.shoot_date || !editFormData.start_time || !editFormData.end_time || !editFormData.shooting_type) {
      alert('필수 항목을 모두 입력해주세요.');
      return;
    }

    if (editFormData.start_time >= editFormData.end_time) {
      alert('종료 시간은 시작 시간보다 늦어야 합니다.');
      return;
    }

    try {
      const updateData = {
        shoot_date: editFormData.shoot_date,
        start_time: editFormData.start_time + ':00',
        end_time: editFormData.end_time + ':00',
        course_name: editFormData.course_name || '',
        course_code: editFormData.course_code || '',
        shooting_type: editFormData.shooting_type,
        notes: editFormData.notes || '',
        break_time_enabled: editFormData.break_time_enabled,
        break_start_time: editFormData.break_time_enabled ? editFormData.break_start_time + ':00' : null,
        break_end_time: editFormData.break_time_enabled ? editFormData.break_end_time + ':00' : null,
        break_duration_minutes: editFormData.break_duration_minutes || 0,
        approval_status: 'pending',
        updated_at: new Date().toISOString()
      };

      console.log('데이터베이스 업데이트 시작...', updateData);

      const { error: mainError } = await supabase
        .from('schedules')
        .update(updateData)
        .eq('id', originalSchedule.id);

      if (mainError) {
        console.error('메인 스케줄 업데이트 오류:', mainError);
        throw mainError;
      }

      console.log('메인 스케줄 업데이트 완료');

      if (originalSchedule.grouped_schedules && originalSchedule.grouped_schedules.length > 1) {
        console.log('그룹 스케줄 업데이트 시작...', originalSchedule.grouped_schedules.length, '개');
        
        const groupUpdatePromises = originalSchedule.grouped_schedules.map((subSchedule, index) => {
          console.log(`그룹 스케줄 ${index + 1} 업데이트 중...`, subSchedule.id);
          
          let subUpdateData = { ...updateData };
          
          if (editFormData.break_time_enabled && index === 0) {
            subUpdateData.end_time = editFormData.break_start_time + ':00';
          } else if (editFormData.break_time_enabled && index === 1) {
            subUpdateData.start_time = editFormData.break_end_time + ':00';
          }
          
          return supabase
            .from('schedules')
            .update(subUpdateData)
            .eq('id', subSchedule.id);
        });
        
        const groupResults = await Promise.all(groupUpdatePromises);
        
        groupResults.forEach((result, index) => {
          if (result.error) {
            console.error(`그룹 스케줄 ${index + 1} 업데이트 오류:`, result.error);
          } else {
            console.log(`그룹 스케줄 ${index + 1} 업데이트 완료`);
          }
        });
      }

      console.log('수정 알림 메시지 발송 시작...');
      
      await sendNaverWorksMessage('modify', {
        courseName: editFormData.course_name,
        date: editFormData.shoot_date,
        startTime: editFormData.start_time,
        endTime: editFormData.end_time,
        shootingType: editFormData.shooting_type,
        breakTime: editFormData.break_time_enabled ? 
          `${editFormData.break_start_time} ~ ${editFormData.break_end_time} (${editFormData.break_duration_minutes}분)` : '',
        notes: editFormData.notes,
        isDirectEdit: true
      });

      console.log('수정 알림 메시지 발송 완료');

      alert(`수정이 완료되었습니다!\n\n변경사항:\n• 날짜: ${editFormData.shoot_date}\n• 시간: ${editFormData.start_time}~${editFormData.end_time}\n• 강좌: ${editFormData.course_name}\n• 형식: ${editFormData.shooting_type}\n\n재승인 요청되었습니다.`);
      
      cancelEditSchedule();
      
      console.log('목록 새로고침 시작...');

      await fetchMyRequests(false);
      
      console.log('수정 저장 전체 프로세스 완료!');

    } catch (error) {
      console.error('수정 저장 오류:', error);
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다';
      alert(`수정 저장 실패: ${errorMessage}`);
    }
  };

  const createScheduleGroup = async (formData: StudioScheduleFormData) => {
    try {
      const schedules = [];
      const groupId = `${userInfo.name}_${formData.shoot_date}_${Date.now()}`;
      
      if (formData.break_time_enabled && formData.break_start_time && formData.break_end_time) {
        const validStudioId = await findAvailableStudio(
          formData.shooting_type, 
          formData.shoot_date, 
          formData.start_time, 
          formData.end_time
        );
        
        const schedule1 = {
          shoot_date: formData.shoot_date,
          start_time: formData.start_time,
          end_time: formData.break_start_time,
          professor_name: userInfo.name,
          course_name: formData.course_name,
          course_code: formData.course_code,
          shooting_type: formData.shooting_type,
          notes: formData.notes || '',
          schedule_group_id: groupId,
          sequence_order: 1,
          is_split_schedule: true,
          break_time_enabled: true,
          break_start_time: formData.break_start_time,
          break_end_time: formData.break_end_time,
          break_duration_minutes: formData.break_duration_minutes,
          schedule_type: 'studio',
          approval_status: 'pending',
          team_id: 1,
          sub_location_id: validStudioId,
          is_active: true
        };
        
        const schedule2 = {
          shoot_date: formData.shoot_date,
          start_time: formData.break_end_time,
          end_time: formData.end_time,
          professor_name: userInfo.name,
          course_name: formData.course_name,
          course_code: formData.course_code,
          shooting_type: formData.shooting_type,
          notes: formData.notes || '',
          schedule_group_id: groupId,
          sequence_order: 2,
          is_split_schedule: true,
          break_time_enabled: true,
          break_start_time: formData.break_start_time,
          break_end_time: formData.break_end_time,
          break_duration_minutes: formData.break_duration_minutes,
          schedule_type: 'studio',
          approval_status: 'pending',
          team_id: 1,
          sub_location_id: validStudioId,
          is_active: true
        };
        
        schedules.push(schedule1, schedule2);
      } else {
        const validStudioId = await findAvailableStudio(
          formData.shooting_type, 
          formData.shoot_date, 
          formData.start_time, 
          formData.end_time
        );
        
        const schedule = {
          shoot_date: formData.shoot_date,
          start_time: formData.start_time,
          end_time: formData.end_time,
          professor_name: userInfo.name,
          course_name: formData.course_name,
          course_code: formData.course_code,
          shooting_type: formData.shooting_type,
          notes: formData.notes || '',
          schedule_group_id: groupId,
          sequence_order: 1,
          is_split_schedule: false,
          break_time_enabled: false,
          break_start_time: null,
          break_end_time: null,
          break_duration_minutes: 0,
          schedule_type: 'studio',
          approval_status: 'pending',
          team_id: 1,
          sub_location_id: validStudioId,
          is_active: true
        };
        
        schedules.push(schedule);
      }

      console.log('삽입할 스케줄 데이터:', schedules);

      const { data: scheduleResults, error } = await supabase
        .from('schedules')
        .insert(schedules)
        .select();

      if (error) throw error;

      console.log('스케줄 삽입 결과:', scheduleResults);

      return {
        success: true,
        message: '스케줄이 등록되었습니다',
        scheduleCount: scheduleResults?.length ?? 0,
        // 🔥 여기 추가: 실제로 삽입된 스케줄 row 들
        schedules: scheduleResults ?? [],
      };



    } catch (error) {
      console.error('스케줄 그룹 생성 오류:', error);
      throw error;
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.shoot_date) {
      newErrors.shoot_date = '촬영 날짜를 선택해주세요';
    }

    if (!formData.start_time) {
      newErrors.start_time = '시작 시간을 선택해주세요';
    }

    if (!formData.end_time) {
      newErrors.end_time = '종료 시간을 선택해주세요';
    }

    if (formData.start_time && formData.end_time && formData.start_time >= formData.end_time) {
      newErrors.end_time = '종료 시간은 시작 시간보다 늦어야 합니다';
    }

    if (!formData.shooting_type) {
      newErrors.shooting_type = '촬영 형식을 반드시 선택해주세요';
    }

    if (formData.break_time_enabled) {
      if (!formData.break_start_time) {
        newErrors.break_start_time = '휴식 시작 시간을 설정해주세요';
      }
      if (!formData.break_end_time) {
        newErrors.break_end_time = '휴식 종료 시간을 설정해주세요';
      }
      if (formData.break_start_time && formData.break_end_time && formData.break_start_time >= formData.break_end_time) {
        newErrors.break_end_time = '휴식 종료 시간은 시작 시간보다 늦어야 합니다';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFormTimeChange = (field: 'start_time' | 'end_time', value: string) => {
    const newFormData = { ...formData, [field]: value };
    
    if (newFormData.start_time && newFormData.end_time) {
      const startMinutes = timeToMinutes(newFormData.start_time);
      const endMinutes = timeToMinutes(newFormData.end_time);
      const durationMinutes = endMinutes - startMinutes;
      
      if (durationMinutes > 240 && !formData.break_time_enabled) {
        const hours = Math.floor(durationMinutes / 60);
        const minutes = durationMinutes % 60;
        const durationText = minutes > 0 ? `${hours}시간 ${minutes}분` : `${hours}시간`;
        
        const useBreakTime = window.confirm(
          `촬영 시간이 ${durationText}으로 4시간을 초과합니다.\n\n` +
          `휴식시간을 설정하시겠습니까?\n\n` +
          `확인: 휴식시간 설정 화면으로\n` +
          `취소: 휴식시간 없이 진행`
        );
        
        if (useBreakTime) {
          alert('휴식시간을 설정하세요.');
          const recommendation = checkBreakTimeRecommendation(newFormData.start_time, newFormData.end_time);
          
          const defaultStartTime = recommendation.suggestedBreakTime?.startTime || '12:00';
          const defaultEndTime = recommendation.suggestedBreakTime?.endTime || '13:00';
          const defaultDuration = timeToMinutes(defaultEndTime) - timeToMinutes(defaultStartTime);
          
          setFormData(prev => ({
            ...prev,
            [field]: value,
            break_time_enabled: true,
            break_start_time: defaultStartTime,
            break_end_time: defaultEndTime,
            break_duration_minutes: Math.max(0, defaultDuration)
          }));
        } else {
          setFormData(prev => ({ ...prev, [field]: value }));
        }
        return;
      }
      
      if (durationMinutes <= 240 && formData.break_time_enabled) {
        const removeBreakTime = window.confirm(
          `촬영 시간이 4시간 이하로 줄어들었습니다.\n\n` +
          `휴식시간 설정을 해제하시겠습니까?`
        );
        
        if (removeBreakTime) {
          setFormData(prev => ({
            ...prev,
            [field]: value,
            break_time_enabled: false,
            break_start_time: undefined,
            break_end_time: undefined,
            break_duration_minutes: 0
          }));
        } else {
          setFormData(prev => ({ ...prev, [field]: value }));
        }
        return;
      }
    }
    
    setFormData(prev => ({ ...prev, [field]: value }));
  };

const submitShootingRequest = async () => {
  if (!validateForm()) {
    alert('필수 항목을 입력해주세요');
    return;
  }

  try {
    // 0. 사용자 정보
    const professorName = localStorage.getItem('userName') || formData.professorname;
    const professorEmail = localStorage.getItem('userEmail');

    // 1. professorCategoryId 조회
    const rawNumericId = localStorage.getItem('userNumericId') || localStorage.getItem('userId');
    const professorNumericId = rawNumericId ? parseInt(rawNumericId, 10) : null;

    let professorCategoryId: number | null = null;
    let professorCategoryName: string | undefined;

    if (professorNumericId) {
    const { data: professorRow, error: professorError } = await supabase
      .from('professors')
      .select('user_id, professor_category_id')
      .eq('user_id', professorNumericId)
      .maybeSingle();

    if (professorError) {
      console.warn('⚠️ 교수 정보 조회 실패:', professorError);
    } else if (professorRow?.professor_category_id) {
      professorCategoryId = professorRow.professor_category_id;
      
      // ✅ 컬럼명 수정: category_name
      const { data: categoryRow } = await supabase
        .from('professor_categories')
        .select('category_name')  // ← categoryname에서 변경
        .eq('id', professorCategoryId)
        .single();
      
      if (categoryRow) {
        professorCategoryName = categoryRow.category_name;  // ← 이것도 변경
      }
    }
  }


    // 3. 스케줄 데이터 준비
    const scheduleData = {
      ...formData,
      professorname: professorName,
      professorid: professorNumericId,
      professorcategoryid: professorCategoryId,
      professorcategoryname: professorCategoryName,
      professoritems: [],
      createdby: professorName,
      createdbyemail: professorEmail,
      createdbyrole: 'professor',
      handler: professorName,
      handleremail: professorEmail,
      handlerrole: 'professor',
      status: 'pending',
    };

    console.log('📝 스케줄 데이터:', scheduleData);

    // 4. 스케줄 생성
    const result = await createScheduleGroup(scheduleData);
    console.log('✅ 스케줄 생성 결과:', result);

    // 5. schedule_history 저장 (✅ 실제 DB 스키마: old_value / new_value / changed_by / description)
    // ⚠️ 여기에서 cancelReason(취소 사유)를 참조하면 교수 등록 시 ReferenceError가 발생함.
    // 신규 등록은 "created"로 기록하고, new_value에 생성된 스케줄 스냅샷만 저장.
    if (result.success && result.schedules) {
      const createdByRole = localStorage.getItem('userRole');
      const isAdminCreated = ['schedule_admin', 'system_admin', 'studio_admin'].includes(createdByRole || '');
      const now = new Date().toISOString();

      for (const schedule of result.schedules) {
        const newValueObj = {
          id: schedule.id,
          shoot_date: schedule.shoot_date,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          shooting_type: schedule.shooting_type,
          professor_name: schedule.professor_name,
          course_name: schedule.course_name || null,
          course_code: schedule.course_code || null,
          approval_status: schedule.approval_status || 'pending',
          notes: schedule.notes || null,
          schedule_group_id: schedule.schedule_group_id || null,
          sub_location_id: schedule.sub_location_id || null,
          is_split_schedule: schedule.is_split_schedule ?? null,
          break_time_enabled: schedule.break_time_enabled ?? null,
          break_start_time: schedule.break_start_time || null,
          break_end_time: schedule.break_end_time || null,
          break_duration_minutes: schedule.break_duration_minutes ?? null,
          is_active: schedule.is_active ?? null,
        };

        const { error: historyError } = await supabase.from('schedule_history').insert({
          schedule_id: schedule.id,
          change_type: 'created',
          changed_by: userInfo.id,
          description: isAdminCreated ? '관리자 등록' : '교수 촬영 신청',
          old_value: null,
          new_value: JSON.stringify(newValueObj),
          created_at: now,
          changed_at: now,
        });

        if (historyError) console.error('❌ History 저장 실패:', historyError);
      }
    }


    // 6. 메시지 전송
    await sendNaverWorksMessage('register', {
      courseName: scheduleData.course_name,
      date: scheduleData.shoot_date,
      startTime: scheduleData.start_time,
      endTime: scheduleData.end_time,
      shootingType: scheduleData.shooting_type,
      breakTime: scheduleData.break_time_enabled
        ? `${scheduleData.break_start_time}-${scheduleData.break_end_time} (${scheduleData.break_duration_minutes}분)`
        : '',
      notes: scheduleData.notes,
    });

    alert(result.message);

    // 7. 폼 초기화
    resetForm();
    if (showMyRequests) {
      fetchMyRequests(false);
    }
  } catch (error) {
    console.error('❌ 촬영 신청 오류:', error);
    const errorMessage = error instanceof Error ? error.message : '촬영 신청 중 오류가 발생했습니다';
    alert(errorMessage);
  }
};



  const resetForm = () => {
    setFormData({
      shoot_date: '',
      start_time: '',
      end_time: '',
      course_name: '',
      course_code: '',
      shooting_type: userInfo?.preferred_shooting_type || '',
      notes: '',
      break_time_enabled: false,
      break_start_time: undefined,
      break_end_time: undefined,
      break_duration_minutes: 0,
      schedule_group_id: undefined,
      is_split_schedule: false
    });
    setErrors({});
    setCompatibleStudios([]);
  };

  const getStatusInfo = (status: string, hasModificationRequest: boolean = false, isActive: boolean = true) => {
    if (!isActive) {
      return { bg: '#f5f5f5', color: '#6c757d', text: '취소완료' };
    }
    
    switch (status) {
      case 'approved':
        return { bg: '#e3f2fd', color: '#1976d2', text: '촬영확정' };
      case 'pending':
        return hasModificationRequest 
          ? { bg: '#fef3c7', color: '#92400e', text: '수정확인 중' }
          : { bg: '#f5f5f5', color: '#616161', text: '검토중' };
      case 'cancelled':
        return { bg: '#ffebee', color: '#d32f2f', text: '취소완료' };
      case 'modification_requested':
        return { bg: '#f3e5f5', color: '#7b1fa2', text: '수정요청' };
      case 'modification_approved':
        return { bg: '#e8f5e8', color: '#388e3c', text: '수정 중' };
      case 'cancellation_requested':
        return { bg: '#fff3cd', color: '#856404', text: '취소요청' };
      default:
        return { bg: '#f5f5f5', color: '#616161', text: '기타' };
    }
  };

  const renderActionButtons = (schedule) => {
    const { approval_status, is_active } = schedule;
    const isPast = isPastSchedule(schedule.shoot_date);
    const isCancelled = isCancelledSchedule(schedule);

    if (editingSchedule === schedule.id) {
      return null;
    }

    if (!is_active || isPast || isCancelled) {
      return null;
    }

    const buttonStyle = {
      padding: 'clamp(8px, 2vw, 10px) clamp(12px, 3vw, 16px)',
      border: 'none',
      borderRadius: '6px',
      fontSize: 'clamp(13px, 3vw, 14px)',
      cursor: 'pointer',
      fontWeight: '500',
      textAlign: 'center' as const
    };

    const buttons = [];

    if (approval_status === 'approved') {
      buttons.push(
        <button
          key="contact-production"
          onClick={(e) => {
            e.stopPropagation();
            setContactScheduleInfo({
              date: schedule.shoot_date,
              daysLeft: 0,
              courseName: schedule.course_name || '미입력',
              startTime: schedule.start_time?.substring(0, 5) || '',
              endTime: schedule.end_time?.substring(0, 5) || ''
            });
            setShowContactModal(true);
          }}
          style={{
            ...buttonStyle,
            backgroundColor: '#FF6F00',
            color: 'white',
            width: '100%'
          }}
        >
          수정요청
        </button>
      );
      
      return (
        <div style={{ 
          marginTop: '12px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          justifyContent: 'center'
        }}>
          {buttons}
        </div>
      );
    }

    if (approval_status === 'cancellation_requested') {
      buttons.push(
        <button
          key="cancel-revoke"
          onClick={(e) => {
            e.stopPropagation();
            submitCancelRevoke(schedule);
          }}
          style={{
            ...buttonStyle,
            backgroundColor: '#4CAF50',
            color: 'white'
          }}
        >
          취소 철회
        </button>
      );
      
      return (
        <div style={{ 
          marginTop: '12px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          justifyContent: 'center'
        }}>
          {buttons}
        </div>
      );
    }

    if (['confirmed', 'pending'].includes(approval_status)) {
      const policy = SchedulePolicy.checkScheduleEditPolicy ? 
        SchedulePolicy.checkScheduleEditPolicy(schedule.shoot_date, testDate) : 
        { needsContact: false, canDirectEdit: true };

      buttons.push(
        <button
          key="edit"
          onClick={(e) => {
            e.stopPropagation();
            
            if (policy.needsContact) {
              setContactScheduleInfo({
                date: schedule.shoot_date,
                daysLeft: policy.daysLeft || 0,
                courseName: schedule.course_name || '강좌명 미입력',
                startTime: schedule.start_time?.substring(0, 5) || '',
                endTime: schedule.end_time?.substring(0, 5) || ''
              });
              setShowContactModal(true);
            } else {
              startEditSchedule(schedule);
            }
          }}
          style={{
            ...buttonStyle,
            backgroundColor: policy.needsContact ? '#FF6F00' : '#2196F3',
            color: 'white',
            marginRight: '8px'
          }}
        >
          {policy.needsContact ? '수정요청' : '수정하기'}
        </button>
      );

      buttons.push(
        <button
          key="cancel"
          onClick={(e) => {
            console.log('취소요청 버튼 클릭됨!', schedule);
            e.stopPropagation();
            submitCancelRequest(schedule);
          }}
          style={{
            ...buttonStyle,
            backgroundColor: '#F44336',
            color: 'white'
          }}
        >
          취소요청
        </button>
      );
    }

    if (approval_status === 'modification_approved') {
      buttons.push(
        <button
          key="edit"
          onClick={(e) => {
            e.stopPropagation();
            setContactScheduleInfo({
              date: schedule.shoot_date,
              daysLeft: 0,
              courseName: schedule.course_name || '강좌명 미입력',
              startTime: schedule.start_time?.substring(0, 5) || '',
              endTime: schedule.end_time?.substring(0, 5) || ''
            });
            setShowContactModal(true);
          }}
          style={{
            ...buttonStyle,
            backgroundColor: '#2196F3',
            color: 'white'
          }}
        >
          수정하기
        </button>
      );
    }

    return buttons.length > 0 ? (
      <div style={{ 
        marginTop: '12px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        justifyContent: 'center'
      }}>
        {buttons}
      </div>
    ) : null;
  };

  const renderBreakTimeSettings = () => {
    if (!shouldShowBreakTimeSettings(formData.start_time, formData.end_time)) {
      return null;
    }

    const recommendation = checkBreakTimeRecommendation(formData.start_time, formData.end_time);
    
    return (
      <div style={{
        marginTop: '16px',
        padding: 'clamp(12px, 3vw, 16px)',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #dee2e6'
      }}>
        <h4 style={{ 
          margin: '0 0 12px 0',
          color: '#374151', 
          fontSize: 'clamp(14px, 3.5vw, 16px)'
        }}>
          휴식시간 설정 (4시간 이상 촬영)
        </h4>
        
        <div style={{
          marginBottom: '12px',
          padding: '8px',
          backgroundColor: '#e9ecef',
          borderRadius: '6px',
          border: '1px solid #ced4da'
        }}>
          <div style={{ 
            color: '#495057', 
            fontWeight: '500', 
            marginBottom: '4px',
            fontSize: 'clamp(12px, 3vw, 14px)'
          }}> 
            장시간 촬영 감지
          </div>
          <div style={{ 
            color: '#495057', 
            fontSize: 'clamp(12px, 3vw, 14px)'
          }}>
            {recommendation.reason}
          </div>
        </div>
        
        <div style={{ marginBottom: '16px' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            flexWrap: 'wrap' 
          }}>
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              cursor: 'pointer',
              fontSize: 'clamp(14px, 3.5vw, 16px)',
              fontWeight: '500'
            }}>
              <input
                type="checkbox"
                checked={formData.break_time_enabled}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  if (enabled) {
                    const suggested = recommendation.suggestedBreakTime;
                    setFormData(prev => ({ 
                      ...prev, 
                      break_time_enabled: true,
                      break_start_time: suggested?.startTime || '12:00',
                      break_end_time: suggested?.endTime || '13:00',
                      break_duration_minutes: suggested?.durationMinutes || 60
                    }));
                  } else {
                    setFormData(prev => ({ 
                      ...prev, 
                      break_time_enabled: false,
                      break_start_time: undefined,
                      break_end_time: undefined,
                      break_duration_minutes: 0
                    }));
                  }
                }}
                style={{ 
                  marginRight: '8px',
                  transform: 'scale(1.2)'
                }}
              />
              휴식시간 사용
            </label>
            
            <span style={{ 
              fontSize: 'clamp(12px, 3vw, 14px)',
              color: '#6c757d',
              fontStyle: 'italic'
            }}>
              {formData.break_time_enabled ? '' : '연속 촬영'}
            </span>
          </div>
        </div>
        
        {formData.break_time_enabled && (
          <div style={{
            padding: '12px',
            backgroundColor: '#f0f9ff',
            borderRadius: '6px',
            border: '1px solid #dbeafe'
          }}>
            <h5 style={{ 
              margin: '0 0 12px 0',
              color: '#1565c0',
              fontSize: 'clamp(14px, 3.5vw, 16px)'
            }}>
              휴식시간 설정
            </h5>
            
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: '1fr 1fr auto',
              gap: '8px',
              alignItems: 'end',
              marginBottom: '12px'
            }}>
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '4px', 
                  fontSize: 'clamp(12px, 3vw, 14px)',
                  fontWeight: '500'
                }}>
                  시작
                </label>
                <select
                  value={formData.break_start_time || '12:00'}
                  onChange={(e) => {
                    const startTime = e.target.value;
                    const endTime = formData.break_end_time || '13:00';
                    
                    const startMinutes = timeToMinutes(startTime);
                    const endMinutes = timeToMinutes(endTime);
                    const calculatedDuration = Math.max(0, endMinutes - startMinutes);
                    
                    setFormData(prev => ({
                      ...prev,
                      break_start_time: startTime,
                      break_duration_minutes: calculatedDuration
                    }));
                  }}
                  style={{
                    width: '100%',
                    padding: 'clamp(8px, 2vw, 10px)',
                    border: `1px solid ${errors.break_start_time ? '#f44336' : '#d1d5db'}`,
                    borderRadius: '6px',
                    fontSize: 'clamp(12px, 3vw, 14px)',
                    textAlign: 'center'
                  }}
                >
                  {generateBreakTimeOptionsInRange(formData.start_time, formData.end_time).map(time => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '4px', 
                  fontSize: 'clamp(12px, 3vw, 14px)',
                  fontWeight: '500'
                }}>
                  종료
                </label>
                <select
                  value={formData.break_end_time || '13:00'}
                  onChange={(e) => {
                    const endTime = e.target.value;
                    const startTime = formData.break_start_time || '12:00';
                    
                    const startMinutes = timeToMinutes(startTime);
                    const endMinutes = timeToMinutes(endTime);
                    const calculatedDuration = Math.max(0, endMinutes - startMinutes);
                    
                    setFormData(prev => ({
                      ...prev,
                      break_end_time: endTime,
                      break_duration_minutes: calculatedDuration
                    }));
                  }}
                  style={{
                    width: '100%',
                    padding: 'clamp(8px, 2vw, 10px)',
                    border: `1px solid ${errors.break_end_time ? '#f44336' : '#d1d5db'}`,
                    borderRadius: '6px',
                    fontSize: 'clamp(12px, 3vw, 14px)',
                    textAlign: 'center'
                  }}
                >
                  {generateBreakTimeOptionsInRange(formData.start_time, formData.end_time).map(time => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
              </div>
              
                            <div style={{ 
                padding: 'clamp(8px, 2vw, 10px)',
                backgroundColor: 'white',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: 'clamp(12px, 3vw, 14px)',
                fontWeight: '500',
                color: '#374151',
                textAlign: 'center',
                whiteSpace: 'nowrap'
              }}>
                {formData.break_duration_minutes}분
              </div>
            </div>

            {(errors.break_start_time || errors.break_end_time) && (
              <div style={{ marginTop: '6px' }}>
                {errors.break_start_time && (
                  <span style={{ 
                    color: '#f44336', 
                    fontSize: 'clamp(11px, 2.5vw, 12px)',
                    display: 'block' 
                  }}>
                    {errors.break_start_time}
                  </span>
                )}
                {errors.break_end_time && (
                  <span style={{ 
                    color: '#f44336', 
                    fontSize: 'clamp(11px, 2.5vw, 12px)',
                    display: 'block' 
                  }}>
                    {errors.break_end_time}
                  </span>
                )}
              </div>
            )}
            
            <div style={{ 
              marginTop: '12px',
              padding: '8px',
              backgroundColor: 'white',
              borderRadius: '6px',
              fontSize: 'clamp(11px, 2.5vw, 12px)',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{ 
                fontWeight: '500', 
                marginBottom: '6px',
                color: '#374151' 
              }}>
                촬영 일정 미리보기
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div>
                  <span style={{ color: '#4caf50', fontWeight: '500' }}>1차 촬영:</span> {formData.start_time} ~ {formData.break_start_time}
                </div>
                <div>
                  <span style={{ color: '#6c757d', fontWeight: '500' }}>휴식시간:</span> {formData.break_start_time} ~ {formData.break_end_time} ({formData.break_duration_minutes}분)
                </div>
                <div>
                  <span style={{ color: '#2196f3', fontWeight: '500' }}>2차 촬영:</span> {formData.break_end_time} ~ {formData.end_time}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

const handleDevDateSelect = (selectedDate: string) => {
  setTestDate(selectedDate);
};

// ✅ Auth + localStorage 둘 다 사용하는 버전
const legacyUserRole  = localStorage.getItem('userRole')  || '';
const legacyUserEmail = localStorage.getItem('userEmail') || '';
const legacyUserName  = localStorage.getItem('userName')  || '';

const authRole  = (user?.user_metadata?.role as string) || '';
const extraAuthRoles =
  ((user?.user_metadata?.roles as string[]) ?? []).filter(Boolean);

  // 화면에 보여줄 사용자 이름 (교수님 이름)
const displayUserName =
  userInfo?.name ||
  legacyUserName ||
  (user?.user_metadata?.name as string) ||
  (legacyUserEmail
    ? legacyUserEmail.split('@')[0]
    : user?.email
    ? user.email.split('@')[0]
    : '사용자');


// 위에서 setUserRoles로 채워둔 userRoles 까지 포함해서 모두 합치기
const allRoles = Array.from(
  new Set([
    ...userRoles,
    authRole,
    ...extraAuthRoles,
    legacyUserRole,
  ].filter(Boolean))
);

const isLoggedIn =
  !!user ||
  !!(legacyUserRole && legacyUserEmail && legacyUserName);

// 관리자 권한: system_admin / schedule_admin / manager
const isAdmin =
  allRoles.includes('system_admin') ||
  allRoles.includes('schedule_admin') ||
  allRoles.includes('manager');

// 교수 권한
const isProfessor = allRoles.includes('professor');

const hasAccess = isAdmin || isProfessor;


  if (!isLoggedIn) {
    return (
      <div style={{ 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{ 
          background: 'white',
          borderRadius: '12px',
          padding: 'clamp(20px, 5vw, 40px)',
          textAlign: 'center',
          boxShadow: '0 10px 25px -3px rgba(0, 0, 0, 0.1)',
          maxWidth: '400px',
          width: '100%'
        }}>
          <h2 style={{ 
            color: '#1f2937', 
            marginBottom: '20px',
            fontSize: 'clamp(18px, 4.5vw, 24px)'
          }}>
            로그인이 필요합니다
          </h2>
          <p style={{ 
            color: '#6b7280', 
            marginBottom: '30px',
            fontSize: 'clamp(14px, 3.5vw, 16px)'
          }}>
            스튜디오 촬영 시스템에 접근하려면<br/>
            먼저 로그인해주세요.
          </p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div style={{ 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{ 
          background: 'white',
          borderRadius: '12px',
          padding: 'clamp(20px, 5vw, 40px)',
          textAlign: 'center',
          boxShadow: '0 10px 25px -3px rgba(0, 0, 0, 0.1)',
          maxWidth: '400px',
          width: '100%'
        }}>
          <h2 style={{ 
            color: '#1f2937', 
            marginBottom: '20px',
            fontSize: 'clamp(18px, 4.5vw, 24px)'
          }}>
            교수님만 접근 가능합니다
          </h2>
          <p style={{ 
            color: '#6b7280', 
            marginBottom: '30px',
            fontSize: 'clamp(14px, 3.5vw, 16px)'
          }}>
            스튜디오 촬영 시스템은 교수님 전용입니다
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
      padding: 'clamp(8px, 2vw, 10px)'
    }}>
      {showDevMode && (
        <DevTestMode 
          onClose={() => setShowDevMode(false)} 
          onDateSelect={handleDevDateSelect}
          testDate={testDate}
        />
      )}

      <ContactModal
        open={showContactModal}
        onClose={() => setShowContactModal(false)}
        scheduleInfo={contactScheduleInfo}
      />

      <div style={{ 
        maxWidth: '600px', 
        margin: '0 auto', 
        padding: '0 clamp(8px, 2vw, 10px)'
      }}>
        {/* 상단 헤더 - 배경 색상 통일 */}
        <div style={{ 
          background: 'white',
          borderRadius: '12px',
          padding: 'clamp(16px, 4vw, 24px)',
          marginBottom: '16px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          textAlign: 'center'
        }}>

            {/* 🔥 우측 상단에 프로필 메뉴 추가 */}
          <div style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              fontSize: 'clamp(12px, 3vw, 14px)',
              color: '#6b7280',
              fontWeight: '500'
            }}>
              {displayUserName} 교수님
            </div>
            <button
              onClick={async () => {
                if (window.confirm('로그아웃 하시겠습니까?')) {
                  try {
                    await signOut(); // ✅ 이제 정의됨!
                  } catch (error) {
                    console.error('로그아웃 오류:', error);
                  }
                }
              }}
              style={{
                padding: '6px 12px',
                backgroundColor: '#f87171',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: 'clamp(11px, 2.5vw, 13px)',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              로그아웃
            </button>
          </div>
          <div style={{ 
            width: 'clamp(100px, 25vw, 140px)',
            height: 'clamp(30px, 8vw, 50px)',
            margin: '0 auto 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <img 
              src="https://img.eduwill.net/Img2/Common/BI/type2/live/logo.svg"
              alt="에듀윌 로고"
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain'
              }}
            />
          </div>
          
          <h1 style={{ 
            color: '#1f2937', 
            fontSize: 'clamp(18px, 4.5vw, 24px)',
            marginBottom: '6px',
            fontWeight: '600',
            lineHeight: '1.2'
          }}>
            안녕하세요. {displayUserName} 교수님
          </h1>
          
          <p style={{ 
            color: '#6b7280', 
            fontSize: 'clamp(14px, 3.5vw, 16px)',
            margin: '0 0 12px 0'
          }}>
            에듀윌 영상개발실입니다
          </p>
          
          <p style={{ 
            color: '#9ca3af',
            fontSize: 'clamp(12px, 3vw, 14px)',
            margin: 0
          }}>
            촬영이 필요한 날짜와 시간을 선택해 주세요
          </p>
          
          {isDevModeActive && (
            <div style={{
              marginTop: '8px',
              padding: '6px 12px',
              backgroundColor: '#4caf50',
              color: 'white',
              borderRadius: '20px',
              fontSize: 'clamp(10px, 2.5vw, 12px)',
              fontWeight: '500',
              display: 'inline-block'
            }}>
              개발 테스트 모드 활성화
            </div>
          )}
        </div>

        {/* 스케줄 입력 폼 - 배경 색상 통일 */}
        <div style={{ 
          background: 'white',
          borderRadius: '12px',
          padding: 'clamp(16px, 4vw, 24px)',
          marginBottom: '16px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ display: 'grid', gap: 'clamp(12px, 3vw, 16px)' }}>
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '6px', 
                fontWeight: '500', 
                color: '#374151',
                fontSize: 'clamp(14px, 3.5vw, 16px)'
              }}>
                촬영 날짜 *
              </label>
              
              {!isDevModeActive && (
                <div style={{
                  backgroundColor: '#f0f9ff',
                  border: '1px solid #dbeafe',
                  borderRadius: '6px',
                  padding: 'clamp(10px, 2.5vw, 12px)',
                  marginBottom: '8px',
                  fontSize: 'clamp(12px, 3vw, 14px)'
                }}>
                  <div style={{ 
                    color: '#1e40af',
                    fontWeight: '500',
                    marginBottom: '2px'
                  }}>
                    이번 등록 대상: {registrationInfo.weekInfo} (2주간)
                  </div>
                  <div style={{ color: '#1e3a8a' }}>
                    매주 월요일에 차차주 2주간 스케줄 등록이 가능합니다.
                  </div>
                </div>
              )}
              
              {isDevModeActive && (
                <div style={{
                  backgroundColor: '#ecfdf5',
                  border: '1px solid #4caf50',
                  borderRadius: '6px',
                  padding: 'clamp(10px, 2.5vw, 12px)',
                  marginBottom: '8px',
                  fontSize: 'clamp(12px, 3vw, 14px)'
                }}>
                  <div style={{ 
                    color: '#2e7d32',
                    fontWeight: '500',
                    marginBottom: '2px'
                  }}>
                    개발 테스트 모드: 모든 날짜 선택 가능
                  </div>
                  <div style={{ color: '#1b5e20' }}>
                    과거/미래 날짜, 주말 포함 모든 날짜로 테스트할 수 있습니다.
                  </div>
                </div>
              )}
              
              <select 
                value={formData.shoot_date} 
                onChange={(e) => setFormData({...formData, shoot_date: e.target.value})} 
                style={{ 
                  width: '100%', 
                  padding: 'clamp(10px, 2.5vw, 12px)',
                  border: `1px solid ${errors.shoot_date ? '#f44336' : '#d1d5db'}`, 
                  borderRadius: '8px',
                  fontSize: 'clamp(14px, 3.5vw, 16px)',
                  outline: 'none',
                  boxSizing: 'border-box'
                }} 
                required 
              >
                <option value="">날짜 선택</option>
                {availableDates.map(date => (
                  <option key={date.value} value={date.value}>{date.label}</option>
                ))}
              </select>
              {errors.shoot_date && (
                <span style={{ 
                  color: '#f44336', 
                  fontSize: 'clamp(11px, 2.5vw, 12px)',
                  marginTop: 4, 
                  display: 'block' 
                }}>
                  {errors.shoot_date}
                </span>
              )}
            </div>

            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '6px',
                fontWeight: '500', 
                color: '#374151',
                fontSize: 'clamp(14px, 3.5vw, 16px)'
              }}>
                촬영 시간 *
              </label>
              
              <div style={{ 
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-end'
              }}>
                <div style={{ flex: 1 }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '4px',
                    fontSize: 'clamp(12px, 3vw, 14px)',
                    fontWeight: '500',
                    color: '#6b7280'
                  }}>
                    시작
                  </label>
                  <select 
                    value={formData.start_time} 
                    onChange={(e) => handleFormTimeChange('start_time', e.target.value)} 
                    style={{ 
                      width: '100%', 
                      padding: 'clamp(10px, 2.5vw, 12px)',
                      border: `1px solid ${errors.start_time ? '#f44336' : '#d1d5db'}`, 
                      borderRadius: '8px',
                      fontSize: 'clamp(13px, 3vw, 15px)',
                      background: 'white',
                      outline: 'none',
                      boxSizing: 'border-box',
                      textAlign: 'center'
                    }} 
                    required
                  >
                    <option value="">시작 시간</option>
                    {timeOptions.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
                
                <div style={{ 
                  padding: 'clamp(10px, 2.5vw, 12px) 0',
                  fontSize: 'clamp(16px, 4vw, 20px)',
                  color: '#6b7280',
                  fontWeight: '500'
                }}>
                  ~
                </div>
                
                <div style={{ flex: 1 }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '4px',
                    fontSize: 'clamp(12px, 3vw, 14px)',
                    fontWeight: '500',
                    color: '#6b7280'
                  }}>
                    종료
                  </label>
                  <select 
                    value={formData.end_time} 
                    onChange={(e) => handleFormTimeChange('end_time', e.target.value)} 
                    style={{ 
                      width: '100%', 
                      padding: 'clamp(10px, 2.5vw, 12px)',
                      border: `1px solid ${errors.end_time ? '#f44336' : '#d1d5db'}`, 
                      borderRadius: '8px',
                      fontSize: 'clamp(13px, 3vw, 15px)',
                      background: 'white',
                      outline: 'none',
                      boxSizing: 'border-box',
                      textAlign: 'center'
                    }} 
                    required
                  >
                    <option value="">종료 시간</option>
                    {timeOptions.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              {(errors.start_time || errors.end_time) && (
                <div style={{ marginTop: '6px' }}>
                  {errors.start_time && (
                    <span style={{ 
                      color: '#f44336', 
                      fontSize: 'clamp(11px, 2.5vw, 12px)',
                      display: 'block' 
                    }}>
                      {errors.start_time}
                    </span>
                  )}
                  {errors.end_time && (
                    <span style={{ 
                      color: '#f44336', 
                      fontSize: 'clamp(11px, 2.5vw, 12px)',
                      display: 'block' 
                    }}>
                      {errors.end_time}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '6px',
                fontWeight: '500', 
                color: '#374151',
                fontSize: 'clamp(14px, 3.5vw, 16px)'
              }}>
                촬영 형식 *
              </label>
              <select
                value={formData.shooting_type}
                onChange={(e) => setFormData({...formData, shooting_type: e.target.value})}
                style={{
                  width: '100%',
                  padding: 'clamp(10px, 2.5vw, 12px)',
                  border: `1px solid ${errors.shooting_type ? '#f44336' : '#d1d5db'}`,
                  borderRadius: '8px',
                  fontSize: 'clamp(14px, 3.5vw, 16px)',
                  background: 'white',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                required
              >
                <option value="">촬영 형식을 선택해주세요</option>
                {shootingTypes.map(type => (
                  <option key={type.id} value={type.name}>
                    {type.name}
                  </option>
                ))}
              </select>
              {errors.shooting_type && (
                <span style={{ 
                  color: '#f44336', 
                  fontSize: 'clamp(11px, 2.5vw, 12px)',
                  marginTop: 6,
                  display: 'block' 
                }}>
                  {errors.shooting_type}
                </span>
              )}
            </div>

            {/* 휴식시간 조건부 표시 (4시간 기준) */}
            {formData.start_time && formData.end_time && renderBreakTimeSettings()}

            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '6px',
                fontWeight: '500', 
                color: '#374151',
                fontSize: 'clamp(14px, 3.5vw, 16px)'
              }}>
                강좌명
              </label>
              <input 
                type="text" 
                value={formData.course_name} 
                onChange={(e) => setFormData({...formData, course_name: e.target.value})} 
                placeholder="예: 데이터베이스 설계"
                style={{ 
                  width: '100%', 
                  padding: 'clamp(10px, 2.5vw, 12px)',
                  border: '1px solid #d1d5db', 
                  borderRadius: '8px',
                  fontSize: 'clamp(14px, 3.5vw, 16px)',
                  outline: 'none',
                  boxSizing: 'border-box'
                }} 
              />
            </div>

            {/* 강좌코드 필드 완전 삭제됨 - 이모티콘 없이 */}

            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '6px',
                fontWeight: '500', 
                color: '#374151',
                fontSize: 'clamp(14px, 3.5vw, 16px)'
              }}>
                전달사항
              </label>
              <textarea 
                value={formData.notes} 
                onChange={(e) => setFormData({...formData, notes: e.target.value})} 
                placeholder="촬영 시 특별히 요청하실 사항이 있으시면 입력해주세요"
                style={{ 
                  width: '100%', 
                  padding: 'clamp(10px, 2.5vw, 12px)',
                  border: '1px solid #d1d5db', 
                  borderRadius: '8px', 
                  minHeight: 'clamp(60px, 15vw, 80px)',
                  fontSize: 'clamp(14px, 3.5vw, 16px)',
                  resize: 'vertical',
                  outline: 'none',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box'
                }} 
              />
            </div>

            <div style={{ marginTop: 'clamp(8px, 2vw, 12px)' }}>
              <button 
                onClick={submitShootingRequest}
                style={{ 
                  width: '100%',
                  padding: 'clamp(12px, 3vw, 16px)',
                  background: '#3b82f6', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '8px', 
                  cursor: 'pointer', 
                  fontSize: 'clamp(16px, 4vw, 18px)',
                  fontWeight: '500'
                }}
              >
                촬영 요청
              </button>
            </div>
          </div>
        </div>

        {/* 내 요청 목록 보기 버튼 */}
        <div style={{ 
          textAlign: 'center', 
          paddingBottom: '24px',
          marginTop: '16px'
        }}>
          <button 
            onClick={() => setShowMyRequests(!showMyRequests)}
            style={{ 
              padding: 'clamp(10px, 2.5vw, 12px) clamp(20px, 5vw, 28px)',
              background: showMyRequests 
                ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)' 
                : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: 'clamp(14px, 3.5vw, 16px)',
              fontWeight: '600',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              transition: 'all 0.2s ease',
              transform: 'translateY(0)',
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
            }}
          >
            {showMyRequests ? '내 요청 목록 숨기기' : '내 요청 목록 보기'}
          </button>
        </div>

        {/* 내 요청 목록 - 배경 색상 통일 */}
        {showMyRequests && (
          <div style={{ 
            background: 'white',
            borderRadius: '12px',
            padding: 'clamp(16px, 4vw, 24px)',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: 16,
              flexWrap: 'wrap',
              gap: '8px'
            }}>
              <h2 style={{ 
                margin: 0, 
                color: '#1f2937', 
                fontSize: 'clamp(18px, 4.5vw, 22px)',
                fontWeight: '600'
              }}>
                내 촬영 요청 목록
              </h2>
              <div style={{ 
                fontSize: 'clamp(12px, 3vw, 14px)',
                color: '#6b7280' 
              }}>
                총 {totalRequestCount}건 중 {myRequests.length}건 표시
              </div>
            </div>

            {/* 검색 필터 */}
            <div style={{
              marginBottom: 16,
              padding: 'clamp(12px, 3vw, 16px)',
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
                alignItems: 'end',
                marginBottom: '12px'
              }}>
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '4px',
                    fontSize: 'clamp(12px, 3vw, 14px)',
                    fontWeight: '500',
                    color: '#374151'
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
                      padding: 'clamp(6px, 1.5vw, 8px)',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: 'clamp(12px, 3vw, 14px)',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '4px',
                    fontSize: 'clamp(12px, 3vw, 14px)',
                    fontWeight: '500',
                    color: '#374151'
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
                      padding: 'clamp(6px, 1.5vw, 8px)',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: 'clamp(12px, 3vw, 14px)',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>
              
              <div style={{
                display: 'flex',
                gap: '8px',
                justifyContent: 'center'
              }}>
                <button
                  onClick={handleSearch}
                  disabled={isSearching}
                  style={{
                    flex: 1,
                    padding: 'clamp(8px, 2vw, 10px) clamp(12px, 3vw, 16px)',
                    backgroundColor: isSearching ? '#9ca3af' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: isSearching ? 'not-allowed' : 'pointer',
                    fontSize: 'clamp(13px, 3vw, 15px)',
                    fontWeight: '500',
                    opacity: isSearching ? 0.6 : 1
                  }}
                >
                  {isSearching ? '검색중...' : '검색'}
                </button>
                
                <button
                  onClick={handleResetSearch}
                  style={{
                    flex: 1,
                    padding: 'clamp(8px, 2vw, 10px) clamp(12px, 3vw, 16px)',
                    backgroundColor: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: 'clamp(13px, 3vw, 15px)',
                    fontWeight: '500'
                  }}
                >
                  초기화
                </button>
              </div>
              
              {(searchFilters.start_date || searchFilters.end_date) && (
                <div style={{ 
                  marginTop: '8px',
                  fontSize: 'clamp(11px, 2.5vw, 12px)',
                  color: '#6b7280',
                  fontStyle: 'italic',
                  textAlign: 'center'
                }}>
                  {searchFilters.start_date && `${searchFilters.start_date} 이후`}
                  {searchFilters.start_date && searchFilters.end_date && ' ~ '}
                  {searchFilters.end_date && `${searchFilters.end_date} 이전`}
                  {' '}요청만 표시 중
                </div>
              )}
            </div>
            
            {/* 요청 목록 내용 */}
            {myRequests.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: 'clamp(30px, 8vw, 50px)',
                color: '#6b7280',
                fontSize: 'clamp(14px, 3.5vw, 16px)'
              }}>
                {isSearching ? (
                  '검색 중...'
                ) : (searchFilters.start_date || searchFilters.end_date) ? (
                  '검색 조건에 맞는 촬영 요청이 없습니다'
                ) : (
                  '아직 등록된 촬영 요청이 없습니다'
                )}
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gap: 'clamp(12px, 3vw, 16px)' }}>
                {myRequests.map((request, index) => {
                  const hasModificationRequest = request.notes && request.notes.includes('[수정요청ID:');
                  const statusInfo = getStatusInfo(request.approval_status, hasModificationRequest, request.is_active);
                  const policy = SchedulePolicy.checkScheduleEditPolicy ? 
                    SchedulePolicy.checkScheduleEditPolicy(request.shoot_date, testDate) : 
                    { daysLeft: 0, needsContact: false, canDirectEdit: true };
                  const isPast = isPastSchedule(request.shoot_date);
                  const isCancelled = isCancelledSchedule(request);

                  return (
                    <div 
                      key={request.id} 
                      style={{ 
                        padding: 'clamp(12px, 3vw, 20px)',
                        border: request.is_grouped ? '1px solid #6c757d' : '1px solid #e5e7eb', 
                        borderRadius: '8px',
                        background: isPast || isCancelled ? '#f8f9fa' : '#fafbfc',
                        position: 'relative',
                        opacity: isPast || isCancelled ? 0.7 : 1
                      }}
                    >
                      {/* 취소 확정 워터마크 */}
                      {isCancelled && (
                        <div style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%) rotate(-15deg)',
                          fontSize: 'clamp(32px, 8vw, 48px)',
                          fontWeight: 'bold',
                          color: 'rgba(108, 117, 125, 0.3)',
                          zIndex: 1,
                          pointerEvents: 'none',
                          userSelect: 'none',
                          textShadow: '2px 2px 4px rgba(0,0,0,0.1)',
                          border: '3px solid rgba(108, 117, 125, 0.3)',
                          borderRadius: '8px',
                          padding: '8px 16px'
                        }}>
                          취소확정
                        </div>
                      )}

                      {/* 과거 스케줄 워터마크 */}
                      {isPast && !isCancelled && (
                        <div style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%) rotate(-15deg)',
                          fontSize: 'clamp(32px, 8vw, 48px)',
                          fontWeight: 'bold',
                          color: 'rgba(108, 117, 125, 0.2)',
                          zIndex: 1,
                          pointerEvents: 'none',
                          userSelect: 'none',
                          textShadow: '2px 2px 4px rgba(0,0,0,0.1)',
                          border: '3px solid rgba(108, 117, 125, 0.2)',
                          borderRadius: '8px',
                          padding: '8px 16px'
                        }}>
                          완료
                        </div>
                      )}


                      <div style={{ 
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '3px',
                        height: '100%',
                        background: statusInfo.color,
                        borderRadius: '8px 0 0 8px'
                      }} />
                      
                      <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column',
                        justifyContent: 'space-between', 
                        alignItems: 'flex-start', 
                        marginBottom: '12px',
                        gap: '8px',
                        marginTop: request.is_grouped ? '20px' : (isPast || isCancelled ? '8px' : '24px'),
                        marginLeft: '6px'
                      }}>
                        <div style={{ flex: 1, width: '100%' }}>
                          <h3 style={{ 
                            margin: '0 0 6px 0',
                            color: isPast || isCancelled ? '#6c757d' : '#1f2937', 
                            fontSize: 'clamp(15px, 4vw, 18px)',
                            fontWeight: '600'
                          }}>
                            {request.course_name || '강좌명 미입력'}
                          </h3>
                          <div style={{ 
                            color: isPast || isCancelled ? '#868e96' : '#6b7280', 
                            fontSize: 'clamp(13px, 3vw, 15px)',
                            fontWeight: '500'
                          }}>
                            {request.shoot_date} | {request.start_time?.substring(0, 5)}~{request.end_time?.substring(0, 5)}
                          </div>
                        </div>
                        
                        <div style={{
                          padding: 'clamp(4px, 1vw, 6px) clamp(8px, 2vw, 12px)',
                          borderRadius: '12px',
                          fontSize: 'clamp(11px, 2.5vw, 13px)',
                          fontWeight: '500',
                          background: statusInfo.bg,
                          color: statusInfo.color,
                          whiteSpace: 'nowrap',
                          alignSelf: 'flex-start'
                        }}>
                          {statusInfo.text}
                        </div>
                      </div>
                      
                      <div style={{ 
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '8px',
                        marginBottom: '12px',
                        marginLeft: '6px'
                      }}>
                        <div style={{ 
                          padding: 'clamp(8px, 2vw, 12px)',
                          background: 'white',
                          borderRadius: '6px',
                          border: '1px solid #e5e7eb'
                        }}>
                          <strong style={{ 
                            color: '#374151',
                            fontSize: 'clamp(11px, 2.5vw, 13px)'
                          }}>촬영형식</strong><br />
                          <span style={{ 
                            color: isPast || isCancelled ? '#6c757d' : '#1f2937',
                            fontSize: 'clamp(13px, 3vw, 15px)'
                          }}>
                            {request.shooting_type || '미지정'}
                          </span>
                        </div>

                        <div style={{ 
                          padding: 'clamp(8px, 2vw, 12px)',
                          background: 'white',
                          borderRadius: '6px',
                          border: '1px solid #e5e7eb'
                        }}>
                          <strong style={{ 
                            color: '#374151',
                            fontSize: 'clamp(11px, 2.5vw, 13px)'
                          }}>배정스튜디오</strong><br />
                          <span style={{ 
                            color: isPast || isCancelled ? '#6c757d' : '#1f2937',
                            fontSize: 'clamp(13px, 3vw, 15px)'
                          }}>
                            {(() => {
                              const status = request.approval_status;
                              
                              if (status === 'approved' || status === 'confirmed') {
                                return request.sub_locations?.name || '스튜디오 배정 중';
                              } else if (status === 'pending' || status === 'approval_requested') {
                                return '미배정 (승인 후 배정 예정)';
                              } else if (status === 'cancelled') {
                                return '취소됨';
                              } else {
                                return '미배정';
                              }
                            })()}
                          </span>
                        </div>
                      </div>

                      {/* 휴식시간 카드 표시 */}
                      {((editingSchedule === request.id && editFormData.break_time_enabled) || 
                        (editingSchedule !== request.id && (request.break_time_enabled || 
                        (request.grouped_schedules && request.grouped_schedules.some(s => s.break_time_enabled))))) && (
                        <div style={{
                          marginBottom: 12,
                          marginLeft: '6px',
                          padding: 'clamp(8px, 2vw, 10px)',
                          backgroundColor: '#e9ecef',
                          borderRadius: '6px',
                          border: '1px solid #ced4da'
                        }}>
                          <div style={{ 
                            fontSize: 'clamp(11px, 2.5vw, 13px)',
                            color: '#495057', 
                            fontWeight: '500' 
                          }}> 
                            휴식시간 정보
                          </div>
                          <div style={{ 
                            fontSize: 'clamp(10px, 2.5vw, 12px)',
                            color: '#495057', 
                            marginTop: '3px'
                          }}>
                            {editingSchedule === request.id && editFormData.break_time_enabled ? (
                              <>휴식시간: {editFormData.break_start_time || '시작시간'} ~ {editFormData.break_end_time || '종료시간'} ({editFormData.break_duration_minutes || 0}분)</>
                            ) : (() => {
                              if (request.grouped_schedules && request.grouped_schedules.length > 1) {
                                const sortedSchedules = request.grouped_schedules.sort((a, b) => a.sequence_order - b.sequence_order);
                                const breakStart = sortedSchedules[0].end_time?.substring(0, 5);
                                const breakEnd = sortedSchedules[1].start_time?.substring(0, 5);
                                const breakDuration = breakStart && breakEnd ? 
                                  timeToMinutes(breakEnd) - timeToMinutes(breakStart) : 0;
                                return <>휴식시간: {breakStart || '시작시간'} ~ {breakEnd || '종료시간'} ({breakDuration}분)</>;
                              } else if (request.break_time_enabled) {
                                return <>휴식시간: {request.break_start_time?.substring(0, 5) || '시작시간'} ~ {request.break_end_time?.substring(0, 5) || '종료시간'} ({request.break_duration_minutes || 0}분)</>;
                              } else {
                                return <>휴식시간 설정 없음</>;
                              }
                            })()}
                          </div>
                        </div>
                      )}

                      {request.notes && (
                        <div style={{ 
                          padding: 'clamp(8px, 2vw, 12px)',
                          background: 'white',
                          borderRadius: '6px',
                          border: '1px solid #e5e7eb',
                          marginBottom: '12px',
                          marginLeft: '6px'
                        }}>
                          <strong style={{ 
                            color: '#374151',
                            fontSize: 'clamp(11px, 2.5vw, 13px)'
                          }}>전달사항</strong><br />
                          <span style={{ 
                            color: isPast || isCancelled ? '#6c757d' : '#1f2937',
                            fontSize: 'clamp(13px, 3vw, 15px)'
                          }}>
                            {request.notes}
                          </span>
                        </div>
                      )}



                      {/* 🔥 수정된 인라인 수정 폼 - 내용이 나오도록 수정 */}
                      {editingSchedule === request.id && (
                        <div style={{
                          marginTop: '12px',
                          marginLeft: '6px',
                          padding: '16px',
                          backgroundColor: '#f8f9fa',
                          borderRadius: '8px',
                          border: '2px solid #007bff'
                        }}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '16px'
                          }}>
                            <span style={{ 
                              fontSize: 'clamp(16px, 4vw, 18px)', 
                              fontWeight: '600',
                              color: '#007bff'
                            }}>
                              스케줄 수정하기
                            </span>
                            <button
                              onClick={cancelEditSchedule}
                              style={{
                                background: 'none',
                                border: 'none',
                                fontSize: '20px',
                                cursor: 'pointer',
                                color: '#6c757d'
                              }}
                            >
                              ×
                            </button>
                          </div>
                          
                          {/* 🔥 수정 폼 완전한 구현 */}
                          <div style={{ display: 'grid', gap: '12px' }}>
                            {/* 1. 촬영 날짜 */}
                            <div>
                              <label style={{ 
                                display: 'block', 
                                marginBottom: '6px', 
                                fontSize: 'clamp(14px, 3.5vw, 16px)', 
                                fontWeight: '500',
                                color: '#374151'
                              }}>
                                촬영 날짜 *
                              </label>
                              <select
                                value={editFormData.shoot_date}
                                onChange={(e) => setEditFormData(prev => ({ ...prev, shoot_date: e.target.value }))}
                                style={{
                                  width: '100%',
                                  padding: 'clamp(10px, 2.5vw, 12px)',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '6px',
                                  fontSize: 'clamp(14px, 3.5vw, 16px)',
                                  boxSizing: 'border-box'
                                }}
                              >
                                {editAvailableDates.map(date => (
                                  <option key={date.value} value={date.value}>{date.label}</option>
                                ))}
                              </select>
                            </div>
                            
                            {/* 2. 촬영 시간 */}
                            <div>
                              <label style={{ 
                                display: 'block', 
                                marginBottom: '6px', 
                                fontSize: 'clamp(14px, 3.5vw, 16px)', 
                                fontWeight: '500',
                                color: '#374151'
                              }}>
                                촬영 시간 *
                              </label>
                              <div style={{ 
                                display: 'grid', 
                                gridTemplateColumns: '1fr auto 1fr', 
                                gap: '8px', 
                                alignItems: 'center' 
                              }}>
                                <select
                                  value={editFormData.start_time}
                                  onChange={(e) => {
                                    const newStartTime = e.target.value;
                                    const newFormData = { ...editFormData, start_time: newStartTime };
                                    handleEditTimeChange('start_time', newStartTime, newFormData);
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: 'clamp(8px, 2vw, 10px)',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '6px',
                                    fontSize: 'clamp(13px, 3vw, 15px)',
                                    boxSizing: 'border-box',
                                    textAlign: 'center'
                                  }}
                                >
                                  {timeOptions.map(time => (
                                    <option key={time} value={time}>{time}</option>
                                  ))}
                                </select>
                                
                                <span style={{ fontSize: '16px', color: '#6b7280', fontWeight: '500' }}>~</span>
                                
                                <select
                                  value={editFormData.end_time}
                                  onChange={(e) => {
                                    const newEndTime = e.target.value;
                                    const newFormData = { ...editFormData, end_time: newEndTime };
                                    handleEditTimeChange('end_time', newEndTime, newFormData);
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: 'clamp(8px, 2vw, 10px)',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '6px',
                                    fontSize: 'clamp(13px, 3vw, 15px)',
                                    boxSizing: 'border-box',
                                    textAlign: 'center'
                                  }}
                                >
                                  {timeOptions.map(time => (
                                    <option key={time} value={time}>{time}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {/* 3. 촬영 형식 */}
                            <div>
                              <label style={{ 
                                display: 'block', 
                                marginBottom: '6px', 
                                fontSize: 'clamp(14px, 3.5vw, 16px)', 
                                fontWeight: '500',
                                color: '#374151'
                              }}>
                                촬영 형식 *
                              </label>
                              <select
                                value={editFormData.shooting_type}
                                onChange={(e) => setEditFormData(prev => ({ ...prev, shooting_type: e.target.value }))}
                                style={{
                                  width: '100%',
                                  padding: 'clamp(10px, 2.5vw, 12px)',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '6px',
                                  fontSize: 'clamp(14px, 3.5vw, 16px)',
                                  boxSizing: 'border-box'
                                }}
                              >
                                {shootingTypes.map(type => (
                                  <option key={type.id} value={type.name}>{type.name}</option>
                                ))}
                              </select>
                            </div>
                            
                            {/* 4. 강좌명 */}
                            <div>
                              <label style={{ 
                                display: 'block', 
                                marginBottom: '6px', 
                                fontSize: 'clamp(14px, 3.5vw, 16px)', 
                                fontWeight: '500',
                                color: '#374151'
                              }}>
                                강좌명
                              </label>
                              <input
                                type="text"
                                value={editFormData.course_name}
                                onChange={(e) => setEditFormData(prev => ({ ...prev, course_name: e.target.value }))}
                                placeholder="예: 데이터베이스 설계"
                                style={{
                                  width: '100%',
                                  padding: 'clamp(10px, 2.5vw, 12px)',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '6px',
                                  fontSize: 'clamp(14px, 3.5vw, 16px)',
                                  boxSizing: 'border-box'
                                }}
                              />
                            </div>
                            
                            {/* 5. 전달사항 */}
                            <div>
                              <label style={{ 
                                display: 'block', 
                                marginBottom: '6px', 
                                fontSize: 'clamp(14px, 3.5vw, 16px)', 
                                fontWeight: '500',
                                color: '#374151'
                              }}>
                                전달사항
                              </label>
                              <textarea
                                value={editFormData.notes}
                                onChange={(e) => setEditFormData(prev => ({ ...prev, notes: e.target.value }))}
                                placeholder="촬영 시 특별히 요청하실 사항이 있으시면 입력해주세요"
                                style={{
                                  width: '100%',
                                  padding: 'clamp(10px, 2.5vw, 12px)',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '6px',
                                  fontSize: 'clamp(14px, 3.5vw, 16px)',
                                  minHeight: '60px',
                                  resize: 'vertical',
                                  boxSizing: 'border-box',
                                  fontFamily: 'inherit'
                                }}
                              />
                            </div>
                            
                            {/* 6. 휴식시간 설정 (조건부 표시) */}
                            {editFormData.start_time && editFormData.end_time && 
                            shouldShowBreakTimeSettings(editFormData.start_time, editFormData.end_time) && (
                              <div style={{
                                padding: '12px',
                                backgroundColor: '#f0f9ff',
                                borderRadius: '6px',
                                border: '1px solid #dbeafe'
                              }}>
                                <div style={{ marginBottom: '12px' }}>
                                  <label style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    cursor: 'pointer',
                                    fontSize: 'clamp(14px, 3.5vw, 16px)',
                                    fontWeight: '500'
                                  }}>
                                    <input
                                      type="checkbox"
                                      checked={editFormData.break_time_enabled}
                                      onChange={(e) => {
                                        const enabled = e.target.checked;
                                        if (enabled) {
                                          setEditFormData(prev => ({ 
                                            ...prev, 
                                            break_time_enabled: true,
                                            break_start_time: '',
                                            break_end_time: '',
                                            break_duration_minutes: 0
                                          }));
                                        } else {
                                          setEditFormData(prev => ({ 
                                            ...prev, 
                                            break_time_enabled: false,
                                            break_start_time: undefined,
                                            break_end_time: undefined,
                                            break_duration_minutes: 0
                                          }));
                                        }
                                      }}
                                      style={{ 
                                        marginRight: '8px',
                                        transform: 'scale(1.2)'
                                      }}
                                    />
                                    휴식시간 사용 (4시간 이상 촬영 권장)
                                  </label>
                                </div>
                                
                                {editFormData.break_time_enabled && (
                                  <div style={{ 
                                    display: 'grid', 
                                    gridTemplateColumns: '1fr auto 1fr auto', 
                                    gap: '8px', 
                                    alignItems: 'center' 
                                  }}>
                                    <select
                                      value={editFormData.break_start_time || ''}
                                      onChange={(e) => {
                                        const startTime = e.target.value;
                                        const endTime = editFormData.break_end_time || '';
                                        
                                        let calculatedDuration = 0;
                                        if (startTime && endTime) {
                                          calculatedDuration = Math.max(0, timeToMinutes(endTime) - timeToMinutes(startTime));
                                        }
                                        
                                        setEditFormData(prev => ({
                                          ...prev,
                                          break_start_time: startTime,
                                          break_duration_minutes: calculatedDuration
                                        }));
                                      }}
                                      style={{
                                        width: '100%',
                                        padding: '8px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '4px',
                                        fontSize: 'clamp(12px, 3vw, 13px)',
                                        textAlign: 'center'
                                      }}
                                    >
                                      <option value="">시작 선택</option>
                                      {generateBreakTimeOptionsInRange(editFormData.start_time, editFormData.end_time).map(time => (
                                        <option key={time} value={time}>{time}</option>
                                      ))}
                                    </select>
                                    
                                    <span style={{ fontSize: '14px', color: '#6b7280' }}>~</span>
                                    
                                    <select
                                      value={editFormData.break_end_time || ''}
                                      onChange={(e) => {
                                        const endTime = e.target.value;
                                        const startTime = editFormData.break_start_time || '';
                                        
                                        let calculatedDuration = 0;
                                        if (startTime && endTime) {
                                          calculatedDuration = Math.max(0, timeToMinutes(endTime) - timeToMinutes(startTime));
                                        }
                                        
                                        setEditFormData(prev => ({
                                          ...prev,
                                          break_end_time: endTime,
                                          break_duration_minutes: calculatedDuration
                                        }));
                                      }}
                                      style={{
                                        width: '100%',
                                        padding: '8px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '4px',
                                        fontSize: 'clamp(12px, 3vw, 13px)',
                                        textAlign: 'center'
                                      }}
                                    >
                                      <option value="">종료 선택</option>
                                      {generateBreakTimeOptionsInRange(editFormData.start_time, editFormData.end_time).map(time => (
                                        <option key={time} value={time}>{time}</option>
                                      ))}
                                    </select>
                                    
                                    <div style={{ 
                                      padding: '8px',
                                      backgroundColor: 'white',
                                      borderRadius: '4px',
                                      border: '1px solid #d1d5db',
                                      fontSize: 'clamp(12px, 3vw, 13px)',
                                      fontWeight: '500',
                                      color: '#374151',
                                      textAlign: 'center'
                                    }}>
                                      {editFormData.break_duration_minutes || 0}분
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* 7. 액션 버튼 */}
                            <div style={{ 
                              display: 'flex', 
                              gap: '12px', 
                              justifyContent: 'center',
                              alignItems: 'center',
                              marginTop: '20px',
                              paddingTop: '16px',
                              borderTop: '1px solid #e5e7eb'
                            }}>
                              <button
                                onClick={cancelEditSchedule}
                                style={{
                                  padding: 'clamp(12px, 3vw, 14px) clamp(20px, 5vw, 28px)',
                                  backgroundColor: '#6c757d',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  fontSize: 'clamp(14px, 3.5vw, 16px)',
                                  fontWeight: '600',
                                  minWidth: '80px',
                                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                }}
                              >
                                취소
                              </button>
                              <button
                                onClick={async () => {
                                  await saveEditedSchedule(request);
                                }}
                                style={{
                                  padding: 'clamp(12px, 3vw, 14px) clamp(20px, 5vw, 28px)',
                                  backgroundColor: '#007bff',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  fontSize: 'clamp(14px, 3.5vw, 16px)',
                                  fontWeight: '600',
                                  minWidth: '80px',
                                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                }}
                              >
                                수정 완료
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 액션 버튼 렌더링 */}
                      {renderActionButtons(request)}
                      
                      <div style={{ 
                        fontSize: 'clamp(9px, 2vw, 11px)',
                        color: '#9ca3af',
                        textAlign: 'right',
                        marginLeft: '6px',
                        marginTop: '8px'
                      }}>
                        요청일시: {new Date(request.created_at || Date.now()).toLocaleString('ko-KR')}
                        {request.schedule_group_id && (
                          <span style={{ marginLeft: 8 }}>
                            그룹ID: {request.schedule_group_id.substring(0, 8)}...
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                </div>

                {hasMore && (
                  <div style={{ textAlign: 'center', marginTop: 16 }}>
                    <button
                      onClick={handleLoadMore}
                      style={{
                        padding: 'clamp(8px, 2vw, 10px) clamp(16px, 4vw, 20px)',
                        backgroundColor: '#4caf50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: 'clamp(13px, 3vw, 15px)',
                        fontWeight: '500'
                      }}
                    >
                      더 보기
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
