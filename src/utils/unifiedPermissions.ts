import { supabase } from './supabaseClient';

interface MenuPermission {
  id: number;
  user_role: string;
  menu_id: string;
  menu_name: string;
  menu_path: string | null;
  menu_icon: string | null;
  category: string;
  menu_order: number;
  parent_menu: string | null;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

// 통합 권한 체크 (메뉴 + 페이지 접근)
export const checkAccess = async (userRole: string, path: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('menu_permissions')
      .select('is_visible')
      .eq('user_role', userRole)
      .eq('menu_path', path)
      .single();

    if (error) {
      // 권한 설정이 없는 페이지는 기본 차단
      console.warn(`권한 설정 없음: ${userRole} -> ${path}`);
      return false;
    }

    return data?.is_visible || false;
  } catch (error) {
    console.error('권한 체크 오류:', error);
    return false;
  }
};

// 사용자별 메뉴 목록 조회 (네비게이션용)
export const getMenuItems = async (userRole: string): Promise<MenuPermission[]> => {
  try {
    const { data, error } = await supabase
      .from('menu_permissions')
      .select('*')
      .eq('user_role', userRole)
      .eq('is_visible', true)
      .not('menu_path', 'is', null) // menu_path가 null이 아닌 것만
      .order('menu_order', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('메뉴 조회 오류:', error);
    return [];
  }
};

// 카테고리별 메뉴 그룹핑
export const getMenusByCategory = async (userRole: string) => {
  try {
    const menuItems = await getMenuItems(userRole);
    
    const groupedMenus: { [category: string]: MenuPermission[] } = {};
    
    menuItems.forEach(menu => {
      const category = menu.category || '기본';
      if (!groupedMenus[category]) {
        groupedMenus[category] = [];
      }
      groupedMenus[category].push(menu);
    });

    return groupedMenus;
  } catch (error) {
    console.error('카테고리별 메뉴 그룹핑 오류:', error);
    return {};
  }
};

// 모든 권한 조회 (관리용)
export const getAllPermissions = async (): Promise<MenuPermission[]> => {
  try {
    const { data, error } = await supabase
      .from('menu_permissions')
      .select('*')
      .order('user_role', { ascending: true })
      .order('category', { ascending: true })
      .order('menu_order', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('권한 목록 조회 오류:', error);
    return [];
  }
};

// 권한 업데이트
export const updatePermission = async (id: number, updates: Partial<MenuPermission>): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('menu_permissions')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('권한 업데이트 오류:', error);
    return false;
  }
};

// 새 권한 추가
export const addPermission = async (permission: Omit<MenuPermission, 'id' | 'created_at' | 'updated_at'>): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('menu_permissions')
      .insert([{
        ...permission,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }]);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('권한 추가 오류:', error);
    return false;
  }
};

// 권한 삭제
export const deletePermission = async (id: number): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('menu_permissions')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('권한 삭제 오류:', error);
    return false;
  }
};

// 공개 페이지 확인
export const isPublicPage = (pathname: string): boolean => {
  const publicPages = [
    '/',
    '/login',
    '/register', 
    '/about',
    '/contact',
    '/terms',
    '/privacy'
  ];
  
  return publicPages.includes(pathname);
};
