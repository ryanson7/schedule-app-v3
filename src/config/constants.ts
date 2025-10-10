// src/config/constants.ts
export const APP_CONFIG = {
  // 조직 정보
  organization: {
    name: '에듀윌',
    departments: {
      shooting: '촬영팀',
      management: '관리팀',
      admin: '시스템팀'
    }
  },
  
  // 역할 타입
  userRoles: {
    shootingRoles: ['shooter', 'schedule_admin'],
    adminRoles: ['system_admin', 'schedule_admin'],
    allRoles: ['shooter', 'schedule_admin', 'system_admin']
  },
  
  // 내부업무 타입
  internalWorkTypes: [
    'Helper', '행사', '기타', '장비/스튜디오대여',
    '당직', '근무', '고정휴무', '개인휴무'
  ]
};

// 사용자 타입별 설정
export const USER_TYPE_CONFIG = {
  schedule_admin: {
    displayName: '스케줄 관리자',
    color: '#dc2626',
    department: 'management',
    accessLevel: 'all_locations',
    sortOrder: 1
  },
  regular: {
    displayName: '정규 촬영자',
    color: '#059669',
    department: 'shooting',
    accessLevel: 'all_locations',
    sortOrder: 2
  },
  dispatch: {
    displayName: '파견 촬영자',
    color: '#f59e0b',
    department: 'shooting',
    accessLevel: 'all_locations',
    sortOrder: 3
  },
  freelancer: {
    displayName: '프리랜서',
    color: '#3b82f6',
    department: 'shooting',
    accessLevel: 'location_preference_only',
    sortOrder: 4
  }
};
