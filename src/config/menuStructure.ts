// utils/menuStructure.ts - 폴더화된 메뉴 구조
export const MENU_CATEGORIES = {
  HOME: {
    id: 'home',
    name: '홈',
    path: '/',
    icon: 'Home',
    order: 1,
    type: 'single' // 단일 메뉴
  },
  
  ADMIN: {
    id: 'admin',
    name: '관리자',
    icon: 'Settings',
    order: 2,
    type: 'folder', // 폴더형 메뉴
    children: [
      { id: 'user-management', name: '사용자 관리', path: '/admin/users', icon: 'Users' },
      { id: 'permission-management', name: '권한 관리', path: '/admin/permission-manager', icon: 'Shield' },
      { id: 'system-settings', name: '시스템 설정', path: '/admin/settings', icon: 'Cog' }
    ]
  },

  SCHEDULES: {
    id: 'schedules',
    name: '스케줄',
    icon: 'Calendar',
    order: 3,
    type: 'folder',
    children: [
      { id: 'all-schedules', name: '전체 스케줄', path: '/all-schedules', icon: 'List' },
      { id: 'studio-schedules', name: '스튜디오 스케줄', path: '/studio-schedules', icon: 'Video' },
      { id: 'academy-schedules', name: '학원 스케줄', path: '/academy-schedules', icon: 'School' },
      { id: 'freelancer-schedules', name: '프리랜서 스케줄', path: '/admin/freelancer-schedules', icon: 'User' }
    ]
  },

  REPORTS: {
    id: 'reports',
    name: '리포트',
    path: '/reports',
    icon: 'BarChart',
    order: 4,
    type: 'single'
  },

  SHOOTING: {
    id: 'shooting',
    name: '촬영',
    icon: 'Camera',
    order: 5,
    type: 'folder',
    children: [
      { id: 'shooter-dashboard', name: '촬영자 대시보드', path: '/shooter/dashboard', icon: 'Camera' }
    ]
  },

  PROFILE: {
    id: 'profile',
    name: '프로필',
    path: '/profile',
    icon: 'User',
    order: 6,
    type: 'single'
  }
};
