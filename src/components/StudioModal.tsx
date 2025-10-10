import React from 'react';

interface StudioModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  type?: 'create' | 'edit' | 'detail' | 'reassign';
  maxWidth?: string;
}

export const StudioModal = ({ 
  open, 
  onClose, 
  title, 
  children, 
  type = 'create',
  maxWidth = '500px'
}: StudioModalProps) => {
  const getHeaderColor = () => {
    switch (type) {
      case 'create': return '#28a745';
      case 'edit': return '#28a745';
      case 'detail': return '#007bff';
      case 'reassign': return '#17a2b8';
      default: return '#28a745';
    }
  };

  const getHeaderIcon = () => {
    switch (type) {
      case 'create': return '📝';
      case 'edit': return '✏️';
      case 'detail': return '📋';
      case 'reassign': return '🔄';
      default: return '📝';
    }
  };

  if (!open) return null;

  return (
    <div 
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        background: 'rgba(0,0,0,0.5)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        zIndex: 1000,
        backdropFilter: 'blur(2px)'
      }}
      onClick={onClose}
    >
      <div 
        style={{ 
          background: 'white', 
          borderRadius: '12px', 
          padding: '0',
          maxWidth: maxWidth, 
          width: '90%',
          maxHeight: '90vh',
          overflow: 'hidden',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          border: '1px solid #e2e8f0'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div style={{ 
          background: getHeaderColor(),
          color: 'white',
          padding: '20px 30px',
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>{getHeaderIcon()}</span>
            <h3 style={{ 
              margin: 0, 
              fontSize: '18px',
              fontWeight: '600'
            }}>
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              fontSize: '18px',
              cursor: 'pointer',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
          >
            ×
          </button>
        </div>

        {/* 콘텐츠 */}
        <div style={{ 
          padding: '30px',
          maxHeight: 'calc(90vh - 80px)',
          overflow: 'auto'
        }}>
          {children}
        </div>
      </div>
    </div>
  );
};
