// src/pages/qr/location/[uuid].tsx (간격 줄인 버전)
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../../utils/supabaseClient';
import QRCode from 'qrcode';
import Head from 'next/head';

interface MainLocation {
  id: number;
  name: string;
  is_active: boolean;
  qr_uuid: string;
}

interface QRCodeData {
  locationId: number;
  locationName: string;
  timestamp: string;
  qrValue: string;
  qrImage: string;
  uuid: string;
}

const LocationQRPage: React.FC = () => {
  const router = useRouter();
  const { uuid } = router.query;
  
  const [location, setLocation] = useState<MainLocation | null>(null);
  const [qrCode, setQrCode] = useState<QRCodeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [error, setError] = useState<string>('');

  // ✅ 보안 강화된 QR 코드 값 생성
  const generateSecureQRValue = (locId: number, uuid: string, timestamp: string): string => {
    const minute = Math.floor(new Date(timestamp).getTime() / (60 * 1000));
    const hash = btoa(`${uuid.slice(0, 8)}_${locId}_${minute}`).slice(0, 12);
    return `SECURE_${hash}_${minute}`;
  };

  // ✅ QR 코드 이미지 생성
  const generateQRImage = async (qrValue: string): Promise<string> => {
    try {
      return await QRCode.toDataURL(qrValue, {
        width: 320,
        margin: 3,
        color: {
          dark: '#1a1a1a',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'H'
      });
    } catch (error) {
      console.error('QR 코드 생성 실패:', error);
      return '';
    }
  };

  // ✅ UUID로 위치 정보 로드
  const loadLocationByUUID = async (qrUuid: string) => {
    try {
      if (!qrUuid) {
        setError('UUID가 없습니다.');
        return;
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(qrUuid)) {
        setError('잘못된 QR 코드 형식입니다.');
        return;
      }

      const { data, error } = await supabase
        .from('main_locations')
        .select('id, name, is_active, qr_uuid')
        .eq('qr_uuid', qrUuid)
        .eq('is_active', true)
        .single();

      if (error) throw error;
      if (!data) {
        setError('유효하지 않은 QR 코드입니다.');
        return;
      }

      setLocation(data);
      await generateQRCode(data);
      
    } catch (error) {
      console.error('❌ 위치 정보 로드 실패:', error);
      setError('QR 코드를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  // ✅ 보안 QR 코드 생성
  const generateQRCode = async (locationData: MainLocation) => {
    const now = new Date();
    const timestamp = now.toISOString();
    const qrValue = generateSecureQRValue(locationData.id, locationData.qr_uuid, timestamp);
    const qrImage = await generateQRImage(qrValue);
    
    setQrCode({
      locationId: locationData.id,
      locationName: locationData.name,
      timestamp,
      qrValue,
      qrImage,
      uuid: locationData.qr_uuid
    });
  };

  // ✅ 촬영 관리 페이지 새 창으로 열기
  const openShooterDashboard = () => {
    if (!location) return;
    const dashboardURL = `/shooter/ShooterDashboard`;
    window.open(dashboardURL, '_blank', 'width=1400,height=900,scrollbars=yes,resizable=yes');
  };

  // ✅ 60초마다 QR 코드 갱신
  useEffect(() => {
    if (!location) return;
    const interval = setInterval(async () => {
      setCurrentTime(new Date());
      await generateQRCode(location);
    }, 60000);
    return () => clearInterval(interval);
  }, [location]);

  // ✅ 1초마다 시계 갱신
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // ✅ 페이지 로드 시 UUID로 위치 정보 로드
  useEffect(() => {
    if (uuid && typeof uuid === 'string') {
      loadLocationByUUID(uuid);
    }
  }, [uuid, router.isReady]);

  // 로딩 상태
  if (loading) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        background: '#ffffff', fontFamily: "'Inter', -apple-system, sans-serif"
      }}>
        <div style={{ fontSize: '28px', color: '#6b7280', fontWeight: '200', letterSpacing: '0.5px' }}>
          QR 코드 준비 중...
        </div>
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        background: '#ffffff', fontFamily: "'Inter', -apple-system, sans-serif"
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '28px', color: '#ef4444', marginBottom: '24px',
            fontWeight: '300', letterSpacing: '0.5px'
          }}>
            {error}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '16px 32px', background: '#f8fafc', border: '1px solid #e2e8f0',
              borderRadius: '12px', fontSize: '16px', cursor: 'pointer',
              fontWeight: '400', fontFamily: "'Inter', sans-serif", color: '#374151'
            }}
          >
            새로고침
          </button>
        </div>
      </div>
    );
  }

  // ✅ 작은 스페이서 컴포넌트
  const Spacer = ({ height }: { height: number }) => (
    <div style={{ height: `${height}px`, flexShrink: 0 }} />
  );

  return (
    <>
      {/* ✅ Head 설정 */}
      <Head>
        <title>{location?.name} - 보안 QR 코드</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;400;500;600;700&family=JetBrains+Mono:wght@200;300;400;500;600&display=swap');
          
          * {
            margin: 0 !important;
            padding: 0 !important;
            box-sizing: border-box !important;
          }
          
          html, body {
            width: 100% !important;
            height: 100% !important;
            overflow: hidden !important;
            background: #ffffff !important;
            font-family: 'Inter', -apple-system, sans-serif !important;
          }
          
          nav, header, aside, .menu, .navigation, .sidebar, .header, .nav-bar {
            display: none !important;
            visibility: hidden !important;
          }
          
          [class*="layout"], [id*="layout"], [class*="wrapper"] {
            all: unset !important;
          }

          .shooting-button:hover {
            transform: translateY(-5px) scale(1.04) !important;
            box-shadow: 0 24px 48px rgba(59, 130, 246, 0.45) !important;
            background: linear-gradient(135deg, #2563eb, #1e40af) !important;
            transition: all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
          }

          .shooting-button:active {
            transform: translateY(-2px) scale(1.02) !important;
          }

          .shooting-button {
            transition: all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
          }
        `}</style>
      </Head>

      {/* ✅ 컴팩트한 간격의 QR 페이지 */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: '#ffffff',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        color: '#1f2937',
        overflow: 'hidden',
        zIndex: 9999,
        padding: '40px'
      }}>
        
        {/* ✅ 1. 장소명 */}
        <div style={{ 
          textAlign: 'center',
          flexShrink: 0
        }}>
          <h1 style={{
            fontSize: '64px',
            fontWeight: '100',
            margin: 0,
            color: '#111827',
            letterSpacing: '-1.2px',
            fontFamily: "'Inter', sans-serif",
            lineHeight: 1.1
          }}>
            {location?.name}
          </h1>
        </div>

        {/* ✅ 줄인 간격 1 */}
        <Spacer height={10} />

        {/* ✅ 2. 날짜 시간 (박스 제거) */}
        <div style={{
          textAlign: 'center',
          flexShrink: 0
        }}>
          <div style={{
            fontSize: '32px',
            fontWeight: '300',
            color: '#4b5563',
            fontFamily: "'JetBrains Mono', 'Monaco', monospace",
            letterSpacing: '1.2px'
          }}>
            {currentTime.toLocaleString('ko-KR', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false
            })}
          </div>
        </div>

        {/* ✅ 줄인 간격 2 */}
        <Spacer height={30} />

        {/* ✅ 3. QR 코드 */}
        <div style={{
          textAlign: 'center',
          flexShrink: 0
        }}>
          {qrCode?.qrImage ? (
            <div style={{
              display: 'inline-block',
              padding: '50px',
              background: '#ffffff',
              borderRadius: '48px',
              boxShadow: '0 32px 80px rgba(0, 0, 0, 0.15)',
              border: '1px solid #f1f5f9'
            }}>
              <img 
                src={qrCode.qrImage} 
                alt={`Secure QR Code: ${qrCode.locationName}`}
                style={{
                  width: '320px',
                  height: '320px',
                  borderRadius: '32px'
                }}
              />
            </div>
          ) : (
            <div style={{
              width: '320px',
              height: '320px',
              background: '#fafafa',
              border: '2px dashed #d1d5db',
              borderRadius: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9ca3af',
              fontSize: '18px',
              fontWeight: '300',
              fontFamily: "'Inter', sans-serif"
            }}>
              보안 QR 생성 중...
            </div>
          )}
        </div>

        {/* ✅ 줄인 간격 3 */}
        <Spacer height={30} />

        {/* ✅ 4. 안내문 (박스 제거) */}
        <div style={{
          textAlign: 'center',
          flexShrink: 0
        }}>
          <div style={{
            fontSize: '24px',
            color: '#475569',
            fontWeight: '400',
            fontFamily: "'Inter', sans-serif",
            letterSpacing: '0.4px',
            lineHeight: 1.6
          }}>
            촬영자는 이 QR 코드를 스캔하여 도착 확인을 진행하세요
          </div>
        </div>

        {/* ✅ 줄인 간격 4 */}
        <Spacer height={30} />

        {/* ✅ 5. 촬영 시작 버튼 */}
        <div style={{ 
          textAlign: 'center',
          flexShrink: 0
        }}>
          <button
            onClick={openShooterDashboard}
            className="shooting-button"
            style={{
              padding: '36px 84px',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              border: 'none',
              borderRadius: '40px',
              fontSize: '24px',
              fontWeight: '600',
              cursor: 'pointer',
              fontFamily: "'Inter', sans-serif",
              color: '#ffffff',
              boxShadow: '0 20px 50px rgba(59, 130, 246, 0.4)',
              transition: 'all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              letterSpacing: '0.8px',
              minWidth: '420px',
              textAlign: 'center',
              lineHeight: 1.4
            }}
          >
            촬영 관리 시작
          </button>
        </div>

        {/* ✅ 개발용 디버그 정보 */}
        {process.env.NODE_ENV === 'development' && (
          <div style={{
            position: 'absolute',
            bottom: '30px',
            left: '30px',
            fontSize: '12px',
            color: '#9ca3af',
            fontFamily: 'monospace',
            background: 'rgba(248, 250, 252, 0.9)',
            padding: '10px 16px',
            borderRadius: '12px',
            border: '1px solid #e2e8f0'
          }}>
            UUID: {location?.qr_uuid?.slice(0, 8)}... → /shooter/ShooterDashboard
          </div>
        )}

      </div>
    </>
  );
};

// ✅ Layout 적용 안 함
LocationQRPage.getLayout = (page: React.ReactElement) => {
  return page;
};

export default LocationQRPage;
