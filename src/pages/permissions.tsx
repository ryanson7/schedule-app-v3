// pages/permissions.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import DynamicNavigation from '../components/DynamicNavigation';
import { getAllMenuItems, getMenusByCategory } from '../utils/menuConfig';
import { getAllRolePermissions, updateRolePermission, syncMenusToDatabase } from '../utils/permissions';

export default function PermissionsPage() {
  const [rolePermissions, setRolePermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // 사용 가능한 역할들
  const roles = [
    { value: 'system_admin', label: '시스템 관리자', color: '#dc2626', description: '모든 시스템 권한' },
    { value: 'schedule_admin', label: '스케줄 관리자', color: '#ea580c', description: '스케줄 관련 관리 권한' },
    { value: 'academy_manager', label: '학원 매니저', color: '#d97706', description: '학원 스케줄 관리' },
    { value: 'online_manager', label: '온라인 매니저', color: '#65a30d', description: '온라인 스케줄 관리' },
    { value: 'professor', label: '교수', color: '#7c3aed', description: '교수 관련 기능' },
    { value: 'shooter', label: '촬영자', color: '#be185d', description: '촬영 관련 기능' }, // 🔧 이 줄이 있어야 함
    { value: 'staff', label: '일반 직원', color: '#6b7280', description: '기본 기능만' }
  ];

  

  // 모든 메뉴 아이템
  const allMenuItems = getAllMenuItems();
  
  // 카테고리별 메뉴
  const menusByCategory = getMenusByCategory();


    // 🔧 콘솔에 출력
  console.log('🔍 모든 메뉴 아이템:', allMenuItems);
  console.log('🔍 카테고리별 메뉴:', menusByCategory);
  console.log('🔍 카테고리 목록:', Object.keys(menusByCategory));


  useEffect(() => {
    loadPermissions();
  }, []);

  // 🔧 DB에서 모든 권한 로드
  const loadPermissions = async () => {
    try {
      setLoading(true);
      console.log('🔍 권한 정보 로딩 시작...');

      const permissions = await getAllRolePermissions();
      setRolePermissions(permissions);
      
      console.log('✅ 권한 로드 완료:', permissions);

    } catch (error) {
      console.error('❌ 권한 로드 실패:', error);
      alert('권한 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 🔧 권한 토글
  const togglePermission = async (roleId: string, menuId: string, granted: boolean) => {
    try {
      setSaving(true);
      
      const success = await updateRolePermission(roleId, menuId, granted);
      
      if (success) {
        // 로컬 상태 업데이트
        setRolePermissions(prev => ({
          ...prev,
          [roleId]: {
            ...prev[roleId],
            [menuId]: granted
          }
        }));
        
        console.log('✅ 권한 변경 성공:', { roleId, menuId, granted });
      } else {
        alert('권한 변경에 실패했습니다.');
      }

    } catch (error) {
      console.error('❌ 권한 변경 실패:', error);
      alert('권한 변경 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 🔧 신규 메뉴 동기화
  const syncNewMenus = async () => {
    try {
      setSyncing(true);
      console.log('🔄 메뉴 동기화 시작...');
      
      const success = await syncMenusToDatabase(allMenuItems);
      
      if (success) {
        alert('✅ 메뉴 동기화가 완료되었습니다!\n새로운 메뉴가 시스템 관리자에게 추가되었습니다.\n페이지를 새로고침합니다.');
        window.location.reload();
      } else {
        alert('❌ 메뉴 동기화에 실패했습니다.');
      }
      
    } catch (error) {
      console.error('❌ 메뉴 동기화 실패:', error);
      alert('메뉴 동기화 중 오류가 발생했습니다.');
    } finally {
      setSyncing(false);
    }
  };

  // 권한 확인
  const hasPermission = (roleId: string, menuId: string): boolean => {
    return rolePermissions[roleId]?.[menuId] === true;
  };

  // 역할별 권한 개수 계산
  const getPermissionCount = (roleId: string): number => {
    return Object.values(rolePermissions[roleId] || {}).filter(Boolean).length;
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        backgroundColor: '#f8fafc'
      }}>
        <div style={{
          padding: '32px',
          textAlign: 'center',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
            🔍 권한 정보 로딩 중...
          </div>
          <div style={{ fontSize: '14px', color: '#6b7280' }}>
            데이터베이스에서 권한 설정을 불러오고 있습니다.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      <DynamicNavigation />
      
      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* 헤더 */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ 
            fontSize: '28px', 
            fontWeight: '700', 
            color: '#1e293b', 
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            🛡️ DB 기반 권한 관리
          </h1>
          <p style={{ fontSize: '16px', color: '#64748b', margin: 0 }}>
            메뉴 구조는 코드에서 관리하고, 권한은 데이터베이스에서 동적으로 설정합니다.
          </p>
        </div>

        
        {/* 🔧 디버깅 정보 추가 */}
        <div style={{
          backgroundColor: '#fff3cd',
          border: '1px solid #ffeaa7',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '24px'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
            🔍 디버깅 정보
          </h3>
          <div style={{ fontSize: '14px', fontFamily: 'monospace' }}>
            <div><strong>전체 메뉴 개수:</strong> {allMenuItems.length}개</div>
            <div><strong>카테고리 개수:</strong> {Object.keys(menusByCategory).length}개</div>
            <div><strong>카테고리 목록:</strong> {Object.keys(menusByCategory).join(', ')}</div>
          </div>
          
          <details style={{ marginTop: '12px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: '600' }}>
              📂 카테고리별 메뉴 상세
            </summary>
            <pre style={{ 
              fontSize: '12px', 
              backgroundColor: '#f8f9fa', 
              padding: '12px', 
              borderRadius: '4px',
              overflow: 'auto',
              maxHeight: '300px',
              marginTop: '8px'
            }}>
              {JSON.stringify(menusByCategory, null, 2)}
            </pre>
          </details>
        </div>

        {/* 동기화 버튼 */}
        <div style={{ 
          marginBottom: '24px',
          padding: '20px',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={syncNewMenus}
              disabled={syncing}
              style={{
                padding: '10px 20px',
                backgroundColor: syncing ? '#9ca3af' : '#10b981',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: syncing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'background-color 0.2s'
              }}
            >
              {syncing ? '🔄' : '🔄'} 
              {syncing ? '동기화 중...' : '신규 메뉴 동기화'}
            </button>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>
              <div>💡 <strong>언제 사용하나요?</strong></div>
              <div>• 개발자가 menuConfig.ts에 새로운 메뉴를 추가했을 때</div>
              <div>• 새 메뉴가 시스템 관리자에게만 먼저 권한이 부여됩니다</div>
            </div>
          </div>
        </div>

        {/* 역할 요약 */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          marginBottom: '24px'
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>
            📊 역할별 권한 현황
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            {roles.map(role => (
              <div key={role.value} style={{
                padding: '16px',
                border: `2px solid ${role.color}20`,
                borderRadius: '8px',
                backgroundColor: `${role.color}08`
              }}>
                <div style={{ 
                  fontSize: '14px', 
                  fontWeight: '600', 
                  color: role.color,
                  marginBottom: '4px'
                }}>
                  {role.label}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
                  {role.description}
                </div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: role.color }}>
                  {getPermissionCount(role.value)}/{allMenuItems.length}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 권한 매트릭스 */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px' }}>
            🔐 역할별 메뉴 접근 권한
          </h2>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <th style={{ 
                    padding: '14px', 
                    textAlign: 'left', 
                    fontWeight: '600',
                    color: '#374151',
                    borderBottom: '2px solid #e5e7eb',
                    minWidth: '250px',
                    position: 'sticky',
                    left: 0,
                    backgroundColor: '#f8fafc',
                    zIndex: 10
                  }}>
                    메뉴
                  </th>
                  {roles.map(role => (
                    <th key={role.value} style={{ 
                      padding: '14px', 
                      textAlign: 'center', 
                      fontWeight: '600',
                      color: role.color,
                      borderBottom: '2px solid #e5e7eb',
                      minWidth: '100px'
                    }}>
                      <div>{role.label}</div>
                      <div style={{ fontSize: '10px', fontWeight: '400', marginTop: '2px' }}>
                        {getPermissionCount(role.value)}개
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(menusByCategory).map(([category, categoryMenus]) => (
                  <React.Fragment key={category}>
                    {/* 카테고리 헤더 */}
                    <tr>
                      <td colSpan={roles.length + 1} style={{
                        padding: '12px 14px',
                        backgroundColor: '#f1f5f9',
                        fontWeight: '600',
                        color: '#475569',
                        fontSize: '14px',
                        borderTop: '1px solid #e2e8f0'
                      }}>
                        📁 {category.toUpperCase()}
                      </td>
                    </tr>
                    
                    {/* 카테고리별 메뉴들 */}
                    {categoryMenus.map(menu => (
                      <tr key={menu.id} style={{
                        borderBottom: '1px solid #f3f4f6',
                      }}>
                        <td style={{ 
                          padding: '12px',
                          position: 'sticky',
                          left: 0,
                          backgroundColor: '#ffffff',
                          zIndex: 5,
                          borderRight: '1px solid #f3f4f6'
                        }}>
                          <div>
                            <div style={{ 
                              fontWeight: '500', 
                              color: '#1e293b',
                              fontSize: '14px'
                            }}>
                              {menu.name}
                            </div>
                            <div style={{ 
                              fontSize: '12px', 
                              color: '#64748b',
                              marginTop: '2px'
                            }}>
                              {menu.path}
                            </div>
                            <div style={{ 
                              fontSize: '10px', 
                              color: '#9ca3af',
                              marginTop: '1px'
                            }}>
                              ID: {menu.id}
                            </div>
                          </div>
                        </td>
                        {roles.map(role => (
                          <td key={role.value} style={{ 
                            padding: '12px',
                            textAlign: 'center'
                          }}>
                            <label style={{ cursor: 'pointer', display: 'inline-block' }}>
                              <input
                                type="checkbox"
                                checked={hasPermission(role.value, menu.id)}
                                onChange={(e) => togglePermission(role.value, menu.id, e.target.checked)}
                                disabled={saving}
                                style={{
                                  width: '18px',
                                  height: '18px',
                                  accentColor: role.color,
                                  cursor: saving ? 'not-allowed' : 'pointer'
                                }}
                              />
                            </label>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 저장 중 오버레이 */}
        {saving && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999
          }}>
            <div style={{
              backgroundColor: '#ffffff',
              padding: '24px',
              borderRadius: '12px',
              boxShadow: '0 8px 16px rgba(0, 0, 0, 0.15)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
                💾 권한 저장 중...
              </div>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>
                데이터베이스에 권한 변경사항을 저장하고 있습니다.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
