import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { checkAccess, isPublicPage } from '../utils/unifiedPermissions';

interface PageGuardState {
  isAuthorized: boolean | null;
  loading: boolean;
  error?: string;
}

export const usePageGuard = (): PageGuardState => {
  const router = useRouter();
  const [state, setState] = useState<PageGuardState>({
    isAuthorized: null,
    loading: true,
    error: undefined
  });

  useEffect(() => {
    checkPageAccess();
  }, [router.pathname]);

  const checkPageAccess = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: undefined }));

      // 공개 페이지 체크
      if (isPublicPage(router.pathname)) {
        setState({
          isAuthorized: true,
          loading: false
        });
        return;
      }

      // 사용자 역할 확인
      const userRole = localStorage.getItem('userRole');
      
      if (!userRole) {
        // 로그인하지 않은 경우 로그인 페이지로 리다이렉트
        console.log('사용자 미로그인, 로그인 페이지로 이동');
        router.push('/login');
        return;
      }

      // 권한 체크
      const hasAccess = await checkAccess(userRole, router.pathname);
      
      if (hasAccess) {
        setState({
          isAuthorized: true,
          loading: false
        });
      } else {
        console.warn(`접근 권한 없음: ${userRole} -> ${router.pathname}`);
        
        // 권한 없는 경우 홈으로 리다이렉트
        setState({
          isAuthorized: false,
          loading: false,
          error: '이 페이지에 접근할 권한이 없습니다.'
        });
        
        // 1초 후 홈으로 리다이렉트
        setTimeout(() => {
          router.push('/');
        }, 1500);
      }

    } catch (error) {
      console.error('페이지 접근 권한 체크 오류:', error);
      setState({
        isAuthorized: false,
        loading: false,
        error: '권한 확인 중 오류가 발생했습니다.'
      });
    }
  };

  return state;
};

// 특정 경로에 대한 권한 체크 (컴포넌트 내에서 사용)
export const usePermissionCheck = (requiredPath?: string) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkPermission();
  }, [requiredPath]);

  const checkPermission = async () => {
    try {
      setLoading(true);
      
      const userRole = localStorage.getItem('userRole');
      if (!userRole) {
        setHasPermission(false);
        return;
      }

      const path = requiredPath || window.location.pathname;
      const hasAccess = await checkAccess(userRole, path);
      setHasPermission(hasAccess);
      
    } catch (error) {
      console.error('권한 체크 오류:', error);
      setHasPermission(false);
    } finally {
      setLoading(false);
    }
  };

  return { hasPermission, loading, checkPermission };
};
