// src/pages/admin/qr-locations.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'next/router';
import QRCode from 'qrcode';

interface MainLocation {
  id: number;
  name: string;
  location_type?: string;
  is_active: boolean;
}

interface QRCodeData {
  locationId: number;
  locationName: string;
  timestamp: string;
  qrValue: string;
  qrImage: string; // ✅ QR 이미지 데이터 추가
}

const QRLocationsPage: React.FC = () => {
  const { user, userData } = useAuth();
  const router = useRouter();
  const [locations, setLocations] = useState<MainLocation[]>([]);
  const [qrCodes, setQrCodes] = useState<QRCodeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // ✅ QR 코드 값 생성 함수 (60초마다 변경)
  const generateQRValue = (locationId: number, timestamp: string): string => {
    const minute = Math.floor(new Date(timestamp).getTime() / (60 * 1000));
    return `LOCATION_${locationId}_${minute}`;
  };

  // ✅ QR 코드 이미지 생성
  const generateQRImage = async (qrValue: string): Promise<string> => {
    try {
      return await QRCode.toDataURL(qrValue, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      });
    } catch (error) {
      console.error('QR 코드 생성 실패:', error);
      return '';
    }
  };

  // ✅ main_locations 조회
  const loadMainLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('main_locations')
        .select('id, name, location_type, is_active')
        .eq('is_active', true)
        .order('id');

      if (error) throw error;

      console.log('📍 main_locations 조회:', data?.length, '개');
      setLocations(data || []);
      
      // QR 코드 초기 생성
      if (data) {
        await generateQRCodes(data);
      }
    } catch (error) {
      console.error('❌ main_locations 조회 실패:', error);
      setLocations([]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ QR 코드들 생성 (실제 이미지 생성)
  const generateQRCodes = async (locationList: MainLocation[]) => {
    const now = new Date();
    const timestamp = now.toISOString();
    
    console.log('🔄 QR 코드 생성 시작:', locationList.length, '개');
    
    const qrPromises = locationList.map(async (location) => {
      const qrValue = generateQRValue(location.id, timestamp);
      const qrImage = await generateQRImage(qrValue);
      
      return {
        locationId: location.id,
        locationName: location.name,
        timestamp,
        qrValue,
        qrImage
      };
    });

    const newQRCodes = await Promise.all(qrPromises);
    setQrCodes(newQRCodes);
    console.log('✅ QR 코드 갱신 완료:', newQRCodes.length, '개');
  };

  // ✅ 60초마다 QR 코드 갱신
  useEffect(() => {
    const interval = setInterval(async () => {
      setCurrentTime(new Date());
      if (locations.length > 0) {
        await generateQRCodes(locations);
      }
    }, 60000); // 60초

    return () => clearInterval(interval);
  }, [locations]);

  // ✅ 1초마다 시계 갱신
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(clockInterval);
  }, []);

  // ✅ 페이지 로드 시 데이터 조회
  useEffect(() => {
    if (user || userData) {
      loadMainLocations();
    }
  }, [user, userData]);

  // ✅ 수동 새로고침 함수
  const handleRefresh = async () => {
    if (locations.length > 0) {
      console.log('🔄 수동 QR 새로고침 시작');
      await generateQRCodes(locations);
    }
  };

  // 권한 체크
  if (!user && !userData) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#f8fafc'
      }}>
        <div style={{ textAlign: 'center', color: '#6b7280' }}>
          로그인이 필요합니다.
        </div>
      </div>
    );
  }

  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      background: '#f8fafc',
      minHeight: '100vh',
      padding: '20px',
      display: 'flex',
      justifyContent: 'center'
    }}>
      {/* ✅ 메인 컨테이너 - 800px 통일 */}
      <div style={{
        width: '100%',
        maxWidth: '800px',
        margin: '0 auto'
      }}>
        
        {/* 헤더 */}
        <div style={{
          background: 'white',
          padding: '24px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          marginBottom: '20px',
          textAlign: 'center'
        }}>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 'bold',
            margin: '0 0 8px 0',
            color: '#1e293b'
          }}>
            📱 QR 코드 관리
          </h1>
          <p style={{
            fontSize: '16px',
            color: '#64748b',
            margin: '0 0 16px 0'
          }}>
            촬영 위치별 QR 코드 (60초마다 자동 갱신)
          </p>
          
          {/* 현재 시간 + 새로고침 버튼 */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '16px'
          }}>
            <div style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#3b82f6',
              fontVariantNumeric: 'tabular-nums'
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
            
            <button
              onClick={handleRefresh}
              disabled={loading}
              style={{
                padding: '8px 16px',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1
              }}
            >
              🔄 새로고침
            </button>
          </div>

          {/* 다음 갱신 시간 */}
          <div style={{
            fontSize: '14px',
            color: '#6b7280'
          }}>
            다음 자동 갱신: {new Date(Math.ceil(currentTime.getTime() / 60000) * 60000).toLocaleTimeString('ko-KR')}
          </div>
        </div>

        {/* 로딩 상태 */}
        {loading && (
          <div style={{
            background: 'white',
            padding: '40px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              border: '3px solid #e5e7eb',
              borderTop: '3px solid #3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px'
            }}></div>
            <div style={{ color: '#6b7280' }}>QR 코드 생성 중...</div>
          </div>
        )}

        {/* QR 코드 그리드 */}
        {!loading && qrCodes.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '20px'
          }}>
            {qrCodes.map((qrData) => (
              <div
                key={qrData.locationId}
                style={{
                  background: 'white',
                  padding: '24px',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  textAlign: 'center',
                  border: '2px solid #e2e8f0'
                }}
              >
                {/* 위치명 */}
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  margin: '0 0 16px 0',
                  color: '#1e293b'
                }}>
                  📍 {qrData.locationName}
                </h3>

                {/* ✅ 실제 QR 코드 이미지 */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  marginBottom: '16px'
                }}>
                  {qrData.qrImage ? (
                    <img 
                      src={qrData.qrImage} 
                      alt={`QR 코드: ${qrData.locationName}`}
                      style={{
                        width: '200px',
                        height: '200px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '8px'
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '200px',
                      height: '200px',
                      background: '#f3f4f6',
                      border: '2px dashed #d1d5db',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#6b7280'
                    }}>
                      QR 생성 중...
                    </div>
                  )}
                </div>

                {/* QR 값 표시 */}
                <div style={{
                  background: '#f1f5f9',
                  padding: '12px',
                  borderRadius: '8px',
                  marginBottom: '12px'
                }}>
                  <div style={{
                    fontSize: '12px',
                    color: '#64748b',
                    marginBottom: '4px'
                  }}>
                    QR 값:
                  </div>
                  <code style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#1e293b',
                    fontFamily: 'Monaco, Consolas, monospace',
                    wordBreak: 'break-all'
                  }}>
                    {qrData.qrValue}
                  </code>
                </div>

                {/* 갱신 시간 */}
                <div style={{
                  fontSize: '12px',
                  color: '#6b7280'
                }}>
                  마지막 갱신: {new Date(qrData.timestamp).toLocaleTimeString('ko-KR')}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 데이터 없음 상태 */}
        {!loading && qrCodes.length === 0 && (
          <div style={{
            background: 'white',
            padding: '40px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📍</div>
            <div style={{ fontSize: '18px', color: '#374151', marginBottom: '8px' }}>
              활성화된 위치가 없습니다
            </div>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>
              main_locations 테이블에서 활성화된 위치를 확인해주세요
            </div>
          </div>
        )}

        {/* 안내 메시지 */}
        <div style={{
          background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
          padding: '20px',
          borderRadius: '12px',
          marginTop: '20px'
        }}>
          <h4 style={{
            margin: '0 0 12px 0',
            color: '#1e40af',
            fontSize: '16px',
            fontWeight: '600'
          }}>
            📋 사용 안내
          </h4>
          <ul style={{
            margin: '0',
            paddingLeft: '20px',
            color: '#1e40af',
            fontSize: '14px',
            lineHeight: '1.6'
          }}>
            <li>각 촬영 위치마다 고유한 QR 코드가 생성됩니다</li>
            <li>QR 코드는 <strong>60초마다 자동으로 갱신</strong>됩니다</li>
            <li>촬영자는 해당 위치의 QR 코드를 스캔하여 도착 확인</li>
            <li>QR 값은 위치 ID와 시간 기반으로 생성되어 보안이 유지됩니다</li>
            <li>수동 새로고침 버튼으로 즉시 갱신 가능합니다</li>
          </ul>
        </div>

        {/* 하단 버튼 */}
        <div style={{
          marginTop: '20px',
          textAlign: 'center'
        }}>
          <button
            onClick={() => router.push('/admin')}
            style={{
              padding: '12px 24px',
              background: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#4b5563';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#6b7280';
            }}
          >
            관리자 페이지로 돌아가기
          </button>
        </div>

        {/* CSS 애니메이션 */}
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          @media (max-width: 768px) {
            div[style*="gridTemplateColumns"] {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>

      </div>
    </div>
  );
};

export default QRLocationsPage;
