// hooks/useUnifiedPermission.ts - 모든 시스템 통합
import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';

export function useUnifiedPermission(pagePath: string) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAllPermissions();
  }, [pagePath]);

  const checkAllPermissions = async () => {
    const userRole = localStorage.getItem('userRole');
    if (!userRole) {
      setHasPermission(false);
      setLoading(false);
      return;
    }

    try {
      // 🔥 모든 권한 시스템을 동시에 체크
      const [dbResult, menuResult, dynamicResult] = await Promise.all([
        // 1. 기존 permissions 테이블
        supabase
          .from('permissions')
          .select('can_access')
          .eq('user_role', userRole)
          .eq('page_path', pagePath)
          .single(),
        
        // 2. menu_permissions 테이블
        supabase
          .from('menu_permissions')
          .select('is_visible')
          .eq('user_role', userRole)
          .eq('menu_path', pagePath)
          .single(),
        
        // 3. 동적 권한 시스템
        Promise.resolve(checkDynamicPermission(userRole, pagePath))
      ]);

      // 우선순위: menu_permissions > permissions > 동적 시스템
      let hasAccess = false;
      
      if (!menuResult.error && menuResult.data?.is_visible) {
        hasAccess = true; // 메뉴에서 표시 허용
      } else if (!dbResult.error && dbResult.data?.can_access) {
        hasAccess = true; // DB에서 접근 허용
      } else if (dynamicResult) {
        hasAccess = true; // 동적 시스템에서 허용
      }

      console.log(`🔍 통합 권한 체크 결과: ${pagePath} → ${hasAccess}`);
      setHasPermission(hasAccess);
      
    } catch (error) {
      console.error('통합 권한 체크 실패:', error);
      setHasPermission(false);
    } finally {
      setLoading(false);
    }
  };

  const checkDynamicPermission = (userRole: string, pagePath: string): boolean => {
    try {
      const dynamicData = localStorage.getItem('dynamic_permission_system');
      if (!dynamicData) return false;
      
      const data = JSON.parse(dynamicData);
      const rolePermissions = data.roles?.[userRole]?.permissions || [];
      
      return rolePermissions.some((p: any) => 
        (p.menu_path === pagePath || p.path === pagePath) && p.is_visible === true
      );
    } catch {
      return false;
    }
  };

  // 권한 강제 새로고침 함수
  const refreshPermission = () => {
    setLoading(true);
    checkAllPermissions();
  };

  // 실시간 권한 변경 이벤트 리스너
  useEffect(() => {
    const handlePermissionChange = () => {
      console.log('🔄 권한 변경 감지 - 재체크');
      refreshPermission();
    };

    window.addEventListener('permission-force-refresh', handlePermissionChange);
    return () => window.removeEventListener('permission-force-refresh', handlePermissionChange);
  }, []);

  return { hasPermission, loading, refreshPermission };
}
