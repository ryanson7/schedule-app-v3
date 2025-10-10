"use client";
import React, { useState, useRef } from 'react';

interface UnifiedScheduleCardProps {
  schedule: any;
  scheduleType: 'academy' | 'studio';
  locationColor?: {
    bg: string;
    border: string;
    text: string;
  };
  onClick?: (schedule: any) => void;
  onContextMenu?: (schedule: any) => void;
  
  // Studio 전용 props
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent, schedule: any) => void;
  onDragEnd?: () => void;
  isAdmin?: boolean;
  onDelete?: (schedule: any) => void;
  onSoftDelete?: (schedule: any) => void;
  
  // 통합스케줄용 props
  showShooterInfo?: boolean;
  shooterText?: string;
  showCheckbox?: boolean;
  isSelected?: boolean;
  onCheckboxChange?: (checked: boolean) => void;
  
  style?: React.CSSProperties;
}

// 🔥 CSS 변수 사용 - 통일된 텍스트 스타일
const textStyles = {
  title: {
    fontSize: 'var(--schedule-card-title)',      // 14px
    fontWeight: 'var(--card-title-weight)',      // 700
    lineHeight: 1.2
  },
  subtitle: {
    fontSize: 'var(--schedule-card-subtitle)',   // 12px
    fontWeight: 'var(--card-subtitle-weight)',   // 500
    lineHeight: 1.2
  },
  body: {
    fontSize: 'var(--schedule-card-body)',       // 11px
    fontWeight: 'var(--card-body-weight)',       // 400
    lineHeight: 1.2
  },
  meta: {
    fontSize: 'var(--schedule-card-meta)',       // 10px
    fontWeight: 'var(--card-meta-weight)',       // 600
    lineHeight: 1
  },
  tiny: {
    fontSize: 'var(--schedule-card-tiny)',       // 9px
    fontWeight: 'var(--card-body-weight)',       // 400
    lineHeight: 1
  }
};

// 🔥 공통 상태 처리 함수
const getStatusInfo = (approvalStatus: string, isActive: boolean) => {
  if (!isActive) {
    if (approvalStatus === 'cancelled') {
      return {
        text: '취소완료',
        color: '#dc2626',
        bgColor: '#fef2f2',
        borderColor: '#dc2626'
      };
    } else if (approvalStatus === 'deleted') {
      return {
        text: '삭제완료',
        color: '#dc2626',
        bgColor: '#fef2f2',
        borderColor: '#dc2626'
      };
    }
  }

  switch (approvalStatus) {
    case 'pending':
      return {
        text: '임시저장',
        color: '#6b7280',
        bgColor: '#f9fafb',
        borderColor: '#6b7280'
      };
    case 'approval_requested':
      return {
        text: '승인요청',
        color: '#2563eb',
        bgColor: '#eff6ff',
        borderColor: '#2563eb'
      };
    case 'approved':
      return {
        text: '승인완료',
        color: '#059669',
        bgColor: '#f0fdf4',
        borderColor: '#059669'
      };
    case 'confirmed':
      return {
        text: '확정완료',
        color: '#059669',
        bgColor: '#f0fdf4',
        borderColor: '#059669'
      };
    case 'modification_requested':
      return {
        text: '수정요청',
        color: '#8b5cf6',
        bgColor: '#faf5ff',
        borderColor: '#8b5cf6'
      };
    case 'modification_approved':
      return {
        text: '수정중',
        color: '#f59e0b',
        bgColor: '#fffbeb',
        borderColor: '#f59e0b'
      };
    case 'cancellation_requested':
      return {
        text: '취소요청',
        color: '#f59e0b',
        bgColor: '#fffbeb',
        borderColor: '#f59e0b'
      };
    case 'deletion_requested':
      return {
        text: '삭제요청',
        color: '#dc2626',
        bgColor: '#fef2f2',
        borderColor: '#dc2626'
      };
    default:
      return {
        text: '상태 미정',
        color: '#6b7280',
        bgColor: '#f9fafb',
        borderColor: '#6b7280'
      };
  }
};

// 🔥 Academy + Studio 통합 촬영형식 스타일
const getShootingTypeStyle = (type: string, scheduleType: 'academy' | 'studio') => {
  // Academy 촬영형식
  const academyStyles = {
    '촬영': {
      background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(34, 197, 94, 0.05) 100%)',
      color: '#16A34A',
      border: '1px solid rgba(34, 197, 94, 0.4)',
      shadow: 'inset 0 1px 2px rgba(34, 197, 94, 0.3)'
    },
    '중계': {
      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.05) 100%)',
      color: '#2563EB',
      border: '1px solid rgba(59, 130, 246, 0.4)',
      shadow: 'inset 0 1px 2px rgba(59, 130, 246, 0.3)'
    },
    '(본사)촬영': {
      background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(245, 158, 11, 0.05) 100%)',
      color: '#D97706',
      border: '1px solid rgba(245, 158, 11, 0.4)',
      shadow: 'inset 0 1px 2px rgba(245, 158, 11, 0.3)'
    },
    '라이브촬영': {
      background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.15) 0%, rgba(236, 72, 153, 0.05) 100%)',
      color: '#DB2777',
      border: '1px solid rgba(236, 72, 153, 0.4)',
      shadow: 'inset 0 1px 2px rgba(236, 72, 153, 0.3)'
    },
    '라이브중계': {
      background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.15) 0%, rgba(124, 58, 237, 0.05) 100%)',
      color: '#7C3AED',
      border: '1px solid rgba(124, 58, 237, 0.4)',
      shadow: 'inset 0 1px 2px rgba(124, 58, 237, 0.3)'
    },
    '(NAS)촬영': {
      background: 'linear-gradient(135deg, rgba(107, 114, 128, 0.15) 0%, rgba(107, 114, 128, 0.05) 100%)',
      color: '#4B5563',
      border: '1px solid rgba(107, 114, 128, 0.4)',
      shadow: 'inset 0 1px 2px rgba(107, 114, 128, 0.3)'
    }
  };

  // Studio 촬영형식
  const studioStyles = {
    'PPT': {
      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.05) 100%)',
      color: '#2563EB',
      border: '1px solid rgba(59, 130, 246, 0.4)',
      shadow: 'inset 0 1px 2px rgba(59, 130, 246, 0.3)'
    },
    '빔판서(PPT)': {
      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.05) 100%)',
      color: '#2563EB',
      border: '1px solid rgba(59, 130, 246, 0.4)',
      shadow: 'inset 0 1px 2px rgba(59, 130, 246, 0.3)'
    },
    '전자칠판': {
      background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(34, 197, 94, 0.05) 100%)',
      color: '#16A34A',
      border: '1px solid rgba(34, 197, 94, 0.4)',
      shadow: 'inset 0 1px 2px rgba(34, 197, 94, 0.3)'
    },
    '크로마키': {
      background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.15) 0%, rgba(236, 72, 153, 0.05) 100%)',
      color: '#DB2777',
      border: '1px solid rgba(236, 72, 153, 0.4)',
      shadow: 'inset 0 1px 2px rgba(236, 72, 153, 0.3)'
    },
    'PC와콤': {
      background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(245, 158, 11, 0.05) 100%)',
      color: '#D97706',
      border: '1px solid rgba(245, 158, 11, 0.4)',
      shadow: 'inset 0 1px 2px rgba(245, 158, 11, 0.3)'
    },
    'PC': {
      background: 'linear-gradient(135deg, rgba(20, 184, 166, 0.15) 0%, rgba(20, 184, 166, 0.05) 100%)',
      color: '#14B8A6',
      border: '1px solid rgba(20, 184, 166, 0.4)',
      shadow: 'inset 0 1px 2px rgba(20, 184, 166, 0.3)'
    },
    '일반칠판': {
      background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.15) 0%, rgba(124, 58, 237, 0.05) 100%)',
      color: '#7C3AED',
      border: '1px solid rgba(124, 58, 237, 0.4)',
      shadow: 'inset 0 1px 2px rgba(124, 58, 237, 0.3)'
    },
    '웹캠': {
      background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(99, 102, 241, 0.05) 100%)',
      color: '#6366F1',
      border: '1px solid rgba(99, 102, 241, 0.4)',
      shadow: 'inset 0 1px 2px rgba(99, 102, 241, 0.3)'
    },
    '라이브': {
      background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0.05) 100%)',
      color: '#EF4444',
      border: '1px solid rgba(239, 68, 68, 0.4)',
      shadow: 'inset 0 1px 2px rgba(239, 68, 68, 0.3)'
    },
    '태블릿': {
      background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.15) 0%, rgba(14, 165, 233, 0.05) 100%)',
      color: '#0EA5E9',
      border: '1px solid rgba(14, 165, 233, 0.4)',
      shadow: 'inset 0 1px 2px rgba(14, 165, 233, 0.3)'
    },
    '녹화': {
      background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(168, 85, 247, 0.05) 100%)',
      color: '#A855F7',
      border: '1px solid rgba(168, 85, 247, 0.4)',
      shadow: 'inset 0 1px 2px rgba(168, 85, 247, 0.3)'
    },
    '스마트폰': {
      background: 'linear-gradient(135deg, rgba(52, 211, 153, 0.15) 0%, rgba(52, 211, 153, 0.05) 100%)',
      color: '#34D399',
      border: '1px solid rgba(52, 211, 153, 0.4)',
      shadow: 'inset 0 1px 2px rgba(52, 211, 153, 0.3)'
    }
  };

  const styles = scheduleType === 'academy' ? academyStyles : studioStyles;
  const defaultStyle = scheduleType === 'academy' ? academyStyles['촬영'] : studioStyles['PPT'];
  return styles[type] || defaultStyle;
};

export const UnifiedScheduleCard = ({ 
  schedule, 
  scheduleType,
  locationColor,
  onClick,
  onContextMenu,
  isDragging = false,
  onDragStart,
  onDragEnd,
  isAdmin = false,
  onDelete,
  onSoftDelete,
  showShooterInfo = false,
  shooterText,
  showCheckbox = false,
  isSelected = false,
  onCheckboxChange,
  style
}: UnifiedScheduleCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const isDragActiveRef = useRef(false);

  // 🔥 공통 데이터 처리
  const safeSchedule = {
    startTime: schedule?.start_time?.substring(0, 5) || '00:00',
    endTime: schedule?.end_time?.substring(0, 5) || '00:00',
    professorName: schedule?.professor_name || schedule?.task_name || '교수명 없음',
    courseName: schedule?.course_name || schedule?.notes || '과정명 없음',
    shootingType: schedule?.shooting_type || (scheduleType === 'academy' ? '촬영' : 'PPT'),
    approvalStatus: schedule?.approval_status || 'pending'
  };

  const statusInfo = getStatusInfo(safeSchedule.approvalStatus, schedule?.is_active);
  const shootingStyle = getShootingTypeStyle(safeSchedule.shootingType, scheduleType);
  const isInactive = schedule?.is_active === false;

  // 🔥 Academy/Studio별 기본 색상
  const getDefaultColor = () => {
    if (scheduleType === 'academy') {
      return locationColor || { bg: '#F9FAFB', border: '#E5E7EB', text: '#374151' };
    } else {
      return { bg: '#f0f9ff', border: '#0ea5e9', text: '#0c4a6e' };
    }
  };

  const cardColor = getDefaultColor();

  // 🔥 공통 이벤트 핸들러
  const handleClick = (e: React.MouseEvent) => {
    if (scheduleType === 'studio' && isDragActiveRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    const target = e.target as HTMLElement;
    const checkbox = target.closest('input[type="checkbox"]');
    
    if (checkbox) {
      e.stopPropagation();
      return;
    }

    e.stopPropagation();
    onClick?.(schedule);
  };

  // 🔥 Studio 전용 드래그 핸들러
  const handleDragStart = (e: React.DragEvent) => {
    if (scheduleType !== 'studio') return;
    
    isDragActiveRef.current = true;
    const dragData = {
      id: schedule.id,
      shoot_date: schedule.shoot_date,
      sub_location_id: schedule.sub_location_id,
      professor_name: schedule.professor_name,
      course_name: schedule.course_name,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      shooting_type: schedule.shooting_type
    };
    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'move';
    onDragStart?.(e, schedule);
  };

  const handleDragEnd = () => {
    if (scheduleType !== 'studio') return;
    isDragActiveRef.current = false;
    onDragEnd?.();
  };

  // 🔥 공통 스타일
  const cardStyle: React.CSSProperties = {
    padding: 8,
    background: cardColor.bg,
    borderRadius: 6,
    border: `2px solid ${cardColor.border}`,
    cursor: isDragging ? 'grabbing' : 'pointer',
    marginBottom: 4,
    transition: 'all 0.2s ease',
    minHeight: 'auto',
    maxHeight: '200px',
    overflowY: 'auto',
    wordWrap: 'break-word',
    wordBreak: 'break-word',
    outline: 'none',
    transform: isHovered && !isDragging ? 'translateY(-1px)' : 'none',
    boxShadow: isHovered && !isDragging ? '0 4px 12px rgba(0, 0, 0, 0.15)' : 'none',
    position: 'relative',
    userSelect: 'none',
    opacity: isDragging ? 0.7 : (isInactive ? 0.7 : 1),
    filter: isInactive ? 'grayscale(30%)' : 'none',
    ...style
  };

  return (
    <div
      draggable={scheduleType === 'studio' && !isDragging && !showShooterInfo}
      onDragStart={scheduleType === 'studio' ? handleDragStart : undefined}
      onDragEnd={scheduleType === 'studio' ? handleDragEnd : undefined}
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(schedule);
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={cardStyle}
    >
      {/* 🔥 통합스케줄 레이아웃 (showShooterInfo=true) */}
      {showShooterInfo ? (
        <>
          {/* 첫 번째 줄: 시간 + 교수명 (체크박스 없음) */}
          <div style={{ 
            ...textStyles.title, // 🎯 14px
            color: cardColor.text,
            marginBottom: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            <span>{safeSchedule.startTime}~{safeSchedule.endTime}</span>
            <span style={{ color: '#9ca3af' }}>|</span>
            <span>{safeSchedule.professorName}</span>
          </div>
          
          {/* 두 번째 줄: 강의명 + 촬영형식 */}
          <div style={{ 
            ...textStyles.subtitle, // 🎯 12px
            marginBottom: 6,
            color: cardColor.text,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8
          }}>
            <div style={{
              flex: 1,
              wordWrap: 'break-word',
              wordBreak: 'break-word',
              whiteSpace: 'normal'
            }}>
              {safeSchedule.courseName}
            </div>
            
            <span style={{
              background: shootingStyle.background,
              color: shootingStyle.color,
              padding: '2px 6px',
              borderRadius: 4,
              ...textStyles.tiny, // 🎯 9px
              boxShadow: `${shootingStyle.shadow}, 0 1px 3px rgba(0, 0, 0, 0.1)`,
              border: shootingStyle.border,
              textShadow: '0 1px 1px rgba(255, 255, 255, 0.8)',
              flexShrink: 0,
              whiteSpace: 'nowrap'
            }}>
              {safeSchedule.shootingType}
            </span>
          </div>

          {/* 세 번째 줄: 촬영자이름(근무시간) + 승인상태 */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            minHeight: '16px'
          }}>
            <div style={{ 
              color: shooterText ? '#059669' : '#dc2626',
              ...textStyles.body, // 🎯 11px
              flex: 1
            }}>
              {shooterText || '미배치'}
            </div>
            
            <div style={{
              backgroundColor: statusInfo.bgColor,
              color: statusInfo.color,
              border: `1px solid ${statusInfo.borderColor}`,
              borderRadius: '10px',
              padding: '2px 8px',
              ...textStyles.tiny, // 🎯 9px
              flexShrink: 0
            }}>
              {statusInfo.text}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* 🔥 일반 레이아웃 (showShooterInfo=false) - 학원과 스튜디오 동일 */}
          
          {/* 첫 번째 줄: 시간 + 교수명 + 체크박스(학원만) */}
          <div style={{ 
            ...textStyles.title, // 🎯 14px
            color: '#374151',
            marginBottom: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flex: 1
            }}>
              <span>{safeSchedule.startTime}~{safeSchedule.endTime}</span>
              <span style={{ color: '#9ca3af' }}>|</span>
              <span style={{
                wordWrap: 'break-word',
                wordBreak: 'break-word'
              }}>
                {safeSchedule.professorName}
              </span>
            </div>
            
            {/* 🔥 체크박스 (일반모드 + 학원만) */}
            {scheduleType === 'academy' && showCheckbox && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => onCheckboxChange?.(e.target.checked)}
                onClick={(e) => e.stopPropagation()}
                style={{ 
                  transform: 'scale(1.1)',
                  cursor: 'pointer',
                  accentColor: '#2563eb',
                  marginLeft: '8px'
                }}
              />
            )}
          </div>

          {/* 두 번째 줄: 강의명 + 촬영형식 */}
          <div style={{ 
            ...textStyles.subtitle, // 🎯 12px
            marginBottom: 6,
            color: '#374151',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 8
          }}>
            <div style={{
              flex: 1,
              wordWrap: 'break-word',
              wordBreak: 'break-word',
              whiteSpace: 'normal'
            }}>
              {safeSchedule.courseName}
            </div>
            
            <div style={{
              background: shootingStyle.background,
              color: shootingStyle.color,
              padding: scheduleType === 'academy' ? '3px 8px' : '2px 6px',
              borderRadius: scheduleType === 'academy' ? 6 : 4,
              ...textStyles.body, // 🎯 11px
              boxShadow: shootingStyle.shadow || '0 1px 2px rgba(0,0,0,0.1)',
              border: shootingStyle.border,
              textShadow: '0 1px 1px rgba(255, 255, 255, 0.8)',
              flexShrink: 0,
              whiteSpace: 'nowrap',
              alignSelf: 'flex-start'
            }}>
              {safeSchedule.shootingType}
            </div>
          </div>

          {/* 🔥 세 번째 줄: 촬영자 + 승인상태 (일반모드에도 포함) */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            minHeight: '18px'
          }}>
            <div style={{ 
              color: shooterText ? '#059669' : '#dc2626',
              ...textStyles.body, // 🎯 11px
              flex: 1
            }}>
              {shooterText || '미배치'}
            </div>
            
            <div style={{
              backgroundColor: statusInfo.bgColor,
              color: statusInfo.color,
              border: `1px solid ${statusInfo.borderColor}`,
              borderRadius: '12px',
              padding: '2px 8px',
              ...textStyles.meta, // 🎯 10px
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              flexShrink: 0
            }}>
              {statusInfo.text}
            </div>
          </div>
        </>
      )}

      {/* 비활성화된 스케줄 오버레이 */}
      {isInactive && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.1)',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...textStyles.subtitle, // 🎯 12px
          color: '#dc2626'
        }}>
          {schedule.approval_status === 'cancelled' ? '취소됨' : '삭제됨'}
        </div>
      )}
    </div>
  );
};
