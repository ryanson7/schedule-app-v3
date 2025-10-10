// src/pages/studio-shooting-types.tsx
"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import Head from 'next/head';
// ❌ Layout import 제거
// import Layout from '../components/Layout';
import { UserRoleType } from '../types/users';
import { safeUserRole } from '../utils/permissions';

const StudioShootingTypesManager = dynamic(
  () => import('../components/StudioShootingTypesManager'),
  { ssr: false }
);

export default function StudioShootingTypesPage() {
  const router = useRouter();
  const [currentUserRole, setCurrentUserRole] = useState<UserRoleType>('staff');
  const [accessDenied, setAccessDenied] = useState(false);
  const [showContent, setShowContent] = useState(false);
  
  // ✅ 중복 실행 완전 차단
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return;
    
    const checkPermissions = () => {
      if (typeof window === 'undefined') return;

      const userRole = localStorage.getItem('userRole');
      const userName = localStorage.getItem('userName');
      
      if (!userRole || !userName) {
        router.replace('/login');
        return;
      }

      const normalizedRole = safeUserRole(userRole);
      
      if (!['system_admin', 'schedule_admin'].includes(normalizedRole)) {
        console.warn('⚠️ 권한 없음:', normalizedRole);
        setAccessDenied(true);
      } else {
        console.log('✅ 권한 확인 완료:', normalizedRole);
        setCurrentUserRole(normalizedRole);
        setAccessDenied(false);
      }
      
      setShowContent(true);
      mounted.current = true;
    };

    checkPermissions();
  }, []);

  if (!showContent) {
    return (
      <div>
        <Head>
          <title>권한 확인 중 - 에듀윌 스케줄 시스템</title>
        </Head>
        <div style={{ padding: '20px', textAlign: 'center' }}>
          권한을 확인하고 있습니다...
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div>
        <Head>
          <title>접근 권한 없음 - 에듀윌 스케줄 시스템</title>
        </Head>
        <div style={{ 
          padding: '40px', 
          textAlign: 'center',
          minHeight: '50vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div>
            <h3 style={{ color: '#dc2626', marginBottom: '16px' }}>
              접근 권한이 없습니다
            </h3>
            <p style={{ marginBottom: '24px', color: '#6b7280' }}>
              스튜디오 촬영형식 관리는 시스템 관리자와 스케줄 관리자만 접근할 수 있습니다.
            </p>
            <button 
              onClick={() => router.replace('/')}
              style={{
                padding: '10px 20px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              홈으로 돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ✅ Layout 없이 직접 렌더링
  return (
    <div>
      <Head>
        <title>스튜디오-촬영형식 관리 - 에듀윌 스케줄 시스템</title>
        <meta name="description" content="스튜디오별 촬영형식 매핑 관리" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      <div style={{
        width: '100vw',
        height: '100vh',
        overflowY: 'auto',
        overflowX: 'hidden',
        backgroundColor: '#f8f9fa'
      }}>
        <StudioShootingTypesManager />
      </div>
    </div>
  );
}
