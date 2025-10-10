"use client";
import React from "react";
import { BaseModal } from "./BaseModal";
import { getAcademyColor } from "../../utils/academyColors";

interface DetailModalProps {
  open: boolean;
  onClose: () => void;
  schedule: any;
  studioLocations?: any[];
  getStatusInfo: (status: string) => any;
  onEdit?: (schedule: any) => void;
  onDelete?: (scheduleId: number) => void;
  onCancel?: (schedule: any) => void;
  onApprove?: (scheduleId: number) => void;
  onRequestApproval?: (scheduleId: number) => void;
  onRequestModification?: (scheduleId: number) => void;
  onRequestCancellation?: (scheduleId: number) => void;
  role: "admin" | "manager";
  type: "studio" | "academy";
}

export const DetailModal = ({
  open,
  onClose,
  schedule,
  studioLocations = [],
  getStatusInfo,
  onEdit,
  onDelete,
  onCancel,
  onApprove,
  onRequestApproval,
  onRequestModification,
  onRequestCancellation,
  role,
  type
}: DetailModalProps) => {
  if (!open || !schedule) return null;

  const statusInfo = getStatusInfo(schedule.approval_status);
  const studio = type === "studio" 
    ? studioLocations.find((s) => s.id === schedule.sub_location_id)
    : null;

  const color = type === "academy" 
    ? getAcademyColor(schedule.sub_locations?.main_location_id || 1)
    : null;

  // 권한별 버튼 표시 로직
  const getAvailableActions = () => {
    if (role === 'admin') {
      const actions = ['edit', 'delete', 'cancel'];
      
      if (schedule.approval_status === 'approval_requested') {
        actions.push('approve');
      }
      if (schedule.approval_status === 'modification_requested') {
        actions.push('approve_modification');
      }
      if (schedule.approval_status === 'cancellation_requested') {
        actions.push('approve_cancellation');
      }
      
      return actions;
    } else if (role === 'manager') {
      switch (schedule.approval_status) {
        case 'pending':
          return ['edit', 'delete', 'request_approval'];
        case 'approved':
          return ['request_modification', 'request_cancellation'];
        case 'approval_requested':
          return ['view'];
        default:
          return ['view'];
      }
    }
    return ['view'];
  };

  const availableActions = getAvailableActions();

  const buttonStyle = (bgColor: string) => ({
    padding: 12,
    background: bgColor,
    color: 'white',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 14,
    minWidth: 100
  });

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      title={`${type === "studio" ? "스튜디오" : "학원"} 스케줄 상세`}
      size="medium"
    >
      {/* 스케줄 정보 카드 */}
      <section style={{
        background: color ? color.bg : "#f8fafc",
        border: `1px solid ${color ? color.border : "#e2e8f0"}`,
        borderRadius: 8,
        padding: 20,
        marginBottom: 24
      }}>
        <dl style={{
          display: "grid",
          gridTemplateColumns: "120px 1fr",
          rowGap: 12,
          columnGap: 16,
          fontSize: 14
        }}>
          <dt style={{ fontWeight: 600, color: "#64748b" }}>날짜</dt>
          <dd style={{ margin: 0, fontWeight: 600 }}>{schedule.shoot_date}</dd>
          
          <dt style={{ fontWeight: 600, color: "#64748b" }}>시간</dt>
          <dd style={{ margin: 0, fontWeight: 600 }}>
            {schedule.start_time?.substring(0, 5)}~{schedule.end_time?.substring(0, 5)}
          </dd>
          
          <dt style={{ fontWeight: 600, color: "#64748b" }}>
            {type === "studio" ? "교수명" : "강사명"}
          </dt>
          <dd style={{ margin: 0, fontWeight: 600 }}>{schedule.professor_name}</dd>
          
          <dt style={{ fontWeight: 600, color: "#64748b" }}>강의명</dt>
          <dd style={{ margin: 0, fontWeight: 600 }}>{schedule.course_name || "–"}</dd>
          
          <dt style={{ fontWeight: 600, color: "#64748b" }}>강의코드</dt>
          <dd style={{ margin: 0, fontWeight: 600 }}>{schedule.course_code || "–"}</dd>
          
          <dt style={{ fontWeight: 600, color: "#64748b" }}>촬영형식</dt>
          <dd style={{ margin: 0, fontWeight: 600 }}>{schedule.shooting_type}</dd>
          
          <dt style={{ fontWeight: 600, color: "#64748b" }}>
            {type === "studio" ? "스튜디오" : "장소"}
          </dt>
          <dd style={{ margin: 0, fontWeight: 600 }}>
            {type === "studio"
              ? studio ? `${studio.name}번 스튜디오` : "미지정"
              : `${schedule.sub_locations?.main_locations?.name} - ${schedule.sub_locations?.name}`}
          </dd>
          
          <dt style={{ fontWeight: 600, color: "#64748b" }}>상태</dt>
          <dd style={{ margin: 0 }}>
            <span style={{
              padding: "4px 12px",
              borderRadius: 12,
              background: statusInfo.bg,
              color: statusInfo.color,
              fontWeight: 600,
              fontSize: 12
            }}>
              {statusInfo.text}
            </span>
          </dd>
        </dl>

        {/* 비고/전달사항 */}
        {schedule.notes && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #e2e8f0" }}>
            <strong style={{ fontSize: 12, color: "#64748b" }}>
              {type === "studio" ? "전달사항" : "비고"}
            </strong>
            <div style={{
              background: "#fef3c7",
              border: "1px solid #fbbf24",
              borderRadius: 6,
              padding: 12,
              marginTop: 6,
              fontSize: 14,
              color: "#92400e",
              lineHeight: 1.5
            }}>
              {schedule.notes}
            </div>
          </div>
        )}
      </section>

      {/* 액션 버튼 */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
        gap: 12,
        marginBottom: 20
      }}>
        {/* 관리자 버튼 */}
        {role === 'admin' && (
          <>
            {availableActions.includes('approve') && (
              <button 
                onClick={() => { onApprove?.(schedule.id); onClose(); }}
                style={buttonStyle('#059669')}
              >
                즉시 승인
              </button>
            )}
            
            {availableActions.includes('edit') && (
              <button 
                onClick={() => { onEdit?.(schedule); onClose(); }}
                style={buttonStyle('#2563eb')}
              >
                즉시 수정
              </button>
            )}
            
            {availableActions.includes('cancel') && (
              <button 
                onClick={() => { onCancel?.(schedule); onClose(); }}
                style={buttonStyle('#d97706')}
              >
                즉시 취소
              </button>
            )}
            
            {availableActions.includes('delete') && (
              <button 
                onClick={() => { onDelete?.(schedule.id); onClose(); }}
                style={buttonStyle('#dc2626')}
              >
                완전 삭제
              </button>
            )}
          </>
        )}

        {/* 매니저 버튼 */}
        {role === 'manager' && (
          <>
            {availableActions.includes('edit') && (
              <button 
                onClick={() => { onEdit?.(schedule); onClose(); }}
                style={buttonStyle('#2563eb')}
              >
                수정
              </button>
            )}
            
            {availableActions.includes('delete') && (
              <button 
                onClick={() => { onDelete?.(schedule.id); onClose(); }}
                style={buttonStyle('#dc2626')}
              >
                삭제
              </button>
            )}
            
            {availableActions.includes('request_approval') && (
              <button 
                onClick={() => { onRequestApproval?.(schedule.id); onClose(); }}
                style={buttonStyle('#059669')}
              >
                승인요청
              </button>
            )}
            
            {availableActions.includes('request_modification') && (
              <button 
                onClick={() => { onRequestModification?.(schedule.id); onClose(); }}
                style={buttonStyle('#2563eb')}
              >
                수정요청
              </button>
            )}
            
            {availableActions.includes('request_cancellation') && (
              <button 
                onClick={() => { onRequestCancellation?.(schedule.id); onClose(); }}
                style={buttonStyle('#d97706')}
              >
                취소요청
              </button>
            )}
          </>
        )}
      </div>

      {/* 닫기 버튼 */}
      <div style={{ textAlign: 'center', paddingTop: 20, borderTop: '1px solid #e2e8f0' }}>
        <button 
          onClick={onClose}
          style={{
            padding: '10px 24px',
            background: '#f8fafc',
            color: '#1e293b',
            border: '2px solid #e2e8f0',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 500
          }}
        >
          닫기
        </button>
      </div>
    </BaseModal>
  );
};
