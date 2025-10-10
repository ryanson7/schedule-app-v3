"use client";
import React, { useState, useEffect } from 'react';

interface ModalField {
  label: string;
  type: 'text' | 'date' | 'time' | 'select' | 'textarea';
  field: string;
  value: string;
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  helpText?: string;
}

interface BaseScheduleModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  fields: ModalField[];
  onChange: (field: string, value: string) => void;
  onSave: (action: 'temp' | 'request' | 'modify_request' | 'cancel_request' | 'delete_request' | 'modify_approve' | 'cancel_approve' | 'delete_approve' | 'confirm' | 'approve' | 'cancel' | 'delete' | 'modify_reject') => Promise<{ success: boolean; message: string }>;
  userRole: string;
  isLoading?: boolean;
  scheduleData?: any;
}

export default function BaseScheduleModal({
  open,
  onClose,
  title,
  fields,
  onChange,
  onSave,
  userRole,
  isLoading = false,
  scheduleData
}: BaseScheduleModalProps) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!open) {
      setSaving(false);
      setMessage('');
    }
  }, [open]);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open && !saving) {
        onClose();
      }
    };
    
    if (open) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [open, saving, onClose]);

  if (!open) return null;

  const getUserPermissions = () => {
    const currentUserRole = localStorage.getItem('userRole') || '';
    const userName = localStorage.getItem('userName') || '';
    
    if (userName === 'manager1' || currentUserRole === 'system_admin' || currentUserRole === 'schedule_admin') {
      return { roleType: 'admin' as const };
    }
    
    if (currentUserRole === 'academy_manager' || currentUserRole === 'studio_manager') {
      return { roleType: 'manager' as const };
    }
    
    return { roleType: 'basic' as const };
  };

  const permissions = getUserPermissions();
  const isEditMode = !!(scheduleData && scheduleData.id);
  const currentStatus = scheduleData?.approval_status;
  const isAfterApprovalRequest = ['approval_requested', 'approved', 'confirmed'].includes(currentStatus);

  const validateFields = () => {
    const requiredFields = fields.filter(field => field.required);
    const emptyRequiredFields = requiredFields.filter(field => 
      !field.value || field.value.trim() === ''
    );
    return emptyRequiredFields;
  };

  const handleSave = async (action: string) => {
    console.log('BaseScheduleModal handleSave 실행:', action, {
      permissions: permissions.roleType,
      isEditMode,
      currentStatus,
      scheduleData: scheduleData?.id ? 'exists' : 'none'
    });

    setSaving(true);
    setMessage('');
    
    try {
      const skipValidation = [
        'cancel_request', 'delete_request', 'modify_request', 'modify_approve', 
        'cancel_approve', 'delete_approve', 'confirm', 'approve', 'cancel', 'delete', 'modify_reject'
      ];

      if (!skipValidation.includes(action)) {
        const emptyFields = validateFields();
        if (emptyFields.length > 0) {
          const fieldNames = emptyFields.map(field => field.label).join(', ');
          throw new Error(`다음 필수 필드를 입력해주세요: ${fieldNames}`);
        }
      }

      const result = await onSave(action as any);
      setMessage(result.message);
      
      if (result.success) {
        setTimeout(() => {
          onClose();
          setMessage('');
        }, 1000);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '처리 중 오류가 발생했습니다.';
      setMessage(errorMessage);
      console.error('BaseScheduleModal 처리 오류:', error);
    } finally {
      setSaving(false);
    }
  };

  const renderField = (field: ModalField) => {
    const commonProps = {
      value: field.value || '',
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => 
        onChange(field.field, e.target.value),
      required: field.required,
      disabled: saving || isLoading || field.disabled || (permissions.roleType === 'manager' && isAfterApprovalRequest),
      placeholder: field.placeholder,
      style: {
        width: '100%',
        padding: '8px 12px',
        border: `1px solid ${field.required && !field.value ? '#dc2626' : '#d1d5db'}`,
        borderRadius: '6px',
        fontSize: '14px',
        outline: 'none',
        backgroundColor: (saving || isLoading || field.disabled || (permissions.roleType === 'manager' && isAfterApprovalRequest)) ? '#f9fafb' : 'white',
        opacity: (field.disabled || (permissions.roleType === 'manager' && isAfterApprovalRequest)) ? 0.6 : 1
      }
    };

    switch (field.type) {
      case 'select':
        return (
          <select {...commonProps}>
            {field.options?.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
      
      case 'textarea':
        return (
          <textarea 
            {...commonProps}
            rows={3}
            style={{
              ...commonProps.style,
              resize: 'vertical',
              minHeight: '80px'
            }}
          />
        );
      
      default:
        return <input {...commonProps} type={field.type} />;
    }
  };

  const renderFieldRow = (field1: ModalField, field2?: ModalField) => {
    if (!field2) {
      return (
        <div key={field1.field} style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            marginBottom: '6px',
            fontSize: '14px',
            fontWeight: '600',
            color: '#374151'
          }}>
            {field1.label}
            {field1.required && <span style={{ color: '#ef4444' }}> *</span>}
          </label>
          {renderField(field1)}
          {field1.helpText && (
            <div style={{
              fontSize: '12px',
              color: '#6b7280',
              marginTop: '4px',
              fontStyle: 'italic'
            }}>
              {field1.helpText}
            </div>
          )}
        </div>
      );
    }

    return (
      <div key={`${field1.field}-${field2.field}`} style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '16px',
        marginBottom: '20px' 
      }}>
        <div>
          <label style={{
            display: 'block',
            marginBottom: '6px',
            fontSize: '14px',
            fontWeight: '600',
            color: '#374151'
          }}>
            {field1.label}
            {field1.required && <span style={{ color: '#ef4444' }}> *</span>}
          </label>
          {renderField(field1)}
          {field1.helpText && (
            <div style={{
              fontSize: '12px',
              color: '#6b7280',
              marginTop: '4px',
              fontStyle: 'italic'
            }}>
              {field1.helpText}
            </div>
          )}
        </div>
        <div>
          <label style={{
            display: 'block',
            marginBottom: '6px',
            fontSize: '14px',
            fontWeight: '600',
            color: '#374151'
          }}>
            {field2.label}
            {field2.required && <span style={{ color: '#ef4444' }}> *</span>}
          </label>
          {renderField(field2)}
          {field2.helpText && (
            <div style={{
              fontSize: '12px',
              color: '#6b7280',
              marginTop: '4px',
              fontStyle: 'italic'
            }}>
              {field2.helpText}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderFields = () => {
    const fieldGroups = [];
    const processedFields = new Set();

    const startTimeField = fields.find(f => f.field === 'start_time');
    const endTimeField = fields.find(f => f.field === 'end_time');
    const professorField = fields.find(f => f.field === 'professor_name');
    const courseField = fields.find(f => f.field === 'course_name');
    const courseCodeField = fields.find(f => f.field === 'course_code');
    const shootingTypeField = fields.find(f => f.field === 'shooting_type');

    fields.forEach(field => {
      if (processedFields.has(field.field)) return;

      if (field.field === 'start_time' && endTimeField) {
        fieldGroups.push(renderFieldRow(field, endTimeField));
        processedFields.add('start_time');
        processedFields.add('end_time');
      }
      else if (field.field === 'professor_name' && courseField) {
        fieldGroups.push(renderFieldRow(field, courseField));
        processedFields.add('professor_name');
        processedFields.add('course_name');
      }
      else if (field.field === 'course_code' && shootingTypeField) {
        fieldGroups.push(renderFieldRow(field, shootingTypeField));
        processedFields.add('course_code');
        processedFields.add('shooting_type');
      }
      else if (!processedFields.has(field.field)) {
        fieldGroups.push(renderFieldRow(field));
        processedFields.add(field.field);
      }
    });

    return fieldGroups;
  };

  const renderActionButtons = () => {
    const emptyRequiredFields = validateFields();
    const canSave = !saving && !isLoading && emptyRequiredFields.length === 0;

    const buttonStyle = {
      padding: '10px 16px',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '500'
    };

    const buttons = [];

    buttons.push(
      <button
        key="close"
        onClick={onClose}
        disabled={saving}
        style={{
          ...buttonStyle,
          border: '1px solid #d1d5db',
          backgroundColor: 'white',
          color: '#374151',
          cursor: saving ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.5 : 1
        }}
      >
        닫기
      </button>
    );

    if (permissions.roleType === 'admin') {
      buttons.push(
        <button 
          key="temp" 
          onClick={() => handleSave('temp')} 
          disabled={!canSave} 
          style={{
            ...buttonStyle, 
            backgroundColor: canSave ? '#6b7280' : '#d1d5db', 
            color: 'white'
          }}
        >
          임시저장
        </button>
      );

      if (!isEditMode) {
        buttons.push(
          <button 
            key="approve" 
            onClick={() => handleSave('approve')} 
            disabled={!canSave} 
            style={{
              ...buttonStyle, 
              backgroundColor: canSave ? '#059669' : '#d1d5db', 
              color: 'white'
            }}
          >
            승인하며 저장
          </button>
        );
      } else {
        buttons.push(
          <button 
            key="approve" 
            onClick={() => handleSave('approve')} 
            disabled={!canSave} 
            style={{
              ...buttonStyle, 
              backgroundColor: canSave ? '#059669' : '#d1d5db', 
              color: 'white'
            }}
          >
            승인하며 저장
          </button>
        );

        if (currentStatus !== 'cancelled' && scheduleData?.is_active !== false) {
          buttons.push(
            <button 
              key="cancel" 
              onClick={() => handleSave('cancel')} 
              disabled={saving} 
              style={{
                ...buttonStyle, 
                backgroundColor: '#f59e0b', 
                color: 'white', 
                opacity: saving ? 0.6 : 1
              }}
            >
              취소처리
            </button>
          );
        }

        buttons.push(
          <button 
            key="delete" 
            onClick={() => handleSave('delete')} 
            disabled={saving} 
            style={{
              ...buttonStyle, 
              backgroundColor: '#dc2626', 
              color: 'white', 
              opacity: saving ? 0.6 : 1
            }}
          >
            삭제처리
          </button>
        );

        if (currentStatus === 'approved') {
          buttons.push(
            <button 
              key="confirm" 
              onClick={() => handleSave('confirm')} 
              disabled={saving} 
              style={{
                ...buttonStyle, 
                backgroundColor: '#059669', 
                color: 'white', 
                opacity: saving ? 0.6 : 1
              }}
            >
              확정처리
            </button>
          );
        }

        // 🔥 수정요청 처리 버튼 추가
        if (currentStatus === 'modification_requested' || currentStatus === 'modify_request') {
          buttons.push(
            <button 
              key="modify_reject" 
              onClick={() => handleSave('modify_reject')} 
              disabled={saving} 
              style={{
                ...buttonStyle, 
                backgroundColor: '#dc2626', 
                color: 'white', 
                opacity: saving ? 0.6 : 1
              }}
            >
              수정 반려
            </button>,
            <button 
              key="modify_approve" 
              onClick={() => handleSave('modify_approve')} 
              disabled={saving} 
              style={{
                ...buttonStyle, 
                backgroundColor: '#8b5cf6', 
                color: 'white', 
                opacity: saving ? 0.6 : 1
              }}
            >
              수정 승인
            </button>
          );
        }
      }
    } else if (permissions.roleType === 'manager') {
      buttons.push(
        <button 
          key="temp" 
          onClick={() => handleSave('temp')} 
          disabled={!canSave} 
          style={{
            ...buttonStyle, 
            backgroundColor: canSave ? '#6b7280' : '#d1d5db', 
            color: 'white'
          }}
        >
          임시저장
        </button>
      );

      if (!isEditMode) {
        buttons.push(
          <button 
            key="request" 
            onClick={() => handleSave('request')} 
            disabled={!canSave} 
            style={{
              ...buttonStyle, 
              backgroundColor: canSave ? '#2563eb' : '#d1d5db', 
              color: 'white'
            }}
          >
            승인요청
          </button>
        );
      } else {
        if (currentStatus === 'pending') {
          buttons.push(
            <button 
              key="request" 
              onClick={() => handleSave('request')} 
              disabled={!canSave} 
              style={{
                ...buttonStyle, 
                backgroundColor: canSave ? '#2563eb' : '#d1d5db', 
                color: 'white'
              }}
            >
              승인요청
            </button>,
            <button 
              key="delete" 
              onClick={() => handleSave('delete_request')} 
              disabled={saving} 
              style={{
                ...buttonStyle, 
                backgroundColor: '#dc2626', 
                color: 'white', 
                opacity: saving ? 0.5 : 1
              }}
            >
              삭제요청
            </button>
          );
        } else if (currentStatus === 'approval_requested') {
          buttons.push(
            <button 
              key="modify_request" 
              onClick={() => handleSave('modify_request')} 
              disabled={saving} 
              style={{
                ...buttonStyle, 
                backgroundColor: '#f59e0b', 
                color: 'white', 
                opacity: saving ? 0.5 : 1
              }}
            >
              수정요청
            </button>
          );
        } else if (currentStatus === 'approved' || currentStatus === 'confirmed') {
          // 🔥 승인됨/확정됨: 수정요청 + 취소요청
          buttons.push(
            <button 
              key="modify_request" 
              onClick={() => handleSave('modify_request')} 
              disabled={saving} 
              style={{
                ...buttonStyle, 
                backgroundColor: '#8b5cf6', 
                color: 'white', 
                opacity: saving ? 0.5 : 1
              }}
            >
              수정요청
            </button>,
            <button 
              key="cancel" 
              onClick={() => handleSave('cancel_request')} 
              disabled={saving} 
              style={{
                ...buttonStyle, 
                backgroundColor: '#f59e0b', 
                color: 'white', 
                opacity: saving ? 0.5 : 1
              }}
            >
              취소요청
            </button>
          );
        } else {
          buttons.push(
            <button 
              key="modify_request" 
              onClick={() => handleSave('modify_request')} 
              disabled={saving} 
              style={{
                ...buttonStyle, 
                backgroundColor: '#8b5cf6', 
                color: 'white', 
                opacity: saving ? 0.5 : 1
              }}
            >
              수정요청
            </button>
          );
        }
      }
    }

    return buttons;
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
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        width: '600px',
        maxWidth: '90vw',
        minHeight: '500px',
        maxHeight: '90vh',
        overflow: 'hidden',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #E5E7EB',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <h2 style={{ 
            margin: 0, 
            fontSize: '18px', 
            fontWeight: 'bold',
            color: '#111827'
          }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: saving ? 'not-allowed' : 'pointer',
              padding: '0',
              color: '#6b7280',
              opacity: saving ? 0.5 : 1
            }}
          >
            ×
          </button>
        </div>

        {permissions.roleType === 'manager' && isAfterApprovalRequest && (
          <div style={{
            margin: '16px 24px 0',
            padding: '12px',
            backgroundColor: '#fef3c7',
            color: '#92400e',
            fontSize: '14px',
            borderRadius: '6px',
            border: '1px solid #fbbf24'
          }}>
            승인요청 후에는 필드 수정이 불가능합니다. 수정이 필요하시면 '수정요청' 버튼을 사용해주세요.
          </div>
        )}

        {permissions.roleType === 'admin' && (
          <div style={{
            margin: '16px 24px 0',
            padding: '12px',
            backgroundColor: '#f0fdf4',
            color: '#166534',
            fontSize: '14px',
            borderRadius: '6px',
            border: '1px solid #bbf7d0'
          }}>
            관리자 권한으로 스케줄을 직접 승인, 취소, 삭제할 수 있습니다.
          </div>
        )}

        <div style={{
          padding: '24px',
          flex: 1,
          overflowY: 'auto'
        }}>
          {isLoading ? (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '200px'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                border: '3px solid #e5e7eb',
                borderTop: '3px solid #059669',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            </div>
          ) : (
            renderFields()
          )}
        </div>

        {message && (
          <div style={{
            margin: '0 24px 16px',
            padding: '12px',
            borderRadius: '6px',
            backgroundColor: message.includes('오류') || message.includes('실패') ? '#fef2f2' : '#f0fdf4',
            color: message.includes('오류') || message.includes('실패') ? '#dc2626' : '#166534',
            fontSize: '14px',
            border: `1px solid ${message.includes('오류') || message.includes('실패') ? '#fecaca' : '#bbf7d0'}`,
            flexShrink: 0
          }}>
            {message}
          </div>
        )}

        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #E5E7EB',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '12px',
          flexShrink: 0,
          flexWrap: 'wrap'
        }}>
          {saving && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginRight: 'auto'
            }}>
              <div style={{
                width: '14px',
                height: '14px',
                border: '2px solid #d1d5db',
                borderTop: '2px solid #059669',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <span style={{ fontSize: '14px', color: '#6b7280' }}>처리 중...</span>
            </div>
          )}
          {renderActionButtons()}
        </div>
      </div>
      
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
