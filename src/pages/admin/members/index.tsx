// pages/admin/members/index.tsx
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../../utils/supabaseClient';
import { useAuth } from '../../../contexts/AuthContext';

type TabType = 'admins' | 'managers' | 'shooters' | 'overview';

interface User {
  id: number;
  auth_id: string;
  email: string;
  name: string;
  phone?: string;
  role: string;
  is_active: boolean;
  created_at: string;
  main_location_id?: number;
  main_location?: {
    id: number;
    name: string;
  };
}

export default function MembersManagementPage() {
  const router = useRouter();
  const { signOut } = useAuth();
  
  const [currentUser, setCurrentUser] = useState({
    id: '',
    role: '',
    name: ''
  });
  
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [createForm, setCreateForm] = useState({
    email: '',
    name: '',
    phone: '',
    role: 'professor',
    main_location_id: '',
    password: 'qwer1234!'
  });

  useEffect(() => {
    initializeUserData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [users, searchTerm, roleFilter, locationFilter, activeTab]);

  const initializeUserData = async () => {
    try {
      setLoading(true);
      
      const userId = localStorage.getItem('userId');
      const userRole = localStorage.getItem('userRole');
      const userName = localStorage.getItem('userName');
      
      setCurrentUser({
        id: userId || '',
        role: userRole || '',
        name: userName || ''
      });

      // 권한 체크
      if (!['system_admin', 'schedule_admin'].includes(userRole || '')) {
        // Academy Manager, Online Manager는 각자 페이지로 리다이렉트
        if (userRole === 'academy_manager') {
          router.replace('/academy-schedules');
          return;
        } else if (userRole === 'online_manager') {
          router.replace('/ManagerStudioSchedulePage');
          return;
        } else {
          alert('멤버 관리 권한이 없습니다.');
          router.replace('/login');
          return;
        }
      }

      await loadAllUsers();
    } catch (error) {
      console.error('초기화 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          id,
          auth_id,
          email,
          name,
          phone,
          role,
          is_active,
          created_at,
          main_location_id,
          main_locations!main_location_id (
            id,
            name
          )
        `)
        .in('role', [
          'system_admin',
          'schedule_admin', 
          'academy_manager',
          'online_manager',
          'professor',
          'shooter'
        ])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('사용자 목록 조회 실패:', error);
    }
  };

  const applyFilters = () => {
    let filtered = users;

    // 탭별 필터링
    switch (activeTab) {
      case 'admins':
        filtered = filtered.filter(user => 
          ['system_admin', 'schedule_admin'].includes(user.role)
        );
        break;
      case 'managers':
        filtered = filtered.filter(user => 
          ['academy_manager', 'online_manager'].includes(user.role)
        );
        break;
      case 'shooters':
        filtered = filtered.filter(user => user.role === 'shooter');
        break;
      case 'overview':
        // 전체 보기
        break;
    }

    // 역할 필터
    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    // 위치 필터
    if (locationFilter !== 'all') {
      filtered = filtered.filter(user => 
        user.main_location_id?.toString() === locationFilter
      );
    }

    // 검색어 필터
    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.phone && user.phone.includes(searchTerm))
      );
    }

    setFilteredUsers(filtered);
  };

  // 멤버 생성
  const handleCreateMember = async () => {
    if (!createForm.email || !createForm.name || !createForm.role) {
      alert('필수 정보를 모두 입력해주세요.');
      return;
    }

    try {
      const response = await fetch('/api/admin/create-member-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...createForm,
          created_by: currentUser.id,
          manager_role: currentUser.role
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        alert(`${createForm.name} 멤버가 성공적으로 생성되었습니다.\n초기 비밀번호: qwer1234!`);
        setShowCreateModal(false);
        resetForm();
        loadAllUsers();
      } else {
        throw new Error(result.error || '멤버 생성 실패');
      }
    } catch (error) {
      console.error('멤버 생성 실패:', error);
      alert('멤버 생성에 실패했습니다: ' + error.message);
    }
  };

  // 비밀번호 재설정
  const handleResetPassword = async (userId: number, userName: string) => {
    if (!confirm(`${userName}님의 비밀번호를 'qwer1234!'로 재설정하시겠습니까?`)) return;

    try {
      const response = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          new_password: 'qwer1234!',
          reset_by: currentUser.id
        })
      });

      if (response.ok) {
        alert(`${userName}님의 비밀번호가 재설정되었습니다.`);
      } else {
        throw new Error('재설정 실패');
      }
    } catch (error) {
      alert('비밀번호 재설정에 실패했습니다.');
    }
  };

  // 자동 로그인
  const handleAutoLogin = async (user: User) => {
    if (!confirm(`${user.name}님으로 자동 로그인하시겠습니까?\n현재 세션이 종료됩니다.`)) return;

    try {
      // 현재 로그아웃
      await signOut();
      
      // 대상 사용자로 강제 로그인
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: 'qwer1234!' // 통일된 초기 비밀번호 사용
      });

      if (error) throw error;

      alert(`${user.name}님으로 로그인되었습니다.`);
      
      // 역할별 페이지로 리다이렉트
      const redirectPath = getRedirectPath(user.role);
      window.location.href = redirectPath;
      
    } catch (error) {
      console.error('자동 로그인 실패:', error);
      alert('자동 로그인에 실패했습니다. 수동으로 로그인해주세요.');
      router.push('/login');
    }
  };

  // 해당 페이지로 리다이렉트 (새 탭)
  const handleRedirectToUserPage = (role: string) => {
    const redirectPath = getRedirectPath(role);
    window.open(redirectPath, '_blank');
  };

  // 역할별 리다이렉트 경로
  const getRedirectPath = (role: string) => {
    switch (role) {
      case 'system_admin':
      case 'schedule_admin':
        return '/admin';
      case 'academy_manager':
        return '/academy-schedules';
      case 'online_manager':
        return '/ManagerStudioSchedulePage';
      case 'professor':
        return '/studio-schedules';
      case 'shooter':
        return '/shooter/schedule-check';
      default:
        return '/login';
    }
  };

  const resetForm = () => {
    setCreateForm({
      email: '',
      name: '',
      phone: '',
      role: 'professor',
      main_location_id: '',
      password: 'qwer1234!'
    });
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

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p>멤버 데이터를 불러오는 중...</p>
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

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '1600px',
        margin: '0 auto'
      }}>
        {/* 헤더 */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px'
          }}>
            <div>
              <h1 style={{
                fontSize: '32px',
                fontWeight: '700',
                color: '#1f2937',
                margin: '0 0 8px 0'
              }}>
                🏢 멤버 관리 시스템
              </h1>
              <p style={{
                color: '#6b7280',
                margin: 0,
                fontSize: '16px'
              }}>
                {getRoleDisplayName(currentUser.role)}으로 전체 멤버 관리 중
              </p>
            </div>
            
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                padding: '14px 28px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: '600',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                transition: 'all 0.2s'
              }}
            >
              ➕ 새 멤버 생성
            </button>
          </div>

          {/* 탭 메뉴 */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '20px',
            borderBottom: '1px solid #e5e7eb',
            paddingBottom: '16px'
          }}>
            {[
              { id: 'overview', name: '📊 전체 멤버현황', count: users.length },
              { id: 'admins', name: '👑 관리자 관리', count: users.filter(u => ['system_admin', 'schedule_admin'].includes(u.role)).length },
              { id: 'managers', name: '🎯 매니저 관리', count: users.filter(u => ['academy_manager', 'online_manager'].includes(u.role)).length },
              { id: 'shooters', name: '📹 촬영자 관리', count: users.filter(u => u.role === 'shooter').length }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                style={{
                  padding: '12px 20px',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  backgroundColor: activeTab === tab.id ? '#3b82f6' : '#f8fafc',
                  color: activeTab === tab.id ? 'white' : '#6b7280',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {tab.name}
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  backgroundColor: activeTab === tab.id ? 'rgba(255,255,255,0.2)' : '#e5e7eb',
                  color: activeTab === tab.id ? 'white' : '#6b7280'
                }}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* 검색 및 필터 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 200px 200px',
            gap: '16px',
            alignItems: 'center'
          }}>
            <input
              type="text"
              placeholder="🔍 이름, 이메일, 전화번호로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: '12px 16px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              style={{
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            >
              <option value="all">모든 역할</option>
              <option value="system_admin">시스템 관리자</option>
              <option value="schedule_admin">스케줄 관리자</option>
              <option value="academy_manager">학원 관리자</option>
              <option value="online_manager">온라인 관리자</option>
              <option value="professor">교수</option>
              <option value="shooter">촬영자</option>
            </select>

            <div style={{
              textAlign: 'right',
              color: '#6b7280',
              fontSize: '14px',
              fontWeight: '600'
            }}>
              📋 총 {filteredUsers.length}명 표시 중
            </div>
          </div>
        </div>

        {/* 멤버 목록 */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          {/* 테이블 헤더 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 120px 150px 150px 100px 300px',
            gap: '16px',
            padding: '18px 24px',
            backgroundColor: '#f8fafc',
            fontWeight: '600',
            fontSize: '14px',
            color: '#374151',
            borderBottom: '2px solid #e5e7eb'
          }}>
            <div>👤 멤버 정보</div>
            <div>🏷️ 역할</div>
            <div>🏢 소속</div>
            <div>📅 등록일</div>
            <div>📊 상태</div>
            <div>🛠️ 관리 액션</div>
          </div>

          {/* 멤버 목록 */}
          {filteredUsers.map((user) => (
            <div
              key={user.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 120px 150px 150px 100px 300px',
                gap: '16px',
                padding: '20px 24px',
                borderBottom: '1px solid #f3f4f6',
                alignItems: 'center',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f9fafb';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {/* 멤버 정보 */}
              <div>
                <div style={{
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '4px'
                }}>
                  {user.name}
                </div>
                <div style={{
                  color: '#6b7280',
                  fontSize: '14px',
                  marginBottom: '2px'
                }}>
                  📧 {user.email}
                </div>
                {user.phone && (
                  <div style={{
                    color: '#9ca3af',
                    fontSize: '12px'
                  }}>
                    📱 {user.phone}
                  </div>
                )}
              </div>

              {/* 역할 */}
              <div>
                <span style={{
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '500',
                  backgroundColor: getRoleColor(user.role) + '20',
                  color: getRoleColor(user.role)
                }}>
                  {getRoleDisplayName(user.role)}
                </span>
              </div>

              {/* 소속 */}
              <div style={{
                fontSize: '14px',
                color: '#6b7280'
              }}>
                {user.main_location?.name || '-'}
              </div>

              {/* 등록일 */}
              <div style={{
                fontSize: '14px',
                color: '#6b7280'
              }}>
                {new Date(user.created_at).toLocaleDateString('ko-KR')}
              </div>

              {/* 상태 */}
              <div>
                <span style={{
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '500',
                  backgroundColor: user.is_active ? '#10b98120' : '#ef444420',
                  color: user.is_active ? '#10b981' : '#ef4444'
                }}>
                  {user.is_active ? '✅ 활성' : '❌ 비활성'}
                </span>
              </div>

              {/* 관리 액션 */}
              <div style={{
                display: 'flex',
                gap: '6px',
                flexWrap: 'wrap'
              }}>
                <button
                  onClick={() => handleResetPassword(user.id, user.name)}
                  style={{
                    padding: '6px 10px',
                    fontSize: '11px',
                    backgroundColor: '#f59e0b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  title="비밀번호를 qwer1234!로 재설정"
                >
                  🔑 비번재설정
                </button>

                <button
                  onClick={() => handleAutoLogin(user)}
                  style={{
                    padding: '6px 10px',
                    fontSize: '11px',
                    backgroundColor: '#8b5cf6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  title="해당 사용자로 자동 로그인"
                >
                  🚀 자동로그인
                </button>

                <button
                  onClick={() => handleRedirectToUserPage(user.role)}
                  style={{
                    padding: '6px 10px',
                    fontSize: '11px',
                    backgroundColor: '#06b6d4',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  title="해당 역할의 메인 페이지로 이동"
                >
                  🔗 페이지이동
                </button>
              </div>
            </div>
          ))}

          {filteredUsers.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '80px 20px',
              color: '#9ca3af'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
              <div style={{ fontSize: '18px', marginBottom: '8px' }}>
                조건에 맞는 멤버가 없습니다
              </div>
              <div style={{ fontSize: '14px' }}>
                다른 필터를 사용하거나 검색어를 변경해보세요
              </div>
            </div>
          )}
        </div>

        {/* 통계 정보 */}
        <div style={{
          marginTop: '24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '16px'
        }}>
          {[
            { role: 'system_admin', name: '시스템 관리자', icon: '👑' },
            { role: 'schedule_admin', name: '스케줄 관리자', icon: '📋' },
            { role: 'academy_manager', name: '학원 관리자', icon: '🏫' },
            { role: 'online_manager', name: '온라인 관리자', icon: '💻' },
            { role: 'professor', name: '교수', icon: '👨‍🏫' },
            { role: 'shooter', name: '촬영자', icon: '📹' }
          ].map((item) => {
            const count = users.filter(u => u.role === item.role).length;
            return (
              <div
                key={item.role}
                style={{
                  backgroundColor: 'white',
                  padding: '20px',
                  borderRadius: '12px',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>{item.icon}</div>
                <div style={{ fontWeight: '600', color: '#1f2937', marginBottom: '4px' }}>
                  {item.name}
                </div>
                <div style={{ 
                  fontSize: '24px', 
                  fontWeight: '700', 
                  color: getRoleColor(item.role) 
                }}>
                  {count}명
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 생성 모달 - 간소화 버전 */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '32px',
            width: '100%',
            maxWidth: '500px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)'
          }}>
            <h2 style={{ margin: '0 0 24px 0', fontSize: '24px', fontWeight: '700' }}>
              새 멤버 생성
            </h2>
            
            {/* 간단한 폼 필드들 */}
            <div style={{ marginBottom: '20px' }}>
              <input
                type="email"
                placeholder="이메일"
                value={createForm.email}
                onChange={(e) => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  marginBottom: '12px'
                }}
              />
              <input
                type="text"
                placeholder="이름"
                value={createForm.name}
                onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  marginBottom: '12px'
                }}
              />
              <select
                value={createForm.role}
                onChange={(e) => setCreateForm(prev => ({ ...prev, role: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px'
                }}
              >
                <option value="professor">교수</option>
                <option value="shooter">촬영자</option>
                {currentUser.role === 'system_admin' && (
                  <>
                    <option value="academy_manager">학원 관리자</option>
                    <option value="online_manager">온라인 관리자</option>
                    <option value="schedule_admin">스케줄 관리자</option>
                  </>
                )}
              </select>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  padding: '12px 24px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  backgroundColor: 'white',
                  cursor: 'pointer'
                }}
              >
                취소
              </button>
              <button
                onClick={handleCreateMember}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                생성
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
