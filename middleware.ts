// middleware.ts (수정된 버전)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { checkPageAccess, getRedirectPath } from './src/utils/roleRedirection';
import { UserRoleType } from './src/types/users';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // 1️⃣ 로그인 페이지와 정적 파일은 항상 허용
  if (pathname === '/login' || pathname === '/' || 
      pathname.startsWith('/_next/') || 
      pathname.startsWith('/api/') ||
      pathname === '/favicon.ico') {
    
    // 🔥 캐시 비활성화 적용
    const response = NextResponse.next();
    response.headers.set('x-middleware-cache', 'no-cache');
    return response;
  }
  
  // 2️⃣ 쿠키에서 역할 정보 가져오기
  const userRole = request.cookies.get('userRole')?.value as UserRoleType;
  const isLoggedIn = request.cookies.get('isLoggedIn')?.value === 'true';
  
  // 🔍 디버깅 로그
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 Middleware Debug:', {
      pathname,
      userRole,
      isLoggedIn,
      cookies: request.cookies.getAll().map(c => ({ name: c.name, value: c.value }))
    });
  }
  
  // 3️⃣ 로그인되지 않은 경우 로그인 페이지로 리다이렉트
  if (!isLoggedIn || !userRole) {
    const redirectResponse = NextResponse.redirect(new URL('/login', request.url));
    // 🔥 리다이렉트 시에도 캐시 비활성화
    redirectResponse.headers.set('x-middleware-cache', 'no-cache');
    return redirectResponse;
  }
  
  // 4️⃣ 기존 roleRedirection.ts의 checkPageAccess 함수 활용
  const accessResult = checkPageAccess(userRole, pathname);
  
  if (!accessResult.canAccess && accessResult.redirectTo) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🚫 Access denied: ${accessResult.reason}`);
      console.log(`🔄 Redirecting to: ${accessResult.redirectTo}`);
    }
    
    const redirectResponse = NextResponse.redirect(new URL(accessResult.redirectTo, request.url));
    // 🔥 권한 리다이렉트 시에도 캐시 비활성화
    redirectResponse.headers.set('x-middleware-cache', 'no-cache');
    return redirectResponse;
  }
  
  // 5️⃣ 정상 접근 시에도 캐시 비활성화
  const response = NextResponse.next();
  response.headers.set('x-middleware-cache', 'no-cache');
  return response;
}

export const config = {
  matcher: [
    // 보호할 경로들
    '/admin/:path*',
    '/studio-schedules/:path*',
    '/studio-schedules',
    '/studio-admin/:path*',
    '/ManagerStudioSchedulePage',
    '/academy-schedules',
    '/shooter/:path*',
    '/profile/:path*',
    '/settings/:path*',
    '/my-schedules/:path*',
    '/notifications/:path*',
    // 루트 경로도 포함 (정적 파일 제외)
    '/((?!api|_next/static|_next/image|favicon.ico|login).*)',
  ]
};
