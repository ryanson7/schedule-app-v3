// components/PasswordReminderBanner.tsx
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function PasswordReminderBanner() {
  const router = useRouter();
  const [showBanner, setShowBanner] = useState(false);
  const [daysSinceDeferred, setDaysSinceDeferred] = useState(0);

  useEffect(() => {
    const isDeferred = localStorage.getItem('tempPasswordDeferred');
    const deferredDate = localStorage.getItem('passwordDeferredDate');
    
    if (isDeferred && deferredDate) {
      const days = Math.floor((Date.now() - parseInt(deferredDate)) / (1000 * 60 * 60 * 24));
      setDaysSinceDeferred(days);
      
      // 🎯 점진적 알림 주기: 즉시→1일→3일→7일→14일 주기
      const shouldShow = days === 0 || days === 1 || days === 3 || days === 7 || days % 14 === 0;
      setShowBanner(shouldShow);
    }
  }, []);

  const getUrgencyLevel = () => {
    if (daysSinceDeferred >= 30) return { color: '#dc2626', text: '긴급', bg: '#fee2e2' };
    if (daysSinceDeferred >= 14) return { color: '#f59e0b', text: '중요', bg: '#fef3c7' };
    if (daysSinceDeferred >= 7) return { color: '#059669', text: '권장', bg: '#d1fae5' };
    return { color: '#3b82f6', text: '안내', bg: '#dbeafe' };
  };

  const handleChangeNow = () => {
    router.push('/auth/first-login');
  };

  const handleDismiss = () => {
    setShowBanner(false);
    // 24시간 후 다시 표시
    localStorage.setItem('bannerDismissedAt', Date.now().toString());
  };

  if (!showBanner) return null;

  const urgency = getUrgencyLevel();

  return (
    <div style={{
      backgroundColor: urgency.bg,
      borderLeft: `4px solid ${urgency.color}`,
      padding: '12px 16px',
      margin: '16px',
      borderRadius: '0 8px 8px 0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          backgroundColor: urgency.color,
          color: 'white',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: '600'
        }}>
          {urgency.text}
        </div>
        
        <div>
          <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '2px' }}>
            🔐 임시 비밀번호 변경 필요
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            보안을 위해 비밀번호를 변경해주세요. ({daysSinceDeferred}일 경과)
          </div>
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={handleChangeNow}
          style={{
            padding: '6px 12px',
            backgroundColor: urgency.color,
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          지금 변경
        </button>
        
        <button
          onClick={handleDismiss}
          style={{
            padding: '6px 8px',
            backgroundColor: 'transparent',
            color: '#6b7280',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
