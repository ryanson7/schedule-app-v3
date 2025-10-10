"use client";
import { useEffect, useState } from "react";
import { supabase } from "../utils/supabaseClient";

interface TestUser {
  email: string;
  name: string;
  roles: string[];
}

interface AccessTest {
  page: string;
  description: string;
  allowedRoles: string[];
  testUrl: string;
}

export default function AccessControlTest() {
  const [currentUser, setCurrentUser] = useState<TestUser | null>(null);
  const [testUsers] = useState<TestUser[]>([
    { email: 'admin@test.com', name: '관리자', roles: ['admin'] },
    { email: 'manager@test.com', name: '학원매니저', roles: ['manager'] },
    { email: 'professor@test.com', name: '교수님', roles: ['professor'] },
    { email: 'shooter@test.com', name: '촬영자', roles: ['shooter'] }
  ]);

  const accessTests: AccessTest[] = [
    {
      page: '학원 스케줄',
      description: '학원 스케줄 등록 및 관리',
      allowedRoles: ['admin', 'manager'],
      testUrl: '/academy-schedules'
    },
    {
      page: '스튜디오 스케줄',
      description: '스튜디오 스케줄 등록 및 관리',
      allowedRoles: ['admin', 'professor'],
      testUrl: '/studio-schedules'
    },
    {
      page: '통합 스케줄',
      description: '모든 스케줄 통합 관리',
      allowedRoles: ['admin'],
      testUrl: '/all-schedules'
    },
    {
      page: '내부업무 스케줄',
      description: '내부업무 스케줄 관리',
      allowedRoles: ['admin'],
      testUrl: '/internal-schedules'
    }
  ];

  useEffect(() => {
    getCurrentUser();
  }, []);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: userRow } = await supabase
        .from('users')
        .select('name, email, user_roles(roles(name))')
        .eq('email', user.email)
        .single();
      
      if (userRow) {
        const roles = userRow.user_roles?.map((r: any) => r.roles.name) || [];
        setCurrentUser({
          email: userRow.email,
          name: userRow.name,
          roles: roles
        });
      }
    }
  };

  const switchUser = async (testUser: TestUser) => {
    // 실제 환경에서는 로그인 시스템을 통해 사용자 전환
    // 테스트 환경에서는 직접 사용자 정보 업데이트
    console.log(`사용자 전환: ${testUser.name} (${testUser.email})`);
    setCurrentUser(testUser);
  };

  const testAccess = (test: AccessTest) => {
    if (!currentUser) return 'unknown';
    
    const hasAccess = test.allowedRoles.some(role => currentUser.roles.includes(role));
    return hasAccess ? 'allowed' : 'denied';
  };

  const getAccessColor = (status: string) => {
    switch (status) {
      case 'allowed': return { bg: '#e8f5e8', color: '#2e7d32', border: '#4caf50' };
      case 'denied': return { bg: '#ffebee', color: '#c62828', border: '#f44336' };
      default: return { bg: '#f5f5f5', color: '#666', border: '#ccc' };
    }
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 20 }}>
      <h1 style={{ textAlign: 'center', marginBottom: 30, color: '#2c3e50' }}>
        🔐 접근 권한 테스트 시스템
      </h1>

      {/* 현재 사용자 정보 */}
      <div style={{ 
        background: '#f8f9fa', 
        padding: 20, 
        borderRadius: 12, 
        marginBottom: 30,
        border: '2px solid #e9ecef'
      }}>
        <h3 style={{ margin: '0 0 16px 0', color: '#495057' }}>현재 로그인 사용자</h3>
        {currentUser ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ 
              background: '#007bff', 
              color: 'white', 
              padding: '8px 16px', 
              borderRadius: 20,
              fontWeight: 'bold'
            }}>
              {currentUser.name}
            </div>
            <div style={{ color: '#6c757d' }}>{currentUser.email}</div>
            <div style={{ 
              background: '#28a745', 
              color: 'white', 
              padding: '4px 12px', 
              borderRadius: 16,
              fontSize: 12,
              fontWeight: 'bold'
            }}>
              {currentUser.roles.join(', ')}
            </div>
          </div>
        ) : (
          <div style={{ color: '#dc3545' }}>로그인된 사용자가 없습니다.</div>
        )}
      </div>

      {/* 테스트 사용자 전환 */}
      <div style={{ marginBottom: 30 }}>
        <h3 style={{ marginBottom: 16, color: '#495057' }}>테스트 사용자 전환</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {testUsers.map(user => (
            <button
              key={user.email}
              onClick={() => switchUser(user)}
              style={{
                padding: 16,
                border: currentUser?.email === user.email ? '3px solid #007bff' : '1px solid #dee2e6',
                borderRadius: 8,
                background: currentUser?.email === user.email ? '#e3f2fd' : 'white',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{user.name}</div>
              <div style={{ fontSize: 12, color: '#6c757d', marginBottom: 4 }}>{user.email}</div>
              <div style={{ 
                background: '#6c757d', 
                color: 'white', 
                padding: '2px 8px', 
                borderRadius: 12,
                fontSize: 10,
                display: 'inline-block'
              }}>
                {user.roles.join(', ')}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 접근 권한 테스트 결과 */}
      <div>
        <h3 style={{ marginBottom: 16, color: '#495057' }}>페이지별 접근 권한 테스트</h3>
        <div style={{ 
          background: 'white',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          {/* 테이블 헤더 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 2fr 1fr 1fr 120px',
            background: '#6c757d',
            color: 'white',
            padding: 16,
            fontWeight: 'bold'
          }}>
            <div>페이지</div>
            <div>설명</div>
            <div>허용 역할</div>
            <div>접근 상태</div>
            <div>테스트</div>
          </div>

          {/* 테스트 결과 */}
          {accessTests.map((test, index) => {
            const accessStatus = testAccess(test);
            const colors = getAccessColor(accessStatus);
            
            return (
              <div key={test.page} style={{
                display: 'grid',
                gridTemplateColumns: '1fr 2fr 1fr 1fr 120px',
                padding: 16,
                borderBottom: index === accessTests.length - 1 ? 'none' : '1px solid #f0f0f0',
                alignItems: 'center'
              }}>
                <div style={{ fontWeight: 'bold' }}>{test.page}</div>
                <div style={{ color: '#6c757d', fontSize: 14 }}>{test.description}</div>
                <div>
                  {test.allowedRoles.map(role => (
                    <span key={role} style={{
                      background: '#e9ecef',
                      color: '#495057',
                      padding: '2px 8px',
                      borderRadius: 12,
                      fontSize: 12,
                      marginRight: 4,
                      display: 'inline-block'
                    }}>
                      {role}
                    </span>
                  ))}
                </div>
                <div>
                  <span style={{
                    background: colors.bg,
                    color: colors.color,
                    border: `1px solid ${colors.border}`,
                    padding: '4px 12px',
                    borderRadius: 16,
                    fontSize: 12,
                    fontWeight: 'bold'
                  }}>
                    {accessStatus === 'allowed' ? '✅ 허용' : '❌ 차단'}
                  </span>
                </div>
                <div>
                  <button
                    onClick={() => window.open(test.testUrl, '_blank')}
                    disabled={!currentUser}
                    style={{
                      padding: '6px 12px',
                      background: accessStatus === 'allowed' ? '#28a745' : '#6c757d',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      cursor: currentUser ? 'pointer' : 'not-allowed',
                      fontSize: 12
                    }}
                  >
                    테스트
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 권한 매트릭스 */}
      <div style={{ marginTop: 40 }}>
        <h3 style={{ marginBottom: 16, color: '#495057' }}>권한 매트릭스</h3>
        <div style={{ 
          background: 'white',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#6c757d', color: 'white' }}>
                <th style={{ padding: 12, textAlign: 'left' }}>역할 / 페이지</th>
                {accessTests.map(test => (
                  <th key={test.page} style={{ padding: 12, textAlign: 'center', fontSize: 12 }}>
                    {test.page}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {['admin', 'manager', 'professor', 'shooter'].map((role, roleIndex) => (
                <tr key={role} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ 
                    padding: 12, 
                    fontWeight: 'bold',
                    background: '#f8f9fa',
                    textTransform: 'capitalize'
                  }}>
                    {role}
                  </td>
                  {accessTests.map(test => {
                    const hasAccess = test.allowedRoles.includes(role);
                    return (
                      <td key={`${role}-${test.page}`} style={{ 
                        padding: 12, 
                        textAlign: 'center',
                        background: hasAccess ? '#e8f5e8' : '#ffebee'
                      }}>
                        {hasAccess ? '✅' : '❌'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 테스트 결과 요약 */}
      <div style={{ 
        marginTop: 30, 
        padding: 20, 
        background: '#e3f2fd', 
        borderRadius: 12,
        border: '2px solid #90caf9'
      }}>
        <h4 style={{ margin: '0 0 12px 0', color: '#1565c0' }}>📊 테스트 결과 요약</h4>
        <ul style={{ margin: 0, paddingLeft: 20, color: '#1976d2' }}>
          <li><strong>Admin</strong>: 모든 페이지 접근 가능 ✅</li>
          <li><strong>Manager</strong>: 학원 스케줄만 접근 가능 📚</li>
          <li><strong>Professor</strong>: 스튜디오 스케줄만 접근 가능 🎬</li>
          <li><strong>Shooter</strong>: 모든 페이지 접근 불가 ❌</li>
        </ul>
      </div>
    </div>
  );
}
