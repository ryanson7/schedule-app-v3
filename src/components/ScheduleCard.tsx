import React from 'react';
import { getStatusInfo, formatTime, canManagerEdit, canManagerDelete, canManagerRequest } from '../utils/scheduleHelpers';

interface ScheduleCardProps {
  schedule: any;
  isAdmin: boolean;
  isManager: boolean;
  isSelected: boolean;
  onSelect: (scheduleId: number, selected: boolean) => void;
  onEdit: (schedule: any) => void;
  onDelete: (scheduleId: number) => void;
  onModificationRequest: (schedule: any) => void;
  onCancellationRequest: (schedule: any) => void;
  onClick: (schedule: any) => void;
}

export const ScheduleCard: React.FC<ScheduleCardProps> = ({
  schedule,
  isAdmin,
  isManager,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onModificationRequest,
  onCancellationRequest,
  onClick
}) => {
  const statusInfo = getStatusInfo(schedule.approval_status);

  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAdmin) {
      onClick(schedule);
    } else if (isManager && canManagerEdit(schedule.approval_status)) {
      onEdit(schedule);
    }
  };

  return (
    <div 
      onClick={handleCardClick}
      style={{ 
        padding: 6, 
        background: 'rgba(255,255,255,0.8)', 
        borderRadius: 4, 
        border: '1px solid #ffcc80',
        cursor: isAdmin || (isManager && canManagerEdit(schedule.approval_status)) ? 'pointer' : 'default',
        position: 'relative'
      }}
    >
      {/* 관리자 체크박스 */}
      {isAdmin && (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onSelect(schedule.id, e.target.checked);
          }}
          style={{ position: 'absolute', top: 4, right: 4 }}
        />
      )}

      {/* 시간 표시 */}
      <div style={{ fontWeight: 700, color: '#e65100', fontSize: 13, marginBottom: 3 }}>
        {formatTime(schedule.start_time)}~{formatTime(schedule.end_time)}
      </div>

      {/* 교수명/강의명 */}
      <div style={{ fontSize: 11, marginBottom: 2, color: '#333' }}>
        {schedule.professor_name} / {schedule.course_name}
      </div>

      {/* 촬영 유형 */}
      <div style={{ fontSize: 9, color: '#888' }}>
        {schedule.shooting_type}
      </div>

      {/* 상태 표시 */}
      <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 8,
          padding: '2px 6px',
          borderRadius: 8,
          background: statusInfo.bg,
          color: statusInfo.color
        }}>
          {statusInfo.text}
        </span>
      </div>

      {/* 요청 메시지 표시 */}
      {schedule.request_message && (
        <div style={{ 
          marginTop: 4, 
          fontSize: 8, 
          color: '#666', 
          fontStyle: 'italic',
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          📝 {schedule.request_message}
        </div>
      )}

      {/* 매니저 액션 버튼 */}
      {isManager && (
        <div style={{ marginTop: 6, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {canManagerDelete(schedule.approval_status) && (
            <button 
              onClick={(e) => { 
                e.stopPropagation(); 
                onDelete(schedule.id); 
              }} 
              style={{ 
                fontSize: 8, 
                padding: '2px 6px', 
                background: '#dc3545', 
                color: 'white', 
                border: 'none', 
                borderRadius: 3, 
                cursor: 'pointer' 
              }}
            >
              삭제
            </button>
          )}
          
          {canManagerRequest(schedule.approval_status) && (
            <>
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  onModificationRequest(schedule); 
                }} 
                style={{ 
                  fontSize: 8, 
                  padding: '2px 6px', 
                  background: '#17a2b8', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: 3, 
                  cursor: 'pointer' 
                }}
              >
                수정요청
              </button>
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  onCancellationRequest(schedule); 
                }} 
                style={{ 
                  fontSize: 8, 
                  padding: '2px 6px', 
                  background: '#ffc107', 
                  color: 'black', 
                  border: 'none', 
                  borderRadius: 3, 
                  cursor: 'pointer' 
                }}
              >
                취소요청
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
