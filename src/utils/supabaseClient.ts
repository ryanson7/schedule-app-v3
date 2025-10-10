// src/utils/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 글로벌 싱글톤 패턴으로 다중 인스턴스 방지
declare global {
  var __supabase__: ReturnType<typeof createClient> | undefined;
}

export const supabase = 
  global.__supabase__ ?? 
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
  global.__supabase__ = supabase;
}

// 🔥 강화된 세션 확인 헬퍼 함수
export const checkSession = async () => {
  try {
    // 1. Supabase 세션 확인
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('세션 확인 오류:', error);
    }
    
    if (session) {
      console.log('✅ Supabase 세션 확인됨:', session.user.email);
      return session;
    }
    
    // 2. 로컬스토리지 세션 확인 (fallback)
    const localSession = localStorage.getItem('supabase.auth.token');
    if (localSession) {
      try {
        const parsedSession = JSON.parse(localSession);
        console.log('✅ 로컬 세션 확인됨:', parsedSession.user?.email);
        return parsedSession;
      } catch (parseError) {
        console.error('로컬 세션 파싱 오류:', parseError);
      }
    }
    
    // 3. 인증 상태 확인 (최종 fallback)
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    const userEmail = localStorage.getItem('userEmail');
    
    if (isAuthenticated === 'true' && userEmail) {
      console.log('✅ 로컬 인증 상태 확인됨:', userEmail);
      return {
        user: {
          email: userEmail,
          id: localStorage.getItem('username'),
          user_metadata: {
            role: localStorage.getItem('userRole'),
            name: localStorage.getItem('userName')
          }
        },
        access_token: 'local_token',
        expires_at: Math.floor(Date.now() / 1000) + 3600
      };
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
export const signOut = async () => {
  try {
    await supabase.auth.signOut();
    localStorage.clear();
    console.log('✅ 로그아웃 완료');
  } catch (error) {
    console.error('로그아웃 오류:', error);
    localStorage.clear(); // 강제 로컬스토리지 클리어
  }
};
