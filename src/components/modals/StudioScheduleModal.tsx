"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { SchedulePolicy } from '../../utils/schedulePolicy';
import { ProfessorAutocomplete } from '../ProfessorAutocomplete';
import { sendMessage } from '../../utils/naverWorksMessage';


const getUserNumericId = (): number => {
  const numericId = localStorage.getItem('userNumericId');
  const parsed = parseInt(numericId || '0', 10);
  
  if (isNaN(parsed) || parsed === 0) {
    console.warn('⚠️ userNumericId가 유효하지 않습니다. 재로그인 필요.');
    return 0;
  }
  
  return parsed;
};

interface StudioScheduleModalProps {
  open: boolean;
  onClose: () => void;
  initialData?: any;
  locations: any[];
  userRole: string;
  onSave: (data: any, action: 'temp' | 'request' | 'approve' | 'modify_request' | 'cancel_request'|'cancel_approve' | 'split') => Promise<{ success: boolean; message: string }>;
  onDelete?: (scheduleId: number) => Promise<void>;
  mode?: 'create' | 'edit' | 'split';
  onSplitSchedule?: (scheduleId: number, splitPoints: string[], reason: string) => Promise<void>;
  onSplit?: () => void;
}

// 통일된 스타일 변수
const UNIFIED_STYLES = {
  fontSize: '15px',
  labelSize: '15px',
  padding: '10px 12px',
  borderRadius: '6px',
  gap: '16px',
  marginBottom: '20px'
};

// 헬퍼 함수들을 먼저 정의 - hh:mm 표기 개선
const timeToMinutes = (timeString: string): number => {
  if (!timeString || typeof timeString !== 'string') return 0;
  const [hours, minutes] = timeString.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

const minutesToTime = (minutes: number): string => {
  if (typeof minutes !== 'number' || minutes < 0) return '00:00';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

// 30분 단위 시간 옵션 생성 - hh:mm 형식으로 통일
const generateStudioTimeOptions = () => {
  const options = [];
  for (let hour = 9; hour <= 22; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      options.push(timeString);
    }
  }
  return options;
};

// 스케줄 분할 컴포넌트
const ScheduleSplitSection = ({ 
  schedule, 
  onSplit, 
  onCancel 
}: { 
  schedule: any; 
  onSplit: (splitPoints: string[], reason: string) => Promise<void>;
  onCancel: () => void;
}) => {
  // 🔧 기본적으로 구간 2개 노출
  const [splitRanges, setSplitRanges] = useState<{start: string, end: string}[]>([
    {start: '', end: ''}, 
    {start: '', end: ''}  // ✅ 기본 2개 구간
  ]);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewSegments, setPreviewSegments] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 통일된 시간 옵션 사용
  const timeOptions = generateStudioTimeOptions();

  // 유효 범위 필터링
  const getValidTimeOptions = () => {
    if (!schedule) return timeOptions;
    
    const startMinutes = timeToMinutes(schedule.start_time);
    const endMinutes = timeToMinutes(schedule.end_time);
    
    return timeOptions.filter(time => {
      const minutes = timeToMinutes(time);
      return minutes >= startMinutes && minutes <= endMinutes;
    });
  };

  const validTimeOptions = getValidTimeOptions();

  useEffect(() => {
    generatePreview();
  }, [splitRanges, schedule]);

  const generatePreview = () => {
    if (!schedule) return;
    
    try {
      setError(null);
      
      const validRanges = splitRanges.filter(range => 
        range.start && range.end && 
        timeToMinutes(range.start) < timeToMinutes(range.end) &&
        timeToMinutes(range.start) >= timeToMinutes(schedule.start_time) &&
        timeToMinutes(range.end) <= timeToMinutes(schedule.end_time)
      );
      
      if (validRanges.length === 0) {
        setPreviewSegments([]);
        return;
      }

      const segments = validRanges.map((range, index) => ({
        segment: index + 1,
        start_time: range.start,
        end_time: range.end,
        duration: Math.round((timeToMinutes(range.end) - timeToMinutes(range.start)) / 60 * 10) / 10
      }));

      setPreviewSegments(segments);
    } catch (err) {
      console.error('미리보기 생성 오류:', err);
      setPreviewSegments([]);
      setError('분할 구간이 올바르지 않습니다.');
    }
  };

  const addSplitRange = () => {
    setSplitRanges(prev => [...prev, {start: '', end: ''}]);
  };

  const updateSplitRange = (index: number, field: 'start' | 'end', time: string) => {
    setSplitRanges(prev => prev.map((range, i) => 
      i === index ? {...range, [field]: time} : range
    ));
  };

  const removeSplitRange = (index: number) => {
    if (splitRanges.length > 1) {
      setSplitRanges(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async () => {
    if (!schedule) return;

    const validRanges = splitRanges.filter(range => 
      range.start && range.end && 
      timeToMinutes(range.start) < timeToMinutes(range.end) &&
      timeToMinutes(range.start) >= timeToMinutes(schedule.start_time) &&
      timeToMinutes(range.end) <= timeToMinutes(schedule.end_time)
    );
    
    // 🔧 최소 2개 구간 필요
    if (validRanges.length < 2) {
      setError('최소 2개의 유효한 분할 구간을 입력해주세요.');
      return;
    }

    // 🔧 분할 사유는 선택사항 - 빈 값도 허용
    const finalReason = reason.trim() || '관리자 분할';

    // 🔧 분할 지점 생성
    const sortedRanges = validRanges.sort((a, b) => 
      timeToMinutes(a.start) - timeToMinutes(b.start)
    );
    
    const splitPoints = [];
    for (let i = 0; i < sortedRanges.length - 1; i++) {
      splitPoints.push(sortedRanges[i].end);
    }
    
    console.log('🔧 생성된 분할 지점:', splitPoints);
    console.log('🔧 스케줄 ID:', schedule.id);
    console.log('🔧 분할 사유:', finalReason);

    try {
      setLoading(true);
      setError(null);
      
      await onSplit(schedule.id, splitPoints, finalReason);
      
    } catch (error) {
      console.error('분할 오류:', error);
      setError(error instanceof Error ? error.message : '분할 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };



  return (
    <div style={{ padding: '0 8px' }}>
      {error && (
        <div style={{
          backgroundColor: '#fee2e2',
          border: '1px solid #fecaca',
          borderRadius: UNIFIED_STYLES.borderRadius,
          padding: UNIFIED_STYLES.padding,
          marginBottom: UNIFIED_STYLES.marginBottom,
          color: '#dc2626',
          fontSize: UNIFIED_STYLES.fontSize
        }}>
          {error}
        </div>
      )}

      {/* 🔧 원본 스케줄 시간 hh:mm 표기 */}
      <div style={{
        backgroundColor: '#f8fafc',
        padding: UNIFIED_STYLES.padding,
        borderRadius: UNIFIED_STYLES.borderRadius,
        marginBottom: UNIFIED_STYLES.marginBottom,
        border: '1px solid #e2e8f0'
      }}>
        <h4 style={{ 
          margin: '0 0 10px 0', 
          color: '#374151',
          fontSize: '16px',
          fontWeight: '600'
        }}>
          분할할 원본 스케줄
        </h4>
        <div style={{ display: 'grid', gap: '8px', fontSize: UNIFIED_STYLES.fontSize }}>
          <p style={{ margin: 0 }}>
            교수: <strong>{schedule?.professor_name}</strong> - {schedule?.course_name}
          </p>
          <p style={{ margin: 0 }}>
            시간: <strong>{schedule?.start_time?.slice(0, 5)} ~ {schedule?.end_time?.slice(0, 5)}</strong>
          </p>
          <p style={{ margin: 0 }}>
            날짜: {schedule?.shoot_date} / 스튜디오: {schedule?.sub_locations?.name || schedule?.sub_location_id}번
          </p>
          <p style={{ margin: 0 }}>
            촬영형식: {schedule?.shooting_type || 'PPT'}
          </p>
        </div>
      </div>

      {/* 분할 구간 설정 */}
      <div style={{ marginBottom: UNIFIED_STYLES.marginBottom }}>
        <h4 style={{ 
          margin: '0 0 12px 0', 
          color: '#374151',
          fontSize: '16px',
          fontWeight: '600'
        }}>
          분할 구간 설정 (최소 2개 구간 필요)
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {splitRanges.map((range, index) => (
            <div key={index} style={{
              display: 'grid',
              gridTemplateColumns: '100px 1fr 30px 1fr auto',
              alignItems: 'center',
              gap: UNIFIED_STYLES.gap,
              padding: UNIFIED_STYLES.padding,
              backgroundColor: '#f9fafb',
              borderRadius: UNIFIED_STYLES.borderRadius,
              border: '1px solid #e5e7eb'
            }}>
              <label style={{ 
                fontSize: UNIFIED_STYLES.labelSize,
                fontWeight: '500',
                color: '#374151'
              }}>
                구간 {index + 1}:
              </label>
              
              <select
                value={range.start}
                onChange={(e) => updateSplitRange(index, 'start', e.target.value)}
                disabled={loading}
                style={{
                  padding: UNIFIED_STYLES.padding,
                  border: '1px solid #d1d5db',
                  borderRadius: UNIFIED_STYLES.borderRadius,
                  fontSize: UNIFIED_STYLES.fontSize,
                  outline: 'none',
                  transition: 'border-color 0.15s ease-in-out'
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              >
                <option value="">시작 시간</option>
                {validTimeOptions.map(time => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>

              <span style={{ 
                textAlign: 'center', 
                fontSize: UNIFIED_STYLES.fontSize, 
                color: '#6b7280',
                fontWeight: '500'
              }}>
                ~
              </span>
              
              <select
                value={range.end}
                onChange={(e) => updateSplitRange(index, 'end', e.target.value)}
                disabled={loading}
                style={{
                  padding: UNIFIED_STYLES.padding,
                  border: '1px solid #d1d5db',
                  borderRadius: UNIFIED_STYLES.borderRadius,
                  fontSize: UNIFIED_STYLES.fontSize,
                  outline: 'none',
                  transition: 'border-color 0.15s ease-in-out'
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              >
                <option value="">종료 시간</option>
                {validTimeOptions.map(time => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
              
              {splitRanges.length > 1 && (
                <button
                  onClick={() => removeSplitRange(index)}
                  disabled={loading}
                  style={{
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: UNIFIED_STYLES.borderRadius,
                    padding: '8px 12px',
                    fontSize: '13px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontWeight: '500'
                  }}
                >
                  삭제
                </button>
              )}
            </div>
          ))}
        </div>
        
        <button
          onClick={addSplitRange}
          disabled={loading}
          style={{
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: UNIFIED_STYLES.borderRadius,
            padding: UNIFIED_STYLES.padding,
            fontSize: UNIFIED_STYLES.fontSize,
            cursor: loading ? 'not-allowed' : 'pointer',
            marginTop: '12px',
            fontWeight: '500'
          }}
        >
          + 분할 구간 추가
        </button>
      </div>

{/* 🔧 분할 사유 - 필수 아님 */}
      <div style={{ marginBottom: UNIFIED_STYLES.marginBottom }}>
        <label style={{ 
          display: 'block', 
          marginBottom: '8px', 
          fontWeight: '600',
          fontSize: UNIFIED_STYLES.labelSize
        }}>
          분할 사유 (선택사항)
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="예: 촬영자 배치를 위한 시간 분할, 복수 촬영진 필요, 장비 교체 시간 확보 등..."
          rows={2}
          disabled={loading}
          style={{
            width: '100%',
            padding: UNIFIED_STYLES.padding,
            border: '1px solid #d1d5db',
            borderRadius: UNIFIED_STYLES.borderRadius,
            fontSize: UNIFIED_STYLES.fontSize,
            resize: 'none',
            fontFamily: 'inherit',
            outline: 'none',
            transition: 'border-color 0.15s ease-in-out'
          }}
        />
      </div>

      {previewSegments.length > 0 && (
        <div style={{
          backgroundColor: '#ecfdf5',
          padding: UNIFIED_STYLES.padding,
          borderRadius: UNIFIED_STYLES.borderRadius,
          marginBottom: UNIFIED_STYLES.marginBottom,
          border: '1px solid #a7f3d0'
        }}>
          <h4 style={{ 
            margin: '0 0 12px 0', 
            color: '#065f46',
            fontSize: '16px',
            fontWeight: '600'
          }}>
            {previewSegments.length === 1 
              ? '시간 수정 미리보기' 
              : `분할 결과 미리보기 (${previewSegments.length}개 세그먼트)`}
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {previewSegments.map((segment, index) => (
              <div key={index} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: UNIFIED_STYLES.padding,
                backgroundColor: 'white',
                borderRadius: UNIFIED_STYLES.borderRadius,
                fontSize: UNIFIED_STYLES.fontSize,
                border: '1px solid #a7f3d0'
              }}>
                <span style={{ fontWeight: '500' }}>
                  {segment.segment}교시: {segment.start_time} ~ {segment.end_time}
                </span>
                <span style={{ 
                  color: '#059669', 
                  fontWeight: '600',
                  backgroundColor: '#d1fae5',
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '13px'
                }}>
                  {segment.duration}시간
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '12px',
        paddingTop: '16px',
        borderTop: '1px solid #e5e7eb'
      }}>
        <button
          onClick={onCancel}
          disabled={loading}
          style={{
            padding: UNIFIED_STYLES.padding,
            border: '1px solid #d1d5db',
            borderRadius: UNIFIED_STYLES.borderRadius,
            background: 'white',
            color: '#374151',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: UNIFIED_STYLES.fontSize,
            fontWeight: '500'
          }}
        >
          취소
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading || previewSegments.length < 2}  // 🔧 사유 필수 조건 제거
          style={{
            padding: UNIFIED_STYLES.padding,
            border: 'none',
            borderRadius: UNIFIED_STYLES.borderRadius,
            background: (loading || previewSegments.length < 2) ? '#9ca3af' : '#059669',
            color: 'white',
            cursor: (loading || previewSegments.length < 2) ? 'not-allowed' : 'pointer',
            fontSize: UNIFIED_STYLES.fontSize,
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {loading && (
            <div style={{
              width: '16px',
              height: '16px',
              border: '2px solid rgba(255,255,255,0.3)',
              borderTop: '2px solid white',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
          )}
          {loading ? '분할 중...' : '분할 실행'}
        </button>
      </div>
    </div>
  );
};

// 제작센터 연락 모달 컴포넌트
const ContactCenterModal = ({ open, onClose, contactInfo }: {
  open: boolean;
  onClose: () => void;
  contactInfo: string;
}) => {
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
      zIndex: 10000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '400px',
        textAlign: 'center',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
      }}>
        <h3 style={{ 
          color: '#dc2626', 
          marginBottom: '16px',
          fontSize: '18px',
          fontWeight: 'bold'
        }}>
          온라인 수정 불가
        </h3>
        <p style={{ 
          marginBottom: '16px', 
          lineHeight: 1.5,
          color: '#374151',
          fontSize: UNIFIED_STYLES.fontSize
        }}>
          수정 가능 기간(목요일 23:59)이 지났습니다.<br/>
          스케줄 변경을 원하시면 제작센터로 연락해주세요.
        </p>
        <div style={{
          padding: '16px',
          backgroundColor: '#fef2f2',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: UNIFIED_STYLES.fontSize,
          fontWeight: 'bold',
          color: '#dc2626',
          whiteSpace: 'pre-line'
        }}>
          {contactInfo}
        </div>
        <button
          onClick={onClose}
          style={{
            padding: UNIFIED_STYLES.padding,
            backgroundColor: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: UNIFIED_STYLES.borderRadius,
            cursor: 'pointer',
            fontSize: UNIFIED_STYLES.fontSize,
            fontWeight: '500'
          }}
        >
          확인
        </button>
      </div>
    </div>
  );
};

// 사유 입력 모달 컴포넌트
const ReasonModal = ({ 
  open, 
  type, 
  onClose, 
  onSubmit 
}: {
  open: boolean;
  type: 'modify' | 'cancel';
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) => {
  const [reason, setReason] = useState('');

  const titles = {
    modify: '수정 요청 사유',
    cancel: '취소 요청 사유'
  };

  const placeholders = {
    modify: '수정이 필요한 이유를 입력해주세요...',
    cancel: '취소가 필요한 이유를 입력해주세요...'
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
      zIndex: 10000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        width: '400px',
        maxWidth: '90vw',
        padding: '24px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
      }}>
        <h3 style={{ 
          margin: '0 0 16px 0', 
          fontSize: '18px', 
          fontWeight: 'bold',
          color: '#111827'
        }}>
          {titles[type]}
        </h3>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={placeholders[type]}
          rows={4}
          style={{
            width: '100%',
            padding: UNIFIED_STYLES.padding,
            border: '1px solid #d1d5db',
            borderRadius: UNIFIED_STYLES.borderRadius,
            fontSize: UNIFIED_STYLES.fontSize,
            outline: 'none',
            resize: 'vertical',
            marginBottom: '16px',
            boxSizing: 'border-box'
          }}
        />
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          justifyContent: 'flex-end' 
        }}>
          <button
            onClick={onClose}
            style={{
              padding: UNIFIED_STYLES.padding,
              border: '1px solid #d1d5db',
              borderRadius: UNIFIED_STYLES.borderRadius,
              backgroundColor: 'white',
              cursor: 'pointer',
              fontSize: UNIFIED_STYLES.fontSize
            }}
          >
            취소
          </button>
          <button
            onClick={() => {
              if (!reason.trim()) {
                alert('사유를 입력해주세요.');
                return;
              }
              onSubmit(reason.trim());
              setReason('');
            }}
            style={{
              padding: UNIFIED_STYLES.padding,
              border: 'none',
              borderRadius: UNIFIED_STYLES.borderRadius,
              backgroundColor: '#2563eb',
              color: 'white',
              cursor: 'pointer',
              fontSize: UNIFIED_STYLES.fontSize,
              fontWeight: '500'
            }}
          >
            요청 전송
          </button>
        </div>
      </div>
    </div>
  );
};

export default function StudioScheduleModal({
  open,
  onClose,
  initialData,
  locations,
  userRole,
  onSave,
  onDelete,
  mode = 'edit',
  onSplitSchedule
}: StudioScheduleModalProps) {
  const [currentMode, setCurrentMode] = useState<'edit' | 'split'>(mode === 'split' ? 'split' : 'edit');

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [userIdLoading, setUserIdLoading] = useState(true);

  const [policyStatus, setPolicyStatus] = useState({
    canEdit: true,
    message: '',
    contactInfo: '',
    urgencyLevel: 'safe' as 'safe' | 'warning' | 'danger'
  });

  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [reasonModalOpen, setReasonModalOpen] = useState(false);
  const [requestType, setRequestType] = useState<'modify' | 'cancel'>('modify');

  const [checkingConflict, setCheckingConflict] = useState(false);
  const [conflictDetected, setConflictDetected] = useState(false);

  const [scheduleHistory, setScheduleHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const getInitValue = (value: any): string => {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  };

  const formatTimeForInput = (timeValue: any): string => {
    if (!timeValue) return '';
    const timeStr = String(timeValue).trim();
    if (timeStr.includes(':')) {
      const parts = timeStr.split(':');
      if (parts.length >= 2) {
        return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
      }
    }
    return timeStr;
  };

  const approvalStatus = initialData?.scheduleData?.approval_status;
  const isAdmin = userRole === 'admin' || userRole === 'system_admin' || userRole === 'schedule_admin';
  const isCancelRequest = approvalStatus === 'cancel_request'||
    approvalStatus === 'cancellation_requested';

  const isEditMode = !!(initialData?.scheduleData && initialData.scheduleData.id);

  const getInitialFormData = () => {
    const scheduleData = initialData?.scheduleData;
    
    if (isEditMode && scheduleData) {
      return {
        shoot_date: getInitValue(scheduleData.shoot_date || initialData.date),
        start_time: formatTimeForInput(scheduleData.start_time),
        end_time: formatTimeForInput(scheduleData.end_time),
        professor_name: getInitValue(scheduleData.professor_name),
        course_name: getInitValue(scheduleData.course_name),
        course_code: getInitValue(scheduleData.course_code),
        shooting_type: getInitValue(scheduleData.shooting_type),
        notes: getInitValue(scheduleData.notes),
        sub_location_id: getInitValue(scheduleData.sub_location_id || initialData.locationId)
      };
    } else {
      // 🆕 신규 등록 모드
      const regRange = SchedulePolicy.getRegistrationDateRange();
      return {
        shoot_date: getInitValue(scheduleData?.shoot_date || initialData?.date || regRange.startDate),
        start_time: '',
        end_time: '',
        professor_name: '',
        course_name: '',
        course_code: '',
        shooting_type: getInitValue(scheduleData?.shooting_type || ''),  // 🆕 수정
        notes: '',
        sub_location_id: getInitValue(scheduleData?.sub_location_id || initialData?.locationId)  // 🆕 수정
      };
    }
  };

  const [formData, setFormData] = useState(getInitialFormData);
  
  const [shootingTypes, setShootingTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const [selectedProfessorInfo, setSelectedProfessorInfo] = useState<any>(null);
  
  const handleProfessorChange = (value: string, professor?: any) => {
    setFormData(prev => ({
      ...prev,
      professor_name: value
    }));

    if (professor) {
      setSelectedProfessorInfo({
        id: professor.id,
        category_name: professor.category_name
      });
    } else {
      setSelectedProfessorInfo(null);
    }
  };

   const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
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

    // 1. 원본 스케줄 조회
    const { data: originalSchedule, error: fetchError } = await supabase
      .from('schedules')
      .select('*')
      .eq('id', scheduleId)
      .single();

    if (fetchError || !originalSchedule) {
      throw new Error('원본 스케줄을 찾을 수 없습니다.');
    }

    // 2. 세그먼트 생성
    const startMinutes = timeToMinutes(originalSchedule.start_time);
    const endMinutes = timeToMinutes(originalSchedule.end_time);
    const splitMinutes = splitPoints.map(timeToMinutes).sort((a, b) => a - b);
    
    const segments = [];
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

    // 3. schedule_group_id 생성
    const scheduleGroupId = `split_${scheduleId}_${Date.now()}`;

    // ✅ 4. 원본 임시 비활성화 (시간 충돌 방지)
    const { error: deactivateError } = await supabase
      .from('schedules')
      .update({
        is_active: false,  // ✅ 임시 비활성화
        is_split: true,
        schedule_group_id: scheduleGroupId,
        split_at: new Date().toISOString(),
        split_reason: reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', scheduleId);

    if (deactivateError) {
      throw new Error(`원본 업데이트 실패: ${deactivateError.message}`);
    }

    // 5. 분할된 새 스케줄들 생성
    const newSchedules = segments.map((segment, index) => {
      const { id, ...scheduleWithoutId } = originalSchedule;  // ✅ id 제거
      
      return {
        ...scheduleWithoutId,  // ✅ id 없는 데이터
        parent_schedule_id: scheduleId,
        schedule_group_id: scheduleGroupId,
        is_split_schedule: true,
        start_time: segment.start_time,
        end_time: segment.end_time,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    });


    const { data: insertedSchedules, error: insertError } = await supabase
      .from('schedules')
      .insert(newSchedules)
      .select();

    if (insertError) {
      console.error('❌ 자식 생성 실패, 원본 복구 중...');
      
      // ❌ 실패 시 원본 복구
      await supabase
        .from('schedules')
        .update({
          is_active: true,
          is_split: false,
          schedule_group_id: null,
          split_at: null,
          split_reason: null
        })
        .eq('id', scheduleId);
      
      throw new Error(`분할 스케줄 생성 실패: ${insertError.message}`);
    }

    // 7. 히스토리 기록
    await supabase
      .from('schedule_history')
      .insert({
        schedule_id: scheduleId,
        change_type: 'split',
        changed_by: getUserNumericId(),
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

    // ✅ onSplitSchedule가 있으면 호출
    if (onSplitSchedule) {
      await onSplitSchedule(scheduleId, splitPoints, reason);
    }

    alert(`스케줄이 성공적으로 ${segments.length}개로 분할되었습니다!`);
    onClose();  // 모달 닫기

  } catch (error) {
    console.error('❌ 분할 오류:', error);
    alert(error instanceof Error ? error.message : '분할 처리 중 오류가 발생했습니다.');
    throw error;
  }
};




  const switchToSplitMode = () => {
    setCurrentMode('split');
  };

  const switchToEditMode = () => {
    setCurrentMode('edit');
  };

  // ESC 키 처리
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open && !saving) {
        if (reasonModalOpen) {
          setReasonModalOpen(false);
          return;
        }
        if (contactModalOpen) {
          setContactModalOpen(false);
          return;
        }
        onClose();
      }
    };

    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, saving, reasonModalOpen, contactModalOpen, onClose]);

  const fetchScheduleHistory = async (scheduleId: number) => {
    if (!scheduleId) return;

    setLoadingHistory(true);
    
    try {
      console.log('스케줄 히스토리 조회 시작:', scheduleId);

      const { data: historyData, error: historyError } = await supabase
        .from('schedule_history')
        .select('*')
        .eq('schedule_id', scheduleId)
        .order('created_at', { ascending: false });

      if (historyError) {
        console.error('히스토리 조회 오류:', historyError);
      }

      const { data: scheduleData, error: scheduleError } = await supabase
        .from('schedules')
        .select('*')
        .eq('id', scheduleId)
        .single();

      if (scheduleError) {
        console.error('스케줄 데이터 조회 오류:', scheduleError);
      }

      const getEssentialHistory = (rawHistory: any[]) => {
        const timeChangeRegex = /시간변경:\s*([^\s→]+).*→\s*([^\s,\]]+)/;

        let essential: any[] = [];
        let found = {
          등록: false,
          승인: false,
          취소: false,
          시간변경: false
        };

        rawHistory.forEach(item => {
          if (!found.등록 && item.action === '등록됨') {
            essential.push(item);
            found.등록 = true;
            return;
          }
          if (!found.승인 && (item.action === '승인처리' || item.action === '승인완료')) {
            essential.push(item);
            found.승인 = true;
            return;
          }
          if (!found.취소 && item.action === '취소완료') {
            essential.push(item);
            found.취소 = true;
            return;
          }
          if (!found.시간변경 && item.reason === '시간 변경') {
            const match = item.details.match(timeChangeRegex);
            if (match && match[1] !== match[2]) { 
              essential.push({
                ...item,
                details: `시간이 ${match[1]}에서 ${match[2]}으로 변경되었습니다`
              });
              found.시간변경 = true;
            }
            return;
          }
        });

        essential.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return essential;
      };

      const getUserDisplayName = (changedBy: any): string => {
        if (!changedBy) return getCurrentUserName();
        
        if (typeof changedBy === 'string' && isNaN(Number(changedBy))) {
          return changedBy;
        }
        
        return getCurrentUserName();
      };

      const getCurrentUserName = () => {
        return localStorage.getItem('userName') || 
               localStorage.getItem('displayName') || 
               'Unknown User';
      };

      const parseScheduleChanges = (description: string): { reason: string; details: string } => {
        if (!description) return { reason: '스케줄 변경', details: '스케줄이 수정되었습니다' };
        
        try {
          const timeChangePattern = /시간변경:\s*([^→]+)→([^,\]]+)/;
          const timeMatch = description.match(timeChangePattern);
          
          if (timeMatch && timeMatch.length >= 3) {
            const oldTime = String(timeMatch[1] || '').trim(); 
            const newTime = String(timeMatch[2] || '').trim();  
            
            if (oldTime && newTime) {
              return {
                reason: '시간 변경',
                details: `시간이 ${oldTime}에서 ${newTime}으로 변경되었습니다`
              };
            }
          }
          
          const dateChangePattern = /날짜변경:\s*([^→]+)→([^,\]]+)/;
          const dateMatch = description.match(dateChangePattern);
          
          if (dateMatch && dateMatch.length >= 3) {
            const oldDate = String(dateMatch[1] || '').trim();
            const newDate = String(dateMatch[2] || '').trim();
            
            if (oldDate && newDate) {
              return {
                reason: '날짜 변경',
                details: `촬영일이 ${oldDate}에서 ${newDate}로 변경되었습니다`
              };
            }
          }
          
          const professorChangePattern = /교수명변경:\s*([^→]+)→([^,\]]+)/;
          const professorMatch = description.match(professorChangePattern);
          
          if (professorMatch && professorMatch.length >= 3) {
            const oldName = String(professorMatch[1] || '').trim();
            const newName = String(professorMatch[2] || '').trim();
            
            if (oldName && newName) {
              return {
                reason: '교수명 변경',
                details: `교수명이 ${oldName}에서 ${newName}으로 변경되었습니다`
              };
            }
          }
          
          if (description.includes('관리자 직접 수정') || description.includes('직접 수정')) {
            const requestorMatch = description.match(/\[요청자:\s*([^\]]+)\]/);
            const requestor = requestorMatch && requestorMatch[1] ? String(requestorMatch[1]).trim() : '';
            return {
              reason: '관리자 직접 수정',
              details: requestor ? `${requestor}이(가) 직접 수정했습니다` : '관리자가 직접 수정했습니다'
            };
          }
          
          if (description.includes('수정 요청')) {
            return {
              reason: '수정 요청',
              details: description
            };
          }
          
          if (description.includes('취소')) {
            return {
              reason: '취소 처리',
              details: description
            };
          }
          
          return {
            reason: '스케줄 변경',
            details: description
          };
          
        } catch (error) {
          console.error('변경 내용 파싱 오류:', error);
          return {
            reason: '스케줄 변경',
            details: description || '스케줄이 수정되었습니다'
          };
        }
      };

      const currentUserName = getCurrentUserName();

      const historyMap = new Map<string, any>();

      if (scheduleData) {
        const actualCreator = scheduleData.created_by_name || 
                             scheduleData.professor_name || 
                             currentUserName;

        historyMap.set(`created_${scheduleData.id}`, {
          id: `created_${scheduleData.id}`,
          action: '등록됨',
          reason: '최초 스케줄 등록',
          changed_by: actualCreator,
          created_at: scheduleData.created_at,
          details: `${scheduleData.professor_name} 교수님 스케줄 등록`,
          source: 'system'
        });

        if (scheduleData.approval_status === 'approved') {
          historyMap.set(`approved_${scheduleData.id}`, {
            id: `approved_${scheduleData.id}`,
            action: '승인완료',
            reason: '관리자 승인 처리',
            changed_by: currentUserName,
            created_at: scheduleData.updated_at || scheduleData.created_at,
            details: `${scheduleData.professor_name} 교수님 스케줄 승인 완료`,
            source: 'system'
          });
        }

        if (scheduleData.approval_status === 'cancelled') {
          historyMap.set(`cancelled_${scheduleData.id}`, {
            id: `cancelled_${scheduleData.id}`,
            action: '취소완료',
            reason: '관리자 취소 승인',
            changed_by: currentUserName,
            created_at: scheduleData.updated_at || scheduleData.created_at,
            details: `${scheduleData.professor_name} 교수님 스케줄 취소 처리 완료`,
            source: 'system'
          });
        }
      }

      if (historyData && historyData.length > 0) {
        const uniqueHistory = historyData.reduce((acc: any[], current) => {
          const timeKey = new Date(current.created_at).getTime();
          const existing = acc.find(item => 
            Math.abs(new Date(item.created_at).getTime() - timeKey) < 5000 &&
            item.change_type === current.change_type
          );
          
          if (!existing) {
            acc.push(current);
          }
          return acc;
        }, []);

        uniqueHistory.slice(0, 8).forEach(item => {
          const key = `history_${item.id}`;
          
          if (!historyMap.has(key)) {
            const parsedChange = parseScheduleChanges(item.description || '');
            
            let actionName = '수정됨';
            if (item.change_type === 'cancelled') {
              actionName = '취소요청';
            } else if (item.change_type === 'approved') {
              actionName = '승인처리';
            } else if (parsedChange.reason === '관리자 직접 수정') {
              actionName = '관리자수정';
            } else if (parsedChange.reason === '수정 요청') {
              actionName = '수정요청';
            } else if (parsedChange.reason === '시간 변경') {
              actionName = '시간변경';
            } else if (parsedChange.reason === '날짜 변경') {
              actionName = '날짜변경';
            } else if (parsedChange.reason === '교수명 변경') {
              actionName = '교수변경';
            }

            const changedByName = getUserDisplayName(item.changed_by);

            historyMap.set(key, {
              id: key,
              action: actionName,
              reason: parsedChange.reason,
              changed_by: changedByName,
              created_at: item.created_at,
              details: parsedChange.details,
              source: 'history'
            });
          }
        });
      }

      const allHistory = Array.from(historyMap.values());
      const essentialHistory = getEssentialHistory(allHistory);

      setScheduleHistory(essentialHistory);
      console.log('히스토리 조회 완료:', essentialHistory.length, '개');

    } catch (error) {
      console.error('히스토리 조회 오류:', error);
      setScheduleHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    const getCurrentUserId = async () => {
      if (!open) return;
      
      try {
        setUserIdLoading(true);

        const storedUserName = localStorage.getItem('userName');
        const storedUserRole = localStorage.getItem('userRole');

        let mappedUserId: number | null = null;

        if (storedUserName && storedUserRole) {
          const userMapping: { [key: string]: number } = {
            'system_admin': 1,
            'schedule_admin': 2,
            'academy_manager': 3,
            'studio_manager': 4,
            'professor': 5
          };

          if (userMapping[storedUserName]) {
            mappedUserId = userMapping[storedUserName];
          }
          else if (userMapping[storedUserRole]) {
            mappedUserId = userMapping[storedUserRole];
          }
          else {
            mappedUserId = 5;
          }
        }

        if (mappedUserId) {
          setCurrentUserId(mappedUserId);
        } else {
          setCurrentUserId(5);
        }
        
      } catch (error) {
        console.error('사용자 ID 조회 실패:', error);
        setCurrentUserId(5);
      } finally {
        setUserIdLoading(false);
      }
    };

    getCurrentUserId();
  }, [open]);

  useEffect(() => {
    if (open) {
      const status = SchedulePolicy.getStatusMessage();
      setPolicyStatus({
        canEdit: status.canEdit,
        message: status.message,
        contactInfo: status.contactInfo || '',
        urgencyLevel: status.urgencyLevel
      });
    }
  }, [open]);

  useEffect(() => {
    if (initialData && open) {
      setFormData(getInitialFormData());
      setSelectedProfessorInfo(null);

      if (isEditMode && initialData.scheduleData?.id) {
        fetchScheduleHistory(initialData.scheduleData.id);
      } else {
        setScheduleHistory([]);
      }
    }
  }, [initialData, open, isEditMode]);

  useEffect(() => {
    if (!open) {
      setSaving(false);
      setMessage('');
      setUserIdLoading(true);
      setSelectedProfessorInfo(null);
      setScheduleHistory([]);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      fetchShootingTypes();
    }
  }, [open]);

  const fetchShootingTypes = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('shooting_types')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      setShootingTypes(data || []);
    } catch (error) {
      console.error('촬영형식 조회 오류:', error);
      setShootingTypes([
        { id: 1, name: 'PPT' },
        { id: 2, name: '전자칠판' },
        { id: 3, name: '크로마키' },
        { id: 4, name: 'PC와콤' },
        { id: 5, name: 'PC' },
        { id: 6, name: '일반칠판' }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const compatibleStudios = useMemo(() => {
    if (!formData.shooting_type) {
      return [];
    }

    if (!initialData?.shootingTypeMapping?.length) {
      const sortedStudios = locations.sort((a, b) => {
        const aNum = parseInt(a.name.toString().replace(/[^0-9]/g, '')) || 999;
        const bNum = parseInt(b.name.toString().replace(/[^0-9]/g, '')) || 999;
        return aNum - bNum;
      });
      return sortedStudios;
    }

    const shootingTypeMapping = initialData.shootingTypeMapping;
    const compatibleStudioIds = shootingTypeMapping
      .filter(mapping => mapping.shooting_types?.name === formData.shooting_type)
      .map(mapping => mapping.sub_location_id);

    const compatible = locations
      .filter(studio => compatibleStudioIds.includes(studio.id))
      .sort((a, b) => {
        const aNum = parseInt(a.name.toString().replace(/[^0-9]/g, '')) || 999;
        const bNum = parseInt(b.name.toString().replace(/[^0-9]/g, '')) || 999;
        return aNum - bNum;
      });

    return compatible;
  }, [formData.shooting_type, locations, initialData?.shootingTypeMapping]);

  useEffect(() => {
    if (!formData.shooting_type) {
      if (formData.sub_location_id) {
        setFormData(prev => ({
          ...prev,
          sub_location_id: ''
        }));
      }
      return;
    }

    if (compatibleStudios.length > 0) {
      const currentStudioId = parseInt(formData.sub_location_id);
      const isCurrentStudioCompatible = compatibleStudios.some(studio => studio.id === currentStudioId);

      if (isEditMode) {
        if (!isCurrentStudioCompatible) {
          const topStudio = compatibleStudios[0];
          setFormData(prev => ({
            ...prev,
            sub_location_id: topStudio.id.toString()
          }));
        }
      } else {
        const topStudio = compatibleStudios[0];
        
        if (currentStudioId !== topStudio.id) {
          setFormData(prev => ({
            ...prev,
            sub_location_id: topStudio.id.toString()
          }));
        }
      }
    } else {
      setFormData(prev => ({
        ...prev,
        sub_location_id: ''
      }));
    }
  }, [formData.shooting_type, compatibleStudios, locations, isEditMode]);

  const checkScheduleConflict = async (
  shootDate: string,
  startTime: string,
  endTime: string,
  subLocationId: string,
  scheduleIdToExclude?: number
): Promise<boolean> => {
  if (!shootDate || !startTime || !endTime || !subLocationId) return false;

  try {
    let query = supabase
      .from('schedules')
      .select('id, professor_name, start_time, end_time, sub_location_id, approval_status, parent_schedule_id, deletion_reason, sub_locations(id, name)')
      .eq('shoot_date', shootDate)  // shoot_date
      .eq('sub_location_id', parseInt(subLocationId))  // sub_location_id
      .eq('schedule_type', 'studio')  // schedule_type
      .eq('is_active', true)  // is_active
      .neq('approval_status', 'cancellation_requested')  // approval_status
      .neq('deletion_reason', 'split_converted')
      .or(`and(start_time.lt.${endTime},end_time.gt.${startTime})`);  // start_time, end_time

    if (scheduleIdToExclude) {
      query = query.neq('id', scheduleIdToExclude);
    }

    const { data, error } = await query;

    if (error) {
      console.error('중복 체크 오류:', error);
      return false;
    }

    const currentSchedule = await supabase
      .from('schedules')
      .select('parent_schedule_id')
      .eq('id', scheduleIdToExclude || 0)
      .maybeSingle();

    const filteredData = (data || []).filter(schedule => {
      if (
        schedule.parent_schedule_id &&
        currentSchedule.data?.parent_schedule_id &&
        schedule.parent_schedule_id === currentSchedule.data.parent_schedule_id
      ) {
        return false;
      }
      return true;
    });

    return filteredData.length > 0;
  } catch (error) {
    console.error('스케줄 충돌 확인 오류:', error);
    return false;
  }
};



  useEffect(() => {
    const checkConflict = async () => {
      setCheckingConflict(true);
      try {
        const conflict = await checkScheduleConflict(
          formData.shoot_date,
          formData.start_time,
          formData.end_time,
          formData.sub_location_id,
          initialData?.scheduleData?.id
        );
        
        setConflictDetected(conflict);
      } catch (error) {
        setConflictDetected(false);
      } finally {
        setCheckingConflict(false);
      }
    };

    if (
      formData.shoot_date &&
      formData.start_time &&
      formData.end_time &&
      formData.sub_location_id
    ) {
      const timeoutId = setTimeout(checkConflict, 300);
      return () => clearTimeout(timeoutId);
    } else {
      setConflictDetected(false);
      setCheckingConflict(false);
    }
  }, [formData.shoot_date, formData.start_time, formData.end_time, formData.sub_location_id, compatibleStudios]);

  const timeOptions = generateStudioTimeOptions();

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleApproveModification = async () => {
    const confirmApprove = confirm(
      `${formData.professor_name} 교수님의 수정 요청을 승인하시겠습니까?\n\n` +
      `승인 후 관리자가 스케줄을 수정할 수 있습니다.`
    );

    if (!confirmApprove) return;

    setSaving(true);
    try {
      const adminName = localStorage.getItem('userName') || 'Unknown User';
      const adminId = parseInt(localStorage.getItem('userId') || '0');
      
      const { error } = await supabase
        .from('schedules')
        .update({
          approval_status: 'modification_approved',
          approved_at: new Date().toISOString(),
          approved_by: adminId,
          modification_reason: `수정 승인 완료 (승인자: ${adminName})`
        })
        .eq('id', initialData.scheduleData.id);
      
      if (error) throw error;

    const messageText = `[수정 권한 승인]\\n\\n교수명: ${formData.professor_name}\\n촬영일: ${initialData.scheduleData.shoot_date}\\n처리 결과: 수정 승인됨\\n처리자: ${adminName}\\n\\n이제 스케줄을 수정할 수 있습니다.`;
    
      // 메시지 발송
      sendMessage(messageText, 'channel', []);

        
        alert('수정 권한이 승인되었습니다. 이제 수정할 수 있습니다.');
        onClose();
      } catch (error) {
        console.error('승인 처리 오류:', error);
        alert('승인 처리 중 오류가 발생했습니다.');
      } finally {
        setSaving(false);
      }
    };

const handleApproveCancellation = async () => {
  const confirmApprove = confirm(
    `${formData.professor_name} 교수님의 취소 요청을 승인하시겠습니까?\n\n` +
    `승인 후 스케줄이 완전히 취소됩니다.`
  );

  if (!confirmApprove) return;

  setSaving(true);
  try {
    const adminName = localStorage.getItem('userName') || 'Unknown User';
    
    const { error } = await supabase
      .from('schedules')
      .update({
        approval_status: 'cancelled',
        is_active: false,
        cancellation_reason: `취소 승인 완료 (승인자: ${adminName})`
      })
      .eq('id', initialData.scheduleData.id);
    
    if (error) throw error;
    
    // ✅ schedule_history로 수정
    await supabase
      .from('schedule_history')
      .insert({
        schedule_id: initialData.scheduleData.id,
        change_type: 'cancelled',
        changed_by: getUserNumericId(),
        description: `취소 승인 처리 완료 (승인자: ${adminName})`,
        old_value: JSON.stringify(initialData.scheduleData),
        new_value: JSON.stringify({
          ...initialData.scheduleData,
          approval_status: 'cancelled'
        }),
        created_at: new Date().toISOString()
      });
    
    alert('취소 요청이 승인되었습니다.');
    onClose();
  } catch (error) {
    console.error('취소 승인 처리 오류:', error);
    alert('취소 승인 처리 중 오류가 발생했습니다.');
  } finally {
    setSaving(false);
  }
};

  const handleSave = async (action: 'temp' | 'request' | 'approve'|'cancel_approve') => {
    if (userIdLoading) {
      setMessage('사용자 정보를 확인하는 중입니다. 잠시만 기다려주세요.');
      return;
    }

    if (!currentUserId) {
      setMessage('사용자 정보를 확인할 수 없습니다. 페이지를 새로고침 후 다시 시도해주세요.');
      return;
    }

if (action === 'cancel_approve') {
  const scheduleId = initialData.scheduleData.id;

  const { error } = await supabase
    .from('schedules')
    .update({
      approval_status: 'cancelled',
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq('id', scheduleId);

  const adminName = localStorage.getItem('userName') || 
                   localStorage.getItem('displayName') || 
                   'Unknown User';

  if (error) throw error;
  
  // ✅ schedule_history로 수정
  await supabase
    .from('schedule_history')
    .insert({
      schedule_id: scheduleId,
      change_type: 'cancelled',
      changed_by: getUserNumericId(),
      description: `관리자 직권 취소: ${adminName}이 직접 취소 처리`,
      old_value: JSON.stringify(initialData.scheduleData),
      new_value: JSON.stringify({
        ...initialData.scheduleData,
        approval_status: 'cancelled'
      }),
      created_at: new Date().toISOString()
    });

  await onSave({ scheduleId }, 'cancel_approve');
  onClose();
  return;
}

    if (isEditMode && action !== 'approve') {
      const canEdit = SchedulePolicy.canEditOnline();
      if (!canEdit) {
        setContactModalOpen(true);
        return;
      }
    }

    if (conflictDetected) {
      alert('선택하신 시간대에 이미 다른 스케줄이 있습니다. 시간을 조정해주세요.');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const formDataWithUser = {
        ...formData,
        currentUserId: currentUserId
      };

      const result = await onSave(formDataWithUser, action);
      
      if (result.success && isEditMode) {
        const currentUser = localStorage.getItem('userName') || 'Unknown User';
        const originalData = initialData?.scheduleData;
        
        console.log('히스토리 기록 시작:', {
          currentUser,
          originalData: {
            start_time: originalData?.start_time,
            end_time: originalData?.end_time,
            shoot_date: originalData?.shoot_date,
            professor_name: originalData?.professor_name
          },
          formData: {
            start_time: formData.start_time,
            end_time: formData.end_time,
            shoot_date: formData.shoot_date,
            professor_name: formData.professor_name
          }
        });
        
        const changes = [];
        
        if (originalData?.start_time !== formData.start_time || originalData?.end_time !== formData.end_time) {
          changes.push(`시간변경: ${originalData?.start_time}~${originalData?.end_time} → ${formData.start_time}~${formData.end_time}`);
        }
        
        if (originalData?.shoot_date !== formData.shoot_date) {
          changes.push(`날짜변경: ${originalData?.shoot_date} → ${formData.shoot_date}`);
        }
        
        if (originalData?.professor_name !== formData.professor_name) {
          changes.push(`교수명변경: ${originalData?.professor_name} → ${formData.professor_name}`);
        }
        
        console.log('감지된 변경사항:', changes);
        
        if (changes.length > 0) {
          const detailsText = changes.join(', ');
          const actionType = action === 'approve' ? 'approved' : 'modification_requested';
          
          let reasonText = '';
          if (action === 'approve') {
            reasonText = '관리자 직접 수정';
          } else {
            reasonText = modificationReason || selectedProfessorInfo?.reason || '시간변경';
          }
          
          console.log('기록할 히스토리:', { actionType, reasonText, detailsText });
          
          try {
            const historyResult = await supabase
              .from('schedule_history')
              .insert({
                schedule_id: initialData.scheduleData.id,
                change_type: actionType,
                description: `수정 요청: ${reasonText} [요청자: ${currentUser}]`,
                changed_by: currentUserId,
                old_value: JSON.stringify(originalData),
                new_value: JSON.stringify(formData),
                changed_at: new Date().toISOString()
              });

              if (action === 'approve') {
                const messageText = `[스케줄 수정 완료]\\n\\n교수명: ${formData.professor_name}\\n촬영일: ${formData.shoot_date}\\n시간: ${formData.start_time}~${formData.end_time}\\n처리자: ${currentUser}\\n\\n스케줄이 최종 수정되었습니다.`;
                
              // 메시지 발송
              sendMessage(messageText, 'channel', []);

               }
              
            console.log('히스토리 기록 성공:', historyResult);
          } catch (historyError) {
            console.error('히스토리 기록 실패:', historyError);
          }
        }
      }

      setMessage(result.message);

      if (result.success) {
        alert(result.message);
        onClose();
        setMessage('');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '저장 중 오류가 발생했습니다.';
      setMessage(errorMessage);
      alert(errorMessage);
      console.error('저장 오류:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isEditMode || !initialData?.scheduleData?.id) {
      alert('삭제할 수 없는 스케줄입니다.');
      return;
    }

    const confirmDelete = confirm(
      `정말로 이 스케줄을 삭제하시겠습니까?\n\n` +
      `교수명: ${formData.professor_name}\n` +
      `날짜: ${formData.shoot_date}\n` +
      `시간: ${formData.start_time} ~ ${formData.end_time}\n\n` +
      `삭제된 스케줄은 복구할 수 없습니다.`
    );

    if (!confirmDelete) return;

    setSaving(true);
    setMessage('');

    try {
      const { error } = await supabase
        .from('schedules')
        .update({
          is_active: false,
          approval_status: 'cancelled',
          deletion_reason: 'admin_deleted',
          updated_at: new Date().toISOString()
        })
        .eq('id', initialData.scheduleData.id);

      if (error) throw error;

      alert('스케줄이 삭제되었습니다.');
      
      if (onDelete) {
        await onDelete(initialData.scheduleData.id);
      }
      
      onClose();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '삭제 중 오류가 발생했습니다.';
      setMessage(errorMessage);
      alert(errorMessage);
      console.error('삭제 오류:', error);
    } finally {
      setSaving(false);
    }
  };

  const [modificationReason, setModificationReason] = useState('');
  const [cancellationReason, setCancellationReason] = useState('');

  const handleRequestWithReason = (reason: string) => {
    if (requestType === 'modify') {
      setModificationReason(reason);
    } else if (requestType === 'cancel') {
      setCancellationReason(reason);
    }
    
    setReasonModalOpen(false);
    handleSave(actionMap[requestType] as 'temp');
  };

  const getStudioOptionLabel = (studio: any) => {
    let label = `${studio.name}번 스튜디오`;

    if (initialData?.shootingTypeMapping?.length && formData.shooting_type) {
      const studioMappings = initialData.shootingTypeMapping.filter(
        mapping => mapping.sub_location_id === studio.id
      );

      const supportedTypes = studioMappings.map(mapping => mapping.shooting_types?.name).filter(Boolean);
      const isPrimary = studioMappings.some(mapping =>
        mapping.shooting_types?.name === formData.shooting_type && mapping.is_primary
      );

      if (supportedTypes.includes(formData.shooting_type)) {
        label += isPrimary ? ' - 주 촬영형식' : ' - 지원';
      }
    }

    return label;
  };

  const formatDateTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!open) return null;

  const isSplitMode = currentMode === 'split';

  return (
    <>
          {/* 개선된 통일 모달 사이즈 - 완전 반응형 */}
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            zIndex: 1000,
            paddingTop: '100px', // ✅ 80px → 60px (조금 더 위로)
            paddingBottom: '20px',
            paddingLeft: '20px',
            paddingRight: '20px',
            overflowY: 'auto'
          }} onClick={handleBackdropClick}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '850px', // ✅ 900px → 850px (살짝 축소)
              minWidth: '320px', // ✅ 700px → 320px (모바일 대응)
              maxHeight: 'calc(100vh - 100px)', // ✅ 90px → 100px (여유공간)
              overflow: 'hidden',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              margin: '0 auto'
            }} onClick={(e) => e.stopPropagation()}>

          {/* 헤더 */}
          <div style={{
            borderBottom: '1px solid #E5E7EB',
            flexShrink: 0
          }}>
            {/* 탭 헤더 */}
            {isEditMode && isAdmin && (
              <div style={{
                display: 'flex',
                borderBottom: '1px solid #e5e7eb'
              }}>
                <button
                  onClick={switchToEditMode}
                  style={{
                    flex: 1,
                    padding: '10px 20px',
                    border: 'none',
                    backgroundColor: currentMode === 'edit' ? 'white' : '#f9fafb',
                    color: currentMode === 'edit' ? '#059669' : '#6b7280',
                    borderBottom: currentMode === 'edit' ? '2px solid #059669' : '2px solid transparent',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  스케줄 편집
                </button>
                <button
                  onClick={switchToSplitMode}
                  style={{
                    flex: 1,
                    padding: '10px 20px',
                    border: 'none',
                    backgroundColor: currentMode === 'split' ? 'white' : '#f9fafb',
                    color: currentMode === 'split' ? '#f59e0b' : '#6b7280',
                    borderBottom: currentMode === 'split' ? '2px solid #f59e0b' : '2px solid transparent',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  스케줄 분할
                </button>
              </div>
            )}
            
            {/* 모달 제목 */}
            <div style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h2 style={{ 
                margin: 0, 
                fontSize: '16px', 
                fontWeight: 'bold',
                color: '#111827'
              }}>
                {isSplitMode ? '스케줄 분할' : 
                 isEditMode ? '스튜디오 스케줄 관리' : '스튜디오 스케줄 등록'}
              </h2>
              <button
                onClick={onClose}
                disabled={saving}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  padding: '0',
                  color: '#6b7280',
                  opacity: saving ? 0.5 : 1
                }}
              >
                ×
              </button>
            </div>
          </div>

          {/* 메인 콘텐츠 */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {isSplitMode && isEditMode ? (
              /* 분할 모드 */
              <div style={{ 
                flex: 1, 
                padding: '20px',
                overflowY: 'auto'
              }}>
                <ScheduleSplitSection
                  schedule={initialData.scheduleData}
                  onSplit={handleSplitSchedule}
                  onCancel={switchToEditMode}
                />
              </div>
            ) : (
              /* 편집 모드 */
              <>
                {/* 메인 콘텐츠 영역 */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isEditMode && scheduleHistory.length > 0 ? '1.2fr 0.8fr' : '1fr',
                  gap: '20px',
                  padding: '20px',
                  flex: 1,
                  overflow: 'hidden'
                }}>
                  {/* 왼쪽: 폼 필드들 */}
                  <div style={{ 
                    overflowY: 'auto',
                    paddingRight: '8px'
                  }}>
                    {/* 날짜/시간을 한 행에 배치 - 통일된 스타일 */}
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '1fr 1fr 1fr', 
                      gap: UNIFIED_STYLES.gap,
                      marginBottom: UNIFIED_STYLES.marginBottom
                    }}>
                      <div>
                        <label style={{
                          display: 'block',
                          marginBottom: '6px',
                          fontSize: UNIFIED_STYLES.labelSize,
                          fontWeight: '600',
                          color: '#374151'
                        }}>
                          촬영 날짜 *
                        </label>
                        <input
                          type="date"
                          value={formData.shoot_date}
                          onChange={(e) => handleChange('shoot_date', e.target.value)}
                          disabled={saving}
                          style={{
                            width: '100%',
                            padding: UNIFIED_STYLES.padding,
                            border: '1px solid #d1d5db',
                            borderRadius: UNIFIED_STYLES.borderRadius,
                            fontSize: UNIFIED_STYLES.fontSize,
                            outline: 'none',
                            backgroundColor: saving ? '#f9fafb' : 'white',
                            transition: 'border-color 0.15s ease-in-out'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                          onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                        />
                      </div>
                      <div>
                        <label style={{
                          display: 'block',
                          marginBottom: '6px',
                          fontSize: UNIFIED_STYLES.labelSize,
                          fontWeight: '600',
                          color: '#374151'
                        }}>
                          시작 시간 *
                        </label>
                        <select
                          value={formData.start_time}
                          onChange={(e) => handleChange('start_time', e.target.value)}
                          disabled={saving}
                          style={{
                            width: '100%',
                            padding: UNIFIED_STYLES.padding,
                            border: '1px solid #d1d5db',
                            borderRadius: UNIFIED_STYLES.borderRadius,
                            fontSize: UNIFIED_STYLES.fontSize,
                            outline: 'none',
                            backgroundColor: saving ? '#f9fafb' : 'white',
                            transition: 'border-color 0.15s ease-in-out'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                          onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                        >
                          <option value="">시작 시간</option>
                          {timeOptions.map(time => (
                            <option key={time} value={time}>{time}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{
                          display: 'block',
                          marginBottom: '6px',
                          fontSize: UNIFIED_STYLES.labelSize,
                          fontWeight: '600',
                          color: '#374151'
                        }}>
                          종료 시간 *
                        </label>
                        <select
                          value={formData.end_time}
                          onChange={(e) => handleChange('end_time', e.target.value)}
                          disabled={saving}
                          style={{
                            width: '100%',
                            padding: UNIFIED_STYLES.padding,
                            border: '1px solid #d1d5db',
                            borderRadius: UNIFIED_STYLES.borderRadius,
                            fontSize: UNIFIED_STYLES.fontSize,
                            outline: 'none',
                            backgroundColor: saving ? '#f9fafb' : 'white',
                            transition: 'border-color 0.15s ease-in-out'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                          onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                        >
                          <option value="">종료 시간</option>
                          {timeOptions.map(time => (
                            <option key={time} value={time}>{time}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* 교수명/강의명 */}
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '1fr 1fr', 
                      gap: UNIFIED_STYLES.gap,
                      marginBottom: UNIFIED_STYLES.marginBottom
                    }}>
                      <div>
                        <label style={{
                          display: 'block',
                          marginBottom: '6px',
                          fontSize: UNIFIED_STYLES.labelSize,
                          fontWeight: '600',
                          color: '#374151'
                        }}>
                          교수명 *
                        </label>
                        <ProfessorAutocomplete
                          value={formData.professor_name || ''}
                          onChange={(value) => handleChange('professor_name', value)}
                          disabled={saving}
                        />
                      </div>
                      <div>
                        <label style={{
                          display: 'block',
                          marginBottom: '6px',
                          fontSize: UNIFIED_STYLES.labelSize,
                          fontWeight: '600',
                          color: '#374151'
                        }}>
                          강의명
                        </label>
                        <input
                          type="text"
                          value={formData.course_name}
                          onChange={(e) => handleChange('course_name', e.target.value)}
                          disabled={saving}
                          style={{
                            width: '100%',
                            padding: UNIFIED_STYLES.padding,
                            border: '1px solid #d1d5db',
                            borderRadius: UNIFIED_STYLES.borderRadius,
                            fontSize: UNIFIED_STYLES.fontSize,
                            outline: 'none',
                            backgroundColor: saving ? '#f9fafb' : 'white',
                            transition: 'border-color 0.15s ease-in-out'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                          onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                        />
                      </div>
                    </div>

                    {/* 강의코드 */}
                    <div style={{ marginBottom: UNIFIED_STYLES.marginBottom }}>
                      <label style={{
                        display: 'block',
                        marginBottom: '6px',
                        fontSize: UNIFIED_STYLES.labelSize,
                        fontWeight: '600',
                        color: '#374151'
                      }}>
                        강의코드
                      </label>
                      <input
                        type="text"
                        value={formData.course_code}
                        onChange={(e) => handleChange('course_code', e.target.value)}
                        disabled={saving}
                        style={{
                          width: '100%',
                          padding: UNIFIED_STYLES.padding,
                          border: '1px solid #d1d5db',
                          borderRadius: UNIFIED_STYLES.borderRadius,
                          fontSize: UNIFIED_STYLES.fontSize,
                          outline: 'none',
                          backgroundColor: saving ? '#f9fafb' : 'white',
                          transition: 'border-color 0.15s ease-in-out'
                        }}
                        onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                        onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                      />
                    </div>

                    {/* 촬영형식/스튜디오 */}
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '1fr 1fr', 
                      gap: UNIFIED_STYLES.gap,
                      marginBottom: UNIFIED_STYLES.marginBottom
                    }}>
                      <div>
                        <label style={{
                          display: 'block',
                          marginBottom: '6px',
                          fontSize: UNIFIED_STYLES.labelSize,
                          fontWeight: '600',
                          color: '#374151'
                        }}>
                          촬영형식 *
                        </label>
                        <select
                          value={formData.shooting_type}
                          onChange={(e) => handleChange('shooting_type', e.target.value)}
                          disabled={saving || isLoading}
                          style={{
                            width: '100%',
                            padding: UNIFIED_STYLES.padding,
                            border: '1px solid #d1d5db',
                            borderRadius: UNIFIED_STYLES.borderRadius,
                            fontSize: UNIFIED_STYLES.fontSize,
                            outline: 'none',
                            backgroundColor: saving || isLoading ? '#f9fafb' : 'white',
                            transition: 'border-color 0.15s ease-in-out'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                          onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                        >
                          <option value="">촬영형식 선택</option>
                          {shootingTypes.map(type => (
                            <option key={type.id} value={type.name}>{type.name}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label style={{
                          display: 'block',
                          marginBottom: '6px',
                          fontSize: UNIFIED_STYLES.labelSize,
                          fontWeight: '600',
                          color: '#374151'
                        }}>
                          스튜디오 *
                        </label>
                        <select
                          value={formData.sub_location_id}
                          onChange={(e) => handleChange('sub_location_id', e.target.value)}
                          disabled={saving || (!formData.shooting_type)}
                          style={{
                            width: '100%',
                            padding: UNIFIED_STYLES.padding,
                            border: '1px solid #d1d5db',
                            borderRadius: UNIFIED_STYLES.borderRadius,
                            fontSize: UNIFIED_STYLES.fontSize,
                            outline: 'none',
                            backgroundColor: saving || (!formData.shooting_type) ? '#f9fafb' : 'white',
                            transition: 'border-color 0.15s ease-in-out'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                          onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                        >
                          {(() => {
                            if (!formData.shooting_type) {
                              return <option value="">촬영형식을 먼저 선택해주세요</option>;
                            }
                            
                            if (compatibleStudios.length === 0) {
                              return <option value="">호환되는 스튜디오가 없습니다</option>;
                            }
                            
                            return (
                              <>
                                {!formData.sub_location_id && (
                                  <option value="">스튜디오 선택</option>
                                )}
                                {compatibleStudios.map(studio => (
                                  <option key={`studio-${studio.id}`} value={studio.id.toString()}>
                                    {getStudioOptionLabel(studio)}
                                  </option>
                                ))}
                              </>
                            );
                          })()}
                        </select>
                      </div>
                    </div>

                    {/* 중복 체크 안내 */}
                    {checkingConflict && (
                      <div style={{
                        color: '#2563eb',
                        marginBottom: '12px',
                        fontWeight: 'bold',
                        fontSize: '14px'
                      }}>
                        스튜디오를 확인 중입니다...
                      </div>
                    )}

                    {!checkingConflict && conflictDetected && (
                      <div style={{
                        color: '#dc2626',
                        marginBottom: '12px',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        padding: '8px',
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: UNIFIED_STYLES.borderRadius
                      }}>
                        선택하신 날짜와 시간에 이미 같은 스튜디오에서 예약된 스케줄이 있습니다.
                      </div>
                    )}

                    {/* 비고 */}
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{
                        display: 'block',
                        marginBottom: '6px',
                        fontSize: UNIFIED_STYLES.labelSize,
                        fontWeight: '600',
                        color: '#374151'
                      }}>
                        비고
                      </label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) => handleChange('notes', e.target.value)}
                        disabled={saving}
                        rows={3}
                        style={{
                          width: '100%',
                          padding: UNIFIED_STYLES.padding,
                          border: '1px solid #d1d5db',
                          borderRadius: UNIFIED_STYLES.borderRadius,
                          fontSize: UNIFIED_STYLES.fontSize,
                          outline: 'none',
                          backgroundColor: saving ? '#f9fafb' : 'white',
                          resize: 'none',
                          transition: 'border-color 0.15s ease-in-out'
                        }}
                        onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                        onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                      />
                    </div>
                  </div>

                  {/* 오른쪽: 변경 히스토리 */}
                  {isEditMode && (
                    <div style={{
                      borderLeft: '1px solid #e5e7eb',
                      paddingLeft: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden'
                    }}>
                      <h3 style={{
                        margin: '0 0 12px 0',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#374151',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        flexShrink: 0
                      }}>
                        변경 히스토리
                        {scheduleHistory.length > 0 && (
                          <span style={{
                            fontSize: '10px',
                            backgroundColor: '#e5e7eb',
                            color: '#6b7280',
                            padding: '1px 4px',
                            borderRadius: '8px'
                          }}>
                            {scheduleHistory.length}
                          </span>
                        )}
                      </h3>

                      {loadingHistory ? (
                        <div style={{
                          padding: '16px',
                          textAlign: 'center',
                          color: '#6b7280',
                          fontSize: '12px'
                        }}>
                          <div style={{
                            width: '16px',
                            height: '16px',
                            border: '2px solid #e5e7eb',
                            borderTop: '2px solid #3b82f6',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite',
                            margin: '0 auto 6px'
                          }} />
                          히스토리를 불러오는 중...
                        </div>
                      ) : scheduleHistory.length === 0 ? (
                        <div style={{
                          padding: '16px',
                          textAlign: 'center',
                          color: '#9ca3af',
                          fontSize: '12px',
                          backgroundColor: '#f9fafb',
                          borderRadius: '6px',
                          border: '1px dashed #d1d5db'
                        }}>
                          변경 기록이 없습니다
                        </div>
                      ) : (
                        <div style={{
                          flex: 1,
                          overflowY: 'auto',
                          paddingRight: '6px'
                        }}>
                          {scheduleHistory.map((historyItem, index) => (
                            <div key={historyItem.id || index} style={{
                              padding: '10px',
                              borderBottom: index < scheduleHistory.length - 1 ? '1px solid #e5e7eb' : 'none',
                              backgroundColor: index % 2 === 0 ? 'white' : '#f9fafb'
                            }}>
                              <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                marginBottom: '6px'
                              }}>
                                <span style={{
                                  fontSize: '12px',
                                  fontWeight: historyItem.action === '승인완료' || historyItem.action === '수정' || 
                                            historyItem.action === '관리자수정' ? 'bold' : 
                                            historyItem.action === '등록됨' || historyItem.action === '수정요청' || 
                                            historyItem.action === '취소요청' ? '600' : 'normal',
                                  color: '#374151'
                                }}>
                                  {historyItem.action}
                                </span>
                                <span style={{
                                  fontSize: '10px',
                                  color: '#6b7280'
                                }}>
                                  {formatDateTime(historyItem.created_at)}
                                </span>
                              </div>
                              
                              <div style={{ fontSize: '11px', lineHeight: '1.3' }}>
                                <div style={{ marginBottom: '3px' }}>
                                  <span style={{ fontWeight: '500', color: '#374151' }}>
                                    {historyItem.action.includes('요청') ? '요청자:' : '처리자:'}
                                  </span>
                                  <span style={{ marginLeft: '6px', color: '#6b7280' }}>
                                    {historyItem.changed_by}
                                  </span>
                                </div>
                                
                                <div style={{ marginBottom: '3px' }}>
                                  <span style={{ fontWeight: '500', color: '#374151' }}>사유:</span>
                                  <span style={{ marginLeft: '6px', color: '#6b7280' }}>
                                    {historyItem.reason}
                                  </span>
                                </div>
                                
                                <div>
                                  <span style={{ fontWeight: '500', color: '#374151' }}>세부:</span>
                                  <span style={{ 
                                    marginLeft: '6px', 
                                    color: '#6b7280',
                                    whiteSpace: 'pre-line'
                                  }}>
                                    {historyItem.details || '상세 정보 없음'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 메시지 표시 */}
                {message && (
                  <div style={{
                    margin: '0 20px 12px',
                    padding: '8px',
                    borderRadius: '4px',
                    backgroundColor: message.includes('오류') || message.includes('실패') ? '#fef2f2' : '#f0fdf4',
                    color: message.includes('오류') || message.includes('실패') ? '#dc2626' : '#166534',
                    fontSize: '12px',
                    border: `1px solid ${message.includes('오류') || message.includes('실패') ? '#fecaca' : '#bbf7d0'}`,
                    flexShrink: 0
                  }}>
                    {message}
                  </div>
                )}

                {/* 상태 표시 */}
                {isEditMode && (
                  <div style={{
                    margin: '0 20px 12px',
                    padding: '8px',
                    backgroundColor: '#f0f9ff',
                    borderRadius: '4px',
                    border: '1px solid #dbeafe',
                    flexShrink: 0
                  }}>
                    <div style={{ 
                      fontSize: '11px', 
                      color: '#1e40af',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <span style={{ fontWeight: '600' }}>현재 상태:</span>
                      {(() => {
                        const status = initialData?.scheduleData?.approval_status;
                        const statusText = {
                          'pending': '승인 대기중',
                          'approved': '승인 완료',
                          'confirmed': '승인 완료', 
                          'modification_requested': '수정 승인 대기중',
                          'modification_approved': '수정 승인됨',
                          'cancellation_requested': '취소 승인 대기중',
                          'cancelled': '취소됨'
                        }[status] || status;
                        
                        return (
                          <>
                            <span>{statusText}</span>
                            {initialData?.scheduleData?.updated_at && (
                              <span style={{ color: '#6b7280', fontSize: '10px' }}>
                                {new Date(initialData.scheduleData.updated_at).toLocaleString('ko-KR')}
                              </span>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* 버튼 영역 - 분할 모드가 아닐 때만 */}
          {!isSplitMode && (
            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid #E5E7EB',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0
            }}>
              {/* 좌측: 관리자 승인 버튼들 */}
              <div style={{ display: 'flex', gap: '8px' }}>
                {isAdmin && approvalStatus === 'modification_requested' && (
                  <button
                    onClick={handleApproveModification}
                    disabled={saving}
                    style={{
                      padding: UNIFIED_STYLES.padding,
                      backgroundColor: saving ? '#d1d5db' : '#7c3aed',
                      color: 'white',
                      border: 'none',
                      borderRadius: UNIFIED_STYLES.borderRadius,
                      cursor: saving ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      fontWeight: '500'
                    }}
                  >
                    수정 승인
                  </button>
                )}

                {isAdmin && approvalStatus === 'cancellation_requested' && (
                  <button
                    onClick={handleApproveCancellation}
                    disabled={saving}
                    style={{
                      padding: UNIFIED_STYLES.padding,
                      backgroundColor: saving ? '#d1d5db' : '#dc2626',
                      color: 'white',
                      border: 'none',
                      borderRadius: UNIFIED_STYLES.borderRadius,
                      cursor: saving ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      fontWeight: '500'
                    }}
                  >
                    취소 승인
                  </button>
                )}
              </div>

              {/* 우측: 기존 버튼들 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {saving && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{
                      width: '12px', height: '12px',
                      border: '2px solid #d1d5db',
                      borderTop: '2px solid #059669',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>처리 중...</span>
                  </div>
                )}

                {isEditMode && (
                  <button
                    onClick={() => {
                      const confirmCancel = confirm(
                        `정말로 이 스케줄을 취소하시겠습니까?\n\n` +
                        `교수명: ${formData.professor_name}\n` +
                        `날짜: ${formData.shoot_date}\n` +
                        `시간: ${formData.start_time} ~ ${formData.end_time}\n\n` +
                        `관리자 직권으로 즉시 취소됩니다.`
                      );
                      
                      if (confirmCancel) {
                        handleSave('cancel_approve');
                      }
                    }}
                    disabled={saving}
                    style={{
                      padding: UNIFIED_STYLES.padding,
                      border: '1px solid #dc2626',
                      borderRadius: UNIFIED_STYLES.borderRadius,
                      backgroundColor: 'white',
                      color: '#dc2626',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      fontWeight: '500',
                      opacity: saving ? 0.5 : 1
                    }}
                  >
                    스케줄 취소
                  </button>
                )}

                {isAdmin && isEditMode && (
                  <button
                    onClick={handleDelete}
                    disabled={saving}
                    style={{
                      padding: UNIFIED_STYLES.padding,
                      border: 'none',
                      borderRadius: UNIFIED_STYLES.borderRadius,
                      backgroundColor: saving ? '#d1d5db' : '#dc2626',
                      color: 'white',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      fontWeight: '500'
                    }}
                  >
                    삭제
                  </button>
                )}

                {isAdmin ? (
                  <>
                    <button
                      onClick={() => handleSave('temp')}
                      disabled={saving || checkingConflict || conflictDetected}
                      style={{
                        padding: UNIFIED_STYLES.padding,
                        border: 'none',
                        borderRadius: UNIFIED_STYLES.borderRadius,
                                                backgroundColor: (saving || checkingConflict || conflictDetected) ? '#d1d5db' : '#6b7280',
                        color: 'white',
                        cursor: (saving || checkingConflict || conflictDetected) ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}
                    >
                      임시저장
                    </button>
                    <button
                      onClick={() => handleSave('approve')}
                      disabled={saving || checkingConflict || conflictDetected}
                      style={{
                        padding: UNIFIED_STYLES.padding,
                        border: 'none',
                        borderRadius: UNIFIED_STYLES.borderRadius,
                        backgroundColor: (saving || checkingConflict || conflictDetected) ? '#d1d5db' : '#059669',
                        color: 'white',
                        cursor: (saving || checkingConflict || conflictDetected) ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}
                    >
                      승인
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleSave('temp')}
                      disabled={saving || checkingConflict || conflictDetected}
                      style={{
                        padding: UNIFIED_STYLES.padding,
                        border: 'none',
                        borderRadius: UNIFIED_STYLES.borderRadius,
                        backgroundColor: (saving || checkingConflict || conflictDetected) ? '#d1d5db' : '#6b7280',
                        color: 'white',
                        cursor: (saving || checkingConflict || conflictDetected) ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}
                    >
                      임시저장
                    </button>
                    <button
                      onClick={() => handleSave('request')}
                      disabled={saving || checkingConflict || conflictDetected}
                      style={{
                        padding: UNIFIED_STYLES.padding,
                        border: 'none',
                        borderRadius: UNIFIED_STYLES.borderRadius,
                        backgroundColor: (saving || checkingConflict || conflictDetected) ? '#d1d5db' : '#2563eb',
                        color: 'white',
                        cursor: (saving || checkingConflict || conflictDetected) ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}
                    >
                      승인요청
                    </button>
                  </>
                )}

                <button
                  onClick={onClose}
                  disabled={saving}
                  style={{
                    padding: UNIFIED_STYLES.padding,
                    border: '1px solid #d1d5db',
                    borderRadius: UNIFIED_STYLES.borderRadius,
                    backgroundColor: 'white',
                    color: '#374151',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                    opacity: saving ? 0.5 : 1
                  }}
                >
                  닫기
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 연락처 모달 */}
      <ContactCenterModal
        open={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
        contactInfo={policyStatus.contactInfo}
      />

      {/* 사유 입력 모달 */}
      <ReasonModal
        open={reasonModalOpen}
        type={requestType}
        onClose={() => setReasonModalOpen(false)}
        onSubmit={handleRequestWithReason}
      />

      {/* 개선된 CSS - 포커스 효과 빠르게 사라지게 */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        /* 포커스 효과 빠르게 사라지게 */
        input, select, textarea {
          transition: border-color 0.15s ease-in-out !important;
        }
        
        input:focus, select:focus, textarea:focus {
          border-color: #3b82f6 !important;
          outline: none !important;
          box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.1) !important;
        }
        
        input:not(:focus), select:not(:focus), textarea:not(:focus) {
          border-color: #d1d5db !important;
          box-shadow: none !important;
        }
        
        @media (max-width: 768px) {
          .modal-container {
            margin-top: 60px !important;
            padding: 10px !important;
          }
          
          .modal-content {
            min-width: 90vw !important;
            max-height: calc(100vh - 80px) !important;
          }
        }
      `}</style>
    </>
  );
}

// ActionType 매핑
const actionMap = {
  modify: 'modify_request',
  cancel: 'cancel_request'
} as const;

