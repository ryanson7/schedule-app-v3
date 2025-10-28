"use client";
import { useState } from "react";
import ModalBase from "../ModalBase";
import { PrimaryButton, SecondaryButton, GhostButton } from "../../ui/buttons";

interface ScheduleDetail {
  id: number;
  shoot_date: string;
  start_time: string;
  end_time: string;
  professor_name: string;
  course_name: string;
  course_code?: string;
  shooting_type: string;
  notes?: string;
  approval_status: string;
  sub_location?: {
    name: string;
    main_locations?: {
      name: string;
    };
  };
  users?: {
    name: string;
    shooter_type?: string;
  };
  created_at: string;
  updated_at: string;
  approved_by?: string;
  approved_at?: string;
  request_message?: string;
  requested_by?: number;
  requested_at?: string;
  processed_by?: number;
  processed_at?: string;
  previous_status?: string;
  status_changed_at?: string;
}

interface DetailModalProps {
  open: boolean;
  onClose: () => void;
  schedule: ScheduleDetail | null;
  userRole: 'admin' | 'manager' | 'user';
  onEdit?: (schedule: ScheduleDetail) => void;
  onDelete?: (scheduleId: number) => void;
  onApprove?: (scheduleId: number, message?: string) => void;
  onReject?: (scheduleId: number, reason: string) => void;
  onRequestModification?: (scheduleId: number, reason: string) => void;
  onRequestCancellation?: (scheduleId: number, reason: string) => void;
  onApproveCancellation?: (scheduleId: number) => void;
  getStatusInfo?: (status: string) => { bg: string; color: string; text: string };
}

export default function DetailModal({
  open,
  onClose,
  schedule,
  userRole,
  onEdit,
  onDelete,
  onApprove,
  onReject,
  onRequestModification,
  onRequestCancellation,
  onApproveCancellation,
  getStatusInfo
}: DetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [showActionForm, setShowActionForm] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState('');

  if (!schedule) return null;

  const statusInfo = getStatusInfo ? getStatusInfo(schedule.approval_status) : {
    bg: '#6b7280',
    color: '#ffffff',
    text: schedule.approval_status
  };

  const isAdmin = userRole === 'admin';
  const isManager = userRole === 'manager';
  
  const getAvailableActions = () => {
    const status = schedule.approval_status;
    
    if (isAdmin) {
      switch (status) {
        case 'pending':
          return ['edit', 'approve', 'reject', 'delete'];
        case 'approval_requested':
          return ['approve', 'reject', 'requestModification', 'delete'];
        case 'approved':
          return ['edit', 'reject', 'delete'];
        case 'modification_requested':
          return ['approve', 'reject', 'edit'];
        case 'cancellation_requested':
          return ['approveCancellation', 'reject', 'delete'];
        default:
          return ['edit', 'delete'];
      }
    } else if (isManager) {
      switch (status) {
        case 'pending':
          return ['edit', 'requestApproval', 'delete'];
        case 'approval_requested':
          return ['requestCancellation', 'requestModification'];
        case 'approved':
          return ['requestModification', 'requestCancellation'];
        case 'modification_requested':
          return ['edit', 'requestApproval'];
        default:
          return [];
      }
    }
    return [];
  };

  const availableActions = getAvailableActions();

  const handleAction = async (action: string) => {
    if (!schedule) return;

    setLoading(true);
    try {
      switch (action) {
        case 'approve':
          if (onApprove) {
            await onApprove(schedule.id, actionMessage || undefined);
            alert('승인되었습니다.');
          }
          break;
        case 'approveCancellation':
          if (onApproveCancellation) {
            await onApproveCancellation(schedule.id);
            alert('취소가 승인되었습니다.');
          }
          break;
        case 'reject':
          if (onReject && actionMessage.trim()) {
            await onReject(schedule.id, actionMessage);
            alert('반려되었습니다.');
          } else {
            alert('반려 사유를 입력해주세요.');
            return;
          }
          break;
        case 'requestModification':
          if (onRequestModification && actionMessage.trim()) {
            await onRequestModification(schedule.id, actionMessage);
            alert('수정요청이 전송되었습니다.');
          } else {
            alert('수정요청 사유를 입력해주세요.');
            return;
          }
          break;
        case 'requestCancellation':
          if (onRequestCancellation && actionMessage.trim()) {
            await onRequestCancellation(schedule.id, actionMessage);
            alert('취소요청이 전송되었습니다.');
          } else {
            alert('취소요청 사유를 입력해주세요.');
            return;
          }
          break;
        case 'requestApproval':
          if (onApprove) {
            await onApprove(schedule.id);
            alert('승인요청이 전송되었습니다.');
          }
          break;
        case 'edit':
          if (onEdit) {
            onEdit(schedule);
          }
          return;
        case 'delete':
          if (onDelete && confirm('이 스케줄을 삭제하시겠습니까?')) {
            await onDelete(schedule.id);
            alert('삭제되었습니다.');
          }
          return;
      }
      
      setShowActionForm(null);
      setActionMessage('');
      onClose();
    } catch (error) {
      console.error(`${action} 오류:`, error);
      alert('처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const toggleActionForm = (actionType: string) => {
    if (showActionForm === actionType) {
      setShowActionForm(null);
      setActionMessage('');
    } else {
      setShowActionForm(actionType);
      setActionMessage('');
    }
  };

  const renderActionButtons = () => {
    const buttons = [];

    if (availableActions.includes('edit')) {
      buttons.push(
        <SecondaryButton key="edit" onClick={() => handleAction('edit')}>
          수정
        </SecondaryButton>
      );
    }

    if (availableActions.includes('approve')) {
      buttons.push(
        <PrimaryButton 
          key="approve" 
          onClick={() => handleAction('approve')}
          loading={loading}
        >
          승인
        </PrimaryButton>
      );
    }

    if (availableActions.includes('approveCancellation')) {
      buttons.push(
        <PrimaryButton 
          key="approveCancellation" 
          onClick={() => handleAction('approveCancellation')}
          loading={loading}
        >
          취소 승인
        </PrimaryButton>
      );
    }

    if (availableActions.includes('reject')) {
      buttons.push(
        <GhostButton 
          key="reject" 
          variant="danger"
          onClick={() => toggleActionForm('reject')}
        >
          반려
        </GhostButton>
      );
    }

    if (availableActions.includes('requestApproval')) {
      buttons.push(
        <PrimaryButton 
          key="requestApproval" 
          onClick={() => handleAction('requestApproval')}
          loading={loading}
        >
          승인 요청
        </PrimaryButton>
      );
    }

    if (availableActions.includes('requestModification')) {
      buttons.push(
        <SecondaryButton 
          key="requestModification"
          onClick={() => toggleActionForm('requestModification')}
        >
          수정 요청
        </SecondaryButton>
      );
    }

    if (availableActions.includes('requestCancellation')) {
      buttons.push(
        <GhostButton 
          key="requestCancellation" 
          variant="danger"
          onClick={() => toggleActionForm('requestCancellation')}
        >
          취소 요청
        </GhostButton>
      );
    }

    if (availableActions.includes('delete')) {
      buttons.push(
        <GhostButton 
          key="delete" 
          variant="danger"
          onClick={() => handleAction('delete')}
          loading={loading}
        >
          삭제
        </GhostButton>
      );
    }

    return buttons;
  };

  return (
    <ModalBase
      open={open}
      onClose={onClose}
      title="스케줄 상세 정보"
      size="md"
      footer={
        <div className="detail-actions">
          <GhostButton onClick={onClose}>닫기</GhostButton>
          <div className="action-buttons">
            {renderActionButtons()}
          </div>
        </div>
      }
    >
      <div className="detail-content">
        <div className="status-header">
          <div 
            className="status-badge"
            style={{ 
              backgroundColor: statusInfo.bg,
              color: statusInfo.color 
            }}
          >
            {statusInfo.text}
          </div>
          <span className="schedule-id">#{schedule.id}</span>
        </div>

        <div className="compact-info">
          <div className="info-row">
            <span className="label">날짜/시간</span>
            <span className="value">
              {new Date(schedule.shoot_date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })} 
              {' '}{schedule.start_time?.substring(0, 5)}~{schedule.end_time?.substring(0, 5)}
            </span>
          </div>
          
          <div className="info-row">
            <span className="label">강의실</span>
            <span className="value">
              {schedule.sub_location?.main_locations?.name} - {schedule.sub_location?.name}
            </span>
          </div>
          
          <div className="info-row">
            <span className="label">강의</span>
            <span className="value">
              {schedule.professor_name} / {schedule.course_name}
              {schedule.course_code && ` (${schedule.course_code})`}
            </span>
          </div>
          
          <div className="info-row">
            <span className="label">촬영형식</span>
            <span className="value shooting-type">{schedule.shooting_type}</span>
          </div>
        </div>

        {schedule.notes && (
          <div className="notes-section">
            <span className="label">비고</span>
            <div className="notes-content">{schedule.notes}</div>
          </div>
        )}

        {/* 🔥 완전한 추적 정보 표시 */}
        <div className="history-section">
          <span className="label">완전한 처리 이력</span>
          <div className="history-list">
            <div className="history-item">
              <span className="history-time">등록</span>
              <span className="history-detail">
                {new Date(schedule.created_at).toLocaleString('ko-KR')}
              </span>
            </div>
            
            {schedule.requested_by && schedule.requested_at && (
              <div className="history-item request">
                <span className="history-time">요청</span>
                <span className="history-detail">
                  {new Date(schedule.requested_at).toLocaleString('ko-KR')} 
                  (요청자 ID: {schedule.requested_by})
                </span>
              </div>
            )}
            
            {schedule.processed_by && schedule.processed_at && (
              <div className="history-item processed">
                <span className="history-time">처리</span>
                <span className="history-detail">
                  {new Date(schedule.processed_at).toLocaleString('ko-KR')} 
                  (처리자 ID: {schedule.processed_by})
                </span>
              </div>
            )}
            
            {schedule.approved_at && (
              <div className="history-item approved">
                <span className="history-time">승인</span>
                <span className="history-detail">
                  {new Date(schedule.approved_at).toLocaleString('ko-KR')}
                  {schedule.approved_by && ` (승인자 ID: ${schedule.approved_by})`}
                </span>
              </div>
            )}
            
            {schedule.previous_status && schedule.status_changed_at && (
              <div className="history-item status-change">
                <span className="history-time">상태변경</span>
                <span className="history-detail">
                  {getStatusInfo ? getStatusInfo(schedule.previous_status).text : schedule.previous_status} → {statusInfo.text}
                  <br />
                  <small>{new Date(schedule.status_changed_at).toLocaleString('ko-KR')}</small>
                </span>
              </div>
            )}
            
            {schedule.request_message && (
              <div className="history-item message">
                <span className="history-time">메시지</span>
                <span className="history-detail">{schedule.request_message}</span>
              </div>
            )}
          </div>
        </div>

        {showActionForm && (
          <div className="action-form">
            <textarea
              value={actionMessage}
              onChange={(e) => setActionMessage(e.target.value)}
              placeholder="사유를 입력해주세요"
              className="message-input"
              rows={2}
            />
            <div className="form-actions">
              <GhostButton onClick={() => toggleActionForm('')}>취소</GhostButton>
              <PrimaryButton 
                onClick={() => handleAction(showActionForm)}
                disabled={!actionMessage.trim()}
                loading={loading}
              >
                확인
              </PrimaryButton>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .detail-content {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .status-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: #f8fafc;
          border-radius: 8px;
        }

        .status-badge {
          padding: 4px 12px;
          border-radius: 16px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .schedule-id {
          font-size: 12px;
          color: #6b7280;
          font-weight: 500;
        }

        .compact-info {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 8px 0;
          border-bottom: 1px solid #f3f4f6;
        }

        .info-row:last-child {
          border-bottom: none;
        }

        .label {
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
          min-width: 60px;
          flex-shrink: 0;
        }

        .value {
          font-size: 14px;
          color: #1f2937;
          text-align: right;
          flex: 1;
        }

        .shooting-type {
          background: #1f2937;
          color: white;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
        }

        .notes-section {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .notes-content {
          background: #f9fafb;
          padding: 8px;
          border-radius: 4px;
          font-size: 13px;
          color: #374151;
          line-height: 1.4;
        }

        .history-section {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .history-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

                .history-item {
          display: flex;
          gap: 12px;
          padding: 6px 8px;
          background: #f9fafb;
          border-radius: 4px;
          border-left: 3px solid #e5e7eb;
        }

        .history-item.request {
          background: #fef3c7;
          border-left-color: #f59e0b;
        }

        .history-item.processed {
          background: #dbeafe;
          border-left-color: #3b82f6;
        }

        .history-item.approved {
          background: #f0fdf4;
          border-left-color: #22c55e;
        }

        .history-item.status-change {
          background: #f3f4f6;
          border-left-color: #6b7280;
        }

        .history-item.message {
          background: #eff6ff;
          border-left-color: #1e40af;
        }

        .history-time {
          font-size: 11px;
          font-weight: 600;
          color: #6b7280;
          min-width: 50px;
          flex-shrink: 0;
        }

        .history-detail {
          font-size: 11px;
          color: #374151;
          line-height: 1.4;
        }

        .history-detail small {
          font-size: 10px;
          color: #9ca3af;
        }

        .action-form {
          background: #fef2f2;
          padding: 12px;
          border-radius: 8px;
          border: 1px solid #fecaca;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .message-input {
          width: 100%;
          padding: 8px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-size: 13px;
          resize: vertical;
          min-height: 60px;
        }

        .message-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        .detail-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
        }

        .action-buttons {
          display: flex;
          gap: 8px;
        }

        @media (max-width: 768px) {
          .info-row {
            flex-direction: column;
            gap: 4px;
          }

          .value {
            text-align: left;
          }

          .detail-actions {
            flex-direction: column;
            gap: 12px;
          }

          .action-buttons {
            width: 100%;
            justify-content: stretch;
          }

          .action-buttons > * {
            flex: 1;
          }

          .history-item {
            flex-direction: column;
            gap: 4px;
          }

          .history-time {
            min-width: auto;
          }
        }
      `}</style>
    </ModalBase>
  );
}
