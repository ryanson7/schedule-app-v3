// components/DynamicNavigation.tsx - 모바일 반응형 + 역할별 홈 링크 (useAuth 사용 버전)
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../utils/supabaseClient';
import { MENU_CONFIG } from '../utils/menuConfig';
import { getRolePermissions, getFilteredMenus } from '../utils/permissions';
import { useAuth } from '../contexts/AuthContext';

export default function DynamicNavigation() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userInfo, setUserInfo] = useState({
    name: '로딩중...',
    role: '로딩중...',
    isLoading: true,
  });
  const [filteredMenus, setFilteredMenus] = useState<any[]>([]);

  // ✅ 모바일 감지
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // ✅ 전역 스타일 + 전역 클릭 핸들러 (1회 설정)
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const style = document.createElement('style');
      style.id = 'nav-global-style';
      style.textContent = `
        body { 
          padding-top: 70px !important; 
          margin: 0; 
        }
        * {
          box-sizing: border-box;
        }
      `;

      const existingStyle = document.getElementById('nav-global-style');
      if (existingStyle) existingStyle.remove();

      document.head.appendChild(style);
    }

    const handleGlobalClick = () => {
      setOpenMenu(null);
      setMobileMenuOpen(false);
    };
    document.addEventListener('click', handleGlobalClick);

    return () => {
      document.removeEventListener('click', handleGlobalClick);
    };
  }, []);

  // ✅ Auth + localStorage 에서 최종 역할 계산
  const resolvedUserRole: string | undefined = (() => {
    if (typeof window === 'undefined') return undefined;

    // AuthContext.saveUserInfo 가 넣어준 최종 역할 (schedule_admin, academy_manager 등)
    const fromStorage = localStorage.getItem('userRole');
    if (fromStorage) return fromStorage;

    // 그래도 없으면 Supabase user_metadata 참고 (fallback)
    const metaRole =
      (user?.user_metadata as any)?.role ||
      (user?.app_metadata as any)?.role;

    if (metaRole) return metaRole as string;

    return undefined; // 아직 역할 미확정
  })();

  // ✅ 역할별 홈 링크 결정
  const getHomeLink = () => {
    const role = resolvedUserRole || 'staff';

    const roleHomePaths: Record<string, string> = {
      shooter: '/shooter/ShooterDashboard',
      system_admin: '/admin',
      schedule_admin: '/admin',
      academy_manager: '/academy-schedules',
      studio_manager: '/admin',
      online_manager: '/ManagerStudioSchedulePage',
      professor: '/admin',
      staff: '/admin',
      manager: '/admin',
    };

    return roleHomePaths[role] || '/admin';
  };

  // ✅ 사용자 메뉴 + 표시 정보 로드 (Auth 역할 확정된 뒤에만 실행)
  const loadUserMenus = async (roleCode: string) => {
    try {
      console.log('🔍 사용자 메뉴 로딩 시작...');

      const roleMap: Record<string, string> = {
        system_admin: '시스템 관리자',
        schedule_admin: '스케줄 관리자',
        academy_manager: '학원 매니저',
        studio_manager: '스튜디오 매니저',
        online_manager: '온라인 매니저',
        professor: '교수',
        shooter: '촬영자',
        staff: '일반 직원',
        manager: '매니저',
      };

      const role = roleCode || 'staff';
      console.log('👤 사용자 역할 코드(userRole):', role);

      const userPermissions = await getRolePermissions(role);
      console.log('🔑 사용자 권한:', userPermissions);

      const filtered = getFilteredMenus(MENU_CONFIG, userPermissions);
      setFilteredMenus(filtered);
      console.log('📋 필터링된 메뉴:', filtered);

      let userName = '사용자';

      try {
        const {
          data: { user: supaUser },
        } = await supabase.auth.getUser();

        if (supaUser?.email) {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('name')
            .eq('email', supaUser.email)
            .eq('is_active', true)
            .single();

          if (!userError && userData?.name) {
            userName = userData.name;
            console.log('✅ DB에서 한글 이름 조회:', userData.name);
          } else {
            userName =
              (supaUser.user_metadata as any)?.name ||
              (supaUser.user_metadata as any)?.full_name ||
              supaUser.email?.split('@')[0] ||
              '사용자';
            console.log('⚠️ DB 조회 실패, 기본값 사용:', userName);
          }
        }
      } catch (supabaseError) {
        console.log('📧 사용자 이름 추출 실패:', supabaseError);
        userName = '사용자';
      }

      // 화면에 보여줄 한글 직책 텍스트
      const displayRole = roleMap[role] || role;

      setUserInfo({
        name: userName,
        role: displayRole,
        isLoading: false,
      });

      console.log('✅ 사용자 정보 설정 완료:', {
        name: userName,
        userRole: role, // 권한 코드
        displayRole, // 화면 표시용 텍스트
      });
    } catch (error) {
      console.error('❌ 메뉴 로드 실패:', error);
      setUserInfo({
        name: '오류',
        role: '로드 실패',
        isLoading: false,
      });
      setFilteredMenus([]);
    }
  };

  // ✅ Auth 로딩 끝 + 역할 확정된 뒤에만 메뉴 로드
  useEffect(() => {
    if (authLoading) return;
    if (!resolvedUserRole) return; // 아직 역할 정보 없음 → 메뉴 로드 보류

    setMounted(true);
    loadUserMenus(resolvedUserRole);
  }, [authLoading, resolvedUserRole]);

  if (!mounted) return null;

  const handleMenuClick = (menuId: string) => {
    setOpenMenu(prev => (prev === menuId ? null : menuId));
  };

  const handleItemClick = (path: string) => {
    setOpenMenu(null);
    setMobileMenuOpen(false);
    router.push(path);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      // ignore
    } finally {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        // ignore
      }
      window.location.href = '/login';
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '70px',
        backgroundColor: '#1f2937',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: isMobile ? '0 16px' : '0 24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        borderBottom: '1px solid #374151',
      }}
    >
      {/* 🔧 로고 - 역할별 링크 */}
      <div
        style={{
          fontSize: isMobile ? '16px' : '20px',
          fontWeight: '700',
          color: '#ffffff',
          cursor: 'pointer',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
        onClick={() => router.push(getHomeLink())}
      >
        {isMobile ? '스케줄 시스템' : '스케줄 관리 시스템'}
      </div>

      {/* 🔧 데스크톱 메뉴 */}
      {!isMobile && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {filteredMenus.map(menu => (
            <div key={menu.id} style={{ position: 'relative' }}>
              <button
                style={{
                  padding: '12px 14px',
                  backgroundColor: openMenu === menu.id ? '#374151' : 'transparent',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'background-color 0.2s',
                  userSelect: 'none',
                }}
                onClick={e => {
                  e.stopPropagation();
                  handleMenuClick(menu.id);
                }}
                onMouseEnter={e => {
                  if (openMenu !== menu.id) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = '#374151';
                  }
                }}
                onMouseLeave={e => {
                  if (openMenu !== menu.id) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                  }
                }}
              >
                {menu.name}
                <span style={{ fontSize: '10px', transition: 'transform 0.2s' }}>
                  {openMenu === menu.id ? '▲' : '▼'}
                </span>
              </button>

              {openMenu === menu.id && menu.children && menu.children.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '8px',
                    minWidth: '220px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    boxShadow: '0 8px 16px rgba(0,0,0,0.15)',
                    zIndex: 999999,
                    maxHeight: '400px',
                    overflowY: 'auto',
                    animation: 'slideDown 0.2s ease-out',
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  {menu.children.map((item: any, index: number) => (
                    <div
                      key={item.path}
                      style={{
                        padding: '12px 16px',
                        color: router.pathname === item.path ? '#1d4ed8' : '#333',
                        backgroundColor:
                          router.pathname === item.path ? '#f0f9ff' : 'transparent',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: router.pathname === item.path ? '600' : '400',
                        borderBottom:
                          index < menu.children.length - 1 ? '1px solid #f0f0f0' : 'none',
                        transition: 'all 0.2s',
                        userSelect: 'none',
                      }}
                      onClick={() => handleItemClick(item.path)}
                      onMouseEnter={e => {
                        if (router.pathname !== item.path) {
                          (e.currentTarget as HTMLElement).style.backgroundColor = '#f8f9fa';
                        }
                      }}
                      onMouseLeave={e => {
                        if (router.pathname !== item.path) {
                          (e.currentTarget as HTMLElement).style.backgroundColor =
                            'transparent';
                        }
                      }}
                    >
                      {item.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {filteredMenus.length === 0 && !userInfo.isLoading && (
            <div
              style={{
                color: '#9ca3af',
                fontSize: '13px',
                padding: '12px',
              }}
            >
              접근 가능한 메뉴가 없습니다.
            </div>
          )}
        </div>
      )}

      {/* 🔧 오른쪽 영역 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '16px' }}>
        {!isMobile && (
          <div style={{ textAlign: 'right', color: '#ffffff' }}>
            <div style={{ fontSize: '14px', fontWeight: '600' }}>{userInfo.name}</div>
            <div style={{ fontSize: '11px', color: '#9ca3af' }}>{userInfo.role}</div>
          </div>
        )}

        {isMobile && (
          <button
            style={{
              background: 'none',
              border: 'none',
              color: '#ffffff',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={e => {
              e.stopPropagation();
              setMobileMenuOpen(!mobileMenuOpen);
            }}
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        )}

        {!isMobile && (
          <button
            style={{
              padding: '8px 16px',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              userSelect: 'none',
            }}
            onClick={handleLogout}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.backgroundColor = '#b91c1c';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.backgroundColor = '#dc2626';
            }}
          >
            로그아웃
          </button>
        )}
      </div>

      {/* 🔧 모바일 드롭다운 메뉴 */}
      {isMobile && mobileMenuOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: '#ffffff',
            border: '1px solid #d1d5db',
            borderTop: 'none',
            boxShadow: '0 8px 16px rgba(0,0,0,0.15)',
            zIndex: 999999,
            maxHeight: '400px',
            overflowY: 'auto',
          }}
          onClick={e => e.stopPropagation()}
        >
          <div
            style={{
              padding: '16px',
              borderBottom: '1px solid #e5e7eb',
              backgroundColor: '#f8fafc',
            }}
          >
            <div
              style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#1e293b',
                marginBottom: '4px',
              }}
            >
              {userInfo.name}
            </div>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>{userInfo.role}</div>
          </div>

          {filteredMenus.map(menu => (
            <div key={menu.id}>
              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: '#f1f5f9',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  borderBottom: '1px solid #e5e7eb',
                }}
              >
                {menu.name}
              </div>
              {menu.children &&
                menu.children.map((item: any) => (
                  <div
                    key={item.path}
                    style={{
                      padding: '12px 24px',
                      color: router.pathname === item.path ? '#1d4ed8' : '#333',
                      backgroundColor:
                        router.pathname === item.path ? '#f0f9ff' : 'transparent',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: router.pathname === item.path ? '600' : '400',
                      borderBottom: '1px solid #f0f0f0',
                      userSelect: 'none',
                    }}
                    onClick={() => handleItemClick(item.path)}
                  >
                    {item.name}
                  </div>
                ))}
            </div>
          ))}

          {filteredMenus.length === 0 && !userInfo.isLoading && (
            <div
              style={{
                padding: '20px 16px',
                textAlign: 'center',
                color: '#9ca3af',
                fontSize: '14px',
              }}
            >
              접근 가능한 메뉴가 없습니다.
            </div>
          )}

          <div style={{ padding: '16px', borderTop: '1px solid #e5e7eb' }}>
            <button
              onClick={handleLogout}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#dc2626',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              로그아웃
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
