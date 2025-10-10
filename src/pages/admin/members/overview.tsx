import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../../utils/supabaseClient';

interface MemberStats {
  role: string;
  count: number;
  active_count: number;
  inactive_count: number;
  growth_rate: number;
}

interface RecentActivity {
  id: string;
  action: 'created' | 'updated' | 'activated' | 'deactivated';
  member_name: string;
  member_role: string;
  timestamp: string;
  description: string;
}

interface SystemHealth {
  total_members: number;
  active_percentage: number;
  new_members_today: number;
  new_members_week: number;
  role_distribution: { [key: string]: number };
}

export default function MembersOverviewPage() {
  const router = useRouter();
  const [stats, setStats] = useState<MemberStats[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    const role = localStorage.getItem('userRole');
    setUserRole(role || '');
    
    if (!['system_admin', 'schedule_admin'].includes(role || '')) {
      if (role === 'academy_manager') {
        router.replace('/academy-schedules');
        return;
      } else if (role === 'online_manager') {
        router.replace('/ManagerStudioSchedulePage');
        return;
      } else {
        alert('접근 권한이 없습니다.');
        router.replace('/login');
        return;
      }
    }

    loadOverviewData();
    
    // 5분마다 데이터 새로고침
    const interval = setInterval(loadOverviewData, 300000);
    return () => clearInterval(interval);
  }, [router]);

  const loadOverviewData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadMemberStats(),
        loadSystemHealth(),
        loadRecentActivity()
      ]);
    } catch (error) {
      console.error('개요 데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMemberStats = async () => {
    const { data: allUsers, error } = await supabase
      .from('users')
      .select('role, is_active, created_at')
      .in('role', ['system_admin', 'schedule_admin', 'academy_manager', 'online_manager', 'professor', 'shooter']);

    if (error) throw error;

    // 7일 전 데이터도 함께 가져와서 성장률 계산
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const roleStats: { [key: string]: { total: number; active: number; weekOld: number } } = {};
    
    allUsers?.forEach(user => {
      if (!roleStats[user.role]) {
        roleStats[user.role] = { total: 0, active: 0, weekOld: 0 };
      }
      roleStats[user.role].total++;
      if (user.is_active) {
        roleStats[user.role].active++;
      }
      if (new Date(user.created_at) < weekAgo) {
        roleStats[user.role].weekOld++;
      }
    });

    const formattedStats = Object.entries(roleStats).map(([role, data]) => ({
      role,
      count: data.total,
      active_count: data.active,
      inactive_count: data.total - data.active,
      growth_rate: data.weekOld > 0 ? ((data.total - data.weekOld) / data.weekOld * 100) : 0
    }));

    setStats(formattedStats);
  };

  const loadSystemHealth = async () => {
    const { data: users, error } = await supabase
      .from('users')
      .select('role, is_active, created_at')
      .in('role', ['system_admin', 'schedule_admin', 'academy_manager', 'online_manager', 'professor', 'shooter']);

    if (error) throw error;

    const today = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const todayStr = today.toISOString().split('T')[0];

    const total = users?.length || 0;
    const active = users?.filter(u => u.is_active).length || 0;
    const newToday = users?.filter(u => u.created_at.startsWith(todayStr)).length || 0;
    const newWeek = users?.filter(u => new Date(u.created_at) >= weekAgo).length || 0;

    const roleDistribution: { [key: string]: number } = {};
    users?.forEach(user => {
      roleDistribution[user.role] = (roleDistribution[user.role] || 0) + 1;
    });

    setSystemHealth({
      total_members: total,
      active_percentage: total > 0 ? Math.round((active / total) * 100) : 0,
      new_members_today: newToday,
      new_members_week: newWeek,
      role_distribution: roleDistribution
    });
  };

  const loadRecentActivity = async () => {
    // 최근 생성된 사용자들
    const { data: recentUsers, error } = await supabase
      .from('users')
      .select('id, name, email, role, created_at, updated_at, is_active')
      .in('role', ['system_admin', 'schedule_admin', 'academy_manager', 'online_manager', 'professor', 'shooter'])
      .order('updated_at', { ascending: false })
      .limit(15);

    if (error) throw error;

    const activities: RecentActivity[] = recentUsers?.map(user => ({
      id: `${user.id}_${user.updated_at}`,
      action: 'updated',
      member_name: user.name || '알 수 없음',
      member_role: user.role,
      timestamp: user.updated_at || user.created_at,
      description: user.is_active ? '계정 활성화됨' : '계정 비활성화됨'
    })) || [];

    setRecentActivity(activities.slice(0, 10));
  };

  const getRoleDisplayName = (role: string) => {
    const names = {
      system_admin: '시스템 관리자',
      schedule_admin: '스케줄 관리자',
      academy_manager: '학원 관리자',
      online_manager: '온라인 관리자',
      professor: '교수',
      shooter: '촬영자'
    };
    return names[role] || role;
  };

  const getRoleColor = (role: string) => {
    const colors = {
      system_admin: '#dc2626',
      schedule_admin: '#ea580c',
      academy_manager: '#3b82f6',
      online_manager: '#059669',
      professor: '#0891b2',
      shooter: '#7c3aed'
    };
    return colors[role] || '#6b7280';
  };

  const navigateToRoleManagement = (role: string) => {
    const roleToPageMap = {
      'system_admin': '/admin/members/admins',
      'schedule_admin': '/admin/members/admins',
      'academy_manager': '/admin/members/managers',
      'online_manager': '/admin/members/managers',
      'professor': '/admin/members/professors',
      'shooter': '/admin/members/shooters'
    };
    router.push(roleToPageMap[role] || '/admin/members/overview');
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #e5e7eb',
          borderTop: '4px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <p style={{ color: '#6b7280', fontSize: '16px' }}>시스템 현황을 불러오는 중...</p>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        {/* 헤더 */}
        <div style={{ 
          marginBottom: '32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <h1 style={{
              fontSize: '32px',
              fontWeight: '700',
              color: '#1f2937',
              margin: '0 0 8px 0'
            }}>
              📊 멤버 전체 현황
            </h1>
            <p style={{
              color: '#6b7280',
              margin: 0,
              fontSize: '16px'
            }}>
              실시간 시스템 멤버 현황과 활동 통계를 확인하세요
            </p>
          </div>
          
          <div style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center'
          }}>
            <div style={{
              fontSize: '14px',
              color: '#6b7280',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                backgroundColor: '#10b981',
                borderRadius: '50%'
              }} />
              마지막 업데이트: {new Date().toLocaleTimeString('ko-KR')}
            </div>
            <button
              onClick={() => loadOverviewData()}
              style={{
                padding: '8px 16px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              새로고침
            </button>
          </div>
        </div>

        {/* 시스템 전체 요약 */}
        {systemHealth && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '20px',
            marginBottom: '40px'
          }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              border: '2px solid #3b82f620'
            }}>
              <h3 style={{ margin: '0 0 12px 0', color: '#374151', fontSize: '14px', fontWeight: '600' }}>
                전체 멤버
              </h3>
              <div style={{ fontSize: '32px', fontWeight: '700', color: '#3b82f6' }}>
                {systemHealth.total_members}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                활성률 {systemHealth.active_percentage}%
              </div>
            </div>

            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              border: '2px solid #10b98120'
            }}>
              <h3 style={{ margin: '0 0 12px 0', color: '#374151', fontSize: '14px', fontWeight: '600' }}>
                오늘 신규
              </h3>
              <div style={{ fontSize: '32px', fontWeight: '700', color: '#10b981' }}>
                {systemHealth.new_members_today}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                이번 주 {systemHealth.new_members_week}명
              </div>
            </div>

            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              border: '2px solid #f59e0b20'
            }}>
              <h3 style={{ margin: '0 0 12px 0', color: '#374151', fontSize: '14px', fontWeight: '600' }}>
                주요 역할
              </h3>
              <div style={{ fontSize: '32px', fontWeight: '700', color: '#f59e0b' }}>
                {Object.keys(systemHealth.role_distribution).length}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                개 역할 그룹
              </div>
            </div>
          </div>
        )}

        {/* 역할별 상세 통계 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '24px',
          marginBottom: '40px'
        }}>
          {stats.map((stat) => (
            <div
              key={stat.role}
              style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '24px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                border: `2px solid ${getRoleColor(stat.role)}20`,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onClick={() => navigateToRoleManagement(stat.role)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 15px -3px rgba(0, 0, 0, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px'
              }}>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#1f2937',
                  margin: 0
                }}>
                  {getRoleDisplayName(stat.role)}
                </h3>
                <div style={{
                  padding: '4px 8px',
                  borderRadius: '12px',
                  backgroundColor: getRoleColor(stat.role),
                  fontSize: '12px',
                  color: 'white',
                  fontWeight: '600'
                }}>
                  {stat.growth_rate > 0 ? '+' : ''}{stat.growth_rate.toFixed(1)}%
                </div>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '16px',
                marginBottom: '16px'
              }}>
                <div style={{
                  fontSize: '36px',
                  fontWeight: '700',
                  color: getRoleColor(stat.role)
                }}>
                  {stat.count}
                </div>
                <div style={{
                  fontSize: '14px',
                  color: '#6b7280'
                }}>
                  총 {stat.count}명
                </div>
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '14px'
              }}>
                <div style={{ color: '#059669' }}>
                  ✅ 활성: {stat.active_count}명
                </div>
                <div style={{ color: '#ef4444' }}>
                  ⏸️ 비활성: {stat.inactive_count}명
                </div>
              </div>

              <div style={{
                marginTop: '12px',
                width: '100%',
                height: '4px',
                backgroundColor: '#f3f4f6',
                borderRadius: '2px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${stat.count > 0 ? (stat.active_count / stat.count) * 100 : 0}%`,
                  height: '100%',
                  backgroundColor: getRoleColor(stat.role),
                  transition: 'width 0.3s'
                }} />
              </div>
            </div>
          ))}
        </div>

        {/* 최근 활동 */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '32px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px'
          }}>
            <h2 style={{
              fontSize: '24px',
              fontWeight: '700',
              color: '#1f2937',
              margin: 0
            }}>
              🔄 최근 활동
            </h2>
            <div style={{
              fontSize: '14px',
              color: '#6b7280'
            }}>
              최근 {recentActivity.length}개 활동
            </div>
          </div>

          <div style={{
            display: 'grid',
            gap: '1px',
            backgroundColor: '#f3f4f6',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 1.5fr',
              gap: '16px',
              padding: '16px',
              backgroundColor: '#f8fafc',
              fontWeight: '600',
              color: '#374151',
              fontSize: '14px'
            }}>
              <div>멤버</div>
              <div>역할</div>
              <div>상태</div>
              <div>시간</div>
            </div>

            {recentActivity.map((activity, index) => (
              <div
                key={activity.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1.5fr',
                  gap: '16px',
                  padding: '16px',
                  backgroundColor: 'white',
                  alignItems: 'center'
                }}
              >
                <div style={{
                  fontWeight: '600',
                  color: '#1f2937'
                }}>
                  {activity.member_name}
                </div>

                <div>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: '500',
                    backgroundColor: getRoleColor(activity.member_role) + '20',
                    color: getRoleColor(activity.member_role)
                  }}>
                    {getRoleDisplayName(activity.member_role)}
                  </span>
                </div>

                <div style={{
                  fontSize: '13px',
                  color: activity.description.includes('활성') ? '#059669' : '#ef4444'
                }}>
                  {activity.description}
                </div>

                <div style={{
                  fontSize: '13px',
                  color: '#6b7280'
                }}>
                  {new Date(activity.timestamp).toLocaleString('ko-KR')}
                </div>
              </div>
            ))}

            {recentActivity.length === 0 && (
              <div style={{
                backgroundColor: 'white',
                textAlign: 'center',
                padding: '40px',
                color: '#9ca3af'
              }}>
                최근 활동이 없습니다.
              </div>
            )}
          </div>
        </div>

        {/* 빠른 액션 */}
        <div style={{
          marginTop: '40px',
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap',
          justifyContent: 'center'
        }}>
          <button
            onClick={() => router.push('/admin/members/admins')}
            style={{
              padding: '12px 24px',
              backgroundColor: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
          >
            👨‍💼 관리자 관리
          </button>
          
          <button
            onClick={() => router.push('/admin/members/professors')}
            style={{
              padding: '12px 24px',
              backgroundColor: '#0891b2',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0e7490'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0891b2'}
          >
            👨‍🏫 교수 관리
          </button>
          
          <button
            onClick={() => router.push('/admin/members/shooters')}
            style={{
              padding: '12px 24px',
              backgroundColor: '#7c3aed',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#6d28d9'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#7c3aed'}
          >
            📸 촬영자 관리
          </button>
        </div>
      </div>
    </div>
  );
}
