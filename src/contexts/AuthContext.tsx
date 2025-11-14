// contexts/AuthContext.tsx (최종 완성 버전)
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

  const checkTempPassword = useCallback(async (email: string): Promise<boolean> => {
    return false;
  }, []);

  const setCookie = useCallback((name: string, value: string, maxAge = 86400) => {
    if (typeof window === 'undefined') return;
    const secure = window.location.protocol === 'https:';
    document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; SameSite=Lax${secure ? '; Secure' : ''}`;
  }, []);

  const deleteCookie = useCallback((name: string) => {
    if (typeof window === 'undefined') return;
    document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax`;
  }, []);

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
    localStorage.setItem('isAuthenticated', 'true');

    console.log('✅ 사용자 정보 저장 완료:', { 
      userName, 
      userRole,
      isAuthenticated: 'true'
    });
  }, [setCookie]);

  const clearUserInfo = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    deleteCookie('userRole');
    deleteCookie('isLoggedIn');
    deleteCookie('userName');
    
    const cookies = document.cookie.split(';');
    cookies.forEach(cookie => {
      const name = cookie.split('=')[0].trim();
      if (name.startsWith('sb-')) {
        deleteCookie(name);
      }
    });
    
    const keysToRemove = [
      'userRole', 'userEmail', 'userName', 'userId', 
      'isLoggedIn', 'professorName', 'isAuthenticated',
      'userNumericId'
    ];
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-')) {
        localStorage.removeItem(key);
      }
    });
    
    console.log('🔄 사용자 정보 완전 삭제 완료');
  }, [deleteCookie]);

const loadUserData = useCallback(async (authUserId: string) => {
  try {
    const { data: userData, error } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', authUserId)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('❌ 숫자 ID 조회 실패:', error);
      return;
    }

    if (userData) {
      localStorage.setItem('userNumericId', userData.id.toString());
      // context의 user 객체에 numericId 병합
      setUser(prev => prev ? { ...prev, numericId: userData.id } : prev);
      console.log('✅ 숫자 ID 저장 및 병합 완료:', {
        authUserId,
        numericId: userData.id
      });
    }else {
      console.warn('⚠️ 숫자 ID 조회 결과 없음');
    }
  } catch (error) {
    console.error('❌ 숫자 ID 조회 오류:', error);
  }
}, []);


  const handleUserLogin = useCallback(async (session: Session) => {
    if (authInitialized) return;
    
    const email = session.user.email;
    console.log('🔄 사용자 로그인 처리 시작:', email);
    
    let userRole = 'system_admin';
    let userName = email?.split('@')[0] || '사용자';

    try {
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
      
      if (email && (email.includes('@professor.temp') || email.includes('@professor.eduwill.com'))) {
        userName = email.split('@')[0];
        userRole = 'professor';
      } else {
        userName = session.user.user_metadata?.name || email?.split('@')[0] || '사용자';
        userRole = session.user.user_metadata?.role || 'system_admin';
      }
    }

    saveUserInfo(userName, userRole, email || '', session.user.id);
    
    // ✅ 숫자 ID 조회
    await loadUserData(session.user.id);
    
    setAuthInitialized(true);

    if (router?.isReady && (router.pathname === '/login' || router.pathname === '/')) {
      const redirectPath = getRedirectPath(userRole);
      console.log('🔄 리다이렉트:', redirectPath);
      setTimeout(() => router.push(redirectPath), 100);
    }
  }, [authInitialized, saveUserInfo, loadUserData, router]);

  const signOut = useCallback(async () => {
    console.log('🚪 강제 로그아웃 시작');
    
    try {
      try {
        clearUserInfo();
        setSession(null);
        setUser(null);
        setAuthInitialized(false);
      } catch (stateError) {
        console.warn('상태 정리 오류 무시:', stateError);
      }
      
      try {
        const keysToRemove = [
          'userRole', 'userEmail', 'userName', 'userId', 
          'isLoggedIn', 'professorName', 'isAuthenticated',
          'userNumericId'
        ];
        
        keysToRemove.forEach(key => {
          try {
            localStorage.removeItem(key);
            sessionStorage.removeItem(key);
          } catch {}
        });
        
        const cookiesToDelete = ['userRole', 'isLoggedIn', 'userName'];
        cookiesToDelete.forEach(name => {
          try {
            document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax`;
          } catch {}
        });
        
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
      
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch (authError) {
        console.warn('Supabase 로그아웃 오류 무시:', authError);
      }
      
      console.log('✅ 강제 로그아웃 완료');
      
    } catch (error) {
      console.error('로그아웃 오류 발생하지만 계속 진행:', error);
    } finally {
      console.log('🔄 로그인 페이지로 강제 이동');
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
  }, [handleUserLogin, authInitialized, loading, clearUserInfo]);

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
