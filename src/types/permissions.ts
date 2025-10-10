import { UserRoleType, PermissionScope, DEFAULT_PERMISSIONS } from '../types/users';

// 권한 검사 함수
export const hasPermission = (
  userRole: UserRoleType,
  resource: keyof typeof DEFAULT_PERMISSIONS[UserRoleType],
  requiredLevel: PermissionScope,
  userAcademyIds?: number[],
  targetAcademyId?: number
): boolean => {
  const userPermission = DEFAULT_PERMISSIONS[userRole][resource];
  
  // 권한 없음
  if (userPermission === 'none') return false;
  
  // 전체 권한
  if (userPermission === 'admin') return true;
  
  // 담당 영역만 접근 가능
  if (userPermission === 'assigned_only') {
    if (!userAcademyIds || !targetAcademyId) return false;
    return userAcademyIds.includes(targetAcademyId);
  }
  
  // 권한 레벨 비교
  const permissionLevels = ['none', 'read', 'write', 'manage', 'admin'];
  const userLevel = permissionLevels.indexOf(userPermission);
  const requiredLevelIndex = permissionLevels.indexOf(requiredLevel);
  
  return userLevel >= requiredLevelIndex;
};

// 학원 스케줄 권한 검사
export const canAccessAcademySchedule = (
  userRole: UserRoleType,
  action: 'read' | 'write' | 'approve',
  userAcademyIds?: number[],
  targetAcademyId?: number
): boolean => {
  return hasPermission(userRole, 'academy_schedules', action, userAcademyIds, targetAcademyId);
};

// 스튜디오 스케줄 권한 검사
export const canAccessStudioSchedule = (
  userRole: UserRoleType,
  action: 'read' | 'write' | 'approve'
): boolean => {
  return hasPermission(userRole, 'studio_schedules', action);
};

// 사용자 관리 권한 검사
export const canManageUsers = (
  userRole: UserRoleType,
  action: 'read' | 'write' | 'manage',
  userAcademyIds?: number[],
  targetUserAcademyId?: number
): boolean => {
  return hasPermission(userRole, 'user_management', action, userAcademyIds, targetUserAcademyId);
};

// 역할별 접근 가능한 메뉴 반환
export const getAccessibleMenus = (userRole: UserRoleType) => {
  const menus = [];
  
  // 스케줄 메뉴
  if (hasPermission(userRole, 'academy_schedules', 'read')) {
    menus.push('academy-schedules');
  }
  if (hasPermission(userRole, 'studio_schedules', 'read')) {
    menus.push('studio-schedules');
  }
  
  // 관리 메뉴
  if (hasPermission(userRole, 'user_management', 'read')) {
    menus.push('user-management');
  }
  if (hasPermission(userRole, 'system_settings', 'read')) {
    menus.push('system-settings');
  }
  
  // 촬영 메뉴
  if (hasPermission(userRole, 'shooting_tasks', 'read')) {
    menus.push('shooting-tasks');
  }
  
  return menus;
};
