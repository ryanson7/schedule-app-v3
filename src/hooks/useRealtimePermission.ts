// hooks/useRealtimePermission.ts
import { useEffect, useCallback } from 'react';
import { onPermissionChange, offPermissionChange } from '../utils/permissionUtils';

export function useRealtimePermissionSync(onUpdate?: () => void) {
  const handlePermissionUpdate = useCallback((event: CustomEvent) => {
    console.log('🔄 실시간 권한 변경 감지:', event.detail);
    
    // 즉시 UI 업데이트
    if (onUpdate) {
      onUpdate();
    }
    
    // 필요시 페이지 새로고침
    if (event.detail.type === 'menu_deleted') {
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  }, [onUpdate]);

  // 강제 새로고침 이벤트
  const handleForceRefresh = useCallback(() => {
    console.log('🔥 강제 권한 새로고침');
    if (onUpdate) {
      onUpdate();
    }
  }, [onUpdate]);

  useEffect(() => {
    onPermissionChange(handlePermissionUpdate);
    window.addEventListener('permission-force-refresh', handleForceRefresh);
    
    return () => {
      offPermissionChange(handlePermissionUpdate);
      window.removeEventListener('permission-force-refresh', handleForceRefresh);
    };
  }, [handlePermissionUpdate, handleForceRefresh]);
}
