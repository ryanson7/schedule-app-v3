// config/menuStructure.ts
export interface MenuItem {
  id: string;
  name: string;
  path?: string;
  parent?: string;
  order: number;
  roles: string[];
  children?: MenuItem[];
  icon?: string;
}

export const MENU_STRUCTURE: MenuItem[] = [
  // 🏛️ 관리자 섹션 (상위 폴더)
  {
    id: 'admin-section',
    name: '관리자',
    order: 1,
    roles: ['system_admin', 'schedule_admin'],
    children: [
      {
        id: 'dashboard',
        name: '대시보드',
        path: '/admin',
        order: 1,
        roles: ['system_admin', 'schedule_admin']
      },
      {
        id: 'members',
        name: '멤버 관리',
        order: 2,
        roles: ['system_admin', 'schedule_admin'],
        children: [
          {
            id: 'members-overview',
            name: '개요',
            path: '/admin/members/overview',
            order: 1,
            roles: ['system_admin', 'schedule_admin']
          },
          {
            id: 'members-admins',
            name: '관리자',
            path: '/admin/members/admins',
            order: 2,
            roles: ['system_admin', 'schedule_admin']
          },
          {
            id: 'members-managers',
            name: '매니저',
            path: '/admin/members/managers',
            order: 3,
            roles: ['system_admin', 'schedule_admin']
          }
        ]
      },
      {
        id: 'professors',
        name: '교수 관리',
        path: '/admin/professors',
        order: 3,
        roles: ['system_admin', 'schedule_admin']
      },
      {
        id: 'system-settings',
        name: '시스템 설정',
        order: 4,
        roles: ['system_admin'], // system_admin만
        children: [
          {
            id: 'permissions',
            name: '권한 관리',
            path: '/permissions',
            order: 1,
            roles: ['system_admin']
          },
          {
            id: 'menu-manager',
            name: '메뉴 관리',
            path: '/admin/menu-manager',
            order: 2,
            roles: ['system_admin']
          }
        ]
      }
    ]
  },

  // 📅 스케줄 섹션
  {
    id: 'schedule-section',
    name: '스케줄 관리',
    order: 2,
    roles: ['system_admin', 'schedule_admin', 'professor', 'academy_manager', 'online_manager'],
    children: [
      {
        id: 'studio-schedules',
        name: '스튜디오 스케줄',
        path: '/studio-schedules',
        order: 1,
        roles: ['system_admin', 'schedule_admin', 'professor']
      },
      {
        id: 'academy-schedules',
        name: '아카데미 스케줄',
        path: '/academy-schedules',
        order: 2,
        roles: ['system_admin', 'schedule_admin', 'academy_manager']
      },
      {
        id: 'manager-studio',
        name: '매니저 스튜디오',
        path: '/ManagerStudioSchedulePage',
        order: 3,
        roles: ['system_admin', 'schedule_admin', 'online_manager']
      },
      {
        id: 'all-schedules',
        name: '전체 스케줄',
        path: '/all-schedules',
        order: 4,
        roles: ['system_admin', 'schedule_admin']
      }
    ]
  },

  // 🎬 촬영자 섹션
  {
    id: 'shooter-section',
    name: '촬영 관리',
    order: 3,
    roles: ['shooter'],
    children: [
      {
        id: 'shooter-dashboard',
        name: '촬영 대시보드',
        path: '/shooter/ShooterDashboard',
        order: 1,
        roles: ['shooter']
      },
      {
        id: 'schedule-check',
        name: '스케줄 확인',
        path: '/shooter/schedule-check',
        order: 2,
        roles: ['shooter']
      },
      {
        id: 'schedule-register',
        name: '일정 등록',
        path: '/shooter/schedule-register',
        order: 3,
        roles: ['shooter']
      }
    ]
  },

  // ⚙️ 설정 섹션
  {
    id: 'settings-section',
    name: '설정',
    order: 10,
    roles: ['system_admin', 'schedule_admin', 'professor', 'shooter', 'academy_manager', 'online_manager'],
    children: [
      {
        id: 'profile',
        name: '프로필 설정',
        path: '/settings/profile',
        order: 1,
        roles: ['system_admin', 'schedule_admin', 'professor', 'shooter', 'academy_manager', 'online_manager']
      },
      {
        id: 'notifications',
        name: '알림 센터',
        path: '/notifications/center',
        order: 2,
        roles: ['system_admin', 'schedule_admin', 'professor', 'shooter', 'academy_manager', 'online_manager']
      }
    ]
  }
];
