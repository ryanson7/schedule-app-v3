import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext'; // AuthContext 활용
// import Layout from '../components/Layout';
import AcademyScheduleManager from '../components/AcademyScheduleManager';
import { UserRoleType } from '../types/users';

export default function AcademySchedulesPage() {
  const router = useRouter();
  const { user, session, loading } = useAuth(); // AuthContext 활용
  const [userRole, setUserRole] = useState<UserRoleType | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const checkAuthAndRole = async () => {
      try {
        // AuthContext 로딩 중이면 대기
        if (loading) {
          return;
        }

        console.log('🔍 페이지 접근 - 인증 확인 시작');

        // 1단계: 세션 확인 (AuthContext에서 관리됨)
        if (!session || !user) {
          console.warn('❌ 세션 없음 - 로그인 페이지로 이동');
          router.push('/login');
          return;
        }

        console.log('✅ 세션 확인 완료:', session.user?.email);

        // 2단계: 로컬스토리지 확인 (AuthContext에서 설정했는지)
        const checkLocalStorage = () => {
          const savedRole = localStorage.getItem('userRole') as UserRoleType;
          const savedEmail = localStorage.getItem('userEmail');
          const savedUserName = localStorage.getItem('userName');

          return { savedRole, savedEmail, savedUserName };
        };

        let { savedRole, savedEmail, savedUserName } = checkLocalStorage();

        // 로컬스토리지 정보가 없으면 잠시 대기 (AuthContext의 handleUserLogin 완료 대기)
        if (!savedRole || !savedEmail || !savedUserName) {
          console.log('⚠️ 로컬스토리지 정보 없음 - 잠시 대기');
          
          // 1초 후 재확인
          await new Promise(resolve => setTimeout(resolve, 1000));
          const retryResult = checkLocalStorage();
          
          if (!retryResult.savedRole || !retryResult.savedEmail || !retryResult.savedUserName) {
            console.warn('❌ 로컬스토리지 정보 여전히 없음 - 로그인 필요');
            router.push('/login');
            return;
          }
          
          // 재시도 성공
          savedRole = retryResult.savedRole;
          savedEmail = retryResult.savedEmail;
          savedUserName = retryResult.savedUserName;
        }

        console.log('✅ 로컬스토리지 확인 완료:', { 
          role: savedRole, 
          email: savedEmail,
          userName: savedUserName 
        });

        // 3단계: 세션과 로컬스토리지 일치성 확인
        if (session.user?.email && session.user.email !== savedEmail) {
          console.warn('⚠️ 세션과 로컬스토리지 이메일 불일치');
          console.log(`세션: ${session.user.email}, 로컬: ${savedEmail}`);
          localStorage.clear();
          router.push('/login');
          return;
        }

        // 4단계: 권한 확인
        const allowedRoles: UserRoleType[] = [
          'system_admin', 
          'schedule_admin', 
          'academy_manager',
          'manager',
          'professor' // 교수도 학원 스케줄 확인 가능
        ];

        if (!allowedRoles.includes(savedRole)) {
          console.warn('⚠️ 권한 없음:', savedRole);
          alert(`학원 스케줄 관리 권한이 없습니다. (현재 권한: ${savedRole})`);
          router.push('/');
          return;
        }

        console.log('✅ 권한 확인 완료:', savedRole);
        setUserRole(savedRole);
        setAuthLoading(false);

      } catch (error) {
        console.error('❌ 인증 확인 오류:', error);
        localStorage.clear();
        router.push('/login');
      }
    };

    checkAuthAndRole();
  }, [user, session, loading, router]); // AuthContext 상태와 연동

 // 🎯 수정된 로딩 화면 (Layout 제거)
  if (loading || authLoading) {
    return (
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
        <p style={{
          color: '#6b7280',
          fontSize: '16px',
          fontWeight: '500'
        }}>
          {loading ? '앱 초기화 중...' : '인증 및 권한을 확인하는 중...'}
        </p>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!userRole) {
    return null;
  }

  // 🎯 수정된 메인 컨텐츠 (Layout 제거)
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      padding: '0',
      margin: '0',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <AcademyScheduleManager currentUserRole={userRole} />
    </div>
  );
}