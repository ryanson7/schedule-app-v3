//src\types\users.ts
// 사용자 기본 정보 타입
export interface User {
  id: number;
  email: string;
  name: string;
  username?: string;
  phone?: string;
  role: UserRoleType;
  is_active: boolean;
  team_id?: number;
  academy_id?: number;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
  deleted_at?: string;
}

// 사용자 프로필 확장 정보
export interface UserProfile {
  user_id: number;
  shooter_type?: ShooterType;
  hourly_rate?: number;
  specialties?: string[];
  hire_date?: string;
  department?: string;
  bio?: string;
  avatar_url?: string;
}

// 역할 타입
export interface Role {
  id: number;
  name: string;
  description: string;
  permissions?: RolePermissions;
  is_system_role: boolean;
  created_at: string;
}

// 사용자-역할 매핑
export interface UserRole {
  id: number;
  user_id: number;
  role_id: number;
  assigned_at: string;
  assigned_by?: number;
}

// 팀 배정
export interface TeamAssignment {
  id: number;
  user_id: number;
  team_id: number;
  main_location_id?: number;
  role_in_team: TeamRole;
  assigned_at: string;
  joined_at: string;
  is_primary: boolean;
  teams?: {
    id: number;
    name: string;
    team_type: string;
  };
  user_profiles?: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
}

// ✅ DB에 실제 저장되는 role 값
export type DbUserRole =
  | 'system_admin'
  | 'schedule_admin'
  | 'manager'
  | 'shooter'
  | 'professor'
  | 'staff';

// ✅ managers.manager_type 값
export type ManagerType =
  | 'shooting_manager'
  | 'academy_manager'
  | 'online_manager';


// 열거형 타입들
export type UserRoleType =
  | 'system_admin'      // 시스템 관리자
  | 'schedule_admin'    // 스케줄 관리자
  | 'manager'           // 일반 관리자(승인 제외)
  | 'academy_manager'   // 학원 매니저
  | 'online_manager'    // 온라인 매니저
  | 'studio_manager'    // 스튜디오 매니저
  | 'shooter'           // 촬영자
  | 'professor'         // 교수
  | 'staff';            // 일반 직원

export type ShooterType = 'photo' | 'video' | 'live' | 'broadcast' | 'multi';

export type TeamRole = 'leader' | 'member' | 'observer';

export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending';

// 권한 시스템
export interface RolePermissions {
  academy_schedules: PermissionScope;
  studio_schedules: PermissionScope;
  user_management: PermissionScope;
  system_settings: PermissionScope;
  shooting_tasks: PermissionScope;
}

export type PermissionScope = 
  | 'none'              // 권한 없음
  | 'read'              // 조회만
  | 'write'             // 등록/수정
  | 'manage'            // 관리 (승인/반려)
  | 'admin'             // 전체 권한
  | 'assigned_only';    // 담당 영역만

// 🔥 역할별 기본 권한 설정 (완전한 정의)
export const DEFAULT_PERMISSIONS: Record<UserRoleType, RolePermissions> = {
  system_admin: {
    academy_schedules: 'admin',
    studio_schedules: 'admin',
    user_management: 'admin',
    system_settings: 'admin',
    shooting_tasks: 'read'
  },
  schedule_admin: {
    academy_schedules: 'admin',
    studio_schedules: 'admin',
    user_management: 'manage',
    system_settings: 'none',
    shooting_tasks: 'read'
  },
  manager: {
    academy_schedules: 'manage',
    studio_schedules: 'manage',
    user_management: 'manage',
    system_settings: 'none',
    shooting_tasks: 'read'
  },
  academy_manager: {
    academy_schedules: 'assigned_only',
    studio_schedules: 'none',
    user_management: 'assigned_only',
    system_settings: 'none',
    shooting_tasks: 'read'
  },
  online_manager: {
    academy_schedules: 'none',
    studio_schedules: 'admin',
    user_management: 'assigned_only',
    system_settings: 'none',
    shooting_tasks: 'read'
  },
    studio_manager: {
    academy_schedules: 'none',
    studio_schedules: 'admin',
    user_management: 'assigned_only',
    system_settings: 'none',
    shooting_tasks: 'read'
  },
  shooter: {
    academy_schedules: 'read',
    studio_schedules: 'read',
    user_management: 'none',
    system_settings: 'none',
    shooting_tasks: 'admin'
  },
  professor: {
    academy_schedules: 'read',
    studio_schedules: 'write',
    user_management: 'none',
    system_settings: 'none',
    shooting_tasks: 'none'
  },
  staff: {
    academy_schedules: 'read',
    studio_schedules: 'read',
    user_management: 'none',
    system_settings: 'none',
    shooting_tasks: 'none'
  }
};

// 역할 표시명
export const ROLE_LABELS: Record<UserRoleType, string> = {
  system_admin: '시스템 관리자',
  schedule_admin: '스케줄 관리자',
  manager: '일반 관리자',
  academy_manager: '학원 매니저',
  online_manager: '온라인 매니저',
  studio_manager: '스튜디오 매니저',
  shooter: '촬영자',
  professor: '교수',
  staff: '일반 직원'
};

// 역할별 색상 (UI용)
export const ROLE_COLORS: Record<UserRoleType, string> = {
  system_admin: '#dc2626',    // 빨강
  schedule_admin: '#ea580c',  // 주황
  manager: '#f97316',         // 밝은 주황
  academy_manager: '#3b82f6', // 파랑
  online_manager: '#059669',  // 녹색
  studio_manager: '#6366f1',  // 남색
  shooter: '#7c3aed',         // 보라
  professor: '#0891b2',       // 청록
  staff: '#6b7280'            // 회색
};

// 🔥 기존 'admin' 역할을 'system_admin'으로 매핑하는 헬퍼 함수
export const normalizeUserRole = (role: string): UserRoleType => {
  switch (role.toLowerCase()) {
    case 'admin':
    case 'system_admin':
      return 'system_admin';
    case 'manager':
    case 'academy_manager':
      return 'academy_manager';
    case 'online_manager':
      return 'online_manager';
    case 'studio_manager':
      return 'studio_manager';
    case 'schedule_admin':
      return 'schedule_admin';
    case 'manager':
      return 'manager';
    case 'shooter':
      return 'shooter';
    case 'professor':
      return 'professor';
    case 'staff':
    default:
      return 'staff';
  }
};

// 폼 데이터 타입들
export interface CreateUserFormData {
  email: string;
  name: string;
  username?: string;
  phone?: string;
  role: UserRoleType;
  team_id?: number;
  academy_id?: number;
  shooter_type?: ShooterType;
  hourly_rate?: number;
  specialties?: string[];
  password: string;
}

export interface UpdateUserFormData {
  id: number;
  name?: string;
  phone?: string;
  role?: UserRoleType;
  team_id?: number;
  academy_id?: number;
  shooter_type?: ShooterType;
  hourly_rate?: number;
  specialties?: string[];
  is_active?: boolean;
}

// API 응답 타입들
export interface UserListResponse {
  users: User[];
  total: number;
  page: number;
  limit: number;
}

export interface UserDetailResponse {
  user: User;
  profile?: UserProfile;
  roles: Role[];
  team_assignments: TeamAssignment[];
}

// 필터 및 검색 타입
export interface UserFilters {
  role?: UserRoleType;
  team_id?: number;
  academy_id?: number;
  is_active?: boolean;
  shooter_type?: ShooterType;
  search?: string;
}

export interface UserSortOptions {
  field: 'name' | 'email' | 'created_at' | 'last_login_at';
  direction: 'asc' | 'desc';
}

// 사용자 활동 로그
export interface UserActivityLog {
  id: number;
  user_id: number;
  action: string;
  resource_type?: string;
  resource_id?: number;
  details?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

// 로그인 관련 타입
export interface LoginCredentials {
  loginId: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  user?: User;
  token?: string;
  message: string;
}

// 비밀번호 변경
export interface ChangePasswordData {
  user_id: number;
  current_password: string;
  new_password: string;
  confirm_password: string;
}

// 대량 작업 타입
export interface BulkUserOperation {
  user_ids: number[];
  operation: 'activate' | 'deactivate' | 'delete' | 'assign_role';
  data?: Record<string, any>;
}

export interface BulkOperationResult {
  success_count: number;
  failed_count: number;
  errors: string[];
}

// ✅ DB users.role + managers.manager_type → 논리적 UserRoleType 변환
export const mapDbRoleToUserRole = (
  dbRole: DbUserRole,
  managerType?: ManagerType | null
): UserRoleType => {
  // 시스템 / 스케줄 관리자
  if (dbRole === 'system_admin' || dbRole === 'schedule_admin') {
    return dbRole;
  }

  // manager 인 경우 manager_type으로 세부 구분
  if (dbRole === 'manager') {
    if (managerType === 'academy_manager') return 'academy_manager';
    if (managerType === 'online_manager') return 'online_manager';
    // 촬영매니저는 권한 체크에서 따로 처리할 거라, 여기서는 그냥 manager로 둠
    if (managerType === 'shooting_manager') return 'manager';
    return 'manager';
  }

  // 나머지는 그대로
  return dbRole as UserRoleType;
};

