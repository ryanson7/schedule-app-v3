// src/core/permissions.ts

/** -----------------------------
 *  역할 타입 (DB 스키마와 일치)
 *  ----------------------------- */
export type AppRole =
  | 'system_admin'
  | 'schedule_admin'
  | 'academy_manager'
  | 'online_manager'
  | 'manager'
  | 'shooter'
  | 'professor'
  | 'staff'
  | string; // 혹시 모를 확장에 대비

/** -----------------------------
 *  Role Level (참고용)
 *  ----------------------------- */
export const ROLE_LEVEL: Record<string, number> = {
  system_admin: 100,
  schedule_admin: 90,
  manager: 85,          // 일반 관리자 (승인 기능 제외, view 중심)
  academy_manager: 80,  // 아카데미 스케줄 관리
  online_manager: 80,   // 온라인 스튜디오 스케줄 관리
  shooter: 60,          // 촬영 관련 페이지 접근
  professor: 50,        // 스튜디오 스케줄 조회
  staff: 30,            // 기본 사용자
};

/** -----------------------------
 *  Normalizer (소문자/공백/미정 의존성 방지)
 *  ----------------------------- */
export const normalizeRole = (role?: string | null): AppRole => {
  if (!role) return '' as AppRole;
  const r = String(role).trim().toLowerCase();
  // DB/FE 간 케이스 차이 흡수
  switch (r) {
    case 'system_admin':
    case 'system admin':
    case 'system-admin':
      return 'system_admin';
    case 'schedule_admin':
    case 'schedule admin':
    case 'schedule-admin':
      return 'schedule_admin';
    case 'academy_manager':
    case 'academy manager':
    case 'academy-manager':
      return 'academy_manager';
    case 'online_manager':
    case 'online manager':
    case 'online-manager':
      return 'online_manager';
    case 'manager':
      return 'manager';
    case 'shooter':
      return 'shooter';
    case 'professor':
      return 'professor';
    case 'staff':
      return 'staff';
    default:
      return r as AppRole; // 알 수 없는 역할은 그대로 반환
  }
};

/** -----------------------------
 *  승인 정책
 *  ----------------------------- */
// 즉시 승인 가능 (요청 없이 곧바로 승인)
export const canApprove = (role?: AppRole): boolean => {
  const r = normalizeRole(role);
  return r === 'system_admin' || r === 'schedule_admin';
};

// 승인 요청만 가능 (본인은 승인 불가)
export const canRequestOnly = (role?: AppRole): boolean => {
  const r = normalizeRole(role);
  return (
    r === 'manager' ||
    r === 'academy_manager' ||
    r === 'online_manager' ||
    r === 'professor' ||
    r === 'shooter' ||     // 촬영자도 승인 주체는 아님
    r === 'staff'
  );
};

// 보기 전용(승인 버튼 숨김) 여부 — manager는 기본 view 중심
export const isViewOnly = (role?: AppRole): boolean => {
  const r = normalizeRole(role);
  if (canApprove(r)) return false;
  // manager 포함 나머지는 승인 불가 → 실무적으로 view 중심
  return true;
};

/** -----------------------------
 *  접근 경로(선택) 폴백 — 필요 시 사용
 *  ----------------------------- */
export const allowedPathsByRole: Record<string, string[]> = {
  system_admin: ['*'], // 모든 경로
  schedule_admin: [
    // 관리자 관리 제외
    '/academy-schedules',
    '/studio-schedules',
    '/manager-studio-schedules',
    '/all-schedules',
    '/settings/profile',
    '/reports',
    '/dashboard',
    '/admin/approvals',
    '/admin/bulk-approval',
  ],
  manager: [
    // view 중심 (상세 권한은 DB permission이 우선)
    '/dashboard',
    '/all-schedules',
    '/settings/profile',
  ],
  academy_manager: ['/academy-schedules', '/settings/profile'],
  online_manager: ['/manager-studio-schedules', '/settings/profile'],
  professor: ['/studio-schedules', '/settings/profile'],
  shooter: ['/manager-studio-schedules', '/settings/profile'], // 필요시 조정
  staff: ['/settings/profile'], // 최소 접근
};

// 코드 기반 경로 허용 폴백(메뉴 권한 로드 실패 시 사용)
export const isPathAllowedByRole = (role: AppRole, pathname: string): boolean => {
  const r = normalizeRole(role);
  const list = allowedPathsByRole[r];
  if (!list) return false;
  if (list.includes('*')) return true;
  return list.includes(pathname);
};

/** -----------------------------
 *  편의 별칭 (기존 코드 호환)
 *  ----------------------------- */
export const isApprover = canApprove;
