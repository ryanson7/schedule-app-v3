// src/utils/permissionUtils.ts
import { dynamicPermissionSystem } from './dynamicPermissionSystem';

// 🔥 타입 정의
export type UserRoleType =
  | 'system_admin'
  | 'schedule_admin'
  | 'manager'
  | 'academy_manager'
  | 'online_manager'
  | 'professor'
  | 'shooter'
  | 'staff';

// 🔥 현재 사용자 역할 가져오기
export const getUserRole = (): UserRoleType => {
  if (typeof window === 'undefined') return 'staff';
  
  try {
    const storedRole = localStorage.getItem('userRole');
    const userName = localStorage.getItem('userName');
    
    // 특별 계정 매핑
    const specialAccounts: Record<string, UserRoleType> = {
      'admin': 'system_admin',
      'manager1': 'schedule_admin',
      'manager1': 'manager',
      'studio001': 'online_manager',
      'academy001': 'academy_manager'
    };
    
    if (userName && specialAccounts[userName]) {
      return specialAccounts[userName];
    }
    
    if (storedRole && isValidRole(storedRole)) {
      return storedRole as UserRoleType;
    }
    
    return 'staff';
  } catch (error) {
    console.error('사용자 역할 조회 실패:', error);
    return 'staff';
  }
};

// 🔥 유효한 역할인지 확인
export const isValidRole = (role: string): boolean => {
  const validRoles: UserRoleType[] = [
    'system_admin',
    'schedule_admin',
    'manager',
    'academy_manager',
    'online_manager',
    'professor',
    'shooter',
    'staff'
  ];
  return validRoles.includes(role as UserRoleType);
};

// 🔥 로그인 상태 확인 (_app.tsx에서 사용)
export const isLoggedIn = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  try {
    const userName = localStorage.getItem('userName');
    const userRole = localStorage.getItem('userRole');
    
    return !!(userName && userRole);
  } catch (error) {
    console.error('로그인 상태 확인 실패:', error);
    return false;
  }
};

// 🔥 권한 시스템 디버깅 (_app.tsx에서 사용)
export const debugPermissionSystem = () => {
  if (typeof window === 'undefined') return;
  
  try {
    const userRole = getUserRole();
    const userName = localStorage.getItem('userName') || '사용자';
    const isUserLoggedIn = isLoggedIn();
    const systemInitialized = dynamicPermissionSystem.isInitialized();
    
    console.group('🔍 권한 시스템 디버깅');
    console.log('사용자명:', userName);
    console.log('현재 역할:', userRole);
    console.log('로그인 상태:', isUserLoggedIn);
    console.log('시스템 초기화:', systemInitialized);
    console.log('브라우저 환경:', typeof window !== 'undefined');
    
    if (systemInitialized) {
      const userMenus = dynamicPermissionSystem.getUserMenus(userRole);
      console.log('사용 가능한 메뉴:', userMenus);
    }
    
    console.groupEnd();
  } catch (error) {
    console.error('❌ 권한 시스템 디버깅 실패:', error);
  }
};

// 🔥 페이지 접근 권한 체크 (dynamicPermissionSystem 연동)
export const checkPageAccess = (userRole: string, pagePath: string): boolean => {
  if (!userRole) return false;
  
  // 시스템 관리자는 모든 접근 허용
  if (userRole === 'system_admin') return true;
  
  // 동적 권한 시스템으로 체크
  return dynamicPermissionSystem.canAccessPage(userRole as UserRoleType, pagePath);
};

// 🔥 메뉴 표시 여부 체크 (dynamicPermissionSystem 연동)
export const isMenuVisible = (userRole: string, pagePath: string): boolean => {
  if (!userRole) return false;
  return dynamicPermissionSystem.isMenuVisible(userRole as UserRoleType, pagePath);
};

// 🔥 사용자별 메뉴 조회 (dynamicPermissionSystem 연동)
export const getUserMenus = (userRole: string) => {
  if (!userRole) return [];
  return dynamicPermissionSystem.getUserMenus(userRole as UserRoleType);
};

// 🔥 권한 업데이트 (dynamicPermissionSystem 연동)
export const updateUserPermission = async (
  userRole: string, 
  pagePath: string, 
  hasAccess: boolean
): Promise<boolean> => {
  if (!userRole) return false;
  return await dynamicPermissionSystem.updatePermission(
    userRole as UserRoleType, 
    pagePath, 
    hasAccess
  );
};

// 🔥 역할 표시명 가져오기
export const getRoleDisplayName = (role: UserRoleType): string => {
  const roleNames: Record<UserRoleType, string> = {
    'system_admin': '시스템 관리자',
    'schedule_admin': '스케줄 관리자',
    'manager': '일반 관리자',
    'academy_manager': '학원 매니저',
    'online_manager': '온라인 매니저',
    'professor': '교수',
    'shooter': '촬영자',
    'staff': '일반 직원'
  };
  return roleNames[role] || role;
};

// 🔥 권한 기반 조건부 렌더링 헬퍼
export const withPermission = (
  userRole: string,
  requiredRoles: UserRoleType[],
  component: React.ReactNode,
  fallback?: React.ReactNode
): React.ReactNode => {
  const hasPermission = requiredRoles.includes(userRole as UserRoleType) || 
                       userRole === 'system_admin';
  return hasPermission ? component : (fallback || null);
};

// 🔥 기능별 권한 체크 함수들
export const canManageSchedules = (userRole: string): boolean => {
  const manageRoles: UserRoleType[] = ['system_admin', 'schedule_admin', 'manager'];
  return manageRoles.includes(userRole as UserRoleType);
};

export const canManageMembers = (userRole: string): boolean => {
  const manageRoles: UserRoleType[] = ['system_admin', 'schedule_admin', 'manager'];
  return manageRoles.includes(userRole as UserRoleType);
};

export const canManageProfessors = (userRole: string): boolean => {
  const manageRoles: UserRoleType[] = ['system_admin', 'schedule_admin', 'manager'];
  return manageRoles.includes(userRole as UserRoleType);
};

export const canAccessShooterFeatures = (userRole: string): boolean => {
  const shooterRoles: UserRoleType[] = ['system_admin', 'schedule_admin', 'shooter'];
  return shooterRoles.includes(userRole as UserRoleType);
};

export const canAccessAcademyFeatures = (userRole: string): boolean => {
  const academyRoles: UserRoleType[] = ['system_admin', 'schedule_admin', 'manager', 'academy_manager'];
  return academyRoles.includes(userRole as UserRoleType);
};

export const canAccessOnlineFeatures = (userRole: string): boolean => {
  const onlineRoles: UserRoleType[] = ['system_admin', 'schedule_admin', 'manager', 'online_manager'];
  return onlineRoles.includes(userRole as UserRoleType);
};

// 🔥 권한 시스템 상태 체크 (_app.tsx에서 사용)
export const checkPermissionSystemReady = async (): Promise<boolean> => {
  try {
    if (typeof window === 'undefined') return false;
    
    // 동적 권한 시스템 초기화 확인
    const isInitialized = dynamicPermissionSystem.isInitialized();
    
    if (!isInitialized) {
      console.log('🔄 권한 시스템 초기화 중...');
      await dynamicPermissionSystem.initialize();
      return dynamicPermissionSystem.isInitialized();
    }
    
    return true;
  } catch (error) {
    console.error('❌ 권한 시스템 상태 체크 실패:', error);
    return false;
  }
};

// 🔥 사용자 인증 상태 체크 (_app.tsx에서 사용)
export const checkAuthStatus = (): { isLoggedIn: boolean; userRole: UserRoleType; userName: string } => {
  if (typeof window === 'undefined') {
    return { isLoggedIn: false, userRole: 'staff', userName: '' };
  }
  
  try {
    const userName = localStorage.getItem('userName') || '';
    const userRole = getUserRole();
    const loggedIn = isLoggedIn();
    
    return {
      isLoggedIn: loggedIn,
      userRole,
      userName
    };
  } catch (error) {
    console.error('❌ 인증 상태 체크 실패:', error);
    return { isLoggedIn: false, userRole: 'staff', userName: '' };
  }
};

// 🔥 디버깅 함수 (기존 유지)
export const debugUserPermissions = () => {
  if (typeof window === 'undefined') return;
  
  const userRole = getUserRole();
  const userMenus = getUserMenus(userRole);
  
  console.group('🔍 사용자 권한 디버깅');
  console.log('현재 역할:', userRole);
  console.log('역할 표시명:', getRoleDisplayName(userRole));
  console.log('사용 가능한 메뉴:', userMenus);
  console.log('스케줄 관리 권한:', canManageSchedules(userRole));
  console.log('멤버 관리 권한:', canManageMembers(userRole));
  console.log('교수 관리 권한:', canManageProfessors(userRole));
  console.log('촬영자 기능 접근:', canAccessShooterFeatures(userRole));
  console.log('학원 기능 접근:', canAccessAcademyFeatures(userRole));
  console.log('온라인 기능 접근:', canAccessOnlineFeatures(userRole));
  console.groupEnd();
};

// 🔥 개발 모드에서 전역 함수 등록
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).debugUserPermissions = debugUserPermissions;
  (window as any).debugPermissionSystem = debugPermissionSystem;
  console.log('🔧 브라우저 콘솔에서 debugUserPermissions(), debugPermissionSystem() 실행 가능');
}
