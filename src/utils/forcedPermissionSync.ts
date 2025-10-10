// utils/forcedPermissionSync.ts - 강제 실시간 동기화
import { supabase } from './supabaseClient';
import { emitPermissionChange } from './permissionUtils';
import type { UserRoleType } from '../types/users';

/**
 * 🔥 강제 권한 동기화 매니저
 * 권한 변경 시 모든 시스템에 즉시 반영
 */
export class ForcedPermissionSync {
  
  /**
   * 메뉴 가시성 토글 + 즉시 반영
   */
  async toggleMenuVisibility(
    permissionId: number | string,
    userRole: UserRoleType,
    menuPath: string,
    currentVisible: boolean
  ): Promise<boolean> {
    try {
      console.log(`🔥 강제 동기화: ${menuPath} 가시성 변경 (${userRole})`);
      
      // 1. Supabase 업데이트
      if (typeof permissionId === 'number') {
        const { error } = await supabase
          .from('menu_permissions')
          .update({ 
            is_visible: !currentVisible,
            updated_at: new Date().toISOString()
          })
          .eq('id', permissionId);
          
        if (error) throw error;
      }

      // 2. 동적 시스템 강제 업데이트
      this.updateDynamicSystem(userRole, menuPath, !currentVisible);

      // 3. 모든 캐시 즉시 클리어
      this.forceClusterCache();

      // 4. 실시간 이벤트 발송
      emitPermissionChange({
        type: 'visibility_changed',
        role: userRole,
        path: menuPath,
        visible: !currentVisible,
        timestamp: Date.now()
      });

      // 5. 페이지 강제 새로고침 (옵션)
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('permission-force-refresh'));
      }, 100);

      console.log(`✅ 강제 동기화 완료: ${menuPath} → ${!currentVisible}`);
      return true;
      
    } catch (error) {
      console.error('❌ 강제 동기화 실패:', error);
      return false;
    }
  }

  /**
   * 메뉴 추가 + 즉시 반영
   */
  async addMenuPermission(
    userRole: UserRoleType,
    menuPath: string,
    menuName: string,
    menuIcon?: string
  ): Promise<boolean> {
    try {
      console.log(`🔥 메뉴 추가 동기화: ${menuPath} (${userRole})`);
      
      // 1. Supabase에 추가
      const { data, error } = await supabase
        .from('menu_permissions')
        .insert({
          user_role: userRole,
          menu_id: menuPath.replace(/\//g, '_'),
          menu_name: menuName,
          menu_path: menuPath,
          menu_icon: menuIcon || '📄',
          is_visible: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
        
      if (error) throw error;

      // 2. 동적 시스템에 추가
      this.addToDynamicSystem(userRole, menuPath, menuName, true);

      // 3. 강제 캐시 클리어
      this.forceClusterCache();

      // 4. 실시간 알림
      emitPermissionChange({
        type: 'menu_added',
        role: userRole,
        path: menuPath,
        name: menuName,
        timestamp: Date.now()
      });

      console.log(`✅ 메뉴 추가 완료: ${menuName}`);
      return true;
      
    } catch (error) {
      console.error('❌ 메뉴 추가 실패:', error);
      return false;
    }
  }

  /**
   * 메뉴 삭제 + 즉시 반영
   */
  async deleteMenuPermission(
    permissionId: number | string,
    userRole: UserRoleType,
    menuPath: string
  ): Promise<boolean> {
    try {
      console.log(`🔥 메뉴 삭제 동기화: ${menuPath} (${userRole})`);
      
      // 1. Supabase에서 삭제
      if (typeof permissionId === 'number') {
        const { error } = await supabase
          .from('menu_permissions')
          .delete()
          .eq('id', permissionId);
          
        if (error) throw error;
      }

      // 2. 동적 시스템에서 제거
      this.removeFromDynamicSystem(userRole, menuPath);

      // 3. 강제 캐시 클리어
      this.forceClusterCache();

      // 4. 실시간 알림
      emitPermissionChange({
        type: 'menu_deleted',
        role: userRole,
        path: menuPath,
        timestamp: Date.now()
      });

      console.log(`✅ 메뉴 삭제 완료: ${menuPath}`);
      return true;
      
    } catch (error) {
      console.error('❌ 메뉴 삭제 실패:', error);
      return false;
    }
  }

  /**
   * 동적 권한 시스템 강제 업데이트
   */
  private updateDynamicSystem(userRole: UserRoleType, menuPath: string, isVisible: boolean) {
    try {
      const storageKey = 'dynamic_permission_system';
      const existing = localStorage.getItem(storageKey);
      let data = existing ? JSON.parse(existing) : { roles: {}, menus: {} };
      
      if (!data.roles[userRole]) {
        data.roles[userRole] = { permissions: [] };
      }

      // 해당 메뉴 찾아서 업데이트
      const existingIndex = data.roles[userRole].permissions.findIndex((p: any) => 
        p.path === menuPath || p.menu_path === menuPath
      );

      if (existingIndex >= 0) {
        data.roles[userRole].permissions[existingIndex].is_visible = isVisible;
        data.roles[userRole].permissions[existingIndex].isVisible = isVisible;
      } else if (isVisible) {
        // 새로 추가
        data.roles[userRole].permissions.push({
          path: menuPath,
          menu_path: menuPath,
          is_visible: true,
          isVisible: true,
          updated_at: new Date().toISOString()
        });
      }

      localStorage.setItem(storageKey, JSON.stringify(data));
      console.log(`🔄 동적 시스템 업데이트: ${userRole}/${menuPath} → ${isVisible}`);
    } catch (error) {
      console.warn('동적 시스템 업데이트 실패:', error);
    }
  }

  /**
   * 동적 시스템에 메뉴 추가
   */
  private addToDynamicSystem(userRole: UserRoleType, menuPath: string, menuName: string, isVisible: boolean) {
    try {
      const storageKey = 'dynamic_permission_system';
      const existing = localStorage.getItem(storageKey);
      let data = existing ? JSON.parse(existing) : { roles: {}, menus: {} };
      
      if (!data.roles[userRole]) {
        data.roles[userRole] = { permissions: [] };
      }

      data.roles[userRole].permissions.push({
        path: menuPath,
        menu_path: menuPath,
        menu_name: menuName,
        name: menuName,
        is_visible: isVisible,
        isVisible: isVisible,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      localStorage.setItem(storageKey, JSON.stringify(data));
      console.log(`➕ 동적 시스템 추가: ${menuName}`);
    } catch (error) {
      console.warn('동적 시스템 추가 실패:', error);
    }
  }

  /**
   * 동적 시스템에서 메뉴 제거
   */
  private removeFromDynamicSystem(userRole: UserRoleType, menuPath: string) {
    try {
      const storageKey = 'dynamic_permission_system';
      const existing = localStorage.getItem(storageKey);
      if (!existing) return;

      let data = JSON.parse(existing);
      if (!data.roles[userRole]) return;

      data.roles[userRole].permissions = data.roles[userRole].permissions.filter((p: any) => 
        p.path !== menuPath && p.menu_path !== menuPath
      );

      localStorage.setItem(storageKey, JSON.stringify(data));
      console.log(`➖ 동적 시스템 제거: ${menuPath}`);
    } catch (error) {
      console.warn('동적 시스템 제거 실패:', error);
    }
  }

  /**
   * 모든 캐시 강제 클리어
   */
  private forceClusterCache() {
    try {
      // 1. 권한 시스템 캐시 클리어
      const { permissionManager } = require('./permissionUtils');
      if (permissionManager?.clearCache) {
        permissionManager.clearCache();
      }

      // 2. 통합 시스템 캐시 클리어
      const { unifiedPermissionSystem } = require('./unifiedPermissionSystem');
      if (unifiedPermissionSystem?.clearCache) {
        unifiedPermissionSystem.clearCache();
      }

      // 3. 브라우저 캐시 무효화
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => {
            if (name.includes('permission') || name.includes('menu')) {
              caches.delete(name);
            }
          });
        });
      }

      console.log(`🧹 모든 권한 캐시 강제 클리어 완료`);
    } catch (error) {
      console.warn('캐시 클리어 실패:', error);
    }
  }
}

// 싱글톤 인스턴스
export const forcedSync = new ForcedPermissionSync();
