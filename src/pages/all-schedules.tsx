"use client";
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
// import Layout from '../components/Layout'; // ❌ 제거됨

// 🎯 수정된 AllSchedulesGrid - Layout 제거
const AllSchedulesGrid = dynamic(
  () => import('../components/AllSchedulesGrid'),
  { 
    ssr: false,
    loading: () => (
      <div style={{ 
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        padding: 40, 
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #3b82f6',
          borderTop: '4px solid transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '16px'
        }} />
        <div style={{
          color: '#6b7280',
          fontSize: '16px',
          fontWeight: '500'
        }}>
          통합 스케줄 로딩 중...
        </div>
        
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }
);

export default function AllSchedulesPage() {
  const [isClient, setIsClient] = useState(false);
  const [userRole, setUserRole] = useState<'admin' | 'manager' | 'user'>('user');

  useEffect(() => {
    setIsClient(true);
    
    // 🔥 역할 정규화 로직 추가
    if (typeof window !== 'undefined') {
      const role = localStorage.getItem('userRole') || '';
      const name = localStorage.getItem('userName') || '';

      let normalizedRole: 'admin' | 'manager' | 'user' = 'user';
      
      if (name === 'manager1' || role === 'system_admin' || role === 'schedule_admin') {
        normalizedRole = 'admin';
      } else if (role === 'manager') {
        normalizedRole = 'manager';
      } else if (role === 'academy_manager' || role === 'online_manager' || role === 'studio_manager') {
        normalizedRole = 'manager';
      }
      
      setUserRole(normalizedRole);
      console.log('🔍 AllSchedulesPage 역할 설정:', { role, name, normalizedRole });
    }
  }, []);

  // 🎯 수정된 클라이언트 준비 중 화면 - Layout 제거
  if (!isClient) {
    return (
      <div style={{ 
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        padding: 20, 
        textAlign: 'center',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <div style={{
          color: '#6b7280',
          fontSize: '16px',
          fontWeight: '500'
        }}>
          페이지 준비 중...
        </div>
      </div>
    );
  }

  // 🎯 수정된 메인 컨텐츠 - Layout 제거
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc'
    }}>
      <AllSchedulesGrid 
        title="통합 스케줄 관리" 
        currentUserRole={userRole} // 🔥 정규화된 역할 전달
      />
    </div>
  );
}
