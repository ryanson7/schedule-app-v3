import { UserRoleType } from '../../types/users';
import { ROLE_DISPLAY_NAMES, ROLE_COLORS } from '../../utils/roleRedirection';
import { canAccessPage } from '../../utils/roleRedirection';

interface MenuItem {
  path: string;
  label: string;
  icon: string;
}

interface SidebarProps {
  menus: MenuItem[];
  userRole: UserRoleType;
  userName: string;
  onLogout: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  currentPath: string;
  onNavigate: (path: string) => void;
}

const Sidebar = ({ 
  menus, 
  userRole, 
  userName, 
  onLogout, 
  isDarkMode, 
  onToggleDarkMode,
  currentPath,
  onNavigate
}: SidebarProps) => {
  
  const handleMenuClick = (path: string) => {
    if (canAccessPage(userRole, path)) {
      onNavigate(path);
    } else {
      alert('접근 권한이 없습니다.');
    }
  };

  return (
    <nav className="sidebar">
      {/* 사이드바 헤더 */}
      <div className="sidebar-header">
        <h1>멤버스 시스템</h1>
        <div className="user-info">
          <span className="user-name">{userName}</span>
          <span 
            className="role-badge"
            style={{ backgroundColor: ROLE_COLORS[userRole] }}
          >
            {ROLE_DISPLAY_NAMES[userRole]}
          </span>
        </div>
      </div>
      
      {/* 메뉴 목록 */}
      <ul className="nav-menu">
        {menus.map((menu) => (
          <li key={menu.path}>
            <a 
              href="#"
              className={currentPath === menu.path ? 'active' : ''}
              onClick={(e) => {
                e.preventDefault();
                handleMenuClick(menu.path);
              }}
            >
              <span className="menu-icon">{menu.icon}</span>
              {menu.label}
            </a>
          </li>
        ))}
      </ul>

      {/* 사이드바 푸터 */}
      <div className="sidebar-footer">
        <button onClick={onToggleDarkMode} className="theme-toggle">
          <span className="toggle-icon">{isDarkMode ? '☀️' : '🌙'}</span>
          {isDarkMode ? '라이트 모드' : '다크 모드'}
        </button>
        <button onClick={onLogout} className="logout-button">
          <span className="logout-icon">🚪</span>
          로그아웃
        </button>
      </div>

      <style jsx>{`
        .sidebar {
          width: 260px;
          background: var(--bg-secondary);
          border-right: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          position: fixed;
          height: 100vh;
          overflow-y: auto;
          z-index: 1000;
          box-shadow: 2px 0 4px rgba(0, 0, 0, 0.1);
        }

        .sidebar-header {
          padding: 24px 20px;
          border-bottom: 1px solid var(--border-color);
        }

        .sidebar-header h1 {
          margin: 0 0 12px 0;
          font-size: 20px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .user-info {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .user-name {
          font-size: 14px;
          color: var(--text-secondary);
          font-weight: 500;
        }

        .role-badge {
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          color: white;
          align-self: flex-start;
        }

        .nav-menu {
          list-style: none;
          padding: 16px 0;
          margin: 0;
          flex: 1;
        }

        .nav-menu li {
          margin-bottom: 2px;
        }

        .nav-menu a {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 20px;
          color: var(--text-secondary);
          text-decoration: none;
          transition: all 0.2s ease;
          border-left: 3px solid transparent;
        }

        .nav-menu a:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
          border-left-color: #3b82f6;
        }

        .nav-menu a.active {
          background: #1e40af;
          color: white;
          border-left-color: #60a5fa;
        }

        .menu-icon {
          font-size: 18px;
          width: 20px;
          text-align: center;
        }

        .sidebar-footer {
          padding: 16px 20px;
          border-top: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .theme-toggle,
        .logout-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 12px;
          border: 1px solid var(--border-color);
          background: var(--bg-tertiary);
          color: var(--text-primary);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 14px;
          font-weight: 500;
        }

        .theme-toggle:hover {
          background: var(--bg-hover);
        }

        .logout-button {
          background: #dc2626;
          border-color: #dc2626;
          color: white;
        }

        .logout-button:hover {
          background: #b91c1c;
          border-color: #b91c1c;
        }

        .toggle-icon,
        .logout-icon {
          font-size: 16px;
        }

        @media (max-width: 768px) {
          .sidebar {
            width: 100%;
            height: auto;
            position: relative;
          }

          .nav-menu {
            display: flex;
            overflow-x: auto;
            padding: 8px;
          }

          .nav-menu li {
            margin-bottom: 0;
            margin-right: 8px;
          }

          .nav-menu a {
            white-space: nowrap;
            padding: 8px 12px;
            border-left: none;
            border-bottom: 3px solid transparent;
          }

          .nav-menu a.active {
            border-left: none;
            border-bottom-color: #60a5fa;
          }

          .sidebar-footer {
            flex-direction: row;
          }
        }
      `}</style>
    </nav>
  );
};

export default Sidebar;
