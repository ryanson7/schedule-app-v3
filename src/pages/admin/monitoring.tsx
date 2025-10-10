"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import MonitoringDashboard from '../../components/admin/MonitoringDashboard';
import NotificationCenter from '../../components/notifications/NotificationCenter';
import { User } from '../../types/shooter';
import { supabase } from '../../utils/supabaseClient';

export default function AdminMonitoringPage() {
  const router = useRouter();
  const [adminInfo, setAdminInfo] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeView, setActiveView] = useState<'monitoring' | 'notifications' | 'settings'>('monitoring');
  const [systemStats, setSystemStats] = useState({
    total_users: 0,
    active_shooters: 0,
    total_schedules_today: 0,
    pending_approvals: 0,
    system_health: 'good' as 'good' | 'warning' | 'error'
  });

  useEffect(() => {
    checkAdminAuth();
  }, []);

  const checkAdminAuth = async () => {
    try {
      // 현재 로그인한 admin 정보 확인
      const userId = localStorage.getItem('userId');
      const userRole = localStorage.getItem('userRole');

      if (!userId || userRole !== 'admin') {
        router.push('/login');
        return;
      }

      // Admin 정보 조회
      const { data: admin, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .eq('role', 'admin')
        .eq('deleted_at', null)
        .single();

      if (error || !admin) {
        console.error('Admin 정보 조회 오류:', error);
        router.push('/login');
        return;
      }

      setAdminInfo(admin);
      await loadSystemStats();

    } catch (error) {
      console.error('인증 확인 오류:', error);
      router.push('/login');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSystemStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      // 전체 사용자 수
      const { count: totalUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('deleted_at', null);

      // 활성 shooter 수
      const { count: activeShooters } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'shooter')
        .eq('deleted_at', null);

      // 오늘 총 스케줄 수
      const { count: totalSchedulesToday } = await supabase
        .from('schedules')
        .select('*', { count: 'exact', head: true })
        .eq('shoot_date', today)
        .eq('is_active', true);

      // 승인 대기 중인 스케줄 수
      const { count: pendingApprovals } = await supabase
        .from('schedules')
        .select('*', { count: 'exact', head: true })
        .eq('approval_status', 'pending')
        .eq('is_active', true);

      // 시스템 상태 체크
      let systemHealth: 'good' | 'warning' | 'error' = 'good';
      
      // 지연된 액션이 많으면 경고
      const { count: overdueActions } = await supabase
        .from('shooter_action_deadlines')
        .select('*', { count: 'exact', head: true })
        .lt('deadline_time', new Date().toISOString())
        .eq('is_completed', false);

      if (overdueActions && overdueActions > 10) {
        systemHealth = 'warning';
      }
      if (overdueActions && overdueActions > 20) {
        systemHealth = 'error';
      }

      setSystemStats({
        total_users: totalUsers || 0,
        active_shooters: activeShooters || 0,
        total_schedules_today: totalSchedulesToday || 0,
        pending_approvals: pendingApprovals || 0,
        system_health: systemHealth
      });

    } catch (error) {
      console.error('시스템 통계 조회 오류:', error);
    }
  };

  const getSystemHealthColor = (health: string): string => {
    switch (health) {
      case 'good': return '#10b981';
      case 'warning': return '#f59e0b';
      case 'error': return '#ef4444';
      default: return '#64748b';
    }
  };

  const getSystemHealthText = (health: string): string => {
    switch (health) {
      case 'good': return '정상';
      case 'warning': return '주의';
      case 'error': return '오류';
      default: return '알 수 없음';
    }
  };

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: '#f8fafc',
        gap: '16px'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #3b82f6',
          borderTop: '4px solid transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <div style={{
          fontSize: '18px',
          color: '#64748b',
          fontWeight: '500'
        }}>
          관리자 대시보드를 준비하는 중...
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

  if (!adminInfo) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: '#f8fafc',
        gap: '20px'
      }}>
        <div style={{
          fontSize: '24px',
          color: '#ef4444',
          fontWeight: '600'
        }}>
          관리자 권한이 필요합니다
        </div>
        <div style={{
          fontSize: '16px',
          color: '#64748b',
          textAlign: 'center',
          lineHeight: 1.5
        }}>
          관리자 계정으로 로그인 후<br/>
          다시 시도해주세요.
        </div>
        <button
          onClick={() => router.push('/login')}
          style={{
            padding: '12px 24px',
            background: '#3b82f6',
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

  return (
    <div style={{
      background: '#f8fafc',
      minHeight: '100vh',
      fontFamily: 'inherit'
    }}>
      {/* 관리자 헤더 */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
        color: 'white',
        padding: '20px 24px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <div>
            <h1 style={{
              margin: '0 0 4px 0',
              fontSize: '24px',
              fontWeight: '600'
            }}>
              관리자 모니터링 센터
            </h1>
            <p style={{
              margin: 0,
              fontSize: '16px',
              opacity: 0.9
            }}>
              안녕하세요, {adminInfo.name} 관리자님
            </p>
          </div>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}>
            {/* 시스템 상태 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(255, 255, 255, 0.1)',
              padding: '8px 12px',
              borderRadius: '20px'
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: getSystemHealthColor(systemStats.system_health)
              }} />
              <span style={{ fontSize: '14px', fontWeight: '500' }}>
                시스템 {getSystemHealthText(systemStats.system_health)}
              </span>
            </div>

            {/* 현재 시간 */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.1)',
              padding: '8px 12px',
              borderRadius: '20px',
              fontSize: '14px',
              fontWeight: '500'
            }}>
              {new Date().toLocaleString('ko-KR', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          </div>
        </div>

        {/* 빠른 통계 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '12px',
          marginBottom: '16px'
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.1)',
            padding: '12px',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>
              {systemStats.total_users}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>전체 사용자</div>
          </div>
          
          <div style={{
            background: 'rgba(255, 255, 255, 0.1)',
            padding: '12px',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>
              {systemStats.active_shooters}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>활성 Shooter</div>
          </div>
          
          <div style={{
            background: 'rgba(255, 255, 255, 0.1)',
            padding: '12px',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>
              {systemStats.total_schedules_today}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>오늘 스케줄</div>
          </div>
          
          <div style={{
            background: systemStats.pending_approvals > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.1)',
            padding: '12px',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ 
              fontSize: '20px', 
              fontWeight: '700', 
              marginBottom: '4px',
              color: systemStats.pending_approvals > 0 ? '#fca5a5' : 'white'
            }}>
              {systemStats.pending_approvals}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>승인 대기</div>
          </div>
        </div>

        {/* 네비게이션 탭 */}
        <div style={{
          display: 'flex',
          gap: '4px',
          background: 'rgba(255, 255, 255, 0.1)',
          padding: '4px',
          borderRadius: '8px'
        }}>
          {[
            { key: 'monitoring', label: '실시간 모니터링', icon: '📊' },
            { key: 'notifications', label: '알림 관리', icon: '🔔' },
            { key: 'settings', label: '시스템 설정', icon: '⚙️' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveView(tab.key as any)}
              style={{
                flex: 1,
                padding: '10px 16px',
                background: activeView === tab.key ? 'white' : 'transparent',
                color: activeView === tab.key ? '#1e293b' : 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div style={{ padding: '24px' }}>
        {activeView === 'monitoring' && (
          <MonitoringDashboard />
        )}

        {activeView === 'notifications' && (
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h2 style={{
                fontSize: '20px',
                fontWeight: '600',
                color: '#1e293b',
                margin: 0
              }}>
                알림 관리 센터
              </h2>
              
              <button
                onClick={() => {
                  // 전체 알림 발송 기능
                  alert('전체 알림 발송 기능은 개발 중입니다.');
                }}
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
                전체 알림 발송
              </button>
            </div>
            
            <NotificationCenter
              userId={adminInfo.id}
              userRole={adminInfo.role}
              maxNotifications={100}
              autoMarkRead={false}
            />
          </div>
        )}

        {activeView === 'settings' && (
          <div>
            <h2 style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#1e293b',
              marginBottom: '20px'
            }}>
              시스템 설정
            </h2>
            
            <div style={{
              display: 'grid',
              gap: '20px'
            }}>
              {/* 알림 설정 */}
              <div style={{
                background: 'white',
                padding: '20px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                <h3 style={{
                  margin: '0 0 12px 0',
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#1e293b'
                }}>
                  알림 설정
                </h3>
                <div style={{ color: '#64748b', fontSize: '14px' }}>
                  시스템 알림 및 데드라인 설정을 관리합니다.
                </div>
                <button
                  onClick={() => alert('알림 설정 기능은 개발 중입니다.')}
                  style={{
                    marginTop: '12px',
                    padding: '8px 16px',
                    background: '#f3f4f6',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  설정 관리
                </button>
              </div>

              {/* 사용자 관리 */}
              <div style={{
                background: 'white',
                padding: '20px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                <h3 style={{
                  margin: '0 0 12px 0',
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#1e293b'
                }}>
                  사용자 관리
                </h3>
                <div style={{ color: '#64748b', fontSize: '14px' }}>
                  Shooter, 교수, 매니저 계정을 관리합니다.
                </div>
                <button
                  onClick={() => alert('사용자 관리 기능은 개발 중입니다.')}
                  style={{
                    marginTop: '12px',
                    padding: '8px 16px',
                    background: '#f3f4f6',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  사용자 관리
                </button>
              </div>

              {/* 시스템 백업 */}
              <div style={{
                background: 'white',
                padding: '20px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                <h3 style={{
                  margin: '0 0 12px 0',
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#1e293b'
                }}>
                  시스템 백업
                </h3>
                <div style={{ color: '#64748b', fontSize: '14px' }}>
                  데이터베이스 백업 및 복구를 관리합니다.
                </div>
                <button
                  onClick={() => alert('백업 기능은 개발 중입니다.')}
                  style={{
                    marginTop: '12px',
                    padding: '8px 16px',
                    background: '#f3f4f6',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  백업 관리
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Next.js 정적 생성 설정
export async function getStaticProps() {
  return {
    props: {
      title: '관리자 모니터링',
      description: '관리자 전용 실시간 모니터링 및 시스템 관리'
    }
  };
}
