"use client";
import React, { useState, useRef, useEffect } from 'react';

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (qrCode: string) => void;
  onScanError?: (error: string) => void;
  title?: string;
  description?: string;
}

interface QRScanResult {
  success: boolean;
  qr_code?: string;
  message?: string;
}

export default function QRScanner({
  isOpen,
  onClose,
  onScanSuccess,
  onScanError,
  title = "QR 코드 스캔",
  description = "카메라로 QR 코드를 스캔하거나 수동으로 입력하세요"
}: QRScannerProps) {
  const [manualInput, setManualInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState<'camera' | 'manual'>('camera');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen && scanMode === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, scanMode]);

  const startCamera = async () => {
    try {
      setCameraError(null);
      setIsScanning(true);

      // 카메라 권한 요청 및 스트림 시작
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // 후면 카메라 우선
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();

        // QR 코드 스캔 시작
        startQRDetection();
      }

    } catch (error) {
      console.error('카메라 시작 오류:', error);
      setCameraError('카메라에 접근할 수 없습니다. 권한을 확인해주세요.');
      setScanMode('manual');
      setIsScanning(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    setIsScanning(false);
  };

  const startQRDetection = () => {
    // 실제 QR 코드 감지는 브라우저 API나 라이브러리 필요
    // 여기서는 시뮬레이션으로 구현
    scanIntervalRef.current = setInterval(() => {
      if (videoRef.current && videoRef.current.readyState === 4) {
        // 실제로는 canvas에 비디오를 그리고 QR 코드 라이브러리로 분석
        // 지금은 테스트용으로 랜덤 QR 생성
        simulateQRDetection();
      }
    }, 1000);
  };

  const simulateQRDetection = () => {
    // 실제 구현에서는 QR 코드 라이브러리 사용
    // 예: jsQR, qr-scanner 등
    
    // 테스트용 QR 코드 패턴 감지 시뮬레이션
    const testQRPattern = /^LOC_\d+_\d+_\d{4}$/;
    
    // 실제로는 카메라 이미지에서 QR 코드를 감지
    // 여기서는 시뮬레이션
    if (Math.random() > 0.95) { // 5% 확률로 QR 감지
      const mockQR = `LOC_1_${Date.now()}_${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`;
      handleQRDetected(mockQR);
    }
  };

  const handleQRDetected = (qrCode: string) => {
    stopCamera();
    onScanSuccess(qrCode);
  };

  const handleManualSubmit = () => {
    if (!manualInput.trim()) {
      if (onScanError) {
        onScanError('QR 코드를 입력해주세요.');
      }
      return;
    }

    // QR 코드 형식 검증
    const qrPattern = /^LOC_\d+_\d+_\d{4}$/;
    if (!qrPattern.test(manualInput.trim())) {
      if (onScanError) {
        onScanError('올바른 QR 코드 형식이 아닙니다.');
      }
      return;
    }

    onScanSuccess(manualInput.trim());
    setManualInput('');
  };

  const generateTestQR = () => {
    const testQR = `LOC_1_${Date.now()}_${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`;
    setManualInput(testQR);
  };

  const handleClose = () => {
    stopCamera();
    setManualInput('');
    setCameraError(null);
    setScanMode('camera');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        maxWidth: '500px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        {/* 헤더 */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h3 style={{
              margin: '0 0 4px 0',
              fontSize: '18px',
              fontWeight: '600',
              color: '#1e293b'
            }}>
              {title}
            </h3>
            <p style={{
              margin: 0,
              fontSize: '14px',
              color: '#64748b'
            }}>
              {description}
            </p>
          </div>
          
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              color: '#64748b',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            ×
          </button>
        </div>

        {/* 스캔 모드 선택 */}
        <div style={{
          padding: '20px 24px 0 24px'
        }}>
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '20px'
          }}>
            <button
              onClick={() => setScanMode('camera')}
              style={{
                flex: 1,
                padding: '10px 16px',
                background: scanMode === 'camera' ? '#3b82f6' : '#f3f4f6',
                color: scanMode === 'camera' ? 'white' : '#374151',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              카메라 스캔
            </button>
            <button
              onClick={() => setScanMode('manual')}
              style={{
                flex: 1,
                padding: '10px 16px',
                background: scanMode === 'manual' ? '#3b82f6' : '#f3f4f6',
                color: scanMode === 'manual' ? 'white' : '#374151',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              수동 입력
            </button>
          </div>
        </div>

        {/* 카메라 스캔 모드 */}
        {scanMode === 'camera' && (
          <div style={{ padding: '0 24px' }}>
            {cameraError ? (
              <div style={{
                padding: '40px',
                textAlign: 'center',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                marginBottom: '20px'
              }}>
                <div style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#dc2626',
                  marginBottom: '8px'
                }}>
                  카메라 오류
                </div>
                <div style={{
                  fontSize: '14px',
                  color: '#7f1d1d',
                  marginBottom: '16px'
                }}>
                  {cameraError}
                </div>
                <button
                  onClick={() => setScanMode('manual')}
                  style={{
                    padding: '8px 16px',
                    background: '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  수동 입력으로 전환
                </button>
              </div>
            ) : (
              <div style={{
                position: 'relative',
                marginBottom: '20px'
              }}>
                <video
                  ref={videoRef}
                  style={{
                    width: '100%',
                    height: '300px',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    background: '#000'
                  }}
                  playsInline
                  muted
                />
                
                {/* 스캔 오버레이 */}
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '200px',
                  height: '200px',
                  border: '2px solid #3b82f6',
                  borderRadius: '8px',
                  background: 'rgba(59, 130, 246, 0.1)'
                }}>
                  <div style={{
                    position: 'absolute',
                    top: '-1px',
                    left: '-1px',
                    width: '20px',
                    height: '20px',
                    borderTop: '3px solid #3b82f6',
                    borderLeft: '3px solid #3b82f6'
                  }} />
                  <div style={{
                    position: 'absolute',
                    top: '-1px',
                    right: '-1px',
                    width: '20px',
                    height: '20px',
                    borderTop: '3px solid #3b82f6',
                    borderRight: '3px solid #3b82f6'
                  }} />
                  <div style={{
                    position: 'absolute',
                    bottom: '-1px',
                    left: '-1px',
                    width: '20px',
                    height: '20px',
                    borderBottom: '3px solid #3b82f6',
                    borderLeft: '3px solid #3b82f6'
                  }} />
                  <div style={{
                    position: 'absolute',
                    bottom: '-1px',
                    right: '-1px',
                    width: '20px',
                    height: '20px',
                    borderBottom: '3px solid #3b82f6',
                    borderRight: '3px solid #3b82f6'
                  }} />
                </div>

                {isScanning && (
                  <div style={{
                    position: 'absolute',
                    bottom: '10px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(0, 0, 0, 0.7)',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      border: '2px solid #3b82f6',
                      borderTop: '2px solid transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    QR 코드를 스캔하는 중...
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 수동 입력 모드 */}
        {scanMode === 'manual' && (
          <div style={{ padding: '0 24px' }}>
            <div style={{
              padding: '20px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <div style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '12px'
              }}>
                QR 코드 직접 입력
              </div>
              
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="LOC_1_1234567890_1234 형식으로 입력"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  marginBottom: '12px',
                  boxSizing: 'border-box'
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleManualSubmit();
                  }
                }}
              />
              
              <div style={{
                display: 'flex',
                gap: '8px'
              }}>
                <button
                  onClick={handleManualSubmit}
                  disabled={!manualInput.trim()}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    background: manualInput.trim() ? '#10b981' : '#e5e7eb',
                    color: manualInput.trim() ? 'white' : '#9ca3af',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: manualInput.trim() ? 'pointer' : 'not-allowed'
                  }}
                >
                  확인
                </button>
                
                <button
                  onClick={generateTestQR}
                  style={{
                    padding: '10px 16px',
                    background: '#f59e0b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  테스트 QR
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 하단 버튼 */}
        <div style={{
          padding: '20px 24px',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'center'
        }}>
          <button
            onClick={handleClose}
            style={{
              padding: '10px 24px',
              background: '#f3f4f6',
              color: '#374151',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            취소
          </button>
        </div>
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
