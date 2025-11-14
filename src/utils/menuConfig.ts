// utils/menuConfig.ts
export interface MenuItem {
  id: string;
  name: string;
  path: string;
  category: string;
  children?: MenuItem[];
}

// 🔧 6개 카테고리 메뉴 구조 (DB 권한과 완전 일치)
export const MENU_CONFIG: MenuItem[] = [
  {
    id: 'schedule-management',
    name: '스케줄 관리',
    path: '/schedule-management',
    category: '스케줄 관리',
    children: [
      { id: 'all-schedules', name: '통합 스케줄', path: '/all-schedules', category: '스케줄 관리' },
      { id: 'academy-schedules', name: '학원 스케줄', path: '/academy-schedules', category: '스케줄 관리' },
      { id: 'studio-admin', name: '스튜디오 스케줄', path: '/studio-admin', category: '스케줄 관리' },
      { id: 'internal-schedules', name: '내부업무 스케줄', path: '/internal-schedules', category: '스케줄 관리' },
      { id: 'ManagerStudioSchedulePage', name: '온라인매니저 스케줄', path: '/ManagerStudioSchedulePage', category: '스케줄 관리' },
      { id: 'studio-schedules', name: '교수님 스케줄 등록', path: '/studio-schedules', category: '스케줄 관리' },
      
    ]
  },
  {
    id: 'member-management',
    name: '멤버 관리',
    path: '/member-management',
    category: '멤버 관리',
    children: [
      { id: 'admin.members.overview', name: '전체 현황', path: '/admin/members/overview', category: '멤버 관리' },
      { id: 'admin.members.admins', name: '관리자 관리', path: '/admin/members/admins', category: '멤버 관리' },
      { id: 'admin.members.managers', name: '매니저 관리', path: '/admin/members/managers', category: '멤버 관리' },
      { id: 'admin.members.shooters', name: '촬영자 관리', path: '/admin/members/shooters', category: '멤버 관리' },
      { id: 'admin.professors', name: '교수 관리', path: '/admin/professors', category: '멤버 관리' },
    ]
  },
  {
    id: 'shooter-management',
    name: '촬영자',
    path: '/shooter-management',
    category: '촬영자',
    children: [
      { id: 'shooter.ShooterDashboard', name: '촬영자 대시보드', path: '/shooter/ShooterDashboard', category: '촬영자' },
      { id: 'shooter.schedule-check', name: '스케줄 확인', path: '/shooter/schedule-check', category: '촬영자' },
      { id: 'shooter.FreelancerWeeklySchedule', name: '주간 스케줄 등록', path: '/shooter/FreelancerWeeklySchedule', category: '촬영자' },
      { id: 'shooter.tracking', name: '촬영 추적', path: '/shooter/tracking', category: '촬영자' },
      { id: 'admin.freelancer-schedules', name: '프리랜서 스케줄 조회', path: '/admin/freelancer-schedules', category: '촬영자' },
      { id: 'admin.shooting-reports', name: '촬영 기록표', path: '/admin/shooting-reports', category: '촬영자' }
    ]
  },
  {
    id: 'system-management',
    name: '시스템 관리',
    path: '/system-management',
    category: '시스템 관리',
    children: [
      { id: 'admin.dashboard', name: '관리자 대시보드', path: '/admin', category: '시스템 관리' },
      { id: 'studio-shooting-types', name: '스튜디오 촬영 타입', path: '/studio-shooting-types', category: '시스템 관리' },
      { id: 'professor-categories', name: '교수 카테고리', path: '/professor-categories', category: '시스템 관리' },
      { id: 'permissions', name: '권한 관리', path: '/permissions', category: '시스템 관리' },
      { id: 'admin.tracking', name: '실시간 촬영 현황', path: '/admin/tracking', category: '시스템 관리' },
      { id: 'admin.qr-locations', name: '학원별 QR코드', path: '/admin/qr-locations', category: '시스템 관리' },
      { id: 'notifications.center', name: '알림 센터', path: '/notifications/center', category: '시스템 관리' },
      { id: 'admin.NotificationManager', name: '공지사항 관리', path: '/admin/NotificationManager', category: '시스템 관리' }
    ]
  },
  {
    id: 'statistics',
    name: '통계',
    path: '/statistics',
    category: '통계',
    children: [
      { id: 'admin.analysis', name: '데이터 분석', path: '/admin/analysis', category: '통계' },
      { id: 'admin.summary', name: '요약 리포트', path: '/admin/summary', category: '통계' },
      { id: 'statistics.schedule', name: '스케줄 통계', path: '/statistics/schedule', category: '통계' },
      { id: 'statistics.member', name: '멤버 통계', path: '/statistics/member', category: '통계' },
      { id: 'statistics.shooting', name: '촬영 통계', path: '/statistics/shooting', category: '통계' },
      { id: 'statistics.performance', name: '성과 분석', path: '/statistics/performance', category: '통계' }
    ]
  },
  {
    id: 'settings',
    name: '설정',
    path: '/settings',
    category: '설정',
    children: [
      { id: 'settings.profile', name: '내 프로필', path: '/settings/profile', category: '설정' },
    ]
  }
];

// 🔧 모든 메뉴 아이템을 플랫하게 반환
export const getAllMenuItems = (): MenuItem[] => {
  const allItems: MenuItem[] = [];
  
  const collectItems = (items: MenuItem[]) => {
    items.forEach(item => {
      allItems.push(item);
      if (item.children) {
        collectItems(item.children);
      }
    });
  };
  
  collectItems(MENU_CONFIG);
  return allItems;
};

// 🔧 카테고리별로 메뉴 그룹화
export const getMenusByCategory = () => {
  const allItems = getAllMenuItems();
  return allItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);
};

// 🔧 역할별 주요 접근 메뉴 (참고용)
export const getRoleMainMenus = () => {
  return {
    'system_admin': '모든 메뉴 접근 가능',
    'schedule_admin': '권한관리, 관리자관리 제외한 거의 모든 메뉴',
    'manager': '스케줄/통계 전반 관리 (승인 기능 제외)',
    'academy_manager': ['academy-schedules', 'settings.profile'],
    'online_manager': ['ManagerStudioSchedulePage', 'settings.profile'], 
    'shooter': [
      'shooter.ShooterDashboard',
      'shooter.schedule-check', 
      'shooter.FreelancerWeeklySchedule',
      'shooter.tracking',
      'settings.profile'
    ],
    'professor': ['studio-schedules', 'settings.profile'],
    'studio_manager': [
      'studio-admin',
      'studio-schedules', 
      'studio.StudioAdminPanel',
      'studio-shooting-types',
      'settings.profile'
    ],
    'staff': ['settings.profile']
  };
};

export default MENU_CONFIG;
