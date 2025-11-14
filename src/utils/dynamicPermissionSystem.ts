// src/utils/dynamicPermissionSystem.ts
import { UserRoleType } from '../types/users';

// 🔥 동적 페이지 및 메뉴 관리
interface DynamicPage {
  id: string;
  path: string;
  name: string;
  icon: string;
  category: string;
  requiredPermissions: string[];
  allowedRoles: UserRoleType[];
  isActive: boolean;
  parentId?: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

interface DynamicRole {
  id: UserRoleType;
  name: string;
  color: string;
  permissions: string[];
  level: number;
  isActive: boolean;
  customPages: string[];
}

// 🔥 브라우저 환경 체크 함수
const isBrowser = typeof window !== 'undefined';

// 🔥 안전한 localStorage 접근
const safeLocalStorage = {
  getItem: (key: string): string | null => {
    if (!isBrowser) return null;
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error('localStorage getItem 오류:', error);
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    if (!isBrowser) return;
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.error('localStorage setItem 오류:', error);
    }
  },
  removeItem: (key: string): void => {
    if (!isBrowser) return;
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('localStorage removeItem 오류:', error);
    }
  }
};

const resolveAdminEquivalentRole = (role: UserRoleType): UserRoleType =>
  role === 'manager' ? 'schedule_admin' : role;

const matchesAllowedRole = (allowedRoles: UserRoleType[], role: UserRoleType): boolean => {
  if (allowedRoles.includes(role)) {
    return true;
  }

  if (role === 'manager') {
    return allowedRoles.includes('schedule_admin');
  }

  return false;
};


// 🔥 동적 데이터 저장소 (SSR 호환)
class DynamicPermissionManager {
  private pages: Map<string, DynamicPage> = new Map();
  private roles: Map<UserRoleType, DynamicRole> = new Map();
  
  // 🔥 메뉴 표시/숨김 상태 관리 (추가)
  private hiddenMenus: Map<string, Set<string>> = new Map(); // role -> hidden paths
  
  private storageKey = 'dynamic_permission_system';
  private initialized = false;

  constructor() {
    // 🔥 브라우저 환경에서만 초기화
    if (isBrowser) {
      this.initialize();
    }
  }

  // 🔥 초기화 상태 확인 함수
  public isInitialized(): boolean {
    return this.initialized;
  }

  // 🔥 비동기 초기화 함수
  public async initialize(): Promise<boolean> {
    if (this.initialized) return true;
    
    try {
      this.loadFromStorage();
      this.initializeCompleteData();
      this.initialized = true;
      console.log('✅ 동적 권한 시스템 초기화 완료 (전체 데이터)');
      return true;
    } catch (error) {
      console.error('❌ 동적 권한 시스템 초기화 실패:', error);
      return false;
    }
  }

  // 🔥 초기화 확인 (모든 메소드에서 호출)
  private ensureInitialized(): void {
    if (!isBrowser) {
      console.warn('⚠️ 서버사이드 환경에서는 동적 권한 시스템을 사용할 수 없습니다.');
      return;
    }
    
    if (!this.initialized) {
      this.initialize();
    }
  }

  // 🔥 메뉴 표시/숨김 토글 (새로 추가)
  public toggleMenuVisibility(userRole: UserRoleType, pagePath: string, isVisible: boolean): boolean {
    this.ensureInitialized();
    
    try {
      // 역할별 숨김 메뉴 Set 가져오기/생성
      if (!this.hiddenMenus.has(userRole)) {
        this.hiddenMenus.set(userRole, new Set());
      }
      
      const roleHiddenMenus = this.hiddenMenus.get(userRole)!;
      
      if (isVisible) {
        // 보이기 - 숨김 목록에서 제거
        roleHiddenMenus.delete(pagePath);
        console.log(`✅ 메뉴 표시: ${userRole} → ${pagePath}`);
      } else {
        // 숨기기 - 숨김 목록에 추가
        roleHiddenMenus.add(pagePath);
        console.log(`🔒 메뉴 숨김: ${userRole} → ${pagePath}`);
      }
      
      this.saveToStorage();
      
      // 변경 이벤트 발생
      emitPermissionChange({
        type: 'menu-visibility-changed',
        role: userRole,
        path: pagePath,
        visible: isVisible
      });
      
      return true;
    } catch (error) {
      console.error('❌ 메뉴 표시/숨김 토글 실패:', error);
      return false;
    }
  }

  // 🔥 메뉴 표시 여부 확인 (새로 추가)
  public isMenuVisible(userRole: UserRoleType, pagePath: string): boolean {
    this.ensureInitialized();
    
    const roleHiddenMenus =
      this.hiddenMenus.get(userRole) ||
      this.hiddenMenus.get(resolveAdminEquivalentRole(userRole));
    if (!roleHiddenMenus) return true;
    
    return !roleHiddenMenus.has(pagePath);
  }

  // 🔥 localStorage에서 데이터 로드 (숨김 메뉴 포함)
  private loadFromStorage(): void {
    try {
      const stored = safeLocalStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        
        // 페이지 데이터 복원
        if (data.pages) {
          Object.entries(data.pages).forEach(([id, page]: [string, any]) => {
            this.pages.set(id, {
              ...page,
              createdAt: new Date(page.createdAt),
              updatedAt: new Date(page.updatedAt)
            });
          });
        }
        
        // 역할 데이터 복원
        if (data.roles) {
          Object.entries(data.roles).forEach(([id, role]: [string, any]) => {
            this.roles.set(id as UserRoleType, role);
          });
        }
        
        // 🔥 숨김 메뉴 데이터 복원 (새로 추가)
        if (data.hiddenMenus) {
          Object.entries(data.hiddenMenus).forEach(([role, paths]: [string, any]) => {
            this.hiddenMenus.set(role as UserRoleType, new Set(paths));
          });
        }
        
        console.log('✅ 동적 권한 시스템 데이터 로드 완료 (숨김 메뉴 포함)');
        return;
      }
    } catch (error) {
      console.error('❌ 동적 권한 시스템 데이터 로드 실패:', error);
    }
  }

  // 🔥 localStorage에 데이터 저장 (숨김 메뉴 포함)
  private saveToStorage(): void {
    if (!isBrowser) return;
    
    try {
      const data = {
        pages: Object.fromEntries(this.pages),
        roles: Object.fromEntries(this.roles),
        hiddenMenus: Object.fromEntries(
          Array.from(this.hiddenMenus.entries()).map(([role, paths]) => [role, Array.from(paths)])
        ),
        lastUpdated: new Date().toISOString(),
        version: '2.1' // 버전 업데이트
      };
      
      safeLocalStorage.setItem(this.storageKey, JSON.stringify(data));
      console.log('💾 동적 권한 시스템 데이터 저장 완료 (숨김 메뉴 포함)');
    } catch (error) {
      console.error('❌ 동적 권한 시스템 데이터 저장 실패:', error);
    }
  }

  // 🔥 완전한 기본 데이터 초기화 (기존 menuConfig 기반)
  private initializeCompleteData(): void {
    console.log('🚀 완전한 역할 및 페이지 데이터 로딩 시작...');
    
    // 🔥 모든 역할 정의 (완전 버전)
    if (this.roles.size === 0) {
      const completeRoles: Array<[UserRoleType, DynamicRole]> = [
        ['system_admin', {
          id: 'system_admin',
          name: '시스템 관리자',
          color: '#dc2626',
          permissions: ['*'],
          level: 100,
          isActive: true,
          customPages: []
        }],
        ['schedule_admin', {
          id: 'schedule_admin',
          name: '스케줄 관리자',
          color: '#2563eb',
          permissions: ['dashboard.view', 'schedules.manage', 'members.manage', 'professors.manage', 'qr.manage', 'shooter.view'],
          level: 80,
          isActive: true,
          customPages: []
        }],
        ['manager', {
          id: 'manager',
          name: '일반 관리자',
          color: '#f97316',
          permissions: ['dashboard.view', 'schedules.manage', 'members.manage', 'professors.manage'],
          level: 75,
          isActive: true,
          customPages: []
        }],
        ['academy_manager', {
          id: 'academy_manager',
          name: '학원 매니저',
          color: '#ea580c',
          permissions: ['academy.manage', 'academy.schedules'],
          level: 60,
          isActive: true,
          customPages: []
        }],
        ['online_manager', {
          id: 'online_manager',
          name: '온라인 매니저',
          color: '#0891b2',
          permissions: ['online.manage', 'studio.schedules'],
          level: 60,
          isActive: true,
          customPages: []
        }],
        ['professor', {
          id: 'professor',
          name: '교수',
          color: '#7c3aed',
          permissions: ['professor.schedule', 'professor.login'],
          level: 40,
          isActive: true,
          customPages: []
        }],
        ['shooter', {
          id: 'shooter',
          name: '촬영자',
          color: '#16a34a',
          permissions: ['shooter.dashboard', 'shooter.tracking', 'shooter.schedule', 'shooter.upload'],
          level: 30,
          isActive: true,
          customPages: []
        }],
        ['staff', {
          id: 'staff',
          name: '일반 직원',
          color: '#6b7280',
          permissions: ['profile.view', 'basic.access'],
          level: 10,
          isActive: true,
          customPages: []
        }]
      ];

      completeRoles.forEach(([id, role]) => {
        this.roles.set(id, role);
      });

      console.log(`✅ ${completeRoles.length}개 역할 로드 완료`);
    }

    // 🔥 모든 페이지 정의 (완전 버전)
    if (this.pages.size === 0) {
      const now = new Date();
      let order = 1;

      const completePages: Array<Omit<DynamicPage, 'createdAt' | 'updatedAt'>> = [
        // 🏠 홈/대시보드
        {
          id: 'home',
          path: '/',
          name: '홈',
          icon: '🏠',
          category: '기본',
          requiredPermissions: [],
          allowedRoles: ['system_admin', 'schedule_admin', 'manager'],
          isActive: true,
          order: order++
        },
        {
          id: 'admin-dashboard',
          path: '/admin',
          name: '관리 대시보드',
          icon: '📊',
          category: '관리',
          requiredPermissions: ['dashboard.view'],
          allowedRoles: ['system_admin', 'schedule_admin', 'manager'],
          isActive: true,
          order: order++
        },

        // 📅 스케줄 관리
        {
          id: 'schedules',
          path: '/schedules',
          name: '스케줄 관리',
          icon: '📅',
          category: '스케줄',
          requiredPermissions: ['schedules.manage'],
          allowedRoles: ['system_admin', 'schedule_admin', 'manager'],
          isActive: true,
          order: order++
        },
        {
          id: 'all-schedules',
          path: '/all-schedules',
          name: '통합 스케줄',
          icon: '📈',
          category: '스케줄',
          requiredPermissions: ['schedules.manage'],
          allowedRoles: ['system_admin', 'schedule_admin', 'manager'],
          isActive: true,
          parentId: 'schedules',
          order: order++
        },
        {
          id: 'academy-schedules',
          path: '/academy-schedules',
          name: '학원 스케줄',
          icon: '🏫',
          category: '스케줄',
          requiredPermissions: ['academy.schedules'],
          allowedRoles: ['system_admin', 'schedule_admin', 'manager', 'academy_manager'],
          isActive: true,
          parentId: 'schedules',
          order: order++
        },
        {
          id: 'studio-admin',
          path: '/studio-admin',
          name: '스튜디오 스케줄',
          icon: '🎬',
          category: '스케줄',
          requiredPermissions: ['schedules.manage'],
          allowedRoles: ['system_admin', 'schedule_admin', 'manager'],
          isActive: true,
          parentId: 'schedules',
          order: order++
        },
        {
          id: 'internal-schedules',
          path: '/internal-schedules',
          name: '내부업무 스케줄',
          icon: '💼',
          category: '스케줄',
          requiredPermissions: ['schedules.manage'],
          allowedRoles: ['system_admin', 'schedule_admin', 'manager'],
          isActive: true,
          parentId: 'schedules',
          order: order++
        },
        {
          id: 'studio-schedules',
          path: '/studio-schedules',
          name: '교수 스케줄 등록',
          icon: '🎭',
          category: '스케줄',
          requiredPermissions: ['schedules.manage'],
          allowedRoles: ['system_admin', 'schedule_admin', 'manager'],
          isActive: true,
          parentId: 'schedules',
          order: order++
        },
        {
          id: 'manager-studio-schedule',
          path: '/ManagerStudioSchedulePage',
          name: '온라인매니저 스케줄',
          icon: '🌐',
          category: '스케줄',
          requiredPermissions: ['studio.schedules'],
          allowedRoles: ['system_admin', 'schedule_admin', 'manager', 'online_manager'],
          isActive: true,
          parentId: 'schedules',
          order: order++
        },

        // 👥 멤버 관리
        {
          id: 'members',
          path: '/admin/members',
          name: '멤버 관리',
          icon: '👥',
          category: '관리',
          requiredPermissions: ['members.manage'],
          allowedRoles: ['system_admin', 'schedule_admin', 'manager'],
          isActive: true,
          order: order++
        },
        {
          id: 'members-overview',
          path: '/admin/members/overview',
          name: '전체 현황',
          icon: '📊',
          category: '관리',
          requiredPermissions: ['members.manage'],
          allowedRoles: ['system_admin'],
          isActive: true,
          parentId: 'members',
          order: order++
        },
        {
          id: 'members-admins',
          path: '/admin/members/admins',
          name: '관리자 관리',
          icon: '👑',
          category: '관리',
          requiredPermissions: ['members.manage'],
          allowedRoles: ['system_admin'],
          isActive: true,
          parentId: 'members',
          order: order++
        },
        {
          id: 'members-managers',
          path: '/admin/members/managers',
          name: '매니저 관리',
          icon: '🎯',
          category: '관리',
          requiredPermissions: ['members.manage'],
          allowedRoles: ['system_admin', 'schedule_admin', 'manager'],
          isActive: true,
          parentId: 'members',
          order: order++
        },
        {
          id: 'members-shooters',
          path: '/admin/members/shooters',
          name: '촬영자 관리',
          icon: '📷',
          category: '관리',
          requiredPermissions: ['members.manage'],
          allowedRoles: ['system_admin', 'schedule_admin', 'manager'],
          isActive: true,
          parentId: 'members',
          order: order++
        },

        // 🎓 교수 관리
        {
          id: 'professors',
          path: '/admin/professors',
          name: '교수 관리',
          icon: '🎓',
          category: '관리',
          requiredPermissions: ['professors.manage'],
          allowedRoles: ['system_admin', 'schedule_admin', 'manager'],
          isActive: true,
          order: order++
        },
        {
          id: 'professor-categories',
          path: '/professor-categories',
          name: '교수 카테고리',
          icon: '🏷️',
          category: '관리',
          requiredPermissions: ['professors.manage'],
          allowedRoles: ['system_admin', 'schedule_admin', 'manager'],
          isActive: true,
          parentId: 'professors',
          order: order++
        },

        // 📷 촬영자 관련
        {
          id: 'shooter-dashboard',
          path: '/shooter/ShooterDashboard',
          name: '촬영자 대시보드',
          icon: '📷',
          category: '촬영',
          requiredPermissions: ['shooter.dashboard'],
          allowedRoles: ['system_admin', 'schedule_admin', 'manager'],
          isActive: true,
          order: order++
        },
        {
          id: 'shooter-tracking',
          path: '/shooter/tracking',
          name: '촬영 트래킹',
          icon: '📍',
          category: '촬영',
          requiredPermissions: ['shooter.tracking'],
          allowedRoles: ['shooter', 'system_admin'],
          isActive: true,
          order: order++
        },
        {
          id: 'shooter-schedule-check',
          path: '/shooter/schedule-check',
          name: '스케줄 확인',
          icon: '📅',
          category: '촬영',
          requiredPermissions: ['shooter.schedule'],
          allowedRoles: ['shooter', 'system_admin'],
          isActive: true,
          order: order++
        },
        {
          id: 'freelancer-weekly-schedule',
          path: '/shooter/FreelancerWeeklySchedule',
          name: '스케줄 등록',
          icon: '➕',
          category: '촬영',
          requiredPermissions: ['shooter.schedule'],
          allowedRoles: ['shooter', 'system_admin'],
          isActive: true,
          order: order++
        },
        {
          id: 'shooting-reports',
          path: '/admin/shooting-reports',
          name: '촬영 기록표',
          icon: '📋',
          category: '촬영',
          requiredPermissions: ['shooter.view'],
          allowedRoles: ['system_admin', 'schedule_admin', 'manager'],
          isActive: true,
          order: order++
        },
        {
          id: 'freelancer-schedules',
          path: '/admin/freelancer-schedules',
          name: '프리랜서 스케줄 조회',
          icon: '📊',
          category: '관리',
          requiredPermissions: ['members.manage'],
          allowedRoles: ['system_admin', 'schedule_admin', 'manager'],
          isActive: true,
          order: order++
        },
        {
          id: 'notification-manager',
          path: '/admin/NotificationManager',
          name: '공지사항',
          icon: '📢',
          category: '관리',
          requiredPermissions: ['shooter.view'],
          allowedRoles: ['system_admin', 'schedule_admin', 'manager'],
          isActive: true,
          order: order++
        },

        // ⚙️ 시스템 관리
        {
          id: 'admin-monitoring',
          path: '/admin/monitoring',
          name: '모니터링 대시보드',
          icon: '📺',
          category: '시스템',
          requiredPermissions: ['dashboard.view'],
          allowedRoles: ['system_admin'],
          isActive: true,
          order: order++
        },
        {
          id: 'admin-settlements',
          path: '/admin/settlements',
          name: '정산 관리',
          icon: '💰',
          category: '시스템',
          requiredPermissions: ['dashboard.view'],
          allowedRoles: ['system_admin'],
          isActive: true,
          order: order++
        },
        {
          id: 'admin-analysis',
          path: '/admin/analysis',
          name: '데이터 분석',
          icon: '📈',
          category: '시스템',
          requiredPermissions: ['dashboard.view'],
          allowedRoles: ['system_admin'],
          isActive: true,
          order: order++
        },
        {
          id: 'admin-summary',
          path: '/admin/summary',
          name: '요약 리포트',
          icon: '📄',
          category: '시스템',
          requiredPermissions: ['dashboard.view'],
          allowedRoles: ['system_admin'],
          isActive: true,
          order: order++
        },
        {
          id: 'admin-user-management',
          path: '/admin/user-management',
          name: '사용자 통합 관리',
          icon: '👤',
          category: '시스템',
          requiredPermissions: ['dashboard.view'],
          allowedRoles: ['system_admin'],
          isActive: true,
          order: order++
        },
        {
          id: 'admin-users',
          path: '/admin/users',
          name: '사용자 목록',
          icon: '📋',
          category: '시스템',
          requiredPermissions: ['dashboard.view'],
          allowedRoles: ['system_admin'],
          isActive: true,
          order: order++
        },
        {
          id: 'admin-shooter-management',
          path: '/admin/shooter-management',
          name: '촬영자 시스템 관리',
          icon: '⚙️',
          category: '시스템',
          requiredPermissions: ['dashboard.view'],
          allowedRoles: ['system_admin'],
          isActive: true,
          order: order++
        },
        {
          id: 'permissions',
          path: '/admin/permissions',
          name: '권한 관리',
          icon: '🔐',
          category: '시스템',
          requiredPermissions: ['dashboard.view'],
          allowedRoles: ['system_admin'],
          isActive: true,
          order: order++
        },
        {
          id: 'studio-shooting-types',
          path: '/studio-shooting-types',
          name: '스튜디오 유형 관리',
          icon: '📝',
          category: '스케줄',
          requiredPermissions: ['schedules.manage'],
          allowedRoles: ['system_admin', 'schedule_admin', 'manager'],
          isActive: true,
          order: order++
        },
        {
          id: 'qr-locations',
          path: '/admin/qr-locations',
          name: '학원별 QR코드',
          icon: '🔲',
          category: '시스템',
          requiredPermissions: ['qr.manage'],
          allowedRoles: ['system_admin', 'schedule_admin', 'manager'],
          isActive: true,
          order: order++
        },

        // 🔔 알림 센터
        {
          id: 'notifications',
          path: '/notifications/center',
          name: '알림 센터',
          icon: '🔔',
          category: '기본',
          requiredPermissions: ['dashboard.view'],
          allowedRoles: ['system_admin'],
          isActive: true,
          order: order++
        },

        // 🛠️ 개발자 도구
        {
          id: 'development',
          path: '/development',
          name: '개발자 도구',
          icon: '🛠️',
          category: '개발',
          requiredPermissions: ['*'],
          allowedRoles: ['system_admin'],
          isActive: true,
          order: order++
        },
        {
          id: 'test-access',
          path: '/test-access',
          name: '접근 테스트',
          icon: '🔍',
          category: '개발',
          requiredPermissions: ['*'],
          allowedRoles: ['system_admin'],
          isActive: true,
          parentId: 'development',
          order: order++
        },
        {
          id: 'test-dashboard',
          path: '/test-dashboard',
          name: '대시보드 테스트',
          icon: '📊',
          category: '개발',
          requiredPermissions: ['*'],
          allowedRoles: ['system_admin'],
          isActive: true,
          parentId: 'development',
          order: order++
        },
        {
          id: 'test-realtime',
          path: '/test-realtime',
          name: '실시간 테스트',
          icon: '⚡',
          category: '개발',
          requiredPermissions: ['*'],
          allowedRoles: ['system_admin'],
          isActive: true,
          parentId: 'development',
          order: order++
        },
        {
          id: 'test-roles',
          path: '/test-roles',
          name: '역할 테스트',
          icon: '👥',
          category: '개발',
          requiredPermissions: ['*'],
          allowedRoles: ['system_admin'],
          isActive: true,
          parentId: 'development',
          order: order++
        },
        {
          id: 'test-supabase',
          path: '/test-supabase',
          name: 'Supabase 테스트',
          icon: '🗄️',
          category: '개발',
          requiredPermissions: ['*'],
          allowedRoles: ['system_admin'],
          isActive: true,
          parentId: 'development',
          order: order++
        },

        // 👤 계정 관리
        {
          id: 'account',
          path: '/account',
          name: '계정 관리',
          icon: '👤',
          category: '계정',
          requiredPermissions: ['profile.view'],
          allowedRoles: ['system_admin', 'schedule_admin', 'academy_manager', 'online_manager', 'professor', 'shooter', 'staff'],
          isActive: true,
          order: order++
        },
        {
          id: 'settings-profile',
          path: '/settings/profile',
          name: '프로필 설정',
          icon: '⚙️',
          category: '계정',
          requiredPermissions: ['profile.view'],
          allowedRoles: ['system_admin', 'schedule_admin', 'academy_manager', 'online_manager', 'professor', 'shooter', 'staff'],
          isActive: true,
          parentId: 'account',
          order: order++
        },

        // 🔐 인증 페이지들 (숨겨진 페이지)
        {
          id: 'first-login',
          path: '/auth/first-login',
          name: '첫 로그인',
          icon: '🔑',
          category: '인증',
          requiredPermissions: ['basic.access'],
          allowedRoles: ['system_admin', 'schedule_admin', 'academy_manager', 'online_manager', 'professor', 'shooter', 'staff'],
          isActive: true,
          order: order++
        },
        {
          id: 'professor-login',
          path: '/professor/login',
          name: '교수 로그인',
          icon: '🎓',
          category: '인증',
          requiredPermissions: ['professor.login'],
          allowedRoles: ['professor'],
          isActive: true,
          order: order++
        },

        // 📱 QR 페이지
        {
          id: 'qr-location',
          path: '/qr/location/[uuid]',
          name: 'QR 위치',
          icon: '📱',
          category: '기능',
          requiredPermissions: ['basic.access'],
          allowedRoles: ['system_admin', 'schedule_admin', 'academy_manager', 'online_manager', 'professor', 'shooter', 'staff'],
          isActive: true,
          order: order++
        }
      ];

      completePages.forEach(pageData => {
        const page: DynamicPage = {
          ...pageData,
          createdAt: now,
          updatedAt: now
        };
        this.pages.set(page.id, page);
      });

      console.log(`✅ ${completePages.length}개 페이지 로드 완료`);
    }

    this.saveToStorage();
    console.log(`🎉 완전한 데이터 로딩 완료: ${this.roles.size}개 역할, ${this.pages.size}개 페이지`);
  }

  // 🔥 권한 체크 함수
  public checkPermission(userRole: UserRoleType, pagePath: string): boolean {
    this.ensureInitialized();
    
    try {
      const role = this.roles.get(userRole);
      if (!role || !role.isActive) return false;
      
      // 시스템 관리자는 모든 권한 허용
      if (role.permissions.includes('*')) return true;
      
      // 페이지별 권한 체크
      const page = Array.from(this.pages.values()).find(p => p.path === pagePath);
      if (!page || !page.isActive) return false;
      
      return page.allowedRoles.includes(userRole);
    } catch (error) {
      console.error('권한 체크 오류:', error);
      return false;
    }
  }

  // 🔥 권한 업데이트 함수 (메뉴 토글과 연동)
  public async updatePermission(userRole: UserRoleType, pagePath: string, hasAccess: boolean): Promise<boolean> {
    this.ensureInitialized();
    
    try {
      // 1. 페이지 권한 업데이트
      const page = Array.from(this.pages.values()).find(p => p.path === pagePath);
      if (page) {
        if (hasAccess && !page.allowedRoles.includes(userRole)) {
          page.allowedRoles.push(userRole);
        } else if (!hasAccess) {
          page.allowedRoles = page.allowedRoles.filter(role => role !== userRole);
        }
        page.updatedAt = new Date();
        this.pages.set(page.id, page);
      }
      
      // 2. 메뉴 표시/숨김 상태 업데이트
      this.toggleMenuVisibility(userRole, pagePath, hasAccess);
      
      console.log(`✅ 권한 업데이트: ${userRole} → ${pagePath} = ${hasAccess}`);
      return true;
    } catch (error) {
      console.error('❌ 권한 업데이트 실패:', error);
      return false;
    }
  }

  // 🔥 사용자 메뉴 조회 (숨김 메뉴 필터링 적용)
  public getUserMenus(userRole: UserRoleType): DynamicPage[] {
    this.ensureInitialized();
    
    const normalizedRole = resolveAdminEquivalentRole(userRole);

    const allPages = Array.from(this.pages.values())
      .filter(page => {
        // 1. 역할 권한 체크
        if (!matchesAllowedRole(page.allowedRoles, userRole) && normalizedRole !== 'system_admin') {
          return false;
        }
        
        // 2. 활성 상태 체크
        if (!page.isActive) {
          return false;
        }
        
        // 3. 숨김 메뉴 체크
        if (!this.isMenuVisible(userRole, page.path)) {
          return false;
        }
        
        return true;
      })
      .sort((a, b) => a.order - b.order);
    
    console.log(`📋 ${userRole} 메뉴 조회: ${allPages.length}개 (숨김 필터링 적용)`);
    return allPages;
  }

  // 🔥 페이지 접근 권한 확인
  public canAccessPage(userRole: UserRoleType, pagePath: string): boolean {
    this.ensureInitialized();
    if (!isBrowser) {
      return this.getBasicAccess(userRole, pagePath);
    }
    
    const normalizedRole = resolveAdminEquivalentRole(userRole);
    const role = this.roles.get(normalizedRole);

  
    if (!role || !role.isActive) return false;

    // 슈퍼 권한
    if (role.permissions.includes('*')) return true;

    const page = Array.from(this.pages.values()).find(p => p.path === pagePath);
    if (!page || !page.isActive) return false;

    // 역할 체크
    if (!matchesAllowedRole(page.allowedRoles, userRole)) return false;

    // 권한 체크
    return page.requiredPermissions.length === 0 ||
      page.requiredPermissions.some(reqPerm => role.permissions.includes(reqPerm));
  }

  private getBasicAccess(userRole: UserRoleType, pagePath: string): boolean {
    const basicPermissions: Record<UserRoleType, string[]> = {
      system_admin: ['*'],
      schedule_admin: ['/admin', '/schedules', '/admin/members', '/admin/professors'],
      manager: ['/admin', '/schedules', '/admin/members', '/admin/professors'],
      academy_manager: ['/academy-schedules'],
      online_manager: ['/ManagerStudioSchedulePage'],
      professor: ['/professor/login', '/settings/profile'],
      shooter: ['/shooter/ShooterDashboard', '/shooter/tracking', '/shooter/schedule-check'],
      staff: ['/settings/profile']
    };

    const userPaths = basicPermissions[userRole] || [];
    return userPaths.includes('*') || userPaths.includes(pagePath);
  }

  // ... 나머지 모든 기존 메서드들
  addPage(pageData: Omit<DynamicPage, 'createdAt' | 'updatedAt'>): string {
    this.ensureInitialized();
    if (!isBrowser) return '';
    
    const now = new Date();
    const page: DynamicPage = {
      ...pageData,
      createdAt: now,
      updatedAt: now
    };

    this.pages.set(page.id, page);
    this.saveToStorage();
    
    console.log(`✅ 새 페이지 추가: ${page.name} (${page.path})`);
    return page.id;
  }

  updatePage(pageId: string, updates: Partial<DynamicPage>): boolean {
    this.ensureInitialized();
    if (!isBrowser) return false;
    
    const page = this.pages.get(pageId);
    if (!page) {
      console.error(`❌ 페이지를 찾을 수 없음: ${pageId}`);
      return false;
    }

    const updatedPage = {
      ...page,
      ...updates,
      updatedAt: new Date()
    };

    this.pages.set(pageId, updatedPage);
    this.saveToStorage();
    
    console.log(`✅ 페이지 수정: ${pageId}`);
    return true;
  }

  deletePage(pageId: string): boolean {
    this.ensureInitialized();
    if (!isBrowser) return false;
    
    if (this.pages.delete(pageId)) {
      this.saveToStorage();
      console.log(`✅ 페이지 삭제: ${pageId}`);
      return true;
    }
    return false;
  }

  getAllPages(): DynamicPage[] {
    this.ensureInitialized();
    if (!isBrowser) return [];
    
    return Array.from(this.pages.values()).sort((a, b) => a.order - b.order);
  }

  getAllRoles(): DynamicRole[] {
    this.ensureInitialized();
    if (!isBrowser) {
      return [
        {
          id: 'system_admin',
          name: '시스템 관리자',
          color: '#dc2626',
          permissions: ['*'],
          level: 100,
          isActive: true,
          customPages: []
        },
        {
          id: 'schedule_admin',
          name: '스케줄 관리자',
          color: '#2563eb',
          permissions: ['dashboard.view', 'schedules.manage'],
          level: 80,
          isActive: true,
          customPages: []
        }
      ];
    }
    
    return Array.from(this.roles.values());
  }

  // 🔥 강제 재초기화 (개발용)
  resetToComplete(): void {
    if (!isBrowser) return;
    
    this.pages.clear();
    this.roles.clear();
    this.hiddenMenus.clear();
    safeLocalStorage.removeItem(this.storageKey);
    this.initialized = false;
    this.initialize();
    console.log('🔄 완전한 데이터로 강제 재초기화 완료');
  }
}

// 🔥 싱글톤 인스턴스
let dynamicPermissionManagerInstance: DynamicPermissionManager | null = null;

export const dynamicPermissionSystem = (() => {
  if (!dynamicPermissionManagerInstance) {
    dynamicPermissionManagerInstance = new DynamicPermissionManager();
  }
  return dynamicPermissionManagerInstance;
})();

// 🔥 이벤트 발생 (SSR 호환)
export function emitPermissionChange(data: any) {
  if (isBrowser && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('permissions-updated', { detail: data }));
  }
}

export type { DynamicPage, DynamicRole };
