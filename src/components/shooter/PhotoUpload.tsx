"use client";
import React, { useState, useRef } from 'react';
import { ActionType } from '../../types/shooter';

interface PhotoUploadProps {
  scheduleId: number;
  shooterId: number;
  actionType: ActionType;
  onUploadSuccess: (photoUrl: string) => void;
  onUploadError?: (error: string) => void;
  required?: boolean;
  maxFileSize?: number; // MB 단위
  targetSizeMB?: number; // 목표 압축 크기 (기본 1MB)
  acceptedFormats?: string[];
}

interface CompressionOptions {
  maxSizeMB: number;
  maxWidthOrHeight: number;
  quality: number;
  useWebWorker: boolean;
}

export default function PhotoUpload({
  scheduleId,
  shooterId,
  actionType,
  onUploadSuccess,
  onUploadError,
  required = false,
  maxFileSize = 10,
  targetSizeMB = 1, // 1MB 이하로 압축
  acceptedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
}: PhotoUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [compressionInfo, setCompressionInfo] = useState<{
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 이미지 압축 함수
  const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Canvas context를 생성할 수 없습니다.'));
        return;
      }

      img.onload = () => {
        // 목표 크기에 맞는 압축 설정 계산
        const targetBytes = targetSizeMB * 1024 * 1024;
        let quality = 0.9;
        let maxDimension = 1920;

        // 파일 크기에 따른 초기 설정
        if (file.size > targetBytes * 5) {
          quality = 0.6;
          maxDimension = 1200;
        } else if (file.size > targetBytes * 2) {
          quality = 0.7;
          maxDimension = 1600;
        }

        // 이미지 크기 조정 계산
        const ratio = Math.min(maxDimension / img.width, maxDimension / img.height, 1);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;

        // 이미지 그리기
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // 압축된 이미지를 Blob으로 변환
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('이미지 압축에 실패했습니다.'));
              return;
            }

            // 목표 크기보다 크면 품질을 더 낮춰서 재시도
            if (blob.size > targetBytes && quality > 0.3) {
              quality -= 0.1;
              canvas.toBlob(
                (retryBlob) => {
                  if (!retryBlob) {
                    reject(new Error('이미지 압축에 실패했습니다.'));
                    return;
                  }

                  const compressedFile = new File(
                    [retryBlob], 
                    file.name.replace(/\.[^/.]+$/, '.jpg'), 
                    { type: 'image/jpeg' }
                  );
                  resolve(compressedFile);
                },
                'image/jpeg',
                quality
              );
            } else {
              const compressedFile = new File(
                [blob], 
                file.name.replace(/\.[^/.]+$/, '.jpg'), 
                { type: 'image/jpeg' }
              );
              resolve(compressedFile);
            }
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => {
        reject(new Error('이미지를 로드할 수 없습니다.'));
      };

      // 이미지 로드
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = () => {
        reject(new Error('파일을 읽을 수 없습니다.'));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 파일 유효성 검증
    const validationResult = validateFile(file);
    if (!validationResult.valid) {
      setError(validationResult.message || '유효하지 않은 파일입니다.');
      if (onUploadError) {
        onUploadError(validationResult.message || '유효하지 않은 파일입니다.');
      }
      return;
    }

    setError(null);
    setOriginalFile(file);
    setIsCompressing(true);

    try {
      // 1MB 이하로 자동 압축
      const compressedFile = await compressImage(file);
      
      setSelectedFile(compressedFile);
      setCompressionInfo({
        originalSize: file.size,
        compressedSize: compressedFile.size,
        compressionRatio: Math.round((1 - compressedFile.size / file.size) * 100)
      });

      // 압축된 이미지 미리보기 생성
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(compressedFile);

    } catch (compressionError) {
      console.error('이미지 압축 오류:', compressionError);
      setError('이미지 압축 중 오류가 발생했습니다.');
      if (onUploadError) {
        onUploadError('이미지 압축 중 오류가 발생했습니다.');
      }
    } finally {
      setIsCompressing(false);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      if (fileInputRef.current) {
        fileInputRef.current.files = dataTransfer.files;
        handleFileSelect({ target: { files: dataTransfer.files } } as any);
      }
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const validateFile = (file: File): { valid: boolean; message?: string } => {
    // 파일 크기 검증 (원본 파일 기준)
    if (file.size > maxFileSize * 1024 * 1024) {
      return {
        valid: false,
        message: `파일 크기는 ${maxFileSize}MB를 초과할 수 없습니다.`
      };
    }

    // 파일 형식 검증
    if (!acceptedFormats.includes(file.type)) {
      return {
        valid: false,
        message: '지원되지 않는 파일 형식입니다. (JPEG, PNG, WebP만 허용)'
      };
    }

    return { valid: true };
  };

  const uploadPhoto = async () => {
    if (!selectedFile) {
      setError('업로드할 파일을 선택해주세요.');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('shooter_id', shooterId.toString());
      formData.append('schedule_id', scheduleId.toString());
      formData.append('action_type', actionType);

      const response = await fetch('/api/shooter/upload-photo', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        onUploadSuccess(result.data.photo_url);
        setSelectedFile(null);
        setOriginalFile(null);
        setPreviewUrl(null);
        setCompressionInfo(null);
      } else {
        throw new Error(result.message || '업로드 실패');
      }

    } catch (error) {
      console.error('사진 업로드 오류:', error);
      const errorMessage = error instanceof Error ? error.message : '업로드 중 오류가 발생했습니다.';
      setError(errorMessage);
      if (onUploadError) {
        onUploadError(errorMessage);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setOriginalFile(null);
    setPreviewUrl(null);
    setError(null);
    setCompressionInfo(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getActionDescription = (action: ActionType): string => {
    const descriptions = {
      'schedule_check': '스케줄 확인 증빙 사진',
      'departure': '출발 증빙 사진',
      'arrival': '도착 증빙 사진',
      'start': '촬영 시작 증빙 사진',
      'end': '촬영 종료 증빙 사진',
      'completion': '업무 완료 증빙 사진 (필수)'
    };
    return descriptions[action] || '증빙 사진';
  };

  return (
    <div style={{
      background: 'white',
      borderRadius: '8px',
      padding: '20px',
      border: '1px solid #e2e8f0'
    }}>
      {/* 헤더 */}
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{
          margin: '0 0 4px 0',
          fontSize: '16px',
          fontWeight: '600',
          color: '#1e293b'
        }}>
          사진 업로드 (자동 압축)
          {required && (
            <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>
          )}
        </h3>
        <p style={{
          margin: 0,
          fontSize: '14px',
          color: '#64748b'
        }}>
          {getActionDescription(actionType)} - 자동으로 {targetSizeMB}MB 이하로 압축됩니다
        </p>
      </div>

      {/* 압축 진행 중 */}
      {isCompressing && (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          background: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: '8px',
          marginBottom: '16px'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #3b82f6',
            borderTop: '4px solid transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 12px'
          }} />
          <div style={{ fontSize: '14px', color: '#0369a1' }}>
            이미지를 {targetSizeMB}MB 이하로 압축하는 중...
          </div>
        </div>
      )}

      {/* 파일 선택 영역 */}
      {!selectedFile && !isCompressing && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          style={{
            border: '2px dashed #cbd5e1',
            borderRadius: '8px',
            padding: '40px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s',
            background: '#f8fafc'
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <div style={{
            fontSize: '48px',
            color: '#94a3b8',
            marginBottom: '12px'
          }}>
            📷
          </div>
          <div style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '8px'
          }}>
            사진을 선택하거나 드래그하세요
          </div>
          <div style={{
            fontSize: '14px',
            color: '#64748b',
            marginBottom: '12px'
          }}>
            자동으로 {targetSizeMB}MB 이하로 압축됩니다
          </div>
          <button
            type="button"
            style={{
              padding: '8px 16px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            파일 선택
          </button>
        </div>
      )}

      {/* 선택된 파일 미리보기 */}
      {selectedFile && previewUrl && (
        <div style={{
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '16px',
          background: '#f8fafc'
        }}>
          <div style={{
            display: 'flex',
            gap: '16px',
            alignItems: 'flex-start'
          }}>
            {/* 미리보기 이미지 */}
            <div style={{
              width: '120px',
              height: '120px',
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid #e2e8f0',
              flexShrink: 0
            }}>
              <img
                src={previewUrl}
                alt="미리보기"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
            </div>

            {/* 파일 정보 */}
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#1e293b',
                marginBottom: '4px'
              }}>
                {selectedFile.name}
              </div>
              <div style={{
                fontSize: '13px',
                color: '#64748b',
                marginBottom: '8px'
              }}>
                압축 후 크기: {formatFileSize(selectedFile.size)} | 형식: {selectedFile.type}
              </div>

              {/* 압축 정보 */}
              {compressionInfo && (
                <div style={{
                  padding: '8px 12px',
                  background: '#ecfdf5',
                  border: '1px solid #bbf7d0',
                  borderRadius: '6px',
                  marginBottom: '12px'
                }}>
                  <div style={{ fontSize: '12px', color: '#166534', fontWeight: '600' }}>
                    압축 완료! {compressionInfo.compressionRatio}% 용량 절약
                  </div>
                  <div style={{ fontSize: '11px', color: '#166534', marginTop: '2px' }}>
                    원본: {formatFileSize(compressionInfo.originalSize)} → 
                    압축: {formatFileSize(compressionInfo.compressedSize)}
                  </div>
                </div>
              )}

              {/* 액션 버튼 */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={uploadPhoto}
                  disabled={isUploading}
                  style={{
                    padding: '8px 16px',
                    background: isUploading ? '#94a3b8' : '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: isUploading ? 'not-allowed' : 'pointer',
                    fontWeight: '500'
                  }}
                >
                  {isUploading ? '업로드 중...' : '업로드'}
                </button>
                
                <button
                  onClick={removeFile}
                  disabled={isUploading}
                  style={{
                    padding: '8px 16px',
                    background: '#f3f4f6',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: isUploading ? 'not-allowed' : 'pointer'
                  }}
                >
                  제거
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 에러 메시지 */}
      {error && (
        <div style={{
          marginTop: '12px',
          padding: '12px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '6px',
          color: '#dc2626',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}

      {/* 숨겨진 파일 입력 */}
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedFormats.join(',')}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        capture="environment"
      />

      {/* 도움말 */}
      <div style={{
        marginTop: '16px',
        padding: '12px',
        background: '#f0f9ff',
        border: '1px solid #bae6fd',
        borderRadius: '6px',
        fontSize: '13px',
        color: '#0369a1'
      }}>
        💡 <strong>자동 압축:</strong> 업로드 전 자동으로 {targetSizeMB}MB 이하로 압축되어 빠른 업로드가 가능합니다.
        {actionType === 'completion' && ' 완료 사진은 업무 증빙용으로 필수입니다.'}
      </div>

      {/* CSS 애니메이션 */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
