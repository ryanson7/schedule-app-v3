// utils/menuManager.ts
import { supabase } from './supabaseClient';
import { UserRoleType } from '../types/users';

export interface MenuData {
  id?: number;
  user_role: UserRoleType;
  menu_id: string;
  menu_name: string;
  menu_path: string;
  menu_icon?: string;
  category: string;
  menu_order: number;
  parent_menu?: string;
  is_visible: boolean;
}

export const menuManager = {
  // 메뉴 생성
  async createMenu(menuData: Omit<MenuData, 'id'>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('menu_permissions')
        .insert(menuData);

      if (error) throw error;
      console.log(`✅ 메뉴 생성: ${menuData.menu_name}`);
      return true;
    } catch (error) {
      console.error('메뉴 생성 오류:', error);
      return false;
    }
  },

  // 메뉴 업데이트
  async updateMenu(id: number, updates: Partial<MenuData>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('menu_permissions')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      console.log(`✅ 메뉴 업데이트: ID ${id}`);
      return true;
    } catch (error) {
      console.error('메뉴 업데이트 오류:', error);
      return false;
    }
  },

  // 메뉴 삭제
  async deleteMenu(id: number): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('menu_permissions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      console.log(`✅ 메뉴 삭제: ID ${id}`);
      return true;
    } catch (error) {
      console.error('메뉴 삭제 오류:', error);
      return false;
    }
  },

  // 역할별 메뉴 복사
  async copyMenusToRole(fromRole: UserRoleType, toRole: UserRoleType): Promise<boolean> {
    try {
      // 기존 메뉴 조회
      const { data: sourceMenus, error: fetchError } = await supabase
        .from('menu_permissions')
        .select('*')
        .eq('user_role', fromRole);

      if (fetchError) throw fetchError;

      if (!sourceMenus || sourceMenus.length === 0) {
        console.warn(`소스 역할 ${fromRole}에 메뉴가 없습니다.`);
        return false;
      }

      // 대상 역할 메뉴로 변환
      const newMenus = sourceMenus.map(menu => ({
        user_role: toRole,
        menu_id: menu.menu_id,
        menu_name: menu.menu_name,
        menu_path: menu.menu_path,
        menu_icon: menu.menu_icon,
        category: menu.category,
        menu_order: menu.menu_order,
        parent_menu: menu.parent_menu,
        is_visible: menu.is_visible
      }));

      // 새 메뉴 삽입
      const { error: insertError } = await supabase
        .from('menu_permissions')
        .insert(newMenus);

      if (insertError) throw insertError;

      console.log(`✅ 메뉴 복사 완료: ${fromRole} → ${toRole} (${newMenus.length}개)`);
      return true;
    } catch (error) {
      console.error('메뉴 복사 오류:', error);
      return false;
    }
  },

  // 메뉴 순서 재정렬
  async reorderMenus(roleType: UserRoleType, menuOrders: { id: number; order: number }[]): Promise<boolean> {
    try {
      const promises = menuOrders.map(({ id, order }) =>
        supabase
          .from('menu_permissions')
          .update({ menu_order: order })
          .eq('id', id)
          .eq('user_role', roleType)
      );

      const results = await Promise.all(promises);
      const hasError = results.some(result => result.error);

      if (hasError) {
        throw new Error('일부 메뉴 순서 변경에 실패했습니다.');
      }

      console.log(`✅ 메뉴 순서 재정렬 완료: ${roleType}`);
      return true;
    } catch (error) {
      console.error('메뉴 순서 재정렬 오류:', error);
      return false;
    }
  }
};
