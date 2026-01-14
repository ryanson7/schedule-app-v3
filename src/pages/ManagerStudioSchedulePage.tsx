//src/pages/ManagerStudioSchedulePage.tsx
"use client";
import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "../utils/supabaseClient";
import { logScheduleHistory, buildSnapshotFromSchedule } from "../utils/scheduleHistory";
import { SchedulePolicy } from "../utils/schedulePolicy";
import { ProfessorAutocomplete } from '../components/ProfessorAutocomplete';
import axios from 'axios';

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

// 30분 단위 휴식시간 옵션 생성
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

// 휴식시간 범위 제한 옵션 생성 (촬영 시간 내에서만)
const generateBreakTimeOptionsInRange = (startTime: string, endTime: string) => {
  if (!startTime || !endTime) return breakTimeOptions;
  
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  
  return breakTimeOptions.filter(time => {
    const timeMinutes = timeToMinutes(time);
    return timeMinutes > startMinutes && timeMinutes < endMinutes;
  });
};

// 수정된 날짜 옵션 생성 (주말 포함)
const generateAvailableDates = (testDate?: string | null, devMode?: boolean) => {
  const baseToday = testDate ? new Date(testDate) : new Date();
  
  if (devMode) {
    // 개발모드: 과거 30일부터 미래 90일까지 모든 날짜
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
  
  // 일반모드: 다음 주 월요일부터 2주간 모든 날짜 (주말 포함)
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

// 분을 시간으로 변환 (HH:MM 형식)
const minutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

// 휴식시간 자동 계산 함수 수정
const calculateBreakDuration = (startTime: string, endTime: string): number => {
  if (!startTime || !endTime) return 0;
  
  try {
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    const duration = endMinutes - startMinutes;
    
    return Math.max(0, duration);
  } catch (error) {
    console.error('휴식시간 계산 오류:', error);
    return 0;
  }
};

// 가능한 시간대 찾기 함수
const findAvailableTimeSlots = (
  schedules: any[],
  compatibleStudioIds: number[],
  durationMinutes: number
) => {
  const workStart = 9 * 60;   // 09:00
  const workEnd   = 22 * 60;  // 22:00
  const suggestions: {start: string; end: string}[] = [];

  // 30분 단위로 훑기
  for (let t = workStart; t <= workEnd - durationMinutes; t += 30) {
    const slotStart = t;
    const slotEnd   = t + durationMinutes;

    // 슬롯이 모든 스튜디오에서 겹치면 → 사용 불가
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
      if (suggestions.length === 3) break;          // 최대 3개만
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
  
  if (durationMinutes >= 240) { // 4시간 이상
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
  return durationMinutes > 240; // 4시간 초과로 변경
};

// 네이버웍스 전용 메시지 템플릿 - 수정된 버전
const generateAdminMessage = (
  requestType: 'approval' | 'edit' | 'cancel' | 'reapproval',
  schedule: any,
  managerName: string,
  reason?: string
) => {
  const typeMap = {
    approval: '승인요청',
    edit: '수정요청', 
    cancel: '취소요청',
    reapproval: '재승인요청'
  };

const generateNotificationMessage = async (requestType, scheduleId, reason) => {
  try {
    console.log('🔧 메시지 생성 시작:', { requestType, scheduleId });

    // 1. 현재 사용자의 부서 정보 조회
    const { data: { session } } = await supabase.auth.getSession();
    const currentUserId = session?.user?.id;
    
    if (!currentUserId) {
      throw new Error('로그인된 사용자를 찾을 수 없습니다.');
    }

    // 2. 사용자 정보 + 소속(organizations) 조회
    const { data: userInfo, error: userError } = await supabase
      .from('users')
      .select(`
        name,
        organizations:organizations_id ( name )
      `)
      .eq('auth_user_id', currentUserId)
      .single();

    if (userError) {
      console.warn('사용자 정보 조회 실패:', userError);
      // 폴백: localStorage에서 가져오기
      var fallbackName = localStorage.getItem('userName') || '관리자';
      var fallbackDept = '관리부서';
    }

    // 3. 스케줄 정보 + 스튜디오명 조회
    const { data: schedule, error: scheduleError } = await supabase
      .from('schedules')
      .select(`
        *,
        sub_locations:sub_location_id ( name )
      `)
      .eq('id', scheduleId)
      .single();

    if (scheduleError || !schedule) {
      throw new Error('스케줄 정보를 찾을 수 없습니다.');
    }

    // 4. 타입 매핑
    const typeMap = {
      'modification_request': '수정 요청',
      'cancellation_request': '취소 요청',
      'approval_request': '승인 요청'
    };

    // 5. 동적 메시지 생성
    const userName = userInfo?.name || fallbackName;
    const deptName = userInfo?.organizations?.name || fallbackDept;
    
    let message = `[촬영 ${typeMap[requestType]}] ${deptName} ${userName}\\n\\n`;
    message += `교수명: ${schedule.professor_name || '미상'}\\n`;
    message += `날짜: ${schedule.shoot_date || '미상'}\\n`;
    message += `시간: ${schedule.start_time?.substring(0,5) || '미상'}~${schedule.end_time?.substring(0,5) || '미상'}\\n`;
    
    // 스튜디오 정보 처리
    const studioInfo = schedule.sub_locations?.name 
      ? `${schedule.sub_locations.name}번 스튜디오`
      : `스튜디오 ${schedule.sub_location_id || '미상'}`;
    message += `스튜디오: ${studioInfo}\\n`;
    
    message += `강의명: ${schedule.course_name || '미상'}\\n\\n`;

    if (reason && reason.trim()) {
      message += `사유: ${reason}\\n\\n`;
    }

    message += `상세 확인 및 승인처리\\n`;
    message += `https://schedule.eduwill.net/admin?scheduleId=${schedule.id}`;

    console.log('✅ 메시지 생성 성공:', message.substring(0, 100) + '...');
    return message;

  } catch (error) {
    console.error('❌ 메시지 생성 실패:', error);
    
    // 최종 폴백 - 하드코딩 없는 기본 메시지
    const fallbackName = localStorage.getItem('userName') || '관리자';
    const fallbackMessage = `[촬영 요청] ${fallbackName}\\n\\n스케줄 ID: ${scheduleId}\\n사유: ${reason || '없음'}\\n\\n상세 확인: https://schedule.eduwill.net/admin?scheduleId=${scheduleId}`;
    
    return fallbackMessage;
  }
}

};



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
        Alt+Shift+D: 모드 토글<br/>
        과거/미래 모든 날짜 선택 가능<br/>
        localStorage.dev_mode = 'true'<br/>
        정책 테스트 가능
      </div>
    </div>
  );
};

// 제작센터 연락 모달
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
    professorName?: string;
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
            {scheduleInfo.professorName && (
              <>교수명: {scheduleInfo.professorName}<br/></>
            )}
            강좌명: {scheduleInfo.courseName || '미입력'}<br/>
            촬영일: {scheduleInfo.date}<br/>
            {scheduleInfo.startTime && scheduleInfo.endTime && (
              <>촬영시간: {scheduleInfo.startTime} ~ {scheduleInfo.endTime}<br/></>
            )}
            <br/>
            <strong>촬영확정 또는 온라인 수정 기간이 종료되었습니다.</strong><br/>
            수정이 필요한 경우 제작센터에 변경사항을 전달해 주시면 확인해드리겠습니다.
          </div>
        </div>

        <div style={{
          padding: '12px',
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          marginBottom: '16px',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{
            fontSize: 'clamp(12px, 3vw, 14px)',
            color: '#475569',
            fontWeight: '500',
            textAlign: 'center'
          }}>
            제작센터 연락처<br/>
            <strong style={{ fontSize: 'clamp(14px, 3.5vw, 16px)' }}>
              02-1234-5678
            </strong><br/>
            (평일 09:00 ~ 18:00)
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
              backgroundColor: '#3b82f6',
              color: 'white',
              cursor: 'pointer',
              fontSize: 'clamp(14px, 3.5vw, 16px)',
              fontWeight: '500'
            }}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};

// 승인 요청 모달
const ApprovalRequestModal = ({ 
  open, 
  onClose, 
  onConfirm,
  schedule,
  requestType 
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  schedule: any;
  requestType: 'edit' | 'cancel';
}) => {
  const [reason, setReason] = useState('');

  if (!open) return null;

  const handleSubmit = () => {
    if (!reason.trim()) {
      alert('사유를 입력해주세요.');
      return;
    }
    onConfirm(reason);
    setReason('');
  };

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
      zIndex: 2000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        width: '90vw',
        maxWidth: '500px',
        padding: '24px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
      }}>
        <h3 style={{ 
          margin: '0 0 16px 0', 
          fontSize: '18px', 
          fontWeight: '600',
          color: '#1f2937'
        }}>
          {requestType === 'edit' ? '수정' : '취소'} 승인 요청
        </h3>

        <div style={{
          padding: '12px',
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          marginBottom: '16px',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ fontSize: '14px', color: '#475569', lineHeight: '1.5' }}>
            <strong>스케줄 정보:</strong><br/>
            교수명: {schedule?.professor_name}<br/>
            촬영일: {schedule?.shoot_date}<br/>
            촬영시간: {schedule?.start_time?.substring(0,5)} ~ {schedule?.end_time?.substring(0,5)}<br/>
            과정명: {schedule?.course_name || '없음'}
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '6px', 
            fontWeight: '500',
            color: '#374151'
          }}>
            {requestType === 'edit' ? '수정' : '취소'} 사유 *
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={`${requestType === 'edit' ? '수정' : '취소'} 사유를 상세히 입력해주세요`}
            rows={4}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              resize: 'vertical',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          justifyContent: 'flex-end' 
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              backgroundColor: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: requestType === 'edit' ? '#3b82f6' : '#dc2626',
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            승인 요청
          </button>
        </div>
      </div>
    </div>
  );
};

// 스케줄 상세보기 모달
const ScheduleDetailModal = ({
  open,
  onClose,
  schedule,
  onEdit,
  onCancel,
  isPastSchedule,
  isCancelledSchedule,
  canEditSchedule,
  getStatusInfo,
  userRoles
}: {
  open: boolean;
  onClose: () => void;
  schedule: any;
  onEdit?: () => void;
  onCancel?: () => void;
  isPastSchedule: (date: string) => boolean;
  isCancelledSchedule: (schedule: any) => boolean;
  canEditSchedule: (schedule: any) => boolean;
  getStatusInfo: (status: string, isActive?: boolean) => any;
  userRoles?: string[];
}) => {
  // 관리자 권한 확인 함수
  const isAdmin = () => {
    return userRoles?.includes('academy_manager') || 
           userRoles?.includes('studio_manager') || 
           userRoles?.includes('system_admin');
  };

  if (!open || !schedule) return null;

  const isPast = isPastSchedule(schedule.shoot_date);
  const isCancelled = isCancelledSchedule(schedule);
  const statusInfo = getStatusInfo(schedule.approval_status, schedule.is_active);
  const canEdit = canEditSchedule(schedule);

  // 분할 스케줄 시간 표시 로직
  const getDisplayTimeRange = (schedule: any) => {
    if (schedule.is_grouped && schedule.grouped_schedules && schedule.grouped_schedules.length > 1) {
      const sortedSchedules = schedule.grouped_schedules.sort((a, b) => a.sequence_order - b.sequence_order);
      const firstSchedule = sortedSchedules[0];
      const lastSchedule = sortedSchedules[sortedSchedules.length - 1];
      
      return {
        full: `${firstSchedule.start_time?.substring(0,5)} ~ ${lastSchedule.end_time?.substring(0,5)}`,
        segments: sortedSchedules.map((s, index) => ({
          label: `${index + 1}차`,
          time: `${s.start_time?.substring(0,5)} ~ ${s.end_time?.substring(0,5)}`
        })),
        breakTime: schedule.break_time_enabled && schedule.break_start_time && schedule.break_end_time ? 
          `${schedule.break_start_time?.substring(0,5)} ~ ${schedule.break_end_time?.substring(0,5)}` : null
      };
    }
    
    return {
      full: `${schedule.start_time?.substring(0,5)} ~ ${schedule.end_time?.substring(0,5)}`,
      segments: [],
      breakTime: null
    };
  };
  
  const timeDisplay = getDisplayTimeRange(schedule);

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
      zIndex: 2000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '600px',
        maxHeight: '90vh',
        overflow: 'auto',
        padding: '24px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
      }}>
        {/* 헤더 */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '20px',
          paddingBottom: '12px',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <h3 style={{ 
            margin: 0, 
            fontSize: '18px', 
            fontWeight: '600',
            color: '#1f2937'
          }}>
            스케줄 상세 정보
          </h3>
          <button 
            onClick={onClose} 
            style={{ 
              background: 'none', 
              border: 'none', 
              fontSize: '24px', 
              cursor: 'pointer',
              color: '#6b7280'
            }}
          >
            ×
          </button>
        </div>

        {/* 상태 배지 */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            display: 'inline-block',
            backgroundColor: statusInfo.bg,
            color: statusInfo.color,
            padding: '6px 12px',
            borderRadius: '16px',
            fontSize: '12px',
            fontWeight: '500'
          }}>
            {statusInfo.text}
          </div>
        </div>

        {/* 기본 정보 */}
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ 
            margin: '0 0 12px 0', 
            fontSize: '16px', 
            fontWeight: '600',
            color: '#374151'
          }}>
            기본 정보
          </h4>
          
          <div style={{ display: 'grid', gap: '8px' }}>
            <div style={{ display: 'flex' }}>
              <span style={{ 
                minWidth: '80px', 
                fontWeight: '500', 
                color: '#6b7280' 
              }}>
                교수명:
              </span>
              <span style={{ color: '#1f2937' }}>{schedule.professor_name}</span>
            </div>
            
            <div style={{ display: 'flex' }}>
              <span style={{ 
                minWidth: '80px', 
                fontWeight: '500', 
                color: '#6b7280' 
              }}>
                과정명:
              </span>
              <span style={{ color: '#1f2937' }}>{schedule.course_name || '미입력'}</span>
            </div>
            
            <div style={{ display: 'flex' }}>
              <span style={{ 
                minWidth: '80px', 
                fontWeight: '500', 
                color: '#6b7280' 
              }}>
                과정코드:
              </span>
              <span style={{ color: '#1f2937' }}>{schedule.course_code || '미입력'}</span>
            </div>
            
            <div style={{ display: 'flex' }}>
              <span style={{ 
                minWidth: '80px', 
                fontWeight: '500', 
                color: '#6b7280' 
              }}>
                촬영일:
              </span>
              <span style={{ color: '#1f2937' }}>{schedule.shoot_date}</span>
            </div>
            
            <div style={{ display: 'flex' }}>
              <span style={{ 
                minWidth: '80px', 
                fontWeight: '500', 
                color: '#6b7280' 
              }}>
                전체시간:
              </span>
              <span style={{ color: '#1f2937' }}>{timeDisplay.full}</span>
            </div>
            
            <div style={{ display: 'flex' }}>
              <span style={{ 
                minWidth: '80px', 
                fontWeight: '500', 
                color: '#6b7280' 
              }}>
                촬영형식:
              </span>
              <span style={{ color: '#1f2937' }}>{schedule.shooting_type}</span>
            </div>
            
            <div style={{ display: 'flex' }}>
              <span style={{ 
                minWidth: '80px', 
                fontWeight: '500', 
                color: '#6b7280' 
              }}>
                스튜디오:
              </span>
              <span style={{ color: '#1f2937' }}>
                {schedule.sub_locations?.name || '스튜디오'}
              </span>
            </div>
          </div>
        </div>

        {/* 개선된 촬영 일정 상세 표시 */}
        {schedule.is_grouped && schedule.grouped_schedules && schedule.grouped_schedules.length > 1 && (
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ 
              margin: '0 0 12px 0', 
              fontSize: '16px', 
              fontWeight: '600',
              color: '#374151'
            }}>
              촬영 일정 상세
            </h4>
            
            <div style={{
              padding: '12px',
              backgroundColor: '#f0f9ff',
              borderRadius: '8px',
              border: '1px solid #dbeafe'
            }}>
              {/* 1차 촬영 */}
              <div style={{
                padding: '6px 8px',
                backgroundColor: '#f8fafc',
                borderRadius: '6px',
                marginBottom: '6px',
                fontSize: '13px',
                color: '#1e40af'
              }}>
                <div style={{ fontWeight: '500' }}>
                  1차 촬영: {schedule.grouped_schedules[0]?.start_time?.substring(0,5)} ~ {schedule.break_start_time?.substring(0,5)}
                </div>
              </div>
              
              {/* 휴식시간 */}
              {schedule.break_time_enabled && schedule.break_start_time && schedule.break_end_time && (
                <div style={{
                  padding: '6px 8px',
                  backgroundColor: '#f3e8ff',
                  borderRadius: '6px',
                  marginBottom: '6px',
                  fontSize: '13px',
                  color: '#7c3aed',
                  fontWeight: '500'
                }}>
                  휴식시간: {schedule.break_start_time?.substring(0,5)} ~ {schedule.break_end_time?.substring(0,5)}
                </div>
              )}
              
              {/* 2차 촬영 */}
              {schedule.grouped_schedules[1] && (
                <div style={{
                  padding: '6px 8px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: '#1e40af'
                }}>
                  <div style={{ fontWeight: '500' }}>
                    2차 촬영: {schedule.break_end_time?.substring(0,5)} ~ {schedule.grouped_schedules[1]?.end_time?.substring(0,5)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 비고 */}
        {schedule.notes && (
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ 
              margin: '0 0 8px 0', 
              fontSize: '16px', 
              fontWeight: '600',
              color: '#374151'
            }}>
              비고
            </h4>
            <div style={{
              padding: '12px',
              backgroundColor: '#f9fafb',
              borderRadius: '6px',
              fontSize: '14px',
              color: '#4b5563',
              lineHeight: '1.5'
            }}>
              {schedule.notes}
            </div>
          </div>
        )}

        {/* 취소 사유 표시 */}
        {(isCancelled || schedule.approval_status === 'cancelled') && schedule.cancellation_reason && (
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ 
              margin: '0 0 8px 0', 
              fontSize: '16px', 
              fontWeight: '600',
              color: '#dc2626'
            }}>
              취소 사유
            </h4>
            <div style={{
              padding: '12px',
              backgroundColor: '#fef2f2',
              borderRadius: '6px',
              border: '1px solid #fecaca',
              fontSize: '14px',
              color: '#991b1b',
              lineHeight: '1.5'
            }}>
              {schedule.cancellation_reason}
            </div>
          </div>
        )}

        {/* 관리 정보 */}
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ 
            margin: '0 0 12px 0', 
            fontSize: '16px', 
            fontWeight: '600',
            color: '#374151'
          }}>
            관리 정보
          </h4>
          
          <div style={{ display: 'grid', gap: '8px', fontSize: '13px' }}>
            <div style={{ display: 'flex' }}>
              <span style={{ 
                minWidth: '100px', 
                fontWeight: '500', 
                color: '#6b7280' 
              }}>
                등록일시:
              </span>
              <span style={{ color: '#1f2937' }}>
                {schedule.created_at ? new Date(schedule.created_at).toLocaleString('ko-KR') : '미상'}
              </span>
            </div>
            
            {schedule.updated_at && schedule.updated_at !== schedule.created_at && (
              <div style={{ display: 'flex' }}>
                <span style={{ 
                  minWidth: '100px', 
                  fontWeight: '500', 
                  color: '#6b7280' 
                }}>
                  승인일시:
                </span>
                <span style={{ color: '#059669', fontWeight: '500' }}>
                  {new Date(schedule.updated_at).toLocaleString('ko-KR')}
                </span>
              </div>
            )}

            {schedule.modification_reason && (
              <div style={{ display: 'flex' }}>
                <span style={{ 
                  minWidth: '100px', 
                  fontWeight: '500', 
                  color: '#6b7280' 
                }}>
                  수정내역:
                </span>
                <span style={{ color: '#059669', fontSize: '12px' }}>
                  {schedule.modification_reason}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 버튼 영역 - 수정된 조건 */}
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          justifyContent: 'flex-end',
          paddingTop: '16px',
          borderTop: '1px solid #e5e7eb'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              backgroundColor: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            닫기
          </button>
          
          {/* modification_approved 포함하여 매니저 수정 가능 */}
          {canEdit && !isPast && !isCancelled && 
           (schedule.approval_status === 'approved' || 
            schedule.approval_status === 'confirmed' || 
            schedule.approval_status === 'modification_approved') && onEdit && (
            <button
              onClick={() => {
                onEdit();
                onClose();
              }}
              style={{
                padding: '10px 20px',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: '#059669',
                color: 'white',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              수정
            </button>
          )}
          
          {canEdit && !isPast && !isCancelled && 
           (schedule.approval_status === 'approved' || 
            schedule.approval_status === 'confirmed' || 
            schedule.approval_status === 'modification_approved') && onCancel && (
            <button
              onClick={() => {
                onCancel();
                onClose();
              }}
              style={{
                padding: '10px 20px',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: '#dc2626',
                color: 'white',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              취소
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// 수정 모달 컴포넌트
const EditScheduleModal = ({
  open,
  onClose,
  schedule,
  onSave,
  shootingTypes,
  availableDates
}: {
  open: boolean;
  onClose: () => void;
  schedule: any;
  onSave: (updatedData: any) => Promise<void>;
  shootingTypes: any[];
  availableDates: any[];
}) => {
  const [editData, setEditData] = useState({
    shoot_date: '',
    start_time: '',
    end_time: '',
    professor_name: '',
    course_name: '',
    course_code: '',
    shooting_type: '',
    notes: '',
    break_time_enabled: false,
    break_start_time: '',
    break_end_time: '',
    break_duration_minutes: 0
  });

  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [selectedProfessorInfo, setSelectedProfessorInfo] = useState<any>(null);

  // 기존 데이터 로딩 (분할 스케줄 고려) - 비고란에서 1차, 2차 텍스트 제거
  useEffect(() => {
    if (open && schedule) {
      const normalizeTime = (timeValue: any): string => {
        if (!timeValue) return '';
        const timeStr = String(timeValue).trim();
        if (/^\d{2}:\d{2}$/.test(timeStr)) return timeStr;
        if (/^\d{2}:\d{2}:\d{2}$/.test(timeStr)) return timeStr.substring(0, 5);
        return '';
      };

      // 분할 스케줄 휴식시간 자동 감지
      let breakTimeEnabled = false;
      let breakStartTime = '';
      let breakEndTime = '';
      let breakDurationMinutes = 0;

      if (schedule.is_grouped && schedule.grouped_schedules && schedule.grouped_schedules.length > 1) {
        const sortedSchedules = schedule.grouped_schedules.sort((a, b) => a.sequence_order - b.sequence_order);
        const firstSchedule = sortedSchedules[0];
        const secondSchedule = sortedSchedules[1];
        
        if (firstSchedule.end_time && secondSchedule.start_time) {
          breakTimeEnabled = true;
          breakStartTime = normalizeTime(firstSchedule.end_time);
          breakEndTime = normalizeTime(secondSchedule.start_time);
          breakDurationMinutes = calculateBreakDuration(breakStartTime, breakEndTime);
        }
      } else if (schedule.break_time_enabled) {
        breakTimeEnabled = true;
        breakStartTime = normalizeTime(schedule.break_start_time);
        breakEndTime = normalizeTime(schedule.break_end_time);
        breakDurationMinutes = schedule.break_duration_minutes || calculateBreakDuration(breakStartTime, breakEndTime);
      }

      // 비고란에서 [1차 촬영], [2차 촬영] 텍스트 완전 제거
      const cleanNotes = (notes: string) => {
        if (!notes) return '';
        return notes
          .replace(/\s*\[1차\s*촬영\]/g, '')
          .replace(/\s*\[2차\s*촬영\]/g, '')
          .trim();
      };

      const normalizedData = {
        shoot_date: schedule.shoot_date || '',
        start_time: normalizeTime(schedule.start_time),
        end_time: schedule.is_grouped && schedule.grouped_schedules?.length > 1 
          ? normalizeTime(schedule.grouped_schedules[schedule.grouped_schedules.length - 1].end_time)
          : normalizeTime(schedule.end_time),
        professor_name: schedule.professor_name || '',
        course_name: schedule.course_name || '',
        course_code: schedule.course_code || '',
        shooting_type: schedule.shooting_type || '',
        notes: cleanNotes(schedule.notes || ''),
        break_time_enabled: breakTimeEnabled,
        break_start_time: breakStartTime || '',
        break_end_time: breakEndTime || '',
        break_duration_minutes: breakDurationMinutes || 0
      };

      setEditData(normalizedData);
    }
  }, [open, schedule]);

  const handleProfessorChange = (value: string, professor?: any) => {
    setEditData(prev => ({ ...prev, professor_name: value }));
    if (professor) {
      setSelectedProfessorInfo({
        id: professor.id,
        category_name: professor.category_name
      });
    } else {
      setSelectedProfessorInfo(null);
    }
  };

  // 휴식시간 실시간 계산
  const handleBreakTimeChange = (field: 'break_start_time' | 'break_end_time', value: string) => {
    const newData = { ...editData, [field]: value };
    
    if (newData.break_start_time && newData.break_end_time) {
      const duration = calculateBreakDuration(newData.break_start_time, newData.break_end_time);
      newData.break_duration_minutes = duration;
    }
    
    setEditData(newData);
  };

  const validateEditForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!editData.shoot_date) newErrors.shoot_date = '촬영 날짜를 선택해주세요';
    if (!editData.start_time) newErrors.start_time = '시작 시간을 선택해주세요';
    if (!editData.end_time) newErrors.end_time = '종료 시간을 선택해주세요';
    if (!editData.professor_name) newErrors.professor_name = '교수명을 입력해주세요';
    if (!editData.shooting_type) newErrors.shooting_type = '촬영 형식을 선택해주세요';

    if (editData.start_time && editData.end_time && editData.start_time >= editData.end_time) {
      newErrors.end_time = '종료 시간은 시작 시간보다 늦어야 합니다';
    }

    setEditErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateEditForm()) {
      alert('필수 항목을 모두 입력해주세요');
      return;
    }

    try {
      await onSave(editData);
      onClose();
    } catch (error) {
      console.error('수정 저장 오류:', error);
      alert('수정 중 오류가 발생했습니다');
    }
  };

  if (!open) return null;

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
      zIndex: 2000,
      padding: '10px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '600px',
        maxHeight: '95vh',
        overflow: 'auto',
        padding: '20px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
      }}>
        {/* 헤더 */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '16px',
          paddingBottom: '8px',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <h3 style={{ 
            margin: 0, 
            fontSize: '18px', 
            fontWeight: '600' 
          }}>
            스케줄 수정
          </h3>
          <button 
            onClick={onClose} 
            style={{ 
              background: 'none', 
              border: 'none', 
              fontSize: '24px', 
              cursor: 'pointer' 
            }}
          >
            ×
          </button>
        </div>

        {/* 육하원칙 순서로 재배열된 폼 */}
        <div style={{ display: 'grid', gap: '12px' }}>
          
          {/* 1. 누가(Who): 교수명 */}
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '14px' }}>
              교수명 *
            </label>
            <div style={{ width: '100%' }}>
              <ProfessorAutocomplete
                value={editData.professor_name}
                onChange={handleProfessorChange}
                placeholder="교수명을 입력하세요"
                disabled={false}
                required
                style={{
                  width: '100%',
                  fontSize: '14px',
                  padding: '8px',
                  borderColor: editErrors.professor_name ? '#f44336' : '#d1d5db'
                }}
              />
            </div>
            {editErrors.professor_name && (
              <span style={{ color: '#f44336', fontSize: '11px' }}>{editErrors.professor_name}</span>
            )}
          </div>

          {/* 2. 언제(When): 날짜 */}
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '14px' }}>
              촬영 날짜 *
            </label>
            <select
              value={editData.shoot_date}
              onChange={(e) => setEditData(prev => ({ ...prev, shoot_date: e.target.value }))}
              style={{
                width: '100%',
                padding: '8px',
                border: `1px solid ${editErrors.shoot_date ? '#f44336' : '#d1d5db'}`,
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            >
              <option value="">날짜 선택</option>
              {availableDates.map(date => (
                <option key={date.value} value={date.value}>{date.label}</option>
              ))}
            </select>
            {editErrors.shoot_date && (
              <span style={{ color: '#f44336', fontSize: '11px' }}>{editErrors.shoot_date}</span>
            )}
          </div>

          {/* 3. 언제(When): 시간 */}
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '14px' }}>
              촬영 시간 *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '8px', alignItems: 'center' }}>
              <select
                value={editData.start_time}
                onChange={(e) => setEditData(prev => ({ ...prev, start_time: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: `1px solid ${editErrors.start_time ? '#f44336' : '#d1d5db'}`,
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              >
                <option value="">시작 시간</option>
                {timeOptions.map(time => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
              <span style={{ fontSize: '14px', fontWeight: '500', padding: '0 4px' }}>~</span>
              <select
                value={editData.end_time}
                onChange={(e) => setEditData(prev => ({ ...prev, end_time: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: `1px solid ${editErrors.end_time ? '#f44336' : '#d1d5db'}`,
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              >
                <option value="">종료 시간</option>
                {timeOptions.map(time => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
            </div>
            {(editErrors.start_time || editErrors.end_time) && (
              <div style={{ marginTop: '2px' }}>
                {editErrors.start_time && (
                  <span style={{ color: '#f44336', fontSize: '11px', display: 'block' }}>
                    {editErrors.start_time}
                  </span>
                )}
                {editErrors.end_time && (
                  <span style={{ color: '#f44336', fontSize: '11px', display: 'block' }}>
                    {editErrors.end_time}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 4. 무엇을(What): 과정명 + 과정코드 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '14px' }}>
                과정명
              </label>
              <input
                type="text"
                value={editData.course_name}
                onChange={(e) => setEditData(prev => ({ ...prev, course_name: e.target.value }))}
                placeholder="예: 9급공무원"
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '14px' }}>
                과정코드
              </label>
              <input
                type="text"
                value={editData.course_code}
                onChange={(e) => setEditData(prev => ({ ...prev, course_code: e.target.value }))}
                placeholder="PUB001"
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* 5. 어떻게(How): 촬영형식 */}
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '14px' }}>
              촬영 형식 *
            </label>
            <select
              value={editData.shooting_type}
              onChange={(e) => setEditData(prev => ({ ...prev, shooting_type: e.target.value }))}
              style={{
                width: '100%',
                padding: '8px',
                border: `1px solid ${editErrors.shooting_type ? '#f44336' : '#d1d5db'}`,
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            >
              <option value="">촬영 형식 선택</option>
              {shootingTypes.map(type => (
                <option key={type.id} value={type.name}>{type.name}</option>
              ))}
            </select>
            {editErrors.shooting_type && (
              <span style={{ color: '#f44336', fontSize: '11px' }}>{editErrors.shooting_type}</span>
            )}
          </div>

          {/* 6. 어떻게(How): 휴식시간 설정 - 4시간 이상일 때만 표시 */}
          {shouldShowBreakTimeSettings(editData.start_time, editData.end_time) && (
            <div style={{
              padding: '12px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              border: '1px solid #dee2e6'
            }}>
              <div style={{ marginBottom: '10px' }}>
                <label style={{
                  display: 'flex', alignItems: 'center', cursor: 'pointer',
                  fontSize: '14px', fontWeight: '500'
                }}>
                  <input
                    type="checkbox"
                    checked={editData.break_time_enabled}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      if (enabled) {
                        const suggestion = checkBreakTimeRecommendation(editData.start_time, editData.end_time);
                        const suggested = suggestion.suggestedBreakTime;
                        const startTime = suggested?.startTime || '12:00';
                        const endTime = suggested?.endTime || '13:00';
                        const duration = calculateBreakDuration(startTime, endTime);
                        setEditData(prev => ({
                          ...prev,
                          break_time_enabled: true,
                          break_start_time: startTime,
                          break_end_time: endTime,
                          break_duration_minutes: duration
                        }));
                      } else {
                        setEditData(prev => ({
                          ...prev,
                          break_time_enabled: false,
                          break_start_time: '',
                          break_end_time: '',
                          break_duration_minutes: 0
                        }));
                      }
                    }}
                    style={{ marginRight: '8px', transform: 'scale(1.1)' }}
                  />
                  휴식시간 사용
                </label>
              </div>

              {editData.break_time_enabled && (
                <div style={{
                  padding: '10px',
                  backgroundColor: '#f0f9ff',
                  borderRadius: '6px',
                  border: '1px solid #dbeafe'
                }}>
                  <div style={{
                    display: 'grid', 
                    gridTemplateColumns: '1fr auto 1fr auto',
                    gap: '6px', 
                    alignItems: 'center',
                    marginBottom: '8px'
                  }}>
                    <select
                      value={editData.break_start_time}
                      onChange={(e) => handleBreakTimeChange('break_start_time', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        fontSize: '12px',
                        textAlign: 'center',
                        boxSizing: 'border-box'
                      }}>
                      {generateBreakTimeOptionsInRange(editData.start_time, editData.end_time).map(time => (
                        <option key={time} value={time}>{time}</option>
                      ))}
                    </select>
                    
                    <span style={{ fontSize: '12px', padding: '0 2px' }}>~</span>
                    
                    <select
                      value={editData.break_end_time}
                      onChange={(e) => handleBreakTimeChange('break_end_time', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        fontSize: '12px',
                        textAlign: 'center',
                        boxSizing: 'border-box'
                      }}>
                      {generateBreakTimeOptionsInRange(editData.start_time, editData.end_time).map(time => (
                        <option key={time} value={time}>{time}</option>
                      ))}
                    </select>
                    
                    <div style={{
                      padding: '6px', 
                      backgroundColor: 'white', 
                      borderRadius: '4px',
                      border: '1px solid #d1d5db', 
                      fontSize: '12px', 
                      fontWeight: '500',
                      textAlign: 'center',
                      minWidth: '50px'
                    }}>
                      {editData.break_duration_minutes}분
                    </div>
                  </div>
                  
                  <div style={{
                    padding: '6px', 
                    backgroundColor: 'white', 
                    borderRadius: '4px',
                    fontSize: '11px', 
                    border: '1px solid #e5e7eb',
                    color: '#6b7280'
                  }}>
                    1차({editData.start_time}~{editData.break_start_time}) → 휴식({editData.break_duration_minutes}분) → 2차({editData.break_end_time}~{editData.end_time})
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 7. 기타: 비고 */}
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '14px' }}>
              비고
            </label>
            <textarea
              value={editData.notes}
              onChange={(e) => setEditData(prev => ({ ...prev, notes: e.target.value }))}
              rows={2}
              placeholder="특이사항이나 요청사항을 입력해주세요"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* 버튼 */}
          <div style={{ 
            display: 'flex', 
            gap: '8px', 
            justifyContent: 'flex-end', 
            marginTop: '8px',
            paddingTop: '12px',
            borderTop: '1px solid #e5e7eb'
          }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                backgroundColor: 'white',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              취소
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: '#3b82f6',
                color: 'white',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface StudioScheduleFormData {
  shoot_date: string;
  start_time: string;
  end_time: string;
  professor_name: string;
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

export default function ManagerStudioSchedulePage() {
  // 개발모드 상태
  const [isDevModeActive, setIsDevModeActive] = useState(false);
  const [showDevMode, setShowDevMode] = useState(false);
  const [testDate, setTestDate] = useState<string | null>(null);
  
  // 매니저 정보 상태
  const [managerInfo, setManagerInfo] = useState<any>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [showScheduleList, setShowScheduleList] = useState(false);
  const [allSchedules, setAllSchedules] = useState<any[]>([]);
  const [totalScheduleCount, setTotalScheduleCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  
  const [shootingTypes, setShootingTypes] = useState<ShootingType[]>([]);
  const [compatibleStudios, setCompatibleStudios] = useState<any[]>([]);
  const [studioLocations, setStudioLocations] = useState<any[]>([]);
  const [shootingTypeMappings, setShootingTypeMappings] = useState<any[]>([]);
  const [availableDates, setAvailableDates] = useState<any[]>([]);
  
  const [searchFilters, setSearchFilters] = useState({
    professor_name: '',
    start_date: '',
    end_date: '',
    limit: 10,
    offset: 0
  });
  const [isSearching, setIsSearching] = useState(false);
  
  // 수정/취소 모달 상태
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactScheduleInfo, setContactScheduleInfo] = useState({
    date: '',
    daysLeft: 0,
    courseName: '',
    professorName: '',
    startTime: '',
    endTime: ''
  });

  // 승인 요청 모달 상태
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalRequestType, setApprovalRequestType] = useState<'edit' | 'cancel' | 'reapproval'>('edit');
  const [approvalSchedule, setApprovalSchedule] = useState<any>(null);

  // 수정 모달 상태
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<any>(null);
  
  // 상세보기 모달 상태
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailSchedule, setDetailSchedule] = useState<any>(null);
  
  // 정책 상태
  const [registrationInfo, setRegistrationInfo] = useState({
    startDate: '',
    endDate: '',
    weekInfo: '',
    period: ''
  });
  
  const [formData, setFormData] = useState<StudioScheduleFormData>({
    shoot_date: '',
    start_time: '',
    end_time: '',
    professor_name: '',
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
  const [selectedProfessorInfo, setSelectedProfessorInfo] = useState<any>(null);

  // 승인 상태 판별 함수 추가
  const isScheduleApproved = (schedule: any): boolean => {
    return schedule.approval_status === 'approved' || 
           schedule.approval_status === 'confirmed' ||
           schedule.approval_status === 'modification_approved';
  };

  // 교수 자동완성 핸들러
  const handleProfessorChange = (value: string, professor?: any) => {
    try {
      // 안전한 값 설정
      setFormData(prev => ({
        ...prev,
        professor_name: value || ''
      }));

      // 교수 정보 처리 (안전하게)
      if (professor && professor.category_name) {
        setSelectedProfessorInfo({
          id: professor.id,
          category_name: professor.category_name
        });
      } else {
        setSelectedProfessorInfo(null);
      }
    } catch (error) {
      console.error('교수 정보 처리 오류:', error);
      // 오류 발생 시 기본값 설정
      setFormData(prev => ({
        ...prev,
        professor_name: value || ''
      }));
      setSelectedProfessorInfo(null);
    }
  };


  // 개발 모드 키보드 단축키
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

  // 개발모드 연동 가용일자 옵션
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

    const status = SchedulePolicy.getStatusMessage(testDate);
  }, [testDate, isDevModeActive]);

  useEffect(() => {
    fetchManagerInfo();
    fetchShootingTypes();
    fetchStudioLocations();
    fetchShootingTypeMappings();
  }, []);

  useEffect(() => {
    if (managerInfo && showScheduleList) {
      fetchAllSchedules(false);
    }
  }, [managerInfo, showScheduleList]);

  // 매니저 정보 조회 함수
  const fetchManagerInfo = async () => {
    const userRole = localStorage.getItem('userRole');
    const userEmail = localStorage.getItem('userEmail');
    const userName = localStorage.getItem('userName');
    
    if (userRole && userEmail) {
      setUserRoles([userRole]);
      
      const mockManagerInfo = {
        id: 301,
        name: userName || '테스트매니저',
        email: userEmail,
        role: userRole,
        department: '영상개발실'
      };
      
      setManagerInfo(mockManagerInfo);
    }
  };

  const fetchShootingTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('shooting_types')
        .select('*')
        .eq('is_active', true)
        .order('id');

      if (error) throw error;
      setShootingTypes(data || []);
    } catch (error) {
      console.error('촬영형식 조회 오류:', error);
      setShootingTypes([]);
    }
  };

  const fetchStudioLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('sub_locations')
        .select(`
          *,
          main_locations(name)
        `)
        .eq('is_active', true)
        .order('id');

      if (error) throw error;
      setStudioLocations(data || []);
    } catch (error) {
      console.error('스튜디오 위치 조회 오류:', error);
      setStudioLocations([]);
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

  // 매니저 페이지용 스케줄 그룹핑 함수
  const groupSchedulesForManager = (schedules: any[]) => {
    const groupMap = new Map();
    const singleSchedules = [];

    schedules.forEach(schedule => {
      if (schedule.schedule_group_id && schedule.is_split_schedule) {
        // 분할 스케줄인 경우 그룹으로 묶기
        if (!groupMap.has(schedule.schedule_group_id)) {
          groupMap.set(schedule.schedule_group_id, []);
        }
        groupMap.get(schedule.schedule_group_id).push(schedule);
      } else {
        // 단일 스케줄인 경우 그대로 추가
        singleSchedules.push(schedule);
      }
    });

    // 그룹된 스케줄들을 통합 스케줄 객체로 변환
    const groupedSchedules = [];
    
    groupMap.forEach((groupSchedules, groupId) => {
      // 시간순 정렬
      const sortedSchedules = groupSchedules.sort((a, b) => a.sequence_order - b.sequence_order);
      const firstSchedule = sortedSchedules[0];
      const lastSchedule = sortedSchedules[sortedSchedules.length - 1];
      
      // 통합 스케줄 객체 생성
      const groupedSchedule = {
        ...firstSchedule, // 기본 정보는 첫 번째 스케줄에서
        id: `group_${groupId}`, // 그룹 ID로 변경
        start_time: firstSchedule.start_time,
        end_time: lastSchedule.end_time,
        is_grouped: true, // 그룹 스케줄임을 표시
        grouped_schedules: sortedSchedules, // 개별 스케줄들 저장
        // 비고에서 [1차 촬영], [2차 촬영] 텍스트 제거
        notes: firstSchedule.notes?.replace(/\s*\[1차\s*촬영\]|\[2차\s*촬영\]/g, '').trim() || '',
        // 휴식시간 정보 포함
        break_time_enabled: firstSchedule.break_time_enabled,
        break_start_time: firstSchedule.break_start_time,
        break_end_time: firstSchedule.break_end_time,
        break_duration_minutes: firstSchedule.break_duration_minutes
      };
      
      groupedSchedules.push(groupedSchedule);
    });

    // 단일 스케줄과 그룹 스케줄 합치고 생성일자 순 정렬
    const allSchedules = [...singleSchedules, ...groupedSchedules];
    return allSchedules.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  };

  // 전체 스케줄 조회 함수 - 분할 스케줄 그룹핑 적용
  const fetchAllSchedules = async (useFilters = false) => {
    if (!managerInfo) return;

    setIsSearching(true);

    try {
      let query = supabase
        .from('schedules')
        .select(
          `
            *,
            sub_locations(name, main_locations(name)),
            cancellation_reason,
            modification_reason,
            deletion_reason
          `, 
          { count: 'exact' }
        )
        .eq('schedule_type', 'studio')
        .eq('is_active', true)
        .neq('approval_status', 'cancelled')
        .is('deletion_reason', null)
        .order('created_at', { ascending: false })
        .range(searchFilters.offset, searchFilters.offset + searchFilters.limit - 1);

      if (useFilters && searchFilters.professor_name) {
        query = query.ilike('professor_name', `%${searchFilters.professor_name}%`);
      }

      if (useFilters && searchFilters.start_date) {
        query = query.gte('shoot_date', searchFilters.start_date);
      }
      if (useFilters && searchFilters.end_date) {
        query = query.lte('shoot_date', searchFilters.end_date);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      const cleanedData = (data || []).filter(schedule => {
        return schedule.is_active === true && 
               schedule.approval_status !== 'cancelled' && 
               !schedule.deletion_reason;
      });

      // 매니저 페이지용 그룹핑 처리
      const groupedSchedules = groupSchedulesForManager(cleanedData);

      setAllSchedules(groupedSchedules);
      setTotalScheduleCount(count || 0);
      setHasMore((data?.length || 0) === searchFilters.limit);

    } catch (err) {
      console.error('스케줄 목록 조회 오류:', err);
    } finally {
      setIsSearching(false);
    }
  };

  // 검색 핸들러들
  const handleSearch = () => {
    setSearchFilters(prev => ({ ...prev, offset: 0 }));
    fetchAllSchedules(true);
  };

  const handleResetSearch = () => {
    setSearchFilters({
      professor_name: '',
      start_date: '',
      end_date: '',
      limit: 10,
      offset: 0
    });
    fetchAllSchedules(false);
  };

  const handleLoadMore = () => {
    const newOffset = searchFilters.offset + searchFilters.limit;
    setSearchFilters(prev => ({ ...prev, offset: newOffset }));
    fetchMoreSchedules(newOffset);
  };

  const fetchMoreSchedules = async (offset: number) => {
    if (!managerInfo) return;

    try {
      let query = supabase
        .from('schedules')
        .select(`
          *,
          sub_locations(name, main_locations(name)),
          cancellation_reason,
          modification_reason,
          deletion_reason
        `)
        .eq('schedule_type', 'studio')
        .eq('is_active', true);

      if (searchFilters.professor_name) {
        query = query.ilike('professor_name', `%${searchFilters.professor_name}%`);
      }

      if (searchFilters.start_date) {
        query = query.gte('shoot_date', searchFilters.start_date);
      }
      if (searchFilters.end_date) {
        query = query.lte('shoot_date', searchFilters.end_date);
      }

      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + searchFilters.limit - 1);

      const { data, error } = await query;
      if (error) throw error;

      const cleanedData = (data || []).filter(schedule => {
        return schedule.is_active === true && 
               schedule.approval_status !== 'cancelled' && 
               !schedule.deletion_reason;
      });

      const groupedSchedules = groupSchedulesForManager(cleanedData);
      setAllSchedules(prev => [...prev, ...groupedSchedules]);
      setHasMore((data?.length || 0) === searchFilters.limit);

    } catch (err) {
      console.error('추가 스케줄 목록 조회 오류:', err);
    }
  };

  // 스케줄 수정 가능 여부 확인
  const canEditSchedule = (schedule: any): boolean => {
    // 취소된 스케줄은 수정 불가
    if (schedule.approval_status === 'cancelled' || schedule.is_active === false) {
      return false;
    }
    return true;
  };

  // 승인 요청 처리 함수 - 수정됨 (존재하지 않는 필드 제거)
const handleApprovalRequest = async (reason: string) => {
  if (!approvalSchedule) return;

  try {
    const statusMap = {
      edit: 'modification_requested',
      cancel: 'cancellation_requested',
    };

    let scheduleIds = [approvalSchedule.id];
    
    // 그룹 스케줄 ID 수집
    if (approvalSchedule.schedulegroupid) {
      const { data: groupSchedules, error: groupError } = await supabase
        .from('schedules')
        .select('id')
        .eq('schedulegroupid', approvalSchedule.schedulegroupid)
        .eq('isactive', true);
      if (!groupError && groupSchedules) {
        scheduleIds = groupSchedules.map(s => s.id);
      }
    }

    // ✅ 수정: schedules 테이블에 사유, 담당자 명확히 기록
    const updateData: any = {
      approval_status: statusMap[approvalRequestType],
      updated_at: new Date().toISOString(),
      updated_by: managerInfo?.id,
    };

    if (approvalRequestType === 'edit') {
      updateData.modification_reason = reason; // 수정사유 기록
      // ✅ 수정요청 들어오면 tracking_status를 null로 리셋(재크로스체크 필요)
      updateData.tracking_status = null;
    } else if (approvalRequestType === 'cancel') {
      updateData.cancellation_reason = reason; // ✅ 취소사유 기록 (누락 방지!)
      updateData.cancelled_by = managerInfo?.id; // ✅ 취소자 기록
    }

    const { error } = await supabase
      .from('schedules')
      .update(updateData)
      .in('id', scheduleIds);

    if (error) throw error;

    // ✅ schedule_history 기록(단일 유틸 사용 + 중복방지)
    for (const scheduleId of scheduleIds) {
      await logScheduleHistory({
        scheduleId,
        changeType: approvalRequestType === 'edit' ? 'modify_request' : 'cancel_request',
        changedBy: managerInfo?.id ?? null,
        changedByName: managerInfo?.name ?? '',
        description: reason ?? '',
        oldValue: { approval_status: approvalSchedule?.approval_status },
        newValue: { approval_status: statusMap[approvalRequestType] },
      });
    }
// 메시지 생성 및 전송...
    const message = generateAdminMessage(approvalRequestType, approvalSchedule, managerInfo?.name, reason);
    
    if (message) {
      try {
        await fetch('/api/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'approvalrequest', message: message })
        });
      } catch (messageError) {
        console.log('메시지 전송 실패:', messageError);
      }
    }

    alert(approvalRequestType === 'edit' ? '수정 요청이 완료되었습니다.' : '취소 요청이 완료되었습니다.');
    fetchAllSchedules(false);
    
  } catch (error) {
    console.error('승인 요청 오류:', error);
    alert(error.message);
  }

  setShowApprovalModal(false);
  setApprovalSchedule(null);
};



  // 수정된 스케줄 수정 처리 함수 - 그룹 처리 추가
  const handleEditSchedule = async (schedule: any) => {
    // modification_approved 상태에서는 바로 수정 모달 열기
    if (schedule.approval_status === 'modification_approved') {
      setEditingSchedule(schedule);
      setShowEditModal(true);
      return;
    }

    // 다른 상태(approved, confirmed)에서는 승인 요청 필요
    if (schedule.approval_status === 'pending' || schedule.approval_status === 'modification_requested') {
      alert('이미 승인 요청 중인 스케줄입니다.');
      return;
    }

    // 그룹 스케줄인 경우 실제 스케줄 ID 찾기
    const targetSchedule = schedule.is_grouped ? schedule.grouped_schedules[0] : schedule;
    
    setApprovalSchedule(targetSchedule);
    setApprovalRequestType('edit');
    setShowApprovalModal(true);
  };

  // 수정된 스케줄 취소 처리 함수 - 그룹 처리 추가
  const handleCancelSchedule = async (schedule: any) => {
    if (schedule.approval_status === 'cancellation_requested') {
      alert('이미 취소 승인 요청 중인 스케줄입니다.');
      return;
    }

    // 그룹 스케줄인 경우 실제 스케줄 ID 찾기
    const targetSchedule = schedule.is_grouped ? schedule.grouped_schedules[0] : schedule;
    
    setApprovalSchedule(targetSchedule);
    setApprovalRequestType('cancel');
    setShowApprovalModal(true);
  };

  // 사용 가능한 스튜디오 찾기 함수
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
      
      return compatibleStudioIds.length > 0 ? compatibleStudioIds : null;
      
    } catch (error) {
      console.error('사용 가능한 스튜디오 조회 오류:', error);
      return null;
    }
  };

  const createScheduleGroup = async (data: StudioScheduleFormData) => {
  try {
    const studioId = await findAvailableStudio(
      data.shooting_type,
      data.shoot_date,
      data.start_time,
      data.end_time
    );

    if (!studioId) {
      throw new Error('사용 가능한 스튜디오를 찾을 수 없습니다.');
    }

    // 분할 스케줄
    if (data.break_time_enabled) {
      const groupId = `${data.professor_name}_${data.shoot_date}_${Date.now()}`;

      const schedule1 = {
        schedule_type: 'studio',
        shoot_date: data.shoot_date,
        start_time: data.start_time,
        end_time: data.break_start_time,
        professor_name: data.professor_name,
        course_name: data.course_name || null,
        course_code: data.course_code || null,
        shooting_type: data.shooting_type,
        notes: data.notes || null,
        sub_location_id: studioId,
        team_id: 1,
        approval_status: 'pending',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sequence_order: 1,
        is_split_schedule: true,
        break_time_enabled: true,
        break_start_time: data.break_start_time,
        break_end_time: data.break_end_time,
        break_duration_minutes: data.break_duration_minutes,
        schedule_group_id: groupId,
        professor_category_id: selectedProfessorInfo?.category_id || null
      };

      const schedule2 = {
        ...schedule1,
        start_time: data.break_end_time,
        end_time: data.end_time,
        sequence_order: 2
      };

      const { data: createdSchedules, error } = await supabase
        .from('schedules')
        .insert([schedule1, schedule2])
        .select();

      if (error) throw error;

      // ✅ 히스토리 기록(단일 유틸 사용 + 중복방지)
      if (createdSchedules && createdSchedules.length > 0) {
        for (const sched of createdSchedules) {
          await logScheduleHistory({
            scheduleId: sched.id,
            changeType: 'created',
            changedBy: managerInfo?.id ?? null,
            changedByName: managerInfo?.name ?? '',
            description: '최초 스케줄 등록',
            oldValue: null,
            newValue: buildSnapshotFromSchedule(sched),
          });
        }
      }

return {
        success: true,
        data: createdSchedules,
        message: `분할 스케줄이 등록되었습니다.\n1차: ${data.start_time} ~ ${data.break_start_time}\n휴식: ${data.break_start_time} ~ ${data.break_end_time}\n2차: ${data.break_end_time} ~ ${data.end_time}\n\n관리자 승인 후 최종 확정됩니다.`
      };
    } else {
      // 단일 스케줄
      const schedule = {
        schedule_type: 'studio',
        shoot_date: data.shoot_date,
        start_time: data.start_time,
        end_time: data.end_time,
        professor_name: data.professor_name,
        course_name: data.course_name || null,
        course_code: data.course_code || null,
        shooting_type: data.shooting_type,
        notes: data.notes || null,
        sub_location_id: studioId,
        team_id: 1,
        approval_status: 'pending',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sequence_order: 1,
        is_split_schedule: false,
        break_time_enabled: false,
        break_start_time: null,
        break_end_time: null,
        break_duration_minutes: 0,
        professor_category_id: selectedProfessorInfo?.category_id || null
      };

      const { data: createdSchedule, error } = await supabase
        .from('schedules')
        .insert([schedule])
        .select();

      if (error) throw error;

      // 히스토리 기록
      if (createdSchedule && createdSchedule.length > 0) {
        const newSchedule = createdSchedule[0];
        await logScheduleHistory({
          scheduleId: newSchedule.id,
          changeType: 'created',
          changedBy: managerInfo?.id,
          changedByName: managerInfo?.name ?? '',
          description: '최초 스케줄 등록',
          oldValue: null,
          newValue: newSchedule,
        });
      }

      return {
        success: true,
        data: createdSchedule,
        message: `스케줄이 등록되었습니다.\n${data.start_time} ~ ${data.end_time}\n\n관리자 승인 후 최종 확정됩니다.`
      };
    }
  } catch (error) {
    console.error('스케줄 생성 오류:', error);
    throw new Error(`스케줄 생성 실패: ${error.message}`);
  }
};

  // 실제 수정 저장 함수 - 양방향 변환 처리
const handleEditScheduleSave = async (editedSchedule: any, reason: string) => {
  try {
    const studioId = editingSchedule?.sublocationid;
    
    const finalData = {
      shoot_date: editedSchedule.shootdate,
      start_time: editedSchedule.starttime,
      end_time: editedSchedule.endtime,
      professor_name: editedSchedule.professorname,
      course_name: editedSchedule.coursename || null,
      course_code: editedSchedule.coursecode || null,
      shooting_type: editedSchedule.shootingtype,
      notes: editedSchedule.notes || null,
      sub_location_id: studioId,
      break_time_enabled: editedSchedule.breaktimeenabled || false,
      break_start_time: editedSchedule.breaktimeenabled && editedSchedule.breakstarttime ? editedSchedule.breakstarttime : null,
      break_end_time: editedSchedule.breaktimeenabled && editedSchedule.breakendtime ? editedSchedule.breakendtime : null,
      break_duration_minutes: editedSchedule.breaktimeenabled ? editedSchedule.breakdurationminutes || 0 : 0,
      approval_status: 'pending',
      updated_at: new Date().toISOString(),
      updated_by: managerInfo?.id, // ✅ 추가
      modification_reason: reason // ✅ 사유 명확히
    };

    // 그룹 스케줄 여부에 따라 update 처리...
    
    if (editingSchedule?.isgrouped && editingSchedule?.groupedschedules) {
      const scheduleIds = editingSchedule.groupedschedules.map((s: any) => s.id);
      
      const { error: updateError } = await supabase
        .from('schedules')
        .update(finalData)
        .in('id', scheduleIds);
      
      if (updateError) throw updateError;
      
      // ✅ history 기록
      for (const scheduleId of scheduleIds) {
        await logScheduleHistory({
          scheduleId: scheduleId,
          changeType: 'modification_approved',
          changedBy: managerInfo?.id,
          changedByName: managerInfo?.name ?? '',
          description: reason,
          oldValue: editingSchedule,
          newValue: finalData,
        });
      }
    } else {
      const { error } = await supabase
        .from('schedules')
        .update(finalData)
        .eq('id', editingSchedule.id);
      
      if (error) throw error;
      
      // ✅ history 기록
      await logScheduleHistory({
          scheduleId: editingSchedule.id,
          changeType: 'modification_approved',
          changedBy: managerInfo?.id,
          changedByName: managerInfo?.name ?? '',
          description: reason,
          oldValue: editingSchedule,
          newValue: finalData,
        });
    }

    // 메시지 생성 및 전송...
    const message = await generateAdminMessage('reapproval', editedSchedule, managerInfo?.name, reason);
    if (message) {
      try {
        await fetch('/api/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'approvalrequest', message: message })
        });
      } catch (messageError) {
        console.log('메시지 전송 실패:', messageError);
      }
    }

    alert('수정이 완료되었습니다.');
    setShowEditModal(false);
    setEditingSchedule(null);
    fetchAllSchedules(false);
    
  } catch (error) {
    console.error('수정 저장 오류:', error);
    alert(error.message);
  }
};



 // 충돌 검사 함수 (매니저용) - 완전한 버전
const checkScheduleConflictAndRecommend = async (
  formData: StudioScheduleFormData, 
  excludeScheduleId?: number,
  excludeGroupId?: string
) => {
  try {
    // 1단계: 촬영형식과 호환되는 스튜디오 찾기
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

    // 2단계: 호환 스튜디오 중에서만 시간 충돌 검사
    const { data: allSchedules, error } = await supabase
      .from('schedules')
      .select(`
        id, 
        start_time, 
        end_time, 
        sub_location_id,
        schedule_group_id,
        professor_name,
        course_name
      `)
      .eq('shoot_date', formData.shoot_date)
      .eq('is_active', true)
      .in('sub_location_id', compatibleStudioIds);

    if (error) throw error;

    // 제외할 스케줄 필터링
    const activeSchedules = (allSchedules || []).filter(schedule => {
      if (excludeScheduleId && schedule.id === excludeScheduleId) return false;
      if (excludeGroupId && schedule.schedule_group_id === excludeGroupId) return false;
      return true;
    });

    // 3단계: 시간 충돌 검사
    const startMinutes = timeToMinutes(formData.start_time);
    const endMinutes = timeToMinutes(formData.end_time);

    const conflictsByStudio = new Map();

    activeSchedules.forEach(schedule => {
      const scheduleStart = timeToMinutes(schedule.start_time);
      const scheduleEnd = timeToMinutes(schedule.end_time);
      
      // 시간 겹침 여부 체크
      if ((startMinutes < scheduleEnd) && (scheduleStart < endMinutes)) {
        const studioId = schedule.sub_location_id;
        if (!conflictsByStudio.has(studioId)) {
          conflictsByStudio.set(studioId, []);
        }
        conflictsByStudio.get(studioId).push(schedule);
      }
    });

    // 4단계: 사용 가능한 스튜디오 찾기
    const availableStudioIds = compatibleStudioIds.filter(
      studioId => !conflictsByStudio.has(studioId)
    );

    if (availableStudioIds.length > 0) {
      // Primary 스튜디오 우선 추천
      const primaryStudio = compatibleData?.find(item => 
        item.is_primary && availableStudioIds.includes(item.sub_location_id)
      );

      return {
        hasConflict: false,
        conflictMessage: '',
        availableStudios: availableStudioIds,
        recommendedStudioId: primaryStudio ? primaryStudio.sub_location_id : availableStudioIds[0]
      };
    }

    // 5단계: 모든 스튜디오가 사용 중인 경우 시간 추천
    const durationMinutes = endMinutes - startMinutes;
    const suggestions = findAvailableTimeSlots(activeSchedules, compatibleStudioIds, durationMinutes);

    let conflictMessage = `선택한 시간대(${formData.start_time}~${formData.end_time})에 모든 호환 스튜디오가 사용 중입니다.\n\n`;

    if (suggestions.length > 0) {
      conflictMessage += `다음 시간대를 추천합니다:\n`;
      suggestions.forEach((slot, idx) => {
        conflictMessage += `${idx + 1}. ${slot.start} ~ ${slot.end}\n`;
      });
    } else {
      conflictMessage += `해당 날짜에는 다른 시간대도 사용할 수 없습니다.\n다른 날짜를 선택해주세요.`;
    }

    return {
      hasConflict: true,
      conflictMessage,
      availableStudios: [],
      recommendedStudioId: null
    };

  } catch (error) {
    console.error('충돌 검사 오류:', error);
    return {
      hasConflict: true,
      conflictMessage: '스케줄 검사 중 오류가 발생했습니다.',
      availableStudios: [],
      recommendedStudioId: null
    };
  }
};
  

  // 폼 검증
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.shoot_date) newErrors.shoot_date = '촬영 날짜를 선택해주세요';
    if (!formData.start_time) newErrors.start_time = '시작 시간을 선택해주세요';
    if (!formData.end_time) newErrors.end_time = '종료 시간을 선택해주세요';
    if (!formData.professor_name) newErrors.professor_name = '교수명을 입력해주세요';
    if (!formData.shooting_type) newErrors.shooting_type = '촬영 형식을 선택해주세요';

    if (formData.start_time && formData.end_time) {
      if (formData.start_time >= formData.end_time) {
        newErrors.end_time = '종료 시간은 시작 시간보다 늦어야 합니다';
      }
    }

    if (formData.break_time_enabled) {
      if (!formData.break_start_time) newErrors.break_start_time = '휴식 시작 시간을 선택해주세요';
      if (!formData.break_end_time) newErrors.break_end_time = '휴식 종료 시간을 선택해주세요';

      if (formData.start_time && formData.break_start_time && formData.start_time >= formData.break_start_time) {
        newErrors.break_start_time = '휴식 시작 시간은 촬영 시작 시간보다 늦어야 합니다';
      }

      if (formData.break_end_time && formData.end_time && formData.break_end_time >= formData.end_time) {
        newErrors.break_end_time = '휴식 종료 시간은 촬영 종료 시간보다 빨라야 합니다';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 폼 시간 변경 핸들러
  const handleFormTimeChange = (field: string, value: string) => {
    const newFormData = { ...formData, [field]: value };

    // 시작/종료 시간 변경 시 휴식시간 자동 조정
    if (field === 'start_time' || field === 'end_time') {
      if (newFormData.break_time_enabled && newFormData.start_time && newFormData.end_time) {
        const recommendation = checkBreakTimeRecommendation(newFormData.start_time, newFormData.end_time);
        
        if (recommendation.shouldRecommend && recommendation.suggestedBreakTime) {
          newFormData.break_start_time = recommendation.suggestedBreakTime.startTime;
          newFormData.break_end_time = recommendation.suggestedBreakTime.endTime;
          newFormData.break_duration_minutes = recommendation.suggestedBreakTime.durationMinutes;
        }
      }
    }

    setFormData(newFormData);
  };

  // 휴식시간 변경 핸들러
  const handleBreakTimeChange = (field: 'break_start_time' | 'break_end_time', value: string) => {
    const newFormData = { ...formData, [field]: value };
    
    if (newFormData.break_start_time && newFormData.break_end_time) {
      const duration = calculateBreakDuration(newFormData.break_start_time, newFormData.break_end_time);
      newFormData.break_duration_minutes = duration;
    }
    
    setFormData(newFormData);
  };

  // 휴식시간 설정 렌더링
  const renderBreakTimeSettings = () => {
    if (!shouldShowBreakTimeSettings(formData.start_time, formData.end_time)) {
      return null;
    }

    const recommendation = checkBreakTimeRecommendation(formData.start_time, formData.end_time);

    return (
      <div style={{
        padding: 'clamp(12px, 3vw, 16px)',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #dee2e6',
        marginBottom: 'clamp(12px, 3vw, 16px)'
      }}>
        <h4 style={{ 
          margin: '0 0 12px 0', 
          color: '#374151',
          fontSize: 'clamp(14px, 3.5vw, 16px)'
        }}>
          휴식시간 설정 (4시간 이상 촬영)
        </h4>
        
        <div style={{ marginBottom: '16px' }}>
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
                if (enabled && recommendation.shouldRecommend && recommendation.suggestedBreakTime) {
                  setFormData(prev => ({
                    ...prev,
                    break_time_enabled: true,
                    break_start_time: recommendation.suggestedBreakTime!.startTime,
                    break_end_time: recommendation.suggestedBreakTime!.endTime,
                    break_duration_minutes: recommendation.suggestedBreakTime!.durationMinutes
                  }));
                } else {
                  setFormData(prev => ({
                    ...prev,
                    break_time_enabled: enabled,
                    break_start_time: enabled ? prev.break_start_time : undefined,
                    break_end_time: enabled ? prev.break_end_time : undefined,
                    break_duration_minutes: enabled ? prev.break_duration_minutes : 0
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
          
          {recommendation.shouldRecommend && (
            <p style={{ 
              color: '#059669', 
              fontSize: 'clamp(12px, 3vw, 13px)', 
              margin: '6px 0 0 0',
              fontWeight: '500'
            }}>
              {recommendation.reason}
            </p>
          )}
        </div>

        {formData.break_time_enabled && (
          <div style={{
            padding: 'clamp(12px, 3vw, 16px)',
            backgroundColor: '#f0f9ff',
            borderRadius: '8px',
            border: '1px solid #dbeafe'
          }}>
            <div style={{
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr auto',
              gap: 'clamp(8px, 2vw, 12px)', 
              alignItems: 'end', 
              marginBottom: '16px'
            }}>
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px', 
                  fontSize: 'clamp(12px, 3vw, 14px)',
                  fontWeight: '500',
                  color: '#374151'
                }}>
                  시작
                </label>
                <select
                  value={formData.break_start_time || ''}
                  onChange={(e) => handleBreakTimeChange('break_start_time', e.target.value)}
                  style={{
                    width: '100%',
                    padding: 'clamp(8px, 2vw, 10px)',
                    border: `1px solid ${errors.break_start_time ? '#f44336' : '#d1d5db'}`,
                    borderRadius: '6px',
                    fontSize: 'clamp(12px, 3vw, 14px)',
                    textAlign: 'center'
                  }}>
                  <option value="">시작</option>
                  {generateBreakTimeOptionsInRange(formData.start_time, formData.end_time).map(time => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
                {errors.break_start_time && (
                  <span style={{ 
                    color: '#f44336', 
                    fontSize: 'clamp(10px, 2.5vw, 11px)',
                    marginTop: 2, 
                    display: 'block' 
                  }}>
                    {errors.break_start_time}
                  </span>
                )}
              </div>
              
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px', 
                  fontSize: 'clamp(12px, 3vw, 14px)',
                  fontWeight: '500',
                  color: '#374151'
                }}>
                  종료
                </label>
                <select
                  value={formData.break_end_time || ''}
                  onChange={(e) => handleBreakTimeChange('break_end_time', e.target.value)}
                  style={{
                    width: '100%',
                    padding: 'clamp(8px, 2vw, 10px)',
                    border: `1px solid ${errors.break_end_time ? '#f44336' : '#d1d5db'}`,
                    borderRadius: '6px',
                    fontSize: 'clamp(12px, 3vw, 14px)',
                    textAlign: 'center'
                  }}>
                  <option value="">종료</option>
                  {generateBreakTimeOptionsInRange(formData.start_time, formData.end_time).map(time => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
                {errors.break_end_time && (
                  <span style={{ 
                    color: '#f44336', 
                    fontSize: 'clamp(10px, 2.5vw, 11px)',
                    marginTop: 2, 
                    display: 'block' 
                  }}>
                    {errors.break_end_time}
                  </span>
                )}
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
                whiteSpace: 'nowrap',
                minHeight: 'clamp(32px, 8vw, 38px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {formData.break_duration_minutes}분
              </div>
            </div>
            
            <div style={{
              padding: 'clamp(8px, 2vw, 12px)', 
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
                분할 스케줄 예상
              </div>
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '3px' 
              }}>
                <div>
                  <span style={{ color: '#4caf50', fontWeight: '500' }}>1차:</span> {formData.start_time} ~ {formData.break_start_time}
                </div>
                <div>
                  <span style={{ color: '#6c757d', fontWeight: '500' }}>휴식:</span> {formData.break_start_time} ~ {formData.break_end_time} ({formData.break_duration_minutes}분)
                </div>
                <div>
                  <span style={{ color: '#2196f3', fontWeight: '500' }}>2차:</span> {formData.break_end_time} ~ {formData.end_time}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

const submitShootingRequest = async () => {
  if (!validateForm()) {
    alert('필수 항목을 모두 입력해주세요');
    return;
  }

  try {
    const conflictCheck = await checkScheduleConflictAndRecommend(formData);
    
    if (conflictCheck.hasConflict) {
      alert(conflictCheck.conflictMessage);
      return;
    }

    const confirmSubmit = confirm(
      `${formData.professor_name} 교수님 촬영을 요청하시겠습니까?\n\n` +
      `날짜: ${formData.shoot_date}\n` +
      `시간: ${formData.start_time} ~ ${formData.end_time}\n` +
      `촬영형식: ${formData.shooting_type}`
    );

    if (!confirmSubmit) return;

    // ✅ 스케줄 생성
    const result = await createScheduleGroup(formData);

    // ✅ 관리자에게 승인 요청 메시지 발송
    try {
      const adminMessage = await generateAdminMessage(
        'approval',
        formData,
        managerInfo?.name || '매니저'
      );

      await fetch('/api/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'approval_request',
          message: adminMessage
        })
      });
    } catch (err) {
      console.log('메시지 발송 실패:', err);
      // 메시지 발송 실패해도 스케줄 등록은 성공으로 처리
    }

    alert(result.message);
    resetForm();
    
    if (showScheduleList) {
      fetchAllSchedules(false);
    }

  } catch (error) {
    console.error('등록 오류:', error);
    alert('등록 중 오류가 발생했습니다: ' + error.message);
  }
};

  // 폼 초기화
  const resetForm = () => {
    setFormData({
      shoot_date: '',
      start_time: '',
      end_time: '',
      professor_name: '',
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
    setErrors({});
    setSelectedProfessorInfo(null);
  };

  // 개발 테스트 날짜 선택 핸들러
  const handleDevDateSelect = (date: string) => {
    setTestDate(date);
  };

  // 스케줄 상태 정보
  const getStatusInfo = (status: string, isActive: boolean = true) => {
    if (isActive === false || status === "cancelled") {
      return { text: "취소됨", bg: "#f5f5f5", color: "#6c757d" };
    }
    
    switch (status) {
      case "modification_requested":
        return { text: "수정 승인 대기중", bg: "#f3e5f5", color: "#7b1fa2" };
      case "modification_approved":
        return { text: "수정 승인됨", bg: "#e8f5e8", color: "#2e7d32" };
      case "cancellation_requested":
        return { text: "취소 승인 대기중", bg: "#fce4ec", color: "#ad1457" };
      case "pending":
        return { text: "승인 대기중", bg: "#fbbf24", color: "#92400e" };
      case "approved":
        return { text: "촬영확정", bg: "#e3f2fd", color: "#1976d2" };
      case "confirmed":
        return { text: "촬영확정", bg: "#e3f2fd", color: "#1976d2" };
      default:
        return { text: status, bg: "#f5f5f5", color: "#616161" };
    }
  };

  // 과거 스케줄 여부 확인
  const isPastSchedule = (date: string): boolean => {
    const today = testDate ? new Date(testDate) : new Date();
    const scheduleDate = new Date(date);
    return scheduleDate < today;
  };

  // 취소된 스케줄 여부 확인
  const isCancelledSchedule = (schedule: any): boolean => {
    return schedule.is_active === false ||
           schedule.approval_status === 'cancelled' ||
           (schedule.deletion_reason && schedule.deletion_reason !== 'split_converted');
  };

  // 로그인하지 않은 경우 로그인 화면 표시
  if (!managerInfo) {
    return (
      <div style={{ 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(16px, 4vw, 20px)'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: 'clamp(24px, 6vw, 32px)',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          maxWidth: '400px',
          width: '100%',
          textAlign: 'center'
        }}>
          <h2 style={{ 
            marginBottom: '24px',
            fontSize: 'clamp(20px, 5vw, 24px)',
            color: '#1f2937'
          }}>
            스튜디오 스케줄 관리
          </h2>
          
          <p style={{ 
            marginBottom: '24px',
            color: '#6b7280',
            fontSize: 'clamp(14px, 3.5vw, 16px)'
          }}>
            매니저 권한이 필요합니다
          </p>
          
          <button
            onClick={() => {
              //localStorage.setItem('userRole', 'academy_manager');
              localStorage.setItem('userName', '테스트매니저');
              localStorage.setItem('userEmail', 'manager@test.com');
              window.location.reload();
            }}
            style={{
              padding: 'clamp(10px, 3vw, 12px) clamp(20px, 5vw, 24px)',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: 'clamp(14px, 3.5vw, 16px)',
              fontWeight: '500'
            }}
          >
            테스트용 매니저 로그인
          </button>
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
      {/* 개발 테스트 모드 */}
      {showDevMode && (
        <DevTestMode 
          onClose={() => setShowDevMode(false)} 
          onDateSelect={handleDevDateSelect}
          testDate={testDate}
        />
      )}
      
      {/* 제작센터 연락 모달 */}
      <ContactModal
        open={showContactModal}
        onClose={() => setShowContactModal(false)}
        scheduleInfo={contactScheduleInfo}
      />

      {/* 승인 요청 모달 */}
      <ApprovalRequestModal
        open={showApprovalModal}
        onClose={() => setShowApprovalModal(false)}
        onConfirm={handleApprovalRequest}
        schedule={approvalSchedule}
        requestType={approvalRequestType}
      />

      {/* 수정 모달 */}
      <EditScheduleModal
        open={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingSchedule(null);
        }}
        schedule={editingSchedule}
        onSave={handleEditScheduleSave}
        shootingTypes={shootingTypes}
        availableDates={availableDates}
      />

      {/* 상세보기 모달 */}
      <ScheduleDetailModal
        open={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        schedule={detailSchedule}
        onEdit={() => handleEditSchedule(detailSchedule)}
        onCancel={() => handleCancelSchedule(detailSchedule)}
        isPastSchedule={isPastSchedule}
        isCancelledSchedule={isCancelledSchedule}
        canEditSchedule={canEditSchedule}
        getStatusInfo={getStatusInfo}
        userRoles={userRoles}
      />

      <div style={{ 
        maxWidth: '600px', 
        margin: '0 auto', 
        padding: '0 clamp(8px, 2vw, 10px)'
      }}>
        <div style={{ 
          background: 'white',
          borderRadius: '12px',
          padding: 'clamp(16px, 4vw, 24px)',
          marginBottom: '16px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ 
            textAlign: 'center',
            marginBottom: 'clamp(16px, 4vw, 20px)',
            paddingBottom: 'clamp(12px, 3vw, 16px)',
            borderBottom: '1px solid #e5e7eb'
          }}>
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
              안녕하세요. {managerInfo?.name} 님
            </h1>
            <p style={{ 
              color: '#6b7280', 
              fontSize: 'clamp(14px, 3.5vw, 16px)',
              margin: '0 0 12px 0'
            }}>
              스튜디오 스케줄 관리 시스템
            </p>
            <p style={{ 
              color: '#9ca3af',
              fontSize: 'clamp(12px, 3vw, 14px)',
              margin: 0
            }}>
              교수님의 촬영 스케줄을 등록 및 관리해 주세요
            </p>
            
            {/* 개발 모드 표시 */}
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
          
          <div style={{ display: 'grid', gap: 'clamp(12px, 3vw, 16px)' }}>
            
            {/* 1. 교수명 */}
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '6px', 
                fontWeight: '500', 
                color: '#374151',
                fontSize: 'clamp(14px, 3.5vw, 16px)'
              }}>
                교수명 *
              </label>
              <ProfessorAutocomplete
                value={formData.professor_name}
                onChange={handleProfessorChange}
                placeholder="교수명을 입력하면 자동완성됩니다"
                disabled={false}
                required
                style={{
                  fontSize: 'clamp(14px, 3.5vw, 16px)',
                  padding: 'clamp(10px, 2.5vw, 12px)',
                  borderColor: errors.professor_name ? '#f44336' : '#d1d5db'
                }}
              />
              {selectedProfessorInfo && selectedProfessorInfo.category_name && (
                <p style={{ 
                  color: '#059669', 
                  fontSize: 'clamp(11px, 2.5vw, 12px)', 
                  margin: '4px 0 0 0',
                  fontWeight: '500'
                }}>
                  매칭됨: {selectedProfessorInfo.category_name}
                </p>
              )}
              {errors.professor_name && (
                <span style={{ 
                  color: '#f44336', 
                  fontSize: 'clamp(11px, 2.5vw, 12px)',
                  marginTop: 4, 
                  display: 'block' 
                }}>
                  {errors.professor_name}
                </span>
              )}
            </div>

            {/* 2. 촬영 날짜 */}
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

            {/* 3. 촬영 시간 */}
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
                      padding: 'clamp(8px, 2vw, 10px)',
                      border: `1px solid ${errors.start_time ? '#f44336' : '#d1d5db'}`, 
                      borderRadius: '6px',
                      fontSize: 'clamp(12px, 3vw, 14px)',
                      outline: 'none'
                    }} 
                    required 
                  >
                    <option value="">시작 시간</option>
                    {timeOptions.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                  {errors.start_time && (
                    <span style={{ 
                      color: '#f44336', 
                      fontSize: 'clamp(10px, 2.5vw, 11px)',
                      marginTop: 2,
                      display: 'block' 
                    }}>
                      {errors.start_time}
                    </span>
                  )}
                </div>
                
                <div style={{ 
                  flex: 0,
                  flexShrink: 0,
                  paddingBottom: errors.start_time || errors.end_time ? '16px' : '6px'
                }}>
                  <span style={{ 
                    color: '#6b7280',
                    fontSize: 'clamp(14px, 3.5vw, 16px)',
                    fontWeight: '500'
                  }}>
                    ~
                  </span>
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
                      padding: 'clamp(8px, 2vw, 10px)',
                      border: `1px solid ${errors.end_time ? '#f44336' : '#d1d5db'}`, 
                      borderRadius: '6px',
                      fontSize: 'clamp(12px, 3vw, 14px)',
                      outline: 'none'
                    }} 
                    required 
                  >
                    <option value="">종료 시간</option>
                    {timeOptions.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                  {errors.end_time && (
                    <span style={{ 
                      color: '#f44336', 
                      fontSize: 'clamp(10px, 2.5vw, 11px)',
                      marginTop: 2,
                      display: 'block' 
                    }}>
                      {errors.end_time}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 4. 휴식시간 설정 */}
            {renderBreakTimeSettings()}

            {/* 5. 과정명 */}
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '6px', 
                fontWeight: '500', 
                color: '#374151',
                fontSize: 'clamp(14px, 3.5vw, 16px)'
              }}>
                과정명
              </label>
              <input 
                type="text" 
                value={formData.course_name}
                onChange={(e) => setFormData({...formData, course_name: e.target.value})} 
                placeholder="예: 9급공무원, 공인중개사 등"
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

            {/* 6. 과정 코드 */}
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '6px', 
                fontWeight: '500', 
                color: '#374151',
                fontSize: 'clamp(14px, 3.5vw, 16px)'
              }}>
                과정 코드
              </label>
              <input 
                type="text" 
                value={formData.course_code} 
                onChange={(e) => setFormData({...formData, course_code: e.target.value})} 
                placeholder="예: PUB001, CER002 등"
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

            {/* 7. 촬영 형식 */}
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
                  outline: 'none',
                  boxSizing: 'border-box'
                }} 
                required 
              >
                <option value="">촬영 형식 선택</option>
                {shootingTypes.map(type => (
                  <option key={type.id} value={type.name}>{type.name}</option>
                ))}
              </select>
              {errors.shooting_type && (
                <span style={{ 
                  color: '#f44336', 
                  fontSize: 'clamp(11px, 2.5vw, 12px)',
                  marginTop: 4, 
                  display: 'block' 
                }}>
                  {errors.shooting_type}
                </span>
              )}
            </div>

            {/* 8. 비고 */}
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '6px', 
                fontWeight: '500', 
                color: '#374151',
                fontSize: 'clamp(14px, 3.5vw, 16px)'
              }}>
                비고
              </label>
              <textarea 
                value={formData.notes} 
                onChange={(e) => setFormData({...formData, notes: e.target.value})} 
                placeholder="특이사항이나 요청사항을 입력해주세요"
                rows={3}
                style={{ 
                  width: '100%', 
                  padding: 'clamp(10px, 2.5vw, 12px)',
                  border: '1px solid #d1d5db', 
                  borderRadius: '8px',
                  fontSize: 'clamp(14px, 3.5vw, 16px)',
                  outline: 'none',
                  resize: 'vertical',
                  minHeight: 'clamp(60px, 15vw, 80px)',
                  boxSizing: 'border-box'
                }} 
              />
            </div>

            {/* 제출 버튼 */}
            <button
              type="button"
              onClick={submitShootingRequest}
              style={{
                width: '100%',
                padding: 'clamp(12px, 3vw, 16px)',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: 'clamp(16px, 4vw, 18px)',
                fontWeight: '600',
                cursor: 'pointer',
                marginTop: 'clamp(8px, 2vw, 12px)',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#2563eb';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(59, 130, 246, 0.3)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#3b82f6';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.2)';
              }}
            >
              촬영 등록하기
            </button>
          </div>
        </div>

        {/* 전체 스케줄 관리 섹션 */}
        <div style={{ 
          background: 'white',
          borderRadius: '12px',
          padding: 'clamp(16px, 4vw, 24px)',
          marginBottom: '16px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: 'clamp(16px, 4vw, 20px)',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <h2 style={{ 
              color: '#1f2937', 
              fontSize: 'clamp(18px, 4.5vw, 22px)',
              margin: 0,
              fontWeight: '600'
            }}>
              전체 스케줄 관리
            </h2>
            <button
              onClick={() => {
                const newShowState = !showScheduleList;
                setShowScheduleList(newShowState);
                if (newShowState && managerInfo) {
                  fetchAllSchedules(false);
                }
              }}
              style={{
                padding: 'clamp(8px, 2vw, 10px) clamp(12px, 3vw, 16px)',
                backgroundColor: showScheduleList ? '#dc2626' : '#059669',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: 'clamp(12px, 3vw, 14px)',
                fontWeight: '500',
                transition: 'all 0.2s ease'
              }}
            >
              {showScheduleList ? '목록 숨기기' : '목록 보기'}
            </button>
          </div>

          {showScheduleList && (
            <>
              {/* 검색 필터 */}
              <div style={{ 
                backgroundColor: '#f8f9fa',
                padding: 'clamp(12px, 3vw, 16px)',
                borderRadius: '8px',
                marginBottom: 'clamp(16px, 4vw, 20px)',
                border: '1px solid #e9ecef'
              }}>
                <h3 style={{ 
                  margin: '0 0 16px 0',
                  fontSize: 'clamp(14px, 3.5vw, 16px)',
                  fontWeight: '600',
                  color: '#495057'
                }}>
                  검색 필터
                </h3>
                
                {/* 교수명 검색 */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '6px',
                    fontSize: 'clamp(12px, 3vw, 14px)',
                    fontWeight: '500',
                    color: '#374151'
                  }}>
                    교수명으로 검색
                  </label>
                  <input
                    type="text"
                    value={searchFilters.professor_name}
                    onChange={(e) => setSearchFilters(prev => ({ 
                      ...prev, 
                      professor_name: e.target.value 
                    }))}
                    placeholder="교수명을 입력하세요"
                    style={{
                      width: '100%',
                      padding: 'clamp(10px, 2.5vw, 12px)',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: 'clamp(14px, 3.5vw, 16px)',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* 날짜 범위 검색 */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '6px',
                    fontSize: 'clamp(12px, 3vw, 14px)',
                    fontWeight: '500',
                    color: '#374151'
                  }}>
                    촬영 기간으로 검색
                  </label>
                  <div style={{ 
                    display: 'grid',
                    gridTemplateColumns: '1fr auto 1fr',
                    gap: '12px',
                    alignItems: 'center'
                  }}>
                    <div>
                      <input
                        type="date"
                        value={searchFilters.start_date}
                        onChange={(e) => setSearchFilters(prev => ({ 
                          ...prev, 
                          start_date: e.target.value 
                        }))}
                        style={{
                          width: '100%',
                          padding: 'clamp(10px, 2.5vw, 12px)',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: 'clamp(14px, 3.5vw, 16px)',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    
                    <span style={{ 
                      color: '#6b7280',
                      fontSize: 'clamp(14px, 3.5vw, 16px)',
                      fontWeight: '500'
                    }}>
                      ~
                    </span>
                    
                    <div>
                      <input
                        type="date"
                        value={searchFilters.end_date}
                        onChange={(e) => setSearchFilters(prev => ({ 
                          ...prev, 
                          end_date: e.target.value 
                        }))}
                        style={{
                          width: '100%',
                          padding: 'clamp(10px, 2.5vw, 12px)',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: 'clamp(14px, 3.5vw, 16px)',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* 검색 버튼들 */}
                <div style={{ 
                  display: 'flex', 
                  gap: '8px',
                  flexWrap: 'wrap'
                }}>
                  <button
                    onClick={handleSearch}
                    disabled={isSearching}
                    style={{
                      padding: 'clamp(10px, 2.5vw, 12px) clamp(16px, 4vw, 20px)',
                      backgroundColor: isSearching ? '#9ca3af' : '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: isSearching ? 'not-allowed' : 'pointer',
                      fontSize: 'clamp(12px, 3vw, 14px)',
                      fontWeight: '500'
                    }}
                  >
                    {isSearching ? '검색 중...' : '검색'}
                  </button>
                  
                  <button
                    onClick={handleResetSearch}
                    style={{
                      padding: 'clamp(10px, 2.5vw, 12px) clamp(16px, 4vw, 20px)',
                      backgroundColor: '#6b7280',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: 'clamp(12px, 3vw, 14px)',
                      fontWeight: '500'
                    }}
                  >
                    초기화
                  </button>
                </div>
              </div>

              {/* 스케줄 개수 표시 */}
              <div style={{ 
                fontSize: 'clamp(12px, 3vw, 14px)',
                color: '#6b7280',
                marginBottom: '16px'
              }}>
                총 {totalScheduleCount}개의 스케줄
              </div>

              {/* 스케줄 목록 */}
              {allSchedules.length === 0 ? (
                <div style={{ 
                  textAlign: 'center',
                  padding: 'clamp(40px, 10vw, 60px)',
                  color: '#9ca3af',
                  fontSize: 'clamp(14px, 3.5vw, 16px)'
                }}>
                  등록된 스케줄이 없습니다
                </div>
              ) : (
                <>
                  {allSchedules.map((schedule) => {
                    const isPast = isPastSchedule(schedule.shoot_date);
                    const isCancelled = isCancelledSchedule(schedule);
                    const canEdit = canEditSchedule(schedule);
                    const statusInfo = getStatusInfo(schedule.approval_status, schedule.is_active);
                    
                    return (
                      <div
                        key={schedule.id}
                        style={{
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          padding: 'clamp(12px, 3vw, 16px)',
                          marginBottom: '12px',
                          backgroundColor: isPast || isCancelled ? '#f9fafb' : 'white',
                          opacity: isPast || isCancelled ? 0.7 : 1,
                          position: 'relative'
                        }}
                      >
                        
                        {/* 상태 배지만 유지 */}
                        <div style={{
                          position: 'absolute',
                          top: '12px',
                          right: '12px',
                          backgroundColor: statusInfo.bg,
                          color: statusInfo.color,
                          padding: '4px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '500'
                        }}>
                          {statusInfo.text}
                        </div>

                        {/* 스케줄 정보 */}
                        <div style={{ marginBottom: '12px', paddingRight: '80px' }}>
                          <h3 style={{
                            margin: '0 0 4px 0',
                            fontSize: 'clamp(14px, 3.5vw, 16px)',
                            fontWeight: '600',
                            color: '#1f2937'
                          }}>
                            {schedule.professor_name}
                          </h3>
                          <p style={{
                            margin: '0',
                            fontSize: 'clamp(12px, 3vw, 14px)',
                            color: '#6b7280'
                          }}>
                            {schedule.course_name || '과정명 없음'}
                          </p>
                        </div>

                        {/* 스케줄 세부 정보 */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                          gap: '8px',
                          fontSize: 'clamp(11px, 2.5vw, 12px)',
                          color: '#4b5563',
                          marginBottom: '12px'
                        }}>
                          <div>날짜: {schedule.shoot_date}</div>
                          <div>촬영형식: {schedule.shooting_type}</div>
                          <div>스튜디오: {schedule.sub_locations?.name || '스튜디오'}</div>
                        </div>

                        {/* 개선된 촬영 일정 표시 */}
                        <div style={{
                          fontSize: 'clamp(11px, 2.5vw, 12px)',
                          color: '#4b5563',
                          marginBottom: '12px',
                          padding: '8px',
                          backgroundColor: schedule.is_grouped ? '#f0f9ff' : '#f8fafc',
                          borderRadius: '4px',
                          border: `1px solid ${schedule.is_grouped ? '#dbeafe' : '#e2e8f0'}`
                        }}>
                          <div style={{ fontWeight: '500', marginBottom: '4px', color: '#374151' }}>
                            촬영 일정:
                          </div>
                          {schedule.is_grouped && schedule.grouped_schedules ? (
                            <div>
                              {/* 1차 촬영 */}
                              <div style={{ marginBottom: '2px' }}>
                                <span style={{ fontWeight: '500' }}>1차:</span> {schedule.grouped_schedules[0]?.start_time?.substring(0,5)} ~ {schedule.break_start_time?.substring(0,5)}
                              </div>
                              
                              {/* 휴식시간 */}
                              {schedule.break_time_enabled && schedule.break_start_time && schedule.break_end_time && (
                                <div style={{ 
                                  marginBottom: '2px',
                                  color: '#7c3aed', 
                                  fontWeight: '500' 
                                }}>
                                  휴식: {schedule.break_start_time?.substring(0,5)} ~ {schedule.break_end_time?.substring(0,5)}
                                </div>
                              )}
                              
                              {/* 2차 촬영 */}
                              {schedule.grouped_schedules[1] && (
                                <div style={{ marginBottom: '2px' }}>
                                  <span style={{ fontWeight: '500' }}>2차:</span> {schedule.break_end_time?.substring(0,5)} ~ {schedule.grouped_schedules[1]?.end_time?.substring(0,5)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div>
                              <span style={{ fontWeight: '500' }}>시간:</span> {schedule.start_time?.substring(0,5)} ~ {schedule.end_time?.substring(0,5)}
                            </div>
                          )}
                        </div>

                        {/* 비고 */}
                        {schedule.notes && (
                          <div style={{
                            fontSize: 'clamp(11px, 2.5vw, 12px)',
                            color: '#6b7280',
                            marginBottom: '12px',
                            padding: '8px',
                            backgroundColor: '#f3f4f6',
                            borderRadius: '4px'
                          }}>
                            비고: {schedule.notes}
                          </div>
                        )}

                        {/* 상세보기/수정/취소 버튼 */}
                        <div style={{
                          display: 'flex',
                          gap: '8px',
                          justifyContent: 'flex-end',
                          marginTop: '12px',
                          paddingTop: '12px',
                          borderTop: '1px solid #e5e7eb',
                          flexWrap: 'wrap'
                        }}>
                          
                          {/* 상세보기 버튼 */}
                          <button
                            onClick={() => {
                              setDetailSchedule(schedule);
                              setShowDetailModal(true);
                            }}
                            style={{
                              padding: 'clamp(6px, 1.5vw, 8px) clamp(12px, 3vw, 16px)',
                              backgroundColor: '#6b7280',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: 'clamp(11px, 2.5vw, 12px)',
                              fontWeight: '500'
                            }}
                          >
                            상세보기
                          </button>
                          
                          {/* 수정된 조건: modification_approved 포함하여 매니저 수정 가능 */}
                          {(schedule.approval_status === 'approved' || 
                            schedule.approval_status === 'confirmed' || 
                            schedule.approval_status === 'modification_approved') && 
                           !isPast && !isCancelled && (
                            <>
                              {/* 수정 버튼 */}
                              <button
                                onClick={() => handleEditSchedule(schedule)}
                                style={{
                                  padding: 'clamp(6px, 1.5vw, 8px) clamp(12px, 3vw, 16px)',
                                  backgroundColor: '#059669',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: 'clamp(11px, 2.5vw, 12px)',
                                  fontWeight: '500'
                                }}
                              >
                                {schedule.approval_status === 'modification_approved' ? '수정하기' : '수정 요청'}
                              </button>
                              
                              {/* 취소 버튼 */}
                              <button
                                onClick={() => handleCancelSchedule(schedule)}
                                style={{
                                  padding: 'clamp(6px, 1.5vw, 8px) clamp(12px, 3vw, 16px)',
                                  backgroundColor: '#dc2626',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: 'clamp(11px, 2.5vw, 12px)',
                                  fontWeight: '500'
                                }}
                              >
                                취소
                              </button>
                            </>
                          )}

                          {/* 승인 대기/요청 중 상태 표시 */}
                          {(schedule.approval_status === 'pending' || 
                            schedule.approval_status === 'modification_requested' || 
                            schedule.approval_status === 'cancellation_requested') && (
                            <div style={{
                              fontSize: 'clamp(10px, 2.5vw, 11px)',
                              color: '#7c3aed',
                              fontStyle: 'italic',
                              padding: '4px 8px',
                              backgroundColor: '#f3f4f6',
                              borderRadius: '12px',
                              border: '1px solid #e5e7eb',
                              display: 'flex',
                              alignItems: 'center'
                            }}>
                              {schedule.approval_status === 'modification_requested' && '수정 승인 대기중'}
                              {schedule.approval_status === 'pending' && '승인 대기중'}
                              {schedule.approval_status === 'cancellation_requested' && '취소 승인 대기중'}
                            </div>
                          )}

                        </div>
                      </div>
                    );
                  })}

                  {/* 더 보기 버튼 */}
                  {hasMore && (
                    <div style={{ textAlign: 'center', marginTop: '20px' }}>
                      <button
                        onClick={handleLoadMore}
                        style={{
                          padding: 'clamp(10px, 2.5vw, 12px) clamp(16px, 4vw, 20px)',
                          backgroundColor: '#6b7280',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: 'clamp(12px, 3vw, 14px)',
                          fontWeight: '500'
                        }}
                      >
                        더 보기
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}