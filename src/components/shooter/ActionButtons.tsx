"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';

interface Schedule {
  id: number;
  shoot_date: string;
  start_time: string;
  end_time: string;
  course_name: string;
  professor_name: string;
  tracking_status: string;
  sub_location_id: number;
  location_name?: string;
  main_location_name?: string;
  main_location_id?: number;
}

interface ActionButtonsProps {
  schedule?: Schedule;
  onActionComplete?: (actionType: string) => void;
}

interface QRScanResult {
  success: boolean;
  qr_code?: string;
  message?: string;
}

export default function ActionButtons({ schedule, onActionComplete }: ActionButtonsProps) {
  const [currentSchedule, setCurrentSchedule] = useState<Schedule | null>(schedule || null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [shooterId, setShooterId] = useState<number | null>(null);

  useEffect(() => {
    // Shooter ID 가져오기 (실제로는 인증 시스템에서)
    const id = localStorage.getItem('shooterId');
    if (id) {
      setShooterId(parseInt(id));
    }

    // 스케줄이 제공되지 않은 경우 오늘의 스케줄 조회
    if (!schedule) {
      loadTodaySchedule();
    }
  }, [schedule]);

  const loadTodaySchedule = async () => {
    if (!shooterId) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('schedules')
        .select(`
          id, shoot_date, start_time, end_time, course_name, 
          professor_name, tracking_status, sub_location_id,
          sub_locations(name, main_location_id, main_locations(name))
        `)
        .eq('assigned_shooter_id', shooterId)
        .eq('shoot_date', today)
        .eq('is_active', true)
        .single();

      if (!error && data) {
        setCurrentSchedule({
          ...data,
          location_name: data.sub_locations?.name,
          main_location_name: data.sub_locations?.main_locations?.name,
          main_location_id: data.sub_locations?.main_location_id
        });
      }
    } catch (error) {
      console.error('오늘 스케줄 조회 오류:', error);
    }
  };

  const performAction = async (actionType: string) => {
    if (!currentSchedule || !shooterId || isLoading) return;

    setIsLoading(true);
    setActionInProgress(actionType);

    try {
      // arrival 액션인 경우 QR 스캔 필요
      if (actionType === 'arrival') {
        setQrScannerOpen(true);
        setIsLoading(false);
        setActionInProgress(null);
        return;
      }

      // completion 액션인 경우 사진 업로드 필요
      if (actionType === 'completion' && !photoFile) {
        alert('완료 사진을 업로드해주세요.');
        setIsLoading(false);
        setActionInProgress(null);
        return;
      }

      let photoUrl = null;
      if (photoFile) {
        photoUrl = await uploadPhoto(photoFile);
      }

      // API 호출
      const response = await fetch('/api/shooter/record-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          schedule_id: currentSchedule.id,
          shooter_id: shooterId,
          action_type: actionType,
          notes: notes || undefined,
          photo_url: photoUrl || undefined
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert(result.message);
        
        // 스케줄 상태 업데이트
        setCurrentSchedule(prev => prev ? {
          ...prev,
          tracking_status: actionType
        } : null);

        // 입력 필드 초기화
        setNotes('');
        setPhotoFile(null);

        // 콜백 호출
        if (onActionComplete) {
          onActionComplete(actionType);
        }

        // 페이지 새로고침 (실시간 업데이트)
        setTimeout(() => {
          window.location.reload();
        }, 1000);

      } else {
        alert(result.message || '액션 수행 중 오류가 발생했습니다.');
      }

    } catch (error) {
      console.error('액션 수행 오류:', error);
      alert('서버 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
      setActionInProgress(null);
    }
  };

  const handleQRScan = async (qrCode: string) => {
    if (!currentSchedule || !shooterId) return;

    setQrScannerOpen(false);
    setIsLoading(true);
    setActionInProgress('arrival');

    try {
      // QR 검증 API 호출
      const verifyResponse = await fetch('/api/qr/verify-qr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          qr_code: qrCode,
          main_location_id: currentSchedule.main_location_id,
          shooter_id: shooterId,
          schedule_id: currentSchedule.id
        }),
      });

      const verifyResult = await verifyResponse.json();

      if (!verifyResult.success) {
        alert(verifyResult.message || 'QR 코드 검증에 실패했습니다.');
        setIsLoading(false);
        setActionInProgress(null);
        return;
      }

      // 도착 액션 수행
      const actionResponse = await fetch('/api/shooter/record-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          schedule_id: currentSchedule.id,
          shooter_id: shooterId,
          action_type: 'arrival',
          qr_code: qrCode,
          notes: notes || undefined
        }),
      });

      const actionResult = await actionResponse.json();

      if (actionResult.success) {
        alert('도착이 확인되었습니다!');
        setCurrentSchedule(prev => prev ? {
          ...prev,
          tracking_status: 'arrival'
        } : null);
        setNotes('');
        
        if (onActionComplete) {
          onActionComplete('arrival');
        }

        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        alert(actionResult.message || '도착 처리 중 오류가 발생했습니다.');
      }

    } catch (error) {
      console.error('QR 스캔 처리 오류:', error);
      alert('서버 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
      setActionInProgress(null);
    }
  };

  const uploadPhoto = async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('shooter_id', shooterId?.toString() || '');
      formData.append('schedule_id', currentSchedule?.id.toString() || '');

      const response = await fetch('/api/shooter/upload-photo', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      return result.success ? result.data.photo_url : null;
    } catch (error) {
      console.error('사진 업로드 오류:', error);
      return null;
    }
  };

  const getNextAction = () => {
    if (!currentSchedule) return null;

    const actionFlow = [
      'scheduled',
      'schedule_check',
      'departure', 
      'arrival',
      'start',
      'end',
      'completion'
    ];

    const currentIndex = actionFlow.indexOf(currentSchedule.tracking_status);
    return currentIndex < actionFlow.length - 1 ? actionFlow[currentIndex + 1] : null;
  };

  const getActionText = (actionType: string) => {
    const actionTexts = {
      'schedule_check': '스케줄 확인',
      'departure': '출발',
      'arrival': '도착',
      'start': '촬영 시작',
      'end': '촬영 종료',
      'completion': '업무 완료'
    };
    return actionTexts[actionType as keyof typeof actionTexts] || actionType;
  };

  const getActionColor = (actionType: string) => {
    const colors = {
      'schedule_check': '#3b82f6',
      'departure': '#f59e0b',
      'arrival': '#10b981',
      'start': '#8b5cf6',
      'end': '#ef4444',
      'completion': '#059669'
    };
    return colors[actionType as keyof typeof colors] || '#64748b';
  };

  const getActionDescription = (actionType: string) => {
    const descriptions = {
      'schedule_check': 'D-1 스케줄을 확인했습니다.',
      'departure': '촬영 장소로 출발합니다.',
      'arrival': 'QR 코드를 스캔하여 도착을 확인합니다.',
      'start': '촬영을 시작합니다.',
      'end': '촬영을 종료합니다.',
      'completion': '사진을 업로드하고 업무를 완료합니다.'
    };
    return descriptions[actionType as keyof typeof descriptions] || '';
  };

  if (!currentSchedule) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        background: 'white',
        borderRadius: '12px',
        border: '2px dashed #cbd5e1',
        color: '#64748b'
      }}>
        오늘 예정된 촬영이 없습니다.
      </div>
    );
  }

  const nextAction = getNextAction();

  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      padding: '24px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      border: '1px solid #e2e8f0'
    }}>
      {/* 현재 스케줄 정보 */}
      <div style={{
        marginBottom: '24px',
        padding: '16px',
        background: '#f8fafc',
        borderRadius: '8px',
        border: '1px solid #e2e8f0'
      }}>
        <h3 style={{
          margin: '0 0 8px 0',
          fontSize: '18px',
          fontWeight: '600',
          color: '#1e293b'
        }}>
          {currentSchedule.course_name}
        </h3>
        <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '4px' }}>
          교수: {currentSchedule.professor_name}
        </div>
        <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>
          시간: {currentSchedule.start_time.substring(0, 5)} - {currentSchedule.end_time.substring(0, 5)}
        </div>
        <div style={{
          display: 'inline-block',
          background: getActionColor(currentSchedule.tracking_status),
          color: 'white',
          padding: '4px 12px',
          borderRadius: '16px',
          fontSize: '12px',
          fontWeight: '600'
        }}>
          현재 상태: {getActionText(currentSchedule.tracking_status)}
        </div>
      </div>

      {/* 다음 액션 */}
      {nextAction && (
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{
            margin: '0 0 16px 0',
            fontSize: '16px',
            fontWeight: '600',
            color: '#1e293b'
          }}>
            다음 액션: {getActionText(nextAction)}
          </h4>
          
          <p style={{
            margin: '0 0 16px 0',
            fontSize: '14px',
            color: '#64748b',
            lineHeight: 1.5
          }}>
            {getActionDescription(nextAction)}
          </p>

          {/* 메모 입력 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151'
            }}>
              메모 (선택사항)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="특이사항이나 메모를 입력하세요..."
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                minHeight: '80px',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* 완료 사진 업로드 */}
          {nextAction === 'completion' && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151'
              }}>
                완료 사진 업로드 (필수)
              </label>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setPhotoFile(file);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
              {photoFile && (
                <div style={{
                  marginTop: '8px',
                  fontSize: '12px',
                  color: '#059669'
                }}>
                  선택된 파일: {photoFile.name}
                </div>
              )}
            </div>
          )}

          {/* 액션 버튼 */}
          <button
            onClick={() => performAction(nextAction)}
            disabled={isLoading || (nextAction === 'completion' && !photoFile)}
            style={{
              width: '100%',
              padding: '16px',
              background: isLoading ? '#9ca3af' : getActionColor(nextAction),
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              opacity: (nextAction === 'completion' && !photoFile) ? 0.5 : 1
            }}
          >
            {isLoading && actionInProgress === nextAction ? 
              '처리 중...' : 
              `${getActionText(nextAction)} 수행`
            }
          </button>
        </div>
      )}

      {/* 완료된 경우 */}
      {currentSchedule.tracking_status === 'completion' && (
        <div style={{
          padding: '20px',
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#166534',
            marginBottom: '8px'
          }}>
            모든 업무가 완료되었습니다!
          </div>
          <div style={{
            fontSize: '14px',
            color: '#166534'
          }}>
            수고하셨습니다. 오늘 촬영이 모두 끝났습니다.
          </div>
        </div>
      )}

      {/* QR 스캐너 모달 */}
      {qrScannerOpen && (
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
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '24px',
            borderRadius: '12px',
            maxWidth: '400px',
            width: '90%'
          }}>
            <h3 style={{
              margin: '0 0 16px 0',
              fontSize: '18px',
              fontWeight: '600',
              textAlign: 'center'
            }}>
              QR 코드 스캔
            </h3>
            
            <div style={{
              padding: '40px',
              border: '2px dashed #cbd5e1',
              borderRadius: '8px',
              textAlign: 'center',
              marginBottom: '16px'
            }}>
              <p style={{ margin: 0, color: '#64748b' }}>
                카메라로 QR 코드를 스캔하거나<br/>
                수동으로 입력하세요
              </p>
            </div>

            <input
              type="text"
              placeholder="QR 코드를 직접 입력"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                marginBottom: '16px',
                boxSizing: 'border-box'
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  const value = (e.target as HTMLInputElement).value;
                  if (value) {
                    handleQRScan(value);
                  }
                }
              }}
            />

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setQrScannerOpen(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                취소
              </button>
              <button
                onClick={() => {
                  // 테스트용 QR 코드
                  handleQRScan(`LOC_${currentSchedule.main_location_id}_${Date.now()}_1234`);
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                테스트 QR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
