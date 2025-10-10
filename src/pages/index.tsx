// pages/index.tsx - 루트 경로를 로그인으로 리다이렉트
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import { getRedirectPath } from '../utils/roleRedirection';

export default function RootPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return; // 로딩 중에는 아무것도 하지 않음

    if (user) {
      // 로그인된 상태면 역할에 맞는 페이지로
      const userRole = localStorage.getItem('userRole') || 'staff';
      const redirectPath = getRedirectPath(userRole);
      router.replace(redirectPath);
    } else {
      // 로그인되지 않은 상태면 로그인 페이지로
      router.replace('/login');
    }
  }, [user, loading, router]);

  // 리다이렉션 처리 중 로딩 표시
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      flexDirection: 'column'
    }}>
      <div>리다이렉션 중...</div>
    </div>
  );
}
