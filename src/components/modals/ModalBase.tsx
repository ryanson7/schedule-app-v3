"use client";
import { ReactNode, useEffect } from "react";

interface ModalBaseProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  footer?: ReactNode;
}

export default function ModalBase({
  open,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
  footer
}: ModalBaseProps) {

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };

    if (open) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden'; // 배경 스크롤 방지
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && closeOnOverlayClick) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className={`modal-container modal-${size}`}>
        {/* 헤더 */}
        {(title || showCloseButton) && (
          <div className="modal-header">
            {title && <h3 className="modal-title">{title}</h3>}
            {showCloseButton && (
              <button onClick={onClose} className="modal-close-btn">
                ×
              </button>
            )}
          </div>
        )}

        {/* 바디 */}
        <div className="modal-body">
          {children}
        </div>

        {/* 푸터 */}
        {footer && (
          <div className="modal-footer">
            {footer}
          </div>
        )}
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.3s ease-out;
        }

        .modal-container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          display: flex;
          flex-direction: column;
          max-height: 90vh;
          animation: scaleIn 0.3s ease-out;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .modal-sm { width: 400px; max-width: 90vw; }
        .modal-md { width: 600px; max-width: 90vw; }
        .modal-lg { width: 800px; max-width: 95vw; }
        .modal-xl { width: 1000px; max-width: 95vw; }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid #e5e7eb;
          flex-shrink: 0;
        }

        .modal-title {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: #1f2937;
        }

        .modal-close-btn {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #6b7280;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          transition: all 0.2s ease;
        }

        .modal-close-btn:hover {
          background: #f3f4f6;
          color: #1f2937;
        }

        .modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }

        .modal-footer {
          padding: 20px 24px;
          border-top: 1px solid #e5e7eb;
          background: #f9fafb;
          flex-shrink: 0;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes scaleIn {
          from { 
            opacity: 0;
            transform: scale(0.95) translateY(-10px);
          }
          to { 
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @media (max-width: 768px) {
          .modal-container {
            margin: 20px;
            max-height: calc(100vh - 40px);
          }

          .modal-header {
            padding: 16px 20px;
          }

          .modal-body {
            padding: 20px;
          }

          .modal-footer {
            padding: 16px 20px;
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}
