import { UserRoleType } from '../../types/users';
import { ROLE_DISPLAY_NAMES, ROLE_COLORS } from '../../utils/roleRedirection';

interface HeaderProps {
  title: string;
  userRole: UserRoleType;
  userName: string;
  onLogout: () => void;
  // 🔥 다크모드 관련 props 제거
  // isDarkMode: boolean;
  // onToggleDarkMode: () => void;
}

const Header = ({ 
  title, 
  userRole, 
  userName, 
  onLogout
  // 🔥 다크모드 관련 매개변수 제거
  // isDarkMode, 
  // onToggleDarkMode 
}: HeaderProps) => {
  return (
    <header className="header">
      <div className="header-content">
        <div className="header-left">
          <h1>{title}</h1>
          <span 
            className="role-badge"
            style={{ backgroundColor: ROLE_COLORS[userRole] }}
          >
            {ROLE_DISPLAY_NAMES[userRole]}
          </span>
        </div>
        
        <div className="header-right">
          {/* 🔥 사용자 정보 표시 개선 */}
          <div className="user-info">
            <span className="user-name">{userName}</span>
            <span 
              className="user-role"
              style={{ color: ROLE_COLORS[userRole] }}
            >
              {ROLE_DISPLAY_NAMES[userRole]}
            </span>
          </div>
          
          {/* 🔥 다크모드 버튼 제거 */}
          {/* 
          <button 
            onClick={onToggleDarkMode}
            className="theme-toggle"
            title={isDarkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
          */}
          
          <button onClick={onLogout} className="logout-btn">
            로그아웃
          </button>
        </div>
      </div>

      <style jsx>{`
        .header {
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border-color);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 24px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .header-left h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .role-badge {
          padding: 4px 12px;
          border-radius: 16px;
          font-size: 12px;
          font-weight: 600;
          color: white;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        /* 🔥 사용자 정보 섹션 개선 */
        .user-info {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          border: 1px solid var(--border-color);
        }

        .user-name {
          font-weight: 600;
          color: var(--text-primary);
          font-size: 14px;
          line-height: 1.2;
        }

        .user-role {
          font-weight: 500;
          font-size: 11px;
          line-height: 1.2;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        /* 🔥 다크모드 토글 스타일 제거 */
        /*
        .theme-toggle {
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 8px;
          cursor: pointer;
          font-size: 16px;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
        }

        .theme-toggle:hover {
          background: var(--bg-hover);
        }
        */

        .logout-btn {
          background: #dc2626;
          color: white;
          border: none;
          border-radius: 6px;
          padding: 8px 16px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s ease;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .logout-btn:hover {
          background: #b91c1c;
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(220, 38, 38, 0.3);
        }

        .logout-btn::before {
          content: '🚪';
          font-size: 14px;
        }

        @media (max-width: 768px) {
          .header-content {
            padding: 12px 16px;
          }

          .header-left h1 {
            font-size: 20px;
          }

          .header-right {
            gap: 12px;
          }

          .user-info {
            padding: 6px 10px;
          }

          .user-name {
            font-size: 13px;
          }

          .user-role {
            font-size: 10px;
          }

          /* 모바일에서는 좌측 role-badge 숨김 (중복 방지) */
          .header-left .role-badge {
            display: none;
          }
        }
      `}</style>
    </header>
  );
};

export default Header;
