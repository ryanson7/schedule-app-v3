// src/pages/shooter/tracking.tsx - DB 권한 연동 완성 버전
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useShootingTracker } from '../../hooks/useShootingTracker';
import { ShootingTracker } from '../../utils/shootingTracker';
import { QRScanner } from '../../components/QRScanner';
import { PhotoUpload } from '../../components/PhotoUpload';
import { supabase } from '../../utils/supabaseClient';

// 🔥 DB 연동 권한 체크 Hook
const usePermission = (pagePath: string) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkPermission();
  }, [pagePath]);

  const checkPermission = async () => {
    const userRole = localStorage.getItem('userRole');
    
    if (!userRole) {
      setHasPermission(false);
      setLoading(false);
      return;
    }

    // 캐시 확인
    const cacheKey = `permission_${userRole}_${pagePath}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (cached !== null) {
      setHasPermission(cached === 'true');
      setLoading(false);
      return;
    }

    try {
      // 🔥 DB에서 권한 확인
      const { data, error } = await supabase
        .from('permissions')
        .select('can_access')
        .eq('user_role', userRole)
        .eq('page_path', pagePath)
        .single();

      if (error) {
        console.error('권한 확인 실패:', error);
        setHasPermission(false);
      } else {
        const permission = data?.can_access || false;
        setHasPermission(permission);
        
        // 캐시 저장 (5분)
        localStorage.setItem(cacheKey, permission.toString());
        setTimeout(() => localStorage.removeItem(cacheKey), 5 * 60 * 1000);
      }
    } catch (error) {
      console.error('권한 체크 에러:', error);
      setHasPermission(false);
    }

    setLoading(false);
  };

  return { hasPermission, loading };
};

// 워터마크 및 구글 드라이브 유틸리티 함수들
const addWatermarkToImage = (imageFile: File, watermarkData: any): Promise<Blob> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      
      // 원본 이미지 그리기
      ctx.drawImage(img, 0, 0);
      
      // 워터마크 배경 (반투명 검정)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, img.height - 100, img.width, 100);
      
      // 텍스트 스타일
      ctx.fillStyle = 'white';
      ctx.font = 'bold 28px Arial';
      ctx.textAlign = 'left';
      
      // 워터마크 텍스트 추가
      const dateText = `📅 ${watermarkData.date} ${watermarkData.time}`;
      const nameText = `👤 ${watermarkData.name}`;
      const locationText = `📍 ${watermarkData.location}`;
      
      ctx.fillText(dateText, 20, img.height - 70);
      ctx.fillText(nameText, 20, img.height - 40);
      ctx.fillText(locationText, 20, img.height - 10);
      
      canvas.toBlob(resolve!, 'image/jpeg', 0.9);
    };
    
    img.src = URL.createObjectURL(imageFile);
  });
};

const uploadToGoogleDrive = async (imageBlob: Blob, fileName: string, folderName: string) => {
  try {
    // Google API 로드 확인
    if (typeof gapi === 'undefined') {
      console.warn('Google API가 로드되지 않음. Supabase에만 저장됩니다.');
      return null;
    }

    // Google Drive API 초기화
    await new Promise<void>((resolve) => {
      gapi.load('client:auth2', resolve);
    });

    await gapi.client.init({
      apiKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY,
      clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
      scope: 'https://www.googleapis.com/auth/drive.file'
    });

    // 인증 확인
    const authInstance = gapi.auth2.getAuthInstance();
    if (!authInstance.isSignedIn.get()) {
      await authInstance.signIn();
    }

    // 폴더 생성 또는 찾기
    const folderId = await createOrFindFolder(folderName);
    
    // 파일 업로드
    const metadata = {
      name: fileName,
      parents: [folderId]
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], {type: 'application/json'}));
    form.append('file', imageBlob);

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${gapi.auth.getToken().access_token}`
      },
      body: form
    });

    return response.json();
  } catch (error) {
    console.error('구글 드라이브 업로드 실패:', error);
    return null;
  }
};

const createOrFindFolder = async (folderName: string): Promise<string> => {
  // 기존 폴더 검색
  const response = await gapi.client.drive.files.list({
    q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}'`
  });

  if (response.result.files.length > 0) {
    return response.result.files[0].id;
  }

  // 새 폴더 생성
  const folderResponse = await gapi.client.drive.files.create({
    resource: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    }
  });

  return folderResponse.result.id;
};

interface Schedule {
  id: string;
  title: string;
  courseName: string;
  professor: string;
  location: string;
  startTime: string;
  endTime: string;
  description?: string;
  phone?: string;
  email?: string;
  room?: string;
}

const TrackingPage = () => {
  const router = useRouter();
  
  // 🔥 DB 연동 권한 체크
  const { hasPermission, loading: permissionLoading } = usePermission('/shooter/tracking');
  
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [loadingError, setLoadingError] = useState<string>('');

  // 시간 포맷 함수 (초 제거)
  const formatTime = (timeString: string): string => {
    if (!timeString) return '';
    return timeString.split(':').slice(0, 2).join(':');
  };

  // 🔥 권한 확인 후 스케줄 로딩
  useEffect(() => {
    if (!permissionLoading) {
      if (!hasPermission) {
        alert('촬영 트래킹 페이지 접근 권한이 없습니다.');
        router.push('/login');
        return;
      } else {
        // 권한이 있는 경우에만 스케줄 로딩
        loadSchedule();
      }
    }
  }, [hasPermission, permissionLoading, router]);

  const loadSchedule = async () => {
    console.log('🔄 스케줄 로딩 시작...');
    
    try {
      if (typeof window !== 'undefined') {
        const storedSchedule = sessionStorage.getItem('currentSchedule');
        console.log('📦 SessionStorage에서 가져온 데이터:', storedSchedule);
        
        if (!storedSchedule) {
          console.log('❌ SessionStorage가 비어있습니다.');
          setLoadingError('스케줄 데이터가 없습니다.');
          
          setTimeout(() => {
            router.push('/shooter/ShooterDashboard');
          }, 3000);
          return;
        }

        const parsedSchedule = JSON.parse(storedSchedule);
        console.log('🔍 파싱된 스케줄 데이터:', parsedSchedule);
        
        if (!parsedSchedule.id || parsedSchedule.id === 'undefined') {
          console.log('❌ 스케줄 ID가 없거나 유효하지 않습니다:', parsedSchedule.id);
          setLoadingError('스케줄 ID가 없습니다.');
          
          setTimeout(() => {
            router.push('/shooter/ShooterDashboard');
          }, 3000);
          return;
        }
        
        const formattedSchedule: Schedule = {
          id: parsedSchedule.id.toString(),
          title: parsedSchedule.title || parsedSchedule.professor || '교수명',
          courseName: parsedSchedule.courseName || '과목명',
          professor: parsedSchedule.professor || parsedSchedule.title || '교수명',
          location: parsedSchedule.location || '촬영지 확인중',
          startTime: formatTime(parsedSchedule.startTime || ''),
          endTime: formatTime(parsedSchedule.endTime || ''),
          description: parsedSchedule.description || '',
          phone: parsedSchedule.phone || '',
          email: parsedSchedule.email || '',
          room: parsedSchedule.room || ''
        };
        
        console.log('✅ 최종 처리된 스케줄 데이터:', formattedSchedule);
        setSchedule(formattedSchedule);
        
        setTimeout(() => {
          setIsInitialized(true);
          console.log('🎯 스케줄 초기화 완료');
        }, 100);
        return;
      }
      
      setLoadingError('브라우저 환경이 올바르지 않습니다.');
      router.push('/shooter/ShooterDashboard');
      
    } catch (error) {
      console.error('❌ 스케줄 로딩 실패:', error);
      setLoadingError('스케줄 데이터를 불러오는데 실패했습니다.');
      
      setTimeout(() => {
        router.push('/shooter/ShooterDashboard');
      }, 3000);
    }
  };

  // 🔥 권한 확인 중 로딩
  if (permissionLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#f8fafc',
        gap: '16px'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #e2e8f0',
          borderTop: '4px solid #667eea',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <div style={{
          fontSize: '18px',
          color: '#64748b',
          fontWeight: '500'
        }}>
          권한 확인 중...
        </div>
        <div style={{
          fontSize: '14px',
          color: '#9ca3af',
          textAlign: 'center'
        }}>
          촬영 트래킹 페이지 접근 권한을 확인하고 있습니다.
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

  // 🔥 권한 없음
  if (!hasPermission) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#f8fafc',
        gap: '20px'
      }}>
        <div style={{
          fontSize: '24px',
          color: '#ef4444',
          fontWeight: '600'
        }}>
          접근 권한이 없습니다
        </div>
        <div style={{
          fontSize: '16px',
          color: '#64748b',
          textAlign: 'center',
          lineHeight: 1.5
        }}>
          촬영 트래킹 페이지에 접근할 권한이 없습니다.<br/>
          관리자에게 문의하세요.
        </div>
        <button
          onClick={() => router.push('/login')}
          style={{
            padding: '12px 24px',
            background: '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          로그인 페이지로 이동
        </button>
      </div>
    );
  }

  // 에러 상태
  if (loadingError) {
    return (
      <div className="error-container">
        <div className="error-icon">❌</div>
        <div className="error-title">오류가 발생했습니다</div>
        <div className="error-message">{loadingError}</div>
        <div className="error-submessage">3초 후 대시보드로 이동합니다...</div>
        <button 
          className="error-button" 
          onClick={() => router.push('/shooter/ShooterDashboard')}
        >
          지금 이동하기
        </button>
        
        <style jsx>{`
          .error-container {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            flex-direction: column;
            gap: 16px;
            background-color: #f8fafc;
            text-align: center;
            padding: 40px 20px;
          }
          .error-icon {
            font-size: 48px;
            margin-bottom: 16px;
          }
          .error-title {
            font-size: 20px;
            font-weight: 600;
            color: #dc2626;
            margin-bottom: 8px;
          }
          .error-message {
            font-size: 16px;
            color: #374151;
            margin-bottom: 8px;
          }
          .error-submessage {
            font-size: 14px;
            color: #6b7280;
            margin-bottom: 24px;
          }
          .error-button {
            padding: 12px 24px;
            background: linear-gradient(135deg, #3b82f6, #1e40af);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .error-button:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
          }
        `}</style>
      </div>
    );
  }

  // 로딩 상태
  if (!isInitialized || !schedule) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <div className="loading-text">스케줄 데이터를 불러오는 중...</div>
        
        <style jsx>{`
          .loading-container {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            flex-direction: column;
            gap: 16px;
            background-color: #f8fafc;
          }
          .loading-spinner {
            width: 40px;
            height: 40px;
            border: 4px solid #e2e8f0;
            border-top: 4px solid #3b82f6;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          .loading-text {
            color: #64748b;
            font-size: 16px;
            font-weight: 500;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return <TrackingMainContent schedule={schedule} />;
};

// 메인 컨텐츠 컴포넌트
const TrackingMainContent: React.FC<{ schedule: Schedule }> = ({ schedule }) => {
  const router = useRouter();
  const [userName, setUserName] = useState<string>('');
  
  // 사용자 이름 로드
  useEffect(() => {
    const storedUserName = localStorage.getItem('userName');
    if (storedUserName) setUserName(storedUserName);
  }, []);

  const shootingTracker = useShootingTracker([schedule]);

  const {
    currentSchedule,
    trackingState,
    availableActions,
    executeAction,
    isLoading,
    showQRScanner,
    setShowQRScanner,
    showPhotoUpload,
    setShowPhotoUpload,
    handleQRCheck,
    handlePhotoUpload: originalHandlePhotoUpload
  } = shootingTracker;

  // 향상된 퇴근 사진 처리 함수
  const handleEnhancedCheckOut = async (imageFile: File) => {
    try {
      console.log('🏁 퇴근 처리 시작...');

      // 1. 워터마크 데이터 준비
      const now = new Date();
      const watermarkData = {
        date: now.toLocaleDateString('ko-KR'),
        time: now.toLocaleTimeString('ko-KR', { 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit' 
        }),
        name: `${userName} PD`,
        location: schedule.location
      };

      console.log('🏷️ 워터마크 데이터:', watermarkData);

      // 2. 워터마크 추가
      const watermarkedImage = await addWatermarkToImage(imageFile, watermarkData);
      console.log('✅ 워터마크 추가 완료');

      // 3. 파일명 생성
      const timestamp = now.getTime();
      const dateStr = now.toISOString().split('T')[0];
      const fileName = `퇴근_${dateStr}_${userName}_${timestamp}.jpg`;
      const folderName = `촬영퇴근사진_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      console.log('📁 파일명:', fileName);
      console.log('📂 폴더명:', folderName);

      // 4. 동시 업로드 (Supabase + Google Drive)
      console.log('☁️ 업로드 시작...');
      
      const [supabaseResult, driveResult] = await Promise.all([
        // Supabase Storage 업로드
        supabase.storage
          .from('shooting-photos')
          .upload(`checkout/${fileName}`, watermarkedImage),
        
        // Google Drive 업로드 (에러가 발생해도 전체 프로세스는 계속)
        uploadToGoogleDrive(watermarkedImage, fileName, folderName).catch(error => {
          console.warn('구글 드라이브 업로드 실패:', error);
          return null;
        })
      ]);

      console.log('📤 Supabase 업로드 결과:', supabaseResult);
      console.log('📤 Google Drive 업로드 결과:', driveResult);

      if (supabaseResult.error) {
        throw new Error(`Supabase 업로드 실패: ${supabaseResult.error.message}`);
      }

      // 5. 데이터베이스에 기록 저장
      const checkoutRecord = {
        schedule_id: parseInt(schedule.id),
        image_url: supabaseResult.data?.path || null,
        drive_file_id: driveResult?.id || null,
        checkout_time: now.toISOString(),
        shooter_name: userName,
        location: schedule.location
      };

      console.log('💾 DB 저장 데이터:', checkoutRecord);

      const { error: dbError } = await supabase
        .from('checkout_records')
        .insert(checkoutRecord);

      if (dbError) {
        console.warn('DB 저장 실패:', dbError);
      }

      // 6. 성공 메시지
      const message = driveResult 
        ? '✅ 퇴근 처리가 완료되었습니다!\n📁 구글 드라이브에도 저장되었습니다.'
        : '✅ 퇴근 처리가 완료되었습니다!\n📁 Supabase에 저장되었습니다.';
      
      alert(message);

      // 7. 원래 핸들러도 실행 (상태 업데이트용)
      await originalHandlePhotoUpload(imageFile);

      console.log('🎉 퇴근 처리 완료!');

    } catch (error) {
      console.error('❌ 퇴근 처리 실패:', error);
      alert('❌ 퇴근 처리 중 오류가 발생했습니다.\n다시 시도해주세요.');
    }
  };

  // 커스텀 액션 실행 함수
  const handleCustomAction = async (action: string) => {
    if (action === '퇴근') {
      // 퇴근 액션일 때는 향상된 사진 처리 활성화
      setShowPhotoUpload(true);
    } else {
      // 다른 액션들은 기본 처리
      await executeAction(action);
    }
  };

  // 커스텀 사진 업로드 핸들러
  const handleCustomPhotoUpload = async (imageFile: File) => {
    if (trackingState.currentState === 'COMPLETED') {
      // 퇴근 상태일 때는 향상된 처리
      await handleEnhancedCheckOut(imageFile);
    } else {
      // 다른 상태일 때는 기본 처리
      await originalHandlePhotoUpload(imageFile);
    }
  };

  // 상태 텍스트 변환
  const getStateText = (state: string): string => {
    const stateTexts: Record<string, string> = {
      'PENDING': '대기중',
      'TRAVELING': '이동중',
      'ARRIVED': '도착완료',
      'SHOOTING': '촬영중',
      'COMPLETED': '촬영완료',
      'FINISHED': '퇴근완료'
    };
    return stateTexts[state] || state;
  };

  return (
    <>
      {/* Google API 스크립트 동적 로드 */}
      <script src="https://apis.google.com/js/api.js" async defer></script>
      
      <div className="tracking-page">

        {/* 🔥 DB 권한 연동 표시 */}
        <div style={{
          position: 'fixed',
          top: '0',
          left: '0',
          right: '0',
          background: '#f0f9ff',
          border: '1px solid #0ea5e9',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          zIndex: 1001
        }}>
          <span style={{ fontSize: '14px' }}>🔐</span>
          <div style={{
            fontSize: '12px',
            color: '#0369a1',
            fontWeight: '500'
          }}>
            DB 권한 연동됨 ✅ - 촬영 트래킹 시스템
          </div>
        </div>

        <div className="tracking-container" style={{ marginTop: '40px' }}> {/* DB 권한 배너 공간 확보 */}
          {/* 헤더 */}
          <div className="header">
            <h1 className="page-title">촬영 진행 관리</h1>
            <div className="status-badge-container">
              <div className={`status-badge ${trackingState.currentState.toLowerCase()}`}>
                {getStateText(trackingState.currentState)}
              </div>
            </div>
          </div>

          {/* 스케줄 정보 카드 */}
          <div className="schedule-card">
            <div className="schedule-header">
              <h2 className="professor-name">{schedule.professor}</h2>
              <h3 className="course-name">{schedule.courseName}</h3>
            </div>
            
            <div className="schedule-details">
              <div className="detail-row">
                <span className="detail-label">시간</span>
                <span className="detail-value">{schedule.startTime} - {schedule.endTime}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">장소</span>
                <span className="detail-value">{schedule.location}</span>
              </div>
              {schedule.room && (
                <div className="detail-row">
                  <span className="detail-label">강의실</span>
                  <span className="detail-value">{schedule.room}</span>
                </div>
              )}
              {schedule.phone && (
                <div className="detail-row">
                  <span className="detail-label">연락처</span>
                  <span className="detail-value">{schedule.phone}</span>
                </div>
              )}
            </div>
          </div>

          {/* 진행 기록 */}
          {Object.keys(trackingState.timestamps).length > 0 && (
            <div className="progress-card">
              <h4 className="progress-title">촬영 진행 기록</h4>
              <div className="timestamp-list">
                {Object.entries(trackingState.timestamps).map(([action, timestamp]) => (
                  <div key={action} className="timestamp-item">
                    <div className="timestamp-action">{action.split('_')[0]}</div>
                    <div className="timestamp-time">{ShootingTracker.formatTime(timestamp)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 액션 버튼 */}
          <div className="action-section">
            {availableActions.length > 0 ? (
              availableActions.map((action: string) => (
                <button
                  key={action}
                  className={`action-button ${action.toLowerCase().replace('qr', 'qr-')} ${action === '퇴근' ? 'checkout-special' : ''}`}
                  onClick={() => handleCustomAction(action)}
                  disabled={isLoading}
                >
                  {isLoading ? '처리 중...' : action}
                  {action === '퇴근' && <span className="checkout-icon">📸</span>}
                </button>
              ))
            ) : trackingState.currentState === 'FINISHED' ? (
              <div className="completion-section">
                <div className="completion-message">🎉 모든 촬영이 완료되었습니다!</div>
                <div className="completion-submessage">수고하셨습니다!</div>
                <button
                  className="finish-button"
                  onClick={() => router.push('/shooter/ShooterDashboard')}
                >
                  대시보드로 돌아가기
                </button>
              </div>
            ) : (
              <div className="waiting-section">
                <div className="waiting-message">다음 액션을 기다리는 중...</div>
              </div>
            )}
          </div>

          {/* 뒤로가기 버튼 */}
          <button className="back-button" onClick={() => router.back()}>
            뒤로가기
          </button>
        </div>

        {/* QR 스캐너 모달 */}
        <QRScanner
          isOpen={showQRScanner}
          onScan={handleQRCheck}
          onClose={() => setShowQRScanner(false)}
          expectedLocation={schedule.location}
        />

        {/* 사진 업로드 모달 */}
        <PhotoUpload
          isOpen={showPhotoUpload}
          onUpload={handleCustomPhotoUpload}
          onClose={() => setShowPhotoUpload(false)}
          isLoading={isLoading}
        />

        <style jsx>{`
          .tracking-page {
            min-height: 100vh;
            background: #f8fafc;
            padding: 20px 16px;
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
          }

          .tracking-container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 16px;
            box-shadow: 0 4px 24px rgba(0,0,0,0.08);
            padding: 32px 28px;
          }

          .header {
            text-align: center;
            margin-bottom: 32px;
          }

          .page-title {
            font-size: 24px;
            font-weight: 700;
            color: #1a202c;
            margin: 0 0 16px 0;
          }

          .status-badge-container {
            display: flex;
            justify-content: center;
          }

          .status-badge {
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
            color: white;
            background: #6b7280;
          }

          .status-badge.pending { background: #f59e0b; }
          .status-badge.traveling { background: #3b82f6; }
          .status-badge.arrived { background: #10b981; }
          .status-badge.shooting { background: #ef4444; }
          .status-badge.completed { background: #8b5cf6; }
          .status-badge.finished { background: #059669; }

          .schedule-card {
            background: #f8fafc;
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 24px;
          }

          .schedule-header {
            text-align: center;
            margin-bottom: 20px;
          }

          .professor-name {
            font-size: 20px;
            font-weight: 700;
            color: #1a202c;
            margin: 0 0 8px 0;
          }

          .course-name {
            font-size: 16px;
            color: #64748b;
            margin: 0;
          }

          .schedule-details {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .detail-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .detail-label {
            font-weight: 600;
            color: #374151;
          }

          .detail-value {
            color: #1f2937;
          }

          .progress-card {
            background: #f0f9ff;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 24px;
          }

          .progress-title {
            font-size: 16px;
            font-weight: 600;
            color: #1e40af;
            margin: 0 0 16px 0;
          }

          .timestamp-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .timestamp-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            background: white;
            border-radius: 8px;
          }

          .timestamp-action {
            font-weight: 500;
            color: #1e40af;
          }

          .timestamp-time {
            color: #64748b;
            font-size: 14px;
          }

          .action-section {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-bottom: 32px;
          }

          .action-button {
            padding: 16px;
            border: none;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            color: white;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
          }

          .action-button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .action-button.출발 { background: linear-gradient(135deg, #10b981, #059669); }
          .action-button.qr-체크 { background: linear-gradient(135deg, #3b82f6, #1e40af); }
          .action-button.시작 { background: linear-gradient(135deg, #8b5cf6, #7c3aed); }
          .action-button.종료 { background: linear-gradient(135deg, #ef4444, #dc2626); }
          .action-button.퇴근 { 
            background: linear-gradient(135deg, #059669, #047857);
            box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);
          }

          .checkout-special {
            border: 2px solid #10b981;
            box-shadow: 0 0 20px rgba(16, 185, 129, 0.3);
          }

          .checkout-icon {
            font-size: 18px;
            animation: pulse 2s infinite;
          }

          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
          }

          .action-button:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(0,0,0,0.15);
          }

          .completion-section, .waiting-section {
            text-align: center;
            padding: 32px 20px;
          }

          .completion-message {
            font-size: 18px;
            font-weight: 600;
            color: #059669;
            margin-bottom: 8px;
          }

          .completion-submessage {
            color: #64748b;
            margin-bottom: 24px;
          }

          .waiting-message {
            color: #64748b;
            font-style: italic;
          }

          .finish-button {
            background: linear-gradient(135deg, #3b82f6, #1e40af);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .finish-button:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
          }

          .back-button {
            background: #f3f4f6;
            color: #374151;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s ease;
            display: block;
            margin: 0 auto;
          }

          .back-button:hover {
            background: #e5e7eb;
          }
        `}</style>
      </div>
    </>
  );
};

export default TrackingPage;
