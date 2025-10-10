// utils/unifiedPermissionSystem.ts - PAGE_PERMISSIONS 오류 해결 버전
import { supabase } from './supabaseClient';
import { dynamicPermissionSystem } from './dynamicPermissionSystem';
import { PAGE_PERMISSIONS } from './roleSystem';

// 통합 권한 시스템 설정
const UNIFIED_CONFIG = {
  useDynamic: true,
  useSupabase: true,
  useRoleSystem: true,
  priority: ['dynamic', 'supabase', 'roleSystem'] as const,
  cacheTimeout: 5 * 60 * 1000, // 5분
};

// 캐시 시스템
const cache = new Map<string, { data: any; timestamp: number }>();
const menuCache = new Map<string, { data: any; timestamp: number }>();

// 📋 통합 권한 시스템 초기화
export const initializeUnifiedSystem = async () => {
  console.log('🚀 통합 권한 시스템 초기화:', UNIFIED_CONFIG);
  
  try {
    // 동적 권한 시스템 초기화
    if (UNIFIED_CONFIG.useDynamic) {
      await dynamicPermissionSystem.initialize();
    }
    
    return true;
  } catch (error) {
    console.error('❌ 통합 권한 시스템 초기화 실패:', error);
    return false;
  }
};

// 🔍 통합 권한 체크
export const checkUnifiedPermission = async (
  userRole: string, 
  pagePath: string
): Promise<boolean> => {
  const cacheKey = `perm_${userRole}_${pagePath}`;
  
  // 캐시 확인
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey)!;
    if (Date.now() - cached.timestamp < UNIFIED_CONFIG.cacheTimeout) {
      return cached.data;
    }
    cache.delete(cacheKey);
  }

  try {
    // 우선순위에 따른 권한 체크
    for (const source of UNIFIED_CONFIG.priority) {
      let hasPermission = false;
      
      try {
        switch (source) {
          case 'dynamic':
            if (UNIFIED_CONFIG.useDynamic) {
              hasPermission = await dynamicPermissionSystem.checkPermission(userRole, pagePath);
              if (hasPermission) {
                console.log(`✅ 권한 체크 완료 [${source}]: ${userRole} → ${pagePath}: ${hasPermission}`);
                cache.set(cacheKey, { data: hasPermission, timestamp: Date.now() });
                return hasPermission;
              }
            }
            break;
            
          case 'supabase':
            if (UNIFIED_CONFIG.useSupabase) {
              hasPermission = await checkSupabasePermission(userRole, pagePath);
              if (hasPermission) {
                console.log(`✅ 권한 체크 완료 [${source}]: ${userRole} → ${pagePath}: ${hasPermission}`);
                cache.set(cacheKey, { data: hasPermission, timestamp: Date.now() });
                return hasPermission;
              }
            }
            break;
            
          case 'roleSystem':
            if (UNIFIED_CONFIG.useRoleSystem) {
              hasPermission = checkRoleSystemPermission(userRole, pagePath);
              if (hasPermission) {
                console.log(`✅ 권한 체크 완료 [${source}]: ${userRole} → ${pagePath}: ${hasPermission}`);
                cache.set(cacheKey, { data: hasPermission, timestamp: Date.now() });
                return hasPermission;
              }
            }
            break;
        }
      } catch (sourceError) {
        console.warn(`⚠️ ${source} 권한 체크 실패:`, sourceError);
        continue;
      }
    }
    
    // 모든 소스에서 권한이 없음
    cache.set(cacheKey, { data: false, timestamp: Date.now() });
    return false;
    
  } catch (error) {
    console.error('❌ 통합 권한 체크 오류:', error);
    return false;
  }
};

// 🗄️ Supabase 권한 체크
const checkSupabasePermission = async (userRole: string, pagePath: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('permissions')
      .select('can_access')
      .eq('user_role', userRole)
      .eq('page_path', pagePath)
      .eq('can_access', true)
      .limit(1)
      .single();

    if (error) {
      throw error;
    }

    return !!data;
  } catch (error) {
    return false;
  }
};

// 📋 역할 시스템 권한 체크 (안전한 PAGE_PERMISSIONS 접근)
const checkRoleSystemPermission = (userRole: string, pagePath: string): boolean => {
  try {
    // PAGE_PERMISSIONS 안전하게 접근
    if (!PAGE_PERMISSIONS || typeof PAGE_PERMISSIONS !== 'object') {
      console.warn('⚠️ PAGE_PERMISSIONS가 정의되지 않음, 기본 권한으로 처리');
      return userRole === 'system_admin'; // 시스템 관리자만 기본 허용
    }

    const rolePermissions = PAGE_PERMISSIONS[userRole as keyof typeof PAGE_PERMISSIONS];
    if (!rolePermissions || !Array.isArray(rolePermissions)) {
      return false;
    }

    return rolePermissions.includes(pagePath);
  } catch (error) {
    console.warn('⚠️ 역할 시스템 권한 체크 실패:', error);
    return false;
  }
};

// 📋 통합 메뉴 조회
export const getUserMenus = async (userRole: string): Promise<any[]> => {
  const cacheKey = `menu_${userRole}`;
  
  // 캐시 확인
  if (menuCache.has(cacheKey)) {
    const cached = menuCache.get(cacheKey)!;
    if (Date.now() - cached.timestamp < UNIFIED_CONFIG.cacheTimeout) {
      return cached.data;
    }
    menuCache.delete(cacheKey);
  }

  try {
    const allMenus: any[] = [];
    
    // 우선순위에 따른 메뉴 수집
    for (const source of UNIFIED_CONFIG.priority) {
      try {
        const sourceMenus = await getMenusBySource(source, userRole);
        if (sourceMenus && sourceMenus.length > 0) {
          allMenus.push(...sourceMenus);
        }
      } catch (sourceError) {
        console.warn(`⚠️ ${source} 메뉴 조회 실패:`, sourceError);
        continue;
      }
    }
    
    // 중복 제거 및 정렬
    const uniqueMenus = deduplicateMenus(allMenus);
    const sortedMenus = uniqueMenus.sort((a, b) => (a.order || 999) - (b.order || 999));
    
    console.log(`✅ 통합 메뉴 조회 완료: ${userRole} (${sortedMenus.length}개)`);
    
    // 캐시 저장
    menuCache.set(cacheKey, { data: sortedMenus, timestamp: Date.now() });
    
    return sortedMenus;
    
  } catch (error) {
    console.error('❌ 통합 메뉴 조회 오류:', error);
    return [];
  }
};

// 📋 소스별 메뉴 조회
const getMenusBySource = async (source: string, userRole: string): Promise<any[]> => {
  switch (source) {
    case 'dynamic':
      if (UNIFIED_CONFIG.useDynamic) {
        return await dynamicPermissionSystem.getMenusByRole(userRole);
      }
      break;
      
    case 'supabase':
      if (UNIFIED_CONFIG.useSupabase) {
        return await getSupabaseMenus(userRole);
      }
      break;
      
    case 'roleSystem':
      if (UNIFIED_CONFIG.useRoleSystem) {
        return getRoleSystemMenus(userRole);
      }
      break;
  }
  
  return [];
};

// 🗄️ Supabase 메뉴 조회
const getSupabaseMenus = async (userRole: string): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from('menu_permissions')
      .select('*')
      .eq('user_role', userRole)
      .eq('is_visible', true)
      .order('menu_order', { ascending: true });

    if (error) {
      throw error;
    }

    return data?.map(menu => ({
      id: menu.menu_id,
      name: menu.menu_name,
      path: menu.menu_path,
      icon: menu.menu_icon,
      category: menu.category,
      order: menu.menu_order,
      isVisible: menu.is_visible
    })) || [];
  } catch (error) {
    return [];
  }
};

// 📋 역할 시스템 메뉴 조회 (안전한 PAGE_PERMISSIONS 접근)
const getRoleSystemMenus = (userRole: string): any[] => {
  try {
    // PAGE_PERMISSIONS 안전하게 접근
    if (!PAGE_PERMISSIONS || typeof PAGE_PERMISSIONS !== 'object') {
      console.warn('⚠️ PAGE_PERMISSIONS가 정의되지 않음, 빈 메뉴 반환');
      return [];
    }

    const rolePermissions = PAGE_PERMISSIONS[userRole as keyof typeof PAGE_PERMISSIONS];
    if (!rolePermissions || !Array.isArray(rolePermissions)) {
      return [];
    }

    return rolePermissions.map((path, index) => ({
      id: `role-${userRole}-${index}`,
      name: getMenuDisplayName(path),
      path: path,
      category: getMenuCategory(path),
      order: index + 1,
      isVisible: true
    }));
  } catch (error) {
    console.warn('⚠️ 역할 시스템 메뉴 조회 실패:', error);
    return [];
  }
};

// 🎯 메뉴 중복 제거
const deduplicateMenus = (menus: any[]): any[] => {
  const seen = new Set<string>();
  return menus.filter(menu => {
    if (!menu || !menu.path) return false;
    if (seen.has(menu.path)) return false;
    seen.add(menu.path);
    return true;
  });
};

// 🎯 메뉴 표시명 생성
const getMenuDisplayName = (path: string): string => {
  if (!path || typeof path !== 'string') return '메뉴';
  
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
  
  return pathNames[path] || path.replace(/^\//, '').replace(/-/g, ' ') || '메뉴';
};

// 🎯 메뉴 카테고리 생성
const getMenuCategory = (path: string): string => {
  if (!path || typeof path !== 'string') return '기본';
  
  const cleanPath = path.toLowerCase();
  if (cleanPath.startsWith('/admin')) return '관리';
  if (cleanPath.includes('schedule')) return '스케줄';
  if (cleanPath.startsWith('/shooter')) return '촬영';
  return '기본';
};

// 📊 시스템 상태 조회
export const getUnifiedStatus = () => {
  return {
    config: UNIFIED_CONFIG,
    cacheSize: cache.size,
    menuCacheSize: menuCache.size,
    uptime: Date.now()
  };
};

// 🧹 캐시 정리
export const clearUnifiedCache = () => {
  cache.clear();
  menuCache.clear();
  console.log('🧹 통합 권한 시스템 캐시 정리 완료');
};

export default {
  initializeUnifiedSystem,
  checkUnifiedPermission,
  getUserMenus,
  getUnifiedStatus,
  clearUnifiedCache
};
