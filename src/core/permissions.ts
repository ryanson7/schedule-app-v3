import { UserRole, ScheduleType } from './types';

// 🔥 확장된 권한 매핑 (manager1 계정 포함)
export const hasAccess = (role: UserRole, area: ScheduleType): boolean => {
  const accessMap = {
    academy: [
      'system_admin', 
      'schedule_admin', 
      'academy_manager', 
      'manager',
      'manager1'  // 🔥 manager1 계정 추가
    ],
    studio: [
      'system_admin', 
      'schedule_admin', 
      'studio_manager', 
      'manager',
      'manager1'   // 🔥 manager1 계정 추가
    ],
    internal: [
      'system_admin', 
      'schedule_admin', 
      'manager',
      'manager1'   // 🔥 manager1 계정 추가
    ],
    integrated: [
      'system_admin', 
      'schedule_admin', 
      'academy_manager', 
      'studio_manager', 
      'manager',
      'manager1'   // 🔥 manager1 계정 추가
    ]
  };
  
  // 🔥 디버깅 로그 추가
  console.log('🔍 권한 체크:', {
    사용자역할: role,
    접근영역: area,
    허용역할목록: accessMap[area],
    접근허용: accessMap[area]?.includes(role) || false
  });
  
  return accessMap[area]?.includes(role) || false;
};

// 🔥 안전한 사용자 역할 검증 (manager1 포함)
export const safeUserRole = (roleString: string): UserRole => {
  const validRoles: UserRole[] = [
    'system_admin', 
    'schedule_admin', 
    'academy_manager', 
    'studio_manager', 
    'manager', 
    'manager1',     // 🔥 manager1 계정 추가
    'staff',
    'user',
    'viewer'
  ];
  
  const normalizedRole = roleString?.toLowerCase()?.trim();
  
  // 🔥 특별 계정 매핑
  const specialAccountMapping: { [key: string]: UserRole } = {
    'manager001': 'manager1',
    'admin001': 'system_admin',
    'studio001': 'studio_manager',
    'academy001': 'academy_manager'
  };
  
  // 특별 계정 체크
  if (specialAccountMapping[normalizedRole]) {
    console.log('🔑 특별 계정 매핑:', {
      입력값: roleString,
      매핑결과: specialAccountMapping[normalizedRole]
    });
    return specialAccountMapping[normalizedRole];
  }
  
  // 일반 역할 체크
  if (validRoles.includes(normalizedRole as UserRole)) {
    console.log('✅ 유효한 역할 확인:', normalizedRole);
    return normalizedRole as UserRole;
  }
  
  console.warn('⚠️ 알 수 없는 역할, 기본값 적용:', { 
    원본역할: roleString, 
    정규화역할: normalizedRole,
    적용역할: 'staff' 
  });
  
  return 'staff';
};

// 🔥 확장된 사용자 권한 정의 (manager1 포함)
export const getUserPermissions = (role: UserRole) => {
  const permissions = {
    // 최고 관리자 권한
    system_admin: {
      canApprove: true,
      canDelete: true,
      canEdit: true,
      canCreate: true,
      canManageUsers: true,
      canViewAllSchedules: true,
      canExportData: true,
      canManageSystem: true
    },
    
    // 스케줄 관리자 권한
    schedule_admin: {
      canApprove: true,
      canDelete: true,
      canEdit: true,
      canCreate: true,
      canManageUsers: false,
      canViewAllSchedules: true,
      canExportData: true,
      canManageSystem: false
    },
    
    // 아카데미 매니저 권한
    academy_manager: {
      canApprove: false,
      canDelete: false,
      canEdit: true,
      canCreate: true,
      canManageUsers: false,
      canViewAllSchedules: false,
      canExportData: false,
      canManageSystem: false
    },
    
    // 스튜디오 매니저 권한
    studio_manager: {
      canApprove: false,
      canDelete: false,
      canEdit: true,
      canCreate: true,
      canManageUsers: false,
      canViewAllSchedules: false,
      canExportData: false,
      canManageSystem: false
    },
    
    // 일반 매니저 권한
    manager: {
      canApprove: false,
      canDelete: false,
      canEdit: true,
      canCreate: true,
      canManageUsers: false,
      canViewAllSchedules: false,
      canExportData: false,
      canManageSystem: false
    },
    
    // 🔥 manager1 계정 특별 권한
    manager1: {
      canApprove: true,     // 승인 권한 부여
      canDelete: true,      // 삭제 권한 부여
      canEdit: true,
      canCreate: true,
      canManageUsers: false,
      canViewAllSchedules: true,  // 모든 스케줄 보기 권한
      canExportData: true,        // 데이터 내보내기 권한
      canManageSystem: false
    },
    
    // 일반 직원 권한
    staff: {
      canApprove: false,
      canDelete: false,
      canEdit: false,
      canCreate: false,
      canManageUsers: false,
      canViewAllSchedules: false,
      canExportData: false,
      canManageSystem: false
    },
    
    // 사용자 권한
    user: {
      canApprove: false,
      canDelete: false,
      canEdit: false,
      canCreate: false,
      canManageUsers: false,
      canViewAllSchedules: false,
      canExportData: false,
      canManageSystem: false
    },
    
    // 뷰어 권한
    viewer: {
      canApprove: false,
      canDelete: false,
      canEdit: false,
      canCreate: false,
      canManageUsers: false,
      canViewAllSchedules: false,
      canExportData: false,
      canManageSystem: false
    }
  };
  
  const userPermissions = permissions[role] || permissions.staff;
  
  console.log('🔐 사용자 권한 조회:', {
    역할: role,
    권한: userPermissions
  });
  
  return userPermissions;
};

// 🔥 특정 기능별 권한 체크 함수들
export const canManageStudio = (role: UserRole): boolean => {
  return hasAccess(role, 'studio');
};

export const canManageAcademy = (role: UserRole): boolean => {
  return hasAccess(role, 'academy');
};

export const canApproveSchedules = (role: UserRole): boolean => {
  const permissions = getUserPermissions(role);
  return permissions.canApprove;
};

export const canDeleteSchedules = (role: UserRole): boolean => {
  const permissions = getUserPermissions(role);
  return permissions.canDelete;
};

export const canEditSchedules = (role: UserRole): boolean => {
  const permissions = getUserPermissions(role);
  return permissions.canEdit;
};

export const canCreateSchedules = (role: UserRole): boolean => {
  const permissions = getUserPermissions(role);
  return permissions.canCreate;
};

// 🔥 역할 표시명 매핑
export const getRoleDisplayName = (role: UserRole): string => {
  const displayNames = {
    system_admin: '시스템 관리자',
    schedule_admin: '스케줄 관리자',
    academy_manager: '아카데미 매니저',
    studio_manager: '스튜디오 매니저',
    manager: '매니저',
    manager1: '매니저1 (특별권한)',  // 🔥 manager1 표시명
    staff: '직원',
    user: '사용자',
    viewer: '뷰어'
  };
  
  return displayNames[role] || '알 수 없음';
};

// 🔥 개발 모드 권한 우회 (개발용)
export const isDevelopmentMode = (): boolean => {
  return process.env.NODE_ENV === 'development';
};

export const hasDevAccess = (role: UserRole, area: ScheduleType): boolean => {
  if (isDevelopmentMode()) {
    console.log('🚧 개발 모드: 모든 권한 허용');
    return true;
  }
  return hasAccess(role, area);
};

// 🔥 권한 검증 및 리다이렉트 헬퍼
export const checkAccessAndRedirect = (
  role: UserRole, 
  area: ScheduleType, 
  redirectCallback?: () => void
): boolean => {
  const hasPermission = hasAccess(role, area);
  
  if (!hasPermission) {
    console.warn('🚫 접근 권한 없음:', {
      사용자역할: role,
      요청영역: area,
      권한표시명: getRoleDisplayName(role)
    });
    
    if (redirectCallback) {
      redirectCallback();
    }
  }
  
  return hasPermission;
};

// 🔥 브라우저 개발자 도구용 디버깅 함수
export const debugPermissions = (username: string = 'manager1') => {
  console.group('🔍 권한 시스템 디버깅');
  
  const role = safeUserRole(username);
  console.log('1. 역할 변환:', { 입력: username, 결과: role });
  
  const permissions = getUserPermissions(role);
  console.log('2. 사용자 권한:', permissions);
  
  const areas: ScheduleType[] = ['academy', 'studio'];
  areas.forEach(area => {
    const access = hasAccess(role, area);
    console.log(`3. ${area} 접근:`, access);
  });
  
  console.log('4. 역할 표시명:', getRoleDisplayName(role));
  
  console.groupEnd();
  
  return {
    role,
    permissions,
    accessMatrix: {
      academy: hasAccess(role, 'academy'),
      studio: hasAccess(role, 'studio')
    }
  };
};

// 전역 객체에 디버깅 함수 등록 (개발용)
if (typeof window !== 'undefined' && isDevelopmentMode()) {
  (window as any).debugPermissions = debugPermissions;
  console.log('🔧 브라우저 콘솔에서 debugPermissions("manager1") 실행 가능');
}
