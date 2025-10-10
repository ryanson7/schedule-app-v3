"use client";
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
// import Layout from '../components/Layout'; // ❌ 제거됨

// 🎯 수정된 InternalScheduleGrid - Layout 제거
const InternalScheduleGrid = dynamic(
  () => import('../components/InternalScheduleGrid'),
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
          내부업무 스케줄 로딩 중...
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

export default function InternalSchedules() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
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
      {/* 🔥 이중 스크롤 해제: 깔끔한 컨테이너 */}
      <div style={{ 
        minHeight: '100vh'
      }}>
        <InternalScheduleGrid title="내부업무 스케줄 관리" />
      </div>
    </div>
  );
}
