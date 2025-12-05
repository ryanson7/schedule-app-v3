// contexts/AuthContext.tsx (✅ manager_type 포함 + resolvedRole 적용 버전)
"use client";
import { createContext, useContext, useEffect, useState, ReactNode, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../utils/supabaseClient';
import { getRedirectPath } from '../utils/roleRedirection';
import { DbUserRole, ManagerType, mapDbRoleToUserRole } from '../types/users';

// ✅ 확장된 User 타입 (numericId, managerType 포함)
interface ExtendedUser extends User {
  numericId?: number;
  managerType?: ManagerType;
}

interface AuthContextType {
  user: ExtendedUser | null;
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
  checkTempPassword: async () => false,
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
  const [user, setUser] = useState<ExtendedUser | null>(initialSession?.user ?? null);
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
    document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; SameSite=Lax${
      secure ? '; Secure' : ''
    }`;
  }, []);

  const deleteCookie = useCallback((name: string) => {
    if (typeof window === 'undefined') return;
    document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax`;
  }, []);

  // ✅ managerType + resolvedRole 저장
  const saveUserInfo = useCallback(
    (
      userName: string,
      userRole: DbUserRole,
      userEmail: string,
      userId: string,
      managerType?: ManagerType,
    ) => {
      if (typeof window === 'undefined') return;

      // ✅ 네비게이션과 permissions 에서 사용할 실제 역할
      // manager + managerType 이면 online_manager / academy_manager / shooting_manager 등으로 바꿔서 저장
      const resolvedRole: string =
        userRole === 'manager' && managerType ? managerType : userRole;

      setCookie('userRole', resolvedRole);
      setCookie('isLoggedIn', 'true');
      setCookie('userName', userName);

      localStorage.setItem('userName', userName);
      localStorage.setItem('userRole', resolvedRole);
      localStorage.setItem('userEmail', userEmail);
      localStorage.setItem('userId', userId);
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('isAuthenticated', 'true');

      // ✅ managerType 저장
      if (managerType) {
        localStorage.setItem('managerType', managerType);
        setCookie('managerType', managerType);
      } else {
        localStorage.removeItem('managerType');
        deleteCookie('managerType');
      }

      console.log('✅ 사용자 정보 저장 완료:', {
        userName,
        userRole: resolvedRole,
        managerType,
        isAuthenticated: 'true',
      });
    },
    [setCookie, deleteCookie],
  );

  const clearUserInfo = useCallback(() => {
    if (typeof window === 'undefined') return;

    deleteCookie('userRole');
    deleteCookie('isLoggedIn');
    deleteCookie('userName');
    deleteCookie('managerType');

    const cookies = document.cookie.split(';');
    cookies.forEach(cookie => {
      const name = cookie.split('=')[0].trim();
      if (name.startsWith('sb-')) {
        deleteCookie(name);
      }
    });

    const keysToRemove = [
      'userRole',
      'userEmail',
      'userName',
      'userId',
      'isLoggedIn',
      'professorName',
      'isAuthenticated',
      'userNumericId',
      'managerType',
    ];

    keysToRemove.forEach(key => localStorage.removeItem(key));

    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-')) {
        localStorage.removeItem(key);
      }
    });

    console.log('🔄 사용자 정보 완전 삭제 완료');
  }, [deleteCookie]);

  // ✅ 숫자 ID + managerType 조회 및 user 객체에 병합
  const loadUserData = useCallback(async (authUserId: string, dbRole?: DbUserRole) => {
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

        let managerType: ManagerType | undefined;

        // ✅ manager인 경우 manager_type 조회
        if (dbRole === 'manager') {
          const { data: managerRow, error: managerError } = await supabase
            .from('managers')
            .select('manager_type')
            .eq('user_id', userData.id)
            .eq('is_active', true)
            .single();

          if (!managerError && managerRow?.manager_type) {
            managerType = managerRow.manager_type as ManagerType;
            localStorage.setItem('managerType', managerType);
            console.log('✅ 매니저 타입 조회 성공:', managerType);
          } else {
            console.warn('⚠️ 매니저 타입 조회 실패 또는 없음:', managerError);
          }
        }

        // ✅ user 객체에 numericId, managerType 병합
        setUser(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            numericId: userData.id,
            managerType,
          } as ExtendedUser;
        });

        console.log('✅ 숫자 ID 및 매니저타입 저장 완료:', {
          authUserId,
          numericId: userData.id,
          managerType,
        });
      } else {
        console.warn('⚠️ 숫자 ID 조회 결과 없음');
      }
    } catch (error) {
      console.error('❌ 사용자 데이터 조회 오류:', error);
    }
  }, []);

  const handleUserLogin = useCallback(
  async (session: Session) => {
    if (authInitialized) return;

    const email = session.user.email;
    console.log('🔄 사용자 로그인 처리 시작:', email);

    // 🔧 여기 한 줄이 꼭 필요합니다
    let userRole: DbUserRole = 'staff';

    let userName = email?.split('@')[0] || '사용자';
    let managerType: ManagerType | undefined;
    let numericId: number | undefined;

      try {
        // ✅ 타임아웃 5초로 늘림
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('DB 조회 타임아웃')), 5000),
        );

        if (email && (email.includes('@professor.temp') || email.includes('@professor.eduwill.com'))) {
          // 교수 로직
          const dbPromise = supabase
            .from('users')
            .select('id, name, role')
            .eq('email', email)
            .eq('role', 'professor')
            .eq('is_active', true)
            .single();

          const { data } = (await Promise.race([dbPromise, timeoutPromise])) as any;

          if (data) {
            userName = data.name;
            userRole = 'professor';
            numericId = data.id;
          }
        } else {
          // ✅ 일반 사용자 + manager_type 조회
          const dbPromise = supabase
            .from('users')
            .select('id, name, role')
            .eq('email', email)
            .eq('is_active', true)
            .single();

          const { data } = (await Promise.race([dbPromise, timeoutPromise])) as any;

          if (data) {
            userName = data.name;
            userRole = data.role as DbUserRole;
            numericId = data.id;

            // ✅ manager인 경우 manager_type 조회 (필수)
            if (userRole === 'manager' && numericId) {
              console.log('🔍 매니저 타입 조회 시작...');

              const { data: managerRow, error: managerError } = await supabase
                .from('managers')
                .select('manager_type')
                .eq('user_id', numericId)
                .eq('is_active', true)
                .single();

              if (!managerError && managerRow?.manager_type) {
                managerType = managerRow.manager_type as ManagerType;
                console.log('✅ 매니저 타입 조회 성공:', managerType);
              } else {
                console.warn('⚠️ 매니저 타입 조회 실패:', managerError);
              }
            }

            console.log('✅ 사용자 정보 조회 성공:', { name: userName, role: userRole, managerType });
          }
        }
      } catch (error) {
        console.warn('DB 조회 실패, 재시도...', error);

        // ✅ 폴백에서도 DB 조회 재시도
        try {
          if (email && (email.includes('@professor.temp') || email.includes('@professor.eduwill.com'))) {
            userName = email.split('@')[0];
            userRole = 'professor';
          } else {
            const { data: userData } = await supabase
              .from('users')
              .select('id, name, role')
              .eq('email', email)
              .eq('is_active', true)
              .single();

            if (userData) {
              userName = userData.name;
              userRole = userData.role as DbUserRole;
              numericId = userData.id;

              if (userRole === 'manager' && numericId) {
                const { data: managerRow } = await supabase
                  .from('managers')
                  .select('manager_type')
                  .eq('user_id', numericId)
                  .eq('is_active', true)
                  .single();

                if (managerRow?.manager_type) {
                  managerType = managerRow.manager_type as ManagerType;
                  console.log('✅ 폴백에서 매니저 타입 조회 성공:', managerType);
                }
              }
            } else {
              userName = session.user.user_metadata?.name || email?.split('@')[0] || '사용자';
              userRole = (session.user.user_metadata?.role || 'staff') as DbUserRole;
            }
          }
        } catch (fallbackError) {
          console.error('폴백 조회도 실패:', fallbackError);
          userName = session.user.user_metadata?.name || email?.split('@')[0] || '사용자';
          userRole = (session.user.user_metadata?.role || 'staff') as DbUserRole;
        }
      }

      // ✅ 모든 조회 완료 후 저장 (resolvedRole은 saveUserInfo 내부에서 적용)
      saveUserInfo(userName, userRole, email || '', session.user.id, managerType);

      if (numericId) {
        localStorage.setItem('userNumericId', numericId.toString());
        setUser(prev => {
          if (!prev) return prev;
          return { ...prev, numericId, managerType } as ExtendedUser;
        });
      }

      setAuthInitialized(true);

      // ✅ 리다이렉트 (managerType 포함) - getRedirectPath는 dbRole + managerType 기준
      if (router?.isReady && (router.pathname === '/login' || router.pathname === '/')) {
        const redirectPath = getRedirectPath(userRole, managerType);
        console.log('🔄 리다이렉트:', redirectPath, { userRole, managerType });
        setTimeout(() => router.push(redirectPath), 100);
      }
    },
    [authInitialized, saveUserInfo, router],
  );

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
          'userRole',
          'userEmail',
          'userName',
          'userId',
          'isLoggedIn',
          'professorName',
          'isAuthenticated',
          'userNumericId',
          'managerType',
        ];

        keysToRemove.forEach(key => {
          try {
            localStorage.removeItem(key);
            sessionStorage.removeItem(key);
          } catch {}
        });

        const cookiesToDelete = ['userRole', 'isLoggedIn', 'userName', 'managerType'];
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

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

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
  }, [handleUserLogin, authInitialized, loading, clearUserInfo, initialSession]);

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      signOut,
      checkTempPassword,
    }),
    [user, session, loading, signOut, checkTempPassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
