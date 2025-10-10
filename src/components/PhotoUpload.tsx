// components/PhotoUpload.tsx
import React, { useState, useRef } from 'react';

interface PhotoUploadProps {
  onUpload: (file: File) => void;
  onClose: () => void;
  isOpen: boolean;
  isLoading: boolean;
}

export const PhotoUpload: React.FC<PhotoUploadProps> = ({
  onUpload,
  onClose,
  isOpen,
  isLoading
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      onUpload(selectedFile);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="photo-upload-modal">
      <div className="photo-upload-container">
        <div className="photo-upload-header">
          <h3>퇴근 인증 사진</h3>
          <p>촬영 완료 인증을 위한 사진을 업로드해주세요</p>
        </div>
        
        <div className="photo-upload-content">
          {!previewUrl ? (
            <div className="photo-upload-area">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                ref={fileInputRef}
                style={{ display: 'none' }}
              />
              <button
                className="photo-select-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
              >
                📷 사진 선택
              </button>
            </div>
          ) : (
            <div className="photo-preview">
              <img src={previewUrl} alt="선택된 사진" />
              <button
                className="photo-change-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
              >
                사진 변경
              </button>
            </div>
          )}
        </div>
        
        <div className="photo-upload-actions">
          <button 
            className="photo-cancel-btn"
            onClick={handleClose}
            disabled={isLoading}
          >
            취소
          </button>
          <button 
            className="photo-upload-btn"
            onClick={handleUpload}
            disabled={!selectedFile || isLoading}
          >
            {isLoading ? '업로드중...' : '퇴근 완료'}
          </button>
        </div>
      </div>
      
      <style jsx>{`
        .photo-upload-modal {
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
        
        .photo-upload-container {
          background: white;
          border-radius: 16px;
          padding: 24px;
          max-width: 400px;
          width: 90%;
          max-height: 90vh;
          overflow-y: auto;
        }
        
        .photo-upload-header {
          text-align: center;
          margin-bottom: 24px;
        }
        
        .photo-upload-header h3 {
          margin: 0 0 8px 0;
          font-size: 20px;
          color: #1a202c;
        }
        
        .photo-upload-header p {
          margin: 0;
          color: #64748b;
          font-size: 14px;
        }
        
        .photo-upload-area {
          border: 2px dashed #d1d5db;
          border-radius: 12px;
          padding: 40px 20px;
          text-align: center;
          margin-bottom: 24px;
        }
        
        .photo-select-btn {
          background: #3b82f6;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 16px;
          cursor: pointer;
          transition: background 0.2s;
        }
        
        .photo-select-btn:hover:not(:disabled) {
          background: #2563eb;
        }
        
        .photo-select-btn:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }
        
        .photo-preview {
          text-align: center;
          margin-bottom: 24px;
        }
        
        .photo-preview img {
          max-width: 100%;
          max-height: 200px;
          border-radius: 8px;
          margin-bottom: 12px;
        }
        
        .photo-change-btn {
          background: #6b7280;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
        }
        
        .photo-change-btn:hover:not(:disabled) {
          background: #4b5563;
        }
        
        .photo-upload-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
        }
        
        .photo-cancel-btn {
          background: #6b7280;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
        }
        
        .photo-upload-btn {
          background: #10b981;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
        }
        
        .photo-upload-btn:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};
