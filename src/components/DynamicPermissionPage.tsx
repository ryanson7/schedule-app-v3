// src/components/DynamicPermissionPage.tsx
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  addPage,
  updatePage,
  deletePage,
  getAllPages,
  getAllRoles,
  addPermissionToRole,
  removePermissionFromRole,
  reorderPages,
  exportData,
  importData,
  emitPermissionChange,
  type DynamicPage,
  type DynamicRole
} from '../utils/dynamicPermissionSystem';
import { UserRoleType } from '../types/users';

function DynamicPermissionPage() {
  const router = useRouter();
  const [pages, setPages] = useState<DynamicPage[]>([]);
  const [roles, setRoles] = useState<DynamicRole[]>([]);
  const [activeTab, setActiveTab] = useState<'pages' | 'roles' | 'permissions'>('pages');
  const [editingPage, setEditingPage] = useState<DynamicPage | null>(null);
  const [showAddPageModal, setShowAddPageModal] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  useEffect(() => {
    refreshData();
    
    // 🔥 권한 변경 감지 리스너
    const handlePermissionChange = () => {
      refreshData();
      setLastUpdate(new Date().toLocaleTimeString());
    };
    
    window.addEventListener('storage', handlePermissionChange);
    window.addEventListener('permissions-updated', handlePermissionChange);
    
    return () => {
      window.removeEventListener('storage', handlePermissionChange);
      window.removeEventListener('permissions-updated', handlePermissionChange);
    };
  }, []);

  const refreshData = () => {
    setPages(getAllPages());
    setRoles(getAllRoles());
    setLastUpdate(new Date().toLocaleTimeString());
  };

  // 🔥 새 페이지 추가 (향상된 버전)
  const handleAddPage = (pageData: any) => {
    try {
      const pageId = addPage({
        id: pageData.id || `page_${Date.now()}`,
        path: pageData.path,
        name: pageData.name,
        icon: pageData.icon || '📄',
        category: pageData.category || '기본',
        requiredPermissions: pageData.requiredPermissions || [],
        allowedRoles: pageData.allowedRoles || [],
        isActive: true,
        order: pages.length + 1
      });
      
      refreshData();
      setShowAddPageModal(false);
      
      // 🔥 권한 변경 이벤트 발생
      emitPermissionChange({
        type: 'page_added',
        pageId,
        pageName: pageData.name,
        timestamp: new Date().toISOString()
      });
      
      alert(`✅ 새 페이지 "${pageData.name}" 추가 완료!\n경로: ${pageData.path}`);
      
      // 🔥 새 페이지로 이동할지 묻기
      if (confirm(`새로 만든 페이지 "${pageData.name}"로 이동하시겠습니까?`)) {
        window.open(pageData.path, '_blank');
      }
      
    } catch (error) {
      console.error('페이지 추가 오류:', error);
      alert(`❌ 페이지 추가 실패: ${error.message}`);
    }
  };

  // 🔥 페이지 수정 (향상된 버전)
  const handleUpdatePage = (pageId: string, updates: Partial<DynamicPage>) => {
    try {
      const oldPage = pages.find(p => p.id === pageId);
      
      updatePage(pageId, updates);
      refreshData();
      setEditingPage(null);
      
      // 🔥 권한 변경 이벤트 발생
      emitPermissionChange({
        type: 'page_updated',
        pageId,
        pageName: updates.name || oldPage?.name,
        changes: updates,
        timestamp: new Date().toISOString()
      });
      
      alert(`✅ 페이지 "${updates.name || oldPage?.name}" 수정 완료!`);
      
    } catch (error) {
      console.error('페이지 수정 오류:', error);
      alert(`❌ 페이지 수정 실패: ${error.message}`);
    }
  };

  // 🔥 페이지 삭제 (향상된 버전)
  const handleDeletePage = (pageId: string, pageName: string) => {
    if (confirm(`⚠️ "${pageName}" 페이지를 완전히 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
      try {
        deletePage(pageId);
        refreshData();
        
        // 🔥 권한 변경 이벤트 발생
        emitPermissionChange({
          type: 'page_deleted',
          pageId,
          pageName,
          timestamp: new Date().toISOString()
        });
        
        alert(`✅ 페이지 "${pageName}" 삭제 완료!`);
        
      } catch (error) {
        console.error('페이지 삭제 오류:', error);
        alert(`❌ 페이지 삭제 실패: ${error.message}`);
      }
    }
  };

  // 🔥 권한 토글
  const handlePermissionToggle = (roleId: UserRoleType, permission: string, hasPermission: boolean) => {
    try {
      if (hasPermission) {
        removePermissionFromRole(roleId, permission);
      } else {
        addPermissionToRole(roleId, permission);
      }
      refreshData();
      
      emitPermissionChange({
        type: 'role_permission_changed',
        roleId,
        permission,
        action: hasPermission ? 'removed' : 'added',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('권한 변경 오류:', error);
      alert(`❌ 권한 변경 실패: ${error.message}`);
    }
  };

  // 🔥 데이터 내보내기
  const handleExport = () => {
    try {
      const data = exportData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `permission_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      alert(`✅ 권한 설정 백업 완료!\n파일명: permission_backup_${new Date().toISOString().split('T')[0]}.json`);
      
    } catch (error) {
      console.error('데이터 내보내기 오류:', error);
      alert(`❌ 데이터 내보내기 실패: ${error.message}`);
    }
  };

  // 🔥 데이터 가져오기
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          if (importData(content)) {
            refreshData();
            alert(`✅ 데이터 가져오기 완료!\n${pages.length}개 페이지, ${roles.length}개 역할이 복원되었습니다.`);
          } else {
            alert('❌ 데이터 가져오기 실패! 파일 형식을 확인해주세요.');
          }
        } catch (error) {
          console.error('데이터 가져오기 오류:', error);
          alert(`❌ 데이터 가져오기 실패: ${error.message}`);
        }
      };
      reader.readAsText(file);
    }
    
    // 파일 선택 초기화
    event.target.value = '';
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* 🔥 헤더 섹션 */}
      <div style={{ marginBottom: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div>
            <h1 style={{ 
              fontSize: '36px', 
              fontWeight: 'bold', 
              marginBottom: '8px', 
              background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', 
              WebkitBackgroundClip: 'text', 
              WebkitTextFillColor: 'transparent' 
            }}>
              🚀 실시간 페이지/메뉴/권한 관리 시스템
            </h1>
            <p style={{ color: '#6b7280', fontSize: '18px', lineHeight: '1.6' }}>
              페이지를 생성하고, 메뉴를 구성하고, 권한을 설정하세요. 모든 변경사항이 즉시 반영됩니다.
            </p>
          </div>
          
          <div style={{ 
            backgroundColor: 'white', 
            padding: '16px 20px', 
            borderRadius: '12px', 
            border: '1px solid #e5e7eb',
            textAlign: 'right',
            minWidth: '180px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#3b82f6', marginBottom: '4px' }}>
              {pages.length}
            </div>
            <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>
              활성 페이지
            </div>
            <div style={{ fontSize: '20px', fontWeight: '600', color: '#8b5cf6', marginBottom: '4px' }}>
              {roles.length}
            </div>
            <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>
              역할
            </div>
            {lastUpdate && (
              <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                업데이트: {lastUpdate}
              </div>
            )}
          </div>
        </div>
        
        {/* 🔥 실시간 상태 표시 */}
        <div style={{ 
          backgroundColor: '#f0f9ff', 
          padding: '16px 20px', 
          borderRadius: '12px',
          border: '1px solid #0ea5e9',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '10px',
            height: '10px',
            backgroundColor: '#10b981',
            borderRadius: '50%',
            animation: 'pulse 2s infinite'
          }}></div>
          <div style={{ flex: 1 }}>
            <span style={{ color: '#0369a1', fontWeight: '600', fontSize: '16px' }}>실시간 모드 활성</span>
            <span style={{ color: '#075985', marginLeft: '12px', fontSize: '14px' }}>
              • 페이지 {pages.length}개 • 역할 {roles.length}개 • 즉시 반영 • localStorage 저장
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '8px 16px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              🔄 새로고침
            </button>
            <button
              onClick={() => {
                if (confirm('⚠️ 권한 시스템을 초기화하시겠습니까?\n모든 커스텀 설정이 사라집니다.')) {
                  localStorage.removeItem('dynamic_permission_system');
                  window.location.reload();
                }
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              🗑️ 초기화
            </button>
          </div>
        </div>
      </div>

      {/* 🔥 탭 네비게이션 */}
      <div style={{ 
        borderBottom: '2px solid #e5e7eb', 
        marginBottom: '30px',
        display: 'flex',
        gap: '0'
      }}>
        {[
          { id: 'pages', name: '📄 페이지 관리', desc: `${pages.filter(p => p.isActive).length}/${pages.length}개` },
          { id: 'roles', name: '👥 역할 관리', desc: `${roles.filter(r => r.isActive).length}개` },
          { id: 'permissions', name: '🔐 권한 매트릭스', desc: '실시간' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '16px 32px',
              backgroundColor: activeTab === tab.id ? '#3b82f6' : 'transparent',
              color: activeTab === tab.id ? 'white' : '#6b7280',
              border: 'none',
              borderBottom: activeTab === tab.id ? '3px solid #3b82f6' : '3px solid transparent',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '600',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.2s',
              borderRadius: '8px 8px 0 0'
            }}
            onMouseOver={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.backgroundColor = '#f3f4f6';
                e.currentTarget.style.color = '#374151';
              }
            }}
            onMouseOut={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#6b7280';
              }
            }}
          >
            <span>{tab.name}</span>
            <span style={{ fontSize: '12px', opacity: 0.8 }}>{tab.desc}</span>
          </button>
        ))}
      </div>

      {/* 🔥 페이지 관리 탭 */}
      {activeTab === 'pages' && (
        <div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '24px' 
          }}>
            <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#1f2937' }}>📄 페이지 관리</h2>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ 
                color: '#6b7280', 
                fontSize: '14px',
                padding: '8px 12px',
                backgroundColor: '#f9fafb',
                borderRadius: '6px',
                border: '1px solid #e5e7eb'
              }}>
                총 {pages.length}개 ({pages.filter(p => p.isActive).length}개 활성)
              </div>
              <button
                onClick={() => setShowAddPageModal(true)}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#059669',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#047857'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#059669'}
              >
                <span>+</span> 새 페이지 추가
              </button>
              <button 
                onClick={handleExport} 
                style={{ 
                  padding: '12px 20px', 
                  backgroundColor: '#6b7280', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '8px', 
                  cursor: 'pointer',
                  fontWeight: '500',
                  fontSize: '14px'
                }}
              >
                📤 백업
              </button>
              <label style={{ 
                padding: '12px 20px', 
                backgroundColor: '#3b82f6', 
                color: 'white', 
                borderRadius: '8px', 
                cursor: 'pointer',
                fontWeight: '500',
                fontSize: '14px'
              }}>
                📥 복원
                <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
              </label>
            </div>
          </div>

          {/* 페이지 목록 테이블 */}
          <div style={{ 
            backgroundColor: 'white', 
            border: '1px solid #e5e7eb', 
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <th style={{ padding: '16px 20px', textAlign: 'left', border: '1px solid #e5e7eb', fontWeight: '600', color: '#374151' }}>순서</th>
                  <th style={{ padding: '16px 20px', textAlign: 'left', border: '1px solid #e5e7eb', fontWeight: '600', color: '#374151' }}>페이지 정보</th>
                  <th style={{ padding: '16px 20px', textAlign: 'left', border: '1px solid #e5e7eb', fontWeight: '600', color: '#374151' }}>경로</th>
                  <th style={{ padding: '16px 20px', textAlign: 'left', border: '1px solid #e5e7eb', fontWeight: '600', color: '#374151' }}>카테고리</th>
                  <th style={{ padding: '16px 20px', textAlign: 'left', border: '1px solid #e5e7eb', fontWeight: '600', color: '#374151' }}>허용 역할</th>
                  <th style={{ padding: '16px 20px', textAlign: 'center', border: '1px solid #e5e7eb', fontWeight: '600', color: '#374151' }}>상태</th>
                  <th style={{ padding: '16px 20px', textAlign: 'center', border: '1px solid #e5e7eb', fontWeight: '600', color: '#374151' }}>작업</th>
                </tr>
              </thead>
              <tbody>
                {pages.map((page, index) => (
                  <tr key={page.id} style={{ 
                    backgroundColor: !page.isActive ? '#fef2f2' : (index % 2 === 0 ? 'white' : '#f9fafb'),
                    transition: 'background-color 0.2s'
                  }}>
                    <td style={{ padding: '16px 20px', border: '1px solid #e5e7eb' }}>
                      <span style={{ 
                        backgroundColor: '#e0f2fe', 
                        color: '#0369a1', 
                        padding: '4px 8px', 
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        #{page.order}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', border: '1px solid #e5e7eb' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '24px' }}>{page.icon}</span>
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '16px', color: '#1f2937', marginBottom: '4px' }}>
                            {page.name}
                          </div>
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>
                            ID: {page.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px', border: '1px solid #e5e7eb' }}>
                      <code style={{ 
                        backgroundColor: '#f3f4f6', 
                        padding: '6px 10px', 
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: '500',
                        color: '#374151',
                        border: '1px solid #e5e7eb'
                      }}>
                        {page.path}
                      </code>
                    </td>
                    <td style={{ padding: '16px 20px', border: '1px solid #e5e7eb' }}>
                      <span style={{ 
                        backgroundColor: '#e0f2fe', 
                        color: '#0369a1', 
                        padding: '4px 12px', 
                        borderRadius: '16px',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}>
                        {page.category}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', border: '1px solid #e5e7eb' }}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {page.allowedRoles.map(role => {
                          const roleInfo = roles.find(r => r.id === role);
                          return (
                            <span key={role} style={{ 
                              backgroundColor: roleInfo?.color || '#6b7280', 
                              color: 'white', 
                              padding: '3px 8px', 
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '500'
                            }}>
                              {roleInfo?.name || role}
                            </span>
                          );
                        })}
                        {page.allowedRoles.length === 0 && (
                          <span style={{ 
                            color: '#dc2626',
                            fontSize: '12px',
                            fontStyle: 'italic'
                          }}>
                            접근 불가
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                      <span style={{ 
                        color: page.isActive ? '#059669' : '#dc2626',
                        fontWeight: '600',
                        fontSize: '14px',
                        padding: '6px 12px',
                        backgroundColor: page.isActive ? '#d1fae5' : '#fee2e2',
                        borderRadius: '6px'
                      }}>
                        {page.isActive ? '✅ 활성' : '❌ 비활성'}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          onClick={() => setEditingPage(page)}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '500',
                            transition: 'all 0.2s'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
                        >
                          ✏️ 수정
                        </button>
                        <button
                          onClick={() => handleDeletePage(page.id, page.name)}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: '#dc2626',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '500',
                            transition: 'all 0.2s'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                        >
                          🗑️ 삭제
                        </button>
                        {page.path && (
                          <button
                            onClick={() => window.open(page.path, '_blank')}
                            style={{
                              padding: '8px 16px',
                              backgroundColor: '#059669',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '500',
                              transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#047857'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#059669'}
                          >
                            🔗 이동
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {pages.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ 
                      padding: '40px', 
                      textAlign: 'center', 
                      color: '#6b7280',
                      fontSize: '16px'
                    }}>
                      페이지가 없습니다. 새 페이지를 추가해보세요! 🚀
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 🔥 역할 관리 탭 */}
      {activeTab === 'roles' && (
        <div>
          <h2 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '24px', color: '#1f2937' }}>👥 역할 관리</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px' }}>
            {roles.map(role => (
              <div key={role.id} style={{ 
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '16px',
                padding: '24px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.2s'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ 
                    width: '24px', 
                    height: '24px', 
                    backgroundColor: role.color, 
                    borderRadius: '50%',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                  }}></div>
                  <h3 style={{ fontSize: '20px', fontWeight: '700', margin: 0, color: '#1f2937' }}>
                    {role.name}
                  </h3>
                  <span style={{ 
                    fontSize: '12px', 
                    color: '#6b7280', 
                    backgroundColor: '#f3f4f6', 
                    padding: '4px 8px', 
                    borderRadius: '6px',
                    fontWeight: '500'
                  }}>
                    Level {role.level}
                  </span>
                </div>
                
                <div style={{ marginBottom: '16px' }}>
                  <strong style={{ fontSize: '14px', marginBottom: '8px', display: 'block', color: '#374151' }}>
                    보유 권한:
                  </strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {role.permissions.map(perm => (
                      <span key={perm} style={{ 
                        fontSize: '12px', 
                        backgroundColor: perm === '*' ? '#dc2626' : '#e0f2fe', 
                        color: perm === '*' ? 'white' : '#0369a1',
                        padding: '4px 10px', 
                        borderRadius: '6px',
                        fontWeight: '500'
                      }}>
                        {perm === '*' ? '🔥 모든 권한' : perm}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div style={{ marginBottom: '16px' }}>
                  <strong style={{ fontSize: '14px', marginBottom: '8px', display: 'block', color: '#374151' }}>
                    접근 가능한 페이지:
                  </strong>
                  <div style={{ 
                    fontSize: '14px', 
                    color: '#6b7280',
                    backgroundColor: '#f9fafb',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb'
                  }}>
                    {pages.filter(page => page.allowedRoles.includes(role.id) || role.permissions.includes('*')).length}개 페이지
                  </div>
                </div>
                
                <div style={{ 
                  padding: '12px', 
                  backgroundColor: role.isActive ? '#d1fae5' : '#fee2e2',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <span style={{ 
                    color: role.isActive ? '#059669' : '#dc2626',
                    fontWeight: '600',
                    fontSize: '14px'
                  }}>
                    {role.isActive ? '✅ 활성 역할' : '❌ 비활성 역할'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 🔥 권한 매트릭스 탭 */}
      {activeTab === 'permissions' && (
        <div>
          <h2 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '24px', color: '#1f2937' }}>🔐 권한 매트릭스</h2>
          
          <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#f0f9ff', borderRadius: '12px', border: '1px solid #0ea5e9' }}>
            <p style={{ margin: 0, color: '#0369a1', fontSize: '14px' }}>
              ✨ <strong>실시간 권한 관리:</strong> 체크박스를 클릭하면 즉시 권한이 변경됩니다. 
              슈퍼 권한(🔥)을 가진 역할은 모든 페이지에 자동으로 접근 가능합니다.
            </p>
          </div>
          
          <div style={{ overflowX: 'auto', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse',
              minWidth: '800px'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <th style={{ 
                    padding: '20px', 
                    textAlign: 'left', 
                    border: '1px solid #e5e7eb',
                    fontWeight: '700',
                    color: '#1f2937',
                    fontSize: '14px',
                    minWidth: '250px',
                    position: 'sticky',
                    left: 0,
                    backgroundColor: '#f8fafc',
                    zIndex: 10
                  }}>
                    페이지 정보
                  </th>
                  {roles.map(role => (
                    <th key={role.id} style={{ 
                      padding: '20px', 
                      textAlign: 'center', 
                      border: '1px solid #e5e7eb',
                      color: role.color,
                      fontSize: '13px',
                      fontWeight: '700',
                      minWidth: '120px',
                      lineHeight: '1.2'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <div style={{
                          width: '16px',
                          height: '16px',
                          backgroundColor: role.color,
                          borderRadius: '50%'
                        }}></div>
                        <div>{role.name}</div>
                        <div style={{ fontSize: '10px', opacity: 0.8 }}>
                          Level {role.level}
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pages.map((page, index) => (
                  <tr key={page.id} style={{ 
                    backgroundColor: index % 2 === 0 ? 'white' : '#f9fafb',
                    opacity: page.isActive ? 1 : 0.6
                  }}>
                    <td style={{ 
                      padding: '16px 20px', 
                      border: '1px solid #e5e7eb',
                      position: 'sticky',
                      left: 0,
                      backgroundColor: index % 2 === 0 ? 'white' : '#f9fafb',
                      zIndex: 5
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '20px' }}>{page.icon}</span>
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '14px', color: '#1f2937', marginBottom: '4px' }}>
                            {page.name}
                          </div>
                          <div style={{ 
                            fontSize: '11px', 
                            color: '#6b7280', 
                            fontFamily: 'monospace',
                            backgroundColor: '#f3f4f6',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            display: 'inline-block'
                          }}>
                            {page.path}
                          </div>
                          <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '2px' }}>
                            {page.category} • #{page.order}
                          </div>
                        </div>
                      </div>
                    </td>
                    {roles.map(role => {
                      const hasAccess = page.allowedRoles.includes(role.id) || role.permissions.includes('*');
                      const isSuper = role.permissions.includes('*');
                      
                      return (
                        <td key={role.id} style={{ 
                          padding: '16px', 
                          textAlign: 'center', 
                          border: '1px solid #e5e7eb',
                          backgroundColor: hasAccess ? '#dcfce7' : '#fef2f2',
                          transition: 'all 0.2s'
                        }}>
                          <button
                            onClick={() => {
                              if (!isSuper) {
                                if (hasAccess) {
                                  const updatedRoles = page.allowedRoles.filter(r => r !== role.id);
                                  handleUpdatePage(page.id, { allowedRoles: updatedRoles });
                                } else {
                                  const updatedRoles = [...page.allowedRoles, role.id];
                                  handleUpdatePage(page.id, { allowedRoles: updatedRoles });
                                }
                              }
                            }}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              fontSize: '24px',
                              cursor: isSuper ? 'not-allowed' : 'pointer',
                              opacity: isSuper ? 0.7 : 1,
                              padding: '8px',
                              borderRadius: '8px',
                              transition: 'all 0.2s'
                            }}
                            disabled={isSuper}
                            title={
                              isSuper 
                                ? `🔥 ${role.name}은(는) 슈퍼 권한으로 자동 접근 허용` 
                                : `클릭하여 ${role.name}의 "${page.name}" 페이지 접근 권한 ${hasAccess ? '제거' : '부여'}`
                            }
                            onMouseOver={(e) => {
                              if (!isSuper) {
                                e.currentTarget.style.transform = 'scale(1.1)';
                                e.currentTarget.style.backgroundColor = hasAccess ? '#fca5a5' : '#86efac';
                              }
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.transform = 'scale(1)';
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            {isSuper ? '🔥' : (hasAccess ? '✅' : '❌')}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* 권한 매트릭스 통계 */}
          <div style={{ 
            marginTop: '24px', 
            padding: '20px', 
            backgroundColor: '#f9fafb', 
            borderRadius: '12px',
            border: '1px solid #e5e7eb' 
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#1f2937' }}>
              📊 권한 통계
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              {roles.map(role => {
                const accessiblePages = pages.filter(page => 
                  page.allowedRoles.includes(role.id) || role.permissions.includes('*')
                ).length;
                const percentage = pages.length > 0 ? Math.round((accessiblePages / pages.length) * 100) : 0;
                
                return (
                  <div key={role.id} style={{
                    backgroundColor: 'white',
                    padding: '16px',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <div style={{
                        width: '12px',
                        height: '12px',
                        backgroundColor: role.color,
                        borderRadius: '50%'
                      }}></div>
                      <span style={{ fontWeight: '600', fontSize: '14px' }}>{role.name}</span>
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: role.color }}>
                      {accessiblePages}/{pages.length}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      {percentage}% 접근 가능
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 🔥 새 페이지 추가 모달 */}
      {showAddPageModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '32px',
            borderRadius: '16px',
            width: '550px',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <h3 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '24px', color: '#1f2937' }}>
              📄 새 페이지 추가
            </h3>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target as HTMLFormElement);
              const allowedRoles = Array.from(formData.getAll('allowedRoles')) as UserRoleType[];
              const requiredPermissions = formData.get('requiredPermissions')?.toString().split(',').map(s => s.trim()).filter(Boolean) || [];
              
              handleAddPage({
                id: formData.get('id'),
                name: formData.get('name'),
                path: formData.get('path'),
                icon: formData.get('icon'),
                category: formData.get('category'),
                allowedRoles,
                requiredPermissions
              });
            }}>
              <div style={{ display: 'grid', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                    페이지 ID *
                  </label>
                  <input 
                    name="id" 
                    type="text" 
                    required 
                    placeholder="예: my-new-page"
                    style={{ 
                      width: '100%', 
                      padding: '12px 16px', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '8px',
                      fontSize: '14px'
                    }} 
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                    페이지 이름 *
                  </label>
                  <input 
                    name="name" 
                    type="text" 
                    required 
                    placeholder="예: 새로운 기능"
                    style={{ 
                      width: '100%', 
                      padding: '12px 16px', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '8px',
                      fontSize: '14px'
                    }} 
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                    경로 *
                  </label>
                  <input 
                    name="path" 
                    type="text" 
                    required 
                    placeholder="예: /my-new-page"
                    style={{ 
                      width: '100%', 
                      padding: '12px 16px', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontFamily: 'monospace'
                    }} 
                  />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                      아이콘
                    </label>
                    <input 
                      name="icon" 
                      type="text" 
                      placeholder="📄"
                      style={{ 
                        width: '100%', 
                        padding: '12px 16px', 
                        border: '1px solid #d1d5db', 
                        borderRadius: '8px',
                        fontSize: '14px',
                        textAlign: 'center'
                      }} 
                    />
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                      카테고리
                    </label>
                    <input 
                      name="category" 
                      type="text" 
                      placeholder="기본"
                      style={{ 
                        width: '100%', 
                        padding: '12px 16px', 
                        border: '1px solid #d1d5db', 
                        borderRadius: '8px',
                        fontSize: '14px'
                      }} 
                    />
                  </div>
                </div>
                
                <div>
                  <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', color: '#374151' }}>
                    허용 역할
                  </label>
                  <div style={{ 
                    border: '1px solid #d1d5db', 
                    borderRadius: '8px', 
                    padding: '16px',
                    backgroundColor: '#f9fafb'
                  }}>
                    {roles.map(role => (
                      <label key={role.id} style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '12px', 
                        marginBottom: '12px',
                        padding: '8px',
                        backgroundColor: 'white',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}>
                        <input type="checkbox" name="allowedRoles" value={role.id} />
                        <div style={{ width: '16px', height: '16px', backgroundColor: role.color, borderRadius: '50%' }}></div>
                        <span style={{ fontWeight: '500' }}>{role.name}</span>
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>Level {role.level}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                    필요 권한 (콤마로 구분)
                  </label>
                  <input 
                    name="requiredPermissions" 
                    type="text" 
                    placeholder="예: dashboard.view, new_feature.access"
                    style={{ 
                      width: '100%', 
                      padding: '12px 16px', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontFamily: 'monospace'
                    }} 
                  />
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '32px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddPageModal(false)}
                  style={{ 
                    padding: '12px 24px', 
                    backgroundColor: '#6b7280', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '8px', 
                    cursor: 'pointer',
                    fontWeight: '500',
                    fontSize: '14px'
                  }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  style={{ 
                    padding: '12px 24px', 
                    backgroundColor: '#059669', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '8px', 
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px'
                  }}
                >
                  페이지 추가
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🔥 페이지 수정 모달 */}
      {editingPage && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '32px',
            borderRadius: '16px',
            width: '550px',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <h3 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '24px', color: '#1f2937' }}>
              ✏️ 페이지 수정: {editingPage.name}
            </h3>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target as HTMLFormElement);
              const allowedRoles = Array.from(formData.getAll('allowedRoles')) as UserRoleType[];
              const requiredPermissions = formData.get('requiredPermissions')?.toString().split(',').map(s => s.trim()).filter(Boolean) || [];
              
              handleUpdatePage(editingPage.id, {
                name: formData.get('name')?.toString(),
                path: formData.get('path')?.toString(),
                icon: formData.get('icon')?.toString(),
                category: formData.get('category')?.toString(),
                allowedRoles,
                requiredPermissions,
                isActive: formData.get('isActive') === 'on'
              });
            }}>
              <div style={{ display: 'grid', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                    페이지 이름 *
                  </label>
                  <input 
                    name="name" 
                    type="text" 
                    defaultValue={editingPage.name} 
                    required 
                    style={{ 
                      width: '100%', 
                      padding: '12px 16px', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '8px',
                      fontSize: '14px'
                    }} 
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                    경로 *
                  </label>
                  <input 
                    name="path" 
                    type="text" 
                    defaultValue={editingPage.path} 
                    required 
                    style={{ 
                      width: '100%', 
                      padding: '12px 16px', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontFamily: 'monospace'
                    }} 
                  />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                      아이콘
                    </label>
                    <input 
                      name="icon" 
                      type="text" 
                      defaultValue={editingPage.icon}
                      style={{ 
                        width: '100%', 
                        padding: '12px 16px', 
                        border: '1px solid #d1d5db', 
                        borderRadius: '8px',
                        fontSize: '14px',
                        textAlign: 'center'
                      }} 
                    />
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                      카테고리
                    </label>
                    <input 
                      name="category" 
                      type="text" 
                      defaultValue={editingPage.category}
                      style={{ 
                        width: '100%', 
                        padding: '12px 16px', 
                        border: '1px solid #d1d5db', 
                        borderRadius: '8px',
                        fontSize: '14px'
                      }} 
                    />
                  </div>
                </div>
                
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    <input type="checkbox" name="isActive" defaultChecked={editingPage.isActive} />
                    <span style={{ fontWeight: '600', color: '#374151' }}>페이지 활성화</span>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>비활성화하면 메뉴에서 숨겨집니다</span>
                  </label>
                </div>
                
                <div>
                  <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', color: '#374151' }}>
                    허용 역할
                  </label>
                  <div style={{ 
                    border: '1px solid #d1d5db', 
                    borderRadius: '8px', 
                    padding: '16px',
                    backgroundColor: '#f9fafb'
                  }}>
                    {roles.map(role => (
                      <label key={role.id} style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '12px', 
                        marginBottom: '12px',
                        padding: '8px',
                        backgroundColor: 'white',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}>
                        <input 
                          type="checkbox" 
                          name="allowedRoles" 
                          value={role.id}
                          defaultChecked={editingPage.allowedRoles.includes(role.id)}
                        />
                        <div style={{ width: '16px', height: '16px', backgroundColor: role.color, borderRadius: '50%' }}></div>
                        <span style={{ fontWeight: '500' }}>{role.name}</span>
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>Level {role.level}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                    필요 권한 (콤마로 구분)
                  </label>
                  <input 
                    name="requiredPermissions" 
                    type="text" 
                    defaultValue={editingPage.requiredPermissions.join(', ')}
                    style={{ 
                      width: '100%', 
                      padding: '12px 16px', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontFamily: 'monospace'
                    }} 
                  />
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '32px' }}>
                <button
                  type="button"
                  onClick={() => setEditingPage(null)}
                  style={{ 
                    padding: '12px 24px', 
                    backgroundColor: '#6b7280', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '8px', 
                    cursor: 'pointer',
                    fontWeight: '500',
                    fontSize: '14px'
                  }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  style={{ 
                    padding: '12px 24px', 
                    backgroundColor: '#3b82f6', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '8px', 
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px'
                  }}
                >
                  수정 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* 🔥 CSS 애니메이션 */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { 
            opacity: 1; 
            transform: scale(1);
          }
          50% { 
            opacity: 0.7; 
            transform: scale(1.05);
          }
        }
      `}</style>
    </div>
  );
}

export default DynamicPermissionPage;
