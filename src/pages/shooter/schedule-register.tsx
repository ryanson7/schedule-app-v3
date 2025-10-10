"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import WeeklyScheduleForm from '../../components/shooter/WeeklyScheduleForm';
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

export default function ShooterScheduleRegisterPage() {
  const router = useRouter();
  
  // 🔥 DB 연동 권한 체크
  const { hasPermission, loading: permissionLoading } = usePermission('/shooter/schedule-register');
  
  const [shooterInfo, setShooterInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [recentSchedules, setRecentSchedules] = useState<any[]>([]);

  useEffect(() => {
    // 🔥 권한 확인 후 shooter 인증 체크
    if (!permissionLoading) {
      if (!hasPermission) {
        alert('Shooter 스케줄 등록 페이지 접근 권한이 없습니다.');
        router.push('/login');
        return;
      } else {
        checkShooterAuth();
      }
    }
  }, [hasPermission, permissionLoading, router]);

  const checkShooterAuth = async () => {
    try {
      // 현재 로그인한 shooter 정보 확인
      const shooterId = localStorage.getItem('shooterId');
      const userRole = localStorage.getItem('userRole');

      if (!shooterId || userRole !== 'shooter') {
        router.push('/login');
        return;
      }

      // Shooter 정보 조회
      const { data: shooter, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', shooterId)
        .eq('role', 'shooter')
        .eq('deleted_at', null)
        .single();

      if (error || !shooter) {
        console.error('Shooter 정보 조회 오류:', error);
        router.push('/login');
        return;
      }

      setShooterInfo(shooter);
      await loadRecentSchedules(parseInt(shooterId));

    } catch (error) {
      console.error('인증 확인 오류:', error);
      router.push('/login');
    } finally {
      setIsLoading(false);
    }
  };

  const loadRecentSchedules = async (shooterId: number) => {
    try {
      // 최근 4주간의 등록된 스케줄 조회
      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
      
      const { data, error } = await supabase
        .from('shooter_weekly_availability')
        .select(`
          week_start_date,
          day_of_week,
          start_time,
          end_time,
          is_available
        `)
        .eq('shooter_id', shooterId)
        .gte('week_start_date', fourWeeksAgo.toISOString().split('T')[0])
        .order('week_start_date', { ascending: false })
        .order('day_of_week')
        .order('start_time');

      if (!error && data) {
        // 주별로 그룹화
        const groupedByWeek = data.reduce((acc, schedule) => {
          const week = schedule.week_start_date;
          if (!acc[week]) {
            acc[week] = [];
          }
          acc[week].push(schedule);
          return acc;
        }, {} as { [key: string]: any[] });

        const recentWeeks = Object.entries(groupedByWeek)
          .map(([week, schedules]) => ({
            week_start: week,
            schedules: schedules,
            total_hours: schedules.reduce((sum, s) => {
              if (!s.is_available) return sum;
              const start = new Date(`2000-01-01T${s.start_time}`);
              const end = new Date(`2000-01-01T${s.end_time}`);
              return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
            }, 0)
          }))
          .slice(0, 4);

        setRecentSchedules(recentWeeks);
      }
    } catch (error) {
      console.error('최근 스케줄 조회 오류:', error);
    }
  };

  const handleScheduleSubmit = (success: boolean) => {
    if (success && shooterInfo) {
      // 성공 시 최근 스케줄 새로고침
      loadRecentSchedules(shooterInfo.id);
    }
  };

  const formatWeekRange = (weekStart: string) => {
    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    
    return `${start.getMonth() + 1}/${start.getDate()} ~ ${end.getMonth() + 1}/${end.getDate()}`;
  };

  const getShooterTypeText = (type: string): string => {
    const types = {
      'employee': '직원',
      'dispatch': '파견직',
      'freelance': '위탁직'
    };
    return types[type as keyof typeof types] || '미분류';
  };

  // 🔥 권한 확인 중 로딩
  if (permissionLoading) {
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
          Shooter 스케줄 등록 페이지 접근 권한을 확인하고 있습니다.
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
        height: '100vh',
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
          Shooter 스케줄 등록 페이지에 접근할 권한이 없습니다.<br/>
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
          스케줄 등록 페이지를 준비하는 중...
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

  if (!shooterInfo) {
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
          접근 권한이 없습니다
        </div>
        <div style={{
          fontSize: '16px',
          color: '#64748b',
          textAlign: 'center',
          lineHeight: 1.5
        }}>
          Shooter 권한이 필요합니다.<br/>
          로그인 후 다시 시도해주세요.
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
      padding: '20px',
      fontFamily: 'inherit'
    }}>

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
          DB 권한 연동됨 ✅ - Shooter 스케줄 등록 시스템
        </div>
      </div>

      {/* 페이지 헤더 */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '24px',
        borderRadius: '12px',
        marginBottom: '24px',
        marginTop: '40px', // DB 권한 배너 공간 확보
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h1 style={{
              margin: '0 0 8px 0',
              fontSize: '28px',
              fontWeight: '600'
            }}>
              주간 근무 스케줄 등록
            </h1>
            <p style={{
              margin: 0,
              fontSize: '16px',
              opacity: 0.9
            }}>
              {shooterInfo.name}님 ({getShooterTypeText(shooterInfo.shooter_type)}) • 매주 근무 가능한 시간과 장소를 등록하세요
            </p>
          </div>
          
          <div style={{
            display: 'flex',
            gap: '12px'
          }}>
            <button
              onClick={() => router.push('/shooter/dashboard')}
              style={{
                padding: '8px 16px',
                background: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              대시보드로
            </button>
            <button
              onClick={() => router.push('/shooter/actions')}
              style={{
                padding: '8px 16px',
                background: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              액션 수행
            </button>
          </div>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: '24px',
        alignItems: 'flex-start'
      }}>
        {/* 메인 스케줄 등록 폼 */}
        <div>
          <WeeklyScheduleForm
            shooterId={shooterInfo.id}
            onScheduleSubmit={handleScheduleSubmit}
          />
        </div>

        {/* 사이드바 - 최근 등록 현황 */}
        <div>
          {/* 등록 가이드 */}
          <div style={{
            background: 'white',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
          }}>
            <h3 style={{
              margin: '0 0 12px 0',
              fontSize: '16px',
              fontWeight: '600',
              color: '#1e293b'
            }}>
              📋 등록 가이드
            </h3>
            <div style={{
              fontSize: '14px',
              color: '#64748b',
              lineHeight: 1.6
            }}>
              <div style={{ marginBottom: '8px' }}>
                <strong>1. 근무 가능 장소</strong><br/>
                촬영 가능한 학원/스튜디오를 선택하세요
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>2. 주간 근무 시간</strong><br/>
                각 요일별로 근무 가능한 시간대를 등록하세요
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>3. 여러 시간대</strong><br/>
                하루에 여러 시간대 등록이 가능합니다
              </div>
              <div>
                <strong>4. 매주 갱신</strong><br/>
                매주 스케줄을 갱신해주세요
              </div>
            </div>
          </div>

          {/* 최근 등록 현황 */}
          <div style={{
            background: 'white',
            borderRadius: '8px',
            padding: '20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
          }}>
            <h3 style={{
              margin: '0 0 16px 0',
              fontSize: '16px',
              fontWeight: '600',
              color: '#1e293b'
            }}>
              📊 최근 등록 현황
            </h3>

            {recentSchedules.length === 0 ? (
              <div style={{
                padding: '20px',
                textAlign: 'center',
                color: '#64748b',
                fontSize: '14px'
              }}>
                아직 등록된 스케줄이 없습니다
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                {recentSchedules.map((week, index) => (
                  <div
                    key={week.week_start}
                    style={{
                      padding: '12px',
                      background: index === 0 ? '#f0f9ff' : '#f8fafc',
                      border: `1px solid ${index === 0 ? '#bae6fd' : '#e2e8f0'}`,
                      borderRadius: '6px'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '4px'
                    }}>
                      <div style={{
                        fontSize: '13px',
                        fontWeight: '600',
                        color: '#1e293b'
                      }}>
                        {formatWeekRange(week.week_start)}
                      </div>
                      {index === 0 && (
                        <div style={{
                          background: '#3b82f6',
                          color: 'white',
                          padding: '2px 6px',
                          borderRadius: '8px',
                          fontSize: '10px',
                          fontWeight: '600'
                        }}>
                          최신
                        </div>
                      )}
                    </div>
                    
                    <div style={{
                      fontSize: '12px',
                      color: '#64748b'
                    }}>
                      등록 시간: {week.total_hours.toFixed(1)}시간
                    </div>
                    
                    <div style={{
                      fontSize: '12px',
                      color: '#64748b'
                    }}>
                      등록 일수: {week.schedules.filter((s: any) => s.is_available).length}일
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 도움말 */}
          <div style={{
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: '8px',
            padding: '16px',
            marginTop: '20px'
          }}>
            <div style={{
              fontSize: '14px',
              color: '#0369a1',
              lineHeight: 1.5
            }}>
              💡 <strong>팁:</strong> 스케줄을 정확히 등록하면 더 많은 촬영 기회를 받을 수 있습니다. 변경사항이 있을 때마다 업데이트해주세요.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Next.js 정적 생성 설정
export async function getStaticProps() {
  return {
    props: {
      title: 'Shooter 스케줄 등록',
      description: 'Shooter 주간 근무 스케줄 등록 및 관리'
    }
  };
}
