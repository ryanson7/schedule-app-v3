// src/components/GlobalHeader.tsx
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function GlobalHeader() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // 화면 크기 감지
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    // 사용자 역할 확인
    setUserRole(localStorage.getItem('userRole'));
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const navigationItems = [
    { name: '학원 스케줄', path: '/academy-schedules', roles: ['admin', 'manager'] },
    { name: '스튜디오 촬영', path: '/studio-schedules', roles: ['professor', 'professor'] },
    { name: '관리자 패널', path: '/admin', roles: ['admin'] },
    { name: '내 정보', path: '/profile', roles: ['all'] }
  ];

  const filteredItems = navigationItems.filter(item => 
    item.roles.includes('all') || (userRole && item.roles.includes(userRole))
  );

  return (
    <>
      {/* 글로벌 헤더 */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        borderBottom: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: isMobile ? '0 15px' : '0 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: isMobile ? '60px' : '70px'
        }}>
          {/* 로고 영역 */}
          <div 
            onClick={() => router.push('/')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer',
              color: 'white'
            }}
          >
            <div style={{
              width: isMobile ? '35px' : '40px',
              height: isMobile ? '35px' : '40px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: isMobile ? '18px' : '20px'
            }}>
              📚
            </div>
            <span style={{
              fontSize: isMobile ? '18px' : '22px',
              fontWeight: 'bold',
              display: isMobile ? 'none' : 'block'
            }}>
              에듀윌 스케줄
            </span>
          </div>

          {/* 데스크톱 네비게이션 */}
          {!isMobile && (
            <nav style={{ display: 'flex', gap: '30px' }}>
              {filteredItems.map((item, index) => (
                <button
                  key={index}
                  onClick={() => router.push(item.path)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'white',
                    fontSize: '16px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'none';
                  }}
                >
                  {item.name}
                </button>
              ))}
            </nav>
          )}

          {/* 모바일 햄버거 메뉴 */}
          {isMobile && (
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                fontSize: '24px',
                cursor: 'pointer',
                padding: '8px'
              }}
            >
              {isMobileMenuOpen ? '✕' : '☰'}
            </button>
          )}
        </div>

        {/* 모바일 드롭다운 메뉴 */}
        {isMobile && isMobileMenuOpen && (
          <div style={{
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(10px)',
            borderTop: '1px solid rgba(255,255,255,0.2)',
            animation: 'slideDown 0.3s ease'
          }}>
            {filteredItems.map((item, index) => (
              <button
                key={index}
                onClick={() => {
                  router.push(item.path);
                  setIsMobileMenuOpen(false);
                }}
                style={{
                  width: '100%',
                  padding: '16px 20px',
                  background: 'none',
                  border: 'none',
                  borderBottom: index < filteredItems.length - 1 ? '1px solid rgba(0,0,0,0.1)' : 'none',
                  color: '#333',
                  fontSize: '16px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(102, 126, 234, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'none';
                }}
              >
                {item.name}
              </button>
            ))}
          </div>
        )}
      </header>

      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}
