// pages/_app.tsx (중복 실행 방지 버전)
import type { AppProps } from 'next/app';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import type { Session } from '@supabase/supabase-js';
import { WeekProvider } from '../contexts/WeekContext';
import DynamicNavigation from '../components/DynamicNavigation';
import { supabase } from '../utils/supabaseClient';
import '../styles/globals.css';

// AuthProvider를 브라우저에서만 로드
const AuthProviderNoSSR = dynamic(
  () => import('../contexts/AuthContext').then(m => m.AuthProvider),
  { ssr: false }
);

function MyApp({ Component, pageProps }: AppProps) {
  const [initialSession, setInitialSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [isClient, setIsClient] = useState(false);
  
  // 🔧 중복 실행 방지
  const initialized = useRef(false);
  const router = useRouter();

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    // 🔧 한 번만 실행되도록
    if (!isClient || !router.isReady || initialized.current) return;
    initialized.current = true;

    const initializeApp = async () => {
      try {
        // 🔧 로그 간소화
        console.log('🔍 앱 초기화 시작');
        
        // Supabase 세션
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('세션 조회 오류:', error);
        } else {
          setInitialSession(session);
          // console.log('✅ 세션 설정:', session?.user?.email || '없음'); // 🔧 로그 줄임
        }

        // 🔧 올바른 키 사용
        const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
        const userRole = localStorage.getItem('userRole');
        const currentPath = router.pathname;

        const safeReplace = (to: string) => {
          if (router.asPath !== to) {
            console.log(`🔄 페이지 이동: ${router.asPath} → ${to}`);
            router.replace(to);
          }
        };

        // 🔧 로그 간소화
        // console.log('🔍 라우팅 체크:', { currentPath, isAuthenticated, userRole, hasSession: !!session });

        // // 🔧 간단한 라우팅 처리
        // if (currentPath === '/') {
        //   if (isAuthenticated && userRole) {
        //     switch (userRole) {
        //       case 'system_admin':
        //       case 'schedule_admin':
        //       case 'systemadmin':
        //         safeReplace('/admin');
        //         break;
        //       case 'academy_manager':
        //         safeReplace('/academy-schedules');
        //         break;
        //       case 'studio_manager':
        //         safeReplace('/studio-schedules');
        //         break;
        //       case 'shooter':
        //         safeReplace('/shooter/ShooterDashboard');
        //         break;
        //       case 'professor':
        //         safeReplace('/professor-categories');
        //         break;
        //       default:
        //         safeReplace('/admin');
        //     }
        //   } else {
        //     safeReplace('/login');
        //   }
        // } 
        // // 로그인 페이지에서 이미 인증된 경우
        // else if (currentPath === '/login') {
        //   if (isAuthenticated && userRole) {
        //     switch (userRole) {
        //       case 'system_admin':
        //       case 'schedule_admin':
        //       case 'systemadmin':
        //         safeReplace('/admin');
        //         break;
        //       case 'academy_manager':
        //         safeReplace('/academy-schedules');
        //         break;
        //       case 'studio_manager':
        //         safeReplace('/studio-schedules');
        //         break;
        //       case 'shooter':
        //         safeReplace('/shooter/ShooterDashboard');
        //         break;
        //       case 'professor':
        //         safeReplace('/professor-categories');
        //         break;
        //       default:
        //         safeReplace('/admin');
        //     }
        //   }
        // }
        // 보호 페이지 접근 제어
        if (
          currentPath !== '/login' && 
          currentPath !== '/auth/first-login' && 
          (!isAuthenticated || !userRole)
        ) {
          console.warn('❌ 인증되지 않은 접근:', currentPath);
          safeReplace('/login');
        } else {
          // console.log('✅ 페이지 접근 허용:', currentPath); // 🔧 로그 줄임
        }

      } catch (e) {
        console.error('앱 초기화 예외:', e);
      } finally {
        setLoading(false);
        setAuthChecked(true);
        console.log('✅ 앱 초기화 완료');
      }
    };

    initializeApp();
  }, [isClient, router.isReady]); // 🔧 router.pathname 제거
  

  // 로그아웃 이벤트 리스너 강화
  useEffect(() => {
    if (!isClient) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 인증 상태 변경:', event);
        
        if (event === 'SIGNED_OUT') {
          console.log('🚪 로그아웃 감지 - 완전 클리어');
          
          // 🔧 강제 클리어
          localStorage.clear();
          sessionStorage.clear();
          
          // 🔧 상태 리셋
          initialized.current = false;
          setAuthChecked(false);
          setInitialSession(null);
          
          // 🔧 즉시 /login으로 강제 이동
          if (window.location.pathname !== '/login') {
            window.location.replace('/login'); // replace 사용
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [isClient]);



  const excludeNavPages = ['/login', '/register', '/auth/first-login'];
  const showNavigation = isClient && !excludeNavPages.includes(router.pathname) && authChecked && !loading;

  if (!isClient || loading || !authChecked) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column',
        gap: 16,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}>
        <div style={{
          width: 50,
          height: 50,
          border: '5px solid rgba(255,255,255,0.3)',
          borderTop: '5px solid white',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <p style={{ color: 'white', fontSize: 16, fontWeight: 500, textAlign: 'center' }}>
          앱을 준비하는 중...
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

  return (
    <AuthProviderNoSSR initialSession={initialSession}>
      <WeekProvider>
        {showNavigation && <DynamicNavigation />}
        <Component {...pageProps} />
      </WeekProvider>
    </AuthProviderNoSSR>
  );
}

export default MyApp;
