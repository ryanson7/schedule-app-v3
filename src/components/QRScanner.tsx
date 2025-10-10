// components/QRScanner.tsx - React 19 호환 버전
import React, { useState } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';

interface QRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
  isOpen: boolean;
  expectedLocation: string;
}

export const QRScanner: React.FC<QRScannerProps> = ({
  onScan,
  onClose,
  isOpen,
  expectedLocation
}) => {
  const [error, setError] = useState<string | null>(null);

  const handleScan = (result: any) => {
    if (result && result.length > 0) {
      onScan(result[0].rawValue);
    }
  };

  const handleError = (err: any) => {
    console.error('QR 스캔 오류:', err);
    setError('QR 코드를 스캔할 수 없습니다. 다시 시도해주세요.');
  };

  if (!isOpen) return null;

  return (
    <div className="qr-scanner-modal">
      <div className="qr-scanner-container">
        <div className="qr-scanner-header">
          <h3>QR 코드 스캔</h3>
          <p>촬영지 확인을 위해 QR 코드를 스캔해주세요</p>
          <p><strong>예상 위치:</strong> {expectedLocation}</p>
        </div>
        
        <div className="qr-scanner-camera">
          <Scanner
            onScan={handleScan}
            onError={handleError}
            constraints={{
              facingMode: 'environment'
            }}
            styles={{
              container: {
                width: '100%',
                borderRadius: '12px'
              }
            }}
          />
        </div>
        
        {error && (
          <div className="qr-scanner-error">
            {error}
          </div>
        )}
        
        <div className="qr-scanner-actions">
          <button 
            className="qr-scanner-close-btn"
            onClick={onClose}
          >
            취소
          </button>
        </div>
      </div>
      
      <style jsx>{`
        .qr-scanner-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }
        
        .qr-scanner-container {
          background: white;
          border-radius: 16px;
          padding: 24px;
          max-width: 400px;
          width: 90%;
          max-height: 90vh;
          overflow-y: auto;
        }
        
        .qr-scanner-header {
          text-align: center;
          margin-bottom: 20px;
        }
        
        .qr-scanner-header h3 {
          margin: 0 0 8px 0;
          font-size: 20px;
          color: #1a202c;
        }
        
        .qr-scanner-header p {
          margin: 4px 0;
          color: #64748b;
          font-size: 14px;
        }
        
        .qr-scanner-camera {
          border-radius: 12px;
          overflow: hidden;
          margin-bottom: 16px;
        }
        
        .qr-scanner-error {
          background: #fef2f2;
          color: #dc2626;
          padding: 12px;
          border-radius: 8px;
          text-align: center;
          margin-bottom: 16px;
          font-size: 14px;
        }
        
        .qr-scanner-actions {
          display: flex;
          justify-content: center;
        }
        
        .qr-scanner-close-btn {
          background: #6b7280;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 16px;
          cursor: pointer;
          transition: background 0.2s;
        }
        
        .qr-scanner-close-btn:hover {
          background: #4b5563;
        }
      `}</style>
    </div>
  );
};
