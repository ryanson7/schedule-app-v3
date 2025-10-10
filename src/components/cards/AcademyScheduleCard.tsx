"use client";
import React, { useState } from 'react';

interface AcademyScheduleCardProps {
  schedule: any;
  locationColor?: {
    bg: string;
    border: string;
    text: string;
  };
  onClick?: (schedule: any) => void;
  onContextMenu?: (schedule: any) => void;
  style?: React.CSSProperties;
  showShooterInfo?: boolean; // 🔥 통합스케줄 모드
  shooterText?: string; // 🔥 촬영자명 + 근무시간
  showCheckbox?: boolean; // 🔥 체크박스 표시
  isSelected?: boolean; // 🔥 체크박스 선택 상태
  onCheckboxChange?: (checked: boolean) => void; // 🔥 체크박스 변경 콜백
}

// 🔥 getStatusInfo 함수 - 상태 표기 개선
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

export const AcademyScheduleCard = ({ 
  schedule, 
  locationColor,
  onClick, 
  onContextMenu,
  style,
  showShooterInfo = false, // 🔥 통합스케줄 모드
  shooterText, // 🔥 촬영자 텍스트
  showCheckbox = false, // 🔥 체크박스 표시
  isSelected = false, // 🔥 선택 상태
  onCheckboxChange // 🔥 체크박스 콜백
}: AcademyScheduleCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const statusInfo = getStatusInfo(schedule.approval_status, schedule.is_active);
  const isInactive = schedule.is_active === false;
  
  const safeSchedule = {
    startTime: schedule?.start_time?.substring(0, 5) || '00:00',
    endTime: schedule?.end_time?.substring(0, 5) || '00:00',
    professorName: schedule?.professor_name || '교수명 없음',
    courseName: schedule?.course_name || '과정명 없음',
    shootingType: schedule?.shooting_type || '촬영',
    approvalStatus: schedule?.approval_status || 'pending'
  };

  const getShootingTypeStyle = (type: string) => {
    const styles = {
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
    return styles[type] || styles['촬영'];
  };

  const shootingStyle = getShootingTypeStyle(safeSchedule.shootingType);

  const handleClick = (e: React.MouseEvent) => {
    console.log('🔧 AcademyScheduleCard handleClick:', schedule?.professor_name);
    
    const target = e.target as HTMLElement;
    const checkbox = target.closest('input[type="checkbox"]');
    const checkboxContainer = target.closest('[style*="position: absolute"][style*="bottom: 4px"]');
    
    if (checkbox || checkboxContainer) {
      console.log('🔧 체크박스 영역 클릭됨 - onClick 이벤트 차단');
      e.stopPropagation();
      return;
    }
    
    if (onClick && typeof onClick === 'function') {
      console.log('🔧 onClick 콜백 실행:', schedule?.id);
      e.stopPropagation();
      onClick(schedule);
    } else {
      console.warn('⚠️ onClick 콜백이 제공되지 않음');
    }
  };

  // 🔥 기존 산뜻한 스타일 유지 (locationColor 기반)
  const cardStyle: React.CSSProperties = {
    padding: 8,
    background: locationColor?.bg || '#F9FAFB', // 🔥 산뜻한 배경색 유지
    borderRadius: 6,
    border: `2px solid ${locationColor?.border || '#E5E7EB'}`, // 🔥 산뜻한 테두리 유지
    cursor: 'pointer',
    marginBottom: 4,
    transition: 'all 0.2s ease',
    minHeight: 'auto',
    maxHeight: '200px',
    overflowY: 'auto',
    wordWrap: 'break-word',
    wordBreak: 'break-word',
    outline: 'none',
    transform: isHovered ? 'translateY(-1px)' : 'none',
    boxShadow: isHovered ? '0 4px 12px rgba(0, 0, 0, 0.15)' : 'none',
    position: 'relative',
    userSelect: 'none',
    opacity: isInactive ? 0.7 : 1,
    filter: isInactive ? 'grayscale(30%)' : 'none',
    ...style
  };

  return (
    <div
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (onContextMenu) {
          onContextMenu(schedule);
        }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={cardStyle}
    >
      {/* 🔥 통합스케줄 레이아웃 */}
      {showShooterInfo ? (
        <>
          {/* 첫 번째 줄: 시간 / 교수명 / 촬영형식 */}
          <div style={{ 
            fontWeight: 700, 
            color: locationColor?.text || '#374151', 
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
            color: locationColor?.text || '#374151',
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
                    accentColor: locationColor?.border || '#2563eb'
                  }}
                />
              </div>
            )}
            
            {/* 우측: 상태표시 */}
            <div
              style={{
                backgroundColor: statusInfo.bgColor,
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
          
          {/* 체크박스 (일반 스케줄용) */}
          {showCheckbox && (
            <div 
              style={{
                position: 'absolute',
                bottom: '4px',
                left: '4px',
                zIndex: 25,
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                borderRadius: '4px',
                padding: '0px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                border: '1px solid #e5e7eb'
              }}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => {
                  onCheckboxChange?.(e.target.checked);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                }}
                style={{ 
                  transform: 'scale(1.2)',
                  margin: 0,
                  cursor: 'pointer',
                  accentColor: '#2563eb'
                }}
              />
            </div>
          )}

          {/* 상태 표시 배지 */}
          <div
            style={{
              position: 'absolute',
              bottom: '4px',
              right: '4px',
              backgroundColor: statusInfo.bgColor,
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

          {/* 첫 번째 줄: 시간 + 교수명 + 촬영형식 */}
          <div style={{ 
            fontWeight: 700, 
            color: '#374151', 
            fontSize: 14,
            marginBottom: 4,
            lineHeight: 1.2,
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 4
          }}>
            <span>
              {safeSchedule.startTime}~{safeSchedule.endTime} / {safeSchedule.professorName} /
            </span>
            <span style={{
              background: shootingStyle.background,
              color: shootingStyle.color,
              padding: '3px 8px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              boxShadow: `${shootingStyle.shadow}, 0 1px 3px rgba(0, 0, 0, 0.1)`,
              border: shootingStyle.border,
              textShadow: '0 1px 1px rgba(255, 255, 255, 0.8)',
              display: 'inline-block'
            }}>
              {safeSchedule.shootingType}
            </span>
          </div>
          
          {/* 두 번째 줄: 과정명 */}
          <div style={{ 
            fontSize: 12, 
            marginBottom: 8,
            color: '#374151',
            fontWeight: 400,
            lineHeight: 1.2,
            paddingRight: '60px'
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
