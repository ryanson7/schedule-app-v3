"use client";
import { useState, useEffect } from "react";

export default function SimpleAuth() {
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  useEffect(() => {
    // 현재 로그인된 사용자 확인
    const userEmail = localStorage.getItem('userEmail');
    const userRole = localStorage.getItem('userRole');
    if (userEmail && userRole) {
      setCurrentUser(`${userEmail} (${userRole})`);
    }
  }, []);

  const handleLogin = async (email: string, role: string) => {
    // 임시 인증 시스템
    localStorage.setItem('userEmail', email);
    localStorage.setItem('userRole', role);
    setCurrentUser(`${email} (${role})`);
    
    // 페이지 새로고침으로 권한 시스템 업데이트
    window.location.reload();
  };

  const handleLogout = () => {
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userRole');
    setCurrentUser(null);
    window.location.reload();
  };

  return (
    <div style={{ 
      maxWidth: 400, 
      margin: '50px auto', 
      padding: 30, 
      border: '2px solid #e0e0e0', 
      borderRadius: 12,
      background: 'white',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
    }}>
      <h2 style={{ textAlign: 'center', marginBottom: 20, color: '#2c3e50' }}>
        🔐 임시 로그인 시스템
      </h2>

      {currentUser ? (
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            background: '#e8f5e8', 
            padding: 16, 
            borderRadius: 8, 
            marginBottom: 20,
            border: '1px solid #4caf50'
          }}>
            <div style={{ fontWeight: 'bold', color: '#2e7d32', marginBottom: 8 }}>
              현재 로그인: {currentUser}
            </div>
            <div style={{ fontSize: 14, color: '#666' }}>
              이제 권한에 맞는 페이지에 접근할 수 있습니다.
            </div>
          </div>
          <button 
            onClick={handleLogout}
            style={{ 
              padding: '12px 24px', 
              background: '#dc3545', 
              color: 'white', 
              border: 'none', 
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 16,
              width: '100%'
            }}
          >
            로그아웃
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          <button 
            onClick={() => handleLogin('admin@test.com', 'admin')}
            style={{ 
              padding: '12px 20px', 
              background: '#6f42c1', 
              color: 'white', 
              border: 'none', 
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 16
            }}
          >
            👑 관리자로 로그인
          </button>
          <button 
            onClick={() => handleLogin('manager@test.com', 'manager')}
            style={{ 
              padding: '12px 20px', 
              background: '#28a745', 
              color: 'white', 
              border: 'none', 
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 16
            }}
          >
            📚 학원 매니저로 로그인
          </button>
          <button 
            onClick={() => handleLogin('professor@test.com', 'professor')}
            style={{ 
              padding: '12px 20px', 
              background: '#007bff', 
              color: 'white', 
              border: 'none', 
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 16
            }}
          >
            🎬 교수로 로그인
          </button>
        </div>
      )}
    </div>
  );
}
