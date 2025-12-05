// utils/roleRedirection.ts
import { UserRoleType, DbUserRole, ManagerType } from '../types/users';

// ✅ 관리자 판별 (managerType 고려)
export const ADMIN_ROLES: UserRoleType[] = ['system_admin', 'schedule_admin', 'manager'];

export const isAdmin = (role?: string, managerType?: ManagerType): boolean => {
  if (!role) return false;
  
  // system_admin, schedule_admin은 무조건 관리자
  if (role === 'system_admin' || role === 'schedule_admin') {
    return true;
  }
  
  // manager는 shooting_manager일 때만 관리자 취급
  if (role === 'manager' && managerType === 'shooting_manager') {
    return true;
  }
  
  return false;
};

// ✅ 역할별 시작(기본) 경로
export const ROLE_START_PATH: Record<UserRoleType, string> = {
  system_admin: '/admin',
  schedule_admin: '/admin',
  manager: '/admin',
  academy_manager: '/academy-schedules',
  online_manager: '/ManagerStudioSchedulePage',
  studio_manager: '/ManagerStudioSchedulePage',
  professor: '/studio-schedules',
  shooter: '/shooter/ShooterDashboard',
  staff: '/login',
};

// ✅ manager + managerType 조합별 시작 경로
const MANAGER_TYPE_START_PATH: Record<ManagerType, string> = {
  shooting_manager: '/admin',
  academy_manager: '/academy-schedules',
  online_manager: '/ManagerStudioSchedulePage',
};

// ✅ 기능별 플래그 관리
const FEATURE_FLAGS = {
  SHOOTER_DASHBOARD_READY: false,
  ACADEMY_SCHEDULES_READY: true,
  MANAGER_STUDIO_READY: true,
} as const;

// ✅ 역할별 허용 경로 (확장됨)
const ROLE_ALLOWED_PATHS: Record<UserRoleType, string[]> = {
  system_admin: ['*'],
  schedule_admin: ['*'],
  manager: ['*'],
  academy_manager: [
    '/academy-schedules',
    '/profile',
    '/settings'
  ],
  online_manager: [
    '/admin',
    '/ManagerStudioSchedulePage',
    '/profile',
    '/settings'
  ],
  studio_manager: [
    '/admin',
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
  staff: ['/login']
};

// ✅ manager + managerType 별 허용 경로
const MANAGER_TYPE_ALLOWED_PATHS: Record<ManagerType, string[]> = {
  shooting_manager: ['*'],  // 모든 경로 허용
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
};

// ✅ 시작 경로 반환 (managerType 지원)
export const getRedirectPath = (role?: string, managerType?: ManagerType): string => {
  const r = (role || '') as DbUserRole;
  
  // 🎯 manager인 경우 managerType으로 분기
  if (r === 'manager' && managerType) {
    const path = MANAGER_TYPE_START_PATH[managerType];
    if (path) {
      console.log('🎯 매니저 타입별 리다이렉트:', { managerType, path });
      return path;
    }
  }
  
  // 🎯 Shooter 특별 처리
  if (r === 'shooter' && !FEATURE_FLAGS.SHOOTER_DASHBOARD_READY) {
    return '/shooter/ShooterDashboard';
  }
  
  // 🎯 일반적인 역할별 기본 경로
  const defaultPath = ROLE_START_PATH[r as UserRoleType];
  if (defaultPath && defaultPath !== '/login') {
    return defaultPath;
  }
  
  // 🎯 폴백: 로그인 페이지
  return '/login';
};

// ✅ 접근 권한 체크 (managerType 지원)
export const canAccessPage = (
  role: UserRoleType | DbUserRole | undefined, 
  path: string,
  managerType?: ManagerType
): boolean => {
  // 🔒 역할이 없으면 로그인 페이지만 허용
  if (!role) {
    return path === '/login' || path === '/';
  }
  
  // 🔓 시스템/스케줄 관리자는 모든 페이지 접근 가능
  if (role === 'system_admin' || role === 'schedule_admin') {
    return true;
  }
  
  // 🎯 manager인 경우 managerType으로 분기
  if (role === 'manager' && managerType) {
    const allowedPaths = MANAGER_TYPE_ALLOWED_PATHS[managerType];
    if (allowedPaths) {
      // 와일드카드 체크
      if (allowedPaths.includes('*')) {
        return true;
      }
      
      // 정확한 경로 매칭
      if (allowedPaths.includes(path)) {
        return true;
      }
      
      // 동적 경로 패턴 매칭
      return allowedPaths.some(allowedPath => {
        if (allowedPath.endsWith('/*')) {
          const basePath = allowedPath.slice(0, -2);
          return path.startsWith(basePath);
        }
        return false;
      });
    }
  }
  
  // 🎯 역할별 허용 경로 확인
  const allowedPaths = ROLE_ALLOWED_PATHS[role as UserRoleType];
  if (!allowedPaths) {
    return false;
  }
  
  // 🌟 와일드카드 체크
  if (allowedPaths.includes('*')) {
    return true;
  }
  
  // 🎯 정확한 경로 매칭
  if (allowedPaths.includes(path)) {
    return true;
  }
  
  // 🎯 동적 경로 패턴 매칭
  return allowedPaths.some(allowedPath => {
    if (allowedPath.endsWith('/*')) {
      const basePath = allowedPath.slice(0, -2);
      return path.startsWith(basePath);
    }
    return false;
  });
};

// ✅ 페이지 접근 가능 여부와 리다이렉트 경로 반환 (managerType 지원)
export const checkPageAccess = (
  role: UserRoleType | DbUserRole | undefined, 
  path: string,
  managerType?: ManagerType
): {
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
  const canAccess = canAccessPage(role, path, managerType);
  
  if (canAccess) {
    return { canAccess: true };
  }
  
  // 🔄 접근 불가능한 경우 해당 역할의 기본 페이지로 리다이렉트
  const redirectTo = getRedirectPath(role, managerType);
  const displayName = ROLE_DISPLAY_NAMES[role as UserRoleType] || role;
  
  return { 
    canAccess: false, 
    redirectTo,
    reason: `${displayName} 권한으로는 접근할 수 없는 페이지입니다`
  };
};

// ✅ 개발자용 디버깅 함수 (managerType 지원)
export const debugRoleAccess = (
  role: UserRoleType | DbUserRole, 
  path: string,
  managerType?: ManagerType
): void => {
  if (process.env.NODE_ENV === 'development') {
    const result = checkPageAccess(role, path, managerType);
    console.group(`🔍 Role Access Debug: ${role}${managerType ? ` (${managerType})` : ''} → ${path}`);
    console.log('✅ Can Access:', result.canAccess);
    if (!result.canAccess) {
      console.log('🔄 Redirect To:', result.redirectTo);
      console.log('📝 Reason:', result.reason);
    }
    
    if (role === 'manager' && managerType) {
      console.log('🎯 Manager Type Allowed Paths:', MANAGER_TYPE_ALLOWED_PATHS[managerType]);
    } else {
      console.log('🎯 Allowed Paths:', ROLE_ALLOWED_PATHS[role as UserRoleType]);
    }
    console.log('🏠 Default Path:', getRedirectPath(role, managerType));
    console.groupEnd();
  }
};

// ✅ 표시명/색상 (기존 유지)
export const ROLE_DISPLAY_NAMES: Record<UserRoleType, string> = {
  system_admin: '시스템 관리자',
  schedule_admin: '스케줄 관리자',
  manager: '일반 관리자',
  academy_manager: '학원 관리자',
  online_manager: '온라인 관리자',
  studio_manager: '스튜디오 관리자',
  professor: '교수',
  shooter: '촬영자',
  staff: '일반 직원',
};

export const ROLE_COLORS: Record<UserRoleType, string> = {
  system_admin: '#dc2626',
  schedule_admin: '#ea580c',
  manager: '#f97316',
  academy_manager: '#3b82f6',
  online_manager: '#059669',
  studio_manager: '#6366f1',
  professor: '#0891b2',
  shooter: '#7c3aed',
  staff: '#6b7280',
};

// ✅ 권한 레벨 정의
export const ROLE_LEVELS: Record<UserRoleType, number> = {
  system_admin: 100,
  schedule_admin: 90,
  manager: 85,
  academy_manager: 50,
  online_manager: 50,
  studio_manager: 50,
  professor: 30,
  shooter: 20,
  staff: 10,
};

// ✅ 역할 비교 함수
export const hasHigherRole = (userRole: UserRoleType, requiredRole: UserRoleType): boolean => {
  return ROLE_LEVELS[userRole] >= ROLE_LEVELS[requiredRole];
};

// ✅ 기능별 접근 권한 체크 (managerType 지원)
export const canAccessFeature = (
  role: UserRoleType | DbUserRole, 
  feature: string,
  managerType?: ManagerType
): boolean => {
  const featurePermissions: Record<string, (UserRoleType | string)[]> = {
    'schedule_management': ['system_admin', 'schedule_admin', 'manager'],
    'studio_booking': ['system_admin', 'schedule_admin', 'manager', 'professor'],
    'shooting_schedule': ['system_admin', 'schedule_admin', 'manager', 'shooter'],
    'academy_schedule': ['system_admin', 'schedule_admin', 'manager', 'academy_manager'],
    'report_view': ['system_admin', 'schedule_admin', 'manager', 'academy_manager', 'online_manager'],
    'admin_dashboard': ['system_admin', 'schedule_admin'],
  };
  
  const allowedRoles = featurePermissions[feature];
  if (!allowedRoles) return false;
  
  // 기본 역할 체크
  if (allowedRoles.includes(role)) {
    return true;
  }
  
  // manager + managerType 체크
  if (role === 'manager' && managerType) {
    // shooting_manager는 manager와 동일한 권한
    if (managerType === 'shooting_manager' && allowedRoles.includes('manager')) {
      return true;
    }
    // online_manager는 admin_dashboard 접근 가능
    if (managerType === 'online_manager' && feature === 'admin_dashboard') {
      return true;
    }
  }
  
  return false;
};
