// components/MainNavigation.tsx - 모든 오류 완전 해결 버전
"use client";
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import { safeUserRole, getRoleDisplayName } from '../utils/permissions';
import { getRoleInfo } from '../utils/roleSystem';
import { supabase } from '../utils/supabaseClient';

interface MenuItem {
  id: string;
  name: string;
  path: string;
  icon?: string;
  category?: string;
  order?: number;
  children?: MenuItem[];
  isVisible?: boolean;
}

export default function MainNavigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [userInfo, setUserInfo] = useState({
    username: '',
    role: 'staff' as any,
    displayName: ''
  });

  const router = useRouter();
  const { user, session, loading, signOut } = useAuth();

  // 🔥 완전히 안전한 DB 권한 기반 메뉴 로딩 (모든 오류 해결)
  const loadUserMenus = useCallback(async (userRole: string) => {
    console.log(`[네비게이션] ${userRole} 역할의 메뉴 권한 조회 시작`);
    setMenuLoading(true);
    
    try {
      // 🎯 STEP 1: menu_permissions 테이블 안전한 조회
      let menuData = null;
      let errorOccurred = false;

      try {
        const { data: menuPermissions, error: menuError } = await supabase
          .from('menu_permissions')
          .select('menu_id, menu_name, menu_path, menu_icon, menu_order, parent_menu, category, is_visible')
          .eq('user_role', userRole)
          .eq('is_visible', true)
          .order('menu_order', { ascending: true });

        if (menuError) {
          console.warn('[네비게이션] menu_permissions 조회 실패:', menuError.message);
          errorOccurred = true;
        } else {
          menuData = menuPermissions;
        }
      } catch (error) {
        console.warn('[네비게이션] menu_permissions 테이블 접근 실패:', error);
        errorOccurred = true;
      }

      console.log(`[네비게이션] menu_permissions에서 ${menuData?.length || 0}개 메뉴 조회`);

      // 🎯 STEP 2: menu_permissions가 비어있거나 오류 시 permissions 테이블 체크
      if (!menuData || menuData.length === 0 || errorOccurred) {
        console.log('[네비게이션] permissions 테이블 백업 조회 시작');
        
        try {
          const { data: permissions, error: permError } = await supabase
            .from('permissions')
            .select('page_path, page_name, can_access')
            .eq('user_role', userRole)
            .eq('can_access', true);

          if (permError) {
            console.warn('[네비게이션] permissions 조회 실패:', permError.message);
          } else if (permissions && permissions.length > 0) {
            const permissionMenus = permissions
              .filter(perm => perm && perm.page_path && typeof perm.page_path === 'string' && perm.page_path.trim())
              .map((perm, index) => ({
                id: `perm-${index}-${Date.now()}`,
                name: (perm.page_name && typeof perm.page_name === 'string') 
                      ? perm.page_name 
                      : getMenuDisplayName(perm.page_path),
                path: perm.page_path.trim(),
                category: getMenuCategory(perm.page_path),
                order: index + 1,
                isVisible: true
              }));

            console.log(`[네비게이션] permissions에서 ${permissionMenus.length}개 메뉴 생성`);
            setMenus(permissionMenus);
            return;
          }
        } catch (error) {
          console.warn('[네비게이션] permissions 테이블 접근 실패:', error);
        }
      }

      // 🎯 STEP 3: menu_permissions 데이터 안전하게 변환
      if (menuData && Array.isArray(menuData) && menuData.length > 0) {
        const safeMenuItems = menuData
          .filter(menu => {
            // 필수 필드 검증
            return menu && 
                   (menu.menu_id || menu.menu_name) && 
                   typeof menu.menu_name === 'string' && 
                   menu.menu_name.trim();
          })
          .map((menu, index) => {
            // 안전한 데이터 변환
            const safeId = menu.menu_id ? String(menu.menu_id) : `menu-${Date.now()}-${index}`;
            const safeName = String(menu.menu_name || '메뉴').trim();
            const safePath = menu.menu_path && typeof menu.menu_path === 'string' 
                           ? menu.menu_path.trim() 
                           : `/${safeId}`;
            const safeCategory = menu.category && typeof menu.category === 'string' 
                               ? menu.category.trim() 
                               : '기본';
            const safeOrder = Number.isInteger(menu.menu_order) && menu.menu_order >= 0 
                            ? menu.menu_order 
                            : index + 1;

            return {
              id: safeId,
              name: safeName,
              path: safePath,
              category: safeCategory,
              order: safeOrder,
              isVisible: true
            };
          });

        console.log(`[네비게이션] 최종 ${safeMenuItems.length}개 메뉴 설정 완료`);
        setMenus(safeMenuItems);
        return;
      }

      // 🎯 STEP 4: 모든 조회 결과가 비어있으면 빈 메뉴
      console.log('[네비게이션] 권한 조회 결과 없음 - 빈 메뉴 설정');
      setMenus([]);

    } catch (error) {
      console.error('[네비게이션] 메뉴 로딩 중 예외 발생:', error);
      setMenus([]);
    } finally {
      setMenuLoading(false);
    }
  }, []);

  // 🎯 안전한 경로별 표시명 매핑
  const getMenuDisplayName = useCallback((path: string) => {
    if (!path || typeof path !== 'string') return '메뉴';
    
    const cleanPath = path.trim();
    const pathNames: Record<string, string> = {
      '/': '홈',
      '/admin': '관리자 대시보드',
      '/admin/analysis': '데이터 분석',
      '/admin/summary': '요약 리포트',
      '/admin/monitoring': '모니터링',
      '/studio-schedules': '스튜디오 스케줄',
      '/academy-schedules': '학원 스케줄',
      '/all-schedules': '전체 스케줄',
      '/permissions': '권한 관리',
      '/admin/permissions': '권한 관리',
      '/admin/professors': '교수 관리',
      '/admin/user-management': '사용자 관리',
      '/shooter/ShooterDashboard': '촬영자 대시보드',
      '/shooter/schedule-check': '스케줄 확인',
      '/professor/login': '교수 로그인'
    };
    
    return pathNames[cleanPath] || cleanPath.replace(/^\//, '').replace(/-/g, ' ') || '메뉴';
  }, []);

  // 🎯 안전한 경로별 카테고리 매핑
  const getMenuCategory = useCallback((path: string) => {
    if (!path || typeof path !== 'string') return '기본';
    
    const cleanPath = path.trim().toLowerCase();
    if (cleanPath.startsWith('/admin')) return '관리';
    if (cleanPath.includes('schedule')) return '스케줄';
    if (cleanPath.startsWith('/shooter')) return '촬영';
    return '기본';
  }, []);

  // 화면 크기 기준 모바일 여부 결정 (안전한 처리)
  useEffect(() => {
    const checkMobile = () => {
      try {
        setIsMobile(window.innerWidth < 768);
      } catch (error) {
        console.warn('[네비게이션] 화면 크기 체크 실패:', error);
        setIsMobile(false);
      }
    };
    
    checkMobile();
    
    try {
      window.addEventListener('resize', checkMobile);
      return () => window.removeEventListener('resize', checkMobile);
    } catch (error) {
      console.warn('[네비게이션] 리사이즈 이벤트 등록 실패:', error);
    }
  }, []);

  // 안전한 사용자 정보 업데이트 함수
  const updateUserInfo = useCallback(async () => {
    try {
      // localStorage 안전하게 접근
      let username, role, displayName;
      
      try {
        username = localStorage.getItem('userName') ||
                  localStorage.getItem('userEmail') ||
                  localStorage.getItem('username') ||
                  '사용자';
        role = safeUserRole(localStorage.getItem('userRole') || 'staff');
        displayName = getRoleDisplayName(role);
      } catch (error) {
        console.warn('[네비게이션] localStorage 접근 실패:', error);
        username = '사용자';
        role = 'staff';
        displayName = '직원';
      }
      
      let finalUsername = username;
      if (role === 'professor') {
        try {
          if (username.includes('@professor.temp')) {
            finalUsername = localStorage.getItem('professorName') || 
                            localStorage.getItem('userName') || '교수';
          }
        } catch (error) {
          console.warn('[네비게이션] 교수 이름 처리 실패:', error);
          finalUsername = '교수';
        }
      }
      
      const newUserInfo = { 
        username: finalUsername, 
        role, 
        displayName 
      };
      
      setUserInfo(prev => {
        if (JSON.stringify(prev) !== JSON.stringify(newUserInfo)) {
          return newUserInfo;
        }
        return prev;
      });

      // 사용자 정보 변경시 메뉴 로드
      await loadUserMenus(role);
      
    } catch (error) {
      console.error('[네비게이션] 사용자 정보 로딩 오류:', error);
      setUserInfo({ username: '사용자', role: 'staff', displayName: '직원' });
      setMenus([]);
    }
  }, [loadUserMenus]);

  // AuthContext와 동기화된 사용자 정보 업데이트 (안전한 처리)
  useEffect(() => {
    updateUserInfo();

    const handleStorageChange = (e: StorageEvent) => {
      try {
        if (e.key && ['userName', 'userRole', 'userEmail'].includes(e.key)) {
          updateUserInfo();
        }
      } catch (error) {
        console.warn('[네비게이션] Storage 변경 처리 실패:', error);
      }
    };

    const handlePermissionChange = () => {
      try {
        updateUserInfo();
      } catch (error) {
        console.warn('[네비게이션] 권한 변경 처리 실패:', error);
      }
    };

    try {
      window.addEventListener('storage', handleStorageChange);
      window.addEventListener('permission-force-refresh', handlePermissionChange);
      window.addEventListener('permissions-updated', handlePermissionChange);
      
      return () => {
        try {
          window.removeEventListener('storage', handleStorageChange);
          window.removeEventListener('permission-force-refresh', handlePermissionChange);
          window.removeEventListener('permissions-updated', handlePermissionChange);
        } catch (error) {
          console.warn('[네비게이션] 이벤트 리스너 제거 실패:', error);
        }
      };
    } catch (error) {
      console.warn('[네비게이션] 이벤트 리스너 등록 실패:', error);
    }
  }, [user, session, updateUserInfo]);

  const isCurrentPath = useCallback((path: string) => {
    try {
      return router.pathname === path;
    } catch {
      return false;
    }
  }, [router.pathname]);
  
  const isSubmenuActive = useCallback((items?: MenuItem[]) => {
    try {
      return items?.some(item => router.pathname === item.path) || false;
    } catch {
      return false;
    }
  }, [router.pathname]);

  const handleLogout = useCallback(() => {
    try {
      if (!confirm('정말 로그아웃하시겠습니까?')) return;
      
      const loadingOverlay = document.createElement('div');
      loadingOverlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); color: white; z-index: 9999;
        display: flex; justify-content: center; align-items: center;
        font-size: 18px; font-weight: bold;
      `;
      loadingOverlay.textContent = '로그아웃 처리 중...';
      document.body.appendChild(loadingOverlay);
      
      // React 상태 정리
      setUserInfo({ username: '', role: 'staff', displayName: '' });
      setMenus([]);
      setIsOpen(false);
      setOpenSubmenu(null);
      setMenuLoading(false);
      
      // 안전한 데이터 정리
      const keysToRemove = [
        'userRole', 'userEmail', 'userName', 'userId', 
        'isLoggedIn', 'professorName', 'isAuthenticated'
      ];
      
      keysToRemove.forEach(key => {
        try {
          localStorage.removeItem(key);
          sessionStorage.removeItem(key);
        } catch (error) {
          console.warn(`[로그아웃] ${key} 삭제 실패:`, error);
        }
      });
      
      // 쿠키 정리
      const cookiesToDelete = ['userRole', 'isLoggedIn', 'userName'];
      cookiesToDelete.forEach(name => {
        try {
          document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax`;
          document.cookie = `${name}=; path=/; domain=${window.location.hostname}; expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax`;
        } catch (error) {
          console.warn(`[로그아웃] 쿠키 ${name} 삭제 실패:`, error);
        }
      });
      
      // Supabase 데이터 정리
      try {
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('sb-')) localStorage.removeItem(key);
        });
        
        Object.keys(sessionStorage).forEach(key => {
          if (key.startsWith('sb-')) sessionStorage.removeItem(key);
        });
      } catch (error) {
        console.warn('[로그아웃] Supabase 데이터 정리 실패:', error);
      }
      
      // 페이지 이동
      window.location.replace('/login');
      
    } catch (error) {
      console.error('[로그아웃] 로그아웃 처리 실패:', error);
      // 오류 발생해도 무조건 이동
      window.location.replace('/login');
    }
  }, []);

  const getUserRoleColor = useCallback(() => {
    try {
      const roleInfo = getRoleInfo(userInfo.role);
      return roleInfo.color;
    } catch {
      return '#6b7280';
    }
  }, [userInfo.role]);

  const handleSubmenuToggle = useCallback((menuId: string) => 
    setOpenSubmenu(prev => prev === menuId ? null : menuId), []);

  const handleUserNameClick = useCallback(() => {
    try {
      router.push('/settings/profile');
    } catch (error) {
      console.error('프로필 페이지 이동 실패:', error);
    }
  }, [router]);

  // 로딩 중일 때
  if (loading || menuLoading) {
    return (
      <nav style={{ background: 'var(--bg-secondary)', height: '60px' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          height: '100%', 
          padding: '0 20px' 
        }}>
          <div style={{ 
            fontSize: '20px', 
            fontWeight: 'bold', 
            color: 'var(--accent-color)' 
          }}>
            촬영스케줄 관리 시스템
          </div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            color: 'var(--text-secondary)' 
          }}>
            <div style={{ 
              width: '16px', 
              height: '16px', 
              border: '2px solid var(--accent-color)', 
              borderTop: '2px solid transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            <span>메뉴 권한 확인 중...</span>
          </div>
        </div>
      </nav>
    );
  }

  // 메뉴가 없을 때
  if (!menus || menus.length === 0) {
    return (
      <nav style={{ 
        background: 'var(--bg-secondary)', 
        height: '60px',
        borderBottom: '1px solid var(--border-color)' 
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          height: '100%', 
          padding: '0 20px',
          maxWidth: '1600px',
          margin: '0 auto'
        }}>
          <div style={{ 
            fontSize: '20px', 
            fontWeight: 'bold', 
            color: 'var(--accent-color)' 
          }}>
            촬영스케줄 관리 시스템
          </div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            color: 'var(--text-secondary)' 
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: '2px'
            }}>
              <span style={{ fontSize: '13px', fontWeight: '600' }}>
                {userInfo.username}
              </span>
              <span style={{ fontSize: '11px', color: getUserRoleColor() }}>
                {userInfo.displayName}
              </span>
            </div>
            <div style={{ 
              width: '1px', 
              height: '20px', 
              backgroundColor: 'var(--border-color)' 
            }}></div>
            <span style={{ 
              fontSize: '12px', 
              color: '#f59e0b',
              fontWeight: '500' 
            }}>
              접근 권한 없음
            </span>
            <button
              onClick={handleLogout}
              style={{
                padding: '6px 12px',
                backgroundColor: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500'
              }}
            >
              로그아웃
            </button>
          </div>
        </div>
      </nav>
    );
  }

  // 정상적인 메뉴가 있을 때
  return (
    <nav style={{ 
      background: 'var(--bg-secondary)', 
      borderBottom: '1px solid var(--border-color)', 
      position: 'sticky', 
      top: 0, 
      zIndex: 1000 
    }}>
      <div style={{ 
        maxWidth: '1600px', 
        margin: '0 auto', 
        padding: '0 20px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        height: '60px' 
      }}>
        {/* 브랜드 영역 */}
        <div style={{ 
          fontSize: '20px', 
          fontWeight: 'bold', 
          color: 'var(--accent-color)', 
          cursor: 'pointer'
        }} onClick={() => router.push('/')}>
          촬영스케줄 관리 시스템
        </div>

        {/* 데스크탑 메뉴 */}
        <div style={{ display: !isMobile ? 'flex' : 'none', alignItems: 'center' }}>
          {menus.map(menu => (
            <div key={menu.id} style={{ position: 'relative' }}>
              {!menu.children ? (
                <button
                  onClick={() => router.push(menu.path)}
                  style={{
                    padding: '12px 16px',
                    background: isCurrentPath(menu.path) ? 'var(--accent-color)' : 'transparent',
                    color: isCurrentPath(menu.path) ? 'white' : 'var(--text-primary)',
                    border: 'none', 
                    cursor: 'pointer', 
                    fontSize: '14px', 
                    fontWeight: '500',
                    borderRadius: '6px',
                    transition: 'all 0.2s'
                  }}
                  title={menu.category ? `${menu.category} - ${menu.name}` : menu.name}
                  onMouseEnter={(e) => {
                    if (!isCurrentPath(menu.path)) {
                      (e.target as HTMLButtonElement).style.backgroundColor = 'var(--bg-primary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isCurrentPath(menu.path)) {
                      (e.target as HTMLButtonElement).style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  {menu.name}
                </button>
              ) : (
                <div 
                  onMouseEnter={() => setOpenSubmenu(menu.id)} 
                  onMouseLeave={() => setOpenSubmenu(null)} 
                  style={{ position: 'relative' }}
                >
                  <button
                    style={{
                      padding: '12px 16px',
                      background: isSubmenuActive(menu.children) ? 'var(--accent-color)' : 'transparent',
                      color: isSubmenuActive(menu.children) ? 'white' : 'var(--text-primary)',
                      border: 'none', 
                      cursor: 'pointer', 
                      fontSize: '14px', 
                      fontWeight: '500',
                      borderRadius: '6px',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {menu.name}
                    <span style={{ 
                      fontSize: '10px',
                      transform: openSubmenu === menu.id ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s'
                    }}>
                      ▼
                    </span>
                  </button>
                  {openSubmenu === menu.id && (
                    <div style={{
                      position: 'absolute', 
                      top: '100%', 
                      left: 0,
                      background: 'var(--bg-secondary)', 
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px', 
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)', 
                      minWidth: '200px', 
                      zIndex: 1001,
                      overflow: 'hidden'
                    }}>
                      {menu.children.map(item => (
                        <button
                          key={item.path}
                          onClick={() => {
                            router.push(item.path);
                            setOpenSubmenu(null);
                          }}
                          style={{
                            width: '100%', 
                            padding: '12px 16px',
                            background: isCurrentPath(item.path) ? 'var(--accent-color)' : 'transparent',
                            color: isCurrentPath(item.path) ? 'white' : 'var(--text-primary)',
                            border: 'none', 
                            textAlign: 'left', 
                            cursor: 'pointer', 
                            fontSize: '14px',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            if (!isCurrentPath(item.path)) {
                              (e.target as HTMLButtonElement).style.backgroundColor = 'var(--bg-primary)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isCurrentPath(item.path)) {
                              (e.target as HTMLButtonElement).style.backgroundColor = 'transparent';
                            }
                          }}
                        >
                          {item.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* 사용자 정보 */}
          <div 
            onClick={handleUserNameClick}
            style={{
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              padding: '6px 12px',
              background: 'var(--bg-primary)', 
              border: '1px solid var(--border-color)',
              borderRadius: '8px', 
              marginLeft: '16px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent-color)';
              (e.currentTarget as HTMLElement).style.color = 'white';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-primary)';
              (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
            }}
            title="계정 설정으로 이동"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              <span style={{ 
                fontSize: '13px', 
                fontWeight: '600', 
                color: 'inherit'
              }}>
                {userInfo.username}
              </span>
              <span style={{ 
                fontSize: '10px', 
                fontWeight: '500', 
                color: getUserRoleColor() 
              }}>
                {userInfo.displayName}
              </span>
            </div>
            <span style={{ fontSize: '12px', opacity: 0.7 }}>설정</span>
          </div>

          {/* 로그아웃 버튼 */}
          <button
            onClick={handleLogout}
            style={{
              padding: '8px 12px', 
              background: '#dc2626', 
              color: 'white', 
              border: 'none',
              borderRadius: '8px', 
              cursor: 'pointer', 
              fontSize: '14px', 
              marginLeft: '8px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor = '#b91c1c';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor = '#dc2626';
            }}
            title="로그아웃"
          >
            로그아웃
          </button>
        </div>

        {/* 모바일 메뉴 버튼 */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            display: isMobile ? 'block' : 'none',
            background: 'none', 
            border: 'none', 
            fontSize: '24px', 
            cursor: 'pointer',
            color: 'var(--text-primary)',
            padding: '8px',
            borderRadius: '6px',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = 'var(--bg-primary)';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = 'transparent';
          }}
        >
          {isOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* 모바일 메뉴 */}
      {isOpen && isMobile && (
        <div style={{
          background: 'var(--bg-secondary)', 
          borderTop: '1px solid var(--border-color)',
          padding: '20px', 
          maxHeight: '80vh', 
          overflowY: 'auto'
        }}>
          {/* 모바일용 사용자 정보 */}
          <div 
            onClick={handleUserNameClick}
            style={{
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px', 
              padding: '12px',
              background: 'var(--bg-primary)', 
              border: '1px solid var(--border-color)',
              borderRadius: '8px', 
              marginBottom: '16px',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
              <span style={{ 
                fontSize: '14px', 
                fontWeight: '600', 
                color: 'var(--text-primary)' 
              }}>
                {userInfo.username}
              </span>
              <span style={{ 
                fontSize: '12px', 
                fontWeight: '500', 
                color: getUserRoleColor() 
              }}>
                {userInfo.displayName}
              </span>
            </div>
            <span style={{ fontSize: '14px', opacity: 0.7 }}>설정</span>
          </div>

          {/* 모바일 메뉴 목록 */}
          {menus.map(menu => (
            <div key={menu.id} style={{ marginBottom: '8px' }}>
              {!menu.children ? (
                <button
                  onClick={() => { router.push(menu.path); setIsOpen(false); }}
                  style={{
                    width: '100%', 
                    padding: '12px',
                    background: isCurrentPath(menu.path) ? 'var(--accent-color)' : 'var(--bg-primary)',
                    color: isCurrentPath(menu.path) ? 'white' : 'var(--text-primary)',
                    border: 'none', 
                    borderRadius: '8px', 
                    textAlign: 'left',
                    cursor: 'pointer', 
                    fontSize: '14px'
                  }}
                >
                  {menu.name}
                </button>
              ) : (
                <div>
                  <button
                    onClick={() => handleSubmenuToggle(menu.id)}
                    style={{
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      width: '100%', 
                      padding: '12px',
                      background: isSubmenuActive(menu.children) ? 'var(--accent-color)' : 'var(--bg-primary)',
                      color: isSubmenuActive(menu.children) ? 'white' : 'var(--text-primary)',
                      border: 'none', 
                      borderRadius: '8px', 
                      textAlign: 'left',
                      cursor: 'pointer', 
                      fontSize: '14px'
                    }}
                  >
                    <span>{menu.name}</span>
                    <span style={{ fontSize: '12px' }}>
                      {openSubmenu === menu.id ? '▲' : '▼'}
                    </span>
                  </button>
                  {openSubmenu === menu.id && (
                    <div style={{ marginTop: '8px', marginLeft: '16px' }}>
                      {menu.children.map(item => (
                        <button
                          key={item.path}
                          onClick={() => { 
                            router.push(item.path); 
                            setIsOpen(false); 
                          }}
                          style={{
                            width: '100%', 
                            padding: '10px 12px', 
                            marginBottom: '4px',
                            background: isCurrentPath(item.path) ? 'var(--accent-color)' : 'transparent',
                            color: isCurrentPath(item.path) ? 'white' : 'var(--text-secondary)',
                            border: '1px solid var(--border-color)', 
                            borderRadius: '6px', 
                            textAlign: 'left',
                            cursor: 'pointer', 
                            fontSize: '13px'
                          }}
                        >
                          {item.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* 모바일 로그아웃 버튼 */}
          <button
            onClick={handleLogout}
            style={{
              width: '100%', 
              padding: '12px',
              background: '#dc2626', 
              color: 'white', 
              border: 'none',
              borderRadius: '8px', 
              cursor: 'pointer', 
              marginTop: '16px',
              fontSize: '14px',
              fontWeight: '500'
            }}
            title="로그아웃"
          >
            로그아웃
          </button>
        </div>
      )}

      {/* CSS 애니메이션 */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </nav>
  );
}
