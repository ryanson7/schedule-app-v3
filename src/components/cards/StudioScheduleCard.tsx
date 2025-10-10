"use client";
import React, { useRef, useState } from 'react';

interface StudioScheduleCardProps {
  schedule: any;
  onClick?: (schedule: any) => void;
  onContextMenu?: (schedule: any) => void;
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent, schedule: any) => void;
  onDragEnd?: () => void;
  style?: React.CSSProperties;
  // 🔥 관리자 삭제 기능 props
  isAdmin?: boolean;
  onDelete?: (schedule: any) => void;
  onSoftDelete?: (schedule: any) => void;
  // 🔥 통합스케줄용 props
  showShooterInfo?: boolean;
  shooterText?: string;
  showCheckbox?: boolean; // 🔥 체크박스 표시
  isSelected?: boolean; // 🔥 체크박스 선택 상태
  onCheckboxChange?: (checked: boolean) => void; // 🔥 체크박스 변경 콜백
}

export const StudioScheduleCard = ({ 
  schedule, 
  onClick, 
  onContextMenu, 
  isDragging = false, 
  onDragStart, 
  onDragEnd,
  style,
  // 🔥 관리자 기능 props
  isAdmin = false,
  onDelete,
  onSoftDelete,
  // 🔥 통합스케줄용 props
  showShooterInfo = false,
  shooterText,
  showCheckbox = false, // 🔥 체크박스 표시
  isSelected = false, // 🔥 선택 상태
  onCheckboxChange // 🔥 체크박스 콜백
}: StudioScheduleCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const isDragActiveRef = useRef(false);

  const safeSchedule = {
    startTime: schedule?.start_time?.substring(0, 5) || '00:00',
    endTime: schedule?.end_time?.substring(0, 5) || '00:00',
    professorName: schedule?.professor_name || schedule?.task_name || '교수명 없음',
    courseName: schedule?.course_name || schedule?.notes || '과정명 없음',
    shootingType: schedule?.shooting_type || 'PPT',
    approvalStatus: schedule?.approval_status || 'pending'
  };

  const getShootingTypeStyle = (type: string) => {
    const styles = {
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
    return styles[type] || styles['PPT'];
  };

  // 🔥 학원과 동일한 getStatusInfo 함수
  const getStatusInfo = (status: string, isActive: boolean = true) => {
    if (!isActive) {
      if (status === 'cancelled') {
        return {
          text: '취소완료',
          color: '#dc2626',
          bg: '#fef2f2',
          borderColor: '#dc2626'
        };
      } else if (status === 'deleted') {
        return {
          text: '삭제완료',
          color: '#dc2626',
          bg: '#fef2f2',
          borderColor: '#dc2626'
        };
      }
    }

    switch (status) {
      case 'pending':
        return {
          text: '임시저장',
          color: '#6b7280',
          bg: '#f9fafb',
          borderColor: '#6b7280'
        };
      
      case 'approval_requested':
        return {
          text: '승인요청',
          color: '#2563eb',
          bg: '#eff6ff',
          borderColor: '#2563eb'
        };
      
      case 'approved':
        return {
          text: '승인완료',
          color: '#059669',
          bg: '#f0fdf4',
          borderColor: '#059669'
        };
      
      case 'confirmed':
        return {
          text: '확정완료',
          color: '#059669',
          bg: '#f0fdf4',
          borderColor: '#059669'
        };
      
      case 'modification_requested':
        return {
          text: '수정요청',
          color: '#8b5cf6',
          bg: '#faf5ff',
          borderColor: '#8b5cf6'
        };
      
      case 'modification_approved':
        return {
          text: '수정중',
          color: '#f59e0b',
          bg: '#fffbeb',
          borderColor: '#f59e0b'
        };
      
      case 'cancellation_requested':
        return {
          text: '취소요청',
          color: '#f59e0b',
          bg: '#fffbeb',
          borderColor: '#f59e0b'
        };
      
      case 'deletion_requested':
        return {
          text: '삭제요청',
          color: '#dc2626',
          bg: '#fef2f2',
          borderColor: '#dc2626'
        };

      case 'cancelled':
        return {
          text: '취소완료',
          color: '#6b7280',
          bg: '#f3f4f6',
          borderColor: '#6b7280'
        };

      case 'cancel_request':
      case 'cancellation_requested':
        return {
          text: '취소요청',
          color: '#f59e0b',
          bg: '#fffbeb',
          borderColor: '#f59e0b'
        };
      
      default:
        return {
          text: '상태 미정',
          color: '#6b7280',
          bg: '#f9fafb',
          borderColor: '#6b7280'
        };
    }
  };

  const shootingStyle = getShootingTypeStyle(safeSchedule.shootingType);
  const statusInfo = getStatusInfo(safeSchedule.approvalStatus, schedule?.is_active);
  const isInactive = schedule?.is_active === false;

  const handleDragStart = (e: React.DragEvent) => {
    console.log('🎯 드래그 시작:', safeSchedule.professorName);
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
    console.log('🎯 드래그 종료');
    isDragActiveRef.current = false;
    onDragEnd?.();
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isDragActiveRef.current) {
      console.log('🎯 드래그 중이므로 클릭 무시');
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    e.stopPropagation();
    console.log('🎯 카드 클릭:', safeSchedule.professorName);
    onClick?.(schedule);
  };

  // 🔥 산뜻한 스튜디오 색상 유지
  const studioColor = {
    bg: '#f0f9ff', // 🔥 산뜻한 연파랑
    border: '#0ea5e9', // 🔥 산뜻한 파랑
    text: '#0c4a6e' // 🔥 진파랑
  };

  const baseStyle: React.CSSProperties = {
    padding: 8,
    background: studioColor.bg, // 🔥 산뜻한 배경
    borderRadius: 6,
    border: `2px solid ${studioColor.border}`, // 🔥 산뜻한 테두리
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
    filter: isInactive ? 'grayscale(30%)' : 'none'
  };

  const finalStyle: React.CSSProperties = {
    ...baseStyle,
    ...style,
    pointerEvents: style?.pointerEvents || 'auto'
  };

  return (
    <div
      draggable={!isDragging && !showShooterInfo}
      onDragStart={showShooterInfo ? undefined : handleDragStart}
      onDragEnd={showShooterInfo ? undefined : handleDragEnd}
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(schedule);
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={finalStyle}
    >
      {/* 🔥 통합스케줄 레이아웃 */}
      {showShooterInfo ? (
        <>
          {/* 첫 번째 줄: 시간 / 교수명 / 촬영형식 */}
          <div style={{ 
            fontWeight: 700, 
            color: studioColor.text, 
            fontSize: 12,
            marginBottom: 4,
            lineHeight: 1.2,
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}>
            <span>{safeSchedule.startTime}~{safeSchedule.endTime}</span>
            <span style={{ color: '#9ca3af' }}>|</span>
            <span>{safeSchedule.professorName}</span>
            <span style={{ color: '#9ca3af' }}>|</span>
            <span style={{
              background: shootingStyle.background,
              color: shootingStyle.color,
              padding: '2px 6px',
              borderRadius: 4,
              fontSize: 9,
              fontWeight: 700,
              boxShadow: `${shootingStyle.shadow}, 0 1px 3px rgba(0, 0, 0, 0.1)`,
              border: shootingStyle.border,
              textShadow: '0 1px 1px rgba(255, 255, 255, 0.8)',
              display: 'inline-block'
            }}>
              {safeSchedule.shootingType}
            </span>
          </div>
          
          {/* 두 번째 줄: 강의명 */}
          <div style={{ 
            fontSize: 11, 
            marginBottom: 8,
            color: studioColor.text,
            fontWeight: 400,
            lineHeight: 1.2
          }}>
            {safeSchedule.courseName}
          </div>

          {/* 🔥 세 번째 줄: 촬영자 (근무시간) + 체크박스 + 상태표시 */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            minHeight: '16px'
          }}>
            {/* 좌측: 촬영자 (근무시간) */}
            <div style={{ 
              color: shooterText ? '#059669' : '#dc2626',
              fontSize: '9px',
              fontWeight: 'bold',
              lineHeight: '1',
              flex: 1
            }}>
              {shooterText || '미배치'}
            </div>
            
            {/* 중앙: 체크박스 */}
            {showCheckbox && (
              <div style={{ 
                marginLeft: '8px',
                marginRight: '8px'
              }}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => {
                    e.stopPropagation();
                    onCheckboxChange?.(e.target.checked);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{ 
                    transform: 'scale(1.1)',
                    cursor: 'pointer',
                    accentColor: studioColor.border
                  }}
                />
              </div>
            )}
            
            {/* 우측: 상태표시 */}
            <div
              style={{
                backgroundColor: statusInfo.bg,
                color: statusInfo.color,
                border: `1px solid ${statusInfo.borderColor}`,
                borderRadius: '10px',
                padding: '1px 6px',
                fontSize: '8px',
                fontWeight: 'bold',
                flexShrink: 0
              }}
            >
              {statusInfo.text}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* 🔥 기존 레이아웃 (일반 스케줄용) - 완전 유지 */}
          
          {/* 상태 표시 배지 - 오른쪽 하단 고정 */}
          <div
            style={{
              position: 'absolute',
              bottom: '4px',
              right: '4px',
              backgroundColor: statusInfo.bg,
              color: statusInfo.color,
              border: `1px solid ${statusInfo.borderColor}`,
              borderRadius: '12px',
              padding: '2px 8px',
              fontSize: '10px',
              fontWeight: 'bold',
              zIndex: 10,
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
            }}
          >
            {statusInfo.text}
          </div>

          {/* 관리자 삭제 버튼들 - 좌측 상단 */}
          {isAdmin && !isDragging && !isInactive && (
            <div style={{
              position: 'absolute',
              top: '4px',
              left: '4px',
              display: 'flex',
              gap: '2px',
              zIndex: 15
            }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onSoftDelete?.(schedule);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  padding: '3px 5px',
                  fontSize: '10px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '18px',
                  height: '18px'
                }}
                title="비활성화 (데이터 보존)"
              >
                📦
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onDelete?.(schedule);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                  background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  padding: '3px 5px',
                  fontSize: '10px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '18px',
                  height: '18px'
                }}
                title="완전 삭제 (되돌릴 수 없음)"
              >
                🗑️
              </button>
            </div>
          )}

          {/* 첫 번째 줄: 시간 색상 제거 */}
          <div style={{ 
            fontWeight: 700, 
            color: '#374151', 
            fontSize: 12,
            marginBottom: 4,
            lineHeight: 1.1,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            paddingLeft: isAdmin ? '44px' : '0',
            paddingRight: '60px',
            minHeight: '16px'
          }}>
            {/* 시간 - 색상 제거, 기본 텍스트 색상 사용 */}
            <div style={{
              whiteSpace: 'nowrap',
              flexShrink: 0,
              fontSize: 11,
              color: '#374151',
              fontWeight: 700,
              minWidth: 'max-content'
            }}>
              {safeSchedule.startTime}~{safeSchedule.endTime}
            </div>

            <span style={{ 
              color: '#9ca3af', 
              flexShrink: 0,
              fontSize: 10
            }}>
              |
            </span>

            <div style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: '1 1 auto',
              minWidth: '40px',
              fontSize: 11
            }}>
              {safeSchedule.professorName}
            </div>

            <span style={{ 
              color: '#9ca3af', 
              flexShrink: 0,
              fontSize: 10
            }}>
              |
            </span>

            <div style={{
              background: shootingStyle.background,
              color: shootingStyle.color,
              padding: '1px 4px',
              borderRadius: 3,
              fontSize: 9,
              fontWeight: 700,
              boxShadow: shootingStyle.shadow,
              border: shootingStyle.border,
              textShadow: '0 1px 1px rgba(255, 255, 255, 0.8)',
              flexShrink: 0,
              whiteSpace: 'nowrap',
              minWidth: 'max-content'
            }}>
              {safeSchedule.shootingType}
            </div>
          </div>

          {/* 두 번째 줄: 강의명 - 폰트 사이즈 약간 축소 */}
          <div style={{ 
            fontSize: 12,
            marginBottom: 6,
            color: '#374151',
            fontWeight: 400,
            lineHeight: 1.1,
            paddingLeft: isAdmin ? '44px' : '0',
            paddingRight: '60px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {safeSchedule.courseName}
          </div>

          {/* 세 번째 줄: 여백 확보용 */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            minHeight: '16px'
          }}>
            {/* 상태는 하단 배지로 표시되므로 여기는 비움 */}
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
          fontSize: '12px',
          fontWeight: 'bold',
          color: '#dc2626'
        }}>
          {schedule.approval_status === 'cancelled' ? '취소됨' : '삭제됨'}
        </div>
      )}
    </div>
  );
};
