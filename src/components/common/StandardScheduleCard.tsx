"use client";
import React, { useRef, useState } from 'react';

interface StudioScheduleCardProps {
  schedule: any;
  onClick?: (schedule: any) => void;
  onContextMenu?: (schedule: any) => void;
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent, schedule: any) => void;
  onDragEnd?: () => void;
}

export const StudioScheduleCard = ({ 
  schedule, 
  onClick, 
  onContextMenu,
  isDragging = false,
  onDragStart,
  onDragEnd
}: StudioScheduleCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  // 🔥 드래그 상태를 더 안정적으로 관리
  const dragStateRef = useRef<'idle' | 'starting' | 'dragging'>('idle');
  const dragTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // 안전한 데이터 추출
  const safeSchedule = {
    startTime: schedule?.start_time?.substring(0, 5) || '00:00',
    endTime: schedule?.end_time?.substring(0, 5) || '00:00',
    professorName: schedule?.professor_name || '교수명 없음',
    courseName: schedule?.course_name || '과정명 없음',
    shootingType: schedule?.shooting_type || 'PPT',
    approvalStatus: schedule?.approval_status || 'pending'
  };

  // 촬영형식별 색상 구분 함수
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
        background: 'linear-gradient(135deg, rgba(107, 114, 128, 0.15) 0%, rgba(107, 114, 128, 0.05) 100%)',
        color: '#4B5563',
        border: '1px solid rgba(107, 114, 128, 0.4)',
        shadow: 'inset 0 1px 2px rgba(107, 114, 128, 0.3)'
      },
      '일반칠판': {
        background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.15) 0%, rgba(124, 58, 237, 0.05) 100%)',
        color: '#7C3AED',
        border: '1px solid rgba(124, 58, 237, 0.4)',
        shadow: 'inset 0 1px 2px rgba(124, 58, 237, 0.3)'
      }
    };
    
    return styles[type] || styles['PPT'];
  };

// 상태 정보 함수
const getStatusInfo = (status: string) => {
  const statusMap = {
    'pending': { bg: '#FEF3C7', color: '#92400E', text: '대기' },
    'approved': { bg: '#D1FAE5', color: '#065F46', text: '승인됨' },
    'confirmed': { bg: '#D1FAE5', color: '#065F46', text: '확정' },
    'approval_requested': { bg: '#DBEAFE', color: '#1E40AF', text: '승인요청' },
    'cancelled': { bg: '#FEE2E2', color: '#991B1B', text: '취소' },
    'completed': { bg: '#E5E7EB', color: '#374151', text: '완료' },
    
    // 🔥 새로운 상태들 추가
    'cancel_request': { bg: '#FED7AA', color: '#C2410C', text: '취소요청' },
    'cancellation_requested': { bg: '#FED7AA', color: '#C2410C', text: '취소요청' },
    'modification_requested': { bg: '#E0E7FF', color: '#3730A3', text: '수정요청' },
    'modification_approved': { bg: '#C7D2FE', color: '#4338CA', text: '수정승인' }
  };
  return statusMap[status] || statusMap['pending'];
};


  const shootingStyle = getShootingTypeStyle(safeSchedule.shootingType);
  const statusInfo = getStatusInfo(safeSchedule.approvalStatus);

  // 🔥 마우스 다운 핸들러 (드래그 준비)
  const handleMouseDown = (e: React.MouseEvent) => {
    // 우클릭은 무시
    if (e.button !== 0) return;
    
    dragStateRef.current = 'idle';
    console.log('🎯 마우스 다운 - 드래그 상태 초기화');
  };

  // 🔥 드래그 시작 핸들러 개선
  const handleDragStart = (e: React.DragEvent) => {
    console.log('🎯 드래그 시작:', safeSchedule.professorName);
    
    // 드래그 상태 설정
    dragStateRef.current = 'starting';
    
    // 약간의 지연 후 dragging 상태로 변경
    dragTimeoutRef.current = setTimeout(() => {
      dragStateRef.current = 'dragging';
    }, 50);
    
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
    
    // 드래그 이미지 설정
    try {
      const dragImage = document.createElement('div');
      dragImage.textContent = `${safeSchedule.professorName} 스케줄`;
      dragImage.style.cssText = `
        position: absolute;
        top: -1000px;
        background: #059669;
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: bold;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      `;
      document.body.appendChild(dragImage);
      e.dataTransfer.setDragImage(dragImage, 50, 25);
      setTimeout(() => document.body.removeChild(dragImage), 0);
    } catch (error) {
      console.warn('드래그 이미지 설정 실패:', error);
    }
    
    onDragStart?.(e, schedule);
  };

  // 🔥 클릭 핸들러 개선
  const handleClick = (e: React.MouseEvent) => {
    // 드래그 중이면 클릭 무시
    if (dragStateRef.current !== 'idle') {
      console.log('🎯 드래그 중이므로 클릭 무시');
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    
    e.stopPropagation();
    console.log('🎯 카드 클릭:', safeSchedule.professorName);
    onClick?.(schedule);
  };

  // 🔥 드래그 종료 핸들러 개선
  const handleDragEnd = (e: React.DragEvent) => {
    console.log('🎯 드래그 종료');
    
    // 타이머 정리
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
      dragTimeoutRef.current = null;
    }
    
    // 상태 초기화 (지연 적용)
    setTimeout(() => {
      dragStateRef.current = 'idle';
    }, 100);
    
    onDragEnd?.();
  };

  // 🔥 컨텍스트 메뉴 핸들러 개선
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 드래그 중이 아닐 때만 컨텍스트 메뉴 허용
    if (dragStateRef.current === 'idle') {
      onContextMenu?.(schedule);
    }
  };
  
  return (
    <div
      draggable={true}
      onMouseDown={handleMouseDown}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: 8,
        background: '#F9FAFB',
        borderRadius: 6,
        border: '2px solid #E5E7EB',
        cursor: dragStateRef.current === 'dragging' ? 'grabbing' : 'grab',
        marginBottom: 4,
        transition: dragStateRef.current === 'dragging' ? 'none' : 'all 0.2s ease',
        minHeight: 'auto',
        maxHeight: '200px',
        overflowY: 'auto',
        wordWrap: 'break-word',
        wordBreak: 'break-word',
        outline: 'none',
        opacity: isDragging ? 0.8 : 1,
        transform: isHovered && !isDragging ? 'translateY(-1px)' : 'none',
        boxShadow: isHovered ? '0 4px 12px rgba(0, 0, 0, 0.15)' : 'none',
        position: 'relative',
        userSelect: 'none',
        // 🔥 드래그 중 포인터 이벤트 최적화
        pointerEvents: dragStateRef.current === 'dragging' ? 'none' : 'auto'
      }}
    >
      {/* 첫 번째 줄: 시간/교수명/촬영형식 */}
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
        lineHeight: 1.2
      }}>
        {safeSchedule.courseName}
      </div>

      {/* 우측 하단 상태 뱃지 */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end'
      }}>
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          backgroundColor: statusInfo.bg,
          color: statusInfo.color,
          padding: '2px 6px',
          borderRadius: 8
        }}>
          {statusInfo.text}
        </span>
      </div>
    </div>
  );
};
