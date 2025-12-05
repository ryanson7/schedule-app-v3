// utils/auth.ts
import { supabase } from './supabaseClient';

export interface User {
  id: number;
  name: string;
  role: string;
  email?: string;
  phone?: string;
  [key: string]: any;
}

export interface ProfessorUser extends User {
  phone: string;
  preferred_shooting_type?: string;
  department?: string;
  is_temp_password: boolean;
}

export interface LoginResult {
  success: boolean;
  user?: User;
  error?: string;
}

// 🎯 통합된 getCurrentUser 함수 (TypeScript)
export const getCurrentUser = (): User | null => {
  if (typeof window === 'undefined') return null;
  
  // 1순위: 교수 세션 확인
  const professorSession = localStorage.getItem('professor_session');
  if (professorSession) {
    try {
      const parsed = JSON.parse(professorSession);
      return parsed as ProfessorUser;
    } catch (error) {
      console.error('교수 세션 파싱 오류:', error);
    }
  }
  
  // 2순위: 일반 관리자 세션 확인 (기존 시스템)
  const userRole = localStorage.getItem('userRole');
  const userName = localStorage.getItem('userName');
  const userEmail = localStorage.getItem('userEmail');
  
  if (userRole && userName && userEmail) {
    return {
      id: parseInt(localStorage.getItem('userId') || '0'),
      name: userName,
      role: userRole,
      email: userEmail,
      phone: localStorage.getItem('userPhone') || undefined
    } as User;
  }
  
  return null;
};

// 🎯 통합된 isLoggedIn 함수 (TypeScript)
export const isLoggedIn = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  // 교수 로그인 확인
  const professorSession = localStorage.getItem('professor_session');
  if (professorSession) return true;
  
  // 일반 관리자 로그인 확인
  const userRole = localStorage.getItem('userRole');
  const userName = localStorage.getItem('userName');
  const userEmail = localStorage.getItem('userEmail');
  
  return !!(userRole && userName && userEmail);
};

// === 교수 관련 함수들 ===
// utils/auth.ts
export const loginProfessor = async (phone: string, password: string): Promise<LoginResult> => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('phone', phone.replace(/[^0-9]/g, ''))
      .eq('role', 'professor')
      .eq('is_active', true)
      .single();

    if (error || !user) {
      return { success: false, error: '휴대폰번호를 찾을 수 없습니다.' };
    }

    if (user.temp_password !== password) {
      return { success: false, error: '패스워드가 일치하지 않습니다.' };
    }

    const sessionData: ProfessorUser = {
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      preferred_shooting_type: user.preferred_shooting_type, // ✅ 기본값 제거
      department: user.department, // ✅ 기본값 제거 (또는 || '미지정' 유지)
      is_temp_password: user.is_temp_password
    };
    
    localStorage.setItem('professor_session', JSON.stringify(sessionData));
    //localStorage.setItem('userRole', 'professor');
    localStorage.setItem('userEmail', user.phone + '@professor.temp');
    localStorage.setItem('userName', user.name);
    
    return { success: true, user: sessionData };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '로그인 중 오류가 발생했습니다.' 
    };
  }
};


export const getCurrentProfessor = (): ProfessorUser | null => {
  try {
    const session = localStorage.getItem('professor_session');
    return session ? JSON.parse(session) as ProfessorUser : null;
  } catch {
    return null;
  }
};

export const logoutProfessor = (): void => {
  localStorage.removeItem('professor_session');
  localStorage.removeItem('userRole');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('userName');
};

export const logout = (): void => {
  // 모든 세션 정리
  localStorage.removeItem('professor_session');
  localStorage.removeItem('userRole');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('userName');
  localStorage.removeItem('userId');
  localStorage.removeItem('userPhone');
};
