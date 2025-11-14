// pages/admin/permissions/index.tsx - DB 연동
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../../utils/supabaseClient';

export default function PermissionsPage() {
  const [mounted, setMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState({ name: '사용자', role: 'guest' });
  const [loading, setLoading] = useState(false);
  const [menuPermissions, setMenuPermissions] = useState([]);
  const [availableMenus, setAvailableMenus] = useState([]);
  const [roleDefinitions, setRoleDefinitions] = useState([]);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    
    if (typeof window !== 'undefined') {
      const userRole = localStorage.getItem('userRole') || 'guest';
      const userName = localStorage.getItem('userName') || '사용자';
      
      setCurrentUser({ name: userName, role: userRole });
      
      // 권한 체크
      if (!['system_admin', 'schedule_admin', 'manager'].includes(userRole)) {
        alert('권한이 없습니다.');
        router.push('/dashboard');
        return;
      }
      
      loadDatabaseData();
    }
  }, [router]);

  // 🔥 DB에서 모든 데이터 로드
  const loadDatabaseData = async () => {
    try {
      setLoading(true);
      
      console.log('🔥 DB에서 권한 데이터 로드 시작');
      
      // 1. 메뉴 권한 데이터 로드
      const { data: menuData, error: menuError } = await supabase
        .from('menupermissions')
        .select('*')
        .order('userrole')
        .order('menuorder');
      
      if (menuError) throw menuError;
      
      // 2. 사용 가능한 모든 메뉴 목록 로드 (유니크한 메뉴만)
      const { data: uniqueMenus, error: uniqueError } = await supabase
        .from('menupermissions')
        .select('menuid, menuname, menupath, category, menuicon')
        .order('menuorder');
      
      if (uniqueError) throw uniqueError;
      
      // 유니크한 메뉴만 추출
      const uniqueMenuList = [];
      const seenMenus = new Set();
      
      uniqueMenus?.forEach(menu => {
        if (!seenMenus.has(menu.menuid)) {
          seenMenus.add(menu.menuid);
          uniqueMenuList.push(menu);
        }
      });
      
      // 3. 역할 정의 (하드코딩된 부분을 DB에서 가져오거나 설정으로 관리)
      const roles = [
        { id: 'system_admin', name: '시스템 관리자', color: '#dc2626', level: 100 },
        { id: 'schedule_admin', name: '스케줄 관리자', color: '#ea580c', level: 80 },
        { id: 'manager', name: '일반 관리자', color: '#f97316', level: 75 },
        { id: 'professor', name: '교수', color: '#0d9488', level: 40 },
        { id: 'staff', name: '일반 직원', color: '#6366f1', level: 10 }
      ];
      
      setMenuPermissions(menuData || []);
      setAvailableMenus(uniqueMenuList);
      setRoleDefinitions(roles);
      
      console.log('✅ DB 데이터 로드 완료:', {
        메뉴권한: menuData?.length || 0,
        유니크메뉴: uniqueMenuList.length,
        역할: roles.length
      });
      
    } catch (error) {
      console.error('❌ DB 데이터 로드 실패:', error);
      alert('데이터 로드에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 🔥 메뉴 토글 함수 (DB 업데이트)
  const toggleMenu = async (userRole, menuId) => {
    try {
      setLoading(true);
      
      // 현재 상태 확인
      const existingPermission = menuPermissions.find(
        p => p.userrole === userRole && p.menuid === menuId
      );
      
      if (existingPermission) {
        // 기존 권한 업데이트
        const { error } = await supabase
          .from('menupermissions')
          .update({
            isvisible: !existingPermission.isvisible,
            updatedat: new Date().toISOString()
          })
          .eq('id', existingPermission.id);
        
        if (error) throw error;
        
      } else {
        // 새 권한 생성
        const menuInfo = availableMenus.find(m => m.menuid === menuId);
        
        const { error } = await supabase
          .from('menupermissions')
          .insert({
            userrole: userRole,
            menuid: menuId,
            menuname: menuInfo?.menuname || menuId,
            menupath: menuInfo?.menupath || '/',
            menuicon: menuInfo?.menuicon || 'FileText',
            isvisible: true,
            menuorder: 99,
            category: menuInfo?.category || 'general'
          });
        
        if (error) throw error;
      }
      
      console.log('✅ 메뉴 권한 업데이트:', userRole, menuId);
      
      // 데이터 다시 로드
      await loadDatabaseData();
      
    } catch (error) {
      console.error('❌ 메뉴 권한 업데이트 실패:', error);
      alert('권한 업데이트에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 🔥 메뉴 가시성 확인
  const getMenuVisibility = (menuId, userRole) => {
    const permission = menuPermissions.find(
      p => p.menuid === menuId && p.userrole === userRole
    );
    return permission?.isvisible || false;
  };

  if (!mounted) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px'
      }}>
        <div style={{ color: '#64748b' }}>로딩 중...</div>
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '20px'
    }}>
      {/* 헤더 */}
      <div style={{
        marginBottom: '30px',
        padding: '20px',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <h1 style={{
          margin: '0 0 10px 0',
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#1f2937'
        }}>
          DB 기반 메뉴 권한 관리
        </h1>
        <p style={{
          margin: 0,
          color: '#64748b',
          fontSize: '14px'
        }}>
          데이터베이스에서 실시간으로 메뉴 권한을 관리합니다.
        </p>
      </div>

      {/* 현재 사용자 정보 */}
      <div style={{
        marginBottom: '20px',
        padding: '15px',
        backgroundColor: '#f0f9ff',
        border: '1px solid #0ea5e9',
        borderRadius: '6px'
      }}>
        <strong>현재 사용자:</strong> {currentUser.name} ({currentUser.role})
      </div>

      {/* 로딩 상태 */}
      {loading && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          padding: '12px 20px',
          backgroundColor: '#1f2937',
          color: 'white',
          borderRadius: '8px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            width: '16px',
            height: '16px',
            border: '2px solid white',
            borderTop: '2px solid transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          DB 업데이트 중...
        </div>
      )}

      {/* 🔥 역할별 메뉴 권한 테이블 */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc' }}>
              <th style={{
                padding: '16px',
                textAlign: 'left',
                fontWeight: '600',
                color: '#374151',
                borderBottom: '2px solid #e5e7eb',
                minWidth: '300px'
              }}>
                메뉴
              </th>
              {roleDefinitions.map(role => (
                <th key={role.id} style={{
                  padding: '16px',
                  textAlign: 'center',
                  fontWeight: '600',
                  color: role.color,
                  borderBottom: '2px solid #e5e7eb',
                  minWidth: '120px'
                }}>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <span>{role.name}</span>
                    <span style={{ fontSize: '11px', opacity: 0.7 }}>
                      Level {role.level}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {availableMenus.map((menu, index) => (
              <tr key={menu.menuid} style={{
                borderBottom: '1px solid #f3f4f6',
                backgroundColor: index % 2 === 0 ? 'white' : '#fafafa'
              }}>
                <td style={{ padding: '16px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      backgroundColor: '#3b82f6',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      color: 'white'
                    }}>
                      {menu.menuicon?.charAt(0) || 'M'}
                    </div>
                    <div>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#111827',
                        marginBottom: '4px'
                      }}>
                        {menu.menuname}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#6b7280',
                        fontFamily: 'monospace',
                        backgroundColor: '#f9fafb',
                        padding: '2px 6px',
                        borderRadius: '3px'
                      }}>
                        {menu.menupath}
                      </div>
                    </div>
                  </div>
                </td>
                {roleDefinitions.map(role => {
                  const isVisible = getMenuVisibility(menu.menuid, role.id);
                  return (
                    <td key={role.id} style={{
                      padding: '16px',
                      textAlign: 'center'
                    }}>
                      <button
                        onClick={() => toggleMenu(role.id, menu.menuid)}
                        disabled={loading}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: isVisible ? '#10b981' : '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          fontSize: '12px',
                          fontWeight: '600',
                          minWidth: '60px',
                          opacity: loading ? 0.6 : 1
                        }}
                      >
                        {isVisible ? 'ON' : 'OFF'}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 🔥 스피너 CSS */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
