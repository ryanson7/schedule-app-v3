// utils/roleSystem.ts (완전 수정 버전)
import { UserRoleType } from '../types/users';
import { supabase } from './supabaseClient';

// 역할 정보는 유지 (색상, 레벨 등)
export const ROLES = {
  system_admin: {
    name: '시스템 관리자',
    color: '#dc2626',
    level: 100,
    description: '모든 시스템 권한',
    permissions: ['*']
  },
  schedule_admin: {
    name: '스케줄 관리자', 
    color: '#2563eb',
    level: 80,
    description: '스케줄 및 기본 관리 업무',
    permissions: ['dashboard.view', 'schedules.manage', 'members.manage']
  },
  academy_manager: {
    name: '아카데미 매니저',
    color: '#ea580c',
    level: 60,
    description: '아카데미 관리 권한',
    permissions: ['academy.manage']
  },
  online_manager: {
    name: '온라인 매니저',
    color: '#0891b2',
    level: 60,
    description: '온라인 강의 관리',
    permissions: ['online.manage']
  },
  professor: {
    name: '교수',
    color: '#7c3aed',
    level: 40,
    description: '교수 스케줄 권한',
    permissions: ['professor.schedule']
  },
  shooter: {
    name: '촬영자',
    color: '#16a34a',
    level: 30,
    description: '촬영자 대시보드',
    permissions: ['shooter.dashboard', 'shooter.tracking']
  },
  staff: {
    name: '직원',
    color: '#6b7280',
    level: 10,
    description: '기본 직원 권한',
    permissions: ['profile.view']
  }
} as const;

// 🚨 하드코딩 메뉴 완전 제거!
// export const ROLE_MENUS = { ... } // ← 삭제!

// ✅ 동적 메뉴 시스템으로 완전 전환
export async function getUserMenus(userRole: UserRoleType) {
  console.log(`🔄 ${ROLES[userRole]?.name || userRole} - 동적 메뉴 로딩...`);
  
  try {
    // 1단계: DB에서 직접 메뉴 권한 조회
    const { data: menuPermissions, error } = await supabase
      .from('menu_permissions')
      .select('*')
      .eq('user_role', userRole)
      .eq('is_visible', true)
      .order('menu_order', { ascending: true });

    if (error) {
      console.error('메뉴 권한 조회 오류:', error);
      return getDefaultMenus(userRole); // 폴백
    }

    if (menuPermissions && menuPermissions.length > 0) {
      const menus = convertPermissionsToMenus(menuPermissions);
      console.log(`✅ DB 메뉴 ${menus.length}개 로드 완료`);
      return menus;
    }

    // 2단계: 최종 폴백 메뉴
    console.log('[폴백메뉴] 기본 메뉴 사용');
    return getDefaultMenus(userRole);

  } catch (error) {
    console.error('[메뉴오류] 메뉴 로딩 실패:', error);
    return getDefaultMenus(userRole); // 최종 폴백
  }
}

// 🛡️ 폴백용 기본 메뉴 (드롭다운 구조)
function getDefaultMenus(userRole: UserRoleType) {
  const basicMenus = [
    {
      id: 'home',
      name: '홈',
      path: '/',
      icon: 'Home',
      category: '기본',
      order: 1
    }
  ];

  // 역할별 드롭다운 메뉴 구조
  if (userRole === 'system_admin' || userRole === 'schedule_admin') {
    basicMenus.push(
      {
        id: 'schedules',
        name: '스케줄 관리',
        path: '#',
        icon: 'Calendar',
        category: '스케줄',
        order: 2,
        children: [
          { id: 'all-schedules', name: '전체 스케줄', path: '/all-schedules', icon: 'List' },
          { id: 'studio-schedules', name: '스튜디오 스케줄', path: '/studio-schedules', icon: 'Video' },
          { id: 'academy-schedules', name: '아카데미 스케줄', path: '/academy-schedules', icon: 'School' }
        ]
      },
      {
        id: 'admin',
        name: '시스템 관리',
        path: '#',
        icon: 'Settings',
        category: '관리',
        order: 3,
        children: [
          { id: 'admin-dashboard', name: '관리자 대시보드', path: '/admin', icon: 'BarChart' },
          { id: 'user-management', name: '사용자 관리', path: '/admin/users', icon: 'Users' },
          { id: 'permissions', name: '권한 관리', path: '/admin/permissions', icon: 'Shield' }
        ]
      }
    );
  }

  if (userRole === 'shooter') {
    basicMenus.push({
      id: 'shooter-dashboard',
      name: '촬영자 대시보드',
      path: '/shooter/dashboard',
      icon: 'Camera',
      category: '촬영',
      order: 2
    });
  }

  if (userRole === 'professor') {
    basicMenus.push({
      id: 'professor-schedule',
      name: '내 스케줄',
      path: '/studio-schedules',
      icon: 'Calendar',
      category: '교수',
      order: 2
    });
  }

  console.log(`⚠️ 폴백 메뉴 ${basicMenus.length}개 사용`);
  return basicMenus;
}

// 🔄 DB 권한을 메뉴 구조로 변환 (드롭다운 지원)
function convertPermissionsToMenus(permissions: any[]) {
  const menuMap = new Map();
  const rootMenus = [];

  permissions.forEach(perm => {
    const menu = {
      id: perm.menu_id,
      name: perm.menu_name,
      path: perm.menu_path || `/${perm.menu_id}`,
      icon: perm.menu_icon || 'FileText',
      category: perm.category || '기본',
      order: perm.menu_order || 99,
      isVisible: perm.is_visible
    };

    if (perm.parent_menu) {
      // 자식 메뉴 처리 (드롭다운 아이템)
      const parent = menuMap.get(perm.parent_menu);
      if (parent) {
        if (!parent.children) parent.children = [];
        parent.children.push(menu);
      }
    } else {
      // 루트 메뉴
      rootMenus.push(menu);
      menuMap.set(menu.id, menu);
    }
  });

  // 자식 메뉴 정렬
  menuMap.forEach(menu => {
    if (menu.children) {
      menu.children.sort((a, b) => (a.order || 99) - (b.order || 99));
    }
  });

  return rootMenus.sort((a, b) => (a.order || 99) - (b.order || 99));
}

// ✅ 페이지 접근 권한 (동적)
export async function canAccessPage(userRole: UserRoleType, pagePath: string): Promise<boolean> {
  console.log(`🔍 ${userRole} - ${pagePath} 접근 권한 확인`);
  
  try {
    if (userRole === 'system_admin') {
      return true; // 시스템 관리자는 모든 페이지 접근 가능
    }

    const { data, error } = await supabase
      .from('permissions')
      .select('can_access')
      .eq('user_role', userRole)
      .eq('page_path', pagePath)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('권한 조회 오류:', error);
      return false;
    }

    const hasAccess = data?.can_access || false;
    console.log(`${hasAccess ? '✅' : '❌'} ${userRole} - ${pagePath}: ${hasAccess ? '허용' : '차단'}`);
    return hasAccess;

  } catch (error) {
    console.error('권한 확인 실패:', error);
    return false;
  }
}

// 🎯 역할 정보 가져오기
export function getRoleInfo(role: UserRoleType) {
  return ROLES[role] || {
    name: role,
    color: '#6b7280',
    level: 0,
    description: '알 수 없는 역할'
  };
}
