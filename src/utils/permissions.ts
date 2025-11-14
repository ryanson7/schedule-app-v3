// utils/permissions.ts
import { supabase } from './supabaseClient';

// 🔧 사용자 역할에 따른 권한 조회 (DB에서)
export const getRolePermissions = async (userRole: string): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('role_permissions')
      .select('menu_id')
      .eq('role', userRole)
      .eq('can_access', true);

    if (error) {
      console.error('권한 조회 실패:', error);
      return [];
    }

    const permissions = data?.map(item => item.menu_id) || [];
    console.log(`✅ ${userRole} 권한:`, permissions);
    return permissions;
    
  } catch (error) {
    console.error('권한 조회 중 오류:', error);
    return [];
  }
};

// 🔧 권한 기반 메뉴 필터링
export const getFilteredMenus = (menuConfig: any[], userPermissions: string[]) => {
  return menuConfig.map(category => ({
    ...category,
    children: category.children?.filter(item => userPermissions.includes(item.id)) || []
  })).filter(category => category.children.length > 0);
};

// 🔧 페이지 접근 권한 체크
export const canAccessPage = (userPermissions: string[], pageId: string): boolean => {
  return userPermissions.includes(pageId);
};

// 🔧 특정 경로에 대한 권한 체크
export const canAccessPath = (userPermissions: string[], pathname: string): boolean => {
  // 정확한 경로 매칭을 위해 모든 메뉴 아이템을 확인
  return userPermissions.some(permission => {
    // permission이 경로와 정확히 일치하는지 확인
    return pathname === `/${permission}` || pathname.startsWith(`/${permission}/`);
  });
};

// 🔧 권한 업데이트 (DB에)
export const updateRolePermission = async (role: string, menuId: string, canAccess: boolean): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('role_permissions')
      .upsert({
        role: role,
        menu_id: menuId,
        can_access: canAccess,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'role,menu_id'
      });

    if (error) {
      console.error('권한 업데이트 실패:', error);
      return false;
    }
    
    console.log('✅ 권한 업데이트 성공:', { role, menuId, canAccess });
    return true;
    
  } catch (error) {
    console.error('권한 업데이트 중 오류:', error);
    return false;
  }
};

// utils/permissions.ts 맨 아래에 추가

export const safeUserRole = (userRole: string | null | undefined): string => {
  if (!userRole) {
    return 'staff';
  }

  const normalized = userRole.toLowerCase();

  if (normalized === 'studio_manager') {
    return 'online_manager';
  }

  const validRoles = [
    'system_admin',
    'schedule_admin',
    'manager',
    'academy_manager',
    'online_manager',
    'professor',
    'shooter',
    'staff'
  ];

  return validRoles.includes(normalized) ? normalized : 'staff';
};

export const hasPermission = (userRole: string, resource: string, level: string = 'read'): boolean => {
  const role = safeUserRole(userRole);
  if (role === 'system_admin') return true;
  
  const permissions = {
    'schedule_admin': ['user_management', 'system_settings', 'academy_schedules', 'shooting_tasks'],
    'manager': ['user_management', 'academy_schedules', 'studio_management', 'shooting_tasks'],
    'academy_manager': ['academy_schedules'],
    'shooter': ['shooting_tasks']
  };
  
  return (permissions[role] || []).includes(resource);
};


// 🔧 모든 역할의 권한 조회
export const getAllRolePermissions = async (): Promise<Record<string, Record<string, boolean>>> => {
  try {
    const { data, error } = await supabase
      .from('role_permissions')
      .select('*')
      .order('role')
      .order('menu_id');

    if (error) {
      console.error('모든 권한 조회 실패:', error);
      return {};
    }

    // 역할별로 권한 그룹화
    const groupedPermissions: Record<string, Record<string, boolean>> = {};
    
    data?.forEach(perm => {
      if (!groupedPermissions[perm.role]) {
        groupedPermissions[perm.role] = {};
      }
      groupedPermissions[perm.role][perm.menu_id] = perm.can_access;
    });

    return groupedPermissions;
    
  } catch (error) {
    console.error('모든 권한 조회 중 오류:', error);
    return {};
  }
};

// 🔧 신규 메뉴 동기화 (시스템 관리자에게만 권한 부여)
export const syncMenusToDatabase = async (allMenus: any[]): Promise<boolean> => {
  try {
    console.log('🔄 메뉴 동기화 시작...');
    
    // system_admin에게 모든 메뉴 권한 부여
    const syncData = allMenus.map(menu => ({
      role: 'system_admin',
      menu_id: menu.id,
      can_access: true
    }));
    
    const { error } = await supabase
      .from('role_permissions')
      .upsert(syncData, {
        onConflict: 'role,menu_id'
      });
    
    if (error) {
      console.error('메뉴 동기화 실패:', error);
      return false;
    }
    
    console.log('✅ 메뉴 동기화 완료');
    return true;
    
  } catch (error) {
    console.error('메뉴 동기화 중 오류:', error);
    return false;
  }
};

export default {
  getRolePermissions,
  getFilteredMenus,
  canAccessPage,
  canAccessPath,
  updateRolePermission,
  getAllRolePermissions,
  syncMenusToDatabase
};
