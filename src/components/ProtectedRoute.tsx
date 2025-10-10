"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { isLoggedIn, getCurrentUser } from '../utils/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export default function ProtectedRoute({ 
  children, 
  allowedRoles 
}: ProtectedRouteProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = getCurrentUser();
        
        if (!currentUser) {
          if (allowedRoles?.includes('professor')) {
            router.push('/professor/login');
          } else {
            router.push('/login');
          }
          return;
        }

        setUser(currentUser);
        
        // 권한 체크
        if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(currentUser.role)) {
          router.push('/unauthorized');
          return;
        }
        
      } catch (error) {
        console.error('인증 체크 오류:', error);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router, allowedRoles]);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8f9fa'
      }}>
        <div style={{
          textAlign: 'center',
          color: '#6c757d'
        }}>
          <div style={{ fontSize: '18px', marginBottom: '8px' }}>
            🔄 로딩 중...
          </div>
          <div style={{ fontSize: '14px' }}>
            사용자 인증을 확인하고 있습니다
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8f9fa'
      }}>
        <div style={{
          textAlign: 'center',
          color: '#dc3545',
          maxWidth: '400px',
          padding: '20px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚫</div>
          <h2 style={{ marginBottom: '16px' }}>접근 권한이 없습니다</h2>
          <p style={{ color: '#6c757d', marginBottom: '20px' }}>
            이 페이지에 접근할 권한이 없습니다.
          </p>
          <button
            onClick={() => router.back()}
            style={{
              background: '#007bff',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            이전 페이지로
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
