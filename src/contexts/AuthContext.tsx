// contexts/AuthContext.tsx (수정된 버전)
"use client";
import { createContext, useContext, useEffect, useState, ReactNode, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../utils/supabaseClient';
import { getRedirectPath } from '../utils/roleRedirection';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  checkTempPassword: (email: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
  checkTempPassword: async () => false
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
  initialSession?: Session | null;
}

export const AuthProvider = ({ children, initialSession }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(initialSession?.user ?? null);
  const [session, setSession] = useState<Session | null>(initialSession ?? null);
  const [loading, setLoading] = useState(!initialSession);
  const [authInitialized, setAuthInitialized] = useState(false);
  const router = useRouter();

  // 🎯 checkTempPassword 함수 (내부 구현)
  const checkTempPassword = useCallback(async (email: string): Promise<boolean> => {
    // 임시 비밀번호 체크 로직이 필요하다면 여기에 구현
    // 현재는 항상 false 반환 (임시 비밀번호 사용 안함)
    return false;
  }, []);

  // 쿠키 설정 헬퍼 함수
  const setCookie = useCallback((name: string, value: string, maxAge = 86400) => {
    if (typeof window === 'undefined') return;
    const secure = window.location.protocol === 'https:';
    document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; SameSite=Lax${secure ? '; Secure' : ''}`;
  }, []);

  const deleteCookie = useCallback((name: string) => {
    if (typeof window === 'undefined') return;
    document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax`;
  }, []);

  // 사용자 정보 저장 함수 (수정된 버전)
  const saveUserInfo = useCallback((userName: string, userRole: string, userEmail: string, userId: string) => {
    if (typeof window === 'undefined') return;
    
    setCookie('userRole', userRole);
    setCookie('isLoggedIn', 'true');
    setCookie('userName', userName);
    
    localStorage.setItem('userName', userName);
    localStorage.setItem('userRole', userRole);
    localStorage.setItem('userEmail', userEmail);
    localStorage.setItem('userId', userId);
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('isAuthenticated', 'true'); // 🔥 이 줄 추가!

    console.log('✅ 사용자 정보 저장 완료:', { 
      userName, 
      userRole,
      isAuthenticated: 'true' // 🔥 로그에도 추가
    });
  }, [setCookie]);


  // 사용자 정보 삭제 함수
  // clearUserInfo 함수에 추가
  const clearUserInfo = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    // 기존 쿠키 삭제
    deleteCookie('userRole');
    deleteCookie('isLoggedIn');
    deleteCookie('userName');
    
    // Supabase 관련 쿠키 모두 정리
    const cookies = document.cookie.split(';');
    cookies.forEach(cookie => {
      const name = cookie.split('=')[0].trim();
      if (name.startsWith('sb-')) {
        deleteCookie(name);
      }
    });
    
    // localStorage 정리
    const keysToRemove = [
      'userRole', 'userEmail', 'userName', 'userId', 
      'isLoggedIn', 'professorName', 'isAuthenticated' // 🔥 이 줄 추가!
    ];
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    // Supabase 관련 localStorage 항목도 정리
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-')) {
        localStorage.removeItem(key);
      }
    });
    
    console.log('🔄 사용자 정보 완전 삭제 완료');
  }, [deleteCookie]);


  // 로그인 처리 함수
  const handleUserLogin = useCallback(async (session: Session) => {
    if (authInitialized) return;
    
    const email = session.user.email;
    console.log('🔄 사용자 로그인 처리 시작:', email);
    
    let userRole = 'system_admin';
    let userName = email?.split('@')[0] || '사용자';

    try {
      // DB 조회 시도 (타임아웃 적용)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('DB 조회 타임아웃')), 3000)
      );

      if (email && (email.includes('@professor.temp') || email.includes('@professor.eduwill.com'))) {
        const phone = email.split('@')[0];
        
        const dbPromise = supabase
          .from('users')
          .select('name, role')
          .eq('email', email)
          .eq('role', 'professor')
          .eq('is_active', true)
          .single();

        const { data } = await Promise.race([dbPromise, timeoutPromise]) as any;
        
        if (data) {
          userName = data.name;
          userRole = 'professor';
          console.log('✅ 교수 정보 조회 성공:', data.name);
        }
      } else {
        const dbPromise = supabase
          .from('users')
          .select('name, role')
          .eq('email', email)
          .eq('is_active', true)
          .single();

        const { data } = await Promise.race([dbPromise, timeoutPromise]) as any;
        
        if (data) {
          userName = data.name;
          userRole = data.role;
          console.log('✅ 사용자 정보 조회 성공:', data);
        } else {
          // 메타데이터에서 정보 가져오기
          userName = session.user.user_metadata?.name || 
                    session.user.user_metadata?.full_name || 
                    email?.split('@')[0] || 
                    '사용자';
          userRole = session.user.user_metadata?.role || 'system_admin';
          console.log('✅ 메타데이터 사용:', { userName, userRole });
        }
      }
    } catch (error) {
      console.warn('DB 조회 실패, 폴백 사용:', error);
      
      // 기본값 설정
      if (email && (email.includes('@professor.temp') || email.includes('@professor.eduwill.com'))) {
        userName = email.split('@')[0];
        userRole = 'professor';
      } else {
        userName = session.user.user_metadata?.name || email?.split('@')[0] || '사용자';
        userRole = session.user.user_metadata?.role || 'system_admin';
      }
    }

    saveUserInfo(userName, userRole, email || '', session.user.id);
    setAuthInitialized(true);

    // 리다이렉트 (router가 준비되었을 때만)
    if (router?.isReady && (router.pathname === '/login' || router.pathname === '/')) {
      const redirectPath = getRedirectPath(userRole);
      console.log('🔄 리다이렉트:', redirectPath);
      setTimeout(() => router.push(redirectPath), 100);
    }
  }, [authInitialized, saveUserInfo, router]);
  
// AuthContext.tsx의 signOut 함수를 다음으로 완전 교체
const signOut = useCallback(async () => {
  console.log('🚪 강제 로그아웃 시작');
  
  try {
    // 1단계: 즉시 상태 정리 (오류 무시)
    try {
      clearUserInfo();
      setSession(null);
      setUser(null);
      setAuthInitialized(false);
    } catch (stateError) {
      console.warn('상태 정리 오류 무시:', stateError);
    }
    
    // 2단계: 강제 데이터 정리 (직접 실행)
    try {
      // localStorage 강제 정리
      const keysToRemove = [
        'userRole', 'userEmail', 'userName', 'userId', 
        'isLoggedIn', 'professorName', 'isAuthenticated'
      ];
      
      keysToRemove.forEach(key => {
        try {
          localStorage.removeItem(key);
          sessionStorage.removeItem(key);
        } catch {}
      });
      
      // 쿠키 강제 정리
      const cookiesToDelete = ['userRole', 'isLoggedIn', 'userName'];
      cookiesToDelete.forEach(name => {
        try {
          document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax`;
        } catch {}
      });
      
      // Supabase 관련 모든 데이터 강제 정리
      try {
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('sb-')) {
            localStorage.removeItem(key);
          }
        });
        
        Object.keys(sessionStorage).forEach(key => {
          if (key.startsWith('sb-')) {
            sessionStorage.removeItem(key);
          }
        });
        
        const cookies = document.cookie.split(';');
        cookies.forEach(cookie => {
          const name = cookie.split('=')[0].trim();
          if (name.startsWith('sb-')) {
            document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
          }
        });
      } catch {}
      
      console.log('✅ 강제 데이터 정리 완료');
    } catch (dataError) {
      console.warn('데이터 정리 오류 무시:', dataError);
    }
    
    // 3단계: Supabase 로그아웃 (오류 무시)
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (authError) {
      console.warn('Supabase 로그아웃 오류 무시:', authError);
    }
    
    console.log('✅ 강제 로그아웃 완료');
    
  } catch (error) {
    console.error('로그아웃 오류 발생하지만 계속 진행:', error);
  } finally {
    // 4단계: 무조건 로그인 페이지로 이동
    console.log('🔄 로그인 페이지로 강제 이동');
    
    // 즉시 이동
    window.location.href = '/login';
  }
}, [clearUserInfo]);




  useEffect(() => {
    let mounted = true;
    let authListener: any = null;

    const initializeAuth = async () => {
      try {
        if (initialSession) {
          await handleUserLogin(initialSession);
          if (mounted) setLoading(false);
          return;
        }

        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          
          if (session && !authInitialized) {
            await handleUserLogin(session);
          }
        }
      } catch (error) {
        console.warn('초기 세션 조회 실패:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    const setupAuthListener = () => {
      authListener = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!mounted) return;

        console.log('🔐 인증 상태 변경:', event);
        
        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          
          if (event === 'SIGNED_IN' && session && !authInitialized) {
            await handleUserLogin(session);
          } else if (event === 'SIGNED_OUT') {
            clearUserInfo();
            setAuthInitialized(false);
          }
          setLoading(false);
        }
      });
    };

    initializeAuth();
    setupAuthListener();

    // 안전 장치: 10초 후 로딩 해제
    const loadingTimeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn('⚠️ 로딩 타임아웃 - 강제 해제');
        setLoading(false);
      }
    }, 10000);

    return () => {
      mounted = false;
      if (authListener?.data?.subscription) {
        authListener.data.subscription.unsubscribe();
      }
      clearTimeout(loadingTimeout);
    };
  }, [handleUserLogin, authInitialized, loading]);

  // Context Value
  const value = useMemo(() => ({
    user,
    session,
    loading,
    signOut,
    checkTempPassword
  }), [user, session, loading, signOut, checkTempPassword]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
