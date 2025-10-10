import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { UserRoleType } from '../types/users';
import { safeUserRole } from '../utils/simplePermissions';
import MainNavigation from './MainNavigation';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const router = useRouter();
  const [userRole, setUserRole] = useState<UserRoleType>('staff');
  const [userName, setUserName] = useState('');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    if (typeof window !== 'undefined') {
      const role = localStorage.getItem('userRole');
      const name = localStorage.getItem('userName');
      
      if (role && name) {
        setUserRole(safeUserRole(role));
        setUserName(name);
      } else if (router.pathname !== '/login') {
        router.push('/login');
      }
    }
  }, [router.pathname]);

  // 로그인 페이지는 레이아웃 없이
  if (router.pathname === '/login') {
    return <>{children}</>;
  }

  // 클라이언트 로딩 중
  if (!isClient) {
    return <div>로딩 중...</div>;
  }

  // MainNavigation 추가된 완전한 레이아웃
  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      margin: '0',
      padding: '0'
    }}>
      {/* MainNavigation 헤더 */}
      <MainNavigation />
      
      {/* 메인 콘텐츠 */}
      <main style={{
        flex: 1,
        overflow: 'auto',
        padding: '0',
        margin: '0',
        backgroundColor: '#f8fafc'
      }}>
        {children}
      </main>
    </div>
  );
};

export default Layout;
