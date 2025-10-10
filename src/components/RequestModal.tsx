import React, { useState } from 'react';

interface RequestModalProps {
  show: boolean;
  requestType: 'modification' | 'cancellation';
  schedule: any;
  onSubmit: (message: string) => void;
  onClose: () => void;
}

export const RequestModal: React.FC<RequestModalProps> = ({
  show,
  requestType,
  schedule,
  onSubmit,
  onClose
}) => {
  const [message, setMessage] = useState('');

  if (!show) return null;

  const handleSubmit = () => {
    if (!message.trim()) {
      alert('요청 사유를 입력해주세요.');
      return;
    }
    onSubmit(message);
    setMessage('');
  };

  const isModification = requestType === 'modification';

  return (
    <div style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0, 
      background: 'rgba(0,0,0,0.5)', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      zIndex: 1000 
    }}>
      <div style={{ 
        background: 'white', 
        borderRadius: 12, 
        padding: 30, 
        maxWidth: 500, 
        width: '90%' 
      }}>
        <h3 style={{ 
          margin: '0 0 20px 0', 
          color: isModification ? '#17a2b8' : '#ffc107' 
        }}>
          {isModification ? '📝 수정 요청' : '❌ 취소 요청'}
        </h3>
        
        <div style={{ 
          background: '#f8f9fa', 
          padding: 16, 
          borderRadius: 8, 
          marginBottom: 20 
        }}>
          <div style={{ marginBottom: 8 }}>
            <strong>강의명:</strong> {schedule?.course_name}
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>교수명:</strong> {schedule?.professor_name}
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>날짜:</strong> {schedule?.shoot_date}
          </div>
          <div>
            <strong>시간:</strong> {schedule?.start_time?.substring(0, 5)}~{schedule?.end_time?.substring(0, 5)}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ 
            display: 'block', 
            marginBottom: 8, 
            fontWeight: 'bold' 
          }}>
            {isModification ? '수정 요청 사유' : '취소 요청 사유'} *
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              isModification 
                ? '수정이 필요한 이유를 상세히 입력해주세요...' 
                : '취소가 필요한 이유를 상세히 입력해주세요...'
            }
            style={{ 
              width: '100%', 
              minHeight: 100, 
              padding: 12, 
              border: '1px solid #ddd', 
              borderRadius: 6,
              fontSize: 14,
              resize: 'vertical'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button 
            onClick={handleSubmit}
            style={{ 
              flex: 1, 
              padding: 12, 
              background: isModification ? '#17a2b8' : '#ffc107', 
              color: isModification ? 'white' : 'black', 
              border: 'none', 
              borderRadius: 6, 
              cursor: 'pointer', 
              fontSize: 16,
              fontWeight: 'bold'
            }}
          >
            요청 제출
          </button>
          <button 
            onClick={() => {
              onClose();
              setMessage('');
            }}
            style={{ 
              flex: 1, 
              padding: 12, 
              background: '#6c757d', 
              color: 'white', 
              border: 'none', 
              borderRadius: 6, 
              cursor: 'pointer', 
              fontSize: 16 
            }}
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
};
