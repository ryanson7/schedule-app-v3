// src/utils/roleColors.ts
export const ROLE_COLORS = {
  system_admin: '#dc2626',      // 빨간색
  schedule_admin: '#2563eb',    // 파란색  
  shooter: '#16a34a',           // 녹색
  professor: '#7c3aed',         // 보라색
  academy_manager: '#ea580c',   // 주황색
  online_manager: '#0891b2',    // 청록색
  staff: '#6b7280'              // 회색
};

export function getRoleColor(userRole: string): string {
  return ROLE_COLORS[userRole] || '#6b7280';
}

export function getRoleDisplayName(userRole: string): string {
  const names = {
    system_admin: '시스템 관리자',
    schedule_admin: '스케줄 관리자',
    shooter: '촬영자',
    professor: '교수',
    academy_manager: '학원 매니저',
    online_manager: '온라인 매니저',
    staff: '직원'
  };
  return names[userRole] || '사용자';
}
