// utils/roleRedirection.ts
import { UserRoleType } from '../types/users';

// ✅ 관리자 판별
export const ADMIN_ROLES: UserRoleType[] = ['system_admin', 'schedule_admin'];
export const isAdmin = (role?: string): boolean =>
  !!role && ADMIN_ROLES.includes(role as UserRoleType);

// ✅ 역할별 시작(기본) 경로
export const ROLE_START_PATH: Record<UserRoleType, string> = {
  system_admin: '/admin',
  schedule_admin: '/admin',
  academy_manager: '/academy-schedules',
  online_manager: '/ManagerStudioSchedulePage',
  professor: '/studio-schedules',
  shooter: '/shooter/ShooterDashboard',
  staff: '/login', // staff는 현재 접근 제한
};

// ✅ 기능별 플래그 관리 (개선됨)
const FEATURE_FLAGS = {
  SHOOTER_DASHBOARD_READY: false,
  ACADEMY_SCHEDULES_READY: true,
  MANAGER_STUDIO_READY: true,
} as const;

// ✅ 역할별 허용 경로 (확장됨)
const ROLE_ALLOWED_PATHS: Record<UserRoleType, string[]> = {
  system_admin: ['*'], // 모든 경로 허용
  schedule_admin: ['*'], // 모든 경로 허용
  academy_manager: [
    '/academy-schedules',
    '/profile',
    '/settings'
  ],
  online_manager: [
    '/ManagerStudioSchedulePage',
    '/profile',
    '/settings'
  ],
  professor: [
    '/studio-schedules',
    '/profile',
    '/my-schedules'
  ],
  shooter: FEATURE_FLAGS.SHOOTER_DASHBOARD_READY ? [
    '/shooter/dashboard',
    '/shooter/schedule-check',
    '/shooter/schedule-register',
    '/shooter/actions',
    '/profile'
  ] : [
    '/shooter/schedule-check',
    '/shooter/schedule-register', 
    '/shooter/actions'
  ],
  staff: ['/login'] // 제한적 접근
};

// ✅ 시작 경로 반환 (개선됨)
export const getRedirectPath = (role?: string): string => {
  const r = (role || '') as UserRoleType;
  
  // 🎯 Shooter 특별 처리
  if (r === 'shooter' && !FEATURE_FLAGS.SHOOTER_DASHBOARD_READY) {
    return '/shooter/ShooterDashboard';
  }
  
  // 🎯 일반적인 역할별 기본 경로
  const defaultPath = ROLE_START_PATH[r];
  if (defaultPath && defaultPath !== '/login') {
    return defaultPath;
  }
  
  // 🎯 폴백: 로그인 페이지
  return '/login';
};

// ✅ 접근 권한 체크 (강화됨)
export const canAccessPage = (role: UserRoleType | undefined, path: string): boolean => {
  // 🔒 역할이 없으면 로그인 페이지만 허용
  if (!role) {
    return path === '/login' || path === '/';
  }
  
  // 🔓 관리자는 모든 페이지 접근 가능
  if (isAdmin(role)) {
    return true;
  }
  
  // 🎯 역할별 허용 경로 확인
  const allowedPaths = ROLE_ALLOWED_PATHS[role];
  if (!allowedPaths) {
    return false;
  }
  
  // 🌟 와일드카드 체크 (관리자용)
  if (allowedPaths.includes('*')) {
    return true;
  }
  
  // 🎯 정확한 경로 매칭
  if (allowedPaths.includes(path)) {
    return true;
  }
  
  // 🎯 동적 경로 패턴 매칭 (예: /shooter/actions/[id])
  return allowedPaths.some(allowedPath => {
    if (allowedPath.endsWith('/*')) {
      const basePath = allowedPath.slice(0, -2);
      return path.startsWith(basePath);
    }
    return false;
  });
};

// ✅ 페이지 접근 가능 여부와 리다이렉트 경로 반환
export const checkPageAccess = (role: UserRoleType | undefined, path: string): {
  canAccess: boolean;
  redirectTo?: string;
  reason?: string;
} => {
  // 🔒 역할이 없는 경우
  if (!role) {
    if (path === '/login' || path === '/') {
      return { canAccess: true };
    }
    return { 
      canAccess: false, 
      redirectTo: '/login',
      reason: '로그인이 필요합니다'
    };
  }
  
  // 🎯 접근 권한 체크
  const canAccess = canAccessPage(role, path);
  
  if (canAccess) {
    return { canAccess: true };
  }
  
  // 🔄 접근 불가능한 경우 해당 역할의 기본 페이지로 리다이렉트
  const redirectTo = getRedirectPath(role);
  return { 
    canAccess: false, 
    redirectTo,
    reason: `${ROLE_DISPLAY_NAMES[role]} 권한으로는 접근할 수 없는 페이지입니다`
  };
};

// ✅ 개발자용 디버깅 함수
export const debugRoleAccess = (role: UserRoleType, path: string): void => {
  if (process.env.NODE_ENV === 'development') {
    const result = checkPageAccess(role, path);
    console.group(`🔍 Role Access Debug: ${role} → ${path}`);
    console.log('✅ Can Access:', result.canAccess);
    if (!result.canAccess) {
      console.log('🔄 Redirect To:', result.redirectTo);
      console.log('📝 Reason:', result.reason);
    }
    console.log('🎯 Allowed Paths:', ROLE_ALLOWED_PATHS[role]);
    console.log('🏠 Default Path:', ROLE_START_PATH[role]);
    console.groupEnd();
  }
};

// ✅ 표시명/색상 (기존 유지)
export const ROLE_DISPLAY_NAMES: Record<UserRoleType, string> = {
  system_admin: '시스템 관리자',
  schedule_admin: '스케줄 관리자',
  academy_manager: '학원 관리자',
  online_manager: '온라인 관리자',
  professor: '교수',
  shooter: '촬영자',
  staff: '일반 직원',
};

export const ROLE_COLORS: Record<UserRoleType, string> = {
  system_admin: '#dc2626',
  schedule_admin: '#ea580c',
  academy_manager: '#3b82f6',
  online_manager: '#059669',
  professor: '#0891b2',
  shooter: '#7c3aed',
  staff: '#6b7280',
};

// ✅ 권한 레벨 정의 (추가)
export const ROLE_LEVELS: Record<UserRoleType, number> = {
  system_admin: 100,
  schedule_admin: 90,
  academy_manager: 50,
  online_manager: 50,
  professor: 30,
  shooter: 20,
  staff: 10,
};

// ✅ 역할 비교 함수
export const hasHigherRole = (userRole: UserRoleType, requiredRole: UserRoleType): boolean => {
  return ROLE_LEVELS[userRole] >= ROLE_LEVELS[requiredRole];
};

// ✅ 기능별 접근 권한 체크
export const canAccessFeature = (role: UserRoleType, feature: string): boolean => {
  const featurePermissions: Record<string, UserRoleType[]> = {
    'user_management': ['system_admin'],
    'schedule_management': ['system_admin', 'schedule_admin'],
    'studio_booking': ['system_admin', 'schedule_admin', 'professor'],
    'shooting_schedule': ['system_admin', 'schedule_admin', 'shooter'],
    'academy_schedule': ['system_admin', 'schedule_admin', 'academy_manager'],
    'report_view': ['system_admin', 'schedule_admin', 'academy_manager', 'online_manager'],
  };
  
  const allowedRoles = featurePermissions[feature];
  return allowedRoles ? allowedRoles.includes(role) : false;
};
