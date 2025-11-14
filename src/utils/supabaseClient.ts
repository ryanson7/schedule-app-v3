// src/utils/supabaseClient.ts
import { createClient, type Session } from '@supabase/supabase-js';

const requireEnv = (value: string | undefined, key: string) => {
  if (!value) {
    throw new Error(
      `환경 변수 ${key} 값이 설정되지 않았습니다. Next.js 실행 전에 .env 파일을 확인해 주세요.`
    );
  }

  return value;
};

const supabaseUrl = requireEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = requireEnv(
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  'NEXT_PUBLIC_SUPABASE_ANON_KEY'
);

// 글로벌 싱글톤 패턴으로 다중 인스턴스 방지
const globalForSupabase = globalThis as typeof globalThis & {
  __supabase__?: ReturnType<typeof createClient>;
};

export const supabase =
  globalForSupabase.__supabase__ ??
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined
    }, // ✅ 콤마 추가
    // 엣지 호환성을 위한 추가 설정
    global: {
      headers: {
        'User-Agent': 'schedule-app/1.0',
      },
    }  // ✅ 마지막 객체이므로 콤마 제거
  });

if (process.env.NODE_ENV !== 'production') {
  globalForSupabase.__supabase__ = supabase;
}

// 🔥 강화된 세션 확인 헬퍼 함수

const readLocalSession = (): Session | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const localSession = window.localStorage.getItem('supabase.auth.token');
  if (!localSession) {
    return null;
  }

  try {
    const parsed = JSON.parse(localSession);
    const currentSession: Session | null = parsed?.currentSession ?? null;

    if (!currentSession) {
      return null;
    }

    const fallbackUserId = window.localStorage.getItem('userId');
    if (!fallbackUserId || !currentSession.user) {
      return currentSession;
    }

    if (currentSession.user.id) {
      return currentSession;
    }

    return {
      ...currentSession,
      user: {
        ...currentSession.user,
        id: fallbackUserId
      }
    } satisfies Session;
  } catch (error) {
    console.error('로컬 세션 파싱 오류:', error);
  }

  return null;
};

const createLocalFallbackSession = (): Session | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const isAuthenticated = window.localStorage.getItem('isAuthenticated');
  const userEmail = window.localStorage.getItem('userEmail');

  if (isAuthenticated !== 'true' || !userEmail) {
    return null;
  }

  const userId = window.localStorage.getItem('userId') ?? undefined;
  const userRole = window.localStorage.getItem('userRole');
  const userName = window.localStorage.getItem('userName');

  return {
    access_token: 'local_token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: null,
    user: {
      app_metadata: {},
      aud: 'authenticated',
      confirmed_at: null,
      created_at: new Date().toISOString(),
      email: userEmail,
      email_confirmed_at: null,
      id: userId,
      identities: [],
      last_sign_in_at: new Date().toISOString(),
      phone: '',
      role: userRole ?? undefined,
      updated_at: new Date().toISOString(),
      user_metadata: {
        role: userRole,
        name: userName
      }
    },
    provider_token: null,
    provider_refresh_token: null
  } satisfies Session;
};
export const checkSession = async () => {
  try {
    const isBrowser = typeof window !== 'undefined';
    // 1. Supabase 세션 확인
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('세션 확인 오류:', error);
    }
    
    if (session) {
      console.log('✅ Supabase 세션 확인됨:', session.user.email);
      return session;
    }

     if (!isBrowser) {
      console.warn('브라우저 환경이 아니어서 로컬 세션 확인을 건너뜁니다.');
      return null;
    }

    
    // 2. 로컬스토리지 세션 확인 (fallback)
    const cachedSession = readLocalSession();
        if (cachedSession) {
          console.log('✅ 로컬 세션 확인됨:', cachedSession.user?.email);
          return cachedSession;
        }
    
    // 3. 인증 상태 확인 (최종 fallback)
    const synthesizedSession = createLocalFallbackSession();
    if (synthesizedSession) {
      console.log('✅ 로컬 인증 상태 확인됨:', synthesizedSession.user.email);
      return synthesizedSession;
    }
    
    console.warn('세션 없음');
    return null;
  } catch (error) {
    console.error('세션 확인 예외:', error);
    return null;
  }
};

// 사용자 정보 확인 헬퍼 함수
export const getAuthUser = async () => {
  try {
    const session = await checkSession();
    if (!session) return null;
    
    return session.user;
  } catch (error) {
    console.error('사용자 조회 예외:', error);
    return null;
  }
};

// 🔥 로그아웃 헬퍼 함수
type ClearAuthStorageOptions = {
  clearCookies?: boolean;
};

const AUTH_STORAGE_KEYS = [
  'userRole',
  'userEmail',
  'userName',
  'userId',
  'userNumericId',
  'isLoggedIn',
  'isAuthenticated',
  'professorName'
];

const AUTH_COOKIE_KEYS = ['userRole', 'isLoggedIn', 'userName'];

const getStorageSafely = (storageType: 'localStorage' | 'sessionStorage'): Storage | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window[storageType];
  } catch (error) {
    console.warn(`${storageType} 접근 실패`, error);
    return null;
  }
};

const removeCookie = (name: string) => {
  if (typeof document === 'undefined') {
    return;
  }

  try {
    document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax`;
  } catch (error) {
    console.warn('쿠키 삭제 중 오류 발생:', error);
  }
};

export const clearAuthStorage = (options: ClearAuthStorageOptions = {}) => {
  if (typeof window === 'undefined') {
    return;
  }

  const { clearCookies = false } = options;
  const storages = [getStorageSafely('localStorage'), getStorageSafely('sessionStorage')];

  storages.forEach((storage) => {
    if (!storage) {
      return;
    }

    AUTH_STORAGE_KEYS.forEach((key) => {
      try {
        storage.removeItem(key);
      } catch (error) {
        console.warn('스토리지 키 삭제 실패:', { key, error });
      }
    });

    const supabaseKeys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && (key.startsWith('sb-') || key.startsWith('supabase.'))) {
        supabaseKeys.push(key);
      }
    }

    supabaseKeys.forEach((key) => {
      try {
        storage.removeItem(key);
      } catch (error) {
        console.warn('Supabase 스토리지 키 삭제 실패:', { key, error });
      }
    });
  });

  if (!clearCookies || typeof document === 'undefined') {
    return;
  }

  AUTH_COOKIE_KEYS.forEach(removeCookie);

  try {
    const cookieEntries = document.cookie.split(';');
    cookieEntries.forEach((cookie) => {
      const [rawName] = cookie.split('=');
      const name = rawName?.trim();

      if (name && name.startsWith('sb-')) {
        removeCookie(name);
      }
    });
  } catch (error) {
    console.warn('Supabase 쿠키 삭제 실패:', error);
  }
};

export const signOut = async () => {
  try {
    await supabase.auth.signOut();
    clearAuthStorage({ clearCookies: true });
    console.log('✅ 로그아웃 완료');
  } catch (error) {
    console.error('로그아웃 오류:', error);
    clearAuthStorage({ clearCookies: true });
  }
};
