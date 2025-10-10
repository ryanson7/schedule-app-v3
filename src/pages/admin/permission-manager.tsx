// pages/admin/permission-manager.tsx (트리구조 유지 + 카테고리별 표시)
"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../utils/supabaseClient';
import * as dynamicPermissionSystem from '../../utils/dynamicPermissionSystem';
import { ROLES, getRoleInfo } from '../../utils/roleSystem';

interface MenuItem {
  id: string;
  name: string;
  path: string;
  icon?: string;
  category?: string;
  order?: number;
  parent?: string;
  is_visible?: boolean;
  description?: string;
}

interface MenuPermission {
  id: number;
  user_role: string;
  menu_id: string;
  menu_name: string;
  menu_path?: string;
  menu_icon?: string;
  is_visible: boolean;
  menu_order?: number;
  parent_menu?: string;
  category?: string;
  created_at: string;
  updated_at: string;
}

interface PagePermission {
  id: number;
  user_role: string;
  page_path: string;
  page_name?: string;
  can_access: boolean;
  role_priority?: number;
  created_at: string;
  updated_at: string;
}

const ROLE_DEFINITIONS = Object.entries(ROLES).map(([role, info]) => ({
  role: role as keyof typeof ROLES,
  name: info.name,
  color: info.color,
  level: info.level
}));

// ✅ 실제 네비게이션과 동일한 트리 구조 (상단 메뉴용)
const PREDEFINED_MENUS = [
  // 기본 메뉴
  { id: 'home', name: '홈', path: '/', icon: 'Home', category: '기본', order: 1 },
  
  // 관리자 메뉴 (부모)
  { id: 'admin', name: '관리자', path: '/admin', icon: 'Settings', category: '관리', order: 2 },
  { id: 'user-management', name: '사용자 관리', path: '/admin/users', icon: 'Users', category: '관리', parent: 'admin', order: 1 },
  { id: 'permission-management', name: '권한 관리', path: '/admin/permission-manager', icon: 'Shield', category: '관리', parent: 'admin', order: 2 },
  { id: 'system-settings', name: '시스템 설정', path: '/admin/settings', icon: 'Cog', category: '관리', parent: 'admin', order: 3 },

  // 스케줄 메뉴 (부모)
  { id: 'schedules', name: '스케줄', path: '/schedules', icon: 'Calendar', category: '스케줄', order: 3 },
  { id: 'all-schedules', name: '전체 스케줄', path: '/all-schedules', icon: 'List', category: '스케줄', parent: 'schedules', order: 1 },
  { id: 'studio-schedules', name: '스튜디오 스케줄', path: '/studio-schedules', icon: 'Video', category: '스케줄', parent: 'schedules', order: 2 },
  { id: 'academy-schedules', name: '학원 스케줄', path: '/academy-schedules', icon: 'School', category: '스케줄', parent: 'schedules', order: 3 },
  { id: 'freelancer-schedules', name: '프리랜서 스케줄', path: '/admin/freelancer-schedules', icon: 'User', category: '스케줄', parent: 'schedules', order: 4 },

  // 독립 메뉴들
  { id: 'reports', name: '리포트', path: '/reports', icon: 'BarChart', category: '분석', order: 4 },
  { id: 'profile', name: '프로필', path: '/profile', icon: 'User', category: '개인', order: 5 },
  { id: 'shooter-dashboard', name: '촬영자 대시보드', path: '/shooter/dashboard', icon: 'Camera', category: '촬영', order: 6 }
];

export default function PermissionManagerPage() {
  const [activeTab, setActiveTab] = useState('menus');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [menuPermissions, setMenuPermissions] = useState<MenuPermission[]>([]);
  const [pagePermissions, setPagePermissions] = useState<PagePermission[]>([]);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [newMenu, setNewMenu] = useState({
    id: '',
    name: '',
    path: '',
    icon: 'FileText',
    category: '기본',
    parent: '',
    order: 99
  });

  const router = useRouter();

  // 데이터 로딩
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: menuData, error: menuError } = await supabase
        .from('menu_permissions')
        .select('*')
        .order('user_role')
        .order('menu_order');

      if (menuError) throw menuError;
      setMenuPermissions(menuData || []);

      const { data: pageData, error: pageError } = await supabase
        .from('permissions')
        .select('*')
        .order('user_role')
        .order('page_path');

      if (pageError) throw pageError;
      setPagePermissions(pageData || []);

      console.log('[권한관리] 데이터 로드 완료:', {
        menus: menuData?.length || 0,
        pages: pageData?.length || 0
      });

    } catch (error) {
      console.error('[권한관리] 데이터 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 메뉴 가시성 토글
  const toggleMenuVisibility = useCallback(async (userRole: string, menuId: string, currentVisible: boolean) => {
    setSaving(true);
    try {
      const menuInfo = PREDEFINED_MENUS.find(m => m.id === menuId);
      
      const { error } = await supabase
        .from('menu_permissions')
        .upsert({
          user_role: userRole,
          menu_id: menuId,
          menu_name: menuInfo?.name || menuId,
          menu_path: menuInfo?.path,
          menu_icon: menuInfo?.icon,
          is_visible: !currentVisible,
          menu_order: menuInfo?.order || 99,
          parent_menu: menuInfo?.parent || null,
          category: menuInfo?.category
        }, { 
          onConflict: 'user_role,menu_id' 
        });

      if (error) throw error;

      console.log(`[메뉴토글] ${userRole}의 ${menuId} 메뉴: ${!currentVisible ? '표시' : '숨김'}`);
      // 🔥 수정: dynamicPermissionManager → dynamicPermissionSystem
      if (dynamicPermissionSystem.emitPermissionChange) {
        dynamicPermissionSystem.emitPermissionChange();
      }
      await loadData();

    } catch (error) {
      console.error('[메뉴토글] 오류:', error);
    } finally {
      setSaving(false);
    }
  }, [loadData]);

  const togglePageAccess = useCallback(async (userRole: string, pagePath: string, currentAccess: boolean) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('permissions')
        .upsert({
          user_role: userRole,
          page_path: pagePath,
          can_access: !currentAccess,
          role_priority: ROLES[userRole as keyof typeof ROLES]?.level || 0
        }, { 
          onConflict: 'user_role,page_path' 
        });

      if (error) throw error;

      console.log(`[페이지권한] ${userRole}의 ${pagePath}: ${!currentAccess ? '허용' : '차단'}`);
      // 🔥 수정: dynamicPermissionManager → dynamicPermissionSystem
      if (dynamicPermissionSystem.emitPermissionChange) {
        dynamicPermissionSystem.emitPermissionChange();
      }
      await loadData();

    } catch (error) {
      console.error('[페이지권한] 오류:', error);
    } finally {
      setSaving(false);
    }
  }, [loadData]);

  const handleAddMenu = useCallback(async () => {
    if (!newMenu.id || !newMenu.name) {
      alert('메뉴 ID와 이름을 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      const insertData = ROLE_DEFINITIONS.map(role => ({
        user_role: role.role,
        menu_id: newMenu.id,
        menu_name: newMenu.name,
        menu_path: newMenu.path,
        menu_icon: newMenu.icon,
        is_visible: false,
        menu_order: newMenu.order,
        parent_menu: newMenu.parent || null,
        category: newMenu.category
      }));

      const { error } = await supabase
        .from('menu_permissions')
        .insert(insertData);

      if (error) throw error;

      console.log(`[메뉴추가] 새 메뉴 '${newMenu.name}' 추가 완료`);
      
      PREDEFINED_MENUS.push({
        id: newMenu.id,
        name: newMenu.name,
        path: newMenu.path,
        icon: newMenu.icon,
        category: newMenu.category,
        parent: newMenu.parent || undefined,
        order: newMenu.order
      });

      // 🔥 수정: dynamicPermissionManager → dynamicPermissionSystem
      if (dynamicPermissionSystem.emitPermissionChange) {
        dynamicPermissionSystem.emitPermissionChange();
      }
      
      setNewMenu({
        id: '',
        name: '',
        path: '',
        icon: 'FileText',
        category: '기본',
        parent: '',
        order: 99
      });
      setShowAddMenu(false);
      await loadData();

    } catch (error) {
      console.error('[메뉴추가] 오류:', error);
      alert('메뉴 추가 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }, [newMenu, loadData]);

  const setDefaultMenusForRole = useCallback(async (userRole: string) => {
    const roleInfo = ROLES[userRole as keyof typeof ROLES];
    if (!confirm(`${roleInfo?.name}의 메뉴를 기본값으로 재설정하시겠습니까?`)) {
      return;
    }

    setSaving(true);
    try {
      await supabase
        .from('menu_permissions')
        .delete()
        .eq('user_role', userRole);

      const defaultMenus = getDefaultMenusForRole(userRole);
      
      const insertData = defaultMenus.map(menu => ({
        user_role: userRole,
        menu_id: menu.id,
        menu_name: menu.name,
        menu_path: menu.path,
        menu_icon: menu.icon,
        is_visible: true,
        menu_order: menu.order,
        parent_menu: menu.parent || null,
        category: menu.category
      }));

      const { error } = await supabase
        .from('menu_permissions')
        .insert(insertData);

      if (error) throw error;

      console.log(`[기본메뉴] ${userRole} 기본 메뉴 설정 완료`);
      // 🔥 수정: dynamicPermissionManager → dynamicPermissionSystem
      if (dynamicPermissionSystem.emitPermissionChange) {
        dynamicPermissionSystem.emitPermissionChange();
      }
      await loadData();

    } catch (error) {
      console.error('[기본메뉴] 오류:', error);
      alert('기본 메뉴 설정 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }, [loadData]);

  // 역할별 기본 메뉴 설정
  const setDefaultMenusForRole = useCallback(async (userRole: string) => {
    const roleInfo = ROLES[userRole as keyof typeof ROLES];
    if (!confirm(`${roleInfo?.name}의 메뉴를 기본값으로 재설정하시겠습니까?`)) {
      return;
    }

    setSaving(true);
    try {
      await supabase
        .from('menu_permissions')
        .delete()
        .eq('user_role', userRole);

      const defaultMenus = getDefaultMenusForRole(userRole);
      
      const insertData = defaultMenus.map(menu => ({
        user_role: userRole,
        menu_id: menu.id,
        menu_name: menu.name,
        menu_path: menu.path,
        menu_icon: menu.icon,
        is_visible: true,
        menu_order: menu.order,
        parent_menu: menu.parent || null, // ✅ 트리 구조 유지
        category: menu.category
      }));

      const { error } = await supabase
        .from('menu_permissions')
        .insert(insertData);

      if (error) throw error;

      console.log(`[기본메뉴] ${userRole} 기본 메뉴 설정 완료`);
      dynamicPermissionManager.emitPermissionChange();
      await loadData();

    } catch (error) {
      console.error('[기본메뉴] 오류:', error);
      alert('기본 메뉴 설정 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }, [loadData]);

  // 역할별 기본 메뉴 정의 (트리 구조 포함)
  const getDefaultMenusForRole = (userRole: string) => {
    const baseMenus = [
      PREDEFINED_MENUS.find(m => m.id === 'home')!
    ].filter(Boolean);

    switch (userRole) {
      case 'system_admin':
        return PREDEFINED_MENUS.filter(m => m.id !== 'shooter-dashboard');
      
      case 'schedule_admin':
        return PREDEFINED_MENUS.filter(m => 
          ['home', 'schedules', 'all-schedules', 'studio-schedules', 'academy-schedules', 'admin', 'user-management', 'permission-management', 'reports', 'profile'].includes(m.id)
        );
      
      case 'professor':
        return PREDEFINED_MENUS.filter(m => 
          ['home', 'studio-schedules', 'profile'].includes(m.id)
        );
      
      case 'shooter':
        return PREDEFINED_MENUS.filter(m => 
          ['home', 'shooter-dashboard', 'studio-schedules', 'profile'].includes(m.id)
        );
      
      default:
        return baseMenus;
    }
  };

  // 메뉴 가시성 확인
  const getMenuVisibility = (menuId: string, userRole: string): boolean => {
    const permission = menuPermissions.find(p => 
      p.menu_id === menuId && p.user_role === userRole
    );
    return permission?.is_visible ?? false;
  };

  // 페이지 접근 권한 확인
  const getPageAccess = (pagePath: string, userRole: string): boolean => {
    const permission = pagePermissions.find(p => 
      p.page_path === pagePath && p.user_role === userRole
    );
    return permission?.can_access ?? false;
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '50vh',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #f3f4f6',
          borderTop: '4px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p>권한 데이터를 로딩 중...</p>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ 
      minWidth: '1200px', 
      margin: '0 auto', 
      padding: '30px 40px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      background: '#fafbfc',
      minHeight: '100vh'
    }}>
      {/* 헤더 */}
      <div style={{ 
        marginBottom: '40px',
        background: 'white',
        padding: '30px',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ 
          fontSize: '32px', 
          fontWeight: 'bold', 
          margin: '0 0 12px 0',
          color: '#111827'
        }}>
          권한 관리 시스템
        </h1>
        <p style={{ 
          color: '#6b7280', 
          margin: 0,
          fontSize: '18px'
        }}>
          사용자 역할별 메뉴 표시 및 페이지 접근 권한을 통합 관리합니다.
        </p>
        <div style={{
          marginTop: '20px',
          padding: '16px 20px',
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '8px',
          color: '#1e40af',
          fontSize: '14px'
        }}>
          <strong>주의:</strong> 권한 변경은 즉시 모든 사용자에게 적용됩니다. 상단 메뉴는 트리 구조로 관리됩니다.
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div style={{ 
        display: 'flex', 
        gap: '4px', 
        marginBottom: '30px',
        background: 'white',
        padding: '8px',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        {[
          { id: 'menus', name: '메뉴 트리 관리', icon: 'M', desc: '상단 네비게이션 트리 구조 설정' },
          { id: 'pages', name: '페이지 접근 권한', icon: 'P', desc: '페이지별 접근 허용/차단 설정' },
          { id: 'bulk', name: '일괄 설정', icon: 'B', desc: '역할별 기본 권한 일괄 적용' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: '16px 24px',
              background: activeTab === tab.id ? '#3b82f6' : 'transparent',
              color: activeTab === tab.id ? 'white' : '#6b7280',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '600',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              borderRadius: '8px',
              transition: 'all 0.2s'
            }}
            title={tab.desc}
          >
            <span style={{ fontSize: '24px', fontWeight: 'bold' }}>{tab.icon}</span>
            <span>{tab.name}</span>
            <span style={{ fontSize: '12px', opacity: 0.8, textAlign: 'center' }}>{tab.desc}</span>
          </button>
        ))}
      </div>

      {saving && (
        <div style={{
          position: 'fixed',
          top: '30px',
          right: '30px',
          background: '#059669',
          color: 'white',
          padding: '16px 24px',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '16px',
          fontWeight: '500'
        }}>
          <div style={{
            width: '20px',
            height: '20px',
            border: '2px solid white',
            borderTop: '2px solid transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          권한 업데이트 중...
        </div>
      )}

      {/* 메뉴 관리 탭 - 트리 구조로 표시 */}
      {activeTab === 'menus' && (
        <div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '30px'
          }}>
            <div>
              <h2 style={{ 
                fontSize: '24px', 
                fontWeight: '600', 
                margin: '0 0 8px 0',
                color: '#111827'
              }}>
                메뉴 트리 구조 설정
              </h2>
              <p style={{
                color: '#6b7280',
                margin: 0,
                fontSize: '16px'
              }}>
                상단 네비게이션에 표시할 메뉴를 트리 구조로 관리합니다. 부모 메뉴와 자식 메뉴가 구분됩니다.
              </p>
            </div>
            
            <button
              onClick={() => setShowAddMenu(true)}
              style={{
                padding: '12px 24px',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 4px rgba(16,185,129,0.3)'
              }}
            >
              <span style={{ fontSize: '18px' }}>+</span>
              새 메뉴 추가
            </button>
          </div>

          <div style={{
            background: 'white',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={{ 
                    padding: '20px 24px', 
                    textAlign: 'left',
                    borderBottom: '1px solid #e5e7eb',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151',
                    minWidth: '350px'
                  }}>
                    메뉴 구조
                  </th>
                  {ROLE_DEFINITIONS.map(role => (
                    <th key={role.role} style={{ 
                      padding: '20px', 
                      textAlign: 'center',
                      borderBottom: '1px solid #e5e7eb',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: role.color,
                      minWidth: '140px'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <span>{role.name}</span>
                        <span style={{ fontSize: '11px', opacity: 0.7 }}>레벨 {role.level}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PREDEFINED_MENUS
                  .filter(menu => !menu.parent) // 부모 메뉴만
                  .sort((a, b) => (a.order || 99) - (b.order || 99))
                  .map(menu => (
                    <React.Fragment key={menu.id}>
                      {/* 부모 메뉴 */}
                      <tr style={{ 
                        borderBottom: '1px solid #f3f4f6',
                        background: '#fafbfc'
                      }}>
                        <td style={{ 
                          padding: '20px 24px',
                          borderRight: '1px solid #f3f4f6'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              width: '40px',
                              height: '40px',
                              background: '#3b82f6',
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '16px',
                              fontWeight: 'bold',
                              color: 'white'
                            }}>
                              {menu.icon?.charAt(0) || 'M'}
                            </div>
                            <div>
                              <div style={{ 
                                fontSize: '16px',
                                fontWeight: '600',
                                color: '#111827',
                                marginBottom: '4px'
                              }}>
                                📁 {menu.name} (부모)
                              </div>
                              {menu.path && (
                                <div style={{ 
                                  fontSize: '13px', 
                                  color: '#6b7280',
                                  fontFamily: 'monospace',
                                  background: '#e5e7eb',
                                  padding: '2px 6px',
                                  borderRadius: '4px'
                                }}>
                                  {menu.path}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        {ROLE_DEFINITIONS.map(role => {
                          const isVisible = getMenuVisibility(menu.id, role.role);
                          return (
                            <td key={role.role} style={{ 
                              padding: '20px',
                              textAlign: 'center',
                              borderRight: '1px solid #f3f4f6'
                            }}>
                              <button
                                onClick={() => toggleMenuVisibility(role.role, menu.id, isVisible)}
                                disabled={saving}
                                style={{
                                  padding: '8px 16px',
                                  background: isVisible ? '#10b981' : '#ef4444',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: saving ? 'not-allowed' : 'pointer',
                                  fontSize: '14px',
                                  fontWeight: '600',
                                  minWidth: '80px',
                                  opacity: saving ? 0.6 : 1,
                                  transition: 'all 0.2s'
                                }}
                              >
                                {isVisible ? '표시' : '숨김'}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                      
                      {/* 자식 메뉴들 */}
                      {PREDEFINED_MENUS
                        .filter(child => child.parent === menu.id)
                        .sort((a, b) => (a.order || 99) - (b.order || 99))
                        .map(child => (
                          <tr key={child.id} style={{ 
                            borderBottom: '1px solid #f3f4f6',
                            background: 'white'
                          }}>
                            <td style={{ 
                              padding: '16px 24px 16px 60px', // 들여쓰기
                              borderRight: '1px solid #f3f4f6'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ color: '#d1d5db', fontSize: '16px' }}>└─</div>
                                <div style={{
                                  width: '32px',
                                  height: '32px',
                                  background: '#f3f4f6',
                                  borderRadius: '6px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '14px',
                                  fontWeight: 'bold',
                                  color: '#6b7280'
                                }}>
                                  {child.icon?.charAt(0) || 'C'}
                                </div>
                                <div>
                                  <div style={{ 
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    color: '#374151',
                                    marginBottom: '4px'
                                  }}>
                                    {child.name}
                                  </div>
                                  {child.path && (
                                    <div style={{ 
                                      fontSize: '12px', 
                                      color: '#9ca3af',
                                      fontFamily: 'monospace',
                                      background: '#f9fafb',
                                      padding: '2px 6px',
                                      borderRadius: '3px'
                                    }}>
                                      {child.path}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            {ROLE_DEFINITIONS.map(role => {
                              const isVisible = getMenuVisibility(child.id, role.role);
                              return (
                                <td key={role.role} style={{ 
                                  padding: '16px', 
                                  textAlign: 'center',
                                  borderRight: '1px solid #f3f4f6'
                                }}>
                                  <button
                                    onClick={() => toggleMenuVisibility(role.role, child.id, isVisible)}
                                    disabled={saving}
                                    style={{
                                      padding: '6px 12px',
                                      background: isVisible ? '#10b981' : '#ef4444',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '4px',
                                      cursor: saving ? 'not-allowed' : 'pointer',
                                      fontSize: '12px',
                                      fontWeight: '600',
                                      minWidth: '70px',
                                      opacity: saving ? 0.6 : 1
                                    }}
                                  >
                                    {isVisible ? '표시' : '숨김'}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                    </React.Fragment>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 페이지 권한 탭 - 평면적으로 표시 */}
      {activeTab === 'pages' && (
        <div>
          <div style={{ marginBottom: '30px' }}>
            <h2 style={{ 
              fontSize: '24px', 
              fontWeight: '600', 
              margin: '0 0 8px 0',
              color: '#111827'
            }}>
              페이지 접근 권한
            </h2>
            <p style={{
              color: '#6b7280',
              margin: 0,
              fontSize: '16px'
            }}>
              각 역할별로 접근 가능한 페이지를 평면적으로 관리합니다. (총 {PREDEFINED_MENUS.filter(m => m.path).length}개 페이지)
            </p>
          </div>

          <div style={{ 
            background: 'white',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={{ 
                    padding: '20px 24px', 
                    textAlign: 'left',
                    borderBottom: '1px solid #e5e7eb',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151',
                    minWidth: '350px'
                  }}>
                    페이지 정보
                  </th>
                  {ROLE_DEFINITIONS.map(role => (
                    <th key={role.role} style={{ 
                      padding: '20px', 
                      textAlign: 'center',
                      borderBottom: '1px solid #e5e7eb',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: role.color,
                      minWidth: '140px'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <span>{role.name}</span>
                        <span style={{ fontSize: '11px', opacity: 0.7 }}>레벨 {role.level}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PREDEFINED_MENUS
                  .filter(menu => menu.path)
                  .sort((a, b) => a.path!.localeCompare(b.path!))
                  .map(page => (
                    <tr key={page.path} style={{ 
                      borderBottom: '1px solid #f3f4f6',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fafbfc'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                      <td style={{ 
                        padding: '24px',
                        borderRight: '1px solid #f3f4f6'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '40px',
                            height: '40px',
                            background: '#f3f4f6',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            color: '#6b7280'
                          }}>
                            {page.icon?.charAt(0) || 'P'}
                          </div>
                          <div>
                            <div style={{ 
                              fontSize: '16px',
                              fontWeight: '600',
                              color: '#111827',
                              marginBottom: '6px'
                            }}>
                              {page.name}
                              {page.parent && (
                                <span style={{ 
                                  fontSize: '12px', 
                                  color: '#9ca3af',
                                  marginLeft: '8px'
                                }}>
                                  (하위: {PREDEFINED_MENUS.find(p => p.id === page.parent)?.name})
                                </span>
                              )}
                            </div>
                            <div style={{ 
                              fontSize: '13px', 
                              color: '#6b7280',
                              fontFamily: 'monospace',
                              background: '#f9fafb',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              marginBottom: '4px'
                            }}>
                              {page.path}
                            </div>
                            <div style={{ 
                              fontSize: '12px', 
                              color: '#9ca3af',
                              background: '#f3f4f6',
                              padding: '2px 6px',
                              borderRadius: '3px',
                              display: 'inline-block'
                            }}>
                              {page.category}
                            </div>
                          </div>
                        </div>
                      </td>
                      {ROLE_DEFINITIONS.map(role => {
                        const hasAccess = getPageAccess(page.path!, role.role);
                        return (
                          <td key={role.role} style={{ 
                            padding: '24px', 
                            textAlign: 'center',
                            borderRight: '1px solid #f3f4f6'
                          }}>
                            <button
                              onClick={() => togglePageAccess(role.role, page.path!, hasAccess)}
                              disabled={saving}
                              style={{
                                padding: '10px 18px',
                                background: hasAccess ? '#10b981' : '#ef4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: saving ? 'not-allowed' : 'pointer',
                                fontSize: '14px',
                                fontWeight: '600',
                                minWidth: '80px',
                                opacity: saving ? 0.6 : 1,
                                transition: 'all 0.2s'
                              }}
                            >
                              {hasAccess ? '허용' : '차단'}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 일괄 설정 탭 */}
      {activeTab === 'bulk' && (
        <div>
          <div style={{ marginBottom: '30px' }}>
            <h2 style={{ 
              fontSize: '24px', 
              fontWeight: '600', 
              margin: '0 0 8px 0',
              color: '#111827'
            }}>
              역할별 기본 설정
            </h2>
            <p style={{
              color: '#6b7280',
              margin: 0,
              fontSize: '16px'
            }}>
              각 역할에 맞는 기본 권한을 일괄 적용합니다. 트리 구조를 포함한 모든 설정이 초기화됩니다.
            </p>
          </div>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
            gap: '30px'
          }}>
            {ROLE_DEFINITIONS.map(role => (
              <div key={role.role} style={{
                background: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
                padding: '30px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '16px',
                  marginBottom: '24px'
                }}>
                  <div style={{
                    width: '60px',
                    height: '60px',
                    background: role.color,
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '24px'
                  }}>
                    {role.name.charAt(0)}
                  </div>
                  <div>
                    <h3 style={{ 
                      margin: 0, 
                      fontSize: '20px', 
                      fontWeight: '600',
                      color: '#111827',
                      marginBottom: '4px'
                    }}>
                      {role.name}
                    </h3>
                    <p style={{ 
                      margin: 0, 
                      fontSize: '14px', 
                      color: '#6b7280'
                    }}>
                      권한 레벨 {role.level}
                    </p>
                  </div>
                </div>

                <div style={{ 
                  marginBottom: '24px',
                  padding: '20px',
                  background: '#f9fafb',
                  borderRadius: '8px'
                }}>
                  <h4 style={{ 
                    fontSize: '16px', 
                    fontWeight: '600', 
                    margin: '0 0 12px 0',
                    color: '#374151'
                  }}>
                    현재 권한 상태
                  </h4>
                  <div style={{ 
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                    fontSize: '14px', 
                    color: '#6b7280' 
                  }}>
                    <div style={{
                      padding: '12px',
                      background: 'white',
                      borderRadius: '6px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontWeight: '600', color: '#10b981', fontSize: '18px' }}>
                        {menuPermissions.filter(m => m.user_role === role.role && m.is_visible).length}
                      </div>
                      <div>표시 메뉴</div>
                    </div>
                    <div style={{
                      padding: '12px',
                      background: 'white',
                      borderRadius: '6px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontWeight: '600', color: '#3b82f6', fontSize: '18px' }}>
                        {pagePermissions.filter(p => p.user_role === role.role && p.can_access).length}
                      </div>
                      <div>접근 페이지</div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setDefaultMenusForRole(role.role)}
                  disabled={saving}
                  style={{
                    width: '100%',
                    padding: '16px',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontSize: '16px',
                    fontWeight: '600',
                    opacity: saving ? 0.6 : 1,
                    transition: 'all 0.2s'
                  }}
                >
                  기본 설정 적용
                </button>
                <p style={{
                  fontSize: '12px',
                  color: '#9ca3af',
                  textAlign: 'center',
                  margin: '8px 0 0 0'
                }}>
                  트리 구조를 포함한 모든 설정이 기본값으로 초기화됩니다
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 새 메뉴 추가 모달 */}
      {showAddMenu && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '40px',
            borderRadius: '16px',
            minWidth: '600px',
            maxWidth: '90vw',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ 
              fontSize: '24px', 
              fontWeight: '600', 
              margin: '0 0 24px 0',
              color: '#111827'
            }}>
              새 메뉴 추가
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ 
                  display: 'block', 
                  fontSize: '14px', 
                  fontWeight: '600', 
                  marginBottom: '8px',
                  color: '#374151'
                }}>
                  메뉴 ID *
                </label>
                <input
                  type="text"
                  value={newMenu.id}
                  onChange={(e) => setNewMenu({...newMenu, id: e.target.value})}
                  placeholder="예: my-custom-menu"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '16px'
                  }}
                />
              </div>

              <div>
                <label style={{ 
                  display: 'block', 
                  fontSize: '14px', 
                  fontWeight: '600', 
                  marginBottom: '8px',
                  color: '#374151'
                }}>
                  메뉴 이름 *
                </label>
                <input
                  type="text"
                  value={newMenu.name}
                  onChange={(e) => setNewMenu({...newMenu, name: e.target.value})}
                  placeholder="예: 내 커스텀 메뉴"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '16px'
                  }}
                />
              </div>

              <div>
                <label style={{ 
                  display: 'block', 
                  fontSize: '14px', 
                  fontWeight: '600', 
                  marginBottom: '8px',
                  color: '#374151'
                }}>
                  경로
                </label>
                <input
                  type="text"
                  value={newMenu.path}
                  onChange={(e) => setNewMenu({...newMenu, path: e.target.value})}
                  placeholder="예: /my-custom-page"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '16px'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '20px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '14px', 
                    fontWeight: '600', 
                    marginBottom: '8px',
                    color: '#374151'
                  }}>
                    카테고리
                  </label>
                  <select
                    value={newMenu.category}
                    onChange={(e) => setNewMenu({...newMenu, category: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '16px'
                    }}
                  >
                    <option value="기본">기본</option>
                    <option value="관리">관리</option>
                    <option value="스케줄">스케줄</option>
                    <option value="분석">분석</option>
                    <option value="개인">개인</option>
                    <option value="촬영">촬영</option>
                  </select>
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '14px', 
                    fontWeight: '600', 
                    marginBottom: '8px',
                    color: '#374151'
                  }}>
                    순서
                  </label>
                  <input
                    type="number"
                    value={newMenu.order}
                    onChange={(e) => setNewMenu({...newMenu, order: parseInt(e.target.value) || 99})}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '16px'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ 
                  display: 'block', 
                  fontSize: '14px', 
                  fontWeight: '600', 
                  marginBottom: '8px',
                  color: '#374151'
                }}>
                  부모 메뉴 (트리 구조)
                </label>
                <select
                  value={newMenu.parent}
                  onChange={(e) => setNewMenu({...newMenu, parent: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '16px'
                  }}
                >
                  <option value="">최상위 메뉴 (부모 없음)</option>
                  {PREDEFINED_MENUS.filter(m => !m.parent).map(menu => (
                    <option key={menu.id} value={menu.id}>
                      📁 {menu.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ 
              display: 'flex', 
              gap: '16px', 
              marginTop: '32px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setShowAddMenu(false)}
                style={{
                  padding: '12px 24px',
                  background: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '500'
                }}
              >
                취소
              </button>
              <button
                onClick={handleAddMenu}
                disabled={!newMenu.id || !newMenu.name || saving}
                style={{
                  padding: '12px 24px',
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: (!newMenu.id || !newMenu.name || saving) ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  fontWeight: '500',
                  opacity: (!newMenu.id || !newMenu.name || saving) ? 0.6 : 1
                }}
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
