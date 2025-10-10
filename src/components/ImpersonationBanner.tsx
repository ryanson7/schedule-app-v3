import { useState, useEffect } from 'react';

interface AdminInfo {
  email: string;
  name: string;
  timestamp: string;
}

export default function ImpersonationBanner() {
  const [isImpersonating, setIsImpersonating] = useState<boolean>(false);
  const [adminInfo, setAdminInfo] = useState<AdminInfo | null>(null);

  useEffect(() => {
    const impersonationData = localStorage.getItem('impersonation_admin');
    if (impersonationData) {
      try {
        const parsed = JSON.parse(impersonationData);
        setIsImpersonating(true);
        setAdminInfo(parsed);
      } catch (error) {
        console.error('임퍼소네이션 데이터 파싱 오류:', error);
        localStorage.removeItem('impersonation_admin');
      }
    }
  }, []);

  const handleStopImpersonation = async () => {
    if (!adminInfo) return;

    try {
      const response = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminInfo.email })
      });

      const result = await response.json();
      
      if (result.success) {
        localStorage.removeItem('impersonation_admin');
        window.location.href = result.magicLink;
      }
    } catch (error) {
      console.error('임퍼소네이션 종료 실패:', error);
      alert('원래 계정으로 돌아가는데 실패했습니다.');
    }
  };

  if (!isImpersonating) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      backgroundColor: '#ff6b35',
      color: 'white',
      padding: '8px 16px',
      textAlign: 'center',
      zIndex: 9999,
      fontSize: '14px',
      fontWeight: 'bold'
    }}>
      🎭 임퍼소네이션 모드 - 원래 관리자: {adminInfo?.name}
      <button
        onClick={handleStopImpersonation}
        style={{
          marginLeft: '16px',
          padding: '4px 12px',
          backgroundColor: 'white',
          color: '#ff6b35',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '12px'
        }}
      >
        원래 계정으로 돌아가기
      </button>
    </div>
  );
}
