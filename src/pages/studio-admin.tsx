"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import dynamic from 'next/dynamic';
import Head from 'next/head';
// import Layout from '../components/Layout'; // ❌ 제거됨
import { UserRoleType } from '../types/users';
import { safeUserRole } from '../utils/permissions';

// 🎯 수정된 StudioAdminPanel - Layout 제거
const StudioAdminPanel = dynamic(
  () => import('../components/StudioAdminPanel'),
  { 
    ssr: false,
    loading: () => (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #3b82f6',
          borderTop: '4px solid transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <div style={{
          color: '#6b7280',
          fontSize: '16px',
          fontWeight: '500'
        }}>
          스튜디오 관리 패널을 불러오는 중...
        </div>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }
);

const StudioAdminPage = () => {
  const router = useRouter();
  const { user, session, loading } = useAuth();
  const [currentUserRole, setCurrentUserRole] = useState<UserRoleType>('staff');
  const [authLoading, setAuthLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAuthAndRole = async () => {
      try {
        // AuthContext 로딩 중이면 대기
        if (loading) {
          return;
        }

        console.log('🔍 스튜디오 페이지 접근 - 인증 확인 시작');

        // 1단계: 세션 확인 (AuthContext에서 관리됨)
        if (!session || !user) {
          console.warn('❌ 세션 없음 - 로그인 페이지로 이동');
          router.push('/login');
          return;
        }

        console.log('✅ 세션 확인 완료:', session.user?.email);

        // 2단계: 로컬스토리지 확인 함수
        const checkLocalStorage = () => {
          const userRole = localStorage.getItem('userRole');
          const userName = localStorage.getItem('userName');
          const userEmail = localStorage.getItem('userEmail');
          
          return { userRole, userName, userEmail };
        };

        let { userRole, userName, userEmail } = checkLocalStorage();
        
        // 로컬스토리지 정보가 없으면 잠시 대기 (AuthContext 처리 완료 대기)
        if (!userRole || !userName || !userEmail) {
          console.log('⚠️ 로컬스토리지 정보 없음 - 잠시 대기');
          
          // 1초 후 재확인
          await new Promise(resolve => setTimeout(resolve, 1000));
          const retryResult = checkLocalStorage();
          
          if (!retryResult.userRole || !retryResult.userName || !retryResult.userEmail) {
            console.warn('❌ 로컬스토리지 정보 여전히 없음 - 로그인 필요');
            router.push('/login');
            return;
          }
          
          // 재시도 성공
          userRole = retryResult.userRole;
          userName = retryResult.userName;
          userEmail = retryResult.userEmail;
        }

        console.log('🔍 스튜디오 관리 페이지 권한 확인:', {
          userRole,
          userName,
          userEmail,
          허용역할: ['system_admin', 'schedule_admin', 'studio_manager', 'manager']
        });

        // 3단계: 세션과 로컬스토리지 일치성 확인
        if (session.user?.email && session.user.email !== userEmail) {
          console.warn('⚠️ 세션과 로컬스토리지 이메일 불일치');
          console.log(`세션: ${session.user.email}, 로컬: ${userEmail}`);
          localStorage.clear();
          router.push('/login');
          return;
        }

        const normalizedRole = safeUserRole(userRole);

        // 4단계: 스튜디오 관리 권한 체크 (권한 확장)
        const allowedRoles = ['system_admin', 'schedule_admin', 'studio_manager', 'manager'];
        
        if (!allowedRoles.includes(normalizedRole)) {
          console.warn('⚠️ 스튜디오 관리 권한 없음:', normalizedRole);
          setAccessDenied(true);
        } else {
          console.log('✅ 권한 확인 완료:', normalizedRole);
          setCurrentUserRole(normalizedRole);
        }
        
        setAuthLoading(false);
      } catch (error) {
        console.error('❌ 인증 확인 오류:', error);
        setError('인증 확인 중 오류가 발생했습니다.');
        setAuthLoading(false);
      }
    };

    checkAuthAndRole();
  }, [user, session, loading, router]);

  // 🎯 수정된 로딩 상태 - Layout 제거
  if (loading || authLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc'
      }}>
        <Head>
          <title>스튜디오 관리 로딩 중 - 에듀윌 스케줄 시스템</title>
        </Head>
        <div style={{ 
          padding: '40px', 
          textAlign: 'center',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #3b82f6',
            borderTop: '4px solid transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <div style={{
            color: '#6b7280',
            fontSize: '16px',
            fontWeight: '500'
          }}>
            {loading ? '앱 초기화 중...' : '스튜디오 관리 페이지 로딩 중...'}
          </div>
          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  // 🎯 수정된 에러 상태 - Layout 제거
  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc'
      }}>
        <Head>
          <title>스튜디오 관리 오류 - 에듀윌 스케줄 시스템</title>
        </Head>
        <div style={{ 
          padding: '40px', 
          textAlign: 'center',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '32px',
            maxWidth: '500px'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <h3 style={{ color: '#dc2626', marginBottom: '16px' }}>
              오류가 발생했습니다
            </h3>
            <p style={{ marginBottom: '24px', color: '#6b7280' }}>{error}</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                onClick={() => window.location.reload()}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                새로고침
              </button>
              <button 
                onClick={() => router.push('/')}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                홈으로
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 🎯 수정된 접근 권한 없음 - Layout 제거
  if (accessDenied) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc'
      }}>
        <Head>
          <title>접근 권한 없음 - 에듀윌 스케줄 시스템</title>
        </Head>
        <div style={{ 
          padding: '40px', 
          textAlign: 'center',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '32px',
            maxWidth: '500px'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚫</div>
            <h3 style={{ color: '#dc2626', marginBottom: '16px' }}>
              접근 권한이 없습니다
            </h3>
            <p style={{ marginBottom: '24px', color: '#6b7280', lineHeight: '1.5' }}>
              스튜디오 관리는 시스템 관리자, 스케줄 관리자, 스튜디오 매니저, 매니저만 접근할 수 있습니다.
              <br />
              권한이 필요하시면 시스템 관리자에게 문의해주세요.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                onClick={() => router.push('/')}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                홈으로 돌아가기
              </button>
              <button 
                onClick={() => router.push('/login')}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                다시 로그인
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 🎯 수정된 메인 컨텐츠 - Layout 제거
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc'
    }}>
      {/* <Head>
        <title>스튜디오 관리 - 에듀윌 스케줄 시스템</title>
        <meta name="description" content="스튜디오 촬영 스케줄 관리 및 드래그 앤 드롭 기능" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head> */}
      
      <div style={{
        minHeight: '100vh',
        padding: '0',
        margin: '0',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <StudioAdminPanel currentUserRole={currentUserRole} />
      </div>
    </div>
  );
};

export default StudioAdminPage;
