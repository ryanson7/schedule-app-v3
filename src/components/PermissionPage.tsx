// src/components/PermissionPage.tsx
import React, { useState } from 'react';
import { 
  ROLES, 
  PAGE_PERMISSIONS, 
  ROLE_MENUS,
  canAccessPage,
  getUserMenus 
} from '../utils/roleSystem';
import { UserRoleType } from '../types/users';

const ROLE_LIST = Object.entries(ROLES).map(([id, role]) => ({
  id: id as UserRoleType,
  ...role
}));

function PermissionPage() {
  const [selectedRole, setSelectedRole] = useState<UserRoleType>('schedule_admin');
  const [testPath, setTestPath] = useState('/admin');

  const testAccess = () => {
    const result = canAccessPage(selectedRole, testPath);
    alert(`${ROLES[selectedRole].name}의 ${testPath} 접근: ${result ? '허용' : '거부'}`);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '20px' }}>
        🔐 새로운 권한 시스템 (roleSystem 기반)
      </h1>
      
      {/* 권한 테스트 */}
      <div style={{ 
        backgroundColor: '#f9fafb', 
        padding: '20px', 
        borderRadius: '8px', 
        marginBottom: '30px' 
      }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '15px' }}>
          🧪 권한 테스트
        </h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select 
            value={selectedRole} 
            onChange={(e) => setSelectedRole(e.target.value as UserRoleType)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            {ROLE_LIST.map(role => (
              <option key={role.id} value={role.id}>{role.name}</option>
            ))}
          </select>
          
          <input 
            type="text" 
            value={testPath} 
            onChange={(e) => setTestPath(e.target.value)}
            placeholder="테스트할 경로 입력"
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', minWidth: '200px' }}
          />
          
          <button 
            onClick={testAccess}
            style={{ 
              padding: '8px 16px', 
              backgroundColor: '#2563eb', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            접근 권한 테스트
          </button>
        </div>
      </div>

      {/* 역할별 정보 */}
      <div style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '15px' }}>
          👥 역할별 정보
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px' }}>
          {ROLE_LIST.map(role => (
            <div key={role.id} style={{ 
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '15px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <div style={{ 
                  width: '16px', 
                  height: '16px', 
                  backgroundColor: role.color, 
                  borderRadius: '50%' 
                }}></div>
                <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>{role.name}</h3>
                <span style={{ 
                  fontSize: '12px', 
                  color: '#6b7280', 
                  backgroundColor: '#f3f4f6', 
                  padding: '2px 6px', 
                  borderRadius: '3px' 
                }}>
                  Level {role.level}
                </span>
              </div>
              <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '10px' }}>
                {role.description}
              </p>
              <div>
                <strong style={{ fontSize: '14px' }}>권한:</strong>
                <div style={{ marginTop: '5px' }}>
                  {role.permissions.map(perm => (
                    <span key={perm} style={{ 
                      display: 'inline-block',
                      fontSize: '12px', 
                      backgroundColor: '#e0f2fe', 
                      color: '#0369a1',
                      padding: '2px 6px', 
                      borderRadius: '3px',
                      marginRight: '5px',
                      marginBottom: '3px'
                    }}>
                      {perm}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 선택된 역할의 메뉴 미리보기 */}
      <div style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '15px' }}>
          📋 {ROLES[selectedRole].name} 메뉴 미리보기
        </h2>
        <div style={{ 
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '20px'
        }}>
          {getUserMenus(selectedRole).map(menu => (
            <div key={menu.id} style={{ marginBottom: '15px' }}>
              <div style={{ 
                fontSize: '16px', 
                fontWeight: '600', 
                marginBottom: '5px',
                color: '#1f2937'
              }}>
                📁 {menu.name} ({menu.path})
              </div>
              {menu.children && (
                <div style={{ marginLeft: '20px' }}>
                  {menu.children.map(child => (
                    <div key={child.path} style={{ 
                      fontSize: '14px', 
                      color: '#6b7280',
                      marginBottom: '3px'
                    }}>
                      └ {child.name} ({child.path})
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 페이지 권한 매트릭스 */}
      <div>
        <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '15px' }}>
          🗂️ 페이지 권한 매트릭스
        </h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb' }}>
                <th style={{ 
                  padding: '12px', 
                  textAlign: 'left', 
                  border: '1px solid #e5e7eb',
                  fontWeight: '600'
                }}>
                  페이지 경로
                </th>
                <th style={{ 
                  padding: '12px', 
                  textAlign: 'left', 
                  border: '1px solid #e5e7eb',
                  fontWeight: '600'
                }}>
                  필요 권한
                </th>
                {ROLE_LIST.map(role => (
                  <th key={role.id} style={{ 
                    padding: '12px', 
                    textAlign: 'center', 
                    border: '1px solid #e5e7eb',
                    color: role.color,
                    fontWeight: '600',
                    fontSize: '12px',
                    minWidth: '80px'
                  }}>
                    {role.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(PAGE_PERMISSIONS).map(([path, permissions]) => (
                <tr key={path}>
                  <td style={{ 
                    padding: '10px', 
                    border: '1px solid #e5e7eb',
                    fontFamily: 'monospace',
                    fontSize: '13px'
                  }}>
                    {path}
                  </td>
                  <td style={{ 
                    padding: '10px', 
                    border: '1px solid #e5e7eb',
                    fontSize: '12px'
                  }}>
                    {permissions.join(', ')}
                  </td>
                  {ROLE_LIST.map(role => {
                    const hasAccess = canAccessPage(role.id, path);
                    return (
                      <td key={role.id} style={{ 
                        padding: '10px', 
                        textAlign: 'center', 
                        border: '1px solid #e5e7eb',
                        backgroundColor: hasAccess ? '#dcfce7' : '#fef2f2'
                      }}>
                        <span style={{
                          fontSize: '16px',
                          color: hasAccess ? '#16a34a' : '#dc2626'
                        }}>
                          {hasAccess ? '✅' : '❌'}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default PermissionPage;
