// src/utils/simplePermissions.ts

export const ROLES = ["admin", "manager", "user"] as const;

export const PAGES = [
  { path: "/", name: "홈" },
  { path: "/admin", name: "관리자" },
  { path: "/my", name: "내정보" }
];

export const MENUS = [
  { key: "dashboard", name: "대시보드" },
  { key: "admin", name: "관리자" },
  { key: "profile", name: "프로필" }
];

export const PAGE_ACCESS: Record<string, string[]> = {
  admin: ["/", "/admin", "/my"],
  manager: ["/", "/my"],
  user: ["/", "/my"]
};

export const MENU_ACCESS: Record<string, string[]> = {
  admin: ["dashboard", "admin", "profile"],
  manager: ["dashboard", "profile"],
  user: ["dashboard", "profile"]
};

export function canAccessPage(userRole: string, path: string): boolean {
  return PAGE_ACCESS[userRole]?.includes(path) ?? false;
}

export function getVisibleMenus(userRole: string) {
  // 방어코드로 에러 완전 방지
  if (!MENU_ACCESS[userRole]) return [];
  return MENUS.filter(menu => MENU_ACCESS[userRole].includes(menu.key));
}
